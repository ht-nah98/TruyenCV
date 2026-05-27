"use client";

import { useState, useEffect } from "react";
import {
  useSettings,
  FONT_OPTIONS,
  type Theme,
} from "@/lib/settings";

const THEMES: { value: Theme; label: string }[] = [
  { value: "light", label: "Sáng" },
  { value: "sepia", label: "Sepia" },
  { value: "dark", label: "Tối" },
  { value: "black", label: "Đen (OLED)" },
];

export function SettingsButton({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="btn icon"
        onClick={() => setOpen(true)}
        aria-label="Cài đặt hiển thị"
        title="Cài đặt hiển thị"
      >
        {compact ? "⚙︎" : "⚙︎ Hiển thị"}
      </button>
      {open && <SettingsPanel onClose={() => setOpen(false)} />}
    </>
  );
}

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const { settings, update, reset } = useSettings();

  // Khóa cuộn nền + đóng bằng Esc khi panel mở
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div className="panel-overlay" onClick={onClose}>
      <div className="panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="panel-header">
          <h3>Tùy chỉnh hiển thị</h3>
          <button className="btn icon panel-close" onClick={onClose} aria-label="Đóng">✕</button>
        </div>

        <div className="field">
          <label>Giao diện (màu nền)</label>
          <div className="seg">
            {THEMES.map((t) => (
              <button
                key={t.value}
                className={settings.theme === t.value ? "active" : ""}
                onClick={() => update({ theme: t.value })}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Phông chữ</label>
          <div className="seg">
            {FONT_OPTIONS.map((f) => (
              <button
                key={f.value}
                className={settings.fontFamily === f.value ? "active" : ""}
                onClick={() => update({ fontFamily: f.value })}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Cỡ chữ: {settings.fontSize}px</label>
          <input
            type="range"
            min={14}
            max={36}
            step={1}
            value={settings.fontSize}
            onChange={(e) => update({ fontSize: Number(e.target.value) })}
          />
        </div>

        <div className="field">
          <label>Giãn dòng: {settings.lineHeight.toFixed(2)}</label>
          <input
            type="range"
            min={1.2}
            max={2.4}
            step={0.05}
            value={settings.lineHeight}
            onChange={(e) => update({ lineHeight: Number(e.target.value) })}
          />
        </div>

        <div className="field">
          <label>Khoảng cách đoạn: {settings.paraGap.toFixed(2)}em</label>
          <input
            type="range"
            min={0.3}
            max={2.5}
            step={0.1}
            value={settings.paraGap}
            onChange={(e) => update({ paraGap: Number(e.target.value) })}
          />
        </div>

        <div className="field">
          <label>Độ rộng cột: {settings.width}px</label>
          <input
            type="range"
            min={520}
            max={1100}
            step={20}
            value={settings.width}
            onChange={(e) => update({ width: Number(e.target.value) })}
          />
        </div>

        <button className="btn" style={{ width: "100%", marginTop: 8 }} onClick={reset}>
          Khôi phục mặc định
        </button>
      </div>
    </div>
  );
}
