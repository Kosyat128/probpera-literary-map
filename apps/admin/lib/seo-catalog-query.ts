export const SEO_REDIRECT_PAGE_SIZE = 40;

export const seoRedirectStatuses = {
  all: "Все состояния",
  active: "Активные",
  inactive: "Выключенные",
} as const;

export const seoRedirectCodes = {
  all: "Все коды",
  "301": "301 · постоянные",
  "302": "302 · временные",
  "307": "307 · временные, строгие",
  "308": "308 · постоянные, строгие",
} as const;

export type SeoRedirectStatus = keyof typeof seoRedirectStatuses;
export type SeoRedirectCode = keyof typeof seoRedirectCodes;

type SeoCatalogQueryInput = {
  q?: unknown;
  status?: unknown;
  code?: unknown;
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

export function parseSeoCatalogQuery(input: SeoCatalogQueryInput) {
  const requestedStatus = text(input.status, 16);
  const status: SeoRedirectStatus = Object.hasOwn(seoRedirectStatuses, requestedStatus)
    ? (requestedStatus as SeoRedirectStatus)
    : "all";
  const requestedCode = text(input.code, 8);
  const code: SeoRedirectCode = Object.hasOwn(seoRedirectCodes, requestedCode)
    ? (requestedCode as SeoRedirectCode)
    : "all";
  const term = text(input.q, 180);
  const page = pageNumber(input.page);
  const from = (page - 1) * SEO_REDIRECT_PAGE_SIZE;
  const pattern = term ? `%${escapedLikePattern(term)}%` : "";
  const quotedPattern = pattern ? quotedPostgrestValue(pattern) : "";

  return {
    term,
    status,
    code,
    page,
    from,
    to: from + SEO_REDIRECT_PAGE_SIZE - 1,
    pattern,
    orFilter: quotedPattern
      ? `source_path.ilike.${quotedPattern},destination_path.ilike.${quotedPattern}`
      : "",
  } as const;
}

export function seoCatalogHref(
  catalog: ReturnType<typeof parseSeoCatalogQuery>,
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
  if (catalog.status !== "all") params.set("status", catalog.status);
  if (catalog.code !== "all") params.set("code", catalog.code);
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
  return `/seo${search ? `?${search}` : ""}`;
}

export function seoCatalogFormHref(
  formData: FormDataReader,
  options: Parameters<typeof seoCatalogHref>[1] = {}
) {
  return seoCatalogHref(
    parseSeoCatalogQuery({
      q: formData.get("catalog_q"),
      status: formData.get("catalog_status"),
      code: formData.get("catalog_code"),
      page: formData.get("catalog_page"),
    }),
    options
  );
}
