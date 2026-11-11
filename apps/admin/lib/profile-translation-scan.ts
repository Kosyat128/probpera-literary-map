import type { SupabaseClient } from "@supabase/supabase-js";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";

import { ensureCountryEnglishProfile, retainedCountryTranslationCandidate } from "./auto-translate-country-profile";
import { ensureWriterEnglishBiography, retainedWriterTranslationCandidate } from "./auto-translate-writer-biography";
import { createCatalogTranslationOperation } from "./catalog-translation-operation";
import { catalogTranslationConfigurationSchema, getCatalogTranslationOperationArtifacts,
  type CatalogTranslationOperationReceipt } from "./catalog-translation-operation-rpc";
import { createWriterTranslationOperation } from "./writer-translation-operation";
import { writerTranslationConfigurationSchema, getWriterTranslationOperationArtifacts,
  type WriterTranslationOperationReceipt } from "./writer-translation-operation-rpc";
import { loadEditorialCatalog, editorialCountry, editorialWriter, type EditorialCatalog } from "./editorial-catalog";
import { adminEnv } from "./env";
import { premiumTranslationConfigurationIdentity } from "./premium-translation-probe";
import { premiumTranslationRuntimeMetadata } from "./premium-translation-runtime";
import { samePremiumTranslationJson } from "./premium-translation-working-draft";
import { profileTranslationBudgetReadiness } from "./translation-profile-budget-readiness";
import { premiumTranslationRuntimeGate } from "./translation-runtime-gate";
import { createTranslationOperationBudget, type TranslationOperationBudgetReason } from "./translation-operation-budget";
import type { TranslationErrorCode } from "./translation-errors";
import { ProfileTranslationScanRpcError, attachProfileTranslationScanOperation, beginProfileTranslationScan,
  checkpointProfileTranslationScanItem, continueProfileTranslationScan, getProfileTranslationScan, profileTranslationScanOrdinal,
  type ProfileTranslationScanConfiguration, type ProfileTranslationScanKind, type ProfileTranslationScanManifest,
  type ProfileTranslationScanObservation, type ProfileTranslationScanPaidReceipt, type ProfileTranslationScanReceipt,
  type CountryProfileOperationReceipt } from "./profile-translation-scan-rpc";

const uuid = z.string().uuid();
const sameId = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const stopped = (r: ProfileTranslationScanReceipt) => r.status === "cancelled" || r.status === "cancelling";
type ProfileResult = Awaited<ReturnType<typeof ensureWriterEnglishBiography>> | Awaited<ReturnType<typeof ensureCountryEnglishProfile>>;

async function confirmTransition<T>(request: () => Promise<T>): Promise<T> {
  try { return await request(); }
  catch (error) {
    unstable_rethrow(error);
    if (error instanceof ProfileTranslationScanRpcError && error.databaseCode !== null) throw error;
    return request();
  }
}

/** Keep the existing opaque JavaScript hash; JSONB serialization is different. */
export async function profileScanCatalogSourceHash(value: Record<string, unknown>) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(value)));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}
const objectValue = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

/** Freeze the original candidate order exactly once, without a live ordinal. */
export async function profileTranslationScanManifest(kind: ProfileTranslationScanKind, catalog: EditorialCatalog): Promise<ProfileTranslationScanManifest> {
  if (kind === "country") {
    return Promise.all(catalog.countries.map(async country => ({ countryId: country.id,
      catalogSourceHash: await profileScanCatalogSourceHash(country.fields) })));
  }
  const manifest: Array<{ countryId: string; writerId: string; catalogSourceHash: string }> = [];
  for (const country of catalog.countries) for (const writer of country.writers) {
    const translations = objectValue(writer.fields.biographyTranslations);
    const ru = objectValue(translations.ru), en = objectValue(translations.en);
    const russianEligible = ru.locale === "ru" && ru.method === "editorial-original" &&
      new Set(["reviewed", "verified"]).has(String(ru.status)) && typeof ru.text === "string" &&
      ru.text.trim().length >= 120 && Array.isArray(ru.sources) && ru.sources.length > 0;
    const staticManualEnglish = en.locale === "en" && en.method !== "machine-translation" &&
      new Set(["reviewed", "verified"]).has(String(en.status));
    if (russianEligible && !staticManualEnglish) manifest.push({ countryId: country.id, writerId: writer.id,
      catalogSourceHash: await profileScanCatalogSourceHash(writer.fields) });
  }
  // The strict native adapter rejects >10000/4MiB atomically, never truncates.
  return manifest;
}

