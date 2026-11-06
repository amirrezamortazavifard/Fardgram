use serde::{Deserialize, Serialize};
use std::{
    fs::{self, File},
    io::{Read, Write},
    path::{Component, Path, PathBuf},
};
use tauri::{AppHandle, Manager};
use zip::{write::SimpleFileOptions, CompressionMethod, ZipWriter};

/// Metadata returned after creating a zip archive.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ZipArchiveResult {
    pub archive_path: String,
    pub file_name: String,
    pub file_count: usize,
    pub total_uncompressed_bytes: u64,
    pub total_compressed_bytes: u64,
}

/// Options for configuring archive creation.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateArchiveOptions {
    pub custom_name: Option<String>,
    pub include_hidden: Option<bool>,
    pub store_only: Option<bool>,
}

/// Checks whether a path component or file name is considered hidden or system-internal.
pub fn is_hidden_or_system_file(path: &Path) -> bool {
    for comp in path.components() {
        if let Component::Normal(os_str) = comp {
            let s = os_str.to_string_lossy();
            if s.starts_with('.')
                || s.eq_ignore_ascii_case("thumbs.db")
                || s.eq_ignore_ascii_case("desktop.ini")
                || s.eq_ignore_ascii_case("__macosx")
            {
                return true;
            }
        }
    }
    false
}

/// Strictly validates that a relative entry path stays safely within the root and contains no traversal escapes.
pub fn sanitize_archive_entry_name(relative_path: &Path) -> Result<String, String> {
    if relative_path.is_absolute() {
        return Err("Archive entry cannot have an absolute path".to_string());
    }

    let mut clean_segments: Vec<String> = Vec::new();
    for comp in relative_path.components() {
        match comp {
            Component::Normal(segment) => {
                let seg_str = segment.to_string_lossy().to_string();
                if seg_str == ".." || seg_str.contains('/') || seg_str.contains('\\') {
                    return Err(format!("Illegal segment in relative path: {seg_str}"));
                }
                clean_segments.push(seg_str);
            }
            Component::CurDir => {}
            Component::ParentDir => {
                return Err("Path traversal '..' is strictly forbidden inside archive entries".to_string());
            }
            Component::RootDir | Component::Prefix(_) => {
                return Err("Root or drive prefix is strictly forbidden inside archive entries".to_string());
            }
        }
    }

    if clean_segments.is_empty() {
        return Err("Relative entry path cannot be empty".to_string());
    }

    Ok(clean_segments.join("/"))
}

/// Returns the bounded application temporary directory for archives.
pub fn app_archive_temp_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let cache_dir = app
        .path()
        .app_cache_dir()
        .map_err(|e| format!("Failed to resolve app cache directory: {e}"))?;
    let temp_archives = cache_dir.join("temp_archives");
    fs::create_dir_all(&temp_archives)
        .map_err(|e| format!("Failed to create temporary archive directory: {e}"))?;
    Ok(temp_archives)
}

/// Collects files recursively from a base directory, rejecting symlink escapes and enforcing limits.
pub fn collect_files_for_archive(
    base_dir: &Path,
    include_hidden: bool,
    max_file_count: usize,
    max_uncompressed_bytes: u64,
) -> Result<(Vec<(PathBuf, String)>, u64), String> {
    let canonical_base = base_dir
        .canonicalize()
        .map_err(|e| format!("Unable to canonicalize base directory {}: {e}", base_dir.display()))?;

    let mut result = Vec::new();
    let mut total_uncompressed_bytes = 0u64;

    let mut stack = vec![canonical_base.clone()];

    while let Some(current_dir) = stack.pop() {
        let entries = fs::read_dir(&current_dir)
            .map_err(|e| format!("Failed to read directory {}: {e}", current_dir.display()))?;

        for entry_res in entries {
            let entry = entry_res.map_err(|e| format!("Failed to inspect directory entry: {e}"))?;
            let path = entry.path();

            // Detect and prevent symlinks that point outside base directory
            let file_type = entry
                .file_type()
                .map_err(|e| format!("Failed to read file type for {}: {e}", path.display()))?;

            if file_type.is_symlink() {
                let canonical_target = match path.canonicalize() {
                    Ok(p) => p,
                    Err(_) => continue, // Broken symlink, safely skip
                };
                if !canonical_target.starts_with(&canonical_base) {
                    // Symlink target escapes base directory! Reject for security.
                    return Err(format!(
                        "Symlink {} escapes root directory (targets {})",
                        path.display(),
                        canonical_target.display()
                    ));
                }
            }

            let rel_path = match path.strip_prefix(&canonical_base) {
                Ok(rel) => rel,
                Err(_) => continue,
            };

            if !include_hidden && is_hidden_or_system_file(rel_path) {
                continue;
            }

            if path.is_dir() {
                stack.push(path);
            } else if path.is_file() {
                let meta = entry
                    .metadata()
                    .map_err(|e| format!("Failed to read metadata for {}: {e}", path.display()))?;
                let file_size = meta.len();

                total_uncompressed_bytes = total_uncompressed_bytes
                    .checked_add(file_size)
                    .ok_or_else(|| "Total uncompressed archive size overflowed".to_string())?;

                if total_uncompressed_bytes > max_uncompressed_bytes {
                    return Err(format!(
                        "Archive content exceeds maximum allowed size of {} MB",
                        max_uncompressed_bytes / (1024 * 1024)
                    ));
                }

                if result.len() >= max_file_count {
                    return Err(format!(
                        "Archive exceeds maximum allowable file count of {max_file_count}"
                    ));
                }

                let entry_name = sanitize_archive_entry_name(rel_path)?;
                result.push((path, entry_name));
            }
        }
    }

    Ok((result, total_uncompressed_bytes))
}

