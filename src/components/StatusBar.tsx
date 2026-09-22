import { Fragment, useLayoutEffect, useMemo, useRef, useState } from "react";
import { calculateStats } from "../lib/statistics";
import { plural } from "../lib/plural";
import Icon from "./Icon";

interface StatusBarProps {
  content: string;
  filePath: string | null;
  updateVersion: string | null;
  onOpenFolder: (path: string) => void;
}

interface Crumb {
  name: string;
  path: string | null;
}

function count(n: number, forms: [string, string, string]) {
  return `${n.toLocaleString("ru-RU")} ${plural(n, forms)}`;
}

function buildCrumbs(filePath: string | null): Crumb[] {
  if (!filePath) return [];
  const separator = filePath.includes("\\") ? "\\" : "/";
  const parts = filePath.split(/[\\/]/).slice(0, -1);
  return parts.flatMap((name, i) => {
    if (!name) return [];
    const joined = parts.slice(0, i + 1).join(separator);
    return [{ name, path: name.endsWith(":") ? joined + separator : joined || separator }];
  });
}

export default function StatusBar({ content, filePath, updateVersion, onOpenFolder }: StatusBarProps) {
  const stats = useMemo(() => calculateStats(content), [content]);
  const fullPath = useMemo(() => buildCrumbs(filePath), [filePath]);
  const [pinned, setPinned] = useState({ filePath, path: "" });
  const pinnedIndex = pinned.filePath === filePath
    ? fullPath.findIndex((crumb) => crumb.path === pinned.path)
    : -1;
  const folders = pinnedIndex >= 0 ? fullPath.slice(0, pinnedIndex + 1) : fullPath;
  const pathRef = useRef<HTMLDivElement>(null);
  const [collapse, setCollapse] = useState({ filePath, hidden: 0 });
  const hidden = collapse.filePath === filePath ? collapse.hidden : 0;
  const crumbs: Crumb[] = hidden > 0
    ? [folders[0], { name: "…", path: null }, ...folders.slice(hidden + 1)]
    : folders;
  const counters = [
    count(stats.words, ["слово", "слова", "слов"]),
    count(stats.characters, ["символ", "символа", "символов"]),
    count(stats.lines, ["строка", "строки", "строк"]),
    `~${stats.readingTime} мин`,
  ];

  const openFolder = (path: string) => {
    setPinned({ filePath, path });
    onOpenFolder(path);
  };

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
            {crumb.path === null ? (
              <span>{crumb.name}</span>
            ) : (
              <button
                type="button"
                onClick={() => openFolder(crumb.path as string)}
                title={`Открыть «${crumb.name}» в боковой панели`}
                className={`rounded-full px-1.5 py-0.5 transition duration-200 ease-trail
                  hover:bg-hover-strong hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                  ${i === crumbs.length - 1
                    ? pinnedIndex >= 0 ? "bg-raised text-fg" : "text-fg"
                    : ""}`}
              >
                {crumb.name}
              </button>
            )}
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
