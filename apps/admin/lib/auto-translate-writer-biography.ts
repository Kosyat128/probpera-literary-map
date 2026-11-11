import type { SupabaseClient } from "@supabase/supabase-js";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";

import { adminEnv } from "./env";
import { premiumTranslateToEnglish, retainedPremiumTranslationResponseValue } from "./premium-english-translation";
import { premiumTranslationConfigurationIdentity } from "./premium-translation-probe";
import { premiumTranslationRuntimeMetadata } from "./premium-translation-runtime";
import { translationErrorCode, type TranslationErrorCode } from "./translation-errors";
import { premiumTranslationRuntimeGate } from "./translation-runtime-gate";
import {
  createTranslationOperationBudget, TranslationOperationBudgetError, type TranslationOperationBudget, type TranslationOperationBudgetStop,
} from "./translation-operation-budget";
import {
  premiumTranslationCandidateOutcome,
  readPremiumTranslationWorkingDraft, samePremiumTranslationJson,
  writerBiographyCandidateIdentity,
  type PremiumTranslationCandidateOutcome,
} from "./premium-translation-working-draft";
import { createWriterTranslationOperation, type WriterTranslationOperation } from "./writer-translation-operation";
import {
  WriterTranslationOperationRpcError, writerTranslationConfigurationSchema,
  type WriterTranslationOperationArtifacts, type WriterTranslationOperationCandidate, type WriterTranslationOperationReceipt,
} from "./writer-translation-operation-rpc";
import {
  assertWriterBiographyEnglishFidelity,
  isCurrentMachineWriterBiography,
  writerBiographyEnglishAutomationOwnership,
  writerBiographySourceFields,
  writerBiographySourceIdentity,
  writerBiographySourceUsages,
  type WriterBiographyProfile,
  type WriterBiographySource,
  type WriterBiographySourceField,
  type WriterBiographySourceUsage,
} from "./writer-biography-edit";

const biographyOutputSchema = z.object({
  text: z.string().trim().min(120).max(1_600),
});

const biographyJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["text"],
  properties: { text: { type: "string", minLength: 120, maxLength: 1_600 } },
} as const;

type BiographySource = WriterBiographySource;
type BiographyProfile = WriterBiographyProfile;

type BiographyMap = Partial<Record<"ru" | "en", BiographyProfile>>;

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function validSources(value: unknown): BiographySource[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) => {
    const source = objectValue(candidate);
    const provider = typeof source.provider === "string" ? source.provider.trim() : "";
    const url = typeof source.url === "string" ? source.url.trim() : "";
    const fields: WriterBiographySourceField[] = Array.isArray(source.fields)
      ? source.fields.flatMap((item) => {
          const field = typeof item === "string" ? item.trim() : "";
          return writerBiographySourceFields.includes(
            field as WriterBiographySourceField
          )
            ? [field as WriterBiographySourceField]
            : [];
        })
      : [];
    const usage =
      typeof source.usage === "string" ? source.usage.trim() : "";
    const retrievedAt =
      typeof source.retrievedAt === "string" ? source.retrievedAt.trim() : "";
    if (
      !provider ||
      !/^https:\/\//iu.test(url) ||
      !fields.length ||
      !writerBiographySourceUsages.includes(
        usage as WriterBiographySourceUsage
      ) ||
      !retrievedAt
    ) {
      return [];
    }
    return [{
      provider,
      url,
      fields,
      usage: usage as WriterBiographySourceUsage,
      retrievedAt,
      author: typeof source.author === "string" ? source.author : undefined,
      title: typeof source.title === "string" ? source.title : undefined,
      licenseName:
        typeof source.licenseName === "string" ? source.licenseName : undefined,
      licenseUrl:
        typeof source.licenseUrl === "string" ? source.licenseUrl : undefined,
    }];
  });
}

function biographyProfile(value: unknown, locale: "ru" | "en") {
  const row = objectValue(value);
  const status = row.status;
  const method = row.method;
  if (
    row.locale !== locale ||
    typeof row.text !== "string" ||
    typeof row.sourceLanguage !== "string" ||
    !new Set(["draft", "reviewed", "verified"]).has(String(status)) ||
    !new Set([
      "editorial-original",
      "human-translation",
      "machine-translation",
      "licensed-source",
    ]).has(String(method))
  ) {
    return null;
  }
  return {
    ...row,
    locale,
    text: row.text.trim(),
    sourceLanguage: row.sourceLanguage.trim(),
    status: status as BiographyProfile["status"],
    method: method as BiographyProfile["method"],
    reviewedAt: typeof row.reviewedAt === "string" ? row.reviewedAt : undefined,
    sources: validSources(row.sources),
    translationMeta: objectValue(row.translationMeta) as BiographyProfile["translationMeta"],
  } as BiographyProfile;
}

