import type { ReactNode } from "react";
import Icon, { type IconName } from "./Icon";

interface SidePanelProps {
  icon: IconName;
  title: string;
  closeLabel: string;
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

export default function SidePanel({ icon, title, closeLabel, onClose, children }: SidePanelProps) {
  return (
    <aside className="mb-2 ml-2 flex w-64 shrink-0 flex-col overflow-hidden rounded-[28px] bg-cosmic">
      <div className="flex min-h-12 shrink-0 items-center gap-2 pb-1 pl-3 pr-2 pt-2">
        <span
          className="inline-flex h-7 min-w-0 items-center gap-1.5 rounded-full bg-raised pl-2.5 pr-3 text-xs font-medium text-dim"
          title={title}
        >
          <Icon name={icon} className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{title}</span>
        </span>
        <button
          type="button"
          onClick={onClose}
          title={closeLabel}
          aria-label={closeLabel}
          className="ml-auto grid h-8 w-8 shrink-0 place-items-center rounded-full text-dim
            transition duration-200 ease-trail hover:bg-hover-strong hover:text-fg active:scale-[.96]
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Icon name="close" />
        </button>
      </div>
      {children}
    </aside>
  );
}
