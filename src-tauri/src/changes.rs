use crate::worklog::{dir_name, git, git_result, root, subdirs, MAINLINE};
use notify_debouncer_mini::{
    new_debouncer,
    notify::{RecommendedWatcher, RecursiveMode},
    DebounceEventResult, Debouncer,
};
use parking_lot::Mutex;
use std::path::Path;
use std::time::Duration;
use tauri::Emitter;

const IGNORED_DIRS: [&str; 3] = ["node_modules", "target", "dist"];
const NO_GIT: &str = "Git не найден — установите Git for Windows";
const DIFF: [&str; 8] = ["--no-optional-locks", "-c", "core.quotepath=false", "diff", "--no-color", "--no-ext-diff", "--no-textconv", "--find-renames"];

static WATCHER: Mutex<Option<Debouncer<RecommendedWatcher>>> = Mutex::new(None);

fn norm(path: &str) -> String {
    path.replace('\\', "/").trim_start_matches("//?/").trim_end_matches('/').to_lowercase()
}

fn is_relevant(repo: &str, path: &Path) -> bool {
    let full = norm(&path.to_string_lossy());
    let root = norm(repo);
    let Some(rel) = full.strip_prefix(&root).filter(|r| r.is_empty() || r.starts_with('/')) else {
        return false;
    };
    let parts: Vec<&str> = rel.split('/').filter(|p| !p.is_empty()).collect();
    if parts.first() == Some(&".git") {
        return matches!(parts.as_slice(), [_, "head"] | [_, "index"] | [_, "refs", "heads", ..]);
    }
    !parts.iter().any(|p| IGNORED_DIRS.contains(p))
}

fn is_notes(notes: &str, path: &Path) -> bool {
    let p = norm(&path.to_string_lossy());
    p == notes || notes.strip_prefix(&p).is_some_and(|r| r.starts_with('/'))
}

fn run(repo: &str, args: &[&str]) -> Result<String, String> {
    git_result(git(repo, args).map_err(|_| NO_GIT.to_string())?)
}

fn check_repo(repo: &str) -> Result<(), String> {
    if Path::new(repo).is_dir() {
        Ok(())
    } else {
        Err(format!("Папка репозитория не найдена: {repo}"))
    }
}

fn merge_base(repo: &str) -> Result<String, String> {
    run(repo, &["rev-parse", "--git-dir"])?;
    MAINLINE
        .iter()
        .find_map(|branch| run(repo, &["merge-base", "HEAD", branch]).ok())
        .map(|s| s.trim().to_string())
        .ok_or_else(|| "Основная ветка не найдена".to_string())
}

fn untracked_diff(repo: &str) -> Result<String, String> {
    let list = run(repo, &["--no-optional-locks", "ls-files", "--others", "--exclude-standard", "-z"])?;
    let mut out = String::new();
    for file in list.split('\0').filter(|f| !f.is_empty()) {
        let args: Vec<&str> = DIFF[..7].iter().copied().chain(["--no-index", "--", "/dev/null", file]).collect();
        let res = git(repo, &args).map_err(|_| NO_GIT.to_string())?;
        if matches!(res.status.code(), Some(0 | 1)) {
            out.push_str(&String::from_utf8_lossy(&res.stdout));
        }
    }
    Ok(out)
}

