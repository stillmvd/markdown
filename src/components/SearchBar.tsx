import { useEffect, useState, type RefObject } from "react";
import Icon from "./Icon";

interface SearchBarProps {
  sheetRef: RefObject<HTMLDivElement | null>;
  content: string;
  onClose: () => void;
}

export const SEARCH_INPUT_ID = "doc-search";

const SUPPORTS_HIGHLIGHTS = typeof CSS !== "undefined" && "highlights" in CSS;
const VIEW_MARGIN = 40;
const NOT_SEARCHED = ".codeblock-lang";

function findRanges(root: HTMLElement, query: string) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) =>
      node.parentElement?.closest(NOT_SEARCHED) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  });
  const nodes: Node[] = [];
  const starts: number[] = [];
  let text = "";
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    nodes.push(node);
    starts.push(text.length);
    text += node.nodeValue ?? "";
  }

  let current = 0;
  const locate = (offset: number) => {
    while (current + 1 < nodes.length && starts[current + 1] <= offset) current += 1;
    return [nodes[current], offset - starts[current]] as const;
  };

  const haystack = text.toLowerCase();
  const needle = query.toLowerCase();
  const ranges: Range[] = [];
  for (let at = haystack.indexOf(needle); at >= 0; at = haystack.indexOf(needle, at + needle.length)) {
    const range = document.createRange();
    range.setStart(...locate(at));
    range.setEnd(...locate(at + needle.length));
    ranges.push(range);
  }
  return ranges;
}

function reveal(sheet: HTMLElement, range: Range) {
  const hiddenBody = range.startContainer.parentElement?.closest<HTMLElement>(".doc-section-body[hidden]");
  hiddenBody?.parentElement?.querySelector<HTMLElement>(".doc-section-head")?.click();

  requestAnimationFrame(() => {
    const rect = range.getBoundingClientRect();
    const view = sheet.getBoundingClientRect();
    if (rect.top >= view.top + VIEW_MARGIN && rect.bottom <= view.bottom - VIEW_MARGIN) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    sheet.scrollTo({
      top: sheet.scrollTop + rect.top - view.top - (sheet.clientHeight - rect.height) / 2,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  });
}

export default function SearchBar({ sheetRef, content, onClose }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [ranges, setRanges] = useState<Range[]>([]);
  const [index, setIndex] = useState(0);
  const [jumps, setJumps] = useState(0);

  useEffect(() => {
    const root = sheetRef.current;
    setRanges(root && query ? findRanges(root, query) : []);
    setIndex(0);
  }, [query, content, sheetRef]);

  useEffect(() => {
    const current = ranges[index];
    const sheet = sheetRef.current;
    if (current && sheet) reveal(sheet, current);
    if (!SUPPORTS_HIGHLIGHTS) return;

    const all = new Highlight();
    ranges.forEach((range) => all.add(range));
    CSS.highlights.set("search", all);
    if (current) {
      const highlight = new Highlight(current);
      highlight.priority = 1;
      CSS.highlights.set("search-current", highlight);
    }
    return () => {
      CSS.highlights.delete("search");
      CSS.highlights.delete("search-current");
    };
  }, [ranges, index, jumps, sheetRef]);

  const step = (delta: number) => {
    if (ranges.length === 0) return;
    setIndex((current) => (current + delta + ranges.length) % ranges.length);
    setJumps((count) => count + 1);
  };

  return (
    <div
      className="doc-search flex shrink-0 items-center gap-1.5 border-t border-line pb-3 pl-4 pr-3 pt-2"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }
      }}
    >
      <input
        id={SEARCH_INPUT_ID}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            step(e.shiftKey ? -1 : 1);
          }
        }}
        placeholder="Найти"
        aria-label="Найти в документе"
        className="cm-search-field"
      />
      {query && (
        <span
          className="inline-flex h-6 shrink-0 items-center whitespace-nowrap rounded-full bg-raised px-2.5 text-xs font-medium tabular-nums text-dim"
          aria-live="polite"
        >
          {ranges.length ? `${index + 1} из ${ranges.length}` : "нет"}
        </span>
      )}
      <div className="tb-group" role="group" aria-label="Совпадения">
        <button type="button" onClick={() => step(-1)} className="tb-dot" title="Предыдущее (Shift+Enter)" aria-label="Предыдущее">
          <Icon name="chevron" className="h-4 w-4 -rotate-90" />
        </button>
        <button type="button" onClick={() => step(1)} className="tb-dot" title="Следующее (Enter)" aria-label="Следующее">
          <Icon name="chevron" className="h-4 w-4 rotate-90" />
        </button>
      </div>
      <button type="button" onClick={onClose} className="cm-search-icon" title="Закрыть (Escape)" aria-label="Закрыть поиск">
        <Icon name="close" />
      </button>
    </div>
  );
}
