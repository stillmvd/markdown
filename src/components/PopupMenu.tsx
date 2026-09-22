import { useEffect, useLayoutEffect, useRef } from "react";
import Icon, { type IconName } from "./Icon";

export interface MenuAction {
  label: string;
  icon: IconName;
  action: () => void;
}

interface PopupMenuProps {
  x: number;
  y: number;
  items: MenuAction[];
  onClose: () => void;
}

const EDGE = 8;

const clamp = (value: number, max: number) => Math.max(EDGE, Math.min(value, max));

export default function PopupMenu({ x, y, items, onClose }: PopupMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  useLayoutEffect(() => {
    const menu = ref.current;
    if (!menu) return;
    menu.style.left = `${clamp(x, window.innerWidth - menu.offsetWidth - EDGE)}px`;
    menu.style.top = `${clamp(y, window.innerHeight - menu.offsetHeight - EDGE)}px`;
  }, [x, y, items.length]);

  return (
    <div ref={ref} className="menu-card fixed z-50">
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          className="menu-row"
          onClick={() => {
            item.action();
            onClose();
          }}
        >
          <Icon name={item.icon} className="h-4 w-4 text-dim" />
          {item.label}
        </button>
      ))}
    </div>
  );
}
