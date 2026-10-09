import type { Schema } from "@tiptap/pm/model";
import { z } from "zod";

import { captureArticleOperationIntent } from "./article-operation-intent";
import { prepareArticlePublicationIntent } from "./article-publication-intent";
import { articleDraftRecoveryKeyPrefix, safeArticleDraftScope } from "./article-recovery";
import { prepareArticleRecoverySnapshot, type ArticleRecoverySnapshot } from "./article-recovery-snapshot";
import type { ArticleSaveContext } from "./article-save-result";
import { EDITOR_AUTOSAVE_RETENTION_DAYS } from "./editor-autosave";

export const ARTICLE_PENDING_OPERATION_MAX_BYTES = 20 * 1024 * 1024;
export const ARTICLE_PENDING_OPERATION_RETENTION_MS = EDITOR_AUTOSAVE_RETENTION_DAYS * 24 * 60 * 60 * 1000;

const uuid = z.string().uuid();
const stamp = z.string().max(80).datetime({ offset: true }).nullable();
const scope = z.string().min(1).max(80).regex(/^[a-z0-9_-]+$/iu).nullable();
const originKey = z.string().min(1).max(240).regex(/^[a-z0-9_-]+$/iu);
const contextSchema = z.object({
  operationId: uuid,
  articleId: uuid.nullable(),
  articleUpdatedAt: stamp,
  englishUpdatedAt: stamp,
  workingDraftVersion: z.number().int().safe().nonnegative(),
}).strict();
const identityFields = {
  version: z.literal(1), actorId: uuid, originRecoveryKey: originKey, draftScope: scope,
  context: contextSchema, expiresAt: z.number().int().safe().positive(),
};
const referenceSchema = z.object({ ...identityFields, operationId: uuid }).strict();
const operationSchema = z.object({
  ...identityFields,
  formFields: z.array(z.tuple([
    z.string().max(100).regex(/^[a-z][a-z0-9_]*$/u), z.string().max(2_000_000),
  ])).max(128),
  snapshotA: z.unknown(), latestSnapshotB: z.unknown(),
}).strict();

export type ArticlePendingOperationContext = ArticleSaveContext & { operationId: string };
export type ArticlePendingOperationIdentity = {
  actorId: string;
  originRecoveryKey: string;
  draftScope: string | null;
};
export type ArticlePendingOperationReference = ArticlePendingOperationIdentity & {
  version: 1;
  operationId: string;
  context: ArticlePendingOperationContext;
  expiresAt: number;
};
/** A bounded tab journal, never a receipt or evidence that a write happened. */
export type ArticlePendingOperation = Omit<ArticlePendingOperationReference, "operationId"> & {
  formFields: Array<[string, string]>;
  snapshotA: ArticleRecoverySnapshot;
  latestSnapshotB: ArticleRecoverySnapshot;
};

const russianFields = {
  title: "title", subtitle: "subtitle", excerpt: "excerpt", slug: "slug", categoryId: "category_id",
  contentHtml: "content_html", contentJson: "content_json", status: "status", scheduledAt: "scheduled_at",
  coverUrl: "cover_external_url", coverAlt: "cover_alt", seoTitle: "seo_title",
  seoDescription: "seo_description", seoKeywords: "seo_keywords", canonicalUrl: "canonical_url",
  ogTitle: "og_title", ogDescription: "og_description", sourceText: "sources",
  bibliographyText: "bibliography", legacyPath: "legacy_path",
} as const;
const russianBooleans = { featured: "featured", showOnHomepage: "show_on_homepage", pinned: "pinned" } as const;
const englishFields = {
  title: "english_title", subtitle: "english_subtitle", excerpt: "english_excerpt", slug: "english_slug",
  contentHtml: "english_content_html", contentJson: "english_content_json", coverAlt: "english_cover_alt",
  seoTitle: "english_seo_title", seoDescription: "english_seo_description", seoKeywords: "english_seo_keywords",
  canonicalUrl: "english_canonical_url", ogTitle: "english_og_title", ogDescription: "english_og_description",
  sourceText: "english_sources", bibliographyText: "english_bibliography", status: "english_status",
} as const;
const englishBooleans = { enabled: "english_enabled", confirmedCurrentSource: "english_confirm_current_source" } as const;
const snapshotKeys = new Set([
  "version", "activeLocale", ...Object.keys(russianFields), ...Object.keys(russianBooleans),
  "slugEdited", "canonicalEdited", "allowIndexing", "russianSourceChanged", "english", "savedAt", "reason",
]);
const englishKeys = new Set([...Object.keys(englishFields), ...Object.keys(englishBooleans), "slugEdited", "canonicalEdited"]);

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validOrigin(originRecoveryKey: string, draftScope: string | null) {
  if (draftScope === null) return originRecoveryKey.startsWith("probpera-editor-")
    && uuid.safeParse(originRecoveryKey.slice("probpera-editor-".length)).success;
  if (safeArticleDraftScope(draftScope) !== draftScope) return false;
  const prefix = articleDraftRecoveryKeyPrefix(draftScope);
  return originRecoveryKey.startsWith(prefix) && /^[a-z0-9_-]{1,160}$/iu.test(originRecoveryKey.slice(prefix.length));
}

