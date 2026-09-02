const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const ISO_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/u;
const CONTROL_PATTERN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;

export const workTranslationMethods = [
  "editorial-original",
  "human-translation",
  "machine-translation",
  "licensed-source",
] as const;

export const workEditorialStatuses = ["draft", "reviewed", "verified"] as const;

export const workSourceUsages = [
  "structured-data",
  "reference-only",
  "licensed-copy",
] as const;

export const workImportStatuses = [
  "candidate",
  "rejected",
  "reviewed",
  "promoted",
] as const;

type TranslationMethod = (typeof workTranslationMethods)[number];
type EditorialStatus = (typeof workEditorialStatuses)[number];
type SourceUsage = (typeof workSourceUsages)[number];
type ImportStatus = (typeof workImportStatuses)[number];

function text(value: unknown, label: string, maxLength: number, minLength = 0) {
  if (typeof value !== "string") throw new Error(`${label}: ожидается текст.`);
  const normalized = value.replace(/\r\n?/gu, "\n").trim();
  if (CONTROL_PATTERN.test(normalized)) {
    throw new Error(`${label}: найдены недопустимые управляющие символы.`);
  }
  if (normalized.length < minLength) {
    throw new Error(`${label}: не менее ${minLength} символов.`);
  }
  if (normalized.length > maxLength) {
    throw new Error(`${label}: не более ${maxLength} символов.`);
  }
  return normalized;
}

function uuid(value: unknown, label: string, optional = false) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (optional && !normalized) return null;
  if (!UUID_PATTERN.test(normalized)) {
    throw new Error(`${label}: некорректный идентификатор.`);
  }
  return normalized;
}

function timestamp(value: unknown, label: string, required: boolean) {
  const normalized = text(value ?? "", label, 80);
  if (!normalized && !required) return null;
  if (
    !ISO_TIMESTAMP_PATTERN.test(normalized) ||
    Number.isNaN(new Date(normalized).getTime())
  ) {
    throw new Error(`${label}: обновите страницу и повторите правку.`);
  }
  return normalized;
}

