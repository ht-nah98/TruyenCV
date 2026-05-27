#!/usr/bin/env python3
"""
Crawler cho tvtruyen.co.uk — tải toàn bộ chương 1 bộ truyện.

Trang KHÔNG bật chặn Cloudflare -> dùng requests thuần (nhanh).
URL chương tuần tự: /<slug>/chuong-<N>  (N = 1..total)
Nội dung nằm trong <div id="chapter-content">, tiêu đề trong <h2>.

Cách dùng:
    python3 crawl_tvtruyen.py                          # mặc định ta-mo-phong-truong-sinh-lo, 1..1693
    python3 crawl_tvtruyen.py --slug <slug> --end <N>
    python3 crawl_tvtruyen.py --start 100 --end 200    # tải khoảng chương

Resume được (bỏ qua chương đã tải), retry khi lỗi.
Output: output/<slug>/{metadata.json, chapters/chuong-XXXX.json}  (cùng schema bộ truyenss)
"""
import argparse
import json
import os
import random
import re
import sys
import time
from html.parser import HTMLParser
import requests

BASE = "https://www.tvtruyen.co.uk"
OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output")
UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")

# Các dòng rác cần loại khỏi nội dung
JUNK_PATTERNS = [
    re.compile(r'^\s*$'),
    re.compile(r'truyentv', re.I),
    re.compile(r'quảng cáo', re.I),
    re.compile(r'vui lòng', re.I),
]


class ContentParser(HTMLParser):
    """Trích text trong <div id='chapter-content'>, <br> -> newline."""

    def __init__(self):
        super().__init__()
        self.depth = 0          # độ sâu div kể từ khi vào chapter-content (0 = ngoài)
        self.capturing = False
        self.parts = []

    def handle_starttag(self, tag, attrs):
        d = dict(attrs)
        if not self.capturing:
            if tag == "div" and d.get("id") == "chapter-content":
                self.capturing = True
                self.depth = 1
            return
        if tag == "div":
            self.depth += 1
        elif tag == "br":
            self.parts.append("\n")
        elif tag in ("script", "style"):
            self.parts.append("\x00")  # đánh dấu để bỏ qua

    def handle_endtag(self, tag):
        if not self.capturing:
            return
        if tag == "div":
            self.depth -= 1
            if self.depth <= 0:
                self.capturing = False

    def handle_data(self, data):
        if self.capturing:
            self.parts.append(data)


def clean_content(html):
    p = ContentParser()
    p.feed(html)
    text = "".join(x for x in p.parts if x != "\x00")
    # gộp dòng, bỏ khoảng trắng thừa
    lines = [ln.strip() for ln in text.split("\n")]
    keep = []
    for ln in lines:
        if not ln:
            keep.append("")
            continue
        if any(pat.search(ln) for pat in JUNK_PATTERNS[1:]):
            continue
        keep.append(ln)
    # gộp các đoạn: ngăn cách bằng 1 dòng trống
    out, blank = [], False
    for ln in keep:
        if ln == "":
            blank = True
            continue
        if out and blank:
            out.append("")
        out.append(ln)
        blank = False
    return "\n\n".join(p for p in "\n".join(out).split("\n\n") if p.strip()).strip()


def extract_title(html, idx):
    m = re.search(r'<h2[^>]*>(.*?)</h2>', html, re.S)
    if m:
        t = re.sub(r'<[^>]+>', '', m.group(1)).strip()
        # dạng "#1. Chương 1: ..." -> bỏ tiền tố "#N. "
        t = re.sub(r'^#\d+\.\s*', '', t)
        if t:
            return t
    return f"Chương {idx}"


