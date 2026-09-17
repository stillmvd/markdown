import { useEffect, useRef, useState } from "react";
import type { ViewMode, Theme } from "../types";
import Icon, { type IconName } from "./Icon";

interface ToolbarProps {
  mode: ViewMode;
  theme: Theme;
  fileName: string | null;
  hasChanges: boolean;
  isFileOpen: boolean;
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
}

export default function Toolbar({
  mode,
  theme,
  fileName,
  hasChanges,
  isFileOpen,
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
}: ToolbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

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

  const themeButton = (target: Theme, label: string) => {
    const active = theme === target;
    return (
      <button
        type="button"
        onClick={active ? undefined : onToggleTheme}
        className={`h-8 flex-1 rounded-full text-[13px] transition duration-200 ease-trail active:scale-[.96]
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
          ${active ? "bg-hover-strong font-bold text-fg shadow-press" : "font-medium text-dim hover:bg-hover-strong hover:text-fg"}`}
        aria-pressed={active}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="shrink-0 bg-ground p-2 select-none" data-tauri-drag-region>
      <div
        className="relative flex h-[52px] items-center gap-1.5 rounded-full bg-cosmic px-1.5 shadow-island"
        data-tauri-drag-region
      >
        <div className="tb-group" role="group" aria-label="Файл">
          {isFileOpen && (
            <button type="button" onClick={onHome} className="tb-dot" title="На главный (Ctrl+W)" aria-label="На главный">
              <Icon name="home" />
            </button>
          )}
          <button type="button" onClick={onNew} className="tb-dot" title="Новый файл" aria-label="Новый файл">
            <Icon name="plus" />
          </button>
          <button type="button" onClick={onOpen} className="tb-dot" title="Открыть (Ctrl+O)" aria-label="Открыть">
            <Icon name="file" />
          </button>
          <button type="button" onClick={onOpenFolder} className="tb-dot" title="Открыть папку" aria-label="Открыть папку">
            <Icon name="folder" />
          </button>
        </div>

        {isFileOpen && (
          hasChanges ? (
            <button
              type="button"
              onClick={onSave}
              className="tb-capsule bg-accent font-bold text-accent-ink hover:bg-accent-hover active:scale-[.96]"
              title="Сохранить (Ctrl+S)"
            >
              Сохранить
            </button>
          ) : (
            <button type="button" disabled className="tb-capsule cursor-default bg-raised font-medium text-dim">
              Сохранено
            </button>
          )
        )}

        {fileName && (
          <div className="pointer-events-none absolute left-1/2 top-1/2 flex max-w-[30%] -translate-x-1/2 -translate-y-1/2 items-center gap-2 max-[720px]:hidden">
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
            <div className="tb-group" role="group" aria-label="Режим">
              {modeButton("view", "eye", "Чтение")}
              {modeButton("edit", "pencil", "Правка")}
            </div>

            {mode === "view" && (
              <button
                type="button"
                onClick={onToggleSearch}
                className={`tb-circle ${showSearch ? "bg-fg text-ground hover:bg-fg" : ""}`}
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
              className={`tb-circle ${showToc ? "bg-fg text-ground hover:bg-fg" : ""}`}
              title="Оглавление"
              aria-label="Оглавление"
              aria-pressed={showToc}
            >
              <Icon name="toc" />
            </button>
          </>
        )}

        <div ref={menuRef} className="relative">
          <button
            ref={triggerRef}
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="tb-circle"
            title="Ещё"
            aria-label="Ещё"
            aria-haspopup="true"
            aria-expanded={menuOpen}
          >
            <Icon name="more" />
          </button>

          {menuOpen && (
            <div className="menu-card absolute right-0 top-[calc(100%+12px)] z-30">
              {isFileOpen && (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onExportPdf();
                  }}
                  className="menu-row"
                >
                  <Icon name="pdf" />
                  Экспорт в PDF
                </button>
              )}
              <span className="px-3.5 pb-0.5 pt-2 text-xs font-medium text-dim">Тема</span>
              <div className="flex h-10 gap-0.5 rounded-full bg-raised p-1" role="group" aria-label="Тема">
                {themeButton("dark", "Тёмная")}
                {themeButton("light", "Светлая")}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
