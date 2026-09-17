import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import {
  HighlightStyle,
  foldEffect,
  foldGutter,
  foldable,
  foldedRanges,
  syntaxHighlighting,
  unfoldEffect,
} from "@codemirror/language";
import { search } from "@codemirror/search";
import { tags as t } from "@lezer/highlight";
import { EditorView } from "@uiw/react-codemirror";
import { lineNumbers, type BlockInfo } from "@codemirror/view";
import type { Extension } from "@codemirror/state";
import type { Theme } from "../types";
import { CHEVRON, createSearchPanel, icon } from "./search-panel";

const surface = {
  "&": {
    backgroundColor: "var(--cosmic)",
    color: "var(--fg)",
  },
  ".cm-content": {
    caretColor: "var(--accent)",
    padding: "16px 0",
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "var(--accent)",
  },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
    backgroundColor: "var(--accent-soft)",
  },
  ".cm-line": {
    padding: "0 16px 0 12px",
  },
  ".cm-gutters": {
    backgroundColor: "var(--cosmic)",
    color: "var(--dim)",
    borderRight: "1px solid var(--line)",
    userSelect: "none",
  },
  ".cm-lineNumbers .cm-gutterElement": {
    padding: "0 4px 0 8px",
    minWidth: "22px",
  },
  ".cm-foldGutter .cm-gutterElement": {
    paddingRight: "6px",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "transparent",
    color: "var(--fg)",
  },
  ".cm-selectionMatch": {
    backgroundColor: "var(--raised)",
  },
  ".cm-searchMatch": {
    backgroundColor: "var(--accent-soft)",
    outline: "1px solid color-mix(in srgb, var(--accent) 45%, transparent)",
  },
  ".cm-searchMatch.cm-searchMatch-selected": {
    backgroundColor: "color-mix(in srgb, var(--accent) 32%, transparent)",
  },
  "&.cm-focused .cm-matchingBracket, &.cm-focused .cm-nonmatchingBracket": {
    backgroundColor: "var(--raised)",
    outline: "none",
  },
  ".cm-panels": {
    backgroundColor: "var(--cosmic)",
    color: "var(--fg)",
  },
  ".cm-panels.cm-panels-top": {
    borderBottom: "1px solid var(--line)",
  },
  ".cm-panels.cm-panels-bottom": {
    borderTop: "1px solid var(--line)",
  },
  ".cm-tooltip": {
    backgroundColor: "var(--cosmic)",
    border: "1px solid var(--line)",
    color: "var(--fg)",
  },
  ".cm-foldPlaceholder": {
    backgroundColor: "var(--raised)",
    border: "none",
    color: "var(--dim)",
  },
};

const lightTheme = EditorView.theme(surface, { dark: false });
const darkTheme = EditorView.theme(surface, { dark: true });

const highlight = syntaxHighlighting(HighlightStyle.define([
  { tag: t.heading, fontWeight: "700", color: "var(--fg)" },
  { tag: t.strong, fontWeight: "700" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strikethrough, textDecoration: "line-through", color: "var(--dim)" },
  { tag: [t.link, t.url], color: "var(--accent)" },
  { tag: [t.processingInstruction, t.contentSeparator, t.labelName, t.comment, t.meta, t.quote], color: "var(--dim)" },
  { tag: [t.keyword, t.operatorKeyword, t.controlKeyword, t.definitionKeyword, t.moduleKeyword, t.modifier, t.bool, t.null, t.atom, t.number, t.tagName, t.attributeName], color: "var(--accent)" },
  { tag: [t.string, t.special(t.string), t.regexp, t.character], color: "color-mix(in srgb, var(--fg) 72%, var(--accent))" },
  { tag: [t.typeName, t.className, t.function(t.variableName), t.function(t.propertyName)], fontWeight: "500" },
  { tag: t.invalid, color: "var(--dim)", textDecoration: "underline wavy" },
]));

const editorThemes: Record<Theme, Extension> = {
  light: [lightTheme, highlight],
  dark: [darkTheme, highlight],
};

export function getEditorTheme(theme: Theme): Extension {
  return editorThemes[theme];
}

function foldMarker(open: boolean) {
  const marker = document.createElement("span");
  marker.className = open ? "cm-fold-marker is-open" : "cm-fold-marker";
  marker.title = open ? "Свернуть" : "Развернуть";
  marker.innerHTML = icon(CHEVRON);
  return marker;
}

function toggleFold(view: EditorView, line: BlockInfo) {
  let folded = null as { from: number; to: number } | null;
  foldedRanges(view.state).between(line.from, line.to, (from, to) => {
    if (!folded || folded.from > from) folded = { from, to };
  });
  if (folded) {
    view.dispatch({ effects: unfoldEffect.of(folded) });
    return true;
  }
  const range = foldable(view.state, line.from, line.to);
  if (!range) return false;
  view.dispatch({ effects: foldEffect.of(range) });
  return true;
}

export const plainEditorExtensions: Extension[] = [
  search({ createPanel: createSearchPanel }),
  lineNumbers({
    domEventHandlers: {
      click: toggleFold,
      mouseover: (view, line, event) => {
        (event.target as HTMLElement).classList.toggle("cm-foldable-line", Boolean(foldable(view.state, line.from, line.to)));
        return false;
      },
    },
  }),
  foldGutter({ markerDOM: foldMarker }),
  EditorView.lineWrapping,
];

export const editorExtensions: Extension[] = [
  markdown({ base: markdownLanguage, codeLanguages: languages }),
  ...plainEditorExtensions,
];

export const editorBasicSetup = { foldGutter: false, lineNumbers: false, highlightActiveLine: false };
