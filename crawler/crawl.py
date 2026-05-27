#!/usr/bin/env python3
"""
Crawler cho truyenss.com — tải toàn bộ chương 1 bộ truyện.

Cách dùng:
    python3 crawl.py                      # tải truyện mặc định (ta-tai)
    python3 crawl.py --folder ta-tai      # chỉ định folder khác
    python3 crawl.py --start 100 --end 200  # tải khoảng chương nhất định

Đặc điểm:
  - Dùng Chrome thật (Playwright) để qua Cloudflare, lấy cookie/session.
  - Gọi thẳng API /layout/xem-chuong.php?folder=...&chuong=N (nhanh, ổn định).
  - Lưu mỗi chương 1 file JSON + metadata.json.
  - Resume được: bỏ qua chương đã tải. Retry khi lỗi.
  - Chậm & an toàn: delay ngẫu nhiên 2-4s giữa các chương, 1 luồng.
"""
import argparse
import json
import os
import random
import re
import sys
import time
from html.parser import HTMLParser
from playwright.sync_api import sync_playwright

BASE = "https://truyenss.com"
STORY_URL_TMPL = BASE + "/truyen/{folder}"
API_TMPL = BASE + "/layout/xem-chuong.php?folder={folder}&chuong={ch}"

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output")

UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")


# ----------------------- Parse HTML chương -> text -----------------------
class ChapterParser(HTMLParser):
    """Trích các đoạn <p> trong <div class='xem-chuong'>. <p> đầu (in đậm) là tiêu đề."""

    def __init__(self):
        super().__init__()
        self.in_chuong = 0          # độ sâu div xem-chuong (0 = ngoài)
        self.in_p = False
        self.cur = []
        self.paragraphs = []        # list[str]

    def handle_starttag(self, tag, attrs):
        d = dict(attrs)
        if tag == "div" and "xem-chuong" in (d.get("class") or ""):
            self.in_chuong = 1
            return
        if self.in_chuong:
            if tag == "div":
                self.in_chuong += 1
            elif tag == "p":
                self.in_p = True
                self.cur = []
            elif tag == "br" and self.in_p:
                self.cur.append("\n")

    def handle_endtag(self, tag):
        if not self.in_chuong:
            return
        if tag == "p" and self.in_p:
            text = "".join(self.cur).strip()
            if text:
                self.paragraphs.append(text)
            self.in_p = False
        elif tag == "div":
            self.in_chuong -= 1

    def handle_data(self, data):
        if self.in_chuong and self.in_p:
            self.cur.append(data)


def parse_chapter(html):
    """Trả về (title, content_text). content_text là các đoạn cách nhau bởi \\n\\n."""
    p = ChapterParser()
    p.feed(html)
    paras = p.paragraphs
    title = ""
    if paras:
        # đoạn đầu tiên thường là "Chương N: ..." -> dùng làm title, bỏ khỏi nội dung
        if re.match(r"^Chương\s*\d", paras[0]):
            title = paras[0]
            paras = paras[1:]
    content = "\n\n".join(paras).strip()
    return title, content


# ----------------------- Lấy metadata truyện -----------------------
def extract_metadata(page, folder):
    body = page.inner_text("body")
    meta = {"folder": folder, "source_url": STORY_URL_TMPL.format(folder=folder)}
    # Tên truyện = H1 đầu tiên không phải logo
    try:
        meta["title"] = page.locator("h1").first.inner_text().strip()
    except Exception:
        meta["title"] = page.title()

    def grab(label):
        # chỉ lấy phần còn lại TRÊN CÙNG DÒNG (tránh vớ nhầm dòng kế tiếp khi trống)
        m = re.search(re.escape(label) + r"[ \t]*([^\n]*)", body)
        return m.group(1).strip() if m else ""

    meta["author"] = grab("Tác Giả:")
    meta["translator"] = grab("Dịch Giả:")
    meta["status"] = grab("Tình Trạng:")
    # Tags nằm trong <p class="tags"> ... <a class="badge">Tên</a>
    tags = page.eval_on_selector_all(
        "p.tags a",
        "els => els.map(e => e.innerText.trim()).filter(Boolean)")
    meta["tags"] = tags
    # Mô tả: text sau "Giới Thiệu:" tới "Xem Giới Thiệu" hoặc "Danh Sách Chương"
    m = re.search(r"Giới Thiệu:.*?\n(.*?)(?:Xem Giới Thiệu|Danh Sách Chương)", body, re.S)
    meta["description"] = m.group(1).strip() if m else ""
    return meta


def get_chapter_list(page):
    """Trả về list[(index:int, title:str)] từ trang truyện."""
    items = page.eval_on_selector_all(
        "a[href^='#']",
        """els => els.map(e => ({href: e.getAttribute('href'), text: e.innerText.trim()}))
              .filter(o => /^Chương\\s*\\d/.test(o.text))""")
    seen, out = set(), []
    for it in items:
        m = re.match(r"^#(\d+)$", it["href"])
        if not m:
            continue
        idx = int(m.group(1))
        if idx in seen:
            continue
        seen.add(idx)
        out.append((idx, it["text"]))
    out.sort(key=lambda x: x[0])
    return out


