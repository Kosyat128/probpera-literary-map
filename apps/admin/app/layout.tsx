import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";
import { getAdminBasePathFromEnv } from "@/lib/admin-path";

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
  const adminBasePath = getAdminBasePathFromEnv(process.env.ADMIN_BASE_PATH);

  return (
    <html lang="ru">
      <body data-admin-base-path={adminBasePath || undefined}>{children}</body>
    </html>
  );
}
