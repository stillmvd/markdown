import { useSyncExternalStore } from "react";
import { highlightHunk, highlightLine, languageOf } from "./diff";

export interface DocLine {
  kind: " " | "+" | "-";
  text: string;
  html: string;
}

export interface DocHunk {
  ctx: string;
  lines: DocLine[];
}

export interface DocFile {
  path: string | null;
  add: number;
  del: number;
  hunks: DocHunk[];
}

export type SplitRow = [DocLine | null, DocLine | null];

const HUNK = /^@@(?:\s*-\d+(?:,\d+)?\s+\+\d+(?:,\d+)?\s*@@)?\s?(.*)$/;

export function parseDocPatch(raw: string): DocFile[] {
  const files: DocFile[] = [];
  const add = (path: string | null): DocFile => {
    const f: DocFile = { path, add: 0, del: 0, hunks: [] };
    files.push(f);
    return f;
  };
  let file: DocFile | null = null;
  let hunk: DocHunk | null = null;
  const body = raw.replace(/\s+$/, "");
  if (!body) return files;
  const lines = body.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/\r$/, "");
    if (!line && /^(diff --git |--- )/.test(lines[i + 1] ?? "")) continue;
    if (line.startsWith("diff --git ")) {
      file = add(line.match(/ b\/(.*)$/)?.[1] ?? null);
      hunk = null;
      continue;
    }
    if (line.startsWith("--- ") && lines[i + 1]?.startsWith("+++ ")) {
      const to = lines[i + 1].slice(4).replace(/\t.*$/, "");
      const from = line.slice(4).replace(/\t.*$/, "");
      const path = (to === "/dev/null" ? from : to).replace(/^[ab]\//, "");
      if (file && !file.hunks.length) file.path = path;
      else file = add(path);
      hunk = null;
      i++;
      continue;
    }
    if (line.startsWith("@@")) {
      file ??= add(null);
      hunk = { ctx: line.match(HUNK)?.[1] ?? "", lines: [] };
      file.hunks.push(hunk);
      continue;
    }
    if (/^(index |(old|new|deleted) (file )?mode |(dis)?similarity index|(rename|copy) (from|to) |Binary files |GIT binary patch|\\ No newline)/.test(line)) continue;
    file ??= add(null);
    if (!hunk) {
      hunk = { ctx: "", lines: [] };
      file.hunks.push(hunk);
    }
    const kind = line[0] === "+" || line[0] === "-" ? line[0] : " ";
    if (kind === "+") file.add++;
    if (kind === "-") file.del++;
    hunk.lines.push({ kind, text: kind === " " && line[0] !== " " ? line : line.slice(1), html: "" });
  }
  for (const f of files) {
    const lang = f.path ? languageOf(f.path) : null;
    for (const h of f.hunks) {
      const html = highlightHunk(h, lang);
      h.lines.forEach((l, i) => { l.html = html[i] || " "; });
      markWords(h.lines);
      h.ctx = h.ctx ? highlightLine(h.ctx, lang) : "";
    }
  }
  return files;
}

function runs(lines: DocLine[], each: (dels: DocLine[], adds: DocLine[]) => void) {
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].kind === " ") continue;
    let j = i;
    while (j < lines.length && lines[j].kind === "-") j++;
    let k = j;
    while (k < lines.length && lines[k].kind === "+") k++;
    each(lines.slice(i, j), lines.slice(j, k));
    i = Math.max(i, k - 1);
  }
}

function markWords(lines: DocLine[]) {
  runs(lines, (dels, adds) => {
    for (let n = 0; n < Math.min(dels.length, adds.length); n++) {
      const a = dels[n].text;
      const b = adds[n].text;
      const max = Math.max(a.length, b.length);
      let p = 0;
      while (p < a.length && p < b.length && a[p] === b[p]) p++;
      let s = 0;
      while (s < a.length - p && s < b.length - p && a[a.length - 1 - s] === b[b.length - 1 - s]) s++;
      if (max === 0 || (p + s) / max < 0.5) continue;
      dels[n].html = wrapRange(dels[n].html, p, a.length - s);
      adds[n].html = wrapRange(adds[n].html, p, b.length - s);
    }
  });
}

const TOKEN = /<[^>]+>|&[a-z#0-9]+;|[^<&]/gi;

function wrapRange(html: string, start: number, end: number) {
  if (end <= start) return html;
  const open: string[] = [];
  let pos = 0;
  let out = "";
  const shut = () => "</span>".repeat(open.length);
  for (const [t] of html.matchAll(TOKEN)) {
    if (t.startsWith("<")) {
      if (t === "</span>") open.pop();
      else open.push(t);
      out += t;
      continue;
    }
    if (pos === start) out += `${shut()}<span class="dd-w">${open.join("")}`;
    out += t;
    pos++;
    if (pos === end) out += `${shut()}</span>${open.join("")}`;
  }
  return out;
}

export function splitRows(lines: DocLine[]): SplitRow[] {
  const out: SplitRow[] = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.kind === " ") {
      out.push([l, l]);
      continue;
    }
    let j = i;
    while (j < lines.length && lines[j].kind === "-") j++;
    let k = j;
    while (k < lines.length && lines[k].kind === "+") k++;
    for (let n = 0; n < Math.max(j - i, k - j); n++) out.push([i + n < j ? lines[i + n] : null, j + n < k ? lines[j + n] : null]);
    i = k - 1;
  }
  return out;
}

const KEY = "doc-diff-split";
const listeners = new Set<() => void>();

function readSplit() {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

let split = readSplit();

export function useDiffSplit(): [boolean, () => void] {
  const value = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => split,
  );
  const toggle = () => {
    split = !split;
    try {
      localStorage.setItem(KEY, split ? "1" : "0");
    } catch {}
    listeners.forEach((cb) => cb());
  };
  return [value, toggle];
}
