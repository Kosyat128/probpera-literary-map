"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";

import {
  ArticleTranslationItemRetryRpcError,
  beginArticleTranslationItemRetry,
  finishArticleTranslationItemRetry,
  getArticleTranslationItemRetry,
  getArticleTranslationItemRetrySelection,
  getArticleTranslationItemRetryCandidate,
  stageArticleTranslationItemRetryCandidate,
  recoverArticleTranslationItemRetryCandidate,
  parseArticleTranslationItemRetryCandidateReceipt,
  recordArticleTranslationItemRetryDispatch,
  recordArticleTranslationItemRetryResponse,
  type ArticleTranslationItemRetryIntent,
  type ArticleTranslationItemRetryOutcome,
  type ArticleTranslationItemRetryReceipt,
  type ArticleTranslationItemRetryProgress,
  type ArticleTranslationItemRetryCandidate,
  type ArticleTranslationItemRetryTarget,
} from "@/lib/article-translation-item-retry";
import { sameArticleRetryRevision } from "@/lib/article-retry-revision";
import {
  ArticleTranslationOrdinaryRpcError,
  beginArticleTranslationOrdinaryFailedRetry,
  canFinalizeOrdinaryCandidate,
  finishArticleTranslationOrdinaryItem,
  getArticleTranslationItemDomain,
  getArticleTranslationOrdinaryItem,
  getArticleTranslationOrdinarySelection,
  ordinaryReceiptMatchesCandidate,
  parseArticleTranslationOrdinaryReceipt,
  recoverArticleTranslationOrdinaryCandidate,
  type ArticleTranslationOrdinaryReceipt,
} from "@/lib/article-translation-ordinary-rpc";
import { ensurePublishedArticlePremiumEnglish } from "@/lib/auto-translate-published-article-premium";
import { requireStaff } from "@/lib/auth";
import { redirect } from "@/lib/navigation";
import { premiumTranslationRuntimeMetadata } from "@/lib/premium-translation-runtime";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createTranslationOperationBudget } from "@/lib/translation-operation-budget";
import { translationErrorCode, type TranslationErrorCode } from "@/lib/translation-errors";
import { premiumTranslationRuntimeGate } from "@/lib/translation-runtime-gate";

const submittedIntent = z.object({
  job_id: z.string().uuid(),
  item_id: z.string().uuid(),
  operation_id: z.string().uuid(),
  expected_job_version: z.string().regex(/^[1-9][0-9]{0,18}$/u)
    .refine(value => /^[1-9][0-9]{0,18}$/u.test(value) && BigInt(value) <= 9_223_372_036_854_775_807n),
  expected_attempt_count: z.string().regex(/^[0-4]$/u),
  source_hash: z.string().regex(/^[a-f0-9]{64}$/u),
}).strict();

function retryUrl(target: { jobId: string; itemId: string; operationId: string }, errorCode?: TranslationErrorCode) {
  const query = new URLSearchParams({ retryJob: target.jobId, retryItem: target.itemId, retryOperation: target.operationId });
  if (errorCode) query.set("errorCode", errorCode);
  return `/translations?${query}`;
}

type TranslationItemReceipt = ArticleTranslationItemRetryReceipt | ArticleTranslationOrdinaryReceipt;

function candidateReceipt(value: unknown, target: ArticleTranslationItemRetryTarget,
  candidate: ArticleTranslationItemRetryCandidate, ordinary: boolean): TranslationItemReceipt | null {
  if (!ordinary) return parseArticleTranslationItemRetryCandidateReceipt(value, target, candidate);
  const receipt = parseArticleTranslationOrdinaryReceipt(value, target, "finish");
  return receipt && ordinaryReceiptMatchesCandidate(receipt, candidate) ? receipt : null;
}

function receiptError(receipt: TranslationItemReceipt): TranslationErrorCode | undefined {
  if (receipt.phase === "finished") {
    if (receipt.result?.outcome === "succeeded" && receipt.result.persistence === "working-draft") return undefined;
    if (receipt.result?.outcome === "cancelled") return "translation_operation_stopped";
    return receipt.result?.errorCode || "translation_retry_blocked";
  }
  return receipt.phase === "blocked" ? "translation_retry_blocked" : "translation_retry_unconfirmed";
}

