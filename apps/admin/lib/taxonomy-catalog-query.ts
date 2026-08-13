export const TAXONOMY_TAG_PAGE_SIZE = 40;

type TaxonomyCatalogQueryInput = {
  q?: unknown;
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

export function parseTaxonomyCatalogQuery(input: TaxonomyCatalogQueryInput) {
  const term = text(input.q, 120);
  const page = pageNumber(input.page);
  const from = (page - 1) * TAXONOMY_TAG_PAGE_SIZE;
  const pattern = term ? `%${escapedLikePattern(term)}%` : "";
  const quotedPattern = pattern ? quotedPostgrestValue(pattern) : "";

  return {
    term,
    page,
    from,
    to: from + TAXONOMY_TAG_PAGE_SIZE - 1,
    pattern,
    orFilter: quotedPattern
      ? `name.ilike.${quotedPattern},slug.ilike.${quotedPattern}`
      : "",
  } as const;
}

export function taxonomyCatalogHref(
  catalog: ReturnType<typeof parseTaxonomyCatalogQuery>,
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
  const page = pageNumber(options.page ?? catalog.page);
  if (page > 1) params.set("page", String(page));

  const error = text(options.error, 500);
  const saved = text(options.saved, 24);
  const deleted = text(options.deleted, 24);
  const published = text(options.published, 40);
  if (error) params.set("error", error);
  if (saved) params.set("saved", saved);
  if (deleted) params.set("deleted", deleted);
  if (published) params.set("published", published);

  const search = params.toString();
  return `/categories${search ? `?${search}` : ""}`;
}

export function taxonomyCatalogFormHref(
  formData: FormDataReader,
  options: Parameters<typeof taxonomyCatalogHref>[1] = {}
) {
  return taxonomyCatalogHref(
    parseTaxonomyCatalogQuery({
      q: formData.get("catalog_q"),
      page: formData.get("catalog_page"),
    }),
    options
  );
}
