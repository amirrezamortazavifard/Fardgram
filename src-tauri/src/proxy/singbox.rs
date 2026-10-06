/// Sing-box proxy core integration.
///
/// Downloads the official `sing-box` binary from GitHub releases (with fast CDN/mirror fallbacks),
/// manages its lifecycle as a background process, generates valid sing-box configurations
/// for VLESS, VMess, Trojan, Shadowsocks, and raw JSON formats, and exposes a local SOCKS5
/// inbound that TDLib connects to.
use base64::prelude::*;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{
    io::Read,
    net::{SocketAddr, TcpStream},
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};
use tauri::{AppHandle, State};

pub const DEFAULT_SINGBOX_PORT: u16 = 10808;
pub const SINGBOX_BIND_ADDR: &str = "127.0.0.1";

const STARTUP_PROBE_TIMEOUT: Duration = Duration::from_secs(12);
const STARTUP_PROBE_INTERVAL: Duration = Duration::from_millis(350);
const DOWNLOAD_TIMEOUT: Duration = Duration::from_secs(90);

/// Official SagerNet/sing-box v1.11.4 — Windows amd64
const SINGBOX_VERSION: &str = "v1.11.4";
const SINGBOX_WINDOWS_AMD64_URL: &str =
    "https://github.com/SagerNet/sing-box/releases/download/v1.11.4/sing-box-1.11.4-windows-amd64.zip";
const SINGBOX_MIRROR_1: &str =
    "https://ghproxy.net/https://github.com/SagerNet/sing-box/releases/download/v1.11.4/sing-box-1.11.4-windows-amd64.zip";
