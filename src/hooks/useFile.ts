import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { MARKDOWN_EXTENSIONS, PLAIN_TEXT_EXTENSIONS, TEXT_EXTENSIONS } from "../lib/markdown-utils";

const MARKDOWN_FILTER = { name: "Markdown", extensions: MARKDOWN_EXTENSIONS };
const PLAIN_TEXT_FILTER = { name: "Текст", extensions: PLAIN_TEXT_EXTENSIONS };

export function useFile() {
  const [filePath, setFilePath] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const hasChanges = content !== savedContent;

  const fileName = filePath
    ? filePath.split(/[\\/]/).pop() ?? "Untitled"
    : null;

  const pickFile = useCallback(async () => {
    const selected = await open({
      filters: [{ name: "Текстовые документы", extensions: TEXT_EXTENSIONS }, MARKDOWN_FILTER, PLAIN_TEXT_FILTER],
    });
    return typeof selected === "string" ? selected : null;
  }, []);

  const openFile = useCallback(async (path: string) => {
    try {
      setIsLoading(true);
      const text = await invoke<string>("read_file", { path });
      setFilePath(path);
      setContent(text);
      setSavedContent(text);
      return path;
    } catch (e) {
      console.error("Failed to open file:", e);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveFile = useCallback(async () => {
    try {
      let targetPath = filePath;
      if (!targetPath) {
        const selected = await save({
          filters: [MARKDOWN_FILTER, PLAIN_TEXT_FILTER],
        });
        if (!selected) return null;
        targetPath = selected;
        setFilePath(targetPath);
      }

      await invoke("write_file", { path: targetPath, content });
      setSavedContent(content);
      return targetPath;
    } catch (e) {
      console.error("Failed to save file:", e);
      return null;
    }
  }, [filePath, content]);

  const newFile = useCallback(() => {
    setFilePath(null);
    setContent("");
    setSavedContent("");
  }, []);

  return {
    filePath,
    fileName,
    content,
    setContent,
    savedContent,
    hasChanges,
    isLoading,
    pickFile,
    openFile,
    saveFile,
    newFile,
  };
}
