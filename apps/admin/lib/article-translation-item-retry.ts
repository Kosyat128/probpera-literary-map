import { unstable_rethrow } from "next/navigation";
import { z } from "zod";

import { articleWorkingDraftEnglishEnvelope } from "../app/(dashboard)/articles/article-working-draft";
import type { TranslationErrorCode } from "./translation-errors";
import { sameArticleRetryRevision } from "./article-retry-revision";

export type ArticleTranslationItemRetryClient = {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>;
};

const uuid = z.string().uuid();
const sourceHash = z.string().regex(/^[a-f0-9]{64}$/u);
const revision = z.string().datetime({ offset: true });
const counter = z.number().int().nonnegative().safe();
const jobVersion = z.string().regex(/^[1-9][0-9]{0,18}$/u)
  .refine(value => /^[1-9][0-9]{0,18}$/u.test(value) && BigInt(value) <= 9_223_372_036_854_775_807n);
const provider = z.enum(["cloudflare", "openai"]);
const outcomeStatus = z.enum(["succeeded", "dead_letter", "conflict", "stale", "skipped", "not-configured"]);
const retryError = z.enum([
  "translation_not_configured", "provider_unavailable", "provider_request_failed",
  "provider_invalid_response", "source_changed", "write_conflict", "database_read_failed",
  "database_write_failed", "unexpected",
]);
const blockReason = z.enum([
  "source_hash_missing", "item_not_failed", "attempt_limit", "job_not_finished", "job_not_sync",
  "operation_stopped", "retry_busy", "author_draft_exists", "manual_english", "source_unavailable",
  "source_shape_unsupported",
]);
const retryResult = z.object({
  outcome: z.enum([...outcomeStatus.options, "cancelled"]),
  errorCode: retryError.nullable(),
  persistence: z.enum(["working-draft", "none"]),
  workingDraftVersion: counter.positive().nullable(),
  workingDraftUpdatedAt: revision.nullable(),
  publication: z.literal("unchanged"),
  humanReview: z.enum(["pending", "unchanged"]),
  providerCalls: counter.max(4),
}).strict().superRefine((value, context) => {
  const draft = value.persistence === "working-draft";
  if (draft !== (value.outcome === "succeeded") ||
    draft !== (value.workingDraftVersion !== null && value.workingDraftUpdatedAt !== null) ||
    !draft && (value.workingDraftVersion !== null || value.workingDraftUpdatedAt !== null) ||
    value.humanReview !== (draft ? "pending" : "unchanged") ||
    value.outcome === "succeeded" && value.errorCode !== null ||
    ["dead_letter", "conflict", "stale", "not-configured"].includes(value.outcome) && value.errorCode === null) {
    context.addIssue({ code: "custom", message: "Invalid private retry result" });
  }
});
const receiptSchema = z.object({
  version: z.literal(1),
  jobId: uuid,
  itemId: uuid,
  articleId: uuid,
  provider,
  sourceHash: sourceHash.nullable(),
  sourceUpdatedAt: revision.nullable(),
  englishUpdatedAt: revision.nullable(),
  jobVersion,
  attemptCount: counter.max(10),
  maxAttempts: counter.min(1).max(5),
  jobStatus: z.enum(["queued", "running", "reviewing", "cancelling", "completed", "partial", "failed", "conflict", "stale", "skipped", "not-configured", "cancelled"]),
  itemStatus: z.enum(["queued", "leased", "reviewing", "retry_wait", "succeeded", "conflict", "stale", "skipped", "not-configured", "dead_letter", "cancelled"]),
  operationId: uuid.nullable(),
  phase: z.enum(["ready", "running", "finished", "blocked"]),
  canExecute: z.boolean(),
  replayed: z.boolean(),
  retryable: z.boolean(),
  blockReason: blockReason.nullable(),
  result: retryResult.nullable(),
}).strict().superRefine((value, context) => {
  const invalid = value.phase === "ready"
    ? value.operationId !== null || value.canExecute || value.replayed || !value.retryable ||
      value.blockReason !== null || value.result !== null || value.sourceHash === null || value.sourceUpdatedAt === null ||
      !["completed", "partial", "failed", "conflict", "stale", "skipped", "not-configured"].includes(value.jobStatus) ||
      !["dead_letter", "conflict", "stale", "not-configured"].includes(value.itemStatus) ||
      value.attemptCount >= 5 || value.attemptCount > value.maxAttempts
    : value.phase === "running"
      ? value.operationId === null || value.sourceHash === null || value.sourceUpdatedAt === null ||
        value.retryable || value.blockReason !== null || value.result !== null || value.canExecute && value.replayed ||
        value.itemStatus !== "reviewing" || !["reviewing", "cancelled", "cancelling"].includes(value.jobStatus) ||
        value.attemptCount >= 5 || value.maxAttempts !== value.attemptCount + 1
      : value.phase === "finished"
        ? value.operationId === null || value.sourceHash === null || value.sourceUpdatedAt === null ||
          value.canExecute || value.retryable || value.blockReason !== null || value.result === null ||
          value.attemptCount < 1 || value.attemptCount > 5 || value.attemptCount !== value.maxAttempts ||
          value.itemStatus !== value.result?.outcome ||
          !["completed", "partial", "failed", "conflict", "stale", "skipped", "not-configured", "cancelled"].includes(value.jobStatus)
        : value.canExecute || value.retryable || value.blockReason === null || value.result !== null;
  if (invalid) context.addIssue({ code: "custom", message: "Invalid private retry receipt" });
});

