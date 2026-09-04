import Link from "next/link";
import { notFound } from "next/navigation";

import { editorialPreviewFonts } from "@/components/EditorialPreviewFonts";
import previewStyles from "@/components/EditorialPreview.module.css";
import { articleEditPath } from "@/lib/admin-routes";
import { formatDate } from "@/lib/format";
import { operatorDataError } from "@/lib/operator-data-error";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  parseArticleWorkingDraft,
  previewEnglishTranslationWithWorkingDraft,
} from "../../article-working-draft";

export const metadata = { title: "Предпросмотр статьи" };

export default async function ArticlePreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ locale?: string; viewport?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const locale = query.locale === "en" ? "en" : "ru";
  const viewport = ["desktop", "tablet", "mobile"].includes(
    query.viewport || ""
  )
    ? (query.viewport as "desktop" | "tablet" | "mobile")
    : "desktop";
  const previewHref = (
    nextLocale: "ru" | "en" = locale,
    nextViewport: "desktop" | "tablet" | "mobile" = viewport
  ) =>
    `/articles/${id}/preview?locale=${nextLocale}&viewport=${nextViewport}`;
  const supabase = await createServerSupabaseClient();
  if (!supabase) notFound();
  const [
    { data: article },
    { data: englishTranslation },
    { data: workingDraftResult, error: workingDraftQueryError },
    { data: categoriesResult },
  ] = await Promise.all([
    supabase
      .from("articles")
      .select("id,title,subtitle,excerpt,content_html,cover_external_url,cover_alt,updated_at,status,category_id,categories(name)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("article_translations")
      .select("title,subtitle,excerpt,content_html,cover_alt,updated_at,status")
      .eq("article_id", id)
      .eq("locale", "en")
      .maybeSingle(),
    supabase
      .from("article_working_drafts")
      .select(
        "article_id,base_article_updated_at,payload,english_payload,expected_english_updated_at,version,updated_at"
      )
      .eq("article_id", id)
      .maybeSingle(),
    supabase
      .from("categories")
      .select("id,name")
      .eq("is_visible", true),
  ]);
  if (!article) notFound();
  let workingDraft = null;
  let workingDraftLoadError = workingDraftQueryError
    ? operatorDataError("articles", "load")
    : null;
  if (workingDraftResult && !workingDraftLoadError) {
    try {
      workingDraft = parseArticleWorkingDraft(workingDraftResult);
    } catch (error) {
      workingDraftLoadError =
        error instanceof Error
          ? error.message
          : "Рабочий черновик повреждён и не был открыт.";
    }
  }
  const previewArticle = workingDraft
    ? {
        ...article,
        ...workingDraft.payload,
        id: article.id,
        updated_at: workingDraft.updated_at,
      }
    : article;
  const previewEnglishTranslation = workingDraft
    ? previewEnglishTranslationWithWorkingDraft(
        englishTranslation || null,
        workingDraft
      )
    : englishTranslation;
  const categoryValue = previewArticle.categories as unknown;
  const category = Array.isArray(categoryValue)
    ? (categoryValue[0] as { name?: string } | undefined)
    : (categoryValue as { name?: string } | null);
  const draftCategory = workingDraft
    ? (categoriesResult || []).find(
        (item) => item.id === previewArticle.category_id
      )
    : null;
  const localizedArticle = workingDraftLoadError
    ? null
    : locale === "en"
      ? previewEnglishTranslation
      : previewArticle;
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
          <span className="eyebrow">
            {workingDraft
              ? "Сохранённый рабочий черновик · публичная версия не изменена"
              : `Закрытый предпросмотр · ${article.status}`}
          </span>
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
          href={previewHref("ru")}
        >
          RU · оригинал
        </Link>
        <Link
          className={locale === "en" ? "is-active" : undefined}
          href={previewHref("en")}
        >
          EN · перевод
        </Link>
      </nav>
      <nav className="preview-device-tabs" aria-label="Ширина предпросмотра">
        {(
          [
            ["desktop", "Компьютер"],
            ["tablet", "Планшет"],
            ["mobile", "Телефон"],
          ] as const
        ).map(([id, label]) => (
          <Link
            key={id}
            className={viewport === id ? "is-active" : undefined}
            aria-current={viewport === id ? "page" : undefined}
            href={previewHref(locale, id)}
          >
            {label}
          </Link>
        ))}
      </nav>
      {workingDraftLoadError && (
        <p className="form-message" role="alert">
          {workingDraftLoadError}
        </p>
      )}
      {locale === "en" && !previewEnglishTranslation && (
        <p className="form-message" role="status">
          Английская версия ещё не создана. Русский текст не подставляется вместо
          перевода.
        </p>
      )}
      {localizedArticle && <article className={`admin-article-preview is-${viewport} ${editorialPreviewFonts} ${previewStyles.fonts} ${previewStyles.reader}`}>
        <header>
          <span>
            {locale === "en"
              ? "Article"
              : workingDraft
                ? draftCategory?.name || "Материалы"
                : category?.name || "Материалы"}
          </span>
          <h1>{localizedArticle.title}</h1>
          {localizedArticle.subtitle && <p>{localizedArticle.subtitle}</p>}
          <small>
            {locale === "en" ? "Updated" : "Обновлено"}{" "}
            {localizedUpdatedAt} · {localizedArticle.status}
          </small>
        </header>
        {localizedArticle.excerpt && (
          <p className="preview-lead">{localizedArticle.excerpt}</p>
        )}
        {previewArticle.cover_external_url && (
          <figure>
            <img
              src={previewArticle.cover_external_url}
              alt={localizedArticle.cover_alt || ""}
            />
            {localizedArticle.cover_alt && (
              <figcaption>{localizedArticle.cover_alt}</figcaption>
            )}
          </figure>
        )}
        <div
          className="preview-prose"
          dangerouslySetInnerHTML={{ __html: localizedArticle.content_html || "" }}
        />
      </article>}
    </>
  );
}
