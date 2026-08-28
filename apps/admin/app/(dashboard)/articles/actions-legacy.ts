"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "@/lib/navigation";
import sanitizeHtml from "sanitize-html";
import { z } from "zod";

import { requireStaff } from "@/lib/auth";
import { articleEditPath } from "@/lib/admin-routes";
import {
  articleCompensationPayload,
  articleTranslationSourceHash,
  canReuseEnglishTranslationApproval,
  englishTranslationCompensationPayload,
  englishTranslationReleaseIssues,
  isReleasedTranslationStatus,
  publicationFailureSavePolicy,
  type ArticleTranslationStatus,
} from "@/lib/article-translations";
import { adminEnv } from "@/lib/env";
import { sanitizeEditorAnchorAttributes } from "@/lib/editor-link";
import { articlePublicPath } from "@/lib/article-route";
import {
  safeTextToneSpanAttributes,
  sanitizeArticleTextToneJson,
} from "@/lib/article-content-presentation";
import {
  positionLeadingIllustrationHtml,
  positionLeadingIllustrationJson,
} from "@/lib/article-leading-illustration";
import { requestPublicBuild } from "@/lib/publication";
import { createSlug } from "@/lib/slug";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const articleSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(3).max(240),
  subtitle: z.string().trim().max(360).default(""),
  excerpt: z.string().trim().max(700).default(""),
  slug: z.string().trim().max(180).optional(),
  contentHtml: z.string().max(2_000_000).default(""),
  contentJson: z.string().max(2_000_000).default("{}"),
  categoryId: z.string().uuid().nullable(),
  status: z.enum(["draft", "review", "scheduled", "published", "hidden", "archived"]),
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
  bibliography: z.array(z.object({ text: z.string().max(1000) })).max(100).default([]),
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
  bibliography: z.array(z.object({ text: z.string().max(1000) })).max(100).default([]),
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
  id: string;
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
  source_article_updated_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  approved_by: string | null;
  created_by: string;
  approved_at: string | null;
  published_at: string | null;
  updated_by: string | null;
  deleted_at: string | null;
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
      "data-text-tone",
    ],
  },
  allowedSchemes: ["http", "https", "mailto"],
  transformTags: {
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

type LegacyArticleCatalogItem = {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  imageAlt?: string;
  sectionId?: string;
  publishedLabel?: string;
  url?: string;
};

type LegacyArticleDocument = {
  contentHtml?: string;
};

const legacyCategoryBySection: Record<string, string> = {
  "book-opinions": "book-opinions",
  "screen-adaptations": "screen-adaptations",
  "writers-world": "writers-world",
  "book-guides": "book-guides",
  awards: "awards",
  folklore: "folklore",
  language: "language",
  "literary-essays": "literary-essays",
  "author-stories": "author-stories",
};

function legacyPath(value?: string) {
  if (!value) return null;
  try {
    const parsed = new URL(value, adminEnv.publicSiteUrl);
    return parsed.hostname === new URL(adminEnv.publicSiteUrl).hostname
      ? parsed.pathname
      : null;
  } catch {
    return null;
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`Источник архива ответил ${response.status}.`);
  }
  return (await response.json()) as T;
}

