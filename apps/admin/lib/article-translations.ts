import { createHash } from "node:crypto";

export type ArticleTranslationStatus =
  | "draft"
  | "review"
  | "approved"
  | "published"
  | "stale"
  | "archived";

export type ArticleTranslationSource = {
  title: string;
  subtitle: string;
  excerpt: string;
  contentJson: unknown;
  contentHtml: string;
  coverAlt: string;
  slug: string;
  sources: readonly unknown[];
  bibliography: readonly unknown[];
  seoTitle: string;
  seoDescription: string;
  seoKeywords: readonly string[];
  ogTitle: string;
  ogDescription: string;
};

export const articleCompensationFields = [
  "title",
  "subtitle",
  "excerpt",
  "slug",
  "content_html",
  "content_json",
  "category_id",
  "status",
  "scheduled_at",
  "published_at",
  "cover_external_url",
  "cover_alt",
  "legacy_path",
  "seo_title",
  "seo_description",
  "seo_keywords",
  "canonical_url",
  "og_title",
  "og_description",
  "allow_indexing",
  "sources",
  "bibliography",
  "featured",
  "show_on_homepage",
  "pinned",
  "updated_by",
] as const;

export const englishTranslationCompensationFields = [
  "title",
  "subtitle",
  "excerpt",
  "content_json",
  "content_html",
  "cover_alt",
  "slug",
  "sources",
  "bibliography",
  "seo_title",
  "seo_description",
  "seo_keywords",
  "canonical_url",
  "og_title",
  "og_description",
  "status",
  "source_content_hash",
  "source_article_updated_at",
  "reviewed_by",
  "reviewed_at",
  "approved_by",
  "approved_at",
  "published_at",
  "created_by",
  "updated_by",
  "deleted_at",
] as const;

function pickCompensationFields<const Fields extends readonly string[]>(
  source: Record<string, unknown>,
  fields: Fields
): { [Key in Fields[number]]: unknown } {
  return Object.fromEntries(fields.map((field) => [field, source[field]])) as {
    [Key in Fields[number]]: unknown;
  };
}

export function articleCompensationPayload(
  source: Record<string, unknown>
) {
  return pickCompensationFields(source, articleCompensationFields);
}

export function englishTranslationCompensationPayload(
  source: Record<string, unknown>
) {
  return pickCompensationFields(source, englishTranslationCompensationFields);
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(
      ([left], [right]) => left.localeCompare(right, "en")
    );
    return `{${entries
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export function articleTranslationSourceHash(
  source: ArticleTranslationSource
): string {
  return createHash("sha256").update(stableJson(source)).digest("hex");
}

export function isReleasedTranslationStatus(
  status: ArticleTranslationStatus
) {
  return status === "approved" || status === "published";
}

export function canReuseEnglishTranslationApproval(input: {
  persistedSourceHash: string | null | undefined;
  currentSourceHash: string;
  persistedContentHash: string | null | undefined;
  currentContentHash: string | null | undefined;
}) {
  return Boolean(
    input.persistedSourceHash &&
      input.persistedSourceHash === input.currentSourceHash &&
      input.persistedContentHash &&
      input.persistedContentHash === input.currentContentHash
  );
}

export function englishTranslationReleaseIssues(input: {
  enabled: boolean;
  status: ArticleTranslationStatus;
  title: string;
  subtitle: string;
  excerpt: string;
  contentHtml: string;
  slug: string;
  coverUrl: string | null;
  coverAlt: string;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: readonly string[];
  ogTitle: string;
  ogDescription: string;
  sources: readonly unknown[];
  bibliography: readonly unknown[];
}) {
  if (!input.enabled) return [];

  const plainText = input.contentHtml
    .replace(/<[^>]+>/gu, " ")
    .replace(/&nbsp;/giu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  const wordCount = plainText
    ? plainText.split(/\s+/u).filter(Boolean).length
    : 0;
  const englishEditorialText = [
    input.title,
    input.subtitle,
    input.excerpt,
    input.contentHtml,
    input.coverAlt,
    input.seoTitle,
    input.seoDescription,
    input.seoKeywords.join(" "),
    input.ogTitle,
    input.ogDescription,
    stableJson(input.sources),
    stableJson(input.bibliography),
  ].join(" ");

  return [
    !isReleasedTranslationStatus(input.status) &&
      "approve or publish the English translation",
    input.title.trim().length < 3 && "add the English title",
    input.slug.trim().length < 2 && "add the English slug",
    wordCount < 250 && "add at least 250 English words",
    !/<h2(?:\s|>)/iu.test(input.contentHtml) && "add English H2 headings",
    input.excerpt.trim().length < 80 &&
      "expand the English card description to 80 characters",
    (!input.coverUrl || input.coverAlt.trim().length < 10) &&
      "add the English cover description",
    input.seoDescription.trim().length < 80 &&
      "expand the English SEO description to 80 characters",
    input.sources.length === 0 && "add at least one English source entry",
    /\p{Script=Cyrillic}/u.test(englishEditorialText) &&
      "remove Cyrillic text from the English translation",
    /data-editorial-block=["']media["']/iu.test(input.contentHtml) &&
      "replace English image placeholders",
  ].filter((issue): issue is string => Boolean(issue));
}

export function publicationFailureSavePolicy(input: {
  hasIssues: boolean;
  previousStatus: string | null | undefined;
  requestedStatus: string;
}) {
  if (input.hasIssues && input.previousStatus === "published") {
    return {
      kind: "preserve-published" as const,
      savedStatus: null,
    };
  }

  return {
    kind: "save" as const,
    savedStatus: input.hasIssues ? "draft" : input.requestedStatus,
  };
}
