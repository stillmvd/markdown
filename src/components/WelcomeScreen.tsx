import type { RecentFile } from "../types";
import { plural } from "../lib/plural";
import Icon, { type IconName } from "./Icon";

interface WelcomeScreenProps {
  recentFiles: RecentFile[];
  onOpen: () => void;
  onOpenFolder: () => void;
  onOpenRecent: (path: string) => void;
}

const SHORTCUTS = [
  ["O", "открыть"],
  ["E", "правка"],
  ["S", "сохранить"],
] as const;

const KBD = "inline-grid h-[22px] min-w-[22px] place-items-center rounded-full bg-raised px-[7px] font-sans text-[11px] font-bold text-fg";

const DAY = 24 * 60 * 60 * 1000;

const MONTHS = ["янв", "февр", "марта", "апр", "мая", "июня", "июля", "авг", "сент", "окт", "нояб", "дек"];

function formatOpenedAt(openedAt: number, now: number) {
  const minutes = Math.floor((now - openedAt) / 60000);
  if (minutes < 1) return "только что";
  if (minutes < 60) return `${minutes} мин назад`;

  const today = new Date(now).setHours(0, 0, 0, 0);
  const day = new Date(openedAt).setHours(0, 0, 0, 0);
  const days = Math.round((today - day) / DAY);
  if (days === 0) return `${Math.floor(minutes / 60)} ч назад`;
  if (days === 1) return "вчера";
  if (days < 7) return `${days} ${plural(days, ["день", "дня", "дней"])} назад`;

  const date = new Date(openedAt);
  const short = `${date.getDate()} ${MONTHS[date.getMonth()]}`;
  return date.getFullYear() === new Date(now).getFullYear() ? short : `${short} ${date.getFullYear()}`;
}

function folderName(path: string) {
  return path.split(/[\\/]/).slice(-2, -1)[0] ?? "";
}

function Tile({ icon, title, text, accent, onClick }: {
  icon: IconName;
  title: string;
  text: string;
  accent?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-start gap-1 rounded-[20px] bg-raised p-4 text-left
        transition duration-200 ease-trail hover:bg-hover-strong active:scale-[.97]
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <span
        className={`mb-2 grid h-10 w-10 place-items-center rounded-full transition-colors duration-200 ease-trail
          ${accent ? "bg-accent text-accent-ink" : "bg-hover-strong group-hover:bg-raised"}`}
      >
        <Icon name={icon} />
      </span>
      <span className="text-[15px] font-bold">{title}</span>
      <span className="text-[13px] leading-[1.35] text-dim">{text}</span>
    </button>
  );
}

export default function WelcomeScreen({ recentFiles, onOpen, onOpenFolder, onOpenRecent }: WelcomeScreenProps) {
  const now = Date.now();

  return (
    <div className="min-w-0 flex-1 px-2 pb-2">
      <div className="welcome-sheet flex h-full flex-col overflow-y-auto rounded-[28px] bg-cosmic">
        <div className="m-auto flex w-[460px] max-w-full flex-col gap-7 px-6 py-8">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,200px))] justify-center gap-2">
            <Tile icon="file" title="Открыть файл" text=".md, .txt или .log с диска" accent onClick={onOpen} />
            <Tile icon="folder" title="Открыть папку" text="Дерево заметок слева" onClick={onOpenFolder} />
          </div>

          {recentFiles.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex min-h-10 items-center pl-3 text-[15px] font-bold">Недавние</div>
              <div className="flex flex-col gap-0.5">
                {recentFiles.map((file) => (
                  <button
                    key={file.path}
                    type="button"
                    className="side-row min-h-10 gap-2.5 hover:bg-hover"
                    onClick={() => onOpenRecent(file.path)}
                    title={file.path}
                  >
                    <Icon name="file" className="h-4 w-4 shrink-0 text-dim" />
                    <span className="truncate text-sm font-medium">{file.name}</span>
                    <span className="min-w-6 truncate text-xs font-medium text-dim [flex-shrink:100]">
                      {folderName(file.path)}
                    </span>
                    <span className="ml-auto shrink-0 pl-2 text-xs font-medium tabular-nums text-dim">
                      {file.openedAt ? formatOpenedAt(file.openedAt, now) : ""}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-center gap-x-4 gap-y-2 px-6 pb-5 text-[13px] text-dim">
          {SHORTCUTS.map(([key, label]) => (
            <span key={key} className="inline-flex items-center gap-[3px]">
              <kbd className={KBD}>Ctrl</kbd>
              <kbd className={KBD}>{key}</kbd>
              <span className="ml-[3px]">{label}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
