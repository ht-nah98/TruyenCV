"use client";

// Lớp truy cập dữ liệu phía client (ĐA TRUYỆN): fetch JSON tĩnh từ /data/<slug>/..., cache RAM.

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

export interface StoryMetaLite {
  slug: string;
  title: string;
  author: string;
  total_chapters: number;
  declared_total: number;
}

export interface ChapterIndexItem {
  i: number;
  t: string;
}

export interface ChapterData {
  index: number;
  title: string;
  content: string;
}

let _libraryPromise: Promise<LibraryItem[]> | null = null;
const _metaPromise = new Map<string, Promise<StoryMetaLite>>();
const _indexPromise = new Map<string, Promise<ChapterIndexItem[]>>();
const _chapterCache = new Map<string, ChapterData>(); // key = `${slug}:${index}`

const pad = (n: number) => String(n).padStart(4, "0");

export function fetchLibrary(): Promise<LibraryItem[]> {
  if (!_libraryPromise) {
    _libraryPromise = fetch("/data/library.json")
      .then((r) => r.json())
      .catch(() => []);
  }
  return _libraryPromise;
}

export function fetchMeta(slug: string): Promise<StoryMetaLite> {
  if (!_metaPromise.has(slug)) {
    _metaPromise.set(
      slug,
      fetch(`/data/${slug}/meta.json`)
        .then((r) => r.json())
        .catch(() => ({ slug, title: "", author: "", total_chapters: 0, declared_total: 0 }))
    );
  }
  return _metaPromise.get(slug)!;
}

export function fetchIndex(slug: string): Promise<ChapterIndexItem[]> {
  if (!_indexPromise.has(slug)) {
    _indexPromise.set(
      slug,
      fetch(`/data/${slug}/chapters-index.json`)
        .then((r) => r.json())
        .catch(() => [])
    );
  }
  return _indexPromise.get(slug)!;
}

export async function fetchChapter(slug: string, index: number): Promise<ChapterData | null> {
  const key = `${slug}:${index}`;
  if (_chapterCache.has(key)) return _chapterCache.get(key)!;
  try {
    const r = await fetch(`/data/${slug}/chapters/chuong-${pad(index)}.json`);
    if (!r.ok) return null;
    const data = (await r.json()) as ChapterData;
    _chapterCache.set(key, data);
    if (_chapterCache.size > 40) {
      const firstKey = _chapterCache.keys().next().value;
      if (firstKey !== undefined) _chapterCache.delete(firstKey);
    }
    return data;
  } catch {
    return null;
  }
}

export function prefetchChapter(slug: string, index: number | null) {
  if (index == null) return;
  const key = `${slug}:${index}`;
  if (_chapterCache.has(key)) return;
  fetchChapter(slug, index).catch(() => {});
}
