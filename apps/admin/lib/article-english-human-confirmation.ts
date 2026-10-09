import { z } from "zod";

import type { ArticleRecoverySnapshot } from "./article-recovery-snapshot";
import { sameArticleRetryRevision } from "./article-retry-revision";

export type ArticleEnglishHumanConfirmationInput = {
  article: object;
  englishTranslation: object | null | undefined;
  canonicalEnglishTranslation: object | null | undefined;
  current: ArticleRecoverySnapshot;
};
export type ArticleEnglishHumanConfirmation = { key: string | null; confirmed: boolean };
type Row = Record<string, unknown>;
type LocalDigest = Pick<SubtleCrypto, "digest">;
const uuid = z.string().uuid(), stamp = z.string().max(80).datetime({ offset: true });
const editorialFields = ["title", "subtitle", "excerpt", "slug", "content_html", "content_json", "cover_alt",
  "seo_title", "seo_description", "seo_keywords", "canonical_url", "og_title", "og_description", "sources", "bibliography"] as const;

function record(value: unknown): Row | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Row : null;
}
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b, "en"))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
function listValue(value: unknown) {
  return Array.isArray(value) ? value.map(item => typeof item === "string" ? item
    : record(item) && "text" in item ? String(item.text || "") : "").filter(Boolean).join("\n") : "";
}
function rowDisplay(row: Row) {
  return { title: row.title || "", subtitle: row.subtitle || "", excerpt: row.excerpt || "", slug: row.slug || "",
    contentHtml: row.content_html || "", contentJson: row.content_json || { type: "doc", content: [] }, coverAlt: row.cover_alt || "",
    seoTitle: row.seo_title || "", seoDescription: row.seo_description || "", seoKeywords: listValue(row.seo_keywords).split("\n").join(", "),
    canonicalUrl: row.canonical_url || "", ogTitle: row.og_title || "", ogDescription: row.og_description || "",
    sourceText: listValue(row.sources), bibliographyText: listValue(row.bibliography) };
}
function currentDisplay(value: ArticleRecoverySnapshot | ArticleRecoverySnapshot["english"]) {
  return { title: value.title, subtitle: value.subtitle, excerpt: value.excerpt, slug: value.slug,
    contentHtml: value.contentHtml, contentJson: JSON.parse(value.contentJson) as unknown, coverAlt: value.coverAlt,
    seoTitle: value.seoTitle, seoDescription: value.seoDescription, seoKeywords: value.seoKeywords,
    canonicalUrl: value.canonicalUrl, ogTitle: value.ogTitle, ogDescription: value.ogDescription,
    sourceText: value.sourceText, bibliographyText: value.bibliographyText };
}
function sameId(a: unknown, b: unknown) {
  return uuid.safeParse(a).success && uuid.safeParse(b).success && String(a).toLowerCase() === String(b).toLowerCase();
}
function sameStamp(a: unknown, b: unknown) {
  return stamp.safeParse(a).success && stamp.safeParse(b).success && sameArticleRetryRevision(String(a), String(b));
}

/** This key binds asynchronous UI evidence to the displayed text, never a DB write. */
export function articleEnglishHumanConfirmationKey(input: ArticleEnglishHumanConfirmationInput): string | null {
  try {
    const article = record(input.article), english = record(input.englishTranslation), canonical = record(input.canonicalEnglishTranslation);
    if (!article) return null;
    return stableJson({ articleId: article.id, articleUpdatedAt: article.updated_at, englishId: english?.id,
      canonicalEnglishId: canonical?.id, englishUpdatedAt: english?.updated_at,
      russian: currentDisplay(input.current), english: currentDisplay(input.current.english),
      englishEnabled: input.current.english.enabled, russianSourceChanged: input.current.russianSourceChanged });
  } catch { return null; }
}
export function matchesArticleEnglishHumanConfirmation(proof: ArticleEnglishHumanConfirmation, key: string | null): boolean {
  return key !== null && proof.confirmed && proof.key === key;
}

/** Same SHA-256 projection as the ordinary server helper, including raw source metadata. */
export async function articleEnglishHumanConfirmationSourceHash(article: object, subtle: LocalDigest | null | undefined = globalThis.crypto?.subtle): Promise<string | null> {
  try {
    const row = record(article);
    if (!row || !subtle) return null;
    const source = { title: row.title, subtitle: row.subtitle || "", excerpt: row.excerpt || "",
      contentJson: row.content_json || { type: "doc", content: [] }, contentHtml: row.content_html || "", coverAlt: row.cover_alt || "", slug: row.slug,
      sources: row.sources || [], bibliography: row.bibliography || [], seoTitle: row.seo_title || row.title,
      seoDescription: row.seo_description || row.excerpt || "", seoKeywords: row.seo_keywords || [],
      ogTitle: row.og_title || row.seo_title || row.title, ogDescription: row.og_description || row.seo_description || row.excerpt || "" };
    const digest = await subtle.digest("SHA-256", new TextEncoder().encode(stableJson(source)));
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  } catch { return null; }
}

/** Reuse only a loaded human approval of this exact EN against this exact RU. */
export async function isPreviouslyHumanConfirmedArticleEnglish(input: ArticleEnglishHumanConfirmationInput,
  subtle: LocalDigest | null | undefined = globalThis.crypto?.subtle): Promise<boolean> {
  try {
    const article = record(input.article), english = record(input.englishTranslation), canonical = record(input.canonicalEnglishTranslation);
    if (!article || !english || !canonical || !input.current.english.enabled || input.current.russianSourceChanged
      || !sameId(article.id, canonical.article_id) || !sameId(article.id, english.article_id) || !sameId(english.id, canonical.id)
      || english.locale !== "en" || canonical.locale !== "en" || english.deleted_at != null || canonical.deleted_at != null
      || !["approved", "published"].includes(String(canonical.status)) || !["approved", "published"].includes(String(english.status))
      || !sameStamp(english.updated_at, canonical.updated_at) || !sameStamp(canonical.source_article_updated_at, article.updated_at)
      || !sameStamp(english.source_article_updated_at, canonical.source_article_updated_at)
      || !/^[a-f0-9]{64}$/u.test(String(canonical.source_content_hash)) || english.source_content_hash !== canonical.source_content_hash
      || !sameId(english.reviewed_by, canonical.reviewed_by) || !sameId(english.approved_by, canonical.approved_by)
      || !sameStamp(english.reviewed_at, canonical.reviewed_at) || !sameStamp(english.approved_at, canonical.approved_at)) return false;
    // Explicit human release strips this provenance. Old automatic dates cannot stand in for that action.
    for (const row of [english, canonical]) {
      const document = record(row.content_json);
      if (!document || Object.hasOwn(document, "__probperaPremiumTranslation")) return false;
    }
    const editorial = (row: Row) => Object.fromEntries(editorialFields.map(field => [field, row[field]]));
    if (stableJson(editorial(english)) !== stableJson(editorial(canonical))
      || stableJson(currentDisplay(input.current)) !== stableJson(rowDisplay(article))
      || stableJson(currentDisplay(input.current.english)) !== stableJson(rowDisplay(english))) return false;
    return await articleEnglishHumanConfirmationSourceHash(article, subtle) === canonical.source_content_hash;
  } catch { return false; }
}
