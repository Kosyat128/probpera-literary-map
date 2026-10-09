import type { SupabaseClient } from "@supabase/supabase-js";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";

import { adminEnv } from "./env";
import { premiumTranslateToEnglish } from "./premium-english-translation";
import { premiumTranslationRuntimeMetadata } from "./premium-translation-runtime";
import { translationErrorCode } from "./translation-errors";
import { premiumTranslationRuntimeGate } from "./translation-runtime-gate";
import {
  PremiumTranslationDraftError, premiumTranslationCandidateOutcome,
  readPremiumTranslationWorkingDraft, samePremiumTranslationJson, stagePremiumTranslationWorkingDraft,
  type PremiumTranslationCandidateOutcome,
} from "./premium-translation-working-draft";

type SupabaseServerClient = SupabaseClient;

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
  | "failed";

export type LiteraryWorkAutoTranslationResult = {
  state: LiteraryWorkAutoTranslationState;
  model?: string;
  reviewerModel?: string | null;
  error?: string;
} & Partial<PremiumTranslationCandidateOutcome>;

export { validateWorkTranslation as validateLiteraryWorkTranslationCandidate };

export async function ensureLiteraryWorkEnglishTranslation(input: {
  supabase: SupabaseServerClient;
  actorId: string;
  workId: string;
  runtimeApproved?: boolean;
}): Promise<LiteraryWorkAutoTranslationResult> {
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

  const startedAt = Date.now();
  const runtime = premiumTranslationRuntimeMetadata();
  try {
    const translated = await premiumTranslateToEnglish({
      source,
      schema: translatedWorkJsonSchema,
      schemaName: "probpera_literary_work_translation",
      validate: validateWorkTranslation,
      review: runtime.twoPassReview,
      maxOutputTokens: 4_000,
      domainInstructions: [
        "This is a compact literary-encyclopedia record for a book or literary work.",
        "Return only the English description. The verified English title is editorially locked and is not part of the model output.",
        "Do not propose, translate, normalize or modify any work title. If the title must be mentioned in the description, copy verifiedEnglishTitle exactly.",
        "The description must be 2-3 polished sentences, 140-900 characters, suitable for an international literary encyclopedia.",
        "Do not translate or modify sourceUrls, publication years, identifiers or original-language metadata.",
      ],
    });

    // Re-read the RU row immediately before writing so a translation never
    // overwrites text generated from a stale editorial source.
    const latestRussian = await input.supabase
      .from("literary_work_translations")
      .select("updated_at")
      .eq("id", russian.id)
      .maybeSingle();
    if (
      latestRussian.error ||
      !latestRussian.data ||
      latestRussian.data.updated_at !== russian.updated_at
    ) {
      return { state: "conflict", error: "Russian work translation changed during translation" };
    }

    const saved = await stagePremiumTranslationWorkingDraft(input.supabase, {
      entityType: "literary_work", entityId: input.workId,
      sourceHash, sourceSnapshot: source, sourceRevision, targetRevision,
      provenance: {
        provider: runtime.provider,
        translatorModel: translated.translatorModel,
        reviewerModel: translated.reviewerModel,
        translatorRequestId: translated.translatorRequestId || null,
        reviewerRequestId: translated.reviewerRequestId || null,
        generatedAt: new Date().toISOString(),
      },
      payload: {
        description: translated.value.description,
        sourceLanguage: "Russian",
        sourceUrls: [...new Set([...englishTitleSourceUrls, ...russian.source_urls])] as string[],
        bibliographicTitle: {
          value: verifiedEnglishTitle,
          provider: titleSourceResponse.data.provider,
          sourceUrl: titleSourceResponse.data.source_url,
          retrievedAt: titleSourceResponse.data.retrieved_at || null,
        },
      },
    });

    await input.supabase.from("admin_audit_log").insert({
      actor_id: input.actorId,
      action: "literary_work.auto_translation.staged",
      entity_type: "literary_work",
      entity_id: input.workId,
      metadata: {
        locale: "en",
        source_hash: sourceHash,
        provider: runtime.provider,
        model: translated.translatorModel,
        reviewer_model: translated.reviewerModel,
        translator_request_id: translated.translatorRequestId,
        reviewer_request_id: translated.reviewerRequestId,
        input_tokens: translated.inputTokens,
        output_tokens: translated.outputTokens,
        review_input_tokens: translated.reviewInputTokens,
        review_output_tokens: translated.reviewOutputTokens,
        duration_ms: Date.now() - startedAt,
        working_draft_id: saved.id,
        human_review: "pending",
      },
    });

    return {
      state: "translated",
      ...premiumTranslationCandidateOutcome(saved),
      model: translated.translatorModel,
      reviewerModel: translated.reviewerModel,
    };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof PremiumTranslationDraftError && error.code === "conflict") {
      return { state: "conflict", error: error.message };
    }
    const message =
      error instanceof Error ? error.message : "automatic work translation failed";
    await input.supabase.from("admin_audit_log").insert({
      actor_id: input.actorId,
      action: "literary_work.auto_translation.failed",
      entity_type: "literary_work",
      entity_id: input.workId,
      metadata: {
        locale: "en",
        provider: runtime.provider,
        model: runtime.model,
        reviewer_model: runtime.reviewerModel,
        error_code: translationErrorCode(message),
        duration_ms: Date.now() - startedAt,
      },
    });
    return { state: "failed", error: message };
  }
}