const SINGBOX_MIRROR_2: &str =
    "https://github.moeyy.xyz/https://github.com/SagerNet/sing-box/releases/download/v1.11.4/sing-box-1.11.4-windows-amd64.zip";

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum SingboxState {
    Idle,
    Downloading { progress: u8 },
    Starting,
    Running {
        port: u16,
        active_profile: Option<String>,
    },
    Stopped,
    Error { message: String },
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedProxyNode {
    pub id: String,
    pub name: String,
    pub protocol: String,
    pub server: String,
    pub port: u16,
    pub raw_link: String,
    pub outbound_json: Value,
    pub latency_ms: Option<u64>,
}

struct SingboxProcessGuard {
    child: Child,
}

impl Drop for SingboxProcessGuard {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

#[derive(Default)]
pub struct SingboxRuntime {
    inner: Arc<Mutex<SingboxRuntimeInner>>,
}

#[derive(Default)]
struct SingboxRuntimeInner {
    state: Option<SingboxState>,
    process: Option<SingboxProcessGuard>,
    active_profile: Option<String>,
    active_port: Option<u16>,
}

impl SingboxRuntime {
    pub fn state(&self) -> SingboxState {
        self.inner
            .lock()
            .map(|g| g.state.clone().unwrap_or(SingboxState::Idle))
            .unwrap_or(SingboxState::Idle)
    }

    fn set_state(&self, state: SingboxState) {
        if let Ok(mut guard) = self.inner.lock() {
            guard.state = Some(state);
        }
    }

    pub fn stop(&self) {
        if let Ok(mut guard) = self.inner.lock() {
            guard.process = None; // Drop kills process
            guard.active_profile = None;
            guard.active_port = None;
            guard.state = Some(SingboxState::Stopped);
        }
    }

    pub fn start(
        &self,
        app: &AppHandle,
        config_content: &str,
        port: Option<u16>,
        routing_mode: Option<String>,
        profile_name: Option<String>,
    ) -> Result<SingboxState, String> {
        let socks_port = port.unwrap_or(DEFAULT_SINGBOX_PORT);
        let route_mode = routing_mode.unwrap_or_else(|| "rule".to_string());

        // Stop any running instance first to reload cleanly
        self.stop();

        self.set_state(SingboxState::Downloading { progress: 0 });

        let binary_path = singbox_binary_path(app)?;
        ensure_binary(self, &binary_path)?;

        self.set_state(SingboxState::Starting);

        // Build valid complete sing-box configuration
        let full_config = build_full_singbox_config(config_content, socks_port, &route_mode)?;

        let config_path = singbox_config_file_path(app)?;
        std::fs::write(&config_path, serde_json::to_string_pretty(&full_config).map_err(|e| e.to_string())?)
            .map_err(|e| format!("Cannot save sing-box config: {e}"))?;

        // Launch sing-box process
        let mut cmd = Command::new(&binary_path);
        cmd.args(["run", "-c", config_path.to_str().unwrap_or("config.json")]);
        cmd.stdout(Stdio::null())
            .stderr(Stdio::null())
            .stdin(Stdio::null());

        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }

        let child = cmd
            .spawn()
            .map_err(|e| format!("Failed to launch sing-box: {e}"))?;

        {
            let mut guard = self.inner.lock().map_err(|e| e.to_string())?;
            guard.process = Some(SingboxProcessGuard { child });
            guard.active_profile = profile_name.clone();
            guard.active_port = Some(socks_port);
        }

        // Wait until SOCKS5 port accepts connections
        wait_for_socks5_ready(socks_port)?;

        let ready = SingboxState::Running {
            port: socks_port,
            active_profile: profile_name,
        };
        self.set_state(ready.clone());
        Ok(ready)
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Tauri Commands
// ──────────────────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn telegram_singbox_status(runtime: State<'_, SingboxRuntime>) -> SingboxState {
    runtime.state()
}

#[tauri::command]
pub fn telegram_singbox_start(
    app: AppHandle,
    config: String,
    port: Option<u16>,
    routing_mode: Option<String>,
    profile_name: Option<String>,
    runtime: State<'_, SingboxRuntime>,
) -> Result<SingboxState, String> {
    runtime.start(&app, &config, port, routing_mode, profile_name)
}

#[tauri::command]
pub fn telegram_singbox_stop(runtime: State<'_, SingboxRuntime>) {
    runtime.stop();
}

#[tauri::command]
pub fn telegram_singbox_test_node(
    server: String,
    port: u16,
    timeout_ms: Option<u64>,
) -> Result<u64, String> {
    test_node_latency(&server, port, timeout_ms.unwrap_or(2500))
}

#[tauri::command]
pub fn telegram_singbox_parse_link(link: String) -> Result<ParsedProxyNode, String> {
    parse_single_proxy_link(&link)
}

#[tauri::command]
pub fn telegram_singbox_fetch_subscription(url: String) -> Result<Vec<ParsedProxyNode>, String> {
    fetch_subscription_nodes(&url)
}

// ──────────────────────────────────────────────────────────────────────────────
// Binary Management & Helpers
// ──────────────────────────────────────────────────────────────────────────────

fn singbox_binary_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = crate::distribution::app_data_directory(app)
        .map_err(|e| format!("Cannot resolve app-data directory: {e}"))?;
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("Cannot create app-data directory: {e}"))?;
    Ok(dir.join(format!("sing-box-{}.exe", SINGBOX_VERSION)))
}

fn singbox_config_file_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = crate::distribution::app_data_directory(app)
        .map_err(|e| format!("Cannot resolve app-data directory: {e}"))?;
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("Cannot create app-data directory: {e}"))?;
    Ok(dir.join("sing-box-config.json"))
}

fn ensure_binary(runtime: &SingboxRuntime, path: &PathBuf) -> Result<(), String> {
    const MIN_BINARY_BYTES: u64 = 8 * 1024 * 1024; // 8 MB floor for sing-box

    if path.exists() {
        let size = std::fs::metadata(path).map(|m| m.len()).unwrap_or(0);
        if size >= MIN_BINARY_BYTES {
            return Ok(());
        }
        let _ = std::fs::remove_file(path);
    }

    download_binary(runtime, path)
}