function biographyMap(value: unknown): BiographyMap {
  const source = objectValue(value);
  const ru = biographyProfile(source.ru, "ru");
  const en = biographyProfile(source.en, "en");
  return {
    ...(ru ? { ru } : {}),
    ...(en ? { en } : {}),
  };
}

export function writerBiographyTranslationSource(fields: Record<string, unknown>, writerId: string) {
  const rawTranslations = objectValue(fields.biographyTranslations);
  const translations = biographyMap(rawTranslations);
  const russian = translations.ru;
  if (!russian) return null;
  return {
    russian, english: translations.en, russianProfile: objectValue(rawTranslations.ru),
    eligible: new Set(["reviewed", "verified"]).has(russian.status) &&
      russian.method === "editorial-original" && Boolean(russian.reviewedAt) && russian.sources.length > 0,
    source: {
      writerName: writerBiographySourceIdentity(fields, writerId),
      text: russian.text, sourceLanguage: russian.sourceLanguage, sources: russian.sources,
    },
  };
}

export function writerBiographyTranslationOwnership(
  sourceFields: Record<string, unknown>, overrideFields: Record<string, unknown>
) {
  const effectiveFields = { ...sourceFields, ...overrideFields };
  const rawTranslations = objectValue(effectiveFields.biographyTranslations);
  const english = biographyProfile(rawTranslations.en, "en");
  const ownership = writerBiographyEnglishAutomationOwnership({ overrideFields, english });
  if (ownership === "tombstone") return ownership;
  // A present incomplete entry is authored/unknown, never permission to overwrite it.
  if (Object.hasOwn(rawTranslations, "en") && (!english || english.method !== "machine-translation")) return "human";
  const rawEnglish = objectValue(rawTranslations.en);
  if (Object.hasOwn(rawEnglish, "translationMeta") &&
      (!rawEnglish.translationMeta || typeof rawEnglish.translationMeta !== "object" || Array.isArray(rawEnglish.translationMeta))) {
    return "human";
  }
  return ownership;
}

function validateEnglishBiography(
  value: unknown,
  source: { writerName: string; text: string }
) {
  const parsed = biographyOutputSchema.parse(value);
  assertWriterBiographyEnglishFidelity({
    sourceText: source.text,
    englishText: parsed.text,
    writerName: source.writerName,
  });
  return parsed;
}

