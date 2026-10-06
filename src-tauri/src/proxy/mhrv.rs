/// MasterHttpRelayVPN (MHRV) Google Apps Script Relay Integration.
///
/// Bypasses DPI and deep packet inspection by using Google's global edge network (www.google.com)
/// as a fronted relay to a private Google Apps Script deployment (Code.gs).
///
/// Runs `mhrv-rs.exe` in the background and exposes local SOCKS5 (port 8088) and HTTP (port 8087)
/// proxy endpoints that TDLib and Fardgram route through.

use serde::{Deserialize, Serialize};
use std::{
    net::{SocketAddr, TcpStream},
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};
use tauri::{AppHandle, Manager, State};

pub const DEFAULT_MHRV_SOCKS5_PORT: u16 = 8088;
pub const DEFAULT_MHRV_HTTP_PORT: u16 = 8087;
pub const DEFAULT_MHRV_GOOGLE_IP: &str = "216.239.38.120";
pub const DEFAULT_MHRV_FRONT_DOMAIN: &str = "www.google.com";

const STARTUP_PROBE_TIMEOUT: Duration = Duration::from_secs(14);
const STARTUP_PROBE_INTERVAL: Duration = Duration::from_millis(350);

fn default_google_ip() -> String {
    DEFAULT_MHRV_GOOGLE_IP.to_string()
}

fn default_front_domain() -> String {
    DEFAULT_MHRV_FRONT_DOMAIN.to_string()
}

fn default_http_port() -> u16 {
    DEFAULT_MHRV_HTTP_PORT
}

fn default_socks5_port() -> u16 {
    DEFAULT_MHRV_SOCKS5_PORT
}

