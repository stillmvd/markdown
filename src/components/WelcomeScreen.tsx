import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import type { RecentEntry, RecentKind } from "../types";
import { plural } from "../lib/plural";
import Icon from "./Icon";
import PopupMenu, { type MenuAction } from "./PopupMenu";
import { useCopy, useToast } from "./Toast";
import type { WorklogProject, WorklogTask } from "../lib/worklog";
import { TaskKey } from "./Journal";

interface WelcomeScreenProps {
  recentFiles: RecentEntry[];
  onOpenRecent: (entry: RecentEntry) => void;
  onRemoveRecent: (path: string) => void;
  onClearRecent: (kind: RecentKind) => void;
  activeTasks: { project: WorklogProject; task: WorklogTask }[];
  onOpenTask: (project: WorklogProject, task: WorklogTask) => void;
}

const SHORTCUTS = [
  ["O", "открыть"],
  ["E", "правка"],
  ["S", "сохранить"],
] as const;

const KBD = "inline-grid h-[22px] min-w-[22px] place-items-center rounded-full bg-raised px-[7px] font-sans text-[11px] font-bold text-fg";

const DAY = 24 * 60 * 60 * 1000;

const VISIBLE_ROWS = 6;
const VISIBLE_FOLDERS = 2;

const MONTHS = ["янв", "февр", "марта", "апр", "мая", "июня", "июля", "авг", "сент", "окт", "нояб", "дек"];

function formatOpenedAt(openedAt: number, now: number) {
  const minutes = Math.floor((now - openedAt) / 60000);
  if (minutes < 1) return "только что";
  if (minutes < 60) return `${minutes} мин назад`;

  const today = new Date(now).setHours(0, 0, 0, 0);
  const day = new Date(openedAt).setHours(0, 0, 0, 0);
  const days = Math.round((today - day) / DAY);
  if (days === 0) return `${Math.floor(minutes / 60)} ч назад`;
  if (days === 1) return "вчера";
  if (days < 7) return `${days} ${plural(days, ["день", "дня", "дней"])} назад`;

  const date = new Date(openedAt);
  const short = `${date.getDate()} ${MONTHS[date.getMonth()]}`;
  return date.getFullYear() === new Date(now).getFullYear() ? short : `${short} ${date.getFullYear()}`;
}

function parentName(path: string) {
  return path.split(/[\\/]/).filter(Boolean).slice(-2, -1)[0] ?? "";
}

function recentMenuItems({ entry, onOpen, onRemove, onClear, onCopy }: {
  entry: RecentEntry;
  onOpen: () => void;
  onRemove: () => void;
  onClear: () => void;
  onCopy: (text: string, message: string) => void;
}): MenuAction[] {
  return [
    { label: "Открыть", icon: entry.kind === "folder" ? "folder" : "file", action: onOpen },
    { label: "Показать в проводнике", icon: "external", action: () => void revealItemInDir(entry.path).catch(() => {}) },
    { label: "Скопировать путь", icon: "copy", action: () => onCopy(entry.path, "Путь скопирован") },
    { label: "Убрать из недавних", icon: "close", action: onRemove },
    {
      label: entry.kind === "folder" ? "Очистить недавние папки" : "Очистить недавние файлы",
      icon: "trash",
      action: onClear,
    },
  ];
}

