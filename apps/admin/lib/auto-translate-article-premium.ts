import { load } from "cheerio";
import sanitizeHtml from "sanitize-html";
import { z } from "zod";

import { safeTextToneSpanAttributes } from "./article-content-presentation";
import { englishTranslationReleaseIssues } from "./article-translations";
import { sanitizeEditorAnchorAttributes } from "./editor-link";
import {
  protectedArticleHtmlSignature,
  type AutoTranslationSource,
} from "./auto-translate-article-core";
import type {
  OpenAiReasoningEffort,
  OpenAiReasoningMode,
} from "./env";
import { premiumTranslateToEnglish } from "./premium-english-translation";
import { createSlug } from "./slug";

const translatedArticleSchema = z.object({
  title: z.string().trim().min(3).max(240),
  subtitle: z.string().trim().max(360),
  excerpt: z.string().trim().min(80).max(700),
  content_html: z.string().min(20).max(2_000_000),
  cover_alt: z.string().trim().min(10).max(500),
  seo_title: z.string().trim().min(3).max(180),
  seo_description: z.string().trim().min(80).max(400),
  seo_keywords: z.array(z.string().trim().min(1).max(80)).max(30),
  og_title: z.string().trim().min(3).max(180),
  og_description: z.string().trim().min(20).max(400),
  sources: z.array(z.string().trim().min(1).max(1000)).max(100),
  bibliography: z.array(z.string().trim().min(1).max(1000)).max(100),
});

type TranslatedArticle = z.infer<typeof translatedArticleSchema>;

const translationJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "title",
    "subtitle",
    "excerpt",
    "content_html",
    "cover_alt",
    "seo_title",
    "seo_description",
    "seo_keywords",
    "og_title",
    "og_description",
    "sources",
    "bibliography",
  ],
  properties: {
    title: { type: "string" },
    subtitle: { type: "string" },
    excerpt: { type: "string" },
    content_html: { type: "string" },
    cover_alt: { type: "string" },
    seo_title: { type: "string" },
    seo_description: { type: "string" },
    seo_keywords: {
      type: "array",
      maxItems: 30,
      items: { type: "string" },
    },
    og_title: { type: "string" },
    og_description: { type: "string" },
    sources: {
      type: "array",
      maxItems: 100,
      items: { type: "string" },
    },
    bibliography: {
      type: "array",
      maxItems: 100,
      items: { type: "string" },
    },
  },
} as const;

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

const cyrillicPattern = /\p{Script=Cyrillic}/u;
const urlPattern = /https?:\/\/[^\s<>"')\]]+/giu;
const yearPattern = /\b(?:1[0-9]{3}|20[0-9]{2}|2100)\b/gu;
const doiPattern = /\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+\b/giu;
const isbnPattern =
  /\bISBN(?:-1[03])?:?\s*[0-9Xx][0-9Xx -]{8,23}[0-9Xx]\b/giu;

function sameStringArray(left: readonly string[], right: readonly string[]) {
  return (
    left.length === right.length &&
    left.every((item, index) => item === right[index])
  );
}

function serialized(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value) || "";
}

function normalizedUrl(value: string) {
  return value.replace(/[.,;:!?]+$/u, "");
}

function sortedUrls(value: unknown) {
  return [...serialized(value).matchAll(urlPattern)]
    .map((match) => normalizedUrl(match[0]))
    .sort((left, right) => left.localeCompare(right, "en"));
}

function protectedEditorialFacts(value: unknown) {
  const text = serialized(value);
  const years = [...text.matchAll(yearPattern)].map(
    (match) => `year:${match[0]}`
  );
  const dois = [...text.matchAll(doiPattern)].map(
    (match) => `doi:${match[0].replace(/[.,;:!?]+$/u, "").toLowerCase()}`
  );
  const isbns = [...text.matchAll(isbnPattern)].map(
    (match) => `isbn:${match[0].toUpperCase().replace(/[^0-9X]/gu, "")}`
  );
  return [...years, ...dois, ...isbns].sort((left, right) =>
    left.localeCompare(right, "en")
  );
}

function withoutUrls(value: string) {
  return value.replace(urlPattern, "");
}

function visibleEnglishPayload(value: TranslatedArticle) {
  const $ = load(value.content_html, { xmlMode: false }, false);
  return [
    value.title,
    value.subtitle,
    value.excerpt,
    $.root().text(),
    value.cover_alt,
    value.seo_title,
    value.seo_description,
    value.seo_keywords.join(" "),
    value.og_title,
    value.og_description,
    value.sources.map(withoutUrls).join("\n"),
    value.bibliography.map(withoutUrls).join("\n"),
  ].join("\n");
}

function validateArticleTranslation(value: unknown) {
  const parsed = translatedArticleSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(
      `OpenAI translation did not match the editorial schema: ${
        parsed.error.issues[0]?.message || "invalid result"
      }`
    );
  }
  return parsed.data;
}

export type PremiumArticleTranslationResult = TranslatedArticle & {
  model: string;
  reviewModel: string | null;
  translatorReasoningEffort: OpenAiReasoningEffort;
  translatorReasoningMode: OpenAiReasoningMode;
  reviewerReasoningEffort: OpenAiReasoningEffort | null;
  reviewerReasoningMode: OpenAiReasoningMode | null;
  requestId: string | null;
  reviewRequestId: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  reviewInputTokens: number | null;
  reviewOutputTokens: number | null;
};

