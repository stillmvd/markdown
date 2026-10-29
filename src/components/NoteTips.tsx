import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import type { DiffFile } from "../lib/diff";
import { noteHtml, type PlacedNote } from "../lib/changes";
import type { FileDecor } from "./JournalDiff";
import Icon from "./Icon";

const OPEN_DELAY = 150;
const SWITCH_DELAY = 350;
const CLOSE_DELAY = 300;

const lineSpan = (file: DiffFile, p: PlacedNote) => {
  const lines = file.hunks[p.hunk].lines.slice(p.start, p.last + 1).map((l) => l.new).filter((n): n is number => n !== undefined);
  const name = file.path.slice(file.path.lastIndexOf("/") + 1);
  if (!lines.length) return name;
  const [a, b] = [lines[0], lines[lines.length - 1]];
  return `${name}:${a === b ? a : `${a}–${b}`}`;
};

export function useNoteTips({ placed, files, listRef, scrollRef }: {
  placed: PlacedNote[];
  files: DiffFile[];
  listRef: RefObject<HTMLDivElement | null>;
  scrollRef: RefObject<HTMLDivElement | null>;
}) {
  const [hot, setHot] = useState<string | null>(null);
  const [pinned, setPinned] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const tipRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number>(undefined);
  const openTimer = useRef<number>(undefined);
  const quiet = useRef(false);
  const current = placed.find((p) => p.note.id === hot) ?? null;

  const close = useCallback(() => {
    clearTimeout(timer.current);
    setHot(null);
    setPinned(false);
    setCodeOpen(false);
  }, []);

  const openNote = (id: string, now = false) => {
    clearTimeout(openTimer.current);
    if (hot === id) return;
    if (pinned && !now) return;
    const go = () => {
      clearTimeout(timer.current);
      setPinned(false);
      setCodeOpen(false);
      setHot(id);
    };
    if (now) go();
    else openTimer.current = window.setTimeout(go, hot ? SWITCH_DELAY : OPEN_DELAY);
  };

  useEffect(() => () => {
    clearTimeout(timer.current);
    clearTimeout(openTimer.current);
  }, []);

  useEffect(() => {
    if (!hot || pinned) return;
    const near = (x: number, y: number) => {
      const mark = listRef.current?.querySelector<HTMLElement>(`[data-ch-mark="${CSS.escape(hot)}"]`)?.getBoundingClientRect();
      const tip = tipRef.current?.getBoundingClientRect();
      if (!mark || !tip) return false;
      const pad = 12;
      return x >= Math.min(mark.left, tip.left) - pad && x <= Math.max(mark.right, tip.right) + pad
        && y >= Math.min(mark.top, tip.top) - pad && y <= Math.max(mark.bottom, tip.bottom) + pad;
    };
    const onMove = (e: PointerEvent) => {
      if (near(e.clientX, e.clientY)) {
        clearTimeout(timer.current);
        timer.current = undefined;
      } else if (timer.current === undefined) {
        timer.current = window.setTimeout(() => {
          timer.current = undefined;
          close();
        }, CLOSE_DELAY);
      }
    };
    window.addEventListener("pointermove", onMove);
    return () => {
      window.removeEventListener("pointermove", onMove);
      clearTimeout(timer.current);
      timer.current = undefined;
    };
  }, [hot, pinned, close, listRef]);

  useEffect(() => {
    if (hot && !current) close();
  }, [hot, current, close]);

  useEffect(() => {
    if (!hot) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element;
      if (!tipRef.current?.contains(t) && !t.closest?.("[data-ch-mark]")) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      const mark = listRef.current?.querySelector<HTMLElement>(`[data-ch-mark="${CSS.escape(hot)}"]`);
      close();
      quiet.current = true;
      mark?.focus();
      quiet.current = false;
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [hot, close, listRef]);

  const placeTip = useCallback(() => {
    const tip = tipRef.current;
    const wrap = listRef.current;
    const scroller = scrollRef.current;
    if (!tip || !wrap || !scroller || !hot) return;
    const mark = wrap.querySelector<HTMLElement>(`[data-ch-mark="${CSS.escape(hot)}"]`);
    const end = wrap.querySelector<HTMLElement>(`[data-ch-end="${CSS.escape(hot)}"]`)?.parentElement;
    if (!mark || !end) return;
    const w = wrap.getBoundingClientRect();
    const port = scroller.getBoundingClientRect();
    const m = mark.getBoundingClientRect();
    const startRow = (mark.parentElement ?? mark).getBoundingClientRect();
    const endRow = end.getBoundingClientRect();
    const below = port.bottom - endRow.bottom - 16;
    const above = startRow.top - port.top - 16;
    tip.style.maxHeight = "420px";
    const full = tip.offsetHeight;
    const down = full <= below || (full > above && below >= above);
    tip.style.maxHeight = `${Math.max(160, Math.min(420, down ? below : above))}px`;
    const h = tip.offsetHeight;
    const raw = down ? endRow.bottom + 8 : startRow.top - 8 - h;
    const top = Math.min(Math.max(raw, port.top + 8), port.bottom - 8 - h) - w.top;
    const left = Math.min(Math.max(8, m.right - w.left - tip.offsetWidth), w.width - tip.offsetWidth - 8);
    tip.style.top = `${top}px`;
    tip.style.left = `${left}px`;
  }, [hot, listRef, scrollRef]);

  useLayoutEffect(placeTip, [placeTip, codeOpen, placed, files]);

  useEffect(() => {
    if (!hot) return;
    window.addEventListener("resize", placeTip);
    return () => window.removeEventListener("resize", placeTip);
  }, [hot, placeTip]);

  const decorFor = (fileIndex: number): FileDecor | undefined => {
    const mine = placed.filter((p) => p.file === fileIndex);
    if (!mine.length) return undefined;
    return {
      rowClass: (h, i) => (current && current.file === fileIndex && current.hunk === h && i >= current.first && i <= current.last ? "ch-hot" : ""),
      extra: (h, i) => {
        const marks = mine.filter((p) => p.hunk === h && p.start === i);
        const end = current && current.file === fileIndex && current.hunk === h && current.last === i;
        if (!marks.length && !end) return null;
        return (
          <>
            {marks.map((p) => (
              <button
                key={p.note.id}
                type="button"
                data-ch-mark={p.note.id}
                aria-expanded={hot === p.note.id}
                aria-controls={hot === p.note.id ? "ch-tip" : undefined}
                onMouseEnter={() => openNote(p.note.id)}
                onMouseLeave={() => clearTimeout(openTimer.current)}
                onFocus={() => {
                  if (!quiet.current) openNote(p.note.id, true);
                }}
                onClick={() => {
                  if (pinned && hot === p.note.id) close();
                  else {
                    clearTimeout(timer.current);
                    clearTimeout(openTimer.current);
                    if (hot !== p.note.id) setCodeOpen(false);
                    setHot(p.note.id);
                    setPinned(true);
                  }
                }}
                className={`ch-mk ${hot === p.note.id ? "is-hot" : ""}`}
              >
                <b>{p.no}</b>
                <span>{p.note.title}</span>
              </button>
            ))}
            {end && <span data-ch-end={current.note.id} hidden />}
          </>
        );
      },
    };
  };

  const tip = current && files[current.file] ? (
    <div
      ref={tipRef}
      id="ch-tip"
      role="dialog"
      aria-label={current.note.title}
      onMouseEnter={() => clearTimeout(openTimer.current)}
      className="ch-tip"
    >
      <div className="ch-tiph">
        <i>{current.no}</i>
        <b>{current.note.title}</b>
        {current.stale && <span className="ch-stale">Устарело</span>}
      </div>
      <div className="ch-tips">
        {current.stale && <div className="ch-stline">Код изменился после пояснения</div>}
        <div className="ch-md" dangerouslySetInnerHTML={{ __html: noteHtml(current.note.plain) }} />
        {codeOpen && <div className="ch-md ch-mdc" dangerouslySetInnerHTML={{ __html: noteHtml(current.note.code) }} />}
      </div>
      <div className="ch-tipf">
        <button
          type="button"
          aria-expanded={codeOpen}
          onClick={() => {
            setCodeOpen((v) => !v);
            setPinned(true);
          }}
          className={`ch-btn ${codeOpen ? "is-on" : ""}`}
        >
          <Icon name="code" className="h-3.5 w-3.5 text-dim" />
          {codeOpen ? "Скрыть код" : "Код"}
          <Icon name="chevron" className={`h-3.5 w-3.5 text-dim ${codeOpen ? "-rotate-90" : "rotate-90"}`} />
        </button>
        <span className="ch-loc">{lineSpan(files[current.file], current)}</span>
      </div>
    </div>
  ) : null;

  return { decorFor, tip, close, openFile: current?.file ?? null };
}
