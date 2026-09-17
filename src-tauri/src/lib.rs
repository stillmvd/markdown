mod updates;

use parking_lot::Mutex;
use std::sync::Arc;
use tauri::{Emitter, Manager};

type CurrentFile = Arc<Mutex<Option<String>>>;

#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("Failed to read file: {}", e))
}

#[tauri::command]
fn write_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, &content).map_err(|e| format!("Failed to write file: {}", e))
}

#[tauri::command]
fn get_current_file(state: tauri::State<CurrentFile>) -> Option<String> {
    state.lock().clone()
}

#[derive(serde::Serialize)]
struct FileEntry {
    name: String,
    path: String,
    is_dir: bool,
    children: Option<Vec<FileEntry>>,
}

fn scan_md_files(dir: &std::path::Path) -> Vec<FileEntry> {
    let mut entries = Vec::new();
    let Ok(read_dir) = std::fs::read_dir(dir) else {
        return entries;
    };
    let mut items: Vec<_> = read_dir.filter_map(|e| e.ok()).collect();
    items.sort_by(|a, b| {
        let a_dir = a.file_type().map(|t| t.is_dir()).unwrap_or(false);
        let b_dir = b.file_type().map(|t| t.is_dir()).unwrap_or(false);
        b_dir.cmp(&a_dir).then_with(|| a.file_name().cmp(&b.file_name()))
    });
    for item in items {
        let path = item.path();
        let name = item.file_name().to_string_lossy().to_string();
        if name.starts_with('.') {
            continue;
        }
        if path.is_dir() {
            let children = scan_md_files(&path);
            if !children.is_empty() {
                entries.push(FileEntry {
                    name,
                    path: path.to_string_lossy().to_string(),
                    is_dir: true,
                    children: Some(children),
                });
            }
        } else if is_text_file(&name) {
            entries.push(FileEntry {
                name,
                path: path.to_string_lossy().to_string(),
                is_dir: false,
                children: None,
            });
        }
    }
    entries
}

const TEXT_EXTENSIONS: [&str; 5] = ["md", "markdown", "txt", "text", "log"];

fn is_text_file(path: &str) -> bool {
    std::path::Path::new(path)
        .extension()
        .and_then(|ext| ext.to_str())
        .is_some_and(|ext| TEXT_EXTENSIONS.iter().any(|known| known.eq_ignore_ascii_case(ext)))
}

#[tauri::command]
fn list_md_files(path: String) -> Result<Vec<FileEntry>, String> {
    let dir = std::path::Path::new(&path);
    if !dir.is_dir() {
        return Err("Not a directory".to_string());
    }
    Ok(scan_md_files(dir))
}

#[cfg(windows)]
fn apply_titlebar_colors(window: &tauri::WebviewWindow, dark: bool) {
    use windows_sys::Win32::Graphics::Dwm::{
        DwmSetWindowAttribute, DWMWA_BORDER_COLOR, DWMWA_CAPTION_COLOR, DWMWA_TEXT_COLOR,
    };
    let Ok(hwnd) = window.hwnd() else { return };
    let (caption, text, border): (u32, u32, u32) = if dark {
        (0x00161414, 0x00EFECEC, 0x00332E2E)
    } else {
        (0x00F6F4F4, 0x001A1717, 0x00E2DEDE)
    };
    for (attribute, color) in [
        (DWMWA_CAPTION_COLOR, caption),
        (DWMWA_TEXT_COLOR, text),
        (DWMWA_BORDER_COLOR, border),
    ] {
        unsafe {
            DwmSetWindowAttribute(
                hwnd.0 as _,
                attribute as u32,
                &color as *const u32 as _,
                std::mem::size_of::<u32>() as u32,
            );
        }
    }
}

#[cfg(not(windows))]
fn apply_titlebar_colors(_window: &tauri::WebviewWindow, _dark: bool) {}

#[tauri::command]
fn set_window_theme(window: tauri::WebviewWindow, dark: bool) {
    let _ = window.set_theme(Some(if dark { tauri::Theme::Dark } else { tauri::Theme::Light }));
    apply_titlebar_colors(&window, dark);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let current_file: CurrentFile = Arc::new(Mutex::new(None));

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            if let Some(path) = args.get(1) {
                if is_text_file(path) {
                    let state = app.state::<CurrentFile>();
                    *state.lock() = Some(path.clone());
                    let _ = app.emit("file-open-request", path.clone());
                }
            }
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            }
        }))
        .manage(current_file.clone())
        .manage(updates::PendingUpdate::default())
        .invoke_handler(tauri::generate_handler![
            read_file,
            write_file,
            get_current_file,
            list_md_files,
            set_window_theme,
            updates::update_prepare
        ])
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                apply_titlebar_colors(&window, true);
            }
            let args: Vec<String> = std::env::args().collect();
            if let Some(path) = args.get(1) {
                if is_text_file(path) {
                    let path_owned = path.clone();
                    let state = app.state::<CurrentFile>();
                    *state.lock() = Some(path_owned.clone());
                    let handle = app.handle().clone();
                    std::thread::spawn(move || {
                        std::thread::sleep(std::time::Duration::from_millis(500));
                        let _ = handle.emit("file-open-request", path_owned);
                    });
                }
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if let tauri::RunEvent::Exit = event {
                updates::install_pending(app);
            }
        });
}
