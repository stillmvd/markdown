import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { load } from "@tauri-apps/plugin-store";
import { installNow, UpdateToast } from "@stillmvd/tauri-ship";
import type { ViewMode, FileEntry, FolderListing, RecentEntry } from "./types";
import { useFile } from "./hooks/useFile";
import { useTheme } from "./hooks/useTheme";
import { useRecentFiles } from "./hooks/useRecentFiles";
import { useKeyboard } from "./hooks/useKeyboard";
import Toolbar from "./components/Toolbar";
import Editor from "./components/Editor";
import Viewer from "./components/Viewer";
import StatusBar from "./components/StatusBar";
import TableOfContents from "./components/TableOfContents";
import WelcomeScreen from "./components/WelcomeScreen";
import DragDropOverlay, { type DragState } from "./components/DragDropOverlay";
import { isPlainTextFile, isTextFile } from "./lib/markdown-utils";
import { SEARCH_INPUT_ID } from "./components/SearchBar";
import FolderSidebar from "./components/FolderSidebar";
import UnsavedDialog from "./components/UnsavedDialog";
import { useToast } from "./components/Toast";
import Journal from "./components/Journal";
import PanelReveal from "./components/PanelReveal";
import Icon from "./components/Icon";
import { loadWorklog, type WorklogProject, type WorklogTask } from "./lib/worklog";
import { plural } from "./lib/plural";

const JOURNAL_PROJECT_KEY = "journal-project";

function readJournalProject() {
  try {
    return localStorage.getItem(JOURNAL_PROJECT_KEY);
  } catch {
    return null;
  }
}