function validExpiry(expiresAt: number) {
  const now = Date.now();
  return expiresAt > now && expiresAt <= now + ARTICLE_PENDING_OPERATION_RETENTION_MS;
}

function validContext(context: ArticlePendingOperationContext) {
  return context.articleId === null
    ? context.articleUpdatedAt === null && context.workingDraftVersion === 0
    : context.articleUpdatedAt !== null;
}

function fullSnapshot(value: unknown, current: ArticleRecoverySnapshot, schema: Schema) {
  if (!record(value) || value.version !== 2 || !record(value.english)
    || Object.keys(value).some(key => !snapshotKeys.has(key))
    || Object.keys(value.english).some(key => !englishKeys.has(key))) return null;
  return prepareArticleRecoverySnapshot(value, current, schema)?.snapshot ?? null;
}

function authorFieldsMatch(fields: Map<string, string>, snapshot: ArticleRecoverySnapshot) {
  return Object.entries(russianFields).every(([key, name]) => fields.get(name) === snapshot[key as keyof typeof russianFields])
    && Object.entries(englishFields).every(([key, name]) => fields.get(name) === snapshot.english[key as keyof typeof englishFields])
    && Object.entries(russianBooleans).every(([key, name]) => fields.get(name) === (snapshot[key as keyof typeof russianBooleans] ? "on" : ""))
    && Object.entries(englishBooleans).every(([key, name]) => fields.get(name) === (snapshot.english[key as keyof typeof englishBooleans] ? "on" : ""))
    && (snapshot.allowIndexing ? fields.get("allow_indexing") === "on" : !fields.has("allow_indexing") || fields.get("allow_indexing") === "")
    && fields.get("preview_locale") === snapshot.activeLocale;
}

function formFromFields(fields: Array<[string, string]>) {
  const formData = new FormData();
  fields.forEach(([name, value]) => formData.append(name, value));
  return formData;
}

/** Real actor and existing article/draft entry only; no cross-user storage key. */
export function articlePendingOperationStorageKey(actorId: string, originRecoveryKey: string): string | null {
  if (!uuid.safeParse(actorId).success || !originKey.safeParse(originRecoveryKey).success
    || !(validOrigin(originRecoveryKey, null) || /^probpera-editor-draft-[a-z0-9_-]+$/iu.test(originRecoveryKey))) return null;
  return `probpera-editor-operation:${actorId.toLowerCase()}:${originRecoveryKey}`;
}

export function parseArticlePendingOperationReference(value: unknown): ArticlePendingOperationReference | null {
  const parsed = referenceSchema.safeParse(value);
  if (!parsed.success) return null;
  const result = parsed.data;
  if (!validOrigin(result.originRecoveryKey, result.draftScope) || !validExpiry(result.expiresAt)
    || !validContext(result.context) || result.operationId !== result.context.operationId
    || result.draftScope === null && result.originRecoveryKey !== `probpera-editor-${result.context.articleId}`) return null;
  return {
    version: 1, actorId: result.actorId, originRecoveryKey: result.originRecoveryKey,
    draftScope: result.draftScope, operationId: result.operationId,
    context: result.context, expiresAt: result.expiresAt,
  };
}

