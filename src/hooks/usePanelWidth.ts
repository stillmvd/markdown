import { useCallback, useState } from "react";

export const DEFAULT_PANEL_WIDTH = 256;
const MIN_PANEL_WIDTH = 200;
const MAX_PANEL_WIDTH = 560;

export type PanelSide = "left" | "right";

const clamp = (width: number) => Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, Math.round(width)));

function read(key: string, fallback: number) {
  try {
    const saved = Number(localStorage.getItem(key));
    return saved ? clamp(saved) : fallback;
  } catch {
    return fallback;
  }
}

function persist(key: string, width: number) {
  try {
    localStorage.setItem(key, String(width));
  } catch {
    // ignore
  }
}

export function usePanelWidth(storageKey: string, side: PanelSide = "left", fallback = DEFAULT_PANEL_WIDTH) {
  const [width, setWidth] = useState(() => read(storageKey, fallback));
  const [resizing, setResizing] = useState(false);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = e.currentTarget.parentElement?.offsetWidth ?? fallback;
    const sign = side === "left" ? 1 : -1;
    let next = startWidth;
    setResizing(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const move = (ev: MouseEvent) => {
      next = clamp(startWidth + sign * (ev.clientX - startX));
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
  }, [storageKey, side, fallback]);

  const onDoubleClick = useCallback(() => {
    setWidth(fallback);
    persist(storageKey, fallback);
  }, [storageKey, fallback]);

  return { width, resizing, onMouseDown, onDoubleClick };
}