export async function importLegacyArticlesAction() {
  const session = await requireStaff(["owner", "admin"]);
  if (!session?.user) redirect("/login");
  const userId = session.user.id;
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/articles?error=База данных не подключена");

  let catalog: LegacyArticleCatalogItem[];
  try {
    catalog = await fetchJson<LegacyArticleCatalogItem[]>(
      `${adminEnv.publicSiteUrl}/articles/index.json`
    );
  } catch (error) {
    redirect(
      `/articles?error=${encodeURIComponent(
        error instanceof Error ? error.message : "Не удалось прочитать архив статей."
      )}`
    );
  }

  const [{ data: existingRows }, { data: categoryRows }] = await Promise.all([
    supabase.from("articles").select("legacy_id").not("legacy_id", "is", null),
    supabase.from("categories").select("id,slug"),
  ]);
  const existingIds = new Set(
    (existingRows || []).map((article) => String(article.legacy_id || ""))
  );
  const categoryIds = new Map(
    (categoryRows || []).map((category) => [category.slug, category.id])
  );
  const missing = catalog.filter(
    (article) => article.id && article.title && !existingIds.has(article.id)
  );

  let imported = 0;
  for (let offset = 0; offset < missing.length; offset += 12) {
    const batch = missing.slice(offset, offset + 12);
    const documents = await Promise.all(
      batch.map(async (article) => {
        try {
          return await fetchJson<LegacyArticleDocument>(
            `${adminEnv.publicSiteUrl}/articles/${encodeURIComponent(article.id)}.json`
          );
        } catch {
          return { contentHtml: "" };
        }
      })
    );
    const payload = batch.map((article, index) => {
      const categorySlug = legacyCategoryBySection[article.sectionId || ""];
      const slug = createSlug(article.title) || "material";
      const path = legacyPath(article.url);
      return {
        legacy_id: article.id,
        title: article.title.trim(),
        excerpt: String(article.description || "").trim().slice(0, 700),
        content_json: { type: "doc", content: [] },
        content_html: positionLeadingIllustrationHtml(
          sanitizeHtml(documents[index]?.contentHtml || "", allowedArticleHtml)
        ),
        cover_external_url: article.imageUrl || null,
        cover_alt:
          article.imageAlt ||
          (article.imageUrl ? `Иллюстрация к статье «${article.title}»` : ""),
        category_id: categorySlug ? categoryIds.get(categorySlug) || null : null,
        author_id: userId,
        status: "draft",
        slug,
        legacy_path: path,
        published_at: null,
        seo_title: article.title.trim(),
        seo_description:
          String(article.description || "").trim().slice(0, 400) ||
          `Авторский материал журнала «Проба Пера»: ${article.title}`,
        canonical_url: `${adminEnv.publicSiteUrl}${articlePublicPath(slug, categorySlug)}`,
        allow_indexing: false,
        created_by: userId,
        updated_by: userId,
      };
    });
    const { error } = await supabase.from("articles").insert(payload);
    if (error) {
      redirect(`/articles?error=${encodeURIComponent(error.message)}`);
    }
    imported += payload.length;
  }

  await supabase.from("admin_audit_log").insert({
    actor_id: userId,
    action: "articles.legacy_imported",
    entity_type: "article",
    metadata: {
      imported,
      skipped: catalog.length - missing.length,
      source: `${adminEnv.publicSiteUrl}/articles/index.json`,
    },
  });
  revalidatePath("/articles");
  revalidatePath("/dashboard");
  redirect(
    `/articles?imported=${imported}&skipped=${catalog.length - missing.length}`
  );
}

