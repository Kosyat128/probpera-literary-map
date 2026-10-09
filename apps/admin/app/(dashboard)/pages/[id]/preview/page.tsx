import Link from "next/link";
import { notFound } from "next/navigation";
import AdminStatusState from "@/components/AdminStatusState";
import { AdminDependencyState } from "@/components/AdminStatusState";
import { adminReadMessage, readAdminResult } from "@/lib/admin-read-result";
import { getAdminBasePathFromEnv } from "@/lib/admin-path";
import { validPagePreviewRead, type PagePreviewRead } from "@/lib/page-load-validation";

import { editorialPreviewFonts } from "@/components/EditorialPreviewFonts";
import previewStyles from "@/components/EditorialPreview.module.css";
import { formatDate } from "@/lib/format";
import {
  pageCatalogPageNumber,
  pageEditorHref,
  parsePageCatalogQuery,
} from "@/lib/page-catalog-query";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireStaffRead } from "@/lib/admin-read-access";

export const metadata = {
  title: "Предпросмотр страницы",
  robots: { index: false, follow: false },
};

export default async function PagePreview({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    q?: string;
    status?: string;
    page?: string;
    revision_page?: string;
  }>;
}) {
  const staff = await requireStaffRead();
  if (!staff) return <AdminStatusState eyebrow="Доступ ограничен"
    title="Редакционные данные недоступны"
    description="Не удалось подтвердить редакционную роль. Обратитесь к владельцу сайта." />;
  const { id } = await params;
  const query = await searchParams;
  const catalog = parsePageCatalogQuery(query);
  const revisionPage = pageCatalogPageNumber(query.revision_page);
  const editorHref = pageEditorHref(id, catalog, { revisionPage });
  const editorUrl = new URL(editorHref, "https://admin.invalid");
  const retryHref = getAdminBasePathFromEnv(process.env.ADMIN_BASE_PATH) + editorUrl.pathname + "/preview" + editorUrl.search;
  const supabase = await createServerSupabaseClient();
  if (!supabase) return <AdminDependencyState />;
  const [response] = await Promise.allSettled([supabase
    .from("pages")
    .select("id,title,excerpt,content_html,updated_at,status")
    .eq("id", id)
    .maybeSingle()]);
  const pageRead = readAdminResult<PagePreviewRead | null>(response,
    value => value === null || validPagePreviewRead(value, id));
  if (pageRead.status === "failed") return <AdminStatusState eyebrow="Предпросмотр страницы"
    title="Не удалось загрузить предпросмотр" description={adminReadMessage(pageRead.issue)}
    action={<a href={retryHref}>Повторить загрузку</a>} />;
  if (pageRead.data === null) notFound();
  const page = pageRead.data;

  return (
    <>
      <header className="page-heading preview-toolbar">
        <div>
          <span className="eyebrow">Закрытый предпросмотр · {page.status}</span>
          <h1>Так страницу увидит читатель</h1>
          <p>Предпросмотр доступен только редакции и не индексируется.</p>
        </div>
        <Link className="button-secondary" href={pageEditorHref(id, catalog, { revisionPage })}>
          ← Вернуться в редактор
        </Link>
      </header>
      <article className={`admin-article-preview admin-page-preview ${editorialPreviewFonts} ${previewStyles.fonts} ${previewStyles.reader}`}>
        <header>
          <span>Проба Пера</span>
          <h1>{page.title}</h1>
          {page.excerpt && <p>{page.excerpt}</p>}
          <small>Обновлено {formatDate(page.updated_at, true)}</small>
        </header>
        <div
          className="preview-prose"
          dangerouslySetInnerHTML={{ __html: page.content_html }}
        />
      </article>
    </>
  );
}
