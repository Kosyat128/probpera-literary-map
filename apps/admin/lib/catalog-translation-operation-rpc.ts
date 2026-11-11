import type { SupabaseClient } from "@supabase/supabase-js";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";

import type { TranslationProviderResponseMetadata } from "./premium-english-translation";
import type { PremiumTranslationDraftProvenance } from "./premium-translation-working-draft";
import { samePremiumTranslationJson } from "./premium-translation-working-draft";
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
const bookSourceRevision = z.object({ workId: uuid, workUpdatedAt: timestamp,
  russianId: uuid, russianUpdatedAt: timestamp }).strict();
const countrySourceRevision = z.object({ overrideId: uuid.nullable(), overrideUpdatedAt: timestamp.nullable(),
  catalogSourceHash: hash }).strict().refine(value => (value.overrideId === null) === (value.overrideUpdatedAt === null));
const sourceRevision = z.union([bookSourceRevision, countrySourceRevision]);
const entityType = z.enum(["literary_work", "country"]);

export const catalogTranslationConfigurationSchema = z.object({
  version: z.literal(1), provider, model, reviewerModel: model, twoPassReview: z.boolean(),
  translatorReasoningEffort: effort, translatorReasoningMode: mode,
  reviewerReasoningEffort: effort, reviewerReasoningMode: mode, promptFingerprint: hash,
  schemaName: z.enum(["probpera_literary_work_translation", "probpera_country_profile_translation"]),
  maxOutputTokens: z.union([z.literal(4_000), z.literal(12_000)]),
}).strict().refine(value => value.schemaName === "probpera_literary_work_translation" ? value.maxOutputTokens === 4_000 : value.maxOutputTokens === 12_000);
export type CatalogTranslationConfiguration = z.infer<typeof catalogTranslationConfigurationSchema>;

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
  version: z.literal(1), jobId: uuid, itemId: uuid, operationId: uuid,
  entityType, entityId: z.string().min(1).max(481), rawSeedHash: hash, actorId: uuid,
  provider, sourceHash: hash, intentHash: hash, configurationHash: hash,
  configuration: catalogTranslationConfigurationSchema, sourceRevision, targetRevision,
  jobVersion: version, phase: z.enum(["running", "blocked", "finished"]),
  canExecute: z.boolean(), canDispatch: z.boolean(), replayed: z.boolean(),
  providerCalls: z.number().int().min(0).max(4), pendingCallId: uuid.nullable(),
  blockReason: z.enum(["provider_outcome_unknown", "operation_owned_by_another_actor", "operation_stopped", "operation_in_progress"]).nullable(),
  resumeCursor: object, result: result.nullable(),
}).strict().superRefine((value, context) => {
  const book = value.entityType === "literary_work";
  const revision = value.sourceRevision;
  const identityValid = book ? uuid.safeParse(value.entityId).success && "workId" in revision &&
    revision.workId.toLowerCase() === value.entityId.toLowerCase() && value.targetRevision.id !== null
    : "overrideId" in revision && revision.overrideId === value.targetRevision.id &&
      revision.overrideUpdatedAt === value.targetRevision.updatedAt;
  if (!identityValid || value.configuration.provider !== value.provider ||
    value.configuration.schemaName !== (book ? "probpera_literary_work_translation" : "probpera_country_profile_translation") ||
    (value.phase === "finished") !== (value.result !== null) ||
    (value.phase === "blocked") !== (value.blockReason !== null) ||
    (value.phase === "finished" && (value.pendingCallId !== null || value.canExecute || value.canDispatch)) ||
    (value.canExecute && (value.phase !== "running" || value.providerCalls !== 0 || value.pendingCallId !== null || value.replayed || value.canDispatch)) ||
    (value.canDispatch && (value.phase !== "running" || value.providerCalls < 1 || value.pendingCallId === null || value.replayed)) ||
    (value.blockReason === "provider_outcome_unknown" && value.pendingCallId === null)) {
    context.addIssue({ code: "custom", message: "Inconsistent catalog operation receipt" });
  }
});
export type CatalogTranslationOperationReceipt = z.infer<typeof receiptSchema>;
export type CatalogTranslationOperationIntent = {
  jobId: string; itemId: string; operationId: string; actorId: string; entityType: "literary_work" | "country"; entityId: string;
  provider: "cloudflare" | "openai"; sourceHash: string; sourceSnapshot: Record<string, unknown>;
  sourceRevision: z.infer<typeof sourceRevision>; targetRevision: z.infer<typeof targetRevision>;
  expectedState: Record<string, unknown>; configuration: CatalogTranslationConfiguration;
  currentCursor: Record<string, unknown>; resumeCursor: Record<string, unknown>;
};
export type CatalogTranslationOperationCandidate = {
  payload: Record<string, unknown>; provenance: PremiumTranslationDraftProvenance;
  translatorCallId: string; reviewerCallId: string | null;
};
export type CatalogTranslationOperationOutcome = {
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
  expectedState: object, rawSeed: object, configuration: catalogTranslationConfigurationSchema,
  calls: z.array(z.object({ requestHash: hash, metadata: callMetadata,
    responseArtifact: z.object({ version: z.literal(1), body: z.unknown() }).strict()
      .refine(value => Object.hasOwn(value, "body") && JSON.stringify(value.body) !== undefined).nullable(),
  }).strict()).max(4),
  candidate: object.nullable(),
}).strict();
export type CatalogTranslationOperationArtifacts = z.infer<typeof artifactSchema>;

