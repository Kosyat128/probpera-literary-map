import type { SupabaseClient } from "@supabase/supabase-js";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";

import type { TranslationProviderResponseMetadata } from "./premium-english-translation";
import type { PremiumTranslationDraftProvenance } from "./premium-translation-working-draft";
import { samePremiumTranslationJson, writerBiographyCandidateIdentity } from "./premium-translation-working-draft";
import { translationErrorCodes, type TranslationErrorCode } from "./translation-errors";

const uuid = z.string().uuid();
const hash = z.string().regex(/^[a-f0-9]{64}$/u);
const timestamp = z.string().datetime({ offset: true });
const object = z.record(z.string(), z.unknown());
const provider = z.enum(["cloudflare", "openai"]);
const effort = z.enum(["none", "low", "medium", "high", "xhigh", "max"]);
const mode = z.enum(["standard", "pro"]);
const model = z.string().min(1).max(200).refine(value => !/[\u0000-\u001f\u007f]/u.test(value));
const version = z.string().regex(/^[1-9][0-9]{0,18}$/u)
  .refine(value => BigInt(value) <= 9223372036854775807n);
const targetRevision = z.object({ id: uuid.nullable(), updatedAt: timestamp.nullable() }).strict()
  .refine(value => (value.id === null) === (value.updatedAt === null));
const sourceRevision = z.object({
  countryId: z.string().min(1), writerId: z.string().min(1), overrideId: uuid.nullable(),
  overrideUpdatedAt: timestamp.nullable(), catalogSourceHash: hash, replaceEnglishTombstone: z.boolean(),
}).strict().refine(value => (value.overrideId === null) === (value.overrideUpdatedAt === null));

export const writerTranslationConfigurationSchema = z.object({
  version: z.literal(1), provider, model, reviewerModel: model, twoPassReview: z.literal(true),
  translatorReasoningEffort: effort, translatorReasoningMode: mode,
  reviewerReasoningEffort: effort, reviewerReasoningMode: mode, promptFingerprint: hash,
  schemaName: z.literal("probpera_writer_biography_translation"), maxOutputTokens: z.literal(4_000),
}).strict();
export type WriterTranslationConfiguration = z.infer<typeof writerTranslationConfigurationSchema>;

