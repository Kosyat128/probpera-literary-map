import type { SupabaseClient } from "@supabase/supabase-js";
import { unstable_rethrow } from "next/navigation";
import { readCatalogTranslationCandidateFreshness } from "./catalog-translation-candidate-freshness-rpc";

import {
  countryProfileTranslationSource, validateCountryTranslationCandidate,
} from "./auto-translate-country-profile";
import { validateLiteraryWorkTranslationCandidate } from "./auto-translate-literary-work";
import {
  validateWriterBiographyTranslationCandidate, writerBiographyTranslationOwnership,
  writerBiographyTranslationSource,
} from "./auto-translate-writer-biography";
import { writerBiographySourceIdentity } from "./writer-biography-edit";
import { SiteCopyTranslationParameterError } from "./site-copy-parameters";
import {
  inspectSiteCopyTranslationOwnership, siteCopyTranslationSource, validateSiteCopyTranslationCandidate,
} from "./site-copy-translation-contract";
import {
  PremiumTranslationDraftError, readPremiumTranslationWorkingDraft,
  promotePremiumTranslationWorkingDraft, samePremiumTranslationJson,
  listSiteCopyPremiumTranslationWorkingDrafts,
  parseWriterBiographyCandidateIdentity,
  type PremiumTranslationCountryFields, type PremiumTranslationEntityType,
  type PremiumTranslationWorkingDraft,
} from "./premium-translation-working-draft";

export type ReviewText = { title: string; description?: string; fields?: PremiumTranslationCountryFields;
  items?: Array<{ key: string; text: string }> };
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

async function withCatalogFreshness(input: ReviewInput,
  draft: Extract<PremiumTranslationWorkingDraft, { entityType: "literary_work" | "country" }>, current: Inspection): Promise<Inspection> {
  // Already-disabled source/manual branches need no additional database read.
  if (!current.view.canPromote) return current;
  let problem: string;
  try {
    const receipt = await readCatalogTranslationCandidateFreshness(input.supabase, {
      entityType: draft.entityType, entityId: draft.entityId, draftId: draft.id, draftVersion: draft.version,
      candidateHash: draft.candidateHash, sourceHash: draft.sourceHash,
      catalogSourceHash: current.catalogSourceHash,
      catalogSourceFields: draft.entityType === "country" ? record(input.sourceFields) : null,
    });
    if (receipt.canPromote) return current;
    problem = receipt.reason === "source_changed"
      ? "Полные данные исходника или права изменились. Одобрение недоступно; черновик можно просмотреть или удалить."
      : "Черновик изменился или больше не найден. Обновите карточку перед одобрением.";
  } catch (error) {
    unstable_rethrow(error);
    problem = "Не удалось подтвердить актуальность полных данных исходника. Одобрение недоступно; черновик можно просмотреть или удалить.";
  }
  return { ...current, view: { ...current.view, canPromote: false, problem } };
}

async function inspect(input: ReviewInput, draft: PremiumTranslationWorkingDraft): Promise<Inspection> {
  if (draft.entityType !== input.entityType || draft.entityId !== input.entityId) throw new PremiumTranslationDraftError("unconfirmed");
  if (draft.entityType === "literary_work") return withCatalogFreshness(input, draft, await inspectBook(input, draft));
  if (draft.entityType === "writer_biography") return inspectWriter(input, draft);
  if (draft.entityType === "site_copy") return withSiteCopyFreshness(input, draft, await inspectSiteCopy(input, draft));
  return withCatalogFreshness(input, draft, await inspectCountry(input, draft));
}

async function withSiteCopyFreshness(input: ReviewInput,
  draft: Extract<PremiumTranslationWorkingDraft, { entityType: "site_copy" }>, current: Inspection): Promise<Inspection> {
  if (!current.view.canPromote) return current;
  let problem: string;
  try {
    const { readSiteCopyTranslationCandidateFreshness } = await import("./site-copy-translation-candidate-freshness-rpc");
    const receipt = await readSiteCopyTranslationCandidateFreshness(input.supabase, {
      entityType: "site_copy", entityId: draft.entityId, draftId: draft.id, draftVersion: draft.version,
      candidateHash: draft.candidateHash, sourceHash: draft.sourceHash,
    });
    if (receipt.canPromote) return current;
    problem = receipt.reason === "source_changed"
      ? "Полные данные текстов сайта изменились. Одобрение недоступно; черновик можно просмотреть или удалить."
      : "Связь сохранённого результата с этим черновиком не подтверждена. Обновите страницу перед одобрением.";
  } catch (error) {
    unstable_rethrow(error);
    problem = "Не удалось подтвердить полные данные исходника и сохранённого результата. Одобрение недоступно; черновик можно просмотреть или удалить.";
  }
  return { ...current, view: { ...current.view, canPromote: false, problem } };
}