function RecentRow({ entry, now, missing, onOpen, onMenu, onRemove }: {
  entry: RecentEntry;
  now: number;
  missing: boolean;
  onOpen: () => void;
  onMenu: (e: React.MouseEvent) => void;
  onRemove: () => void;
}) {
  return (
    <div className="group/row relative flex min-w-0">
      <button
        type="button"
        className={`side-row min-h-10 w-full gap-2.5 hover:bg-hover ${missing ? "opacity-50" : ""}`}
        onClick={onOpen}
        onContextMenu={onMenu}
        title={entry.path}
      >
        <Icon name={entry.kind === "folder" ? "folder" : "file"} className="h-4 w-4 shrink-0 text-dim" />
        <span className="truncate text-sm font-medium">{entry.name}</span>
        <span className="min-w-6 truncate text-xs font-medium text-dim [flex-shrink:100]">
          {parentName(entry.path)}
        </span>
        <span className="ml-auto shrink-0 pl-2 text-xs font-medium tabular-nums text-dim
          transition-opacity duration-200 ease-trail group-hover/row:opacity-0">
          {missing ? "не найден" : entry.openedAt ? formatOpenedAt(entry.openedAt, now) : ""}
        </span>
      </button>
      <button
        type="button"
        onClick={onRemove}
        title="Убрать из недавних"
        aria-label={`Убрать «${entry.name}» из недавних`}
        className="absolute right-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full
          text-dim opacity-0 transition duration-200 ease-trail hover:bg-hover-strong hover:text-fg active:scale-[.96]
          group-hover/row:opacity-100 focus-visible:opacity-100
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <Icon name="close" className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export default function WelcomeScreen({ recentFiles, onOpenRecent, onRemoveRecent, onClearRecent, activeTasks, onOpenTask }: WelcomeScreenProps) {
  const toast = useToast();
  const copy = useCopy();
  const now = Date.now();
  const [expanded, setExpanded] = useState(false);
  const [missing, setMissing] = useState<string[]>([]);
  const [menu, setMenu] = useState<{ entry: RecentEntry; x: number; y: number } | null>(null);

  const paths = recentFiles.map((entry) => entry.path).join("\n");
  useEffect(() => {
    const list = paths ? paths.split("\n") : [];
    if (list.length === 0) {
      setMissing([]);
      return;
    }
    let active = true;
    invoke<boolean[]>("paths_exist", { paths: list })
      .then((exists) => {
        if (active) setMissing(list.filter((_, i) => exists[i] === false));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [paths]);

  const folders = recentFiles.filter((entry) => entry.kind === "folder");
  const files = recentFiles.filter((entry) => entry.kind === "file");
  const baseFolders = folders.slice(0, VISIBLE_FOLDERS);
  const baseFiles = files.slice(0, VISIBLE_ROWS - baseFolders.length);
  const hidden = folders.length - baseFolders.length + files.length - baseFiles.length;
  const groups = [
    { kind: "folder" as const, title: "Папки", base: baseFolders, rest: folders.slice(baseFolders.length) },
    { kind: "file" as const, title: folders.length > 0 ? "Файлы" : "Недавние", base: baseFiles, rest: files.slice(baseFiles.length) },
  ];

  const renderRow = (entry: RecentEntry) => (
    <RecentRow
      key={entry.path}
      entry={entry}
      now={now}
      missing={missing.includes(entry.path)}
      onOpen={() => handleOpenEntry(entry)}
      onMenu={(e) => {
        e.preventDefault();
        setMenu({ entry, x: e.clientX, y: e.clientY });
      }}
      onRemove={() => onRemoveRecent(entry.path)}
    />
  );

  const handleOpenEntry = useCallback((entry: RecentEntry) => {
    onOpenRecent(entry);
    if (entry.kind === "file") {
      invoke<boolean[]>("paths_exist", { paths: [entry.path] })
        .then((exists) => {
          if (exists[0] === false) setMissing((prev) => (prev.includes(entry.path) ? prev : [...prev, entry.path]));
        })
        .catch(() => {});
    }
  }, [onOpenRecent]);

  return (
    <div className="min-w-0 flex-1 px-2 pb-2">
      <div className="welcome-sheet flex h-full flex-col overflow-y-auto rounded-[28px] bg-cosmic">
        {activeTasks.length === 0 && recentFiles.length === 0 ? (
          <div className="m-auto flex max-w-[320px] flex-col items-center gap-1.5 px-6 py-8 text-center">
            <span className="text-[15px] font-bold">Здесь пока пусто</span>
            <span className="text-[13px] leading-[1.4] text-dim">Недавние файлы и задачи в работе появятся здесь</span>
          </div>
        ) : (
          <div className="m-auto flex w-[508px] max-w-full flex-col gap-7 px-6 py-8">

          {activeTasks.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex min-h-8 items-center pl-3 text-[15px] font-bold">Сейчас в работе</div>
              <div className="flex flex-col gap-0.5">
                {activeTasks.map(({ project, task }) => (
                  <button
                    key={`${project.slug}/${task.id}`}
                    type="button"
                    onClick={() => onOpenTask(project, task)}
                    title={task.title}
                    className="side-row min-h-10 w-full gap-2.5 hover:bg-hover"
                  >
                    <TaskKey id={task.id} />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{task.title}</span>
                    {task.phasesTotal > 0 && (
                      <span className="shrink-0 text-xs font-medium tabular-nums text-dim">
                        {task.phasesDone} из {task.phasesTotal}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {recentFiles.length > 0 && (
            <div className="flex flex-col gap-4">
              {groups.map((group) => group.base.length > 0 && (
                <div key={group.kind} className="flex flex-col gap-2">
                  <div className="flex min-h-8 items-center pl-3 text-[15px] font-bold">
                    {group.title}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {group.base.map(renderRow)}
                  </div>
                  {group.rest.length > 0 && (
                    <div
                      className={`-mt-1.5 grid transition-[grid-template-rows,opacity] duration-300 ease-trail
                        ${expanded ? "opacity-100" : "opacity-0"}`}
                      style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
                    >
                      <div className="flex flex-col gap-0.5 overflow-hidden">
                        {group.rest.map(renderRow)}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {(hidden > 0 || expanded) && (
                <button
                  type="button"
                  onClick={() => setExpanded((prev) => !prev)}
                  className="mx-auto inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium text-dim
                    transition duration-200 ease-trail hover:bg-hover-strong hover:text-fg
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <Icon name="chevron" className={`h-3.5 w-3.5 ${expanded ? "-rotate-90" : "rotate-90"}`} />
                  {expanded ? "Свернуть" : `Ещё ${hidden}`}
                </button>
              )}
            </div>
          )}
          </div>
        )}

        <div className="flex shrink-0 flex-wrap items-center justify-center gap-x-4 gap-y-2 px-6 pb-5 text-[13px] text-dim">
          {SHORTCUTS.map(([key, label]) => (
            <span key={key} className="inline-flex items-center gap-[3px]">
              <kbd className={KBD}>Ctrl</kbd>
              <kbd className={KBD}>{key}</kbd>
              <span className="ml-[3px]">{label}</span>
            </span>
          ))}
        </div>
      </div>

      {menu && (
        <PopupMenu
          x={menu.x}
          y={menu.y}
          items={recentMenuItems({
            entry: menu.entry,
            onOpen: () => handleOpenEntry(menu.entry),
            onRemove: () => onRemoveRecent(menu.entry.path),
            onClear: () => {
              onClearRecent(menu.entry.kind);
              toast(menu.entry.kind === "folder" ? "Недавние папки очищены" : "Недавние файлы очищены");
            },
            onCopy: copy,
          })}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}
