import type { SupabaseClient } from "@supabase/supabase-js";
import { unstable_rethrow } from "next/navigation";

import { retainedPremiumTranslationResponseValue, type TranslationPrivateResponseArtifacts, type TranslationProviderCallJournal, type TranslationProviderResponseMetadata } from "./premium-english-translation";
import { premiumTranslationCandidateOutcome, readPremiumTranslationWorkingDraft, samePremiumTranslationJson } from "./premium-translation-working-draft";
import { premiumTranslationRuntimeGate } from "./translation-runtime-gate";
import {
  CatalogTranslationOperationRpcError, beginCatalogTranslationOperation, dispatchCatalogTranslationOperation,
  finishCatalogTranslationOperation, getCatalogTranslationOperationArtifacts, reconcileCatalogTranslationOperation,
  recordCatalogTranslationOperationResponse, catalogTranslationOperationReady, catalogTranslationReceiptMatchesIntent,
  parseCatalogTranslationOperationReceipt,
  type CatalogTranslationOperationArtifacts, type CatalogTranslationOperationCandidate, type CatalogTranslationOperationIntent,
  type CatalogTranslationOperationOutcome, type CatalogTranslationOperationReceipt,
} from "./catalog-translation-operation-rpc";

export type CatalogTranslationOperation = {
  jobId: string; itemId: string; operationId: string; receipt: CatalogTranslationOperationReceipt | null;
};