export type ArticleTranslationItemRetryReceipt = z.infer<typeof receiptSchema>;
export type ArticleTranslationItemRetryOutcome = {
  status: z.infer<typeof outcomeStatus>;
  providerCalls: number;
  errorCode?: z.infer<typeof retryError> | null;
  model?: string | null;
  requestId?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  durationMs?: number | null;
};
export type ArticleTranslationItemRetryTarget = { jobId: string; itemId: string; operationId?: string | null; articleId?: string };
export type ArticleTranslationItemRetryIntent = {
  jobId: string;
  itemId: string;
  operationId: string;
  articleId?: string;
  expectedJobVersion: string;
  expectedAttemptCount: number;
  expectedSourceHash: string;
  expectedSourceUpdatedAt: string;
  expectedEnglishUpdatedAt: string | null;
  provider: "cloudflare" | "openai";
};

export class ArticleTranslationItemRetryRpcError extends Error {
  constructor(readonly errorCode: TranslationErrorCode, readonly operationNotFound = false) {
    super("Article item retry could not be confirmed");
    this.name = "ArticleTranslationItemRetryRpcError";
  }
}

function sameUuid(left: string, right: string) {
  return left.toLowerCase() === right.toLowerCase();
}

export function parseArticleTranslationItemRetryReceipt(
  value: unknown,
  target: ArticleTranslationItemRetryTarget,
  boundary: "get" | "begin" | "finish" = "get",
): ArticleTranslationItemRetryReceipt | null {
  const parsed = receiptSchema.safeParse(value);
  if (!parsed.success || !uuid.safeParse(target.jobId).success || !uuid.safeParse(target.itemId).success ||
    target.operationId != null && !uuid.safeParse(target.operationId).success ||
    target.articleId !== undefined && !uuid.safeParse(target.articleId).success) return null;
  const receipt = parsed.data;
  if (!sameUuid(receipt.jobId, target.jobId) || !sameUuid(receipt.itemId, target.itemId) ||
    target.articleId !== undefined && !sameUuid(receipt.articleId, target.articleId) ||
    target.operationId != null && receipt.operationId !== null && !sameUuid(receipt.operationId, target.operationId) ||
    boundary !== "begin" && receipt.canExecute ||
    boundary === "begin" && (receipt.phase !== "running" && receipt.phase !== "finished") ||
    boundary === "finish" && receipt.phase !== "finished") return null;
  return receipt;
}

