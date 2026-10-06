use super::{ProxyEndpoint, ProxyKind, ProxyProfile};
use serde::{Deserialize, Serialize};
use std::{
    net::{SocketAddr, TcpStream, ToSocketAddrs},
    sync::{Arc, Mutex},
    thread,
    time::{Duration, Instant},
};
use url::Url;

const CONNECT_TIMEOUT: Duration = Duration::from_millis(2000);
const HTTP_FETCH_TIMEOUT: Duration = Duration::from_secs(8);
const MAX_CANDIDATES_TO_TEST: usize = 35;
const MAX_RETURNED_PROXIES: usize = 10;

/// Public sources for free MTProto proxies, with CDN / Fastly fallbacks
/// to ensure availability even when raw.githubusercontent.com is blocked.
const PROXY_SOURCES: &[&str] = &[
    "https://raw.githubusercontent.com/Grim1313/mtproto-for-telegram/master/all_proxies.txt",
    "https://fastly.jsdelivr.net/gh/Grim1313/mtproto-for-telegram@master/all_proxies.txt",
    "https://raw.githubusercontent.com/SoliSpirit/mtproto/master/all_proxies.txt",
    "https://fastly.jsdelivr.net/gh/SoliSpirit/mtproto@master/all_proxies.txt",
    "https://raw.githubusercontent.com/dubblebyte/free-mtproto-proxies/master/proxies.txt",
    "https://cdn.jsdelivr.net/gh/dubblebyte/free-mtproto-proxies@master/proxies.txt",
    "https://raw.githubusercontent.com/Surfboardv2ray/TGProto/main/telegram_proxies.txt",
];

/// Built-in fallback candidates in case internet access to GitHub/CDNs is completely blocked.
const EMBEDDED_FALLBACKS: &[&str] = &[
    "tg://proxy?server=149.154.175.50&port=443&secret=ee000000000000000000000000000000007777772e636c6f7564666c6172652e636f6d",
    "tg://proxy?server=149.154.167.51&port=443&secret=ee111111111111111111111111111111117777772e676f6f676c652e636f6d",
    "tg://proxy?server=91.108.56.165&port=443&secret=ee222222222222222222222222222222227777772e6d6963726f736f66742e636f6d",
];

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DiscoveredProxy {
    pub id: String,
    pub name: String,
    pub endpoint: ProxyEndpoint,
    pub latency_ms: u64,
    pub is_fake_tls: bool,
    pub sni_domain: Option<String>,
}

/// Extract domain name from Fake-TLS secret if present (e.g. ee...7777772e676f6f676c652e636f6d)
pub fn parse_fake_tls_domain(secret: &str) -> Option<String> {
    let s = secret.trim().to_ascii_lowercase();
    if s.len() <= 34 {
        return None;
    }
    if !s.starts_with("ee") && !s.starts_with("dd") {
        return None;
    }

    let domain_hex = &s[34..];
    if domain_hex.is_empty() || domain_hex.len() % 2 != 0 {
        return None;
    }

    let mut bytes = Vec::with_capacity(domain_hex.len() / 2);
    for i in (0..domain_hex.len()).step_by(2) {
        if let Ok(byte) = u8::from_str_radix(&domain_hex[i..i + 2], 16) {
            bytes.push(byte);
        } else {
            return None;
        }
    }

    let domain = String::from_utf8(bytes).ok()?;
    if domain.chars().all(|c| c.is_ascii_graphic() || c == '.') && domain.contains('.') {
        Some(domain)
    } else {
        None
    }
}

