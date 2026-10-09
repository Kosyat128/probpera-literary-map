"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { after } from "next/server";
import sanitizeHtml from "sanitize-html";
import { z } from "zod";

import { articleEditPath } from "@/lib/admin-routes";
import { parseArticleSaveResult, type ArticleSaveResult, type ArticleSaveReceipt } from "@/lib/article-save-result";
import { articleOperationSaveResult, type ArticleOperationResultContext } from "@/lib/article-operation-result";
import { articlePublicPath } from "@/lib/article-route";
import {
  buildArticleMetadataDraft,
  completeArticleMetadataDraft,
} from "@/lib/article-composer";
import {
  articleTranslationSourceHash,
  canReuseEnglishTranslationApproval,
  englishTranslationReleaseIssues,
  isReleasedTranslationStatus,
  publicationFailureSavePolicy,
  type ArticleTranslationStatus,
} from "@/lib/article-translations";
import { requireStaff } from "@/lib/auth";
import {
  safeTextToneSpanAttributes,
  sanitizeArticleTextToneJson,
} from "@/lib/article-content-presentation";
import { rebindPremiumArticleMachineSourceHash } from "@/lib/article-translation-machine-ownership";
import { adminEnv } from "@/lib/env";
import { sanitizeEditorAnchorAttributes } from "@/lib/editor-link";
import {
  editorialGalleryAttributeNames,
  safeEditorialGalleryHtmlAttributes,
  sanitizeEditorialGalleryJson,
} from "@/lib/editorial-gallery";
import {
  editorialImageDataAttributes,
  safeEditorialImageHtmlAttributes,
  sanitizeEditorialMediaJson,
} from "@/lib/editorial-media-content";
import {
  assertEditorialMediaIdentityParity,
  editorialMediaHtmlAccessibilityIssues,
  parseEditorialContentJson,
} from "@/lib/editorial-media-identity";
import { redirect } from "@/lib/navigation";
import { requestPublicBuild } from "@/lib/publication";
import { normalizeShortHyphensFormData } from "@/lib/short-hyphens";
import { createSlug } from "@/lib/slug";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import {
  promoteArticleWorkingDraftRpc,
  saveArticleBundleRpc,
  type ArticleBundleRpcInput,
} from "./article-bundle-rpc";
import {
  articleWorkingDraftEnglishEnvelope,
  parseArticleWorkingDraft,
  saveArticleWorkingDraftRpc,
} from "./article-working-draft";
import { ArticleOperationRpcError } from "./article-operation-rpc";

const articleSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(3).max(240),
  subtitle: z.string().trim().max(360).default(""),
  excerpt: z.string().trim().max(700).default(""),
  slug: z.string().trim().max(180).optional(),
  contentHtml: z.string().max(2_000_000).default(""),
  contentJson: z.string().max(2_000_000).default("{}"),
  categoryId: z.string().uuid().nullable(),
  status: z.enum([
    "draft",
    "review",
    "scheduled",
    "published",
    "hidden",
    "archived",
  ]),
  scheduledAt: z.string().nullable(),
  coverExternalUrl: z.string().url().nullable(),
  coverAlt: z.string().trim().max(500).default(""),
  legacyPath: z.string().trim().nullable(),
  seoTitle: z.string().trim().max(180).default(""),
  seoDescription: z.string().trim().max(400).default(""),
  seoKeywords: z.array(z.string().max(80)).max(30).default([]),
  canonicalUrl: z.string().url().nullable(),
  ogTitle: z.string().trim().max(180).default(""),
  ogDescription: z.string().trim().max(400).default(""),
  sources: z.array(z.object({ text: z.string().max(1000) })).max(100).default([]),
  bibliography: z
    .array(z.object({ text: z.string().max(1000) }))
    .max(100)
    .default([]),
  allowIndexing: z.boolean(),
  featured: z.boolean(),
  showOnHomepage: z.boolean(),
  pinned: z.boolean(),
});

const articleTranslationSchema = z.object({
  enabled: z.boolean(),
  title: z.string().trim().min(3).max(240),
  subtitle: z.string().trim().max(360).default(""),
  excerpt: z.string().trim().max(700).default(""),
  slug: z.string().trim().min(2).max(180),
  contentHtml: z.string().max(2_000_000).default(""),
  contentJson: z.string().max(2_000_000).default("{}"),
  coverAlt: z.string().trim().max(500).default(""),
  seoTitle: z.string().trim().max(180).default(""),
  seoDescription: z.string().trim().max(400).default(""),
  seoKeywords: z.array(z.string().max(80)).max(30).default([]),
  canonicalUrl: z.string().url().nullable(),
  ogTitle: z.string().trim().max(180).default(""),
  ogDescription: z.string().trim().max(400).default(""),
  sources: z.array(z.object({ text: z.string().max(1000) })).max(100).default([]),
  bibliography: z
    .array(z.object({ text: z.string().max(1000) }))
    .max(100)
    .default([]),
  status: z.enum([
    "draft",
    "review",
    "approved",
    "published",
    "stale",
    "archived",
  ]),
  confirmCurrentSource: z.boolean(),
});

type ExistingEnglishTranslation = {
  updated_at: string;
  status: ArticleTranslationStatus;
  source_content_hash: string | null;
  title: string;
  subtitle: string | null;
  excerpt: string | null;
  content_json: unknown;
  content_html: string;
  cover_alt: string | null;
  slug: string;
  sources: readonly unknown[] | null;
  bibliography: readonly unknown[] | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_keywords: readonly string[] | null;
  canonical_url: string | null;
  og_title: string | null;
  og_description: string | null;
  approved_at: string | null;
  published_at: string | null;
};

