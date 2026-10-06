use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::Manager;

#[derive(serde::Serialize)]
pub struct RawFile {
    name: String,
    text: String,
}

#[derive(serde::Serialize)]
pub struct RawTask {
    id: String,
    files: Vec<RawFile>,
}

#[derive(serde::Serialize)]
pub struct RawProject {
    slug: String,
    project: String,
    tasks: Vec<RawTask>,
}

#[derive(serde::Serialize)]
pub struct Worklog {
    root: String,
    projects: Vec<RawProject>,
}

fn root(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path()
        .home_dir()
        .map(|home| home.join("Documents").join("Worklog"))
        .map_err(|e| e.to_string())
}

fn subdirs(dir: &Path) -> Vec<PathBuf> {
    let mut dirs: Vec<PathBuf> = std::fs::read_dir(dir)
        .into_iter()
        .flatten()
        .flatten()
        .map(|e| e.path())
        .filter(|p| p.is_dir() && !p.file_name().is_some_and(|n| n.to_string_lossy().starts_with('.')))
        .collect();
    dirs.sort();
    dirs
}

fn md_files(dir: &Path) -> Vec<RawFile> {
    let mut files: Vec<RawFile> = std::fs::read_dir(dir)
        .into_iter()
        .flatten()
        .flatten()
        .filter(|e| e.path().extension().is_some_and(|x| x == "md"))
        .filter_map(|e| {
            Some(RawFile {
                name: e.file_name().to_string_lossy().to_string(),
                text: std::fs::read_to_string(e.path()).ok()?,
            })
        })
        .collect();
    files.sort_by(|a, b| a.name.cmp(&b.name));
    files
}

fn dir_name(p: &Path) -> String {
    p.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default()
}

#[tauri::command]
pub fn worklog_read(app: tauri::AppHandle) -> Result<Worklog, String> {
    let root = root(&app)?;
    let projects = subdirs(&root)
        .into_iter()
        .filter_map(|dir| {
            let project = std::fs::read_to_string(dir.join("project.md")).ok()?;
            let tasks = subdirs(&dir)
                .into_iter()
                .map(|t| RawTask { id: dir_name(&t), files: md_files(&t) })
                .filter(|t| t.files.iter().any(|f| f.name == "task.md"))
                .collect();
            Some(RawProject { slug: dir_name(&dir), project, tasks })
        })
        .collect();
    Ok(Worklog { root: root.to_string_lossy().to_string(), projects })
}

fn git(repo: &str, args: &[&str]) -> std::io::Result<std::process::Output> {
    let mut cmd = Command::new("git");
    cmd.arg("-C").arg(repo).args(args);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000);
    }
    cmd.output()
}

#[tauri::command]
pub async fn git_show(repo: String, hash: String) -> Result<String, String> {
    if !hash.chars().all(|c| c.is_ascii_hexdigit()) || hash.len() < 4 {
        return Err("Некорректный hash коммита".into());
    }
    if !Path::new(&repo).is_dir() {
        return Err(format!("Папка репозитория не найдена: {repo}"));
    }
    tauri::async_runtime::spawn_blocking(move || {
        let out = git(&repo, &["-c", "core.quotepath=false", "show", "--no-color", "--no-ext-diff", "--no-textconv", "--diff-merges=first-parent", "--format=%H%n%an%n%aI%n%B%x00", "--patch", "--find-renames", &hash])
            .map_err(|_| "Git не найден — установите Git for Windows".to_string())?;
        git_result(out)
    })
    .await
    .map_err(|e| e.to_string())?
}

fn git_result(out: std::process::Output) -> Result<String, String> {
    if out.status.success() {
        return Ok(String::from_utf8_lossy(&out.stdout).to_string());
    }
    let err = String::from_utf8_lossy(&out.stderr);
    if err.contains("not a git repository") {
        Err("Папка не является git-репозиторием".into())
    } else if err.contains("unknown revision") || err.contains("bad object") || err.contains("ambiguous argument") {
        Err("Коммит не найден в репозитории — возможно, ветку не подтянули (git fetch)".into())
    } else {
        Err(err.trim().to_string())
    }
}

#[tauri::command]
pub async fn git_mainline(repo: String) -> Result<String, String> {
    if !Path::new(&repo).is_dir() {
        return Err(format!("Папка репозитория не найдена: {repo}"));
    }
    tauri::async_runtime::spawn_blocking(move || {
        let mut last = Err("Основная ветка не найдена".to_string());
        for branch in ["origin/HEAD", "origin/main", "origin/master", "main", "master"] {
            let out = git(&repo, &["log", "--first-parent", "--no-color", "--format=%H%x09%aI%x09%s", branch])
                .map_err(|_| "Git не найден — установите Git for Windows".to_string())?;
            last = git_result(out);
            if last.is_ok() {
                break;
            }
        }
        last
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub async fn git_file(repo: String, hash: String, path: String) -> Result<String, String> {
    if !hash.chars().all(|c| c.is_ascii_hexdigit()) || hash.len() < 4 {
        return Err("Некорректный hash коммита".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        let spec = format!("{hash}:{path}");
        let out = git(&repo, &["show", "--no-color", "--no-textconv", &spec])
            .map_err(|_| "Git не найден — установите Git for Windows".to_string())?;
        git_result(out)
    })
    .await
    .map_err(|e| e.to_string())?
}
