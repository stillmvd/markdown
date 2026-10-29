import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { UnlistenFn } from "@tauri-apps/api/event";
import type { WorklogProject } from "../lib/worklog";
import { parseCommit, type DiffFile } from "../lib/diff";
import {
  changesUnwatch, changesWatch, gitCurrentBranch, gitWorktreeDiff, loadNotes, noteHtml, onChangesUpdated, placeNotes,
  readRepoFile, taskOf, type DiffMode, type PlacedNote,
} from "../lib/changes";
import { themeVars, useDiffTheme } from "../lib/diffThemes";
import { plural } from "../lib/plural";
import { useMenu } from "../hooks/useMenu";
import { count, FileCard, FilesMenu, FoldAll, nFiles, type FileDecor } from "./JournalDiff";
import Icon from "./Icon";

export const CHANGES_MODE_KEY = "changes-mode";

export function readChangesMode(): DiffMode {
  try {
    return localStorage.getItem(CHANGES_MODE_KEY) === "branch" ? "branch" : "uncommitted";
  } catch {
    return "uncommitted";
  }
}

export interface ChangesSummary {
  slug: string;
  branch: string;
  files: number;
  notes: number;
}

interface View {
  key: string;
  files: DiffFile[];
  branch: string;
  placed: PlacedNote[];
}

const OPEN_DELAY = 150;
const SWITCH_DELAY = 350;
const CLOSE_DELAY = 300;

