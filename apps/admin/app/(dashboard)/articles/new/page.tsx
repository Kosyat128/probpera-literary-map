import ArticleEditor from "@/components/ArticleEditor";
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
  const { data: categoriesResult } =
    (await supabase
      .from("categories")
      .select("id,name,slug")
      .eq("is_visible", true)
      .order("display_order")) || {};
  const categories = categoriesResult || [];

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
      />
    </>
  );
}
