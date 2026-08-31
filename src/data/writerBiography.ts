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
// `Рё` is also a legitimate Cyrillic sequence in names such as «Рён».
// Corrupted UTF-8 Russian text contains the stronger markers below as well,
// so the ambiguous pair must not hide valid biographies on its own.
const mojibakeMarkers = ["Р°", "Рµ", "СЃ", "С‚", "вЂ"];

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
  return [...normalized.matchAll(/[.!?…]+(?=\s|$)/gu)].filter((match) => {
    if (match[0] !== "." || match.index === undefined) return true;
    const before = normalized.slice(0, match.index);
    const after = normalized.slice(match.index + 1);
    // A regnal Roman numeral ends the sentence in constructs such as
    // «Mohammed V. In 2003…»; unlike a personal-name initial, it must count.
    if (
      /(?:^|\s)[IVXLCDM]$/u.test(before) &&
      !/^\s+\p{Lu}\.(?:\s|$)/u.test(after)
    ) {
      return true;
    }
    return !(
      /(?:^|\s)\p{Lu}$/u.test(before) && /^\s+\p{Lu}/u.test(after)
    );
  }).length;
}

export function isGenericBiographyText(value: string) {
  const normalized = normalizeBiographyText(value);
  return genericBiographyPatterns.some((pattern) => pattern.test(normalized));
}

function hasCompleteSource(
  source: WriterBiographyTranslationProfile["sources"][number]
) {
  let safeUrl = false;
  try {
    const parsed = new URL(source.url);
    safeUrl =
      source.url.length <= 1_000 &&
      parsed.protocol === "https:" &&
      !parsed.username &&
      !parsed.password;
  } catch {
    safeUrl = false;
  }
  return (
    Boolean(source.provider.trim()) &&
    source.provider.length <= 240 &&
    safeUrl &&
    source.fields.length > 0 &&
    source.fields.every((field) => biographySourceFields.has(field)) &&
    biographySourceUsages.has(source.usage) &&
    isIsoDate(source.retrievedAt)
  );
}

function hasBiographyFactCheck(
  source: WriterBiographyTranslationProfile["sources"][number]
) {
  return (
    source.usage === "fact-check" &&
    source.fields.includes("biography-facts")
  );
}

function isIsoDate(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
  );
}

function hasCompleteMachineProvenance(
  translation: WriterBiographyTranslationProfile
) {
  const metadata = translation.translationMeta;
  return Boolean(
    metadata?.model?.trim() &&
      metadata.reviewerModel?.trim() &&
      metadata.sourceHash &&
      /^(?:sha256:)?[a-f0-9]{64}$/u.test(metadata.sourceHash) &&
      metadata.generatedAt &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(
        metadata.generatedAt
      ) &&
      !Number.isNaN(Date.parse(metadata.generatedAt))
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
    issues.push(`биография ${locale} должна содержать 2-4 предложения`);
  }
  if (text.length < 120 || text.length > 1_600) {
    issues.push(`биография ${locale} должна содержать 120-1600 знаков`);
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
  if (
    translation.method === "machine-translation" &&
    translation.status !== "reviewed"
  ) {
    issues.push(
      `машинный перевод ${locale} должен иметь статус reviewed`
    );
  }
  if (!isIsoDate(translation.reviewedAt)) {
    issues.push(`нет даты проверки биографии ${locale}`);
  }
  if (!translation.reviewer?.trim()) {
    issues.push(`не указан редактор биографии ${locale}`);
  }
  if (!translation.sources.length) {
    issues.push(`нет provenance биографии ${locale}`);
  } else if (translation.sources.some((source) => !hasCompleteSource(source))) {
    issues.push(`provenance биографии ${locale} заполнена не полностью`);
  }
  if (
    translation.sources.length &&
    !translation.sources.some(hasBiographyFactCheck)
  ) {
    issues.push(`нет fact-check источника biography-facts для биографии ${locale}`);
  }

  if (
    translation.method === "licensed-source" &&
    !translation.sources.some(hasLicenseMetadata)
  ) {
    if (
      !translation.translatedFromLocale ||
      translation.translatedFromLocale === locale
    ) {
      issues.push(`для перевода ${locale} не указан другой язык оригинала`);
    }
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
      translation.method === "machine-translation" &&
      !hasCompleteMachineProvenance(translation)
    ) {
      issues.push(`для машинного перевода ${locale} нет двухпроходной provenance`);
    }
    if (
      translation.method === "machine-translation" &&
      translation.translatedFromLocale &&
      writer?.biographyTranslations?.[translation.translatedFromLocale] &&
      JSON.stringify(translation.sources) !==
        JSON.stringify(
          writer.biographyTranslations[translation.translatedFromLocale]?.sources
        )
    ) {
      issues.push(`машинный перевод ${locale} не наследует provenance оригинала`);
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
