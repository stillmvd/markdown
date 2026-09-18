import { useState, useCallback } from "react";
import { load } from "@tauri-apps/plugin-store";
import type { RecentFile } from "../types";

const MAX_RECENT = 10;
const STORE_KEY = "recentFiles";

export function useRecentFiles() {
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
  const [loaded] = useState(() =>
    load("settings.json")
      .then((store) => store.get<RecentFile[]>(STORE_KEY))
      .then((saved) => {
        if (saved) setRecentFiles(saved);
      })
      .catch(() => {}),
  );

  const addRecentFile = useCallback(async (path: string) => {
    await loaded;
    const name = path.split(/[\\/]/).pop() ?? path;
    const entry: RecentFile = { path, name, openedAt: Date.now() };

    setRecentFiles((prev) => {
      const filtered = prev.filter((f) => f.path !== path);
      const updated = [entry, ...filtered].slice(0, MAX_RECENT);

      (async () => {
        try {
          const store = await load("settings.json");
          await store.set(STORE_KEY, updated);
          await store.save();
        } catch {
          // ignore
        }
      })();

      return updated;
    });
  }, [loaded]);

  return { recentFiles, addRecentFile };
}
