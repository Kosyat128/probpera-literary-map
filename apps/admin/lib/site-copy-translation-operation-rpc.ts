// Closed staff RPC adapter for durable site-copy translation operations.
import type { SupabaseClient } from "@supabase/supabase-js";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";

import type { TranslationProviderResponseMetadata } from "./premium-english-translation";
import type { PremiumTranslationDraftProvenance } from "./premium-translation-working-draft";
import { samePremiumTranslationJson } from "./premium-translation-working-draft";
import { translationErrorCodes, type TranslationErrorCode } from "./translation-errors";
import { validSiteCopyTranslationKey } from "./site-copy-translation-contract";

const uuid = z.string().uuid();
const hash = z.string().regex(/^[a-f0-9]{64}$/u);
const timestamp = z.string().datetime({ offset: true });
// JSON PostgreSQL timestamps carry microseconds. Parsing the fractional part
// separately preserves the exact instant across equivalent timezone spellings.
function timestampKey(value: string): bigint | null {
  const parts = /^(.*:[0-9]{2})(?:\.([0-9]{1,9}))?(Z|[+-][0-9]{2}:[0-9]{2})$/u.exec(value);
  if (!parts) return null;
  const wholeSecond = Date.parse(`${parts[1]}${parts[3]}`);
  return Number.isFinite(wholeSecond)
    ? BigInt(wholeSecond) * 1_000_000n + BigInt((parts[2] ?? "").padEnd(9, "0"))
    : null;
}
const object = z.record(z.string(), z.unknown());
const provider = z.enum(["cloudflare", "openai"]);
const effort = z.enum(["none", "low", "medium", "high", "xhigh", "max"]);
const mode = z.enum(["standard", "pro"]);
const model = z.string().min(1).max(200).refine(value => !/[\u0000-\u001f\u007f]/u.test(value));
const version = z.string().regex(/^[1-9][0-9]{0,18}$/u)
  .refine(value => BigInt(value) <= 9223372036854775807n);
const targetRevision = z.object({ id: uuid, updatedAt: timestamp }).strict();
const sourceRevision = z.object({ blockId: uuid, blockUpdatedAt: timestamp }).strict();
const entityType = z.literal("site_copy");
export const SITE_COPY_LOGICAL_SCOPE = "site-copy-overrides" as const;
const sourceSnapshot = z.object({
  settings: object,
  items: z.array(z.object({
    key: z.string().refine(validSiteCopyTranslationKey),
    text: z.string().min(1).max(4_000).refine(value => value.trim().length > 0),
    sourceHash: hash,
  }).strict()).min(1).max(50)
    .refine(items => new Set(items.map(item => item.key)).size === items.length),
}).strict();
const blockProjection = z.object({ id: uuid, settings: object, updated_at: timestamp }).strict();
const expectedState = z.object({ version: z.literal(1), block: blockProjection }).strict();
// The server captures the entire actual row. Other current row columns are
// retained here and remain part of its opaque native rawSeedHash.
const rawSeed = z.object({
  version: z.literal(1), block: blockProjection.passthrough(),
}).strict();

