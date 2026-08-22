"use server";

import { revalidatePath } from "next/cache";
import sanitizeHtml from "sanitize-html";

import { articleEditPath } from "@/lib/admin-routes";
import { articlePublicPath } from "@/lib/article-route";
import {
  articleTranslationSourceHash,
  englishTranslationReleaseIssues,
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

import { saveArticleBundleRpc } from "./article-bundle-rpc";
import { saveArticleAction as legacySaveArticleAction } from "./actions-legacy";

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

function parsedContentJson(value: FormDataEntryValue | null) {
  try {
    return positionLeadingIllustrationJson(
      sanitizeArticleTextToneJson(JSON.parse(String(value || "{}")))
    );
  } catch {
    return { type: "doc", content: [] };
  }
}

function publishErrorPath(articleId: string | null, message: string) {
  return articleId
    ? articleEditPath(articleId, { error: message })
    : `/articles/new?error=${encodeURIComponent(message)}`;
}

export async function saveAutoTranslatedArticleAtomically(formData: FormData) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");

  const supabase = await createServerSupabaseClient();
  if (!supabase) return legacySaveArticleAction(formData);

  const actorId = session.user.id;
  const articleId = optionalText(formData.get("id"));
  const expectedUpdatedAt = optionalText(formData.get("expected_updated_at"));
  const englishExpectedUpdatedAt = optionalText(
    formData.get("english_expected_updated_at")
  );
  const title = String(formData.get("title") || "").trim();
  const subtitle = String(formData.get("subtitle") || "").trim();
  const excerpt = String(formData.get("excerpt") || "").trim();
  const slug =
    createSlug(String(formData.get("slug") || "").trim() || title) ||
    `material-${Date.now()}`;
  const categoryId = optionalText(formData.get("category_id"));
  const coverExternalUrl = optionalText(formData.get("cover_external_url"));
  const coverAlt = String(formData.get("cover_alt") || "").trim();
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
  const sources = lineItems(formData.get("sources"));
  const bibliography = lineItems(formData.get("bibliography"));
  const contentJson = parsedContentJson(formData.get("content_json"));
  const contentHtml = positionLeadingIllustrationHtml(
    sanitizeHtml(String(formData.get("content_html") || ""), allowedArticleHtml)
  );

  const englishTitle = String(formData.get("english_title") || "").trim();
  const englishSubtitle = String(
    formData.get("english_subtitle") || ""
  ).trim();
  const englishExcerpt = String(formData.get("english_excerpt") || "").trim();
  const englishSlug =
    createSlug(
      String(formData.get("english_slug") || "").trim() || englishTitle
    ) || `english-${slug}`;
  const englishContentJson = parsedContentJson(
    formData.get("english_content_json")
  );
  const englishContentHtml = positionLeadingIllustrationHtml(
    sanitizeHtml(
      String(formData.get("english_content_html") || ""),
      allowedArticleHtml
    )
  );
  const englishCoverAlt = String(
    formData.get("english_cover_alt") || ""
  ).trim();
  const englishSeoTitle =
    String(formData.get("english_seo_title") || "").trim() || englishTitle;
  const englishSeoDescription =
    String(formData.get("english_seo_description") || "").trim() ||
    englishExcerpt;
  const englishSeoKeywords = commaList(
    formData.get("english_seo_keywords")
  );
  const englishCanonicalUrl = optionalText(
    formData.get("english_canonical_url")
  );
  const englishOgTitle =
    String(formData.get("english_og_title") || "").trim() ||
    englishSeoTitle ||
    englishTitle;
  const englishOgDescription =
    String(formData.get("english_og_description") || "").trim() ||
    englishSeoDescription ||
    englishExcerpt;
  const englishSources = lineItems(formData.get("english_sources"));
  const englishBibliography = lineItems(formData.get("english_bibliography"));

  const plainText = sanitizeHtml(contentHtml, {
    allowedTags: [],
    allowedAttributes: {},
  })
    .replace(/\s+/gu, " ")
    .trim();
  const publicationIssues = [
    title.length < 3 && "укажите заголовок",
    !categoryId && "выберите рубрику",
    plainText.split(/\s+/u).filter(Boolean).length < 250 &&
      "добавьте не менее 250 слов",
    !/<h2(?:\s|>)/iu.test(contentHtml) && "добавьте смысловые подзаголовки H2",
    excerpt.length < 80 && "расширьте описание карточки до 80 знаков",
    (!coverExternalUrl || coverAlt.length < 10) &&
      "добавьте обложку и её описание",
    seoDescription.length < 80 && "расширьте SEO-описание до 80 знаков",
    sources.length === 0 && "укажите хотя бы один источник",
    /data-editorial-block=["']media["']/iu.test(contentHtml) &&
      "замените все места для изображений настоящими файлами",
    formData.get("publication_override") !== "1" &&
      formData.get("publication_ready") !== "yes" &&
      "завершите контроль перед публикацией",
    ...englishTranslationReleaseIssues({
      enabled: true,
      status: "published",
      title: englishTitle,
      subtitle: englishSubtitle,
      excerpt: englishExcerpt,
      contentHtml: englishContentHtml,
      slug: englishSlug,
      coverUrl: coverExternalUrl,
      coverAlt: englishCoverAlt,
      seoTitle: englishSeoTitle,
      seoDescription: englishSeoDescription,
      seoKeywords: englishSeoKeywords,
      ogTitle: englishOgTitle,
      ogDescription: englishOgDescription,
      sources: englishSources,
      bibliography: englishBibliography,
    }).map((issue) => `English: ${issue}`),
  ].filter((issue): issue is string => Boolean(issue));

  // Preserve the exact legacy save policy whenever editorial validation fails.
  // Atomic persistence is only used for a release that has already passed the
  // same publication gates.
  if (publicationIssues.length > 0) {
    return legacySaveArticleAction(formData);
  }

  let categorySlug: string | null = null;
  if (categoryId) {
    const { data: category } = await supabase
      .from("categories")
      .select("slug")
      .eq("id", categoryId)
      .maybeSingle();
    categorySlug = category?.slug || null;
  }

  let previousSlug: string | null = null;
  let previousCategorySlug: string | null = null;
  let previousPublishedAt: string | null = null;
  let existingEnglishUpdatedAt: string | null = null;

  if (articleId) {
    const [
      { data: previous, error: previousError },
      { data: existingEnglish, error: englishError },
    ] = await Promise.all([
      supabase
        .from("articles")
        .select("slug,published_at,updated_at,categories(slug)")
        .eq("id", articleId)
        .maybeSingle(),
      supabase
        .from("article_translations")
        .select("updated_at")
        .eq("article_id", articleId)
        .eq("locale", "en")
        .maybeSingle(),
    ]);

    if (previousError || !previous) {
      redirect(
        publishErrorPath(
          articleId,
          previousError?.message || "Статья не найдена"
        )
      );
    }
    if (!expectedUpdatedAt) {
      return legacySaveArticleAction(formData);
    }
    if (englishError) {
      redirect(publishErrorPath(articleId, englishError.message));
    }

    previousSlug = previous.slug || null;
    previousPublishedAt = previous.published_at || null;
    const previousCategory = Array.isArray(previous.categories)
      ? previous.categories[0]
      : previous.categories;
    previousCategorySlug = previousCategory?.slug || null;
    existingEnglishUpdatedAt = existingEnglish?.updated_at || null;

    // Keep the page-load optimistic token authoritative. If an English row
    // exists but the editor did not submit its token, let the legacy action
    // handle the compatibility case rather than weakening concurrency safety.
    if (existingEnglishUpdatedAt && !englishExpectedUpdatedAt) {
      return legacySaveArticleAction(formData);
    }
  }

  const now = new Date().toISOString();
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

  const articlePayload = {
    title,
    subtitle,
    excerpt,
    slug,
    content_html: contentHtml,
    content_json: contentJson,
    category_id: categoryId,
    status: "published",
    scheduled_at: null,
    published_at: previousPublishedAt || now,
    cover_external_url: coverExternalUrl,
    cover_alt: coverAlt,
    legacy_path: optionalText(formData.get("legacy_path")),
    seo_title: seoTitle,
    seo_description: seoDescription,
    seo_keywords: seoKeywords,
    canonical_url: `${adminEnv.publicSiteUrl}${articlePublicPath(
      slug,
      categorySlug
    )}`,
    og_title: ogTitle,
    og_description: ogDescription,
    allow_indexing: formData.get("allow_indexing") === "on",
    sources,
    bibliography,
    featured: formData.get("featured") === "on",
    show_on_homepage: formData.get("show_on_homepage") === "on",
    pinned: formData.get("pinned") === "on",
  };

  const englishPayload = {
    title: englishTitle,
    subtitle: englishSubtitle,
    excerpt: englishExcerpt,
    content_json: englishContentJson,
    content_html: englishContentHtml,
    cover_alt: englishCoverAlt,
    slug: englishSlug,
    sources: englishSources,
    bibliography: englishBibliography,
    seo_title: englishSeoTitle,
    seo_description: englishSeoDescription,
    seo_keywords: englishSeoKeywords,
    canonical_url: englishCanonicalUrl,
    og_title: englishOgTitle,
    og_description: englishOgDescription,
    status: "published",
    source_content_hash: sourceHash,
    reviewed_at: now,
    approved_at: now,
    published_at: now,
    deleted_at: null,
  };

  const redirectSourcePath =
    previousSlug &&
    (previousSlug !== slug || previousCategorySlug !== categorySlug)
      ? articlePublicPath(previousSlug, previousCategorySlug)
      : null;
  const redirectDestinationPath = redirectSourcePath
    ? articlePublicPath(slug, categorySlug)
    : null;

  try {
    const saved = await saveArticleBundleRpc(supabase, {
      articleId,
      expectedArticleUpdatedAt: articleId ? expectedUpdatedAt : null,
      articlePayload,
      englishMode: "save",
      englishPayload,
      expectedEnglishUpdatedAt: existingEnglishUpdatedAt
        ? englishExpectedUpdatedAt
        : null,
      redirectSourcePath,
      redirectDestinationPath,
      replaceHomepage:
        formData.get("show_on_homepage") === "on" && Boolean(categoryId),
      auditAction: articleId ? "article.updated" : "article.created",
      auditMetadata: {
        title,
        status: "published",
        requested_status: "published",
        publication_blocked: false,
        slug,
        english_status: "published",
        english_source_hash: sourceHash,
        persistence: "atomic-article-bundle",
      },
      socialPublishRequested: true,
      socialMetadata: {
        title,
        slug,
        platforms: ["dzen"],
        requested_at: now,
        persistence: "atomic-article-bundle",
      },
    });

    const publication = await requestPublicBuild({
      supabase,
      actorId,
      entityType: "article",
      entityId: saved.articleId,
      reason: "article.published",
      metadata: { persistence: "atomic-article-bundle" },
    });

    revalidatePath("/dashboard");
    revalidatePath("/articles");
    redirect(
      articleEditPath(saved.articleId, {
        saved: 1,
        publish: publication.state,
        replaced: saved.homepageReplaced || null,
      })
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Не удалось атомарно сохранить публикацию.";
    redirect(publishErrorPath(articleId, message));
  }
}