export async function translateArticleSourceToEnglish(
  source: AutoTranslationSource,
  options: {
    apiKey?: string;
    model?: string;
    reviewerModel?: string;
    reasoningEffort?: OpenAiReasoningEffort;
    reasoningMode?: OpenAiReasoningMode;
    reviewerReasoningEffort?: OpenAiReasoningEffort;
    reviewerReasoningMode?: OpenAiReasoningMode;
    review?: boolean;
    fetchImpl?: typeof fetch;
  } = {}
): Promise<PremiumArticleTranslationResult> {
  const sourceHtml = sanitizeHtml(source.contentHtml, allowedArticleHtml);
  const sourceSignature = protectedArticleHtmlSignature(sourceHtml);

  const translated = await premiumTranslateToEnglish({
    source: { ...source, contentHtml: sourceHtml },
    schema: translationJsonSchema,
    schemaName: "probpera_article_translation",
    validate: validateArticleTranslation,
    maxOutputTokens: 60_000,
    apiKey: options.apiKey,
    model: options.model,
    reviewerModel: options.reviewerModel,
    reasoningEffort: options.reasoningEffort,
    reasoningMode: options.reasoningMode,
    reviewerReasoningEffort: options.reviewerReasoningEffort,
    reviewerReasoningMode: options.reviewerReasoningMode,
    review: options.review,
    fetchImpl: options.fetchImpl,
    domainInstructions: [
      "This material is a literary magazine article. Preserve every paragraph, heading, list item, quotation, caption and editorial qualification in the original order.",
      "For content_html preserve complete HTML element order and nesting.",
      "Preserve href, src, id, class, name, target, rel, width, height, loading, data-editorial-block, data-reveal, data-image-layout, data-media-id and data-text-tone values exactly.",
      "Translate visible text plus human-facing alt, title, figcaption and data-caption text. Do not create or remove links, images or structural elements.",
      "Translate source and bibliography strings without inventing bibliographic data. Preserve every URL, ISBN, DOI, year, volume/issue number, publisher identity and identifier exactly.",
      "SEO and Open Graph fields must sound native, remain faithful to the article and avoid clickbait.",
    ],
  });

  const translatedHtml = sanitizeHtml(
    translated.value.content_html,
    allowedArticleHtml
  );
  if (
    !sameStringArray(
      sourceSignature,
      protectedArticleHtmlSignature(translatedHtml)
    )
  ) {
    throw new Error(
      "OpenAI translation changed protected HTML structure or link/image attributes"
    );
  }

  const normalized: TranslatedArticle = {
    ...translated.value,
    content_html: translatedHtml,
  };

  const protectedUrlPairs: Array<{
    label: string;
    sourceValue: unknown;
    translatedValue: unknown;
  }> = [
    {
      label: "article body",
      sourceValue: sourceHtml,
      translatedValue: normalized.content_html,
    },
    {
      label: "sources",
      sourceValue: source.sources,
      translatedValue: normalized.sources,
    },
    {
      label: "bibliography",
      sourceValue: source.bibliography,
      translatedValue: normalized.bibliography,
    },
  ];
  for (const pair of protectedUrlPairs) {
    if (!sameStringArray(sortedUrls(pair.sourceValue), sortedUrls(pair.translatedValue))) {
      throw new Error(
        `OpenAI translation changed a protected ${pair.label} URL`
      );
    }
  }

  if (
    !sameStringArray(
      protectedEditorialFacts({ ...source, contentHtml: sourceHtml }),
      protectedEditorialFacts(normalized)
    )
  ) {
    throw new Error(
      "OpenAI translation changed a protected year, ISBN or DOI"
    );
  }

  if (cyrillicPattern.test(visibleEnglishPayload(normalized))) {
    throw new Error(
      "OpenAI translation left Cyrillic in reader-facing English fields"
    );
  }

  const releaseIssues = englishTranslationReleaseIssues({
    enabled: true,
    status: "published",
    title: normalized.title,
    subtitle: normalized.subtitle,
    excerpt: normalized.excerpt,
    contentHtml: normalized.content_html,
    slug: createSlug(normalized.title) || "english-article",
    coverUrl: "https://probpera.invalid/cover.webp",
    coverAlt: normalized.cover_alt,
    seoTitle: normalized.seo_title,
    seoDescription: normalized.seo_description,
    seoKeywords: normalized.seo_keywords,
    ogTitle: normalized.og_title,
    ogDescription: normalized.og_description,
    sources: normalized.sources.map((text) => ({ text })),
    bibliography: normalized.bibliography.map((text) => ({ text })),
  }).filter((issue) => !issue.includes("cover"));

  if (releaseIssues.length) {
    throw new Error(
      `English translation failed release checks: ${releaseIssues.join("; ")}`
    );
  }

  return {
    ...normalized,
    model: translated.translatorModel,
    reviewModel: translated.reviewerModel,
    translatorReasoningEffort: translated.translatorReasoningEffort,
    translatorReasoningMode: translated.translatorReasoningMode,
    reviewerReasoningEffort: translated.reviewerReasoningEffort,
    reviewerReasoningMode: translated.reviewerReasoningMode,
    requestId: translated.translatorRequestId,
    reviewRequestId: translated.reviewerRequestId,
    inputTokens: translated.inputTokens,
    outputTokens: translated.outputTokens,
    reviewInputTokens: translated.reviewInputTokens,
    reviewOutputTokens: translated.reviewOutputTokens,
  };
}