fn download_binary(runtime: &SingboxRuntime, dest: &PathBuf) -> Result<(), String> {
    let client = reqwest::blocking::Client::builder()
        .timeout(DOWNLOAD_TIMEOUT)
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Fardgram/0.5.0")
        .build()
        .map_err(|e| format!("HTTP client error: {e}"))?;

    runtime.set_state(SingboxState::Downloading { progress: 10 });

    let mirrors = [
        SINGBOX_WINDOWS_AMD64_URL,
        SINGBOX_MIRROR_1,
        SINGBOX_MIRROR_2,
    ];

    let zip_bytes = mirrors
        .iter()
        .find_map(|url| {
            client
                .get(*url)
                .send()
                .ok()
                .filter(|r| r.status().is_success())
                .and_then(|r| r.bytes().ok())
        })
        .ok_or_else(|| {
            "Unable to download sing-box core: all download mirrors failed. Please check your internet connection.".to_string()
        })?;

    runtime.set_state(SingboxState::Downloading { progress: 65 });

    let cursor = std::io::Cursor::new(&zip_bytes[..]);
    let mut archive =
        zip::ZipArchive::new(cursor).map_err(|e| format!("Invalid sing-box zip archive: {e}"))?;

    let exe_bytes = (0..archive.len())
        .find_map(|i| {
            archive.by_index(i).ok().and_then(|mut f| {
                let name = f.name().to_ascii_lowercase();
                if name.ends_with("sing-box.exe") || name.ends_with("sing-box") {
                    let mut buf = Vec::new();
                    f.read_to_end(&mut buf).ok()?;
                    Some(buf)
                } else {
                    None
                }
            })
        })
        .ok_or_else(|| "sing-box executable not found inside zip archive".to_string())?;

    runtime.set_state(SingboxState::Downloading { progress: 90 });

    std::fs::write(dest, &exe_bytes)
        .map_err(|e| format!("Cannot write sing-box binary: {e}"))?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = std::fs::metadata(dest).map_err(|e| e.to_string())?.permissions();
        perms.set_mode(0o755);
        let _ = std::fs::set_permissions(dest, perms);
    }

    runtime.set_state(SingboxState::Downloading { progress: 100 });
    Ok(())
}

fn wait_for_socks5_ready(port: u16) -> Result<(), String> {
    let deadline = Instant::now() + STARTUP_PROBE_TIMEOUT;
    let target = format!("{}:{}", SINGBOX_BIND_ADDR, port);

    while Instant::now() < deadline {
        if TcpStream::connect_timeout(
            &target.parse().map_err(|e| format!("{e}"))?,
            STARTUP_PROBE_INTERVAL,
        )
        .is_ok()
        {
            return Ok(());
        }
        std::thread::sleep(STARTUP_PROBE_INTERVAL);
    }

    Err(format!(
        "sing-box failed to bind local SOCKS5 port {port} within {} seconds",
        STARTUP_PROBE_TIMEOUT.as_secs()
    ))
}

pub fn test_node_latency(server: &str, port: u16, timeout_ms: u64) -> Result<u64, String> {
    let addr_str = format!("{}:{}", server.trim(), port);
    let timeout = Duration::from_millis(timeout_ms);
    let start = Instant::now();

    // Try resolving or direct socket connect
    let addrs: Vec<SocketAddr> = std::net::ToSocketAddrs::to_socket_addrs(&addr_str)
        .map_err(|e| format!("DNS resolve error: {e}"))?
        .collect();

    if addrs.is_empty() {
        return Err("No IP addresses found for host".to_string());
    }

    let stream = TcpStream::connect_timeout(&addrs[0], timeout)
        .map_err(|e| format!("Connection error: {e}"))?;

    drop(stream);
    Ok(start.elapsed().as_millis() as u64)
}

// ──────────────────────────────────────────────────────────────────────────────
// Configuration Generation & Parsing
// ──────────────────────────────────────────────────────────────────────────────

