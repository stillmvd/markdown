import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { ViewMode, Theme } from "../types";
import Icon, { type IconName } from "./Icon";

interface ToolbarProps {
  mode: ViewMode;
  theme: Theme;
  fileName: string | null;
  hasChanges: boolean;
  isFileOpen: boolean;
  canGoHome: boolean;
  onOpen: () => void;
  onSave: () => void;
  onNew: () => void;
  onHome: () => void;
  onOpenFolder: () => void;
  onToggleMode: () => void;
  onToggleTheme: () => void;
  onToggleToc: () => void;
  showToc: boolean;
  onToggleSearch: () => void;
  showSearch: boolean;
  onExportPdf: () => void;
  journalOpen: boolean;
  onOpenJournal: () => void;
}

function NavButton({ icon, label, title, pressed, onClick }: {
  icon: IconName;
  label: string;
  title?: string;
  pressed?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title ?? label}
      aria-label={label}
      aria-pressed={pressed}
      className={`tb-nav ${pressed ? "bg-hover-strong" : ""}`}
    >
      <Icon name={icon} />
      <span className="tb-label">{label}</span>
    </button>
  );
}

function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  const dark = theme === "dark";
  return (
    <button
      type="button"
      onClick={onToggle}
      className="tb-island"
      title={dark ? "Светлая тема" : "Тёмная тема"}
      aria-label={dark ? "Включить светлую тему" : "Включить тёмную тему"}
    >
      <svg viewBox="0 0 24 24" className="theme-icon h-5 w-5" data-dark={dark || undefined} aria-hidden="true">
        <mask id="theme-icon-bite">
          <rect width="24" height="24" fill="#fff" />
          <circle className="theme-icon-bite" fill="#000" />
        </mask>
        <circle className="theme-icon-core" cx="12" cy="12" fill="currentColor" mask="url(#theme-icon-bite)" />
        <g className="theme-icon-rays" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M12 1.5v2M12 20.5v2M1.5 12h2M20.5 12h2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M4.6 19.4 6 18M18 6l1.4-1.4" />
        </g>
      </svg>
    </button>
  );
}

function WindowControls() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    const appWindow = getCurrentWindow();
    appWindow.isMaximized().then(setMaximized);
    const unlisten = appWindow.onResized(() => {
      appWindow.isMaximized().then(setMaximized);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  return (
    <div className="flex shrink-0 items-center gap-1 pl-1" role="group" aria-label="Окно">
      <button type="button" onClick={() => getCurrentWindow().minimize()} className="tb-win" title="Свернуть" aria-label="Свернуть">
        <Icon name="winMin" />
      </button>
      <button
        type="button"
        onClick={() => getCurrentWindow().toggleMaximize()}
        className="tb-win"
        title={maximized ? "Восстановить" : "Развернуть"}
        aria-label={maximized ? "Восстановить" : "Развернуть"}
      >
        <Icon name={maximized ? "winRestore" : "winMax"} />
      </button>
      <button type="button" onClick={() => getCurrentWindow().close()} className="tb-win tb-win-close" title="Закрыть" aria-label="Закрыть">
        <Icon name="close" />
      </button>
    </div>
  );
}

export default function Toolbar({
  mode,
  theme,
  fileName,
  hasChanges,
  isFileOpen,
  canGoHome,
  onOpen,
  onSave,
  onNew,
  onHome,
  onOpenFolder,
  onToggleMode,
  onToggleTheme,
  onToggleToc,
  showToc,
  onToggleSearch,
  showSearch,
  onExportPdf,
  journalOpen,
  onOpenJournal,
}: ToolbarProps) {
  const modeButton = (target: ViewMode, icon: IconName, label: string) => {
    const active = mode === target;
    return (
      <button
        type="button"
        onClick={active ? undefined : onToggleMode}
        className={`tb-dot ${active ? "bg-hover-strong shadow-press" : "text-dim hover:text-fg"}`}
        title={`${label} (Ctrl+E)`}
        aria-label={label}
        aria-pressed={active}
      >
        <Icon name={icon} />
      </button>
    );
  };

  return (
    <div className="relative flex h-16 shrink-0 items-center gap-2 bg-ground px-2 py-3 select-none" data-tauri-drag-region>
      {canGoHome && <NavButton icon="home" label="Главная" title="На главный (Ctrl+W)" onClick={onHome} />}
      <NavButton icon="plus" label="Новый файл" onClick={onNew} />
      <NavButton icon="file" label="Открыть файл" title="Открыть файл (Ctrl+O)" onClick={onOpen} />
      <NavButton icon="folder" label="Открыть папку" onClick={onOpenFolder} />
      <NavButton icon="book" label="Журнал" pressed={journalOpen} onClick={onOpenJournal} />

      {isFileOpen && (
        hasChanges ? (
          <button
            type="button"
            onClick={onSave}
            className="tb-capsule bg-accent px-4 text-[13px] font-bold text-accent-ink shadow-island hover:bg-accent-hover active:scale-[.96]"
            title="Сохранить (Ctrl+S)"
          >
            Сохранить
          </button>
        ) : (
          <button type="button" disabled className="tb-capsule cursor-default bg-cosmic px-4 text-[13px] font-medium text-dim shadow-island">
            Сохранено
          </button>
        )
      )}

      {fileName && (
        <div className="pointer-events-none absolute left-1/2 top-1/2 flex max-w-[24%] -translate-x-1/2 -translate-y-1/2 items-center gap-2 max-[1760px]:hidden">
          <span className="truncate text-sm font-medium text-fg">{fileName}</span>
          {hasChanges && (
            <>
              <span className="h-2 w-2 shrink-0 rounded-full bg-accent" aria-hidden="true" />
              <span className="sr-only">есть несохранённые правки</span>
            </>
          )}
        </div>
      )}

      <div className="flex-1 self-stretch" data-tauri-drag-region />

      {isFileOpen && (
        <>
          <div className="tb-group bg-cosmic shadow-island" role="group" aria-label="Режим">
            {modeButton("view", "eye", "Чтение")}
            {modeButton("edit", "pencil", "Правка")}
          </div>

          {mode === "view" && (
            <button
              type="button"
              onClick={onToggleSearch}
              className={`tb-island ${showSearch ? "bg-fg text-ground hover:bg-fg" : ""}`}
              title="Найти (Ctrl+F)"
              aria-label="Найти"
              aria-pressed={showSearch}
            >
              <Icon name="search" />
            </button>
          )}

          <button
            type="button"
            onClick={onToggleToc}
            className={`tb-island ${showToc ? "bg-fg text-ground hover:bg-fg" : ""}`}
            title="Оглавление"
            aria-label="Оглавление"
            aria-pressed={showToc}
          >
            <Icon name="toc" />
          </button>

          <button type="button" onClick={onExportPdf} className="tb-island" title="Экспорт в PDF" aria-label="Экспорт в PDF">
            <Icon name="pdf" />
          </button>
        </>
      )}

      <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      <WindowControls />
    </div>
  );
}
