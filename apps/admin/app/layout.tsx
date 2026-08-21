import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";
import SafeBrowserStorageBootstrap from "@/components/SafeBrowserStorageBootstrap";
import { getAdminBasePathFromEnv } from "@/lib/admin-path";

// A nonce-based CSP is generated for every request. Force dynamic rendering so
// Next.js can attach that fresh nonce to framework and page scripts.
export const dynamic = "force-dynamic";

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
      <body data-admin-base-path={adminBasePath || undefined}>
        <SafeBrowserStorageBootstrap />
        {children}
      </body>
    </html>
  );
}
