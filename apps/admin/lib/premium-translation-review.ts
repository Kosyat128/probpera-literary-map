import type { SupabaseClient } from "@supabase/supabase-js";
import { unstable_rethrow } from "next/navigation";

import {
  countryProfileTranslationSource, validateCountryTranslationCandidate,
} from "./auto-translate-country-profile";
import { validateLiteraryWorkTranslationCandidate } from "./auto-translate-literary-work";
import {
  PremiumTranslationDraftError, readPremiumTranslationWorkingDraft,
  promotePremiumTranslationWorkingDraft, samePremiumTranslationJson,
  type PremiumTranslationCountryFields, type PremiumTranslationEntityType,
  type PremiumTranslationWorkingDraft,
} from "./premium-translation-working-draft";

export type ReviewText = { title: string; description?: string; fields?: PremiumTranslationCountryFields };
export type PremiumTranslationReviewView =
  | { status: "none" }
  | { status: "unavailable"; problem: string }
  | { status: "pending"; draft: PremiumTranslationWorkingDraft; currentSource: ReviewText | null;
      currentEnglish: ReviewText | null; candidateEnglish: ReviewText;
      canPromote: boolean; problem: string | null };

type ReviewInput = {
  supabase: SupabaseClient;
  entityType: PremiumTranslationEntityType;
  entityId: string;
  sourceFields?: Record<string, unknown>;
};
type Inspection = {
  view: Extract<PremiumTranslationReviewView, { status: "pending" }>;
  sourceHash: string | null;
  catalogSourceHash: string | null;
};

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new PremiumTranslationDraftError("unconfirmed");
  return value as Record<string, unknown>;
}
function optionalRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function text(value: unknown): string {
  if (typeof value !== "string") throw new PremiumTranslationDraftError("unconfirmed");
  return value;
}
function textList(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) throw new PremiumTranslationDraftError("unconfirmed");
  return value;
}
async function sourceHash(value: unknown): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(value)));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
function data(response: { data: unknown; error: unknown } | null | undefined): Record<string, unknown> | null {
  unstable_rethrow(response?.error);
  if (!response || response.error) throw new PremiumTranslationDraftError("unavailable");
  return response.data === null ? null : record(response.data);
}

