import { createContext, useCallback, useContext, useRef, useState } from "react";
import Icon from "./Icon";

export type ToastTone = "ok" | "error";

interface ToastItem {
  id: number;
  text: string;
  tone: ToastTone;
  leaving: boolean;
}

type ShowToast = (text: string, tone?: ToastTone) => void;

const ToastContext = createContext<ShowToast>(() => {});

export const useToast = () => useContext(ToastContext);

export function useCopy() {
  const toast = useToast();
  return useCallback((text: string, message: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => toast(message))
      .catch(() => toast("Не удалось скопировать", "error"));
  }, [toast]);
}

const LIFETIME = 2400;
const FADE = 180;
const MAX = 3;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const toast = useCallback<ShowToast>((text, tone = "ok") => {
    const id = ++seq.current;
    setItems((prev) => [...prev.slice(-(MAX - 1)), { id, text, tone, leaving: false }]);
    setTimeout(() => {
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, leaving: true } : item)));
    }, LIFETIME);
    setTimeout(() => {
      setItems((prev) => prev.filter((item) => item.id !== id));
    }, LIFETIME + FADE);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {items.map((item) => (
          <div key={item.id} className={`toast${item.leaving ? " is-leaving" : ""}`} role="status">
            <Icon
              name={item.tone === "error" ? "alert" : "check"}
              className={`h-4 w-4 shrink-0 ${item.tone === "error" ? "text-fg" : "text-accent"}`}
            />
            <span className="truncate">{item.text}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
