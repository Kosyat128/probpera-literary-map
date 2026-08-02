import ArticleEditor, { type CustomTemplate } from "@/components/ArticleEditor";
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
  ]);
  const categories = categoriesResult || [];
  const templates: CustomTemplate[] = (templatesResult || []).map((template) => ({
    id: template.id,
    label: template.label,
    html: template.content_html,
    visibility: template.visibility as "personal" | "shared",
    canDelete: template.owner_id === authResult.user?.id,
  }));

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
      <ArticleEditor
        article={{ status: "draft" }}
        categories={categories}
        publicSiteUrl={adminEnv.publicSiteUrl}
        templates={templates}
      />
    </>
  );
}
