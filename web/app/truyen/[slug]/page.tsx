import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getMeta, getStorySlugs } from "@/lib/data";
import { ChapterBrowser } from "@/components/ChapterBrowser";
import { SettingsButton } from "@/components/SettingsPanel";

export function generateStaticParams() {
  return getStorySlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const meta = getMeta(slug);
  return {
    title: meta.title,
    description: meta.description?.slice(0, 160) || "Đọc truyện online",
  };
}

export default async function StoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const slugs = getStorySlugs();
  if (!slugs.includes(slug)) notFound();

  const meta = getMeta(slug);
  const firstIndex = meta.first_index || 1;

  return (
    <>
      <header className="site-header">
        <div className="inner">
          <Link href="/" className="brand">📚 Tủ Truyện</Link>
          <span className="spacer" />
          <SettingsButton />
        </div>
      </header>

      <main className="container">
        <section className="story-head">
          <h1>{meta.title}</h1>
          {meta.author && <div className="meta-row">Tác giả: {meta.author}</div>}
          {meta.translator && <div className="meta-row">Dịch giả: {meta.translator}</div>}
          {meta.status && <div className="meta-row">Tình trạng: {meta.status}</div>}
          <div className="meta-row">
            {meta.total_chapters} chương đã có
            {meta.declared_total > meta.total_chapters &&
              ` / ${meta.declared_total} chương (đang cập nhật)`}
          </div>

          {meta.tags?.length > 0 && (
            <div className="tags">
              {meta.tags.map((t) => (
                <span className="tag" key={t}>{t}</span>
              ))}
            </div>
          )}

          <div className="toolbar">
            <Link className="btn primary" href={`/truyen/${slug}/chuong/${firstIndex}`}>
              ▶ Đọc từ đầu
            </Link>
          </div>

          {meta.description && (
            <div className="desc">{meta.description.replace(/﻿/g, "").trim()}</div>
          )}
        </section>

        <ChapterBrowser slug={slug} />

        <footer style={{ padding: "40px 0", color: "var(--fg-muted)", fontSize: 13 }}>
          {meta.source_url && (
            <div>
              Nguồn:{" "}
              <a href={meta.source_url} target="_blank" rel="noreferrer">{meta.source_url}</a>
            </div>
          )}
        </footer>
      </main>
    </>
  );
}
