#!/usr/bin/env node
/**
 * Build-data (ĐA TRUYỆN): quét mọi folder trong crawler/output/ và sinh dữ liệu tĩnh.
 *
 * Nguồn:  ../crawler/output/<slug>/{metadata.json, chapter_list.json, chapters/*.json}
 * Đích:   ./public/data/library.json                       (danh sách truyện)
 *         ./public/data/<slug>/meta.json
 *         ./public/data/<slug>/chapters-index.json
 *         ./public/data/<slug>/chapters/chuong-XXXX.json
 *
 * Chạy tự động trước `dev` và `build`. An toàn khi crawler chưa xong.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.resolve(__dirname, "..");
const SRC_ROOT = path.resolve(WEB_ROOT, "..", "crawler", "output");
const OUT_ROOT = path.join(WEB_ROOT, "public", "data");

function readJSON(p, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {
    return fallback;
  }
}

function listStorySlugs() {
  if (!fs.existsSync(SRC_ROOT)) return [];
  return fs
    .readdirSync(SRC_ROOT, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .filter((d) => fs.existsSync(path.join(SRC_ROOT, d.name, "chapters")))
    .map((d) => d.name);
}

function buildStory(slug) {
  const src = path.join(SRC_ROOT, slug);
  const out = path.join(OUT_ROOT, slug);
  const outChapters = path.join(out, "chapters");
  fs.mkdirSync(outChapters, { recursive: true });

  const meta = readJSON(path.join(src, "metadata.json"), {});
  const chaptersSrc = path.join(src, "chapters");
  const files = fs.existsSync(chaptersSrc)
    ? fs.readdirSync(chaptersSrc).filter((f) => f.endsWith(".json")).sort()
    : [];

  const index = [];
  let copied = 0;
  for (const f of files) {
    const data = readJSON(path.join(chaptersSrc, f));
    if (!data || typeof data.index !== "number") continue;
    const out_slug = `chuong-${String(data.index).padStart(4, "0")}.json`;
    const title = data.title || data.list_title || `Chương ${data.index}`;
    fs.writeFileSync(
      path.join(outChapters, out_slug),
      JSON.stringify({
        index: data.index,
        title,
        content: data.content || "",
        char_count: data.char_count ?? (data.content ? data.content.length : 0),
      })
    );
    copied++;
    index.push({ i: data.index, t: title });
  }
  index.sort((a, b) => a.i - b.i);

  const outMeta = {
    slug,
    title: meta.title || slug,
    author: meta.author || "",
    translator: meta.translator || "",
    status: meta.status || "",
    tags: meta.tags || [],
    description: meta.description || "",
    source_url: meta.source_url || "",
    total_chapters: index.length,
    declared_total: meta.total_chapters || index.length,
    first_index: index.length ? index[0].i : 0,
    last_index: index.length ? index[index.length - 1].i : 0,
    built_at: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(out, "meta.json"), JSON.stringify(outMeta, null, 2));
  fs.writeFileSync(path.join(out, "chapters-index.json"), JSON.stringify(index));

  console.log(`[build-data] ${slug}: ${copied} chương (declared ${outMeta.declared_total}).`);
  return {
    slug,
    title: outMeta.title,
    author: outMeta.author,
    tags: outMeta.tags,
    source_url: outMeta.source_url,
    total_chapters: outMeta.total_chapters,
    declared_total: outMeta.declared_total,
    description: (outMeta.description || "").slice(0, 300),
  };
}

function main() {
  fs.mkdirSync(OUT_ROOT, { recursive: true });
  const slugs = listStorySlugs();
  if (slugs.length === 0) {
    console.error("[build-data] Không tìm thấy truyện nào trong crawler/output/");
    fs.writeFileSync(path.join(OUT_ROOT, "library.json"), "[]");
    return;
  }
  const library = slugs.map(buildStory);
  // sắp xếp: truyện nhiều chương trước
  library.sort((a, b) => b.total_chapters - a.total_chapters);
  fs.writeFileSync(path.join(OUT_ROOT, "library.json"), JSON.stringify(library, null, 2));
  console.log(`[build-data] Thư viện: ${library.length} truyện -> library.json`);
}

main();
