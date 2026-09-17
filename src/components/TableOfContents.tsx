import { useLayoutEffect, useState, type RefObject } from "react";
import SidePanel, { SidePanelEmpty } from "./SidePanel";

interface TocItem {
  level: number;
  title: string;
  el: HTMLElement;
}

interface TableOfContentsProps {
  content: string;
  sheetRef: RefObject<HTMLDivElement | null>;
  onClose: () => void;
}

const SPY_OFFSET = 56;

export default function TableOfContents({ content, sheetRef, onClose }: TableOfContentsProps) {
  const [items, setItems] = useState<TocItem[]>([]);
  const [active, setActive] = useState(-1);

  useLayoutEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet) return;

    const found = Array.from(
      sheet.querySelectorAll<HTMLElement>(".markdown-body :is(h1, h2, h3, h4, h5, h6)"),
      (el) => ({ level: Number(el.tagName[1]), title: el.textContent ?? "", el }),
    );
    setItems(found);

    const update = () => {
      const edge = sheet.getBoundingClientRect().top + SPY_OFFSET;
      const atEnd = sheet.scrollTop > 0 && sheet.scrollTop + sheet.clientHeight >= sheet.scrollHeight - 1;
      setActive(
        atEnd
          ? found.length - 1
          : found.reduce((last, item, i) => (item.el.getBoundingClientRect().top <= edge ? i : last), -1),
      );
    };
    update();
    sheet.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(sheet);
    if (sheet.firstElementChild) observer.observe(sheet.firstElementChild);
    return () => {
      sheet.removeEventListener("scroll", update);
      observer.disconnect();
    };
  }, [content, sheetRef]);

  const hideTitle = items.length > 1 && items.filter((item) => item.level === 1).length === 1;
  const visible = items
    .map((item, index) => ({ ...item, index }))
    .filter((item) => !(hideTitle && item.level === 1));
  const chapter = Math.min(...visible.map((item) => item.level));

  return (
    <SidePanel icon="toc" title="Оглавление" closeLabel="Закрыть оглавление" onClose={onClose}>
      {visible.length === 0 ? (
        <SidePanelEmpty icon="toc" title="Заголовков нет" text="Оглавление собирается из строк, которые начинаются с #" />
      ) : (
        <nav className="side-list gap-0.5" aria-label="Оглавление">
          {visible.map((item) => {
            const isActive = item.index === active;
            const isChapter = item.level === chapter;
            const shape = isChapter ? "min-h-9 text-[15px] font-bold" : "toc-sub ml-5 min-h-7 text-[13px] font-medium";
            const state = isActive ? "bg-hover-strong text-fg shadow-press" : `hover:bg-hover ${isChapter ? "" : "text-dim"}`;
            return (
              <button
                key={item.index}
                type="button"
                className={`side-row ${shape} ${state}`}
                style={isChapter ? undefined : { paddingLeft: 12 + (item.level - chapter - 1) * 14 }}
                title={item.title}
                aria-current={isActive ? "location" : undefined}
                onClick={() => item.el.scrollIntoView({ behavior: "smooth", block: "start" })}
              >
                <span className="truncate">{item.title}</span>
              </button>
            );
          })}
        </nav>
      )}
    </SidePanel>
  );
}
