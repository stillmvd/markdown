import { useEffect, useMemo, useState } from "react";
import type { WorklogProject, WorklogTask } from "../lib/worklog";
import { dateRange, isReturned, weekStats } from "../lib/worklog";
import { changelog, gitMainline, groupByRelease, type ReleaseGroup } from "../lib/releases";
import { plural } from "../lib/plural";
import { useMenu } from "../hooks/useMenu";
import Icon from "./Icon";
import { useCopy } from "./Toast";
import SidePanel, { SidePanelEmpty } from "./SidePanel";
import JournalTask from "./JournalTask";
import JournalEntry from "./JournalEntry";

interface JournalProps {
  projects: WorklogProject[] | null;
  error: string | null;
  selected: string | null;
  onSelect: (slug: string) => void;
  taskId: string | null;
  onBack: () => void;
  entryFile: string | null;
  onEntry: (file: string | null) => void;
  onOpenTask: (project: WorklogProject, task: WorklogTask) => void;
  onClose: () => void;
}

export function TaskKey({ id, small = false, className = "bg-raised" }: { id: string; small?: boolean; className?: string }) {
  const copy = useCopy();
  const [shot, setShot] = useState(0);
  return (
    <span
      title={`Скопировать ${id}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        copy(id, `${id} скопирован`);
        setShot((n) => n + 1);
      }}
      className={`task-key relative inline-flex shrink-0 cursor-copy items-center whitespace-nowrap rounded-full font-mono font-medium
        ${small ? "h-5 px-[7px] text-[11px]" : "h-[22px] px-2 text-xs"} ${className}`}
    >
      <span key={shot} className={`inline-flex items-center ${shot ? "task-key-shake" : ""}`}>
        {id}
        <Icon name="copy" className="task-key-icon h-3 w-3 shrink-0" />
      </span>
      {shot > 0 && (
        <span key={`f${shot}`} aria-hidden="true" className="task-key-fly pointer-events-none absolute inset-0 grid place-items-center">
          {id}
        </span>
      )}
    </span>
  );
}

export function StatusChip({ task }: { task: WorklogTask }) {
  return task.status === "done" ? (
    <span className="inline-flex h-[22px] shrink-0 items-center rounded-full bg-hover-strong px-[9px] text-xs font-medium text-dim
      transition-colors duration-200 ease-trail group-hover:bg-raised">
      Готово
    </span>
  ) : (
    <span className="inline-flex h-[22px] shrink-0 items-center rounded-full bg-accent-soft px-[9px] text-xs font-medium text-accent">
      В работе
    </span>
  );
}

export function PhaseProgress({ task }: { task: WorklogTask }) {
  if (!task.phasesTotal) {
    const commits = new Set(task.entries.flatMap((e) => e.commits)).size;
    return <span className="whitespace-nowrap text-xs font-medium tabular-nums text-dim">Коммиты: {commits}</span>;
  }
  return <PhaseBar task={task} />;
}

export function PhaseBar({ task }: { task: WorklogTask }) {
  return (
    <span className="inline-flex items-center gap-2" title={`Фазы: ${task.phasesDone} из ${task.phasesTotal}`}>
      <span className="h-1 w-14 overflow-hidden rounded-sm bg-line">
        <span className="block h-full bg-fg" style={{ width: `${Math.round((task.phasesDone / task.phasesTotal) * 100)}%` }} />
      </span>
      <span className="text-xs font-medium tabular-nums">{task.phasesDone}/{task.phasesTotal}</span>
    </span>
  );
}

function TaskCard({ task, fix = false, onOpen }: { task: WorklogTask; fix?: boolean; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      title={task.title}
      className="group flex min-w-0 flex-col gap-2.5 rounded-[20px] bg-raised p-4 text-left
        transition duration-200 ease-trail hover:bg-hover-strong active:scale-[.98]
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <span className="flex min-w-0 items-center gap-2">
        <TaskKey id={task.id} className="bg-hover-strong transition-colors duration-200 ease-trail group-hover:bg-raised" />
        {isReturned(task) && (
          <span className="inline-flex h-[22px] shrink-0 items-center rounded-full bg-hover-strong px-[9px] text-xs font-medium
            transition-colors duration-200 ease-trail group-hover:bg-raised">
            Вернулась
          </span>
        )}
        {fix && (
          <span className="inline-flex h-[22px] shrink-0 items-center rounded-full bg-hover-strong px-[9px] text-xs font-medium
            transition-colors duration-200 ease-trail group-hover:bg-raised">
            дофикс
          </span>
        )}
        <span className="flex-1" />
        <StatusChip task={task} />
      </span>
      <span className="line-clamp-2 min-h-[2.6em] text-[15px] font-bold leading-[1.3]">{task.title}</span>
      <span className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <PhaseProgress task={task} />
        <span className="whitespace-nowrap text-xs font-medium tabular-nums text-dim">{dateRange(task)}</span>
        {task.branches.length > 0 && (
          <span className="flex min-w-0 basis-full items-center gap-1.5 font-mono text-xs text-dim">
            <Icon name="branch" className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{task.branches.join(", ")}</span>
          </span>
        )}
      </span>
    </button>
  );
}

function TaskGroups({ project, onOpenTask }: { project: WorklogProject; onOpenTask: JournalProps["onOpenTask"] }) {
  const groups = [
    { title: "В работе", tasks: project.tasks.filter((t) => t.status !== "done") },
    { title: "Готово", tasks: project.tasks.filter((t) => t.status === "done") },
  ].filter((g) => g.tasks.length > 0);

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-2">
      {groups.map((group, i) => (
        <section key={group.title} className="contents">
          <h2 className={`col-span-full px-3.5 pb-1 text-[13px] font-bold text-dim ${i > 0 ? "pt-3.5" : ""}`}>
            {group.title}
          </h2>
          {group.tasks.map((task) => (
            <TaskCard key={task.id} task={task} onOpen={() => onOpenTask(project, task)} />
          ))}
        </section>
      ))}
    </div>
  );
}

const GROUP_KEY = "journal-group";

function CopyMenu({ group }: { group: ReleaseGroup }) {
  const { open, setOpen, ref, buttonRef, run } = useMenu();
  const copy = useCopy();
  const name = group.kind === "release" ? group.title : "невыпущенного";
  const formats = [
    { label: "Номер задачи — описание", sample: `${group.items[0]?.task.id} - …`, keys: true },
    { label: "Маркированный список", sample: "• …", keys: false },
  ];
  return (
    <div ref={ref} className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Скопировать чендж-лог"
        aria-label={`Скопировать чендж-лог ${group.title}`}
        className={`grid h-7 w-7 place-items-center rounded-full transition duration-200 ease-trail hover:bg-hover-strong active:scale-[.96]
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${open ? "bg-hover-strong" : "bg-raised"}`}
      >
        <Icon name="copy" className="h-3.5 w-3.5 text-dim" />
      </button>
      {open && (
        <div role="menu" className="menu-card wl-menu absolute right-0 top-[calc(100%+6px)] z-10 w-max">
          {formats.map((format) => (
            <button
              key={format.label}
              type="button"
              role="menuitem"
              className="menu-row"
              onClick={run(() => copy(changelog(group, format.keys), `Чендж-лог ${name} скопирован`))}
            >
              <Icon name={format.keys ? "code" : "list"} className="h-4 w-4 shrink-0 text-dim" />
              <span className="flex-1">{format.label}</span>
              <span className="shrink-0 font-mono text-xs text-dim">{format.sample}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Releases({ project, groups, onOpenTask }: {
  project: WorklogProject;
  groups: ReleaseGroup[];
  onOpenTask: JournalProps["onOpenTask"];
}) {
  return (
    <div className="relative flex flex-col gap-7 pl-7 before:absolute before:bottom-3.5 before:left-1 before:top-3.5 before:w-px before:bg-line">
      {groups.map((group) => {
        const n = group.items.length;
        const count = n > 0 || group.extra.length === 0
          ? `${n} ${plural(n, ["задача", "задачи", "задач"])}`
          : `${group.extra.length} ${plural(group.extra.length, ["ветка", "ветки", "веток"])}`;
        return (
          <section key={group.id} className="flex min-w-0 flex-col gap-3">
            <div className="relative flex min-h-7 min-w-0 items-center gap-3">
              <span
                className={`absolute -left-7 top-[9px] h-2.5 w-2.5 rounded-full shadow-[0_0_0_4px_var(--cosmic)]
                  ${group.kind === "release" ? "bg-dim" : "bg-cosmic ring-[1.5px] ring-inset ring-dim"}`}
              />
              <h2 className={`shrink-0 text-[15px] font-bold leading-[1.2] ${group.kind === "release" ? "font-mono" : ""}`}>{group.title}</h2>
              <span className="min-w-0 truncate text-[13px] font-medium tabular-nums text-dim">
                {group.meta} · {count}
              </span>
              <i className="h-px min-w-3 flex-1 bg-line" />
              {group.kind !== "wip" && group.items.length > 0 && <CopyMenu group={group} />}
            </div>
            {group.items.length > 0 && (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-2">
                {group.items.map(({ task, fix }) => (
                  <TaskCard key={task.id} task={task} fix={fix} onOpen={() => onOpenTask(project, task)} />
                ))}
              </div>
            )}
            {group.extra.length > 0 && (
              <div className="flex flex-col">
                {group.extra.map((branch) => (
                  <div key={branch} className="flex h-8 min-w-0 items-center gap-2.5 px-3 text-xs font-medium text-dim">
                    <Icon name="branch" className="h-3.5 w-3.5 shrink-0" />
                    <span className="min-w-0 flex-1 truncate font-mono font-normal">{branch}</span>
                    <span className="shrink-0">нет в журнале</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

const mainlines = new Map<string, string | null>();

function ProjectTasks({ project, onOpenTask }: { project: WorklogProject; onOpenTask: JournalProps["onOpenTask"] }) {
  const [, setLoaded] = useState(0);
  const [mode, setMode] = useState(() => {
    try {
      return localStorage.getItem(GROUP_KEY) === "status" ? "status" : "releases";
    } catch {
      return "releases";
    }
  });

  useEffect(() => {
    let alive = true;
    const done = (raw: string | null) => {
      mainlines.set(project.repo, raw);
      if (alive) setLoaded((n) => n + 1);
    };
    gitMainline(project.repo).then(done, () => done(null));
    return () => {
      alive = false;
    };
  }, [project.repo]);

  const raw = mainlines.get(project.repo);
  const loading = raw === undefined;
  const groups = useMemo(() => (raw ? groupByRelease(project, raw) : null), [raw, project]);

  const choose = (next: string) => {
    setMode(next);
    try {
      localStorage.setItem(GROUP_KEY, next);
    } catch {}
  };

  const segment = (groups || loading) && (
    <div role="radiogroup" aria-label="Группировка" className="inline-flex h-10 shrink-0 gap-0.5 self-start rounded-full bg-raised p-1">
      {[["status", "По статусу"], ["releases", "По релизам"]].map(([id, label]) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={mode === id}
          onClick={() => choose(id)}
          className={`inline-flex h-8 items-center whitespace-nowrap rounded-full px-3.5 text-[13px] font-medium transition duration-200 ease-trail
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
            ${mode === id ? "bg-hover-strong text-fg shadow-[0_1px_2px_var(--press-shade)]" : "text-dim hover:text-fg"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <ProjectHead project={project} />
        {segment}
      </div>
      {mode === "releases" && loading ? null : groups && mode === "releases" ? (
        <Releases project={project} groups={groups} onOpenTask={onOpenTask} />
      ) : (
        <TaskGroups project={project} onOpenTask={onOpenTask} />
      )}
    </>
  );
}

function ProjectHead({ project }: { project: WorklogProject }) {
  const { active, commits } = weekStats(project);
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <h1 className="text-[42px] font-light leading-[1.06] tracking-[-0.02em] [text-wrap:balance]">
        Задачи <b className="font-bold">{project.name}</b>
      </h1>
      <div className="flex flex-wrap gap-1.5">
        {[`${active} в работе`, `${commits} ${plural(commits, ["коммит", "коммита", "коммитов"])} за неделю`].map((text) => (
          <span key={text} className="inline-flex h-6 items-center rounded-full bg-raised px-2.5 text-xs font-medium tabular-nums text-dim">
            {text}
          </span>
        ))}
      </div>
    </div>
  );
}

function TaskNav({ project, task, onBack, onOpenTask }: {
  project: WorklogProject;
  task: WorklogTask;
  onBack: () => void;
  onOpenTask: JournalProps["onOpenTask"];
}) {
  return (
    <>
      <button
        type="button"
        onClick={onBack}
        title="К списку задач"
        className="side-row mx-2 shrink-0 gap-1.5 pl-2 text-[13px] font-medium text-dim hover:bg-hover hover:text-fg"
      >
        <Icon name="chevron" className="h-3.5 w-3.5 shrink-0 -scale-x-100" />
        <span className="truncate">{project.name}</span>
      </button>
      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-2 pt-1" aria-label={`Задачи ${project.name}`}>
        {project.tasks.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onOpenTask(project, t)}
            title={t.title}
            aria-current={t === task ? "page" : undefined}
            className={`side-row pl-1.5 pr-2.5 text-[13px] font-medium
              ${t === task ? "bg-hover-strong shadow-press" : "hover:bg-hover"}`}
          >
            <TaskKey id={t.id} small className={t === task ? "bg-cosmic" : "bg-raised"} />
            <span className={`truncate ${t.status === "done" && t !== task ? "text-dim" : ""}`}>{t.title}</span>
          </button>
        ))}
      </nav>
    </>
  );
}

