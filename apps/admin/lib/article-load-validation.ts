import { isReadRecord } from "./admin-read-result";

const articleStatuses = ["draft", "review", "scheduled", "published", "hidden", "archived"];
const translationStatuses = ["draft", "review", "approved", "published", "stale", "archived"];
const nullableText = (value: unknown) => value === null || typeof value === "string";
const rowId = (value: unknown) => typeof value === "string" ||
  (typeof value === "number" && Number.isSafeInteger(value));

/** PostgreSQL UUID identity is case-insensitive; preserve the original data. */
export function sameArticleId(value: unknown, expected: string): boolean {
  return typeof value === "string" && value.toLowerCase() === expected.toLowerCase();
}

function textList(value: unknown): boolean {
  return Array.isArray(value) && value.every((item) =>
    typeof item === "string" || (isReadRecord(item) && typeof item.text === "string"));
}

/** Validate presence and types only. Never normalize or replace editorial values. */
function editorialFields(row: Record<string, unknown>): boolean {
  return ["title", "subtitle", "excerpt", "slug", "content_html", "cover_alt"]
    .every((field) => typeof row[field] === "string") &&
    ["seo_title", "seo_description", "og_title", "og_description"]
      .every((field) => nullableText(row[field])) &&
    isReadRecord(row.content_json) && textList(row.sources) && textList(row.bibliography) &&
    Array.isArray(row.seo_keywords) && row.seo_keywords.every((item) => typeof item === "string");
}

export function validArticleRead(value: unknown, id: string, mode: "edit" | "copy"): boolean {
  if (!isReadRecord(value) || !sameArticleId(value.id, id) || !editorialFields(value)) return false;
  if (!["category_id", "cover_external_url", "cover_media_id", "legacy_path"]
    .every((field) => nullableText(value[field]))) return false;
  if (typeof value.status !== "string" || !articleStatuses.includes(value.status)) return false;
  if (!["allow_indexing", "featured", "show_on_homepage", "pinned"]
    .every((field) => typeof value[field] === "boolean")) return false;
  return mode === "copy" || (typeof value.updated_at === "string" &&
    nullableText(value.scheduled_at) && nullableText(value.canonical_url));
}

export function validEnglishRead(value: unknown, articleId: string, mode: "edit" | "copy"): boolean {
  if (!isReadRecord(value) || !editorialFields(value)) return false;
  if (mode === "copy") {
    return sameArticleId(value.article_id, articleId) && value.locale === "en";
  }
  return typeof value.id === "string" && sameArticleId(value.article_id, articleId) && value.locale === "en" &&
    typeof value.updated_at === "string" && typeof value.status === "string" &&
    translationStatuses.includes(value.status) &&
    ["canonical_url", "source_content_hash", "source_article_updated_at", "approved_at", "published_at"]
      .every((field) => nullableText(value[field]));
}

export function validRevisionRead(row: Record<string, unknown>): boolean {
  return rowId(row.id) && typeof row.revision_number === "number" &&
    Number.isSafeInteger(row.revision_number) && row.revision_number > 0 && typeof row.created_at === "string" &&
    typeof row.change_summary === "string" && nullableText(row.changed_by);
}

export function validTemplateRead(row: Record<string, unknown>): boolean {
  return typeof row.id === "string" && typeof row.label === "string" &&
    typeof row.content_html === "string" && typeof row.visibility === "string" &&
    ["personal", "shared"].includes(row.visibility) &&
    nullableText(row.owner_id);
}

export function validCopyOptionRead(row: Record<string, unknown>): boolean {
  return typeof row.id === "string" && typeof row.title === "string" &&
    typeof row.status === "string" && articleStatuses.includes(row.status) &&
    typeof row.updated_at === "string";
}

export function validArticleListRead(row: Record<string, unknown>): boolean {
  const validCategory = (value: unknown) => isReadRecord(value) &&
    ["id", "name", "slug"].every((field) => typeof value[field] === "string");
  const categories = row.categories;
  return ["id", "title", "slug", "created_at", "updated_at"].every((field) => typeof row[field] === "string") &&
    typeof row.status === "string" && articleStatuses.includes(row.status) &&
    ["author_id", "cover_external_url", "published_at", "legacy_path"].every((field) => nullableText(row[field])) &&
    (categories === null || validCategory(categories) ||
      (Array.isArray(categories) && categories.every(validCategory)));
}

export function validSocialRequestRead(row: Record<string, unknown>, articleId: string): boolean {
  return rowId(row.id) && typeof row.created_at === "string" &&
    isReadRecord(row.metadata) && sameArticleId(row.metadata.article_id, articleId);
}

export function validSocialResultRead(row: Record<string, unknown>): boolean {
  if (row.action === "social_publish.completed") {
    return typeof row.created_at === "string" && isReadRecord(row.metadata) &&
      typeof row.metadata.article_id === "string" && isReadRecord(row.metadata.platforms) &&
      Object.values(row.metadata.platforms).every((state) => typeof state === "string");
  }
  return typeof row.action === "string" &&
    ["social_publish.succeeded", "social_publish.pending", "social_publish.failed"]
      .includes(row.action) && typeof row.created_at === "string" &&
    isReadRecord(row.metadata) && typeof row.metadata.platform === "string" &&
    (row.metadata.state === undefined || typeof row.metadata.state === "string");
}
