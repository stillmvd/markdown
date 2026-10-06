import { invoke } from "@tauri-apps/api/core";

export type EntryType = "phase" | "fix" | "commit";

export interface WorklogEntry {
  file: string;
  type: EntryType;
  seq: number;
  phase: number | null;
  title: string;
  date: string;
  branch: string;
  commits: string[];
  message: string;
  files: string[];
  summary: string;
  changes: string;
}

export interface WorklogTask {
  id: string;
  title: string;
  branches: string[];
  status: "in-progress" | "done";
  phasesTotal: number;
  phasesDone: number;
  started: string;
  lastActivity: string;
  summary: string;
  text: string;
  entries: WorklogEntry[];
}

export interface WorklogProject {
  slug: string;
  name: string;
  repo: string;
  gitlab: string;
  jira: string;
  tasks: WorklogTask[];
}

interface RawWorklog {
  root: string;
  projects: { slug: string; project: string; tasks: { id: string; files: { name: string; text: string }[] }[] }[];
}

type Fm = Record<string, unknown>;

function parseValue(raw: string): unknown {
  const v = raw.trim();
  if (v === "" || v === "null" || v === "~") return null;
  if (v.startsWith("[") || v.startsWith('"')) {
    try {
      return JSON.parse(v);
    } catch {
      return v.startsWith('"') ? v.slice(1, -1) : v.slice(1, -1).split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
    }
  }
  if (/^-?\d+$/.test(v)) return Number(v);
  return v.replace(/^'(.*)'$/, "$1");
}

function parseDoc(text: string): { fm: Fm; body: string } {
  const m = text.replace(/^﻿/, "").match(/^---\r?\n(?:([\s\S]*?)\r?\n)?---\r?\n?([\s\S]*)$/);
  if (!m) return { fm: {}, body: text };
  const fm: Fm = {};
  for (const line of (m[1] ?? "").split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_][\w-]*):\s?(.*)$/);
    if (kv) fm[kv[1]] = parseValue(kv[2]);
  }
  return { fm, body: m[2] };
}

function sections(body: string): Record<string, string> {
  const out: Record<string, string[]> = {};
  let key = "";
  for (const line of body.split(/\r?\n/)) {
    const h = line.match(/^##\s+(.+?)\s*$/);
    if (h) out[(key = h[1])] = [];
    else if (key) out[key].push(line);
  }
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.join("\n").trim()]));
}

const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
const list = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);
const num = (v: unknown) => (typeof v === "number" ? v : 0);

function parseEntry(name: string, text: string): WorklogEntry {
  const { fm, body } = parseDoc(text);
  const sec = sections(body);
  const type = str(fm.type);
  return {
    file: name,
    type: type === "phase" || type === "fix" ? type : "commit",
    seq: num(fm.seq),
    phase: typeof fm.phase === "number" ? fm.phase : null,
    title: str(fm.title),
    date: str(fm.date),
    branch: str(fm.branch),
    commits: list(fm.commits),
    message: str(fm.message),
    files: list(fm.files),
    summary: sec["Summary"] ?? "",
    changes: sec["Изменения"] ?? "",
  };
}

function parseTask(id: string, files: { name: string; text: string }[]): WorklogTask {
  const head = parseDoc(files.find((f) => f.name === "task.md")?.text ?? "");
  const sec = sections(head.body);
  const entries = files
    .filter((f) => /^\d{3}-.+\.md$/.test(f.name))
    .map((f) => parseEntry(f.name, f.text))
    .sort((a, b) => a.seq - b.seq);
  return {
    id,
    title: str(head.fm.title) || id,
    branches: list(head.fm.branches),
    status: head.fm.status === "done" ? "done" : "in-progress",
    phasesTotal: num(head.fm.phases_total),
    phasesDone: num(head.fm.phases_done),
    started: str(head.fm.started),
    lastActivity: str(head.fm.last_activity),
    summary: sec["Итог"] ?? "",
    text: sec["Задача"] ?? "",
    entries,
  };
}

export async function loadWorklog(): Promise<{ root: string; projects: WorklogProject[] }> {
  const raw = await invoke<RawWorklog>("worklog_read");
  return {
    root: raw.root,
    projects: raw.projects.map((p) => {
      const fm = parseDoc(p.project).fm;
      return {
        slug: p.slug,
        name: str(fm.name) || p.slug,
        repo: str(fm.repo),
        gitlab: str(fm.gitlab),
        jira: str(fm.jira),
        tasks: p.tasks
          .map((t) => parseTask(t.id, t.files))
          .sort((a, b) => b.lastActivity.localeCompare(a.lastActivity)),
      };
    }),
  };
}

export const gitShow = (repo: string, hash: string) => invoke<string>("git_show", { repo, hash });

export const jiraUrl = (project: WorklogProject, id: string) =>
  /^[A-Z][A-Z0-9]+-\d+$/.test(id) && project.jira ? project.jira.replace("{key}", id) : null;

export const commitUrl = (project: WorklogProject, hash: string) =>
  project.gitlab ? `${project.gitlab.replace(/\/$/, "")}/-/commit/${hash}` : null;

export const shortDate = (iso: string) => (iso ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}` : "");

export function entryKind(entry: WorklogEntry) {
  if (entry.type === "phase") return entry.phase ? `Фаза ${entry.phase}` : "Фаза";
  if (entry.type === "fix") return entry.phase ? `Дофикс · фаза ${entry.phase}` : "Дофикс";
  return "Коммит";
}

export function dateRange(task: WorklogTask) {
  const a = shortDate(task.started);
  const b = shortDate(task.lastActivity);
  return !a || a === b ? b || a : `${a} – ${b}`;
}

const DAY = 864e5;

export function weekStats(project: WorklogProject) {
  const since = Date.now() - 7 * DAY;
  const commits = new Set(
    project.tasks.flatMap((t) => t.entries.filter((e) => Date.parse(e.date) >= since).flatMap((e) => e.commits)),
  );
  return { active: project.tasks.filter((t) => t.status !== "done").length, commits: commits.size };
}

export function isReturned(task: WorklogTask) {
  if (task.entries.length < 2) return false;
  const [prev, last] = task.entries.slice(-2);
  return last.type === "fix" && Date.parse(last.date) - Date.parse(prev.date) >= 2 * DAY;
}

export const plainText = (markdown: string) => markdown.replace(/\*\*|`/g, "");

export interface ChangeRow {
  refs: string[];
  what: string;
  why: string;
}

export interface FileChanges {
  file: string;
  rows: ChangeRow[];
}

const splitRow = (line: string) =>
  line.trim().replace(/^\||\|$/g, "").split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, "|"));

export function parseChanges(markdown: string): FileChanges[] {
  const files: FileChanges[] = [];
  const lines = markdown.split(/\r?\n/).filter((line) => line.trim().startsWith("|"));
  for (const line of lines.slice(2)) {
    const [file = "", what = "", why = ""] = splitRow(line);
    const name = file.replace(/`/g, "");
    if (name || files.length === 0) files.push({ file: name, rows: [] });
    if (!what && !why) continue;
    const refs = what.match(/^((?:`:[^`]+`[,\s]*)+)[—–-]\s*([\s\S]*)$/);
    files[files.length - 1].rows.push(
      refs
        ? { refs: [...refs[1].matchAll(/`(:[^`]+)`/g)].map((m) => m[1]), what: refs[2], why }
        : { refs: [], what, why },
    );
  }
  return files;
}
