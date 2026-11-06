use std::{
    fs,
    path::{Component, Path, PathBuf},
};
use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::DialogExt;

/// Prompts the user with a native OS folder picker dialog to select an export destination.
#[tauri::command]
pub async fn fardgram_pick_export_folder(app: AppHandle) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let Some(selected) = app
            .dialog()
            .file()
            .set_title("Select Chat Export Destination Folder")
            .blocking_pick_folder()
        else {
            return Ok(None);
        };
        let path = selected
            .into_path()
            .map_err(|error| format!("Unable to resolve selected folder: {error}"))?;
        if !path.is_absolute() {
            return Err("Selected folder path must be absolute".to_string());
        }
        Ok(Some(path.to_string_lossy().to_string()))
    })
    .await
    .map_err(|error| format!("Unable to join pick export folder worker: {error}"))?
}

/// Safely opens the export folder in the OS file explorer / finder.
#[tauri::command]
pub fn fardgram_open_export_folder(folder_path: String) -> Result<(), String> {
    let path = PathBuf::from(&folder_path);
    if !path.is_dir() {
        return Err(format!("Export directory does not exist: {folder_path}"));
    }
    crate::storage::file_actions::open_path(&path)
}

/// Safely writes an export text file (such as messages.html, result.json, or css/style.css)
/// while strictly defending against path traversal attacks.
#[tauri::command]
pub async fn fardgram_write_chat_export_file(
    base_dir: String,
    relative_path: String,
    content: String,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let base = PathBuf::from(&base_dir);
        if !base.is_dir() {
            return Err(format!("Export base directory does not exist: {base_dir}"));
        }
        let target = validate_export_relative_path(&base, &relative_path)?;
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent)
                .map_err(|error| format!("Unable to create parent directories for export file: {error}"))?;
        }
        fs::write(&target, content)
            .map_err(|error| format!("Unable to write export file {}: {error}", target.display()))
    })
    .await
    .map_err(|error| format!("Unable to join export file writer: {error}"))?
}

/// Safely copies a cached/downloaded Telegram media file into the chat export package.
#[tauri::command]
pub async fn fardgram_copy_chat_export_media(
    app: AppHandle,
    base_dir: String,
    relative_path: String,
    source_path: String,
) -> Result<u64, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let base = PathBuf::from(&base_dir);
        if !base.is_dir() {
            return Err(format!("Export base directory does not exist: {base_dir}"));
        }
        let target = validate_export_relative_path(&base, &relative_path)?;
        let source = crate::storage::file_actions::trusted_local_file(&app, &source_path)?;
        app.state::<crate::telegram::media_stream::MediaStreamRegistry>()
            .check_export(&source)?;

        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent)
                .map_err(|error| format!("Unable to create parent directories for export media: {error}"))?;
        }
        fs::copy(&source, &target)
            .map_err(|error| format!("Unable to copy export media from {} to {}: {error}", source.display(), target.display()))
    })
    .await
    .map_err(|error| format!("Unable to join export media copy worker: {error}"))?
}

/// Strictly validates that the relative path does not escape `base_dir`.
pub fn validate_export_relative_path(base_dir: &Path, relative_path: &str) -> Result<PathBuf, String> {
    let rel_path = Path::new(relative_path);

    // Reject absolute paths or paths with drive prefixes
    if rel_path.is_absolute() {
        return Err("Relative export path cannot be absolute".to_string());
    }

    // Inspect each path component for illegal traversal or root components
    for component in rel_path.components() {
        match component {
            Component::Normal(_) => {}
            Component::ParentDir => {
                return Err("Path traversal '..' is strictly forbidden in export relative paths".to_string());
            }
            Component::RootDir | Component::Prefix(_) => {
                return Err("Root or prefix component is forbidden in export relative paths".to_string());
            }
            Component::CurDir => {}
        }
    }

    let joined = base_dir.join(rel_path);

    // Defense-in-depth: normalize and verify the path stays within base_dir
    let clean_base = base_dir
        .canonicalize()
        .map_err(|error| format!("Base export directory cannot be canonicalized: {error}"))?;
    
    // Check if the joined path when canonicalized or stripped starts with clean_base
    // If target file does not exist yet, verify parent
    if let Some(parent) = joined.parent() {
        if parent.exists() {
            let clean_parent = parent
                .canonicalize()
                .map_err(|error| format!("Parent export directory cannot be canonicalized: {error}"))?;
            if !clean_parent.starts_with(&clean_base) {
                return Err("Export destination path escapes the chosen base directory".to_string());
            }
        }
    }

    Ok(joined)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn create_test_temp_dir() -> PathBuf {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let pid = std::process::id();
        let dir = std::env::temp_dir().join(format!("fardgram-export-test-{pid}-{stamp}"));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn validates_safe_relative_paths() {
        let base = create_test_temp_dir();
        let safe_subpath = "messages.html";
        let res = validate_export_relative_path(&base, safe_subpath);
        assert!(res.is_ok());
        assert_eq!(res.unwrap(), base.join("messages.html"));

        let safe_nested = "css/style.css";
        let res_nested = validate_export_relative_path(&base, safe_nested);
        assert!(res_nested.is_ok());
        assert_eq!(res_nested.unwrap(), base.join("css/style.css"));

        let _ = fs::remove_dir_all(base);
    }

    #[test]
    fn rejects_path_traversal_attempts() {
        let base = create_test_temp_dir();

        assert!(validate_export_relative_path(&base, "../outside.txt").is_err());
        assert!(validate_export_relative_path(&base, "../../etc/passwd").is_err());
        assert!(validate_export_relative_path(&base, "photos/../../secret.key").is_err());
        assert!(validate_export_relative_path(&base, "/absolute/path/file.txt").is_err());

        #[cfg(target_os = "windows")]
        {
            assert!(validate_export_relative_path(&base, "C:\\Windows\\System32").is_err());
            assert!(validate_export_relative_path(&base, "\\\\server\\share\\file").is_err());
        }

        let _ = fs::remove_dir_all(base);
    }
}
