import { isReadRecord } from "./admin-read-result";
import { bookEditionRightsStatuses } from "./book-edition-edit";
import { workEditorialStatuses, workImportStatuses, workSourceUsages, workTranslationMethods } from "./literary-work-workspace";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const uuid = (value: unknown): value is string => typeof value === "string" && uuidPattern.test(value);
const nullableText = (value: unknown) => value === null || typeof value === "string";
const textList = (value: unknown) => Array.isArray(value) && value.every((item) => typeof item === "string");
const integer = (value: unknown, minimum = 0, maximum = Number.MAX_SAFE_INTEGER): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= minimum && value <= maximum;
const timestamp = (value: unknown) => typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/u.test(value) && Number.isFinite(Date.parse(value));
const opaqueJson = (value: unknown) => value === null || typeof value === "string" || typeof value === "boolean" ||
  (typeof value === "number" && Number.isFinite(value)) || Array.isArray(value) || isReadRecord(value);
const date = (value: unknown) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/u.test(value) &&
  Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const status = (value: unknown, choices: readonly string[]) => typeof value === "string" && choices.includes(value);

/** Compare SQL UUIDs without changing the selected values or editorial bytes. */
export function sameLibraryId(value: unknown, expected: string) {
  return typeof value === "string" && (value === expected ||
    (uuid(value) && uuid(expected) && value.toLowerCase() === expected.toLowerCase()));
}

/** Existing mutation parsers support this narrower set; reads retain all SQL UUIDs. */
export function libraryActionIdSupported(value: unknown) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
}

export function validLibraryWork(value: unknown, withRevision = true) {
  return isReadRecord(value) && uuid(value.id) &&
    ["legacy_id", "title", "original_title", "original_language", "description", "writer_id", "country_id"].every((key) => typeof value[key] === "string") &&
    (value.first_published === null || integer(value.first_published, -3000, 2100)) &&
    nullableText(value.source_url) && textList(value.genres) && textList(value.tags) &&
    status(value.editorial_status, workEditorialStatuses) && opaqueJson(value.metadata) &&
    (!withRevision || timestamp(value.updated_at));
}

export function validLibraryCatalogWork(value: unknown) {
  if (!validLibraryWork(value) || !isReadRecord(value)) return false;
  const relation = value.literary_work_cover_artworks;
  const row = Array.isArray(relation) && relation.length === 1 ? relation[0] : relation;
  return isReadRecord(row) && (integer(row.count) ||
    (typeof row.count === "string" && /^(?:0|[1-9]\d*)$/u.test(row.count) && integer(Number(row.count))));
}

export function matchesLibraryWork(value: unknown, requested: string) {
  return validLibraryWork(value) && isReadRecord(value) &&
    (uuid(requested) ? sameLibraryId(value.id, requested) : value.legacy_id === requested);
}

export function validLibraryEdition(value: unknown, complete = true) {
  if (!isReadRecord(value) || !uuid(value.id) ||
    !["title", "publisher", "language"].every((key) => typeof value[key] === "string") ||
    !["isbn_10", "isbn_13", "cover_url"].every((key) => nullableText(value[key])) ||
    !(value.publication_year === null || integer(value.publication_year, 1400, 2100)) ||
    !status(value.cover_rights_status, bookEditionRightsStatuses) ||
    typeof value.is_primary !== "boolean" || !timestamp(value.updated_at)) return false;
  if (!complete) {
    const relation = value.literary_works;
    const work = Array.isArray(relation) && relation.length === 1 ? relation[0] : relation;
    return isReadRecord(work) && uuid(work.id) &&
      ["legacy_id", "title", "country_id", "writer_id"].every((key) => typeof work[key] === "string") &&
      status(work.editorial_status, workEditorialStatuses) && opaqueJson(work.metadata);
  }
  return uuid(value.work_id) &&
    ["legacy_id", "format", "license_name", "creator", "rights_holder"].every((key) => typeof value[key] === "string") &&
    ["cover_source_url", "license_url", "source_url"].every((key) => nullableText(value[key])) &&
    (value.page_count === null || integer(value.page_count, 1)) &&
    (value.rights_checked_at === null || date(value.rights_checked_at));
}