const result = z.object({
  state: z.enum(["translated", "failed", "conflict", "stale", "skipped", "not-configured", "cancelled"]),
  errorCode: z.enum(translationErrorCodes).nullable(),
  persistence: z.enum(["none", "private-artifact", "working-draft"]),
  draftId: uuid.nullable(), draftVersion: z.number().int().positive().safe().nullable(),
  draftUpdatedAt: timestamp.nullable(), candidateHash: hash.nullable(),
  publication: z.literal("unchanged"), humanReview: z.enum(["pending", "unchanged"]),
}).strict().superRefine((value, context) => {
  const draft = value.persistence === "working-draft";
  if (draft !== (value.draftId !== null && value.draftVersion !== null && value.draftUpdatedAt !== null) ||
    (!draft && (value.draftId !== null || value.draftVersion !== null || value.draftUpdatedAt !== null)) ||
    ((value.persistence !== "none") !== (value.candidateHash !== null)) ||
    ((value.candidateHash !== null) !== (value.humanReview === "pending")) ||
    (value.state === "translated" && (!draft || value.errorCode !== null))) {
    context.addIssue({ code: "custom", message: "Inconsistent writer operation persistence" });
  }
});
const receiptSchema = z.object({
  version: z.literal(1), jobId: uuid, itemId: uuid, operationId: uuid,
  entityId: z.string().min(1).max(481), countryId: z.string(), writerId: z.string(), actorId: uuid,
  provider, sourceHash: hash, intentHash: hash, configurationHash: hash,
  configuration: writerTranslationConfigurationSchema, sourceRevision, targetRevision,
  jobVersion: version, phase: z.enum(["running", "blocked", "finished"]),
  canExecute: z.boolean(), canDispatch: z.boolean(), replayed: z.boolean(),
  providerCalls: z.number().int().min(0).max(4), pendingCallId: uuid.nullable(),
  blockReason: z.enum(["provider_outcome_unknown", "operation_owned_by_another_actor", "operation_stopped", "operation_in_progress"]).nullable(),
  resumeCursor: object, result: result.nullable(),
}).strict().superRefine((value, context) => {
  let identity: string | null = null;
  try { identity = writerBiographyCandidateIdentity(value.countryId, value.writerId); } catch { /* Invalid identity fails below. */ }
  if (identity !== value.entityId || value.configuration.provider !== value.provider ||
    value.sourceRevision.countryId !== value.countryId || value.sourceRevision.writerId !== value.writerId ||
    value.sourceRevision.overrideId !== value.targetRevision.id ||
    value.sourceRevision.overrideUpdatedAt !== value.targetRevision.updatedAt ||
    (value.phase === "finished") !== (value.result !== null) ||
    (value.phase === "blocked") !== (value.blockReason !== null) ||
    (value.phase === "finished" && (value.pendingCallId !== null || value.canExecute || value.canDispatch)) ||
    (value.canExecute && (value.phase !== "running" || value.providerCalls !== 0 || value.pendingCallId !== null || value.replayed || value.canDispatch)) ||
    (value.canDispatch && (value.phase !== "running" || value.providerCalls < 1 || value.pendingCallId === null || value.replayed)) ||
    (value.blockReason === "provider_outcome_unknown" && value.pendingCallId === null)) {
    context.addIssue({ code: "custom", message: "Inconsistent writer operation receipt" });
  }
});
export type WriterTranslationOperationReceipt = z.infer<typeof receiptSchema>;
export type WriterTranslationOperationIntent = {
  jobId: string; itemId: string; operationId: string; actorId: string; countryId: string; writerId: string;
  provider: "cloudflare" | "openai"; sourceHash: string; sourceSnapshot: Record<string, unknown>;
  sourceRevision: z.infer<typeof sourceRevision>; targetRevision: z.infer<typeof targetRevision>;
  expectedOverrideFields: Record<string, unknown> | null; configuration: WriterTranslationConfiguration;
  currentCursor: Record<string, unknown>; resumeCursor: Record<string, unknown>;
};
export type WriterTranslationOperationCandidate = {
  payload: { text: string }; provenance: PremiumTranslationDraftProvenance;
  translatorCallId: string; reviewerCallId: string;
};
export type WriterTranslationOperationOutcome = {
  status: "succeeded" | "dead_letter" | "conflict" | "stale" | "skipped" | "not-configured" | "cancelled";
  providerCalls: number; errorCode?: TranslationErrorCode | null; model?: string | null;
  requestId?: string | null; inputTokens?: number | null; outputTokens?: number | null; durationMs?: number | null;
};
const callMetadata = z.object({
  callId: uuid, provider, model, pass: z.enum(["translation", "repair", "review"]),
  dispatchRecordedAt: timestamp, responseReceivedAt: timestamp.nullable(),
  httpStatus: z.number().int().min(100).max(599).nullable(), requestId: z.string().min(1).max(200).nullable(),
  responseId: z.string().min(1).max(200).nullable(), inputTokens: z.number().int().min(0).max(10_000_000).nullable(),
  outputTokens: z.number().int().min(0).max(10_000_000).nullable(),
}).strict();
const artifactSchema = z.object({
  version: z.literal(1), receipt: receiptSchema, sourceSnapshot: object, sourceRevision, targetRevision,
  expectedOverrideFields: object.nullable(), configuration: writerTranslationConfigurationSchema,
  calls: z.array(z.object({ requestHash: hash, metadata: callMetadata,
    responseArtifact: z.object({ version: z.literal(1), body: z.unknown() }).strict()
      .refine(value => Object.hasOwn(value, "body")).nullable(),
  }).strict()).max(4),
  candidate: object.nullable(),
}).strict();
export type WriterTranslationOperationArtifacts = z.infer<typeof artifactSchema>;

