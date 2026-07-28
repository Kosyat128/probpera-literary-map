import { notFound } from "next/navigation";

import ArticleEditor from "@/components/ArticleEditor";
import { adminEnv } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata = { title: "Редактирование статьи" };

export default async function EditArticlePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createServerSupabaseClient();
  if (!supabase) notFound();
  const [{ data: article }, { data: categoriesResult }] = await Promise.all([
    supabase.from("articles").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("categories")
      .select("id,name,slug")
      .eq("is_visible", true)
      .order("display_order"),
  ]);
  const categories = categoriesResult || [];

  if (!article) notFound();

  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">Редактирование</span>
          <h1>Редактор статьи</h1>
          <p>Изменения фиксируются в истории версий автоматически.</p>
        </div>
      </header>
      {query.error && <p className="form-message">{query.error}</p>}
      {query.saved && <p className="form-message form-success">Изменения сохранены.</p>}
      <ArticleEditor
        article={article}
        categories={categories}
        publicSiteUrl={adminEnv.publicSiteUrl}
      />
    </>
  );
}
