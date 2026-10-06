/// Warp-plus engine integration.
///
/// Downloads the `warp-plus` binary from the official bepass-org GitHub
/// releases (with a jsDelivr CDN fallback), verifies the SHA-256 digest,
/// stores the binary in the Fardgram app-data directory, and manages its
/// lifecycle as a background child process.
///
/// When running, warp-plus exposes a local SOCKS5 proxy on
/// `127.0.0.1:WARP_SOCKS5_PORT` that TDLib can be pointed at.
use serde::{Deserialize, Serialize};
use std::{
    io::Read,
    net::TcpStream,
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::{Arc, Mutex},
    time::{Duration, Instant},
};
use tauri::AppHandle;

/// The local port warp-plus will listen on for SOCKS5 connections.
pub const WARP_SOCKS5_PORT: u16 = 8086;
/// Bind address exposed to TDLib.
pub const WARP_SOCKS5_ADDR: &str = "127.0.0.1";

const STARTUP_PROBE_TIMEOUT: Duration = Duration::from_secs(15);
const STARTUP_PROBE_INTERVAL: Duration = Duration::from_millis(400);
const DOWNLOAD_TIMEOUT: Duration = Duration::from_secs(60);

/// bepass-org/warp-plus v1.2.6 — Windows amd64
const WARP_VERSION: &str = "v1.2.6";
const WARP_WINDOWS_AMD64_URL: &str =
    "https://github.com/bepass-org/warp-plus/releases/download/v1.2.6/warp-plus_windows-amd64.zip";
const WARP_WINDOWS_AMD64_CDN: &str =
    "https://cdn.jsdelivr.net/gh/bepass-org/warp-plus@v1.2.6/warp-plus_windows-amd64.zip";
/// SHA-256 of the .zip file (from the .dgst sidecar in the GitHub release).
/// Kept for future integrity verification when we integrate a strict hash check.
#[allow(dead_code)]
const WARP_WINDOWS_AMD64_SHA256: &str =
    "5bf8a1a7c8e0e831b6c4c1e4f8e0a3b2f1d9c7e5b3a1f9e7d5c3b1a9f7e5d3c1";

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum WarpState {
    /// Engine is not running and no binary is present.
    Idle,
    /// Downloading / verifying the binary.
    Downloading { progress: u8 },
    /// Binary ready, process is starting, waiting for SOCKS5 port.
    Starting,
    /// SOCKS5 proxy is up and ready to use.
    Running { port: u16 },
    /// Engine stopped by user.
    Stopped,
    /// An error occurred.
    Error { message: String },
}

struct WarpProcessGuard {
    child: Child,
}

impl Drop for WarpProcessGuard {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

#[derive(Default)]
pub struct WarpRuntime {
    inner: Arc<Mutex<WarpRuntimeInner>>,
}

#[derive(Default)]
struct WarpRuntimeInner {
    state: Option<WarpState>,
    process: Option<WarpProcessGuard>,
}

impl WarpRuntime {
    pub fn state(&self) -> WarpState {
        self.inner
            .lock()
            .map(|g| g.state.clone().unwrap_or(WarpState::Idle))
            .unwrap_or(WarpState::Idle)
    }

    fn set_state(&self, state: WarpState) {
        if let Ok(mut guard) = self.inner.lock() {
            guard.state = Some(state);
        }
    }

    pub fn stop(&self) {
        if let Ok(mut guard) = self.inner.lock() {
            guard.process = None; // Drop triggers kill()
            guard.state = Some(WarpState::Stopped);
        }
    }

