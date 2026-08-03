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
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createServerSupabaseClient();
  if (!supabase) return null;
  const [
    { data: categoriesResult },
    { data: templatesResult },
    { data: authResult },
    { data: articlesResult },
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
  ]);
  const categories = categoriesResult || [];
  const templates: CustomTemplate[] = (templatesResult || []).map((template) => ({
    id: template.id,
    label: template.label,
    html: template.content_html,
    visibility: template.visibility as "personal" | "shared",
    canDelete: template.owner_id === authResult.user?.id,
  }));
  const copyableArticles: CopyableArticle[] = (articlesResult || []).map(
    (item) => ({
      id: item.id,
      title: item.title,
      status: item.status,
      updatedAt: item.updated_at,
    })
  );

  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">Новый материал</span>
          <h1>Редактор статьи</h1>
          <p>Пишите и оформляйте текст так, как он будет читаться на сайте.</p>
        </div>
      </header>
      {error && <p className="form-message">{error}</p>}
      <ArticleCopyPicker articles={copyableArticles} />
      <ArticleEditor
        article={{ status: "draft" }}
        categories={categories}
        publicSiteUrl={adminEnv.publicSiteUrl}
        templates={templates}
      />
    </>
  );
}
