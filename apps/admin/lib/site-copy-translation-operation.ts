import type { SupabaseClient } from "@supabase/supabase-js";
import { unstable_rethrow } from "next/navigation";

import { adminEnv } from "./env";
import { retainedPremiumTranslationResponseValue, type TranslationPrivateResponseArtifacts, type TranslationProviderCallJournal,
  type TranslationProviderResponseMetadata } from "./premium-english-translation";
import { samePremiumTranslationJson } from "./premium-translation-working-draft";
import { premiumTranslationRuntimeGate } from "./translation-runtime-gate";
import {
  SiteCopyTranslationOperationRpcError, beginSiteCopyTranslationOperation, dispatchSiteCopyTranslationOperation,
  finishSiteCopyTranslationOperation, getSiteCopyTranslationOperationArtifacts, reconcileSiteCopyTranslationOperation,
  recordSiteCopyTranslationOperationResponse, siteCopyTranslationOperationReady, siteCopyTranslationReceiptMatchesIntent,
  parseSiteCopyTranslationOperationReceipt, type SiteCopyTranslationOperationArtifacts, type SiteCopyTranslationOperationCandidate,
  type SiteCopyTranslationOperationIntent, type SiteCopyTranslationOperationOutcome, type SiteCopyTranslationOperationReceipt,
} from "./site-copy-translation-operation-rpc";

export type SiteCopyTranslationOperation = {
  jobId: string; itemId: string; operationId: string; receipt: SiteCopyTranslationOperationReceipt | null;
};

/** Only an acknowledged complete sequence can be recovered without another call. */
export function retainedSiteCopyTranslationPass(artifact: SiteCopyTranslationOperationArtifacts) {
  const calls = artifact.calls, first = calls[0], last = calls.at(-1);
  const sequence = calls.map(call => call.metadata.pass).join(",");
  const allowed = artifact.configuration.twoPassReview
    ? ["translation,review", "translation,repair,review", "translation,review,repair", "translation,repair,review,repair"]
    : ["translation", "translation,repair"];
  if (!first || !last?.responseArtifact || !last.metadata.responseReceivedAt || !allowed.includes(sequence) ||
    calls.some((call, index) => call.metadata.provider !== artifact.receipt.provider ||
      call.metadata.model !== (index === 0 ? artifact.configuration.model : artifact.configuration.reviewerModel) ||
      call.metadata.responseReceivedAt === null || call.responseArtifact === null ||
      (call.metadata.httpStatus !== null && (call.metadata.httpStatus < 200 || call.metadata.httpStatus >= 300)))) return null;
  return { value: retainedPremiumTranslationResponseValue(artifact.receipt.provider, last.responseArtifact.body, last.metadata.pass),
    translatorCallId: first.metadata.callId, reviewerCallId: calls.length > 1 ? last.metadata.callId : null,
    provenance: { provider: artifact.receipt.provider, translatorModel: first.metadata.model,
      reviewerModel: calls.length > 1 ? last.metadata.model : null,
      translatorRequestId: first.metadata.requestId ?? first.metadata.responseId,
      reviewerRequestId: calls.length > 1 ? last.metadata.requestId ?? last.metadata.responseId : null,
      generatedAt: new Date(last.metadata.responseReceivedAt).toISOString() } };
}

