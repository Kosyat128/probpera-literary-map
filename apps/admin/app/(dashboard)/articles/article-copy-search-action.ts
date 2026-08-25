"use server";

import { requireStaff } from "@/lib/auth";
import {
  ARTICLE_COPY_SEARCH_LIMIT,
  articleCopySearchPattern,
  normalizeArticleCopySearch,
} from "@/lib/article-copy-search";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type ArticleCopySearchItem = {
  id: string;
  title: string;
  status: string;
  updatedAt?: string | null;
};

export type ArticleCopySearchResult = {
  items: ArticleCopySearchItem[];
  error: string | null;
};

export async function searchArticleCopyOptionsAction(
  rawQuery: string
): Promise<ArticleCopySearchResult> {
  const session = await requireStaff();
  if (!session?.user) {
    return { items: [], error: "Сессия редактора недоступна." };
  }
  const query = normalizeArticleCopySearch(rawQuery);
  const pattern = articleCopySearchPattern(query);
  if (!pattern) return { items: [], error: null };

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return { items: [], error: "База данных не подключена." };
  }

  const response = await supabase
    .from("articles")
    .select("id,title,status,updated_at")
    .is("deleted_at", null)
    .ilike("title", pattern)
    .order("updated_at", { ascending: false })
    .limit(ARTICLE_COPY_SEARCH_LIMIT);

  if (response.error) {
    return { items: [], error: response.error.message };
  }

  return {
    items: (response.data || []).map((item) => ({
      id: String(item.id),
      title: String(item.title || "Без названия"),
      status: String(item.status || "draft"),
      updatedAt: item.updated_at ? String(item.updated_at) : null,
    })),
    error: null,
  };
}