/** Validate both full copies and the original command before returning any state. */
export function parseArticlePendingOperation(
  value: unknown,
  identity: ArticlePendingOperationIdentity,
  currentSnapshot: ArticleRecoverySnapshot,
  schema: Schema
): ArticlePendingOperation | null {
  try {
    if (new TextEncoder().encode(JSON.stringify(value)).byteLength > ARTICLE_PENDING_OPERATION_MAX_BYTES) return null;
    const parsed = operationSchema.safeParse(value);
    if (!parsed.success) return null;
    const result = parsed.data;
    if (!uuid.safeParse(identity.actorId).success || result.actorId !== identity.actorId
      || result.originRecoveryKey !== identity.originRecoveryKey || result.draftScope !== identity.draftScope
      || !validOrigin(result.originRecoveryKey, result.draftScope) || !validExpiry(result.expiresAt)
      || !validContext(result.context)) return null;
    for (let index = 0; index < result.formFields.length; index += 1) {
      if (index > 0 && result.formFields[index - 1][0] >= result.formFields[index][0]) return null;
    }
    const fields = new Map(result.formFields);
    if (fields.get("article_operation_id") !== result.context.operationId || fields.get("article_result_mode") !== "receipt") return null;
    const formData = formFromFields(result.formFields);
    prepareArticlePublicationIntent(formData);
    const intent = captureArticleOperationIntent(formData);
    if (!intent || intent.entityId !== result.context.articleId
      || intent.expectedUpdatedAt !== result.context.articleUpdatedAt
      || intent.englishExpectedUpdatedAt !== result.context.englishUpdatedAt
      || intent.workingDraftVersion !== result.context.workingDraftVersion) return null;
    // A draft/new origin remains stable after an own acknowledged article ID is adopted.
    if (result.draftScope === null && result.originRecoveryKey !== `probpera-editor-${result.context.articleId}`) return null;
    const snapshotA = fullSnapshot(result.snapshotA, currentSnapshot, schema);
    const latestSnapshotB = fullSnapshot(result.latestSnapshotB, currentSnapshot, schema);
    if (!snapshotA || !latestSnapshotB || !authorFieldsMatch(fields, snapshotA)) return null;
    return JSON.parse(JSON.stringify({ ...result, snapshotA, latestSnapshotB })) as ArticlePendingOperation;
  } catch { return null; }
}

export function createArticlePendingOperation(
  formData: FormData,
  snapshotA: ArticleRecoverySnapshot,
  latestSnapshotB: ArticleRecoverySnapshot,
  options: ArticlePendingOperationIdentity & { expiresAt: number },
  schema: Schema
): ArticlePendingOperation | null {
  const formFields: Array<[string, string]> = [];
  for (const [name, value] of formData.entries()) {
    if (name.startsWith("$ACTION_")) continue;
    if (typeof value !== "string") return null;
    formFields.push([name, value]);
  }
  formFields.sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
  const adapted = formFromFields(formFields);
  prepareArticlePublicationIntent(adapted);
  const intent = captureArticleOperationIntent(adapted);
  if (!intent) return null;
  return parseArticlePendingOperation({
    version: 1, ...options,
    context: {
      operationId: formData.get("article_operation_id"), articleId: intent.entityId,
      articleUpdatedAt: intent.expectedUpdatedAt, englishUpdatedAt: intent.englishExpectedUpdatedAt,
      workingDraftVersion: intent.workingDraftVersion,
    },
    formFields, snapshotA, latestSnapshotB,
  }, options, snapshotA, schema);
}

/** Reconstruct only the frozen request; never regenerate it from later copy B. */
export function articlePendingOperationFormData(operation: ArticlePendingOperation): FormData {
  return formFromFields(operation.formFields);
}

export function articlePendingOperationReference(operation: ArticlePendingOperation): ArticlePendingOperationReference {
  return {
    version: 1, actorId: operation.actorId, originRecoveryKey: operation.originRecoveryKey,
    draftScope: operation.draftScope, operationId: operation.context.operationId,
    context: { ...operation.context }, expiresAt: operation.expiresAt,
  };
}

/** Later author input changes only B; original A, operation and CAS stay frozen. */
export function updateArticlePendingOperationSnapshot(
  operation: ArticlePendingOperation,
  latestSnapshotB: ArticleRecoverySnapshot,
  schema: Schema
): ArticlePendingOperation | null {
  return parseArticlePendingOperation({ ...operation, latestSnapshotB }, operation, operation.snapshotA, schema);
}