function rpcFault(error: unknown, confirmed: boolean, specificOperationLookup = false): ArticleTranslationItemRetryRpcError {
  const code = error && typeof error === "object" && "code" in error ? error.code : null;
  return new ArticleTranslationItemRetryRpcError(!confirmed ? "translation_retry_unconfirmed"
    : code === "42883" || code === "PGRST202" ? "translation_migration_required"
    : code === "42501" ? "translation_operation_stopped"
    : code === "40001" ? "write_conflict"
    : code === "22023" ? "invalid_input"
    : code === "P0002" ? "database_read_failed" : "translation_retry_unconfirmed",
  confirmed && specificOperationLookup && code === "P0002");
}

async function callRetryRpc(
  supabase: ArticleTranslationItemRetryClient,
  name: string,
  args: Record<string, unknown>,
  target: ArticleTranslationItemRetryTarget,
  boundary: "get" | "begin" | "finish",
) {
  let response;
  try {
    response = await supabase.rpc(name, args);
  } catch (error) {
    unstable_rethrow(error);
    throw rpcFault(error, false);
  }
  if (!response || typeof response !== "object" || Array.isArray(response) ||
    !Object.hasOwn(response, "data") || !Object.hasOwn(response, "error")) throw rpcFault(null, false);
  unstable_rethrow(response.error);
  if (response.error !== null) throw rpcFault(response.error, response.data === null,
    boundary === "get" && target.operationId != null);
  const receipt = parseArticleTranslationItemRetryReceipt(response.data, target, boundary);
  if (!receipt) throw rpcFault(null, false);
  return receipt;
}

export async function getArticleTranslationItemRetry(
  supabase: ArticleTranslationItemRetryClient,
  target: ArticleTranslationItemRetryTarget,
) {
  if (!uuid.safeParse(target.jobId).success || !uuid.safeParse(target.itemId).success ||
    target.operationId != null && !uuid.safeParse(target.operationId).success) throw rpcFault({ code: "22023" }, true);
  return callRetryRpc(supabase, "get_article_translation_item_retry", {
    p_job_id: target.jobId,
    p_item_id: target.itemId,
    p_operation_id: target.operationId ?? null,
  }, target, "get");
}

/** Resolve an explicit selection without turning an unknown read into admission.
 * A new form UUID has no operation receipt yet. Only the server's confirmed
 * missing lookup allows a separate, strictly validated read of the item.
 */
export async function getArticleTranslationItemRetrySelection(
  supabase: ArticleTranslationItemRetryClient,
  target: ArticleTranslationItemRetryTarget,
) {
  try {
    return await getArticleTranslationItemRetry(supabase, target);
  } catch (error) {
    unstable_rethrow(error);
    if (!(error instanceof ArticleTranslationItemRetryRpcError) ||
      !error.operationNotFound || target.operationId == null) throw error;
  }
  return getArticleTranslationItemRetry(supabase, { ...target, operationId: null });
}

export async function beginArticleTranslationItemRetry(
  supabase: ArticleTranslationItemRetryClient,
  intent: ArticleTranslationItemRetryIntent,
) {
  if (!uuid.safeParse(intent.jobId).success || !uuid.safeParse(intent.itemId).success ||
    !uuid.safeParse(intent.operationId).success || !jobVersion.safeParse(intent.expectedJobVersion).success ||
    BigInt(intent.expectedJobVersion) > 9_223_372_036_854_775_805n ||
    !counter.max(4).safeParse(intent.expectedAttemptCount).success || !sourceHash.safeParse(intent.expectedSourceHash).success ||
    !revision.safeParse(intent.expectedSourceUpdatedAt).success || !revision.nullable().safeParse(intent.expectedEnglishUpdatedAt).success ||
    !provider.safeParse(intent.provider).success) throw rpcFault({ code: "22023" }, true);
  const receipt = await callRetryRpc(supabase, "begin_article_translation_item_retry", {
    p_job_id: intent.jobId,
    p_item_id: intent.itemId,
    p_operation_id: intent.operationId,
    p_expected_job_version: intent.expectedJobVersion,
    p_expected_attempt_count: intent.expectedAttemptCount,
    p_expected_source_hash: intent.expectedSourceHash,
    p_expected_article_updated_at: intent.expectedSourceUpdatedAt,
    p_expected_english_updated_at: intent.expectedEnglishUpdatedAt,
    p_provider: intent.provider,
  }, intent, "begin");
  if (receipt.sourceHash !== intent.expectedSourceHash || receipt.sourceUpdatedAt !== intent.expectedSourceUpdatedAt ||
    receipt.englishUpdatedAt !== intent.expectedEnglishUpdatedAt || receipt.provider !== intent.provider ||
    receipt.operationId === null || receipt.canExecute && (receipt.attemptCount !== intent.expectedAttemptCount ||
      receipt.jobVersion !== String(BigInt(intent.expectedJobVersion) + 1n) || receipt.jobStatus !== "reviewing" ||
      receipt.itemStatus !== "reviewing" || receipt.maxAttempts !== intent.expectedAttemptCount + 1)) throw rpcFault(null, false);
  return receipt;
}

