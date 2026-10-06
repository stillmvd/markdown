import { Fragment, useEffect, useRef, useState } from "react";
import type { WorklogEntry, WorklogProject, WorklogTask } from "../lib/worklog";
import { commitUrl, entryKind, parseChanges, shortDate } from "../lib/worklog";
import { plural } from "../lib/plural";
import { useMenu } from "../hooks/useMenu";
import { useDiffTheme } from "../lib/diffThemes";
import Icon from "./Icon";
import JournalDiff, { type DiffTarget } from "./JournalDiff";
import { useCopy } from "./Toast";

function Inline({ text }: { text: string }) {
  return (
    <>
      {text.replace(/\*\*/g, "").split(/(`[^`]+`)/).map((part, i) =>
        part.startsWith("`") && part.endsWith("`") && part.length > 1
          ? <code key={i} className="wl-code">{part.slice(1, -1)}</code>
          : <Fragment key={i}>{part}</Fragment>,
      )}
    </>
  );
}

function HashMenu({ project, hash }: { project: WorklogProject; hash: string }) {
  const { open, setOpen, ref, buttonRef, run } = useMenu();
  const copy = useCopy();
  const gitlab = commitUrl(project, hash);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={hash}
        className={`inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-full pl-4 pr-3.5 font-mono text-[13px] font-medium
          transition duration-200 ease-trail hover:bg-hover-strong active:scale-[.96]
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
          ${open ? "bg-hover-strong" : "bg-raised"}`}
      >
        {hash.slice(0, 7)}
        <Icon name="chevron" className="h-3.5 w-3.5 rotate-90 text-dim" />
      </button>
      {open && (
        <div role="menu" className="menu-card wl-menu absolute right-0 top-[calc(100%+6px)] z-10">
          <button type="button" role="menuitem" className="menu-row" onClick={run(() => copy(hash, "Hash скопирован"))}>
            <Icon name="copy" className="h-4 w-4 text-dim" />
            Скопировать hash
          </button>
          {gitlab && (
            <button
              type="button"
              role="menuitem"
              className="menu-row"
              title={gitlab}
              onClick={run(() => import("@tauri-apps/plugin-opener").then(({ openUrl }) => openUrl(gitlab)).catch(() => {}))}
            >
              <Icon name="external" className="h-4 w-4 text-dim" />
              Открыть в GitLab
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function lineRef(ref: string) {
  const m = ref.match(/^:(\d+)(?:-(\d+))?/);
  return m ? { from: +m[1], to: +(m[2] ?? m[1]) } : {};
}

function Changes({ entry, onDiff }: { entry: WorklogEntry; onDiff: ((target: DiffTarget) => void) | null }) {
  const files = parseChanges(entry.changes);
  const n = entry.files.length || files.length;
  if (files.length === 0) return null;
  return (
    <section className="flex min-w-0 flex-col gap-3.5">
      <div className="flex items-baseline gap-2.5">
        <h2 className="text-lg font-bold leading-[1.2]">Изменения</h2>
        <span className="text-[13px] font-medium text-dim">{n} {plural(n, ["файл", "файла", "файлов"])}</span>
      </div>
      <div className="wl-changes flex flex-col gap-2">
        {files.map((file, i) => (
          <div key={`${file.file}-${i}`} className="wl-file flex min-w-0 flex-col gap-1.5 rounded-[20px] bg-raised px-[18px] py-4">
            <div className="font-mono text-[13px] font-bold [overflow-wrap:anywhere]">{file.file}</div>
            {file.rows.map((row, j) => (
              <div key={j} className="wl-change-row text-sm leading-normal">
                <span className="flex flex-wrap items-start gap-1">
                  {row.refs.map((ref, k) => onDiff ? (
                    <button
                      key={`${ref}-${k}`}
                      type="button"
                      onClick={() => onDiff({ file: file.file, ...lineRef(ref) })}
                      title="Показать в диффе"
                      className="whitespace-nowrap rounded font-mono text-xs text-accent underline decoration-1 underline-offset-[3px]
                        transition-colors duration-200 ease-trail hover:text-accent-hover
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      {ref}
                    </button>
                  ) : (
                    <span key={`${ref}-${k}`} className="whitespace-nowrap font-mono text-xs text-dim">{ref}</span>
                  ))}
                </span>
                <span className="[overflow-wrap:anywhere]"><Inline text={row.what} /></span>
                <span className="text-dim [overflow-wrap:anywhere]"><Inline text={row.why} /></span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

export default function JournalEntry({ project, task, entry, closing, onClose, onClosed }: {
  project: WorklogProject;
  task: WorklogTask;
  entry: WorklogEntry;
  closing: boolean;
  onClose: () => void;
  onClosed: () => void;
}) {
  const hash = entry.commits[0];
  const context = [entryKind(entry), shortDate(entry.date), entry.branch].filter(Boolean).join(" · ");
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef(document.activeElement as HTMLElement | null);
  const diffCloseRef = useRef<HTMLButtonElement>(null);
  const diffOpenerRef = useRef<HTMLElement | null>(null);
  const [diff, setDiff] = useState<DiffTarget | null>(null);
  const [diffSheet, setDiffSheet] = useState<DiffTarget | null>(null);
  if (diff && diff !== diffSheet) setDiffSheet(diff);
  const [picker, setPicker] = useState(false);
  const themeRef = useRef<HTMLButtonElement>(null);
  const { theme, choose } = useDiffTheme();
  const inDiff = diff !== null;

  const openDiff = (target: DiffTarget, opener?: HTMLElement | null) => {
    diffOpenerRef.current = opener ?? (document.activeElement as HTMLElement | null);
    setDiff(target);
  };

  const closeDiff = () => {
    setPicker(false);
    setDiff(null);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) setDiffSheet(null);
  };

  useEffect(() => {
    if (inDiff) diffCloseRef.current?.focus();
    else (diffOpenerRef.current?.isConnected ? diffOpenerRef.current : closeRef.current)?.focus();
  }, [inDiff]);

  useEffect(() => {
    if (!closing) return;
    openerRef.current?.focus();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) onClosed();
  }, [closing, onClosed]);

  useEffect(() => {
    if (closing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (picker) {
        setPicker(false);
        themeRef.current?.focus();
      } else if (diff) closeDiff();
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closing, onClose, diff, picker]);

  return (
    <>
    <div
      role="dialog"
      aria-modal={!inDiff}
      aria-label={entry.title}
      inert={closing}
      data-closing={closing || undefined}
      onAnimationEnd={(e) => {
        if (closing && e.target === e.currentTarget) onClosed();
      }}
      className="wl-sheet absolute bottom-4 left-16 right-4 top-2 z-20 flex flex-col overflow-hidden
        rounded-[28px] border border-line bg-cosmic shadow-surface"
    >
      <div inert={inDiff} className="flex h-14 shrink-0 items-center justify-between pl-7 pr-3 text-[13px] font-medium text-dim">
        <span className="truncate">{task.id} · {entryKind(entry).split(" · ")[0]}</span>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          title="Закрыть (Esc)"
          aria-label="Закрыть запись"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-dim transition duration-200 ease-trail
            hover:bg-hover-strong hover:text-fg active:scale-[.96]
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Icon name="close" />
        </button>
      </div>
      <div inert={inDiff} className="welcome-sheet min-h-0 flex-1 overflow-y-auto px-7 pb-7">
        <div className="flex flex-col gap-5">
          <div className="flex min-w-0 flex-col gap-3.5">
            <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
              <h1 className="min-w-0 flex-[1_1_320px] text-[28px] font-bold leading-[1.1] tracking-[-0.02em] [overflow-wrap:anywhere] [text-wrap:balance]">
                {entry.title || entry.message || "Без названия"}
              </h1>
              {hash ? (
                <div className="flex shrink-0 items-center gap-2">
                  <HashMenu project={project} hash={hash} />
                  <button
                    type="button"
                    onClick={(e) => openDiff({}, e.currentTarget)}
                    title="Показать дифф"
                    aria-label="Показать дифф"
                    className="grid h-10 w-10 place-items-center rounded-full bg-raised text-dim transition duration-200 ease-trail
                      hover:bg-hover-strong hover:text-fg active:scale-[.96]
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <Icon name="code" className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <span className="inline-flex h-10 shrink-0 items-center whitespace-nowrap rounded-full border border-dashed
                  border-[color-mix(in_srgb,var(--dim)_65%,transparent)] px-4 text-[13px] text-dim">
                  не закоммичено
                </span>
              )}
            </div>
            <div className="text-[13px] font-medium tabular-nums text-dim">{context}</div>
          </div>
          {entry.summary && (
            <p className="max-w-[80ch] border-l-2 border-line pl-4 text-[15px] leading-[1.6] [overflow-wrap:anywhere]">
              <Inline text={entry.summary} />
            </p>
          )}
          <Changes entry={entry} onDiff={hash ? openDiff : null} />
        </div>
      </div>
      <div
        aria-hidden="true"
        title="К записи"
        data-on={(inDiff && !closing) || undefined}
        onClick={closeDiff}
        className="wl-scrim wl-scrim-soft inset-0"
      />
    </div>
    {diffSheet && hash && (
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Дифф ${hash.slice(0, 7)}`}
        inert={closing || !inDiff}
        data-closing={closing || !inDiff || undefined}
        onAnimationEnd={(e) => {
          if (!inDiff && e.target === e.currentTarget) setDiffSheet(null);
        }}
        className="wl-sheet wl-diff absolute bottom-4 left-28 right-4 top-2 z-30 flex flex-col overflow-hidden
          rounded-[28px] border border-line bg-cosmic shadow-surface"
      >
        <div className="flex h-14 shrink-0 items-center justify-between pl-3 pr-3 text-[13px] font-medium text-dim">
          <button
            ref={themeRef}
            type="button"
            onClick={() => setPicker((prev) => !prev)}
            aria-expanded={picker}
            title="Тема кода"
            className={`inline-flex h-8 min-w-0 items-center gap-1.5 rounded-full pl-[11px] pr-[9px] text-fg transition duration-200 ease-trail
              hover:bg-hover-strong active:scale-[.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
              ${picker ? "bg-hover-strong" : "bg-raised"}`}
          >
            <Icon name="palette" className="h-3.5 w-3.5 shrink-0 text-dim" />
            <span className="truncate">{theme.name}</span>
            <Icon name="chevron" className={`h-3 w-3 shrink-0 text-dim transition-transform duration-200 ease-trail ${picker ? "-rotate-90" : "rotate-90"}`} />
          </button>
          <button
            ref={diffCloseRef}
            type="button"
            onClick={closeDiff}
            title="К записи (Esc)"
            aria-label="Закрыть дифф"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-dim transition duration-200 ease-trail
              hover:bg-hover-strong hover:text-fg active:scale-[.96]
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Icon name="close" />
          </button>
        </div>
        <JournalDiff project={project} entry={entry} hash={hash} target={diffSheet} theme={theme} picker={picker} onPick={choose} />
      </div>
    )}
    </>
  );
}
