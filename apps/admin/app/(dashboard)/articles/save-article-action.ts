"use server";

import { articleEditPath } from "@/lib/admin-routes";
import { articleCanonicalUrl } from "@/lib/article-route";
import {
  isMachineOwnedEnglishArticleTranslation,
  premiumArticleMachineContentJson,
  stripPremiumArticleMachineMetadata,
} from "@/lib/article-translation-machine-ownership";
import { articleTranslationSourceHash } from "@/lib/article-translations";
import { translateArticleSourceToEnglish } from "@/lib/auto-translate-article";
import { adminEnv } from "@/lib/env";
import { redirect } from "@/lib/navigation";
import { createSlug } from "@/lib/slug";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import { saveStandardArticleAtomically } from "./atomic-standard-save-action";

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

type ExistingEnglishForAuto = {
  source_content_hash: string | null;
  status: string | null;
  content_json: unknown;
  title: string;
  subtitle: string | null;
  excerpt: string | null;
  slug: string;
  content_html: string;
  cover_alt: string | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: string[] | null;
  canonical_url: string | null;
  og_title: string | null;
  og_description: string | null;
  sources: unknown[] | null;
  bibliography: unknown[] | null;
};

const existingEnglishSelect =
  "source_content_hash,status,content_json,title,subtitle,excerpt,slug,content_html,cover_alt,seo_title,seo_description,seo_keywords,canonical_url,og_title,og_description,sources,bibliography";

function normalizedStoredLineItems(value: unknown[] | null | undefined) {
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

function englishFormFingerprint(formData: FormData) {
  return JSON.stringify({
    title: String(formData.get("english_title") || "").trim(),
    subtitle: String(formData.get("english_subtitle") || "").trim(),
    excerpt: String(formData.get("english_excerpt") || "").trim(),
    slug: String(formData.get("english_slug") || "").trim(),
    contentHtml: String(formData.get("english_content_html") || ""),
    coverAlt: String(formData.get("english_cover_alt") || "").trim(),
    seoTitle: String(formData.get("english_seo_title") || "").trim(),
    seoDescription: String(
      formData.get("english_seo_description") || ""
    ).trim(),
    seoKeywords: commaList(formData.get("english_seo_keywords")),
    canonicalUrl: optionalText(formData.get("english_canonical_url")),
    ogTitle: String(formData.get("english_og_title") || "").trim(),
    ogDescription: String(formData.get("english_og_description") || "").trim(),
    sources: lineItems(formData.get("english_sources")).map((item) => item.text),
    bibliography: lineItems(formData.get("english_bibliography")).map(
      (item) => item.text
    ),
    status: String(formData.get("english_status") || "draft"),
  });
}

function storedEnglishFingerprint(row: ExistingEnglishForAuto) {
  return JSON.stringify({
    title: row.title || "",
    subtitle: row.subtitle || "",
    excerpt: row.excerpt || "",
    slug: row.slug || "",
    contentHtml: row.content_html || "",
    coverAlt: row.cover_alt || "",
    seoTitle: row.seo_title || "",
    seoDescription: row.seo_description || "",
    seoKeywords: row.seo_keywords || [],
    canonicalUrl: row.canonical_url || null,
    ogTitle: row.og_title || "",
    ogDescription: row.og_description || "",
    sources: normalizedStoredLineItems(row.sources),
    bibliography: normalizedStoredLineItems(row.bibliography),
    status: row.status || "draft",
  });
}

function manualEnglishProvided(formData: FormData) {
  if (formData.get("english_enabled") !== "on") return false;
  return [
    "english_title",
    "english_excerpt",
    "english_content_html",
    "english_seo_title",
    "english_seo_description",
    "english_sources",
    "english_bibliography",
  ].some((field) => String(formData.get(field) || "").trim().length > 0);
}

function stripMachineOwnershipFromFormData(formData: FormData) {
  const raw = String(formData.get("english_content_json") || "").trim();
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw) as unknown;
    const stripped = stripPremiumArticleMachineMetadata(parsed);
    formData.set("english_content_json", JSON.stringify(stripped));
  } catch {
    // The canonical standard action owns validation of malformed editor JSON.
  }
}

function preserveMachineOwnershipInFormData(
  formData: FormData,
  existing: ExistingEnglishForAuto
) {
  formData.set(
    "english_content_json",
    JSON.stringify(existing.content_json || { type: "doc", content: [] })
  );
}

function saveHumanOwnedEnglish(formData: FormData) {
  stripMachineOwnershipFromFormData(formData);
  return saveStandardArticleAtomically(formData);
}

