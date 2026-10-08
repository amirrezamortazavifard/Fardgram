use serde::Serialize;
use tauri::WebviewWindow;

const DEFAULT_REFRESH_RATE_HZ: f64 = 60.0;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DisplayTiming {
    refresh_rate_hz: f64,
    native: bool,
}

fn valid_refresh_rate(refresh_rate_hz: u32) -> Option<f64> {
    (24..=1_000)
        .contains(&refresh_rate_hz)
        .then_some(refresh_rate_hz as f64)
}

#[cfg(windows)]
fn current_display_refresh_rate(window: &WebviewWindow) -> Result<f64, String> {
    use std::mem::size_of;
    use windows_sys::Win32::Graphics::Gdi::{
        DEVMODEW, ENUM_CURRENT_SETTINGS, EnumDisplaySettingsW, GetMonitorInfoW,
        MONITOR_DEFAULTTONEAREST, MONITORINFO, MONITORINFOEXW, MonitorFromWindow,
    };

    let hwnd = window
        .hwnd()
        .map_err(|error| format!("Failed to get window handle: {error}"))?;
    let monitor = unsafe { MonitorFromWindow(hwnd.0, MONITOR_DEFAULTTONEAREST) };
    if monitor.is_null() {
        return Err("Failed to locate monitor for window".to_string());
    }

    let mut monitor_info = MONITORINFOEXW::default();
    monitor_info.monitorInfo.cbSize = size_of::<MONITORINFOEXW>() as u32;
    let monitor_info_ok =
        unsafe { GetMonitorInfoW(monitor, &mut monitor_info.monitorInfo as *mut MONITORINFO) };
    if monitor_info_ok == 0 {
        return Err("Failed to get monitor information".to_string());
    }

    let mut mode = DEVMODEW {
        dmSize: size_of::<DEVMODEW>() as u16,
        ..DEVMODEW::default()
    };
    let mode_ok = unsafe {
        EnumDisplaySettingsW(
            monitor_info.szDevice.as_ptr(),
            ENUM_CURRENT_SETTINGS,
            &mut mode,
        )
    };
    if mode_ok == 0 {
        return Err("Failed to get current monitor display mode".to_string());
    }

    valid_refresh_rate(mode.dmDisplayFrequency)
        .ok_or_else(|| "Monitor returned invalid refresh rate".to_string())
}

#[cfg(not(windows))]
fn current_display_refresh_rate(_window: &WebviewWindow) -> Result<f64, String> {
    Err("Native display refresh rate not provided on this platform".to_string())
}

#[tauri::command]
pub fn fardgram_display_timing(window: WebviewWindow) -> DisplayTiming {
    match current_display_refresh_rate(&window) {
        Ok(refresh_rate_hz) => DisplayTiming {
            refresh_rate_hz,
            native: true,
        },
        Err(_) => DisplayTiming {
            refresh_rate_hz: DEFAULT_REFRESH_RATE_HZ,
            native: false,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::valid_refresh_rate;

    #[test]
    fn accepts_realistic_display_refresh_rates() {
        assert_eq!(valid_refresh_rate(30), Some(30.0));
        assert_eq!(valid_refresh_rate(60), Some(60.0));
        assert_eq!(valid_refresh_rate(144), Some(144.0));
        assert_eq!(valid_refresh_rate(360), Some(360.0));
    }

    #[test]
    fn rejects_default_and_implausible_display_modes() {
        assert_eq!(valid_refresh_rate(0), None);
        assert_eq!(valid_refresh_rate(1), None);
        assert_eq!(valid_refresh_rate(1_001), None);
    }
}
