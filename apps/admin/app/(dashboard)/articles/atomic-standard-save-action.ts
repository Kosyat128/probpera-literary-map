"use server";

import { revalidatePath } from "next/cache";
import sanitizeHtml from "sanitize-html";
import { z } from "zod";

import { articleEditPath } from "@/lib/admin-routes";
import { articlePublicPath } from "@/lib/article-route";
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
import {
  positionLeadingIllustrationHtml,
  positionLeadingIllustrationJson,
} from "@/lib/article-leading-illustration";
import { adminEnv } from "@/lib/env";
import { redirect } from "@/lib/navigation";
import { requestPublicBuild } from "@/lib/publication";
import { createSlug } from "@/lib/slug";
import { createServerSupabaseClient } from "@/lib/supabase/server";

import { saveArticleAction as legacySaveArticleAction } from "./actions-legacy";
import {
  isArticleBundleRpcAvailable,
  saveArticleBundleRpc,
} from "./article-bundle-rpc";

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
      "data-text-tone",
    ],
  },
  allowedSchemes: ["http", "https", "mailto"],
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", {
      rel: "noopener noreferrer",
    }),
    span: (tagName: string, attributes: Record<string, string>) => ({
      tagName,
      attribs: safeTextToneSpanAttributes(attributes),
    }),
  },
};

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

function saveErrorPath(articleId: string | undefined, message: string) {
  return articleId
    ? articleEditPath(articleId, { error: message })
    : `/articles/new?error=${encodeURIComponent(message)}`;
}

