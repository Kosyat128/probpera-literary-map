import Link from "next/link";
import { notFound } from "next/navigation";

import { editorialPreviewFonts } from "@/components/EditorialPreviewFonts";
import previewStyles from "@/components/EditorialPreview.module.css";
import { formatDate } from "@/lib/format";
import {
  pageCatalogPageNumber,
  pageEditorHref,
  parsePageCatalogQuery,
} from "@/lib/page-catalog-query";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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
  const { id } = await params;
  const query = await searchParams;
  const catalog = parsePageCatalogQuery(query);
  const revisionPage = pageCatalogPageNumber(query.revision_page);
  const supabase = await createServerSupabaseClient();
  if (!supabase) notFound();
  const { data: page } = await supabase
    .from("pages")
    .select("title,excerpt,content_html,updated_at,status")
    .eq("id", id)
    .maybeSingle();
  if (!page) notFound();

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
          dangerouslySetInnerHTML={{ __html: page.content_html || "" }}
        />
      </article>
    </>
  );
}