async function saveStandardRespectingEnglishOwnership(
  formData: FormData,
  options: { forceHuman?: boolean } = {}
) {
  if (options.forceHuman) return saveHumanOwnedEnglish(formData);

  const articleId = optionalText(formData.get("id"));
  if (!articleId) {
    if (manualEnglishProvided(formData)) stripMachineOwnershipFromFormData(formData);
    return saveStandardArticleAtomically(formData);
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) return saveStandardArticleAtomically(formData);

  const response = await supabase
    .from("article_translations")
    .select(existingEnglishSelect)
    .eq("article_id", articleId)
    .eq("locale", "en")
    .maybeSingle();
  if (response.error || !response.data) {
    if (!response.data && manualEnglishProvided(formData)) {
      stripMachineOwnershipFromFormData(formData);
    }
    return saveStandardArticleAtomically(formData);
  }

  const existing = response.data as ExistingEnglishForAuto;
  const machineOwned = isMachineOwnedEnglishArticleTranslation({
    contentJson: existing.content_json,
    sourceContentHash: existing.source_content_hash,
  });
  if (!machineOwned) return saveHumanOwnedEnglish(formData);

  if (englishFormFingerprint(formData) !== storedEnglishFingerprint(existing)) {
    return saveHumanOwnedEnglish(formData);
  }

  // Tiptap serialises only the editor document and may drop unknown top-level
  // metadata. Restore the persisted provenance when the editor did not change
  // any reader-facing English field, so a Russian-only save does not silently
  // disable future automatic refreshes.
  preserveMachineOwnershipInFormData(formData, existing);
  return saveStandardArticleAtomically(formData);
}

export async function saveArticleAction(formData: FormData) {
  const intent = String(formData.get("intent") || "save");
  const autoTranslationEnabled =
    adminEnv.openAiAutoTranslateArticles && Boolean(adminEnv.openAiApiKey);
  if (intent !== "publish" || !autoTranslationEnabled) {
    return saveStandardRespectingEnglishOwnership(formData);
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
    return saveStandardRespectingEnglishOwnership(formData, {
      forceHuman: true,
    });
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
  if (!supabase) {
    return saveStandardArticleAtomically(formData);
  }

  let existingEnglish: ExistingEnglishForAuto | null = null;
  if (articleId) {
    const response = await supabase
      .from("article_translations")
      .select(existingEnglishSelect)
      .eq("article_id", articleId)
      .eq("locale", "en")
      .maybeSingle();
    if (response.error) {
      return saveStandardRespectingEnglishOwnership(formData);
    }
    existingEnglish =
      (response.data as ExistingEnglishForAuto | null) || null;
  }

  if (!existingEnglish && manualEnglishProvided(formData)) {
    return saveHumanOwnedEnglish(formData);
  }

  if (existingEnglish) {
    const machineOwned = isMachineOwnedEnglishArticleTranslation({
      contentJson: existingEnglish.content_json,
      sourceContentHash: existingEnglish.source_content_hash,
    });

    // Existing translations without the marker predate premium automation or
    // have been taken over by an editor. They are human-owned by default.
    if (!machineOwned) {
      return saveHumanOwnedEnglish(formData);
    }

    // Editing any visible English field transfers ownership to the editor even
    // if the old row was originally generated by the premium pipeline.
    if (englishFormFingerprint(formData) !== storedEnglishFingerprint(existingEnglish)) {
      return saveHumanOwnedEnglish(formData);
    }

    // Keep the provenance marker even if the editor client discarded unknown
    // JSON metadata while rendering an otherwise untouched English document.
    preserveMachineOwnershipInFormData(formData, existingEnglish);

    // An unchanged already-published machine translation needs no paid model
    // request. The canonical standard action still verifies optimistic locks
    // and release rules.
    if (
      existingEnglish.source_content_hash === sourceHash &&
      existingEnglish.status === "published"
    ) {
      return saveStandardArticleAtomically(formData);
    }
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
    const hadEnglishBeforeAuto =
      formData.get("english_enabled") === "on" &&
      Boolean(String(formData.get("english_title") || "").trim());
    let englishCanonical = hadEnglishBeforeAuto
      ? String(formData.get("english_canonical_url") || "").trim()
      : "";
    if (!englishCanonical) {
      let categorySlug: string | null = null;
      const categoryId = optionalText(formData.get("category_id"));
      if (categoryId) {
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
      JSON.stringify(
        premiumArticleMachineContentJson({
          sourceHash,
          model: translated.model,
          reviewerModel: translated.reviewModel,
          translatorRequestId: translated.requestId,
          reviewerRequestId: translated.reviewRequestId,
        })
      )
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

    return saveStandardArticleAtomically(formData);
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