# ----------------------- Main crawl -----------------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--folder", default="ta-tai")
    ap.add_argument("--start", type=int, default=1)
    ap.add_argument("--end", type=int, default=0, help="0 = tới chương cuối")
    ap.add_argument("--min-delay", type=float, default=2.0)
    ap.add_argument("--max-delay", type=float, default=4.0)
    ap.add_argument("--retries", type=int, default=4)
    args = ap.parse_args()

    story_dir = os.path.join(OUT_DIR, args.folder)
    chap_dir = os.path.join(story_dir, "chapters")
    os.makedirs(chap_dir, exist_ok=True)

    with sync_playwright() as pw:
        browser = pw.chromium.launch(channel="chrome", headless=True,
                                     args=["--disable-blink-features=AutomationControlled", "--no-sandbox"])
        ctx = browser.new_context(user_agent=UA, viewport={"width": 1366, "height": 900}, locale="vi-VN")
        page = ctx.new_page()

        story_url = STORY_URL_TMPL.format(folder=args.folder)
        print(f"[*] Mở trang truyện: {story_url}", file=sys.stderr)
        page.goto(story_url, wait_until="domcontentloaded", timeout=60000)
        # chờ qua Cloudflare
        for _ in range(40):
            if "Just a moment" not in page.title() and page.title().strip():
                break
            time.sleep(1)
        time.sleep(3)
        print(f"[*] Title: {page.title()!r}", file=sys.stderr)

        meta = extract_metadata(page, args.folder)
        chapters = get_chapter_list(page)
        meta["total_chapters"] = len(chapters)
        meta["crawled_at"] = time.strftime("%Y-%m-%d %H:%M:%S")
        with open(os.path.join(story_dir, "metadata.json"), "w", encoding="utf-8") as f:
            json.dump(meta, f, ensure_ascii=False, indent=2)
        # lưu danh sách chương riêng (index + tiêu đề từ trang mục lục)
        with open(os.path.join(story_dir, "chapter_list.json"), "w", encoding="utf-8") as f:
            json.dump([{"index": i, "title": t} for i, t in chapters], f, ensure_ascii=False, indent=2)

        print(f"[*] Truyện: {meta['title']}", file=sys.stderr)
        print(f"[*] Tác giả: {meta['author']} | Tổng chương phát hiện: {len(chapters)}", file=sys.stderr)

        title_by_idx = {i: t for i, t in chapters}
        last = args.end if args.end > 0 else (max(title_by_idx) if title_by_idx else 0)
        if last == 0:
            print("[!] Không phát hiện chương nào — dừng.", file=sys.stderr)
            browser.close()
            return

        ok = skip = fail = 0
        fails = []
        for ch in range(args.start, last + 1):
            out_path = os.path.join(chap_dir, f"chuong-{ch:04d}.json")
            if os.path.exists(out_path) and os.path.getsize(out_path) > 50:
                skip += 1
                continue

            api = API_TMPL.format(folder=args.folder, ch=ch)
            content = title = None
            for attempt in range(1, args.retries + 1):
                try:
                    res = page.evaluate(
                        """async (url) => {
                            const r = await fetch(url, {headers: {'X-Requested-With':'XMLHttpRequest'}});
                            return {status: r.status, body: await r.text()};
                        }""", api)
                    if res["status"] != 200:
                        raise RuntimeError(f"HTTP {res['status']}")
                    title, content = parse_chapter(res["body"])
                    if not content or len(content) < 20:
                        raise RuntimeError(f"nội dung rỗng/ngắn (len={len(content or '')})")
                    break
                except Exception as e:
                    wait = attempt * 3
                    print(f"    [retry {attempt}/{args.retries}] chương {ch}: {e} -> chờ {wait}s",
                          file=sys.stderr)
                    time.sleep(wait)
            else:
                fail += 1
                fails.append(ch)
                print(f"[FAIL] Chương {ch} bỏ qua sau {args.retries} lần thử.", file=sys.stderr)
                continue

            data = {
                "index": ch,
                "title": title or title_by_idx.get(ch, f"Chương {ch}"),
                "list_title": title_by_idx.get(ch, ""),
                "content": content,
                "char_count": len(content),
                "source": api,
            }
            with open(out_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            ok += 1
            if ok % 20 == 0 or ch == last:
                print(f"[*] Tiến độ: chương {ch}/{last} | mới={ok} bỏ-qua={skip} lỗi={fail}",
                      file=sys.stderr)
            time.sleep(random.uniform(args.min_delay, args.max_delay))

        if fails:
            with open(os.path.join(story_dir, "failed_chapters.json"), "w", encoding="utf-8") as f:
                json.dump(fails, f)
        print(f"\n[DONE] mới={ok} bỏ-qua={skip} lỗi={fail}", file=sys.stderr)
        if fails:
            print(f"[!] Các chương lỗi (chạy lại script để retry): {fails}", file=sys.stderr)
        browser.close()


if __name__ == "__main__":
    main()
