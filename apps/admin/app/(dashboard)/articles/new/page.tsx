import ArticleEditor, { type CustomTemplate } from "@/components/ArticleEditor";
import ArticleCopyPicker, {
  type CopyableArticle,
} from "@/components/ArticleCopyPicker";
import { adminEnv } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata = { title: "Новая статья" };

export default async function NewArticlePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; copyFrom?: string }>;
}) {
  const { error, copyFrom } = await searchParams;
  const supabase = await createServerSupabaseClient();
  if (!supabase) return null;

  const copyFromId =
    copyFrom && /^[0-9a-f-]{36}$/iu.test(copyFrom) ? copyFrom : null;

  const [
    { data: categoriesResult },
    { data: templatesResult },
    { data: authResult },
    { data: articlesResult },
    { data: sourceArticleResult },
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
      .limit(500),
    copyFromId
      ? supabase
          .from("articles")
          .select(
            "id,title,subtitle,excerpt,slug,content_html,content_json,category_id,cover_external_url,cover_alt,status,cover_media_id,sources,bibliography,seo_title,seo_description,seo_keywords,og_title,og_description,allow_indexing,featured,show_on_homepage,pinned,legacy_path"
          )
          .eq("id", copyFromId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
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
  const copiedArticle = sourceArticle
    ? {
        ...sourceArticle,
        status: "draft",
      }
    : null;

  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">Новый материал</span>
          <h1>Создать статью</h1>
          <p>
            Выберите базовый материал и начинайте редактирование сразу: можно заменить
            тему, текст, иллюстрации и настроить SEO.
          </p>
        </div>
      </header>
      {error && <p className="form-message">{error}</p>}
      <ArticleCopyPicker articles={copyableArticles} />
      <ArticleEditor
        article={
          copiedArticle
            ? {
                ...copiedArticle,
                status: "draft",
                legacy_path: copiedArticle.legacy_path || null,
              }
            : { status: "draft" }
        }
        categories={categories}
        publicSiteUrl={adminEnv.publicSiteUrl}
        templates={templates}
      />
    </>
  );
}