async function configuration(client: SupabaseClient, kind: ProfileTranslationScanKind): Promise<ProfileTranslationScanConfiguration> {
  if (!adminEnv.openAiAutoTranslateProfiles || !(await premiumTranslationRuntimeGate(client))) {
    throw new ProfileTranslationScanRpcError("translation_not_configured");
  }
  const readiness = await profileTranslationBudgetReadiness(client);
  if (readiness) throw new ProfileTranslationScanRpcError(readiness);
  const ready = await client.rpc("premium_machine_translation_ready");
  unstable_rethrow(ready.error);
  if (ready.error || ready.data !== true) throw new ProfileTranslationScanRpcError("translation_migration_required");
  const runtime = premiumTranslationRuntimeMetadata();
  const identity = await premiumTranslationConfigurationIdentity({ review: kind === "writer" || runtime.twoPassReview });
  return kind === "writer" ? writerTranslationConfigurationSchema.parse({ ...identity.configuration,
    schemaName: "probpera_writer_biography_translation", maxOutputTokens: 4_000 })
    : catalogTranslationConfigurationSchema.parse({ ...identity.configuration,
      schemaName: "probpera_country_profile_translation", maxOutputTokens: 12_000 });
}

/** Recovery reads the original private seed, before today's runtime/catalog. */
async function recoverChild(client: SupabaseClient, parent: ProfileTranslationScanReceipt, actorId: string): Promise<ProfileTranslationScanPaidReceipt | null> {
  const child = parent.child?.receipt;
  if (!child || child.phase === "finished" || !sameId(child.actorId, actorId) || child.pendingCallId !== null) return child ?? null;
  if ("writerId" in child) {
    const artifact = await getWriterTranslationOperationArtifacts(client, child);
    const operation = createWriterTranslationOperation({ supabase: client, intent: {
      jobId: child.jobId, itemId: child.itemId, operationId: child.operationId, actorId: child.actorId,
      countryId: child.countryId, writerId: child.writerId, provider: child.provider, sourceHash: child.sourceHash,
      sourceSnapshot: artifact.sourceSnapshot, sourceRevision: artifact.sourceRevision, targetRevision: artifact.targetRevision,
      expectedOverrideFields: artifact.expectedOverrideFields, configuration: artifact.configuration,
      currentCursor: {}, resumeCursor: child.resumeCursor,
    }, candidateFromArtifacts: retainedWriterTranslationCandidate });
    const recovered = await operation.recoverExisting(artifact.receipt);
    return recovered?.phase !== "finished" && recovered?.providerCalls === 0 && recovered.pendingCallId === null
      ? operation.failed(new ProfileTranslationScanRpcError("translation_retry_pending")) : recovered;
  }
  const artifact = await getCatalogTranslationOperationArtifacts(client, child);
  const operation = createCatalogTranslationOperation({ supabase: client, intent: {
    jobId: child.jobId, itemId: child.itemId, operationId: child.operationId, actorId: child.actorId,
    entityType: child.entityType, entityId: child.entityId, provider: child.provider, sourceHash: child.sourceHash,
    sourceSnapshot: artifact.sourceSnapshot, sourceRevision: artifact.sourceRevision, targetRevision: artifact.targetRevision,
    expectedState: artifact.expectedState, configuration: artifact.configuration, currentCursor: {}, resumeCursor: child.resumeCursor,
  }, candidateFromArtifacts: retainedCountryTranslationCandidate });
  const recovered = await operation.recoverExisting(artifact.receipt);
  const result = recovered?.phase !== "finished" && recovered?.providerCalls === 0 && recovered.pendingCallId === null
    ? await operation.failed(new ProfileTranslationScanRpcError("translation_retry_pending")) : recovered;
  return result && countryChild(result);
}
function countryChild(receipt: CatalogTranslationOperationReceipt): CountryProfileOperationReceipt {
  if (receipt.entityType !== "country" || !("catalogSourceHash" in receipt.sourceRevision)) {
    throw new ProfileTranslationScanRpcError("translation_scan_unconfirmed");
  }
  return receipt as CountryProfileOperationReceipt;
}
function freeObservation(result: ProfileResult): ProfileTranslationScanObservation | null {
  const state = result.state;
  if (state === "manual" || state === "current" || state === "review-pending" || state === "stale" || state === "skipped" || state === "failed") {
    return { version: 1, type: "free", state, reason: state === "review-pending" ? "existing_candidate"
      : state === "failed" ? "database_read_failed" : state === "skipped" ? "ineligible" : null, sourceHash: null };
  }
  return null;
}

