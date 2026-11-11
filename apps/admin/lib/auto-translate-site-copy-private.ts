import type { SupabaseClient } from "@supabase/supabase-js";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";

import { translateSiteCopyBatchToEnglish, translationSourceHash, validateRetainedSiteCopyTranslation } from "./auto-translate-site-copy";
import { adminEnv } from "./env";
import { premiumTranslationConfigurationIdentity } from "./premium-translation-probe";
import { premiumTranslationRuntimeMetadata } from "./premium-translation-runtime";
import {
  PremiumTranslationDraftError, premiumTranslationCandidateOutcome, readPremiumTranslationWorkingDraft,
  samePremiumTranslationJson,
  type PremiumTranslationCandidateOutcome,
} from "./premium-translation-working-draft";
import {
  siteCopyTranslationSource, validateSiteCopyTranslationCandidate, validSiteCopyTranslationKey,
} from "./site-copy-translation-contract";
import { createTranslationOperationBudget, TranslationOperationBudgetError, type TranslationOperationBudget,
  type TranslationOperationBudgetStop } from "./translation-operation-budget";
import { premiumTranslationRuntimeGate } from "./translation-runtime-gate";
import { translationErrorCode, type TranslationErrorCode } from "./translation-errors";
import { createSiteCopyTranslationOperation, retainedSiteCopyTranslationPass, type SiteCopyTranslationOperation } from "./site-copy-translation-operation";
import { SiteCopyTranslationOperationRpcError, reconcileSiteCopyTranslationOperation, siteCopyTranslationConfigurationSchema,
  type SiteCopyTranslationOperationArtifacts, type SiteCopyTranslationOperationCandidate,
  type SiteCopyTranslationOperationReceipt } from "./site-copy-translation-operation-rpc";

const blockSchema = z.object({
  id: z.string().uuid(), updated_at: z.string().datetime({ offset: true }),
  settings: z.record(z.string(), z.unknown()),
});

export type SiteCopyTranslationState = "translated" | "review-pending" | "stale" | "current" |
  "manual" | "skipped" | "not-configured" | "conflict" | "not-ready" | "failed" | "unconfirmed" | "cancelled";

export type SiteCopyTranslationResult = {
  state: SiteCopyTranslationState;
  model?: string;
  reviewerModel?: string | null;
  error?: string;
  translatedItems?: number;
  sourceFreshness?: "current" | "stale" | "unknown";
  errorCode?: TranslationErrorCode;
  operation?: SiteCopyTranslationOperation;
  budgetStop?: TranslationOperationBudgetStop;
} & Partial<PremiumTranslationCandidateOutcome>;

async function readSiteCopyBlock(supabase: SupabaseClient) {
  try {
    const response = await supabase.from("homepage_blocks").select("id,settings,updated_at")
      .contains("settings", { systemKey: "site-copy-overrides" })
      .order("updated_at", { ascending: false }).limit(2);
    unstable_rethrow(response?.error);
    const parsed = z.array(blockSchema).length(1).safeParse(response?.data);
    return response && !response.error && parsed.success ? parsed.data[0] : null;
  } catch (error) {
    unstable_rethrow(error);
    return null;
  }
}

/** Rebuild the original selected projection without consulting today's CMS or runtime. */
async function siteCopyTranslationArtifactSource(artifact: SiteCopyTranslationOperationArtifacts) {
  try {
    const original = artifact.rawSeed.block;
    if (artifact.receipt.entityType !== "site_copy" || artifact.rawSeed.version !== 1 || artifact.expectedState.version !== 1 ||
      original.id.toLowerCase() !== artifact.receipt.entityId.toLowerCase() ||
      artifact.expectedState.block.id.toLowerCase() !== artifact.receipt.entityId.toLowerCase() ||
      !samePremiumTranslationJson(artifact.sourceRevision, artifact.receipt.sourceRevision) ||
      !samePremiumTranslationJson(artifact.targetRevision, artifact.receipt.targetRevision) ||
      !samePremiumTranslationJson(artifact.configuration, artifact.receipt.configuration) ||
      !samePremiumTranslationJson(original.settings, artifact.sourceSnapshot.settings) ||
      !samePremiumTranslationJson(artifact.expectedState.block.settings, original.settings)) return null;
    const source = await siteCopyTranslationSource(original.settings);
    const items = artifact.sourceSnapshot.items;
    const selectedKeys = new Set(items.map(item => item.key));
    if (!samePremiumTranslationJson(source.items.filter(item => selectedKeys.has(item.key)).slice(0, 50), items) ||
      await translationSourceHash(items) !== artifact.receipt.sourceHash) return null;
    return items;
  } catch (error) { unstable_rethrow(error); return null; }
}