function isoDate(value: unknown, label: string, required: boolean) {
  const normalized = text(value ?? "", label, 10);
  if (!normalized && !required) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(normalized)) {
    throw new Error(`${label}: используйте формат ГГГГ-ММ-ДД.`);
  }
  const date = new Date(`${normalized}T00:00:00.000Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== normalized
  ) {
    throw new Error(`${label}: такой даты не существует.`);
  }
  return normalized;
}

function httpsUrl(value: unknown, label: string) {
  const normalized = text(value, label, 2_000, 1);
  try {
    const parsed = new URL(normalized);
    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password ||
      !parsed.hostname
    ) {
      throw new Error();
    }
    return parsed.toString();
  } catch {
    throw new Error(`${label}: укажите безопасный HTTPS-адрес.`);
  }
}

function uniqueLines(
  value: unknown,
  label: string,
  options: { maxItems: number; maxLength: number; urls?: boolean; required?: boolean }
) {
  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/\r?\n/gu)
      : [];
  const seen = new Set<string>();
  const values: string[] = [];
  for (const item of source) {
    const normalized = text(item, label, options.maxLength);
    if (!normalized) continue;
    const finalValue = options.urls ? httpsUrl(normalized, label) : normalized;
    if (seen.has(finalValue)) continue;
    seen.add(finalValue);
    values.push(finalValue);
  }
  if (options.required && values.length === 0) {
    throw new Error(`${label}: добавьте хотя бы одну строку.`);
  }
  if (values.length > options.maxItems) {
    throw new Error(`${label}: не более ${options.maxItems} строк.`);
  }
  return values;
}

function enumValue<const Values extends readonly string[]>(
  value: unknown,
  values: Values,
  label: string
): Values[number] {
  const normalized = text(value, label, 80, 1);
  if (!values.includes(normalized)) throw new Error(`${label}: неизвестное значение.`);
  return normalized as Values[number];
}

function integer(value: unknown, label: string, min: number, max: number) {
  const normalized = Number(String(value ?? "").trim());
  if (!Number.isInteger(normalized) || normalized < min || normalized > max) {
    throw new Error(`${label}: укажите целое число от ${min} до ${max}.`);
  }
  return normalized;
}

function sentenceCount(value: string) {
  return (value.match(/[.!?…]+(?=\s|$)/gu) || []).length;
}

function assertEditorialProse(value: string) {
  if (/[ \t]{2,}|[\r\n]/u.test(value)) {
    throw new Error("Описание: удалите лишние пробелы и переносы строк.");
  }
  if (/\s+[,.!?;:]/u.test(value)) {
    throw new Error("Описание: удалите пробел перед знаком препинания.");
  }
  if (/\s-\s/u.test(value)) {
    throw new Error("Описание: используйте тире, а не дефис с пробелами.");
  }
  if (/<\/?[a-z][^>]*>/iu.test(value)) {
    throw new Error("Описание: HTML-разметка не допускается.");
  }
  if (/https?:\/\//iu.test(value)) {
    throw new Error("Описание: URL указываются в полях источников, не в тексте.");
  }
  if (/[!?]{2,}/u.test(value)) {
    throw new Error("Описание: экспрессивная пунктуация не допускается.");
  }
  if (
    (value.match(/«/gu)?.length || 0) !==
    (value.match(/»/gu)?.length || 0)
  ) {
    throw new Error("Описание: проверьте парность кавычек.");
  }
}

export function parseWorkTranslationEdit(input: Record<string, unknown>) {
  const translationId = uuid(input.translationId, "Перевод", true);
  const status = enumValue(
    input.editorialStatus,
    workEditorialStatuses,
    "Редакционный статус"
  ) as EditorialStatus;
  const description = text(input.description, "Описание", 900, 140);
  assertEditorialProse(description);
  const sourceUrls = uniqueLines(input.sourceUrls, "Источники перевода", {
    maxItems: 20,
    maxLength: 2_000,
    urls: true,
    required: status !== "draft",
  });
  const reviewedAt = isoDate(
    input.reviewedAt,
    "Дата проверки",
    status !== "draft"
  );
  if (status !== "draft") {
    const count = sentenceCount(description);
    if (count < 2 || count > 3) {
      throw new Error("Проверенное описание должно состоять из 2-3 предложений.");
    }
  }
  return {
    workId: uuid(input.workId, "Произведение")!,
    translationId,
    expectedUpdatedAt: timestamp(
      input.expectedUpdatedAt,
      "Версия перевода",
      Boolean(translationId)
    ),
    locale: enumValue(input.locale, ["ru", "en"] as const, "Язык") as "ru" | "en",
    patch: {
      title: text(input.title, "Название", 300, 1),
      description,
      source_language: text(input.sourceLanguage, "Исходный язык", 40, 2),
      translation_method: enumValue(
        input.translationMethod,
        workTranslationMethods,
        "Метод перевода"
      ) as TranslationMethod,
      editorial_status: status,
      source_urls: sourceUrls,
      reviewed_at: reviewedAt,
    },
  } as const;
}

export function parseWorkSourceEdit(input: Record<string, unknown>) {
  const sourceId = uuid(input.sourceId, "Источник", true);
  return {
    workId: uuid(input.workId, "Произведение")!,
    sourceId,
    expectedUpdatedAt: timestamp(
      input.expectedUpdatedAt,
      "Версия источника",
      Boolean(sourceId)
    ),
    patch: {
      provider: text(input.provider, "Поставщик", 160, 2),
      source_url: httpsUrl(input.sourceUrl, "Адрес источника"),
      field_names: uniqueLines(input.fieldNames, "Подтверждаемые поля", {
        maxItems: 80,
        maxLength: 120,
        required: true,
      }),
      license_name: text(input.licenseName ?? "", "Лицензия", 240) || null,
      usage: enumValue(input.usage, workSourceUsages, "Назначение") as SourceUsage,
      retrieved_at: isoDate(input.retrievedAt, "Дата получения", true)!,
    },
  } as const;
}

export function parseWorkExternalId(input: Record<string, unknown>) {
  const scheme = text(input.scheme, "Схема", 40, 2).toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]{1,39}$/u.test(scheme)) {
    throw new Error("Схема: используйте латинские буквы, цифры, _ или -.");
  }
  return {
    workId: uuid(input.workId, "Произведение")!,
    externalIdRowId: uuid(input.externalIdRowId, "Внешний идентификатор", true),
    scheme,
    externalId: text(input.externalId, "Внешний идентификатор", 180, 1),
    sourceUrl: httpsUrl(input.sourceUrl, "Источник идентификатора"),
  } as const;
}

export function parseWorkImportCandidateReview(input: Record<string, unknown>) {
  const status = enumValue(
    input.status,
    workImportStatuses,
    "Статус кандидата"
  ) as ImportStatus;
  const rejectionReasons = uniqueLines(
    input.rejectionReasons,
    "Причины отклонения",
    { maxItems: 40, maxLength: 500, required: status === "rejected" }
  );
  return {
    candidateId: uuid(input.candidateId, "Импорт-кандидат")!,
    workId: uuid(input.workId, "Произведение")!,
    expectedUpdatedAt: timestamp(
      input.expectedUpdatedAt,
      "Версия импорт-кандидата",
      true
    )!,
    qualityScore: integer(input.qualityScore, "Оценка качества", 0, 100),
    status,
    rejectionReasons,
  } as const;
}

export function parseWorkspaceDelete(input: Record<string, unknown>) {
  return {
    workId: uuid(input.workId, "Произведение")!,
    rowId: uuid(input.rowId, "Запись")!,
    expectedUpdatedAt: timestamp(input.expectedUpdatedAt, "Версия записи", false),
    exactValue: text(input.exactValue ?? "", "Контрольное значение", 2_000),
  } as const;
}
