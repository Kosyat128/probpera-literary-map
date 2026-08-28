import ArticleEditor, {
  type ArticleTranslation,
  type CustomTemplate,
} from "@/components/ArticleEditor";
import ArticleCopyPicker, {
  type CopyableArticle,
} from "@/components/ArticleCopyPicker";
import { INITIAL_ARTICLE_COPY_OPTIONS_LIMIT } from "@/lib/article-copy-search";
import { adminEnv } from "@/lib/env";
import { createSlug } from "@/lib/slug";
import { AdminDependencyState } from "@/components/AdminStatusState";
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
  const { error, copyFrom } = await searchParams;
  const supabase = await createServerSupabaseClient();
  if (!supabase) return <AdminDependencyState />;

  const copyFromId =
    copyFrom && /^[0-9a-f-]{36}$/iu.test(copyFrom) ? copyFrom : null;

  const [
    { data: categoriesResult },
    { data: templatesResult },
    { data: authResult },
    { data: articlesResult },
    { data: sourceArticleResult },
    {
      data: sourceEnglishTranslationResult,
      error: sourceEnglishTranslationError,
    },
  ] = await Promise.all([
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
    supabase.auth.getUser(),
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
            "title,subtitle,excerpt,slug,content_html,content_json,cover_alt,sources,bibliography,seo_title,seo_description,seo_keywords,og_title,og_description"
          )
          .eq("article_id", copyFromId)
          .eq("locale", "en")
          .is("deleted_at", null)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const categories = categoriesResult || [];
  const templates: CustomTemplate[] = (templatesResult || []).map((template) => ({
    id: template.id,
    label: template.label,
    html: template.content_html,
    visibility: template.visibility as "personal" | "shared",
    canDelete: template.owner_id === authResult.user?.id,
  }));
  const copyableArticles: CopyableArticle[] = (articlesResult || []).map((item) => ({
    id: item.id,
    title: item.title,
    status: item.status,
    updatedAt: item.updated_at,
  }));

  const sourceArticle = sourceArticleResult || null;
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
    sourceArticle && sourceEnglishTranslationResult
      ? {
          locale: "en",
          title: sourceEnglishTranslationResult.title,
          subtitle: sourceEnglishTranslationResult.subtitle,
          excerpt: sourceEnglishTranslationResult.excerpt,
          content_html: sourceEnglishTranslationResult.content_html,
          content_json: sourceEnglishTranslationResult.content_json,
          cover_alt: sourceEnglishTranslationResult.cover_alt,
          sources: sourceEnglishTranslationResult.sources,
          bibliography: sourceEnglishTranslationResult.bibliography,
          seo_title: sourceEnglishTranslationResult.seo_title,
          seo_description: sourceEnglishTranslationResult.seo_description,
          seo_keywords: sourceEnglishTranslationResult.seo_keywords,
          og_title: sourceEnglishTranslationResult.og_title,
          og_description: sourceEnglishTranslationResult.og_description,
          status: "draft",
          slug: copiedDraftSlug(
            sourceEnglishTranslationResult.slug,
            copyToken || "draft-en"
          ),
          canonical_url: null,
        }
      : undefined;
  const copyLoadError =
    copyFromId && sourceEnglishTranslationError
      ? `Не удалось загрузить английскую версию исходной статьи: ${sourceEnglishTranslationError.message}`
      : null;

  return (
    <>
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
      {(error || copyLoadError) && (
        <p className="form-message">{error || copyLoadError}</p>
      )}
      <ArticleCopyPicker articles={copyableArticles} />
      {!copyLoadError && (
        <ArticleEditor
          article={copiedArticle ? copiedArticle : { status: "draft" }}
          englishTranslation={copiedEnglishTranslation}
          categories={categories}
          publicSiteUrl={adminEnv.publicSiteUrl}
          templates={templates}
          draftKey={copyFromId ? `copy-${copyFromId}` : undefined}
        />
      )}
    </>
  );
}
