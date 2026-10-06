mod agent;
mod context_menu_window;
mod desktop_lifecycle;
mod desktop_notification;
mod development;
mod diagnostics;
mod display_metrics;
mod distribution;
mod external_links;
mod media_viewer_window;
mod proxy;
mod settings_window;
mod shortcuts;
mod storage;
mod telegram;
mod telegram_links;
mod video_window;
mod webview_security;
mod window_placement;

use tauri::{Manager, WebviewWindowBuilder};

fn create_main_window(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let config = app
        .config()
        .app
        .windows
        .iter()
        .find(|window| window.label == "main")
        .ok_or("main window configuration is unavailable")?;
    let data_directory =
        distribution::webview_data_directory(app.handle()).map_err(std::io::Error::other)?;
    WebviewWindowBuilder::from_config(app.handle(), config)?
        .data_directory(data_directory)
        .build()?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    if distribution::run_release_probe_if_requested() {
        return;
    }
    development::load_environment();
    let context = tauri::generate_context!();
    tauri::Builder::default()
        .manage(telegram_links::startup_queue())
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            let startup = desktop_lifecycle::arguments_include_startup(&args);
            telegram_links::receive_arguments(app, args);
            if !startup {
                desktop_lifecycle::show_main_window(app);
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            create_main_window(app)?;
            webview_security::setup(app)?;
            app.manage(diagnostics::setup(app.handle())?);
            window_placement::setup(app)?;
            if distribution::supports_native_updater() {
                app.handle()
                    .plugin(tauri_plugin_updater::Builder::new().build())?;
            }
            desktop_lifecycle::setup(app)
        })
        .on_window_event(desktop_lifecycle::handle_window_event)
        .manage(telegram::TelegramRuntime::new())
        .manage(telegram::update_delivery::UpdateDelivery::default())
        .manage(proxy::recovery::ProxyRuntime::default())
        .manage(proxy::warp::WarpRuntime::default())
        .manage(proxy::singbox::SingboxRuntime::default())
        .manage(proxy::mhrv::MhrvRuntime::default())
        .manage(telegram::media_stream::MediaStreamRegistry::default())
        .manage(storage::SnapshotCacheWriteState::default())
        .manage(storage::paths::SessionStorage::default())
        .manage(storage::assets::AccountAssets::default())
        .register_asynchronous_uri_scheme_protocol(
            "fardgram-asset",
            |context, request, responder| {
                let app = context.app_handle().clone();
                tauri::async_runtime::spawn_blocking(move || {
                    responder.respond(storage::assets::respond(&app, request))
                });
            },
        )
        .manage(context_menu_window::ContextMenuWindowState::default())
        .manage(desktop_notification::DesktopNotificationWindowState::default())
        .register_asynchronous_uri_scheme_protocol(
            "fardgram-media",
            |context, request, responder| {
                telegram::media_stream::respond(context.app_handle().clone(), request, responder);
            },
        )
        .invoke_handler(tauri::generate_handler![
            agent::fardgram_agent_execute,
            agent::fardgram_agent_test_connection,
            shortcuts::fardgram_check_shortcut,
            telegram_links::fardgram_take_telegram_links,
            telegram_links::fardgram_telegram_protocol_settings,
            telegram_links::fardgram_register_telegram_protocol,
            telegram_links::fardgram_open_default_apps,
            diagnostics::fardgram_diagnostics_settings,
            diagnostics::fardgram_export_diagnostics,
            diagnostics::fardgram_set_crash_reporting_enabled,
            display_metrics::fardgram_display_timing,
            distribution::fardgram_distribution_kind,
            desktop_lifecycle::fardgram_desktop_settings,
            desktop_lifecycle::fardgram_set_launch_on_startup,
            webview_security::fardgram_set_developer_mode,
            desktop_notification::fardgram_show_notification,
            desktop_notification::fardgram_desktop_notification_snapshot,
            desktop_notification::fardgram_show_notification_window,
            desktop_notification::fardgram_dismiss_notification,
            desktop_notification::fardgram_open_notification,
            context_menu_window::fardgram_close_context_menu_window,
            context_menu_window::fardgram_open_context_menu_window,
            context_menu_window::fardgram_prepare_context_menu_window,
            context_menu_window::fardgram_resize_context_menu_window,
            context_menu_window::fardgram_show_context_menu_window,
            external_links::fardgram_open_external_url,
            settings_window::fardgram_open_settings_window,
            media_viewer_window::fardgram_close_media_viewer_window,
            media_viewer_window::fardgram_open_media_viewer_window,
            media_viewer_window::fardgram_show_media_viewer_window,
            video_window::fardgram_close_video_window,
            video_window::fardgram_open_video_window,
            telegram::telegram_runtime_status,
            proxy::telegram_proxy_settings,
            proxy::telegram_save_proxy_settings,
            proxy::telegram_discover_proxies,
            proxy::telegram_apply_discovered_proxies,
            proxy::telegram_quick_connect_best_proxy,
            proxy::telegram_warp_status,
            proxy::telegram_warp_start,
            proxy::telegram_warp_stop,
            proxy::singbox::telegram_singbox_status,
            proxy::singbox::telegram_singbox_start,
            proxy::singbox::telegram_singbox_stop,
            proxy::singbox::telegram_singbox_test_node,
            proxy::singbox::telegram_singbox_parse_link,
            proxy::singbox::telegram_singbox_fetch_subscription,
            proxy::mhrv::telegram_mhrv_status,
            proxy::mhrv::telegram_mhrv_start,
            proxy::mhrv::telegram_mhrv_stop,
            proxy::mhrv::telegram_mhrv_test,
            proxy::recovery::telegram_recover_connection,
            proxy::recovery::telegram_connection_state,
            storage::telegram_storage_settings,
            storage::telegram_save_storage_settings,
            storage::paths::telegram_remove_migration_backup,
            storage::file_actions::telegram_save_downloaded_file,
            storage::file_actions::telegram_open_cached_file,
            storage::file_actions::telegram_save_cached_file_as,
            storage::file_actions::telegram_open_download_directory,
            storage::telegram_cache_usage,
            storage::telegram_clear_media_cache,
            storage::telegram_read_snapshot_cache,
            storage::local_state::telegram_read_local_state,
            storage::local_state::telegram_write_local_state,
            storage::metadata::telegram_read_account_metadata,
            storage::metadata::telegram_write_account_metadata,
            storage::blobs::telegram_begin_blob,
            storage::blobs::telegram_append_blob,
            storage::blobs::telegram_commit_blob,
            storage::blobs::telegram_read_blob_chunk,
            storage::blobs::telegram_attachment_batch,
            storage::blobs::telegram_attachment_inventory,
            storage::inventory::telegram_storage_inventory,
            storage::metadata::telegram_locate_download,
            storage::telegram_write_snapshot_cache,
            storage::telegram_begin_snapshot_cache_write,
            storage::telegram_append_snapshot_cache_chunk,
            storage::telegram_commit_snapshot_cache_write,
            storage::telegram_abort_snapshot_cache_write,
            storage::telegram_clear_snapshot_cache,
            storage::account::telegram_account_state,
            storage::account::telegram_register_account,
            storage::account::telegram_select_account,
            storage::account::telegram_remove_account,
            telegram::telegram_start,
            telegram::telegram_get_api_credentials,
            telegram::telegram_save_api_credentials,
            telegram::telegram_clear_api_credentials,
            telegram::telegram_test_api_credentials,
            telegram::update_delivery::telegram_open_update_stream,
            telegram::update_delivery::telegram_take_updates,
            telegram::update_delivery::telegram_close_update_stream,
            telegram::telegram_send,
            telegram::telegram_recover_file,
            telegram::telegram_optimize_storage,
            telegram::telegram_log_performance,
            telegram::telegram_log_performance_batch,
            telegram::telegram_read_performance_records,
            telegram::telegram_clear_performance_records,
            telegram::telegram_register_media_stream,
            telegram::media_stream::telegram_set_media_focus,
            telegram::telegram_update_media_stream,
            telegram::telegram_suspend_media_stream,
            telegram::telegram_media_stream_status,
            telegram::telegram_send_pasted_files,
            telegram::telegram_pick_and_send_file,
            telegram::telegram_pick_profile_photo,
            telegram::telegram_pick_chat_photo,
            telegram::telegram_shutdown,
        ])
        .run(context)
        .expect("failed to run Fardgram");
}