/// Creates a safe `.zip` archive from a folder on local disk.
#[tauri::command]
pub async fn fardgram_create_zip_from_folder(
    app: AppHandle,
    folder_path: String,
    options: Option<CreateArchiveOptions>,
) -> Result<ZipArchiveResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let base_path = PathBuf::from(&folder_path);
        if !base_path.is_dir() {
            return Err(format!("Source path is not a directory: {folder_path}"));
        }

        let opts = options.unwrap_or(CreateArchiveOptions {
            custom_name: None,
            include_hidden: Some(false),
            store_only: Some(false),
        });

        let include_hidden = opts.include_hidden.unwrap_or(false);
        let store_only = opts.store_only.unwrap_or(false);

        // Maximum limits to defend against zip-bombs and memory exhaustion
        const MAX_FILE_COUNT: usize = 20_000;
        const MAX_TOTAL_UNCOMPRESSED_BYTES: u64 = 2 * 1024 * 1024 * 1024; // 2 GB standard Telegram doc limit

        let (files_to_zip, total_uncompressed) = collect_files_for_archive(
            &base_path,
            include_hidden,
            MAX_FILE_COUNT,
            MAX_TOTAL_UNCOMPRESSED_BYTES,
        )?;

        if files_to_zip.is_empty() {
            return Err("No eligible files found in folder to archive".to_string());
        }

        let default_name = base_path
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "archive".to_string());

        let base_name = opts
            .custom_name
            .filter(|n| !n.trim().is_empty())
            .unwrap_or(default_name);

        let clean_base_name = base_name.replace(['/', '\\', ':', '*', '?', '"', '<', '>', '|'], "_");
        let zip_file_name = if clean_base_name.to_ascii_lowercase().ends_with(".zip") {
            clean_base_name
        } else {
            format!("{clean_base_name}.zip")
        };

        let temp_dir = app_archive_temp_dir(&app)?;
        let archive_id = format!("{}_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_millis(), zip_file_name);
        let output_path = temp_dir.join(&archive_id);

        let out_file = File::create(&output_path)
            .map_err(|e| format!("Failed to create output archive file {}: {e}", output_path.display()))?;

        let mut zip_writer = ZipWriter::new(out_file);
        let compression = if store_only {
            CompressionMethod::Stored
        } else {
            CompressionMethod::Deflated
        };
        let file_options = SimpleFileOptions::default().compression_method(compression);

        let mut buffer = vec![0u8; 64 * 1024];

        for (disk_path, entry_name) in &files_to_zip {
            zip_writer
                .start_file(entry_name, file_options)
                .map_err(|e| format!("Failed to add entry '{entry_name}' to zip: {e}"))?;

            let mut f = File::open(disk_path)
                .map_err(|e| format!("Failed to open file {}: {e}", disk_path.display()))?;

            loop {
                let bytes_read = f
                    .read(&mut buffer)
                    .map_err(|e| format!("Error reading from {}: {e}", disk_path.display()))?;
                if bytes_read == 0 {
                    break;
                }
                zip_writer
                    .write_all(&buffer[..bytes_read])
                    .map_err(|e| format!("Error writing to zip archive: {e}"))?;
            }
        }

        let finished_file = zip_writer
            .finish()
            .map_err(|e| format!("Failed to finalize zip archive: {e}"))?;

        let total_compressed_bytes = finished_file
            .metadata()
            .map(|m| m.len())
            .unwrap_or(0);

        Ok(ZipArchiveResult {
            archive_path: output_path.to_string_lossy().to_string(),
            file_name: zip_file_name,
            file_count: files_to_zip.len(),
            total_uncompressed_bytes: total_uncompressed,
            total_compressed_bytes,
        })
    })
    .await
    .map_err(|e| format!("Archive task execution failed: {e}"))?
}

