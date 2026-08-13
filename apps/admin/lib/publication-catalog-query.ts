export const PUBLICATION_CATALOG_PAGE_SIZE = 50;

export const publicationStatuses = [
  "requested",
  "dispatched",
  "deployed",
  "failed",
] as const;
export type PublicationStatus = (typeof publicationStatuses)[number];

type PublicationCatalogQueryInput = {
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

function pageNumber(value: unknown) {
  const candidate = Number(String(value || "1"));
  return Number.isSafeInteger(candidate)
    ? Math.min(Math.max(candidate, 1), 10_000)
    : 1;
}

function escapedLikePattern(value: string) {
  return value.replace(/\\/gu, "\\\\").replace(/%/gu, "\\%").replace(/_/gu, "\\_");
}

function quotedPostgrestValue(value: string) {
  return `"${value.replace(/\\/gu, "\\\\").replace(/"/gu, '\\"')}"`;
}

export function parsePublicationCatalogQuery(input: PublicationCatalogQueryInput) {
  const term = text(input.q, 160);
  const requestedStatus = text(input.status, 24);
  const status = publicationStatuses.includes(requestedStatus as PublicationStatus)
    ? (requestedStatus as PublicationStatus)
    : "";
  const page = pageNumber(input.page);
  const from = (page - 1) * PUBLICATION_CATALOG_PAGE_SIZE;
  const pattern = term ? `%${escapedLikePattern(term)}%` : "";
  const quotedPattern = pattern ? quotedPostgrestValue(pattern) : "";

  return {
    term,
    status,
    page,
    from,
    to: from + PUBLICATION_CATALOG_PAGE_SIZE - 1,
    orFilter: quotedPattern
      ? `entity_type.ilike.${quotedPattern},entity_id.ilike.${quotedPattern},reason.ilike.${quotedPattern}`
      : "",
  } as const;
}

export function publicationCatalogHref(
  catalog: ReturnType<typeof parsePublicationCatalogQuery>,
  options: {
    page?: unknown;
    published?: unknown;
    error?: unknown;
  } = {}
) {
  const params = new URLSearchParams();
  if (catalog.term) params.set("q", catalog.term);
  if (catalog.status) params.set("status", catalog.status);
  const page = pageNumber(options.page ?? catalog.page);
  if (page > 1) params.set("page", String(page));
  const published = text(options.published, 40);
  const error = text(options.error, 500);
  if (published) params.set("published", published);
  if (error) params.set("error", error);
  const search = params.toString();
  return `/publication${search ? `?${search}` : ""}`;
}

export function publicationCatalogFormHref(
  formData: FormDataReader,
  options: Parameters<typeof publicationCatalogHref>[1] = {}
) {
  return publicationCatalogHref(
    parsePublicationCatalogQuery({
      q: formData.get("catalog_q"),
      status: formData.get("catalog_status"),
      page: formData.get("catalog_page"),
    }),
    options
  );
}
