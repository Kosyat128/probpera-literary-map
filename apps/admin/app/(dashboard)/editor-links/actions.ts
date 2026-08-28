"use server";

import { requireStaff } from "@/lib/auth";
import { articlePublicPath } from "@/lib/article-route";
import {
  EDITOR_INTERNAL_LINK_SEARCH_LIMIT,
  editorInternalLinkSearchPattern,
  normalizeEditorInternalLinkSearch,
  validateEditorLinkHref,
} from "@/lib/editor-link";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type EditorInternalLinkItem = {
  id: string;
  type: "article" | "page";
  title: string;
  href: string;
};

export type EditorInternalLinkSearchResult = {
  items: EditorInternalLinkItem[];
  error: string | null;
};

function categorySlug(value: unknown) {
  const category = Array.isArray(value) ? value[0] : value;
  if (!category || typeof category !== "object") return null;
  const slug = (category as { slug?: unknown }).slug;
  return typeof slug === "string" ? slug : null;
}

function safeInternalItem(item: EditorInternalLinkItem) {
  const validation = validateEditorLinkHref(item.href);
  return validation.ok && validation.href.startsWith("/")
    ? { ...item, href: validation.href }
    : null;
}

export async function searchEditorInternalLinksAction(
  rawQuery: string
): Promise<EditorInternalLinkSearchResult> {
  const session = await requireStaff();
  if (!session?.user) {
    return { items: [], error: "Сессия редактора недоступна." };
  }

  const query = normalizeEditorInternalLinkSearch(rawQuery);
  const pattern = editorInternalLinkSearchPattern(query);
  if (!pattern) return { items: [], error: null };

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return { items: [], error: "База данных не подключена." };
  }

  const perTypeLimit = Math.ceil(EDITOR_INTERNAL_LINK_SEARCH_LIMIT / 2);
  const [articlesResponse, pagesResponse] = await Promise.all([
    supabase
      .from("articles")
      .select("id,title,slug,categories(slug)")
      .eq("status", "published")
      .is("deleted_at", null)
      .ilike("title", pattern)
      .order("title", { ascending: true })
      .limit(perTypeLimit),
    supabase
      .from("pages")
      .select("id,title,slug")
      .eq("status", "published")
      .is("deleted_at", null)
      .ilike("title", pattern)
      .order("title", { ascending: true })
      .limit(perTypeLimit),
  ]);

  if (articlesResponse.error || pagesResponse.error) {
    return {
      items: [],
      error: "Поиск по опубликованным материалам временно недоступен.",
    };
  }

  const articleItems = (articlesResponse.data || []).map((item) => ({
    id: String(item.id),
    type: "article" as const,
    title: String(item.title || "Без названия"),
    href: `${articlePublicPath(
      String(item.slug || ""),
      categorySlug(item.categories)
    ).replace(/\/+$/u, "")}/`,
  }));
  const pageItems = (pagesResponse.data || []).map((item) => ({
    id: String(item.id),
    type: "page" as const,
    title: String(item.title || "Без названия"),
    href: `/stranitsy/${String(item.slug || "").replace(/^\/+|\/+$/gu, "")}/`,
  }));

  return {
    items: [...articleItems, ...pageItems]
      .map(safeInternalItem)
      .filter((item): item is EditorInternalLinkItem => item !== null)
      .sort((first, second) => first.title.localeCompare(second.title, "ru"))
      .slice(0, EDITOR_INTERNAL_LINK_SEARCH_LIMIT),
    error: null,
  };
}