export async function runProfileTranslationScan(input: {
  supabase: SupabaseClient; actorId: string; kind: ProfileTranslationScanKind;
  jobId?: string | null; scanIntent?: string | null; legacyCursor?: string | number | null;
}) {
  const client = input.supabase, scanLimit = input.kind === "writer" ? 120 : 30;
  const attempts = input.kind === "writer" ? 3 : 2;
  const budget = createTranslationOperationBudget({ maxAttempts: attempts, maxProviderCalls: attempts * 4, deadlineMs: 300_000 });
  let receipt: ProfileTranslationScanReceipt | null = null, paidOutcomeUnconfirmed = false;
  let recoveryJobId = uuid.safeParse(input.scanIntent || input.jobId).success ? (input.scanIntent || input.jobId)! : null;
  let processed = 0, translated = 0, reviewPending = 0, stale = 0, current = 0, manual = 0, skipped = 0, failed = 0;
  let errorCode: TranslationErrorCode | null = null, stopReason: TranslationOperationBudgetReason | null = null;
  const checkpoint = async (observation: ProfileTranslationScanObservation, operationId: string | null = null) => {
    const before = receipt!, transition = crypto.randomUUID();
    receipt = await confirmTransition(() => checkpointProfileTranslationScanItem(client, before, transition, observation, operationId));
    return receipt.nextPosition === before.nextPosition + 1;
  };
  const account = (state: ProfileResult["state"]) => {
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
    const recovered = await recoverChild(client, receipt, input.actorId);
    if (receipt.child.binding !== "attached") {
      if (recovered?.phase !== "finished") { errorCode = "translation_retry_pending"; return true; }
      receipt = await getProfileTranslationScan(client, receipt.jobId, input.kind);
      if (receipt.child === null) { paidOutcomeUnconfirmed = false; return false; }
      if (receipt.child.receipt.phase !== "finished" || !sameId(receipt.child.receipt.operationId, child.operationId)) {
        errorCode = "translation_retry_pending"; return true;
      }
    }
    const advanced = await checkpoint({ version: 1, type: "child-terminal" }, child.operationId);
    if (advanced) { account(recovered?.result?.state ?? child.result?.state ?? "skipped"); paidOutcomeUnconfirmed = false; }
    errorCode = advanced ? null : stopped(receipt!) ? "translation_operation_stopped" : "translation_retry_pending";
    return !advanced;
  };
  try {
    if (input.kind !== "writer" && input.kind !== "country") throw new ProfileTranslationScanRpcError("invalid_input");
    if (input.scanIntent && !uuid.safeParse(input.scanIntent).success) throw new ProfileTranslationScanRpcError("invalid_input");
    if (input.scanIntent) {
      try { receipt = await getProfileTranslationScan(client, input.scanIntent, input.kind); }
      catch (error) {
        unstable_rethrow(error);
        if (!(error instanceof ProfileTranslationScanRpcError) || error.databaseCode !== "P0002") throw error;
      }
    } else if (input.jobId) {
      if (!uuid.safeParse(input.jobId).success) throw new ProfileTranslationScanRpcError("invalid_input");
      receipt = await getProfileTranslationScan(client, input.jobId, input.kind);
    } else {
      const raw = String(input.legacyCursor ?? "0").trim();
      if (raw !== "" && !/^0+$/u.test(raw)) throw new ProfileTranslationScanRpcError(/^\d+$/u.test(raw) ? "translation_resume_stale" : "invalid_input");
    }
    if (receipt) {
      if (!sameId(receipt.actorId, input.actorId)) throw new ProfileTranslationScanRpcError("translation_retry_blocked");
      if (await observeChild()) return result();
      if (stopped(receipt)) throw new ProfileTranslationScanRpcError("translation_operation_stopped");
      if (receipt.exhausted) throw new ProfileTranslationScanRpcError("translation_scan_complete");
    }
    const config = await configuration(client, input.kind);
    // Passing {} deliberately bypasses the loader's process-wide catalog cache.
    // A read failure holds the saved position; it is not a synthetic missing row.
    let catalog: EditorialCatalog | null = null;
    const currentCatalog = async () => catalog ??= await loadEditorialCatalog({});
    if (!receipt) {
      const manifest = await profileTranslationScanManifest(input.kind, await currentCatalog());
      const scanId = input.scanIntent || crypto.randomUUID();
      recoveryJobId = scanId;
      receipt = await confirmTransition(() => beginProfileTranslationScan(client, scanId, input.kind, config, manifest));
      if (!sameId(receipt.actorId, input.actorId)) throw new ProfileTranslationScanRpcError("translation_retry_blocked");
    }
    let hops = 0;
    while (processed < scanLimit && hops < 20) {
      stopReason = budget.exhaustedReason();
      if (stopReason) break;
      receipt = await getProfileTranslationScan(client, receipt.jobId, input.kind);
      if (await observeChild()) break;
      if (stopped(receipt)) { errorCode = "translation_operation_stopped"; break; }
      if (receipt.exhausted) break;
      const before: ProfileTranslationScanReceipt = receipt;
      receipt = await confirmTransition(() => continueProfileTranslationScan(client, before, config));
      if (receipt.exhausted) break;
      if (!sameId(receipt.jobId, before.jobId)) { hops++; continue; }
      // Eager successor existence is never a reason to skip this window.
      if (receipt.child) continue;
      if (stopped(receipt)) { errorCode = "translation_operation_stopped"; break; }
      if (receipt.nextPosition === receipt.totalItems) throw new ProfileTranslationScanRpcError("translation_scan_unconfirmed");
      stopReason = budget.exhaustedReason();
      if (stopReason) break;
      const member = receipt.members[receipt.nextPosition];
      if (!member) throw new ProfileTranslationScanRpcError("translation_scan_unconfirmed");
      const actualCatalog = await currentCatalog();
      const entity = receipt.kind === "writer" && "writerId" in member
        ? editorialWriter(actualCatalog, member.countryId, member.writerId) : editorialCountry(actualCatalog, member.countryId);
      if (!entity || await profileScanCatalogSourceHash(entity.fields) !== member.catalogSourceHash) {
        const state = entity ? "stale" : "skipped";
        if (!(await checkpoint({ version: 1, type: "free", state, reason: entity ? "catalog_changed" : "source_missing", sourceHash: null }))) {
          errorCode = "translation_retry_pending"; break;
        }
        account(state); continue;
      }
      const ordinal = profileTranslationScanOrdinal(receipt), key = input.kind === "writer" ? "writerCursor" : "countryCursor";
      let attached: ProfileTranslationScanPaidReceipt | null = null;
      const admission = async (child: ProfileTranslationScanPaidReceipt) => {
        if (!samePremiumTranslationJson(child.configuration, config)) throw new ProfileTranslationScanRpcError("translation_resume_stale");
        const target = receipt!, transition = crypto.randomUUID();
        receipt = await confirmTransition(() => attachProfileTranslationScanOperation(client, target, child, transition));
        attached = child;
      };
      const common = { supabase: client, actorId: input.actorId, countryId: member.countryId, sourceFields: entity.fields,
        runtimeApproved: true, operationBudget: budget,
        operationCursor: { current: { [key]: ordinal }, next: { [key]: ordinal + 1 } } };
      const translatedResult: ProfileResult = receipt.kind === "writer" && "writerId" in member
        ? await ensureWriterEnglishBiography({ ...common, writerId: member.writerId, operationAdmission: admission })
        : await ensureCountryEnglishProfile({ ...common, operationAdmission: child => admission(countryChild(child)) });
      const child = translatedResult.operation?.receipt;
      paidOutcomeUnconfirmed = (child?.providerCalls ?? 0) > 0;
      if (attached || child) {
        receipt = await getProfileTranslationScan(client, receipt.jobId, input.kind);
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
        account(translatedResult.state);
      }
      if (translatedResult.budgetStop) { stopReason = translatedResult.budgetStop.reason; break; }
      if (translatedResult.state === "failed") { errorCode = translatedResult.errorCode || "database_read_failed"; break; }
    }
    if (receipt && receipt.nextPosition === receipt.totalItems && !receipt.exhausted && !stopped(receipt) && !receipt.child) {
      const before: ProfileTranslationScanReceipt = receipt;
      receipt = await confirmTransition(() => continueProfileTranslationScan(client, before, config));
    }
  } catch (error) {
    unstable_rethrow(error);
    errorCode = error instanceof ProfileTranslationScanRpcError && error.errorCode !== "translation_scan_unconfirmed"
      ? error.errorCode : paidOutcomeUnconfirmed ? "translation_retry_unconfirmed" : "translation_scan_unconfirmed";
  }
  return result();
  function result() { return { receipt, recoveryJobId: receipt?.jobId ?? recoveryJobId, processed, translated, reviewPending, stale, current, manual, skipped, failed,
    errorCode, budget: budget.snapshot(), stopReason }; }
}