def fetch(session, url, retries=4):
    for attempt in range(1, retries + 1):
        try:
            r = session.get(url, timeout=30)
            if r.status_code == 404:
                return None, 404
            r.raise_for_status()
            return r.text, 200
        except Exception as e:
            wait = attempt * 2
            print(f"    [retry {attempt}/{retries}] {url}: {e} -> chờ {wait}s", file=sys.stderr)
            time.sleep(wait)
    return None, -1


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--slug", default="ta-mo-phong-truong-sinh-lo")
    ap.add_argument("--title", default="Ta Mô Phỏng Trường Sinh Lộ")
    ap.add_argument("--start", type=int, default=1)
    ap.add_argument("--end", type=int, default=1693)
    ap.add_argument("--min-delay", type=float, default=0.5)
    ap.add_argument("--max-delay", type=float, default=1.5)
    ap.add_argument("--retries", type=int, default=4)
    args = ap.parse_args()

    story_dir = os.path.join(OUT_DIR, args.slug)
    chap_dir = os.path.join(story_dir, "chapters")
    os.makedirs(chap_dir, exist_ok=True)

    session = requests.Session()
    session.headers.update({"User-Agent": UA, "Referer": f"{BASE}/{args.slug}.html"})

    # metadata cơ bản (lấy từ trang giới thiệu)
    intro_html, st = fetch(session, f"{BASE}/{args.slug}.html")
    meta = {
        "folder": args.slug,
        "title": args.title,
        "author": "",
        "translator": "",
        "status": "",
        "tags": [],
        "description": "",
        "source_url": f"{BASE}/{args.slug}.html",
        "total_chapters": 0,
        "crawled_at": time.strftime("%Y-%m-%d %H:%M:%S"),
    }
    if intro_html:
        ma = re.search(r'[Tt]ác giả[:\s]*</?[^>]*>?\s*<a[^>]*>(.*?)</a>', intro_html)
        if ma:
            meta["author"] = re.sub(r'<[^>]+>', '', ma.group(1)).strip()
        md = re.search(r'<div[^>]*class="[^"]*story-detail-introduction[^"]*"[^>]*>(.*?)</div>', intro_html, re.S)
        if md:
            meta["description"] = re.sub(r'<[^>]+>', '', md.group(1)).strip()[:2000]

    ok = skip = fail = 0
    fails = []
    chapter_titles = {}

    for ch in range(args.start, args.end + 1):
        out_path = os.path.join(chap_dir, f"chuong-{ch:04d}.json")
        if os.path.exists(out_path) and os.path.getsize(out_path) > 50:
            skip += 1
            # vẫn nạp title để dựng chapter_list
            try:
                chapter_titles[ch] = json.load(open(out_path, encoding="utf-8")).get("title", f"Chương {ch}")
            except Exception:
                pass
            continue

        url = f"{BASE}/{args.slug}/chuong-{ch}"
        html, status = fetch(session, url, args.retries)
        if status == 404:
            print(f"[404] Chương {ch} không tồn tại -> dừng tại đây.", file=sys.stderr)
            break
        if not html:
            fail += 1
            fails.append(ch)
            print(f"[FAIL] Chương {ch}.", file=sys.stderr)
            continue

        content = clean_content(html)
        title = extract_title(html, ch)
        if not content or len(content) < 20:
            fail += 1
            fails.append(ch)
            print(f"[FAIL] Chương {ch}: nội dung rỗng (len={len(content)}).", file=sys.stderr)
            continue

        data = {
            "index": ch,
            "title": title,
            "list_title": title,
            "content": content,
            "char_count": len(content),
            "source": url,
        }
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        chapter_titles[ch] = title
        ok += 1
        if ok % 25 == 0:
            print(f"[*] Tiến độ TV: chương {ch}/{args.end} | mới={ok} bỏ-qua={skip} lỗi={fail}", file=sys.stderr)
        time.sleep(random.uniform(args.min_delay, args.max_delay))

    # ghi metadata + chapter_list
    meta["total_chapters"] = len(chapter_titles)
    with open(os.path.join(story_dir, "metadata.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
    clist = [{"index": i, "title": chapter_titles[i]} for i in sorted(chapter_titles)]
    with open(os.path.join(story_dir, "chapter_list.json"), "w", encoding="utf-8") as f:
        json.dump(clist, f, ensure_ascii=False, indent=2)
    if fails:
        with open(os.path.join(story_dir, "failed_chapters.json"), "w", encoding="utf-8") as f:
            json.dump(fails, f)

    print(f"\n[DONE TV] mới={ok} bỏ-qua={skip} lỗi={fail} | tổng có={len(chapter_titles)}", file=sys.stderr)
    if fails:
        print(f"[!] Chương lỗi (chạy lại để retry): {fails}", file=sys.stderr)


if __name__ == "__main__":
    main()
