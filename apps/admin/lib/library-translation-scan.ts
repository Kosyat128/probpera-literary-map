import type { SupabaseClient } from "@supabase/supabase-js";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";

import { ensureLiteraryWorkEnglishTranslation } from "./auto-translate-literary-work-safe";
import { retainedLiteraryWorkTranslationCandidate, type LiteraryWorkAutoTranslationResult } from "./auto-translate-literary-work";
import { createCatalogTranslationOperation } from "./catalog-translation-operation";
import { catalogTranslationConfigurationSchema, getCatalogTranslationOperationArtifacts,
  type CatalogTranslationConfiguration, type CatalogTranslationOperationReceipt } from "./catalog-translation-operation-rpc";
import { adminEnv } from "./env";
import { premiumTranslationConfigurationIdentity } from "./premium-translation-probe";
import { premiumTranslationRuntimeMetadata } from "./premium-translation-runtime";
import { samePremiumTranslationJson } from "./premium-translation-working-draft";
import { profileTranslationBudgetReadiness } from "./translation-profile-budget-readiness";
import { premiumTranslationRuntimeGate } from "./translation-runtime-gate";
import { createTranslationOperationBudget, type TranslationOperationBudgetReason } from "./translation-operation-budget";
import type { TranslationErrorCode } from "./translation-errors";
import { LibraryTranslationScanRpcError, attachLibraryTranslationScanOperation, beginLibraryTranslationScan,
  checkpointLibraryTranslationScanItem, continueLibraryTranslationScan, getLibraryTranslationScan,
  type LibraryTranslationScanObservation, type LibraryTranslationScanReceipt } from "./library-translation-scan-rpc";

const uuid = z.string().uuid();
const sameId = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const stopped = (receipt: LibraryTranslationScanReceipt) => receipt.status === "cancelled" || receipt.status === "cancelling";
export const libraryTranslationScanOrdinal = (receipt: LibraryTranslationScanReceipt) => receipt.windowIndex * 500 + receipt.nextPosition;

/** A lost acknowledgement repeats the same transition, never a model request. */
async function confirmTransition<T>(request: () => Promise<T>): Promise<T> {
  try { return await request(); }
  catch (error) {
    unstable_rethrow(error);
    if (error instanceof LibraryTranslationScanRpcError && error.databaseCode !== null) throw error;
    return request();
  }
}

async function configuration(client: SupabaseClient): Promise<CatalogTranslationConfiguration> {
  if (!adminEnv.openAiAutoTranslateLibrary || !(await premiumTranslationRuntimeGate(client))) {
    throw new LibraryTranslationScanRpcError("translation_not_configured");
  }
  const readiness = await profileTranslationBudgetReadiness(client);
  if (readiness) throw new LibraryTranslationScanRpcError(readiness);
  const response = await client.rpc("premium_machine_translation_ready");
  unstable_rethrow(response.error);
  if (response.error || response.data !== true) throw new LibraryTranslationScanRpcError("translation_migration_required");
  const runtime = premiumTranslationRuntimeMetadata();
  const identity = await premiumTranslationConfigurationIdentity({ review: runtime.twoPassReview });
  return catalogTranslationConfigurationSchema.parse({ ...identity.configuration,
    schemaName: "probpera_literary_work_translation", maxOutputTokens: 4_000 });
}

/** Recover a complete retained answer without reading today's mutable source or runtime. */
async function recoverChild(client: SupabaseClient, parent: LibraryTranslationScanReceipt, actorId: string) {
  const child = parent.child?.receipt;
  if (!child || child.phase === "finished" || !sameId(child.actorId, actorId) || child.pendingCallId !== null) return child;
  const artifact = await getCatalogTranslationOperationArtifacts(client, child);
  const operation = createCatalogTranslationOperation({ supabase: client, intent: {
    jobId: child.jobId, itemId: child.itemId, operationId: child.operationId, actorId: child.actorId,
    entityType: child.entityType, entityId: child.entityId, provider: child.provider, sourceHash: child.sourceHash,
    sourceSnapshot: artifact.sourceSnapshot, sourceRevision: artifact.sourceRevision, targetRevision: artifact.targetRevision,
    expectedState: artifact.expectedState, configuration: artifact.configuration, currentCursor: {}, resumeCursor: child.resumeCursor,
  }, candidateFromArtifacts: retainedLiteraryWorkTranslationCandidate });
  const recovered = await operation.recoverExisting(artifact.receipt);
  // A zero-call admission can be safely released under the existing cache lock.
  // A concurrent dispatch wins that lock or is refused before any external call.
  if (recovered?.phase !== "finished" && recovered?.providerCalls === 0 && recovered.pendingCallId === null) {
    return operation.failed(new LibraryTranslationScanRpcError("translation_retry_pending"));
  }
  return recovered;
}