pub fn build_full_singbox_config(
    input: &str,
    listen_port: u16,
    routing_mode: &str,
) -> Result<Value, String> {
    let trimmed = input.trim();

    // Check if input is already a complete sing-box JSON configuration
    if trimmed.starts_with('{') {
        if let Ok(mut parsed) = serde_json::from_str::<Value>(trimmed) {
            if parsed.get("outbounds").is_some() {
                // Ensure SOCKS5 inbound is present and set to our target listen_port
                let inbound = json!({
                    "type": "socks",
                    "tag": "socks-in",
                    "listen": SINGBOX_BIND_ADDR,
                    "listen_port": listen_port,
                    "sniff": true
                });

                if let Some(inbounds) = parsed.get_mut("inbounds").and_then(Value::as_array_mut) {
                    // Check if a socks inbound already exists; replace or prepend
                    if let Some(pos) = inbounds.iter().position(|i| i.get("type").and_then(Value::as_str) == Some("socks")) {
                        inbounds[pos] = inbound;
                    } else {
                        inbounds.insert(0, inbound);
                    }
                } else {
                    parsed["inbounds"] = json!([inbound]);
                }

                return Ok(parsed);
            } else if parsed.get("type").is_some() {
                // Single outbound object passed as JSON
                return Ok(wrap_outbound_into_config(parsed, listen_port, routing_mode));
            }
        }
    }

    // Try parsing as a URL/link (VLESS, VMess, Trojan, SS)
    let parsed_node = parse_single_proxy_link(trimmed)?;
    Ok(wrap_outbound_into_config(parsed_node.outbound_json, listen_port, routing_mode))
}

fn wrap_outbound_into_config(outbound: Value, listen_port: u16, routing_mode: &str) -> Value {
    let outbounds = vec![
        outbound,
        json!({
            "type": "direct",
            "tag": "direct"
        }),
        json!({
            "type": "block",
            "tag": "block"
        }),
        json!({
            "type": "dns",
            "tag": "dns-out"
        }),
    ];

    let rules = if routing_mode == "rule" {
        vec![
            json!({
                "outbound": "dns-out",
                "port": [53]
            }),
            json!({
                "geoip": ["private"],
                "outbound": "direct"
            }),
            json!({
                "outbound": "proxy"
            })
        ]
    } else {
        vec![
            json!({
                "outbound": "proxy"
            })
        ]
    };

    json!({
        "log": {
            "level": "warn",
            "timestamp": true
        },
        "dns": {
            "servers": [
                {
                    "tag": "dns-remote",
                    "address": "https://1.1.1.1/dns-query",
                    "detour": "proxy"
                },
                {
                    "tag": "dns-local",
                    "address": "local",
                    "detour": "direct"
                }
            ],
            "rules": [
                {
                    "outbound": "any",
                    "server": "dns-remote"
                }
            ],
            "strategy": "prefer_ipv4"
        },
        "inbounds": [
            {
                "type": "socks",
                "tag": "socks-in",
                "listen": SINGBOX_BIND_ADDR,
                "listen_port": listen_port,
                "sniff": true
            }
        ],
        "outbounds": outbounds,
        "route": {
            "rules": rules,
            "auto_detect_interface": true
        }
    })
}

pub fn parse_single_proxy_link(link: &str) -> Result<ParsedProxyNode, String> {
    let link = link.trim();
    if link.starts_with("vless://") {
        parse_vless_link(link)
    } else if link.starts_with("vmess://") {
        parse_vmess_link(link)
    } else if link.starts_with("trojan://") {
        parse_trojan_link(link)
    } else if link.starts_with("ss://") {
        parse_shadowsocks_link(link)
    } else if link.starts_with('{') {
        let val: Value = serde_json::from_str(link).map_err(|e| format!("Invalid JSON: {e}"))?;
        let name = val.get("tag").and_then(Value::as_str).unwrap_or("Sing-box Custom").to_string();
        let server = val.get("server").and_then(Value::as_str).unwrap_or("127.0.0.1").to_string();
        let port = val.get("server_port").and_then(Value::as_u64).unwrap_or(443) as u16;
        let protocol = val.get("type").and_then(Value::as_str).unwrap_or("custom").to_string();
        Ok(ParsedProxyNode {
            id: generate_id(),
            name,
            protocol,
            server,
            port,
            raw_link: link.to_string(),
            outbound_json: val,
            latency_ms: None,
        })
    } else {
        Err(format!("Unsupported proxy protocol. Expected vless://, vmess://, trojan://, ss:// or sing-box json."))
    }
}