export async function finishArticleTranslationItemRetry(
  supabase: ArticleTranslationItemRetryClient,
  intent: ArticleTranslationItemRetryIntent,
  outcome: ArticleTranslationItemRetryOutcome,
  englishEnvelope: unknown = null,
) {
  const parsed = z.object({
    status: outcomeStatus,
    providerCalls: counter.max(4),
    errorCode: retryError.nullable().optional(),
    model: z.string().min(1).max(200).nullable().optional(),
    requestId: z.string().min(1).max(200).nullable().optional(),
    inputTokens: counter.max(10_000_000).nullable().optional(),
    outputTokens: counter.max(10_000_000).nullable().optional(),
    durationMs: counter.max(3_600_000).nullable().optional(),
  }).strict().safeParse(outcome);
  if (!parsed.success || !uuid.safeParse(intent.operationId).success ||
    !uuid.safeParse(intent.jobId).success || !uuid.safeParse(intent.itemId).success ||
    outcome.status === "succeeded" && outcome.errorCode != null) throw rpcFault({ code: "22023" }, true);
  let payload = null;
  if (outcome.status === "succeeded") {
    const envelope = z.object({ mode: z.literal("save"), payload: z.record(z.string(), z.unknown()) }).strict().safeParse(englishEnvelope);
    if (!envelope.success) throw rpcFault({ code: "22023" }, true);
    try {
      payload = articleWorkingDraftEnglishEnvelope(envelope.data.payload);
    } catch (error) {
      unstable_rethrow(error);
      throw rpcFault({ code: "22023" }, true);
    }
    if (payload.mode !== "save" || payload.payload.status !== "draft" ||
      payload.payload.source_content_hash !== intent.expectedSourceHash ||
      payload.payload.reviewed_at !== null || payload.payload.approved_at !== null ||
      payload.payload.published_at !== null || payload.payload.deleted_at !== null) throw rpcFault({ code: "22023" }, true);
  } else if (englishEnvelope !== null) throw rpcFault({ code: "22023" }, true);
  const receipt = await callRetryRpc(supabase, "finish_article_translation_item_retry", {
    p_job_id: intent.jobId,
    p_item_id: intent.itemId,
    p_operation_id: intent.operationId,
    p_outcome: parsed.data,
    p_english_payload: payload,
  }, intent, "finish");
  if (receipt.operationId === null || receipt.sourceHash !== intent.expectedSourceHash ||
    receipt.sourceUpdatedAt !== intent.expectedSourceUpdatedAt || receipt.englishUpdatedAt !== intent.expectedEnglishUpdatedAt ||
    receipt.provider !== intent.provider || receipt.attemptCount !== intent.expectedAttemptCount + 1 ||
    receipt.result === null || receipt.result.providerCalls !== outcome.providerCalls ||
    receipt.result.outcome !== outcome.status && receipt.result.outcome !== "cancelled" &&
      !(outcome.status === "succeeded" && receipt.result.persistence === "none" &&
        ["conflict", "stale", "skipped"].includes(receipt.result.outcome))) throw rpcFault(null, false);
  return receipt;
}

