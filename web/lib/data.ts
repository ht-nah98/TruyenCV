import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "public", "data");

export interface LibraryItem {
  slug: string;
  title: string;
  author: string;
  tags: string[];
  source_url: string;
  total_chapters: number;
  declared_total: number;
  description: string;
}

export interface StoryMeta {
  slug: string;
  title: string;
  author: string;
  translator: string;
  status: string;
  tags: string[];
  description: string;
  source_url: string;
  total_chapters: number;
  declared_total: number;
  first_index: number;
  last_index: number;
}

function readJSON<T>(p: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

export function getLibrary(): LibraryItem[] {
  return readJSON<LibraryItem[]>(path.join(DATA_DIR, "library.json"), []);
}

export function getStorySlugs(): string[] {
  return getLibrary().map((s) => s.slug);
}

export function getMeta(slug: string): StoryMeta {
  return readJSON<StoryMeta>(path.join(DATA_DIR, slug, "meta.json"), {
    slug,
    title: slug,
    author: "",
    translator: "",
    status: "",
    tags: [],
    description: "",
    source_url: "",
    total_chapters: 0,
    declared_total: 0,
    first_index: 0,
    last_index: 0,
  });
}
