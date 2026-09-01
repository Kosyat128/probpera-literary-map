import { createHash } from "node:crypto";

import {
  writerBiographyEditorialPostEditIssues,
  writerBiographyEnglishQaIssues,
  writerBiographySentenceCount,
} from "./writer-biography-english-qa.mjs";
import { isStructuredRussianBiographyText } from "./writer-biography-structured-ru.mjs";

const biographyStatuses = new Set(["reviewed", "verified"]);
const biographyMethods = new Set([
  "editorial-original",
  "human-translation",
  "machine-translation",
  "licensed-source",
]);
const biographyRights = new Set([
  "project-original",
  "public-domain",
  "licensed",
  "permission",
]);
const biographySourceUsages = new Set([
  "structured-data",
  "fact-check",
  "licensed-copy",
]);
const biographySourceFields = new Set([
  "identity",
  "life-dates",
  "biography-facts",
  "awards",
  "works",
]);
const genericBiographyPatterns = [
  /автор, связанный с литературной традицией/iu,
  /представител[ьница]* современной .*литературной сцены/iu,
  /расширенная биографическая карточка проходит редакционную проверку/iu,
  /расширенная биография .*готовится/iu,
  /представлен[а]? в книжном архиве произведениями/iu,
  /повторное литературное направление не созда[её]тся/iu,
  /в основную базу .* не включается/iu,
  /biograph(?:y|ical note) .* (?:is|being) prepared/iu,
];
const forbiddenEnglishPattern =
  /```|\bSOURCE_DATA\b|\bDRAFT_TRANSLATION\b|\bVALIDATION_FAILURE\b|\b(?:I cannot|I can(?:not|'t)|as an AI)\b/iu;
const mojibakeMarkers = ["Р°", "Рµ", "СЃ", "С‚", "вЂ"];

function plainRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function textValue(value, maximum, required = false) {
  if (typeof value !== "string") return required ? null : undefined;
  const normalized = value.replace(/\r\n?/gu, "\n").trim();
  if (
    (!normalized && required) ||
    normalized.length > maximum ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(normalized)
  ) {
    return null;
  }
  return normalized || undefined;
}

function isoDate(value) {
  const normalized = textValue(value, 10, true);
  if (!normalized || !/^\d{4}-\d{2}-\d{2}$/u.test(normalized)) return null;
  const [year, month, day] = normalized.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
    ? normalized
    : null;
}

function isoTimestamp(value) {
  const normalized = textValue(value, 80, true);
  return normalized &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(
      normalized
    ) &&
    !Number.isNaN(Date.parse(normalized))
    ? normalized
    : null;
}

function httpsUrl(value, maximum = 1_000) {
  const normalized = textValue(value, maximum, true);
  if (!normalized) return null;
  try {
    const url = new URL(normalized);
    return url.protocol === "https:" && !url.username && !url.password
      ? normalized
      : null;
  } catch {
    return null;
  }
}

function normalizeBiographySource(value) {
  const row = plainRecord(value);
  const provider = textValue(row.provider, 240, true);
  const url = httpsUrl(row.url);
  const retrievedAt = isoDate(row.retrievedAt);
  if (!Array.isArray(row.fields) || !row.fields.length) return null;
  const fields = [...new Set(row.fields)];
  if (
    fields.some(
      (field) => typeof field !== "string" || !biographySourceFields.has(field)
    )
  ) {
    return null;
  }
  const usage = textValue(row.usage, 80, true);
  const author = textValue(row.author, 300);
  const title = textValue(row.title, 500);
  const licenseName = textValue(row.licenseName, 300);
  const licenseUrl =
    row.licenseUrl === undefined || row.licenseUrl === ""
      ? undefined
      : httpsUrl(row.licenseUrl);
  if (
    !provider ||
    !url ||
    !retrievedAt ||
    !usage ||
    !biographySourceUsages.has(usage) ||
    licenseUrl === null
  ) {
    return null;
  }
  return {
    provider,
    url,
    fields,
    usage,
    retrievedAt,
    ...(author ? { author } : {}),
    ...(title ? { title } : {}),
    ...(licenseName ? { licenseName } : {}),
    ...(licenseUrl ? { licenseUrl } : {}),
  };
}

function isStructuredEnglishBiographyText(value) {
  return (
    value.length >= 120 &&
    value.length <= 1_600 &&
    writerBiographySentenceCount(value) >= 2 &&
    writerBiographySentenceCount(value) <= 4 &&
    /[A-Za-z]/u.test(value) &&
    !/\p{Script=Cyrillic}/u.test(value) &&
    !forbiddenEnglishPattern.test(value) &&
    !genericBiographyPatterns.some((pattern) => pattern.test(value)) &&
    !mojibakeMarkers.some((marker) => value.includes(marker))
  );
}

function normalizeTranslationMeta(value) {
  const row = plainRecord(value);
  const model = textValue(row.model, 120, true);
  const reviewerModel = textValue(row.reviewerModel, 120, true);
  const sourceHash = textValue(row.sourceHash, 128, true);
  const generatedAt = isoTimestamp(row.generatedAt);
  const editorialPostEditFields = [
    "editorialPostEditedAt",
    "editorialPostEditor",
    "editorialPostEditReasonCodes",
  ];
  const editorialPostEditFieldCount = editorialPostEditFields.filter(
    (field) => row[field] !== undefined
  ).length;
  if (
    !model ||
    !reviewerModel ||
    !sourceHash ||
    !/^(?:sha256:)?[a-f0-9]{64}$/u.test(sourceHash) ||
    !generatedAt ||
    (editorialPostEditFieldCount > 0 &&
      editorialPostEditFieldCount !== editorialPostEditFields.length)
  ) {
    return null;
  }
  if (editorialPostEditFieldCount === 0) {
    return { model, reviewerModel, sourceHash, generatedAt };
  }

  const editorialPostEditedAt = isoTimestamp(row.editorialPostEditedAt);
  const editorialPostEditor = textValue(row.editorialPostEditor, 300, true);
  const editorialPostEditReasonCodes = Array.isArray(
    row.editorialPostEditReasonCodes
  )
    ? row.editorialPostEditReasonCodes.map((reason) =>
        textValue(reason, 80, true)
      )
    : null;
  if (
    !editorialPostEditedAt ||
    !editorialPostEditor ||
    !editorialPostEditReasonCodes ||
    editorialPostEditReasonCodes.some((reason) => !reason) ||
    writerBiographyEditorialPostEditIssues({
      editedAt: editorialPostEditedAt,
      editor: editorialPostEditor,
      reasonCodes: editorialPostEditReasonCodes,
    }).length
  ) {
    return null;
  }
  return {
    model,
    reviewerModel,
    sourceHash,
    generatedAt,
    editorialPostEditedAt,
    editorialPostEditor,
    editorialPostEditReasonCodes,
  };
}

function normalizeBiographyProfile(value, locale) {
  const row = plainRecord(value);
  const text = textValue(row.text, 1_600, true);
  const sourceLanguage = textValue(row.sourceLanguage, 80, true);
  const status = textValue(row.status, 20, true);
  const method = textValue(row.method, 40, true);
  const reviewedAt = isoDate(row.reviewedAt);
  const reviewer = textValue(row.reviewer, 300, true);
  if (!Array.isArray(row.sources) || !row.sources.length) return null;
  const sources = row.sources.map(normalizeBiographySource);
  if (
    row.locale !== locale ||
    !text ||
    !sourceLanguage ||
    !status ||
    !biographyStatuses.has(status) ||
    !method ||
    !biographyMethods.has(method) ||
    (method === "machine-translation" && status !== "reviewed") ||
    !reviewedAt ||
    !reviewer ||
    sources.some((source) => !source) ||
    !sources.some(
      (source) =>
        source.usage === "fact-check" &&
        source.fields.includes("biography-facts")
    ) ||
    (locale === "ru"
      ? !isStructuredRussianBiographyText(text)
      : !isStructuredEnglishBiographyText(text))
  ) {
    return null;
  }

  const translatedFromLocale =
    row.translatedFromLocale === "ru" || row.translatedFromLocale === "en"
      ? row.translatedFromLocale
      : undefined;
  const sourceTextRights = biographyRights.has(String(row.sourceTextRights))
    ? String(row.sourceTextRights)
    : undefined;
  const isTranslation =
    method === "human-translation" || method === "machine-translation";
  const hasLicensedCopy = sources.some(
    (source) =>
      source.usage === "licensed-copy" &&
      Boolean(source.licenseName) &&
      Boolean(source.licenseUrl)
  );
  if (
    (isTranslation &&
      (!translatedFromLocale ||
        translatedFromLocale === locale ||
        !sourceTextRights)) ||
    (method === "licensed-source" && !hasLicensedCopy) ||
    ((sourceTextRights === "licensed" || sourceTextRights === "permission") &&
      !hasLicensedCopy)
  ) {
    return null;
  }

  const translationMeta =
    method === "machine-translation"
      ? normalizeTranslationMeta(row.translationMeta)
      : undefined;
  if (method === "machine-translation" && !translationMeta) return null;
  return {
    locale,
    text,
    sourceLanguage,
    status,
    method,
    reviewedAt,
    reviewer,
    ...(translatedFromLocale ? { translatedFromLocale } : {}),
    ...(sourceTextRights ? { sourceTextRights } : {}),
    sources,
    ...(translationMeta ? { translationMeta } : {}),
  };
}

export function writerBiographyPublicSourceHash({ writerName, russian }) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        writerName,
        text: russian.text,
        sourceLanguage: russian.sourceLanguage,
        sources: russian.sources,
      })
    )
    .digest("hex");
}

export function normalizePublicWriterBiographyTranslations(value, context = {}) {
  const row = plainRecord(value);
  const profiles = {
    ru: normalizeBiographyProfile(row.ru, "ru"),
    en: normalizeBiographyProfile(row.en, "en"),
  };
  for (const locale of ["ru", "en"]) {
    const profile = profiles[locale];
    if (!profile) continue;
    if (
      (profile.method === "human-translation" ||
        profile.method === "machine-translation") &&
      profile.sourceTextRights === "project-original" &&
      profiles[profile.translatedFromLocale]?.method !== "editorial-original"
    ) {
      profiles[locale] = null;
    }
  }
  if (
    profiles.en?.method === "machine-translation" &&
    (profiles.en.translatedFromLocale !== "ru" ||
      !profiles.ru ||
      JSON.stringify(profiles.en.sources) !== JSON.stringify(profiles.ru.sources))
  ) {
    profiles.en = null;
  }
  if (profiles.en?.method === "machine-translation") {
    const writerName = textValue(context.writerName, 300, true);
    const expectedSourceHash = writerName
      ? writerBiographyPublicSourceHash({
          writerName,
          russian: profiles.ru,
        })
      : null;
    const actualSourceHash = profiles.en.translationMeta.sourceHash.replace(
      /^sha256:/u,
      ""
    );
    const qaIssues = writerBiographyEnglishQaIssues({
      sourceText: profiles.ru?.text,
      englishText: profiles.en.text,
      writerName,
    });
    if (
      !expectedSourceHash ||
      actualSourceHash !== expectedSourceHash ||
      qaIssues.length
    ) {
      profiles.en = null;
    }
  }
  return {
    ...(profiles.ru ? { ru: profiles.ru } : {}),
    ...(profiles.en ? { en: profiles.en } : {}),
  };
}