async function inspectBook(input: ReviewInput, draft: Extract<PremiumTranslationWorkingDraft, { entityType: "literary_work" }>): Promise<Inspection> {
  // No feature/runtime gate: inspecting and approving saved work performs no provider call.
  const [workRead, russianRead, englishRead, titleRead] = await Promise.all([
    input.supabase.from("literary_works")
      .select("id,title,original_title,first_published,original_language,editorial_status,updated_at")
      .eq("id", input.entityId).maybeSingle(),
    input.supabase.from("literary_work_translations")
      .select("id,title,description,source_language,source_urls,editorial_status,updated_at,metadata")
      .eq("work_id", input.entityId).eq("locale", "ru").maybeSingle(),
    input.supabase.from("literary_work_translations")
      .select("id,title,description,source_urls,translation_method,editorial_status,updated_at,metadata")
      .eq("work_id", input.entityId).eq("locale", "en").maybeSingle(),
    input.supabase.from("literary_work_sources").select("provider,source_url,retrieved_at")
      .eq("work_id", input.entityId).contains("field_names", ["title"])
      .eq("source_url", draft.payload.bibliographicTitle.sourceUrl).limit(1).maybeSingle(),
  ]);
  const work = data(workRead), russian = data(russianRead), english = data(englishRead), titleSource = data(titleRead);
  validateLiteraryWorkTranslationCandidate({ description: draft.payload.description });
  if (!work || !russian || !english || !titleSource) {
    // Confirmed deletion makes the saved candidate stale, not unreadable. Validate
    // every remaining row before displaying it; errors/malformed rows stay closed.
    if (work) {
      if (text(work.id) !== input.entityId || (work.first_published !== null && typeof work.first_published !== "number")) {
        throw new PremiumTranslationDraftError("unconfirmed");
      }
      text(work.updated_at); text(work.editorial_status);
      if (work.original_title != null) text(work.original_title);
      if (work.original_language != null) text(work.original_language);
    }
    if (russian) {
      text(russian.id); text(russian.title); text(russian.description); text(russian.updated_at);
      text(russian.source_language); text(russian.editorial_status); textList(russian.source_urls);
    }
    if (english) {
      text(english.id); text(english.title); text(english.description); text(english.updated_at);
      text(english.translation_method); text(english.editorial_status); textList(english.source_urls);
    }
    if (titleSource) {
      text(titleSource.provider); text(titleSource.source_url);
      if (titleSource.retrieved_at != null) text(titleSource.retrieved_at);
    }
    const problem = !work ? "Произведение больше не найдено. Черновик можно просмотреть или удалить."
      : !russian ? "Русский исходник больше не найден. Черновик можно просмотреть или удалить."
        : !english ? "Текущая английская версия больше не найдена. Черновик можно просмотреть или удалить."
          : "Библиографический источник названия больше не найден. Черновик можно просмотреть или удалить.";
    return { sourceHash: null, catalogSourceHash: null, view: {
      status: "pending", draft, currentSource: russian ? { title: text(russian.title), description: text(russian.description) } : null,
      currentEnglish: english ? { title: text(english.title), description: text(english.description) } : null,
      candidateEnglish: { title: draft.payload.bibliographicTitle.value, description: draft.payload.description },
      canPromote: false, problem,
    } };
  }
  const workId = text(work.id), russianId = text(russian.id), englishId = text(english.id);
  if (workId !== input.entityId) throw new PremiumTranslationDraftError("unconfirmed");
  if (work.first_published !== null && typeof work.first_published !== "number") throw new PremiumTranslationDraftError("unconfirmed");
  const source = {
    russianTitle: text(russian.title), verifiedEnglishTitle: text(english.title).trim(),
    verifiedEnglishTitleSourceUrl: text(titleSource.source_url), description: text(russian.description),
    originalTitle: work.original_title == null ? "" : text(work.original_title),
    firstPublished: work.first_published as number | null,
    originalLanguage: work.original_language == null ? "" : text(work.original_language),
    sourceLanguage: text(russian.source_language), sourceUrls: textList(russian.source_urls),
  };
  const currentHash = await sourceHash(source);
  const currentSourceRevision = { workId, workUpdatedAt: text(work.updated_at),
    russianId, russianUpdatedAt: text(russian.updated_at) };
  const currentTargetRevision = { id: englishId, updatedAt: text(english.updated_at) };
  const englishUrls = textList(english.source_urls).filter((url) => /^https:\/\//u.test(url));
  const expectedUrls = [...new Set([...englishUrls, ...source.sourceUrls])];
  const title = draft.payload.bibliographicTitle;
  const recorded = optionalRecord(optionalRecord(optionalRecord(english.metadata).premiumTranslation).bibliographicTitle);
  const validTitle = title.value === source.verifiedEnglishTitle && !/\p{Script=Cyrillic}/u.test(title.value) &&
    title.sourceUrl === source.verifiedEnglishTitleSourceUrl && title.provider === titleSource.provider &&
    title.retrievedAt === (titleSource.retrieved_at || null) && englishUrls.includes(title.sourceUrl) &&
    recorded.value === title.value && recorded.sourceUrl === title.sourceUrl &&
    samePremiumTranslationJson(draft.payload.sourceUrls, expectedUrls);
  let problem: string | null = null;
  if (english.translation_method !== "machine-translation") {
    problem = "Ручной английский перевод сохранён. Машинный кандидат не может его заменить.";
  } else if (!samePremiumTranslationJson(draft.targetRevision, currentTargetRevision)) {
    problem = "Английская запись изменилась после создания кандидата. Подтверждение недоступно.";
  } else if (currentHash !== draft.sourceHash || !samePremiumTranslationJson(draft.sourceSnapshot, source) ||
      !samePremiumTranslationJson(draft.sourceRevision, currentSourceRevision) ||
      !["reviewed", "verified"].includes(text(work.editorial_status)) ||
      !["reviewed", "verified"].includes(text(russian.editorial_status)) || !validTitle) {
    problem = "Русский исходник или источники изменились. Кандидат устарел; его можно просмотреть или удалить.";
  }
  return {
    sourceHash: currentHash, catalogSourceHash: null,
    view: { status: "pending", draft, currentSource: { title: source.russianTitle, description: source.description },
      currentEnglish: { title: text(english.title), description: text(english.description) },
      candidateEnglish: { title: title.value, description: draft.payload.description }, canPromote: problem === null, problem },
  };
}

async function inspectCountry(input: ReviewInput, draft: Extract<PremiumTranslationWorkingDraft, { entityType: "country" }>): Promise<Inspection> {
  const sourceFields = record(input.sourceFields);
  const response = await input.supabase.from("country_profile_overrides").select("id,fields,updated_at")
    .eq("country_id", input.entityId).maybeSingle();
  unstable_rethrow(response.error);
  if (response.error) throw new PremiumTranslationDraftError("unavailable");
  const existing = response.data === null ? null : record(response.data);
  const overrideFields = existing ? record(existing.fields) : {};
  const effectiveFields = { ...sourceFields, ...overrideFields };
  const source = countryProfileTranslationSource(effectiveFields);
  const currentHash = await sourceHash(source), catalogHash = await sourceHash(sourceFields);
  const translations = optionalRecord(effectiveFields.translations), sourceTranslations = optionalRecord(sourceFields.translations);
  const ownEnglish = Object.prototype.hasOwnProperty.call(translations, "en");
  const english = optionalRecord(ownEnglish ? translations.en : sourceTranslations.en);
  const englishPresent = ownEnglish || Object.prototype.hasOwnProperty.call(sourceTranslations, "en");
  const manual = englishPresent && (english.locale !== "en" || english.method !== "machine-translation");
  const currentRevision = { id: existing ? text(existing.id) : null, updatedAt: existing ? text(existing.updated_at) : null };
  // Validate against the bound generation source even when current RU has changed;
  // a stale candidate remains visible/discardable, never approvable.
  validateCountryTranslationCandidate(draft.sourceSnapshot, draft.payload.fields);
  let problem: string | null = null;
  if (manual) {
    problem = "Ручной или неполный английский перевод сохранён. Машинный кандидат не может его заменить.";
  } else if (!samePremiumTranslationJson(currentRevision, draft.targetRevision)) {
    problem = "Карточка страны изменилась после создания кандидата. Подтверждение недоступно.";
  } else if (currentHash !== draft.sourceHash || catalogHash !== draft.sourceRevision.catalogSourceHash ||
      !samePremiumTranslationJson(source, draft.sourceSnapshot)) {
    problem = "Русский исходник изменился. Кандидат устарел; его можно просмотреть или удалить.";
  }
  if (problem === null) validateCountryTranslationCandidate(source, draft.payload.fields);
  const currentEnglishFields = englishPresent ? countryProfileTranslationSource(optionalRecord(english.fields)) : null;
  return {
    sourceHash: currentHash, catalogSourceHash: catalogHash,
    view: { status: "pending", draft, currentSource: { title: source.name, fields: source },
      currentEnglish: currentEnglishFields ? { title: currentEnglishFields.name, fields: currentEnglishFields } : null,
      candidateEnglish: { title: draft.payload.fields.name, fields: draft.payload.fields }, canPromote: problem === null, problem },
  };
}

async function inspect(input: ReviewInput, draft: PremiumTranslationWorkingDraft): Promise<Inspection> {
  if (draft.entityType !== input.entityType || draft.entityId !== input.entityId) throw new PremiumTranslationDraftError("unconfirmed");
  return draft.entityType === "literary_work" ? inspectBook(input, draft) : inspectCountry(input, draft);
}

export async function loadPremiumTranslationReview(input: ReviewInput): Promise<PremiumTranslationReviewView> {
  try {
    const draft = await readPremiumTranslationWorkingDraft(input.supabase, input);
    return draft ? (await inspect(input, draft)).view : { status: "none" };
  } catch (error) {
    unstable_rethrow(error);
    return { status: "unavailable", problem: "Машинный кандидат недоступен или не прошёл проверку данных. Подтверждение перевода недоступно; сохранённые редакционные записи остаются на месте." };
  }
}

export async function approvePremiumTranslationReview(input: ReviewInput & {
  actorId: string; draftId: string; version: number; candidateHash: string;
}) {
  const draft = await readPremiumTranslationWorkingDraft(input.supabase, input);
  if (!draft || draft.id !== input.draftId || draft.version !== input.version || draft.candidateHash !== input.candidateHash) {
    throw new PremiumTranslationDraftError("conflict");
  }
  const current = await inspect(input, draft);
  if (!current.view.canPromote || current.sourceHash === null) throw new PremiumTranslationDraftError("conflict");
  const receipt = await promotePremiumTranslationWorkingDraft(input.supabase, {
    entityType: input.entityType, entityId: input.entityId, draftId: input.draftId,
    version: input.version, candidateHash: input.candidateHash, actorId: input.actorId,
    sourceHash: current.sourceHash, catalogSourceHash: current.catalogSourceHash,
    catalogSourceFields: input.entityType === "country" ? record(input.sourceFields) : null,
  });
  if (draft.targetRevision.id !== null && receipt.canonicalId !== draft.targetRevision.id) {
    throw new PremiumTranslationDraftError("unconfirmed");
  }
  return receipt;
}
