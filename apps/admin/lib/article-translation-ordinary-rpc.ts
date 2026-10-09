import { unstable_rethrow } from "next/navigation";
import { z } from "zod";

import { articleWorkingDraftEnglishEnvelope, parseArticleWorkingDraft } from "../app/(dashboard)/articles/article-working-draft";
import { sameArticleRetryRevision } from "./article-retry-revision";
import { decodeArticleTranslationResumeCursor } from "./article-translation-scan";
import { parseArticleTranslationItemRetryCandidate, type ArticleTranslationItemRetryCandidate, type ArticleTranslationItemRetryClient, type ArticleTranslationItemRetryIntent, type ArticleTranslationItemRetryOutcome, type ArticleTranslationItemRetryTarget } from "./article-translation-item-retry";
import type { TranslationErrorCode } from "./translation-errors";

const uuid = z.string().uuid(), hash = z.string().regex(/^[a-f0-9]{64}$/u), revision = z.string().datetime({ offset: true });
const count = z.number().int().nonnegative().safe(), provider = z.enum(["openai", "cloudflare"]);
const version = z.string().regex(/^[1-9][0-9]{0,18}$/u).refine(value => BigInt(value) <= 9_223_372_036_854_775_807n);
const expectedVersion = z.string().regex(/^(?:0|[1-9][0-9]{0,18})$/u).refine(value => BigInt(value) <= 9_223_372_036_854_775_805n);
const cursor = z.record(z.string(), z.unknown()).refine(value => Object.keys(value).length === 0 ||
  Object.keys(value).length === 1 && Object.hasOwn(value, "articleScan") && decodeArticleTranslationResumeCursor(value).kind === "scan");