export default function Journal({ projects, error, selected, onSelect, taskId, onBack, entryFile, onEntry, onOpenTask, onClose }: JournalProps) {
  const project = projects?.find((p) => p.slug === selected) ?? projects?.[0] ?? null;
  const task = project?.tasks.find((t) => t.id === taskId) ?? null;
  const entry = task?.entries.find((e) => e.file === entryFile) ?? null;
  const empty = projects !== null && projects.every((p) => p.tasks.length === 0);
  const sheetKey = (file: string) => `${project?.slug}/${task?.id}/${file}`;
  const [lastSheet, setLastSheet] = useState<string | null>(null);
  if (entry && sheetKey(entry.file) !== lastSheet) setLastSheet(sheetKey(entry.file));
  const sheetEntry = entry ?? task?.entries.find((e) => sheetKey(e.file) === lastSheet) ?? null;

  return (
    <>
      <SidePanel icon="book" title="Журнал" closeLabel="Закрыть журнал" storageKey="journal-panel-width" onClose={onClose}>
        {project && task ? (
          <TaskNav project={project} task={task} onBack={onBack} onOpenTask={onOpenTask} />
        ) : (
        <nav className="flex flex-col gap-0.5 px-2 pb-2 pt-1" aria-label="Проекты">
          {projects?.map((p) => (
            <button
              key={p.slug}
              type="button"
              onClick={() => onSelect(p.slug)}
              aria-current={p === project ? "page" : undefined}
              className={`side-row pl-3 pr-1.5 text-[13px] font-medium
                ${p === project ? "bg-hover-strong shadow-press" : "hover:bg-hover"}`}
            >
              <span className="truncate">{p.name}</span>
              <span className={`ml-auto inline-grid h-5 min-w-[22px] shrink-0 place-items-center rounded-full px-[7px] text-[11px] font-bold tabular-nums text-dim
                ${p === project ? "bg-cosmic" : "bg-raised"}`}>
                {p.tasks.length}
              </span>
            </button>
          ))}
        </nav>
        )}
      </SidePanel>

      <div className="wl-stack relative min-w-0 flex-1 px-2 pb-2 [overflow-x:clip]">
        <div
          key={task?.id ?? "list"}
          className="welcome-sheet flex h-full flex-col overflow-y-auto rounded-[28px] bg-cosmic"
        >
          <div inert={!!entry} className="contents">
            {error ? (
              <SidePanelEmpty icon="alert" title="Журнал не прочитан" text={error} />
            ) : projects === null ? null : empty || !project ? (
              <SidePanelEmpty icon="book" title="Журнал пуст" text="Записи появятся после /phase:complete или коммита по задаче" />
            ) : task ? (
              <JournalTask project={project} task={task} entryFile={entryFile} onOpenEntry={onEntry} />
            ) : (
              <div className="mx-auto flex w-full max-w-[880px] flex-col gap-5 px-8 pb-8 pt-8">
                <ProjectTasks project={project} onOpenTask={onOpenTask} />
              </div>
            )}
          </div>
        </div>
        {task && (
          <div
            aria-hidden="true"
            title="К задаче"
            data-on={entry ? true : undefined}
            onClick={() => onEntry(null)}
            className="wl-scrim inset-x-2 bottom-2 top-0 z-10 rounded-[28px]"
          />
        )}
        {project && task && sheetEntry && (
          <JournalEntry
            key={sheetEntry.file}
            project={project}
            task={task}
            entry={sheetEntry}
            closing={!entry}
            onClose={() => onEntry(null)}
            onClosed={() => setLastSheet(null)}
          />
        )}
      </div>
    </>
  );
}
