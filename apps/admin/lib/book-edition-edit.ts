import { isValidIsbn, normalizeIsbn } from "./isbn";

export const bookEditionRightsStatuses = [
  "public-domain",
  "licensed",
  "permission",
  "editorial-original",
  "external-preview",
  "unverified",
] as const;

export type BookEditionEditInput = {
  editionId: unknown;
  expectedUpdatedAt: unknown;
  workId: unknown;
  title: unknown;
  isbn10: unknown;
  isbn13: unknown;
  publisher: unknown;
  publicationYear: unknown;
  language: unknown;
  format: unknown;
  pageCount: unknown;
  coverUrl: unknown;
  coverSourceUrl: unknown;
  coverRightsStatus: unknown;
  licenseName: unknown;
  licenseUrl: unknown;
  creator: unknown;
  rightsHolder: unknown;
  rightsCheckedAt: unknown;
  sourceUrl: unknown;
  primary: unknown;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const CONTROL_PATTERN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;
const ISO_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/u;

function uuid(value: unknown, label: string) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!UUID_PATTERN.test(normalized)) {
    throw new Error(`Некорректный идентификатор: ${label}.`);
  }
  return normalized;
}

function text(
  value: unknown,
  label: string,
  maxLength: number,
  required = false
) {
  if (typeof value !== "string") throw new Error(`${label}: ожидается текст.`);
  const normalized = value.replace(/\r\n?/gu, "\n").trim();
  if (CONTROL_PATTERN.test(normalized)) {
    throw new Error(`${label}: найдены недопустимые управляющие символы.`);
  }
  if (required && !normalized) throw new Error(`${label}: поле обязательно.`);
  if (normalized.length > maxLength) {
    throw new Error(`${label}: не более ${maxLength} символов.`);
  }
  return normalized;
}

function integer(
  value: unknown,
  label: string,
  min: number,
  max: number
) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }
  const normalized = Number(String(value).trim());
  if (!Number.isInteger(normalized) || normalized < min || normalized > max) {
    throw new Error(`${label}: укажите целое число от ${min} до ${max}.`);
  }
  return normalized;
}

function httpsUrl(value: unknown, label: string) {
  const normalized = text(value, label, 2_000);
  if (!normalized) return null;
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

function isbn(value: unknown, length: 10 | 13) {
  const source = text(value, `ISBN-${length}`, 32);
  if (!source) return null;
  const normalized = normalizeIsbn(source);
  if (normalized.length !== length || !isValidIsbn(normalized)) {
    throw new Error(`ISBN-${length} не прошёл контрольную проверку.`);
  }
  return normalized;
}

function isoDate(value: unknown, label: string) {
  const normalized = text(value, label, 10);
  if (!normalized) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(normalized)) {
    throw new Error(`${label}: используйте формат ГГГГ-ММ-ДД.`);
  }
  const date = new Date(`${normalized}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== normalized) {
    throw new Error(`${label}: такой даты не существует.`);
  }
  return normalized;
}

function isoTimestamp(value: unknown, label: string) {
  const normalized = text(value, label, 40, true);
  if (!ISO_TIMESTAMP_PATTERN.test(normalized)) {
    throw new Error(`${label}: ожидается точная ISO-дата с часовым поясом.`);
  }
  const calendarDate = new Date(`${normalized.slice(0, 10)}T00:00:00.000Z`);
  if (
    Number.isNaN(new Date(normalized).getTime()) ||
    Number.isNaN(calendarDate.getTime()) ||
    calendarDate.toISOString().slice(0, 10) !== normalized.slice(0, 10)
  ) {
    throw new Error(`${label}: дата не существует.`);
  }
  return normalized;
}

export function parseBookEditionEdit(input: BookEditionEditInput) {
  const editionId = uuid(input.editionId, "издание");
  const expectedUpdatedAt = isoTimestamp(input.expectedUpdatedAt, "Версия издания");
  const workId = uuid(input.workId, "произведение");
  const isbn10 = isbn(input.isbn10, 10);
  const isbn13 = isbn(input.isbn13, 13);
  if (!isbn10 && !isbn13) {
    throw new Error("Укажите хотя бы один проверенный ISBN.");
  }

  const coverUrl = httpsUrl(input.coverUrl, "Обложка");
  const coverSourceUrl = httpsUrl(input.coverSourceUrl, "Источник обложки");
  const coverRightsStatus = text(
    input.coverRightsStatus,
    "Статус прав",
    40,
    true
  );
  if (!bookEditionRightsStatuses.includes(coverRightsStatus as never)) {
    throw new Error("Неизвестный статус прав на обложку.");
  }
  const rightsCheckedAt = isoDate(input.rightsCheckedAt, "Дата проверки прав");
  if (
    coverUrl &&
    (!coverSourceUrl || coverRightsStatus === "unverified" || !rightsCheckedAt)
  ) {
    throw new Error(
      "Для обложки обязательны источник, подтверждённый статус прав и дата проверки."
    );
  }

  return {
    editionId,
    expectedUpdatedAt,
    workId,
    patch: {
      work_id: workId,
      title: text(input.title, "Название издания", 300, true),
      isbn_10: isbn10,
      isbn_13: isbn13,
      publisher: text(input.publisher, "Издатель", 240),
      publication_year: integer(input.publicationYear, "Год издания", 1400, 2100),
      language: text(input.language, "Язык", 120),
      format: text(input.format, "Формат", 120),
      page_count: integer(input.pageCount, "Количество страниц", 1, 100_000),
      cover_url: coverUrl,
      cover_source_url: coverSourceUrl,
      cover_rights_status: coverRightsStatus,
      license_name: text(input.licenseName, "Лицензия", 240),
      license_url: httpsUrl(input.licenseUrl, "Ссылка на лицензию"),
      creator: text(input.creator, "Автор изображения", 240),
      rights_holder: text(input.rightsHolder, "Правообладатель", 240),
      rights_checked_at: rightsCheckedAt,
      source_url: httpsUrl(input.sourceUrl, "Источник сведений"),
      is_primary: input.primary === true || input.primary === "on" || input.primary === "true",
    },
  } as const;
}