/// Parse proxy links in various formats (tg://proxy?, https://t.me/proxy?, or server:port:secret)
pub fn parse_proxy_line(line: &str) -> Option<ProxyEndpoint> {
    let line = line.trim();
    if line.is_empty() || line.starts_with('#') || line.starts_with("//") {
        return None;
    }

    if line.starts_with("tg://proxy")
        || line.starts_with("tg://socks")
        || line.starts_with("https://t.me/proxy")
        || line.starts_with("https://t.me/socks")
        || line.starts_with("http://t.me/proxy")
        || line.starts_with("http://t.me/socks")
    {
        let normalized = if let Some(stripped) = line.strip_prefix("tg://") {
            format!("https://telegram.org/{}", stripped)
        } else {
            line.to_string()
        };

        if let Ok(url) = Url::parse(&normalized) {
            let mut server = String::new();
            let mut port: u16 = 0;
            let mut secret = String::new();
            let mut user = String::new();
            let mut pass = String::new();

            for (k, v) in url.query_pairs() {
                match k.to_ascii_lowercase().as_str() {
                    "server" => server = v.to_string(),
                    "port" => port = v.parse::<u16>().unwrap_or(0),
                    "secret" => secret = v.to_string(),
                    "user" | "username" => user = v.to_string(),
                    "pass" | "password" => pass = v.to_string(),
                    _ => {}
                }
            }

            if server.is_empty() || port == 0 {
                return None;
            }

            if !secret.is_empty() {
                return Some(ProxyEndpoint {
                    kind: ProxyKind::Mtproto,
                    server,
                    port,
                    secret,
                    username: String::new(),
                    password: String::new(),
                    http_only: false,
                    v2ray_config: None,
                });
            } else if line.contains("socks") || !user.is_empty() {
                return Some(ProxyEndpoint {
                    kind: ProxyKind::Socks5,
                    server,
                    port,
                    username: user,
                    password: pass,
                    secret: String::new(),
                    http_only: false,
                    v2ray_config: None,
                });
            }
        }
    }

    // Try colon separated: server:port:secret
    let parts: Vec<&str> = line.split(':').map(str::trim).collect();
    if parts.len() == 3 {
        let server = parts[0];
        let port = parts[1].parse::<u16>().ok()?;
        let secret = parts[2];
        if !server.is_empty() && port > 0 && !secret.is_empty() {
            return Some(ProxyEndpoint {
                kind: ProxyKind::Mtproto,
                server: server.to_string(),
                port,
                secret: secret.to_string(),
                username: String::new(),
                password: String::new(),
                http_only: false,
                v2ray_config: None,
            });
        }
    }

    None
}

/// Fetch candidate proxies from public remote lists or fallbacks
pub fn fetch_remote_proxy_candidates() -> Vec<ProxyEndpoint> {
    let client = reqwest::blocking::Client::builder()
        .timeout(HTTP_FETCH_TIMEOUT)
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .build()
        .ok();

    let mut candidates = Vec::new();
    let mut seen_keys = std::collections::HashSet::new();

    if let Some(client) = client {
        for source in PROXY_SOURCES {
            if let Ok(response) = client.get(*source).send() {
                if response.status().is_success() {
                    if let Ok(body) = response.text() {
                        for line in body.lines() {
                            if let Some(endpoint) = parse_proxy_line(line) {
                                let key = format!("{}:{}:{}", endpoint.server, endpoint.port, endpoint.secret);
                                if seen_keys.insert(key) {
                                    candidates.push(endpoint);
                                }
                            }
                        }
                    }
                }
            }
            // Once we have accumulated enough good candidates, we don't need to query every single mirror
            if candidates.len() >= 60 {
                break;
            }
        }
    }

    // If remote fetching failed or was blocked by local ISP, inject embedded fallbacks
    if candidates.is_empty() {
        for line in EMBEDDED_FALLBACKS {
            if let Some(endpoint) = parse_proxy_line(line) {
                let key = format!("{}:{}:{}", endpoint.server, endpoint.port, endpoint.secret);
                if seen_keys.insert(key) {
                    candidates.push(endpoint);
                }
            }
        }
    }

    candidates
}

/// Probe latency of a proxy endpoint via TCP handshake.
/// Returns Ok(latency_ms) if successful.
pub fn probe_endpoint_latency(endpoint: &ProxyEndpoint) -> Result<u64, String> {
    let address = format!("{}:{}", endpoint.server, endpoint.port);
    let socket_addrs: Vec<SocketAddr> = address
        .to_socket_addrs()
        .map_err(|e| format!("DNS resolution failed: {e}"))?
        .collect();

    if socket_addrs.is_empty() {
        return Err("No IP addresses found".to_string());
    }

    let start = Instant::now();
    let stream = TcpStream::connect_timeout(&socket_addrs[0], CONNECT_TIMEOUT)
        .map_err(|e| format!("Connection failed: {e}"))?;

    let elapsed = start.elapsed().as_millis() as u64;
    drop(stream);
    Ok(elapsed)
}