const jobStatus = z.enum(["queued", "running", "reviewing", "cancelling", "completed", "partial", "failed", "conflict", "stale", "skipped", "not-configured", "cancelled"]);
const errors = z.enum(["translation_not_configured", "provider_unavailable", "provider_request_failed", "provider_invalid_response", "source_changed", "write_conflict", "database_read_failed", "database_write_failed", "unexpected"]);
const outcomeStatus = z.enum(["succeeded", "dead_letter", "conflict", "stale", "skipped", "not-configured"]);
const resultSchema = z.object({
  outcome: z.enum([...outcomeStatus.options, "cancelled"]), errorCode: errors.nullable(),
  persistence: z.enum(["working-draft", "none"]), workingDraftVersion: count.positive().nullable(), workingDraftUpdatedAt: revision.nullable(),
  publication: z.literal("unchanged"), humanReview: z.enum(["pending", "unchanged"]), providerCalls: count.max(4),
}).strict().superRefine((value, context) => {
  const draft = value.outcome === "succeeded";
  if (draft !== (value.persistence === "working-draft") || draft !== (value.workingDraftVersion !== null && value.workingDraftUpdatedAt !== null) ||
    !draft && (value.workingDraftVersion !== null || value.workingDraftUpdatedAt !== null) || value.humanReview !== (draft ? "pending" : "unchanged") ||
    draft && value.errorCode !== null || ["dead_letter", "conflict", "stale", "not-configured"].includes(value.outcome) && value.errorCode === null) {
    context.addIssue({ code: "custom", message: "Invalid ordinary translation result" });
  }
});
const itemReceipt = z.object({
  version: z.literal(1), jobId: uuid, itemId: uuid, articleId: uuid, provider,
  sourceHash: hash.nullable(), sourceUpdatedAt: revision.nullable(), englishUpdatedAt: revision.nullable(), jobVersion: version,
  attemptCount: count.max(3), maxAttempts: z.literal(3), jobStatus,
  itemStatus: z.enum(["queued", "leased", "retry_wait", "reviewing", ...outcomeStatus.options, "cancelled"]), operationId: uuid.nullable(),
  phase: z.enum(["ready", "running", "finished", "blocked"]), canExecute: z.boolean(), replayed: z.boolean(), retryable: z.boolean(),
  blockReason: z.enum(["source_hash_missing", "item_not_failed", "attempt_limit", "job_not_finished", "job_not_sync", "operation_stopped", "retry_busy", "author_draft_exists", "manual_english", "source_unavailable", "source_shape_unsupported"]).nullable(), result: resultSchema.nullable(),
}).strict().superRefine((value, context) => {
  const invalid = value.phase === "ready"
    ? value.operationId !== null || value.canExecute || value.replayed || !value.retryable || value.blockReason !== null || value.result !== null ||
      value.sourceHash === null || value.sourceUpdatedAt === null || value.attemptCount >= value.maxAttempts ||
      !["dead_letter", "conflict", "stale", "not-configured"].includes(value.itemStatus) ||
      !["completed", "partial", "failed", "conflict", "stale", "skipped", "not-configured"].includes(value.jobStatus)
    : value.phase === "running"
      ? value.operationId === null || value.sourceHash === null || value.sourceUpdatedAt === null || value.retryable || value.blockReason !== null ||
        value.attemptCount >= value.maxAttempts || value.result !== null || value.itemStatus !== "reviewing" ||
        !["running", "reviewing", "cancelling", "cancelled"].includes(value.jobStatus) || value.canExecute && value.replayed
      : value.phase === "finished"
        ? value.operationId === null || value.sourceHash === null || value.sourceUpdatedAt === null || value.attemptCount < 1 || value.canExecute ||
          value.retryable || value.blockReason !== null || value.result === null || value.itemStatus !== value.result.outcome || value.jobStatus === "queued"
        : value.canExecute || value.retryable || value.blockReason === null || value.result !== null;
  if (invalid) {
    context.addIssue({ code: "custom", message: "Invalid ordinary item phase" });
  }
});
const runReceipt = z.object({
  version: z.literal(1), jobId: uuid, provider, actorId: uuid, jobVersion: version, status: jobStatus,
  totalItems: count.max(500), succeededItems: count.max(500), failedItems: count.max(500), activeItems: count.max(500), pendingItems: count.max(500),
  resumeCursor: cursor, replayed: z.boolean(),
}).strict().superRefine((value, context) => {
  const active = value.activeItems + value.pendingItems;
  if (value.succeededItems + value.failedItems + active > value.totalItems ||
    active > 0 && !["running", "reviewing", "cancelling", "cancelled"].includes(value.status) ||
    value.status === "completed" && value.failedItems > 0) context.addIssue({ code: "custom", message: "Invalid ordinary run accounting" });
});

