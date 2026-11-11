import type { SupabaseClient } from "@supabase/supabase-js";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";

import { adminEnv } from "./env";
import { premiumTranslateToEnglish } from "./premium-english-translation";
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
  type PremiumTranslationCandidateOutcome,
} from "./premium-translation-working-draft";

type SupabaseServerClient = SupabaseClient;

import { catalogTranslationOperationResult, createCatalogTranslationOperation, retainedCatalogTranslationPass,
  type CatalogTranslationOperation } from "./catalog-translation-operation";
import { CatalogTranslationOperationRpcError, catalogTranslationConfigurationSchema,
  type CatalogTranslationOperationArtifacts, type CatalogTranslationOperationCandidate, type CatalogTranslationOperationReceipt } from "./catalog-translation-operation-rpc";

const translatedWorkSchema = z.object({
  description: z.string().trim().min(140).max(900),
});

const translatedWorkJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["description"],
  properties: {
    description: { type: "string", minLength: 140, maxLength: 900 },
  },
} as const;

function sentenceCount(value: string) {
  return value.match(/[.!?…]+(?=\s|$)/gu)?.length || 0;
}

function validateWorkTranslation(value: unknown) {
  const parsed = translatedWorkSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(
      `Premium book translation has invalid shape: ${
        parsed.error.issues[0]?.message || "invalid result"
      }`
    );
  }
  if (/\p{Script=Cyrillic}/u.test(parsed.data.description)) {
    throw new Error("Premium English book translation still contains Cyrillic");
  }
  const sentences = sentenceCount(parsed.data.description);
  if (sentences < 2 || sentences > 3) {
    throw new Error("Premium English book description must contain 2-3 sentences");
  }
  return parsed.data;
}