const allowedArticleHtml = {
  allowedTags: [
    ...sanitizeHtml.defaults.allowedTags,
    "img",
    "figure",
    "figcaption",
    "mark",
    "aside",
    "section",
  ],
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    a: ["href", "name", "target", "rel"],
    img: ["src", "alt", "title", "width", "height", "loading"],
    "*": [
      "class",
      "id",
      "data-editorial-block",
      "data-reveal",
      "data-image-layout",
      "data-caption",
      "data-media-id",
      ...editorialImageDataAttributes,
      ...editorialGalleryAttributeNames,
      "data-text-tone",
      "data-typography-scope",
    ],
  },
  allowedSchemes: ["http", "https", "mailto"],
  transformTags: {
    img: (tagName: string, attributes: Record<string, string>) => ({
      tagName,
      attribs: safeEditorialImageHtmlAttributes(attributes),
    }),
    section: (tagName: string, attributes: Record<string, string>) => ({
      tagName,
      attribs: safeEditorialGalleryHtmlAttributes(attributes),
    }),
    a: (tagName: string, attributes: Record<string, string>) => ({
      tagName,
      attribs: sanitizeEditorAnchorAttributes(attributes),
    }),
    span: (tagName: string, attributes: Record<string, string>) => ({
      tagName,
      attribs: safeTextToneSpanAttributes(attributes),
    }),
  },
};

function isExistingArticleRead(value: unknown): value is {
  slug: string; status: string; published_at: string | null; updated_at: string;
  categories: { slug: string } | { slug: string }[] | null;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  const category = (entry: unknown) => Boolean(entry && typeof entry === "object" &&
    !Array.isArray(entry) && typeof (entry as Record<string, unknown>).slug === "string");
  return typeof row.slug === "string" && typeof row.updated_at === "string" && typeof row.status === "string" &&
    ["draft", "review", "scheduled", "published", "hidden", "archived"].includes(row.status) &&
    (row.published_at === null || typeof row.published_at === "string") &&
    (row.categories === null || (Array.isArray(row.categories) ? row.categories.every(category) : category(row.categories)));
}

function isExistingEnglishRead(value: unknown): value is ExistingEnglishTranslation {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  if (!["updated_at", "title", "slug", "content_html"].every((key) => typeof row[key] === "string") ||
    !Object.hasOwn(row, "content_json") || row.content_json === undefined || typeof row.status !== "string" ||
    !["draft", "review", "approved", "published", "stale", "archived"].includes(row.status)) return false;
  if (!["source_content_hash", "subtitle", "excerpt", "cover_alt", "seo_title", "seo_description",
    "canonical_url", "og_title", "og_description", "approved_at", "published_at"].every((key) =>
    row[key] === null || typeof row[key] === "string")) return false;
  return ["sources", "bibliography"].every((key) => row[key] === null || Array.isArray(row[key])) &&
    (row.seo_keywords === null || (Array.isArray(row.seo_keywords) && row.seo_keywords.every((item) => typeof item === "string")));
}

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
    .filter((item) => item.trim().length > 0)
    .map((text) => ({ text }));
}

function scheduleArticleReceiptRevalidation(paths: string[]): "scheduled" | "unknown" {
  try {
    after(() => {
      try { paths.forEach(path => revalidatePath(path)); }
      catch (error) { unstable_rethrow(error); }
    });
    return "scheduled";
  } catch (error) {
    unstable_rethrow(error);
    return "unknown";
  }
}

