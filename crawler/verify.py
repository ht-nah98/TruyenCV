#!/usr/bin/env python3
"""
Kiểm tra toàn vẹn dữ liệu crawler: phát hiện chương thiếu, file rỗng, nội dung quá ngắn.

Dùng:  python3 verify.py                  # kiểm tra mọi truyện trong output/
       python3 verify.py <folder>         # chỉ 1 truyện
       python3 verify.py --min 500        # đổi ngưỡng nội dung tối thiểu (mặc định 500 ký tự)
"""
import argparse
import json
import os
import sys

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output")


def verify_one(folder, min_len=500):
    story_dir = os.path.join(OUT, folder)
    chap_dir = os.path.join(story_dir, "chapters")
    meta_path = os.path.join(story_dir, "metadata.json")

    if not os.path.isdir(chap_dir):
        print(f"[{folder}] BỎ QUA: không có thư mục chapters/")
        return

    meta = {}
    if os.path.exists(meta_path):
        try:
            meta = json.load(open(meta_path, encoding="utf-8"))
        except Exception:
            pass
    declared = meta.get("total_chapters") or 0

    # đọc các file chương
    indexes = []
    short = []
    bad = []
    for f in sorted(os.listdir(chap_dir)):
        if not f.endswith(".json"):
            continue
        path = os.path.join(chap_dir, f)
        try:
            d = json.load(open(path, encoding="utf-8"))
        except Exception as e:
            bad.append((f, str(e)))
            continue
        i = d.get("index")
        content = d.get("content") or ""
        if not isinstance(i, int):
            bad.append((f, "thiếu index"))
            continue
        indexes.append(i)
        if len(content) < min_len:
            short.append((i, len(content)))

    indexes_set = set(indexes)
    have = len(indexes_set)
    lo = min(indexes_set) if indexes_set else 0
    hi = max(indexes_set) if indexes_set else 0
    # ước tính chương thiếu (giả sử cần liên tục 1..max)
    target = declared if declared and declared >= hi else hi
    expected = set(range(1, target + 1)) if target else set()
    missing = sorted(expected - indexes_set)

    print(f"\n=== {folder} ===")
    print(f"  Đã có: {have} chương | Phạm vi: {lo}..{hi} | Khai báo: {declared}")
    print(f"  Thiếu: {len(missing)} chương" + (f" -> {missing[:30]}{'...' if len(missing)>30 else ''}" if missing else ""))
    print(f"  File hỏng: {len(bad)}" + ("" if not bad else f" -> {[b[0] for b in bad[:5]]}"))
    print(f"  Nội dung ngắn (< {min_len} ký tự): {len(short)}" + ("" if not short else f" -> {short[:10]}"))

    return {"folder": folder, "have": have, "missing": missing, "bad": [b[0] for b in bad], "short": short}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("folder", nargs="?", default=None)
    ap.add_argument("--min", type=int, default=500)
    args = ap.parse_args()

    if args.folder:
        folders = [args.folder]
    else:
        folders = [d for d in sorted(os.listdir(OUT)) if os.path.isdir(os.path.join(OUT, d))]

    results = []
    for f in folders:
        r = verify_one(f, args.min)
        if r:
            results.append(r)

    print("\n=== Tổng kết ===")
    for r in results:
        ok = len(r["missing"]) == 0 and len(r["bad"]) == 0
        flag = "✅" if ok else "⚠️"
        print(f"  {flag} {r['folder']}: {r['have']} chương | thiếu={len(r['missing'])} hỏng={len(r['bad'])} ngắn={len(r['short'])}")


if __name__ == "__main__":
    main()
