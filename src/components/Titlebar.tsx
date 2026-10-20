import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { UpdateBadge } from "@stillmvd/tauri-ship";
import mark from "../../brand/logo/mark-small.svg";
import Icon from "./Icon";

function WindowControls() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    const appWindow = getCurrentWindow();
    appWindow.isMaximized().then(setMaximized);
    const unlisten = appWindow.onResized(() => {
      appWindow.isMaximized().then(setMaximized);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  return (
    <div className="flex shrink-0 items-center gap-1" role="group" aria-label="Окно">
      <button type="button" onClick={() => getCurrentWindow().minimize()} className="tb-win" title="Свернуть" aria-label="Свернуть">
        <Icon name="winMin" />
      </button>
      <button
        type="button"
        onClick={() => getCurrentWindow().toggleMaximize()}
        className="tb-win"
        title={maximized ? "Восстановить" : "Развернуть"}
        aria-label={maximized ? "Восстановить" : "Развернуть"}
      >
        <Icon name={maximized ? "winRestore" : "winMax"} />
      </button>
      <button type="button" onClick={() => getCurrentWindow().close()} className="tb-win tb-win-close" title="Закрыть" aria-label="Закрыть">
        <Icon name="close" />
      </button>
    </div>
  );
}

export default function Titlebar({ hasChanges }: { hasChanges: boolean }) {
  return (
    <div className="flex h-12 shrink-0 select-none items-center gap-2.5 bg-ground pl-5 pr-4" data-tauri-drag-region>
      <img src={mark} alt="" className="pointer-events-none h-4 w-4 shrink-0" />
      <span className="pointer-events-none text-sm font-bold tracking-[-0.01em]">Markdown</span>
      <div className="min-w-12 flex-1 self-stretch" data-tauri-drag-region />
      {!hasChanges && (
        <span className="flex empty:hidden">
          <UpdateBadge lang="ru" />
        </span>
      )}
      <WindowControls />
    </div>
  );
}
