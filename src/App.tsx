import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { load } from "@tauri-apps/plugin-store";
import type { ViewMode, FileEntry } from "./types";
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

function App() {
  const { theme, toggleTheme } = useTheme();
  const file = useFile();
  const { recentFiles, addRecentFile } = useRecentFiles();
  const [mode, setMode] = useState<ViewMode>("view");
  const [showToc, setShowToc] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [dragState, setDragState] = useState<DragState>(null);
  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [folderFiles, setFolderFiles] = useState<FileEntry[]>([]);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const closedPathRef = useRef<string | null>(null);
  const hasChangesRef = useRef(file.hasChanges);

  const isFileOpen = file.filePath !== null || file.content.length > 0;
  const isPlain = file.filePath !== null && isPlainTextFile(file.filePath);

  useEffect(() => {
    hasChangesRef.current = file.hasChanges;
  }, [file.hasChanges]);

  const loadFolderFiles = useCallback(async (path: string) => {
    try {
      const files = await invoke<FileEntry[]>("list_md_files", { path });
      setFolderFiles(files);
    } catch (e) {
      console.error("Failed to load folder:", e);
      setFolderFiles([]);
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

  const handleOpenFolder = useCallback(async () => {
    const selected = await open({ directory: true });
    if (selected) {
      setFolderPath(selected);
      loadFolderFiles(selected);
      try {
        const store = await load("settings.json");
        await store.set("folderPath", selected);
        await store.save();
      } catch {}
    }
  }, [loadFolderFiles]);

  const handleCloseFolder = useCallback(async () => {
    setFolderPath(null);
    setFolderFiles([]);
    try {
      const store = await load("settings.json");
      await store.delete("folderPath");
      await store.save();
    } catch {}
  }, []);

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
      }
    });
  }, [guard, file, addRecentFile]);

  const handleOpen = useCallback(async () => {
    if (pendingAction) return;
    const path = await file.pickFile();
    if (path) handleOpenPath(path);
  }, [pendingAction, file, handleOpenPath]);

  const handleNew = useCallback(() => {
    guard(file.newFile);
  }, [guard, file.newFile]);

  const handleHome = useCallback(() => {
    if (!isFileOpen) return;
    const path = file.filePath;
    guard(() => {
      closedPathRef.current = path;
      file.newFile();
      setMode("view");
    });
  }, [isFileOpen, file, guard]);

  const handleForward = useCallback(() => {
    const path = closedPathRef.current;
    if (!isFileOpen && path) handleOpenPath(path);
  }, [isFileOpen, handleOpenPath]);

  const handleSave = useCallback(async () => {
    const path = await file.saveFile();
    if (path) {
      setMode("view");
      addRecentFile(path);
    }
    return path !== null;
  }, [file, addRecentFile]);

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

  useEffect(() => {
    invoke<string | null>("update_prepare").then(setUpdateVersion, () => {});
  }, []);

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
        hasChanges={file.hasChanges}
        isFileOpen={isFileOpen}
        onOpen={handleOpen}
        onSave={handleSave}
        onNew={handleNew}
        onHome={handleHome}
        onOpenFolder={handleOpenFolder}
        onToggleMode={handleToggleMode}
        onToggleTheme={toggleTheme}
        onToggleToc={() => setShowToc((prev) => !prev)}
        showToc={showToc}
        onToggleSearch={handleToggleSearch}
        showSearch={showSearch}
        onExportPdf={handleExportPdf}
      />

      <div className="relative flex flex-1 overflow-hidden">
        {folderPath && (
          <FolderSidebar
            files={folderFiles}
            folderPath={folderPath}
            currentFilePath={file.filePath}
            onFileClick={handleOpenPath}
            onClose={handleCloseFolder}
          />
        )}

        {showToc && mode === "view" && isFileOpen && (
          <TableOfContents
            content={file.content}
            sheetRef={sheetRef}
            onClose={() => setShowToc(false)}
          />
        )}

        {!isFileOpen ? (
          <WelcomeScreen
            recentFiles={recentFiles}
            onOpen={handleOpen}
            onOpenFolder={handleOpenFolder}
            onOpenRecent={handleOpenPath}
          />
        ) : mode === "view" ? (
          <Viewer
            content={file.content}
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

      {isFileOpen && (
        <StatusBar
          content={file.content}
          filePath={file.filePath}
          updateVersion={updateVersion}
        />
      )}

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
