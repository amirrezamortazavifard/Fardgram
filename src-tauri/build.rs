#![allow(clippy::collapsible_if)]
#![allow(clippy::unnecessary_map_or)]
use std::env;
use std::fs;
use std::path::PathBuf;

fn main() {
    println!("cargo:rerun-if-env-changed=NOTGRAM_API_ID");
    println!("cargo:rerun-if-env-changed=NOTGRAM_API_HASH");
    println!("cargo:rerun-if-env-changed=NOTGRAM_TDLIB_PATH");

    tauri_build::build();

    // Copy tdlib runtime dynamic libraries directly to target directory
    let target_os = env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();
    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap());
    let tdlib_dir = manifest_dir.join("tdlib");
    if tdlib_dir.exists() {
        if let Ok(out_dir_str) = env::var("OUT_DIR") {
            let out_dir = PathBuf::from(out_dir_str);
            if let Some(target_dir) = out_dir.ancestors().nth(3) {
                if let Ok(entries) = fs::read_dir(&tdlib_dir) {
                    for entry in entries.flatten() {
                        let path = entry.path();
                        let is_lib = match target_os.as_str() {
                            "windows" => path.extension().map_or(false, |ext| ext == "dll"),
                            "macos" => path.extension().map_or(false, |ext| ext == "dylib"),
                            _ => path.extension().map_or(false, |ext| ext == "so"),
                        };
                        if is_lib {
                            let _ = fs::copy(&path, target_dir.join(entry.file_name()));
                        }
                    }
                }
            }
        }
    }
}