async function sha256(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

function translationMeta(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function retainedWorkCandidate(artifact: CatalogTranslationOperationArtifacts): Promise<CatalogTranslationOperationCandidate | null> {
  try {
    if (artifact.receipt.entityType !== "literary_work" || artifact.rawSeed.version !== 1 || !Array.isArray(artifact.rawSeed.sources)) return null;
    const work = translationMeta(artifact.rawSeed.work), russian = translationMeta(artifact.rawSeed.russian), english = translationMeta(artifact.rawSeed.english);
    const titleSource = artifact.rawSeed.sources.map(translationMeta).find(row => row.id === artifact.rawSeed.selectedTitleSourceId);
    if (!titleSource || work.id !== artifact.receipt.entityId || russian.locale !== "ru" || english.locale !== "en" ||
      russian.work_id !== work.id || english.work_id !== work.id || titleSource.work_id !== work.id ||
      !new Set(["reviewed", "verified"]).has(String(work.editorial_status)) ||
      !new Set(["reviewed", "verified"]).has(String(russian.editorial_status)) ||
      english.translation_method !== "machine-translation" || typeof english.title !== "string" ||
      !english.title.trim() || /\p{Script=Cyrillic}/u.test(english.title) ||
      !Array.isArray(russian.source_urls) || russian.source_urls.length === 0 ||
      !Array.isArray(titleSource.field_names) || !titleSource.field_names.includes("title")) return null;
    const urls = Array.isArray(english.source_urls) ? english.source_urls.filter((url): url is string => typeof url === "string" && /^https:\/\//u.test(url)) : [];
    const locked = translationMeta(translationMeta(english.metadata).premiumTranslation);
    const recorded = translationMeta(locked.bibliographicTitle);
    if (recorded.value !== english.title.trim() || recorded.sourceUrl !== titleSource.source_url || !urls.includes(String(titleSource.source_url))) return null;
    const source = { russianTitle: russian.title, verifiedEnglishTitle: english.title.trim(),
      verifiedEnglishTitleSourceUrl: titleSource.source_url, description: russian.description,
      originalTitle: work.original_title || "", firstPublished: work.first_published,
      originalLanguage: work.original_language || "", sourceLanguage: russian.source_language, sourceUrls: russian.source_urls };
    if (await sha256(source) !== artifact.receipt.sourceHash || !samePremiumTranslationJson(source, artifact.sourceSnapshot)) return null;
    const pass = retainedCatalogTranslationPass(artifact);
    if (!pass) return null;
    const value = validateWorkTranslation(pass.value);
    return { payload: { description: value.description, sourceLanguage: "Russian",
      sourceUrls: [...new Set([...urls, ...russian.source_urls])],
      bibliographicTitle: { value: source.verifiedEnglishTitle, provider: titleSource.provider,
        sourceUrl: titleSource.source_url, retrievedAt: titleSource.retrieved_at || null } },
      provenance: pass.provenance, translatorCallId: pass.translatorCallId, reviewerCallId: pass.reviewerCallId };
  } catch (error) { unstable_rethrow(error); return null; }
}

export type LiteraryWorkAutoTranslationState =
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

export type LiteraryWorkAutoTranslationResult = {
  state: LiteraryWorkAutoTranslationState;
  model?: string;
  reviewerModel?: string | null;
  error?: string;
  errorCode?: TranslationErrorCode;
  operation?: CatalogTranslationOperation;
  budgetStop?: TranslationOperationBudgetStop;
} & Partial<PremiumTranslationCandidateOutcome>;

export { validateWorkTranslation as validateLiteraryWorkTranslationCandidate,
  retainedWorkCandidate as retainedLiteraryWorkTranslationCandidate };

export async function ensureLiteraryWorkEnglishTranslation(input: {
  supabase: SupabaseServerClient;
  actorId: string;
  workId: string;
  runtimeApproved?: boolean;
  operationBudget?: TranslationOperationBudget;
  operationCursor?: { current: Record<string, unknown>; next: Record<string, unknown> };
  operationAdmission?: (receipt: CatalogTranslationOperationReceipt) => Promise<void>;
}): Promise<LiteraryWorkAutoTranslationResult> {
  input = { ...input, workId: input.workId.toLowerCase() };
  const operationBudget = input.operationBudget ?? createTranslationOperationBudget({
    maxAttempts: 1, maxProviderCalls: 4, deadlineMs: 300_000,
  });
  if (!adminEnv.openAiAutoTranslateLibrary) return { state: "skipped" };
  if (!input.runtimeApproved && !(await premiumTranslationRuntimeGate(input.supabase))) {
    return { state: "not-configured" };
  }

  const [workResponse, russianResponse, englishResponse] = await Promise.all([
    input.supabase
      .from("literary_works")
      .select("id,title,original_title,first_published,original_language,editorial_status,updated_at")
      .eq("id", input.workId)
      .maybeSingle(),
    input.supabase
      .from("literary_work_translations")
      .select("id,title,description,source_language,source_urls,editorial_status,updated_at,metadata")
      .eq("work_id", input.workId)
      .eq("locale", "ru")
      .maybeSingle(),
    input.supabase
      .from("literary_work_translations")
      .select("id,title,description,source_urls,translation_method,editorial_status,updated_at,metadata")
      .eq("work_id", input.workId)
      .eq("locale", "en")
      .maybeSingle(),
  ]);

  if (workResponse.error || !workResponse.data) {
    return {
      state: "failed",
      error: workResponse.error?.message || "literary work not found",
    };
  }
  if (russianResponse.error || !russianResponse.data) {
    return {
      state: "skipped",
      error: russianResponse.error?.message || "reviewed Russian translation is required",
    };
  }
  if (englishResponse.error) {
    return { state: "failed", error: englishResponse.error.message };
  }

  const work = workResponse.data;
  const russian = russianResponse.data;
  const existing = englishResponse.data;
  if (!new Set(["reviewed", "verified"]).has(work.editorial_status)) {
    return { state: "skipped", error: "literary work is not reviewed" };
  }
  if (!new Set(["reviewed", "verified"]).has(russian.editorial_status)) {
    return { state: "skipped", error: "Russian translation is not reviewed" };
  }
  if (!Array.isArray(russian.source_urls) || russian.source_urls.length === 0) {
    return { state: "skipped", error: "Russian translation has no provenance" };
  }

  // Never overwrite deliberate editorial English. Automatic regeneration is
  // limited to rows that were themselves created by this machine pipeline.
  if (existing && existing.translation_method !== "machine-translation") {
    return { state: "manual" };
  }

  if (!existing) {
    return {
      state: "skipped",
      error: "a pre-verified English bibliographic title is required",
    };
  }
  const verifiedEnglishTitle = existing.title.trim();
  if (!verifiedEnglishTitle || /\p{Script=Cyrillic}/u.test(verifiedEnglishTitle)) {
    return {
      state: "skipped",
      error: "the pre-verified English bibliographic title is invalid",
    };
  }

  const existingMetadata = translationMeta(existing.metadata);
  const premiumMetadata = translationMeta(existingMetadata.premiumTranslation);
  const recordedTitle = translationMeta(premiumMetadata.bibliographicTitle);
  const recordedTitleSourceUrl =
    typeof recordedTitle.sourceUrl === "string" ? recordedTitle.sourceUrl : "";
  if (
    existing.translation_method === "machine-translation" &&
    (recordedTitle.value !== verifiedEnglishTitle || !recordedTitleSourceUrl)
  ) {
    return {
      state: "skipped",
      error: "the machine-generated English title requires bibliographic verification",
    };
  }

  const englishTitleSourceUrls = Array.isArray(existing.source_urls)
    ? existing.source_urls.filter(
        (url): url is string => typeof url === "string" && /^https:\/\//u.test(url)
      )
    : [];
  if (
    englishTitleSourceUrls.length === 0 ||
    (recordedTitleSourceUrl && !englishTitleSourceUrls.includes(recordedTitleSourceUrl))
  ) {
    return {
      state: "skipped",
      error: "the English title has no verified bibliographic provenance",
    };
  }

  const titleSourceQuery = input.supabase
    .from("literary_work_sources")
    .select("provider,source_url,retrieved_at")
    .eq("work_id", input.workId)
    .contains("field_names", ["title"]);
  const titleSourceResponse = recordedTitleSourceUrl
    ? await titleSourceQuery
        .eq("source_url", recordedTitleSourceUrl)
        .limit(1)
        .maybeSingle()
    : await titleSourceQuery
        .in("source_url", englishTitleSourceUrls)
        .limit(1)
        .maybeSingle();
  if (titleSourceResponse.error) {
    return { state: "failed", error: titleSourceResponse.error.message };
  }
  if (!titleSourceResponse.data) {
    return {
      state: "skipped",
      error: "the English title is not backed by a verified bibliographic source",
    };
  }

  const source = {
    russianTitle: russian.title,
    verifiedEnglishTitle,
    verifiedEnglishTitleSourceUrl: titleSourceResponse.data.source_url,
    description: russian.description,
    originalTitle: work.original_title || "",
    firstPublished: work.first_published,
    originalLanguage: work.original_language || "",
    sourceLanguage: russian.source_language,
    sourceUrls: russian.source_urls,
  };
  const sourceHash = await sha256(source);
  if (
    existing.translation_method === "machine-translation" &&
    premiumMetadata.sourceHash === sourceHash &&
    new Set(["reviewed", "verified"]).has(existing.editorial_status)
  ) {
    return { state: "current" };
  }

  const sourceRevision = { workId: input.workId, workUpdatedAt: work.updated_at,
    russianId: russian.id, russianUpdatedAt: russian.updated_at };
  const targetRevision = { id: existing.id, updatedAt: existing.updated_at };
  try {
    const pending = await readPremiumTranslationWorkingDraft(input.supabase, {
      entityType: "literary_work", entityId: input.workId,
    });
    if (pending) {
      if (pending.sourceHash !== sourceHash || !samePremiumTranslationJson(pending.sourceRevision, sourceRevision)) {
        return { state: "stale", error: "Russian source changed; the saved private candidate requires review or discard" };
      }
      if (!samePremiumTranslationJson(pending.targetRevision, targetRevision)) {
        return { state: "conflict", error: "English translation changed after the private candidate was saved" };
      }
      return { state: "review-pending", ...premiumTranslationCandidateOutcome(pending),
        model: pending.provenance.translatorModel, reviewerModel: pending.provenance.reviewerModel };
    }
  } catch (error) {
    unstable_rethrow(error);
    return { state: "not-ready", error: "Private translation drafts are unavailable" };
  }

  const runtime = premiumTranslationRuntimeMetadata();
  const providerCallsBefore = operationBudget.snapshot().providerCalls;
  let attemptStarted = false;
  let operation: ReturnType<typeof createCatalogTranslationOperation> | null = null;
  const unconfirmed = () => ({ state: "unconfirmed" as const, error: "translation_retry_pending",
    errorCode: "translation_retry_pending" as const, operation: operation?.operation() });
  const fromReceipt = (receipt: import("./catalog-translation-operation-rpc").CatalogTranslationOperationReceipt | null) =>
    catalogTranslationOperationResult({ supabase: input.supabase, operation: operation!, receipt, candidateFromArtifacts: retainedWorkCandidate });
  try {
    const identity = await premiumTranslationConfigurationIdentity({ review: runtime.twoPassReview });
    const configuration = catalogTranslationConfigurationSchema.parse({ ...identity.configuration,
      schemaName: "probpera_literary_work_translation", maxOutputTokens: 4_000 });
    operation = createCatalogTranslationOperation({ supabase: input.supabase,
      intent: { jobId: crypto.randomUUID(), itemId: crypto.randomUUID(), operationId: crypto.randomUUID(),
        actorId: input.actorId, entityType: "literary_work", entityId: input.workId, provider: runtime.provider,
        sourceHash, sourceSnapshot: source, sourceRevision, targetRevision, expectedState: JSON.parse(JSON.stringify({ version: 1, work, russian, english: existing, titleSource: titleSourceResponse.data })),
        configuration, currentCursor: input.operationCursor?.current || {}, resumeCursor: input.operationCursor?.next || {} },
      candidateFromArtifacts: retainedWorkCandidate,
      ...(input.operationAdmission === undefined ? {} : { onAdmission: input.operationAdmission }) });
    if (!(await operation.admit())) return fromReceipt(await operation.recoverCandidate());
    operationBudget.startAttempt();
    attemptStarted = true;
    const translated = await premiumTranslateToEnglish({
      source, schema: translatedWorkJsonSchema, schemaName: "probpera_literary_work_translation",
      validate: validateWorkTranslation, review: runtime.twoPassReview,
      maxOutputTokens: 4_000, operationBudget, providerJournal: operation.providerJournal, responseArtifacts: operation.responseArtifacts,
      domainInstructions: [
        "This is a compact literary-encyclopedia record for a book or literary work.",
        "Return only the English description. The verified English title is editorially locked and is not part of the model output.",
        "Do not propose, translate, normalize or modify any work title. If the title must be mentioned in the description, copy verifiedEnglishTitle exactly.",
        "The description must be 2-3 polished sentences, 140-900 characters, suitable for an international literary encyclopedia.",
        "Do not translate or modify sourceUrls, publication years, identifiers or original-language metadata.",
      ],
    });
    return fromReceipt(await operation.complete({ description: translated.value.description, sourceLanguage: "Russian",
      sourceUrls: [...new Set([...englishTitleSourceUrls, ...russian.source_urls])],
      bibliographicTitle: { value: verifiedEnglishTitle, provider: titleSourceResponse.data.provider,
        sourceUrl: titleSourceResponse.data.source_url, retrievedAt: titleSourceResponse.data.retrieved_at || null } }));
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
    const errorCode = error instanceof CatalogTranslationOperationRpcError ? error.errorCode : translationErrorCode(error);
    await input.supabase.from("admin_audit_log").insert({ actor_id: input.actorId,
      action: "literary_work.auto_translation.failed", entity_type: "literary_work", entity_id: input.workId,
      metadata: { locale: "en", provider: runtime.provider, model: runtime.model,
        reviewer_model: operation?.receipt?.configuration.reviewerModel ?? runtime.reviewerModel, error_code: errorCode } });
    return { state: errorCode === "translation_migration_required" ? "not-ready" : "failed",
      error: errorCode, errorCode, operation: operation?.operation() };
  }
}
