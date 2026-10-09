import { unstable_rethrow } from "next/navigation";
import type { ReactNode } from "react";
import ArticleEditorLoader, {
  type ArticleTranslation,
  type CustomTemplate,
} from "@/components/ArticleEditorLoader";
import ArticleCopyPicker, {
  type CopyableArticle,
} from "@/components/ArticleCopyPicker";
import { INITIAL_ARTICLE_COPY_OPTIONS_LIMIT } from "@/lib/article-copy-search";
import { requireStaffRead } from "@/lib/admin-read-access";
import { adminEnv } from "@/lib/env";
import { createSlug } from "@/lib/slug";
import ArticleLoadState from "@/components/ArticleLoadState";
import { AdminDependencyState } from "@/components/AdminStatusState";
import AdminStatusState from "@/components/AdminStatusState";
import { getAdminBasePathFromEnv } from "@/lib/admin-path";
import { readAdminList, readAdminResult, rethrowAdminReadControlFlow } from "@/lib/admin-read-result";
import { validArticleRead, validCopyOptionRead, validEnglishRead, validTemplateRead } from "@/lib/article-load-validation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata = { title: "Новая статья" };

function copiedDraftSlug(sourceSlug: string, copyToken: string) {
  const base = createSlug(sourceSlug) || "material";
  const suffix = `copy-${copyToken}`;
  return `${base.slice(0, Math.max(2, 179 - suffix.length))}-${suffix}`;
}

