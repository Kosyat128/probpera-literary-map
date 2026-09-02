"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { ArticleEditorWorkspaceProvider } from "@/components/ArticleEditorContext";
import ArticleWorkspaceTools from "@/components/ArticleWorkspaceTools";
import AdminCommandPalette from "@/components/AdminCommandPalette";
import {
  adminCommandEntries,
  adminSidebarEntries,
} from "@/lib/admin-module-registry";
import type { StaffSession } from "@/lib/auth";
import { adminBasePath, withAdminBasePath } from "@/lib/navigation";
import { safePublicSiteOrigin } from "@/lib/public-link-boundary";
import { logoutAction } from "@/app/(auth)/login/actions";

// Canonical registry marker retained for the typography navigation contract:
// ["✦", "Студия сайта", "/site-studio"]

function isArticleEditorPath(pathname: string) {
  return /^\/articles\/(?:new|edit|[0-9a-f-]{36})$/iu.test(pathname);
}

export default function AdminShell({
  session,
  publicSiteUrl,
  children,
}: {
  session: StaffSession & { user: NonNullable<StaffSession["user"]>; role: NonNullable<StaffSession["role"]> };
  publicSiteUrl: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const normalizedPathname =
    !adminBasePath
      ? pathname
      : pathname === adminBasePath
        ? "/"
        : pathname.startsWith(`${adminBasePath}/`)
          ? pathname.slice(adminBasePath.length) || "/"
          : pathname;
  const publicSiteOrigin = safePublicSiteOrigin(publicSiteUrl);
  const showArticleWorkspace = isArticleEditorPath(normalizedPathname);

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
              <Link className="admin-brand" href={withAdminBasePath("/dashboard")}>
          <span className="brand-mark" aria-hidden="true">П</span>
          <span>
            <strong>Проба Пера</strong>
            <small>Редакционная система</small>
          </span>
        </Link>
        <nav className="admin-nav" aria-label="Разделы панели">
          {adminSidebarEntries.map(([icon, label, href]) => (
            <span key={href}>
              {href === "/menus" && <span className="nav-divider" aria-hidden="true" />}
              <Link
                href={withAdminBasePath(href)}
                aria-current={
                  normalizedPathname === href ||
                  normalizedPathname.startsWith(`${href}/`)
                    ? "page"
                    : undefined
                }
              >
                <span aria-hidden="true">{icon}</span>
                <span>{label}</span>
              </Link>
            </span>
          ))}
        </nav>
        <div className="sidebar-profile">
          <strong>{session.user.email}</strong>
          <small>
            {session.role === "owner"
              ? "Владелец"
              : session.role === "admin"
                ? "Администратор"
                : "Редактор"}
          </small>
          <form action={logoutAction}>
            <button type="submit">Выйти из кабинета</button>
          </form>
        </div>
      </aside>
      <div className="admin-main">
        <header className="admin-topbar">
          <p>Все изменения сохраняются в истории редакции</p>
          <div className="admin-topbar-actions">
            <AdminCommandPalette entries={adminCommandEntries} />
            <a href={publicSiteOrigin} target="_blank" rel="noreferrer">
              Открыть сайт ↗
            </a>
          </div>
        </header>
        <main
          className={
            showArticleWorkspace
              ? "admin-content article-workspace-page"
              : "admin-content"
          }
        >
          {showArticleWorkspace ? (
            <ArticleEditorWorkspaceProvider>
              <ArticleWorkspaceTools />
              {children}
            </ArticleEditorWorkspaceProvider>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