#[tauri::command]
pub async fn git_worktree_diff(repo: String, mode: String) -> Result<String, String> {
    check_repo(&repo)?;
    tauri::async_runtime::spawn_blocking(move || {
        let base = match mode.as_str() {
            "uncommitted" => "HEAD".to_string(),
            "branch" => merge_base(&repo)?,
            _ => return Err(format!("Неизвестный режим: {mode}")),
        };
        let args: Vec<&str> = DIFF.iter().copied().chain([base.as_str(), "--"]).collect();
        let mut patch = run(&repo, &args)?;
        patch.push_str(&untracked_diff(&repo)?);
        Ok(patch)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn git_current_branch(repo: String) -> Result<String, String> {
    check_repo(&repo)?;
    tauri::async_runtime::spawn_blocking(move || {
        let name = run(&repo, &["branch", "--show-current"])?.trim().to_string();
        if !name.is_empty() {
            return Ok(name);
        }
        run(&repo, &["rev-parse", "--short", "HEAD"]).map(|s| s.trim().to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn changes_watch(app: tauri::AppHandle, repo: String, notes_path: Option<String>) -> Result<(), String> {
    check_repo(&repo)?;
    let notes = notes_path.filter(|p| !p.is_empty());
    let root = repo.clone();
    let notes_norm = notes.as_deref().map(norm);
    let mut debouncer = new_debouncer(Duration::from_millis(300), move |res: DebounceEventResult| {
        let Ok(events) = res else { return };
        let hit = events
            .iter()
            .any(|e| is_relevant(&root, &e.path) || notes_norm.as_deref().is_some_and(|n| is_notes(n, &e.path)));
        if hit {
            let _ = app.emit("changes-updated", ());
        }
    })
    .map_err(|e| e.to_string())?;
    debouncer.watcher().watch(Path::new(&repo), RecursiveMode::Recursive).map_err(|e| e.to_string())?;
    if let Some(notes) = notes.as_deref() {
        let dir = Path::new(notes).parent();
        let target = dir.filter(|d| d.is_dir()).map(|d| (d, RecursiveMode::NonRecursive)).or_else(|| {
            dir.and_then(|d| d.ancestors().find(|a| a.is_dir())).map(|a| (a, RecursiveMode::Recursive))
        });
        if let Some((dir, mode)) = target.filter(|(d, _)| !is_relevant(&repo, d)) {
            debouncer.watcher().watch(dir, mode).map_err(|e| e.to_string())?;
        }
    }
    *WATCHER.lock() = Some(debouncer);
    Ok(())
}

#[tauri::command]
pub fn changes_unwatch() {
    *WATCHER.lock() = None;
}

#[derive(serde::Serialize)]
pub struct NotesFile {
    slug: String,
    task: String,
    path: String,
    text: String,
}

#[tauri::command]
pub fn changes_notes(app: tauri::AppHandle) -> Result<Vec<NotesFile>, String> {
    let root = root(&app)?;
    Ok(subdirs(&root)
        .into_iter()
        .flat_map(|project| {
            let slug = dir_name(&project);
            subdirs(&project).into_iter().filter_map(move |task| {
                let path = task.join("notes.json");
                let text = std::fs::read_to_string(&path).ok()?;
                Some(NotesFile { slug: slug.clone(), task: dir_name(&task), path: path.to_string_lossy().to_string(), text })
            })
        })
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn filters_paths() {
        let repo = "C:/Users/a/Proj";
        assert!(is_relevant(repo, Path::new("C:\\Users\\a\\Proj\\src\\main.rs")));
        assert!(is_relevant(repo, Path::new("C:\\Users\\a\\Proj\\.git\\HEAD")));
        assert!(is_relevant(repo, Path::new("C:\\Users\\a\\Proj\\.git\\index")));
        assert!(is_relevant(repo, Path::new("C:\\Users\\a\\Proj\\.git\\refs\\heads\\VS-734")));
        assert!(!is_relevant(repo, Path::new("C:\\Users\\a\\Proj\\.git\\index.lock")));
        assert!(!is_relevant(repo, Path::new("C:\\Users\\a\\Proj\\.git\\objects\\ab\\cd")));
        assert!(!is_relevant(repo, Path::new("C:\\Users\\a\\Proj\\node_modules\\x\\a.js")));
        assert!(!is_relevant(repo, Path::new("C:\\Users\\a\\Proj\\src-tauri\\target\\debug\\x")));
        assert!(!is_relevant(repo, Path::new("C:\\Users\\a\\Other\\file.rs")));
        assert!(!is_relevant(repo, Path::new("C:\\Users\\a\\Proj-main\\file.rs")));
    }

    #[test]
    fn matches_notes() {
        let notes = norm("C:\\Users\\a\\Worklog\\breeze\\VS-734\\notes.json");
        assert!(is_notes(&notes, Path::new("C:/Users/a/Worklog/breeze/VS-734/notes.json")));
        assert!(is_notes(&notes, Path::new("C:\\Users\\a\\Worklog\\breeze\\VS-734")));
        assert!(!is_notes(&notes, Path::new("C:\\Users\\a\\Worklog\\breeze\\VS-734\\001-phase.md")));
        assert!(!is_notes(&notes, Path::new("C:\\Users\\a\\Worklog\\breeze\\VS-73")));
    }
}
