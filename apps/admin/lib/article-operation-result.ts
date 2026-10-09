import { z } from "zod";

import { articleEditPath } from "./admin-routes";
import {
  parseArticleOperationIntent,
  type ArticleOperationIntent,
} from "./article-operation-intent";
import {
  articleWorkingDraftReceiptSchema,
  parseArticleSaveResult,
  type ArticleSaveReceipt,
  type ArticleSaveResult,
} from "./article-save-result";

const uuid = z.string().uuid();
const stamp = z.string().max(80).datetime({ offset: true });
const bundleResult = z.object({
  article_id: uuid,
  article_updated_at: stamp,
  english_updated_at: stamp.nullable(),
  homepage_replaced: z.number().int().min(0).max(2_147_483_647),
}).strict();
const workingDraftResult = z.object({
  articleId: uuid,
  version: z.number().int().positive().safe(),
  updatedAt: stamp,
}).strict();
const metadata = {
  version: z.literal(1),
  operationId: uuid,
  entityType: z.literal("article"),
  requestedEntityId: uuid.nullable(),
  intent: z.enum(["save", "preview", "publish"]),
  replayed: z.boolean(),
  canonicalStatus: z.enum(["draft", "review", "scheduled", "published", "hidden", "archived"]),
  englishWrite: z.enum(["saved", "preserved", "status-only"]).optional(),
  workingDraft: articleWorkingDraftReceiptSchema.optional(),
};
const operationResultSchema = z.discriminatedUnion("persistence", [
  z.object({ ...metadata, persistence: z.literal("article-bundle"), result: bundleResult }).strict(),
  z.object({ ...metadata, persistence: z.literal("working-draft"), result: workingDraftResult }).strict(),
  z.object({ ...metadata, persistence: z.literal("working-draft-promotion"), result: bundleResult }).strict(),
]);

/** A DB acknowledgement bound to the trusted command, separate from delivery. */
export type ArticleOperationResult = z.infer<typeof operationResultSchema>;
export type ArticleOperationResultContext = {
  operationId: string;
  submittedIntent: ArticleOperationIntent;
};
type SavedArticleResult = Extract<ArticleSaveResult, { outcome: "saved" }>;

function sameIdentity(left: string | null, right: string | null) {
  return left === null || right === null ? left === right : left.toLowerCase() === right.toLowerCase();
}

function savedResult(operation: ArticleOperationResult, intent: ArticleOperationIntent): SavedArticleResult | null {
  if (operation.persistence === "working-draft-promotion" && intent.intent !== "publish") return null;
  let receipt: ArticleSaveReceipt;
  if (operation.persistence === "working-draft") {
    if (intent.entityId === null || intent.expectedUpdatedAt === null
      || !operation.workingDraft && operation.canonicalStatus !== "published") return null;
    receipt = {
      articleId: operation.result.articleId,
      articleUpdatedAt: intent.expectedUpdatedAt,
      englishUpdatedAt: intent.englishExpectedUpdatedAt,
      workingDraftVersion: operation.result.version,
      workingDraftUpdatedAt: operation.result.updatedAt,
      canonicalStatus: operation.canonicalStatus,
      ...(operation.workingDraft ? { workingDraft: operation.workingDraft } : {}),
    };
  } else {
    receipt = {
      articleId: operation.result.article_id,
      articleUpdatedAt: operation.result.article_updated_at,
      englishUpdatedAt: operation.result.english_updated_at,
      workingDraftVersion: operation.workingDraft?.version ?? 0,
      workingDraftUpdatedAt: operation.workingDraft?.updatedAt ?? null,
      canonicalStatus: operation.canonicalStatus,
      ...(operation.workingDraft ? { workingDraft: operation.workingDraft } : {}),
    };
  }
  const destination = intent.intent === "preview"
    ? `/articles/${receipt.articleId}/preview?locale=${intent.previewLocale}`
    : articleEditPath(receipt.articleId);
  const result = parseArticleSaveResult({
    operationId: operation.operationId,
    outcome: "saved",
    englishState: operation.englishWrite ?? "unknown",
    persistence: operation.persistence,
    receipt,
    publicationState: "unknown",
    revalidationState: "unknown",
    destination,
  }, {
    operationId: operation.operationId,
    articleId: intent.entityId,
    articleUpdatedAt: intent.expectedUpdatedAt,
    englishUpdatedAt: intent.englishExpectedUpdatedAt,
    workingDraftVersion: intent.workingDraftVersion,
  });
  return result?.outcome === "saved" ? result : null;
}

function validatedResult(value: unknown, context: ArticleOperationResultContext) {
  if (!context || !uuid.safeParse(context.operationId).success) return null;
  const intent = parseArticleOperationIntent(context.submittedIntent);
  const parsed = operationResultSchema.safeParse(value);
  if (!intent || !parsed.success) return null;
  const operation = parsed.data;
  if (!sameIdentity(operation.operationId, context.operationId)
    || !sameIdentity(operation.requestedEntityId, intent.entityId)
    || operation.intent !== intent.intent) return null;
  const acknowledgement = savedResult(operation, intent);
  return acknowledgement ? { operation, acknowledgement } : null;
}

/** Only the exact ledger envelope may acknowledge this submitted operation. */
export function parseArticleOperationResult(value: unknown, context: ArticleOperationResultContext): ArticleOperationResult | null {
  return validatedResult(value, context)?.operation ?? null;
}

/** Lookup proves the write; publication/cache completion stays unconfirmed. */
export function articleOperationSaveResult(value: unknown, context: ArticleOperationResultContext): SavedArticleResult | null {
  return validatedResult(value, context)?.acknowledgement ?? null;
}
