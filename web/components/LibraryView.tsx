"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { LibraryItem } from "@/lib/data";
import { getGlobalLast, type GlobalLast } from "@/lib/progress";

export function LibraryView({ library }: { library: LibraryItem[] }) {
  const [last, setLast] = useState<GlobalLast | null>(null);

  useEffect(() => {
    setLast(getGlobalLast());
  }, []);

  const lastStory = last ? library.find((s) => s.slug === last.slug) : null;

  return (
    <div>
      {last && lastStory && (
        <div className="continue-card">
          <div>
            <div className="progress-note" style={{ margin: 0 }}>Đang đọc dở</div>
            <strong>{lastStory.title}</strong> — Chương {last.index}
          </div>
          <Link className="btn primary" href={`/truyen/${last.slug}/chuong/${last.index}`}>
            Tiếp tục →
          </Link>
        </div>
      )}

      <div className="story-grid">
        {library.map((s) => (
          <Link key={s.slug} href={`/truyen/${s.slug}`} className="story-card">
            <div className="story-card-title">{s.title}</div>
            {s.author && <div className="meta-row">Tác giả: {s.author}</div>}
            <div className="meta-row">
              {s.total_chapters} chương
              {s.declared_total > s.total_chapters && ` / ${s.declared_total} (đang cập nhật)`}
            </div>
            {s.tags?.length > 0 && (
              <div className="tags">
                {s.tags.slice(0, 5).map((t) => (
                  <span className="tag" key={t}>{t}</span>
                ))}
              </div>
            )}
            {s.description && (
              <p className="story-card-desc">{s.description.replace(/﻿/g, "").trim()}</p>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