const providerCall = z.object({
  callId: uuid,
  provider,
  model: z.string().min(1).max(200),
  pass: z.enum(["translation", "repair", "review"]),
  dispatchRecordedAt: revision,
  responseReceivedAt: revision.nullable(),
  httpStatus: z.number().int().min(100).max(599).nullable(),
  requestId: z.string().min(1).max(200).nullable(),
  responseId: z.string().min(1).max(200).nullable(),
  inputTokens: counter.max(10_000_000).nullable(),
  outputTokens: counter.max(10_000_000).nullable(),
}).strict();
const providerProgress = z.object({
  version: z.literal(1),
  jobId: uuid,
  itemId: uuid,
  articleId: uuid,
  operationId: uuid,
  provider,
  phase: z.enum(["running", "finished"]),
  startedAt: revision.nullable(),
  updatedAt: revision,
  providerCalls: counter.max(4),
  canDispatch: z.boolean(),
  replayed: z.boolean(),
  calls: z.array(providerCall).max(4),
}).strict().superRefine((value, context) => {
  if (value.providerCalls !== value.calls.length ||
    new Set(value.calls.map(call => call.callId.toLowerCase())).size !== value.calls.length ||
    value.calls.some(call => call.provider !== value.provider) ||
    value.calls.length > 0 && value.startedAt === null ||
    value.calls.some((call, index) => call.responseReceivedAt === null &&
      (index !== value.calls.length - 1 || call.httpStatus !== null || call.requestId !== null ||
        call.responseId !== null || call.inputTokens !== null || call.outputTokens !== null)) ||
    value.canDispatch && (value.phase !== "running" || value.replayed || value.calls.length === 0 ||
      value.calls.at(-1)?.responseReceivedAt !== null)) {
    context.addIssue({ code: "custom", message: "Invalid article retry provider progress" });
  }
});
export type ArticleTranslationItemRetryProgress = z.infer<typeof providerProgress>;
export type ArticleTranslationItemRetryDispatch = Pick<z.infer<typeof providerCall>, "callId" | "provider" | "model" | "pass">;
export type ArticleTranslationItemRetryResponse = ArticleTranslationItemRetryDispatch &
  Pick<z.infer<typeof providerCall>, "httpStatus" | "requestId" | "responseId" | "inputTokens" | "outputTokens">;

/** Admission metadata records an intent to send, never provider acceptance. */
export function parseArticleTranslationItemRetryProgress(
  value: unknown,
  target: ArticleTranslationItemRetryTarget,
  boundary: "get" | "dispatch" | "response" = "get",
) {
  const parsed = providerProgress.safeParse(value);
  if (!parsed.success || !uuid.safeParse(target.jobId).success || !uuid.safeParse(target.itemId).success ||
    !uuid.safeParse(target.operationId).success ||
    target.articleId !== undefined && !uuid.safeParse(target.articleId).success) return null;
  const progress = parsed.data;
  if (!sameUuid(progress.jobId, target.jobId) || !sameUuid(progress.itemId, target.itemId) ||
    !sameUuid(progress.operationId, target.operationId!) ||
    target.articleId !== undefined && !sameUuid(progress.articleId, target.articleId) ||
    boundary !== "dispatch" && progress.canDispatch) return null;
  return progress;
}

async function callProgressRpc(
  supabase: ArticleTranslationItemRetryClient,
  name: string,
  args: Record<string, unknown>,
  target: ArticleTranslationItemRetryTarget,
  boundary: "get" | "dispatch" | "response",
) {
  if (!uuid.safeParse(target.jobId).success || !uuid.safeParse(target.itemId).success ||
    !uuid.safeParse(target.operationId).success) throw rpcFault({ code: "22023" }, true);
  let response;
  try {
    response = await supabase.rpc(name, args);
  } catch (error) {
    unstable_rethrow(error);
    throw rpcFault(error, false);
  }
  if (!response || typeof response !== "object" || Array.isArray(response) ||
    !Object.hasOwn(response, "data") || !Object.hasOwn(response, "error")) throw rpcFault(null, false);
  unstable_rethrow(response.error);
  if (response.error !== null) throw rpcFault(response.error, response.data === null);
  const progress = parseArticleTranslationItemRetryProgress(response.data, target, boundary);
  if (!progress) throw rpcFault(null, false);
  return progress;
}

