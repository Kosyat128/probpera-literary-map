export const writerBiographyLocales = ["ru", "en"] as const;
export const writerBiographyStatuses = ["draft", "reviewed", "verified"] as const;
export const writerBiographyMethods = [
  "editorial-original",
  "human-translation",
  "machine-translation",
  "licensed-source",
] as const;
export const writerBiographySourceFields = [
  "identity",
  "life-dates",
  "biography-facts",
  "awards",
  "works",
] as const;
export const writerBiographySourceUsages = [
  "structured-data",
  "fact-check",
  "licensed-copy",
] as const;
export const writerBiographySourceRights = [
  "project-original",
  "public-domain",
  "licensed",
  "permission",
] as const;

export type WriterBiographyLocale = (typeof writerBiographyLocales)[number];
export type WriterBiographyStatus = (typeof writerBiographyStatuses)[number];
export type WriterBiographyMethod = (typeof writerBiographyMethods)[number];
export type WriterBiographySourceField =
  (typeof writerBiographySourceFields)[number];
export type WriterBiographySourceUsage =
  (typeof writerBiographySourceUsages)[number];
export type WriterBiographySourceRight =
  (typeof writerBiographySourceRights)[number];

export type WriterBiographySource = {
  provider: string;
  url: string;
  fields: WriterBiographySourceField[];
  usage: WriterBiographySourceUsage;
  retrievedAt: string;
  author?: string;
  title?: string;
  licenseName?: string;
  licenseUrl?: string;
};

export type WriterBiographyProfile = {
  locale: WriterBiographyLocale;
  text: string;
  sourceLanguage: string;
  status: WriterBiographyStatus;
  method: WriterBiographyMethod;
  reviewedAt?: string;
  reviewer?: string;
  translatedFromLocale?: WriterBiographyLocale;
  sourceTextRights?: WriterBiographySourceRight;
  sources: WriterBiographySource[];
  translationMeta?: Record<string, unknown>;
};

export type WriterBiographyTranslations = Partial<
  Record<WriterBiographyLocale, WriterBiographyProfile>
>;

export type WriterBiographySaveTranslations = {
  ru: WriterBiographyProfile;
  en?: WriterBiographyProfile | null;
};

export type WriterBiographyLocaleEditorInput = {
  enabled: boolean;
  text: unknown;
  sourceLanguage: unknown;
  status: unknown;
  method: unknown;
  reviewedAt: unknown;
  reviewer: unknown;
  translatedFromLocale: unknown;
  sourceTextRights: unknown;
  sourcesJson: unknown;
};

export function writerBiographySourceIdentity(
  fields: Record<string, unknown>,
  writerId: string
) {
  const fullName =
    typeof fields.fullName === "string" ? fields.fullName.trim() : "";
  const name = typeof fields.name === "string" ? fields.name.trim() : "";
  return fullName || name || writerId;
}

// Keep this deny-list in parity with the public writerBiographyQualityIssues
// gate. Saving a text that the strict selector will hide is never reported as
// a successful editorial release.
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
const mojibakeMarkers = ["Р°", "Рµ", "СЃ", "С‚", "вЂ"];
const englishIdentityOpeningPattern =
  /^(?!(?:The|He|She|This|A|An)\b)(?=[^!?…]{1,120}\b(?:is|was)\b)\p{Lu}[^!?…]{1,120}\b(?:is|was)\b/u;
