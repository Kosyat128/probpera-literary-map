import Link from "next/link";
import { notFound } from "next/navigation";

import ArticleLoadState from "@/components/ArticleLoadState";
import { AdminDependencyState } from "@/components/AdminStatusState";
import AdminStatusState from "@/components/AdminStatusState";
import { editorialPreviewFonts } from "@/components/EditorialPreviewFonts";
import previewStyles from "@/components/EditorialPreview.module.css";
import { getAdminBasePathFromEnv } from "@/lib/admin-path";
import { isReadRecord, readAdminList, readAdminResult, rethrowAdminReadControlFlow } from "@/lib/admin-read-result";
import { sameArticleId } from "@/lib/article-load-validation";
import { articleEditPath } from "@/lib/admin-routes";
import { formatDate } from "@/lib/format";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requireStaffRead } from "@/lib/admin-read-access";
import {
  parseArticleWorkingDraft,
  previewEnglishTranslationWithWorkingDraft,
} from "../../article-working-draft";

type PreviewText = {
  title: string;
  subtitle: string | null;
  excerpt: string | null;
  content_html: string;
  cover_alt: string | null;
  updated_at: string;
  status: string;
};
type PreviewCategory = { name: string };
type PreviewArticle = PreviewText & {
  id: string;
  cover_external_url: string | null;
  category_id: string | null;
  categories: PreviewCategory | PreviewCategory[] | null;
};

const nullableText = (value: unknown) => value === null || typeof value === "string";
const validCategory = (value: unknown): value is PreviewCategory =>
  isReadRecord(value) && typeof value.name === "string";

// Validate only this page's selected fields, without replacing editorial values.
function validPreviewText(value: unknown): value is PreviewText {
  return isReadRecord(value) &&
    typeof value.title === "string" && typeof value.content_html === "string" &&
    ["subtitle", "excerpt", "cover_alt"].every((field) => nullableText(value[field])) &&
    typeof value.updated_at === "string" && value.updated_at.trim().length > 0 &&
    Number.isFinite(new Date(value.updated_at).getTime()) &&
    typeof value.status === "string";
}

function validPreviewArticle(value: unknown, id: string): value is PreviewArticle {
  if (!validPreviewText(value) || !isReadRecord(value)) return false;
  const row = value as PreviewText & Record<string, unknown>;
  const category = row.categories;
  return sameArticleId(row.id, id) && nullableText(row.cover_external_url) &&
    nullableText(row.category_id) &&
    ["draft", "review", "scheduled", "published", "hidden", "archived"].includes(value.status) &&
    (category === null || validCategory(category) ||
      (Array.isArray(category) && category.length <= 1 && category.every(validCategory)));
}

function validPreviewEnglish(value: unknown, id: string): value is PreviewText {
  if (!validPreviewText(value) || !isReadRecord(value)) return false;
  const row = value as PreviewText & Record<string, unknown>;
  return sameArticleId(row.article_id, id) && row.locale === "en" &&
    ["draft", "review", "approved", "published", "stale", "archived"].includes(value.status);
}

export const metadata = { title: "Предпросмотр статьи" };

export default async function ArticlePreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ locale?: string; viewport?: string }>;
}) {
  const staff = await requireStaffRead();
  if (!staff) return <AdminStatusState eyebrow="Доступ ограничен"
    title="Редакционные данные недоступны"
    description="Не удалось подтвердить редакционную роль. Обратитесь к владельцу сайта." />;
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
  const retryHref = `${getAdminBasePathFromEnv(process.env.ADMIN_BASE_PATH)}/articles/${encodeURIComponent(id)}/preview?locale=${locale}&viewport=${viewport}`;
  const supabase = await createServerSupabaseClient();
  if (!supabase) return <><AdminDependencyState /><div className="state-actions"><a className="button-secondary" href={retryHref}>Повторить загрузку</a></div></>;
  const [
    articleResult,
    englishResult,
    workingDraftResult,
    categoriesResult,
  ] = await Promise.allSettled([
    supabase
      .from("articles")
      .select("id,title,subtitle,excerpt,content_html,cover_external_url,cover_alt,updated_at,status,category_id,categories(name)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("article_translations")
      .select("article_id,locale,title,subtitle,excerpt,content_html,cover_alt,updated_at,status")
      .eq("article_id", id)
      .eq("locale", "en")
      .maybeSingle(),
    supabase
      .from("article_working_drafts")
      .select(
        "article_id,base_article_updated_at,payload,english_payload,expected_english_updated_at,draft_scope,draft_english_enabled,version,updated_at"
      )
      .eq("article_id", id)
      .maybeSingle(),
    supabase
      .from("categories")
      .select("id,name")
      .eq("is_visible", true),
  ]);

  rethrowAdminReadControlFlow(articleResult, englishResult, workingDraftResult, categoriesResult);
  const articleRead = readAdminResult(articleResult, (data) =>
    data === null || validPreviewArticle(data, id));
  if (articleRead.status === "failed") {
    return <ArticleLoadState issue={articleRead.issue} retryHref={retryHref} />;
  }
  const article = articleRead.data as PreviewArticle | null;
  if (!article) notFound();
  const englishRead = readAdminResult(englishResult, (data) =>
    data === null || validPreviewEnglish(data, id));
  if (englishRead.status === "failed") {
    return <ArticleLoadState issue={englishRead.issue} retryHref={retryHref} />;
  }
  const categoriesRead = readAdminList(categoriesResult, (item) =>
    typeof item.id === "string" && typeof item.name === "string");
  if (categoriesRead.status === "failed") {
    return <ArticleLoadState issue={categoriesRead.issue} retryHref={retryHref} />;
  }
  const workingDraftRead = readAdminResult(workingDraftResult, (data) =>
    data === null || isReadRecord(data));
  if (workingDraftRead.status === "failed") {
    return <ArticleLoadState issue={workingDraftRead.issue} retryHref={retryHref} />;
  }
  const englishTranslation = englishRead.data as PreviewText | null;
  const categories = categoriesRead.data;
  let workingDraft = null;
  if (workingDraftRead.data) {
    try {
      workingDraft = parseArticleWorkingDraft(workingDraftRead.data);
    } catch {
      return <ArticleLoadState issue="invalid" retryHref={retryHref} />;
    }
    if (!sameArticleId(workingDraft.article_id, id)) {
      return <ArticleLoadState issue="invalid" retryHref={retryHref} />;
    }
  }
  const previewArticle = workingDraft && workingDraft.draft_scope !== "english-only"
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
  const draftCategory = workingDraft && workingDraft.draft_scope !== "english-only"
    ? categories.find(
        (item) => item.id === previewArticle.category_id
      )
    : null;
  const localizedArticle = locale === "en"
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
              ? workingDraft.draft_scope === "english-only"
                ? locale === "en"
                  ? "Приватный английский черновик · английская версия не выпущена"
                  : `Закрытый предпросмотр русской версии · ${article.status}`
                : "Сохранённый рабочий черновик · публичная версия не изменена"
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
              : workingDraft && workingDraft.draft_scope !== "english-only"
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
