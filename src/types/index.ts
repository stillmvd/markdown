export type ViewMode = "view" | "edit";
export type Theme = "dark" | "light";

export type RecentKind = "file" | "folder";

export interface RecentEntry {
  path: string;
  name: string;
  openedAt: number;
  kind: RecentKind;
}

export interface HeadingSection {
  level: number;
  title: string;
  content: string;
  id: string;
}

export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  children?: FileEntry[];
}

export interface DocumentStats {
  words: number;
  characters: number;
  lines: number;
  readingTime: number;
}
