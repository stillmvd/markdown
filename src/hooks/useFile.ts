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
  const [isDraft, setIsDraft] = useState(false);

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
      setIsDraft(false);
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

  const adoptPath = useCallback((path: string) => {
    setFilePath(path);
    setIsDraft(false);
  }, []);

  const saveFile = useCallback(async () => {
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
    setIsDraft(false);
    setSavedContent(content);
    return targetPath;
  }, [filePath, content]);

  const newFile = useCallback(() => {
    setFilePath(null);
    setContent("");
    setSavedContent("");
    setIsDraft(true);
  }, []);

  const closeFile = useCallback(() => {
    setFilePath(null);
    setContent("");
    setSavedContent("");
    setIsDraft(false);
  }, []);

  return {
    filePath,
    fileName,
    content,
    setContent,
    savedContent,
    hasChanges,
    isLoading,
    isDraft,
    pickFile,
    openFile,
    adoptPath,
    saveFile,
    newFile,
    closeFile,
  };
}
