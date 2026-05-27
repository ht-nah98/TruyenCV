import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SettingsProvider, themeInitScript } from "@/lib/settings";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f3ec" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1a1a" },
  ],
};

export const metadata: Metadata = {
  title: "Tủ Truyện",
  description: "Đọc truyện online — thư viện cá nhân",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <SettingsProvider>{children}</SettingsProvider>
      </body>
    </html>
  );
}