export function validLibraryTranslation(row: Record<string, unknown>, workId: string) {
  return uuid(row.id) && sameLibraryId(row.work_id, workId) && status(row.locale, ["ru", "en"]) &&
    ["title", "description", "source_language"].every((key) => typeof row[key] === "string") &&
    status(row.translation_method, workTranslationMethods) && status(row.editorial_status, workEditorialStatuses) &&
    textList(row.source_urls) && (row.reviewed_at === null || date(row.reviewed_at)) && timestamp(row.updated_at);
}

export function validLibrarySource(row: Record<string, unknown>, workId: string) {
  return uuid(row.id) && sameLibraryId(row.work_id, workId) &&
    ["provider", "source_url"].every((key) => typeof row[key] === "string") &&
    textList(row.field_names) && nullableText(row.license_name) && status(row.usage, workSourceUsages) &&
    date(row.retrieved_at) && timestamp(row.updated_at);
}

export function validLibraryExternalId(row: Record<string, unknown>, workId: string) {
  return uuid(row.id) && sameLibraryId(row.work_id, workId) &&
    ["scheme", "external_id", "source_url"].every((key) => typeof row[key] === "string");
}

export function validLibraryImportCandidate(row: Record<string, unknown>, countryId: string, writerId: string) {
  return uuid(row.id) && row.country_id === countryId && row.writer_id === writerId &&
    ["provider", "external_id", "title", "source_url"].every((key) => typeof row[key] === "string") &&
    integer(row.quality_score, 0, 100) && status(row.status, workImportStatuses) && textList(row.rejection_reasons) &&
    (row.promoted_work_id === null || uuid(row.promoted_work_id)) && timestamp(row.updated_at);
}

export function validLibraryArtwork(row: Record<string, unknown>, workId: string) {
  return uuid(row.id) && sameLibraryId(row.work_id, workId) &&
    ["cover_url", "thumbnail_url", "cover_source_url", "source_archive_sha256", "source_image_sha256", "source_filename", "source_relative_path"].every((key) => typeof row[key] === "string") &&
    ["cover_width", "cover_height", "thumbnail_width", "thumbnail_height", "source_index"].every((key) => integer(row[key], 1)) &&
    row.rights_status === "editorial-original" && typeof row.is_primary === "boolean" &&
    date(row.rights_checked_at) && isReadRecord(row.provenance) && timestamp(row.created_at) && timestamp(row.updated_at);
}

export function validLibraryWriterOverride(value: unknown, countryId: string, writerId: string) {
  if (!isReadRecord(value) || !uuid(value.id) || value.country_id !== countryId || value.writer_id !== writerId ||
    !isReadRecord(value.fields) || typeof value.is_enabled !== "boolean" || !timestamp(value.updated_at)) return false;
  const fields = value.fields;
  return ["name", "years"].every((key) => fields[key] === undefined || typeof fields[key] === "string") &&
    (fields.awards === undefined || textList(fields.awards));
}

export function validLibraryIsbnCandidate(value: unknown, requestedIsbn: string) {
  return isReadRecord(value) && (value.isbn10 === requestedIsbn || value.isbn13 === requestedIsbn) &&
    ["title", "subtitle", "publisher", "publishedDate", "language", "openLibraryUrl"].every((key) => typeof value[key] === "string") &&
    ["isbn10", "isbn13", "googleBooksUrl", "coverUrl"].every((key) => nullableText(value[key])) && textList(value.authors) &&
    (value.publicationYear === null || integer(value.publicationYear)) &&
    (value.pageCount === null || integer(value.pageCount, 1));
}