export default async function NewArticlePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; copyFrom?: string }>;
}) {
  const staff = await requireStaffRead();
  if (!staff) return <AdminStatusState eyebrow="Доступ ограничен"
    title="Редакционные данные недоступны"
    description="Не удалось подтвердить редакционную роль. Обратитесь к владельцу сайта." />;
  const { error, copyFrom } = await searchParams;
  const retryHref = `${getAdminBasePathFromEnv(process.env.ADMIN_BASE_PATH)}/articles/new${copyFrom ? `?copyFrom=${encodeURIComponent(copyFrom)}` : ""}`;
  const copyFromId =
    copyFrom && /^[0-9a-f-]{36}$/iu.test(copyFrom) ? copyFrom : null;
  const editorKey = copyFrom ? `copy:${copyFrom.toLowerCase()}` : "new";
  const unavailableEditor = (fallback: ReactNode) => <ArticleEditorLoader
    key={editorKey} editorKey={editorKey} actorId={staff.user?.id} current={null} fallback={fallback} retryHref={retryHref}
  />;
  let supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  try {
    supabase = await createServerSupabaseClient();
  } catch (error) {
    unstable_rethrow(error);
    return unavailableEditor(<ArticleLoadState issue="unavailable" retryHref={retryHref} />);
  }
  if (!supabase) return unavailableEditor(<><AdminDependencyState /><div className="state-actions"><a className="button-secondary" href={retryHref}>Повторить загрузку</a></div></>);
  if (copyFrom && !copyFromId) return unavailableEditor(<ArticleLoadState issue="invalid" retryHref={retryHref} />);

  const [
    categoriesResult,
    templatesResult,
    articlesResult,
    sourceArticleResult,
    sourceEnglishTranslationResult,
  ] = await Promise.allSettled([
    supabase
      .from("categories")
      .select("id,name,slug")
      .eq("is_visible", true)
      .order("display_order"),
    supabase
      .from("editor_templates")
      .select("id,label,content_html,visibility,owner_id")
      .order("updated_at", { ascending: false })
      .limit(60),
    supabase
      .from("articles")
      .select("id,title,status,updated_at")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(INITIAL_ARTICLE_COPY_OPTIONS_LIMIT),
    copyFromId
      ? supabase
          .from("articles")
          .select(
            "id,title,subtitle,excerpt,slug,content_html,content_json,category_id,cover_external_url,cover_alt,status,cover_media_id,sources,bibliography,seo_title,seo_description,seo_keywords,og_title,og_description,allow_indexing,featured,show_on_homepage,pinned,legacy_path"
          )
          .eq("id", copyFromId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    copyFromId
      ? supabase
          .from("article_translations")
          .select(
            "article_id,locale,title,subtitle,excerpt,slug,content_html,content_json,cover_alt,sources,bibliography,seo_title,seo_description,seo_keywords,og_title,og_description"
          )
          .eq("article_id", copyFromId)
          .eq("locale", "en")
          .is("deleted_at", null)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  rethrowAdminReadControlFlow(categoriesResult, templatesResult, articlesResult,
    sourceArticleResult, sourceEnglishTranslationResult);
  const categoriesRead = readAdminList(categoriesResult, (item) =>
    typeof item.id === "string" && typeof item.name === "string" && typeof item.slug === "string");
  if (categoriesRead.status === "failed") {
    return unavailableEditor(<ArticleLoadState issue={categoriesRead.issue} retryHref={retryHref} />);
  }
  const sourceArticleRead = readAdminResult(sourceArticleResult, (data) =>
    data === null || (copyFromId !== null && validArticleRead(data, copyFromId, "copy")));
  if (sourceArticleRead.status === "failed") {
    return unavailableEditor(<ArticleLoadState issue={sourceArticleRead.issue} retryHref={retryHref} />);
  }
  if (copyFromId && !sourceArticleRead.data) {
    return unavailableEditor(<ArticleLoadState issue="permission" retryHref={retryHref} />);
  }
  const englishRead = readAdminResult(sourceEnglishTranslationResult, (data) =>
    data === null || (copyFromId !== null && validEnglishRead(data, copyFromId, "copy")));
  if (englishRead.status === "failed") {
    return unavailableEditor(<ArticleLoadState issue={englishRead.issue} retryHref={retryHref} />);
  }
  const categories = categoriesRead.data;
  const templatesRead = readAdminList(templatesResult, validTemplateRead);
  const templates: CustomTemplate[] = (templatesRead.status === "success" ? templatesRead.data : []).map((template) => ({
    id: template.id,
    label: template.label,
    html: template.content_html,
    visibility: template.visibility as "personal" | "shared",
    canDelete: template.owner_id === staff.user?.id,
  }));
  const articlesRead = readAdminList(articlesResult, validCopyOptionRead);
  const copyableArticles: CopyableArticle[] = (articlesRead.status === "success" ? articlesRead.data : []).map((item) => ({
    id: item.id,
    title: item.title,
    status: item.status,
    updatedAt: item.updated_at,
  }));

  const sourceArticle = sourceArticleRead.data;
  const sourceEnglishTranslation = englishRead.data;
  const copyToken = copyFromId
    ? `${copyFromId.slice(0, 8)}-${crypto.randomUUID().slice(0, 8)}`
    : null;
  const copiedArticle = sourceArticle
    ? {
        title: sourceArticle.title,
        subtitle: sourceArticle.subtitle,
        excerpt: sourceArticle.excerpt,
        content_html: sourceArticle.content_html,
        content_json: sourceArticle.content_json,
        category_id: sourceArticle.category_id,
        cover_external_url: sourceArticle.cover_external_url,
        cover_alt: sourceArticle.cover_alt,
        cover_media_id: sourceArticle.cover_media_id,
        sources: sourceArticle.sources,
        bibliography: sourceArticle.bibliography,
        seo_title: sourceArticle.seo_title,
        seo_description: sourceArticle.seo_description,
        seo_keywords: sourceArticle.seo_keywords,
        og_title: sourceArticle.og_title,
        og_description: sourceArticle.og_description,
        allow_indexing: sourceArticle.allow_indexing,
        slug: copiedDraftSlug(sourceArticle.slug, copyToken || "draft"),
        canonical_url: null,
        legacy_path: null,
        status: "draft",
        featured: false,
        show_on_homepage: false,
        pinned: false,
      }
    : null;
  const copiedEnglishTranslation: ArticleTranslation | undefined =
    sourceArticle && sourceEnglishTranslation
      ? {
          locale: "en",
          title: sourceEnglishTranslation.title,
          subtitle: sourceEnglishTranslation.subtitle,
          excerpt: sourceEnglishTranslation.excerpt,
          content_html: sourceEnglishTranslation.content_html,
          content_json: sourceEnglishTranslation.content_json,
          cover_alt: sourceEnglishTranslation.cover_alt,
          sources: sourceEnglishTranslation.sources,
          bibliography: sourceEnglishTranslation.bibliography,
          seo_title: sourceEnglishTranslation.seo_title,
          seo_description: sourceEnglishTranslation.seo_description,
          seo_keywords: sourceEnglishTranslation.seo_keywords,
          og_title: sourceEnglishTranslation.og_title,
          og_description: sourceEnglishTranslation.og_description,
          status: "draft",
          slug: copiedDraftSlug(
            sourceEnglishTranslation.slug,
            copyToken || "draft-en"
          ),
          canonical_url: null,
        }
      : undefined;

  return (
    <ArticleEditorLoader
      key={editorKey}
      editorKey={editorKey}
      retryHref={retryHref}
      current={{
        article: copiedArticle ? copiedArticle : { status: "draft" },
        englishTranslation: copiedEnglishTranslation,
        categories,
        publicSiteUrl: adminEnv.publicSiteUrl,
        templates,
        draftKey: copyFromId ? `copy-${copyFromId}` : undefined,
        actorId: staff.user?.id,
        canPublish: staff.role === "owner" || staff.role === "admin",
        canOverridePublicationChecklist: staff.role === "owner",
      }}
      before={<>
      <header className="page-heading">
        <div>
          <span className="eyebrow">Новый материал</span>
          <h1>Создать статью</h1>
          <p>
            Начните с чистого листа, готового шаблона или найдите существующую статью
            как образец. Полный архив подгружается только по вашему поиску.
          </p>
        </div>
      </header>
      {error && (
        <p className="form-message">{error}</p>
      )}
      {articlesRead.status === "failed" ? (
        <p className="notice" role="status">
          Список статей для копирования временно недоступен. <a href={retryHref}>Повторить загрузку</a>
        </p>
      ) : <ArticleCopyPicker articles={copyableArticles} />}
      {templatesRead.status === "failed" && (
        <p className="notice" role="status">
          Шаблоны временно недоступны. <a href={retryHref}>Повторить загрузку</a>
        </p>
      )}
      </>}
    />
  );
}