/** Decode only a complete acknowledged pass sequence, using the production parser. */
export function retainedCatalogTranslationPass(artifact: CatalogTranslationOperationArtifacts) {
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

/** Historical FINISH is checked against its private artifact and any still-pending draft. */
export async function catalogTranslationOperationResult(input: {
  supabase: SupabaseClient; operation: ReturnType<typeof createCatalogTranslationOperation>;
  receipt: CatalogTranslationOperationReceipt | null;
  candidateFromArtifacts: (artifact: CatalogTranslationOperationArtifacts) => Promise<CatalogTranslationOperationCandidate | null>;
}) {
  const unknown = () => ({ state: "unconfirmed" as const, error: "translation_retry_pending",
    errorCode: "translation_retry_pending" as const, operation: input.operation.operation() });
  const receipt = input.receipt;
  if (!receipt || receipt.phase !== "finished" || !receipt.result) return unknown();
  const result = receipt.result;
  try {
    if (result.candidateHash !== null) {
      const artifact = await input.operation.readArtifacts();
      const candidate = await input.candidateFromArtifacts(artifact);
      if (!candidate || !samePremiumTranslationJson(artifact.candidate, candidate)) return unknown();
      if (!receipt.replayed) await input.supabase.from("admin_audit_log").insert({ actor_id: receipt.actorId,
        action: receipt.entityType === "literary_work" ? "literary_work.auto_translation.staged" : "country_profile.auto_translation.staged",
        entity_type: receipt.entityType === "literary_work" ? "literary_work" : "country_profile", entity_id: receipt.entityId,
        metadata: { locale: "en", source_hash: receipt.sourceHash, provider: receipt.provider,
          model: candidate.provenance.translatorModel, reviewer_model: candidate.provenance.reviewerModel,
          translator_request_id: candidate.provenance.translatorRequestId, reviewer_request_id: candidate.provenance.reviewerRequestId,
          working_draft_id: result.draftId, operation_id: receipt.operationId, job_id: receipt.jobId,
          persistence: result.persistence, human_review: "pending" } });
      if (result.persistence === "working-draft") {
        const draft = await readPremiumTranslationWorkingDraft(input.supabase, receipt);
        if (!draft) return { state: "skipped" as const, error: "translation_retry_blocked", errorCode: "translation_retry_blocked" as const,
          operation: input.operation.operation() };
        if (draft.id !== result.draftId) return { state: "conflict" as const, error: "write_conflict", errorCode: "write_conflict" as const,
          operation: input.operation.operation() };
        if (draft.entityType !== receipt.entityType || draft.version !== result.draftVersion || draft.candidateHash !== result.candidateHash ||
          draft.sourceHash !== receipt.sourceHash || !samePremiumTranslationJson(draft.sourceSnapshot, artifact.sourceSnapshot) ||
          !samePremiumTranslationJson(draft.sourceRevision, artifact.sourceRevision) || !samePremiumTranslationJson(draft.targetRevision, artifact.targetRevision) ||
          !samePremiumTranslationJson(draft.payload, candidate.payload) || !samePremiumTranslationJson(draft.provenance, candidate.provenance)) return unknown();
        if (result.state === "translated") return { state: "translated" as const, ...premiumTranslationCandidateOutcome(draft),
          model: candidate.provenance.translatorModel, reviewerModel: candidate.provenance.reviewerModel, operation: input.operation.operation() };
      }
    }
    return { state: result.state === "translated" ? "unconfirmed" as const : result.state,
      ...(result.errorCode ? { error: result.errorCode, errorCode: result.errorCode } : {}),
      model: receipt.configuration.model, reviewerModel: receipt.configuration.reviewerModel, operation: input.operation.operation() };
  } catch (error) { unstable_rethrow(error); return unknown(); }
}

/** Catalog-only coordination of the existing operational journal and private artifacts. */
export function createCatalogTranslationOperation(input: {
  supabase: SupabaseClient; intent: CatalogTranslationOperationIntent;
  candidateFromArtifacts: (artifact: CatalogTranslationOperationArtifacts) => Promise<CatalogTranslationOperationCandidate | null>;
  onAdmission?: (receipt: CatalogTranslationOperationReceipt) => Promise<void>;
}) {
  const { supabase, intent } = input;
  let latest: CatalogTranslationOperationReceipt | null = null;
  let admitted = false, beginAttempted = false, runtimeStopped = false;
  let prepared: CatalogTranslationOperationCandidate | null = null;
  const recorded = new Map<string, TranslationProviderResponseMetadata>();
  const unconfirmed = () => new CatalogTranslationOperationRpcError("translation_retry_unconfirmed");
  const observe = (receipt: CatalogTranslationOperationReceipt) => { latest = receipt; return receipt; };
  const operation = (): CatalogTranslationOperation => ({
    jobId: latest?.jobId ?? intent.jobId, itemId: latest?.itemId ?? intent.itemId,
    operationId: latest?.operationId ?? intent.operationId, receipt: latest,
  });
  async function readArtifacts() {
    if (!latest || latest.actorId.toLowerCase() !== intent.actorId.toLowerCase()) throw unconfirmed();
    const artifact = await getCatalogTranslationOperationArtifacts(supabase, latest);
    observe(artifact.receipt);
    return artifact;
  }
  async function lookupExact() {
    const receipt = await reconcileCatalogTranslationOperation(supabase, intent, latest?.operationId ?? intent.operationId);
    if (receipt) observe(receipt);
    return receipt;
  }
  async function admit() {
    if (!(await catalogTranslationOperationReady(supabase))) {
      throw new CatalogTranslationOperationRpcError("translation_migration_required", true);
    }
    const previous = await reconcileCatalogTranslationOperation(supabase, intent);
    if (previous && (previous.phase !== "finished" ||
      (previous.sourceHash === intent.sourceHash && (previous.providerCalls > 0 || previous.result?.candidateHash !== null)))) {
      observe(previous);
      return false;
    }
    beginAttempted = true;
    const receipt = observe(await beginCatalogTranslationOperation(supabase, intent));
    if (!receipt.canExecute) return false;
    const artifact = await readArtifacts();
    if (!catalogTranslationReceiptMatchesIntent(receipt, intent) || artifact.calls.length !== 0 || artifact.candidate !== null ||
      !samePremiumTranslationJson(artifact.sourceSnapshot, intent.sourceSnapshot) ||
      !samePremiumTranslationJson(artifact.expectedState, intent.expectedState)) throw unconfirmed();
    await input.onAdmission?.(receipt);
    admitted = true;
    return true;
  }
  const providerJournal: TranslationProviderCallJournal = {
    async beforeDispatch(call) {
      if (!admitted || !latest || !call.requestHash || !/^[a-f0-9]{64}$/u.test(call.requestHash)) throw unconfirmed();
      if (!(await premiumTranslationRuntimeGate(supabase))) {
        runtimeStopped = true;
        throw new CatalogTranslationOperationRpcError("translation_not_configured", true);
      }
      const callId = crypto.randomUUID();
      const receipt = observe(await dispatchCatalogTranslationOperation(supabase, latest, { ...call, requestHash: call.requestHash, callId }));
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
        const receipt = observe(await recordCatalogTranslationOperationResponse(supabase, latest, metadata, body));
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
  function outcome(artifact: CatalogTranslationOperationArtifacts, status: CatalogTranslationOperationOutcome["status"],
    errorCode?: CatalogTranslationOperationOutcome["errorCode"]): CatalogTranslationOperationOutcome {
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
  async function finishCandidate(artifact: CatalogTranslationOperationArtifacts, candidate: CatalogTranslationOperationCandidate) {
    prepared = candidate;
    try {
      return observe(await finishCatalogTranslationOperation(supabase, artifact.receipt, outcome(artifact, "succeeded"), candidate));
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
    if (latest.phase === "finished" || latest.pendingCallId !== null || latest.providerCalls < 1) return latest;
    const artifact = await readArtifacts();
    const candidate = await input.candidateFromArtifacts(artifact);
    return candidate ? finishCandidate(artifact, candidate) : latest;
  }
  async function recoverExisting(receipt: CatalogTranslationOperationReceipt) {
    // Observation grants no dispatch authority. A scan may recover a complete
    // retained answer even when today's source or runtime configuration changed.
    if (!parseCatalogTranslationOperationReceipt(receipt, intent, intent) ||
      !catalogTranslationReceiptMatchesIntent(receipt, intent)) throw unconfirmed();
    observe(receipt);
    const current = await lookupExact();
    if (!current) throw unconfirmed();
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
        const status = runtimeStopped ? "not-configured" : admitted && error instanceof CatalogTranslationOperationRpcError &&
          error.confirmedRefusal && error.errorCode === "write_conflict" ? "conflict" : "skipped";
        return observe(await finishCatalogTranslationOperation(supabase, artifact.receipt,
          outcome(artifact, status, status === "not-configured" ? "translation_not_configured" : status === "conflict" ? "write_conflict" : undefined)));
      }
    } catch (finishError) { unstable_rethrow(finishError); }
    return latest;
  }
  return { admit, providerJournal, responseArtifacts, complete, recoverCandidate, recoverExisting, failed, readArtifacts, operation,
    get admitted() { return admitted; }, get receipt() { return latest; } };
}
