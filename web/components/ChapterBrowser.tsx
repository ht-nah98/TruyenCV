"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useReadChapters, getLastRead, type LastRead } from "@/lib/progress";
import { fetchIndex, type ChapterIndexItem } from "@/lib/client-data";

const PAGE_SIZE = 50;

export function ChapterBrowser({ slug }: { slug: string }) {
  const [chapters, setChapters] = useState<ChapterIndexItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [asc, setAsc] = useState(true);
  const { isRead } = useReadChapters(slug);
  const [last, setLast] = useState<LastRead | null>(null);

  useEffect(() => {
    setLast(getLastRead(slug));
    fetchIndex(slug).then((idx) => {
      setChapters(idx);
      setLoaded(true);
    });
  }, [slug]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = chapters;
    if (q) {
      // tìm theo số chương hoặc theo tên
      const asNum = Number(q);
      list = chapters.filter(
        (c) =>
          c.t.toLowerCase().includes(q) ||
          (!Number.isNaN(asNum) && c.i === asNum)
      );
    }
    const sorted = asc ? list : [...list].reverse();
    return sorted;
  }, [chapters, query, asc]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const slice = filtered.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE
  );

  // reset trang khi đổi query/sort
  useEffect(() => {
    setPage(0);
  }, [query, asc]);

  return (
    <div>
      {last && (
        <div className="progress-note">
          Đang đọc dở:{" "}
          <Link href={`/truyen/${slug}/chuong/${last.index}`}>
            tiếp tục Chương {last.index} →
          </Link>
        </div>
      )}

      <div className="toolbar">
        <input
          className="search"
          placeholder="Tìm theo tên chương hoặc số chương…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="btn" onClick={() => setAsc((v) => !v)}>
          {asc ? "Cũ → Mới" : "Mới → Cũ"}
        </button>
      </div>

      <div className="progress-note">
        {!loaded
          ? "Đang tải mục lục…"
          : query
          ? `${filtered.length} kết quả`
          : `${chapters.length} chương`}
      </div>

      {!loaded ? (
        <ul className="chapter-list">
          {Array.from({ length: 8 }).map((_, i) => (
            <li key={i}>
              <span style={{ display: "block", padding: "14px 16px" }}>
                <span className="skeleton-line" style={{ width: "70%", margin: 0, display: "block" }} />
              </span>
            </li>
          ))}
        </ul>
      ) : slice.length === 0 ? (
        <div className="empty">Không tìm thấy chương nào khớp.</div>
      ) : (
        <ul className="chapter-list">
          {slice.map((c) => (
            <li key={c.i}>
              <Link
                href={`/truyen/${slug}/chuong/${c.i}`}
                className={isRead(c.i) ? "read" : ""}
              >
                <span className="num">#{c.i}</span>
                <span className="ctitle">{c.t}</span>
                {isRead(c.i) && (
                  <span style={{ marginLeft: "auto", opacity: 0.6 }}>✓</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {pageCount > 1 && (
        <div className="pager">
          <button
            className="btn"
            disabled={safePage === 0}
            onClick={() => setPage(0)}
          >
            « Đầu
          </button>
          <button
            className="btn"
            disabled={safePage === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            ‹ Trước
          </button>
          <span className="page-info">
            Trang {safePage + 1}/{pageCount}
          </span>
          <button
            className="btn"
            disabled={safePage >= pageCount - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            Sau ›
          </button>
          <button
            className="btn"
            disabled={safePage >= pageCount - 1}
            onClick={() => setPage(pageCount - 1)}
          >
            Cuối »
          </button>
        </div>
      )}
    </div>
  );
}
