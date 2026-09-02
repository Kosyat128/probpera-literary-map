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
const authorshipKinds = new Set([
  "single",
  "multiple",
  "anonymous",
  "collective",
  "traditional",
  "disputed",
]);
const attributionKinds = new Set(["credited", "attributed", "disputed"]);
const mojibakeMarkers = ["Р°", "Рµ", "Рё", "СЃ", "С‚", "вЂ"];
const forbiddenControlCharacters = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u;

function safeString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function safeStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function isHttpsUrl(value: unknown) {
  try {
    const parsed = new URL(safeString(value));
    return parsed.protocol === "https:" && parsed.hostname.includes(".");
  } catch {
    return false;
  }
}

export function countEditorialSentences(value: string) {
  const normalized = safeString(value).replace(/\s+/gu, " ").trim();
  if (!normalized) return 0;
  return normalized.match(/[.!?…]+(?=\s|$)/gu)?.length || 0;
}

/** Objective prose defects only; semantic style remains a human review task. */
export function editorialProseQualityIssues(value: unknown, locale: WorkLocale) {
  const prose = safeString(value);
  const issues: string[] = [];
  if (prose !== prose.trim()) {
    issues.push(`описание ${locale} содержит краевые пробелы`);
  }
  if (/[ \t]{2,}|[\r\n]/u.test(prose)) {
    issues.push(`описание ${locale} содержит лишние пробелы или переносы`);
  }
  if (/\s+[,.!?;:]/u.test(prose)) {
    issues.push(`описание ${locale} содержит пробел перед знаком препинания`);
  }
  if (/<\/?[a-z][^>]*>/iu.test(prose)) {
    issues.push(`описание ${locale} содержит HTML`);
  }
  if (forbiddenControlCharacters.test(prose)) {
    issues.push(`описание ${locale} содержит управляющие символы`);
  }
  if (/https?:\/\//iu.test(prose)) {
    issues.push(`описание ${locale} содержит URL внутри текста`);
  }
  if (/[!?]{2,}/u.test(prose)) {
    issues.push(`описание ${locale} содержит экспрессивную пунктуацию`);
  }
  const openingGuillemets = prose.match(/«/gu)?.length || 0;
  const closingGuillemets = prose.match(/»/gu)?.length || 0;
  if (openingGuillemets !== closingGuillemets) {
    issues.push(`описание ${locale} содержит незакрытые кавычки`);
  }
  return issues;
}

export function translationQualityIssues(
  translation: WorkTranslationProfile | undefined,
  locale: WorkLocale
) {
  const issues: string[] = [];
  if (!translation) return [`нет перевода ${locale}`];
  const title = safeString(translation.title);
  const sourceUrls = safeStrings(translation.sourceUrls);
  if (translation.locale !== locale) issues.push(`locale не совпадает с ${locale}`);
  if (!title.trim()) issues.push(`нет названия ${locale}`);
  if (!safeString(translation.sourceLanguage).trim()) {
    issues.push(`не указан исходный язык текста ${locale}`);
  }
  if (!lawfulTextMethods.has(translation.method)) {
    issues.push(`не указан допустимый метод создания текста ${locale}`);
  }

  const description = safeString(translation.description).trim();
  issues.push(...editorialProseQualityIssues(translation.description, locale));
  const sentenceCount = countEditorialSentences(description);
  if (sentenceCount < 2 || sentenceCount > 3) {
    issues.push(`описание ${locale} должно содержать 2-3 предложения`);
  }
  if (description.length < 140 || description.length > 900) {
    issues.push(`описание ${locale} должно содержать 140-900 знаков`);
  }
  if (locale === "ru" && !/[А-Яа-яЁё]/u.test(description)) {
    issues.push("русское описание не содержит кириллицы");
  }
  if (locale === "en" && !/[A-Za-z]/u.test(description)) {
    issues.push("английское описание не содержит латиницы");
  }
  if (
    locale === "en" &&
    (/\p{Script=Cyrillic}/u.test(title) ||
      /\p{Script=Cyrillic}/u.test(description))
  ) {
    issues.push("английская карточка содержит кириллицу");
  }
  if (mojibakeMarkers.some((marker) => description.includes(marker))) {
    issues.push(`описание ${locale} похоже на повреждённую кодировку`);
  }
  if (
    sourceUrls.length === 0 || sourceUrls.some((url) => !isHttpsUrl(url))
  ) {
    issues.push(`для перевода ${locale} нужны HTTPS-источники`);
  }
  if (!publishableStatuses.has(translation.status)) {
    issues.push(`перевод ${locale} не прошёл редакционную проверку`);
  }
  if (!translation.reviewedAt) issues.push(`нет даты проверки перевода ${locale}`);
  return issues;
}

