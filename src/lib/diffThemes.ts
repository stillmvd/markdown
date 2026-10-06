import { useCallback, useState, type CSSProperties } from "react";

type TokenKey =
  | "comment" | "keyword" | "string" | "number" | "literal" | "tag" | "attr" | "title"
  | "type" | "builtIn" | "variable" | "property" | "operator" | "punct" | "regexp";

export interface DiffTheme {
  id: string;
  name: string;
  vscode?: boolean;
  bg: string;
  fg: string;
  line: string;
  ins: string;
  del: string;
  tokens: Record<TokenKey, string>;
}

const STRING = "color-mix(in srgb, var(--fg) 72%, var(--accent))";

export const DIFF_THEMES: DiffTheme[] = [
  {
    id: "app", name: "Как в приложении",
    bg: "var(--cosmic)", fg: "var(--fg)", line: "var(--dim)", ins: "var(--accent-soft)", del: "var(--raised)",
    tokens: {
      comment: "var(--dim)", keyword: "var(--accent)", string: STRING, number: "var(--accent)", literal: "var(--accent)",
      tag: "var(--accent)", attr: "var(--accent)", title: "var(--fg)", type: "var(--fg)", builtIn: "var(--fg)",
      variable: "var(--fg)", property: "var(--fg)", operator: "var(--fg)", punct: "var(--accent)", regexp: STRING,
    },
  },
  {
    id: "2026-dark", name: "Dark 2026", vscode: true,
    bg: "#121314", fg: "#BBBEBF", line: "#858889", ins: "#347d3926", del: "#c93c3726",
    tokens: {
      comment: "#8b949e", keyword: "#C586C0", string: "#a5d6ff", number: "#b5cea8", literal: "#569cd6", tag: "#7ee787",
      attr: "#9cdcfe", title: "#d2a8ff", type: "#4EC9B0", builtIn: "#DCDCAA", variable: "#c9d1d9", property: "#c9d1d9",
      operator: "#d4d4d4", punct: "#808080", regexp: "#a5d6ff",
    },
  },
  {
    id: "dark_modern", name: "Dark Modern",
    bg: "#1F1F1F", fg: "#CCCCCC", line: "#6E7681", ins: "#9bb95533", del: "#ff000033",
    tokens: {
      comment: "#6A9955", keyword: "#C586C0", string: "#ce9178", number: "#b5cea8", literal: "#569cd6", tag: "#569cd6",
      attr: "#9cdcfe", title: "#DCDCAA", type: "#4EC9B0", builtIn: "#DCDCAA", variable: "#9CDCFE", property: "#9CDCFE",
      operator: "#d4d4d4", punct: "#808080", regexp: "#d16969",
    },
  },
];

export function themeVars(theme: DiffTheme): CSSProperties {
  const vars: Record<string, string> = {
    "--dt-bg": theme.bg, "--dt-fg": theme.fg, "--dt-line": theme.line, "--dt-ins": theme.ins, "--dt-del": theme.del,
  };
  for (const [key, value] of Object.entries(theme.tokens)) vars[`--dt-${key}`] = value;
  return vars as CSSProperties;
}

const KEY = "diff-theme";

export function useDiffTheme() {
  const [id, setId] = useState(() => {
    try {
      return localStorage.getItem(KEY) ?? "2026-dark";
    } catch {
      return "2026-dark";
    }
  });
  const theme = DIFF_THEMES.find((t) => t.id === id) ?? DIFF_THEMES[1];
  const choose = useCallback((next: string) => {
    setId(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {}
  }, []);
  return { theme, choose };
}