export async function retainedSiteCopyTranslationCandidate(
  artifact: SiteCopyTranslationOperationArtifacts
): Promise<SiteCopyTranslationOperationCandidate | null> {
  try {
    const items = await siteCopyTranslationArtifactSource(artifact);
    if (!items) return null;
    const pass = retainedSiteCopyTranslationPass(artifact);
    if (!pass) return null;
    // The original provider validator trims the received output. Reuse it so
    // retained responses follow exactly the same validation as a live result.
    const payload = validateSiteCopyTranslationCandidate(items, validateRetainedSiteCopyTranslation(items, pass.value));
    return { payload, provenance: pass.provenance, translatorCallId: pass.translatorCallId, reviewerCallId: pass.reviewerCallId };
  } catch (error) { unstable_rethrow(error); return null; }
}

export type SiteCopyTranslationInput = {
  supabase: SupabaseClient;
  actorId: string;
  blockId?: string;
  /** An addressed operation is observation/recovery only; it never starts new work. */
  operationId?: string;
  /** A browser-created fresh command UUID; replaying it only observes its original operation. */
  operationIntent?: string;
  runtimeApproved?: boolean;
  keys?: readonly string[];
  operationBudget?: TranslationOperationBudget;
  operationAdmission?: (receipt: SiteCopyTranslationOperationReceipt) => Promise<void>;
};

