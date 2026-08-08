import Link from "next/link";
import { notFound } from "next/navigation";

import { articleEditPath } from "@/lib/admin-routes";
import { formatDate } from "@/lib/format";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata = { title: "Предпросмотр статьи" };

export default async function ArticlePreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ locale?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const locale = query.locale === "en" ? "en" : "ru";
  const supabase = await createServerSupabaseClient();
  if (!supabase) notFound();
  const [{ data: article }, { data: englishTranslation }] = await Promise.all([
    supabase
      .from("articles")
      .select("title,subtitle,excerpt,content_html,cover_external_url,cover_alt,updated_at,status,categories(name)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("article_translations")
      .select("title,subtitle,excerpt,content_html,cover_alt,updated_at,status")
      .eq("article_id", id)
      .eq("locale", "en")
      .maybeSingle(),
  ]);
  if (!article) notFound();
  const categoryValue = article.categories as unknown;
  const category = Array.isArray(categoryValue)
    ? (categoryValue[0] as { name?: string } | undefined)
    : (categoryValue as { name?: string } | null);
  const localizedArticle = locale === "en" ? englishTranslation : article;
  const localizedUpdatedAt = localizedArticle
    ? locale === "en"
      ? new Intl.DateTimeFormat("en-GB", {
          dateStyle: "long",
          timeStyle: "short",
        }).format(new Date(localizedArticle.updated_at))
      : formatDate(localizedArticle.updated_at, true)
    : "";

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
      <nav className="article-language-tabs" aria-label="Язык предпросмотра">
        <Link
          className={locale === "ru" ? "is-active" : undefined}
          href={`/articles/${id}/preview?locale=ru`}
        >
          RU · оригинал
        </Link>
        <Link
          className={locale === "en" ? "is-active" : undefined}
          href={`/articles/${id}/preview?locale=en`}
        >
          EN · перевод
        </Link>
      </nav>
      {locale === "en" && !englishTranslation && (
        <p className="form-message" role="status">
          Английская версия ещё не создана. Русский текст не подставляется вместо
          перевода.
        </p>
      )}
      {localizedArticle && <article className="admin-article-preview">
        <header>
          <span>{locale === "en" ? "Article" : category?.name || "Материалы"}</span>
          <h1>{localizedArticle.title}</h1>
          {localizedArticle.subtitle && <p>{localizedArticle.subtitle}</p>}
          <small>
            {locale === "en" ? "Updated" : "Обновлено"}{" "}
            {localizedUpdatedAt} · {localizedArticle.status}
          </small>
        </header>
        {article.cover_external_url && (
          <figure>
            <img
              src={article.cover_external_url}
              alt={localizedArticle.cover_alt || ""}
            />
            {localizedArticle.cover_alt && (
              <figcaption>{localizedArticle.cover_alt}</figcaption>
            )}
          </figure>
        )}
        {localizedArticle.excerpt && (
          <p className="preview-lead">{localizedArticle.excerpt}</p>
        )}
        <div
          className="preview-prose"
          dangerouslySetInnerHTML={{ __html: localizedArticle.content_html || "" }}
        />
      </article>}
    </>
  );
}
