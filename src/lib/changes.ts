import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { DiffFile } from "./diff";
import { highlightLines, languageOf } from "./diff";

export type DiffMode = "uncommitted" | "branch";

export const gitWorktreeDiff = (repo: string, mode: DiffMode) => invoke<string>("git_worktree_diff", { repo, mode });

export const gitCurrentBranch = (repo: string) => invoke<string>("git_current_branch", { repo });

export const changesWatch = (repo: string, notesPath?: string) =>
  invoke<void>("changes_watch", { repo, notesPath: notesPath ?? null });

export const changesUnwatch = () => invoke<void>("changes_unwatch");

export const onChangesUpdated = (handler: () => void): Promise<UnlistenFn> => listen("changes-updated", handler);

export const readRepoFile = (repo: string, path: string) =>
  invoke<string>("read_file", { path: `${repo.replace(/[\\/]+$/, "")}/${path}` });

export interface Note {
  id: string;
  file: string;
  anchor: { lines: string[]; line: number };
  title: string;
  plain: string;
  code: string;
}

export interface NotesDoc {
  repo: string;
  branch: string;
  updated: string;
  notes: Note[];
}

export interface NotesFile {
  slug: string;
  task: string;
  path: string;
  doc: NotesDoc | null;
}

function parseNotes(text: string): NotesDoc | null {
  try {
    const raw = JSON.parse(text.replace(/^﻿/, ""));
    if (!raw || !Array.isArray(raw.notes)) return null;
    const notes = raw.notes.filter((n: Note) =>
      typeof n?.id === "string" && typeof n.file === "string" && typeof n.title === "string"
      && typeof n.plain === "string" && typeof n.code === "string"
      && Array.isArray(n.anchor?.lines) && n.anchor.lines.length > 0
      && n.anchor.lines.every((l) => typeof l === "string") && n.anchor.lines.some((l) => l.trim()));
    return { repo: String(raw.repo ?? ""), branch: String(raw.branch ?? ""), updated: String(raw.updated ?? ""), notes };
  } catch {
    return null;
  }
}

export const loadNotes = () =>
  invoke<{ slug: string; task: string; path: string; text: string }[]>("changes_notes").then((list) =>
    list.map((f): NotesFile => ({ slug: f.slug, task: f.task, path: f.path, doc: parseNotes(f.text) })));

const TICKET = /^([A-Z][A-Z0-9]+-\d+)/;

export const taskOf = (branch: string) => branch.match(TICKET)?.[1] ?? branch;

export interface PlacedNote {
  note: Note;
  no: number;
  file: number;
  hunk: number;
  first: number;
  start: number;
  last: number;
  stale: boolean;
}

const same = (a: string, b: string) => a.trimEnd() === b.trimEnd();

function findInHunks(file: DiffFile, need: string[], hint: number) {
  let best: { hunk: number; start: number; last: number; at: number } | null = null;
  for (const [h, hunk] of file.hunks.entries()) {
    const side = hunk.lines.map((line, i) => ({ line, i })).filter(({ line }) => line.kind !== "-");
    for (let s = 0; s + need.length <= side.length; s++) {
      if (!need.every((text, j) => same(side[s + j].line.text, text))) continue;
      const at = side[s].line.new ?? 0;
      if (!best || Math.abs(at - hint) < Math.abs(best.at - hint)) best = { hunk: h, start: side[s].i, last: side[s + need.length - 1].i, at };
    }
  }
  return best;
}

function findInText(text: string, need: string[], hint: number) {
  const lines = text.split(/\r?\n/);
  let best = -1;
  for (let i = 0; i + need.length <= lines.length; i++) {
    if (need.every((t, j) => same(lines[i + j], t)) && (best < 0 || Math.abs(i + 1 - hint) < Math.abs(best - hint))) best = i + 1;
  }
  return best;
}

function rowsAround(file: DiffFile, from: number, to: number) {
  let best: { hunk: number; start: number; last: number; dist: number } | null = null;
  for (const [h, hunk] of file.hunks.entries()) {
    for (const [i, line] of hunk.lines.entries()) {
      if (line.new === undefined) continue;
      const dist = line.new < from ? from - line.new : line.new > to ? line.new - to : 0;
      if (!best || dist < best.dist) best = { hunk: h, start: i, last: i, dist };
      else if (dist === 0 && best.dist === 0 && best.hunk === h) best.last = i;
    }
  }
  return best;
}

export async function placeNotes(files: DiffFile[], notes: Note[], read: (path: string) => Promise<string>): Promise<PlacedNote[]> {
  const placed: Omit<PlacedNote, "no">[] = [];
  for (const note of notes) {
    const f = files.findIndex((x) => x.path === note.file);
    if (f < 0 || files[f].hunks.length === 0) continue;
    const file = files[f];
    const need = note.anchor.lines;
    const hint = Number.isInteger(note.anchor.line) && note.anchor.line > 0 ? note.anchor.line : 1;
    try {
      let spot: { hunk: number; start: number; last: number } | null = findInHunks(file, need, hint);
      let stale = false;
      if (!spot) {
        const at = await read(note.file).then((text) => findInText(text, need, hint), () => -1);
        stale = at < 0;
        spot = rowsAround(file, stale ? hint : at, stale ? hint : at + need.length - 1);
      }
      if (!spot) continue;
      const lines = file.hunks[spot.hunk].lines;
      let first = spot.start;
      while (first > 0 && lines[first - 1].kind === "-") first--;
      placed.push({ note, file: f, hunk: spot.hunk, first, start: spot.start, last: spot.last, stale });
    } catch {
      continue;
    }
  }
  placed.sort((a, b) => a.file - b.file || a.hunk - b.hunk || a.start - b.start);
  return placed.map((p, i) => ({ ...p, no: i + 1 }));
}

const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const inline = (text: string) =>
  escapeHtml(text).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");

const paragraphs = (text: string) =>
  text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${inline(block).replace(/\n/g, "<br>")}</p>`)
    .join("");

export function noteHtml(markdown: string) {
  const text = markdown.replace(/\r\n/g, "\n");
  const fence = /^```(\w*)\n([\s\S]*?)\n?^```[ \t]*$/gm;
  let out = "";
  let last = 0;
  for (const m of text.matchAll(fence)) {
    out += paragraphs(text.slice(last, m.index));
    out += `<pre>${highlightLines(m[2].split("\n"), m[1] ? languageOf(`x.${m[1]}`) : null).join("\n")}</pre>`;
    last = m.index + m[0].length;
  }
  return out + paragraphs(text.slice(last));
}
