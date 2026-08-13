export const LIBRARY_CATALOG_PAGE_SIZE = 40;
export const LIBRARY_WORK_PICKER_PAGE_SIZE = 30;

export const libraryEditorialStatuses = {
  draft: "Черновик",
  reviewed: "Проверено",
  verified: "Подтверждено",
} as const;

export type LibraryEditorialStatus = keyof typeof libraryEditorialStatuses;

type LibraryCatalogQueryInput = {
  q?: unknown;
  country?: unknown;
  writer?: unknown;
  status?: unknown;
  works_page?: unknown;
  editions_page?: unknown;
  work_picker_q?: unknown;
  work_picker_page?: unknown;
};

export type LibraryCatalogHrefOptions = {
  worksPage?: unknown;
  editionsPage?: unknown;
  workPickerTerm?: unknown;
  workPickerPage?: unknown;
  isbn?: unknown;
  workId?: unknown;
  writerId?: unknown;
  countryId?: unknown;
  editionId?: unknown;
  notice?: unknown;
  saved?: unknown;
  published?: unknown;
  error?: unknown;
};

type FormDataReader = {
  get(name: string): unknown;
};

function normalizedText(value: unknown, maxLength: number) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, maxLength);
}

export function normalizeLibraryIdentifier(value: unknown, maxLength = 180) {
  const normalized = normalizedText(value, maxLength);
  return /^[\p{L}\p{N}][\p{L}\p{N}._:-]*$/u.test(normalized)
    ? normalized
    : "";
}

function pageNumber(value: unknown) {
  const candidate = Number(String(value || "1"));
  return Number.isSafeInteger(candidate)
    ? Math.min(Math.max(candidate, 1), 100_000)
    : 1;
}

function escapedLikePattern(value: string) {
  return value.replace(/\\/gu, "\\\\").replace(/%/gu, "\\%").replace(/_/gu, "\\_");
}

export function parseLibraryCatalogQuery(input: LibraryCatalogQueryInput) {
  const term = normalizedText(input.q, 120);
  const country = normalizeLibraryIdentifier(input.country, 120);
  const writer = normalizeLibraryIdentifier(input.writer, 180);
  const requestedStatus = normalizedText(input.status, 20);
  const status: LibraryEditorialStatus | "" = Object.hasOwn(
    libraryEditorialStatuses,
    requestedStatus
  )
    ? (requestedStatus as LibraryEditorialStatus)
    : "";
  const worksPage = pageNumber(input.works_page);
  const editionsPage = pageNumber(input.editions_page);
  const workPickerTerm = normalizedText(input.work_picker_q, 120);
  const workPickerPage = pageNumber(input.work_picker_page);
  const worksFrom = (worksPage - 1) * LIBRARY_CATALOG_PAGE_SIZE;
  const editionsFrom = (editionsPage - 1) * LIBRARY_CATALOG_PAGE_SIZE;
  const workPickerFrom = (workPickerPage - 1) * LIBRARY_WORK_PICKER_PAGE_SIZE;

  return {
    term,
    pattern: term ? `%${escapedLikePattern(term)}%` : "",
    country,
    writer,
    status,
    worksPage,
    worksFrom,
    worksTo: worksFrom + LIBRARY_CATALOG_PAGE_SIZE - 1,
    editionsPage,
    editionsFrom,
    editionsTo: editionsFrom + LIBRARY_CATALOG_PAGE_SIZE - 1,
    workPickerTerm,
    workPickerPattern: workPickerTerm
      ? `%${escapedLikePattern(workPickerTerm)}%`
      : "",
    workPickerPage,
    workPickerFrom,
    workPickerTo: workPickerFrom + LIBRARY_WORK_PICKER_PAGE_SIZE - 1,
  } as const;
}

export function mergeLibraryWorkOptions<T extends { id: string }>(
  current: T | null | undefined,
  selected: T | null | undefined,
  results: readonly T[]
) {
  const byId = new Map<string, T>();
  for (const work of [current, selected, ...results]) {
    if (work && !byId.has(work.id)) byId.set(work.id, work);
  }
  return [...byId.values()];
}

function normalizedIsbn(value: unknown) {
  return normalizedText(value, 32).replace(/[^0-9Xx]/gu, "").toUpperCase().slice(0, 13);
}

function appendContextParam(
  params: URLSearchParams,
  name: string,
  value: unknown,
  maxLength: number
) {
  const normalized = normalizedText(value, maxLength);
  if (normalized) params.set(name, normalized);
}

export function libraryCatalogHref(
  catalog: ReturnType<typeof parseLibraryCatalogQuery>,
  options: LibraryCatalogHrefOptions = {}
) {
  const params = new URLSearchParams();
  if (catalog.term) params.set("q", catalog.term);
  if (catalog.country) params.set("country", catalog.country);
  if (catalog.writer) params.set("writer", catalog.writer);
  if (catalog.status) params.set("status", catalog.status);

  const worksPage = pageNumber(options.worksPage ?? catalog.worksPage);
  const editionsPage = pageNumber(options.editionsPage ?? catalog.editionsPage);
  if (worksPage > 1) params.set("works_page", String(worksPage));
  if (editionsPage > 1) params.set("editions_page", String(editionsPage));

  const workPickerTerm = normalizedText(
    options.workPickerTerm ?? catalog.workPickerTerm,
    120
  );
  const workPickerPage = pageNumber(
    options.workPickerPage ?? catalog.workPickerPage
  );
  if (workPickerTerm) params.set("work_picker_q", workPickerTerm);
  if (workPickerPage > 1) params.set("work_picker_page", String(workPickerPage));

  const isbn = normalizedIsbn(options.isbn);
  if (isbn) params.set("isbn", isbn);
  const workId = normalizeLibraryIdentifier(options.workId, 180);
  const writerId = normalizeLibraryIdentifier(options.writerId, 180);
  const countryId = normalizeLibraryIdentifier(options.countryId, 120);
  const editionId = normalizeLibraryIdentifier(options.editionId, 180);
  if (workId) params.set("work_id", workId);
  if (writerId) params.set("writer_id", writerId);
  if (countryId) params.set("country_id", countryId);
  if (editionId) params.set("edition_id", editionId);

  appendContextParam(params, "notice", options.notice, 40);
  appendContextParam(params, "saved", options.saved, 40);
  appendContextParam(params, "published", options.published, 40);
  appendContextParam(params, "error", options.error, 500);
  const search = params.toString();
  return `/library${search ? `?${search}` : ""}`;
}

export function libraryCatalogFormHref(
  formData: FormDataReader,
  overrides: LibraryCatalogHrefOptions = {}
) {
  const catalog = parseLibraryCatalogQuery({
    q: formData.get("catalog_q"),
    country: formData.get("catalog_country"),
    writer: formData.get("catalog_writer"),
    status: formData.get("catalog_status"),
    works_page: formData.get("catalog_works_page"),
    editions_page: formData.get("catalog_editions_page"),
    work_picker_q: formData.get("catalog_work_picker_q"),
    work_picker_page: formData.get("catalog_work_picker_page"),
  });
  return libraryCatalogHref(catalog, {
    isbn: formData.get("catalog_isbn"),
    workId: formData.get("catalog_work_id"),
    writerId: formData.get("catalog_writer_id"),
    countryId: formData.get("catalog_country_id"),
    editionId: formData.get("catalog_edition_id"),
    ...overrides,
  });
}