export async function saveArticleAction(formData: FormData) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  const actorId = session.user.id;
  const expectedUpdatedAt = optionalText(formData.get("expected_updated_at"));
  const englishExpectedUpdatedAt = optionalText(
    formData.get("english_expected_updated_at")
  );

  const intent = String(formData.get("intent") || "save");
  const requestedStatus =
    intent === "publish" ? "published" : String(formData.get("status") || "draft");
  const previousStatus = String(formData.get("previous_status") || "draft");
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
    const failedArticleId = optionalText(formData.get("id")) || "new";
    const errorMessage = parsed.error.issues[0]?.message || "Проверьте поля статьи.";
    redirect(
      failedArticleId === "new"
        ? `/articles/new?error=${encodeURIComponent(errorMessage)}`
        : articleEditPath(failedArticleId, { error: errorMessage })
    );
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
    const failedArticleId = optionalText(formData.get("id")) || "new";
    const errorMessage =
      parsedEnglish.error.issues[0]?.message ||
      "Проверьте поля английской версии статьи.";
    redirect(
      failedArticleId === "new"
        ? `/articles/new?error=${encodeURIComponent(errorMessage)}`
        : articleEditPath(failedArticleId, { error: errorMessage })
    );
  }

  const englishData = parsedEnglish?.success ? parsedEnglish.data : null;
  const isNewRelease =
    intent === "publish" ||
    requestedStatus === "scheduled" ||
    (requestedStatus === "published" && previousStatus !== "published");
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
    }).replace(/\s+/gu, " ").trim();
    const releaseIssues = [
      !parsed.data.categoryId && "выберите рубрику",
      plainText.split(/\s+/u).filter(Boolean).length < 250 && "добавьте не менее 250 слов",
      !/<h2(?:\s|>)/iu.test(releaseContentHtml) && "добавьте смысловые подзаголовки H2",
      parsed.data.excerpt.length < 80 && "расширьте описание карточки до 80 знаков",
      (!parsed.data.coverExternalUrl || parsed.data.coverAlt.length < 10) && "добавьте обложку и её описание",
      parsed.data.seoDescription.length < 80 && "расширьте SEO-описание до 80 знаков",
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
    slug: parsed.data.slug || generatedSlug,
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

  const now = new Date().toISOString();
  let articleId = parsed.data.id;
  let previousSlug: string | null = null;
  let previousPublishedAt: string | null = null;
  let previousCategorySlug: string | null = null;
  let previousArticleSnapshot: ReturnType<
    typeof articleCompensationPayload
  > | null = null;
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
        .select(
          "title,subtitle,excerpt,slug,content_html,content_json,category_id,status,scheduled_at,published_at,cover_external_url,cover_alt,legacy_path,seo_title,seo_description,seo_keywords,canonical_url,og_title,og_description,allow_indexing,sources,bibliography,featured,show_on_homepage,pinned,updated_by,updated_at,categories(slug)"
        )
        .eq("id", articleId)
        .single(),
      supabase
        .from("article_translations")
        .select(
          "id,status,source_content_hash,title,subtitle,excerpt,content_json,content_html,cover_alt,slug,sources,bibliography,seo_title,seo_description,seo_keywords,canonical_url,og_title,og_description,source_article_updated_at,reviewed_by,reviewed_at,approved_by,approved_at,published_at,created_by,updated_by,updated_at,deleted_at"
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
          error: "Статья уже изменена в другой вкладке. Обновите страницу и повторите правку.",
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
          error: "Английская версия уже изменена в другой вкладке. Обновите страницу и повторите правку.",
        })
      );
    }
    previousArticleSnapshot = articleCompensationPayload(
      previous as unknown as Record<string, unknown>
    );
    previousSlug = previous?.slug || null;
    previousPublishedAt = previous?.published_at || null;
    const previousCategory = Array.isArray(previous?.categories)
      ? previous.categories[0]
      : previous?.categories;
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
    previousStatus: previousArticleSnapshot?.status as string | undefined,
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
    )}. Опубликованная версия оставлена без изменений. Новые правки находятся в локальной автокопии редактора - нажмите «Восстановить копию» после возврата.`;
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

  const payload = {
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
    canonical_url:
      `${adminEnv.publicSiteUrl}${articlePublicPath(savedSlug, categorySlug)}`,
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
    updated_by: session.user.id,
  };

  if (articleId) {
    const { data: updated, error } = await supabase
      .from("articles")
      .update(payload)
      .eq("id", articleId)
      .eq("updated_at", expectedUpdatedAt!)
      .select("id")
      .maybeSingle();
    if (error || !updated) {
      redirect(
        articleEditPath(articleId, {
          error:
            error?.message ||
            "Статья уже изменена в другой вкладке. Обновите страницу и повторите правку.",
        })
      );
    }
  } else {
    const { data, error } = await supabase
      .from("articles")
      .insert({
        ...payload,
        created_by: session.user.id,
      })
      .select("id")
      .single();
    if (error || !data) {
      redirect(`/articles/new?error=${encodeURIComponent(error?.message || "Статья не создана")}`);
    }
    articleId = data.id;
  }

  if (!articleId) {
    redirect("/articles?error=Не удалось определить сохранённую статью");
  }

  const compensateAfterEnglishFailure = async () => {
    let compensationMessage =
      "Предыдущая версия статьи восстановлена полностью";

    if (previousArticleSnapshot) {
      const { error: articleRestoreError } = await supabase
        .from("articles")
        .update({ ...previousArticleSnapshot, updated_by: actorId })
        .eq("id", articleId);

      if (articleRestoreError) {
        const { error: safetyDraftError } = await supabase
          .from("articles")
          .update({
            status: "draft",
            scheduled_at: null,
            published_at: null,
            updated_by: actorId,
          })
          .eq("id", articleId);
        compensationMessage = safetyDraftError
          ? `Автоматическое восстановление исходной статьи не завершено (${articleRestoreError.message}), защитный перевод в черновик также не выполнен (${safetyDraftError.message}); требуется немедленная ручная проверка`
          : `Автоматическое восстановление исходной статьи не завершено (${articleRestoreError.message}); статья защитно переведена в черновик и требует ручной проверки`;
      } else if (existingEnglishTranslation) {
        const englishRestoreSnapshot = englishTranslationCompensationPayload(
          existingEnglishTranslation as unknown as Record<string, unknown>
        );
        const {
          created_by: _previousEnglishCreator,
          updated_by: _previousEnglishUpdater,
          ...mutableEnglishRestoreSnapshot
        } = englishRestoreSnapshot;
        const {
          data: restoredEnglishTranslation,
          error: englishRestoreError,
        } = await supabase
          .from("article_translations")
          .update({
            ...mutableEnglishRestoreSnapshot,
            updated_by: actorId,
          })
          .eq("id", existingEnglishTranslation.id)
          .eq("article_id", articleId)
          .eq("locale", "en")
          .select("id")
          .maybeSingle();

        if (englishRestoreError || !restoredEnglishTranslation) {
          const englishRestoreMessage =
            englishRestoreError?.message ||
            "прежняя английская запись не была восстановлена";
          const { error: safetyDraftError } = await supabase
            .from("articles")
            .update({
              status: "draft",
              scheduled_at: null,
              published_at: null,
              updated_by: actorId,
            })
            .eq("id", articleId);
          compensationMessage = safetyDraftError
            ? `Исходная статья восстановлена, но прежнюю английскую версию восстановить не удалось (${englishRestoreMessage}), а защитный перевод русской версии в черновик завершился ошибкой (${safetyDraftError.message}); требуется немедленная ручная проверка`
            : `Прежнюю английскую версию восстановить не удалось (${englishRestoreMessage}); русская статья защитно переведена в черновик и требует ручной проверки`;
        }
      }
    } else {
      const { error: draftFallbackError } = await supabase
        .from("articles")
        .update({
          status: "draft",
          scheduled_at: null,
          published_at: null,
          updated_by: actorId,
        })
        .eq("id", articleId);
      compensationMessage = draftFallbackError
        ? `Новую статью не удалось перевести в черновик (${draftFallbackError.message}); требуется ручная проверка`
        : "Новая статья сохранена только как черновик";
    }

    return compensationMessage;
  };

  if (staleReleasedEnglishOnDisable && existingEnglishTranslation) {
    const { data: disabledEnglishTranslation, error: englishDisableError } =
      await supabase
      .from("article_translations")
      .update({
        status: "stale",
        approved_by: null,
        approved_at: null,
        published_at: null,
        updated_by: session.user.id,
      })
      .eq("id", existingEnglishTranslation.id)
      .eq("article_id", articleId)
      .eq("locale", "en")
      .eq("updated_at", englishExpectedUpdatedAt || "")
      .select("id")
      .maybeSingle();

    if (englishDisableError || !disabledEnglishTranslation) {
      const compensationMessage = await compensateAfterEnglishFailure();
      const disableFailure =
        englishDisableError?.message ||
        "запись английской версии не была обновлена";
      redirect(
        articleEditPath(articleId, {
          error: `Английская версия не отключена безопасно. ${compensationMessage}: ${disableFailure}`,
        })
      );
    }
  }

  if (englishData && savedEnglishStatus) {
    const englishReleased = isReleasedTranslationStatus(savedEnglishStatus);
    const englishPublished = savedEnglishStatus === "published";
    const englishSavePayload = {
      article_id: articleId,
      locale: "en",
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
      source_article_updated_at: now,
      reviewed_by:
        savedEnglishStatus === "review" || englishReleased ? actorId : null,
      reviewed_at:
        savedEnglishStatus === "review" || englishReleased ? now : null,
      approved_by: englishReleased ? actorId : null,
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
      updated_by: actorId,
      deleted_at: null,
    };
    const englishSaveResult = existingEnglishTranslation
      ? await supabase
          .from("article_translations")
          .update(englishSavePayload)
          .eq("id", existingEnglishTranslation.id)
          .eq("article_id", articleId)
          .eq("locale", "en")
          .eq("updated_at", englishExpectedUpdatedAt || "")
          .select("id")
          .maybeSingle()
      : await supabase
          .from("article_translations")
          .insert({ ...englishSavePayload, created_by: actorId })
          .select("id")
          .maybeSingle();
    const englishSaveError =
      englishSaveResult.error ||
      (!englishSaveResult.data
        ? new Error("запись английской версии не была сохранена")
        : null);

    if (englishSaveError) {
      const compensationMessage = await compensateAfterEnglishFailure();
      redirect(
        articleEditPath(articleId, {
          error: `Английская версия не сохранена. ${compensationMessage}: ${englishSaveError.message}`,
        })
      );
    }
  }

  if (
    previousSlug &&
    (previousSlug !== savedSlug || previousCategorySlug !== categorySlug)
  ) {
    await supabase.from("redirects").upsert(
      {
        source_path: articlePublicPath(previousSlug, previousCategorySlug),
        destination_path: articlePublicPath(savedSlug, categorySlug),
        status_code: 301,
        is_active: true,
        created_by: session.user.id,
      },
      { onConflict: "source_path" }
    );
  }

  await supabase.from("admin_audit_log").insert({
    actor_id: session.user.id,
    action: parsed.data.id ? "article.updated" : "article.created",
    entity_type: "article",
    entity_id: articleId,
    metadata: {
      title: parsed.data.title,
      status: savedStatus,
      requested_status: parsed.data.status,
      publication_blocked: Boolean(publicationBlockMessage),
      slug: savedSlug,
      english_status: staleReleasedEnglishOnDisable
        ? "stale"
        : savedEnglishStatus,
      english_source_hash: englishData ? currentSourceHash : null,
    },
  });

  let homepageReplaced = 0;
  if (
    savedStatus === "published" &&
    parsed.data.showOnHomepage &&
    parsed.data.categoryId
  ) {
    const { data: replacedArticles, error: replacementError } = await supabase
      .from("articles")
      .update({
        show_on_homepage: false,
        updated_by: session.user.id,
      })
      .eq("category_id", parsed.data.categoryId)
      .eq("status", "published")
      .eq("show_on_homepage", true)
      .neq("id", articleId)
      .select("id");

    if (replacementError) {
      await supabase.from("admin_audit_log").insert({
        actor_id: session.user.id,
        action: "homepage.article_replacement_failed",
        entity_type: "article",
        entity_id: articleId,
        metadata: { error: replacementError.message },
      });
    } else {
      homepageReplaced = replacedArticles?.length || 0;
    }
  }

  let publicationState: "started" | "queued" | "queue-error" | null = null;
  if (savedStatus === "published") {
    if (isNewRelease) {
      await supabase.from("admin_audit_log").insert({
        actor_id: session.user.id,
        action: "social_publish.requested",
        entity_type: "article",
        entity_id: articleId,
        metadata: {
          article_id: articleId,
          title: parsed.data.title,
          slug: savedSlug,
          platforms: ["dzen"],
          requested_at: now,
        },
      });
    }
    const publication = await requestPublicBuild({
      supabase,
      actorId: session.user.id,
      entityType: "article",
      entityId: articleId,
      reason: "article.published",
    });
    publicationState = publication.state;
  }

  revalidatePath("/dashboard");
  revalidatePath("/articles");
  redirect(
    articleEditPath(articleId, {
      saved: 1,
      error: publicationBlockMessage,
      publish: publicationState,
      replaced: homepageReplaced || null,
    })
  );
}

function articleIdFromForm(formData: FormData) {
  const parsed = z.string().uuid().safeParse(formData.get("id"));
  return parsed.success ? parsed.data : null;
}

function articleExpectedUpdatedAtFromForm(formData: FormData) {
  const parsed = z.string().datetime({ offset: true }).safeParse(
    formData.get("expected_updated_at")
  );
  return parsed.success ? parsed.data : null;
}

export async function requestSocialPublicationAction(formData: FormData) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  const id = articleIdFromForm(formData);
  if (!id) redirect("/articles?error=Некорректный идентификатор статьи");

  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect(articleEditPath(id, { error: "База данных не подключена" }));
  const { data: article, error } = await supabase
    .from("articles")
    .select("id,title,slug,status")
    .eq("id", id)
    .maybeSingle();
  if (error || !article) {
    redirect(
      articleEditPath(id, {
        error: error?.message || "Статья не найдена",
      })
    );
  }
  if (article.status !== "published") {
    redirect(
      articleEditPath(id, {
        error: "Автопостинг доступен только для опубликованной статьи",
      })
    );
  }

  const { data: latestRequests, error: latestRequestError } = await supabase
    .from("admin_audit_log")
    .select("id")
    .eq("action", "social_publish.requested")
    .eq("entity_type", "article")
    .eq("entity_id", article.id)
    .order("created_at", { ascending: false })
    .limit(1);
  if (latestRequestError) {
    redirect(articleEditPath(id, { error: latestRequestError.message }));
  }

  const latestRequest = latestRequests?.[0] || null;
  const { data: completedRows, error: completionError } = latestRequest
    ? await supabase
        .from("admin_audit_log")
        .select("id")
        .eq("action", "social_publish.completed")
        .eq("entity_type", "social_publication")
        .eq("entity_id", String(latestRequest.id))
        .limit(1)
    : { data: [], error: null };
  if (completionError) {
    redirect(articleEditPath(id, { error: completionError.message }));
  }

  const resumedPendingRequest = Boolean(latestRequest && !completedRows?.length);
  if (!resumedPendingRequest) {
    const { error: queueError } = await supabase.from("admin_audit_log").insert({
      actor_id: session.user.id,
      action: "social_publish.requested",
      entity_type: "article",
      entity_id: article.id,
      metadata: {
        article_id: article.id,
        title: article.title,
        slug: article.slug,
        platforms: ["dzen"],
        requested_at: new Date().toISOString(),
        reason: "manual-editor-request",
      },
    });
    if (queueError) {
      redirect(articleEditPath(id, { error: queueError.message }));
    }
  }

  const publication = await requestPublicBuild({
    supabase,
    actorId: session.user.id,
    entityType: "article",
    entityId: article.id,
    reason: "article.social-publication.requested",
  });
  revalidatePath(articleEditPath(id));
  redirect(
    articleEditPath(id, {
      social: resumedPendingRequest ? "retrying" : "requested",
      publish: publication.state,
    })
  );
}

async function auditArticleAction(
  action: string,
  articleId: string,
  metadata: Record<string, unknown> = {}
) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/articles?error=База данных не подключена");
  await supabase.from("admin_audit_log").insert({
    actor_id: session.user.id,
    action,
    entity_type: "article",
    entity_id: articleId,
    metadata,
  });
  return { userId: session.user.id, supabase };
}

export async function duplicateArticleAction(formData: FormData) {
  const id = articleIdFromForm(formData);
  if (!id) redirect("/articles?error=Некорректный материал");
  const { userId, supabase } = await auditArticleAction(
    "article.duplicate.requested",
    id
  );
  const [
    { data: source, error: sourceError },
    { data: sourceEnglishTranslation, error: sourceEnglishError },
  ] = await Promise.all([
    supabase.from("articles").select("*").eq("id", id).single(),
    supabase
      .from("article_translations")
      .select(
        "title,subtitle,excerpt,content_json,content_html,cover_alt,slug,sources,bibliography,seo_title,seo_description,seo_keywords,og_title,og_description"
      )
      .eq("article_id", id)
      .eq("locale", "en")
      .is("deleted_at", null)
      .maybeSingle(),
  ]);
  if (sourceError || !source) {
    redirect(`/articles?error=${encodeURIComponent(sourceError?.message || "Статья не найдена")}`);
  }
  if (sourceEnglishError) {
    redirect(
      `/articles?error=${encodeURIComponent(
        `Не удалось прочитать английскую версию: ${sourceEnglishError.message}`
      )}`
    );
  }

  const copySlugBase = createSlug(`${source.slug}-kopiya`).slice(0, 170);
  const { data: existingCopies } = await supabase
    .from("articles")
    .select("slug")
    .like("slug", `${copySlugBase}%`);
  const usedCopySlugs = new Set(
    (existingCopies || []).map((article) => String(article.slug || ""))
  );
  let copySlug = copySlugBase;
  let copyNumber = 2;
  while (usedCopySlugs.has(copySlug)) {
    copySlug = `${copySlugBase}-${copyNumber}`;
    copyNumber += 1;
  }
  const { data: copy, error } = await supabase
    .from("articles")
    .insert({
      title: `${source.title} - копия`,
      subtitle: source.subtitle,
      excerpt: source.excerpt,
      content_json: source.content_json,
      content_html: source.content_html,
      cover_media_id: source.cover_media_id,
      cover_external_url: source.cover_external_url,
      cover_alt: source.cover_alt,
      category_id: source.category_id,
      author_id: userId,
      status: "draft",
      slug: copySlug,
      featured: false,
      show_on_homepage: false,
      pinned: false,
      related_article_id: source.id,
      sources: source.sources || [],
      bibliography: source.bibliography || [],
      seo_title: source.seo_title,
      seo_description: source.seo_description,
      seo_keywords: source.seo_keywords || [],
      og_title: source.og_title,
      og_description: source.og_description,
      allow_indexing: false,
      created_by: userId,
      updated_by: userId,
    })
    .select("id")
    .single();
  if (error || !copy) {
    redirect(`/articles?error=${encodeURIComponent(error?.message || "Не удалось создать копию")}`);
  }

  if (sourceEnglishTranslation) {
    const englishCopySlugBase = createSlug(
      `${sourceEnglishTranslation.slug || sourceEnglishTranslation.title}-copy`
    ).slice(0, 170);
    const { data: existingEnglishCopies, error: englishSlugsError } =
      await supabase
        .from("article_translations")
        .select("slug")
        .eq("locale", "en")
        .like("slug", `${englishCopySlugBase}%`);

    let englishCopyError = englishSlugsError;
    if (!englishCopyError) {
      const usedEnglishCopySlugs = new Set(
        (existingEnglishCopies || []).map((translation) =>
          String(translation.slug || "")
        )
      );
      let englishCopySlug = englishCopySlugBase;
      let englishCopyNumber = 2;
      while (usedEnglishCopySlugs.has(englishCopySlug)) {
        englishCopySlug = `${englishCopySlugBase}-${englishCopyNumber}`;
        englishCopyNumber += 1;
      }

      const { error: insertEnglishCopyError } = await supabase
        .from("article_translations")
        .insert({
          article_id: copy.id,
          locale: "en",
          title: sourceEnglishTranslation.title,
          subtitle: sourceEnglishTranslation.subtitle,
          excerpt: sourceEnglishTranslation.excerpt,
          content_json: sourceEnglishTranslation.content_json,
          content_html: sourceEnglishTranslation.content_html,
          cover_alt: sourceEnglishTranslation.cover_alt,
          slug: englishCopySlug,
          sources: sourceEnglishTranslation.sources || [],
          bibliography: sourceEnglishTranslation.bibliography || [],
          seo_title: sourceEnglishTranslation.seo_title,
          seo_description: sourceEnglishTranslation.seo_description,
          seo_keywords: sourceEnglishTranslation.seo_keywords || [],
          canonical_url: null,
          og_title: sourceEnglishTranslation.og_title,
          og_description: sourceEnglishTranslation.og_description,
          status: "draft",
          source_content_hash: null,
          source_article_updated_at: null,
          reviewed_by: null,
          reviewed_at: null,
          approved_by: null,
          approved_at: null,
          published_at: null,
          created_by: userId,
          updated_by: userId,
          deleted_at: null,
        });
      englishCopyError = insertEnglishCopyError;
    }

    if (englishCopyError) {
      const { data: rolledBackCopy, error: rollbackError } = await supabase
        .from("articles")
        .delete()
        .eq("id", copy.id)
        .select("id")
        .maybeSingle();
      const rollbackFailure =
        rollbackError?.message ||
        (!rolledBackCopy ? "запись копии не была удалена" : null);
      const rollbackMessage = rollbackFailure
        ? `; удалить неполную копию также не удалось: ${rollbackFailure}`
        : "; неполная русская копия удалена";
      redirect(
        `/articles?error=${encodeURIComponent(
          `Английская версия не скопирована: ${englishCopyError.message}${rollbackMessage}`
        )}`
      );
    }
  }
  await supabase.from("admin_audit_log").insert({
    actor_id: userId,
    action: "article.duplicated",
    entity_type: "article",
    entity_id: copy.id,
    metadata: { sourceId: id },
  });
  revalidatePath("/articles");
  redirect(articleEditPath(copy.id, { saved: 1 }));
}

export async function changeArticleStatusAction(formData: FormData) {
  const id = articleIdFromForm(formData);
  const expectedUpdatedAt = articleExpectedUpdatedAtFromForm(formData);
  const statusValue = String(formData.get("status") || "");
  const allowedStatuses = new Set([
    "draft",
    "review",
    "scheduled",
    "published",
    "hidden",
    "archived",
  ]);
  if (!id || !expectedUpdatedAt || !allowedStatuses.has(statusValue)) {
    redirect("/articles?error=Некорректное изменение статуса");
  }
  if (statusValue === "published" || statusValue === "scheduled") {
    redirect(
      articleEditPath(id, {
        error:
          "Публикация и планирование выполняются только из редактора после полной проверки RU и EN.",
      })
    );
  }
  const { userId, supabase } = await auditArticleAction(
    "article.status.requested",
    id,
    { status: statusValue }
  );
  const { data: updated, error } = await supabase
    .from("articles")
    .update({
      status: statusValue,
      ...(statusValue === "published"
        ? { published_at: new Date().toISOString() }
        : {}),
      updated_by: userId,
    })
    .eq("id", id)
    .eq("updated_at", expectedUpdatedAt)
    .select("id")
    .maybeSingle();
  if (error) {
    redirect(`/articles?error=${encodeURIComponent(error.message)}`);
  }
  if (!updated) {
    redirect("/articles?error=Статья уже изменена в другой вкладке. Обновите список.");
  }
  await supabase.from("admin_audit_log").insert({
    actor_id: userId,
    action: `article.status.${statusValue}`,
    entity_type: "article",
    entity_id: id,
  });
  const publication = await requestPublicBuild({
    supabase,
    actorId: userId,
    entityType: "article",
    entityId: id,
    reason: `article.status.${statusValue}`,
  });
  revalidatePath("/articles");
  revalidatePath(articleEditPath(id));
  redirect(`/articles?saved=1&published=${publication.state}`);
}

export async function softDeleteArticleAction(formData: FormData) {
  const session = await requireStaff(["owner", "admin"]);
  if (!session?.user) redirect("/login");
  const id = articleIdFromForm(formData);
  const expectedUpdatedAt = articleExpectedUpdatedAtFromForm(formData);
  if (!id || !expectedUpdatedAt) redirect("/articles?error=Некорректный материал или версия");
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/articles?error=База данных не подключена");
  const { data: updated, error } = await supabase
    .from("articles")
    .update({
      status: "archived",
      deleted_at: new Date().toISOString(),
      updated_by: session.user.id,
    })
    .eq("id", id)
    .eq("updated_at", expectedUpdatedAt)
    .select("id")
    .maybeSingle();
  if (error) redirect(`/articles?error=${encodeURIComponent(error.message)}`);
  if (!updated) redirect("/articles?error=Статья уже изменена в другой вкладке. Обновите страницу.");
  await supabase.from("admin_audit_log").insert({
    actor_id: session.user.id,
    action: "article.soft_deleted",
    entity_type: "article",
    entity_id: id,
  });
  const publication = await requestPublicBuild({
    supabase,
    actorId: session.user.id,
    entityType: "article",
    entityId: id,
    reason: "article.soft_deleted",
  });
  revalidatePath("/articles");
  redirect(`/articles?deleted=1&published=${publication.state}`);
}

export async function restoreArticleRevisionAction(formData: FormData) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  const articleId = articleIdFromForm(formData);
  const expectedUpdatedAt = articleExpectedUpdatedAtFromForm(formData);
  const revisionId = z.coerce.number().int().positive().safeParse(
    formData.get("revision_id")
  );
  if (!articleId || !expectedUpdatedAt || !revisionId.success) {
    redirect("/articles?error=Некорректная версия");
  }
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/articles?error=База данных не подключена");
  const { data: revision, error: revisionError } = await supabase
    .from("article_revisions")
    .select("snapshot,revision_number")
    .eq("id", revisionId.data)
    .eq("article_id", articleId)
    .single();
  if (revisionError || !revision?.snapshot) {
    redirect(articleEditPath(articleId, {
      error: revisionError?.message || "Версия не найдена",
    }));
  }

  const snapshot = revision.snapshot as Record<string, unknown>;
  const restorableFields = [
    "title",
    "subtitle",
    "excerpt",
    "content_json",
    "content_html",
    "cover_media_id",
    "cover_external_url",
    "cover_alt",
    "category_id",
    "slug",
    "legacy_path",
    "featured",
    "show_on_homepage",
    "pinned",
    "related_article_id",
    "sources",
    "bibliography",
    "seo_title",
    "seo_description",
    "seo_keywords",
    "canonical_url",
    "og_title",
    "og_description",
    "og_media_id",
    "allow_indexing",
  ] as const;
  const payload = Object.fromEntries(
    restorableFields
      .filter((field) => field in snapshot)
      .map((field) => [field, snapshot[field]])
  );
  const { data: updated, error } = await supabase
    .from("articles")
    .update({
      ...payload,
      status: "draft",
      scheduled_at: null,
      published_at: null,
      updated_by: session.user.id,
    })
    .eq("id", articleId)
    .eq("updated_at", expectedUpdatedAt)
    .select("id")
    .maybeSingle();
  if (error) {
    redirect(articleEditPath(articleId, { error: error.message }));
  }
  if (!updated) {
    redirect(articleEditPath(articleId, {
      error: "Статья уже изменена в другой вкладке. Обновите страницу.",
    }));
  }
  await supabase.from("admin_audit_log").insert({
    actor_id: session.user.id,
    action: "article.revision.restored",
    entity_type: "article",
    entity_id: articleId,
    metadata: { revisionNumber: revision.revision_number },
  });
  const publication = await requestPublicBuild({
    supabase,
    actorId: session.user.id,
    entityType: "article",
    entityId: articleId,
    reason: "article.revision.restored",
  });
  revalidatePath(articleEditPath(articleId));
  redirect(articleEditPath(articleId, { saved: 1, publish: publication.state }));
}
