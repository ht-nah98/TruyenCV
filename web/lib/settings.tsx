"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";

export type Theme = "light" | "dark" | "sepia" | "black";

export interface ReaderSettings {
  theme: Theme;
  fontSize: number; // px
  lineHeight: number;
  fontFamily: string;
  width: number; // px (độ rộng cột đọc)
  paraGap: number; // em
}

const DEFAULTS: ReaderSettings = {
  theme: "light",
  fontSize: 20,
  lineHeight: 1.8,
  fontFamily: 'Georgia, "Times New Roman", serif',
  width: 720,
  paraGap: 1,
};

export const FONT_OPTIONS = [
  { label: "Serif", value: 'Georgia, "Times New Roman", serif' },
  { label: "Sans", value: '-apple-system, "Segoe UI", Roboto, sans-serif' },
  { label: "Mono", value: '"SF Mono", Consolas, monospace' },
  {
    label: "Đọc sách",
    value: '"Bookerly", "Literata", Georgia, serif',
  },
];

const STORAGE_KEY = "reader-settings-v1";

interface Ctx {
  settings: ReaderSettings;
  update: (patch: Partial<ReaderSettings>) => void;
  reset: () => void;
}

const SettingsContext = createContext<Ctx | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<ReaderSettings>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  // Nạp từ localStorage 1 lần
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSettings({ ...DEFAULTS, ...JSON.parse(raw) });
    } catch {}
    setLoaded(true);
  }, []);

  // Áp dụng vào :root + lưu lại
  useEffect(() => {
    if (!loaded) return;
    const root = document.documentElement;
    root.setAttribute("data-theme", settings.theme);
    root.style.setProperty("--reader-font-size", `${settings.fontSize}px`);
    root.style.setProperty("--reader-line-height", String(settings.lineHeight));
    root.style.setProperty("--reader-font-family", settings.fontFamily);
    root.style.setProperty("--reader-width", `${settings.width}px`);
    root.style.setProperty("--reader-para-gap", `${settings.paraGap}em`);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {}
  }, [settings, loaded]);

  const update = useCallback((patch: Partial<ReaderSettings>) => {
    setSettings((s) => ({ ...s, ...patch }));
  }, []);

  const reset = useCallback(() => setSettings(DEFAULTS), []);

  return (
    <SettingsContext.Provider value={{ settings, update, reset }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}

/** Script chèn sớm để tránh nháy theme (FOUC) trước khi React hydrate. */
export const themeInitScript = `
(function(){
  try {
    var s = JSON.parse(localStorage.getItem('${STORAGE_KEY}') || '{}');
    var root = document.documentElement;
    root.setAttribute('data-theme', s.theme || 'light');
    if (s.fontSize) root.style.setProperty('--reader-font-size', s.fontSize + 'px');
    if (s.lineHeight) root.style.setProperty('--reader-line-height', String(s.lineHeight));
    if (s.fontFamily) root.style.setProperty('--reader-font-family', s.fontFamily);
    if (s.width) root.style.setProperty('--reader-width', s.width + 'px');
    if (s.paraGap) root.style.setProperty('--reader-para-gap', s.paraGap + 'em');
  } catch(e){}
})();
`;