async function sha256(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

async function retainedWriterCandidate(
  artifact: WriterTranslationOperationArtifacts,
): Promise<WriterTranslationOperationCandidate | null> {
  try {
    const snapshot = artifact.sourceSnapshot;
    const catalog = objectValue(snapshot.catalogFields);
    const original = writerBiographyTranslationSource({ ...catalog, ...(artifact.expectedOverrideFields || {}) }, artifact.receipt.writerId);
    if (!original?.eligible || await sha256(original.source) !== artifact.receipt.sourceHash ||
      !samePremiumTranslationJson(JSON.parse(JSON.stringify({ ...original.source,
        russianProfile: original.russianProfile, catalogFields: catalog })), snapshot)) return null;
    const first = artifact.calls[0], last = artifact.calls.at(-1);
    if (artifact.calls.length < 2 || first?.metadata.pass !== "translation" || !last?.responseArtifact ||
      last.metadata.responseReceivedAt === null || last.metadata.pass === "translation" ||
      !artifact.calls.some(call => call.metadata.pass === "review") ||
      artifact.calls.some(call => call.metadata.responseReceivedAt === null || call.responseArtifact === null ||
        (call.metadata.httpStatus !== null && (call.metadata.httpStatus < 200 || call.metadata.httpStatus >= 300)))) return null;
    const payload = validateEnglishBiography(retainedPremiumTranslationResponseValue(
      artifact.receipt.provider, last.responseArtifact.body, last.metadata.pass,
    ), original.source);
    return { payload, translatorCallId: first.metadata.callId, reviewerCallId: last.metadata.callId,
      provenance: { provider: artifact.receipt.provider, translatorModel: first.metadata.model,
        reviewerModel: last.metadata.model, generatedAt: new Date(last.metadata.responseReceivedAt).toISOString(),
        translatorRequestId: first.metadata.requestId ?? first.metadata.responseId,
        reviewerRequestId: last.metadata.requestId ?? last.metadata.responseId } };
  } catch (error) { unstable_rethrow(error); return null; }
}

export type WriterBiographyTranslationState =
  | "translated"
  | "review-pending"
  | "stale"
  | "not-ready"
  | "current"
  | "manual"
  | "skipped"
  | "not-configured"
  | "conflict"
  | "unconfirmed"
  | "cancelled"
  | "failed";

export async function ensureWriterEnglishBiography(input: {
  supabase: SupabaseClient;
  actorId: string;
  countryId: string;
  writerId: string;
  sourceFields: Record<string, unknown>;
  runtimeApproved?: boolean;
  replaceEnglishTombstone?: boolean;
  operationBudget?: TranslationOperationBudget;
  operationCursor?: { current: Record<string, unknown>; next: Record<string, unknown> };
  operationAdmission?: (receipt: WriterTranslationOperationReceipt) => Promise<void>;
}): Promise<{
  state: WriterBiographyTranslationState;
  model?: string;
  reviewerModel?: string | null;
  error?: string;
  errorCode?: TranslationErrorCode;
  overrideId?: string;
  budgetStop?: TranslationOperationBudgetStop;
  operation?: WriterTranslationOperation;
} & Partial<PremiumTranslationCandidateOutcome>> {
  const operationBudget = input.operationBudget ?? createTranslationOperationBudget({
    maxAttempts: 1, maxProviderCalls: 4, deadlineMs: 300_000,
  });
  if (!adminEnv.openAiAutoTranslateProfiles) return { state: "skipped" };
  if (!input.runtimeApproved && !(await premiumTranslationRuntimeGate(input.supabase))) {
    return { state: "not-configured" };
  }

  const existingResponse = await input.supabase
    .from("writer_profile_overrides")
    .select("id,fields,updated_at")
    .eq("country_id", input.countryId)
    .eq("writer_id", input.writerId)
    .maybeSingle();
  if (existingResponse.error) {
    return { state: "failed", error: existingResponse.error.message };
  }

  const existingOverride = existingResponse.data;
  const overrideFields = objectValue(existingOverride?.fields);
  const effectiveFields = { ...input.sourceFields, ...overrideFields };
  const context = writerBiographyTranslationSource(effectiveFields, input.writerId);
  if (!context?.eligible) {
    return {
      state: "skipped",
      error: "a reviewed project-original Russian biography with provenance is required",
    };
  }
  const { russian, english, source } = context;
  const englishOwnership = writerBiographyTranslationOwnership(input.sourceFields, overrideFields);
  if (
    englishOwnership === "tombstone" &&
    !input.replaceEnglishTombstone
  ) {
    return {
      state: "skipped",
      error: "an explicit English biography tombstone is present",
      overrideId: existingOverride?.id,
    };
  }
  if (englishOwnership === "human") {
    return { state: "manual", overrideId: existingOverride?.id };
  }

  const sourceHash = await sha256(source);
  if (isCurrentMachineWriterBiography({
    russian,
    english,
    sourceHash,
    writerName: source.writerName,
  })) {
    return { state: "current", overrideId: existingOverride?.id };
  }

  let entityId: string;
  try { entityId = writerBiographyCandidateIdentity(input.countryId, input.writerId); }
  catch { return { state: "failed", error: "Invalid writer translation identity" }; }
  const sourceRevision = {
    countryId: input.countryId, writerId: input.writerId,
    overrideId: existingOverride?.id || null, overrideUpdatedAt: existingOverride?.updated_at || null,
    catalogSourceHash: await sha256(input.sourceFields), replaceEnglishTombstone: Boolean(input.replaceEnglishTombstone),
  };
  const targetRevision = { id: existingOverride?.id || null, updatedAt: existingOverride?.updated_at || null };
  // Match the JSON wire representation without changing any authored string or metadata.
  const sourceSnapshot = JSON.parse(JSON.stringify({
    ...source, russianProfile: context.russianProfile, catalogFields: input.sourceFields,
  }));
  try {
    const pending = await readPremiumTranslationWorkingDraft(input.supabase, { entityType: "writer_biography", entityId });
    if (pending) {
      if (pending.entityType !== "writer_biography" || pending.sourceHash !== sourceHash ||
          pending.sourceRevision.catalogSourceHash !== sourceRevision.catalogSourceHash ||
          !samePremiumTranslationJson(pending.sourceSnapshot, sourceSnapshot)) {
        return { state: "stale", error: "Writer source changed; the saved private candidate requires review or discard" };
      }
      if (!samePremiumTranslationJson(pending.targetRevision, targetRevision)) {
        return { state: "conflict", error: "Writer override changed after the private candidate was saved" };
      }
      return { state: "review-pending", ...premiumTranslationCandidateOutcome(pending),
        model: pending.provenance.translatorModel, reviewerModel: pending.provenance.reviewerModel,
        overrideId: existingOverride?.id };
    }
  } catch (error) {
    unstable_rethrow(error);
    return { state: "not-ready", error: "Private translation drafts are unavailable" };
  }

  const runtime = premiumTranslationRuntimeMetadata();
  const providerCallsBefore = operationBudget.snapshot().providerCalls;
  let attemptStarted = false, auditRecorded = false;
  let operation: ReturnType<typeof createWriterTranslationOperation> | null = null;
  const unconfirmed = () => ({ state: "unconfirmed" as const, error: "translation_retry_pending",
    errorCode: "translation_retry_pending" as const, operation: operation?.operation(), overrideId: existingOverride?.id });
  async function fromReceipt(receipt: WriterTranslationOperationReceipt | null): Promise<Awaited<ReturnType<typeof ensureWriterEnglishBiography>>> {
    if (!receipt || receipt.phase !== "finished" || !receipt.result) return unconfirmed();
    const result = receipt.result;
    try {
      if (result.candidateHash !== null) {
        const artifact = await operation!.readArtifacts();
        const candidate = await retainedWriterCandidate(artifact);
        if (!candidate || !samePremiumTranslationJson(artifact.candidate, candidate)) return unconfirmed();
        if (!auditRecorded && !receipt.replayed) {
          auditRecorded = true;
          await input.supabase.from("admin_audit_log").insert({ actor_id: input.actorId,
            action: "writer_profile.auto_translation.staged", entity_type: "writer_profile", entity_id: receipt.entityId,
            metadata: { countryId: receipt.countryId, writerId: receipt.writerId, locale: "en", source_hash: receipt.sourceHash,
              provider: receipt.provider, model: candidate.provenance.translatorModel,
              reviewer_model: candidate.provenance.reviewerModel,
              translator_request_id: candidate.provenance.translatorRequestId,
              reviewer_request_id: candidate.provenance.reviewerRequestId,
              working_draft_id: result.draftId, operation_id: receipt.operationId, job_id: receipt.jobId,
              persistence: result.persistence, human_review: "pending" } });
        }
        if (result.persistence === "working-draft") {
          const draft = await readPremiumTranslationWorkingDraft(input.supabase, { entityType: "writer_biography", entityId });
          if (!draft) return { state: "skipped", error: "translation_retry_blocked", errorCode: "translation_retry_blocked",
            operation: operation!.operation(), overrideId: existingOverride?.id };
          if (draft.id !== result.draftId) return { state: "conflict", error: "write_conflict", errorCode: "write_conflict",
            operation: operation!.operation(), overrideId: existingOverride?.id };
          if (draft.entityType !== "writer_biography" ||
            draft.version !== result.draftVersion || draft.candidateHash !== result.candidateHash ||
            draft.sourceHash !== receipt.sourceHash || !samePremiumTranslationJson(draft.sourceSnapshot, artifact.sourceSnapshot) ||
            !samePremiumTranslationJson(draft.sourceRevision, artifact.sourceRevision) ||
            !samePremiumTranslationJson(draft.targetRevision, artifact.targetRevision) ||
            !samePremiumTranslationJson(draft.payload, candidate.payload) ||
            !samePremiumTranslationJson(draft.provenance, candidate.provenance)) return unconfirmed();
          if (result.state === "translated") return { state: "translated", ...premiumTranslationCandidateOutcome(draft),
            model: draft.provenance.translatorModel, reviewerModel: draft.provenance.reviewerModel,
            overrideId: existingOverride?.id, operation: operation!.operation() };
        }
      }
      return { state: result.state === "translated" ? "unconfirmed" : result.state,
        ...(result.errorCode ? { error: result.errorCode, errorCode: result.errorCode } : {}),
        model: receipt.configuration.model, reviewerModel: receipt.configuration.reviewerModel,
        overrideId: existingOverride?.id, operation: operation!.operation() };
    } catch (error) { unstable_rethrow(error); return unconfirmed(); }
  }
  try {
    const identity = await premiumTranslationConfigurationIdentity({ review: true });
    const configuration = writerTranslationConfigurationSchema.parse({ ...identity.configuration,
      schemaName: "probpera_writer_biography_translation", maxOutputTokens: 4_000 });
    operation = createWriterTranslationOperation({ supabase: input.supabase,
      intent: { jobId: crypto.randomUUID(), itemId: crypto.randomUUID(), operationId: crypto.randomUUID(),
        actorId: input.actorId, countryId: input.countryId, writerId: input.writerId, provider: runtime.provider,
        sourceHash, sourceSnapshot, sourceRevision, targetRevision,
        expectedOverrideFields: existingOverride ? JSON.parse(JSON.stringify(existingOverride.fields)) : null,
        configuration, currentCursor: input.operationCursor?.current || {}, resumeCursor: input.operationCursor?.next || {} },
      onAdmission: input.operationAdmission, candidateFromArtifacts: retainedWriterCandidate });
    if (!(await operation.admit())) return fromReceipt(await operation.recoverCandidate());
    operationBudget.startAttempt();
    attemptStarted = true;
    const translated = await premiumTranslateToEnglish({
      source,
      schema: biographyJsonSchema,
      schemaName: "probpera_writer_biography_translation",
      validate: (value) => validateEnglishBiography(value, source),
      // Technical completion always includes an independent review and remains private.
      review: true,
      maxOutputTokens: 4_000,
      operationBudget,
      providerJournal: operation.providerJournal,
      responseArtifacts: operation.responseArtifacts,
      domainInstructions: [
        "This is a concise factual literary biography for a world-literature encyclopedia.",
        "Preserve every biographical fact, date, institution, work and award exactly; do not infer missing facts.",
        "Use the established English form of the writer's name and institutions when unambiguous.",
        "Write 2-4 fluent sentences with an authoritative reference-work tone, not promotional copy.",
      ],
    });
    if (!translated.reviewerModel) throw new Error("writer biography translation did not complete the required reviewer pass");
    return fromReceipt(await operation.complete({ text: translated.value.text }));
  } catch (error) {
    unstable_rethrow(error);
    const receipt = operation ? await operation.failed(error) : null;
    if (receipt?.phase === "finished" && receipt.result?.candidateHash !== null) return fromReceipt(receipt);
    if (error instanceof TranslationOperationBudgetError) {
      const providerCalls = operationBudget.snapshot().providerCalls - providerCallsBefore;
      return { ...(providerCalls > 0 ? unconfirmed() : { state: "skipped" as const, operation: operation?.operation() }),
        error: error.message, errorCode: "translation_operation_stopped",
        budgetStop: { reason: error.reason, attemptStarted, providerCalls } };
    }
    if (receipt?.phase === "finished" && receipt.result?.state !== "skipped") return fromReceipt(receipt);
    if (operation?.receipt) return unconfirmed();
    const errorCode = error instanceof WriterTranslationOperationRpcError ? error.errorCode : translationErrorCode(error);
    await input.supabase.from("admin_audit_log").insert({ actor_id: input.actorId,
      action: "writer_profile.auto_translation.failed", entity_type: "writer_profile", entity_id: entityId,
      metadata: { locale: "en", provider: runtime.provider, model: runtime.model,
        reviewer_model: operation?.receipt?.configuration.reviewerModel ?? runtime.reviewerModel, error_code: errorCode } });
    return { state: errorCode === "translation_migration_required" ? "not-ready" : "failed",
      error: errorCode, errorCode, operation: operation?.operation() };
  }
}

export { validateEnglishBiography as validateWriterBiographyTranslationCandidate };

export { retainedWriterCandidate as retainedWriterTranslationCandidate };
