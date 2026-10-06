import { useRef, useState, type ReactNode } from "react";

type Phase = "in" | "idle" | "out" | null;

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function PanelReveal({ show, children }: { show: boolean; children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>(show ? "idle" : null);
  const [prevShow, setPrevShow] = useState(show);
  const last = useRef(children);
  if (show) last.current = children;

  if (show !== prevShow) {
    setPrevShow(show);
    setPhase(show ? (reducedMotion() ? "idle" : "in") : phase && !reducedMotion() ? "out" : null);
  }

  if (!phase) return null;
  return (
    <div
      data-phase={phase}
      inert={phase === "out"}
      className="panel-reveal"
      onTransitionEnd={(e) => {
        if (e.target !== e.currentTarget || e.propertyName !== "width") return;
        setPhase(phase === "out" ? null : "idle");
      }}
    >
      {last.current}
    </div>
  );
}