export async function getArticleTranslationItemRetryProgress(
  supabase: ArticleTranslationItemRetryClient,
  target: ArticleTranslationItemRetryTarget,
) {
  return callProgressRpc(supabase, "get_article_translation_item_retry_progress", {
    p_job_id: target.jobId, p_item_id: target.itemId, p_operation_id: target.operationId,
  }, target, "get");
}

export async function recordArticleTranslationItemRetryDispatch(
  supabase: ArticleTranslationItemRetryClient,
  target: ArticleTranslationItemRetryTarget,
  dispatch: ArticleTranslationItemRetryDispatch,
) {
  const valid = providerCall.pick({ callId: true, provider: true, model: true, pass: true }).safeParse(dispatch);
  if (!valid.success) throw rpcFault({ code: "22023" }, true);
  const progress = await callProgressRpc(supabase, "record_article_translation_item_retry_dispatch", {
    p_job_id: target.jobId, p_item_id: target.itemId, p_operation_id: target.operationId,
    p_call_id: dispatch.callId, p_provider: dispatch.provider, p_model: dispatch.model, p_pass: dispatch.pass,
  }, target, "dispatch");
  const call = progress.calls.find(row => sameUuid(row.callId, dispatch.callId));
  if (!call || call.provider !== dispatch.provider || call.model !== dispatch.model || call.pass !== dispatch.pass ||
    progress.canDispatch && (!sameUuid(progress.calls.at(-1)!.callId, dispatch.callId) || call.responseReceivedAt !== null)) {
    throw rpcFault(null, false);
  }
  return progress;
}

export async function recordArticleTranslationItemRetryResponse(
  supabase: ArticleTranslationItemRetryClient,
  target: ArticleTranslationItemRetryTarget,
  metadata: ArticleTranslationItemRetryResponse,
) {
  const valid = providerCall.omit({ dispatchRecordedAt: true, responseReceivedAt: true }).safeParse(metadata);
  if (!valid.success) throw rpcFault({ code: "22023" }, true);
  const progress = await callProgressRpc(supabase, "record_article_translation_item_retry_response", {
    p_job_id: target.jobId, p_item_id: target.itemId, p_operation_id: target.operationId, p_metadata: valid.data,
  }, target, "response");
  const call = progress.calls.find(row => sameUuid(row.callId, metadata.callId));
  if (!call || call.responseReceivedAt === null || Object.entries(valid.data).some(([key, value]) =>
    key === "callId" ? !sameUuid(call.callId, value as string) : call[key as keyof typeof call] !== value)) {
    throw rpcFault(null, false);
  }
  return progress;
}

const candidateBlockReason = z.enum([
  "candidate_missing", "source_changed", "english_changed", "draft_changed", "draft_missing",
  "provider_outcome_unconfirmed",
]);
const retryCandidate = z.object({
  version: z.literal(1),
  jobId: uuid, itemId: uuid, articleId: uuid, operationId: uuid,
  provider,
  sourceHash,
  sourceUpdatedAt: revision,
  englishUpdatedAt: revision.nullable(),
  phase: z.enum(["running", "finished"]),
  candidateState: z.enum(["missing", "staged", "finished"]),
  candidateHash: sourceHash.nullable(),
  preparedAt: revision.nullable(),
  workingDraftVersion: counter.positive().nullable(),
  workingDraftUpdatedAt: revision.nullable(),
  providerCalls: counter.max(4),
  canRecover: z.boolean(),
  replayed: z.boolean(),
  blockReason: candidateBlockReason.nullable(),
}).strict().superRefine((value, context) => {
  const missing = value.candidateState === "missing";
  const absent = [value.candidateHash, value.preparedAt, value.workingDraftVersion,
    value.workingDraftUpdatedAt].every(field => field === null);
  const complete = [value.candidateHash, value.preparedAt, value.workingDraftVersion,
    value.workingDraftUpdatedAt].every(field => field !== null);
  if (missing && (!absent || value.canRecover || value.blockReason !== "candidate_missing") ||
    !missing && (!complete || value.providerCalls === 0 || value.blockReason === "candidate_missing") ||
    value.candidateState === "staged" && value.phase !== "running" ||
    value.candidateState === "finished" && value.phase !== "finished" ||
    value.phase === "finished" && (value.canRecover || !value.replayed) ||
    value.canRecover !== (value.candidateState === "staged" && value.blockReason === null)) {
    context.addIssue({ code: "custom", message: "Invalid article retry candidate state" });
  }
});
export type ArticleTranslationItemRetryCandidate = z.infer<typeof retryCandidate>;

