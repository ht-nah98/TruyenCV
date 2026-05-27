"use client";

import { useCallback, useEffect, useState } from "react";

// Tiến độ đọc lưu THEO TỪNG TRUYỆN (slug) để 2 bộ không lẫn nhau.
const readKey = (slug: string) => `reader-read-v2:${slug}`;
const lastKey = (slug: string) => `reader-last-v2:${slug}`;
const scrollKey = (slug: string, i: number) => `reader-scroll-v2:${slug}:${i}`;
// vị trí đọc gần nhất trên toàn thư viện (để "tiếp tục đọc" ở trang chủ)
const GLOBAL_LAST = "reader-global-last-v2";

export interface LastRead {
  index: number;
  scroll: number;
  ts: number;
}

export interface GlobalLast {
  slug: string;
  title?: string;
  index: number;
  ts: number;
}

function loadSet(key: string): Set<number> {
  try {
    const raw = localStorage.getItem(key);
    return raw ? new Set(JSON.parse(raw) as number[]) : new Set();
  } catch {
    return new Set();
  }
}
function saveSet(key: string, set: Set<number>) {
  try {
    localStorage.setItem(key, JSON.stringify([...set]));
  } catch {}
}

export function useReadChapters(slug: string) {
  const [read, setRead] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!slug) return;
    setRead(loadSet(readKey(slug)));
    const onStorage = (e: StorageEvent) => {
      if (e.key === readKey(slug)) setRead(loadSet(readKey(slug)));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [slug]);

  const markRead = useCallback(
    (index: number) => {
      setRead((prev) => {
        if (prev.has(index)) return prev;
        const next = new Set(prev);
        next.add(index);
        saveSet(readKey(slug), next);
        return next;
      });
    },
    [slug]
  );

  const isRead = useCallback((index: number) => read.has(index), [read]);
  return { read, markRead, isRead };
}

export function getLastRead(slug: string): LastRead | null {
  try {
    const raw = localStorage.getItem(lastKey(slug));
    return raw ? (JSON.parse(raw) as LastRead) : null;
  } catch {
    return null;
  }
}

export function setLastRead(slug: string, index: number, scroll: number, title?: string) {
  try {
    localStorage.setItem(lastKey(slug), JSON.stringify({ index, scroll, ts: Date.now() }));
    localStorage.setItem(GLOBAL_LAST, JSON.stringify({ slug, title, index, ts: Date.now() }));
  } catch {}
}

export function getGlobalLast(): GlobalLast | null {
  try {
    const raw = localStorage.getItem(GLOBAL_LAST);
    return raw ? (JSON.parse(raw) as GlobalLast) : null;
  } catch {
    return null;
  }
}

export function saveScroll(slug: string, index: number, scroll: number) {
  try {
    localStorage.setItem(scrollKey(slug, index), String(scroll));
  } catch {}
}

export function getScroll(slug: string, index: number): number {
  try {
    const v = localStorage.getItem(scrollKey(slug, index));
    return v ? parseInt(v, 10) || 0 : 0;
  } catch {
    return 0;
  }
}
