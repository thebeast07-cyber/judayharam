import "./globals.css";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Judi Haram — demo edukasi",
  description:
    "Simulasi slot bohongan tanpa deposit dan tanpa WD. Tujuannya nunjukin siapa yang sebenernya ngatur menang-kalah.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#050b1c",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
