use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};
use tauri::AppHandle;

pub const API_CREDENTIALS_FILE: &str = "api-credentials.json";

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomApiCredentials {
    pub api_id: i32,
    pub api_hash: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub app_title: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub short_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TelegramApiCredentialsInfo {
    pub configured: bool,
    pub source: String, // "custom" | "environment" | "none"
    pub api_id: Option<i32>,
    pub api_hash: Option<String>,
    pub is_custom: bool,
    pub custom_saved: bool,
    pub app_title: Option<String>,
    pub short_name: Option<String>,
    pub created_at: Option<String>,
    pub env_api_id: Option<i32>,
    pub env_api_hash_present: bool,
    pub config_file_path: String,
    pub tdlib_state: String,
    pub linked: bool,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiCredentialsTestResult {
    pub valid: bool,
    pub api_id_valid: bool,
    pub api_hash_valid: bool,
    pub error_message: Option<String>,
    pub hints: Vec<String>,
}

pub fn custom_credentials_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = crate::distribution::app_config_directory(app)?;
    fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create config directory {}: {e}", dir.display()))?;
    Ok(dir.join(API_CREDENTIALS_FILE))
}

pub fn load_custom_credentials(app: &AppHandle) -> Result<Option<CustomApiCredentials>, String> {
    let path = custom_credentials_path(app)?;
    if !path.is_file() {
        return Ok(None);
    }
    let data = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read {}: {e}", path.display()))?;
    let creds: CustomApiCredentials = serde_json::from_str(&data)
        .map_err(|e| format!("Failed to parse {}: {e}", path.display()))?;
    if creds.api_id <= 0 || creds.api_hash.trim().is_empty() {
        return Ok(None);
    }
    Ok(Some(creds))
}

pub fn save_custom_credentials(
    app: &AppHandle,
    api_id: i32,
    api_hash: String,
    app_title: Option<String>,
    short_name: Option<String>,
) -> Result<CustomApiCredentials, String> {
    if api_id <= 0 {
        return Err("API ID must be a positive 32-bit integer.".to_string());
    }
    let hash = api_hash.trim().to_ascii_lowercase();
    if hash.len() != 32 || !hash.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err("API Hash must be a valid 32-character hexadecimal string.".to_string());
    }

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs().to_string())
        .unwrap_or_default();

    let creds = CustomApiCredentials {
        api_id,
        api_hash: hash,
        app_title: app_title.filter(|s| !s.trim().is_empty()),
        short_name: short_name.filter(|s| !s.trim().is_empty()),
        created_at: Some(timestamp),
    };
    let path = custom_credentials_path(app)?;
    let serialized = serde_json::to_string_pretty(&creds)
        .map_err(|e| format!("Failed to serialize credentials: {e}"))?;
    fs::write(&path, serialized)
        .map_err(|e| format!("Failed to write credentials to {}: {e}", path.display()))?;
    Ok(creds)
}

pub fn remove_custom_credentials(app: &AppHandle) -> Result<bool, String> {
    let path = custom_credentials_path(app)?;
    if path.exists() {
        fs::remove_file(&path)
            .map_err(|e| format!("Failed to remove credentials file {}: {e}", path.display()))?;
        Ok(true)
    } else {
        Ok(false)
    }
}

pub fn get_api_credentials_info(
    app: &AppHandle,
    runtime: &super::TelegramRuntime,
) -> Result<TelegramApiCredentialsInfo, String> {
    let config_file_path = custom_credentials_path(app)
        .map(|p| p.display().to_string())
        .unwrap_or_default();

    let custom = load_custom_credentials(app).unwrap_or(None);
    let custom_saved = custom.is_some();

    let env_id_str = crate::development::environment_value("NOTGRAM_API_ID")
        .or_else(|| option_env!("NOTGRAM_API_ID").map(str::to_string));
    let env_api_id = env_id_str.as_deref().and_then(|s| s.parse::<i32>().ok());

    let env_hash_str = crate::development::environment_value("NOTGRAM_API_HASH")
        .or_else(|| option_env!("NOTGRAM_API_HASH").map(str::to_string));
    let env_api_hash_present = env_hash_str.as_deref().map_or(false, |s| !s.trim().is_empty());

    let status = runtime.status(app);

    if let Some(custom) = custom {
        Ok(TelegramApiCredentialsInfo {
            configured: true,
            source: "custom".to_string(),
            api_id: Some(custom.api_id),
            api_hash: Some(custom.api_hash),
            is_custom: true,
            custom_saved,
            app_title: custom.app_title,
            short_name: custom.short_name,
            created_at: custom.created_at,
            env_api_id,
            env_api_hash_present,
            config_file_path,
            tdlib_state: status.state.to_string(),
            linked: status.linked,
        })
    } else if let (Some(id), Some(hash)) = (env_api_id, env_hash_str.filter(|s| !s.trim().is_empty())) {
        Ok(TelegramApiCredentialsInfo {
            configured: true,
            source: "environment".to_string(),
            api_id: Some(id),
            api_hash: Some(hash),
            is_custom: false,
            custom_saved: false,
            app_title: None,
            short_name: None,
            created_at: None,
            env_api_id: Some(id),
            env_api_hash_present: true,
            config_file_path,
            tdlib_state: status.state.to_string(),
            linked: status.linked,
        })
    } else {
        Ok(TelegramApiCredentialsInfo {
            configured: false,
            source: "none".to_string(),
            api_id: None,
            api_hash: None,
            is_custom: false,
            custom_saved: false,
            app_title: None,
            short_name: None,
            created_at: None,
            env_api_id,
            env_api_hash_present,
            config_file_path,
            tdlib_state: status.state.to_string(),
            linked: status.linked,
        })
    }
}