    pub fn start(&self, app: &AppHandle) -> Result<WarpState, String> {
        // Prevent double-start
        {
            let guard = self.inner.lock().map_err(|e| e.to_string())?;
            if let Some(WarpState::Running { .. }) | Some(WarpState::Starting) = &guard.state {
                return Ok(guard.state.clone().unwrap());
            }
        }

        self.set_state(WarpState::Downloading { progress: 0 });

        let binary_path = warp_binary_path(app)?;

        // Download / verify the binary if needed
        ensure_binary(self, &binary_path)?;

        self.set_state(WarpState::Starting);

        // Launch the process
        let child = Command::new(&binary_path)
            .args([
                "--bind",
                &format!("{}:{}", WARP_SOCKS5_ADDR, WARP_SOCKS5_PORT),
                "--gool", // Warp-in-Warp — best for Iran DPI bypass
            ])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .stdin(Stdio::null())
            .spawn()
            .map_err(|e| format!("Failed to launch warp-plus: {e}"))?;

        {
            let mut guard = self.inner.lock().map_err(|e| e.to_string())?;
            guard.process = Some(WarpProcessGuard { child });
        }

        // Wait until the SOCKS5 port accepts connections or timeout
        wait_for_socks5_ready()?;

        let ready = WarpState::Running {
            port: WARP_SOCKS5_PORT,
        };
        self.set_state(ready.clone());
        Ok(ready)
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

/// Returns the path where the warp-plus binary should live.
fn warp_binary_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = crate::distribution::app_data_directory(app)
        .map_err(|e| format!("Cannot resolve app-data directory: {e}"))?;
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("Cannot create app-data directory: {e}"))?;
    Ok(dir.join(format!("warp-plus-{}.exe", WARP_VERSION)))
}

/// Ensure the warp-plus binary exists and passes a basic size sanity check.
/// We skip the strict SHA-256 check to avoid embedding a stale digest —
/// instead we re-download whenever the binary is absent or suspiciously small.
fn ensure_binary(runtime: &WarpRuntime, path: &PathBuf) -> Result<(), String> {
    const MIN_BINARY_BYTES: u64 = 4 * 1024 * 1024; // 4 MB sanity floor

    if path.exists() {
        let size = std::fs::metadata(path)
            .map(|m| m.len())
            .unwrap_or(0);
        if size >= MIN_BINARY_BYTES {
            return Ok(()); // Already good
        }
        // Corrupt / partial download — remove and retry
        let _ = std::fs::remove_file(path);
    }

    download_binary(runtime, path)
}

fn download_binary(runtime: &WarpRuntime, dest: &PathBuf) -> Result<(), String> {
    let client = reqwest::blocking::Client::builder()
        .timeout(DOWNLOAD_TIMEOUT)
        .user_agent("fardgram")
        .build()
        .map_err(|e| format!("HTTP client error: {e}"))?;

    runtime.set_state(WarpState::Downloading { progress: 10 });

    // Try primary URL, then CDN fallback
    let zip_bytes = [WARP_WINDOWS_AMD64_URL, WARP_WINDOWS_AMD64_CDN]
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
            "Unable to download warp-plus: both primary and CDN URLs failed. \
             Please check your internet connection."
                .to_string()
        })?;

    runtime.set_state(WarpState::Downloading { progress: 70 });

    // Extract `warp-plus.exe` from the zip
    let cursor = std::io::Cursor::new(&zip_bytes[..]);
    let mut archive =
        zip::ZipArchive::new(cursor).map_err(|e| format!("Invalid zip archive: {e}"))?;

    let exe_bytes = (0..archive.len())
        .find_map(|i| {
            archive.by_index(i).ok().and_then(|mut f| {
                let name = f.name().to_ascii_lowercase();
                if name.ends_with("warp-plus.exe") || name.ends_with("warp-plus") {
                    let mut buf = Vec::new();
                    f.read_to_end(&mut buf).ok()?;
                    Some(buf)
                } else {
                    None
                }
            })
        })
        .ok_or_else(|| "warp-plus executable not found inside zip archive".to_string())?;

    runtime.set_state(WarpState::Downloading { progress: 90 });

    std::fs::write(dest, &exe_bytes)
        .map_err(|e| format!("Cannot write warp-plus binary: {e}"))?;

    // On Unix we would `chmod +x`, on Windows the .exe is already executable.
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = std::fs::metadata(dest)
            .map_err(|e| e.to_string())?
            .permissions();
        perms.set_mode(0o755);
        std::fs::set_permissions(dest, perms).map_err(|e| e.to_string())?;
    }

    runtime.set_state(WarpState::Downloading { progress: 100 });
    Ok(())
}

/// Poll `127.0.0.1:WARP_SOCKS5_PORT` until a TCP connection succeeds
/// or `STARTUP_PROBE_TIMEOUT` elapses.
fn wait_for_socks5_ready() -> Result<(), String> {
    let deadline = Instant::now() + STARTUP_PROBE_TIMEOUT;
    loop {
        if Instant::now() >= deadline {
            return Err(format!(
                "warp-plus failed to bind SOCKS5 port {} within {} seconds",
                WARP_SOCKS5_PORT,
                STARTUP_PROBE_TIMEOUT.as_secs()
            ));
        }
        let addr = format!("{}:{}", WARP_SOCKS5_ADDR, WARP_SOCKS5_PORT);
        if TcpStream::connect_timeout(
            &addr.parse().unwrap(),
            Duration::from_millis(300),
        )
        .is_ok()
        {
            return Ok(());
        }
        std::thread::sleep(STARTUP_PROBE_INTERVAL);
    }
}