/**
 * Explicit authorship overrides the legacy routing writer, so malformed or
 * incomplete credits must fail publication rather than silently dropping a
 * coauthor from the visible byline.
 */
export function bookAuthorshipIssues(work: WorkProfile) {
  const authorship = work.authorship;
  if (authorship === undefined) return [];
  if (!authorship || typeof authorship !== "object") {
    return ["некорректная структура авторства"];
  }

  const issues: string[] = [];
  const kind = safeString(authorship.kind);
  const authors = Array.isArray(authorship.authors)
    ? authorship.authors
    : [];
  if (!authorshipKinds.has(kind)) issues.push("неизвестный тип авторства");
  if (!Array.isArray(authorship.authors)) {
    issues.push("список авторов должен быть массивом");
  }
  if (kind === "single" && authors.length !== 1) {
    issues.push("для single требуется ровно один автор");
  }
  if (kind === "multiple" && authors.length < 2) {
    issues.push("для multiple требуется не менее двух авторов");
  }
  if (["anonymous", "traditional"].includes(kind) && authors.length !== 0) {
    issues.push(`для ${kind} список авторов должен быть пустым`);
  }
  if (["collective", "disputed"].includes(kind) && authors.length < 1) {
    issues.push(`для ${kind} требуется хотя бы одна авторская подпись`);
  }

  const linkedKeys = new Set<string>();
  let hasDisputedCredit = false;
  for (const [index, rawAuthor] of authors.entries()) {
    const prefix = `автор ${index + 1}`;
    if (!rawAuthor || typeof rawAuthor !== "object") {
      issues.push(`${prefix}: некорректная запись`);
      continue;
    }
    const countryId = safeString(rawAuthor.countryId).trim();
    const writerId = safeString(rawAuthor.writerId).trim();
    if (Boolean(countryId) !== Boolean(writerId)) {
      issues.push(`${prefix}: countryId и writerId задаются только вместе`);
    }
    if (countryId && writerId) {
      const key = `${countryId}:${writerId}`;
      if (linkedKeys.has(key)) issues.push(`${prefix}: повторная ссылка на автора`);
      linkedKeys.add(key);
    }
    const ru = safeString(rawAuthor.creditNames?.ru).trim();
    const en = safeString(rawAuthor.creditNames?.en).trim();
    if (!ru) issues.push(`${prefix}: нет проверенной русской подписи`);
    if (!en) issues.push(`${prefix}: нет проверенной английской подписи`);
    if (en && /\p{Script=Cyrillic}/u.test(en)) {
      issues.push(`${prefix}: английская подпись содержит кириллицу`);
    }
    const attribution = safeString(rawAuthor.attribution || "credited");
    if (!attributionKinds.has(attribution)) {
      issues.push(`${prefix}: неизвестный статус атрибуции`);
    }
    if (attribution === "disputed") hasDisputedCredit = true;
  }
  if (kind === "disputed" && !hasDisputedCredit) {
    issues.push("для disputed нужна хотя бы одна спорная атрибуция");
  }
  return [...new Set(issues)];
}

export function bookPublicationIssues(work: WorkProfile) {
  const issues = [
    ...bookAuthorshipIssues(work),
    ...requiredLocales.flatMap((locale) =>
      translationQualityIssues(work.translations?.[locale], locale)
    ),
  ];
  const workSources = Array.isArray(work.sources)
    ? work.sources.filter(Boolean)
    : [];
  if (workSources.length === 0) {
    issues.push("нет структурированных сведений об источниках");
  }
  if (
    workSources.some(
      (source) =>
        !isHttpsUrl(source.url) ||
        !safeString(source.provider).trim() ||
        !Array.isArray(source.fields) ||
        source.fields.length === 0 ||
        !safeString(source.retrievedAt).trim()
    )
  ) {
    issues.push("сведения об источниках заполнены не полностью");
  }

  const structuredSourceUrls = new Set(
    workSources.map((source) => safeString(source.url).trim())
  );
  for (const locale of requiredLocales) {
    const translation = work.translations?.[locale];
    if (!translation) continue;
    const sourceUrls = safeStrings(translation.sourceUrls);
    if (
      sourceUrls.some(
        (sourceUrl) => !structuredSourceUrls.has(sourceUrl.trim())
      )
    ) {
      issues.push(`источники текста ${locale} не описаны в структурированном виде`);
    }
    if (
      translation.method === "licensed-source" &&
      !workSources.some(
        (source) =>
          sourceUrls.includes(safeString(source.url)) &&
          source.usage === "licensed-copy" &&
          Boolean(safeString(source.license).trim())
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
