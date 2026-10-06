import { useState } from "react";
import type { WorklogEntry, WorklogProject, WorklogTask } from "../lib/worklog";
import { dateRange, entryKind, jiraUrl, plainText, shortDate } from "../lib/worklog";
import { plural } from "../lib/plural";
import Icon from "./Icon";
import { PhaseBar, StatusChip, TaskKey } from "./Journal";

const CHIP_BASE = "inline-flex h-7 min-w-0 items-center gap-2 whitespace-nowrap rounded-full bg-raised px-3 font-medium tabular-nums";
const CHIP = `${CHIP_BASE} text-[12.5px]`;

function openLink(url: string) {
  import("@tauri-apps/plugin-opener").then(({ openUrl }) => openUrl(url)).catch(() => {});
}

const NUMBERED = /^\s*\d+[.)]\s+/;

function parseSummary(summary: string) {
  const intro: string[] = [];
  const items: string[] = [];
  for (const line of summary.split(/\r?\n/)) {
    if (NUMBERED.test(line)) items.push(line.replace(NUMBERED, ""));
    else if (line.trim() && items.length) items[items.length - 1] += `\n${line.trim()}`;
    else if (line.trim() || intro.length) intro.push(line);
  }
  return { intro: intro.join("\n").trim(), items };
}

function Properties({ project, task }: { project: WorklogProject; task: WorklogTask }) {
  const jira = jiraUrl(project, task.id);
  const commits = new Set(task.entries.flatMap((e) => e.commits)).size;
  return (
    <div className="flex flex-wrap gap-1.5">
      {jira && (
        <button
          type="button"
          onClick={() => openLink(jira)}
          title={jira}
          className={`${CHIP} transition duration-200 ease-trail hover:bg-hover-strong active:scale-[.96]
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent`}
        >
          Jira
          <Icon name="external" className="h-3.5 w-3.5 text-dim" />
        </button>
      )}
      {task.branches.map((branch) => (
        <span key={branch} className={`${CHIP_BASE} font-mono text-xs`}>
          <Icon name="branch" className="h-3.5 w-3.5 shrink-0 text-dim" />
          <span className="truncate">{branch}</span>
        </span>
      ))}
      <span className={CHIP}>
        {task.phasesTotal > 0 ? <>Фазы <PhaseBar task={task} /></> : "Без фаз"}
      </span>
      {dateRange(task) && <span className={CHIP}>{dateRange(task)}</span>}
      <span className={CHIP}>{commits} {plural(commits, ["коммит", "коммита", "коммитов"])}</span>
    </div>
  );
}

function Brief({ task }: { task: WorklogTask }) {
  const done = task.status === "done" && task.summary !== "";
  const [open, setOpen] = useState(false);
  const { intro, items } = parseSummary(task.summary);
  return (
    <>
      {done && (
        <section className="flex flex-col gap-3 rounded-[20px] bg-accent-soft p-5">
          <h2 className="text-[15px] font-bold text-accent">Итог</h2>
          {intro && <p className="whitespace-pre-line text-sm leading-normal">{plainText(intro)}</p>}
          {items.length > 0 && (
            <ol className="flex list-decimal flex-col gap-1.5 pl-[22px] text-sm leading-normal marker:font-medium marker:text-dim">
              {items.map((item, i) => <li key={i} className="whitespace-pre-line">{plainText(item)}</li>)}
            </ol>
          )}
        </section>
      )}
      {task.text && (
        <section className="-mt-2 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            aria-expanded={open}
            className="-ml-1.5 inline-flex h-8 items-center gap-1.5 self-start rounded-full pl-1.5 pr-3 text-sm font-medium
              transition duration-200 ease-trail hover:bg-hover-strong
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Icon name="chevron" className={`h-3.5 w-3.5 text-dim transition-transform duration-200 ease-trail ${open ? "rotate-90" : ""}`} />
            Исходный текст задачи
          </button>
          {open && <p className="whitespace-pre-line text-sm leading-[1.55] [overflow-wrap:anywhere]">{plainText(task.text)}</p>}
        </section>
      )}
    </>
  );
}

