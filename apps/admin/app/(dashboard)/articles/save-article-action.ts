"use server";

import { articleEditPath } from "@/lib/admin-routes";
import { articleCanonicalUrl } from "@/lib/article-route";
import { articleTranslationSourceHash } from "@/lib/article-translations";
import { translateArticleSourceToEnglish } from "@/lib/auto-translate-article";
import { adminEnv } from "@/lib/env";
import { redirect } from "@/lib/navigation";
import { createSlug } from "@/lib/slug";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import { saveArticleAction as legacySaveArticleAction } from "./actions-legacy";

function optionalText(value: FormDataEntryValue | null) {
  const text = String(value || "").trim();
  return text || null;
}

function commaList(value: FormDataEntryValue | null) {
  return String(value || "")
    .split(/[,;\n]+/u)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 30);
}

function lineItems(value: FormDataEntryValue | null) {
  return String(value || "")
    .split(/\r?\n/u)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 100)
    .map((text) => ({ text }));
}

function parsedContentJson(value: FormDataEntryValue | null) {
  try {
    return JSON.parse(String(value || "{}")) as unknown;
  } catch {
    return { type: "doc", content: [] };
  }
}

function publicationErrorPath(articleId: string | null, message: string) {
  return articleId
    ? articleEditPath(articleId, { error: message })
    : `/articles/new?error=${encodeURIComponent(message)}`;
}

export async function saveArticleAction(formData: FormData) {
  const intent = String(formData.get("intent") || "save");
  const autoTranslationEnabled =
    adminEnv.openAiAutoTranslateArticles && Boolean(adminEnv.openAiApiKey);
  if (intent !== "publish" || !autoTranslationEnabled) {
    return legacySaveArticleAction(formData);
  }

  // A deliberately reviewed manual English release always wins. Automatic
  // translation is the default path, not a way to overwrite an editor who has
  // explicitly confirmed the current source in this submission.
  const manualEnglishConfirmed =
    formData.get("english_enabled") === "on" &&
    ["approved", "published"].includes(
      String(formData.get("english_status") || "")
    ) &&
    formData.get("english_confirm_current_source") === "on";
  if (manualEnglishConfirmed) {
    return legacySaveArticleAction(formData);
  }

  const articleId = optionalText(formData.get("id"));
  const title = String(formData.get("title") || "").trim();
  const subtitle = String(formData.get("subtitle") || "").trim();
  const excerpt = String(formData.get("excerpt") || "").trim();
  const rawSlug = String(formData.get("slug") || "").trim();
  const slug = createSlug(rawSlug || title) || `material-${Date.now()}`;
  const contentHtml = String(formData.get("content_html") || "");
  const contentJson = parsedContentJson(formData.get("content_json"));
  const coverAlt = String(formData.get("cover_alt") || "").trim();
  const sources = lineItems(formData.get("sources"));
  const bibliography = lineItems(formData.get("bibliography"));
  const seoTitle = String(formData.get("seo_title") || "").trim() || title;
  const seoDescription =
    String(formData.get("seo_description") || "").trim() || excerpt;
  const seoKeywords = commaList(formData.get("seo_keywords"));
  const ogTitle =
    String(formData.get("og_title") || "").trim() || seoTitle || title;
  const ogDescription =
    String(formData.get("og_description") || "").trim() ||
    seoDescription ||
    excerpt;
  const sourceHash = articleTranslationSourceHash({
    title,
    subtitle,
    excerpt,
    contentJson,
    contentHtml,
    coverAlt,
    slug,
    sources,
    bibliography,
    seoTitle,
    seoDescription,
    seoKeywords,
    ogTitle,
    ogDescription,
  });

  const supabase = await createServerSupabaseClient();
  let existingEnglishHash: string | null = null;
  let existingEnglishStatus: string | null = null;
  if (supabase && articleId) {
    const { data: existingEnglish } = await supabase
      .from("article_translations")
      .select("source_content_hash,status")
      .eq("article_id", articleId)
      .eq("locale", "en")
      .maybeSingle();
    existingEnglishHash = existingEnglish?.source_content_hash || null;
    existingEnglishStatus = existingEnglish?.status || null;
  }

  // An unchanged already-published English translation needs no paid model
  // request. Legacy validation will independently verify the persisted source
  // hash before saving the Russian article.
  if (
    existingEnglishHash === sourceHash &&
    existingEnglishStatus === "published"
  ) {
    return legacySaveArticleAction(formData);
  }

  try {
    const translated = await translateArticleSourceToEnglish({
      title,
      subtitle,
      excerpt,
      contentHtml,
      coverAlt: coverAlt || `Иллюстрация к статье «${title}»`,
      sources: sources.map((item) => item.text),
      bibliography: bibliography.map((item) => item.text),
      seoTitle,
      seoDescription,
      seoKeywords,
      ogTitle,
      ogDescription,
    });

    const englishSlug =
      String(formData.get("english_slug") || "").trim() ||
      createSlug(translated.title) ||
      `english-${slug}`;
    let englishCanonical = String(
      formData.get("english_canonical_url") || ""
    ).trim();
    if (!englishCanonical) {
      let categorySlug: string | null = null;
      const categoryId = optionalText(formData.get("category_id"));
      if (supabase && categoryId) {
        const { data: category } = await supabase
          .from("categories")
          .select("slug")
          .eq("id", categoryId)
          .maybeSingle();
        categorySlug = category?.slug || null;
      }
      englishCanonical = articleCanonicalUrl(
        adminEnv.publicSiteUrl,
        englishSlug,
        categorySlug
      );
    }

    formData.set("english_enabled", "on");
    formData.set("english_title", translated.title);
    formData.set("english_subtitle", translated.subtitle);
    formData.set("english_excerpt", translated.excerpt);
    formData.set("english_slug", englishSlug);
    formData.set("english_content_html", translated.content_html);
    formData.set(
      "english_content_json",
      JSON.stringify({ type: "doc", content: [] })
    );
    formData.set("english_cover_alt", translated.cover_alt);
    formData.set("english_seo_title", translated.seo_title);
    formData.set("english_seo_description", translated.seo_description);
    formData.set("english_seo_keywords", translated.seo_keywords.join(", "));
    formData.set("english_canonical_url", englishCanonical);
    formData.set("english_og_title", translated.og_title);
    formData.set("english_og_description", translated.og_description);
    formData.set("english_sources", translated.sources.join("\n"));
    formData.set("english_bibliography", translated.bibliography.join("\n"));
    formData.set("english_status", "published");
    formData.set("english_confirm_current_source", "on");

    return legacySaveArticleAction(formData);
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "неизвестная ошибка переводчика";
    const message =
      `Автоматический английский перевод не выполнен, поэтому публикация остановлена: ${detail}`.slice(
        0,
        900
      );
    redirect(publicationErrorPath(articleId, message));
  }
}