const forbiddenMachineOutputPattern =
  /```|\bSOURCE_DATA\b|\bDRAFT_TRANSLATION\b|\bVALIDATION_FAILURE\b|\b(?:I cannot|I can(?:not|'t)|as an AI)\b/iu;
const russianSourceNarrationPattern =
  /(?:подтверждает|фиксирует|документирует|называет|характеризует|описывает|атрибутирует|идентифицирует|перечисляет|указывает|сообщает|связывает|представляет|определяет|профиль (?:автора|издателя)|архивная страница|официальная страница|цифровой каталог|университетск(?:ая публикация|ое издательство|ое исследование)|национальная библиотека|литературный музей|институциональн(?:ая справка|ый материал)|авторитетная запись|библиографическая запись|(?:архив|каталог|издание|справка|библиотека|музей|профиль|страница)[^.]{0,100}(?:включает|содержит))/iu;
const russianTechnicalNarrationPattern =
  /(?:review|fact[- ]?check|sha-?256|source hash|проверено|не проверено|верифицирован|редакционн(?:ая|ое|ый) проверк|служебн(?:ая|ое|ый) пометк|источник недоступен|данные источника|согласно источнику|по данным (?:архива|каталога|профиля|страницы|источника))/iu;
const identityStopWords = new Set([
  "al",
  "bin",
  "bint",
  "da",
  "de",
  "del",
  "di",
  "dos",
  "du",
  "el",
  "ibn",
  "la",
  "le",
  "of",
  "the",
  "van",
  "von",
]);

function plainRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizedText(value: unknown, label: string, maximum: number) {
  if (typeof value !== "string") throw new Error(`${label}: требуется текст.`);
  const normalized = value.replace(/\r\n?/gu, "\n").trim();
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(normalized)) {
    throw new Error(`${label}: обнаружены недопустимые управляющие символы.`);
  }
  if (normalized.length > maximum) {
    throw new Error(`${label}: больше ${maximum} символов.`);
  }
  return normalized;
}

function requiredText(value: unknown, label: string, maximum: number) {
  const normalized = normalizedText(value, label, maximum);
  if (!normalized) throw new Error(`${label}: поле не заполнено.`);
  return normalized;
}

function enumValue<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  label: string,
  optional = false
): T[number] | undefined {
  const normalized = String(value ?? "").trim();
  if (!normalized && optional) return undefined;
  if (!allowed.includes(normalized)) {
    throw new Error(`${label}: выбрано недопустимое значение.`);
  }
  return normalized as T[number];
}

function isoDate(value: unknown, label: string, required = false) {
  const normalized = normalizedText(value, label, 10);
  if (!normalized && !required) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(normalized)) {
    throw new Error(`${label}: укажите дату в формате ГГГГ-ММ-ДД.`);
  }
  const [year, month, day] = normalized.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`${label}: такой даты не существует.`);
  }
  return normalized;
}

function httpsUrl(value: unknown, label: string, required = false) {
  const normalized = normalizedText(value, label, 1_000);
  if (!normalized && !required) return undefined;
  try {
    const parsed = new URL(normalized);
    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password ||
      /\s/u.test(normalized)
    ) {
      throw new Error("unsafe URL");
    }
  } catch {
    throw new Error(`${label}: требуется полный HTTPS-адрес.`);
  }
  return normalized;
}

function sentenceEnds(value: string) {
  const text = value.replace(/\s+/gu, " ").trim();
  return [...text.matchAll(/[.!?…]+(?=\s|$)/gu)].filter((match) => {
    if (match[0] !== "." || match.index === undefined) return true;
    const before = text.slice(0, match.index);
    const after = text.slice(match.index + 1);
    if (
      /(?:^|\s)[IVXLCDM]$/u.test(before) &&
      !/^\s+\p{Lu}\.(?:\s|$)/u.test(after)
    ) {
      return true;
    }
    return !(
      /(?:^|\s)\p{Lu}$/u.test(before) && /^\s+\p{Lu}/u.test(after)
    );
  });
}

function sentenceCount(value: string) {
  return sentenceEnds(value).length;
}

const russianSemanticStopWords = new Set([
  "была",
  "были",
  "было",
  "года",
  "году",
  "которого",
  "которая",
  "который",
  "которые",
  "среди",
  "стал",
  "стала",
  "является",
]);

function russianSemanticStem(word: string) {
  const normalized = word.toLocaleLowerCase("ru").replace(/ё/gu, "е");
  const adjectiveStem = normalized.replace(
    /(?:ского|скому|скими|ский|ская|ское|ские|ской|ским|скую)$/u,
    ""
  );
  const nounStem = adjectiveStem.replace(
    /(?:иями|ами|ями|ого|ому|ыми|ими|иях|ах|ях|ью|ою|ею|ом|ем|ой|ей|а|я|у|ю|ы|и|е)$/u,
    ""
  );
  const stem = nounStem.replace(/[ьъ]$/u, "");
  return stem.length >= 4 ? stem : normalized;
}

function russianBiographySentences(value: string) {
  const text = value.replace(/\s+/gu, " ").trim();
  let cursor = 0;
  return sentenceEnds(text)
    .map((match) => {
      const end = (match.index || 0) + match[0].length;
      const sentence = text.slice(cursor, end).trim();
      cursor = end;
      return sentence;
    })
    .filter(Boolean);
}

function russianSemanticWords(value: string) {
  return new Set(
    (value.toLocaleLowerCase("ru").match(/[\p{L}\p{N}]{4,}/gu) || [])
      .filter((word) => !russianSemanticStopWords.has(word))
      .map(russianSemanticStem)
  );
}

function hasRussianBiographyTautology(value: string) {
  const sentences = russianBiographySentences(value);
  for (let leftIndex = 0; leftIndex < sentences.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < sentences.length; rightIndex += 1) {
      const leftWords = russianSemanticWords(sentences[leftIndex]);
      const rightWords = russianSemanticWords(sentences[rightIndex]);
      const smallerSize = Math.min(leftWords.size, rightWords.size);
      const intersection = [...leftWords].filter((word) => rightWords.has(word)).length;
      const leftCanonical = [...leftWords].sort().join(" ");
      const rightCanonical = [...rightWords].sort().join(" ");
      const contained =
        Math.min(leftCanonical.length, rightCanonical.length) >= 45 &&
        (leftCanonical.includes(rightCanonical) ||
          rightCanonical.includes(leftCanonical));
      if (
        (smallerSize >= 4 && intersection / smallerSize >= 0.72) ||
        (smallerSize >= 4 && contained)
      ) {
        return true;
      }
    }
  }
  return false;
}

export function isGenericWriterBiographyText(value: string) {
  const normalized = value.replace(/\s+/gu, " ").trim();
  return genericBiographyPatterns.some((pattern) => pattern.test(normalized));
}

export function assertWriterBiographyTextQuality(
  locale: WriterBiographyLocale,
  text: string
) {
  if (text.length < 120) {
    throw new Error(
      `${locale.toUpperCase()}: биография должна содержать не меньше 120 символов.`
    );
  }
  const sentences = sentenceCount(text);
  if (sentences < 2 || sentences > 4) {
    throw new Error(
      `${locale.toUpperCase()}: биография должна содержать 2-4 предложения.`
    );
  }
  if (locale === "ru" && !/[А-Яа-яЁё]/u.test(text)) {
    throw new Error("RU: биография должна быть написана по-русски.");
  }
  if (
    locale === "ru" &&
    (russianSourceNarrationPattern.test(text) ||
      russianTechnicalNarrationPattern.test(text) ||
      hasRussianBiographyTautology(text))
  ) {
    throw new Error(
      "RU: биография содержит служебное описание источника, техническую пометку или повтор факта."
    );
  }
  if (
    locale === "en" &&
    (!/[A-Za-z]/u.test(text) || /\p{Script=Cyrillic}/u.test(text))
  ) {
    throw new Error("EN: английская биография не должна содержать кириллицу.");
  }
  if (isGenericWriterBiographyText(text)) {
    throw new Error(
      `${locale.toUpperCase()}: служебный или шаблонный текст нельзя публиковать как биографию.`
    );
  }
  if (locale === "en" && forbiddenMachineOutputPattern.test(text)) {
    throw new Error("EN: служебный вывод модели нельзя публиковать как биографию.");
  }
  if (mojibakeMarkers.some((marker) => text.includes(marker))) {
    throw new Error(
      `${locale.toUpperCase()}: текст похож на повреждённую кодировку.`
    );
  }
}

function sortedMatches(value: string, pattern: RegExp) {
  return [...value.replace(/\s+/gu, " ").trim().matchAll(pattern)]
    .map((match) => match[0].normalize("NFC"))
    .sort((left, right) => left.localeCompare(right, "en"));
}

function quotedSpanCount(value: string) {
  return [
    ...value.matchAll(/[«“"]([^»”"]+)[»”"]|‘([^’]+)’/gu),
  ].length;
}

function protectedLatinTokens(value: string) {
  return sortedMatches(
    value,
    /\p{Script=Latin}[\p{Script=Latin}\p{M}'’-]*/gu
  ).filter(
    (token) =>
      token.length >= 2 &&
      !/^[IVXLCDM]+$/u.test(token) &&
      !identityStopWords.has(token.toLocaleLowerCase("en"))
  );
}

export function assertWriterBiographyEnglishFidelity(input: {
  sourceText: string;
  englishText: string;
  writerName: string;
}) {
  const sourceText = input.sourceText.replace(/\s+/gu, " ").trim();
  const englishText = input.englishText.replace(/\s+/gu, " ").trim();
  const writerName = input.writerName.replace(/\s+/gu, " ").trim();
  assertWriterBiographyTextQuality("en", englishText);
  if (!sourceText || !writerName) {
    throw new Error("EN: отсутствует точный RU-оригинал или идентичность автора.");
  }
  if (
    forbiddenMachineOutputPattern.test(englishText) ||
    !englishIdentityOpeningPattern.test(englishText)
  ) {
    throw new Error("EN: перевод должен начинаться с имени автора и не содержать служебный вывод модели.");
  }
  if (
    JSON.stringify(sortedMatches(sourceText, /\p{Number}+/gu)) !==
    JSON.stringify(sortedMatches(englishText, /\p{Number}+/gu))
  ) {
    throw new Error("EN: числовые факты не совпадают с русским оригиналом.");
  }
  if (quotedSpanCount(sourceText) !== quotedSpanCount(englishText)) {
    throw new Error("EN: изменилось число названий произведений в кавычках.");
  }
  const foldedEnglish = englishText.toLocaleLowerCase("en");
  if (
    protectedLatinTokens(sourceText).some(
      (token) => !foldedEnglish.includes(token.toLocaleLowerCase("en"))
    )
  ) {
    throw new Error("EN: пропущен защищённый латинский термин из RU-оригинала.");
  }
  const identityTokens = protectedLatinTokens(writerName);
  if (
    identityTokens.length &&
    !identityTokens.some((token) =>
      foldedEnglish.includes(token.toLocaleLowerCase("en"))
    )
  ) {
    throw new Error("EN: в переводе отсутствует идентичность автора.");
  }
  return englishText;
}

export function isCurrentMachineWriterBiography(input: {
  russian: WriterBiographyProfile;
  english: WriterBiographyProfile | undefined;
  sourceHash: string;
  writerName: string;
}) {
  const english = input.english;
  const metadata = english?.translationMeta;
  if (
    !english ||
    english.locale !== "en" ||
    english.method !== "machine-translation" ||
    english.status !== "reviewed" ||
    english.translatedFromLocale !== "ru" ||
    english.sourceTextRights !== "project-original" ||
    !english.reviewer?.trim() ||
    !english.reviewedAt ||
    typeof metadata?.model !== "string" ||
    !metadata.model.trim() ||
    typeof metadata.reviewerModel !== "string" ||
    !metadata.reviewerModel.trim() ||
    metadata.sourceHash !== input.sourceHash ||
    typeof metadata.generatedAt !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u.test(
      metadata.generatedAt
    ) ||
    Number.isNaN(Date.parse(metadata.generatedAt)) ||
    JSON.stringify(english.sources) !== JSON.stringify(input.russian.sources)
  ) {
    return false;
  }
  try {
    isoDate(english.reviewedAt, "Дата проверки EN", true);
    assertWriterBiographyEnglishFidelity({
      sourceText: input.russian.text,
      englishText: english.text,
      writerName: input.writerName,
    });
    return true;
  } catch {
    return false;
  }
}

function normalizedSource(value: unknown, index: number): WriterBiographySource {
  const row = plainRecord(value);
  const label = `Источник ${index + 1}`;
  const fieldsValue = Array.isArray(row.fields) ? row.fields : [];
  const fields = [
    ...new Set(
      fieldsValue.map((field) =>
        enumValue(field, writerBiographySourceFields, `${label}, fields`)
      )
    ),
  ] as WriterBiographySourceField[];
  if (!fields.length) throw new Error(`${label}: не указаны подтверждаемые поля.`);
  const usage = enumValue(
    row.usage,
    writerBiographySourceUsages,
    `${label}, usage`
  )!;
  const licenseName = normalizedText(
    row.licenseName ?? "",
    `${label}, licenseName`,
    300
  );
  const licenseUrl = httpsUrl(
    row.licenseUrl ?? "",
    `${label}, licenseUrl`
  );
  if (usage === "licensed-copy" && (!licenseName || !licenseUrl)) {
    throw new Error(
      `${label}: для licensed-copy обязательны licenseName и licenseUrl.`
    );
  }
  return {
    provider: requiredText(row.provider, `${label}, provider`, 240),
    url: httpsUrl(row.url, `${label}, url`, true)!,
    fields,
    usage,
    retrievedAt: isoDate(row.retrievedAt, `${label}, retrievedAt`, true)!,
    ...(normalizedText(row.author ?? "", `${label}, author`, 300)
      ? { author: normalizedText(row.author, `${label}, author`, 300) }
      : {}),
    ...(normalizedText(row.title ?? "", `${label}, title`, 500)
      ? { title: normalizedText(row.title, `${label}, title`, 500) }
      : {}),
    ...(licenseName ? { licenseName } : {}),
    ...(licenseUrl ? { licenseUrl } : {}),
  };
}

export function parseWriterBiographySourcesJson(value: unknown) {
  const source = normalizedText(value, "Источники", 50_000);
  if (!source) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new Error("Источники: JSON заполнен с ошибкой.");
  }
  if (!Array.isArray(parsed)) {
    throw new Error("Источники: ожидается JSON-массив.");
  }
  if (parsed.length > 20) {
    throw new Error("Источники: допускается не больше 20 записей.");
  }
  return parsed.map(normalizedSource);
}

function normalizedStoredSource(value: unknown): WriterBiographySource | null {
  try {
    return normalizedSource(value, 0);
  } catch {
    return null;
  }
}

function normalizedStoredProfile(
  value: unknown,
  locale: WriterBiographyLocale
): WriterBiographyProfile | null {
  const row = plainRecord(value);
  if (row.locale !== locale || typeof row.text !== "string") return null;
  try {
    const sources = Array.isArray(row.sources)
      ? row.sources.flatMap((source) => {
          const normalized = normalizedStoredSource(source);
          return normalized ? [normalized] : [];
        })
      : [];
    const translationMeta = plainRecord(row.translationMeta);
    return {
      locale,
      text: normalizedText(row.text, "Текст биографии", 1_600),
      sourceLanguage: requiredText(
        row.sourceLanguage,
        "Исходный язык",
        80
      ),
      status: enumValue(row.status, writerBiographyStatuses, "Статус")!,
      method: enumValue(row.method, writerBiographyMethods, "Метод")!,
      ...(isoDate(row.reviewedAt ?? "", "Дата проверки")
        ? { reviewedAt: isoDate(row.reviewedAt, "Дата проверки") }
        : {}),
      ...(normalizedText(row.reviewer ?? "", "Проверяющий", 300)
        ? { reviewer: normalizedText(row.reviewer, "Проверяющий", 300) }
        : {}),
      ...(enumValue(
        row.translatedFromLocale,
        writerBiographyLocales,
        "Язык оригинала",
        true
      )
        ? {
            translatedFromLocale: enumValue(
              row.translatedFromLocale,
              writerBiographyLocales,
              "Язык оригинала",
              true
            ),
          }
        : {}),
      ...(enumValue(
        row.sourceTextRights,
        writerBiographySourceRights,
        "Права на исходный текст",
        true
      )
        ? {
            sourceTextRights: enumValue(
              row.sourceTextRights,
              writerBiographySourceRights,
              "Права на исходный текст",
              true
            ),
          }
        : {}),
      sources,
      ...(Object.keys(translationMeta).length ? { translationMeta } : {}),
    };
  } catch {
    return null;
  }
}

export function parseStoredWriterBiographyTranslations(
  value: unknown
): WriterBiographyTranslations {
  const row = plainRecord(value);
  const ru = normalizedStoredProfile(row.ru, "ru");
  const en = normalizedStoredProfile(row.en, "en");
  return {
    ...(ru ? { ru } : {}),
    ...(en ? { en } : {}),
  };
}

export function effectiveStoredWriterBiographyTranslations(
  sourceValue: unknown,
  overrideValue: unknown
): WriterBiographyTranslations {
  const source = parseStoredWriterBiographyTranslations(sourceValue);
  const override = parseStoredWriterBiographyTranslations(overrideValue);
  // The public publisher treats an explicit biographyTranslations property as
  // ownership of the whole locale map. Mirror that rule in the editor: an
  // empty/partial/null durable value is a tombstone for every omitted locale,
  // while only an absent property (undefined) falls back to the catalog.
  return overrideValue === undefined ? source : override;
}

export type WriterBiographyEnglishAutomationOwnership =
  | "automatic"
  | "human"
  | "tombstone";

export function writerBiographyEnglishAutomationOwnership(input: {
  overrideFields: unknown;
  english: Pick<WriterBiographyProfile, "method"> | null | undefined;
}): WriterBiographyEnglishAutomationOwnership {
  const overrideFields = plainRecord(input.overrideFields);
  if (Object.hasOwn(overrideFields, "biographyTranslations")) {
    const overrideTranslations = plainRecord(
      overrideFields.biographyTranslations
    );
    if (
      !Object.hasOwn(overrideTranslations, "en") ||
      overrideTranslations.en === null ||
      overrideTranslations.en === undefined
    ) {
      return "tombstone";
    }
  }
  return input.english && input.english.method !== "machine-translation"
    ? "human"
    : "automatic";
}

function normalizedEditorProfile(
  locale: WriterBiographyLocale,
  input: WriterBiographyLocaleEditorInput,
  stored: WriterBiographyProfile | undefined
): WriterBiographyProfile | null {
  if (!input.enabled) return null;
  const text = requiredText(
    input.text,
    locale === "ru" ? "Русская биография" : "Английская биография",
    1_600
  );
  assertWriterBiographyTextQuality(locale, text);

  const status = enumValue(input.status, writerBiographyStatuses, "Статус")!;
  const method = enumValue(input.method, writerBiographyMethods, "Метод")!;
  if (method === "machine-translation" && status !== "reviewed") {
    throw new Error(
      `${locale.toUpperCase()}: двухпроходный машинный перевод может иметь только статус reviewed.`
    );
  }
  const reviewedAt = isoDate(
    input.reviewedAt,
    "Дата проверки",
    status === "reviewed" || status === "verified"
  );
  const sources = parseWriterBiographySourcesJson(input.sourcesJson);
  if ((status === "reviewed" || status === "verified") && !sources.length) {
    throw new Error(
      `${locale.toUpperCase()}: для проверенного статуса нужен хотя бы один источник.`
    );
  }
  if (
    (status === "reviewed" || status === "verified") &&
    !sources.some(
      (source) =>
        source.usage === "fact-check" &&
        source.fields.includes("biography-facts")
    )
  ) {
    throw new Error(
      `${locale.toUpperCase()}: проверенный статус требует источник fact-check для biography-facts.`
    );
  }
  if (
    method === "licensed-source" &&
    !sources.some((source) => source.usage === "licensed-copy")
  ) {
    throw new Error(
      `${locale.toUpperCase()}: licensed-source требует источник licensed-copy.`
    );
  }

  const translatedFromLocale = enumValue(
    input.translatedFromLocale,
    writerBiographyLocales,
    "Язык оригинала",
    true
  );
  const sourceTextRights = enumValue(
    input.sourceTextRights,
    writerBiographySourceRights,
    "Права на исходный текст",
    true
  );
  if (method === "human-translation" || method === "machine-translation") {
    if (!translatedFromLocale || translatedFromLocale === locale) {
      throw new Error(
        `${locale.toUpperCase()}: для перевода укажите другой язык оригинала.`
      );
    }
    if (!sourceTextRights) {
      throw new Error(
        `${locale.toUpperCase()}: для перевода зафиксируйте права на исходный текст.`
      );
    }
    if (
      (sourceTextRights === "licensed" || sourceTextRights === "permission") &&
      !sources.some((source) => source.usage === "licensed-copy")
    ) {
      throw new Error(
        `${locale.toUpperCase()}: для прав ${sourceTextRights} нужен источник licensed-copy с лицензией или разрешением.`
      );
    }
  }

  const sourceLanguage = requiredText(
    input.sourceLanguage,
    "Исходный язык",
    80
  );
  const reviewer = normalizedText(input.reviewer, "Проверяющий", 300);
  if ((status === "reviewed" || status === "verified") && !reviewer) {
    throw new Error(
      `${locale.toUpperCase()}: для проверенного статуса укажите проверяющего.`
    );
  }

  if (
    locale === "en" &&
    method === "machine-translation" &&
    (!stored?.translationMeta ||
      stored.text !== text ||
      stored.sourceLanguage !== sourceLanguage ||
      stored.status !== status ||
      stored.reviewedAt !== reviewedAt ||
      (stored.reviewer || "") !== reviewer ||
      stored.translatedFromLocale !== translatedFromLocale ||
      stored.sourceTextRights !== sourceTextRights ||
      JSON.stringify(stored.sources) !== JSON.stringify(sources))
  ) {
    throw new Error(
      "EN: изменённый вручную машинный текст нужно сохранить как human-translation."
    );
  }

  return {
    locale,
    text,
    sourceLanguage,
    status,
    method,
    ...(reviewedAt ? { reviewedAt } : {}),
    ...(reviewer ? { reviewer } : {}),
    ...(translatedFromLocale ? { translatedFromLocale } : {}),
    ...(sourceTextRights ? { sourceTextRights } : {}),
    sources,
    ...(method === "machine-translation" && stored?.translationMeta
      ? { translationMeta: stored.translationMeta }
      : {}),
  };
}

function russianSourceFingerprint(profile: WriterBiographyProfile | undefined) {
  if (!profile) return "";
  return JSON.stringify({
    text: profile.text,
    sourceLanguage: profile.sourceLanguage,
    sources: profile.sources,
  });
}

function autoTranslatableRussianBiography(
  profile: WriterBiographyProfile | undefined
) {
  return Boolean(
    profile &&
      (profile.status === "reviewed" || profile.status === "verified") &&
      profile.method === "editorial-original" &&
      profile.reviewedAt &&
      profile.sources.length
  );
}

export function buildWriterBiographySaveModel(input: {
  sourceTranslations: unknown;
  overrideTranslations: unknown;
  ru: WriterBiographyLocaleEditorInput;
  en: WriterBiographyLocaleEditorInput;
  confirmManualEnglishAgainstRussianChange?: boolean;
  manualEnglishConfirmationDate?: string;
}) {
  const effective = effectiveStoredWriterBiographyTranslations(
    input.sourceTranslations,
    input.overrideTranslations
  );
  const ru = normalizedEditorProfile("ru", input.ru, effective.ru);
  if (!ru) {
    throw new Error(
      "RU: русский редакционный оригинал обязателен для карточки писателя."
    );
  }
  const submittedEn = normalizedEditorProfile("en", input.en, effective.en);
  if (
    submittedEn?.sourceTextRights === "project-original" &&
    ru.method !== "editorial-original"
  ) {
    throw new Error(
      "EN: project-original допустим только для перевода редакционного RU-оригинала."
    );
  }
  if (
    (ru.method === "human-translation" ||
      ru.method === "machine-translation") &&
    ru.sourceTextRights === "project-original" &&
    submittedEn?.method !== "editorial-original"
  ) {
    throw new Error(
      "RU: project-original допустим только для перевода редакционного EN-оригинала."
    );
  }
  const russianSourceChanged =
    russianSourceFingerprint(effective.ru) !==
    russianSourceFingerprint(ru || undefined);
  const explicitEnglishTombstone = !input.en.enabled;
  const invalidatedMachineEnglish = Boolean(
    effective.en?.method === "machine-translation" &&
      (russianSourceChanged || !autoTranslatableRussianBiography(ru)) &&
      !explicitEnglishTombstone &&
      submittedEn?.method === "machine-translation"
  );
  const manualEnglishNeedsConfirmation = Boolean(
    russianSourceChanged &&
      effective.en &&
      effective.en.method !== "machine-translation" &&
      submittedEn &&
      submittedEn.method !== "machine-translation" &&
      (submittedEn.status === "reviewed" || submittedEn.status === "verified")
  );
  if (
    manualEnglishNeedsConfirmation &&
    !input.confirmManualEnglishAgainstRussianChange
  ) {
    throw new Error(
      "EN: русский оригинал изменён. Сверьте ручной английский текст и явно подтвердите его соответствие новой RU-версии."
    );
  }
  const manualEnglishConfirmedAgainstRussianChange = Boolean(
    manualEnglishNeedsConfirmation &&
      input.confirmManualEnglishAgainstRussianChange
  );
  const en = invalidatedMachineEnglish
    ? null
    : manualEnglishConfirmedAgainstRussianChange && submittedEn
      ? {
          ...submittedEn,
          reviewedAt: isoDate(
            input.manualEnglishConfirmationDate,
            "Дата повторной сверки EN",
            true
          )!,
        }
      : submittedEn;
  const biographyTranslations: WriterBiographySaveTranslations = {
    ru,
    ...(en
      ? { en }
      : invalidatedMachineEnglish || effective.en
        ? { en: null }
        : {}),
  };
  return {
    biographyTranslations,
    russianSourceChanged,
    invalidatedMachineEnglish,
    manualEnglishConfirmedAgainstRussianChange,
    shouldAutoTranslate:
      autoTranslatableRussianBiography(ru) && !explicitEnglishTombstone,
  };
}

export function writerBiographySourcesJson(
  profile: WriterBiographyProfile | undefined
) {
  return JSON.stringify(profile?.sources || [], null, 2);
}