async function inspectSiteCopy(input: ReviewInput,
  draft: Extract<PremiumTranslationWorkingDraft, { entityType: "site_copy" }>): Promise<Inspection> {
  const source = draft.sourceSnapshot;
  const bound = await siteCopyTranslationSource(source.settings);
  if (source.items.some((item) => !samePremiumTranslationJson(item, bound.items.find((candidate) => candidate.key === item.key))) ||
      await sourceHash(source.items) !== draft.sourceHash) throw new PremiumTranslationDraftError("unconfirmed");
  let parameterProblem: string | null = null;
  try {
    validateSiteCopyTranslationCandidate(source.items, draft.payload);
  } catch (error) {
    if (!(error instanceof SiteCopyTranslationParameterError)) throw error;
    parameterProblem = error.operatorMessage;
  }

  const response = await input.supabase.from("homepage_blocks").select("id,settings,updated_at")
    .contains("settings", { systemKey: "site-copy-overrides" }).limit(2);
  unstable_rethrow(response?.error);
  if (!response || response.error || !Array.isArray(response.data) || response.data.length > 1) {
    throw new PremiumTranslationDraftError("unavailable");
  }
  const existing = response.data.length ? record(response.data[0]) : null;
  const settings = existing ? record(existing.settings) : {};
  const copy = optionalRecord(settings.siteCopy), ru = optionalRecord(copy.ru), en = optionalRecord(copy.en);
  const revision = existing ? { id: text(existing.id), updatedAt: text(existing.updated_at) } : null;
  let problem: string | null = parameterProblem;
  let currentHash: string | null = null;
  if (!existing || existing.id !== input.entityId) {
    problem = "Исходный блок текстов сайта больше не найден. Кандидат можно просмотреть или удалить.";
  } else if (source.items.some((item) => ["manual", "invalid"].includes(inspectSiteCopyTranslationOwnership(settings, item.key)))) {
    problem = "Английские тексты изменены вручную или имеют неполные сведения о происхождении. Подтверждение кандидата недоступно.";
  } else if (!samePremiumTranslationJson(revision, draft.targetRevision) || !samePremiumTranslationJson(settings, source.settings)) {
    problem = "Тексты сайта изменились после создания кандидата. Его можно просмотреть или удалить.";
  } else {
    try {
      const live = await siteCopyTranslationSource(settings);
      const selected = source.items.map((item) => live.items.find((candidate) => candidate.key === item.key));
      if (!samePremiumTranslationJson(selected, source.items)) {
        problem = "Русский исходник или сведения о переводе изменились. Подтверждение кандидата недоступно.";
      } else {
        currentHash = await sourceHash(selected);
        validateSiteCopyTranslationCandidate(source.items, draft.payload);
      }
    } catch (error) {
      unstable_rethrow(error);
      problem = error instanceof SiteCopyTranslationParameterError ? error.operatorMessage
        : "Текущие исходники не прошли проверку. Кандидат можно просмотреть или удалить.";
    }
  }
  const currentItems = (values: Record<string, unknown>) => source.items.flatMap((item) =>
    typeof values[item.key] === "string" ? [{ key: item.key, text: values[item.key] as string }] : []);
  return {
    sourceHash: currentHash, catalogSourceHash: null,
    view: { status: "pending", draft,
      currentSource: existing ? { title: "Тексты сайта", items: currentItems(ru) } : null,
      currentEnglish: existing ? { title: "Сохранённый перевод", items: currentItems(en) } : null,
      candidateEnglish: { title: "Машинный кандидат", items: draft.payload.items },
      canPromote: problem === null, problem },
  };
}