// ── VLESS Parser ─────────────────────────────────────────────────────────────
fn parse_vless_link(link: &str) -> Result<ParsedProxyNode, String> {
    let url = url::Url::parse(link).map_err(|e| format!("Invalid VLESS URL: {e}"))?;
    let uuid = url.username();
    let server = url.host_str().ok_or("Missing server host in VLESS link")?;
    let port = url.port().unwrap_or(443);
    let tag = url.fragment().map(urlencoding_decode).unwrap_or_else(|| format!("{}:{}", server, port));

    let query: std::collections::HashMap<_, _> = url.query_pairs().into_owned().collect();

    let security = query.get("security").map(String::as_str).unwrap_or("none");
    let flow = query.get("flow").map(String::as_str).unwrap_or("");
    let transport_type = query.get("type").map(String::as_str).unwrap_or("tcp");
    let sni = query.get("sni").or_else(|| query.get("serverName")).map(String::as_str).unwrap_or(server);
    let fingerprint = query.get("fp").map(String::as_str).unwrap_or("chrome");

    let mut outbound = json!({
        "type": "vless",
        "tag": "proxy",
        "server": server,
        "server_port": port,
        "uuid": uuid
    });

    if !flow.is_empty() {
        outbound["flow"] = json!(flow);
    }

    // TLS or Reality
    if security == "reality" {
        let public_key = query.get("pbk").cloned().unwrap_or_default();
        let short_id = query.get("sid").cloned().unwrap_or_default();
        outbound["tls"] = json!({
            "enabled": true,
            "server_name": sni,
            "utls": {
                "enabled": true,
                "fingerprint": fingerprint
            },
            "reality": {
                "enabled": true,
                "public_key": public_key,
                "short_id": short_id
            }
        });
    } else if security == "tls" {
        outbound["tls"] = json!({
            "enabled": true,
            "server_name": sni,
            "utls": {
                "enabled": true,
                "fingerprint": fingerprint
            }
        });
    }

    // Transport (ws, grpc, http)
    if transport_type == "ws" {
        let path = query.get("path").cloned().unwrap_or_else(|| "/".to_string());
        let host = query.get("host").cloned().unwrap_or_else(|| sni.to_string());
        outbound["transport"] = json!({
            "type": "ws",
            "path": path,
            "headers": {
                "Host": host
            }
        });
    } else if transport_type == "grpc" {
        let service_name = query.get("serviceName").cloned().unwrap_or_default();
        outbound["transport"] = json!({
            "type": "grpc",
            "service_name": service_name
        });
    }

    Ok(ParsedProxyNode {
        id: generate_id(),
        name: tag,
        protocol: "vless".to_string(),
        server: server.to_string(),
        port,
        raw_link: link.to_string(),
        outbound_json: outbound,
        latency_ms: None,
    })
}

