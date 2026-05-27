"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SettingsButton } from "@/components/SettingsPanel";
import {
  useReadChapters,
  setLastRead,
  saveScroll,
  getScroll,
} from "@/lib/progress";
import {
  fetchMeta,
  fetchIndex,
  fetchChapter,
  prefetchChapter,
  type ChapterData,
} from "@/lib/client-data";

interface NavState {
  prev: number | null;
  next: number | null;
}

export function ReaderClient({ slug, index }: { slug: string; index: number }) {
  const router = useRouter();
  const { markRead } = useReadChapters(slug);
  const [chapter, setChapter] = useState<ChapterData | null>(null);
  const [nav, setNav] = useState<NavState>({ prev: null, next: null });
  const [storyTitle, setStoryTitle] = useState("");
  const [status, setStatus] = useState<"loading" | "ok" | "notfound">("loading");
  const savedRef = useRef(false);

  // Tải nội dung chương + tính prev/next
  useEffect(() => {
    let alive = true;
    setStatus("loading");
    setChapter(null);
    savedRef.current = false;

    (async () => {
      const [meta, idx, ch] = await Promise.all([
        fetchMeta(slug),
        fetchIndex(slug),
        fetchChapter(slug, index),
      ]);
      if (!alive) return;
      setStoryTitle(meta.title);
      if (!ch) {
        setStatus("notfound");
        return;
      }
      const pos = idx.findIndex((c) => c.i === index);
      const prev = pos > 0 ? idx[pos - 1].i : null;
      const next = pos >= 0 && pos < idx.length - 1 ? idx[pos + 1].i : null;
      setNav({ prev, next });
      setChapter(ch);
      setStatus("ok");
      setLastRead(slug, index, 0, meta.title);
      // prefetch chương kế để chuyển mượt
      if (next != null) prefetchChapter(slug, next);
      if (prev != null) prefetchChapter(slug, prev);
    })();

    return () => {
      alive = false;
    };
  }, [slug, index]);

  // Khôi phục vị trí cuộn sau khi nội dung đã render
  useEffect(() => {
    if (status !== "ok") return;
    const y = getScroll(slug, index);
    requestAnimationFrame(() => window.scrollTo(0, y > 0 ? y : 0));
  }, [status, slug, index]);

  // Theo dõi cuộn: lưu vị trí + đánh dấu đã đọc khi gần cuối
  useEffect(() => {
    if (status !== "ok") return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const scrollY = window.scrollY;
        saveScroll(slug, index, scrollY);
        setLastRead(slug, index, scrollY, storyTitle);
        const doc = document.documentElement;
        if (scrollY + window.innerHeight >= doc.scrollHeight - 200 && !savedRef.current) {
          savedRef.current = true;
          markRead(index);
        }
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [status, slug, index, storyTitle, markRead]);

  // Phím tắt
  const go = useCallback(
    (target: number | null) => {
      if (target != null) router.push(`/truyen/${slug}/chuong/${target}`);
    },
    [router, slug]
  );
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowLeft") go(nav.prev);
      else if (e.key === "ArrowRight") go(nav.next);
      else if (e.key.toLowerCase() === "h") router.push(`/truyen/${slug}`);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [nav, go, router, slug]);

  const paragraphs = chapter
    ? chapter.content.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
    : [];

  // Cập nhật document.title
  useEffect(() => {
    if (chapter) document.title = `${chapter.title} – ${storyTitle}`;
  }, [chapter, storyTitle]);

  return (
    <>
      <header className="site-header">
        <div className="inner">
          <Link href={`/truyen/${slug}`} className="brand" title="Về mục lục (phím H)">
            ‹ {storyTitle || "Mục lục"}
          </Link>
          <span className="spacer" />
          <SettingsButton />
        </div>
      </header>

      {status === "loading" && (
        <div className="reader">
          <div className="skeleton-title" />
          {Array.from({ length: 8 }).map((_, i) => (
            <div className="skeleton-line" key={i} style={{ width: `${85 + (i % 3) * 5}%` }} />
          ))}
        </div>
      )}

      {status === "notfound" && (
        <div className="empty">
          <h2>Chương {index} chưa có</h2>
          <p>Chương này có thể chưa được tải về.</p>
          <Link className="btn primary" href={`/truyen/${slug}`}>← Về mục lục</Link>
        </div>
      )}

      {status === "ok" && chapter && (
        <article className="reader">
          <h1 className="ch-title">{chapter.title}</h1>
          <div className="content">
            {paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>

          <nav className="reader-nav">
            <button className="btn" disabled={nav.prev == null} onClick={() => go(nav.prev)}>
              ‹ Trước
            </button>
            <Link className="btn" href={`/truyen/${slug}`}>Mục lục</Link>
            <button className="btn primary" disabled={nav.next == null} onClick={() => go(nav.next)}>
              Sau ›
            </button>
          </nav>
        </article>
      )}

      <div className="bottom-bar">
        <button className="btn" disabled={nav.prev == null} onClick={() => go(nav.prev)} aria-label="Chương trước">
          ‹
        </button>
        <Link className="btn" href={`/truyen/${slug}`}>☰ Mục lục</Link>
        <SettingsButton compact />
        <button className="btn primary" disabled={nav.next == null} onClick={() => go(nav.next)} aria-label="Chương sau">
          ›
        </button>
      </div>
    </>
  );
}
