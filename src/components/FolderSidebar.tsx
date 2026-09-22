import { useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { confirm } from "@tauri-apps/plugin-dialog";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import type { FileEntry } from "../types";
import Icon from "./Icon";
import PopupMenu, { type MenuAction } from "./PopupMenu";
import SidePanel, { SidePanelEmpty } from "./SidePanel";
import { useCopy, useToast } from "./Toast";

interface FolderSidebarProps {
  files: FileEntry[];
  truncated: boolean;
  folderPath: string;
  currentFilePath: string | null;
  onFileClick: (path: string) => void;
  onClose: () => void;
  onRefresh: () => void;
  onRenamed: (from: string, to: string) => void;
  onDeleted: (path: string) => void;
}

interface TreeContext {
  currentFilePath: string | null;
  renaming: string | null;
  isExpanded: (path: string, depth: number) => boolean;
  onToggle: (path: string, depth: number) => void;
  onFileClick: (path: string) => void;
  onMenu: (e: React.MouseEvent, entry: FileEntry) => void;
  onRenameSubmit: (entry: FileEntry, name: string) => void;
  onRenameCancel: () => void;
}

function countFiles(entry: FileEntry): number {
  return entry.children?.reduce((sum, child) => sum + (child.is_dir ? countFiles(child) : 1), 0) ?? 0;
}

function RenameRow({ entry, ctx, className }: { entry: FileEntry; ctx: TreeContext; className: string }) {
  const [done, setDone] = useState(false);

  const finish = (value: string | null) => {
    if (done) return;
    setDone(true);
    if (value === null || value === entry.name) ctx.onRenameCancel();
    else ctx.onRenameSubmit(entry, value);
  };

  return (
    <div className={`side-row ${className}`}>
      <Icon name={entry.is_dir ? "folder" : "file"} className="h-4 w-4 shrink-0 text-dim" />
      <input
        autoFocus
        defaultValue={entry.name}
        spellCheck={false}
        onFocus={(e) => {
          const dot = e.target.value.lastIndexOf(".");
          e.target.setSelectionRange(0, dot > 0 && !entry.is_dir ? dot : e.target.value.length);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") finish(e.currentTarget.value);
          else if (e.key === "Escape") finish(null);
        }}
        onBlur={(e) => finish(e.currentTarget.value)}
        className="min-w-0 flex-1 rounded-full bg-ground px-2 py-0.5 text-inherit outline-none
          ring-1 ring-accent focus:outline-none"
      />
    </div>
  );
}

function TreeNode({ entry, ctx, depth = 0 }: { entry: FileEntry; ctx: TreeContext; depth?: number }) {
  const expanded = ctx.isExpanded(entry.path, depth);
  const renaming = ctx.renaming === entry.path;

  if (entry.is_dir) {
    const raised = depth % 2 === 0;
    return (
      <div className={`flex shrink-0 flex-col gap-0.5 rounded-[20px] p-1 ${raised ? "bg-raised" : "bg-cosmic"}`}>
        {renaming ? (
          <RenameRow entry={entry} ctx={ctx} className="text-[13px] font-medium" />
        ) : (
          <button
            type="button"
            onClick={() => ctx.onToggle(entry.path, depth)}
            onContextMenu={(e) => ctx.onMenu(e, entry)}
            className="side-row text-[13px] font-medium hover:bg-hover-strong"
            title={entry.path}
            aria-expanded={expanded}
          >
            <Icon name="folder" className="h-4 w-4 shrink-0 text-dim" />
            <span className="truncate">{entry.name}</span>
            <span
              className={`ml-auto grid h-5 min-w-[22px] shrink-0 place-items-center rounded-full px-[7px]
                text-[11px] font-bold tabular-nums text-dim ${raised ? "bg-cosmic" : "bg-raised"}`}
            >
              {countFiles(entry)}
            </span>
            <Icon
              name="chevron"
              className={`h-4 w-4 shrink-0 text-dim transition-transform duration-200 ease-trail ${expanded ? "rotate-90" : ""}`}
            />
          </button>
        )}
        {expanded && entry.children?.map((child) => (
          <TreeNode key={child.path} entry={child} ctx={ctx} depth={depth + 1} />
        ))}
      </div>
    );
  }

  const isActive = ctx.currentFilePath === entry.path;
  const inRaised = depth % 2 === 1;
  const state = isActive
    ? `${inRaised ? "bg-cosmic" : "bg-hover-strong"} shadow-press`
    : depth === 0 ? "hover:bg-hover" : "hover:bg-hover-strong";

  if (renaming) {
    return <RenameRow entry={entry} ctx={ctx} className={`text-sm ${depth === 0 ? "pl-4" : ""}`} />;
  }

  return (
    <button
      type="button"
      onClick={() => ctx.onFileClick(entry.path)}
      onContextMenu={(e) => ctx.onMenu(e, entry)}
      className={`side-row text-sm ${depth === 0 ? "pl-4" : ""} ${state}`}
      title={entry.path}
      aria-current={isActive ? "page" : undefined}
    >
      <Icon name="file" className="h-4 w-4 shrink-0 text-dim" />
      <span className="truncate">{entry.name}</span>
    </button>
  );
}

function getFolderName(folderPath: string) {
  const parts = folderPath.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] || folderPath;
}

