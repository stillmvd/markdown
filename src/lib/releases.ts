import { invoke } from "@tauri-apps/api/core";
import type { WorklogProject, WorklogTask } from "./worklog";

export interface ReleaseItem {
  task: WorklogTask;
  fix: boolean;
}

export interface ReleaseGroup {
  id: string;
  kind: "unreleased" | "wip" | "release";
  title: string;
  meta: string;
  items: ReleaseItem[];
  extra: string[];
}

const PUBLISH = /^\[publish\]\s*v?(\d+(?:\.\d+)+)\s*$/i;
const MERGE = /^Merge branch '([^']+)'/;
const KEY = /[A-Z][A-Z0-9]+-\d+/;

export const gitMainline = (repo: string) => invoke<string>("git_mainline", { repo });

const shortDate = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}`;

function add(group: ReleaseGroup, task: WorklogTask, fix: boolean) {
  const found = group.items.find((item) => item.task === task);
  if (found) found.fix &&= fix;
  else group.items.push({ task, fix });
}

export function groupByRelease(project: WorklogProject, raw: string): ReleaseGroup[] | null {
  const byId = new Map(project.tasks.map((task) => [task.id, task]));
  const byBranch = new Map(project.tasks.flatMap((task) => task.branches.map((branch) => [branch, task] as const)));
  const find = (name: string) => byId.get(name.match(KEY)?.[0] ?? name) ?? byBranch.get(name);
  const merged = new Set<WorklogTask>();
  const unreleased: ReleaseGroup = { id: "unreleased", kind: "unreleased", title: "Не выпущено", meta: "влито, ждёт [publish]", items: [], extra: [] };
  const groups: ReleaseGroup[] = [];
  let current = unreleased;
  for (const line of raw.split(/\r?\n/)) {
    const [, date = "", subject = ""] = line.split("\t");
    const publish = subject.match(PUBLISH);
    if (publish) {
      current = { id: publish[1], kind: "release", title: publish[1], meta: shortDate(date), items: [], extra: [] };
      groups.push(current);
      continue;
    }
    const branch = subject.match(MERGE)?.[1];
    if (!branch) {
      const token = subject.trim().split(/[:\s]/)[0];
      const direct = find(subject.match(KEY)?.[0] ?? token);
      if (direct) {
        add(current, direct, token !== direct.id && /fix/i.test(token));
        merged.add(direct);
      }
      continue;
    }
    const task = find(branch);
    if (task) {
      add(current, task, branch !== task.id && /fix/i.test(branch));
      merged.add(task);
      for (const other of task.branches) {
        const inner = find(other);
        if (inner && inner !== task && !merged.has(inner)) {
          add(current, inner, false);
          merged.add(inner);
        }
      }
    } else if (!current.extra.includes(branch)) {
      current.extra.push(branch);
    }
  }
  if (groups.length === 0) return null;
  const wip: ReleaseGroup = {
    id: "wip", kind: "wip", title: "В работе", meta: "не влито",
    items: project.tasks.filter((task) => !merged.has(task)).map((task) => ({ task, fix: false })),
    extra: [],
  };
  return [unreleased, wip, ...groups].filter((group) => group.kind === "release" || group.items.length + group.extra.length > 0);
}

export const changelog = (group: ReleaseGroup, withKeys: boolean) =>
  group.items.map(({ task }) => (withKeys ? `${task.id} - ${task.title}` : `• ${task.title}`)).join("\n");