function App() {
  const toast = useToast();
  const { theme, toggleTheme } = useTheme();
  const file = useFile();
  const { recentFiles, addRecentFile, addRecentFolder, removeRecent, clearRecent } = useRecentFiles();
  const [mode, setMode] = useState<ViewMode>("view");
  const [showToc, setShowToc] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [dragState, setDragState] = useState<DragState>(null);
  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [folderFiles, setFolderFiles] = useState<FileEntry[]>([]);
  const [folderTruncated, setFolderTruncated] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [journalOpen, setJournalOpen] = useState(false);
  const [journalProject, setJournalProject] = useState<string | null>(readJournalProject);
  const [journalTask, setJournalTask] = useState<string | null>(null);
  const [journalEntry, setJournalEntry] = useState<string | null>(null);
  const [worklog, setWorklog] = useState<{ root: string; projects: WorklogProject[] } | null>(null);
  const [worklogError, setWorklogError] = useState<string | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const closedPathRef = useRef<string | null>(null);
  const hasChangesRef = useRef(file.hasChanges);

  const isFileOpen = file.filePath !== null || file.isDraft;
  const isPlain = file.filePath !== null && isPlainTextFile(file.filePath);
  const showJournal = journalOpen && !isFileOpen;

  const reloadWorklog = useCallback(() => {
    loadWorklog().then(
      (data) => {
        setWorklog(data);
        setWorklogError(null);
      },
      (e) => setWorklogError(String(e)),
    );
  }, []);

  useEffect(reloadWorklog, [reloadWorklog]);

  const activeTasks = useMemo(
    () => (worklog?.projects ?? [])
      .flatMap((project) => project.tasks.filter((task) => task.status !== "done").map((task) => ({ project, task })))
      .sort((a, b) => b.task.lastActivity.localeCompare(a.task.lastActivity))
      .slice(0, 2),
    [worklog],
  );
  const taskCount = worklog?.projects.reduce((n, p) => n + p.tasks.length, 0) ?? 0;

  const handleOpenJournal = useCallback(() => {
    reloadWorklog();
    setJournalOpen(true);
  }, [reloadWorklog]);

  const handleSelectJournalProject = useCallback((slug: string) => {
    setJournalProject(slug);
    try {
      localStorage.setItem(JOURNAL_PROJECT_KEY, slug);
    } catch {}
  }, []);

  useEffect(() => {
    hasChangesRef.current = file.hasChanges;
  }, [file.hasChanges]);

  const loadFolderFiles = useCallback(async (path: string) => {
    try {
      const listing = await invoke<FolderListing>("list_md_files", { path });
      setFolderFiles(listing.entries);
      setFolderTruncated(listing.truncated);
    } catch (e) {
      console.error("Failed to load folder:", e);
      setFolderFiles([]);
      setFolderTruncated(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const store = await load("settings.json");
        const saved = await store.get<string>("folderPath");
        if (saved) {
          setFolderPath(saved);
          loadFolderFiles(saved);
        }
      } catch {}
    })();
  }, [loadFolderFiles]);

  const handleOpenFolderPath = useCallback(async (path: string) => {
    setFolderPath(path);
    loadFolderFiles(path);
    addRecentFolder(path);
    try {
      const store = await load("settings.json");
      await store.set("folderPath", path);
      await store.save();
    } catch {}
  }, [loadFolderFiles, addRecentFolder]);

  const handleOpenFolder = useCallback(async () => {
    const selected = await open({ directory: true });
    if (selected) handleOpenFolderPath(selected);
  }, [handleOpenFolderPath]);

  const handleCloseFolder = useCallback(async () => {
    setFolderPath(null);
    setFolderFiles([]);
    setFolderTruncated(false);
    try {
      const store = await load("settings.json");
      await store.delete("folderPath");
      await store.save();
    } catch {}
  }, []);

  const refreshFolder = useCallback(() => {
    if (folderPath) loadFolderFiles(folderPath);
  }, [folderPath, loadFolderFiles]);

  const handleRenamed = useCallback((from: string, to: string) => {
    refreshFolder();
    if (file.filePath === from) file.adoptPath(to);
  }, [refreshFolder, file]);

  const handleDeleted = useCallback((path: string) => {
    refreshFolder();
    const current = file.filePath;
    if (current === path || current?.startsWith(path + "\\") || current?.startsWith(path + "/")) file.closeFile();
  }, [refreshFolder, file]);

  const guard = useCallback((action: () => void) => {
    if (pendingAction) return;
    if (file.hasChanges) setPendingAction(() => action);
    else action();
  }, [pendingAction, file.hasChanges]);

  const handleOpenPath = useCallback((path: string) => {
    guard(async () => {
      const result = await file.openFile(path);
      if (result) {
        closedPathRef.current = null;
        addRecentFile(result);
        setMode("view");
        setJournalOpen(false);
      }
    });
  }, [guard, file, addRecentFile]);

  const handleOpen = useCallback(async () => {
    if (pendingAction) return;
    const path = await file.pickFile();
    if (path) handleOpenPath(path);
  }, [pendingAction, file, handleOpenPath]);

  const handleNew = useCallback(() => {
    guard(() => {
      file.newFile();
      setMode("edit");
      setJournalOpen(false);
    });
  }, [guard, file.newFile]);

  const handleOpenRecent = useCallback((entry: RecentEntry) => {
    if (entry.kind === "folder") handleOpenFolderPath(entry.path);
    else handleOpenPath(entry.path);
  }, [handleOpenFolderPath, handleOpenPath]);

  const handleHome = useCallback(() => {
    if (!isFileOpen) {
      if (journalEntry) setJournalEntry(null);
      else if (journalTask) setJournalTask(null);
      else setJournalOpen(false);
      return;
    }
    const path = file.filePath;
    guard(() => {
      closedPathRef.current = path;
      file.closeFile();
      setMode("view");
    });
  }, [isFileOpen, file, guard, journalTask, journalEntry]);

  const closeJournal = useCallback(() => {
    setJournalTask(null);
    setJournalEntry(null);
    setJournalOpen(false);
  }, []);

  const handleGoHome = useCallback(() => {
    if (isFileOpen) handleHome();
    else closeJournal();
  }, [isFileOpen, handleHome, closeJournal]);

  const handleToolbarJournal = useCallback(() => {
    if (!isFileOpen) {
      if (journalOpen) closeJournal();
      else handleOpenJournal();
      return;
    }
    const path = file.filePath;
    guard(() => {
      closedPathRef.current = path;
      file.closeFile();
      setMode("view");
      handleOpenJournal();
    });
  }, [isFileOpen, journalOpen, file, guard, closeJournal, handleOpenJournal]);

  const handleForward = useCallback(() => {
    const path = closedPathRef.current;
    if (!isFileOpen && path) handleOpenPath(path);
  }, [isFileOpen, handleOpenPath]);

  const handleOpenTask = useCallback((project: WorklogProject, task: WorklogTask) => {
    handleSelectJournalProject(project.slug);
    setJournalTask(task.id);
    setJournalEntry(null);
    setJournalOpen(true);
  }, [handleSelectJournalProject]);

  const handleSave = useCallback(async () => {
    try {
      const path = await file.saveFile();
      if (path) {
        setMode("view");
        addRecentFile(path);
        toast(`«${path.split(/[\\/]/).pop()}» сохранён`);
      }
      return path !== null;
    } catch (e) {
      console.error("Failed to save file:", e);
      toast("Не удалось сохранить файл", "error");
      return false;
    }
  }, [file, addRecentFile, toast]);

  const cancelPendingAction = useCallback(() => {
    setPendingAction(null);
  }, []);

  const runPendingAction = useCallback(() => {
    setPendingAction(null);
    pendingAction?.();
  }, [pendingAction]);

  const saveThenRunPendingAction = useCallback(async () => {
    if (await handleSave()) runPendingAction();
    else cancelPendingAction();
  }, [handleSave, runPendingAction, cancelPendingAction]);

  const handleToggleMode = useCallback(() => {
    setMode((prev) => (prev === "view" ? "edit" : "view"));
  }, []);

  const focusSearch = useCallback(() => {
    requestAnimationFrame(() => {
      const input = document.getElementById(SEARCH_INPUT_ID) as HTMLInputElement | null;
      input?.focus();
      input?.select();
    });
  }, []);

  const handleSearch = useCallback(() => {
    if (mode !== "view" || !isFileOpen) return;
    setShowSearch(true);
    focusSearch();
  }, [mode, isFileOpen, focusSearch]);

  const handleToggleSearch = useCallback(() => {
    if (showSearch) setShowSearch(false);
    else handleSearch();
  }, [showSearch, handleSearch]);

  const closeSearch = useCallback(() => {
    setShowSearch(false);
  }, []);

  useEffect(() => {
    setShowSearch(false);
  }, [file.filePath, mode]);

  const handleExportPdf = useCallback(() => {
    window.print();
  }, []);

  const keyboardActions = useMemo(() => ({
    onSave: pendingAction ? saveThenRunPendingAction : handleSave,
    onOpen: handleOpen,
    onToggleMode: handleToggleMode,
    onSearch: handleSearch,
    onClose: handleHome,
  }), [pendingAction, saveThenRunPendingAction, handleSave, handleOpen, handleToggleMode, handleSearch, handleHome]);

  useKeyboard(keyboardActions);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (e.button === 3) {
        e.preventDefault();
        handleHome();
      } else if (e.button === 4) {
        e.preventDefault();
        handleForward();
      }
    };
    window.addEventListener("mouseup", handler);
    return () => window.removeEventListener("mouseup", handler);
  }, [handleHome, handleForward]);

  const { openFile } = file;
  useEffect(() => {
    (async () => {
      const path = await invoke<string | null>("get_current_file").catch(() => null);
      if (path && (await openFile(path))) addRecentFile(path);
      await document.fonts.ready;
      invoke("app_ready");
    })();
  }, [openFile, addRecentFile]);

  useEffect(() => {
    const appWindow = getCurrentWindow();
    const unlisten = appWindow.onCloseRequested((event) => {
      if (!hasChangesRef.current) return;
      event.preventDefault();
      setPendingAction((current) => current ?? (() => {
        appWindow.destroy();
      }));
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    const unlisten = listen<string>("file-open-request", (event) => {
      handleOpenPath(event.payload);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [handleOpenPath]);

  useEffect(() => {
    const unlistenDrop = getCurrentWindow().onDragDropEvent(({ payload }) => {
      if (payload.type === "enter") {
        if (payload.paths.length === 0) setDragState(null);
        else setDragState(payload.paths.some(isTextFile) ? "text" : "other");
      } else if (payload.type === "drop") {
        setDragState(null);
        const textFile = payload.paths.find(isTextFile);
        if (textFile) handleOpenPath(textFile);
      } else if (payload.type === "leave") {
        setDragState(null);
      }
    });

    return () => {
      unlistenDrop.then((fn) => fn());
    };
  }, [handleOpenPath]);

  useEffect(() => {
    const title = file.fileName
      ? `${file.fileName}${file.hasChanges ? " *" : ""} — MARKDOWN`
      : "MARKDOWN";
    getCurrentWindow().setTitle(title);
  }, [file.fileName, file.hasChanges]);

  return (
    <div className="h-screen flex flex-col bg-ground text-fg">
      <Toolbar
        mode={mode}
        theme={theme}
        fileName={file.fileName}
        hasChanges={file.hasChanges || file.isDraft}
        isFileOpen={isFileOpen}
        canGoHome={isFileOpen || journalOpen}
        onOpen={handleOpen}
        onSave={handleSave}
        onNew={handleNew}
        onHome={handleGoHome}
        onOpenFolder={handleOpenFolder}
        onToggleMode={handleToggleMode}
        onToggleTheme={toggleTheme}
        onToggleToc={() => setShowToc((prev) => !prev)}
        showToc={showToc}
        onToggleSearch={handleToggleSearch}
        showSearch={showSearch}
        onExportPdf={handleExportPdf}
        journalOpen={showJournal}
        onOpenJournal={handleToolbarJournal}
      />

      <div className="relative flex flex-1 overflow-hidden">
        {!showJournal && (
          <PanelReveal show={!!folderPath}>
            {folderPath && (
              <FolderSidebar
                files={folderFiles}
                truncated={folderTruncated}
                folderPath={folderPath}
                currentFilePath={file.filePath}
                onFileClick={handleOpenPath}
                onClose={handleCloseFolder}
                onRefresh={refreshFolder}
                onRenamed={handleRenamed}
                onDeleted={handleDeleted}
              />
            )}
          </PanelReveal>
        )}

        {mode === "view" && isFileOpen && (
          <PanelReveal show={showToc}>
            <TableOfContents
              content={file.content}
              sheetRef={sheetRef}
              onClose={() => setShowToc(false)}
            />
          </PanelReveal>
        )}

        {showJournal ? (
          <Journal
            projects={worklog?.projects ?? null}
            error={worklogError}
            selected={journalProject}
            onSelect={(slug) => {
              handleSelectJournalProject(slug);
              setJournalTask(null);
              setJournalEntry(null);
            }}
            taskId={journalTask}
            onBack={() => {
              setJournalTask(null);
              setJournalEntry(null);
            }}
            entryFile={journalEntry}
            onEntry={setJournalEntry}
            onOpenTask={handleOpenTask}
            onClose={closeJournal}
          />
        ) : !isFileOpen ? (
          <WelcomeScreen
            activeTasks={activeTasks}
            onOpenTask={handleOpenTask}
            recentFiles={recentFiles}
            onOpenRecent={handleOpenRecent}
            onRemoveRecent={removeRecent}
            onClearRecent={clearRecent}
          />
        ) : mode === "view" ? (
          <Viewer
            content={file.content}
            filePath={file.filePath}
            folderPath={folderPath}
            onOpenFile={handleOpenPath}
            sheetRef={sheetRef}
            plain={isPlain}
            showSearch={showSearch}
            onCloseSearch={closeSearch}
          />
        ) : (
          <Editor
            content={file.content}
            onChange={file.setContent}
            theme={theme}
            plain={isPlain}
          />
        )}

        <DragDropOverlay state={dragState} />
      </div>

      {showJournal && worklog && (
        <div className="flex h-8 shrink-0 select-none items-center justify-between gap-4 whitespace-nowrap px-5 pb-2
          text-xs font-medium tabular-nums text-dim" title={worklog.root}>
          <span className="flex min-w-0 items-center gap-0.5 overflow-hidden">
            {[...worklog.root.split(/[\\/]/).slice(-2), ...(journalTask ? [worklog.projects.find((p) => p.slug === journalProject)?.name ?? "", journalTask] : [])].map((part, i, all) => (
              <span key={part} className="flex items-center gap-0.5">
                {i > 0 && <Icon name="chevron" className="h-3 w-3 shrink-0 opacity-60" />}
                <span className={i === all.length - 1 ? "px-1.5 text-fg" : "px-1.5"}>{part}</span>
              </span>
            ))}
          </span>
          <span>
            {worklog.projects.length} {plural(worklog.projects.length, ["проект", "проекта", "проектов"])} ·{" "}
            {taskCount} {plural(taskCount, ["задача", "задачи", "задач"])}
          </span>
        </div>
      )}

      {isFileOpen && (
        <StatusBar
          content={file.content}
          filePath={file.filePath}
          onInstallUpdate={() => guard(() => {
            installNow().catch(() => {});
          })}
          onOpenFolder={handleOpenFolderPath}
        />
      )}

      {!file.hasChanges && !file.isDraft && <UpdateToast lang="ru" />}

      {pendingAction && (
        <UnsavedDialog
          fileName={file.fileName}
          onSave={saveThenRunPendingAction}
          onDiscard={runPendingAction}
          onCancel={cancelPendingAction}
        />
      )}
    </div>
  );
}

export default App;
