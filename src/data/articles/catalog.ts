import {
  articleCatalog as legacyArticleCatalog,
  type ArticleCatalogEntry as LegacyArticleCatalogEntry,
} from "./catalog.generated";
import { cmsArticleCatalog } from "./cms.generated";
import { articlePublicPath } from "../../utils/articleRoutes";
import { normalizeArticleMetadataRecord } from "../../utils/articleMetadata";

export type ArticleTranslationStatus = "approved" | "published";

export type ArticleCatalogTranslation = {
  locale: "en";
  title: string;
  description: string;
  imageAlt?: string;
  sectionLabel: string;
  publishedLabel: string;
  publishedAt?: string | null;
  readingMinutes: number;
  wordCount: number;
  headingCount: number;
  slug?: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
  seoKeywords?: readonly string[];
  canonicalUrl?: string | null;
  ogTitle?: string | null;
  ogDescription?: string | null;
  translationStatus: ArticleTranslationStatus;
  sourceContentHash?: string | null;
  sourceArticleUpdatedAt?: string | null;
  approvedAt?: string | null;
  translationPublishedAt?: string | null;
};

export type ArticleCatalogEntry = LegacyArticleCatalogEntry & {
  source?: "legacy" | "cms";
  slug?: string;
  sourceSlug?: string;
  legacyId?: string | null;
  legacyPath?: string | null;
  documentPath?: string;
  imageAlt?: string;
  publishedAt?: string | null;
  featured?: boolean;
  pinned?: boolean;
  showOnHomepage?: boolean;
  seoTitle?: string | null;
  seoDescription?: string | null;
  seoKeywords?: readonly string[];
  canonicalUrl?: string | null;
  ogTitle?: string | null;
  ogDescription?: string | null;
  ogImageUrl?: string | null;
  allowIndexing?: boolean;
  translations?: Readonly<{
    en?: ArticleCatalogTranslation;
  }>;
};

function normalizedPath(value?: string | null) {
  if (!value) return "";
  try {
    return new URL(value, "https://probpera.ru").pathname.replace(/\/+$/, "") || "/";
  } catch {
    return value.split(/[?#]/u)[0].replace(/\/+$/, "") || "/";
  }
}

function publishedTime(article: ArticleCatalogEntry) {
  const timestamp = article.publishedAt
    ? Date.parse(article.publishedAt)
    : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function mergeArticleCatalog(
  legacyEntries: readonly ArticleCatalogEntry[],
  cmsEntries: readonly ArticleCatalogEntry[]
) {
  const normalizedCms = [...cmsEntries].sort(
    (first, second) =>
      Number(Boolean(second.pinned)) - Number(Boolean(first.pinned)) ||
      Number(Boolean(second.featured)) - Number(Boolean(first.featured)) ||
      publishedTime(second) - publishedTime(first)
  );

  const replacedLegacyIds = new Set(
    normalizedCms
      .map((article) => article.legacyId)
      .filter((value): value is string => Boolean(value))
  );
  const replacedLegacyPaths = new Set(
    normalizedCms
      .map((article) => normalizedPath(article.legacyPath))
      .filter(Boolean)
  );

  const retainedLegacy = legacyEntries.filter(
    (article) =>
      !replacedLegacyIds.has(article.id) &&
      !replacedLegacyPaths.has(
        normalizedPath(article.legacyPath || article.url)
      )
  );

  return [...normalizedCms, ...retainedLegacy];
}

function withCurrentPublicAddress(
  article: ArticleCatalogEntry,
  source: "legacy" | "cms"
): ArticleCatalogEntry {
  const normalizedTranslation = article.translations?.en
    ? normalizeArticleMetadataRecord(article.translations.en)
    : undefined;
  const normalizedArticle = normalizeArticleMetadataRecord({
    ...article,
    translations: normalizedTranslation
      ? { ...article.translations, en: normalizedTranslation }
      : article.translations,
  });
  const legacyPath =
    normalizedArticle.legacyPath ||
    (source === "legacy" ? normalizedPath(normalizedArticle.url) : null);
  const currentPath = articlePublicPath(
    normalizedArticle.id,
    normalizedArticle.title,
    normalizedArticle.sectionId,
    normalizedArticle.slug
  );
  const canonicalUrl = new URL(currentPath, "https://probpera.ru").href;

  return {
    ...normalizedArticle,
    source,
    legacyPath,
    url: canonicalUrl,
    canonicalUrl,
  };
}

const legacyEntries: ArticleCatalogEntry[] = legacyArticleCatalog.map((article) =>
  withCurrentPublicAddress(article, "legacy")
);

const cmsEntries = (cmsArticleCatalog as unknown as readonly ArticleCatalogEntry[]).map(
  (article) => withCurrentPublicAddress(article, "cms")
);

export const articleCatalog = mergeArticleCatalog(
  legacyEntries,
  cmsEntries
);