/** A read receipt never grants a second provider invocation. */
export async function retryArticleTranslationItemAction(formData: FormData) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  const fieldNames = ["job_id", "item_id", "operation_id", "expected_job_version", "expected_attempt_count", "source_hash"] as const;
  if (fieldNames.some(name => formData.getAll(name).length !== 1)) redirect("/translations?errorCode=invalid_input");
  const parsed = submittedIntent.safeParse(Object.fromEntries(fieldNames.map(name => [name, formData.get(name)])));
  if (!parsed.success) redirect("/translations?errorCode=invalid_input");
  const form = parsed.data;
  const target = { jobId: form.job_id, itemId: form.item_id, operationId: form.operation_id };
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect(retryUrl(target, "database_unavailable"));

  let latestReceipt: TranslationItemReceipt;
  let ordinary = false;
  try {
    ordinary = (await getArticleTranslationItemDomain(supabase, target.jobId)).kind === "ordinary";
    latestReceipt = ordinary ? await getArticleTranslationOrdinarySelection(supabase, target)
      : await getArticleTranslationItemRetrySelection(supabase, target);
  } catch (error) {
    unstable_rethrow(error);
    redirect(retryUrl(target, error instanceof ArticleTranslationItemRetryRpcError || error instanceof ArticleTranslationOrdinaryRpcError
      ? error.errorCode : "translation_retry_unconfirmed"));
  }
  if (latestReceipt.phase !== "ready") redirect(retryUrl(target, receiptError(latestReceipt)));
  if (!latestReceipt.retryable || latestReceipt.sourceHash === null || latestReceipt.sourceUpdatedAt === null ||
    latestReceipt.jobVersion !== form.expected_job_version ||
    latestReceipt.attemptCount !== Number(form.expected_attempt_count) || latestReceipt.sourceHash !== form.source_hash) {
    redirect(retryUrl(target, "write_conflict"));
  }
  const runtime = premiumTranslationRuntimeMetadata();
  if (runtime.provider !== latestReceipt.provider) redirect(retryUrl(target, "translation_not_configured"));
  try {
    if (!(await premiumTranslationRuntimeGate(supabase))) redirect(retryUrl(target, "translation_not_configured"));
  } catch (error) {
    unstable_rethrow(error);
    redirect(retryUrl(target, "translation_retry_blocked"));
  }

  const intent: ArticleTranslationItemRetryIntent = {
    ...target,
    articleId: latestReceipt.articleId,
    expectedJobVersion: form.expected_job_version,
    expectedAttemptCount: Number(form.expected_attempt_count),
    expectedSourceHash: form.source_hash,
    expectedSourceUpdatedAt: latestReceipt.sourceUpdatedAt,
    expectedEnglishUpdatedAt: latestReceipt.englishUpdatedAt,
    provider: runtime.provider,
  };
  const budget = createTranslationOperationBudget({ maxAttempts: 1, maxProviderCalls: 4, deadlineMs: 300_000 });
  let admitted = false;
  let finishAttempted = false;
  let stoppedBeforeDispatch = false;
  let conflictBeforeDispatch = false;
  let acknowledgedProgress: ArticleTranslationItemRetryProgress | null = null;
  let preparedRequest: { outcome: ArticleTranslationItemRetryOutcome; englishEnvelope: unknown;
    candidate: ArticleTranslationItemRetryCandidate } | null = null;
  let failureCode: TranslationErrorCode = "translation_retry_blocked";

  function currentReceipt(): TranslationItemReceipt {
    return latestReceipt;
  }
  function currentProgress(): ArticleTranslationItemRetryProgress | null {
    return acknowledgedProgress;
  }

  async function reconcile() {
    try {
      const receipt = ordinary ? await getArticleTranslationOrdinaryItem(supabase!, intent)
        : await getArticleTranslationItemRetry(supabase!, intent);
      if (preparedRequest !== null && receipt.phase === "finished") {
        const candidate = await getArticleTranslationItemRetryCandidate(supabase!, intent);
        if (candidate.candidateState !== "finished" || candidate.candidateHash !== preparedRequest.candidate.candidateHash ||
          !candidateReceipt(receipt, intent, candidate, ordinary) ||
          !candidateReceipt(receipt, intent, preparedRequest.candidate, ordinary)) {
          throw new ArticleTranslationItemRetryRpcError("translation_retry_unconfirmed");
        }
      }
      latestReceipt = receipt;
    } catch (error) {
      unstable_rethrow(error);
    }
  }
  async function finishKnown(outcome: ArticleTranslationItemRetryOutcome, englishEnvelope: unknown = null) {
    finishAttempted = true;
    const receipt = ordinary ? await finishArticleTranslationOrdinaryItem(supabase!, intent, outcome, englishEnvelope)
      : await finishArticleTranslationItemRetry(supabase!, intent, outcome, englishEnvelope);
    if (preparedRequest !== null && !candidateReceipt(receipt, intent, preparedRequest.candidate, ordinary)) {
      throw new ArticleTranslationItemRetryRpcError("translation_retry_unconfirmed");
    }
    latestReceipt = receipt;
    return latestReceipt;
  }

  try {
    const result = await ensurePublishedArticlePremiumEnglish({
      supabase,
      actorId: session.user.id,
      articleId: latestReceipt.articleId,
      runtimeApproved: true,
      expectedSourceHash: intent.expectedSourceHash,
      expectedSourceUpdatedAt: intent.expectedSourceUpdatedAt,
      operationBudget: budget,
      privateRetry: {
        expectedEnglishUpdatedAt: intent.expectedEnglishUpdatedAt,
        providerJournal: {
          async beforeDispatch(call) {
            if (!admitted) throw new ArticleTranslationItemRetryRpcError("translation_retry_unconfirmed");
            if (!(await premiumTranslationRuntimeGate(supabase))) {
              stoppedBeforeDispatch = true;
              throw new ArticleTranslationItemRetryRpcError("translation_operation_stopped");
            }
            const callId = crypto.randomUUID();
            let progress: ArticleTranslationItemRetryProgress;
            try {
              progress = await recordArticleTranslationItemRetryDispatch(supabase, intent, { ...call, callId });
            } catch (error) {
              unstable_rethrow(error);
              // Only a confirmed SQL conflict establishes that this dispatch
              // was refused. Rejected or malformed RPC results stay unknown.
              if (error instanceof ArticleTranslationItemRetryRpcError && error.errorCode === "write_conflict") {
                conflictBeforeDispatch = true;
              }
              throw error;
            }
            acknowledgedProgress = progress;
            if (!progress.canDispatch) throw new ArticleTranslationItemRetryRpcError("translation_retry_unconfirmed");
            return callId;
          },
          async responseReceived(metadata) {
            acknowledgedProgress = await recordArticleTranslationItemRetryResponse(supabase, intent, metadata);
          },
        },
        async admit(source) {
          if (source.sourceHash !== intent.expectedSourceHash || source.sourceUpdatedAt !== intent.expectedSourceUpdatedAt ||
            source.expectedEnglishUpdatedAt !== intent.expectedEnglishUpdatedAt) return false;
          latestReceipt = ordinary ? await beginArticleTranslationOrdinaryFailedRetry(supabase, intent)
            : await beginArticleTranslationItemRetry(supabase, intent);
          admitted = latestReceipt.canExecute;
          if (admitted) {
            try {
              const capability = await getArticleTranslationItemRetryCandidate(supabase, intent);
              if (capability.phase !== "running" || capability.candidateState !== "missing" ||
                capability.sourceHash !== intent.expectedSourceHash ||
                capability.sourceUpdatedAt !== intent.expectedSourceUpdatedAt ||
                capability.englishUpdatedAt !== intent.expectedEnglishUpdatedAt ||
                capability.provider !== intent.provider || capability.providerCalls !== 0) {
                throw new ArticleTranslationItemRetryRpcError("translation_retry_unconfirmed");
              }
            } catch (error) {
              unstable_rethrow(error);
              // The new storage capability must be confirmed before transport.
              // Its read failure cannot authorise a provider call.
              stoppedBeforeDispatch = true;
              throw error;
            }
          }
          return admitted;
        },
        async stageCandidate(candidate) {
          const journal = currentProgress();
          if (!admitted || journal === null || journal.providerCalls === 0 ||
            journal.calls.some(call => call.responseReceivedAt === null) ||
            journal.providerCalls !== budget.snapshot().providerCalls) {
            throw new ArticleTranslationItemRetryRpcError("translation_retry_unconfirmed");
          }
          const outcome: ArticleTranslationItemRetryOutcome = {
            status: "succeeded",
            providerCalls: journal.providerCalls,
            model: candidate.model,
            requestId: candidate.requestId,
            inputTokens: candidate.inputTokens,
            outputTokens: candidate.outputTokens,
            durationMs: candidate.durationMs,
          };
          const englishEnvelope = { mode: "save", payload: candidate.englishPayload };
          const staged = await stageArticleTranslationItemRetryCandidate(supabase, intent, outcome, englishEnvelope);
          if (staged.candidateState !== "staged" || !staged.canRecover) {
            throw new ArticleTranslationItemRetryRpcError("translation_retry_unconfirmed");
          }
          preparedRequest = { outcome, englishEnvelope, candidate: staged };
        },
        async persist(candidate) {
          if (preparedRequest === null ||
            JSON.stringify(preparedRequest.englishEnvelope) !== JSON.stringify({ mode: "save", payload: candidate.englishPayload }) ||
            preparedRequest.outcome.model !== candidate.model || preparedRequest.outcome.requestId !== candidate.requestId ||
            preparedRequest.outcome.inputTokens !== candidate.inputTokens ||
            preparedRequest.outcome.outputTokens !== candidate.outputTokens ||
            preparedRequest.outcome.durationMs !== candidate.durationMs) {
            throw new ArticleTranslationItemRetryRpcError("translation_retry_unconfirmed");
          }
          const receipt = await finishKnown(preparedRequest.outcome, preparedRequest.englishEnvelope);
          const draftVersion = receipt.result?.workingDraftVersion;
          return {
            confirmed: receipt.result?.outcome === "succeeded" && receipt.result.persistence === "working-draft",
            ...(draftVersion !== null && draftVersion !== undefined ? { draftVersion } : {}),
          };
        },
      },
    });
    if (admitted && !finishAttempted) {
      const status = result.state === "conflict" ? "conflict" : result.state === "stale" ? "stale"
        : result.state === "not-configured" ? "not-configured" : result.state === "failed" ? "dead_letter" : "skipped";
      const errorCode = status === "conflict" ? "write_conflict" : status === "stale" ? "source_changed"
        : status === "not-configured" ? "translation_not_configured" : status === "dead_letter" ? "unexpected" : null;
      await finishKnown({ status, errorCode, providerCalls: budget.snapshot().providerCalls });
    } else if (!admitted && result.retryAdmission !== "existing") {
      failureCode = result.state === "stale" ? "source_changed" : result.state === "not-configured"
        ? "translation_not_configured" : "translation_retry_blocked";
    }
    if (currentReceipt().phase === "finished") revalidatePath("/translations");
  } catch (error) {
    unstable_rethrow(error);
    const snapshot = budget.snapshot();
    const journalReceipt = currentProgress();
    // A literal gate refusal before transport is known. A reserved budget slot
    // is not a dispatched request; only acknowledged journal admissions count.
    if (admitted && !finishAttempted && (stoppedBeforeDispatch || conflictBeforeDispatch) &&
      (journalReceipt === null || journalReceipt.calls.every(call => call.responseReceivedAt !== null))) {
      try {
        await finishKnown({ status: conflictBeforeDispatch ? "conflict" : "not-configured",
          errorCode: conflictBeforeDispatch ? "write_conflict" : "translation_not_configured",
          providerCalls: journalReceipt?.providerCalls ?? 0 });
      } catch (finishError) {
        unstable_rethrow(finishError);
      }
    } else if (admitted && !finishAttempted && snapshot.providerCalls === 0) {
      // No request was admitted by the shared transport budget. Its refusal is
      // known; a request already sent to a provider remains unresolved below.
      try {
        await finishKnown({ status: "dead_letter", errorCode: "unexpected", providerCalls: 0 });
      } catch (finishError) {
        unstable_rethrow(finishError);
      }
    }
    failureCode = error instanceof ArticleTranslationItemRetryRpcError || error instanceof ArticleTranslationOrdinaryRpcError ? error.errorCode
      : snapshot.providerCalls > 0 ? "translation_retry_unconfirmed" : translationErrorCode(error, "translation_retry_blocked");
    await reconcile();
  }
  const finalReceipt = currentReceipt();
  if (finalReceipt.phase === "finished" || finalReceipt.phase === "running" || finalReceipt.phase === "blocked") {
    redirect(retryUrl(target, receiptError(finalReceipt)));
  }
  redirect(retryUrl(target, failureCode));
}

