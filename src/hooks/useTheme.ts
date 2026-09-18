import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { load } from "@tauri-apps/plugin-store";
import type { Theme } from "../types";

const STORE_KEY = "theme";

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem(STORE_KEY, theme);
  } catch {}
  invoke("set_window_theme", { dark: theme === "dark" }).catch((e) =>
    console.error("Failed to apply window theme:", e),
  );
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    (async () => {
      try {
        const store = await load("settings.json");
        const saved = await store.get<Theme>(STORE_KEY);
        if (saved) {
          setThemeState(saved);
          applyTheme(saved);
        } else {
          applyTheme("dark");
        }
      } catch {
        applyTheme("dark");
      }
    })();
  }, []);

  const setTheme = useCallback(async (newTheme: Theme) => {
    setThemeState(newTheme);
    applyTheme(newTheme);
    try {
      const store = await load("settings.json");
      await store.set(STORE_KEY, newTheme);
      await store.save();
    } catch (e) {
      console.error("Failed to save theme:", e);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  return { theme, setTheme, toggleTheme };
}
