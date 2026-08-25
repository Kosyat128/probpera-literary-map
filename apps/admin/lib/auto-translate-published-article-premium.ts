import type { SupabaseClient } from "@supabase/supabase-js";

import { articleCanonicalUrl } from "./article-route";
import {
  isMachineOwnedEnglishArticleTranslation,
  premiumArticleMachineContentJson,
} from "./article-translation-machine-ownership";
import { articleTranslationSourceHash } from "./article-translations";
import { translateArticleSourceToEnglish } from "./auto-translate-article";
import { adminEnv } from "./env";
import { createSlug } from "./slug";

type ArticleRow = {
  id: string;
  title: string;
  subtitle: string | null;
  excerpt: string | null;
  slug: string;
  content_html: string;
  content_json: unknown;
  cover_alt: string | null;
  status: string;
  sources: unknown[] | null;
  bibliography: unknown[] | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string[] | null;
  og_title: string | null;
  og_description: string | null;
  updated_at: string;
  categories: { slug?: string } | { slug?: string }[] | null;
};

type ExistingEnglishRow = {
  id: string;
  updated_at: string;
  slug: string;
  canonical_url: string | null;
  status: string;
  source_content_hash: string | null;
  content_json: unknown;
};

function normalizedLineItems(value: unknown[] | null | undefined) {
  return (value || [])
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object" && "text" in item) {
        return String((item as { text?: unknown }).text || "").trim();
      }
      return "";
    })
    .filter(Boolean);
}

export type PremiumArticleBackfillState =
  | "translated"
  | "current"
  | "manual"
  | "skipped"
  | "not-configured"
  | "conflict"
  | "failed";