export const siteCopyTranslationConfigurationSchema = z.object({
  version: z.literal(1), provider, model, reviewerModel: model, twoPassReview: z.boolean(),
  translatorReasoningEffort: effort, translatorReasoningMode: mode,
  reviewerReasoningEffort: effort, reviewerReasoningMode: mode, promptFingerprint: hash,
  schemaName: z.literal("probpera_site_copy_translation"), maxOutputTokens: z.literal(12_000),
}).strict();
export type SiteCopyTranslationConfiguration = z.infer<typeof siteCopyTranslationConfigurationSchema>;

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
    context.addIssue({ code: "custom", message: "Inconsistent catalog operation persistence" });
  }
});
const receiptSchema = z.object({
  version: z.literal(1), logicalScope: z.literal(SITE_COPY_LOGICAL_SCOPE), jobId: uuid, itemId: uuid, operationId: uuid,
  entityType, entityId: uuid, rawSeedHash: hash, actorId: uuid,
  provider, sourceHash: hash, intentHash: hash, configurationHash: hash,
  configuration: siteCopyTranslationConfigurationSchema, sourceRevision, targetRevision,
  startedAt: timestamp, deadlineAt: timestamp, jobVersion: version, phase: z.enum(["running", "blocked", "finished"]),
  canExecute: z.boolean(), canDispatch: z.boolean(), replayed: z.boolean(),
  providerCalls: z.number().int().min(0).max(4), pendingCallId: uuid.nullable(),
  blockReason: z.enum(["provider_outcome_unknown", "operation_owned_by_another_actor", "operation_stopped", "operation_in_progress", "operation_deadline"]).nullable(),
  resumeCursor: z.object({}).strict(), result: result.nullable(),
}).strict().superRefine((value, context) => {
  const revision = value.sourceRevision;
  const started = timestampKey(value.startedAt);
  const deadline = timestampKey(value.deadlineAt);
  const identityValid = revision.blockId.toLowerCase() === value.entityId.toLowerCase() &&
    value.targetRevision.id.toLowerCase() === value.entityId.toLowerCase() && revision.blockUpdatedAt === value.targetRevision.updatedAt;
  if (!identityValid || value.configuration.provider !== value.provider ||
    value.configuration.schemaName !== "probpera_site_copy_translation" ||
    (started === null || deadline === null || deadline - started !== 45_000_000_000n) ||
    (value.phase === "finished") !== (value.result !== null) ||
    (value.phase === "blocked") !== (value.blockReason !== null) ||
    (value.phase === "finished" && (value.pendingCallId !== null || value.canExecute || value.canDispatch)) ||
    (value.canExecute && (value.phase !== "running" || value.providerCalls !== 0 || value.pendingCallId !== null || value.replayed || value.canDispatch)) ||
    (value.canDispatch && (value.phase !== "running" || value.providerCalls < 1 || value.pendingCallId === null || value.replayed)) ||
    (value.blockReason === "provider_outcome_unknown" && value.pendingCallId === null)) {
    context.addIssue({ code: "custom", message: "Inconsistent catalog operation receipt" });
  }
});
export type SiteCopyTranslationOperationReceipt = z.infer<typeof receiptSchema>;
export type SiteCopyTranslationOperationIntent = {
  jobId: string; itemId: string; operationId: string; actorId: string; entityType: "site_copy"; entityId: string;
  provider: "cloudflare" | "openai"; sourceHash: string; sourceSnapshot: Record<string, unknown>;
  sourceRevision: z.infer<typeof sourceRevision>; targetRevision: z.infer<typeof targetRevision>;
  expectedState: Record<string, unknown>; configuration: SiteCopyTranslationConfiguration;
};
export type SiteCopyTranslationOperationCandidate = {
  payload: Record<string, unknown>; provenance: PremiumTranslationDraftProvenance;
  translatorCallId: string; reviewerCallId: string | null;
};
export type SiteCopyTranslationOperationOutcome = {
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
export const siteCopyTranslationCallMetadataSchema = callMetadata;
const artifactSchema = z.object({
  version: z.literal(1), receipt: receiptSchema, sourceSnapshot, sourceRevision, targetRevision,
  expectedState, rawSeed, configuration: siteCopyTranslationConfigurationSchema,
  calls: z.array(z.object({ requestHash: hash, metadata: callMetadata,
    responseArtifact: z.object({ version: z.literal(1), body: z.unknown() }).strict()
      .refine(value => Object.hasOwn(value, "body") && JSON.stringify(value.body) !== undefined).nullable(),
  }).strict()).max(4),
  candidate: object.nullable(),
}).strict();
export type SiteCopyTranslationOperationArtifacts = z.infer<typeof artifactSchema>;

export class SiteCopyTranslationOperationRpcError extends Error {
  constructor(readonly errorCode: TranslationErrorCode, readonly confirmedRefusal = false, readonly databaseCode: string | null = null) {
    super(errorCode); this.name = "SiteCopyTranslationOperationRpcError";
  }
}
function fault(error?: { code?: unknown } | null) {
  const code = typeof error?.code === "string" && error.code.length ? error.code : null;
  return new SiteCopyTranslationOperationRpcError(code === "PGRST202" || code === "42883" ? "translation_migration_required"
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
    if (error instanceof SiteCopyTranslationOperationRpcError) throw error;
    throw fault();
  }
}
const sameUuid = (left: string, right: string) => left.toLowerCase() === right.toLowerCase();
export function parseSiteCopyTranslationOperationReceipt(value: unknown, identity?: { entityType: "site_copy"; entityId: string }, exact?: {
  jobId: string; itemId: string; operationId: string; actorId: string; sourceHash: string; intentHash?: string;
}) {
  const parsed = receiptSchema.safeParse(value);
  if (!parsed.success || identity && (parsed.data.entityType !== identity.entityType || !sameUuid(parsed.data.entityId, identity.entityId))) return null;
  if (exact && (!sameUuid(parsed.data.jobId, exact.jobId) || !sameUuid(parsed.data.itemId, exact.itemId) ||
    !sameUuid(parsed.data.operationId, exact.operationId) || !sameUuid(parsed.data.actorId, exact.actorId) ||
    parsed.data.sourceHash !== exact.sourceHash || (exact.intentHash !== undefined && parsed.data.intentHash !== exact.intentHash))) return null;
  return parsed.data;
}
function parse(value: unknown, target: SiteCopyTranslationOperationReceipt) {
  const receipt = parseSiteCopyTranslationOperationReceipt(value, target, target);
  if (!receipt || receipt.rawSeedHash !== target.rawSeedHash || receipt.configurationHash !== target.configurationHash ||
    receipt.startedAt !== target.startedAt || receipt.deadlineAt !== target.deadlineAt ||
    !samePremiumTranslationJson(receipt.configuration, target.configuration) ||
    !samePremiumTranslationJson(receipt.sourceRevision, target.sourceRevision) ||
    !samePremiumTranslationJson(receipt.targetRevision, target.targetRevision)) throw fault();
  return receipt;
}
export function siteCopyTranslationReceiptMatchesIntent(receipt: SiteCopyTranslationOperationReceipt, intent: SiteCopyTranslationOperationIntent) {
  return sameUuid(receipt.actorId, intent.actorId) && receipt.provider === intent.provider && receipt.sourceHash === intent.sourceHash &&
    samePremiumTranslationJson(receipt.sourceRevision, intent.sourceRevision) &&
    samePremiumTranslationJson(receipt.targetRevision, intent.targetRevision) && samePremiumTranslationJson(receipt.configuration, intent.configuration);
}
export async function siteCopyTranslationOperationReady(client: SupabaseClient) {
  const value = await rpc(client, "site_copy_translation_operation_ready");
  if (typeof value !== "boolean") throw new SiteCopyTranslationOperationRpcError("database_read_failed");
  return value;
}
export async function beginSiteCopyTranslationOperation(client: SupabaseClient, intent: SiteCopyTranslationOperationIntent) {
  const value = await rpc(client, "begin_site_copy_translation_operation", {
    p_job_id: intent.jobId, p_item_id: intent.itemId, p_operation_id: intent.operationId,
    p_block_id: intent.entityId, p_provider: intent.provider, p_source_hash: intent.sourceHash,
    p_source_snapshot: intent.sourceSnapshot, p_source_revision: intent.sourceRevision, p_target_revision: intent.targetRevision,
    p_expected_state: intent.expectedState, p_configuration: intent.configuration,
  });
  const receipt = parseSiteCopyTranslationOperationReceipt(value);
  if (!receipt || (receipt.canExecute && (!parseSiteCopyTranslationOperationReceipt(value, intent, intent) ||
    !siteCopyTranslationReceiptMatchesIntent(receipt, intent)))) throw fault();
  return receipt;
}
export async function reconcileSiteCopyTranslationOperation(client: SupabaseClient, operationId: string | null = null) {
  const value = await rpc(client, "reconcile_site_copy_translation_operation", { p_operation_id: operationId });
  if (value === null) return null;
  const receipt = parseSiteCopyTranslationOperationReceipt(value);
  // Active logical scope deliberately wins over an older requested operation.
  // This metadata observation grants no expense or private-body capability.
  if (!receipt || receipt.canExecute || receipt.canDispatch) throw fault();
  return receipt;
}
export async function getSiteCopyTranslationOperationArtifacts(client: SupabaseClient, target: SiteCopyTranslationOperationReceipt) {
  const value = await rpc(client, "get_site_copy_translation_operation_artifacts", {
    p_job_id: target.jobId, p_item_id: target.itemId, p_operation_id: target.operationId,
    p_intent_hash: target.intentHash, p_source_hash: target.sourceHash, p_raw_seed_hash: target.rawSeedHash,
  });
  const parsed = artifactSchema.safeParse(value);
  if (!parsed.success) throw fault();
  const artifact = parsed.data, receipt = parse(artifact.receipt, target);
  const raw = artifact.rawSeed, expected = artifact.expectedState;
  const revisionTime = timestampKey(receipt.sourceRevision.blockUpdatedAt);
  const rawValid = sameUuid(raw.block.id, receipt.entityId) && sameUuid(expected.block.id, receipt.entityId) &&
    raw.block.settings.systemKey === SITE_COPY_LOGICAL_SCOPE &&
    revisionTime !== null && timestampKey(raw.block.updated_at) === revisionTime &&
    timestampKey(expected.block.updated_at) === revisionTime &&
    samePremiumTranslationJson(raw.block.settings, expected.block.settings) &&
    samePremiumTranslationJson(raw.block.settings, artifact.sourceSnapshot.settings);
  const pending = artifact.calls.filter(call => call.metadata.responseReceivedAt === null);
  const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length;
  if (receipt.canExecute || receipt.canDispatch || artifact.calls.length !== receipt.providerCalls ||
    !rawValid || bytes(raw) > 4 * 1024 * 1024 || bytes(expected) > 4 * 1024 * 1024 ||
    bytes(artifact.sourceSnapshot) > 4 * 1024 * 1024 || bytes(artifact.calls) > 4 * 1024 * 1024 ||
    (artifact.candidate !== null && bytes(artifact.candidate) > 1024 * 1024) ||
    (receipt.pendingCallId === null ? pending.length !== 0 : pending.length !== 1 ||
      pending[0].metadata.callId.toLowerCase() !== receipt.pendingCallId.toLowerCase() ||
      artifact.calls.at(-1)?.metadata.callId.toLowerCase() !== receipt.pendingCallId.toLowerCase()) ||
    !samePremiumTranslationJson(artifact.sourceRevision, receipt.sourceRevision) ||
    !samePremiumTranslationJson(artifact.targetRevision, receipt.targetRevision) ||
    !samePremiumTranslationJson(artifact.configuration, receipt.configuration) ||
    new Set(artifact.calls.map(call => call.metadata.callId.toLowerCase())).size !== artifact.calls.length ||
    artifact.calls.some(call => call.metadata.provider !== receipt.provider ||
      (call.responseArtifact !== null && bytes(call.responseArtifact) > 1024 * 1024) ||
      ((call.metadata.responseReceivedAt === null) !== (call.responseArtifact === null)))) throw fault();
  return artifact;
}
export async function dispatchSiteCopyTranslationOperation(client: SupabaseClient, target: SiteCopyTranslationOperationReceipt, call: {
  callId: string; provider: "cloudflare" | "openai"; model: string; pass: "translation" | "repair" | "review"; requestHash: string;
}) {
  return parse(await rpc(client, "record_site_copy_translation_operation_dispatch", {
    p_job_id: target.jobId, p_item_id: target.itemId, p_operation_id: target.operationId,
    p_call_id: call.callId, p_provider: call.provider, p_model: call.model, p_pass: call.pass, p_request_hash: call.requestHash,
  }), target);
}
export async function recordSiteCopyTranslationOperationResponse(client: SupabaseClient, target: SiteCopyTranslationOperationReceipt,
  metadata: TranslationProviderResponseMetadata, body: unknown) {
  return parse(await rpc(client, "record_site_copy_translation_operation_response", {
    p_job_id: target.jobId, p_item_id: target.itemId, p_operation_id: target.operationId,
    p_metadata: metadata, p_response_artifact: { version: 1, body },
  }), target);
}
export async function finishSiteCopyTranslationOperation(client: SupabaseClient, target: SiteCopyTranslationOperationReceipt,
  outcome: SiteCopyTranslationOperationOutcome, candidate: SiteCopyTranslationOperationCandidate | null = null) {
  const receipt = parse(await rpc(client, "finish_site_copy_translation_operation", {
    p_job_id: target.jobId, p_item_id: target.itemId, p_operation_id: target.operationId,
    p_outcome: outcome, p_candidate: candidate,
  }), target);
  if (receipt.phase !== "finished" || (candidate !== null && receipt.result?.candidateHash === null)) throw fault();
  return receipt;
}