export class WriterTranslationOperationRpcError extends Error {
  constructor(readonly errorCode: TranslationErrorCode, readonly confirmedRefusal = false, readonly databaseCode: string | null = null) {
    super(errorCode); this.name = "WriterTranslationOperationRpcError";
  }
}
function fault(error?: { code?: unknown } | null) {
  const code = typeof error?.code === "string" ? error.code : null;
  return new WriterTranslationOperationRpcError(code === "PGRST202" || code === "42883" ? "translation_migration_required"
    : code === "40001" ? "write_conflict" : code === "22023" ? "invalid_input" : "translation_retry_unconfirmed",
  code === "40001" || code === "22023" || code === "42501" || code === "P0002", code);
}
async function rpc(client: SupabaseClient, name: string, args: Record<string, unknown> = {}) {
  try {
    const response = await client.rpc(name, args);
    unstable_rethrow(response?.error);
    if (response?.error) throw fault(response.error);
    return response?.data;
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof WriterTranslationOperationRpcError) throw error;
    throw fault();
  }
}
const sameUuid = (left: string, right: string) => left.toLowerCase() === right.toLowerCase();
export function parseWriterTranslationOperationReceipt(value: unknown, identity: { countryId: string; writerId: string }, exact?: {
  jobId: string; itemId: string; operationId: string; actorId: string; sourceHash: string; intentHash?: string;
}) {
  const parsed = receiptSchema.safeParse(value);
  if (!parsed.success || parsed.data.countryId !== identity.countryId || parsed.data.writerId !== identity.writerId) return null;
  if (exact && (!sameUuid(parsed.data.jobId, exact.jobId) || !sameUuid(parsed.data.itemId, exact.itemId) ||
    !sameUuid(parsed.data.operationId, exact.operationId) || !sameUuid(parsed.data.actorId, exact.actorId) ||
    parsed.data.sourceHash !== exact.sourceHash || (exact.intentHash !== undefined && parsed.data.intentHash !== exact.intentHash))) return null;
  return parsed.data;
}
function parse(value: unknown, target: WriterTranslationOperationReceipt) {
  const receipt = parseWriterTranslationOperationReceipt(value, target, target);
  if (!receipt || receipt.configurationHash !== target.configurationHash ||
    !samePremiumTranslationJson(receipt.configuration, target.configuration) ||
    !samePremiumTranslationJson(receipt.sourceRevision, target.sourceRevision) ||
    !samePremiumTranslationJson(receipt.targetRevision, target.targetRevision)) throw fault();
  return receipt;
}
export function writerTranslationReceiptMatchesIntent(receipt: WriterTranslationOperationReceipt, intent: WriterTranslationOperationIntent) {
  return sameUuid(receipt.actorId, intent.actorId) && receipt.provider === intent.provider && receipt.sourceHash === intent.sourceHash &&
    samePremiumTranslationJson(receipt.sourceRevision, intent.sourceRevision) &&
    samePremiumTranslationJson(receipt.targetRevision, intent.targetRevision) && samePremiumTranslationJson(receipt.configuration, intent.configuration);
}
export async function writerTranslationOperationReady(client: SupabaseClient) {
  const value = await rpc(client, "writer_translation_operation_ready");
  if (typeof value !== "boolean") throw new WriterTranslationOperationRpcError("database_read_failed");
  return value;
}
export async function beginWriterTranslationOperation(client: SupabaseClient, intent: WriterTranslationOperationIntent) {
  const value = await rpc(client, "begin_writer_translation_operation", {
    p_job_id: intent.jobId, p_item_id: intent.itemId, p_operation_id: intent.operationId,
    p_country_id: intent.countryId, p_writer_id: intent.writerId, p_provider: intent.provider, p_source_hash: intent.sourceHash,
    p_source_snapshot: intent.sourceSnapshot, p_source_revision: intent.sourceRevision, p_target_revision: intent.targetRevision,
    p_expected_override_fields: intent.expectedOverrideFields, p_configuration: intent.configuration,
    p_current_cursor: intent.currentCursor, p_resume_cursor: intent.resumeCursor,
  });
  const receipt = parseWriterTranslationOperationReceipt(value, intent);
  if (!receipt || (receipt.canExecute && (!parseWriterTranslationOperationReceipt(value, intent, intent) ||
    !writerTranslationReceiptMatchesIntent(receipt, intent)))) throw fault();
  return receipt;
}
export async function reconcileWriterTranslationOperation(client: SupabaseClient, identity: { countryId: string; writerId: string }, operationId: string | null = null) {
  const value = await rpc(client, "reconcile_writer_translation_operation", {
    p_country_id: identity.countryId, p_writer_id: identity.writerId, p_operation_id: operationId,
  });
  if (value === null) return null;
  const receipt = parseWriterTranslationOperationReceipt(value, identity);
  if (!receipt || receipt.canExecute || receipt.canDispatch || (operationId !== null && !sameUuid(receipt.operationId, operationId))) throw fault();
  return receipt;
}
export async function getWriterTranslationOperationArtifacts(client: SupabaseClient, target: WriterTranslationOperationReceipt) {
  const value = await rpc(client, "get_writer_translation_operation_artifacts", {
    p_job_id: target.jobId, p_item_id: target.itemId, p_operation_id: target.operationId,
    p_intent_hash: target.intentHash, p_source_hash: target.sourceHash,
  });
  const parsed = artifactSchema.safeParse(value);
  if (!parsed.success) throw fault();
  const artifact = parsed.data, receipt = parse(artifact.receipt, target);
  if (receipt.canExecute || receipt.canDispatch || artifact.calls.length !== receipt.providerCalls ||
    !samePremiumTranslationJson(artifact.sourceRevision, receipt.sourceRevision) ||
    !samePremiumTranslationJson(artifact.targetRevision, receipt.targetRevision) ||
    !samePremiumTranslationJson(artifact.configuration, receipt.configuration) ||
    new Set(artifact.calls.map(call => call.metadata.callId.toLowerCase())).size !== artifact.calls.length ||
    artifact.calls.some(call => call.metadata.provider !== receipt.provider ||
      ((call.metadata.responseReceivedAt === null) !== (call.responseArtifact === null)))) throw fault();
  return artifact;
}
export async function dispatchWriterTranslationOperation(client: SupabaseClient, target: WriterTranslationOperationReceipt, call: {
  callId: string; provider: "cloudflare" | "openai"; model: string; pass: "translation" | "repair" | "review"; requestHash: string;
}) {
  return parse(await rpc(client, "record_writer_translation_operation_dispatch", {
    p_job_id: target.jobId, p_item_id: target.itemId, p_operation_id: target.operationId,
    p_call_id: call.callId, p_provider: call.provider, p_model: call.model, p_pass: call.pass, p_request_hash: call.requestHash,
  }), target);
}
export async function recordWriterTranslationOperationResponse(client: SupabaseClient, target: WriterTranslationOperationReceipt,
  metadata: TranslationProviderResponseMetadata, body: unknown) {
  return parse(await rpc(client, "record_writer_translation_operation_response", {
    p_job_id: target.jobId, p_item_id: target.itemId, p_operation_id: target.operationId,
    p_metadata: metadata, p_response_artifact: { version: 1, body },
  }), target);
}
export async function finishWriterTranslationOperation(client: SupabaseClient, target: WriterTranslationOperationReceipt,
  outcome: WriterTranslationOperationOutcome, candidate: WriterTranslationOperationCandidate | null = null) {
  const receipt = parse(await rpc(client, "finish_writer_translation_operation", {
    p_job_id: target.jobId, p_item_id: target.itemId, p_operation_id: target.operationId,
    p_outcome: outcome, p_candidate: candidate,
  }), target);
  if (receipt.phase !== "finished" || (candidate !== null && receipt.result?.candidateHash === null)) throw fault();
  return receipt;
}
