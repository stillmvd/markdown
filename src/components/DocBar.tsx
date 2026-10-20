import type { ViewMode } from "../types";
import Icon, { type IconName } from "./Icon";

function Tool({ icon, label, pressed, onClick }: { icon: IconName; label: string; pressed?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} title={label} aria-label={label} aria-pressed={pressed} className="dock-btn">
      <Icon name={icon} />
    </button>
  );
}

export default function DocBar({ fileName, hasChanges, mode, showSearch, showToc, onSave, onToggleMode, onToggleSearch, onToggleToc, onExportPdf }: {
  fileName: string;
  hasChanges: boolean;
  mode: ViewMode;
  showSearch: boolean;
  showToc: boolean;
  onSave: () => void;
  onToggleMode: () => void;
  onToggleSearch: () => void;
  onToggleToc: () => void;
  onExportPdf: () => void;
}) {
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
    <div role="toolbar" aria-label="Документ" className="dock">
      <span className="dock-name flex min-w-0 items-center gap-2 text-sm font-bold" title={fileName}>
        <span className="truncate">{fileName}</span>
        {hasChanges && (
          <>
            <span className="h-2 w-2 shrink-0 rounded-full bg-accent" aria-hidden="true" />
            <span className="sr-only">есть несохранённые правки</span>
          </>
        )}
      </span>
      <span className="dock-name mx-1.5 h-6 w-px shrink-0 bg-line" aria-hidden="true" />
      <span aria-live="polite" className="contents">
      {hasChanges ? (
        <button
          type="button"
          onClick={onSave}
          className="tb-capsule bg-accent px-4 text-[13px] font-bold text-accent-ink hover:bg-accent-hover active:scale-[.96]"
          title="Сохранить (Ctrl+S)"
        >
          Сохранить
        </button>
      ) : (
        <span className="tb-capsule px-4 text-[13px] font-medium text-dim">Сохранено</span>
      )}
      </span>
      <div className="tb-group" role="group" aria-label="Режим">
        {modeButton("view", "eye", "Чтение")}
        {modeButton("edit", "pencil", "Правка")}
      </div>
      {mode === "view" && (
        <>
          <Tool icon="search" label="Найти (Ctrl+F)" pressed={showSearch} onClick={onToggleSearch} />
          <Tool icon="toc" label="Оглавление" pressed={showToc} onClick={onToggleToc} />
        </>
      )}
      <Tool icon="pdf" label="Экспорт в PDF" onClick={onExportPdf} />
    </div>
  );
}