// ── VMess Parser ─────────────────────────────────────────────────────────────
fn parse_vmess_link(link: &str) -> Result<ParsedProxyNode, String> {
    let payload = link.trim_start_matches("vmess://");
    let decoded = decode_base64_string(payload)?;
    let val: Value = serde_json::from_str(&decoded).map_err(|e| format!("Invalid VMess JSON: {e}"))?;

    let name = val.get("ps").and_then(Value::as_str).unwrap_or("VMess Node").to_string();
    let server = val.get("add").and_then(Value::as_str).ok_or("Missing add in VMess")?.to_string();
    let port = match val.get("port") {
        Some(Value::Number(n)) => n.as_u64().unwrap_or(443) as u16,
        Some(Value::String(s)) => s.parse::<u16>().unwrap_or(443),
        _ => 443,
    };
    let uuid = val.get("id").and_then(Value::as_str).ok_or("Missing id in VMess")?.to_string();
    let alter_id = val.get("aid").and_then(Value::as_i64).unwrap_or(0);
    let net = val.get("net").and_then(Value::as_str).unwrap_or("tcp");
    let tls = val.get("tls").and_then(Value::as_str).unwrap_or("");
    let sni = val.get("sni").and_then(Value::as_str).unwrap_or(&server);
    let path = val.get("path").and_then(Value::as_str).unwrap_or("/");
    let host = val.get("host").and_then(Value::as_str).unwrap_or(sni);

    let mut outbound = json!({
        "type": "vmess",
        "tag": "proxy",
        "server": server,
        "server_port": port,
        "uuid": uuid,
        "alter_id": alter_id,
        "security": "auto"
    });

    if tls == "tls" {
        outbound["tls"] = json!({
            "enabled": true,
            "server_name": sni,
            "utls": {
                "enabled": true,
                "fingerprint": "chrome"
            }
        });
    }

    if net == "ws" {
        outbound["transport"] = json!({
            "type": "ws",
            "path": path,
            "headers": {
                "Host": host
            }
        });
    } else if net == "grpc" {
        outbound["transport"] = json!({
            "type": "grpc",
            "service_name": path
        });
    }

    Ok(ParsedProxyNode {
        id: generate_id(),
        name,
        protocol: "vmess".to_string(),
        server,
        port,
        raw_link: link.to_string(),
        outbound_json: outbound,
        latency_ms: None,
    })
}

// ── Trojan Parser ────────────────────────────────────────────────────────────
fn parse_trojan_link(link: &str) -> Result<ParsedProxyNode, String> {
    let url = url::Url::parse(link).map_err(|e| format!("Invalid Trojan URL: {e}"))?;
    let password = url.username();
    let server = url.host_str().ok_or("Missing server host in Trojan link")?;
    let port = url.port().unwrap_or(443);
    let tag = url.fragment().map(urlencoding_decode).unwrap_or_else(|| format!("{}:{}", server, port));

    let query: std::collections::HashMap<_, _> = url.query_pairs().into_owned().collect();
    let sni = query.get("sni").map(String::as_str).unwrap_or(server);
    let transport_type = query.get("type").map(String::as_str).unwrap_or("tcp");

    let mut outbound = json!({
        "type": "trojan",
        "tag": "proxy",
        "server": server,
        "server_port": port,
        "password": password,
        "tls": {
            "enabled": true,
            "server_name": sni
        }
    });

    if transport_type == "ws" {
        let path = query.get("path").cloned().unwrap_or_else(|| "/".to_string());
        let host = query.get("host").cloned().unwrap_or_else(|| sni.to_string());
        outbound["transport"] = json!({
            "type": "ws",
            "path": path,
            "headers": {
                "Host": host
            }
        });
    } else if transport_type == "grpc" {
        let service_name = query.get("serviceName").cloned().unwrap_or_default();
        outbound["transport"] = json!({
            "type": "grpc",
            "service_name": service_name
        });
    }

    Ok(ParsedProxyNode {
        id: generate_id(),
        name: tag,
        protocol: "trojan".to_string(),
        server: server.to_string(),
        port,
        raw_link: link.to_string(),
        outbound_json: outbound,
        latency_ms: None,
    })
}

