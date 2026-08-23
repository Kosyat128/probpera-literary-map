import type {
  WriterBiographyLocale,
  WriterBiographyTranslationProfile,
  WriterProfile,
} from "./countries/types";

const publishableStatuses = new Set(["reviewed", "verified"]);
const lawfulMethods = new Set([
  "editorial-original",
  "human-translation",
  "machine-translation",
  "licensed-source",
]);
const translationSourceRights = new Set([
  "project-original",
  "public-domain",
  "licensed",
  "permission",
]);
const mojibakeMarkers = ["Р°", "Рµ", "Рё", "СЃ", "С‚", "вЂ"];

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

export function normalizeBiographyText(value: string) {
  return value.replace(/\s+/gu, " ").trim();
}

export function countBiographySentences(value: string) {
  const normalized = normalizeBiographyText(value);
  if (!normalized) return 0;
  return normalized.match(/[.!?…]+(?=\s|$)/gu)?.length || 0;
}

export function isGenericBiographyText(value: string) {
  const normalized = normalizeBiographyText(value);
  return genericBiographyPatterns.some((pattern) => pattern.test(normalized));
}

function hasCompleteSource(
  source: WriterBiographyTranslationProfile["sources"][number]
) {
  return (
    Boolean(source.provider.trim()) &&
    /^https:\/\//iu.test(source.url) &&
    source.fields.length > 0 &&
    Boolean(source.retrievedAt)
  );
}

function hasLicenseMetadata(
  source: WriterBiographyTranslationProfile["sources"][number]
) {
  return (
    source.usage === "licensed-copy" &&
    Boolean(source.licenseName?.trim()) &&
    Boolean(source.licenseUrl && /^https:\/\//iu.test(source.licenseUrl))
  );
}

export function writerBiographyQualityIssues(
  translation: WriterBiographyTranslationProfile | undefined,
  locale: WriterBiographyLocale,
  writer?: WriterProfile
) {
  const issues: string[] = [];
  if (!translation) return [`нет биографии ${locale}`];
  if (translation.locale !== locale) issues.push(`locale не совпадает с ${locale}`);
  if (!translation.sourceLanguage.trim()) {
    issues.push(`не указан исходный язык биографии ${locale}`);
  }
  if (!lawfulMethods.has(translation.method)) {
    issues.push(`не указан допустимый метод создания биографии ${locale}`);
  }

  const text = normalizeBiographyText(translation.text);
  const sentenceCount = countBiographySentences(text);
  if (sentenceCount < 2 || sentenceCount > 4) {
    issues.push(`биография ${locale} должна содержать 2–4 предложения`);
  }
  if (text.length < 120 || text.length > 1_600) {
    issues.push(`биография ${locale} должна содержать 120–1600 знаков`);
  }
  if (locale === "ru" && !/[А-Яа-яЁё]/u.test(text)) {
    issues.push("русская биография не содержит кириллицы");
  }
  if (locale === "en" && !/[A-Za-z]/u.test(text)) {
    issues.push("английская биография не содержит латиницы");
  }
  if (locale === "en" && /\p{Script=Cyrillic}/u.test(text)) {
    issues.push("английская биография содержит кириллицу");
  }
  if (mojibakeMarkers.some((marker) => text.includes(marker))) {
    issues.push(`биография ${locale} похожа на повреждённую кодировку`);
  }
  if (isGenericBiographyText(text)) {
    issues.push(`биография ${locale} является служебным или шаблонным текстом`);
  }
  if (!publishableStatuses.has(translation.status)) {
    issues.push(`биография ${locale} не прошла редакционную проверку`);
  }
  if (!translation.reviewedAt) {
    issues.push(`нет даты проверки биографии ${locale}`);
  }
  if (!translation.sources.length) {
    issues.push(`нет provenance биографии ${locale}`);
  } else if (translation.sources.some((source) => !hasCompleteSource(source))) {
    issues.push(`provenance биографии ${locale} заполнена не полностью`);
  }

  if (
    translation.method === "licensed-source" &&
    !translation.sources.some(hasLicenseMetadata)
  ) {
    issues.push(
      `для лицензированного текста ${locale} не зафиксированы лицензия и право копирования`
    );
  }

  if (
    translation.method === "human-translation" ||
    translation.method === "machine-translation"
  ) {
    if (!translationSourceRights.has(translation.sourceTextRights || "")) {
      issues.push(`для перевода ${locale} не зафиксированы права на исходный текст`);
    }
    if (
      translation.sourceTextRights === "project-original" &&
      (!translation.translatedFromLocale ||
        writer?.biographyTranslations?.[translation.translatedFromLocale]?.method !==
          "editorial-original")
    ) {
      issues.push(
        `перевод ${locale} не связан с редакционным оригиналом проекта`
      );
    }
    if (
      (translation.sourceTextRights === "licensed" ||
        translation.sourceTextRights === "permission") &&
      !translation.sources.some(hasLicenseMetadata)
    ) {
      issues.push(
        `для исходного текста перевода ${locale} нет лицензии или разрешения`
      );
    }
  }

  return [...new Set(issues)];
}

/**
 * Pure, locale-exact publication selector. It deliberately ignores legacy
 * `bio`, `biography` and `description` strings because those fields do not
 * prove who wrote the prose or whether it may lawfully be republished.
 */
export function selectWriterBiography(
  writer: WriterProfile,
  locale: WriterBiographyLocale
) {
  const translation = writer.biographyTranslations?.[locale];
  return writerBiographyQualityIssues(translation, locale, writer).length === 0
    ? translation || null
    : null;
}

export function writerBiographyText(
  writer: WriterProfile,
  locale: WriterBiographyLocale
) {
  return selectWriterBiography(writer, locale)?.text.trim() || null;
}

export function legacyWriterBiography(writer: WriterProfile) {
  return normalizeBiographyText(
    writer.biography || writer.bio || writer.description || ""
  );
}
