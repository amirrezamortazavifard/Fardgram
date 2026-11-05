use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder, webview::PageLoadEvent};
use url::Url;

const DEFAULT_WINDOW_WIDTH: f64 = 440.0;
const DEFAULT_WINDOW_HEIGHT: f64 = 740.0;
const MIN_WINDOW_WIDTH: f64 = 360.0;
const MIN_WINDOW_HEIGHT: f64 = 480.0;
const MAX_WINDOW_WIDTH: f64 = 1024.0;
const MAX_WINDOW_HEIGHT: f64 = 1080.0;

const MINI_APP_BRIDGE_SCRIPT: &str = r#"
(function() {
  if (window.TelegramWebviewProxy) return;
  var eventHandlers = {};
  window.TelegramWebviewProxy = {
    postEvent: function(eventType, eventData) {
      if (eventType === 'web_app_close') {
        window.close();
      } else if (eventType === 'web_app_open_link') {
        try {
          var parsed = typeof eventData === 'string' ? JSON.parse(eventData) : eventData;
          if (parsed && parsed.url) {
            window.open(parsed.url, '_blank');
          }
        } catch (e) {}
      }
    }
  };
  window.Telegram = window.Telegram || {};
  window.Telegram.WebView = {
    receiveEvent: function(eventType, eventData) {
      var handlers = eventHandlers[eventType] || [];
      for (var i = 0; i < handlers.length; i++) {
        try { handlers[i](eventData); } catch (e) { console.error(e); }
      }
    },
    onEvent: function(eventType, callback) {
      eventHandlers[eventType] = eventHandlers[eventType] || [];
      eventHandlers[eventType].push(callback);
    }
  };
})();
"#;

pub fn validate_window_id(id: &str) -> Result<(), String> {
    if id.is_empty()
        || id.len() > 64
        || !id
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || character == '-' || character == '_')
    {
        return Err("Invalid mini app window identifier".to_string());
    }
    Ok(())
}

pub fn validate_mini_app_url(raw_url: &str) -> Result<Url, String> {
    if raw_url.trim().is_empty() {
        return Err("Mini App URL cannot be empty".to_string());
    }
    let parsed = Url::parse(raw_url).map_err(|error| format!("Invalid URL: {error}"))?;
    match parsed.scheme() {
        "https" => Ok(parsed),
        "http" if parsed.host_str() == Some("localhost") || parsed.host_str() == Some("127.0.0.1") => {
            Ok(parsed)
        }
        _ => Err("Mini App URL must use https scheme".to_string()),
    }
}

#[tauri::command]
pub async fn fardgram_open_mini_app(
    app: AppHandle,
    id: String,
    url: String,
    title: String,
    bot_username: Option<String>,
) -> Result<(), String> {
    validate_window_id(&id)?;
    let parsed_url = validate_mini_app_url(&url)?;

    let label = format!("mini-app-{id}");
    if let Some(existing) = app.get_webview_window(&label) {
        let _ = existing.unminimize();
        existing.show().map_err(|error| error.to_string())?;
        existing.set_focus().map_err(|error| error.to_string())?;
        return Ok(());
    }

    let window_title = match bot_username {
        Some(ref username) if !username.trim().is_empty() => {
            let clean_username = username.trim_start_matches('@');
            format!("{title} (@{clean_username}) — Fardgram")
        }
        _ => format!("{title} — Fardgram"),
    };

    let width = DEFAULT_WINDOW_WIDTH.clamp(MIN_WINDOW_WIDTH, MAX_WINDOW_WIDTH);
    let height = DEFAULT_WINDOW_HEIGHT.clamp(MIN_WINDOW_HEIGHT, MAX_WINDOW_HEIGHT);

    let mini_app_data_dir = crate::distribution::webview_data_directory(&app)?
        .join("mini_apps");

    let mut builder = WebviewWindowBuilder::new(&app, label, WebviewUrl::External(parsed_url))
        .data_directory(mini_app_data_dir)
        .title(window_title)
        .inner_size(width, height)
        .min_inner_size(MIN_WINDOW_WIDTH, MIN_WINDOW_HEIGHT)
        .resizable(true)
        .maximizable(true)
        .minimizable(true)
        .decorations(true)
        .always_on_top(false)
        .skip_taskbar(false)
        .focused(true)
        .visible(false)
        .initialization_script(MINI_APP_BRIDGE_SCRIPT)
        .on_page_load(|window, payload| {
            if payload.event() != PageLoadEvent::Finished {
                return;
            }
            let _ = window.show();
            let _ = window.set_focus();
        });

    builder = if let Some((x, y)) =
        crate::window_placement::centered_on_main_window(&app, width, height)
    {
        builder.position(x, y)
    } else {
        builder.center()
    };

    builder.build().map_err(|error| error.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn fardgram_close_mini_app(app: AppHandle, id: String) -> Result<(), String> {
    validate_window_id(&id)?;
    let label = format!("mini-app-{id}");
    if let Some(window) = app.get_webview_window(&label) {
        window.close().map_err(|error| error.to_string())?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_valid_and_invalid_window_ids() {
        assert!(validate_window_id("app-12345").is_ok());
        assert!(validate_window_id("valid_id-test").is_ok());
        assert!(validate_window_id("").is_err());
        assert!(validate_window_id("../escape").is_err());
        assert!(validate_window_id("invalid/id").is_err());
    }

    #[test]
    fn validates_safe_and_unsafe_mini_app_urls() {
        assert!(validate_mini_app_url("https://t.me/app").is_ok());
        assert!(validate_mini_app_url("https://example.com/miniapp#tgWebAppData=hash").is_ok());
        assert!(validate_mini_app_url("http://localhost:3000/app").is_ok());
        assert!(validate_mini_app_url("http://127.0.0.1:8080/app").is_ok());

        assert!(validate_mini_app_url("http://insecure-domain.com").is_err());
        assert!(validate_mini_app_url("javascript:alert(1)").is_err());
        assert!(validate_mini_app_url("file:///C:/Windows/System32").is_err());
        assert!(validate_mini_app_url("data:text/html,<h1>PWN</h1>").is_err());
        assert!(validate_mini_app_url("").is_err());
    }
}