/** Metadata can offer bookkeeping recovery; it never authorises generation. */
export function parseArticleTranslationItemRetryCandidate(value: unknown, target: ArticleTranslationItemRetryTarget) {
  const parsed = retryCandidate.safeParse(value);
  if (!parsed.success || !uuid.safeParse(target.jobId).success || !uuid.safeParse(target.itemId).success ||
    !uuid.safeParse(target.operationId).success ||
    target.articleId !== undefined && !uuid.safeParse(target.articleId).success) return null;
  const candidate = parsed.data;
  if (!sameUuid(candidate.jobId, target.jobId) || !sameUuid(candidate.itemId, target.itemId) ||
    !sameUuid(candidate.operationId, target.operationId!) ||
    target.articleId !== undefined && !sameUuid(candidate.articleId, target.articleId)) return null;
  return candidate;
}

/** A finished receipt confirms only the original stored candidate revision. */
export function parseArticleTranslationItemRetryCandidateReceipt(
  value: unknown,
  target: ArticleTranslationItemRetryTarget,
  expectedCandidate: unknown,
): ArticleTranslationItemRetryReceipt | null {
  const candidate = parseArticleTranslationItemRetryCandidate(expectedCandidate, target);
  if (!candidate || candidate.candidateState === "missing") return null;
  const receipt = parseArticleTranslationItemRetryReceipt(value, { ...target, articleId: candidate.articleId }, "finish");
  if (!receipt || receipt.sourceHash !== candidate.sourceHash ||
    !sameArticleRetryRevision(receipt.sourceUpdatedAt, candidate.sourceUpdatedAt) ||
    !sameArticleRetryRevision(receipt.englishUpdatedAt, candidate.englishUpdatedAt) ||
    receipt.provider !== candidate.provider || receipt.result === null ||
    receipt.result.providerCalls !== candidate.providerCalls ||
    !["succeeded", "cancelled"].includes(receipt.result.outcome) ||
    receipt.result.outcome === "succeeded" &&
      (receipt.result.workingDraftVersion !== candidate.workingDraftVersion ||
        !sameArticleRetryRevision(receipt.result.workingDraftUpdatedAt, candidate.workingDraftUpdatedAt))) return null;
  return receipt;
}

async function callCandidateRpc(
  supabase: ArticleTranslationItemRetryClient,
  name: string,
  args: Record<string, unknown>,
  target: ArticleTranslationItemRetryTarget,
) {
  if (!uuid.safeParse(target.jobId).success || !uuid.safeParse(target.itemId).success ||
    !uuid.safeParse(target.operationId).success) throw rpcFault({ code: "22023" }, true);
  let response;
  try {
    response = await supabase.rpc(name, args);
  } catch (error) {
    unstable_rethrow(error);
    throw rpcFault(error, false);
  }
  if (!response || typeof response !== "object" || Array.isArray(response) ||
    !Object.hasOwn(response, "data") || !Object.hasOwn(response, "error")) throw rpcFault(null, false);
  unstable_rethrow(response.error);
  if (response.error !== null) throw rpcFault(response.error, response.data === null);
  const candidate = parseArticleTranslationItemRetryCandidate(response.data, target);
  if (!candidate) throw rpcFault(null, false);
  return candidate;
}