function ProjectPicker({ projects, current, onPick }: { projects: WorklogProject[]; current: WorklogProject; onPick: (slug: string) => void }) {
  const { open, setOpen, ref, buttonRef, run } = useMenu();
  return (
    <div ref={ref} className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Проект"
        className={`inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-full pl-4 pr-3 text-[15px] font-bold
          transition duration-200 ease-trail hover:bg-hover-strong active:scale-[.97]
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${open ? "bg-hover-strong" : "bg-raised"}`}
      >
        {current.name}
        <Icon name="chevron" className="h-3.5 w-3.5 rotate-90 text-dim" />
      </button>
      {open && (
        <div role="menu" className="menu-card wl-menu absolute left-0 top-[calc(100%+6px)] z-20 min-w-[240px]">
          {projects.map((p) => (
            <button
              key={p.slug}
              type="button"
              role="menuitemradio"
              aria-checked={p.slug === current.slug}
              className="menu-row"
              onClick={run(() => onPick(p.slug))}
            >
              <Icon name={p.slug === current.slug ? "check" : "book"} className="h-4 w-4 shrink-0 text-dim" />
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ModeSwitch({ mode, onChange }: { mode: DiffMode; onChange: (mode: DiffMode) => void }) {
  return (
    <div role="radiogroup" aria-label="Что показывать" className="inline-flex h-10 shrink-0 gap-0.5 rounded-full bg-raised p-1">
      {([["uncommitted", "Незакоммиченное"], ["branch", "Вся ветка"]] as const).map(([id, label]) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={mode === id}
          onClick={() => onChange(id)}
          className={`inline-flex h-8 items-center whitespace-nowrap rounded-full px-3.5 text-[13px] font-medium transition duration-200 ease-trail
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
            ${mode === id ? "bg-hover-strong text-fg shadow-[0_1px_2px_var(--press-shade)]" : "text-dim hover:text-fg"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function Empty({ title, text, mono }: { title: ReactNode; text: string; mono?: boolean }) {
  return (
    <div className="m-auto flex flex-col items-center gap-2.5 pb-16 text-center">
      <h2 className="text-[28px] font-light leading-[1.1] tracking-[-0.02em] [text-wrap:balance]">{title}</h2>
      <p className={`max-w-[60ch] text-dim ${mono ? "font-mono text-[12.5px]" : "text-sm"}`}>{text}</p>
    </div>
  );
}

const lineSpan = (file: DiffFile, p: PlacedNote) => {
  const lines = file.hunks[p.hunk].lines.slice(p.start, p.last + 1).map((l) => l.new).filter((n): n is number => n !== undefined);
  const name = file.path.slice(file.path.lastIndexOf("/") + 1);
  if (!lines.length) return name;
  const [a, b] = [lines[0], lines[lines.length - 1]];
  return `${name}:${a === b ? a : `${a}–${b}`}`;
};

export default function Changes({ projects, root, project, onProject, onSummary }: {
  projects: WorklogProject[];
  root: string;
  project: WorklogProject | null;
  onProject: (slug: string) => void;
  onSummary: (summary: ChangesSummary) => void;
}) {
  const { theme } = useDiffTheme();
  const [mode, setMode] = useState(readChangesMode);
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState<{ key: string; text: string } | null>(null);
  const [folded, setFolded] = useState<Set<string>>(() => new Set());
  const [hot, setHot] = useState<string | null>(null);
  const [pinned, setPinned] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const cards = useRef<(HTMLElement | null)[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number>(undefined);
  const openTimer = useRef<number>(undefined);
  const quiet = useRef(false);
  const seq = useRef(0);

  const repo = project?.repo ?? "";
  const key = `${project?.slug}|${mode}`;
  const shown = view?.key === key ? view : null;
  const failed = error?.key === key ? error.text : null;
  const [foldKey, setFoldKey] = useState(key);
  if (foldKey !== key) {
    setFoldKey(key);
    setFolded(new Set());
  }

  const refresh = useCallback(async () => {
    if (!project?.repo) return;
    const my = ++seq.current;
    try {
      const [patch, branch, notes] = await Promise.all([
        gitWorktreeDiff(project.repo, mode),
        gitCurrentBranch(project.repo),
        loadNotes().catch(() => []),
      ]);
      const files = parseCommit(patch);
      const task = taskOf(branch);
      const own = notes.filter((n) => n.slug === project.slug);
      const doc = (own.find((n) => n.task === task) ?? own.find((n) => n.doc?.branch === branch))?.doc ?? null;
      const placed = doc ? await placeNotes(files, doc.notes, (path) => readRepoFile(project.repo, path)) : [];
      if (my !== seq.current) return;
      setView({ key: `${project.slug}|${mode}`, files, branch, placed });
      setError(null);
      onSummary({ slug: project.slug, branch, files: files.length, notes: placed.length });
    } catch (e) {
      if (my !== seq.current) return;
      setError({ key: `${project.slug}|${mode}`, text: String(e) });
    }
  }, [project, mode, onSummary]);

  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
    refresh();
  }, [refresh]);

  const branch = shown?.branch;
  const notesPath = project && root && branch ? `${root}/${project.slug}/${taskOf(branch)}/notes.json` : undefined;

  useEffect(() => {
    if (!repo) return;
    let alive = true;
    let unlisten: UnlistenFn | undefined;
    let wait = 0;
    changesWatch(repo, notesPath).then(() => {
      if (alive && notesPath) refreshRef.current();
    }, () => {});
    onChangesUpdated(() => {
      clearTimeout(wait);
      wait = window.setTimeout(() => refreshRef.current(), 120);
    }).then((un) => (alive ? (unlisten = un) : un()));
    return () => {
      alive = false;
      clearTimeout(wait);
      unlisten?.();
      changesUnwatch().catch(() => {});
    };
  }, [repo, notesPath]);

  const chooseMode = (next: DiffMode) => {
    setMode(next);
    try {
      localStorage.setItem(CHANGES_MODE_KEY, next);
    } catch {}
  };

  const files = shown?.files ?? [];
  const placed = shown?.placed ?? [];
  const current = placed.find((p) => p.note.id === hot) ?? null;
  const allFolded = files.length > 0 && files.every((f) => folded.has(f.path));
  const total = files.reduce((sum, f) => ({ add: sum.add + f.add, del: sum.del + f.del }), { add: 0, del: 0 });

  const close = useCallback(() => {
    clearTimeout(timer.current);
    setHot(null);
    setPinned(false);
    setCodeOpen(false);
  }, []);

  const openNote = (id: string, now = false) => {
    clearTimeout(openTimer.current);
    if (hot === id) return;
    if (pinned && !now) return;
    const go = () => {
      clearTimeout(timer.current);
      setPinned(false);
      setCodeOpen(false);
      setHot(id);
    };
    if (now) go();
    else openTimer.current = window.setTimeout(go, hot ? SWITCH_DELAY : OPEN_DELAY);
  };

  const leaveMark = () => clearTimeout(openTimer.current);

  useEffect(() => () => {
    clearTimeout(timer.current);
    clearTimeout(openTimer.current);
  }, []);

  useEffect(() => {
    if (!hot || pinned) return;
    const near = (x: number, y: number) => {
      const mark = listRef.current?.querySelector<HTMLElement>(`[data-ch-mark="${CSS.escape(hot)}"]`)?.getBoundingClientRect();
      const tip = tipRef.current?.getBoundingClientRect();
      if (!mark || !tip) return false;
      const pad = 12;
      const left = Math.min(mark.left, tip.left) - pad;
      const right = Math.max(mark.right, tip.right) + pad;
      const top = Math.min(mark.top, tip.top) - pad;
      const bottom = Math.max(mark.bottom, tip.bottom) + pad;
      return x >= left && x <= right && y >= top && y <= bottom;
    };
    const onMove = (e: PointerEvent) => {
      if (near(e.clientX, e.clientY)) {
        clearTimeout(timer.current);
        timer.current = undefined;
      } else if (timer.current === undefined) {
        timer.current = window.setTimeout(() => {
          timer.current = undefined;
          close();
        }, CLOSE_DELAY);
      }
    };
    window.addEventListener("pointermove", onMove);
    return () => {
      window.removeEventListener("pointermove", onMove);
      clearTimeout(timer.current);
      timer.current = undefined;
    };
  }, [hot, pinned, close]);

  useEffect(() => {
    if (hot && !current) close();
  }, [hot, current, close]);

  useEffect(() => {
    if (!hot) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element;
      if (!tipRef.current?.contains(t) && !t.closest?.("[data-ch-mark]")) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      const mark = listRef.current?.querySelector<HTMLElement>(`[data-ch-mark="${CSS.escape(hot)}"]`);
      close();
      quiet.current = true;
      mark?.focus();
      quiet.current = false;
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [hot, close]);

  const placeTip = useCallback(() => {
    const tip = tipRef.current;
    const wrap = listRef.current;
    const scroller = scrollRef.current;
    if (!tip || !wrap || !scroller || !hot) return;
    const mark = wrap.querySelector<HTMLElement>(`[data-ch-mark="${CSS.escape(hot)}"]`);
    const end = wrap.querySelector<HTMLElement>(`[data-ch-end="${CSS.escape(hot)}"]`)?.parentElement;
    if (!mark || !end) return;
    const w = wrap.getBoundingClientRect();
    const port = scroller.getBoundingClientRect();
    const m = mark.getBoundingClientRect();
    const startRow = (mark.parentElement ?? mark).getBoundingClientRect();
    const endRow = end.getBoundingClientRect();
    const below = port.bottom - endRow.bottom - 16;
    const above = startRow.top - port.top - 16;
    tip.style.maxHeight = "420px";
    const full = tip.offsetHeight;
    const down = full <= below || (full > above && below >= above);
    tip.style.maxHeight = `${Math.max(160, Math.min(420, down ? below : above))}px`;
    const h = tip.offsetHeight;
    const raw = down ? endRow.bottom + 8 : startRow.top - 8 - h;
    const top = Math.min(Math.max(raw, port.top + 8), port.bottom - 8 - h) - w.top;
    const left = Math.min(Math.max(8, m.right - w.left - tip.offsetWidth), w.width - tip.offsetWidth - 8);
    tip.style.top = `${top}px`;
    tip.style.left = `${left}px`;
  }, [hot]);

  useLayoutEffect(placeTip, [placeTip, codeOpen, shown]);

  useEffect(() => {
    if (!hot) return;
    window.addEventListener("resize", placeTip);
    return () => window.removeEventListener("resize", placeTip);
  }, [hot, placeTip]);

  const decorFor = (fileIndex: number): FileDecor | undefined => {
    const mine = placed.filter((p) => p.file === fileIndex);
    if (!mine.length) return undefined;
    return {
      rowClass: (h, i) => (current && current.file === fileIndex && current.hunk === h && i >= current.first && i <= current.last ? "ch-hot" : ""),
      extra: (h, i) => {
        const marks = mine.filter((p) => p.hunk === h && p.start === i);
        const end = current && current.file === fileIndex && current.hunk === h && current.last === i;
        if (!marks.length && !end) return null;
        return (
          <>
            {marks.map((p) => (
              <button
                key={p.note.id}
                type="button"
                data-ch-mark={p.note.id}
                aria-expanded={hot === p.note.id}
                aria-controls={hot === p.note.id ? "ch-tip" : undefined}
                onMouseEnter={() => openNote(p.note.id)}
                onMouseLeave={leaveMark}
                onFocus={() => {
                  if (!quiet.current) openNote(p.note.id, true);
                }}
                onClick={() => {
                  if (pinned && hot === p.note.id) close();
                  else {
                    clearTimeout(timer.current);
                    clearTimeout(openTimer.current);
                    if (hot !== p.note.id) setCodeOpen(false);
                    setHot(p.note.id);
                    setPinned(true);
                  }
                }}
                className={`ch-mk ${hot === p.note.id ? "is-hot" : ""}`}
              >
                <b>{p.no}</b>
                <span>{p.note.title}</span>
              </button>
            ))}
            {end && <span data-ch-end={current.note.id} hidden />}
          </>
        );
      },
    };
  };

  const pick = (index: number) => {
    const path = files[index]?.path;
    if (path && folded.has(path)) {
      setFolded((prev) => {
        const next = new Set(prev);
        next.delete(path);
        return next;
      });
    }
    requestAnimationFrame(() => cards.current[index]?.scrollIntoView({ block: "start" }));
  };

  const fileSig = useMemo(
    () => files.map((f) => {
      let hash = 5381;
      for (const h of f.hunks) for (const l of h.lines) for (let i = 0; i < l.text.length; i++) hash = (hash * 33 + l.text.charCodeAt(i)) | 0;
      return `${f.path}@${f.add}-${f.del}-${f.hunks.map((h) => h.newStart).join(",")}-${hash}`;
    }),
    [files],
  );

  if (!project) {
    return (
      <div className="relative flex min-w-0 flex-1 px-2 pb-2">
        <div className="flex h-full w-full flex-col rounded-[28px] bg-cosmic">
          <Empty title={<>Проектов <b className="font-bold">нет</b></>} text="Добавьте проект в реестр Журнала — project.md с полем repo" />
        </div>
      </div>
    );
  }

  const notGit = failed?.includes("не является git-репозиторием") || failed?.includes("не найдена");

  return (
    <div className="relative flex min-w-0 flex-1 px-2 pb-2">
      <div className="dt flex h-full min-w-0 flex-1 flex-col gap-4 rounded-[28px] bg-cosmic px-7 pt-7" style={themeVars(theme)}>
        <div className="flex min-h-10 shrink-0 flex-wrap items-center gap-2">
          <ProjectPicker projects={projects} current={project} onPick={onProject} />
          {!failed && branch && (
            <span className="inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-hover-strong pl-2.5 pr-3 font-mono text-[12.5px] font-semibold">
              <Icon name="branch" className="h-3.5 w-3.5 text-dim" />
              {branch}
            </span>
          )}
          <span className="flex-1" />
          {shown && !failed && (
            <span className="shrink-0 whitespace-nowrap text-[13px] font-medium tabular-nums text-dim">
              {files.length ? <>{nFiles(files.length)} · <span className="font-mono">{count(total)}</span></> : "изменений нет"}
            </span>
          )}
          {!notGit && <ModeSwitch mode={mode} onChange={chooseMode} />}
        </div>

        {failed ? (
          notGit
            ? <Empty title={<><b className="font-bold">{project.name}</b> — не git-репозиторий</>} text={project.repo} mono />
            : <Empty title={<>Diff <b className="font-bold">не открыт</b></>} text={failed} />
        ) : !shown ? null : files.length === 0 ? (
          <Empty
            title={<>Изменений <b className="font-bold">нет</b></>}
            text={mode === "uncommitted" ? "Рабочее дерево совпадает с последним коммитом" : "Ветка совпадает с основной"}
          />
        ) : (
          <>
            {placed.length === 0 && (
              <p className="-mt-1 shrink-0 text-[13px] font-medium text-dim">
                Пояснений пока нет — Claude пишет их в конце фазы или по <code className="ch-code">/explain --diff</code>
              </p>
            )}
            <div className="-mt-1 flex shrink-0 items-center justify-end gap-2">
              {files.length > 1 && (
                <FoldAll all={allFolded} onClick={() => setFolded(allFolded ? new Set() : new Set(files.map((f) => f.path)))} />
              )}
              <FilesMenu files={files} onPick={pick} />
            </div>
            <div ref={scrollRef} className="welcome-sheet -mx-7 min-h-0 flex-1 overflow-y-auto px-7 pb-6">
              <div ref={listRef} className="relative flex flex-col gap-4">
                {files.map((file, i) => (
                  <FileCard
                    key={fileSig[i]}
                    file={file}
                    load={() => readRepoFile(project.repo, file.path)}
                    target={null}
                    folded={folded.has(file.path)}
                    onToggle={() => {
                      if (current?.file === i && !folded.has(file.path)) close();
                      setFolded((prev) => {
                        const next = new Set(prev);
                        if (!next.delete(file.path)) next.add(file.path);
                        return next;
                      });
                    }}
                    cardRef={(el) => {
                      cards.current[i] = el;
                    }}
                    decor={decorFor(i)}
                  />
                ))}
                {current && (
                  <div
                    ref={tipRef}
                    id="ch-tip"
                    role="dialog"
                    aria-label={current.note.title}
                    onMouseEnter={() => clearTimeout(openTimer.current)}
                    className="ch-tip"
                  >
                    <div className="ch-tiph">
                      <i>{current.no}</i>
                      <b>{current.note.title}</b>
                      {current.stale && <span className="ch-stale">Устарело</span>}
                    </div>
                    <div className="ch-tips">
                      {current.stale && <div className="ch-stline">Код изменился после пояснения</div>}
                      <div className="ch-md" dangerouslySetInnerHTML={{ __html: noteHtml(current.note.plain) }} />
                      {codeOpen && <div className="ch-md ch-mdc" dangerouslySetInnerHTML={{ __html: noteHtml(current.note.code) }} />}
                    </div>
                    <div className="ch-tipf">
                      <button
                        type="button"
                        aria-expanded={codeOpen}
                        onClick={() => {
                          setCodeOpen((v) => !v);
                          setPinned(true);
                        }}
                        className={`ch-btn ${codeOpen ? "is-on" : ""}`}
                      >
                        <Icon name="code" className="h-3.5 w-3.5 text-dim" />
                        {codeOpen ? "Скрыть код" : "Код"}
                        <Icon name="chevron" className={`h-3.5 w-3.5 text-dim ${codeOpen ? "-rotate-90" : "rotate-90"}`} />
                      </button>
                      <span className="ch-loc">{lineSpan(files[current.file], current)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export const notesCount = (n: number) => `${n} ${plural(n, ["пояснение", "пояснения", "пояснений"])}`;
