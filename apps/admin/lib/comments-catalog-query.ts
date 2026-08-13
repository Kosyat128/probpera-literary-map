export const COMMENTS_CATALOG_PAGE_SIZE = 50;

export const commentStatuses = ["published", "hidden", "pending"] as const;
export type CommentStatus = (typeof commentStatuses)[number];

type CommentsCatalogQueryInput = {
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

export function parseCommentsCatalogQuery(input: CommentsCatalogQueryInput) {
  const term = text(input.q, 160);
  const requestedStatus = text(input.status, 24);
  const status = commentStatuses.includes(requestedStatus as CommentStatus)
    ? (requestedStatus as CommentStatus)
    : "";
  const page = pageNumber(input.page);
  const from = (page - 1) * COMMENTS_CATALOG_PAGE_SIZE;
  const pattern = term ? `%${escapedLikePattern(term)}%` : "";
  const quotedPattern = pattern ? quotedPostgrestValue(pattern) : "";

  return {
    term,
    status,
    page,
    from,
    to: from + COMMENTS_CATALOG_PAGE_SIZE - 1,
    orFilter: quotedPattern
      ? `body.ilike.${quotedPattern},guest_name.ilike.${quotedPattern},article_slug.ilike.${quotedPattern}`
      : "",
  } as const;
}

export function commentsCatalogHref(
  catalog: ReturnType<typeof parseCommentsCatalogQuery>,
  page: number,
  notice: { error?: unknown; saved?: unknown } = {}
) {
  const params = new URLSearchParams();
  if (catalog.term) params.set("q", catalog.term);
  if (catalog.status) params.set("status", catalog.status);
  const normalizedPage = pageNumber(page);
  if (normalizedPage > 1) params.set("page", String(normalizedPage));
  const error = text(notice.error, 500);
  const saved = text(notice.saved, 24);
  if (error) params.set("error", error);
  if (saved) params.set("saved", saved);
  const search = params.toString();
  return `/comments${search ? `?${search}` : ""}`;
}

export function commentsCatalogFormHref(
  formData: FormDataReader,
  notice: Parameters<typeof commentsCatalogHref>[2] = {}
) {
  const catalog = parseCommentsCatalogQuery({
    q: formData.get("catalog_q"),
    status: formData.get("catalog_status"),
    page: formData.get("catalog_page"),
  });
  return commentsCatalogHref(catalog, catalog.page, notice);
}
