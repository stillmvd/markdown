import type { HeadingSection } from "../types";

const EMBED = /!\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g;
const CODE = /(```[\s\S]*?```|`[^`\n]*`)/g;
const WIKI_LINK = /\[\[([^\]|]+)(?:\|([^\]]*))?\]\]/g;

function noteTarget(target: string) {
  const [path, anchor] = target.split("#");
  const name = path.split("/").pop() ?? path;
  const extension = name.toLowerCase().split(".").pop() ?? "";
  const withExtension = LINK_EXTENSIONS.includes(extension) ? path : `${path}.md`;
  return { path: withExtension, label: anchor ? `${name} › ${anchor}` : name };
}

function expandOutsideCode(chunk: string): string {
  return chunk
    .replace(EMBED, (_, target: string, alias?: string) => `![${alias?.trim() ?? ""}](${encodeURI(target.trim())})`)
    .replace(WIKI_LINK, (_, target: string, alias?: string) => {
      const note = noteTarget(target.trim());
      return `[${alias?.trim() || note.label}](${encodeURI(note.path)})`;
    });
}

export function expandWikiLinks(markdown: string): string {
  return markdown
    .split(CODE)
    .map((chunk, i) => (i % 2 === 1 ? chunk : expandOutsideCode(chunk)))
    .join("");
}

export function splitByHeadings(markdown: string): HeadingSection[] {
  const lines = markdown.split(/\r?\n/);
  const sections: HeadingSection[] = [];
  let currentSection: HeadingSection | null = null;
  let contentLines: string[] = [];

  const flushSection = () => {
    if (currentSection) {
      currentSection.content = contentLines.join("\n");
      sections.push(currentSection);
      contentLines = [];
    }
  };

  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      flushSection();
      const level = match[1].length;
      const title = match[2].trim();
      const id = title
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-");
      currentSection = { level, title, content: "", id };
    } else {
      contentLines.push(line);
    }
  }

  flushSection();

  if (!sections.length && markdown.trim()) {
    sections.push({
      level: 0,
      title: "",
      content: markdown,
      id: "root",
    });
  }

  return sections;
}

export function wrapSelection(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  before: string,
  after: string,
): { text: string; newStart: number; newEnd: number } {
  const selected = text.slice(selectionStart, selectionEnd);
  const newText =
    text.slice(0, selectionStart) + before + selected + after + text.slice(selectionEnd);
  return {
    text: newText,
    newStart: selectionStart + before.length,
    newEnd: selectionEnd + before.length,
  };
}

export const MARKDOWN_EXTENSIONS = ["md", "markdown"];
export const PLAIN_TEXT_EXTENSIONS = ["txt", "text", "log"];
export const TEXT_EXTENSIONS = [...MARKDOWN_EXTENSIONS, ...PLAIN_TEXT_EXTENSIONS];
const LINK_EXTENSIONS = [...TEXT_EXTENSIONS, "pdf", "png", "jpg", "jpeg", "gif", "webp", "svg"];

function extensionOf(path: string) {
  const name = path.split(/[\\/]/).pop() ?? "";
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

export const isTextFile = (path: string) => TEXT_EXTENSIONS.includes(extensionOf(path));
export const isPlainTextFile = (path: string) => PLAIN_TEXT_EXTENSIONS.includes(extensionOf(path));

export const CODE_LANGUAGES = [
  "javascript", "typescript", "python", "rust", "go", "java", "c", "cpp",
  "csharp", "php", "ruby", "swift", "kotlin", "scala", "html", "css",
  "scss", "sql", "bash", "shell", "powershell", "json", "yaml", "toml",
  "xml", "markdown", "dockerfile", "graphql", "lua", "r", "dart", "elixir",
];
