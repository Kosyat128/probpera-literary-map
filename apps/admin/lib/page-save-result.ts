import { z } from "zod";

export type PageSaveAuditState = "recorded" | "unavailable" | "unknown";
export type PageSavePublicationState = "started" | "queued" | "queue-error" | "unknown";
export type PageSaveReceipt = { pageId: string; updatedAt: string; canonicalStatus?: "draft" | "published" | "hidden" };
export type PageSaveResult = { operationId?: string } & (
  | { outcome: "rejected"; reason: "validation" | "content" | "media" | "publication-media" }
  | { outcome: "dependency-unavailable" }
  | { outcome: "conflict" }
  | { outcome: "unknown-outcome" }
  | { outcome: "saved"; receipt: PageSaveReceipt; auditState: PageSaveAuditState;
      publicationState: PageSavePublicationState; revalidationState: "complete" | "scheduled" | "unknown" });

const receiptSchema = z.object({
  pageId: z.string().uuid(),
  updatedAt: z.string().datetime({ offset: true }),
  canonicalStatus: z.enum(["draft", "published", "hidden"]).optional(),
}).strict();
const operationId = z.string().uuid().optional();
const resultSchema = z.discriminatedUnion("outcome", [
  z.object({ operationId, outcome: z.literal("rejected"), reason: z.enum(["validation", "content", "media", "publication-media"]) }).strict(),
  z.object({ operationId, outcome: z.literal("dependency-unavailable") }).strict(),
  z.object({ operationId, outcome: z.literal("conflict") }).strict(),
  z.object({ operationId, outcome: z.literal("unknown-outcome") }).strict(),
  z.object({ operationId, outcome: z.literal("saved"), receipt: receiptSchema,
    auditState: z.enum(["recorded", "unavailable", "unknown"]),
    publicationState: z.enum(["started", "queued", "queue-error", "unknown"]),
    revalidationState: z.enum(["complete", "scheduled", "unknown"]),
  }).strict(),
]);

function revisionIdentity(value: string) {
  const parts = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?)(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})$/u.exec(value);
  if (!parts) return null;
  // Parse only whole seconds. Keep the fractional digits outside Date so that
  // different PostgreSQL microsecond revisions never collapse to milliseconds.
  const whole = Date.parse(parts[1] + parts[3]);
  return Number.isFinite(whole) ? `${whole}:${(parts[2] || "").replace(/0+$/u, "")}` : null;
}

/** Validate identity/version without changing the receipt's original strings. */
export function parsePageSaveReceipt(value: unknown, expectedPageId: string, previousUpdatedAt: string): PageSaveReceipt | null {
  const read = receiptSchema.safeParse(value);
  if (!read.success || !z.string().uuid().safeParse(expectedPageId).success
    || !z.string().datetime({ offset: true }).safeParse(previousUpdatedAt).success
    || read.data.pageId.toLowerCase() !== expectedPageId.toLowerCase()) return null;
  const previousRevision = revisionIdentity(previousUpdatedAt);
  const updatedRevision = revisionIdentity(read.data.updatedAt);
  if (previousRevision === null || updatedRevision === null || updatedRevision === previousRevision) return null;
  return read.data;
}

/** Only an action response may supply a receipt; URL flags never enter this parser. */
export function parsePageSaveResult(value: unknown, expectedPageId: string, previousUpdatedAt: string, expectedOperationId?: string): PageSaveResult | null {
  const read = resultSchema.safeParse(value);
  if (!read.success) return null;
  if (expectedOperationId !== undefined && (!z.string().uuid().safeParse(expectedOperationId).success
    || read.data.operationId?.toLowerCase() !== expectedOperationId.toLowerCase())) return null;
  if (read.data.outcome === "saved"
    && !parsePageSaveReceipt(read.data.receipt, expectedPageId, previousUpdatedAt)) return null;
  return read.data;
}
