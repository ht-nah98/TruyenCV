# TruyenChu — Web đọc truyện cá nhân

Thư viện truyện đa bộ, đọc trên web desktop & mobile. Crawler riêng cho từng nguồn,
web đọc Next.js (App Router) tải nội dung động phía client, sẵn sàng deploy Vercel.

## Cấu trúc

```
TruyenChu/
├── crawler/                # Crawler Python
│   ├── crawl.py            # Cho truyenss.com (Playwright + Cloudflare bypass)
│   ├── crawl_tvtruyen.py   # Cho tvtruyen.co.uk (requests thuần)
│   ├── verify.py           # Kiểm tra toàn vẹn (chương thiếu / hỏng)
│   └── output/<slug>/{metadata.json, chapter_list.json, chapters/chuong-XXXX.json}
└── web/                    # Next.js app
    ├── scripts/build-data.mjs   # Quét output/ -> public/data/ (đa truyện)
    ├── app/                # Routes: /, /truyen/[slug], /truyen/[slug]/chuong/[index]
    ├── components/         # Reader, ChapterBrowser, LibraryView, SettingsPanel
    ├── lib/                # data, client-data, settings, progress
    └── vercel.json         # Cache headers cho /data/
```

## Crawl truyện mới

**Từ truyenss.com:**
```bash
cd crawler
python3 crawl.py --folder <slug>           # vd: ta-tai
```

**Từ tvtruyen.co.uk:**
```bash
cd crawler
python3 crawl_tvtruyen.py --slug <slug> --end <total>
```

Cả hai crawler đều có resume (skip chương đã tải) và retry. Chạy lại lệnh để retry chương lỗi (`failed_chapters.json`).

## Chạy web local

```bash
cd web
npm install
npm run dev   # tự chạy scripts/build-data.mjs trước, mở http://localhost:3000
```

Mỗi lần crawler tải thêm chương, chạy `npm run data` để cập nhật web.

## Deploy lên Vercel

1. Đảm bảo đã chạy `npm run data` để `public/data/` có đủ truyện.
2. `vercel deploy` (hoặc kết nối GitHub repo).
3. `vercel.json` đã cấu hình cache CDN dài hạn cho data (`chapters/*.json` cache 1 năm immutable).

Dung lượng dự kiến: ~34 MB cho 2 bộ truyện (3727 file JSON nhỏ) — an toàn với mọi plan Vercel.

## Tính năng web

- **Đa truyện**: trang chủ là thư viện, mỗi truyện URL riêng.
- **Đọc động**: nội dung chương fetch khi cần, prefetch chương trước/sau → chuyển mượt.
- **Responsive**: tối ưu cho mobile (bottom-bar điều hướng, bottom-sheet settings, safe-area).
- **Tùy chỉnh hiển thị**: 4 theme (Sáng/Sepia/Tối/Đen OLED), 4 phông, slider cho cỡ chữ / giãn dòng / khoảng cách đoạn / độ rộng cột.
- **Tiến độ đọc**: lưu vị trí cuộn, đánh dấu chương đã đọc, "tiếp tục đọc dở" — riêng cho từng truyện.
- **Tìm kiếm**: theo tên chương hoặc số chương trong mục lục.
- **Phím tắt**: ← → chuyển chương, H về mục lục.

## Kiểm tra toàn vẹn

```bash
cd crawler
python3 verify.py                 # tất cả truyện
python3 verify.py ta-tai          # 1 truyện cụ thể
```

Báo cáo: số chương đã có, chương thiếu, file hỏng, chương nội dung ngắn bất thường.
