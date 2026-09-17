use parking_lot::Mutex;
use tauri::{AppHandle, Manager};
use tauri_plugin_updater::{Update, UpdaterExt};

#[derive(Default)]
pub struct PendingUpdate(Mutex<Option<(Update, Vec<u8>)>>);

#[tauri::command]
pub async fn update_prepare(app: AppHandle) -> Result<Option<String>, String> {
    if cfg!(debug_assertions) {
        return Ok(None);
    }
    let updater = app.updater().map_err(|e| e.to_string())?;
    let Some(update) = updater.check().await.map_err(|e| e.to_string())? else {
        return Ok(None);
    };
    let bytes = update.download(|_, _| {}, || {}).await.map_err(|e| e.to_string())?;
    let version = update.version.clone();
    *app.state::<PendingUpdate>().0.lock() = Some((update, bytes));
    Ok(Some(version))
}

pub fn install_pending(app: &AppHandle) {
    let pending = app.state::<PendingUpdate>().0.lock().take();
    if let Some((update, bytes)) = pending {
        let _ = update.restart_after_install(false).install(bytes);
    }
}
