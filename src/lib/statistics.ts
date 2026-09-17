import type { DocumentStats } from "../types";

export function calculateStats(text: string): DocumentStats {
  const trimmed = text.trim();
  if (!trimmed) {
    return { words: 0, characters: 0, lines: 0, readingTime: 0 };
  }

  const words = trimmed.split(/\s+/).filter(Boolean).length;
  const characters = trimmed.length;
  const lines = trimmed.split("\n").length;
  const readingTime = Math.max(1, Math.ceil(words / 200));

  return { words, characters, lines, readingTime };
}
