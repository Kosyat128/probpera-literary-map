export const MEDIA_CATALOG_PAGE_SIZE = 48;

export const mediaCatalogSearchFields = {
  alt: { column: "alt_text", label: "Описание" },
  creator: { column: "creator", label: "Автор" },
  collection: { column: "collection_name", label: "Коллекция" },
  filename: { column: "object_path", label: "Имя файла" },
  license: { column: "license_name", label: "Лицензия" },
} as const;

export type MediaCatalogSearchField = keyof typeof mediaCatalogSearchFields;

type MediaCatalogQueryInput = {
  q?: unknown;
  search_field?: unknown;
  page?: unknown;
};

function normalizedSearchTerm(value: unknown) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 120);
}

function escapedLikePattern(value: string) {
  return value.replace(/\\/gu, "\\\\").replace(/%/gu, "\\%").replace(/_/gu, "\\_");
}

export function parseMediaCatalogQuery(input: MediaCatalogQueryInput) {
  const requestedField = String(input.search_field || "alt");
  const field: MediaCatalogSearchField = Object.hasOwn(
    mediaCatalogSearchFields,
    requestedField
  )
    ? (requestedField as MediaCatalogSearchField)
    : "alt";
  const pageCandidate = Number(String(input.page || "1"));
  const page = Number.isSafeInteger(pageCandidate)
    ? Math.min(Math.max(pageCandidate, 1), 10_000)
    : 1;
  const term = normalizedSearchTerm(input.q);
  const from = (page - 1) * MEDIA_CATALOG_PAGE_SIZE;
  return {
    term,
    field,
    column: mediaCatalogSearchFields[field].column,
    pattern: term ? `%${escapedLikePattern(term)}%` : "",
    page,
    from,
    to: from + MEDIA_CATALOG_PAGE_SIZE - 1,
  } as const;
}

export function mediaCatalogPageHref(
  query: ReturnType<typeof parseMediaCatalogQuery>,
  page: number,
  notice?: { saved?: string; error?: string; published?: string }
) {
  const params = new URLSearchParams();
  if (query.term) params.set("q", query.term);
  if (query.field !== "alt") params.set("search_field", query.field);
  if (page > 1) params.set("page", String(page));
  if (notice?.saved) params.set("saved", notice.saved);
  if (notice?.error) params.set("error", notice.error);
  if (notice?.published) params.set("published", notice.published);
  const search = params.toString();
  return `/media${search ? `?${search}` : ""}`;
}
