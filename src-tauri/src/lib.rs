use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Set up panic hook for logging before abort
    std::panic::set_hook(Box::new(|info| {
        log::error!("Panic occurred: {}", info);
        // Note: SQLite in WAL mode handles checkpoints automatically,
        // so no explicit cleanup is needed here
    }));

    if let Err(e) = tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;

                // Open devtools in debug mode
                if let Some(window) = app.get_webview_window("main") {
                    window.open_devtools();
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
    {
        eprintln!("Failed to start JurisDesk: {}", e);
        std::process::exit(1);
    }
}