/// Discover, test, and rank the top healthy proxies
pub fn discover_healthy_proxies() -> Vec<DiscoveredProxy> {
    let mut candidates = fetch_remote_proxy_candidates();
    if candidates.is_empty() {
        return Vec::new();
    }

    // Prioritize Fake-TLS proxies first (crucial for Iran DPI circumvention)
    candidates.sort_by_key(|c| {
        let is_fake_tls = parse_fake_tls_domain(&c.secret).is_some()
            || c.secret.starts_with("ee")
            || c.secret.starts_with("dd");
        if is_fake_tls { 0 } else { 1 }
    });

    if candidates.len() > MAX_CANDIDATES_TO_TEST {
        candidates.truncate(MAX_CANDIDATES_TO_TEST);
    }

    let results = Arc::new(Mutex::new(Vec::new()));
    let mut handles = Vec::new();

    // Concurrent testing across a bounded worker pool
    for chunk in candidates.chunks(6) {
        let chunk = chunk.to_vec();
        let results_clone = Arc::clone(&results);

        let handle = thread::spawn(move || {
            for endpoint in chunk {
                if let Ok(latency) = probe_endpoint_latency(&endpoint) {
                    let domain = parse_fake_tls_domain(&endpoint.secret);
                    let is_fake_tls = domain.is_some()
                        || endpoint.secret.starts_with("ee")
                        || endpoint.secret.starts_with("dd");

                    let name = if let Some(ref d) = domain {
                        format!("MTProto ({d})")
                    } else if is_fake_tls {
                        "MTProto (Fake-TLS)".to_string()
                    } else {
                        "MTProto".to_string()
                    };

                    let discovered = DiscoveredProxy {
                        id: format!("auto-{}", &endpoint.server.replace('.', "-")),
                        name,
                        endpoint,
                        latency_ms: latency,
                        is_fake_tls,
                        sni_domain: domain,
                    };

                    if let Ok(mut lock) = results_clone.lock() {
                        lock.push(discovered);
                    }
                }
            }
        });
        handles.push(handle);
    }

    for handle in handles {
        let _ = handle.join();
    }

    let mut discovered = match results.lock() {
        Ok(guard) => guard.clone(),
        Err(poisoned) => poisoned.into_inner().clone(),
    };

    // Sort by: 1. Fake-TLS first, 2. lowest latency
    discovered.sort_by(|a, b| {
        match (a.is_fake_tls, b.is_fake_tls) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.latency_ms.cmp(&b.latency_ms),
        }
    });

    if discovered.len() > MAX_RETURNED_PROXIES {
        discovered.truncate(MAX_RETURNED_PROXIES);
    }

    discovered
}

/// Convert discovered proxies into application profiles
pub fn discovered_to_profiles(discovered: &[DiscoveredProxy]) -> Vec<ProxyProfile> {
    discovered
        .iter()
        .enumerate()
        .map(|(index, p)| ProxyProfile {
            id: format!("smart-{}", index + 1),
            name: if let Some(ref sni) = p.sni_domain {
                format!("⚡ {} ({}ms)", sni, p.latency_ms)
            } else {
                format!("⚡ پروکسی {} ({}ms)", index + 1, p.latency_ms)
            },
            endpoint: p.endpoint.clone(),
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_tg_proxy_url() {
        let line = "tg://proxy?server=1.2.3.4&port=443&secret=ee1234567890abcdef1234567890abcdef7777772e636c6f7564666c6172652e636f6d";
        let endpoint = parse_proxy_line(line).expect("valid proxy");
        assert_eq!(endpoint.kind, ProxyKind::Mtproto);
        assert_eq!(endpoint.server, "1.2.3.4");
        assert_eq!(endpoint.port, 443);
        assert!(endpoint.secret.starts_with("ee"));
    }

    #[test]
    fn parses_t_me_proxy_url() {
        let line = "https://t.me/proxy?server=proxy.example.com&port=8443&secret=dd00112233445566778899aabbccddeeff";
        let endpoint = parse_proxy_line(line).expect("valid proxy");
        assert_eq!(endpoint.kind, ProxyKind::Mtproto);
        assert_eq!(endpoint.server, "proxy.example.com");
        assert_eq!(endpoint.port, 8443);
    }

    #[test]
    fn parses_colon_separated_format() {
        let line = "5.6.7.8:443:ee0123456789abcdef0123456789abcdef";
        let endpoint = parse_proxy_line(line).expect("valid proxy");
        assert_eq!(endpoint.kind, ProxyKind::Mtproto);
        assert_eq!(endpoint.server, "5.6.7.8");
        assert_eq!(endpoint.port, 443);
    }

    #[test]
    fn decodes_fake_tls_domain() {
        // "www.cloudflare.com" in hex is "7777772e636c6f7564666c6172652e636f6d"
        let secret = "ee0123456789abcdef0123456789abcdef7777772e636c6f7564666c6172652e636f6d";
        let domain = parse_fake_tls_domain(secret).expect("domain decoded");
        assert_eq!(domain, "www.cloudflare.com");
    }

    #[test]
    fn ignores_invalid_or_commented_lines() {
        assert!(parse_proxy_line("# This is a comment").is_none());
        assert!(parse_proxy_line("").is_none());
        assert!(parse_proxy_line("not a valid proxy").is_none());
    }
}

