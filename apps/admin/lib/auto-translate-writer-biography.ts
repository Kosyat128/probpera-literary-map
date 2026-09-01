import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { adminEnv } from "./env";
import { premiumTranslateToEnglish } from "./premium-english-translation";
import { premiumTranslationRuntimeMetadata } from "./premium-translation-runtime";
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
  properties: { text: { type: "string" } },
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

export type WriterBiographyTranslationState =
  | "translated"
  | "current"
  | "manual"
  | "skipped"
  | "not-configured"
  | "conflict"
  | "failed";

export async function ensureWriterEnglishBiography(input: {
  supabase: SupabaseClient;
  actorId: string;
  countryId: string;
  writerId: string;
  sourceFields: Record<string, unknown>;
  replaceEnglishTombstone?: boolean;
}): Promise<{
  state: WriterBiographyTranslationState;
  model?: string;
  reviewerModel?: string | null;
  error?: string;
  overrideId?: string;
}> {
  if (!adminEnv.openAiAutoTranslateProfiles) return { state: "skipped" };
  if (!adminEnv.premiumTranslationConfigured) return { state: "not-configured" };

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
  const translations = biographyMap(effectiveFields.biographyTranslations);
  const russian = translations.ru;
  const english = translations.en;

  if (
    !russian ||
    !new Set(["reviewed", "verified"]).has(russian.status) ||
    russian.method !== "editorial-original" ||
    !russian.reviewedAt ||
    !russian.sources.length
  ) {
    return {
      state: "skipped",
      error: "a reviewed project-original Russian biography with provenance is required",
    };
  }

  const englishOwnership = writerBiographyEnglishAutomationOwnership({
    overrideFields,
    english,
  });
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

  const source = {
    writerName: writerBiographySourceIdentity(effectiveFields, input.writerId),
    text: russian.text,
    sourceLanguage: russian.sourceLanguage,
    sources: russian.sources,
  };
  const sourceHash = await sha256(source);
  if (isCurrentMachineWriterBiography({
    russian,
    english,
    sourceHash,
    writerName: source.writerName,
  })) {
    return { state: "current", overrideId: existingOverride?.id };
  }

  const runtime = premiumTranslationRuntimeMetadata();
  try {
    const translated = await premiumTranslateToEnglish({
      source,
      schema: biographyJsonSchema,
      schemaName: "probpera_writer_biography_translation",
      validate: (value) => validateEnglishBiography(value, source),
      // A checked biography may never be published from a single model pass,
      // even when the generic premium-translation setting disables review.
      review: true,
      maxOutputTokens: 4_000,
      domainInstructions: [
        "This is a concise factual literary biography for a world-literature encyclopedia.",
        "Preserve every biographical fact, date, institution, work and award exactly; do not infer missing facts.",
        "Use the established English form of the writer's name and institutions when unambiguous.",
        "Write 2-4 fluent sentences with an authoritative reference-work tone, not promotional copy.",
      ],
    });
    if (!translated.reviewerModel) {
      throw new Error(
        "writer biography translation did not complete the required reviewer pass"
      );
    }

    const latestResponse = existingOverride
      ? await input.supabase
          .from("writer_profile_overrides")
          .select("updated_at")
          .eq("id", existingOverride.id)
          .maybeSingle()
      : null;
    if (
      existingOverride &&
      (latestResponse?.error ||
        !latestResponse?.data ||
        latestResponse.data.updated_at !== existingOverride.updated_at)
    ) {
      return { state: "conflict", error: "writer override changed during translation" };
    }

    const generatedAt = new Date().toISOString();
    const providerLabel =
      runtime.provider === "cloudflare" ? "Cloudflare Workers AI" : "OpenAI";
    const englishProfile: BiographyProfile = {
      locale: "en",
      text: translated.value.text,
      sourceLanguage: "Russian",
      status: "reviewed",
      method: "machine-translation",
      reviewedAt: generatedAt.slice(0, 10),
      reviewer: `${providerLabel} ${translated.reviewerModel || translated.translatorModel}`,
      translatedFromLocale: "ru",
      sourceTextRights: "project-original",
      sources: russian.sources,
      translationMeta: {
        provider: runtime.provider,
        model: translated.translatorModel,
        reviewerModel: translated.reviewerModel,
        sourceHash,
        generatedAt,
        translatorRequestId: translated.translatorRequestId,
        reviewerRequestId: translated.reviewerRequestId,
      },
    };
    const fields = {
      ...overrideFields,
      biographyTranslations: {
        ...objectValue(effectiveFields.biographyTranslations),
        en: englishProfile,
      },
    };
    const payload = {
      country_id: input.countryId,
      writer_id: input.writerId,
      fields,
      is_enabled: true,
      updated_by: input.actorId,
    };

    const saved = existingOverride
      ? await input.supabase
          .from("writer_profile_overrides")
          .update(payload)
          .eq("id", existingOverride.id)
          .eq("updated_at", existingOverride.updated_at)
          .select("id")
          .maybeSingle()
      : await input.supabase
          .from("writer_profile_overrides")
          .insert(payload)
          .select("id")
          .maybeSingle();

    if (saved.error || !saved.data) {
      return {
        state: existingOverride && !saved.error ? "conflict" : "failed",
        error: saved.error?.message || "writer biography override changed concurrently",
      };
    }

    await input.supabase.from("admin_audit_log").insert({
      actor_id: input.actorId,
      action: "writer_profile.auto_translation.succeeded",
      entity_type: "writer_profile",
      entity_id: saved.data.id,
      metadata: {
        countryId: input.countryId,
        writerId: input.writerId,
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
      },
    });

    return {
      state: "translated",
      model: translated.translatorModel,
      reviewerModel: translated.reviewerModel,
      overrideId: saved.data.id,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "writer biography translation failed";
    await input.supabase.from("admin_audit_log").insert({
      actor_id: input.actorId,
      action: "writer_profile.auto_translation.failed",
      entity_type: "writer_profile",
      entity_id: `${input.countryId}:${input.writerId}`,
      metadata: {
        locale: "en",
        provider: runtime.provider,
        model: runtime.model,
        reviewer_model: runtime.reviewerModel,
        error: message.slice(0, 500),
      },
    });
    return { state: "failed", error: message };
  }
}