export default function FolderSidebar({
  files,
  truncated,
  folderPath,
  currentFilePath,
  onFileClick,
  onClose,
  onRefresh,
  onRenamed,
  onDeleted,
}: FolderSidebarProps) {
  const toast = useToast();
  const copy = useCopy();
  const [menu, setMenu] = useState<{ entry: FileEntry; x: number; y: number } | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [openState, setOpenState] = useState<Record<string, boolean>>({});

  const isExpanded = useCallback(
    (path: string, depth: number) => openState[path] ?? depth < 1,
    [openState],
  );

  const onToggle = useCallback((path: string, depth: number) => {
    setOpenState((prev) => ({ ...prev, [path]: !(prev[path] ?? depth < 1) }));
  }, []);

  const collapseAll = useCallback(() => {
    const collapsed: Record<string, boolean> = {};
    const walk = (list: FileEntry[]) => list.forEach((entry) => {
      if (!entry.is_dir) return;
      collapsed[entry.path] = false;
      if (entry.children) walk(entry.children);
    });
    walk(files);
    setOpenState(collapsed);
  }, [files]);

  const hasOpenFolder = files.some((entry) => entry.is_dir && isExpanded(entry.path, 0));

  const run = useCallback(async (task: () => Promise<void>, failure: string) => {
    try {
      await task();
    } catch (e) {
      console.error(failure, e);
      toast(failure, "error");
    }
  }, [toast]);

  const handleRenameSubmit = useCallback((entry: FileEntry, name: string) => {
    setRenaming(null);
    run(async () => {
      const next = await invoke<string>("rename_path", { path: entry.path, name });
      onRenamed(entry.path, next);
      toast(`«${entry.name}» → «${name}»`);
    }, "Не удалось переименовать");
  }, [run, onRenamed, toast]);

  const handleDelete = useCallback((entry: FileEntry) => {
    run(async () => {
      if (entry.is_dir) {
        const ok = await confirm(`Папка «${entry.name}» и всё её содержимое отправятся в корзину.`, {
          title: "Удалить папку?",
          kind: "warning",
          okLabel: "Удалить",
          cancelLabel: "Отмена",
        });
        if (!ok) return;
      }
      await invoke("trash_path", { path: entry.path });
      onDeleted(entry.path);
      toast(`«${entry.name}» в корзине`);
    }, `Не удалось удалить «${entry.name}»`);
  }, [run, onDeleted, toast]);

  const menuItems = useCallback((entry: FileEntry): MenuAction[] => [
    ...(entry.is_dir ? [] : [{ label: "Открыть", icon: "file" as const, action: () => onFileClick(entry.path) }]),
    { label: "Показать в проводнике", icon: "external", action: () => void revealItemInDir(entry.path).catch(() => {}) },
    { label: "Скопировать путь", icon: "copy", action: () => copy(entry.path, "Путь скопирован") },
    { label: "Скопировать имя", icon: "copy", action: () => copy(entry.name, "Имя скопировано") },
    { label: "Переименовать", icon: "pencil", action: () => setRenaming(entry.path) },
    ...(entry.is_dir ? [] : [{
      label: "Дублировать",
      icon: "plus" as const,
      action: () => run(async () => {
        await invoke("duplicate_path", { path: entry.path });
        onRefresh();
        toast(`Копия «${entry.name}» создана`);
      }, "Не удалось дублировать файл"),
    }]),
    { label: "Удалить в корзину", icon: "trash", action: () => handleDelete(entry) },
  ], [onFileClick, onRefresh, run, handleDelete, copy, toast]);

  const ctx: TreeContext = {
    currentFilePath,
    renaming,
    isExpanded,
    onToggle,
    onFileClick,
    onMenu: (e, entry) => {
      e.preventDefault();
      setMenu({ entry, x: e.clientX, y: e.clientY });
    },
    onRenameSubmit: handleRenameSubmit,
    onRenameCancel: () => setRenaming(null),
  };

  return (
    <SidePanel
      icon="folder"
      title={getFolderName(folderPath)}
      closeLabel="Закрыть папку"
      storageKey="folderPanelWidth"
      onClose={onClose}
      actions={hasOpenFolder ? (
        <button
          type="button"
          onClick={collapseAll}
          title="Свернуть все папки"
          aria-label="Свернуть все папки"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-dim
            transition duration-200 ease-trail hover:bg-hover-strong hover:text-fg active:scale-[.96]
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Icon name="collapse" />
        </button>
      ) : null}
    >
      {truncated ? (
        <span
          title="Папка слишком большая — дерево показано частично. Откройте папку поменьше."
          className="mx-2 mb-1 shrink-0 truncate rounded-full bg-raised px-3 py-1.5 text-[11px] text-dim"
        >
          Показаны не все файлы
        </span>
      ) : null}
      {files.length === 0 ? (
        <SidePanelEmpty icon="folder" title="Текстовых файлов нет" text="Здесь появятся .md и .txt из этой папки и вложенных" />
      ) : (
        <div className="side-list gap-1.5">
          {files.map((entry) => (
            <TreeNode key={entry.path} entry={entry} ctx={ctx} />
          ))}
        </div>
      )}
      {menu && (
        <PopupMenu
          x={menu.x}
          y={menu.y}
          items={menuItems(menu.entry)}
          onClose={() => setMenu(null)}
        />
      )}
    </SidePanel>
  );
}
