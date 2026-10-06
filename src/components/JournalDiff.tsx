import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { WorklogEntry, WorklogProject } from "../lib/worklog";
import { entryKind, gitShow } from "../lib/worklog";
import type { DiffFile, DiffLine } from "../lib/diff";
import { hiddenBefore, highlightHunk, highlightLine, highlightLines, languageOf, parseCommit } from "../lib/diff";
import { DIFF_THEMES, themeVars, type DiffTheme } from "../lib/diffThemes";
import { plural } from "../lib/plural";
import { useMenu } from "../hooks/useMenu";
import Icon from "./Icon";
import { SidePanelEmpty } from "./SidePanel";

export interface DiffTarget {
  file?: string;
  from?: number;
  to?: number;
}

const MINUS = "−";
const count = (f: { add: number; del: number }) => `+${f.add} ${MINUS}${f.del}`;
const splitPath = (path: string) => {
  const i = path.lastIndexOf("/");
  return [path.slice(0, i + 1), path.slice(i + 1)];
};
const nFiles = (n: number) => `${n} ${plural(n, ["файл", "файла", "файлов"])}`;

function findFile(files: DiffFile[], name: string) {
  const clean = name.replace(/\\/g, "/").replace(/^\.?\//, "");
  const exact = files.findIndex((f) => f.path === clean);
  return exact >= 0 ? exact : files.findIndex((f) => f.path.endsWith(`/${clean}`));
}

function Bar({ file }: { file: DiffFile }) {
  const total = file.add + file.del;
  let a = total ? Math.round((5 * file.add) / total) : 0;
  if (file.del > 0 && a === 5) a = 4;
  if (file.add > 0 && a === 0) a = 1;
  const d = file.del > 0 ? Math.min(5 - a, Math.max(1, Math.round((5 * file.del) / total))) : 0;
  return (
    <span className="flex shrink-0 gap-0.5">
      {[0, 1, 2, 3, 4].map((i) => (
        <i key={i} className={`block h-2 w-2 rounded-sm ${i < a ? "bg-accent" : i < a + d ? "df-cell-d" : "df-cell"}`} />
      ))}
    </span>
  );
}

function Row({ line, html, flash }: { line: DiffLine; html: string; flash: boolean }) {
  return (
    <div
      className={`df-r ${line.kind === "+" ? "df-ad" : line.kind === "-" ? "df-dl" : ""} ${flash ? "df-flash" : ""}`}
      data-jump={flash || undefined}
    >
      <span className="df-n">{line.old}</span>
      <span className="df-n">{line.new}</span>
      <span className="df-sg">{line.kind === "+" ? "+" : line.kind === "-" ? MINUS : ""}</span>
      <span className="df-t" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

function FileCard({ file, repo, hash, target, folded, onToggle, cardRef }: {
  file: DiffFile;
  repo: string;
  hash: string;
  target: DiffTarget | null;
  folded: boolean;
  onToggle: () => void;
  cardRef: (el: HTMLElement | null) => void;
}) {
  const [shown, setShown] = useState<Record<number, { lines: DiffLine[]; html: string[] }>>({});
  const [failed, setFailed] = useState(false);
  const [body, setBody] = useState<"idle" | "grow" | null>(folded ? null : "idle");
  if (!folded && !body) setBody("grow");
  const contentRef = useRef<Promise<string[]> | null>(null);
  const lang = useMemo(() => languageOf(file.path), [file.path]);
  const hunkHtml = useMemo(() => file.hunks.map((hunk) => highlightHunk(hunk, lang)), [file, lang]);
  const [dir, name] = splitPath(file.path);
  const inRange = (n?: number) => !!target && n !== undefined && n >= (target.from ?? 0) && n <= (target.to ?? target.from ?? 0);

  const expand = (index: number) => {
    const { start, count: n } = hiddenBefore(file, index);
    const offset = file.hunks[index].oldStart - file.hunks[index].newStart;
    contentRef.current ??= invoke<string>("git_file", { repo, hash, path: file.path }).then((text) => text.split("\n"));
    contentRef.current
      .then((lines) => {
        const rows = lines.slice(start - 1, start - 1 + n).map((text, i): DiffLine => ({
          kind: " ",
          old: start + i + offset,
          new: start + i,
          text: text.replace(/\r$/, ""),
        }));
        setFailed(false);
        setShown((prev) => ({ ...prev, [index]: { lines: rows, html: highlightLines(rows.map((r) => r.text), lang) } }));
      })
      .catch(() => {
        contentRef.current = null;
        setFailed(true);
      });
  };

  return (
    <section ref={cardRef} className="df-card flex min-w-0 scroll-mt-2 flex-col rounded-[20px]">
      <div className="df-stick sticky top-0 z-[2]">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!folded}
          data-shut={(folded && !body) || undefined}
          title={file.path}
          className={`df-fh flex min-h-11 w-full min-w-0 items-center gap-3 px-4 text-left
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent
            ${folded && !body ? "rounded-[19px]" : "rounded-t-[19px]"}`}
        >
          <Icon name="chevron" className={`df-muted -ml-1 h-3.5 w-3.5 shrink-0 transition-transform duration-200 ease-trail ${folded ? "" : "rotate-90"}`} />
          <span className="flex min-w-0 flex-1 font-mono text-[13px]">
            <span className="df-muted min-w-0 truncate">{dir}</span>
            <b className="shrink-0 font-bold">{name}</b>
          </span>
          <span className="df-muted shrink-0 whitespace-nowrap font-mono text-xs">{count(file)}</span>
          <Bar file={file} />
        </button>
      </div>
      {body && (
      <div
        data-folded={folded || undefined}
        data-grow={body === "grow" || undefined}
        onTransitionEnd={(e) => {
          if (folded && e.target === e.currentTarget) setBody(null);
        }}
        className="df-body grid"
      >
      <div inert={folded} className="min-h-0 overflow-hidden">
      {file.binary || file.hunks.length === 0 ? (
        <div className="df-muted px-4 py-3 text-[13px]">
          {file.binary
            ? "Двоичный файл — изменения не показываются"
            : file.status === "renamed" ? "Файл переименован без правок" : "Строки не менялись"}
        </div>
      ) : (
        <div className="df-scroll overflow-x-auto rounded-b-[19px]">
          <div className="w-max min-w-full py-1.5">
            {file.hunks.map((hunk, i) => {
              const hidden = hiddenBefore(file, i).count;
              return (
                <div key={i}>
                  {shown[i]
                    ? shown[i].lines.map((line, k) => <Row key={`x${k}`} line={line} html={shown[i].html[k]} flash={false} />)
                    : hidden > 0 && (
                      <div className="flex h-11 items-center pl-[60px] pr-4">
                        <button
                          type="button"
                          onClick={() => expand(i)}
                          className="df-ex inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full pl-2.5 pr-3
                            text-[12.5px] font-medium transition duration-200 ease-trail active:scale-[.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                        >
                          <Icon name="chevron" className="h-3.5 w-3.5 -rotate-90" />
                          {failed ? "Файл не прочитан — повторить" : `Показать ${hidden} ${plural(hidden, ["строку", "строки", "строк"])}`}
                        </button>
                      </div>
                    )}
                  {hunk.lines.map((line, k) => (
                    <Row key={k} line={line} html={hunkHtml[i][k]} flash={line.kind !== "-" && inRange(line.new)} />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
      </div>
      </div>
      )}
    </section>
  );
}

function FilesMenu({ files, onPick }: { files: DiffFile[]; onPick: (index: number) => void }) {
  const { open, setOpen, ref, buttonRef, run } = useMenu();
  const label = nFiles(files.length);
  if (files.length < 2) {
    return <span className="inline-flex h-7 shrink-0 items-center rounded-full bg-raised px-3 text-[12.5px] font-medium tabular-nums">{label}</span>;
  }
  return (
    <div ref={ref} className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full pl-3 pr-2.5 text-[12.5px] font-medium tabular-nums
          transition duration-200 ease-trail hover:bg-hover-strong active:scale-[.96]
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${open ? "bg-hover-strong" : "bg-raised"}`}
      >
        {label}
        <Icon name="chevron" className="h-3.5 w-3.5 rotate-90 text-dim" />
      </button>
      {open && (
        <div role="menu" className="menu-card wl-menu absolute right-0 top-[calc(100%+6px)] z-10 min-w-[300px] max-w-[min(480px,70vw)]">
          {files.map((file, i) => (
            <button key={file.path} type="button" role="menuitem" className="menu-row" title={file.path} onClick={run(() => onPick(i))}>
              <Icon name="file" className="h-4 w-4 shrink-0 text-dim" />
              <span className="min-w-0 flex-1 truncate">{splitPath(file.path)[1]}</span>
              <span className="shrink-0 font-mono text-xs text-dim">{count(file)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const SAMPLE = [
  highlightLine('<q-btn flat label="OK" />', "xml"),
  highlightLine("const port = ref<Port>(0)", "typescript"),
  highlightLine('import { api } from "src"', "typescript"),
  highlightLine("// порт сессии", "typescript"),
];

function ThemeColumn({ current, onPick }: { current: DiffTheme; onPick: (id: string) => void }) {
  return (
    <div className="flex w-[min(300px,38%)] shrink-0 flex-col gap-1.5 overflow-y-auto px-0.5 pb-5" role="group" aria-label="Тема кода">
      <span className="h-6 shrink-0 pl-0.5 text-xs font-medium leading-6 text-dim">Тема кода</span>
      {DIFF_THEMES.map((t) => {
        const on = t.id === current.id;
        return (
          <button
            key={t.id}
            type="button"
            aria-pressed={on}
            aria-label={t.name}
            onClick={() => onPick(t.id)}
            style={themeVars(t)}
            className={`dt group relative flex min-w-0 shrink-0 flex-col overflow-hidden rounded-2xl text-left transition-shadow duration-200 ease-trail
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
              ${on ? "shadow-[0_0_0_2px_var(--accent)]" : "shadow-[0_0_0_1px_var(--line)] hover:shadow-[0_0_0_1px_var(--fg)]"}`}
          >
            <span className="block h-[72px] overflow-hidden whitespace-pre bg-[var(--dt-bg)] px-2.5 py-2 font-mono text-[11px] leading-[14px] text-[var(--dt-fg)]">
              {SAMPLE.map((html, i) => <span key={i} className="block h-3.5 overflow-hidden" dangerouslySetInnerHTML={{ __html: html }} />)}
            </span>
            {t.vscode && (
              <span className="absolute right-1.5 top-1.5 inline-flex h-[18px] items-center whitespace-nowrap rounded-full bg-fg px-[7px] text-[10.5px] font-bold text-ground">
                Как в VS Code
              </span>
            )}
            <span className="flex h-[30px] items-center bg-raised px-2.5 text-[12.5px] font-medium text-fg transition-colors duration-200 ease-trail group-hover:bg-hover-strong">
              <span className="truncate">{t.name}</span>
            </span>
          </button>
        );
      })}
      <div className="flex min-h-[102px] shrink-0 flex-col items-center justify-center gap-[3px] rounded-2xl border-[1.5px] border-dashed
        border-[color-mix(in_srgb,var(--dim)_65%,transparent)] p-2.5 text-center text-[11px] font-medium leading-[1.3] text-dim">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-raised">
          <Icon name="plus" className="h-3.5 w-3.5" />
        </span>
        <b className="text-[12.5px] font-medium text-fg">Добавить тему</b>
        <span>Свои темы из VS Code — скоро</span>
      </div>
    </div>
  );
}

export default function JournalDiff({ project, entry, hash, target, theme, picker, onPick }: {
  project: WorklogProject;
  entry: WorklogEntry;
  hash: string;
  target: DiffTarget;
  theme: DiffTheme;
  picker: boolean;
  onPick: (id: string) => void;
}) {
  const [files, setFiles] = useState<DiffFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cards = useRef<(HTMLElement | null)[]>([]);
  const [folded, setFolded] = useState<Set<string>>(() => new Set());
  const [foldTarget, setFoldTarget] = useState(target);
  if (foldTarget !== target) {
    setFoldTarget(target);
    setFolded(new Set());
  }
  const allFolded = !!files && files.length > 0 && files.every((f) => folded.has(f.path));

  const toggle = (path: string) =>
    setFolded((prev) => {
      const next = new Set(prev);
      if (!next.delete(path)) next.add(path);
      return next;
    });

  const pick = (index: number) => {
    const path = files?.[index]?.path;
    if (path && folded.has(path)) toggle(path);
    requestAnimationFrame(() => cards.current[index]?.scrollIntoView({ block: "start" }));
  };

  useEffect(() => {
    let alive = true;
    setFiles(null);
    setError(null);
    gitShow(project.repo, hash).then(
      (raw) => alive && setFiles(parseCommit(raw)),
      (e) => alive && setError(String(e)),
    );
    return () => {
      alive = false;
    };
  }, [project.repo, hash]);

  const targetIndex = files && target.file ? findFile(files, target.file) : -1;

  useLayoutEffect(() => {
    if (!files) return;
    const card = cards.current[targetIndex];
    const line = card?.querySelector<HTMLElement>("[data-jump]");
    if (line) line.scrollIntoView({ block: "center" });
    else card?.scrollIntoView({ block: "start" });
  }, [files, targetIndex, target]);

  const total = files?.reduce((sum, f) => ({ add: sum.add + f.add, del: sum.del + f.del }), { add: 0, del: 0 });

  return (
    <div className="dt flex min-h-0 flex-1 gap-4 px-5" style={themeVars(theme)}>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
        <div className="flex min-h-8 shrink-0 items-center gap-2.5">
          <span className={`inline-flex h-[22px] shrink-0 items-center whitespace-nowrap rounded-full bg-hover-strong px-[9px] text-xs font-medium
            ${entry.type === "phase" ? "text-fg" : "text-dim"}`}>
            {entryKind(entry).split(" · ")[0]}
          </span>
          <span className="inline-flex h-[22px] shrink-0 items-center rounded-full bg-hover-strong px-2 font-mono text-xs font-medium" title={hash}>
            {hash.slice(0, 7)}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-bold">{entry.title || entry.message}</span>
          {total && <span className="shrink-0 whitespace-nowrap font-mono text-xs text-dim">{count(total)}</span>}
          {files && files.length > 1 && (
            <button
              type="button"
              onClick={() => setFolded(allFolded ? new Set() : new Set(files.map((f) => f.path)))}
              className="inline-flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-raised pl-2.5 pr-3 text-[12.5px] font-medium
                transition duration-200 ease-trail hover:bg-hover-strong active:scale-[.96]
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Icon name={allFolded ? "unfoldAll" : "foldAll"} className="h-3.5 w-3.5 text-dim" />
              {allFolded ? "Развернуть все" : "Свернуть все"}
            </button>
          )}
          {files && <FilesMenu files={files} onPick={pick} />}
        </div>
        <div className="welcome-sheet min-h-0 flex-1 overflow-y-auto pb-5">
          {error ? (
            <SidePanelEmpty icon="alert" title="Дифф не открыт" text={error} />
          ) : files === null ? null : files.length === 0 ? (
            <SidePanelEmpty icon="code" title="Изменений нет" text="В этом коммите нет изменённых файлов" />
          ) : (
            <div className="flex flex-col gap-4">
              {files.map((file, i) => (
                <FileCard
                  key={file.path}
                  file={file}
                  repo={project.repo}
                  hash={hash}
                  target={i === targetIndex && target.from !== undefined ? target : null}
                  folded={folded.has(file.path)}
                  onToggle={() => toggle(file.path)}
                  cardRef={(el) => {
                    cards.current[i] = el;
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
      {picker && <ThemeColumn current={theme} onPick={onPick} />}
    </div>
  );
}