/** One bounded provider batch; successful output is retained outside canonical copy. */
export async function ensureSiteCopyEnglishTranslation(input: SiteCopyTranslationInput): Promise<SiteCopyTranslationResult> {
  if ((input.blockId !== undefined && !z.string().uuid().safeParse(input.blockId).success) ||
      (input.operationId !== undefined && !z.string().uuid().safeParse(input.operationId).success) ||
      (input.operationIntent !== undefined && !z.string().uuid().safeParse(input.operationIntent).success) ||
      (input.operationId !== undefined && input.operationIntent !== undefined) ||
      !z.string().uuid().safeParse(input.actorId).success ||
      (input.keys && (new Set(input.keys).size !== input.keys.length ||
        input.keys.some(key => !validSiteCopyTranslationKey(key))))) {
    return { state: "failed", error: "Invalid site-copy translation identity" };
  }
  let operation: ReturnType<typeof createSiteCopyTranslationOperation> | null = null;
  let history: { receipt: SiteCopyTranslationOperationReceipt; result: SiteCopyTranslationResult } | null = null;
  const unconfirmed = (): SiteCopyTranslationResult => ({ state: "unconfirmed", error: "translation_retry_pending",
    errorCode: "translation_retry_pending", ...(operation ? { operation: operation.operation() } : {}) });
  const coordinator = (existing: SiteCopyTranslationOperationReceipt) => createSiteCopyTranslationOperation({
    supabase: input.supabase, actorId: input.actorId, existing,
    validateArtifacts: async artifact => Boolean(await siteCopyTranslationArtifactSource(artifact)),
    candidateFromArtifacts: retainedSiteCopyTranslationCandidate,
  });
  async function fromReceipt(receipt: SiteCopyTranslationOperationReceipt | null, repeated: boolean): Promise<SiteCopyTranslationResult> {
    if (!receipt || !operation || receipt.actorId.toLowerCase() !== input.actorId.toLowerCase() ||
      receipt.phase !== "finished" || !receipt.result) return unconfirmed();
    const result = receipt.result;
    try {
      if (result.candidateHash !== null) {
        const artifact = await operation.readArtifacts();
        const candidate = await retainedSiteCopyTranslationCandidate(artifact);
        if (!candidate || !samePremiumTranslationJson(artifact.candidate, candidate)) return unconfirmed();
        const payload = validateSiteCopyTranslationCandidate(artifact.sourceSnapshot.items, candidate.payload);
        const base = { operation: operation.operation(), translatedItems: payload.items.length,
          model: candidate.provenance.translatorModel, reviewerModel: candidate.provenance.reviewerModel };
        if (result.persistence === "working-draft") {
          const draft = await readPremiumTranslationWorkingDraft(input.supabase, receipt);
          if (!draft) return { state: "skipped", ...base, error: "translation_retry_blocked", errorCode: "translation_retry_blocked" };
          if (draft.id !== result.draftId) return { state: "conflict", ...base, error: "write_conflict", errorCode: "write_conflict" };
          if (draft.entityType !== "site_copy" || draft.version !== result.draftVersion || draft.candidateHash !== result.candidateHash ||
            draft.sourceHash !== receipt.sourceHash || !samePremiumTranslationJson(draft.sourceSnapshot, artifact.sourceSnapshot) ||
            !samePremiumTranslationJson(draft.sourceRevision, artifact.sourceRevision) || !samePremiumTranslationJson(draft.targetRevision, artifact.targetRevision) ||
            !samePremiumTranslationJson(draft.payload, candidate.payload) || !samePremiumTranslationJson(draft.provenance, candidate.provenance)) return unconfirmed();
          if (!repeated && !receipt.replayed) await input.supabase.from("admin_audit_log").insert({
            actor_id: input.actorId, action: "site_copy.auto_translation.staged", entity_type: "site_copy", entity_id: receipt.entityId,
            metadata: { translated: payload.items.length, source_hash: receipt.sourceHash, working_draft_id: draft.id,
              candidate_hash: draft.candidateHash, model: candidate.provenance.translatorModel,
              reviewer_model: candidate.provenance.reviewerModel, translator_request_id: candidate.provenance.translatorRequestId,
              reviewer_request_id: candidate.provenance.reviewerRequestId, operation_id: receipt.operationId, job_id: receipt.jobId },
          });
          return { state: repeated ? "review-pending" : result.state, ...premiumTranslationCandidateOutcome(draft), ...base,
            ...(result.errorCode ? { error: result.errorCode, errorCode: result.errorCode } : {}) };
        }
        return { state: result.state === "translated" ? "unconfirmed" : result.state, ...base,
          humanReview: "pending", publication: "unchanged", ...(result.errorCode ? { error: result.errorCode, errorCode: result.errorCode } : {}) };
      }
      return { state: result.state === "translated" ? "unconfirmed" : result.state, operation: operation.operation(),
        ...(result.errorCode ? { error: result.errorCode, errorCode: result.errorCode } : {}) };
    } catch (error) { unstable_rethrow(error); return unconfirmed(); }
  }
  // Logical metadata is deliberately read before the current block, feature
  // flag, provider configuration, pending classification or expense budget.
  try {
    const requested = input.operationId ?? input.operationIntent ?? null;
    const previous = await reconcileSiteCopyTranslationOperation(input.supabase, requested);
    if (previous) {
      operation = coordinator(previous);
      if ((requested && previous.operationId.toLowerCase() !== requested.toLowerCase()) ||
        previous.phase !== "finished" && previous.actorId.toLowerCase() !== input.actorId.toLowerCase()) return unconfirmed();
      if (previous.actorId.toLowerCase() !== input.actorId.toLowerCase()) {
        // Terminal foreign metadata grants no body read. Current pending/manual
        // guards and the new native BEGIN still arbitrate any later fresh work.
        if (requested) return unconfirmed();
        history = { receipt: previous, result: unconfirmed() };
        operation = null;
      } else {
      if (previous.phase !== "finished") return fromReceipt(await operation.recoverExisting(previous), true);
      if (requested) return fromReceipt(previous, true);
      if (previous.result?.candidateHash !== null) {
        const result = await fromReceipt(previous, true);
        if (result.state === "unconfirmed" || result.translationPersistence === "working-draft" || result.state === "conflict") return result;
        history = { receipt: previous, result };
      }
      operation = null;
      }
    } else if (input.operationId) {
      return { state: "skipped", error: "translation_retry_blocked", errorCode: "translation_retry_blocked" };
    }
  } catch (error) {
    unstable_rethrow(error);
    const errorCode = error instanceof SiteCopyTranslationOperationRpcError ? error.errorCode : translationErrorCode(error);
    return { ...unconfirmed(), ...(errorCode === "translation_migration_required" ? { state: "not-ready" as const } : {}), error: errorCode, errorCode };
  }
  if (!adminEnv.openAiAutoTranslateSiteCopy) return history?.result ?? { state: "not-configured", errorCode: "translation_not_configured" };
  try {
    if (!input.runtimeApproved && !(await premiumTranslationRuntimeGate(input.supabase))) {
      return history?.result ?? { state: "not-configured", errorCode: "translation_not_configured" };
    }
  } catch (error) { unstable_rethrow(error); if (history) return history.result; throw error; }
  const block = await readSiteCopyBlock(input.supabase);
  if (!block || (input.blockId && block.id.toLowerCase() !== input.blockId.toLowerCase())) {
    return history?.result ?? { state: "failed", error: "Site-copy source could not be read" };
  }
  let source: Awaited<ReturnType<typeof siteCopyTranslationSource>>;
  try { source = await siteCopyTranslationSource(block.settings); }
  catch (error) {
    unstable_rethrow(error);
    return history?.result ?? { state: "failed", error: "Site-copy source or English ownership is ambiguous" };
  }
  const targetRevision = { id: block.id, updatedAt: block.updated_at };
  try {
    const pending = await readPremiumTranslationWorkingDraft(input.supabase, {
      entityType: "site_copy", entityId: block.id,
    });
    if (pending) {
      if (pending.entityType !== "site_copy") throw new PremiumTranslationDraftError("unconfirmed");
      const liveByKey = new Map(source.items.map(item => [item.key, item]));
      if (!samePremiumTranslationJson(pending.sourceSnapshot.settings, block.settings) ||
          pending.sourceHash !== await translationSourceHash(pending.sourceSnapshot.items) ||
          pending.sourceSnapshot.items.some(item => !samePremiumTranslationJson(item, liveByKey.get(item.key)))) {
        return { state: "stale", error: "Site-copy source changed; review or discard the saved private candidate" };
      }
      if (!samePremiumTranslationJson(pending.targetRevision, targetRevision)) {
        return { state: "conflict", error: "Site-copy revision changed after the private candidate was saved" };
      }
      validateSiteCopyTranslationCandidate(pending.sourceSnapshot.items, pending.payload);
      return { state: "review-pending", ...premiumTranslationCandidateOutcome(pending),
        translatedItems: pending.payload.items.length, model: pending.provenance.translatorModel,
        reviewerModel: pending.provenance.reviewerModel };
    }
  } catch (error) {
    unstable_rethrow(error);
    return { state: "not-ready", error: "Private translation drafts are unavailable or unconfirmed" };
  }
  const selectedKeys = input.keys ? new Set(input.keys) : null;
  const items = source.items.filter(item => !selectedKeys || selectedKeys.has(item.key)).slice(0, 50);
  if (!items.length) {
    return { state: source.manual ? "manual" : source.current ? "current" : "skipped" };
  }
  const operationBudget = input.operationBudget ?? createTranslationOperationBudget({
    maxAttempts: 1, maxProviderCalls: 4, deadlineMs: 45_000,
  });
  const runtime = premiumTranslationRuntimeMetadata();
  const providerCallsBefore = operationBudget.snapshot().providerCalls;
  let attemptStarted = false;
  try {
    const identity = await premiumTranslationConfigurationIdentity({ review: runtime.twoPassReview });
    const configuration = siteCopyTranslationConfigurationSchema.parse({ ...identity.configuration,
      schemaName: "probpera_site_copy_translation", maxOutputTokens: 12_000 });
    const intent = { jobId: crypto.randomUUID(), itemId: crypto.randomUUID(), operationId: input.operationIntent ?? crypto.randomUUID(),
      actorId: input.actorId, entityType: "site_copy" as const, entityId: block.id, provider: runtime.provider,
      sourceHash: await translationSourceHash(items), sourceRevision: { blockId: block.id, blockUpdatedAt: block.updated_at },
      targetRevision, sourceSnapshot: { settings: block.settings, items },
      expectedState: { version: 1, block: { id: block.id, settings: block.settings, updated_at: block.updated_at } }, configuration };
    if (history && history.receipt.sourceHash === intent.sourceHash &&
      samePremiumTranslationJson(history.receipt.configuration, intent.configuration)) return history.result;
    operation = createSiteCopyTranslationOperation({ supabase: input.supabase, actorId: input.actorId, intent,
      allowNewFinished: Boolean(input.operationIntent),
      onAdmission: input.operationAdmission, validateArtifacts: async artifact => Boolean(await siteCopyTranslationArtifactSource(artifact)),
      candidateFromArtifacts: retainedSiteCopyTranslationCandidate });
    if (!(await operation.admit())) return fromReceipt(await operation.recoverCandidate(), true);
    operationBudget.startAttempt();
    attemptStarted = true;
    const translated = await translateSiteCopyBatchToEnglish(items.map(({ key, text }) => ({ key, text })), {
      operationBudget, providerJournal: operation.providerJournal, responseArtifacts: operation.responseArtifacts,
    });
    if (!translated) return { state: "skipped" };
    const payload = validateSiteCopyTranslationCandidate(items, translated.value);
    const latest = await readSiteCopyBlock(input.supabase);
    const sourceFreshness = !latest ? "unknown" : latest.id !== block.id || latest.updated_at !== block.updated_at ||
      !samePremiumTranslationJson(latest.settings, block.settings) ? "stale" : "current";
    // Retain an already received result even if its source changed. Promotion,
    // unlike private staging, still requires the exact live source and target.
    const result = await fromReceipt(await operation.complete(payload), false);
    return { ...result, ...(result.translationPersistence === "working-draft" && sourceFreshness === "stale" ? { state: "stale" as const } : {}), sourceFreshness,
      ...(sourceFreshness === "unknown" ? { error: "Private candidate retained; current source freshness could not be confirmed" } : {}) };
  } catch (error) {
    unstable_rethrow(error);
    if (!operation && history) return history.result;
    const receipt = operation ? await operation.failed(error) : null;
    if (receipt?.phase === "finished" && receipt.result?.candidateHash !== null) return fromReceipt(receipt, false);
    if (error instanceof TranslationOperationBudgetError) {
      return { state: "failed", error: error.message, errorCode: "translation_operation_stopped",
        ...(operation ? { operation: operation.operation() } : {}),
        budgetStop: { reason: error.reason, attemptStarted, providerCalls: operationBudget.snapshot().providerCalls - providerCallsBefore } };
    }
    if (operation?.receipt && receipt?.phase !== "finished") return unconfirmed();
    if (error instanceof PremiumTranslationDraftError && error.code === "conflict") {
      return { state: "conflict", error: "Site-copy source changed while the private translation was being saved" };
    }
    const errorCode = error instanceof SiteCopyTranslationOperationRpcError ? error.errorCode : translationErrorCode(error);
    if (errorCode === "translation_retry_unconfirmed" || errorCode === "translation_retry_pending") {
      return { ...unconfirmed(), error: errorCode, errorCode };
    }
    return { state: errorCode === "translation_migration_required" ? "not-ready" : errorCode === "translation_not_configured" ? "not-configured"
      : errorCode === "write_conflict" ? "conflict" : "failed",
      error: errorCode, errorCode, ...(operation ? { operation: operation.operation() } : {}) };
  }
}
