import Link from "next/link";
import { notFound } from "next/navigation";

import { articleEditPath } from "@/lib/admin-routes";
import { formatDate } from "@/lib/format";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata = { title: "Предпросмотр статьи" };

export default async function ArticlePreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  if (!supabase) notFound();
  const { data: article } = await supabase
    .from("articles")
    .select("title,subtitle,excerpt,content_html,cover_external_url,cover_alt,updated_at,status,categories(name)")
    .eq("id", id)
    .maybeSingle();
  if (!article) notFound();
  const categoryValue = article.categories as unknown;
  const category = Array.isArray(categoryValue)
    ? (categoryValue[0] as { name?: string } | undefined)
    : (categoryValue as { name?: string } | null);

  return (
    <>
      <header className="page-heading preview-toolbar">
        <div>
          <span className="eyebrow">Закрытый предпросмотр · {article.status}</span>
          <h1>Так материал увидит читатель</h1>
          <p>Страница доступна только редакции и не индексируется.</p>
        </div>
        <Link className="button-secondary" href={articleEditPath(id)}>
          ← Вернуться в редактор
        </Link>
      </header>
      <article className="admin-article-preview">
        <header>
          <span>{category?.name || "Материалы"}</span>
          <h1>{article.title}</h1>
          {article.subtitle && <p>{article.subtitle}</p>}
          <small>Обновлено {formatDate(article.updated_at, true)}</small>
        </header>
        {article.cover_external_url && (
          <figure>
            <img src={article.cover_external_url} alt={article.cover_alt || ""} />
            {article.cover_alt && <figcaption>{article.cover_alt}</figcaption>}
          </figure>
        )}
        {article.excerpt && <p className="preview-lead">{article.excerpt}</p>}
        <div
          className="preview-prose"
          dangerouslySetInnerHTML={{ __html: article.content_html || "" }}
        />
      </article>
    </>
  );
}