async function inspectWriter(input: ReviewInput,
  draft: Extract<PremiumTranslationWorkingDraft, { entityType: "writer_biography" }>): Promise<Inspection> {
  const identity = parseWriterBiographyCandidateIdentity(input.entityId);
  if (!identity) throw new PremiumTranslationDraftError("unconfirmed");
  const sourceFields = record(input.sourceFields);
  const existing = data(await input.supabase.from("writer_profile_overrides")
    .select("id,fields,updated_at").eq("country_id", identity.countryId).eq("writer_id", identity.writerId).maybeSingle());
  const overrideFields = existing ? record(existing.fields) : {};
  const effectiveFields = { ...sourceFields, ...overrideFields };
  const current = writerBiographyTranslationSource(effectiveFields, identity.writerId);
  const source = draft.sourceSnapshot;
  const bound = writerBiographyTranslationSource({
    fullName: source.writerName, biographyTranslations: { ru: source.russianProfile },
  }, identity.writerId);
  const recordedProviderSource = {
    writerName: source.writerName, text: source.text, sourceLanguage: source.sourceLanguage, sources: source.sources,
  };
  // Validate a stale candidate against its captured source, so it stays inspectable
  // and discardable even when the live RU profile has been removed.
  if (!bound?.eligible || !samePremiumTranslationJson(
    JSON.parse(JSON.stringify(bound.source)), recordedProviderSource
  ) || await sourceHash(bound.source) !== draft.sourceHash) {
    throw new PremiumTranslationDraftError("unconfirmed");
  }
  validateWriterBiographyTranslationCandidate(draft.payload, recordedProviderSource);

  const currentHash = current ? await sourceHash(current.source) : null;
  const catalogHash = await sourceHash(sourceFields);
  const currentRevision = { id: existing ? text(existing.id) : null, updatedAt: existing ? text(existing.updated_at) : null };
  const ownership = writerBiographyTranslationOwnership(sourceFields, overrideFields);
  let problem: string | null = null;
  if (ownership === "human") {
    problem = "Ручная или неполная английская биография сохранена. Машинный кандидат не может её заменить.";
  } else if (ownership === "tombstone" && !draft.sourceRevision.replaceEnglishTombstone) {
    problem = "Английская биография была явно удалена. Подтверждение этого кандидата недоступно.";
  } else if (!samePremiumTranslationJson(currentRevision, draft.targetRevision)) {
    problem = "Карточка автора изменилась после создания кандидата. Подтверждение недоступно.";
  } else if (!current?.eligible || currentHash !== draft.sourceHash ||
      catalogHash !== draft.sourceRevision.catalogSourceHash ||
      !samePremiumTranslationJson(sourceFields, source.catalogFields) ||
      !samePremiumTranslationJson(current.russianProfile, source.russianProfile) ||
      !samePremiumTranslationJson(JSON.parse(JSON.stringify(current.source)), recordedProviderSource)) {
    problem = "Русская биография или её источники изменились. Кандидат устарел; его можно просмотреть или удалить.";
  }
  if (problem === null && current) validateWriterBiographyTranslationCandidate(draft.payload, current.source);
  const translations = optionalRecord(effectiveFields.biographyTranslations);
  const russian = optionalRecord(translations.ru), english = optionalRecord(translations.en);
  const title = writerBiographySourceIdentity(effectiveFields, identity.writerId);
  return {
    sourceHash: currentHash, catalogSourceHash: catalogHash,
    view: {
      status: "pending", draft,
      currentSource: typeof russian.text === "string" ? { title, description: russian.text } : null,
      currentEnglish: typeof english.text === "string" ? { title, description: english.text } : null,
      candidateEnglish: { title: source.writerName, description: draft.payload.text },
      canPromote: problem === null, problem,
    },
  };
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

export async function loadSiteCopyPremiumTranslationReviews(input: { supabase: SupabaseClient; afterId?: string | null }): Promise<{
  views: PremiumTranslationReviewView[]; nextCursor: string | null;
}> {
  try {
    const page = await listSiteCopyPremiumTranslationWorkingDrafts(input.supabase, input.afterId ?? null);
    return { views: await Promise.all(page.entityIds.map((entityId) => loadPremiumTranslationReview({
      supabase: input.supabase, entityType: "site_copy", entityId,
    }))), nextCursor: page.nextCursor };
  } catch (error) {
    unstable_rethrow(error);
    return { views: [{ status: "unavailable", problem: "Список машинных кандидатов недоступен. Сохранённые редакционные тексты остаются доступны." }], nextCursor: null };
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
    catalogSourceFields: input.entityType === "country" || input.entityType === "writer_biography"
      ? record(input.sourceFields) : null,
  });
  if (draft.targetRevision.id !== null && receipt.canonicalId !== draft.targetRevision.id) {
    throw new PremiumTranslationDraftError("unconfirmed");
  }
  return receipt;
}
