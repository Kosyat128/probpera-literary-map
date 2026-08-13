export const PAGE_CATALOG_PAGE_SIZE = 40;

export const pageCatalogStatuses = {
  draft: "Черновики",
  published: "Опубликованные",
  hidden: "Скрытые",
} as const;

export type PageCatalogStatus = keyof typeof pageCatalogStatuses;

type PageCatalogQueryInput = {
  q?: unknown;
  status?: unknown;
  page?: unknown;
};

type FormDataReader = { get(name: string): unknown };

function text(value: unknown, maxLength: number) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, maxLength);
}

export function pageCatalogPageNumber(value: unknown) {
  const candidate = Number(String(value || "1"));
  return Number.isSafeInteger(candidate)
    ? Math.min(Math.max(candidate, 1), 100_000)
    : 1;
}

function escapedLikePattern(value: string) {
  return value.replace(/\\/gu, "\\\\").replace(/%/gu, "\\%").replace(/_/gu, "\\_");
}

export function parsePageCatalogQuery(input: PageCatalogQueryInput) {
  const term = text(input.q, 120);
  const requestedStatus = text(input.status, 20);
  const status: PageCatalogStatus | "" = Object.hasOwn(
    pageCatalogStatuses,
    requestedStatus
  )
    ? (requestedStatus as PageCatalogStatus)
    : "";
  const page = pageCatalogPageNumber(input.page);
  const from = (page - 1) * PAGE_CATALOG_PAGE_SIZE;
  return {
    term,
    pattern: term ? `%${escapedLikePattern(term)}%` : "",
    status,
    page,
    from,
    to: from + PAGE_CATALOG_PAGE_SIZE - 1,
  } as const;
}

export function pageCatalogHref(
  catalog: ReturnType<typeof parsePageCatalogQuery>,
  options: {
    page?: unknown;
    error?: unknown;
    saved?: unknown;
    deleted?: unknown;
    published?: unknown;
  } = {}
) {
  const params = new URLSearchParams();
  if (catalog.term) params.set("q", catalog.term);
  if (catalog.status) params.set("status", catalog.status);
  const page = pageCatalogPageNumber(options.page ?? catalog.page);
  if (page > 1) params.set("page", String(page));
  for (const name of ["error", "saved", "deleted", "published"] as const) {
    const value = text(options[name], name === "error" ? 500 : 40);
    if (value) params.set(name, value);
  }
  const search = params.toString();
  return `/pages${search ? `?${search}` : ""}`;
}

export function pageEditorHref(
  id: string,
  catalog: ReturnType<typeof parsePageCatalogQuery>,
  options: {
    error?: unknown;
    saved?: unknown;
    published?: unknown;
    revisionPage?: unknown;
  } = {}
) {
  const catalogHref = pageCatalogHref(catalog, options);
  const search = catalogHref.includes("?")
    ? new URLSearchParams(catalogHref.slice(catalogHref.indexOf("?") + 1))
    : new URLSearchParams();
  const revisionPage = pageCatalogPageNumber(options.revisionPage);
  if (revisionPage > 1) search.set("revision_page", String(revisionPage));
  return `/pages/${encodeURIComponent(id)}${search.size ? `?${search.toString()}` : ""}`;
}

export function pageCatalogFromForm(formData: FormDataReader) {
  return parsePageCatalogQuery({
    q: formData.get("catalog_q"),
    status: formData.get("catalog_status"),
    page: formData.get("catalog_page"),
  });
}
