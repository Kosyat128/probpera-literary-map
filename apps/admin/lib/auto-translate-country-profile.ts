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

const timelineItemSchema = z.object({
  year: z.string().max(80),
  title: z.string().max(500),
  description: z.string().max(2_000),
});

const translatedCountrySchema = z.object({
  name: z.string().trim().min(1).max(160),
  region: z.string().max(160),
  continent: z.string().max(160),
  officialLanguage: z.string().max(300),
  capital: z.string().max(200),
  description: z.string().max(4_000),
  history: z.string().max(8_000),
  historicalNote: z.string().max(4_000),
  literaryPeriods: z.array(z.string().max(300)).max(40),
  literaryMovements: z.array(z.string().max(300)).max(40),
  periods: z.array(z.string().max(300)).max(40),
  facts: z.array(z.string().max(1_000)).max(80),
  literaryPlaces: z.array(z.string().max(500)).max(80),
  timeline: z.array(timelineItemSchema).max(100),
  chronology: z.array(timelineItemSchema).max(100),
});

const translatedCountryJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "name",
    "region",
    "continent",
    "officialLanguage",
    "capital",
    "description",
    "history",
    "historicalNote",
    "literaryPeriods",
    "literaryMovements",
    "periods",
    "facts",
    "literaryPlaces",
    "timeline",
    "chronology",
  ],
  properties: {
    name: { type: "string", minLength: 1, maxLength: 160 },
    region: { type: "string", maxLength: 160 },
    continent: { type: "string", maxLength: 160 },
    officialLanguage: { type: "string", maxLength: 300 },
    capital: { type: "string", maxLength: 200 },
    description: { type: "string", maxLength: 4_000 },
    history: { type: "string", maxLength: 8_000 },
    historicalNote: { type: "string", maxLength: 4_000 },
    literaryPeriods: { type: "array", maxItems: 40, items: { type: "string", maxLength: 300 } },
    literaryMovements: { type: "array", maxItems: 40, items: { type: "string", maxLength: 300 } },
    periods: { type: "array", maxItems: 40, items: { type: "string", maxLength: 300 } },
    facts: { type: "array", maxItems: 80, items: { type: "string", maxLength: 1_000 } },
    literaryPlaces: { type: "array", maxItems: 80, items: { type: "string", maxLength: 500 } },
    timeline: {
      type: "array",
      maxItems: 100,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["year", "title", "description"],
        properties: {
          year: { type: "string", maxLength: 80 },
          title: { type: "string", maxLength: 500 },
          description: { type: "string", maxLength: 2_000 },
        },
      },
    },
    chronology: {
      type: "array",
      maxItems: 100,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["year", "title", "description"],
        properties: {
          year: { type: "string", maxLength: 80 },
          title: { type: "string", maxLength: 500 },
          description: { type: "string", maxLength: 2_000 },
        },
      },
    },
  },
} as const;

type TimelineItem = { year: string; title: string; description: string };

type CountryTranslationSource = z.infer<typeof translatedCountrySchema>;

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function stringList(value: unknown) {
  return Array.isArray(value)
    ? value.flatMap((item) =>
        typeof item === "string" && item.trim() ? [item.trim()] : []
      )
    : [];
}

function timeline(value: unknown): TimelineItem[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (typeof item === "string") {
      return { year: "", title: "", description: item.trim() };
    }
    const record = objectValue(item);
    return {
      year:
        typeof record.year === "number"
          ? String(record.year)
          : stringValue(record.year),
      title: stringValue(record.title),
      description: stringValue(record.description),
    };
  });
}

function sourceFromFields(fields: Record<string, unknown>): CountryTranslationSource {
  return {
    name: stringValue(fields.name),
    region: stringValue(fields.region),
    continent: stringValue(fields.continent),
    officialLanguage: stringValue(fields.officialLanguage),
    capital: stringValue(fields.capital),
    description: stringValue(fields.description),
    history: stringValue(fields.history),
    historicalNote: stringValue(fields.historicalNote),
    literaryPeriods: stringList(fields.literaryPeriods),
    literaryMovements: stringList(fields.literaryMovements),
    periods: stringList(fields.periods),
    facts: stringList(fields.facts),
    literaryPlaces: stringList(fields.literaryPlaces),
    timeline: timeline(fields.timeline),
    chronology: timeline(fields.chronology),
  };
}