/// Safely removes a temporary archive file created by the application.
#[tauri::command]
pub async fn fardgram_cleanup_temp_archive(
    app: AppHandle,
    archive_path: String,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let path = PathBuf::from(&archive_path);
        let temp_dir = app_archive_temp_dir(&app)?;

        // Ensure the path is genuinely within the application's temp archive directory
        let canonical_path = path
            .canonicalize()
            .map_err(|e| format!("Invalid archive path {}: {e}", path.display()))?;
        let canonical_temp = temp_dir
            .canonicalize()
            .map_err(|e| format!("Invalid temp directory: {e}"))?;

        if !canonical_path.starts_with(&canonical_temp) {
            return Err("Attempted to delete a file outside the temporary archive directory".to_string());
        }

        if canonical_path.is_file() {
            fs::remove_file(&canonical_path)
                .map_err(|e| format!("Failed to remove temporary archive: {e}"))?;
        }
        Ok(())
    })
    .await
    .map_err(|e| format!("Cleanup task execution failed: {e}"))?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_is_hidden_or_system_file() {
        assert!(is_hidden_or_system_file(Path::new(".git/config")));
        assert!(is_hidden_or_system_file(Path::new("folder/.DS_Store")));
        assert!(is_hidden_or_system_file(Path::new("Thumbs.db")));
        assert!(is_hidden_or_system_file(Path::new("sub/desktop.ini")));
        assert!(is_hidden_or_system_file(Path::new("__MACOSX/._test.txt")));

        assert!(!is_hidden_or_system_file(Path::new("src/main.rs")));
        assert!(!is_hidden_or_system_file(Path::new("docs/readme.md")));
    }

    #[test]
    fn test_sanitize_archive_entry_name() {
        assert_eq!(
            sanitize_archive_entry_name(Path::new("folder/sub/file.txt")).unwrap(),
            "folder/sub/file.txt"
        );
        assert_eq!(
            sanitize_archive_entry_name(Path::new("folder\\sub\\file.txt")).unwrap(),
            "folder/sub/file.txt"
        );

        // Path traversal must fail
        assert!(sanitize_archive_entry_name(Path::new("../escape.txt")).is_err());
        assert!(sanitize_archive_entry_name(Path::new("folder/../../escape.txt")).is_err());

        // Absolute paths must fail
        #[cfg(windows)]
        assert!(sanitize_archive_entry_name(Path::new("C:\\windows\\system.ini")).is_err());
        #[cfg(not(windows))]
        assert!(sanitize_archive_entry_name(Path::new("/etc/passwd")).is_err());
    }

    #[test]
    fn test_collect_files_and_archive_size_limit() {
        let unique_id = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        let base = std::env::temp_dir().join(format!("fardgram-test-archive-{}-{}", std::process::id(), unique_id));
        let _ = fs::remove_dir_all(&base);
        fs::create_dir_all(&base).unwrap();

        // Create sample structure
        fs::create_dir_all(base.join("docs")).unwrap();
        fs::write(base.join("docs/a.txt"), b"hello").unwrap();
        fs::write(base.join("b.txt"), b"world").unwrap();
        fs::write(base.join(".hidden"), b"secret").unwrap();

        // Without hidden files
        let (files, total) = collect_files_for_archive(&base, false, 100, 1000).unwrap();
        assert_eq!(files.len(), 2);
        assert_eq!(total, 10);

        // With hidden files
        let (files_all, total_all) = collect_files_for_archive(&base, true, 100, 1000).unwrap();
        assert_eq!(files_all.len(), 3);
        assert_eq!(total_all, 16);

        // Exceeding max bytes
        assert!(collect_files_for_archive(&base, false, 100, 5).is_err());

        // Exceeding max count
        assert!(collect_files_for_archive(&base, false, 1, 1000).is_err());

        // Cleanup
        let _ = fs::remove_dir_all(&base);
    }
}
