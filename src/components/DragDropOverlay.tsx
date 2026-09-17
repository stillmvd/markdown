import Icon from "./Icon";

export type DragState = "text" | "other" | null;

export default function DragDropOverlay({ state }: { state: DragState }) {
  if (!state) return null;
  const isText = state === "text";

  return (
    <div
      className={`pointer-events-none absolute inset-x-2 bottom-2 top-0 z-40 grid place-items-center rounded-[28px] border-2 border-dashed bg-scrim p-4 ${
        isText ? "border-accent" : "border-dim"
      }`}
    >
      <div className="flex max-w-[320px] flex-col items-center gap-3 text-center">
        <span
          className={`grid h-16 w-16 place-items-center rounded-full ${
            isText ? "bg-accent text-accent-ink" : "bg-raised text-dim"
          }`}
        >
          <Icon name="file" className="h-6 w-6" />
        </span>
        <div className="flex flex-col items-center gap-0.5">
          <p className="m-0 text-lg font-bold leading-[1.25] text-fg">
            {isText ? "Отпустите, чтобы открыть" : "Это не текстовый документ"}
          </p>
          {!isText && <p className="m-0 text-sm text-dim">Откроются Markdown (.md) и текст (.txt, .log)</p>}
        </div>
      </div>
    </div>
  );
}