function sameLength(
  left: readonly unknown[],
  right: readonly unknown[],
  label: string
) {
  if (left.length !== right.length) {
    throw new Error(`Premium country translation changed ${label} item count`);
  }
}

function validateCountryTranslation(
  source: CountryTranslationSource,
  value: unknown
) {
  const translated = translatedCountrySchema.parse(value);
  sameLength(source.literaryPeriods, translated.literaryPeriods, "literaryPeriods");
  sameLength(source.literaryMovements, translated.literaryMovements, "literaryMovements");
  sameLength(source.periods, translated.periods, "periods");
  sameLength(source.facts, translated.facts, "facts");
  sameLength(source.literaryPlaces, translated.literaryPlaces, "literaryPlaces");
  sameLength(source.timeline, translated.timeline, "timeline");
  sameLength(source.chronology, translated.chronology, "chronology");

  source.timeline.forEach((item, index) => {
    if (translated.timeline[index]?.year !== item.year) {
      throw new Error("Premium country translation changed a timeline year");
    }
  });
  source.chronology.forEach((item, index) => {
    if (translated.chronology[index]?.year !== item.year) {
      throw new Error("Premium country translation changed a chronology year");
    }
  });

  const visibleText = JSON.stringify(translated);
  if (/\p{Script=Cyrillic}/u.test(visibleText)) {
    throw new Error("Premium English country translation still contains Cyrillic");
  }
  return translated;
}