export async function saveStandardArticleAtomically(formData: FormData) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  const actorId = session.user.id;
  const expectedUpdatedAt = optionalText(formData.get("expected_updated_at"));
  const englishExpectedUpdatedAt = optionalText(
    formData.get("english_expected_updated_at")
  );

  const intent = String(formData.get("intent") || "save");
  const requestedStatus =
    intent === "publish"
      ? "published"
      : String(formData.get("status") || "draft");
  const previousStatusFromForm = String(
    formData.get("previous_status") || "draft"
  );
  const title = String(formData.get("title") || "");
  const rawSlug = String(formData.get("slug") || "");
  const generatedSlug = createSlug(rawSlug || title) || `material-${Date.now()}`;
  const scheduledAt = optionalText(formData.get("scheduled_at"));
  const status =
    requestedStatus === "scheduled" && !scheduledAt ? "draft" : requestedStatus;
  const canonicalUrl = optionalText(formData.get("canonical_url"));

  const parsed = articleSchema.safeParse({
    id: optionalText(formData.get("id")) || undefined,
    title,
    subtitle: String(formData.get("subtitle") || ""),
    excerpt: String(formData.get("excerpt") || ""),
    slug: generatedSlug,
    contentHtml: String(formData.get("content_html") || ""),
    contentJson: String(formData.get("content_json") || "{}"),
    categoryId: optionalText(formData.get("category_id")),
    status,
    scheduledAt,
    coverExternalUrl: optionalText(formData.get("cover_external_url")),
    coverAlt: String(formData.get("cover_alt") || ""),
    legacyPath: optionalText(formData.get("legacy_path")),
    seoTitle: String(formData.get("seo_title") || ""),
    seoDescription: String(formData.get("seo_description") || ""),
    seoKeywords: commaList(formData.get("seo_keywords")),
    canonicalUrl,
    ogTitle: String(formData.get("og_title") || ""),
    ogDescription: String(formData.get("og_description") || ""),
    sources: lineItems(formData.get("sources")),
    bibliography: lineItems(formData.get("bibliography")),
    allowIndexing: formData.get("allow_indexing") === "on",
    featured: formData.get("featured") === "on",
    showOnHomepage: formData.get("show_on_homepage") === "on",
    pinned: formData.get("pinned") === "on",
  });

  if (!parsed.success) {
    const failedArticleId = optionalText(formData.get("id")) || undefined;
    const errorMessage = parsed.error.issues[0]?.message || "Проверьте поля статьи.";
    redirect(saveErrorPath(failedArticleId, errorMessage));
  }

  const englishEnabled = formData.get("english_enabled") === "on";
  const englishTitle = String(formData.get("english_title") || "");
  const englishSlug =
    createSlug(String(formData.get("english_slug") || "") || englishTitle) ||
    `english-material-${Date.now()}`;
  const parsedEnglish = englishEnabled
    ? articleTranslationSchema.safeParse({
        enabled: true,
        title: englishTitle,
        subtitle: String(formData.get("english_subtitle") || ""),
        excerpt: String(formData.get("english_excerpt") || ""),
        slug: englishSlug,
        contentHtml: String(formData.get("english_content_html") || ""),
        contentJson: String(formData.get("english_content_json") || "{}"),
        coverAlt: String(formData.get("english_cover_alt") || ""),
        seoTitle: String(formData.get("english_seo_title") || ""),
        seoDescription: String(
          formData.get("english_seo_description") || ""
        ),
        seoKeywords: commaList(formData.get("english_seo_keywords")),
        canonicalUrl: optionalText(formData.get("english_canonical_url")),
        ogTitle: String(formData.get("english_og_title") || ""),
        ogDescription: String(formData.get("english_og_description") || ""),
        sources: lineItems(formData.get("english_sources")),
        bibliography: lineItems(formData.get("english_bibliography")),
        status: String(formData.get("english_status") || "draft"),
        confirmCurrentSource:
          formData.get("english_confirm_current_source") === "on",
      })
    : null;

  if (parsedEnglish && !parsedEnglish.success) {
    const failedArticleId = optionalText(formData.get("id")) || undefined;
    const errorMessage =
      parsedEnglish.error.issues[0]?.message ||
      "Проверьте поля английской версии статьи.";
    redirect(saveErrorPath(failedArticleId, errorMessage));
  }

  const englishData = parsedEnglish?.success ? parsedEnglish.data : null;
  const isNewRelease =
    intent === "publish" ||
    requestedStatus === "scheduled" ||
    (requestedStatus === "published" &&
      previousStatusFromForm !== "published");
  const requiresReleaseValidation =
    parsed.data.status === "published" || parsed.data.status === "scheduled";
  const publicationIssues = new Set<string>();
  const publicationOverride = formData.get("publication_override") === "1";

  if (requiresReleaseValidation) {
    const releaseContentHtml = sanitizeHtml(
      parsed.data.contentHtml,
      allowedArticleHtml
    );
    const releaseEnglishContentHtml = englishData
      ? sanitizeHtml(englishData.contentHtml, allowedArticleHtml)
      : "";
    const plainText = sanitizeHtml(releaseContentHtml, {
      allowedTags: [],
      allowedAttributes: {},
    })
      .replace(/\s+/gu, " ")
      .trim();
    const releaseIssues = [
      !parsed.data.categoryId && "выберите рубрику",
      plainText.split(/\s+/u).filter(Boolean).length < 250 &&
        "добавьте не менее 250 слов",
      !/<h2(?:\s|>)/iu.test(releaseContentHtml) &&
        "добавьте смысловые подзаголовки H2",
      parsed.data.excerpt.length < 80 &&
        "расширьте описание карточки до 80 знаков",
      (!parsed.data.coverExternalUrl || parsed.data.coverAlt.length < 10) &&
        "добавьте обложку и её описание",
      parsed.data.seoDescription.length < 80 &&
        "расширьте SEO-описание до 80 знаков",
      parsed.data.sources.length === 0 && "укажите хотя бы один источник",
      /data-editorial-block=["']media["']/iu.test(releaseContentHtml) &&
        "замените все места для изображений настоящими файлами",
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
                  contentHtml: releaseEnglishContentHtml,
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
    ].filter(Boolean) as string[];
    releaseIssues.forEach((issue) => publicationIssues.add(issue));
  }

  const savedSlug = parsed.data.slug || generatedSlug;
  let contentJson: unknown;
  try {
    contentJson = positionLeadingIllustrationJson(
      sanitizeArticleTextToneJson(JSON.parse(parsed.data.contentJson))
    );
  } catch {
    contentJson = { type: "doc", content: [] };
  }
  const sanitizedContentHtml = positionLeadingIllustrationHtml(
    sanitizeHtml(parsed.data.contentHtml, allowedArticleHtml)
  );

  let englishContentJson: unknown = null;
  const sanitizedEnglishContentHtml = englishData
    ? positionLeadingIllustrationHtml(
        sanitizeHtml(englishData.contentHtml, allowedArticleHtml)
      )
    : "";
  if (englishData) {
    try {
      englishContentJson = positionLeadingIllustrationJson(
        sanitizeArticleTextToneJson(JSON.parse(englishData.contentJson))
      );
    } catch {
      englishContentJson = { type: "doc", content: [] };
    }
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

  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/articles/new?error=База данных не подключена");
  if (!(await isArticleBundleRpcAvailable(supabase))) {
    return legacySaveArticleAction(formData);
  }

  const now = new Date().toISOString();
  const articleId = parsed.data.id;
  let previousSlug: string | null = null;
  let previousPublishedAt: string | null = null;
  let previousCategorySlug: string | null = null;
  let persistedPreviousStatus: string | undefined;
  let existingEnglishTranslation: ExistingEnglishTranslation | null = null;

  let categorySlug: string | null = null;
  if (parsed.data.categoryId) {
    const { data: category } = await supabase
      .from("categories")
      .select("slug")
      .eq("id", parsed.data.categoryId)
      .maybeSingle();
    categorySlug = category?.slug || null;
  }

  if (articleId) {
    const [
      { data: previous, error: previousError },
      { data: englishTranslation, error: englishError },
    ] = await Promise.all([
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

    if (previousError || !previous) {
      redirect(
        articleEditPath(articleId, {
          error: `Не удалось прочитать исходную статью: ${
            previousError?.message || "запись не найдена"
          }`,
        })
      );
    }
    if (!expectedUpdatedAt || previous.updated_at !== expectedUpdatedAt) {
      redirect(
        articleEditPath(articleId, {
          error:
            "Статья уже изменена в другой вкладке. Обновите страницу и повторите правку.",
        })
      );
    }
    if (englishError) {
      redirect(
        articleEditPath(articleId, {
          error: `Не удалось прочитать английскую версию: ${englishError.message}`,
        })
      );
    }

    existingEnglishTranslation =
      (englishTranslation as ExistingEnglishTranslation | null) || null;
    if (
      existingEnglishTranslation &&
      (!englishExpectedUpdatedAt ||
        existingEnglishTranslation.updated_at !== englishExpectedUpdatedAt)
    ) {
      redirect(
        articleEditPath(articleId, {
          error:
            "Английская версия уже изменена в другой вкладке. Обновите страницу и повторите правку.",
        })
      );
    }

    previousSlug = previous.slug || null;
    previousPublishedAt = previous.published_at || null;
    persistedPreviousStatus = previous.status || undefined;
    const previousCategory = Array.isArray(previous.categories)
      ? previous.categories[0]
      : previous.categories;
    previousCategorySlug = previousCategory?.slug || null;
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
    (parsed.data.status === "published" || parsed.data.status === "scheduled");

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

  const publicationSavePolicy = publicationFailureSavePolicy({
    hasIssues: publicationIssues.size > 0,
    previousStatus: persistedPreviousStatus,
    requestedStatus: parsed.data.status,
  });
  if (publicationSavePolicy.kind === "preserve-published") {
    if (!articleId) {
      redirect("/articles?error=Не удалось определить опубликованную статью");
    }
    const errorMessage = `Публикация остановлена: ${Array.from(
      publicationIssues
    ).join(
      "; "
    )}. Опубликованная версия оставлена без изменений. Новые правки находятся в локальной автокопии редактора — нажмите «Восстановить копию» после возврата.`;
    redirect(articleEditPath(articleId, { error: errorMessage }));
  }

  const publicationBlockMessage = publicationIssues.size
    ? `Публикация остановлена: ${Array.from(publicationIssues).join(
        "; "
      )}. Текст и изображения сохранены в черновике.`
    : null;
  const savedStatus = publicationSavePolicy.savedStatus;
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

  let saved: Awaited<ReturnType<typeof saveArticleBundleRpc>>;
  try {
    saved = await saveArticleBundleRpc(supabase, {
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
        persistence: "atomic-article-bundle",
      },
      socialPublishRequested,
      socialMetadata: socialPublishRequested
        ? {
            article_id: articleId || null,
            title: parsed.data.title,
            slug: savedSlug,
            platforms: ["dzen"],
            requested_at: now,
            persistence: "atomic-article-bundle",
          }
        : {},
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Не удалось атомарно сохранить статью.";
    redirect(saveErrorPath(articleId, message));
  }

  let publicationState: "started" | "queued" | "queue-error" | null = null;
  if (savedStatus === "published") {
    const publication = await requestPublicBuild({
      supabase,
      actorId,
      entityType: "article",
      entityId: saved.articleId,
      reason: "article.published",
      metadata: { persistence: "atomic-article-bundle" },
    });
    publicationState = publication.state;
  }

  revalidatePath("/dashboard");
  revalidatePath("/articles");
  redirect(
    articleEditPath(saved.articleId, {
      saved: 1,
      error: publicationBlockMessage,
      publish: publicationState,
      replaced: saved.homepageReplaced || null,
    })
  );
}