fn default_verify_ssl() -> bool {
    true
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum MhrvState {
    Idle,
    Starting,
    Running { http_port: u16, socks5_port: u16 },
    Stopped,
    Error { message: String },
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MhrvConfig {
    pub script_id: String,
    pub auth_key: String,
    #[serde(default = "default_google_ip")]
    pub google_ip: String,
    #[serde(default = "default_front_domain")]
    pub front_domain: String,
    #[serde(default = "default_http_port")]
    pub http_port: u16,
    #[serde(default = "default_socks5_port")]
    pub socks5_port: u16,
    #[serde(default = "default_verify_ssl")]
    pub verify_ssl: bool,
}

impl Default for MhrvConfig {
    fn default() -> Self {
        Self {
            script_id: String::new(),
            auth_key: String::new(),
            google_ip: default_google_ip(),
            front_domain: default_front_domain(),
            http_port: default_http_port(),
            socks5_port: default_socks5_port(),
            verify_ssl: default_verify_ssl(),
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MhrvTestResult {
    pub success: bool,
    pub latency_ms: Option<u64>,
    pub message: String,
}

struct MhrvProcessGuard {
    child: Child,
}

impl Drop for MhrvProcessGuard {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

#[derive(Default)]
struct MhrvRuntimeInner {
    state: Option<MhrvState>,
    process: Option<MhrvProcessGuard>,
    active_config: Option<MhrvConfig>,
}

#[derive(Default)]
pub struct MhrvRuntime {
    inner: Arc<Mutex<MhrvRuntimeInner>>,
}

impl MhrvRuntime {
    pub fn state(&self) -> MhrvState {
        self.inner
            .lock()
            .map(|g| g.state.clone().unwrap_or(MhrvState::Idle))
            .unwrap_or(MhrvState::Idle)
    }

    pub fn set_state(&self, state: MhrvState) {
        if let Ok(mut guard) = self.inner.lock() {
            guard.state = Some(state);
        }
    }

    pub fn active_config(&self) -> Option<MhrvConfig> {
        self.inner.lock().ok().and_then(|g| g.active_config.clone())
    }

    pub fn stop(&self) {
        if let Ok(mut guard) = self.inner.lock() {
            guard.process = None;
            guard.state = Some(MhrvState::Stopped);
        }
    }

    pub fn start(&self, app: &AppHandle, config: MhrvConfig) -> Result<MhrvState, String> {
        self.stop();
        self.set_state(MhrvState::Starting);

        let binary_path = find_mhrv_binary(app)?;
        let config_path = write_mhrv_config(app, &config)?;

        let mut cmd = Command::new(&binary_path);
        cmd.args(["-c", config_path.to_str().unwrap_or_default(), "--no-cert-check"])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .stdin(Stdio::null());

        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }

        let child = cmd
            .spawn()
            .map_err(|e| format!("Failed to launch mhrv-rs: {e}"))?;

        {
            let mut guard = self.inner.lock().map_err(|e| e.to_string())?;
            guard.process = Some(MhrvProcessGuard { child });
            guard.active_config = Some(config.clone());
        }

        // Wait until local SOCKS5 port accepts TCP connections
        wait_for_port_ready(config.socks5_port)?;

        let running_state = MhrvState::Running {
            http_port: config.http_port,
            socks5_port: config.socks5_port,
        };
        self.set_state(running_state.clone());
        Ok(running_state)
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

fn extract_clean_script_id(input: &str) -> String {
    let trimmed = input.trim();
    if let Some(pos) = trimmed.find("/macros/s/") {
        let after = &trimmed[pos + "/macros/s/".len()..];
        if let Some(slash_pos) = after.find('/') {
            return after[..slash_pos].to_string();
        }
        return after.to_string();
    }
    trimmed.to_string()
}

fn find_mhrv_binary(app: &AppHandle) -> Result<PathBuf, String> {
    let binary_name = format!("mhrv-rs{}", std::env::consts::EXE_SUFFIX);

    // 1. Check inside resources/mhrv relative to current executable
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            let candidate = dir.join("resources").join("mhrv").join(&binary_name);
            if candidate.is_file() {
                ensure_executable_permissions(&candidate);
                return Ok(candidate);
            }
            let direct = dir.join(&binary_name);
            if direct.is_file() {
                ensure_executable_permissions(&direct);
                return Ok(direct);
            }
        }
    }

    // 2. Check tauri resource dir
    if let Ok(res_dir) = app.path().resource_dir() {
        let candidate = res_dir.join("resources").join("mhrv").join(&binary_name);
        if candidate.is_file() {
            ensure_executable_permissions(&candidate);
            return Ok(candidate);
        }
        let direct = res_dir.join(&binary_name);
        if direct.is_file() {
            ensure_executable_permissions(&direct);
            return Ok(direct);
        }
    }

    // 3. Check app-data directory
    if let Ok(app_dir) = crate::distribution::app_data_directory(app) {
        let candidate = app_dir.join("mhrv").join(&binary_name);
        if candidate.is_file() {
            ensure_executable_permissions(&candidate);
            return Ok(candidate);
        }
    }

    // 4. Check development source path
    let dev_path = PathBuf::from(r"D:\Telegeram\src-tauri\resources\mhrv").join(&binary_name);
    if dev_path.is_file() {
        ensure_executable_permissions(&dev_path);
        return Ok(dev_path);
    }

    // 5. Check external release directory
    let ext_path = PathBuf::from(r"D:\MasterHttpRelayVPN-RUST-main\releases").join(&binary_name);
    if ext_path.is_file() {
        ensure_executable_permissions(&ext_path);
        return Ok(ext_path);
    }

    // 6. Check system PATH (especially useful on Linux/macOS)
    if let Ok(path_var) = std::env::var("PATH") {
        let separator = if cfg!(windows) { ';' } else { ':' };
        for part in path_var.split(separator) {
            let p = PathBuf::from(part).join(&binary_name);
            if p.is_file() {
                ensure_executable_permissions(&p);
                return Ok(p);
            }
        }
    }

    Err(format!(
        "'{binary_name}' binary not found. Place '{binary_name}' in resources/mhrv/, in app data, or install it to your system PATH."
    ))
}

#[allow(unused_variables)]
fn ensure_executable_permissions(path: &PathBuf) {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if let Ok(metadata) = std::fs::metadata(path) {
            let mut permissions = metadata.permissions();
            let mode = permissions.mode();
            if mode & 0o111 == 0 {
                permissions.set_mode(mode | 0o755);
                let _ = std::fs::set_permissions(path, permissions);
            }
        }
    }
}

fn write_mhrv_config(app: &AppHandle, config: &MhrvConfig) -> Result<PathBuf, String> {
    let dir = crate::distribution::app_data_directory(app)
        .map_err(|e| format!("Cannot resolve app-data directory: {e}"))?
        .join("mhrv");
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("Cannot create mhrv config directory: {e}"))?;

    let clean_script_id = extract_clean_script_id(&config.script_id);
    let toml_content = format!(
        r#"[relay]
mode = "apps_script"
script_id = "{clean_script_id}"
auth_key = "{auth_key}"

[network]
google_ip = "{google_ip}"
front_domain = "{front_domain}"
listen_host = "127.0.0.1"
listen_port = {http_port}
socks5_port = {socks5_port}
verify_ssl = {verify_ssl}

[logging]
log_level = "info"
"#,
        clean_script_id = clean_script_id,
        auth_key = config.auth_key.trim(),
        google_ip = if config.google_ip.trim().is_empty() { DEFAULT_MHRV_GOOGLE_IP } else { config.google_ip.trim() },
        front_domain = if config.front_domain.trim().is_empty() { DEFAULT_MHRV_FRONT_DOMAIN } else { config.front_domain.trim() },
        http_port = if config.http_port == 0 { DEFAULT_MHRV_HTTP_PORT } else { config.http_port },
        socks5_port = if config.socks5_port == 0 { DEFAULT_MHRV_SOCKS5_PORT } else { config.socks5_port },
        verify_ssl = config.verify_ssl,
    );

    let config_file = dir.join("config.toml");
    std::fs::write(&config_file, toml_content)
        .map_err(|e| format!("Failed to write mhrv config.toml: {e}"))?;

    Ok(config_file)
}

fn wait_for_port_ready(port: u16) -> Result<(), String> {
    let start = Instant::now();
    let addr: SocketAddr = format!("127.0.0.1:{}", port)
        .parse()
        .map_err(|e| format!("Invalid bind address: {e}"))?;

    while start.elapsed() < STARTUP_PROBE_TIMEOUT {
        if TcpStream::connect_timeout(&addr, Duration::from_millis(300)).is_ok() {
            return Ok(());
        }
        std::thread::sleep(STARTUP_PROBE_INTERVAL);
    }

    Err(format!(
        "Timed out waiting for mhrv-rs to bind SOCKS5 port {port}. Please check your deployment ID and credentials."
    ))
}

// ──────────────────────────────────────────────────────────────────────────────
// Tauri Commands
// ──────────────────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn telegram_mhrv_status(
    runtime: State<'_, MhrvRuntime>,
) -> Result<(MhrvState, Option<MhrvConfig>), String> {
    Ok((runtime.state(), runtime.active_config()))
}

#[tauri::command]
pub async fn telegram_mhrv_start(
    app: AppHandle,
    runtime: State<'_, MhrvRuntime>,
    config: MhrvConfig,
) -> Result<MhrvState, String> {
    if config.script_id.trim().is_empty() {
        return Err("Google Apps Script Deployment ID or Web App URL is required.".to_string());
    }
    if config.auth_key.trim().is_empty() {
        return Err("Secret Auth Key is required.".to_string());
    }

    runtime.start(&app, config)
}

#[tauri::command]
pub async fn telegram_mhrv_stop(
    runtime: State<'_, MhrvRuntime>,
) -> Result<MhrvState, String> {
    runtime.stop();
    Ok(MhrvState::Stopped)
}

#[tauri::command]
pub async fn telegram_mhrv_test(
    app: AppHandle,
    config: MhrvConfig,
) -> Result<MhrvTestResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let start = Instant::now();
        let binary_path = match find_mhrv_binary(&app) {
            Ok(b) => b,
            Err(e) => return Ok(MhrvTestResult {
                success: false,
                latency_ms: None,
                message: e,
            }),
        };

        let temp_config = match write_mhrv_config(&app, &config) {
            Ok(p) => p,
            Err(e) => return Ok(MhrvTestResult {
                success: false,
                latency_ms: None,
                message: e,
            }),
        };

        let mut cmd = Command::new(&binary_path);
        cmd.args(["test", "-c", temp_config.to_str().unwrap_or_default()]);

        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            cmd.creation_flags(0x08000000);
        }

        let output = match cmd.output() {
            Ok(out) => out,
            Err(e) => return Ok(MhrvTestResult {
                success: false,
                latency_ms: None,
                message: format!("Failed to execute mhrv test: {e}"),
            }),
        };

        let latency_ms = start.elapsed().as_millis() as u64;
        let stdout = String::from_utf8_lossy(&output.stdout);
        let stderr = String::from_utf8_lossy(&output.stderr);
        let combined = format!("{stdout} {stderr}");

        if output.status.success() || combined.to_lowercase().contains("success") || combined.to_lowercase().contains("200 ok") {
            Ok(MhrvTestResult {
                success: true,
                latency_ms: Some(latency_ms),
                message: format!("Relay operational ({latency_ms} ms). Traffic successfully fronted through Google edge."),
            })
        } else {
            Ok(MhrvTestResult {
                success: false,
                latency_ms: Some(latency_ms),
                message: if combined.trim().is_empty() {
                    format!("Test exited with status code: {}", output.status)
                } else {
                    combined.trim().to_string()
                },
            })
        }
    })
    .await
    .map_err(|e| format!("Join error: {e}"))?
}
