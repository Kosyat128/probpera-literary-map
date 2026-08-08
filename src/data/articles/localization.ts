import type {
  ArticleCatalogEntry,
  ArticleCatalogTranslation,
} from "./catalog";
import { articlePublicPath } from "../../utils/articleRoutes";

export type ArticleContentHeading = {
  id: string;
  level: number;
  text: string;
};

export type ArticleContentSource =
  | string
  | { text?: string; title?: string; label?: string; url?: string };

export type ArticleDocumentTranslation = ArticleCatalogTranslation & {
  headings: ArticleContentHeading[];
  contentHtml: string;
  plainText: string;
  sources?: ArticleContentSource[];
  bibliography?: ArticleContentSource[];
};

export type LocalizableArticleDocument = Omit<
  ArticleCatalogEntry,
  "translations"
> & {
  headings: ArticleContentHeading[];
  contentHtml: string;
  plainText: string;
  sources?: ArticleContentSource[];
  bibliography?: ArticleContentSource[];
  translations?: Readonly<{
    en?: ArticleDocumentTranslation;
  }>;
};

function isReleasedEnglishTranslation(
  translation: ArticleCatalogTranslation | undefined
) {
  const catalogText = translation
    ? [
        translation.title,
        translation.description,
        translation.imageAlt,
        translation.sectionLabel,
        translation.publishedLabel,
        translation.seoTitle,
        translation.seoDescription,
        translation.ogTitle,
        translation.ogDescription,
      ]
        .filter(Boolean)
        .join(" ")
    : "";
  return (
    Boolean(translation?.title.trim()) &&
    !/\p{Script=Cyrillic}/u.test(catalogText) &&
    (translation?.translationStatus === "approved" ||
      translation?.translationStatus === "published")
  );
}

function serializedVisibleText(value: unknown) {
  try {
    return JSON.stringify(value) || "";
  } catch {
    return "";
  }
}

function englishArticleAddress(
  article: ArticleCatalogEntry,
  translation: ArticleCatalogTranslation
) {
  const slug = translation.slug?.trim() || undefined;
  const generatedUrl = new URL(
    articlePublicPath(
      article.id,
      translation.title,
      article.sectionId,
      slug
    ),
    article.url || "https://probpera.ru"
  ).href;
  const canonicalUrl = translation.canonicalUrl?.trim() || generatedUrl;

  return { slug, url: generatedUrl, canonicalUrl };
}

export function articleCatalogEntryForLanguage(
  article: ArticleCatalogEntry,
  language: "ru" | "en"
): ArticleCatalogEntry | null {
  if (language === "ru") return article;

  const translation = article.translations?.en;
  if (!isReleasedEnglishTranslation(translation) || !translation) return null;
  const address = englishArticleAddress(article, translation);

  return {
    ...article,
    ...address,
    title: translation.title,
    description: translation.description,
    imageAlt: translation.imageAlt || "",
    sectionLabel: translation.sectionLabel,
    publishedLabel: translation.publishedLabel,
    publishedAt: translation.publishedAt,
    readingMinutes: translation.readingMinutes,
    wordCount: translation.wordCount,
    headingCount: translation.headingCount,
    seoTitle: translation.seoTitle,
    seoDescription: translation.seoDescription,
    seoKeywords: translation.seoKeywords,
    canonicalUrl: address.canonicalUrl,
    ogTitle: translation.ogTitle,
    ogDescription: translation.ogDescription,
  };
}

export function articleDocumentForLanguage(
  article: LocalizableArticleDocument,
  language: "ru" | "en"
): LocalizableArticleDocument | null {
  if (language === "ru") return article;

  const translation = article.translations?.en;
  if (
    !isReleasedEnglishTranslation(translation) ||
    !translation ||
    !translation.contentHtml.trim() ||
    /\p{Script=Cyrillic}/u.test(
      [
        translation.contentHtml,
        translation.plainText,
        translation.headings.map((heading) => heading.text).join(" "),
        serializedVisibleText(translation.sources || []),
        serializedVisibleText(translation.bibliography || []),
      ].join(" ")
    )
  ) {
    return null;
  }
  const address = englishArticleAddress(article, translation);

  return {
    ...article,
    ...address,
    title: translation.title,
    description: translation.description,
    imageAlt: translation.imageAlt || "",
    sectionLabel: translation.sectionLabel,
    publishedLabel: translation.publishedLabel,
    publishedAt: translation.publishedAt,
    readingMinutes: translation.readingMinutes,
    wordCount: translation.wordCount,
    headingCount: translation.headingCount,
    seoTitle: translation.seoTitle,
    seoDescription: translation.seoDescription,
    seoKeywords: translation.seoKeywords,
    canonicalUrl: address.canonicalUrl,
    ogTitle: translation.ogTitle,
    ogDescription: translation.ogDescription,
    headings: translation.headings,
    contentHtml: translation.contentHtml,
    plainText: translation.plainText,
    sources: translation.sources || [],
    bibliography: translation.bibliography || [],
  };
}
