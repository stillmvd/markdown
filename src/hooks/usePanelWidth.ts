import { useCallback, useState } from "react";

export const DEFAULT_PANEL_WIDTH = 256;
const MIN_PANEL_WIDTH = 200;
const MAX_PANEL_WIDTH = 560;

const clamp = (width: number) => Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, Math.round(width)));

function read(key: string) {
  try {
    const saved = Number(localStorage.getItem(key));
    return saved ? clamp(saved) : DEFAULT_PANEL_WIDTH;
  } catch {
    return DEFAULT_PANEL_WIDTH;
  }
}

function persist(key: string, width: number) {
  try {
    localStorage.setItem(key, String(width));
  } catch {
    // ignore
  }
}

export function usePanelWidth(storageKey: string) {
  const [width, setWidth] = useState(() => read(storageKey));
  const [resizing, setResizing] = useState(false);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = e.currentTarget.parentElement?.offsetWidth ?? DEFAULT_PANEL_WIDTH;
    let next = startWidth;
    setResizing(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const move = (ev: MouseEvent) => {
      next = clamp(startWidth + ev.clientX - startX);
      setWidth(next);
    };
    const up = () => {
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", up);
      setResizing(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      persist(storageKey, next);
    };

    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", up);
  }, [storageKey]);

  const onDoubleClick = useCallback(() => {
    setWidth(DEFAULT_PANEL_WIDTH);
    persist(storageKey, DEFAULT_PANEL_WIDTH);
  }, [storageKey]);

  return { width, resizing, onMouseDown, onDoubleClick };
}