export type ArticleTranslationOrdinaryReceipt = z.infer<typeof itemReceipt>;
export type ArticleTranslationOrdinaryTarget = ArticleTranslationItemRetryTarget & Partial<Omit<ArticleTranslationItemRetryIntent, "jobId" | "itemId" | "operationId" | "articleId">>;
export type ArticleTranslationSyncRun = z.infer<typeof runReceipt>;
export type ArticleTranslationSyncIntent = ArticleTranslationItemRetryIntent & {
  articleId: string; expectedCursor: Record<string, unknown>; resumeCursor: Record<string, unknown>; sourceSnapshot: Record<string, unknown>;
};
export type ArticleTranslationObservedItem = { entityId: string; state: "current" | "manual" | "skipped"; sourceHash?: string };
export class ArticleTranslationOrdinaryRpcError extends Error {
  constructor(readonly errorCode: TranslationErrorCode, readonly confirmedRefusal = false, readonly operationNotFound = false, readonly databaseCode: string | null = null) {
    super("Ordinary article translation operation was not confirmed"); this.name = "ArticleTranslationOrdinaryRpcError";
  }
}
const sameUuid = (left: string, right: string) => left.toLowerCase() === right.toLowerCase();
function fault(error: unknown, confirmed: boolean, specificLookup = false) {
  const code = error && typeof error === "object" && "code" in error ? error.code : null;
  return new ArticleTranslationOrdinaryRpcError(!confirmed ? "translation_retry_unconfirmed"
    : code === "42883" || code === "PGRST202" ? "translation_migration_required" : code === "42501" ? "translation_operation_stopped"
    : code === "40001" ? "write_conflict" : code === "22023" ? "invalid_input" : code === "P0002" ? "database_read_failed"
    : "translation_retry_unconfirmed", confirmed && ["42883", "PGRST202", "42501", "40001", "22023", "P0002"].includes(String(code)), confirmed && specificLookup && code === "P0002", confirmed && typeof code === "string" ? code : null);
}
async function rpc(client: ArticleTranslationItemRetryClient, name: string, args: Record<string, unknown>) {
  let reply;
  try { reply = await client.rpc(name, args); } catch (error) { unstable_rethrow(error); throw fault(error, false); }
  if (!reply || typeof reply !== "object" || Array.isArray(reply) || !Object.hasOwn(reply, "data") || !Object.hasOwn(reply, "error")) throw fault(null, false);
  unstable_rethrow(reply.error);
  if (reply.error !== null) throw fault(reply.error, reply.data === null, name === "get_article_translation_item_retry" && typeof args.p_operation_id === "string");
  return reply.data;
}
export function parseArticleTranslationOrdinaryReceipt(value: unknown, intent: ArticleTranslationOrdinaryTarget, boundary: "get" | "begin" | "finish" = "get") {
  const parsed = itemReceipt.safeParse(value);
  if (!parsed.success || !uuid.safeParse(intent.jobId).success || !uuid.safeParse(intent.itemId).success ||
    intent.operationId != null && !uuid.safeParse(intent.operationId).success || intent.articleId !== undefined && !uuid.safeParse(intent.articleId).success) return null;
  const receipt = parsed.data;
  if (!sameUuid(receipt.jobId, intent.jobId) || !sameUuid(receipt.itemId, intent.itemId) ||
    intent.operationId != null && receipt.operationId !== null && !sameUuid(receipt.operationId, intent.operationId) ||
    intent.articleId !== undefined && !sameUuid(receipt.articleId, intent.articleId) || intent.provider !== undefined && receipt.provider !== intent.provider ||
    intent.expectedSourceHash !== undefined && receipt.sourceHash !== intent.expectedSourceHash ||
    intent.expectedSourceUpdatedAt !== undefined && !sameArticleRetryRevision(receipt.sourceUpdatedAt, intent.expectedSourceUpdatedAt) ||
    intent.expectedEnglishUpdatedAt !== undefined && !sameArticleRetryRevision(receipt.englishUpdatedAt, intent.expectedEnglishUpdatedAt) ||
    boundary !== "begin" && receipt.canExecute || boundary === "begin" && !["running", "finished"].includes(receipt.phase) ||
    boundary === "finish" && receipt.phase !== "finished" || intent.expectedAttemptCount !== undefined &&
      (receipt.phase === "running" && receipt.attemptCount !== intent.expectedAttemptCount || receipt.phase === "finished" && receipt.attemptCount !== intent.expectedAttemptCount + 1)) return null;
  if (receipt.canExecute && (!expectedVersion.safeParse(intent.expectedJobVersion).success || receipt.jobVersion !== String(BigInt(intent.expectedJobVersion!) + 1n) ||
    receipt.jobStatus !== "reviewing" || receipt.itemStatus !== "reviewing" || receipt.replayed)) return null;
  return receipt;
}
export function parseArticleTranslationSyncRun(value: unknown, jobId: string, actorId?: string) {
  const parsed = runReceipt.safeParse(value);
  return parsed.success && uuid.safeParse(jobId).success && sameUuid(parsed.data.jobId, jobId) &&
    (actorId === undefined || uuid.safeParse(actorId).success && sameUuid(parsed.data.actorId, actorId)) ? parsed.data : null;
}
function checkedIntent(intent: ArticleTranslationSyncIntent) {
  if (!uuid.safeParse(intent.jobId).success || !uuid.safeParse(intent.itemId).success || !uuid.safeParse(intent.operationId).success ||
    !uuid.safeParse(intent.articleId).success || !expectedVersion.safeParse(intent.expectedJobVersion).success || intent.expectedAttemptCount !== 0 ||
    !hash.safeParse(intent.expectedSourceHash).success || !revision.safeParse(intent.expectedSourceUpdatedAt).success ||
    !revision.nullable().safeParse(intent.expectedEnglishUpdatedAt).success || !provider.safeParse(intent.provider).success ||
    !cursor.safeParse(intent.expectedCursor).success || !cursor.safeParse(intent.resumeCursor).success) throw fault({ code: "22023" }, true);
  try {
    parseArticleWorkingDraft({ article_id: intent.articleId, base_article_updated_at: intent.expectedSourceUpdatedAt, payload: intent.sourceSnapshot,
      english_payload: { mode: "disabled" }, expected_english_updated_at: intent.expectedEnglishUpdatedAt, draft_scope: "bundle", draft_english_enabled: false,
      version: 1, updated_at: intent.expectedSourceUpdatedAt });
    if (new TextEncoder().encode(JSON.stringify(intent.sourceSnapshot)).byteLength > 5_242_880) throw new Error();
  } catch (error) { unstable_rethrow(error); throw fault({ code: "22023" }, true); }
}
export async function beginArticleTranslationSyncItem(client: ArticleTranslationItemRetryClient, intent: ArticleTranslationSyncIntent) {
  checkedIntent(intent);
  const value = await rpc(client, "begin_article_translation_sync_item", { p_job_id: intent.jobId, p_item_id: intent.itemId, p_operation_id: intent.operationId,
    p_article_id: intent.articleId, p_expected_job_version: intent.expectedJobVersion, p_expected_source_hash: intent.expectedSourceHash,
    p_expected_article_updated_at: intent.expectedSourceUpdatedAt, p_expected_english_updated_at: intent.expectedEnglishUpdatedAt,
    p_provider: intent.provider, p_expected_cursor: intent.expectedCursor, p_resume_cursor: intent.resumeCursor, p_expected_source_snapshot: intent.sourceSnapshot });
  const receipt = parseArticleTranslationOrdinaryReceipt(value, intent, "begin"); if (!receipt) throw fault(null, false); return receipt;
}
export async function getArticleTranslationOrdinaryItem(client: ArticleTranslationItemRetryClient, intent: ArticleTranslationOrdinaryTarget) {
  if (!uuid.safeParse(intent.jobId).success || !uuid.safeParse(intent.itemId).success || intent.operationId != null && !uuid.safeParse(intent.operationId).success) throw fault({ code: "22023" }, true);
  const value = await rpc(client, "get_article_translation_item_retry", { p_job_id: intent.jobId, p_item_id: intent.itemId, p_operation_id: intent.operationId ?? null });
  const receipt = parseArticleTranslationOrdinaryReceipt(value, intent); if (!receipt) throw fault(null, false); return receipt;
}
export async function getArticleTranslationOrdinarySelection(client: ArticleTranslationItemRetryClient, target: ArticleTranslationOrdinaryTarget) {
  try { return await getArticleTranslationOrdinaryItem(client, target); }
  catch (error) { unstable_rethrow(error); if (!(error instanceof ArticleTranslationOrdinaryRpcError) || !error.operationNotFound || target.operationId == null) throw error; }
  return getArticleTranslationOrdinaryItem(client, { ...target, operationId: null });
}
export async function beginArticleTranslationOrdinaryFailedRetry(client: ArticleTranslationItemRetryClient, intent: ArticleTranslationItemRetryIntent) {
  if (!uuid.safeParse(intent.jobId).success || !uuid.safeParse(intent.itemId).success || !uuid.safeParse(intent.operationId).success ||
    !expectedVersion.safeParse(intent.expectedJobVersion).success || intent.expectedJobVersion === "0" || !count.max(2).safeParse(intent.expectedAttemptCount).success ||
    !hash.safeParse(intent.expectedSourceHash).success || !revision.safeParse(intent.expectedSourceUpdatedAt).success ||
    !revision.nullable().safeParse(intent.expectedEnglishUpdatedAt).success || !provider.safeParse(intent.provider).success) throw fault({ code: "22023" }, true);
  const value = await rpc(client, "begin_article_translation_item_retry", { p_job_id: intent.jobId, p_item_id: intent.itemId, p_operation_id: intent.operationId,
    p_expected_job_version: intent.expectedJobVersion, p_expected_attempt_count: intent.expectedAttemptCount, p_expected_source_hash: intent.expectedSourceHash,
    p_expected_article_updated_at: intent.expectedSourceUpdatedAt, p_expected_english_updated_at: intent.expectedEnglishUpdatedAt, p_provider: intent.provider });
  const receipt = parseArticleTranslationOrdinaryReceipt(value, intent, "begin"); if (!receipt) throw fault(null, false); return receipt;
}
export async function getArticleTranslationSyncRun(client: ArticleTranslationItemRetryClient, jobId: string, actorId?: string) {
  if (!uuid.safeParse(jobId).success) throw fault({ code: "22023" }, true);
  const value = await rpc(client, "get_article_translation_sync_run", { p_job_id: jobId });
  const run = parseArticleTranslationSyncRun(value, jobId, actorId); if (!run) throw fault(null, false); return run;
}
export async function getArticleTranslationSyncReadiness(client: ArticleTranslationItemRetryClient): Promise<boolean> {
  const value = await rpc(client, "article_translation_sync_ready", {});
  if (typeof value !== "boolean") throw fault(null, false);
  return value;
}
/** Read the actual full saved cursor for the existing atomic empty-tail seal. */
export async function getArticleTranslationSyncCompletionCursor(client: ArticleTranslationItemRetryClient, run: ArticleTranslationSyncRun, actorId: string) {
  if (!parseArticleTranslationSyncRun(run, run.jobId, actorId)) throw fault({ code: "22023" }, true);
  const value = await rpc(client, "get_translation_job_resume", { p_job_id: run.jobId });
  const receipt = z.object({ id: uuid, kind: z.literal("article"), status: jobStatus, resumeCursor: z.record(z.string(), z.unknown()) }).strict().safeParse(value);
  if (!receipt.success || !sameUuid(receipt.data.id, run.jobId) || receipt.data.status !== run.status) throw fault(null, false);
  const { articleOrdinary, ...savedCursor } = receipt.data.resumeCursor;
  const marker = z.object({ version: z.literal(1), actorId: uuid, provider, initialCursorHash: hash, lastCheckpointHash: hash.nullable() }).strict().safeParse(articleOrdinary);
  const expectedScan = decodeArticleTranslationResumeCursor(run.resumeCursor), savedScan = decodeArticleTranslationResumeCursor(savedCursor);
  if (!marker.success || !sameUuid(marker.data.actorId, actorId) || marker.data.provider !== run.provider ||
    !cursor.safeParse(savedCursor).success || expectedScan.kind !== "scan" || savedScan.kind !== "scan" ||
    JSON.stringify(expectedScan.state) !== JSON.stringify(savedScan.state)) throw fault(null, false);
  return receipt.data.resumeCursor;
}
/** Only a confirmed missing ordinary marker plus a real legacy article job establishes its domain. */
export async function getArticleTranslationItemDomain(client: ArticleTranslationItemRetryClient, jobId: string) {
  try { return { kind: "ordinary" as const, run: await getArticleTranslationSyncRun(client, jobId) }; }
  catch (error) { unstable_rethrow(error); if (!(error instanceof ArticleTranslationOrdinaryRpcError) || !error.confirmedRefusal || error.databaseCode !== "P0002") throw error; }
  const value = await rpc(client, "get_translation_job_resume", { p_job_id: jobId });
  const legacy = z.object({ id: uuid, kind: z.literal("article"), resumeCursor: z.record(z.string(), z.unknown()), status: jobStatus }).strict().safeParse(value);
  if (!legacy.success || !sameUuid(legacy.data.id, jobId)) throw fault(null, false);
  return { kind: "legacy" as const, job: legacy.data };
}
export async function checkpointArticleTranslationSyncRun(client: ArticleTranslationItemRetryClient, input: {
  jobId: string; expectedJobVersion: string; expectedCursor: Record<string, unknown>; resumeCursor: Record<string, unknown>;
  observedItems: readonly ArticleTranslationObservedItem[]; provider: "openai" | "cloudflare"; actorId?: string;
}) {
  const observed = z.array(z.object({ entityId: uuid, state: z.enum(["current", "manual", "skipped"]), sourceHash: hash.optional() }).strict()).max(500).safeParse(input.observedItems);
  if (!uuid.safeParse(input.jobId).success || !expectedVersion.safeParse(input.expectedJobVersion).success || !observed.success ||
    !cursor.safeParse(input.expectedCursor).success || !cursor.safeParse(input.resumeCursor).success || !provider.safeParse(input.provider).success) throw fault({ code: "22023" }, true);
  const value = await rpc(client, "checkpoint_article_translation_sync_run", { p_job_id: input.jobId, p_expected_job_version: input.expectedJobVersion,
    p_expected_cursor: input.expectedCursor, p_resume_cursor: input.resumeCursor, p_observed_items: observed.data, p_provider: input.provider });
  const run = parseArticleTranslationSyncRun(value, input.jobId, input.actorId);
  const expectedScan = decodeArticleTranslationResumeCursor(input.resumeCursor), actualScan = run ? decodeArticleTranslationResumeCursor(run.resumeCursor) : null;
  if (!run || (Object.keys(input.resumeCursor).length === 0 ? Object.keys(run.resumeCursor).length !== 0 :
    expectedScan.kind !== "scan" || actualScan?.kind !== "scan" || JSON.stringify(expectedScan.state) !== JSON.stringify(actualScan.state))) throw fault(null, false);
  return run;
}
export async function finishArticleTranslationOrdinaryItem(client: ArticleTranslationItemRetryClient, intent: ArticleTranslationItemRetryIntent,
  outcome: ArticleTranslationItemRetryOutcome, englishEnvelope: unknown = null) {
  const parsed = z.object({ status: outcomeStatus, providerCalls: count.max(4), errorCode: errors.nullable().optional(), model: z.string().min(1).max(200).nullable().optional(),
    requestId: z.string().min(1).max(200).nullable().optional(), inputTokens: count.max(10_000_000).nullable().optional(), outputTokens: count.max(10_000_000).nullable().optional(), durationMs: count.max(3_600_000).nullable().optional() }).strict().safeParse(outcome);
  if (!parsed.success) throw fault({ code: "22023" }, true);
  let payload: unknown = null;
  if (outcome.status === "succeeded") {
    const envelope = z.object({ mode: z.literal("save"), payload: z.record(z.string(), z.unknown()) }).strict().safeParse(englishEnvelope);
    if (!envelope.success || outcome.errorCode != null) throw fault({ code: "22023" }, true);
    try {
      const checked = articleWorkingDraftEnglishEnvelope(envelope.data.payload);
      if (checked.mode !== "save" || checked.payload.status !== "draft" || checked.payload.source_content_hash !== intent.expectedSourceHash ||
        checked.payload.reviewed_at !== null || checked.payload.approved_at !== null || checked.payload.published_at !== null || checked.payload.deleted_at !== null) throw new Error();
      payload = checked;
    } catch (error) { unstable_rethrow(error); throw fault({ code: "22023" }, true); }
  } else if (englishEnvelope !== null) throw fault({ code: "22023" }, true);
  const value = await rpc(client, "finish_article_translation_item_retry", { p_job_id: intent.jobId, p_item_id: intent.itemId, p_operation_id: intent.operationId, p_outcome: parsed.data, p_english_payload: payload });
  const receipt = parseArticleTranslationOrdinaryReceipt(value, intent, "finish");
  if (!receipt || !receipt.result || receipt.result.providerCalls !== outcome.providerCalls || receipt.result.outcome !== outcome.status && receipt.result.outcome !== "cancelled" &&
    !(outcome.status === "succeeded" && receipt.result.persistence === "none" && ["conflict", "stale", "skipped"].includes(receipt.result.outcome))) throw fault(null, false);
  return receipt;
}
export function ordinaryReceiptMatchesCandidate(receipt: ArticleTranslationOrdinaryReceipt, candidate: ArticleTranslationItemRetryCandidate) {
  const result = receipt.result;
  const canonicalRefusal = result?.persistence === "none" && result.workingDraftVersion === null && result.workingDraftUpdatedAt === null &&
    result.humanReview === "unchanged" && (result.outcome === "stale" && result.errorCode === "source_changed" ||
      result.outcome === "conflict" && result.errorCode === "write_conflict");
  return receipt.phase === "finished" && sameUuid(receipt.jobId, candidate.jobId) && sameUuid(receipt.itemId, candidate.itemId) && sameUuid(receipt.articleId, candidate.articleId) &&
    receipt.operationId !== null && sameUuid(receipt.operationId, candidate.operationId) && receipt.sourceHash === candidate.sourceHash && receipt.provider === candidate.provider &&
    sameArticleRetryRevision(receipt.sourceUpdatedAt, candidate.sourceUpdatedAt) && sameArticleRetryRevision(receipt.englishUpdatedAt, candidate.englishUpdatedAt) &&
    receipt.result !== null && receipt.result.providerCalls === candidate.providerCalls && candidate.candidateHash !== null &&
    candidate.workingDraftVersion !== null && candidate.workingDraftUpdatedAt !== null &&
    (["succeeded", "cancelled"].includes(receipt.result.outcome) || canonicalRefusal) &&
    (receipt.result.outcome !== "succeeded" || receipt.result.workingDraftVersion === candidate.workingDraftVersion && sameArticleRetryRevision(receipt.result.workingDraftUpdatedAt, candidate.workingDraftUpdatedAt));
}
/** A known canonical refusal can finish accounting while preserving the intact private candidate. */
export function canFinalizeOrdinaryCandidate(candidate: ArticleTranslationItemRetryCandidate) {
  return candidate.phase === "running" && candidate.candidateState === "staged" && candidate.candidateHash !== null &&
    candidate.workingDraftVersion !== null && candidate.workingDraftUpdatedAt !== null &&
    (candidate.canRecover ? candidate.blockReason === null : candidate.blockReason === "source_changed" || candidate.blockReason === "english_changed");
}
export async function recoverArticleTranslationOrdinaryCandidate(client: ArticleTranslationItemRetryClient, intent: ArticleTranslationItemRetryIntent, candidate: ArticleTranslationItemRetryCandidate) {
  if (!parseArticleTranslationItemRetryCandidate(candidate, intent) || !canFinalizeOrdinaryCandidate(candidate) || candidate.candidateHash === null ||
    candidate.sourceHash !== intent.expectedSourceHash || candidate.provider !== intent.provider ||
    !sameArticleRetryRevision(candidate.sourceUpdatedAt, intent.expectedSourceUpdatedAt) || !sameArticleRetryRevision(candidate.englishUpdatedAt, intent.expectedEnglishUpdatedAt)) throw fault({ code: "22023" }, true);
  const value = await rpc(client, "recover_article_translation_item_retry_candidate", { p_job_id: intent.jobId, p_item_id: intent.itemId, p_operation_id: intent.operationId, p_expected_candidate_hash: candidate.candidateHash });
  const receipt = parseArticleTranslationOrdinaryReceipt(value, intent, "finish"); if (!receipt || !ordinaryReceiptMatchesCandidate(receipt, candidate)) throw fault(null, false); return receipt;
}
