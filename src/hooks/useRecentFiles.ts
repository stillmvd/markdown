import { useState, useCallback } from "react";
import { load } from "@tauri-apps/plugin-store";
import type { RecentEntry, RecentKind } from "../types";

const MAX_BY_KIND: Record<RecentKind, number> = { file: 10, folder: 5 };
const STORE_KEY = "recentFiles";

function limit(entries: RecentEntry[]) {
  const kept: Record<RecentKind, number> = { file: 0, folder: 0 };
  return entries.filter((entry) => ++kept[entry.kind] <= MAX_BY_KIND[entry.kind]);
}

async function persist(entries: RecentEntry[]) {
  try {
    const store = await load("settings.json");
    await store.set(STORE_KEY, entries);
    await store.save();
  } catch {
    // ignore
  }
}

export function useRecentFiles() {
  const [recentFiles, setRecentFiles] = useState<RecentEntry[]>([]);
  const [loaded] = useState(() =>
    load("settings.json")
      .then((store) => store.get<RecentEntry[]>(STORE_KEY))
      .then((saved) => {
        if (saved) setRecentFiles(limit(saved.map((entry) => ({ ...entry, kind: entry.kind ?? "file" }))));
      })
      .catch(() => {}),
  );

  const addRecent = useCallback(async (path: string, kind: RecentKind) => {
    await loaded;
    const name = path.split(/[\\/]/).filter(Boolean).pop() ?? path;
    const entry: RecentEntry = { path, name, openedAt: Date.now(), kind };

    setRecentFiles((prev) => {
      const updated = limit([entry, ...prev.filter((f) => f.path !== path)]);
      persist(updated);
      return updated;
    });
  }, [loaded]);

  const addRecentFile = useCallback((path: string) => addRecent(path, "file"), [addRecent]);
  const addRecentFolder = useCallback((path: string) => addRecent(path, "folder"), [addRecent]);

  const clearRecent = useCallback((kind: RecentKind) => {
    setRecentFiles((prev) => {
      const updated = prev.filter((f) => f.kind !== kind);
      persist(updated);
      return updated;
    });
  }, []);

  const removeRecent = useCallback((path: string) => {
    setRecentFiles((prev) => {
      const updated = prev.filter((f) => f.path !== path);
      persist(updated);
      return updated;
    });
  }, []);

  return { recentFiles, addRecentFile, addRecentFolder, removeRecent, clearRecent };
}
