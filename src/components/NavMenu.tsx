import { useRef, useState, type ReactNode } from "react";
import type { Theme } from "../types";
import type { WorklogProject } from "../lib/worklog";
import { usePanelWidth } from "../hooks/usePanelWidth";
import { PanelResizeHandle } from "./SidePanel";
import Icon, { type IconName } from "./Icon";

export type NavScreen = "home" | "journal" | "changes" | "file";

export interface NavChanges {
  name: string;
  branch: string;
  files: number | null;
}

const COLLAPSED_KEY = "nav-collapsed";

function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function ThemeIcon({ dark }: { dark: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="theme-icon h-4 w-4 shrink-0" data-dark={dark || undefined} aria-hidden="true">
      <mask id="theme-icon-bite">
        <rect width="24" height="24" fill="#fff" />
        <circle className="theme-icon-bite" fill="#000" />
      </mask>
      <circle className="theme-icon-core" cx="12" cy="12" fill="currentColor" mask="url(#theme-icon-bite)" />
      <g className="theme-icon-rays" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M12 1.5v2M12 20.5v2M1.5 12h2M20.5 12h2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M4.6 19.4 6 18M18 6l1.4-1.4" />
      </g>
    </svg>
  );
}

function Row({ icon, label, title, current, section, rail, onClick, children }: {
  icon: IconName;
  label: string;
  title?: string;
  current?: boolean;
  section?: boolean;
  rail: boolean;
  onClick: () => void;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={rail ? label : title}
      aria-label={rail ? label : undefined}
      aria-current={current ? "page" : section ? "true" : undefined}
      className={`nav-row ${rail ? "nav-row-rail" : ""}`}
    >
      <Icon name={icon} className="nav-ic" />
      {!rail && <span className="truncate">{label}</span>}
      {!rail && children}
    </button>
  );
}

export default function NavMenu({
  screen,
  projects,
  journalProject,
  changes,
  theme,
  folder,
  onHome,
  onJournal,
  onProject,
  onChanges,
  onNew,
  onOpen,
  onOpenFolder,
  onToggleTheme,
}: {
  screen: NavScreen;
  projects: WorklogProject[];
  journalProject: string | null;
  changes: NavChanges | null;
  theme: Theme;
  folder: ReactNode;
  onHome: () => void;
  onJournal: () => void;
  onProject: (slug: string) => void;
  onChanges: () => void;
  onNew: () => void;
  onOpen: () => void;
  onOpenFolder: () => void;
  onToggleTheme: () => void;
}) {
  const [rail, setRail] = useState(readCollapsed);
  const [anim, setAnim] = useState(false);
  const animTimer = useRef<number>(undefined);
  const { width, resizing, onMouseDown, onDoubleClick } = usePanelWidth("navMenuWidth", "left", 264);
  const dark = theme === "dark";
  const shownProject = screen === "journal"
    ? (projects.find((p) => p.slug === journalProject) ?? projects[0])?.slug ?? null
    : null;

  const toggleRail = () => {
    clearTimeout(animTimer.current);
    setAnim(true);
    animTimer.current = window.setTimeout(() => setAnim(false), 300);
    setRail((prev) => {
      try {
        localStorage.setItem(COLLAPSED_KEY, prev ? "0" : "1");
      } catch {}
      return !prev;
    });
  };

  const actions: [IconName, string, string, string, () => void][] = [
    ["plus", "Новый", "Новый файл", "Новый файл", onNew],
    ["file", "Файл", "Открыть файл", "Открыть файл (Ctrl+O)", onOpen],
    ["folder", "Папка", "Открыть папку", "Открыть папку", onOpenFolder],
  ];

  return (
    <nav
      aria-label="Меню"
      style={rail ? undefined : { width }}
      data-anim={anim || undefined}
      data-resizing={resizing || undefined}
      className={`nav-menu relative mb-2 ml-2 flex shrink-0 select-none flex-col gap-2 ${rail ? "w-14" : ""}`}
    >
      <div className="flex shrink-0 flex-col gap-0.5 rounded-[20px] bg-cosmic p-2">
        <Row icon="home" label="Главная" title="Главная (Ctrl+W)" current={screen === "home"} rail={rail} onClick={onHome} />
        <Row icon="book" label="Журнал" current={rail && screen === "journal"} section={screen === "journal"} rail={rail} onClick={onJournal} />
        {!rail && projects.length > 0 && (
          <div className="nav-nest">
            {projects.map((p) => (
              <button
                key={p.slug}
                type="button"
                onClick={() => onProject(p.slug)}
                aria-current={p.slug === shownProject ? "page" : undefined}
                className="nav-row nav-sub"
              >
                <span className="truncate">{p.name}</span>
                <em className="nav-count">{p.tasks.length}</em>
              </button>
            ))}
          </div>
        )}
      </div>

      {changes && (
        <div className="flex shrink-0 flex-col rounded-[20px] bg-cosmic p-2">
          {rail ? (
            <Row icon="diff" label="Изменения" current={screen === "changes"} rail onClick={onChanges} />
          ) : (
            <button
              type="button"
              onClick={onChanges}
              aria-current={screen === "changes" ? "page" : undefined}
              title={`Изменения · ${changes.name} · ${changes.branch}`}
              className="nav-row nav-row-tall"
            >
              <Icon name="diff" className="nav-ic" />
              <span className="flex min-w-0 flex-col leading-tight">
                <span className="truncate">Изменения</span>
                <small className="truncate text-xs font-medium text-dim">
                  {changes.name}{changes.branch ? ` · ${changes.branch}` : ""}
                </small>
              </span>
              {changes.files !== null && <em className="nav-count">{changes.files}</em>}
            </button>
          )}
        </div>
      )}

      <div className={`shrink-0 rounded-[20px] bg-cosmic p-2 ${rail ? "flex flex-col gap-0.5" : "grid grid-cols-3 gap-1.5"}`}>
        {actions.map(([icon, short, label, title, run]) => (
          <button
            key={icon}
            type="button"
            onClick={run}
            title={title}
            aria-label={label}
            className={rail ? "nav-row nav-row-rail" : "nav-tile"}
          >
            <Icon name={icon} className={rail ? "nav-ic" : "h-4 w-4"} />
            {!rail && <span>{short}</span>}
          </button>
        ))}
      </div>

      {folder && <div className={rail ? "hidden" : "contents"}>{folder}</div>}
      {(rail || !folder) && <div className="flex-1" />}

      <div className={`flex shrink-0 gap-1 ${rail ? "flex-col items-center" : "items-center"}`}>
        <button
          type="button"
          onClick={onToggleTheme}
          title={dark ? "Включить светлую тему" : "Включить тёмную тему"}
          aria-label={dark ? "Включить светлую тему" : "Включить тёмную тему"}
          className={`nav-row nav-row-ground ${rail ? "nav-row-rail" : "min-w-0 flex-1"}`}
        >
          <span className="nav-ic grid place-items-center"><ThemeIcon dark={dark} /></span>
          {!rail && <span className="truncate">{dark ? "Тёмная тема" : "Светлая тема"}</span>}
        </button>
        <button
          type="button"
          onClick={toggleRail}
          title={rail ? "Развернуть меню" : "Свернуть меню"}
          aria-label={rail ? "Развернуть меню" : "Свернуть меню"}
          aria-expanded={!rail}
          className="nav-circ"
        >
          <Icon name="sidebar" />
        </button>
      </div>

      {!rail && <PanelResizeHandle side="left" resizing={resizing} onMouseDown={onMouseDown} onDoubleClick={onDoubleClick} />}
    </nav>
  );
}