export function getArticleTranslationItemRetryCandidate(
  supabase: ArticleTranslationItemRetryClient,
  target: ArticleTranslationItemRetryTarget,
) {
  return callCandidateRpc(supabase, "get_article_translation_item_retry_candidate", {
    p_job_id: target.jobId, p_item_id: target.itemId, p_operation_id: target.operationId,
  }, target);
}

export async function stageArticleTranslationItemRetryCandidate(
  supabase: ArticleTranslationItemRetryClient,
  intent: ArticleTranslationItemRetryIntent,
  outcome: ArticleTranslationItemRetryOutcome,
  englishEnvelope: unknown,
) {
  const parsed = z.object({
    status: z.literal("succeeded"),
    providerCalls: counter.min(1).max(4),
    errorCode: z.null().optional(),
    model: z.string().min(1).max(200).nullable().optional(),
    requestId: z.string().min(1).max(200).nullable().optional(),
    inputTokens: counter.max(10_000_000).nullable().optional(),
    outputTokens: counter.max(10_000_000).nullable().optional(),
    durationMs: counter.max(3_600_000).nullable().optional(),
  }).strict().safeParse(outcome);
  const envelope = z.object({ mode: z.literal("save"), payload: z.record(z.string(), z.unknown()) })
    .strict().safeParse(englishEnvelope);
  if (!parsed.success || !envelope.success || !sourceHash.safeParse(intent.expectedSourceHash).success ||
    !revision.safeParse(intent.expectedSourceUpdatedAt).success ||
    !revision.nullable().safeParse(intent.expectedEnglishUpdatedAt).success ||
    !provider.safeParse(intent.provider).success) throw rpcFault({ code: "22023" }, true);
  let payload;
  try {
    payload = articleWorkingDraftEnglishEnvelope(envelope.data.payload);
  } catch (error) {
    unstable_rethrow(error);
    throw rpcFault({ code: "22023" }, true);
  }
  if (payload.mode !== "save" || payload.payload.status !== "draft" ||
    payload.payload.source_content_hash !== intent.expectedSourceHash ||
    payload.payload.reviewed_at !== null || payload.payload.approved_at !== null ||
    payload.payload.published_at !== null || payload.payload.deleted_at !== null) throw rpcFault({ code: "22023" }, true);
  const candidate = await callCandidateRpc(supabase, "stage_article_translation_item_retry_candidate", {
    p_job_id: intent.jobId, p_item_id: intent.itemId, p_operation_id: intent.operationId,
    p_outcome: parsed.data, p_english_payload: payload,
  }, intent);
  if (candidate.candidateState === "missing" || candidate.sourceHash !== intent.expectedSourceHash ||
    !sameArticleRetryRevision(candidate.sourceUpdatedAt, intent.expectedSourceUpdatedAt) ||
    !sameArticleRetryRevision(candidate.englishUpdatedAt, intent.expectedEnglishUpdatedAt) ||
    candidate.provider !== intent.provider || candidate.providerCalls !== outcome.providerCalls) throw rpcFault(null, false);
  return candidate;
}

export async function recoverArticleTranslationItemRetryCandidate(
  supabase: ArticleTranslationItemRetryClient,
  target: ArticleTranslationItemRetryTarget,
  expectedCandidate: ArticleTranslationItemRetryCandidate,
) {
  const candidate = parseArticleTranslationItemRetryCandidate(expectedCandidate, target);
  if (!candidate || candidate.candidateState !== "staged" || !candidate.canRecover || candidate.candidateHash === null) {
    throw rpcFault({ code: "22023" }, true);
  }
  const receipt = await callRetryRpc(supabase, "recover_article_translation_item_retry_candidate", {
    p_job_id: target.jobId, p_item_id: target.itemId, p_operation_id: target.operationId,
    p_expected_candidate_hash: candidate.candidateHash,
  }, target, "finish");
  const confirmed = parseArticleTranslationItemRetryCandidateReceipt(receipt, target, candidate);
  if (!confirmed) throw rpcFault(null, false);
  return confirmed;
}
