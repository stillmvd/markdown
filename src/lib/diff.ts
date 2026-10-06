import hljs from "highlight.js/lib/common";

export interface DiffLine {
  kind: " " | "+" | "-";
  old?: number;
  new?: number;
  text: string;
}

export interface DiffHunk {
  oldStart: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export interface DiffFile {
  path: string;
  status: "added" | "deleted" | "renamed" | "modified";
  binary: boolean;
  add: number;
  del: number;
  hunks: DiffHunk[];
}

const HUNK = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,(\d+))? @@/;

export function parseCommit(raw: string): DiffFile[] {
  const patch = raw.slice(raw.indexOf("\0") + 1);
  const files: DiffFile[] = [];
  let file: DiffFile | null = null;
  let hunk: DiffHunk | null = null;
  let o = 0;
  let n = 0;
  for (const rawLine of patch.split("\n")) {
    const line = rawLine.replace(/\r$/, "");
    if (line.startsWith("diff --git ")) {
      file = { path: line.match(/ b\/(.*)$/)?.[1] ?? "", status: "modified", binary: false, add: 0, del: 0, hunks: [] };
      files.push(file);
      hunk = null;
      continue;
    }
    if (!file) continue;
    const head = line.match(HUNK);
    if (head) {
      o = +head[1];
      n = +head[2];
      hunk = { oldStart: o, newStart: n, newLines: head[3] === undefined ? 1 : +head[3], lines: [] };
      file.hunks.push(hunk);
      continue;
    }
    if (!hunk) {
      if (line.startsWith("new file mode")) file.status = "added";
      else if (line.startsWith("deleted file mode")) file.status = "deleted";
      else if (line.startsWith("rename from ")) file.status = "renamed";
      else if (line.startsWith("rename to ")) file.path = line.slice(10);
      else if (line.startsWith("Binary files")) file.binary = true;
      else if (line.startsWith("+++ b/")) file.path = line.slice(6).replace(/\t$/, "");
      else if (line.startsWith("--- a/") && file.status === "deleted") file.path = line.slice(6).replace(/\t$/, "");
      continue;
    }
    const kind = line[0];
    if (kind === "+") {
      hunk.lines.push({ kind, new: n++, text: line.slice(1) });
      file.add++;
    } else if (kind === "-") {
      hunk.lines.push({ kind, old: o++, text: line.slice(1) });
      file.del++;
    } else if (kind === " ") {
      hunk.lines.push({ kind, old: o++, new: n++, text: line.slice(1) });
    }
  }
  return files;
}

export function hiddenBefore(file: DiffFile, index: number) {
  const prev = file.hunks[index - 1];
  const start = prev ? prev.newStart + prev.newLines : 1;
  return { start, count: Math.max(0, file.hunks[index].newStart - start) };
}

const LANGS: Record<string, string> = {
  vue: "xml", html: "xml", svg: "xml", ts: "typescript", tsx: "typescript", mts: "typescript",
  js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript", rs: "rust", md: "markdown",
  py: "python", yml: "yaml", sh: "bash", ps1: "powershell",
};

export function languageOf(path: string) {
  const ext = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
  const lang = LANGS[ext] ?? ext;
  return hljs.getLanguage(lang) ? lang : null;
}

const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const highlightLine = (text: string, lang: string | null) =>
  lang ? hljs.highlight(text, { language: lang, ignoreIllegals: true }).value : escapeHtml(text);

const TAG = /<span[^>]*>|<\/span>/g;

export function highlightLines(lines: string[], lang: string | null): string[] {
  if (!lang) return lines.map(escapeHtml);
  const html = hljs.highlight(lines.join("\n"), { language: lang, ignoreIllegals: true }).value;
  const out: string[] = [];
  const open: string[] = [];
  for (const chunk of html.split("\n")) {
    let line = open.join("");
    let last = 0;
    for (const m of chunk.matchAll(TAG)) {
      line += chunk.slice(last, m.index) + m[0];
      last = m.index + m[0].length;
      if (m[0] === "</span>") open.pop();
      else open.push(m[0]);
    }
    out.push(line + chunk.slice(last) + "</span>".repeat(open.length));
  }
  return out;
}

export function highlightHunk(hunk: DiffHunk, lang: string | null): string[] {
  const after = hunk.lines.filter((l) => l.kind !== "-");
  const before = hunk.lines.filter((l) => l.kind !== "+");
  const a = highlightLines(after.map((l) => l.text), lang);
  const b = highlightLines(before.map((l) => l.text), lang);
  let i = 0;
  let j = 0;
  return hunk.lines.map((l) => {
    if (l.kind === "+") return a[i++];
    if (l.kind === "-") return b[j++];
    j++;
    return a[i++];
  });
}
