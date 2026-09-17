import { useState } from "react";
import type { FileEntry } from "../types";
import Icon from "./Icon";
import SidePanel, { SidePanelEmpty } from "./SidePanel";

interface FolderSidebarProps {
  files: FileEntry[];
  folderPath: string;
  currentFilePath: string | null;
  onFileClick: (path: string) => void;
  onClose: () => void;
}

function countFiles(entry: FileEntry): number {
  return entry.children?.reduce((sum, child) => sum + (child.is_dir ? countFiles(child) : 1), 0) ?? 0;
}

function TreeNode({
  entry,
  currentFilePath,
  onFileClick,
  depth = 0,
}: {
  entry: FileEntry;
  currentFilePath: string | null;
  onFileClick: (path: string) => void;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(depth < 1);

  if (entry.is_dir) {
    const raised = depth % 2 === 0;
    return (
      <div className={`flex shrink-0 flex-col gap-0.5 rounded-[20px] p-1 ${raised ? "bg-raised" : "bg-cosmic"}`}>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="side-row text-[13px] font-medium hover:bg-hover-strong"
          title={entry.path}
          aria-expanded={expanded}
        >
          <Icon name="folder" className="h-4 w-4 shrink-0 text-dim" />
          <span className="truncate">{entry.name}</span>
          <span
            className={`ml-auto grid h-5 min-w-[22px] shrink-0 place-items-center rounded-full px-[7px]
              text-[11px] font-bold tabular-nums text-dim ${raised ? "bg-cosmic" : "bg-raised"}`}
          >
            {countFiles(entry)}
          </span>
          <Icon
            name="chevron"
            className={`h-4 w-4 shrink-0 text-dim transition-transform duration-200 ease-trail ${expanded ? "rotate-90" : ""}`}
          />
        </button>
        {expanded && entry.children?.map((child) => (
          <TreeNode
            key={child.path}
            entry={child}
            currentFilePath={currentFilePath}
            onFileClick={onFileClick}
            depth={depth + 1}
          />
        ))}
      </div>
    );
  }

  const isActive = currentFilePath === entry.path;
  const inRaised = depth % 2 === 1;
  const state = isActive
    ? `${inRaised ? "bg-cosmic" : "bg-hover-strong"} shadow-press`
    : depth === 0 ? "hover:bg-hover" : "hover:bg-hover-strong";

  return (
    <button
      type="button"
      onClick={() => onFileClick(entry.path)}
      className={`side-row text-sm ${depth === 0 ? "pl-4" : ""} ${state}`}
      title={entry.path}
      aria-current={isActive ? "page" : undefined}
    >
      <Icon name="file" className="h-4 w-4 shrink-0 text-dim" />
      <span className="truncate">{entry.name}</span>
    </button>
  );
}

function getFolderName(folderPath: string) {
  const parts = folderPath.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] || folderPath;
}

export default function FolderSidebar({ files, folderPath, currentFilePath, onFileClick, onClose }: FolderSidebarProps) {
  return (
    <SidePanel icon="folder" title={getFolderName(folderPath)} closeLabel="Закрыть папку" onClose={onClose}>
      {files.length === 0 ? (
        <SidePanelEmpty icon="folder" title="Текстовых файлов нет" text="Здесь появятся .md и .txt из этой папки и вложенных" />
      ) : (
        <div className="side-list gap-1.5">
          {files.map((entry) => (
            <TreeNode
              key={entry.path}
              entry={entry}
              currentFilePath={currentFilePath}
              onFileClick={onFileClick}
            />
          ))}
        </div>
      )}
    </SidePanel>
  );
}
