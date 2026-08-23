import type {
  WorkLocale,
  WorkProfile,
  WorkTranslationProfile,
} from "./countries/types";

const requiredLocales = ["ru", "en"] as const satisfies readonly WorkLocale[];
const publishableStatuses = new Set(["reviewed", "verified"]);
const lawfulTextMethods = new Set([
  "editorial-original",
  "human-translation",
  "machine-translation",
  "licensed-source",
]);
const mojibakeMarkers = ["Р°", "Рµ", "Рё", "СЃ", "С‚", "вЂ"];

export function countEditorialSentences(value: string) {
  const normalized = value.replace(/\s+/gu, " ").trim();
  if (!normalized) return 0;
  return normalized.match(/[.!?…]+(?=\s|$)/gu)?.length || 0;
}

export function translationQualityIssues(
  translation: WorkTranslationProfile | undefined,
  locale: WorkLocale
) {
  const issues: string[] = [];
  if (!translation) return [`нет перевода ${locale}`];
  if (translation.locale !== locale) issues.push(`locale не совпадает с ${locale}`);
  if (!translation.title.trim()) issues.push(`нет названия ${locale}`);
  if (!translation.sourceLanguage?.trim()) {
    issues.push(`не указан исходный язык текста ${locale}`);
  }
  if (!lawfulTextMethods.has(translation.method)) {
    issues.push(`не указан допустимый метод создания текста ${locale}`);
  }

  const description = translation.description.trim();
  const sentenceCount = countEditorialSentences(description);
  if (sentenceCount < 2 || sentenceCount > 3) {
    issues.push(`описание ${locale} должно содержать 2–3 предложения`);
  }
  if (description.length < 140 || description.length > 900) {
    issues.push(`описание ${locale} должно содержать 140–900 знаков`);
  }
  if (locale === "ru" && !/[А-Яа-яЁё]/u.test(description)) {
    issues.push("русское описание не содержит кириллицы");
  }
  if (locale === "en" && !/[A-Za-z]/u.test(description)) {
    issues.push("английское описание не содержит латиницы");
  }
  if (
    locale === "en" &&
    (/\p{Script=Cyrillic}/u.test(translation.title) ||
      /\p{Script=Cyrillic}/u.test(description))
  ) {
    issues.push("английская карточка содержит кириллицу");
  }
  if (mojibakeMarkers.some((marker) => description.includes(marker))) {
    issues.push(`описание ${locale} похоже на повреждённую кодировку`);
  }
  if (
    !translation.sourceUrls.length ||
    translation.sourceUrls.some((url) => !/^https:\/\//iu.test(url))
  ) {
    issues.push(`для перевода ${locale} нужны HTTPS-источники`);
  }
  if (!publishableStatuses.has(translation.status)) {
    issues.push(`перевод ${locale} не прошёл редакционную проверку`);
  }
  if (!translation.reviewedAt) issues.push(`нет даты проверки перевода ${locale}`);
  return issues;
}

export function bookPublicationIssues(work: WorkProfile) {
  const issues = requiredLocales.flatMap((locale) =>
    translationQualityIssues(work.translations?.[locale], locale)
  );
  if (!work.sources?.length) issues.push("нет структурированной provenance");
  if (
    work.sources?.some(
      (source) =>
        !/^https:\/\//iu.test(source.url) ||
        !source.provider.trim() ||
        !source.fields.length ||
        !source.retrievedAt
    )
  ) {
    issues.push("provenance заполнена не полностью");
  }

  const structuredSourceUrls = new Set(
    (work.sources || []).map((source) => source.url.trim())
  );
  for (const locale of requiredLocales) {
    const translation = work.translations?.[locale];
    if (!translation) continue;
    if (
      translation.sourceUrls.some(
        (sourceUrl) => !structuredSourceUrls.has(sourceUrl.trim())
      )
    ) {
      issues.push(`источники текста ${locale} не описаны в provenance`);
    }
    if (
      translation.method === "licensed-source" &&
      !(work.sources || []).some(
        (source) =>
          translation.sourceUrls.includes(source.url) &&
          source.usage === "licensed-copy" &&
          Boolean(source.license?.trim())
      )
    ) {
      issues.push(
        `для лицензированного текста ${locale} не зафиксированы лицензия и разрешение на копирование`
      );
    }
  }
  return issues;
}

/**
 * Single publication gate for every visitor-facing book selector. Drafts and
 * legacy title-only records stay available to editorial tooling via
 * buildBookArchive, but cannot leak into the public catalogue or search.
 */
export function isPublicBook(work: WorkProfile) {
  return (
    publishableStatuses.has(work.editorial?.status || "draft") &&
    bookPublicationIssues(work).length === 0
  );
}

export const isPublishableGeneratedBook = isPublicBook;

export const requiredBookLocales = requiredLocales;
