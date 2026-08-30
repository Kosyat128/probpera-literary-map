export const MEDIA_CATALOG_PAGE_SIZE = 48;

export const mediaCatalogSearchFields = {
  alt: { column: "alt_text", label: "Описание" },
  creator: { column: "creator", label: "Автор" },
  collection: { column: "collection_name", label: "Коллекция" },
  filename: { column: "object_path", label: "Имя файла" },
  license: { column: "license_name", label: "Лицензия" },
} as const;

export type MediaCatalogSearchField = keyof typeof mediaCatalogSearchFields;
export const mediaCatalogStates = {
  active: "Активные",
  unused: "Не используются",
  trash: "Корзина",
} as const;
export type MediaCatalogState = keyof typeof mediaCatalogStates;
export const mediaCatalogViews = {
  grid: "Плитка",
  list: "Список",
} as const;
export type MediaCatalogView = keyof typeof mediaCatalogViews;

type MediaCatalogQueryInput = {
  q?: unknown;
  search_field?: unknown;
  state?: unknown;
  view?: unknown;
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
  const requestedState = String(input.state || "active");
  const state: MediaCatalogState = Object.hasOwn(
    mediaCatalogStates,
    requestedState
  )
    ? (requestedState as MediaCatalogState)
    : "active";
  const requestedView = String(input.view || "grid");
  const view: MediaCatalogView = Object.hasOwn(mediaCatalogViews, requestedView)
    ? (requestedView as MediaCatalogView)
    : "grid";
  const pageCandidate = Number(String(input.page || "1"));
  const page = Number.isSafeInteger(pageCandidate)
    ? Math.min(Math.max(pageCandidate, 1), 10_000)
    : 1;
  const term = normalizedSearchTerm(input.q);
  const from = (page - 1) * MEDIA_CATALOG_PAGE_SIZE;
  return {
    term,
    field,
    state,
    view,
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
  notice?: {
    saved?: string;
    error?: string;
    published?: string;
    replacementCount?: number;
    bulkCount?: number;
    skippedCount?: number;
    orphanCount?: number;
    orphanPreview?: boolean;
  }
) {
  const params = new URLSearchParams();
  if (query.term) params.set("q", query.term);
  if (query.field !== "alt") params.set("search_field", query.field);
  if (query.state !== "active") params.set("state", query.state);
  if (query.view !== "grid") params.set("view", query.view);
  if (page > 1) params.set("page", String(page));
  if (notice?.saved) params.set("saved", notice.saved);
  if (notice?.error) params.set("error", notice.error);
  if (notice?.published) params.set("published", notice.published);
  if (
    typeof notice?.replacementCount === "number"
    && Number.isSafeInteger(notice.replacementCount)
  ) {
    params.set("replacement_count", String(notice.replacementCount));
  }
  if (typeof notice?.bulkCount === "number" && Number.isSafeInteger(notice.bulkCount)) {
    params.set("bulk_count", String(notice.bulkCount));
  }
  if (
    typeof notice?.skippedCount === "number"
    && Number.isSafeInteger(notice.skippedCount)
  ) {
    params.set("skipped_count", String(notice.skippedCount));
  }
  if (
    typeof notice?.orphanCount === "number"
    && Number.isSafeInteger(notice.orphanCount)
  ) {
    params.set("orphan_count", String(notice.orphanCount));
  }
  if (notice?.orphanPreview) params.set("orphan_cleanup", "preview");
  const search = params.toString();
  return `/media${search ? `?${search}` : ""}`;
}
