import type { SupabaseClient } from "@supabase/supabase-js";
import { unstable_rethrow } from "next/navigation";

import type { PrivateArticleRetry, PrivateArticleRetryCandidate, PremiumArticleBackfillState } from "./auto-translate-published-article-premium";
import { sameArticleRetryRevision } from "./article-retry-revision";
import {
  ArticleTranslationItemRetryRpcError, getArticleTranslationItemRetryCandidate, recordArticleTranslationItemRetryDispatch,
  recordArticleTranslationItemRetryResponse, stageArticleTranslationItemRetryCandidate,
  type ArticleTranslationItemRetryCandidate, type ArticleTranslationItemRetryOutcome, type ArticleTranslationItemRetryProgress,
} from "./article-translation-item-retry";
import {
  ArticleTranslationOrdinaryRpcError, beginArticleTranslationSyncItem, finishArticleTranslationOrdinaryItem, getArticleTranslationOrdinaryItem,
  getArticleTranslationSyncReadiness, ordinaryReceiptMatchesCandidate, type ArticleTranslationOrdinaryReceipt, type ArticleTranslationSyncIntent,
} from "./article-translation-ordinary-rpc";
import { premiumTranslationRuntimeMetadata } from "./premium-translation-runtime";
import { translationErrorCode, type TranslationErrorCode } from "./translation-errors";
import { TranslationOperationBudgetError, type TranslationOperationBudget } from "./translation-operation-budget";
import { premiumTranslationRuntimeGate } from "./translation-runtime-gate";

export type ArticleTranslationOrdinaryRunContext = {
  jobId: string; expectedJobVersion: string; expectedCursor: Record<string, unknown>; resumeCursor: Record<string, unknown>;
  onReceipt?: (receipt: ArticleTranslationOrdinaryReceipt) => void;
};
export type ArticleTranslationOrdinaryOperation = {
  jobId: string; itemId: string; operationId: string; receipt: ArticleTranslationOrdinaryReceipt | null;
};

