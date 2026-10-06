use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{fs, path::PathBuf};
use tauri::{AppHandle, Manager, State};

pub mod discovery;
pub mod mhrv;
pub mod recovery;
pub mod singbox;
pub mod warp;
mod system;
use system::{SystemProxy, detect_system_proxy};

#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ProxyMode {
    #[default]
    System,
    Direct,
    Custom,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ProxyKind {
    #[default]
    Http,
    Socks5,
    Mtproto,
    V2ray,
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ProxyEndpoint {
    #[serde(rename = "type")]
    pub kind: ProxyKind,
    pub server: String,
    pub port: u16,
    #[serde(default)]
    pub username: String,
    #[serde(default)]
    pub password: String,
    #[serde(default)]
    pub secret: String,
    #[serde(default)]
    pub http_only: bool,
    #[serde(default)]
    pub v2ray_config: Option<serde_json::Value>,
}

impl Default for ProxyEndpoint {
    fn default() -> Self {
        Self {
            kind: ProxyKind::Http,
            server: "127.0.0.1".to_string(),
            port: 7890,
            username: String::new(),
            password: String::new(),
            secret: String::new(),
            http_only: false,
            v2ray_config: None,
        }
    }
}

impl ProxyEndpoint {
    fn validate(&self) -> Result<(), String> {
        if self.server.trim().is_empty() {
            return Err("代理服务器不能为空".to_string());
        }
        if self.server.chars().any(char::is_whitespace) {
            return Err("代理服务器不能包含空白字符".to_string());
        }
        if self.port == 0 {
            return Err("代理端口必须在 1 到 65535 之间".to_string());
        }
        if self.kind == ProxyKind::Mtproto && self.secret.trim().is_empty() {
            return Err("MTProto 代理必须填写 secret".to_string());
        }
        Ok(())
    }

    pub fn tdlib_value(&self) -> Value {
        let proxy_type = match self.kind {
            ProxyKind::Http => json!({
                "@type": "proxyTypeHttp",
                "username": self.username,
                "password": self.password,
                "http_only": self.http_only,
            }),
            ProxyKind::Socks5 => json!({
                "@type": "proxyTypeSocks5",
                "username": self.username,
                "password": self.password,
            }),
            ProxyKind::Mtproto => json!({
                "@type": "proxyTypeMtproto",
                "secret": self.secret,
            }),
            ProxyKind::V2ray => json!({
                "@type": "proxyTypeSocks5",
                "username": self.username,
                "password": self.password,
            }),
        };
        json!({
            "@type": "proxy",
            "server": self.server.trim(),
            "port": self.port,
            "type": proxy_type,
        })
    }
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ProxyProfile {
    pub id: String,
    pub name: String,
    pub endpoint: ProxyEndpoint,
}

impl ProxyProfile {
    fn validate(&self) -> Result<(), String> {
        if self.id.is_empty()
            || self.id.len() > 64
            || !self
                .id
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
        {
            return Err("代理标识无效".to_string());
        }
        let name = self.name.trim();
        if name.is_empty() || name.chars().count() > 40 {
            return Err("代理名称必须为 1 到 40 个字符".to_string());
        }
        self.endpoint.validate()
    }
}

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ProxyPreferences {
    #[serde(default)]
    pub mode: ProxyMode,
    #[serde(default, skip_serializing)]
    custom: Option<ProxyEndpoint>,
    #[serde(default)]
    pub profiles: Vec<ProxyProfile>,
    #[serde(default)]
    pub active_profile_id: String,
    #[serde(default)]
    pub auto_switch: bool,
}

impl Default for ProxyPreferences {
    fn default() -> Self {
        Self {
            mode: ProxyMode::System,
            custom: None,
            profiles: vec![ProxyProfile {
                id: "proxy-1".to_string(),
                name: "代理 1".to_string(),
                endpoint: ProxyEndpoint::default(),
            }],
            active_profile_id: "proxy-1".to_string(),
            auto_switch: false,
        }
    }
}

impl ProxyPreferences {
    fn normalize(mut self) -> Result<Self, String> {
        if self.profiles.is_empty() {
            self.profiles.push(ProxyProfile {
                id: "proxy-1".to_string(),
                name: "代理 1".to_string(),
                endpoint: self.custom.take().unwrap_or_default(),
            });
        }
        if !self
            .profiles
            .iter()
            .any(|profile| profile.id == self.active_profile_id)
        {
            self.active_profile_id = self.profiles[0].id.clone();
        }
        self.custom = None;
        self.validate()?;
        Ok(self)
    }

    fn validate(&self) -> Result<(), String> {
        if self.profiles.len() > 20 {
            return Err("最多可以保存 20 个代理".to_string());
        }
        let mut ids = std::collections::HashSet::new();
        for profile in &self.profiles {
            profile.validate()?;
            if !ids.insert(&profile.id) {
                return Err("代理标识不能重复".to_string());
            }
        }
        if self.mode == ProxyMode::Custom && self.profiles.is_empty() {
            return Err("自定义模式至少需要一个代理".to_string());
        }
        if !self.profiles.is_empty()
            && !self
                .profiles
                .iter()
                .any(|profile| profile.id == self.active_profile_id)
        {
            return Err("当前代理不在代理列表中".to_string());
        }
        Ok(())
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProxySettings {
    mode: ProxyMode,
    profiles: Vec<ProxyProfile>,
    active_profile_id: String,
    auto_switch: bool,
    system: Option<ProxyEndpoint>,
    system_status: SystemProxy,
    revision: u64,
    runtime_profile_id: Option<String>,
}

#[tauri::command]
pub fn telegram_proxy_settings(
    app: AppHandle,
    runtime: State<'_, recovery::ProxyRuntime>,
) -> Result<ProxySettings, String> {
    runtime.settings(&app)
}

pub fn sync_singbox_for_preferences(app: &AppHandle, preferences: &ProxyPreferences) {
    let Some(singbox) = app.try_state::<singbox::SingboxRuntime>() else {
        return;
    };

    if preferences.mode != ProxyMode::Custom {
        singbox.stop();
        return;
    }

    let active_profile = preferences
        .profiles
        .iter()
        .find(|p| p.id == preferences.active_profile_id)
        .or_else(|| preferences.profiles.first());

    if let Some(profile) = active_profile {
        if profile.endpoint.kind == ProxyKind::V2ray {
            if let Some(cfg) = &profile.endpoint.v2ray_config {
                let config_str = match cfg {
                    Value::String(s) => s.clone(),
                    other => other.to_string(),
                };
                let port = if profile.endpoint.port > 0 {
                    profile.endpoint.port
                } else {
                    singbox::DEFAULT_SINGBOX_PORT
                };
                let _ = singbox.start(app, &config_str, Some(port), None, Some(profile.name.clone()));
                return;
            }
        }
    }

    singbox.stop();
}

#[tauri::command]
pub fn telegram_save_proxy_settings(
    app: AppHandle,
    preferences: ProxyPreferences,
    revision: Option<u64>,
    runtime: State<'_, recovery::ProxyRuntime>,
) -> Result<(), String> {
    let preferences = preferences.normalize()?;
    sync_singbox_for_preferences(&app, &preferences);
    runtime.save(&app, preferences, revision)
}

#[tauri::command]
pub fn telegram_discover_proxies() -> Result<Vec<discovery::DiscoveredProxy>, String> {
    Ok(discovery::discover_healthy_proxies())
}

#[tauri::command]
pub fn telegram_apply_discovered_proxies(
    app: AppHandle,
    proxies: Vec<discovery::DiscoveredProxy>,
    active_id: Option<String>,
    runtime: State<'_, recovery::ProxyRuntime>,
) -> Result<ProxySettings, String> {
    if proxies.is_empty() {
        return Err("لیست پروکسی‌های یافت‌شده خالی است".to_string());
    }

    let profiles = discovery::discovered_to_profiles(&proxies);
    let active_profile_id = active_id
        .filter(|id| profiles.iter().any(|p| &p.id == id))
        .unwrap_or_else(|| profiles[0].id.clone());

    let preferences = ProxyPreferences {
        mode: ProxyMode::Custom,
        custom: None,
        profiles,
        active_profile_id,
        auto_switch: true,
    };

    let preferences = preferences.normalize()?;
    sync_singbox_for_preferences(&app, &preferences);
    runtime.save(&app, preferences, None)?;
    runtime.settings(&app)
}

#[tauri::command]
pub fn telegram_quick_connect_best_proxy(
    app: AppHandle,
    runtime: State<'_, recovery::ProxyRuntime>,
) -> Result<ProxySettings, String> {
    let discovered = discovery::discover_healthy_proxies();
    if discovered.is_empty() {
        return Err("پروکسی فعالی در حال حاضر یافت نشد. لطفاً مجدداً تلاش کنید.".to_string());
    }
    let profiles = discovery::discovered_to_profiles(&discovered);
    let active_profile_id = profiles[0].id.clone();

    let preferences = ProxyPreferences {
        mode: ProxyMode::Custom,
        custom: None,
        profiles,
        active_profile_id,
        auto_switch: true,
    };

    let preferences = preferences.normalize()?;
    runtime.save(&app, preferences, None)?;
    runtime.settings(&app)
}

/// Returns the current state of the Warp-plus engine.
#[tauri::command]
pub fn telegram_warp_status(warp: State<'_, warp::WarpRuntime>) -> warp::WarpState {
    warp.state()
}

/// Downloads (if needed) and starts the Warp-plus engine, then returns its
/// state. Blocks until the SOCKS5 port is ready or an error occurs (≤ 15 s).
#[tauri::command]
pub fn telegram_warp_start(
    app: AppHandle,
    warp: State<'_, warp::WarpRuntime>,
) -> Result<warp::WarpState, String> {
    warp.start(&app)
}

/// Stops the Warp-plus engine immediately.
#[tauri::command]
pub fn telegram_warp_stop(warp: State<'_, warp::WarpRuntime>) {
    warp.stop();
}

fn proxy_request(endpoint: Option<&ProxyEndpoint>) -> Value {
    match endpoint {
        Some(endpoint) => json!({
            "@type": "addProxy",
            "proxy": endpoint.tdlib_value(),
            "enable": true,
            "comment": "Fardgram",
        }),
        None => json!({
            "@type": "disableProxy",
        }),
    }
}

fn preferences_path(app: &AppHandle) -> Result<PathBuf, String> {
    let directory = crate::distribution::app_config_directory(app)
        .map_err(|error| format!("无法解析应用配置目录: {error}"))?;
    fs::create_dir_all(&directory)
        .map_err(|error| format!("无法创建应用配置目录 {}: {error}", directory.display()))?;
    Ok(directory.join("proxy-settings.dat"))
}

fn load_preferences(app: &AppHandle) -> Result<ProxyPreferences, String> {
    let path = preferences_path(app)?;
    let preferences: ProxyPreferences =
        crate::storage::persistence::read_json(&path, true)?.unwrap_or_default();
    preferences.normalize()
}

fn save_preferences(app: &AppHandle, preferences: &ProxyPreferences) -> Result<(), String> {
    let path = preferences_path(app)?;
    crate::storage::persistence::write_json(&path, preferences, true)
}

fn parse_proxy_server(value: &str) -> Option<ProxyEndpoint> {
    let value = value.trim();
    if value.is_empty() {
        return None;
    }

    let mut selected_kind = ProxyKind::Http;
    let mut address = value;
    if value.contains('=') {
        let entries: Vec<(&str, &str)> = value
            .split(';')
            .filter_map(|entry| entry.split_once('='))
            .map(|(key, address)| (key.trim(), address.trim()))
            .collect();
        if let Some((_, found)) = entries.iter().find(|(key, _)| {
            key.eq_ignore_ascii_case("socks") || key.eq_ignore_ascii_case("socks5")
        }) {
            selected_kind = ProxyKind::Socks5;
            address = found;
        } else if let Some((_, found)) = entries
            .iter()
            .find(|(key, _)| key.eq_ignore_ascii_case("https"))
            .or_else(|| {
                entries
                    .iter()
                    .find(|(key, _)| key.eq_ignore_ascii_case("http"))
            })
        {
            address = found;
        } else {
            return None;
        }
    }

    if let Some((scheme, remainder)) = address.split_once("://") {
        address = remainder;
        if scheme.eq_ignore_ascii_case("socks") || scheme.eq_ignore_ascii_case("socks5") {
            selected_kind = ProxyKind::Socks5;
        } else if !scheme.eq_ignore_ascii_case("http") {
            return None;
        }
    }
    // Do not silently discard credentials or misinterpret an unsupported URI.
    if address.contains('@') || address.contains('/') || address.chars().any(char::is_whitespace) {
        return None;
    }
    let (server, port) = address.rsplit_once(':')?;
    let server = server.trim().trim_matches(['[', ']']);
    let port = port.trim().parse::<u16>().ok()?;
    if server.is_empty() || port == 0 {
        return None;
    }
    Some(ProxyEndpoint {
        kind: selected_kind,
        server: server.to_string(),
        port,
        ..ProxyEndpoint::default()
    })
}

#[cfg(target_os = "windows")]
pub(crate) fn protect(data: &[u8]) -> Result<Vec<u8>, String> {
    use std::{ptr, slice};
    use windows_sys::Win32::{
        Foundation::LocalFree,
        Security::Cryptography::{CRYPT_INTEGER_BLOB, CRYPTPROTECT_UI_FORBIDDEN, CryptProtectData},
    };

    let input = CRYPT_INTEGER_BLOB {
        cbData: data
            .len()
            .try_into()
            .map_err(|_| "受保护的本地数据过大".to_string())?,
        pbData: data.as_ptr() as *mut u8,
    };
    let mut output = CRYPT_INTEGER_BLOB::default();
    let success = unsafe {
        CryptProtectData(
            &input,
            ptr::null(),
            ptr::null(),
            ptr::null(),
            ptr::null(),
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut output,
        )
    };
    if success == 0 {
        return Err(format!(
            "Windows 无法加密本地数据: {}",
            std::io::Error::last_os_error()
        ));
    }
    let protected =
        unsafe { slice::from_raw_parts(output.pbData, output.cbData as usize) }.to_vec();
    unsafe { LocalFree(output.pbData.cast()) };
    Ok(protected)
}

#[cfg(target_os = "windows")]
pub(crate) fn unprotect(data: &[u8]) -> Result<Vec<u8>, String> {
    use std::{ptr, slice};
    use windows_sys::Win32::{
        Foundation::LocalFree,
        Security::Cryptography::{
            CRYPT_INTEGER_BLOB, CRYPTPROTECT_UI_FORBIDDEN, CryptUnprotectData,
        },
    };

    let input = CRYPT_INTEGER_BLOB {
        cbData: data
            .len()
            .try_into()
            .map_err(|_| "受保护的本地数据过大".to_string())?,
        pbData: data.as_ptr() as *mut u8,
    };
    let mut output = CRYPT_INTEGER_BLOB::default();
    let success = unsafe {
        CryptUnprotectData(
            &input,
            ptr::null_mut(),
            ptr::null(),
            ptr::null(),
            ptr::null(),
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut output,
        )
    };
    if success == 0 {
        return Err(format!(
            "Windows 无法解密本地数据: {}",
            std::io::Error::last_os_error()
        ));
    }
    let unprotected =
        unsafe { slice::from_raw_parts(output.pbData, output.cbData as usize) }.to_vec();
    unsafe { LocalFree(output.pbData.cast()) };
    Ok(unprotected)
}

#[cfg(not(target_os = "windows"))]
pub(crate) fn protect(data: &[u8]) -> Result<Vec<u8>, String> {
    Ok(data.to_vec())
}

#[cfg(not(target_os = "windows"))]
pub(crate) fn unprotect(data: &[u8]) -> Result<Vec<u8>, String> {
    Ok(data.to_vec())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_simple_windows_proxy() {
        let proxy = parse_proxy_server("127.0.0.1:7897").expect("proxy");
        assert_eq!(proxy.kind, ProxyKind::Http);
        assert_eq!(proxy.server, "127.0.0.1");
        assert_eq!(proxy.port, 7897);
    }

    #[test]
    fn prefers_socks_from_protocol_map() {
        let proxy = parse_proxy_server("http=127.0.0.1:8080;socks=localhost:1080").expect("proxy");
        assert_eq!(proxy.kind, ProxyKind::Socks5);
        assert_eq!(proxy.server, "localhost");
        assert_eq!(proxy.port, 1080);
    }

    #[test]
    fn migrates_the_legacy_single_proxy_preferences() {
        let preferences: ProxyPreferences = serde_json::from_value(json!({
            "mode": "custom",
            "custom": {
                "type": "socks5",
                "server": "127.0.0.1",
                "port": 1080,
                "username": "demo",
                "password": "secret",
                "secret": "",
                "httpOnly": false
            }
        }))
        .expect("legacy preferences");

        let migrated = preferences.normalize().expect("normalized preferences");

        assert_eq!(migrated.profiles.len(), 1);
        assert_eq!(migrated.active_profile_id, "proxy-1");
        assert_eq!(migrated.profiles[0].endpoint.kind, ProxyKind::Socks5);
        assert_eq!(migrated.profiles[0].endpoint.password, "secret");
    }

    #[test]
    fn rejects_duplicate_proxy_profile_ids() {
        let profile = ProxyProfile {
            id: "duplicate".to_string(),
            name: "主代理".to_string(),
            endpoint: ProxyEndpoint::default(),
        };
        let preferences = ProxyPreferences {
            mode: ProxyMode::Custom,
            custom: None,
            profiles: vec![profile.clone(), profile],
            active_profile_id: "duplicate".to_string(),
            auto_switch: true,
        };

        assert_eq!(preferences.validate(), Err("代理标识不能重复".to_string()));
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn protects_proxy_preferences_for_current_windows_user() {
        let serialized = br#"{"mode":"custom","password":"secret"}"#;
        let protected = protect(serialized).expect("protect");
        assert_ne!(protected, serialized);
        assert_eq!(unprotect(&protected).expect("unprotect"), serialized);
    }
}
