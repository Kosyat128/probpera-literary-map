import { z } from "zod";

import { compareArticleSaveRevisions } from "./article-save-result";
import { parsePageOperationIntent, type PageOperationIntent } from "./page-operation-intent";
import type { PageSaveResult } from "./page-save-result";

const uuid = z.string().uuid();
const stamp = z.string().max(80).datetime({ offset: true });
const status = z.enum(["draft", "published", "hidden"]);
const operationResultSchema = z.object({
  version: z.literal(1), operationId: uuid, entityType: z.literal("page"), requestedEntityId: uuid,
  intent: z.enum(["save", "publish"]), persistence: z.literal("page"), replayed: z.boolean(),
  receipt: z.object({ page_id: uuid, page_updated_at: stamp, page_status: status }).strict(),
}).strict();

export type PageOperationResult = z.infer<typeof operationResultSchema>;
export type PageOperationResultContext = { operationId: string; submittedIntent: PageOperationIntent };
export type SavedPageOperationResult = Extract<PageSaveResult, { outcome: "saved" }> & {
  operationId: string; receipt: { pageId: string; updatedAt: string; canonicalStatus: z.infer<typeof status> };
};

function sameIdentity(left: string, right: string) {
  return left.toLowerCase() === right.toLowerCase();
}

/** The committed status follows the command, rather than a later edited form. */
export function pageOperationStatus(intent: PageOperationIntent): z.infer<typeof status> | null {
  const parsed = status.safeParse(intent.intent === "publish" ? "published" : new Map(intent.fields).get("status") || "draft");
  return parsed.success ? parsed.data : null;
}

/** Only a strict actual receipt for this original operation can acknowledge A. */
export function parsePageOperationResult(value: unknown, context: PageOperationResultContext): PageOperationResult | null {
  if (!context || !uuid.safeParse(context.operationId).success) return null;
  const intent = parsePageOperationIntent(context.submittedIntent);
  const parsed = operationResultSchema.safeParse(value);
  if (!intent || !parsed.success) return null;
  const result = parsed.data;
  if (!sameIdentity(result.operationId, context.operationId) || !sameIdentity(result.requestedEntityId, intent.entityId)
    || !sameIdentity(result.receipt.page_id, intent.entityId) || result.intent !== intent.intent
    || result.receipt.page_status !== pageOperationStatus(intent)
    || compareArticleSaveRevisions(result.receipt.page_updated_at, intent.expectedUpdatedAt) !== 1) return null;
  return result;
}

/** Reconciliation confirms persistence; audit, publication and cache stay unknown. */
export function pageOperationSaveResult(value: unknown, context: PageOperationResultContext): SavedPageOperationResult | null {
  const result = parsePageOperationResult(value, context);
  if (!result) return null;
  return {
    operationId: result.operationId, outcome: "saved",
    receipt: { pageId: result.receipt.page_id, updatedAt: result.receipt.page_updated_at, canonicalStatus: result.receipt.page_status },
    auditState: "unknown", publicationState: "unknown", revalidationState: "unknown",
  };
}