/** A single admitted item shares the existing journal and private candidate storage. */
export function createArticleTranslationOrdinaryCoordinator(input: {
  supabase: SupabaseClient; articleId: string; sourceHash: string; sourceUpdatedAt: string;
  expectedEnglishUpdatedAt: string | null; sourceSnapshot: Record<string, unknown>; budget: TranslationOperationBudget;
  run?: ArticleTranslationOrdinaryRunContext;
}) {
  const runtime = premiumTranslationRuntimeMetadata();
  const intent: ArticleTranslationSyncIntent = {
    jobId: input.run?.jobId ?? crypto.randomUUID(), itemId: crypto.randomUUID(), operationId: crypto.randomUUID(), articleId: input.articleId,
    expectedJobVersion: input.run?.expectedJobVersion ?? "0", expectedAttemptCount: 0,
    expectedSourceHash: input.sourceHash, expectedSourceUpdatedAt: input.sourceUpdatedAt, expectedEnglishUpdatedAt: input.expectedEnglishUpdatedAt,
    provider: runtime.provider, sourceSnapshot: input.sourceSnapshot, expectedCursor: input.run?.expectedCursor ?? {},
    resumeCursor: input.run?.resumeCursor ?? { articleScan: { version: 1, order: "id", upperId: input.articleId, afterId: input.articleId,
      pendingIds: [], nextIndex: 0, lastWindow: true, exhausted: true } },
  };
  const initialCalls = input.budget.snapshot().providerCalls;
  let latest: ArticleTranslationOrdinaryReceipt | null = null, admitted = false, finishAttempted = false;
  let beginAttempted = false, stageAttempted = false;
  let progress: ArticleTranslationItemRetryProgress | null = null;
  let knownStop: "conflict" | "not-configured" | null = null;
  let prepared: { candidate: ArticleTranslationItemRetryCandidate; outcome: ArticleTranslationItemRetryOutcome; envelope: unknown } | null = null;
  const observe = (receipt: ArticleTranslationOrdinaryReceipt) => { latest = receipt; input.run?.onReceipt?.(receipt); };
  const operation = (): ArticleTranslationOrdinaryOperation => ({ jobId: intent.jobId, itemId: intent.itemId, operationId: intent.operationId, receipt: latest });
  const allResponses = () => progress === null || progress.calls.every(call => call.responseReceivedAt !== null);

  async function finish(outcome: ArticleTranslationItemRetryOutcome, envelope: unknown = null) {
    finishAttempted = true;
    const receipt = await finishArticleTranslationOrdinaryItem(input.supabase, intent, outcome, envelope);
    if (prepared !== null && !ordinaryReceiptMatchesCandidate(receipt, prepared.candidate)) throw new ArticleTranslationOrdinaryRpcError("translation_retry_unconfirmed");
    observe(receipt); return receipt;
  }
  async function reconcile() {
    try {
      const receipt = await getArticleTranslationOrdinaryItem(input.supabase, intent);
      if (prepared !== null && receipt.phase === "finished") {
        const stored = await getArticleTranslationItemRetryCandidate(input.supabase, intent);
        if (stored.candidateState !== "finished" || stored.candidateHash !== prepared.candidate.candidateHash ||
          !ordinaryReceiptMatchesCandidate(receipt, stored) || !ordinaryReceiptMatchesCandidate(receipt, prepared.candidate)) return;
      }
      observe(receipt);
    } catch (error) { unstable_rethrow(error); }
  }
  const privateRetry: PrivateArticleRetry = {
    expectedEnglishUpdatedAt: input.expectedEnglishUpdatedAt,
    async admit(source) {
      if (source.sourceHash !== input.sourceHash || !sameArticleRetryRevision(source.sourceUpdatedAt, input.sourceUpdatedAt) ||
        !sameArticleRetryRevision(source.expectedEnglishUpdatedAt, input.expectedEnglishUpdatedAt)) return false;
      if (await getArticleTranslationSyncReadiness(input.supabase) !== true) throw new ArticleTranslationOrdinaryRpcError("translation_migration_required", true);
      beginAttempted = true;
      const receipt = await beginArticleTranslationSyncItem(input.supabase, intent);
      observe(receipt); admitted = receipt.canExecute;
      if (!admitted) return false;
      // Freeze the server's precise intent representation for the reused typed candidate adapters.
      intent.expectedSourceUpdatedAt = receipt.sourceUpdatedAt!; intent.expectedEnglishUpdatedAt = receipt.englishUpdatedAt;
      const capability = await getArticleTranslationItemRetryCandidate(input.supabase, intent);
      if (capability.phase !== "running" || capability.candidateState !== "missing" || capability.providerCalls !== 0 ||
        capability.provider !== intent.provider || capability.sourceHash !== intent.expectedSourceHash ||
        !sameArticleRetryRevision(capability.sourceUpdatedAt, intent.expectedSourceUpdatedAt) ||
        !sameArticleRetryRevision(capability.englishUpdatedAt, intent.expectedEnglishUpdatedAt)) throw new ArticleTranslationOrdinaryRpcError("translation_retry_unconfirmed");
      return true;
    },
    providerJournal: {
      async beforeDispatch(call) {
        if (!admitted) throw new ArticleTranslationOrdinaryRpcError("translation_retry_unconfirmed");
        if (!(await premiumTranslationRuntimeGate(input.supabase))) {
          knownStop = "not-configured"; throw new ArticleTranslationOrdinaryRpcError("translation_operation_stopped");
        }
        const callId = crypto.randomUUID();
        try { progress = await recordArticleTranslationItemRetryDispatch(input.supabase, intent, { ...call, callId }); }
        catch (error) {
          unstable_rethrow(error);
          if (error instanceof ArticleTranslationItemRetryRpcError && error.errorCode === "write_conflict") knownStop = "conflict";
          throw error;
        }
        if (!progress.canDispatch) throw new ArticleTranslationOrdinaryRpcError("translation_retry_unconfirmed");
        return callId;
      },
      async responseReceived(metadata) { progress = await recordArticleTranslationItemRetryResponse(input.supabase, intent, metadata); },
    },
    async stageCandidate(candidate) {
      if (!admitted || progress === null || progress.providerCalls === 0 || !allResponses() ||
        progress.providerCalls !== input.budget.snapshot().providerCalls - initialCalls) throw new ArticleTranslationOrdinaryRpcError("translation_retry_unconfirmed");
      const outcome: ArticleTranslationItemRetryOutcome = { status: "succeeded", providerCalls: progress.providerCalls,
        model: candidate.model, requestId: candidate.requestId, inputTokens: candidate.inputTokens, outputTokens: candidate.outputTokens, durationMs: candidate.durationMs };
      const envelope = { mode: "save", payload: candidate.englishPayload };
      stageAttempted = true;
      let staged: ArticleTranslationItemRetryCandidate;
      try {
        staged = await stageArticleTranslationItemRetryCandidate(input.supabase, intent, outcome, envelope);
      } catch (error) {
        unstable_rethrow(error);
        // A fulfilled CAS refusal and a bound read proving no stored candidate
        // permit conflict accounting. A lost ACK or an existing body stays open.
        if (error instanceof ArticleTranslationItemRetryRpcError && error.errorCode === "write_conflict") {
          try {
            const stored = await getArticleTranslationItemRetryCandidate(input.supabase, intent);
            if (stored.phase === "running" && stored.candidateState === "missing" && stored.blockReason === "candidate_missing" &&
              stored.provider === intent.provider && stored.sourceHash === intent.expectedSourceHash &&
              sameArticleRetryRevision(stored.sourceUpdatedAt, intent.expectedSourceUpdatedAt) &&
              sameArticleRetryRevision(stored.englishUpdatedAt, intent.expectedEnglishUpdatedAt) &&
              stored.providerCalls === progress.providerCalls) {
              stageAttempted = false; knownStop = "conflict";
            }
          } catch (lookupError) { unstable_rethrow(lookupError); }
        }
        throw error;
      }
      if (staged.candidateState !== "staged" || !staged.canRecover) throw new ArticleTranslationOrdinaryRpcError("translation_retry_unconfirmed");
      prepared = { candidate: staged, outcome, envelope };
    },
    async persist(candidate: PrivateArticleRetryCandidate) {
      if (prepared === null || JSON.stringify(prepared.envelope) !== JSON.stringify({ mode: "save", payload: candidate.englishPayload }) ||
        prepared.outcome.model !== candidate.model || prepared.outcome.requestId !== candidate.requestId || prepared.outcome.inputTokens !== candidate.inputTokens ||
        prepared.outcome.outputTokens !== candidate.outputTokens || prepared.outcome.durationMs !== candidate.durationMs) throw new ArticleTranslationOrdinaryRpcError("translation_retry_unconfirmed");
      const receipt = await finish(prepared.outcome, prepared.envelope);
      return { confirmed: receipt.result?.outcome === "succeeded" && receipt.result.persistence === "working-draft",
        ...(receipt.result?.workingDraftVersion != null ? { draftVersion: receipt.result.workingDraftVersion } : {}) };
    },
  };
  async function complete(state: PremiumArticleBackfillState) {
    if (admitted && !finishAttempted) {
      if (prepared !== null) {
        await finish(prepared.outcome, prepared.envelope);
      } else {
        const status = state === "conflict" ? "conflict" : state === "stale" ? "stale" : state === "not-configured" ? "not-configured" : state === "failed" ? "dead_letter" : "skipped";
        await finish({ status, providerCalls: progress?.providerCalls ?? 0, errorCode: status === "conflict" ? "write_conflict" : status === "stale" ? "source_changed"
          : status === "not-configured" ? "translation_not_configured" : status === "dead_letter" ? "unexpected" : null });
      }
    }
    return operation();
  }
  async function failed(error: unknown): Promise<{ operation: ArticleTranslationOrdinaryOperation; errorCode: TranslationErrorCode }> {
    unstable_rethrow(error);
    const reservedCalls = input.budget.snapshot().providerCalls - initialCalls;
    if (admitted && !finishAttempted && !stageAttempted && prepared === null && allResponses() &&
      (knownStop !== null || reservedCalls === 0 || progress !== null && progress.providerCalls === reservedCalls)) {
      try {
        const budgetStopped = error instanceof TranslationOperationBudgetError;
        await finish({ status: knownStop ?? (budgetStopped ? "skipped" : "dead_letter"), errorCode: knownStop === "conflict" ? "write_conflict" : knownStop === "not-configured" ? "translation_not_configured"
          : budgetStopped ? null : translationErrorCode(error, "unexpected") as ArticleTranslationItemRetryOutcome["errorCode"], providerCalls: progress?.providerCalls ?? 0 });
      } catch (finishError) { unstable_rethrow(finishError); }
    }
    if (beginAttempted) await reconcile();
    return { operation: operation(), errorCode: latest?.phase === "running" ? "translation_retry_pending" :
      error instanceof ArticleTranslationOrdinaryRpcError || error instanceof ArticleTranslationItemRetryRpcError ? error.errorCode :
        reservedCalls > 0 ? "translation_retry_unconfirmed" : translationErrorCode(error) };
  }
  return { privateRetry, operation, complete, failed };
}
