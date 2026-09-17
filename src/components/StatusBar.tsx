import { Fragment, useLayoutEffect, useMemo, useRef, useState } from "react";
import { calculateStats } from "../lib/statistics";
import { plural } from "../lib/plural";
import Icon from "./Icon";

interface StatusBarProps {
  content: string;
  filePath: string | null;
  updateVersion: string | null;
}

function count(n: number, forms: [string, string, string]) {
  return `${n.toLocaleString("ru-RU")} ${plural(n, forms)}`;
}

export default function StatusBar({ content, filePath, updateVersion }: StatusBarProps) {
  const stats = useMemo(() => calculateStats(content), [content]);
  const folders = useMemo(() => filePath?.split(/[\\/]/).filter(Boolean).slice(0, -1) ?? [], [filePath]);
  const pathRef = useRef<HTMLDivElement>(null);
  const [collapse, setCollapse] = useState({ filePath, hidden: 0 });
  const hidden = collapse.filePath === filePath ? collapse.hidden : 0;
  const crumbs = hidden > 0 ? [folders[0], "…", ...folders.slice(hidden + 1)] : folders;
  const counters = [
    count(stats.words, ["слово", "слова", "слов"]),
    count(stats.characters, ["символ", "символа", "символов"]),
    count(stats.lines, ["строка", "строки", "строк"]),
    `~${stats.readingTime} мин`,
  ];

  useLayoutEffect(() => {
    const el = pathRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setCollapse((prev) => ({ ...prev, hidden: 0 })));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const el = pathRef.current;
    if (el && el.scrollWidth > el.clientWidth && hidden < folders.length - 2) {
      setCollapse({ filePath, hidden: hidden + 1 });
    }
  });

  return (
    <div className="flex h-8 shrink-0 select-none items-center justify-between gap-4 whitespace-nowrap px-5 pb-2
      text-xs font-medium tabular-nums text-dim">
      <div ref={pathRef} className="flex min-w-0 flex-1 items-center gap-0.5 overflow-hidden" title={filePath ?? undefined}>
        {crumbs.map((crumb, i) => (
          <Fragment key={i}>
            {i > 0 && <Icon name="chevron" className="h-3 w-3 shrink-0 opacity-60" />}
            <span className={i === crumbs.length - 1 ? "text-fg" : undefined}>{crumb}</span>
          </Fragment>
        ))}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {updateVersion && <span className="mr-2">Версия {updateVersion} установится при закрытии</span>}
        {counters.map((counter) => (
          <span key={counter} className="inline-flex h-6 items-center rounded-full bg-raised px-2.5">
            {counter}
          </span>
        ))}
      </div>
    </div>
  );
}
