import type { SupabaseClient } from "@supabase/supabase-js";
import { unstable_rethrow } from "next/navigation";

import type { TranslationPrivateResponseArtifacts, TranslationProviderCallJournal, TranslationProviderResponseMetadata } from "./premium-english-translation";
import { samePremiumTranslationJson } from "./premium-translation-working-draft";
import { premiumTranslationRuntimeGate } from "./translation-runtime-gate";
import {
  WriterTranslationOperationRpcError, beginWriterTranslationOperation, dispatchWriterTranslationOperation,
  finishWriterTranslationOperation, getWriterTranslationOperationArtifacts, reconcileWriterTranslationOperation,
  recordWriterTranslationOperationResponse, writerTranslationOperationReady, writerTranslationReceiptMatchesIntent, parseWriterTranslationOperationReceipt,
  type WriterTranslationOperationArtifacts, type WriterTranslationOperationCandidate, type WriterTranslationOperationIntent,
  type WriterTranslationOperationOutcome, type WriterTranslationOperationReceipt,
} from "./writer-translation-operation-rpc";

export type WriterTranslationOperation = {
  jobId: string; itemId: string; operationId: string; receipt: WriterTranslationOperationReceipt | null;
};

/** Writer-only coordination of the existing operational journal and private artifacts. */
export function createWriterTranslationOperation(input: {
  supabase: SupabaseClient; intent: WriterTranslationOperationIntent;
  onAdmission?: (receipt: WriterTranslationOperationReceipt) => Promise<void>;
  candidateFromArtifacts: (artifact: WriterTranslationOperationArtifacts) => Promise<WriterTranslationOperationCandidate | null>;
}) {
  const { supabase, intent } = input;
  let latest: WriterTranslationOperationReceipt | null = null;
  let admitted = false, beginAttempted = false, runtimeStopped = false;
  let prepared: WriterTranslationOperationCandidate | null = null;
  const recorded = new Map<string, TranslationProviderResponseMetadata>();
  const unconfirmed = () => new WriterTranslationOperationRpcError("translation_retry_unconfirmed");
  const observe = (receipt: WriterTranslationOperationReceipt) => { latest = receipt; return receipt; };
  const operation = (): WriterTranslationOperation => ({
    jobId: latest?.jobId ?? intent.jobId, itemId: latest?.itemId ?? intent.itemId,
    operationId: latest?.operationId ?? intent.operationId, receipt: latest,
  });
  async function readArtifacts() {
    if (!latest || latest.actorId.toLowerCase() !== intent.actorId.toLowerCase()) throw unconfirmed();
    const artifact = await getWriterTranslationOperationArtifacts(supabase, latest);
    observe(artifact.receipt);
    return artifact;
  }
  async function lookupExact() {
    const receipt = await reconcileWriterTranslationOperation(supabase, intent, latest?.operationId ?? intent.operationId);
    if (receipt) observe(receipt);
    return receipt;
  }
  async function admit() {
    if (!(await writerTranslationOperationReady(supabase))) {
      throw new WriterTranslationOperationRpcError("translation_migration_required", true);
    }
    const previous = await reconcileWriterTranslationOperation(supabase, intent);
    if (previous && (previous.phase !== "finished" ||
      (previous.sourceHash === intent.sourceHash && (previous.providerCalls > 0 || previous.result?.candidateHash !== null)))) {
      observe(previous);
      return false;
    }
    beginAttempted = true;
    const receipt = observe(await beginWriterTranslationOperation(supabase, intent));
    if (!receipt.canExecute) return false;
    const artifact = await readArtifacts();
    if (!writerTranslationReceiptMatchesIntent(receipt, intent) || artifact.calls.length !== 0 || artifact.candidate !== null ||
      !samePremiumTranslationJson(artifact.sourceSnapshot, intent.sourceSnapshot) ||
      !samePremiumTranslationJson(artifact.expectedOverrideFields, intent.expectedOverrideFields)) throw unconfirmed();
    await input.onAdmission?.(receipt);
    admitted = true;
    return true;
  }
  const providerJournal: TranslationProviderCallJournal = {
    async beforeDispatch(call) {
      if (!admitted || !latest || !call.requestHash || !/^[a-f0-9]{64}$/u.test(call.requestHash)) throw unconfirmed();
      if (!(await premiumTranslationRuntimeGate(supabase))) {
        runtimeStopped = true;
        throw new WriterTranslationOperationRpcError("translation_not_configured", true);
      }
      const callId = crypto.randomUUID();
      const receipt = observe(await dispatchWriterTranslationOperation(supabase, latest, { ...call, requestHash: call.requestHash, callId }));
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
      // The wire is JSON. Never treat an absent JavaScript value as a retained body.
      if (JSON.stringify(body) === undefined) throw unconfirmed();
      try {
        const receipt = observe(await recordWriterTranslationOperationResponse(supabase, latest, metadata, body));
        if (receipt.pendingCallId !== null) throw unconfirmed();
      } catch (error) {
        unstable_rethrow(error);
        const receipt = await lookupExact().catch(lookupError => { unstable_rethrow(lookupError); return null; });
        if (!receipt) throw error;
        const artifact = await readArtifacts();
        const stored = artifact.calls.find(call => call.metadata.callId.toLowerCase() === metadata.callId.toLowerCase());
        if (!stored || stored.requestHash !== requestHash || stored.metadata.responseReceivedAt === null ||
          !samePremiumTranslationJson(stored.responseArtifact, { version: 1, body })) throw error;
        const { dispatchRecordedAt: _dispatch, responseReceivedAt: _response, ...storedMetadata } = stored.metadata;
        if (!samePremiumTranslationJson(storedMetadata, metadata)) throw error;
      }
      recorded.set(metadata.callId.toLowerCase(), metadata);
    },
  };
  function outcome(artifact: WriterTranslationOperationArtifacts, status: WriterTranslationOperationOutcome["status"],
    errorCode?: WriterTranslationOperationOutcome["errorCode"]): WriterTranslationOperationOutcome {
    const last = artifact.calls.at(-1)?.metadata;
    const first = artifact.calls[0]?.metadata;
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
  async function finishCandidate(artifact: WriterTranslationOperationArtifacts, candidate: WriterTranslationOperationCandidate) {
    prepared = candidate;
    try {
      return observe(await finishWriterTranslationOperation(supabase, artifact.receipt, outcome(artifact, "succeeded"), candidate));
    } catch (error) {
      unstable_rethrow(error);
      const receipt = await lookupExact().catch(lookupError => { unstable_rethrow(lookupError); return null; });
      if (!receipt || receipt.phase !== "finished") throw error;
      const stored = await readArtifacts();
      if (!samePremiumTranslationJson(stored.candidate, candidate) || stored.receipt.result?.candidateHash === null) throw error;
      return stored.receipt;
    }
  }
  async function recoverCandidate() {
    if (!latest || latest.actorId.toLowerCase() !== intent.actorId.toLowerCase()) return latest;
    if (latest.phase === "finished" || latest.pendingCallId !== null || latest.providerCalls < 2) return latest;
    const artifact = await readArtifacts();
    const candidate = await input.candidateFromArtifacts(artifact);
    return candidate ? finishCandidate(artifact, candidate) : latest;
  }
  async function recoverExisting(receipt: WriterTranslationOperationReceipt) {
    // Metadata observation grants no BEGIN, budget or provider authority.
    if (!parseWriterTranslationOperationReceipt(receipt, intent, intent) ||
      !writerTranslationReceiptMatchesIntent(receipt, intent)) throw unconfirmed();
    observe(receipt);
    const current = await lookupExact();
    if (!current) throw unconfirmed();
    return recoverCandidate();
  }
  async function complete(payload: { text: string }) {
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
    if (!latest || latest.actorId.toLowerCase() !== intent.actorId.toLowerCase() || latest.phase === "finished" || latest.pendingCallId !== null) return latest;
    try {
      const artifact = await readArtifacts();
      if (prepared) return finishCandidate(artifact, prepared);
      const candidate = await input.candidateFromArtifacts(artifact);
      if (candidate) return finishCandidate(artifact, candidate);
      // Acknowledged paid work stays admitted until a complete candidate exists.
      // Ordinary helper calls must not spend again after an editorial failure.
      if (artifact.calls.length > 0) return latest;
      if (artifact.calls.length === 0) {
        const status = runtimeStopped ? "not-configured" : admitted && error instanceof WriterTranslationOperationRpcError &&
          error.confirmedRefusal && error.errorCode === "write_conflict" ? "conflict" : "skipped";
        return observe(await finishWriterTranslationOperation(supabase, artifact.receipt,
          outcome(artifact, status, status === "not-configured" ? "translation_not_configured" : status === "conflict" ? "write_conflict" : undefined)));
      }
    } catch (finishError) { unstable_rethrow(finishError); }
    return latest;
  }
  return { admit, providerJournal, responseArtifacts, complete, recoverCandidate, recoverExisting, failed, readArtifacts, operation,
    get admitted() { return admitted; }, get receipt() { return latest; } };
}
