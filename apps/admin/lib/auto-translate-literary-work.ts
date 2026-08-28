import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { adminEnv } from "./env";
import { premiumTranslateToEnglish } from "./premium-english-translation";
import { premiumTranslationRuntimeMetadata } from "./premium-translation-runtime";

type SupabaseServerClient = SupabaseClient;

const translatedWorkSchema = z.object({
  title: z.string().trim().min(1).max(300),
  description: z.string().trim().min(140).max(900),
});

const translatedWorkJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "description"],
  properties: {
    title: { type: "string" },
    description: { type: "string" },
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
  if (/\p{Script=Cyrillic}/u.test(`${parsed.data.title} ${parsed.data.description}`)) {
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
  | "current"
  | "manual"
  | "skipped"
  | "not-configured"
  | "conflict"
  | "failed";

export async function ensureLiteraryWorkEnglishTranslation(input: {
  supabase: SupabaseServerClient;
  actorId: string;
  workId: string;
}): Promise<{
  state: LiteraryWorkAutoTranslationState;
  model?: string;
  reviewerModel?: string | null;
  error?: string;
}> {
  if (!adminEnv.openAiAutoTranslateLibrary) return { state: "skipped" };
  if (!adminEnv.premiumTranslationConfigured) return { state: "not-configured" };

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
      .select("id,title,description,translation_method,editorial_status,updated_at,metadata")
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
  if (
    existing &&
    existing.translation_method !== "machine-translation" &&
    new Set(["reviewed", "verified"]).has(existing.editorial_status)
  ) {
    return { state: "manual" };
  }

  const source = {
    title: russian.title,
    description: russian.description,
    originalTitle: work.original_title || "",
    firstPublished: work.first_published,
    originalLanguage: work.original_language || "",
    sourceLanguage: russian.source_language,
    sourceUrls: russian.source_urls,
  };
  const sourceHash = await sha256(source);
  const existingMetadata = translationMeta(existing?.metadata);
  const premiumMetadata = translationMeta(existingMetadata.premiumTranslation);
  if (
    existing?.translation_method === "machine-translation" &&
    premiumMetadata.sourceHash === sourceHash &&
    new Set(["reviewed", "verified"]).has(existing.editorial_status)
  ) {
    return { state: "current" };
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
        "Use the established English title when it is clearly standard and supported by the source context. Otherwise give a faithful English rendering without inventing an edition title.",
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

    const today = new Date().toISOString().slice(0, 10);
    const metadata = {
      ...existingMetadata,
      premiumTranslation: {
        sourceHash,
        provider: runtime.provider,
        translatorModel: translated.translatorModel,
        reviewerModel: translated.reviewerModel,
        translatorRequestId: translated.translatorRequestId,
        reviewerRequestId: translated.reviewerRequestId,
        generatedAt: new Date().toISOString(),
      },
    };
    const payload = {
      title: translated.value.title,
      description: translated.value.description,
      source_language: "Russian",
      translation_method: "machine-translation",
      editorial_status: "reviewed",
      source_urls: russian.source_urls,
      reviewed_at: today,
      metadata,
    };

    const saved = existing
      ? await input.supabase
          .from("literary_work_translations")
          .update(payload)
          .eq("id", existing.id)
          .eq("work_id", input.workId)
          .eq("locale", "en")
          .eq("updated_at", existing.updated_at)
          .select("id")
          .maybeSingle()
      : await input.supabase
          .from("literary_work_translations")
          .insert({ work_id: input.workId, locale: "en", ...payload })
          .select("id")
          .maybeSingle();

    if (saved.error || !saved.data) {
      return {
        state: existing && !saved.error ? "conflict" : "failed",
        error: saved.error?.message || "English work translation changed concurrently",
      };
    }

    await input.supabase.from("admin_audit_log").insert({
      actor_id: input.actorId,
      action: "literary_work.auto_translation.succeeded",
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
      },
    });

    return {
      state: "translated",
      model: translated.translatorModel,
      reviewerModel: translated.reviewerModel,
    };
  } catch (error) {
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
        error: message.slice(0, 500),
        duration_ms: Date.now() - startedAt,
      },
    });
    return { state: "failed", error: message };
  }
}
