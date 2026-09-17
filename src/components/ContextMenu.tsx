import { useEffect, useLayoutEffect, useRef, useState } from "react";
import CodeLanguagePicker from "./CodeLanguagePicker";
import Icon, { type IconName } from "./Icon";

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onFormat: (before: string, after: string) => void;
  onLinePrefix: (prefix: string) => void;
  onCodeBlock: (lang: string) => void;
}

interface MenuItem {
  label: string;
  icon: IconName;
  action: () => void;
}

const EDGE = 8;
const SUBMENU_GAP = 4;
const SUBMENU_CLOSE_DELAY = 200;
const HEADING_SIZES = ["text-[22px]", "text-[19px]", "text-[17px]", "text-[15px]", "text-sm", "text-[13px] text-dim"];

const clamp = (value: number, max: number) => Math.max(EDGE, Math.min(value, max));

export default function ContextMenu({
  x,
  y,
  onClose,
  onFormat,
  onLinePrefix,
  onCodeBlock,
}: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLButtonElement>(null);
  const submenuRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef(0);
  const [showHeadings, setShowHeadings] = useState(false);
  const [showCodePicker, setShowCodePicker] = useState(false);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  useLayoutEffect(() => {
    const menu = ref.current;
    if (!menu) return;
    menu.style.left = `${clamp(x, window.innerWidth - menu.offsetWidth - EDGE)}px`;
    menu.style.top = `${clamp(y, window.innerHeight - menu.offsetHeight - EDGE)}px`;
  }, [x, y, showCodePicker]);

  useLayoutEffect(() => {
    const menu = ref.current;
    const heading = headingRef.current;
    const submenu = submenuRef.current;
    if (!showHeadings || !menu || !heading || !submenu) return;
    const menuRect = menu.getBoundingClientRect();
    const inset = submenu.clientTop + parseFloat(getComputedStyle(submenu).paddingTop);
    const right = menuRect.right + SUBMENU_GAP;
    const left =
      right + submenu.offsetWidth <= window.innerWidth - EDGE
        ? right
        : menuRect.left - SUBMENU_GAP - submenu.offsetWidth;
    submenu.style.left = `${Math.max(EDGE, left)}px`;
    submenu.style.top = `${clamp(
      heading.getBoundingClientRect().top - inset,
      window.innerHeight - submenu.offsetHeight - EDGE,
    )}px`;
  }, [x, y, showHeadings]);

  const openHeadings = () => {
    window.clearTimeout(closeTimer.current);
    setShowHeadings(true);
  };

  const closeHeadingsSoon = () => {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setShowHeadings(false), SUBMENU_CLOSE_DELAY);
  };

  const inlineItems: MenuItem[] = [
    { label: "Жирный", icon: "bold", action: () => onFormat("**", "**") },
    { label: "Курсив", icon: "italic", action: () => onFormat("*", "*") },
    { label: "Зачёркнутый", icon: "strike", action: () => onFormat("~~", "~~") },
    { label: "Код", icon: "code", action: () => onFormat("`", "`") },
    { label: "Ссылка", icon: "link", action: () => onFormat("[", "](url)") },
  ];

  const blockItems: MenuItem[] = [
    { label: "Цитата", icon: "quote", action: () => onLinePrefix("> ") },
    { label: "Список", icon: "list", action: () => onLinePrefix("- ") },
    { label: "Нумерованный", icon: "numbered", action: () => onLinePrefix("1. ") },
    { label: "Блок кода", icon: "codeBlock", action: () => setShowCodePicker(true) },
  ];

  return (
    <div ref={ref} className="menu-card fixed z-50">
      {showCodePicker ? (
        <CodeLanguagePicker onSelect={onCodeBlock} onBack={() => setShowCodePicker(false)} />
      ) : (
        <>
          <div className="tb-group mb-1 justify-between">
            {inlineItems.map((item) => (
              <button
                key={item.label}
                type="button"
                className="tb-dot"
                title={item.label}
                aria-label={item.label}
                onMouseEnter={closeHeadingsSoon}
                onClick={item.action}
              >
                <Icon name={item.icon} />
              </button>
            ))}
          </div>

          <button
            ref={headingRef}
            type="button"
            className={`menu-row ${showHeadings ? "bg-hover-strong" : ""}`}
            aria-haspopup="true"
            aria-expanded={showHeadings}
            onMouseEnter={openHeadings}
            onClick={openHeadings}
          >
            <Icon name="heading" className="h-4 w-4 text-dim" />
            Заголовок
            <Icon name="chevron" className="ml-auto h-4 w-4 text-dim" />
          </button>

          {showHeadings && (
            <div ref={submenuRef} className="menu-card fixed w-[196px]" onMouseEnter={openHeadings}>
              {HEADING_SIZES.map((size, index) => (
                <button
                  key={size}
                  type="button"
                  className={`menu-row font-bold leading-[1.15] ${size}`}
                  onClick={() => onLinePrefix("#".repeat(index + 1) + " ")}
                >
                  Заголовок {index + 1}
                </button>
              ))}
            </div>
          )}

          {blockItems.map((item) => (
            <button
              key={item.label}
              type="button"
              className="menu-row"
              onMouseEnter={closeHeadingsSoon}
              onClick={item.action}
            >
              <Icon name={item.icon} className="h-4 w-4 text-dim" />
              {item.label}
            </button>
          ))}
        </>
      )}
    </div>
  );
}
