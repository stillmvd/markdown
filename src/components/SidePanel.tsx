import type { ReactNode } from "react";
import { usePanelWidth } from "../hooks/usePanelWidth";
import Icon, { type IconName } from "./Icon";

interface SidePanelProps {
  icon: IconName;
  title: string;
  closeLabel: string;
  storageKey: string;
  actions?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}

export function SidePanelEmpty({ icon, title, text }: { icon: IconName; title: string; text: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-1.5 px-6 pb-16 pt-6 text-center">
      <span className="mb-2 grid h-12 w-12 place-items-center rounded-full bg-raised text-dim">
        <Icon name={icon} />
      </span>
      <span className="text-[15px] font-bold">{title}</span>
      <span className="max-w-[26ch] text-[13px] text-dim [text-wrap:balance]">{text}</span>
    </div>
  );
}

export default function SidePanel({ icon, title, closeLabel, storageKey, actions, onClose, children }: SidePanelProps) {
  const { width, resizing, onMouseDown, onDoubleClick } = usePanelWidth(storageKey);

  return (
    <div style={{ width }} className="relative mb-2 ml-2 flex shrink-0">
      <aside className="flex w-full flex-col overflow-hidden rounded-[28px] bg-cosmic">
        <div className="flex min-h-12 shrink-0 items-center gap-2 pb-1 pl-3 pr-2 pt-2">
          <span
            className="inline-flex h-7 min-w-0 items-center gap-1.5 rounded-full bg-raised pl-2.5 pr-3 text-xs font-medium text-dim"
            title={title}
          >
            <Icon name={icon} className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{title}</span>
          </span>
          <span className="ml-auto flex shrink-0 items-center">{actions}</span>
          <button
            type="button"
            onClick={onClose}
            title={closeLabel}
            aria-label={closeLabel}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-dim
              transition duration-200 ease-trail hover:bg-hover-strong hover:text-fg active:scale-[.96]
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Icon name="close" />
          </button>
        </div>
        {children}
      </aside>
      <div
        role="separator"
        aria-orientation="vertical"
        data-active={resizing}
        title="Потяните, чтобы изменить ширину. Двойной клик — по умолчанию"
        onMouseDown={onMouseDown}
        onDoubleClick={onDoubleClick}
        className="group absolute inset-y-0 right-0 z-20 flex w-3 translate-x-[calc(50%+4px)] cursor-col-resize items-center justify-center"
      >
        <span
          className="absolute left-1/2 top-1/2 h-2/5 w-[2px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent opacity-0
            transition-opacity duration-200 ease-trail group-hover:opacity-100 group-data-[active=true]:opacity-100"
        />
        <span
          className="relative grid h-7 w-[22px] scale-75 place-items-center rounded-full bg-accent text-accent-ink opacity-0
            transition duration-200 ease-trail group-hover:scale-100 group-hover:opacity-100
            group-data-[active=true]:scale-100 group-data-[active=true]:opacity-100"
        >
          <span className="flex items-center">
            <Icon
              name="chevron"
              className="h-[11px] w-[11px] rotate-180 transition-transform duration-200 ease-trail group-hover:-translate-x-[1px]"
            />
            <Icon
              name="chevron"
              className="-ml-[2px] h-[11px] w-[11px] transition-transform duration-200 ease-trail group-hover:translate-x-[1px]"
            />
          </span>
        </span>
      </div>
    </div>
  );
}
