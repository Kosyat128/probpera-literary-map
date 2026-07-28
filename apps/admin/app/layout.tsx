import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Редакция — Проба Пера",
    template: "%s — Редакция «Пробы Пера»",
  },
  description:
    "Защищённый редакционный кабинет литературного журнала «Проба Пера».",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    nocache: true,
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
