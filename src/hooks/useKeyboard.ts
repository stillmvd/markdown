import { useEffect } from "react";

interface KeyboardActions {
  onSave: () => void;
  onOpen: () => void;
  onToggleMode: () => void;
  onSearch: () => void;
  onClose: () => void;
}

export function useKeyboard(actions: KeyboardActions) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.code) {
          case "KeyS":
            e.preventDefault();
            actions.onSave();
            break;
          case "KeyO":
            e.preventDefault();
            actions.onOpen();
            break;
          case "KeyE":
            e.preventDefault();
            actions.onToggleMode();
            break;
          case "KeyW":
            e.preventDefault();
            actions.onClose();
            break;
          case "KeyF":
            e.preventDefault();
            actions.onSearch();
            break;
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [actions]);
}