export async function saveStandardArticleAtomically(
  formData: FormData,
  operationContext?: ArticleOperationResultContext
) {
  normalizeShortHyphensFormData(formData);
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  const receiptMode = Boolean(operationContext) || formData.get("article_result_mode") === "receipt";
  const actorId = session.user.id;
  const expectedUpdatedAt = optionalText(formData.get("expected_updated_at"));
  const englishExpectedUpdatedAt = optionalText(
    formData.get("english_expected_updated_at")
  );

  const submittedIntent = String(formData.get("intent") || "save");
  const intent = ["publish", "preview"].includes(submittedIntent)
    ? (submittedIntent as "publish" | "preview")
    : "save";
  const previewLocale = formData.get("preview_locale") === "en" ? "en" : "ru";
  const automaticTranslationDeferred =
    formData.get("automatic_translation_deferred") === "1";
  const skipAutomaticTranslation =
    automaticTranslationDeferred ||
    formData.get("skip_automatic_translation") === "1";
  const submittedStatus = String(formData.get("status") || "draft");
  const requestedStatus =
    intent === "publish"
      ? ["scheduled", "hidden", "archived"].includes(submittedStatus)
        ? submittedStatus
        : "published"
      : submittedStatus === "review"
        ? "review"
        : "draft";
  const title = String(formData.get("title") || "");
  const rawSlug = String(formData.get("slug") || "");
  const generatedSlug = createSlug(rawSlug || title) || `material-${Date.now()}`;
  const scheduledAt = optionalText(formData.get("scheduled_at"));
  if (requestedStatus === "scheduled" && !scheduledAt) {
    return { outcome: "rejected", reason: "schedule" } satisfies ArticleSaveResult;
  }
  const status = requestedStatus;
  const canonicalUrl = optionalText(formData.get("canonical_url"));
  const publicationOverride = formData.get("publication_override") === "1";
  if (publicationOverride && session.role !== "owner") {
    return { outcome: "rejected", reason: "permission" } satisfies ArticleSaveResult;
  }

  const subtitle = String(formData.get("subtitle") || "");
  const submittedContentHtml = String(formData.get("content_html") || "");
  const completedMetadata = completeArticleMetadataDraft(
    {
      excerpt: String(formData.get("excerpt") || ""),
      seoTitle: String(formData.get("seo_title") || ""),
      seoDescription: String(formData.get("seo_description") || ""),
      seoKeywords: String(formData.get("seo_keywords") || ""),
      ogTitle: String(formData.get("og_title") || ""),
      ogDescription: String(formData.get("og_description") || ""),
    },
    buildArticleMetadataDraft({
      title,
      subtitle,
      contentHtml: submittedContentHtml,
      locale: "ru",
    })
  );

  const parsed = articleSchema.safeParse({
    id: optionalText(formData.get("id")) || undefined,
    title,
    subtitle,
    excerpt: completedMetadata.excerpt,
    slug: generatedSlug,
    contentHtml: submittedContentHtml,
    contentJson: String(formData.get("content_json") || "{}"),
    categoryId: optionalText(formData.get("category_id")),
    status,
    scheduledAt,
    coverExternalUrl: optionalText(formData.get("cover_external_url")),
    coverAlt: String(formData.get("cover_alt") || ""),
    legacyPath: optionalText(formData.get("legacy_path")),
    seoTitle: completedMetadata.seoTitle,
    seoDescription: completedMetadata.seoDescription,
    seoKeywords: commaList(completedMetadata.seoKeywords),
    canonicalUrl,
    ogTitle: completedMetadata.ogTitle,
    ogDescription: completedMetadata.ogDescription,
    sources: lineItems(formData.get("sources")),
    bibliography: lineItems(formData.get("bibliography")),
    allowIndexing: formData.get("allow_indexing") === "on",
    featured: formData.get("featured") === "on",
    showOnHomepage: formData.get("show_on_homepage") === "on",
    pinned: formData.get("pinned") === "on",
  });

  if (!parsed.success) {
    return { outcome: "rejected", reason: "validation" } satisfies ArticleSaveResult;
  }

  const englishEnabled = formData.get("english_enabled") === "on";
  const englishTitle = String(formData.get("english_title") || "");
  const englishSubtitle = String(formData.get("english_subtitle") || "");
  const submittedEnglishContentHtml = String(
    formData.get("english_content_html") || ""
  );
  const completedEnglishMetadata = completeArticleMetadataDraft(
    {
      excerpt: String(formData.get("english_excerpt") || ""),
      seoTitle: String(formData.get("english_seo_title") || ""),
      seoDescription: String(formData.get("english_seo_description") || ""),
      seoKeywords: String(formData.get("english_seo_keywords") || ""),
      ogTitle: String(formData.get("english_og_title") || ""),
      ogDescription: String(formData.get("english_og_description") || ""),
    },
    buildArticleMetadataDraft({
      title: englishTitle,
      subtitle: englishSubtitle,
      contentHtml: submittedEnglishContentHtml,
      locale: "en",
    })
  );
  const englishSlug =
    createSlug(String(formData.get("english_slug") || "") || englishTitle) ||
    `english-material-${Date.now()}`;
  const parsedEnglish = englishEnabled
    ? articleTranslationSchema.safeParse({
        enabled: true,
        title: englishTitle,
        subtitle: englishSubtitle,
        excerpt: completedEnglishMetadata.excerpt,
        slug: englishSlug,
        contentHtml: submittedEnglishContentHtml,
        contentJson: String(formData.get("english_content_json") || "{}"),
        coverAlt: String(formData.get("english_cover_alt") || ""),
        seoTitle: completedEnglishMetadata.seoTitle,
        seoDescription: completedEnglishMetadata.seoDescription,
        seoKeywords: commaList(completedEnglishMetadata.seoKeywords),
        canonicalUrl: optionalText(formData.get("english_canonical_url")),
        ogTitle: completedEnglishMetadata.ogTitle,
        ogDescription: completedEnglishMetadata.ogDescription,
        sources: lineItems(formData.get("english_sources")),
        bibliography: lineItems(formData.get("english_bibliography")),
        status: String(formData.get("english_status") || "draft"),
        confirmCurrentSource:
          formData.get("english_confirm_current_source") === "on",
      })
    : null;

  if (parsedEnglish && !parsedEnglish.success) {
    return { outcome: "rejected", reason: "english-validation" } satisfies ArticleSaveResult;
  }

  const englishData = parsedEnglish?.success ? parsedEnglish.data : null;
  let submittedContentJson: unknown;
  try {
    submittedContentJson = sanitizeEditorialGalleryJson(
      sanitizeEditorialMediaJson(
        sanitizeArticleTextToneJson(
          parseEditorialContentJson(parsed.data.contentJson, "Русская версия статьи")
        )
      )
    );
  } catch (error) {
    unstable_rethrow(error);
    return { outcome: "rejected", reason: "content" } satisfies ArticleSaveResult;
  }
  let submittedEnglishContentJson: unknown = null;
  if (englishData) {
    try {
      submittedEnglishContentJson = sanitizeEditorialGalleryJson(
        sanitizeEditorialMediaJson(
          sanitizeArticleTextToneJson(
            parseEditorialContentJson(
              englishData.contentJson,
              "Английская версия статьи"
            )
          )
        )
      );
    } catch (error) {
      unstable_rethrow(error);
      return { outcome: "rejected", reason: "english-content" } satisfies ArticleSaveResult;
    }
  }
  const publicationIssues = new Set<string>();

  const savedSlug = parsed.data.slug || generatedSlug;
  const contentJson = submittedContentJson;
  const sanitizedContentHtml = sanitizeHtml(
    parsed.data.contentHtml,
    allowedArticleHtml
  );

  let englishContentJson: unknown = null;
  const sanitizedEnglishContentHtml = englishData
    ? sanitizeHtml(englishData.contentHtml, allowedArticleHtml)
    : "";
  if (englishData) {
    englishContentJson = submittedEnglishContentJson;
  }

  try {
    assertEditorialMediaIdentityParity(
      contentJson,
      sanitizedContentHtml,
      "Русская версия статьи"
    );
    if (englishData && englishContentJson) {
      assertEditorialMediaIdentityParity(
        englishContentJson,
        sanitizedEnglishContentHtml,
        "Английская версия статьи"
      );
    }
  } catch (error) {
    unstable_rethrow(error);
    return { outcome: "rejected", reason: "media" } satisfies ArticleSaveResult;
  }

  const currentSourceHash = articleTranslationSourceHash({
    title: parsed.data.title,
    subtitle: parsed.data.subtitle,
    excerpt: parsed.data.excerpt,
    contentJson,
    contentHtml: sanitizedContentHtml,
    coverAlt: parsed.data.coverAlt,
    slug: savedSlug,
    sources: parsed.data.sources,
    bibliography: parsed.data.bibliography,
    seoTitle: parsed.data.seoTitle || parsed.data.title,
    seoDescription: parsed.data.seoDescription || parsed.data.excerpt,
    seoKeywords: parsed.data.seoKeywords,
    ogTitle: parsed.data.ogTitle || parsed.data.seoTitle || parsed.data.title,
    ogDescription:
      parsed.data.ogDescription ||
      parsed.data.seoDescription ||
      parsed.data.excerpt,
  });
  if (englishContentJson) {
    englishContentJson = rebindPremiumArticleMachineSourceHash(
      englishContentJson,
      currentSourceHash
    );
  }

  let supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  try {
    supabase = await createServerSupabaseClient();
  } catch (error) {
    unstable_rethrow(error);
    return { outcome: "dependency-unavailable" } satisfies ArticleSaveResult;
  }
  if (!supabase) return { outcome: "dependency-unavailable" } satisfies ArticleSaveResult;

  const now = new Date().toISOString();
  const articleId = parsed.data.id;
  let expectedWorkingDraftVersion = 0;
  if (articleId) {
    const parsedWorkingDraftVersion = z.coerce
      .number()
      .int()
      .min(0)
      .safeParse(formData.get("working_draft_version") || "0");
    if (!parsedWorkingDraftVersion.success) {
      return { outcome: "conflict", scope: "article" } satisfies ArticleSaveResult;
    }
    expectedWorkingDraftVersion = parsedWorkingDraftVersion.data;
  }
  let previousSlug: string | null = null;
  let previousPublishedAt: string | null = null;
  let previousCategorySlug: string | null = null;
  let persistedPreviousStatus: string | undefined;
  let existingEnglishTranslation: ExistingEnglishTranslation | null = null;

  let categorySlug: string | null = null;
  if (parsed.data.categoryId) {
    let categoryResponse;
    try {
      categoryResponse = await supabase
        .from("categories")
        .select("slug")
        .eq("id", parsed.data.categoryId)
        .maybeSingle();
    } catch (error) {
      unstable_rethrow(error);
      return { outcome: "dependency-unavailable" } satisfies ArticleSaveResult;
    }
    if (!categoryResponse || categoryResponse.error || !categoryResponse.data ||
      typeof categoryResponse.data.slug !== "string") {
      return { outcome: "dependency-unavailable" } satisfies ArticleSaveResult;
    }
    const category = categoryResponse.data;
    categorySlug = category?.slug || null;
  }

  if (articleId) {
    let existingBundle;
    try {
      existingBundle = await Promise.all([
        supabase
          .from("articles")
          .select("slug,status,published_at,updated_at,categories(slug)")
          .eq("id", articleId)
          .single(),
        supabase
          .from("article_translations")
          .select(
            "status,source_content_hash,title,subtitle,excerpt,content_json,content_html,cover_alt,slug,sources,bibliography,seo_title,seo_description,seo_keywords,canonical_url,og_title,og_description,approved_at,published_at,updated_at"
          )
          .eq("article_id", articleId)
          .eq("locale", "en")
          .maybeSingle(),
      ]);
    } catch (error) {
      unstable_rethrow(error);
      return { outcome: "dependency-unavailable" } satisfies ArticleSaveResult;
    }
    if (existingBundle.some((response) => !response || !Object.hasOwn(response, "data"))) {
      return { outcome: "dependency-unavailable" } satisfies ArticleSaveResult;
    }
    const [
      { data: previous, error: previousError },
      { data: englishTranslation, error: englishError },
    ] = existingBundle;

    if (previousError || !isExistingArticleRead(previous)) {
      return { outcome: "dependency-unavailable" } satisfies ArticleSaveResult;
    }
    if (!expectedUpdatedAt || previous.updated_at !== expectedUpdatedAt) {
      return { outcome: "conflict", scope: "article" } satisfies ArticleSaveResult;
    }
    if (englishError || englishTranslation === undefined ||
      (englishTranslation !== null && !isExistingEnglishRead(englishTranslation))) {
      return { outcome: "dependency-unavailable" } satisfies ArticleSaveResult;
    }

    existingEnglishTranslation =
      (englishTranslation as ExistingEnglishTranslation | null) || null;
    if (
      existingEnglishTranslation &&
      (!englishExpectedUpdatedAt ||
        existingEnglishTranslation.updated_at !== englishExpectedUpdatedAt)
    ) {
      return { outcome: "conflict", scope: "english" } satisfies ArticleSaveResult;
    }

    previousSlug = previous.slug || null;
    previousPublishedAt = previous.published_at || null;
    persistedPreviousStatus = previous.status || undefined;
    const previousCategory = Array.isArray(previous.categories)
      ? previous.categories[0]
      : previous.categories;
    previousCategorySlug = previousCategory?.slug || null;
  }

  let continuingReleasedWorkingDraft = false;
  if (articleId && persistedPreviousStatus && ["scheduled", "hidden", "archived"].includes(persistedPreviousStatus)
    && (intent === "save" || intent === "preview") && expectedWorkingDraftVersion > 0) {
    let draftResponse;
    try {
      draftResponse = await supabase.from("article_working_drafts")
        .select("article_id,base_article_updated_at,payload,english_payload,expected_english_updated_at,version,updated_at,draft_scope,draft_english_enabled")
        .eq("article_id", articleId).maybeSingle();
    } catch (error) {
      unstable_rethrow(error);
      return { outcome: "dependency-unavailable" } satisfies ArticleSaveResult;
    }
    if (!draftResponse || draftResponse.error || draftResponse.data === undefined) {
      return { outcome: "dependency-unavailable" } satisfies ArticleSaveResult;
    }
    if (draftResponse.data === null) return { outcome: "conflict", scope: "article" } satisfies ArticleSaveResult;
    let draft;
    try { draft = parseArticleWorkingDraft(draftResponse.data); }
    catch { return { outcome: "dependency-unavailable" } satisfies ArticleSaveResult; }
    if (draft.article_id.toLowerCase() !== articleId.toLowerCase() || draft.version !== expectedWorkingDraftVersion
      || draft.base_article_updated_at !== expectedUpdatedAt) {
      return { outcome: "conflict", scope: "article" } satisfies ArticleSaveResult;
    }
    if (draft.expected_english_updated_at !== englishExpectedUpdatedAt) {
      return { outcome: "conflict", scope: "english" } satisfies ArticleSaveResult;
    }
    continuingReleasedWorkingDraft = true;
  }
  const isPublishedWorkingDraftSave = Boolean(
    articleId &&
      (persistedPreviousStatus === "published" || continuingReleasedWorkingDraft) &&
      (intent === "save" || intent === "preview")
  );
  if (
    session.role === "editor" &&
    !isPublishedWorkingDraftSave &&
    !["draft", "review"].includes(parsed.data.status)
  ) {
    return { outcome: "rejected", reason: "permission" } satisfies ArticleSaveResult;
  }

  const isNewRelease =
    intent === "publish" ||
    parsed.data.status === "scheduled" ||
    (parsed.data.status === "published" &&
      persistedPreviousStatus !== "published");
  const requiresReleaseValidation =
    !isPublishedWorkingDraftSave &&
    (parsed.data.status === "published" || parsed.data.status === "scheduled");

  if (requiresReleaseValidation) {
    const plainText = sanitizeHtml(sanitizedContentHtml, {
      allowedTags: [],
      allowedAttributes: {},
    })
      .replace(/\s+/gu, " ")
      .trim();
    const releaseIssues = [
      !parsed.data.categoryId && "выберите рубрику",
      plainText.split(/\s+/u).filter(Boolean).length < 250 &&
        "добавьте не менее 250 слов",
      !/<h2(?:\s|>)/iu.test(sanitizedContentHtml) &&
        "добавьте смысловые подзаголовки H2",
      parsed.data.excerpt.length < 80 &&
        "расширьте описание карточки до 80 знаков",
      (!parsed.data.coverExternalUrl || parsed.data.coverAlt.length < 10) &&
        "добавьте обложку и её описание",
      parsed.data.seoDescription.length < 80 &&
        "расширьте SEO-описание до 80 знаков",
      parsed.data.sources.length === 0 && "укажите хотя бы один источник",
      /data-editorial-block=["']media["']/iu.test(sanitizedContentHtml) &&
        "замените все места для изображений настоящими файлами",
      ...editorialMediaHtmlAccessibilityIssues(sanitizedContentHtml),
      !publicationOverride &&
        formData.get("publication_ready") !== "yes" &&
        "завершите контроль перед публикацией",
      ...(englishEnabled
        ? englishTranslationReleaseIssues(
            englishData
              ? {
                  enabled: true,
                  status: englishData.status,
                  title: englishData.title,
                  subtitle: englishData.subtitle,
                  excerpt: englishData.excerpt,
                  contentHtml: sanitizedEnglishContentHtml,
                  slug: englishData.slug,
                  coverUrl: parsed.data.coverExternalUrl,
                  coverAlt: englishData.coverAlt,
                  seoTitle: englishData.seoTitle,
                  seoDescription: englishData.seoDescription,
                  seoKeywords: englishData.seoKeywords,
                  ogTitle: englishData.ogTitle,
                  ogDescription: englishData.ogDescription,
                  sources: englishData.sources,
                  bibliography: englishData.bibliography,
                }
              : {
                  enabled: false,
                  status: "draft",
                  title: "",
                  subtitle: "",
                  excerpt: "",
                  contentHtml: "",
                  slug: "",
                  coverUrl: null,
                  coverAlt: "",
                  seoTitle: "",
                  seoDescription: "",
                  seoKeywords: [],
                  ogTitle: "",
                  ogDescription: "",
                  sources: [],
                  bibliography: [],
                }
          ).map((issue) => `English: ${issue}`)
        : []),
      ...(englishData && isReleasedTranslationStatus(englishData.status)
        ? editorialMediaHtmlAccessibilityIssues(
            sanitizedEnglishContentHtml
          ).map((issue) => `English: ${issue}`)
        : []),
    ].filter(Boolean) as string[];
    releaseIssues.forEach((issue) => publicationIssues.add(issue));
  }

  const englishReleaseChecks = englishTranslationReleaseIssues(
    englishData
      ? {
          enabled: true,
          status: englishData.status,
          title: englishData.title,
          subtitle: englishData.subtitle,
          excerpt: englishData.excerpt,
          contentHtml: englishData.contentHtml,
          slug: englishData.slug,
          coverUrl: parsed.data.coverExternalUrl,
          coverAlt: englishData.coverAlt,
          seoTitle: englishData.seoTitle,
          seoDescription: englishData.seoDescription,
          seoKeywords: englishData.seoKeywords,
          ogTitle: englishData.ogTitle,
          ogDescription: englishData.ogDescription,
          sources: englishData.sources,
          bibliography: englishData.bibliography,
        }
      : {
          enabled: false,
          status: "draft",
          title: "",
          subtitle: "",
          excerpt: "",
          contentHtml: "",
          slug: "",
          coverUrl: null,
          coverAlt: "",
          seoTitle: "",
          seoDescription: "",
          seoKeywords: [],
          ogTitle: "",
          ogDescription: "",
          sources: [],
          bibliography: [],
        }
  );
  const persistedEnglishSourceIsCurrent =
    existingEnglishTranslation?.source_content_hash === currentSourceHash;
  const currentEnglishContentHash = englishData
    ? articleTranslationSourceHash({
        title: englishData.title,
        subtitle: englishData.subtitle,
        excerpt: englishData.excerpt,
        contentJson: englishContentJson || { type: "doc", content: [] },
        contentHtml: sanitizedEnglishContentHtml,
        coverAlt: englishData.coverAlt,
        slug: englishData.slug,
        sources: englishData.sources,
        bibliography: englishData.bibliography,
        seoTitle: englishData.seoTitle || englishData.title,
        seoDescription: englishData.seoDescription || englishData.excerpt,
        seoKeywords: englishData.seoKeywords,
        ogTitle:
          englishData.ogTitle || englishData.seoTitle || englishData.title,
        ogDescription:
          englishData.ogDescription ||
          englishData.seoDescription ||
          englishData.excerpt,
      })
    : null;
  const persistedEnglishContentHash = existingEnglishTranslation
    ? articleTranslationSourceHash({
        title: existingEnglishTranslation.title,
        subtitle: existingEnglishTranslation.subtitle || "",
        excerpt: existingEnglishTranslation.excerpt || "",
        contentJson:
          existingEnglishTranslation.content_json || {
            type: "doc",
            content: [],
          },
        contentHtml: existingEnglishTranslation.content_html || "",
        coverAlt: existingEnglishTranslation.cover_alt || "",
        slug: existingEnglishTranslation.slug,
        sources: existingEnglishTranslation.sources || [],
        bibliography: existingEnglishTranslation.bibliography || [],
        seoTitle: existingEnglishTranslation.seo_title || "",
        seoDescription: existingEnglishTranslation.seo_description || "",
        seoKeywords: existingEnglishTranslation.seo_keywords || [],
        ogTitle: existingEnglishTranslation.og_title || "",
        ogDescription: existingEnglishTranslation.og_description || "",
      })
    : null;
  const englishContentChanged = Boolean(
    existingEnglishTranslation &&
      currentEnglishContentHash !== persistedEnglishContentHash
  );
  const englishSourceIsCurrent = Boolean(
    englishData &&
      (englishData.confirmCurrentSource ||
        (persistedEnglishSourceIsCurrent && !englishContentChanged))
  );
  const previousEnglishApprovalIsReusable =
    canReuseEnglishTranslationApproval({
      persistedSourceHash: existingEnglishTranslation?.source_content_hash,
      currentSourceHash,
      persistedContentHash: persistedEnglishContentHash,
      currentContentHash: currentEnglishContentHash,
    });
  const requiresEnglishRelease =
    Boolean(englishData) &&
    requiresReleaseValidation;

  if (requiresEnglishRelease) {
    const bilingualIssues = [
      ...englishReleaseChecks,
      !englishSourceIsCurrent &&
        "confirm that the English version was reviewed against the current Russian source",
    ].filter((issue): issue is string => Boolean(issue));
    bilingualIssues.forEach((issue) =>
      publicationIssues.add(`English: ${issue}`)
    );
  }

  const publicationSavePolicy = isPublishedWorkingDraftSave
    ? null
    : publicationFailureSavePolicy({
        hasIssues: publicationIssues.size > 0,
        previousStatus: persistedPreviousStatus,
        requestedStatus: parsed.data.status,
      });
  const publicationWasBlockedForPublished =
    publicationSavePolicy?.kind === "preserve-published";
  const saveToPublishedWorkingDraft =
    isPublishedWorkingDraftSave || publicationWasBlockedForPublished;

  const publicationBlockMessage = publicationIssues.size
    ? `Публикация остановлена: ${Array.from(publicationIssues).join(
        "; "
      )}. Текст и изображения сохранены в рабочем черновике, опубликованная версия не изменена.`
    : null;
  const savedStatus = saveToPublishedWorkingDraft
    ? isPublishedWorkingDraftSave && parsed.data.status === "review"
      ? "review"
      : "draft"
    : publicationSavePolicy?.kind === "save"
      ? publicationSavePolicy.savedStatus
      : "draft";
  const savedEnglishStatus: ArticleTranslationStatus | null = englishData
    ? publicationBlockMessage && isReleasedTranslationStatus(englishData.status)
      ? "draft"
      : isReleasedTranslationStatus(englishData.status) && !englishSourceIsCurrent
        ? "stale"
        : englishData.status
    : null;
  const staleReleasedEnglishOnDisable = Boolean(
    !englishData &&
      existingEnglishTranslation &&
      isReleasedTranslationStatus(existingEnglishTranslation.status)
  );

  const articlePayload = {
    title: parsed.data.title,
    subtitle: parsed.data.subtitle,
    excerpt: parsed.data.excerpt,
    slug: savedSlug,
    content_html: sanitizedContentHtml,
    content_json: contentJson,
    category_id: parsed.data.categoryId,
    status: savedStatus,
    scheduled_at: savedStatus === "scheduled" ? parsed.data.scheduledAt : null,
    published_at:
      savedStatus === "published" ? previousPublishedAt || now : null,
    cover_external_url: parsed.data.coverExternalUrl,
    cover_alt: parsed.data.coverAlt,
    legacy_path: parsed.data.legacyPath,
    seo_title: parsed.data.seoTitle || parsed.data.title,
    seo_description: parsed.data.seoDescription || parsed.data.excerpt,
    seo_keywords: parsed.data.seoKeywords,
    canonical_url: `${adminEnv.publicSiteUrl}${articlePublicPath(
      savedSlug,
      categorySlug
    )}`,
    og_title: parsed.data.ogTitle || parsed.data.seoTitle || parsed.data.title,
    og_description:
      parsed.data.ogDescription ||
      parsed.data.seoDescription ||
      parsed.data.excerpt,
    allow_indexing: parsed.data.allowIndexing,
    sources: parsed.data.sources,
    bibliography: parsed.data.bibliography,
    featured: parsed.data.featured,
    show_on_homepage: parsed.data.showOnHomepage,
    pinned: parsed.data.pinned,
  };

  const englishMode = englishData && savedEnglishStatus
    ? "save"
    : staleReleasedEnglishOnDisable
      ? "stale"
      : "none";
  let englishPayload: Record<string, unknown> | null = null;
  if (englishMode === "save" && englishData && savedEnglishStatus) {
    const englishReleased = isReleasedTranslationStatus(savedEnglishStatus);
    const englishPublished = savedEnglishStatus === "published";
    englishPayload = {
      title: englishData.title,
      subtitle: englishData.subtitle,
      excerpt: englishData.excerpt,
      content_json: englishContentJson || { type: "doc", content: [] },
      content_html: sanitizedEnglishContentHtml,
      cover_alt: englishData.coverAlt,
      slug: englishData.slug,
      sources: englishData.sources,
      bibliography: englishData.bibliography,
      seo_title: englishData.seoTitle || englishData.title,
      seo_description: englishData.seoDescription || englishData.excerpt,
      seo_keywords: englishData.seoKeywords,
      canonical_url: englishData.canonicalUrl,
      og_title:
        englishData.ogTitle || englishData.seoTitle || englishData.title,
      og_description:
        englishData.ogDescription ||
        englishData.seoDescription ||
        englishData.excerpt,
      status: savedEnglishStatus,
      source_content_hash: currentSourceHash,
      reviewed_at:
        savedEnglishStatus === "review" || englishReleased ? now : null,
      approved_at: englishReleased
        ? previousEnglishApprovalIsReusable
          ? existingEnglishTranslation?.approved_at || now
          : now
        : null,
      published_at: englishPublished
        ? previousEnglishApprovalIsReusable
          ? existingEnglishTranslation?.published_at || now
          : now
        : null,
      deleted_at: null,
    };
  }

  if (saveToPublishedWorkingDraft) {
    if (!articleId || !expectedUpdatedAt) {
      return { outcome: "conflict", scope: "article" } satisfies ArticleSaveResult;
    }
    let savedDraft: Awaited<ReturnType<typeof saveArticleWorkingDraftRpc>>;
    try {
      savedDraft = await saveArticleWorkingDraftRpc(supabase, {
        articleId,
        baseArticleUpdatedAt: expectedUpdatedAt,
        articlePayload,
        englishEnvelope: articleWorkingDraftEnglishEnvelope(englishPayload),
        expectedEnglishUpdatedAt: englishExpectedUpdatedAt,
        expectedVersion: expectedWorkingDraftVersion,
      }, operationContext);
    } catch (error) {
      unstable_rethrow(error);
      if (operationContext && error instanceof ArticleOperationRpcError) throw error;
      return { outcome: "unknown-outcome" } satisfies ArticleSaveResult;
    }
    if (operationContext && savedDraft.operationResult?.replayed) {
      return articleOperationSaveResult(savedDraft.operationResult, operationContext)
        ?? { outcome: "unknown-outcome" } satisfies ArticleSaveResult;
    }
    if (receiptMode) {
      const result = {
        outcome: "saved" as const,
        ...(operationContext ? { operationId: operationContext.operationId,
          englishState: englishPayload ? "saved" as const : "preserved" as const } : {}),
        persistence: "working-draft" as const,
        receipt: {
          articleId: savedDraft.articleId,
          articleUpdatedAt: expectedUpdatedAt,
          englishUpdatedAt: englishExpectedUpdatedAt,
          workingDraftVersion: savedDraft.version,
          workingDraftUpdatedAt: savedDraft.updatedAt,
          canonicalStatus: savedDraft.operationResult?.canonicalStatus
            ?? persistedPreviousStatus as ArticleSaveReceipt["canonicalStatus"],
          ...(savedDraft.operationResult?.workingDraft ? { workingDraft: savedDraft.operationResult.workingDraft } : {}),
        },
        publicationState: "not-requested" as const,
        revalidationState: "unknown" as "scheduled" | "unknown",
        destination: intent === "preview"
          ? `/articles/${articleId}/preview?locale=${previewLocale}`
          : articleEditPath(articleId, { saved: "working-draft", error: publicationBlockMessage }),
      } satisfies ArticleSaveResult;
      if (!parseArticleSaveResult(result, {
        articleId, articleUpdatedAt: expectedUpdatedAt, englishUpdatedAt: englishExpectedUpdatedAt,
        workingDraftVersion: expectedWorkingDraftVersion,
        ...(operationContext ? { operationId: operationContext.operationId } : {}),
      })) return { outcome: "unknown-outcome" } satisfies ArticleSaveResult;
      result.revalidationState = scheduleArticleReceiptRevalidation(["/articles/edit", `/articles/${articleId}/preview`]);
      return result;
    }
    revalidatePath("/articles/edit");
    revalidatePath(`/articles/${articleId}/preview`);
    if (intent === "preview") {
      redirect(`/articles/${articleId}/preview?locale=${previewLocale}`);
    }
    redirect(
      articleEditPath(articleId, {
        saved: "working-draft",
        error: publicationBlockMessage,
      })
    );
  }

  const redirectSourcePath =
    previousSlug &&
    (previousSlug !== savedSlug || previousCategorySlug !== categorySlug)
      ? articlePublicPath(previousSlug, previousCategorySlug)
      : null;
  const redirectDestinationPath = redirectSourcePath
    ? articlePublicPath(savedSlug, categorySlug)
    : null;
  const socialPublishRequested =
    savedStatus === "published" && isNewRelease;
  const isPrivilegedRelease = [
    "published",
    "scheduled",
    "hidden",
    "archived",
  ].includes(savedStatus);
  const shouldPromoteExistingArticle = Boolean(
    articleId && intent === "publish" && isPrivilegedRelease
  );
  const bundleInput: ArticleBundleRpcInput = {
    articleId: articleId || null,
    expectedArticleUpdatedAt: articleId ? expectedUpdatedAt : null,
    articlePayload,
    englishMode,
    englishPayload,
    expectedEnglishUpdatedAt:
      englishMode === "save" || englishMode === "stale"
        ? englishExpectedUpdatedAt
        : null,
    redirectSourcePath,
    redirectDestinationPath,
    replaceHomepage:
      savedStatus === "published" &&
      parsed.data.showOnHomepage &&
      Boolean(parsed.data.categoryId),
    auditAction: articleId ? "article.updated" : "article.created",
    auditMetadata: {
      title: parsed.data.title,
      status: savedStatus,
      requested_status: parsed.data.status,
      publication_blocked: Boolean(publicationBlockMessage),
      slug: savedSlug,
      english_status: staleReleasedEnglishOnDisable
        ? "stale"
        : savedEnglishStatus,
      english_source_hash: englishData ? currentSourceHash : null,
      persistence: shouldPromoteExistingArticle
        ? "atomic-working-draft-promotion"
        : "atomic-article-bundle",
    },
    socialPublishRequested,
    socialMetadata: socialPublishRequested
      ? {
          article_id: articleId || null,
          title: parsed.data.title,
          slug: savedSlug,
          platforms: ["dzen"],
          requested_at: now,
          persistence: shouldPromoteExistingArticle
            ? "atomic-working-draft-promotion"
            : "atomic-article-bundle",
        }
      : {},
  };

  let saved: Awaited<ReturnType<typeof saveArticleBundleRpc>>;
  try {
    saved = shouldPromoteExistingArticle
      ? await promoteArticleWorkingDraftRpc(supabase, {
          ...bundleInput,
          expectedWorkingDraftVersion,
        }, operationContext)
      : await saveArticleBundleRpc(supabase, bundleInput, operationContext);
  } catch (error) {
    unstable_rethrow(error);
    if (operationContext && error instanceof ArticleOperationRpcError) throw error;
    return { outcome: "unknown-outcome" } satisfies ArticleSaveResult;
  }
  if (operationContext && saved.operationResult?.replayed) {
    return articleOperationSaveResult(saved.operationResult, operationContext)
      ?? { outcome: "unknown-outcome" } satisfies ArticleSaveResult;
  }

  if (receiptMode && ((englishMode === "none") !== (saved.englishUpdatedAt === null))) {
    return { outcome: "unknown-outcome" } satisfies ArticleSaveResult;
  }
  const confirmedReceipt = receiptMode ? parseArticleSaveResult({
    outcome: "saved", persistence: shouldPromoteExistingArticle ? "working-draft-promotion" : "article-bundle",
    ...(operationContext ? { operationId: operationContext.operationId,
      englishState: ({ save: "saved", none: "preserved", stale: "status-only" } as const)[englishMode] } : {}),
    receipt: { articleId: saved.articleId, articleUpdatedAt: saved.articleUpdatedAt,
      englishUpdatedAt: saved.englishUpdatedAt, workingDraftVersion: saved.operationResult?.workingDraft?.version ?? 0,
      workingDraftUpdatedAt: saved.operationResult?.workingDraft?.updatedAt ?? null,
      canonicalStatus: saved.operationResult?.canonicalStatus ?? savedStatus,
      ...(saved.operationResult?.workingDraft ? { workingDraft: saved.operationResult.workingDraft } : {}) },
    publicationState: "not-requested", revalidationState: "unknown",
    destination: articleEditPath(saved.articleId),
  }, { articleId: articleId || null, articleUpdatedAt: expectedUpdatedAt, englishUpdatedAt: englishExpectedUpdatedAt,
    workingDraftVersion: expectedWorkingDraftVersion,
    ...(operationContext ? { operationId: operationContext.operationId } : {}) }) : null;
  if (receiptMode && (!confirmedReceipt || confirmedReceipt.outcome !== "saved")) {
    return { outcome: "unknown-outcome" } satisfies ArticleSaveResult;
  }

  let publicationState: "started" | "queued" | "queue-error" | "unknown" | null = null;
  if (
    intent === "publish" &&
    ["published", "scheduled", "hidden", "archived"].includes(savedStatus)
  ) {
    const requestPublication = () => requestPublicBuild({
      supabase,
      actorId,
      entityType: "article",
      entityId: saved.articleId,
      reason: `article.status.${savedStatus}`,
      metadata: {
        persistence: shouldPromoteExistingArticle
          ? "atomic-working-draft-promotion"
          : "atomic-article-bundle",
        status: savedStatus,
        automatic_translation_deferred: automaticTranslationDeferred,
      },
      skipAutoTranslation: skipAutomaticTranslation,
    });
    if (receiptMode) {
      try {
        const publication = await requestPublication();
        publicationState = publication && ["started", "queued", "queue-error"].includes(publication.state)
          ? publication.state : "unknown";
      } catch (error) {
        unstable_rethrow(error);
        publicationState = "unknown";
      }
    } else {
      publicationState = (await requestPublication()).state;
    }
  }

  if (receiptMode && confirmedReceipt?.outcome === "saved") {
    return {
      ...confirmedReceipt,
      publicationState: publicationState ?? "not-requested",
      revalidationState: scheduleArticleReceiptRevalidation(["/dashboard", "/articles"]),
      destination: intent === "preview"
        ? `/articles/${saved.articleId}/preview?locale=${previewLocale}`
        : articleEditPath(saved.articleId, { saved: 1, error: publicationBlockMessage, publish: publicationState,
            released: intent === "publish" ? savedStatus : null,
            translation: automaticTranslationDeferred ? "deferred" : null, replaced: saved.homepageReplaced || null }),
    } satisfies ArticleSaveResult;
  }

  revalidatePath("/dashboard");
  revalidatePath("/articles");
  if (intent === "preview") {
    redirect(`/articles/${saved.articleId}/preview?locale=${previewLocale}`);
  }
  redirect(
    articleEditPath(saved.articleId, {
      saved: 1,
      error: publicationBlockMessage,
      publish: publicationState,
      released: intent === "publish" ? savedStatus : null,
      translation: automaticTranslationDeferred ? "deferred" : null,
      replaced: saved.homepageReplaced || null,
    })
  );
}