function EntryCard({ entry, current, onOpen }: { entry: WorklogEntry; current: boolean; onOpen: () => void }) {
  const hash = entry.commits[0];
  const files = entry.files.length;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-current={current ? "true" : undefined}
      className={`group flex w-full min-w-0 flex-col gap-2 rounded-[20px] p-4 text-left transition duration-200 ease-trail hover:bg-hover-strong active:scale-[.99]
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${current ? "bg-hover-strong" : "bg-raised"}`}
    >
      <div className="flex min-h-[22px] items-center gap-2">
        <span className={`inline-flex h-[22px] shrink-0 items-center whitespace-nowrap rounded-full bg-hover-strong px-[9px] text-xs font-medium
          transition-colors duration-200 ease-trail group-hover:bg-cosmic ${entry.type === "phase" ? "text-fg" : "text-dim"}`}>
          {entryKind(entry)}
        </span>
        <span className="flex-1" />
        {hash ? (
          <span
            title={entry.commits.join("\n")}
            className="inline-flex h-[22px] shrink-0 items-center rounded-full bg-hover-strong px-2 font-mono text-xs font-medium
              transition-colors duration-200 ease-trail group-hover:bg-cosmic"
          >
            {hash.slice(0, 7)}
          </span>
        ) : (
          <span className="inline-flex h-[22px] shrink-0 items-center rounded-full border border-dashed border-[color-mix(in_srgb,var(--dim)_65%,transparent)] px-2 text-xs font-medium text-dim">
            не закоммичено
          </span>
        )}
      </div>
      <h3 className="text-[15px] font-bold leading-[1.3] [overflow-wrap:anywhere]">{entry.title || entry.message || "Без названия"}</h3>
      {entry.summary && <p className="line-clamp-2 text-[13px] leading-[1.4] text-dim">{plainText(entry.summary)}</p>}
      <div className="flex items-center gap-2.5 text-xs font-medium tabular-nums text-dim">
        <span>{files} {plural(files, ["файл", "файла", "файлов"])}</span>
        <span className="ml-auto">{shortDate(entry.date)}</span>
      </div>
    </button>
  );
}

function Feed({ entries, entryFile, onOpenEntry }: { entries: WorklogEntry[]; entryFile: string | null; onOpenEntry: (file: string) => void }) {
  const n = entries.length;
  return (
    <section className="flex min-w-0 flex-col gap-3.5">
      <div className="flex items-baseline gap-2.5">
        <h2 className="text-lg font-bold leading-[1.2]">Лента</h2>
        <span className="text-[13px] font-medium text-dim">{n} {plural(n, ["запись", "записи", "записей"])}</span>
      </div>
      <ol className="relative flex min-w-0 flex-col gap-2 pl-7 before:absolute before:bottom-4 before:left-1 before:top-4 before:w-px before:bg-line">
        {entries.map((entry) => (
          <li key={entry.file} className="relative min-w-0">
            <span
              aria-hidden="true"
              className={`absolute -left-7 top-[22px] h-2.5 w-2.5 rounded-full shadow-[0_0_0_4px_var(--cosmic)]
                ${entry.commits.length ? "bg-dim" : "bg-cosmic ring-[1.5px] ring-inset ring-dim"}`}
            />
            <EntryCard entry={entry} current={entry.file === entryFile} onOpen={() => onOpenEntry(entry.file)} />
          </li>
        ))}
      </ol>
    </section>
  );
}

export default function JournalTask({ project, task, entryFile, onOpenEntry }: {
  project: WorklogProject;
  task: WorklogTask;
  entryFile: string | null;
  onOpenEntry: (file: string) => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-[880px] flex-col gap-7 px-8 pb-8 pt-8">
      <div className="flex min-w-0 flex-col gap-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <TaskKey id={task.id} />
          <StatusChip task={task} />
        </div>
        <h1 className="text-[32px] font-bold leading-[1.1] tracking-[-0.02em] [overflow-wrap:anywhere] [text-wrap:balance]">
          {task.title}
        </h1>
      </div>
      <Properties project={project} task={task} />
      <Brief key={task.id} task={task} />
      {task.entries.length > 0 && <Feed entries={task.entries} entryFile={entryFile} onOpenEntry={onOpenEntry} />}
    </div>
  );
}
