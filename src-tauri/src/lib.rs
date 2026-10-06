mod splash;
mod updates;
mod worklog;

use parking_lot::Mutex;
use std::sync::Arc;
use tauri::window::Color;
use tauri::{Emitter, Manager};
use tauri_plugin_store::StoreExt;

type CurrentFile = Arc<Mutex<Option<String>>>;
type SplashState = Mutex<Option<splash::Splash>>;

#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("Failed to read file: {}", e))
}

#[tauri::command]
fn write_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, &content).map_err(|e| format!("Failed to write file: {}", e))
}

#[tauri::command]
fn paths_exist(paths: Vec<String>) -> Vec<bool> {
    paths
        .iter()
        .map(|p| std::path::Path::new(p).exists())
        .collect()
}

#[tauri::command]
fn rename_path(path: String, name: String) -> Result<String, String> {
    let name = name.trim();
    if name.is_empty() || name.contains(['/', '\\', ':', '*', '?', '"', '<', '>', '|']) {
        return Err("Недопустимое имя".into());
    }
    let source = std::path::Path::new(&path);
    let target = source
        .parent()
        .ok_or("Нет родительской папки")?
        .join(name);
    if target == source {
        return Ok(path);
    }
    if target.exists() {
        return Err(format!("«{}» уже существует", name));
    }
    std::fs::rename(source, &target).map_err(|e| format!("Не удалось переименовать: {}", e))?;
    Ok(target.to_string_lossy().into_owned())
}

#[tauri::command]
fn trash_path(path: String) -> Result<(), String> {
    trash::delete(&path).map_err(|e| format!("Не удалось удалить: {}", e))
}

#[tauri::command]
fn duplicate_path(path: String) -> Result<String, String> {
    let source = std::path::Path::new(&path);
    if source.is_dir() {
        return Err("Папки не дублируются".into());
    }
    let parent = source.parent().ok_or("Нет родительской папки")?;
    let stem = source
        .file_stem()
        .map(|s| s.to_string_lossy().into_owned())
        .ok_or("Нет имени файла")?;
    let suffix = source
        .extension()
        .map(|e| format!(".{}", e.to_string_lossy()))
        .unwrap_or_default();

    let target = (1..)
        .map(|i| {
            let name = if i == 1 {
                format!("{} копия{}", stem, suffix)
            } else {
                format!("{} копия {}{}", stem, i, suffix)
            };
            parent.join(name)
        })
        .find(|candidate| !candidate.exists())
        .ok_or("Нет свободного имени")?;

    std::fs::copy(source, &target).map_err(|e| format!("Не удалось дублировать: {}", e))?;
    Ok(target.to_string_lossy().into_owned())
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

const MAX_DEPTH: usize = 8;
const SCAN_BUDGET: usize = 20_000;
const SKIP_DIRS: [&str; 11] = [
    "node_modules",
    "appdata",
    "application data",
    "$recycle.bin",
    "system volume information",
    "target",
    "dist",
    "build",
    "vendor",
    "__pycache__",
    "venv",
];

fn scan_md_files(dir: &std::path::Path, depth: usize, budget: &mut usize) -> Vec<FileEntry> {
    let mut entries = Vec::new();
    if depth >= MAX_DEPTH || *budget == 0 {
        return entries;
    }
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
        if *budget == 0 {
            break;
        }
        *budget -= 1;
        let path = item.path();
        let name = item.file_name().to_string_lossy().to_string();
        if name.starts_with('.') {
            continue;
        }
        let Ok(file_type) = item.file_type() else {
            continue;
        };
        if file_type.is_symlink() {
            continue;
        }
        if file_type.is_dir() {
            if SKIP_DIRS.contains(&name.to_lowercase().as_str()) {
                continue;
            }
            let children = scan_md_files(&path, depth + 1, budget);
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

#[derive(serde::Serialize)]
struct FolderListing {
    entries: Vec<FileEntry>,
    truncated: bool,
}

#[tauri::command]
fn list_md_files(path: String) -> Result<FolderListing, String> {
    let dir = std::path::Path::new(&path);
    if !dir.is_dir() {
        return Err("Not a directory".to_string());
    }
    let mut budget = SCAN_BUDGET;
    let entries = scan_md_files(dir, 0, &mut budget);
    Ok(FolderListing {
        entries,
        truncated: budget == 0,
    })
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

fn paint_window(window: &tauri::WebviewWindow, dark: bool) {
    let (theme, ground) = if dark {
        (tauri::Theme::Dark, Color(0x14, 0x14, 0x16, 0xff))
    } else {
        (tauri::Theme::Light, Color(0xf4, 0xf4, 0xf6, 0xff))
    };
    let _ = window.set_theme(Some(theme));
    let _ = window.set_background_color(Some(ground));
    apply_titlebar_colors(window, dark);
}

#[tauri::command]
fn set_window_theme(window: tauri::WebviewWindow, dark: bool) {
    paint_window(&window, dark);
}

#[tauri::command]
fn app_ready(window: tauri::WebviewWindow, splash: tauri::State<SplashState>) {
    let _ = window.show();
    let _ = window.set_focus();
    if let Some(splash) = splash.lock().take() {
        splash.close();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let context = tauri::generate_context!();
    let splash: SplashState = Mutex::new(splash::show(&context.config().identifier));
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
        .manage(splash)
        .manage(updates::PendingUpdate::default())
        .invoke_handler(tauri::generate_handler![
            read_file,
            write_file,
            get_current_file,
            paths_exist,
            list_md_files,
            rename_path,
            trash_path,
            duplicate_path,
            set_window_theme,
            app_ready,
            updates::update_prepare,
            worklog::worklog_read,
            worklog::git_show,
            worklog::git_file
        ])
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let dark = app
                    .store("settings.json")
                    .ok()
                    .and_then(|store| store.get("theme"))
                    .map_or(true, |theme| theme != "light");
                paint_window(&window, dark);
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_secs(8));
                    if !window.is_visible().unwrap_or(true) {
                        let _ = window.show();
                    }
                });
            }
            if let Some(path) = std::env::args().nth(1).filter(|path| is_text_file(path)) {
                *app.state::<CurrentFile>().lock() = Some(path);
            }
            Ok(())
        })
        .build(context)
        .expect("error while building tauri application")
        .run(|app, event| {
            if let tauri::RunEvent::Exit = event {
                updates::install_pending(app);
            }
        });
}
