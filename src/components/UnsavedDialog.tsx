import { useEffect, useRef } from "react";

interface UnsavedDialogProps {
  fileName: string | null;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}

export default function UnsavedDialog({ fileName, onSave, onDiscard, onCancel }: UnsavedDialogProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const saveRef = useRef<HTMLButtonElement>(null);
  const pressedOnScrim = useRef(false);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    saveRef.current?.focus();
    return () => {
      if (previous?.isConnected) previous.focus();
    };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [onCancel]);

  const keepFocusInside = (e: React.KeyboardEvent) => {
    if (e.key !== "Tab") return;
    const buttons = cardRef.current?.querySelectorAll("button");
    if (!buttons?.length) return;
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-scrim"
      onPointerDown={(e) => {
        pressedOnScrim.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (pressedOnScrim.current && e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        ref={cardRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="unsaved-question"
        onKeyDown={keepFocusInside}
        className="flex w-[400px] max-w-[calc(100%-32px)] flex-col gap-5 rounded-[28px] border border-line bg-cosmic p-6 shadow-surface"
      >
        <p id="unsaved-question" className="m-0 break-words text-[15px] font-medium leading-[1.4] text-fg">
          <span className="mr-2 inline-block h-2 w-2 rounded-full bg-accent align-[0.12em]" aria-hidden="true" />
          {fileName ? (
            <>
              Сохранить изменения в <b className="font-bold">{fileName}</b>?
            </>
          ) : (
            "Сохранить новый файл?"
          )}
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="tb-capsule font-medium text-dim hover:bg-hover-strong hover:text-fg active:scale-[.96]"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className="tb-capsule bg-raised font-medium text-fg hover:bg-hover-strong active:scale-[.96]"
          >
            Не сохранять
          </button>
          <button
            ref={saveRef}
            type="button"
            onClick={onSave}
            className="tb-capsule bg-accent font-bold text-accent-ink hover:bg-accent-hover active:scale-[.96]"
          >
            {fileName ? "Сохранить" : "Сохранить…"}
          </button>
        </div>
      </div>
    </div>
  );
}