export class CatalogTranslationOperationRpcError extends Error {
  constructor(readonly errorCode: TranslationErrorCode, readonly confirmedRefusal = false, readonly databaseCode: string | null = null) {
    super(errorCode); this.name = "CatalogTranslationOperationRpcError";
  }
}
function fault(error?: { code?: unknown } | null) {
  const code = typeof error?.code === "string" ? error.code : null;
  return new CatalogTranslationOperationRpcError(code === "PGRST202" || code === "42883" ? "translation_migration_required"
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
    if (error instanceof CatalogTranslationOperationRpcError) throw error;
    throw fault();
  }
}
const sameUuid = (left: string, right: string) => left.toLowerCase() === right.toLowerCase();
export function parseCatalogTranslationOperationReceipt(value: unknown, identity: { entityType: "literary_work" | "country"; entityId: string }, exact?: {
  jobId: string; itemId: string; operationId: string; actorId: string; sourceHash: string; intentHash?: string;
}) {
  const parsed = receiptSchema.safeParse(value);
  if (!parsed.success || parsed.data.entityType !== identity.entityType || parsed.data.entityId !== identity.entityId) return null;
  if (exact && (!sameUuid(parsed.data.jobId, exact.jobId) || !sameUuid(parsed.data.itemId, exact.itemId) ||
    !sameUuid(parsed.data.operationId, exact.operationId) || !sameUuid(parsed.data.actorId, exact.actorId) ||
    parsed.data.sourceHash !== exact.sourceHash || (exact.intentHash !== undefined && parsed.data.intentHash !== exact.intentHash))) return null;
  return parsed.data;
}
function parse(value: unknown, target: CatalogTranslationOperationReceipt) {
  const receipt = parseCatalogTranslationOperationReceipt(value, target, target);
  if (!receipt || receipt.rawSeedHash !== target.rawSeedHash || receipt.configurationHash !== target.configurationHash ||
    !samePremiumTranslationJson(receipt.configuration, target.configuration) ||
    !samePremiumTranslationJson(receipt.sourceRevision, target.sourceRevision) ||
    !samePremiumTranslationJson(receipt.targetRevision, target.targetRevision)) throw fault();
  return receipt;
}
export function catalogTranslationReceiptMatchesIntent(receipt: CatalogTranslationOperationReceipt, intent: CatalogTranslationOperationIntent) {
  return sameUuid(receipt.actorId, intent.actorId) && receipt.provider === intent.provider && receipt.sourceHash === intent.sourceHash &&
    samePremiumTranslationJson(receipt.sourceRevision, intent.sourceRevision) &&
    samePremiumTranslationJson(receipt.targetRevision, intent.targetRevision) && samePremiumTranslationJson(receipt.configuration, intent.configuration);
}
export async function catalogTranslationOperationReady(client: SupabaseClient) {
  const value = await rpc(client, "catalog_translation_operation_ready");
  if (typeof value !== "boolean") throw new CatalogTranslationOperationRpcError("database_read_failed");
  return value;
}
export async function beginCatalogTranslationOperation(client: SupabaseClient, intent: CatalogTranslationOperationIntent) {
  const value = await rpc(client, "begin_catalog_translation_operation", {
    p_job_id: intent.jobId, p_item_id: intent.itemId, p_operation_id: intent.operationId,
    p_entity_type: intent.entityType, p_entity_id: intent.entityId, p_provider: intent.provider, p_source_hash: intent.sourceHash,
    p_source_snapshot: intent.sourceSnapshot, p_source_revision: intent.sourceRevision, p_target_revision: intent.targetRevision,
    p_expected_state: intent.expectedState, p_configuration: intent.configuration,
    p_current_cursor: intent.currentCursor, p_resume_cursor: intent.resumeCursor,
  });
  const receipt = parseCatalogTranslationOperationReceipt(value, intent);
  if (!receipt || (receipt.canExecute && (!parseCatalogTranslationOperationReceipt(value, intent, intent) ||
    !catalogTranslationReceiptMatchesIntent(receipt, intent)))) throw fault();
  return receipt;
}
export async function reconcileCatalogTranslationOperation(client: SupabaseClient, identity: { entityType: "literary_work" | "country"; entityId: string }, operationId: string | null = null) {
  const value = await rpc(client, "reconcile_catalog_translation_operation", {
    p_entity_type: identity.entityType, p_entity_id: identity.entityId, p_operation_id: operationId,
  });
  if (value === null) return null;
  const receipt = parseCatalogTranslationOperationReceipt(value, identity);
  if (!receipt || receipt.canExecute || receipt.canDispatch || (operationId !== null && !sameUuid(receipt.operationId, operationId))) throw fault();
  return receipt;
}
export async function getCatalogTranslationOperationArtifacts(client: SupabaseClient, target: CatalogTranslationOperationReceipt) {
  const value = await rpc(client, "get_catalog_translation_operation_artifacts", {
    p_job_id: target.jobId, p_item_id: target.itemId, p_operation_id: target.operationId,
    p_entity_type: target.entityType, p_entity_id: target.entityId,
    p_intent_hash: target.intentHash, p_source_hash: target.sourceHash,
  });
  const parsed = artifactSchema.safeParse(value);
  if (!parsed.success) throw fault();
  const artifact = parsed.data, receipt = parse(artifact.receipt, target);
  const raw = artifact.rawSeed, expected = artifact.expectedState;
  const plain = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
  const rawValid = raw.version === 1 && expected.version === 1 && (receipt.entityType === "literary_work"
    ? plain(raw.work) && plain(raw.russian) && plain(raw.english) && Array.isArray(raw.sources) && raw.sources.every(plain) &&
      uuid.safeParse(raw.selectedTitleSourceId).success && raw.work.id === receipt.entityId &&
      plain(expected.work) && plain(expected.russian) && plain(expected.english) && plain(expected.titleSource)
    : plain(raw.catalogFields) && (raw.override === null || plain(raw.override)) && plain(expected.catalogFields) &&
      (expected.override === null || plain(expected.override)) && samePremiumTranslationJson(raw.catalogFields, expected.catalogFields));
  const pending = artifact.calls.filter(call => call.metadata.responseReceivedAt === null);
  const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length;
  if (receipt.canExecute || receipt.canDispatch || artifact.calls.length !== receipt.providerCalls ||
    !rawValid || bytes(raw) > 4 * 1024 * 1024 ||
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
export async function dispatchCatalogTranslationOperation(client: SupabaseClient, target: CatalogTranslationOperationReceipt, call: {
  callId: string; provider: "cloudflare" | "openai"; model: string; pass: "translation" | "repair" | "review"; requestHash: string;
}) {
  return parse(await rpc(client, "record_catalog_translation_operation_dispatch", {
    p_job_id: target.jobId, p_item_id: target.itemId, p_operation_id: target.operationId,
    p_call_id: call.callId, p_provider: call.provider, p_model: call.model, p_pass: call.pass, p_request_hash: call.requestHash,
  }), target);
}
export async function recordCatalogTranslationOperationResponse(client: SupabaseClient, target: CatalogTranslationOperationReceipt,
  metadata: TranslationProviderResponseMetadata, body: unknown) {
  return parse(await rpc(client, "record_catalog_translation_operation_response", {
    p_job_id: target.jobId, p_item_id: target.itemId, p_operation_id: target.operationId,
    p_metadata: metadata, p_response_artifact: { version: 1, body },
  }), target);
}
export async function finishCatalogTranslationOperation(client: SupabaseClient, target: CatalogTranslationOperationReceipt,
  outcome: CatalogTranslationOperationOutcome, candidate: CatalogTranslationOperationCandidate | null = null) {
  const receipt = parse(await rpc(client, "finish_catalog_translation_operation", {
    p_job_id: target.jobId, p_item_id: target.itemId, p_operation_id: target.operationId,
    p_outcome: outcome, p_candidate: candidate,
  }), target);
  if (receipt.phase !== "finished" || (candidate !== null && receipt.result?.candidateHash === null)) throw fault();
  return receipt;
}