async function sha256(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

function compactFields(value: CountryTranslationSource) {
  return Object.fromEntries(
    Object.entries(value).filter(([, field]) =>
      Array.isArray(field) ? field.length > 0 : Boolean(field)
    )
  );
}

export type CountryTranslationState =
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

export async function ensureCountryEnglishProfile(input: {
  supabase: SupabaseClient;
  actorId: string;
  countryId: string;
  sourceFields: Record<string, unknown>;
  runtimeApproved?: boolean;
}): Promise<{
  state: CountryTranslationState;
  model?: string;
  reviewerModel?: string | null;
  error?: string;
} & Partial<PremiumTranslationCandidateOutcome>> {
  if (!adminEnv.openAiAutoTranslateProfiles) return { state: "skipped" };
  if (!input.runtimeApproved && !(await premiumTranslationRuntimeGate(input.supabase))) {
    return { state: "not-configured" };
  }

  const existingResponse = await input.supabase
    .from("country_profile_overrides")
    .select("id,fields,updated_at")
    .eq("country_id", input.countryId)
    .maybeSingle();
  if (existingResponse.error) {
    return { state: "failed", error: existingResponse.error.message };
  }

  const existing = existingResponse.data;
  const overrideFields = objectValue(existing?.fields);
  const effectiveFields = { ...input.sourceFields, ...overrideFields };
  const source = sourceFromFields(effectiveFields);
  if (!source.name || (!source.description && !source.history && !source.historicalNote)) {
    return {
      state: "skipped",
      error: "country profile has no substantive Russian editorial text",
    };
  }

  const translations = objectValue(effectiveFields.translations);
  const existingEnglish = objectValue(translations.en);
  const sourceTranslations = objectValue(input.sourceFields.translations);
  const hasEnglish = Object.prototype.hasOwnProperty.call(translations, "en");
  // An override may hide the catalog's translations map. Preserve existing
  // English unless the effective entry is explicitly machine-owned.
  const protectedEnglish = hasEnglish
    ? existingEnglish
    : objectValue(sourceTranslations.en);
  if (
    (hasEnglish || Object.prototype.hasOwnProperty.call(sourceTranslations, "en")) &&
    (protectedEnglish.locale !== "en" || protectedEnglish.method !== "machine-translation")
  ) {
    return { state: "manual" };
  }

  const sourceHash = await sha256(source);
  if (
    existingEnglish.locale === "en" &&
    existingEnglish.method === "machine-translation" &&
    existingEnglish.sourceHash === sourceHash &&
    new Set(["reviewed", "verified"]).has(String(existingEnglish.status))
  ) {
    return { state: "current" };
  }

  const sourceRevision = { overrideId: existing?.id || null, overrideUpdatedAt: existing?.updated_at || null,
    catalogSourceHash: await sha256(input.sourceFields) };
  const targetRevision = { id: existing?.id || null, updatedAt: existing?.updated_at || null };
  try {
    const pending = await readPremiumTranslationWorkingDraft(input.supabase, {
      entityType: "country", entityId: input.countryId,
    });
    if (pending) {
      if (pending.sourceHash !== sourceHash || pending.entityType !== "country" ||
          pending.sourceRevision.catalogSourceHash !== sourceRevision.catalogSourceHash) {
        return { state: "stale", error: "Country source changed; the saved private candidate requires review or discard" };
      }
      if (!samePremiumTranslationJson(pending.targetRevision, targetRevision)) {
        return { state: "conflict", error: "Country override changed after the private candidate was saved" };
      }
      return { state: "review-pending", ...premiumTranslationCandidateOutcome(pending),
        model: pending.provenance.translatorModel, reviewerModel: pending.provenance.reviewerModel };
    }
  } catch (error) {
    unstable_rethrow(error);
    return { state: "not-ready", error: "Private translation drafts are unavailable" };
  }

  const runtime = premiumTranslationRuntimeMetadata();
  try {
    const translated = await premiumTranslateToEnglish({
      source,
      schema: translatedCountryJsonSchema,
      schemaName: "probpera_country_profile_translation",
      validate: (value) => validateCountryTranslation(source, value),
      review: runtime.twoPassReview,
      maxOutputTokens: 12_000,
      domainInstructions: [
        "This is a factual country profile for a world-literature encyclopedia.",
        "Use established English country, region, capital and language names.",
        "Translate literary periods, movements, facts and places naturally while preserving meaning and item order.",
        "Keep every timeline and chronology year exactly unchanged and preserve the number and order of all array entries.",
        "Do not alter coordinates, country codes, flags, counts or other non-text data because they are not part of the translation payload.",
        "Do not invent historical facts, literary movements, authors, institutions or dates.",
      ],
    });

    const latest = existing
      ? await input.supabase
          .from("country_profile_overrides")
          .select("updated_at")
          .eq("id", existing.id)
          .maybeSingle()
      : null;
    if (
      existing &&
      (latest?.error ||
        !latest?.data ||
        latest.data.updated_at !== existing.updated_at)
    ) {
      return { state: "conflict", error: "country override changed during translation" };
    }

    const saved = await stagePremiumTranslationWorkingDraft(input.supabase, {
      entityType: "country", entityId: input.countryId,
      sourceHash, sourceSnapshot: source, sourceRevision, targetRevision,
      payload: { fields: translated.value },
      provenance: {
        provider: runtime.provider, translatorModel: translated.translatorModel,
        reviewerModel: translated.reviewerModel, translatorRequestId: translated.translatorRequestId || null,
        reviewerRequestId: translated.reviewerRequestId || null, generatedAt: new Date().toISOString(),
      },
    });

    await input.supabase.from("admin_audit_log").insert({
      actor_id: input.actorId,
      action: "country_profile.auto_translation.staged",
      entity_type: "country_profile",
      entity_id: input.countryId,
      metadata: {
        countryId: input.countryId,
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
      error instanceof Error ? error.message : "country profile translation failed";
    await input.supabase.from("admin_audit_log").insert({
      actor_id: input.actorId,
      action: "country_profile.auto_translation.failed",
      entity_type: "country_profile",
      entity_id: input.countryId,
      metadata: {
        locale: "en",
        provider: runtime.provider,
        model: runtime.model,
        reviewer_model: runtime.reviewerModel,
        error_code: translationErrorCode(message),
      },
    });
    return { state: "failed", error: message };
  }
}

export {
  sourceFromFields as countryProfileTranslationSource,
  validateCountryTranslation as validateCountryTranslationCandidate,
  compactFields as compactCountryTranslationFields,
};