export async function ensurePublishedArticlePremiumEnglish(input: {
  supabase: SupabaseClient;
  actorId: string;
  articleId: string;
}): Promise<{
  state: PremiumArticleBackfillState;
  model?: string;
  reviewerModel?: string | null;
  error?: string;
}> {
  if (!adminEnv.openAiAutoTranslateArticles) return { state: "skipped" };
  if (!adminEnv.openAiApiKey) return { state: "not-configured" };

  const articleResponse = await input.supabase
    .from("articles")
    .select(
      "id,title,subtitle,excerpt,slug,content_html,content_json,cover_alt,status,sources,bibliography,seo_title,seo_description,seo_keywords,og_title,og_description,updated_at,categories(slug)"
    )
    .eq("id", input.articleId)
    .maybeSingle();
  if (articleResponse.error || !articleResponse.data) {
    return {
      state: "failed",
      error: articleResponse.error?.message || "published article not found",
    };
  }
  const article = articleResponse.data as unknown as ArticleRow;
  if (article.status !== "published") return { state: "skipped" };

  const sourceHash = articleTranslationSourceHash({
    title: article.title,
    subtitle: article.subtitle || "",
    excerpt: article.excerpt || "",
    contentJson: article.content_json || { type: "doc", content: [] },
    contentHtml: article.content_html || "",
    coverAlt: article.cover_alt || "",
    slug: article.slug,
    sources: article.sources || [],
    bibliography: article.bibliography || [],
    seoTitle: article.seo_title || article.title,
    seoDescription: article.seo_description || article.excerpt || "",
    seoKeywords: article.seo_keywords || [],
    ogTitle: article.og_title || article.seo_title || article.title,
    ogDescription:
      article.og_description ||
      article.seo_description ||
      article.excerpt ||
      "",
  });

  const englishResponse = await input.supabase
    .from("article_translations")
    .select(
      "id,updated_at,slug,canonical_url,status,source_content_hash,content_json"
    )
    .eq("article_id", article.id)
    .eq("locale", "en")
    .maybeSingle();
  if (englishResponse.error) {
    return { state: "failed", error: englishResponse.error.message };
  }
  const existing = englishResponse.data as ExistingEnglishRow | null;
  if (
    existing?.source_content_hash === sourceHash &&
    existing.status === "published"
  ) {
    return { state: "current" };
  }

  // Anything that predates the premium ownership marker, or anything an
  // editor has subsequently taken over, is human-owned and is never replaced
  // by a batch backfill.
  if (
    existing &&
    !isMachineOwnedEnglishArticleTranslation({
      contentJson: existing.content_json,
      sourceContentHash: existing.source_content_hash,
    })
  ) {
    return { state: "manual" };
  }

  const startedAt = Date.now();
  try {
    const translated = await translateArticleSourceToEnglish({
      title: article.title,
      subtitle: article.subtitle || "",
      excerpt: article.excerpt || "",
      contentHtml: article.content_html || "",
      coverAlt: article.cover_alt || `Иллюстрация к статье «${article.title}»`,
      sources: normalizedLineItems(article.sources),
      bibliography: normalizedLineItems(article.bibliography),
      seoTitle: article.seo_title || article.title,
      seoDescription: article.seo_description || article.excerpt || "",
      seoKeywords: [...(article.seo_keywords || [])],
      ogTitle: article.og_title || article.seo_title || article.title,
      ogDescription:
        article.og_description ||
        article.seo_description ||
        article.excerpt ||
        "",
    });

    const latest = await input.supabase
      .from("articles")
      .select("updated_at")
      .eq("id", article.id)
      .maybeSingle();
    if (
      latest.error ||
      !latest.data ||
      latest.data.updated_at !== article.updated_at
    ) {
      return { state: "conflict", error: "Russian source changed during translation" };
    }

    const category = Array.isArray(article.categories)
      ? article.categories[0]
      : article.categories;
    const englishSlug =
      existing?.slug ||
      createSlug(translated.title) ||
      `article-${article.id.slice(0, 8)}`;
    const now = new Date().toISOString();
    const translationPayload = {
      article_id: article.id,
      locale: "en",
      title: translated.title,
      subtitle: translated.subtitle,
      excerpt: translated.excerpt,
      content_json: premiumArticleMachineContentJson({
        sourceHash,
        model: translated.model,
        reviewerModel: translated.reviewModel,
        translatorRequestId: translated.requestId,
        reviewerRequestId: translated.reviewRequestId,
        generatedAt: now,
      }),
      content_html: translated.content_html,
      cover_alt: translated.cover_alt,
      slug: englishSlug,
      sources: translated.sources.map((text) => ({ text })),
      bibliography: translated.bibliography.map((text) => ({ text })),
      seo_title: translated.seo_title,
      seo_description: translated.seo_description,
      seo_keywords: translated.seo_keywords,
      canonical_url:
        existing?.canonical_url ||
        articleCanonicalUrl(
          adminEnv.publicSiteUrl,
          englishSlug,
          category?.slug || null
        ),
      og_title: translated.og_title,
      og_description: translated.og_description,
      status: "published",
      source_content_hash: sourceHash,
      source_article_updated_at: article.updated_at,
      reviewed_by: input.actorId,
      reviewed_at: now,
      approved_by: input.actorId,
      approved_at: now,
      published_at: now,
      updated_by: input.actorId,
      deleted_at: null,
    };

    const saved = existing
      ? await input.supabase
          .from("article_translations")
          .update(translationPayload)
          .eq("id", existing.id)
          .eq("article_id", article.id)
          .eq("locale", "en")
          .eq("updated_at", existing.updated_at)
          .select("id")
          .maybeSingle()
      : await input.supabase
          .from("article_translations")
          .insert({ ...translationPayload, created_by: input.actorId })
          .select("id")
          .maybeSingle();

    if (saved.error || !saved.data) {
      return {
        state: existing && !saved.error ? "conflict" : "failed",
        error: saved.error?.message || "English translation changed concurrently",
      };
    }

    await input.supabase.from("admin_audit_log").insert({
      actor_id: input.actorId,
      action: "article.premium_translation.backfill.succeeded",
      entity_type: "article",
      entity_id: article.id,
      metadata: {
        locale: "en",
        source_hash: sourceHash,
        ownership: "machine-translation",
        model: translated.model,
        reviewer_model: translated.reviewModel,
        translator_request_id: translated.requestId,
        reviewer_request_id: translated.reviewRequestId,
        input_tokens: translated.inputTokens,
        output_tokens: translated.outputTokens,
        review_input_tokens: translated.reviewInputTokens,
        review_output_tokens: translated.reviewOutputTokens,
        duration_ms: Date.now() - startedAt,
      },
    });

    return {
      state: "translated",
      model: translated.model,
      reviewerModel: translated.reviewModel,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "premium article translation failed";
    await input.supabase.from("admin_audit_log").insert({
      actor_id: input.actorId,
      action: "article.premium_translation.backfill.failed",
      entity_type: "article",
      entity_id: article.id,
      metadata: {
        locale: "en",
        model: adminEnv.openAiTranslationModel,
        reviewer_model: adminEnv.openAiTranslationReviewModel,
        error: message.slice(0, 500),
        duration_ms: Date.now() - startedAt,
      },
    });
    return { state: "failed", error: message };
  }
}
