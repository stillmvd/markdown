import type { MutableRefObject } from "react";

export interface ScrollSync {
  read: (() => number | null) | null;
  line: number | null;
}

export type ScrollSyncRef = MutableRefObject<ScrollSync>;

type HastNode = {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  position?: { start: { line: number } };
  children?: HastNode[];
};

const BLOCKS = new Set(["p", "h1", "h2", "h3", "h4", "h5", "h6", "li", "pre", "blockquote", "table", "tr", "hr", "img", "div", "details"]);

export function rehypeSourceLines(offset: number) {
  return () => (tree: HastNode) => {
    const walk = (node: HastNode) => {
      if (node.type === "element" && node.tagName && BLOCKS.has(node.tagName) && node.position) {
        node.properties = { ...node.properties, dataLine: node.position.start.line + offset };
      }
      node.children?.forEach(walk);
    };
    walk(tree);
  };
}

function marks(sheet: HTMLElement) {
  return [...sheet.querySelectorAll<HTMLElement>("[data-line]")]
    .map((el) => ({ el, line: Number(el.dataset.line), rect: el.getBoundingClientRect() }))
    .filter((m) => m.rect.height > 0 && Number.isFinite(m.line));
}

function nextLine(list: ReturnType<typeof marks>, i: number) {
  for (let j = i + 1; j < list.length; j++) if (list[j].line > list[i].line) return list[j].line;
  return list[i].line + 1;
}

export function viewerTopLine(sheet: HTMLElement, totalLines: number): number {
  if (sheet.scrollTop <= 0) return 1;
  const list = marks(sheet);
  if (!list.length) {
    const room = sheet.scrollHeight - sheet.clientHeight;
    return room > 0 ? 1 + Math.round((sheet.scrollTop / room) * (totalLines - 1)) : 1;
  }
  const top = sheet.getBoundingClientRect().top;
  let i = -1;
  list.forEach((m, k) => {
    if (m.rect.top <= top + 2) i = k;
  });
  if (i < 0) return list[0].line;
  const m = list[i];
  const span = nextLine(list, i) - m.line;
  const frac = Math.min(1, Math.max(0, (top - m.rect.top) / m.rect.height));
  return m.line + Math.floor(frac * span);
}

export function scrollViewerToLine(sheet: HTMLElement, line: number, totalLines: number) {
  if (line <= 1) {
    sheet.scrollTop = 0;
    return;
  }
  const list = marks(sheet);
  if (!list.length) {
    sheet.scrollTop = ((line - 1) / Math.max(1, totalLines - 1)) * (sheet.scrollHeight - sheet.clientHeight);
    return;
  }
  let i = 0;
  list.forEach((m, k) => {
    if (m.line <= line) i = k;
  });
  const m = list[i];
  const span = nextLine(list, i) - m.line;
  const frac = m.line > line ? 0 : Math.min(1, (line - m.line) / span);
  sheet.scrollTop += m.rect.top + frac * m.rect.height - sheet.getBoundingClientRect().top;
}