function freeObservation(result: LiteraryWorkAutoTranslationResult): LibraryTranslationScanObservation | null {
  const state = result.state;
  if (state === "failed" && result.error === "literary work not found" ||
    state === "skipped" && result.error === "reviewed Russian translation is required") {
    // Only a known snapshot member reaches this path. The checkpoint verifies
    // actual source absence under its entity lock before accepting this reason.
    return { version: 1, type: "free", state: "skipped", reason: "source_missing", sourceHash: null };
  }
  if (state === "manual" || state === "current" || state === "review-pending" || state === "stale" || state === "skipped" || state === "failed") {
    return { version: 1, type: "free", state,
      reason: state === "review-pending" ? "existing_candidate" : state === "failed" ? "database_read_failed"
        : state === "skipped" ? "ineligible" : null, sourceHash: null };
  }
  return null;
}

export async function runLibraryTranslationScan(input: {
  supabase: SupabaseClient; actorId: string; jobId?: string | null; scanIntent?: string | null; legacyCursor?: string | number | null;
}) {
  const client = input.supabase;
  const budget = createTranslationOperationBudget({ maxAttempts: 4, maxProviderCalls: 16, deadlineMs: 300_000 });
  let receipt: LibraryTranslationScanReceipt | null = null;
  let paidOutcomeUnconfirmed = false;
  let recoveryJobId = uuid.safeParse(input.scanIntent || input.jobId).success ? (input.scanIntent || input.jobId)! : null;
  let processed = 0, translated = 0, reviewPending = 0, stale = 0, current = 0, manual = 0, skipped = 0, failed = 0;
  let errorCode: TranslationErrorCode | null = null, stopReason: TranslationOperationBudgetReason | null = null;
  const checkpoint = async (observation: LibraryTranslationScanObservation, operationId: string | null = null) => {
    const before = receipt!;
    const transition = crypto.randomUUID();
    receipt = await confirmTransition(() => checkpointLibraryTranslationScanItem(client, before, transition, observation, operationId));
    return receipt.nextPosition === before.nextPosition + 1;
  };
  const account = (state: LiteraryWorkAutoTranslationResult["state"]) => {
    processed++;
    if (state === "translated") translated++;
    else if (state === "review-pending") reviewPending++;
    else if (state === "stale") stale++;
    else if (state === "current") current++;
    else if (state === "manual") manual++;
    else if (state === "failed" || state === "conflict") failed++;
    else skipped++;
  };
  const observeChild = async () => {
    if (!receipt?.child) return false;
    const child = receipt.child.receipt;
    paidOutcomeUnconfirmed = child.providerCalls > 0;
    if (receipt.child.binding !== "attached") {
      // An existing operation is an identity hold, never permission to borrow it.
      // Its owner may finish a complete retained body (or release zero calls),
      // but that historical paid attempt is never attached to this scan.
      const recovered = await recoverChild(client, receipt, input.actorId);
      if (recovered?.phase === "finished") {
        receipt = await getLibraryTranslationScan(client, receipt.jobId);
        if (receipt.child === null) { paidOutcomeUnconfirmed = false; return false; }
        if (receipt.child.receipt.phase === "finished" && sameId(receipt.child.receipt.operationId, child.operationId)) {
          // A persisted historical hold becomes one free logical observation.
          // Native metadata derives the outcome; Continue never retries its cost.
          const advanced = await checkpoint({ version: 1, type: "child-terminal" }, child.operationId);
          if (advanced) { account(recovered.result?.state ?? "skipped"); paidOutcomeUnconfirmed = false; }
          errorCode = advanced ? null : stopped(receipt!) ? "translation_operation_stopped" : "translation_retry_pending";
          return !advanced;
        }
      }
      errorCode = "translation_retry_pending";
      return true;
    }
    const recovered = await recoverChild(client, receipt, input.actorId);
    const advanced = await checkpoint({ version: 1, type: "child-terminal" }, child.operationId);
    if (advanced) { account(recovered?.result?.state ?? child.result?.state ?? "skipped"); paidOutcomeUnconfirmed = false; }
    errorCode = advanced ? null : stopped(receipt!) ? "translation_operation_stopped" : "translation_retry_pending";
    return !advanced;
  };
  try {
    if (input.scanIntent && !uuid.safeParse(input.scanIntent).success) throw new LibraryTranslationScanRpcError("invalid_input");
    if (input.scanIntent) {
      try { receipt = await getLibraryTranslationScan(client, input.scanIntent); }
      catch (error) {
        unstable_rethrow(error);
        if (!(error instanceof LibraryTranslationScanRpcError) || error.databaseCode !== "P0002") throw error;
      }
      if (receipt) {
        if (!sameId(receipt.actorId, input.actorId)) throw new LibraryTranslationScanRpcError("translation_retry_blocked");
        if (await observeChild()) return result();
        if (stopped(receipt)) throw new LibraryTranslationScanRpcError("translation_operation_stopped");
        if (receipt.exhausted) throw new LibraryTranslationScanRpcError("translation_scan_complete");
      }
    }
    if (!input.scanIntent && input.jobId) {
      if (!uuid.safeParse(input.jobId).success) throw new LibraryTranslationScanRpcError("invalid_input");
      receipt = await getLibraryTranslationScan(client, input.jobId);
      if (!sameId(receipt.actorId, input.actorId)) throw new LibraryTranslationScanRpcError("translation_retry_blocked");
      if (await observeChild()) return result();
      if (stopped(receipt)) throw new LibraryTranslationScanRpcError("translation_operation_stopped");
      if (receipt.exhausted) throw new LibraryTranslationScanRpcError("translation_scan_complete");
    } else if (!input.scanIntent) {
      const rawCursor = String(input.legacyCursor ?? "0").trim();
      if (rawCursor !== "" && !/^0+$/u.test(rawCursor)) {
        throw new LibraryTranslationScanRpcError(/^\d+$/u.test(rawCursor) ? "translation_resume_stale" : "invalid_input");
      }
    }
    const config = await configuration(client);
    if (!receipt) {
      const scanId = input.scanIntent || crypto.randomUUID();
      recoveryJobId = scanId;
      receipt = await confirmTransition(() => beginLibraryTranslationScan(client, scanId, config));
      if (!sameId(receipt.actorId, input.actorId)) throw new LibraryTranslationScanRpcError("translation_retry_blocked");
    }
    let windowHops = 0;
    while (processed < 60 && windowHops < 60) {
      stopReason = budget.exhaustedReason();
      if (stopReason) break;
      // Read first: a concurrent or previously attached child pins the identity
      // before any feature/source/config eligibility check or cursor movement.
      receipt = await getLibraryTranslationScan(client, receipt.jobId);
      if (await observeChild()) break;
      if (stopped(receipt)) { errorCode = "translation_operation_stopped"; break; }
      if (receipt.exhausted) break;
      if (receipt.nextPosition === receipt.totalItems || receipt.successorJobId !== null) {
        const before: LibraryTranslationScanReceipt = receipt;
        receipt = await confirmTransition(() => continueLibraryTranslationScan(client, before, config));
        if (receipt.exhausted) break;
        if (sameId(receipt.jobId, before.jobId)) throw new LibraryTranslationScanRpcError("translation_scan_unconfirmed");
        windowHops++;
        continue;
      }
      // Native CONTINUE verifies configuration for an unfinished window too.
      const before: LibraryTranslationScanReceipt = receipt;
      receipt = await confirmTransition(() => continueLibraryTranslationScan(client, before, config));
      if (receipt.child) continue;
      if (stopped(receipt)) { errorCode = "translation_operation_stopped"; break; }
      stopReason = budget.exhaustedReason();
      if (stopReason) break;
      const member = receipt.members[receipt.nextPosition];
      if (!member) throw new LibraryTranslationScanRpcError("translation_scan_unconfirmed");
      const ordinal = libraryTranslationScanOrdinal(receipt);
      let attached: CatalogTranslationOperationReceipt | null = null;
      const translatedResult = await ensureLiteraryWorkEnglishTranslation({ supabase: client, actorId: input.actorId,
        workId: member.workId, runtimeApproved: true, operationBudget: budget,
        operationCursor: { current: { libraryCursor: ordinal }, next: { libraryCursor: ordinal + 1 } },
        operationAdmission: async child => {
          if (!samePremiumTranslationJson(child.configuration, config)) throw new LibraryTranslationScanRpcError("translation_resume_stale");
          const target = receipt!, transition = crypto.randomUUID();
          receipt = await confirmTransition(() => attachLibraryTranslationScanOperation(client, target, child, transition));
          attached = child;
        },
      });
      const child = translatedResult.operation?.receipt;
      paidOutcomeUnconfirmed = (child?.providerCalls ?? 0) > 0;
      let knownMissing = false;
      if (attached || child) {
        // Observe the server's formal linkage, including a lost attach ACK.
        receipt = await getLibraryTranslationScan(client, receipt.jobId);
        if (receipt.child?.binding === "attached" || child?.phase === "finished" &&
          (receipt.child === null || sameId(receipt.child.receipt.operationId, child.operationId))) {
          const terminalId = receipt.child?.receipt.operationId ?? child!.operationId;
          const advanced = await checkpoint({ version: 1, type: "child-terminal" }, terminalId);
          if (advanced) { account(child?.result?.state ?? translatedResult.state); paidOutcomeUnconfirmed = false; }
          else { errorCode = stopped(receipt) ? "translation_operation_stopped" : translatedResult.errorCode || "translation_retry_pending";
            stopReason = stopped(receipt) ? "stopped" : translatedResult.budgetStop?.reason ?? null; break; }
        } else { errorCode = translatedResult.errorCode || "translation_retry_pending"; break; }
      } else {
        if (translatedResult.budgetStop?.providerCalls === 0) { stopReason = translatedResult.budgetStop.reason; break; }
        const observation = freeObservation(translatedResult);
        if (!observation) { errorCode = translatedResult.errorCode || (translatedResult.state === "conflict" ? "write_conflict"
          : translatedResult.state === "not-ready" ? "translation_migration_required"
            : translatedResult.state === "not-configured" ? "translation_not_configured" : "translation_scan_unconfirmed"); break; }
        if (!(await checkpoint(observation))) { errorCode = "translation_retry_pending"; break; }
        knownMissing = observation.type === "free" && observation.reason === "source_missing";
        account(knownMissing ? "skipped" : translatedResult.state);
      }
      if (translatedResult.budgetStop) { stopReason = translatedResult.budgetStop.reason; break; }
      if (translatedResult.state === "failed" && !knownMissing) {
        errorCode = translatedResult.errorCode || "database_read_failed"; break;
      }
    }
    if (receipt && receipt.nextPosition === receipt.totalItems && !receipt.exhausted && !stopped(receipt) && !receipt.child) {
      const before: LibraryTranslationScanReceipt = receipt;
      receipt = await confirmTransition(() => continueLibraryTranslationScan(client, before, config));
    }
  } catch (error) {
    unstable_rethrow(error);
    errorCode = error instanceof LibraryTranslationScanRpcError && error.errorCode !== "translation_scan_unconfirmed"
      ? error.errorCode : paidOutcomeUnconfirmed ? "translation_retry_unconfirmed" : "translation_scan_unconfirmed";
  }
  return result();
  function result() { return { receipt, recoveryJobId: receipt?.jobId ?? recoveryJobId, processed, translated, reviewPending, stale, current, manual, skipped, failed,
    errorCode, budget: budget.snapshot(), stopReason }; }
}