/** One logical site-copy scope; observations never grant a dispatch capability. */
export function createSiteCopyTranslationOperation(input: {
  supabase: SupabaseClient; actorId: string;
  intent?: SiteCopyTranslationOperationIntent;
  existing?: SiteCopyTranslationOperationReceipt;
  /** Only an explicit new command may repeat settled selected source/configuration. */
  allowNewFinished?: boolean;
  onAdmission?: (receipt: SiteCopyTranslationOperationReceipt) => Promise<void>;
  validateArtifacts: (artifact: SiteCopyTranslationOperationArtifacts) => Promise<boolean>;
  candidateFromArtifacts: (artifact: SiteCopyTranslationOperationArtifacts) => Promise<SiteCopyTranslationOperationCandidate | null>;
}) {
  const { supabase, intent } = input;
  if (!intent && !input.existing) throw new TypeError("A site-copy operation identity is required");
  let latest: SiteCopyTranslationOperationReceipt | null = input.existing ?? null;
  let admitted = false, beginAttempted = false, runtimeStopped = false;
  let prepared: SiteCopyTranslationOperationCandidate | null = null;
  const recorded = new Map<string, TranslationProviderResponseMetadata>();
  const unconfirmed = () => new SiteCopyTranslationOperationRpcError("translation_retry_unconfirmed");
  const observe = (receipt: SiteCopyTranslationOperationReceipt) => { latest = receipt; return receipt; };
  const operation = (): SiteCopyTranslationOperation => ({
    jobId: latest?.jobId ?? intent!.jobId, itemId: latest?.itemId ?? intent!.itemId,
    operationId: latest?.operationId ?? intent!.operationId, receipt: latest,
  });
  const owned = () => latest?.actorId.toLowerCase() === input.actorId.toLowerCase();
  async function readArtifacts() {
    if (!latest || !owned()) throw unconfirmed();
    const artifact = await getSiteCopyTranslationOperationArtifacts(supabase, latest);
    if (!(await input.validateArtifacts(artifact))) throw unconfirmed();
    observe(artifact.receipt);
    return artifact;
  }
  async function lookupExact() {
    const expected = latest?.operationId ?? intent?.operationId;
    if (!expected) throw unconfirmed();
    const receipt = await reconcileSiteCopyTranslationOperation(supabase, expected);
    if (receipt) observe(receipt);
    // An active logical operation wins in SQL. Do not adopt its private body
    // merely because this caller addressed an older operation.
    if (!receipt || receipt.operationId.toLowerCase() !== expected.toLowerCase()) throw unconfirmed();
    return receipt;
  }
  async function expenseAllowed() {
    if (!adminEnv.openAiAutoTranslateSiteCopy || !(await premiumTranslationRuntimeGate(supabase))) {
      runtimeStopped = true;
      throw new SiteCopyTranslationOperationRpcError("translation_not_configured", true);
    }
  }
  async function admit() {
    if (!intent) throw unconfirmed();
    const previous = await reconcileSiteCopyTranslationOperation(supabase);
    if (previous && (previous.phase !== "finished" || previous.operationId.toLowerCase() === intent.operationId.toLowerCase() ||
      (!input.allowNewFinished && previous.result?.candidateHash !== null && previous.sourceHash === intent.sourceHash &&
        samePremiumTranslationJson(previous.configuration, intent.configuration)))) {
      observe(previous);
      return false;
    }
    if (!(await siteCopyTranslationOperationReady(supabase))) {
      throw new SiteCopyTranslationOperationRpcError("translation_migration_required", true);
    }
    await expenseAllowed();
    beginAttempted = true;
    const receipt = observe(await beginSiteCopyTranslationOperation(supabase, intent));
    if (!receipt.canExecute) return false;
    const artifact = await readArtifacts();
    if (!siteCopyTranslationReceiptMatchesIntent(receipt, intent) || artifact.calls.length !== 0 || artifact.candidate !== null ||
      !samePremiumTranslationJson(artifact.sourceSnapshot, intent.sourceSnapshot) ||
      !samePremiumTranslationJson(artifact.expectedState, intent.expectedState)) throw unconfirmed();
    await input.onAdmission?.(receipt);
    admitted = true;
    return true;
  }
  const providerJournal: TranslationProviderCallJournal = {
    async beforeDispatch(call) {
      if (!admitted || !latest || !call.requestHash || !/^[a-f0-9]{64}$/u.test(call.requestHash)) throw unconfirmed();
      await expenseAllowed();
      const callId = crypto.randomUUID();
      const receipt = observe(await dispatchSiteCopyTranslationOperation(supabase, latest, { ...call, requestHash: call.requestHash, callId }));
      if (!receipt.canDispatch || receipt.pendingCallId?.toLowerCase() !== callId.toLowerCase()) throw unconfirmed();
      return callId;
    },
    async responseReceived(metadata) {
      const stored = recorded.get(metadata.callId.toLowerCase());
      if (!stored || !samePremiumTranslationJson(stored, metadata)) throw unconfirmed();
    },
  };
  const responseArtifacts: TranslationPrivateResponseArtifacts = {
    async record(response) {
      if (!admitted || !latest) throw unconfirmed();
      const { body, requestHash, ...metadata } = response;
      if (JSON.stringify(body) === undefined) throw unconfirmed();
      try {
        const receipt = observe(await recordSiteCopyTranslationOperationResponse(supabase, latest, metadata, body));
        if (receipt.pendingCallId !== null) throw unconfirmed();
      } catch (error) {
        unstable_rethrow(error);
        try {
          await lookupExact();
          const artifact = await readArtifacts();
          const stored = artifact.calls.find(call => call.metadata.callId.toLowerCase() === metadata.callId.toLowerCase());
          if (!stored || stored.requestHash !== requestHash || stored.metadata.responseReceivedAt === null ||
            !samePremiumTranslationJson(stored.responseArtifact, { version: 1, body })) throw error;
          const { dispatchRecordedAt: _dispatch, responseReceivedAt: _response, ...storedMetadata } = stored.metadata;
          if (!samePremiumTranslationJson(storedMetadata, metadata)) throw error;
        } catch (lookupError) { unstable_rethrow(lookupError); throw error; }
      }
      recorded.set(metadata.callId.toLowerCase(), metadata);
    },
  };
  function outcome(artifact: SiteCopyTranslationOperationArtifacts, status: SiteCopyTranslationOperationOutcome["status"],
    errorCode?: SiteCopyTranslationOperationOutcome["errorCode"]): SiteCopyTranslationOperationOutcome {
    const last = artifact.calls.at(-1)?.metadata, first = artifact.calls[0]?.metadata;
    const total = (key: "inputTokens" | "outputTokens") => {
      const values = artifact.calls.map(call => call.metadata[key]).filter((value): value is number => value !== null);
      return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
    };
    return { status, providerCalls: artifact.calls.length, ...(errorCode ? { errorCode } : {}),
      ...(last ? { model: last.model, requestId: last.requestId ?? last.responseId,
        inputTokens: total("inputTokens"), outputTokens: total("outputTokens"),
        durationMs: first && last.responseReceivedAt !== null
          ? Math.max(0, Date.parse(last.responseReceivedAt) - Date.parse(first.dispatchRecordedAt)) : null } : {}) };
  }
  async function finishCandidate(artifact: SiteCopyTranslationOperationArtifacts, candidate: SiteCopyTranslationOperationCandidate) {
    prepared = candidate;
    try {
      return observe(await finishSiteCopyTranslationOperation(supabase, artifact.receipt, outcome(artifact, "succeeded"), candidate));
    } catch (error) {
      unstable_rethrow(error);
      try {
        const receipt = await lookupExact();
        if (receipt.phase !== "finished") throw error;
        const stored = await readArtifacts();
        if (!samePremiumTranslationJson(stored.candidate, candidate) || stored.receipt.result?.candidateHash === null) throw error;
        return stored.receipt;
      } catch (lookupError) { unstable_rethrow(lookupError); throw error; }
    }
  }
  async function recoverCandidate() {
    if (!latest || !owned() || latest.phase === "finished" || latest.pendingCallId !== null || latest.providerCalls < 1) return latest;
    const artifact = await readArtifacts();
    const candidate = await input.candidateFromArtifacts(artifact);
    return candidate ? finishCandidate(artifact, candidate) : latest;
  }
  async function recoverExisting(receipt: SiteCopyTranslationOperationReceipt) {
    if (!parseSiteCopyTranslationOperationReceipt(receipt) || receipt.canExecute || receipt.canDispatch) throw unconfirmed();
    observe(receipt);
    if (!owned()) return latest;
    await lookupExact();
    return recoverCandidate();
  }
  async function complete(payload: Record<string, unknown>) {
    if (!admitted) throw unconfirmed();
    const artifact = await readArtifacts();
    const candidate = await input.candidateFromArtifacts(artifact);
    if (!candidate || !samePremiumTranslationJson(candidate.payload, payload)) throw unconfirmed();
    return finishCandidate(artifact, candidate);
  }
  async function failed(error: unknown) {
    unstable_rethrow(error);
    if (beginAttempted || latest !== null) {
      try { await lookupExact(); } catch (lookupError) { unstable_rethrow(lookupError); return latest; }
    }
    if (!latest || !owned() || latest.phase === "finished" || latest.pendingCallId !== null) return latest;
    try {
      const artifact = await readArtifacts();
      if (prepared) return finishCandidate(artifact, prepared);
      const candidate = await input.candidateFromArtifacts(artifact);
      if (candidate) return finishCandidate(artifact, candidate);
      // Neither a known partial answer nor an unknown request is a fresh retry.
      // Only the newly attempted, confirmed zero-call admission can be cleaned up.
      if (artifact.calls.length === 0 && beginAttempted) {
        const status = runtimeStopped ? "not-configured" : "skipped";
        return observe(await finishSiteCopyTranslationOperation(supabase, artifact.receipt,
          outcome(artifact, status, runtimeStopped ? "translation_not_configured" : undefined)));
      }
    } catch (finishError) { unstable_rethrow(finishError); }
    return latest;
  }
  return { admit, recoverExisting, recoverCandidate, providerJournal, responseArtifacts, complete, failed, readArtifacts, operation,
    get admitted() { return admitted; }, get receipt() { return latest; } };
}