// ── Shadowsocks Parser ───────────────────────────────────────────────────────
fn parse_shadowsocks_link(link: &str) -> Result<ParsedProxyNode, String> {
    let trimmed = link.trim_start_matches("ss://");
    let (body, fragment) = match trimmed.split_once('#') {
        Some((b, f)) => (b, Some(f)),
        None => (trimmed, None),
    };
    let tag = fragment.map(urlencoding_decode).unwrap_or_else(|| "Shadowsocks".to_string());

    // ss link can be ss://base64(method:password@server:port) or ss://base64(method:password)@server:port
    let (method, password, server, port) = if body.contains('@') {
        let (user_info, host_port) = body.split_once('@').unwrap();
        let decoded_user = decode_base64_string(user_info).unwrap_or_else(|_| user_info.to_string());
        let (method, password) = decoded_user.split_once(':').ok_or("Invalid user info in SS")?;
        let (server, port_str) = host_port.rsplit_once(':').ok_or("Invalid host:port in SS")?;
        (method.to_string(), password.to_string(), server.to_string(), port_str.parse::<u16>().map_err(|_| "Invalid port")?)
    } else {
        let decoded = decode_base64_string(body)?;
        let (user_info, host_port) = decoded.split_once('@').ok_or("Invalid SS payload")?;
        let (method, password) = user_info.split_once(':').ok_or("Invalid user info in SS")?;
        let (server, port_str) = host_port.rsplit_once(':').ok_or("Invalid host:port in SS")?;
        (method.to_string(), password.to_string(), server.to_string(), port_str.parse::<u16>().map_err(|_| "Invalid port")?)
    };

    let outbound = json!({
        "type": "shadowsocks",
        "tag": "proxy",
        "server": server,
        "server_port": port,
        "method": method,
        "password": password
    });

    Ok(ParsedProxyNode {
        id: generate_id(),
        name: tag,
        protocol: "shadowsocks".to_string(),
        server,
        port,
        raw_link: link.to_string(),
        outbound_json: outbound,
        latency_ms: None,
    })
}

// ── Subscription Fetcher ─────────────────────────────────────────────────────
pub fn fetch_subscription_nodes(url: &str) -> Result<Vec<ParsedProxyNode>, String> {
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(15))
        .user_agent("v2rayN/6.23")
        .build()
        .map_err(|e| format!("HTTP Client Error: {e}"))?;

    let response = client
        .get(url)
        .send()
        .map_err(|e| format!("Subscription request failed: {e}"))?;

    if !response.status().is_success() {
        return Err(format!("Subscription returned HTTP {}", response.status()));
    }

    let text = response.text().map_err(|e| format!("Failed to read response text: {e}"))?;
    parse_subscription_content(&text)
}

pub fn parse_subscription_content(content: &str) -> Result<Vec<ParsedProxyNode>, String> {
    let trimmed = content.trim();
    
    // First, try decoding as base64 subscription
    let raw_text = if let Ok(decoded) = decode_base64_string(trimmed) {
        decoded
    } else {
        trimmed.to_string()
    };

    let mut nodes = Vec::new();
    for line in raw_text.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with("//") || line.starts_with('#') {
            continue;
        }

        if let Ok(node) = parse_single_proxy_link(line) {
            nodes.push(node);
        }
    }

    if nodes.is_empty() {
        return Err("No valid proxy nodes found in content".to_string());
    }

    Ok(nodes)
}

// ── General Utilities ────────────────────────────────────────────────────────
fn decode_base64_string(input: &str) -> Result<String, String> {
    let sanitized: String = input.chars().filter(|c| !c.is_whitespace()).collect();
    
    // Try standard base64, URL-safe base64, with and without padding
    if let Ok(bytes) = BASE64_STANDARD.decode(&sanitized) {
        if let Ok(s) = String::from_utf8(bytes) {
            return Ok(s);
        }
    }

    if let Ok(bytes) = BASE64_URL_SAFE.decode(&sanitized) {
        if let Ok(s) = String::from_utf8(bytes) {
            return Ok(s);
        }
    }

    // Try padding if length % 4 != 0
    let remainder = sanitized.len() % 4;
    if remainder > 0 {
        let padded = format!("{}{}", sanitized, "=".repeat(4 - remainder));
        if let Ok(bytes) = BASE64_STANDARD.decode(&padded) {
            if let Ok(s) = String::from_utf8(bytes) {
                return Ok(s);
            }
        }
        if let Ok(bytes) = BASE64_URL_SAFE.decode(&padded) {
            if let Ok(s) = String::from_utf8(bytes) {
                return Ok(s);
            }
        }
    }

    Err("Invalid base64 payload".to_string())
}

fn urlencoding_decode(s: &str) -> String {
    url::form_urlencoded::parse(s.as_bytes())
        .map(|(k, _)| k.into_owned())
        .collect::<Vec<_>>()
        .join("")
}

fn generate_id() -> String {
    format!(
        "{:x}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos()
    )
}