const submittedRecovery = z.object({
  job_id: z.string().uuid(), item_id: z.string().uuid(), operation_id: z.string().uuid(),
  candidate_hash: z.string().regex(/^[a-f0-9]{64}$/u),
}).strict();

/** Complete the original attempt using its stored candidate, with no provider. */
export async function recoverArticleTranslationItemCandidateAction(formData: FormData) {
  const session = await requireStaff();
  if (!session?.user) redirect("/login");
  const names = ["job_id", "item_id", "operation_id", "candidate_hash"] as const;
  if (names.some(name => formData.getAll(name).length !== 1)) redirect("/translations?errorCode=invalid_input");
  const parsed = submittedRecovery.safeParse(Object.fromEntries(names.map(name => [name, formData.get(name)])));
  if (!parsed.success) redirect("/translations?errorCode=invalid_input");
  const form = parsed.data;
  const target = { jobId: form.job_id, itemId: form.item_id, operationId: form.operation_id };
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect(retryUrl(target, "database_unavailable"));
  let receipt: TranslationItemReceipt | null = null;
  let ordinary = false;
  let domainConfirmed = false;
  let boundTarget: ArticleTranslationItemRetryTarget = target;
  let originalCandidate: ArticleTranslationItemRetryCandidate | null = null;
  let failure: TranslationErrorCode = "translation_retry_unconfirmed";
  try {
    ordinary = (await getArticleTranslationItemDomain(supabase, target.jobId)).kind === "ordinary";
    domainConfirmed = true;
    receipt = ordinary ? await getArticleTranslationOrdinaryItem(supabase, target)
      : await getArticleTranslationItemRetry(supabase, target);
    if (receipt.phase !== "running" && receipt.phase !== "finished") {
      redirect(retryUrl(target, "translation_retry_blocked"));
    }
    const bound = { ...target, articleId: receipt.articleId };
    boundTarget = bound;
    const candidate = await getArticleTranslationItemRetryCandidate(supabase, bound);
    if (candidate.candidateHash !== form.candidate_hash || candidate.sourceHash !== receipt.sourceHash ||
      !sameArticleRetryRevision(candidate.sourceUpdatedAt, receipt.sourceUpdatedAt) ||
      !sameArticleRetryRevision(candidate.englishUpdatedAt, receipt.englishUpdatedAt) ||
      candidate.provider !== receipt.provider) redirect(retryUrl(target, "write_conflict"));
    originalCandidate = candidate;
    if (receipt.phase === "finished") {
      if (candidate.candidateState !== "finished" || !candidateReceipt(receipt, bound, candidate, ordinary)) {
        throw new ArticleTranslationItemRetryRpcError("translation_retry_unconfirmed");
      }
      redirect(retryUrl(target, receiptError(receipt)));
    }
    if (!candidate.canRecover && !(ordinary && canFinalizeOrdinaryCandidate(candidate))) {
      redirect(retryUrl(target, candidate.blockReason === "source_changed" ? "source_changed"
        : candidate.blockReason === "english_changed" || candidate.blockReason === "draft_changed" ||
          candidate.blockReason === "draft_missing" ? "write_conflict" : "translation_retry_unconfirmed"));
    }
    receipt = ordinary ? await recoverArticleTranslationOrdinaryCandidate(supabase, {
      ...bound, expectedJobVersion: receipt.jobVersion, expectedAttemptCount: receipt.attemptCount,
      expectedSourceHash: candidate.sourceHash, expectedSourceUpdatedAt: candidate.sourceUpdatedAt,
      expectedEnglishUpdatedAt: candidate.englishUpdatedAt, provider: candidate.provider,
    }, candidate) : await recoverArticleTranslationItemRetryCandidate(supabase, bound, candidate);
    revalidatePath("/translations");
  } catch (error) {
    unstable_rethrow(error);
    failure = error instanceof ArticleTranslationItemRetryRpcError || error instanceof ArticleTranslationOrdinaryRpcError
      ? error.errorCode : "translation_retry_unconfirmed";
    if (domainConfirmed) try {
      const latest = ordinary ? await getArticleTranslationOrdinaryItem(supabase, boundTarget)
        : await getArticleTranslationItemRetry(supabase, boundTarget);
      receipt = null;
      if (latest.phase === "finished") {
        const bound = { ...boundTarget, articleId: latest.articleId };
        const candidate = await getArticleTranslationItemRetryCandidate(supabase, bound);
        if (candidate.candidateState === "finished" && candidate.candidateHash === form.candidate_hash) {
          const confirmed = candidateReceipt(latest, bound, candidate, ordinary);
          if (confirmed && (originalCandidate === null || candidateReceipt(confirmed, bound, originalCandidate, ordinary))) {
            receipt = confirmed;
          }
        }
      }
    } catch (lookupError) {
      unstable_rethrow(lookupError);
      receipt = null;
    }
  }
  redirect(retryUrl(target, receipt?.phase === "finished" ? receiptError(receipt) : failure));
}
