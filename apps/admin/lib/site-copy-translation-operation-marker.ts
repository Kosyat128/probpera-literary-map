import { z } from "zod";
import type { SiteCopyTranslationOperationReceipt } from "./site-copy-translation-operation-rpc";

const markerSchema = z.object({
  version: z.literal(1), logicalScope: z.literal("site-copy-overrides"),
  operationId: z.string().uuid(), actorId: z.string().uuid(),
  intentHash: z.string().regex(/^[a-f0-9]{64}$/u),
}).strict();
export type SiteCopyTranslationOperationMarker = z.infer<typeof markerSchema>;

/** Only the actual single-operation job cursor can address retained work. */
export function siteCopyTranslationOperationMarker(cursor: unknown) {
  if (!cursor || typeof cursor !== "object" || Array.isArray(cursor) || !Object.hasOwn(cursor, "siteCopyOperation")) {
    return { kind: "none" as const };
  }
  const parsed = z.object({ siteCopyOperation: markerSchema }).strict().safeParse(cursor);
  return parsed.success ? { kind: "operation" as const, ...parsed.data.siteCopyOperation } : { kind: "invalid" as const };
}

export function siteCopyTranslationMarkerMatchesReceipt(
  marker: SiteCopyTranslationOperationMarker, receipt: SiteCopyTranslationOperationReceipt, jobId: string,
) {
  return receipt.jobId.toLowerCase() === jobId.toLowerCase() &&
    receipt.operationId.toLowerCase() === marker.operationId.toLowerCase() &&
    receipt.actorId.toLowerCase() === marker.actorId.toLowerCase() && receipt.intentHash === marker.intentHash;
}
