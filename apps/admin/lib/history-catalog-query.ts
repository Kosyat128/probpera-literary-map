export const HISTORY_PAGE_SIZE = 40;
export const HISTORY_EVENTS_PAGE_SIZE = 60;

export const historyRevisionKinds = {
  article: "Статьи",
  page: "Страницы",
  homepage: "Главная",
  country: "Страны",
  writer: "Авторы",
  work: "Произведения",
  edition: "Издания",
  banner: "Баннеры",
  navigation: "Навигация",
} as const;

export type HistoryRevisionKind = keyof typeof historyRevisionKinds;

export const historyAuditEntityTypes: Record<HistoryRevisionKind, string[]> = {
  article: ["article"],
  page: ["page"],
  homepage: ["homepage", "homepage_block"],
  country: ["country", "country_profile"],
  writer: ["writer", "writer_profile"],
  work: [
    "work",
    "literary_work",
    "literary_work_translation",
    "literary_work_source",
    "literary_work_external_id",
    "book_import_candidate",
  ],
  edition: ["edition", "book_edition"],
  banner: ["banner"],
  navigation: ["navigation", "navigation_item"],
};

type HistoryQueryInput = {
  kind?: unknown;
  entity?: unknown;
  page?: unknown;
  events_page?: unknown;
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
    ? Math.min(Math.max(candidate, 1), 100_000)
    : 1;
}

function escapedLikePattern(value: string) {
  return value.replace(/\\/gu, "\\\\").replace(/%/gu, "\\%").replace(/_/gu, "\\_");
}

export function parseHistoryCatalogQuery(input: HistoryQueryInput) {
  const requestedKind = text(input.kind, 24);
  const kind: HistoryRevisionKind | "" = Object.hasOwn(
    historyRevisionKinds,
    requestedKind
  )
    ? (requestedKind as HistoryRevisionKind)
    : "";
  const entity = text(input.entity, 180);
  const page = pageNumber(input.page);
  const eventsPage = pageNumber(input.events_page);
  const from = (page - 1) * HISTORY_PAGE_SIZE;
  const eventsFrom = (eventsPage - 1) * HISTORY_EVENTS_PAGE_SIZE;
  return {
    kind,
    entity,
    entityPattern: entity ? `%${escapedLikePattern(entity)}%` : "",
    page,
    from,
    to: from + HISTORY_PAGE_SIZE - 1,
    eventsPage,
    eventsFrom,
    eventsTo: eventsFrom + HISTORY_EVENTS_PAGE_SIZE - 1,
  } as const;
}

export function historyCatalogHref(
  catalog: ReturnType<typeof parseHistoryCatalogQuery>,
  options: {
    page?: unknown;
    eventsPage?: unknown;
    error?: unknown;
    restored?: unknown;
    published?: unknown;
  } = {}
) {
  const params = new URLSearchParams();
  if (catalog.kind) params.set("kind", catalog.kind);
  if (catalog.entity) params.set("entity", catalog.entity);
  const page = pageNumber(options.page ?? catalog.page);
  const eventsPage = pageNumber(options.eventsPage ?? catalog.eventsPage);
  if (page > 1) params.set("page", String(page));
  if (eventsPage > 1) params.set("events_page", String(eventsPage));
  const error = text(options.error, 500);
  const restored = text(options.restored, 24);
  const published = text(options.published, 40);
  if (error) params.set("error", error);
  if (restored) params.set("restored", restored);
  if (published) params.set("published", published);
  const search = params.toString();
  return `/history${search ? `?${search}` : ""}`;
}

export function historyCatalogFormHref(
  formData: FormDataReader,
  options: Parameters<typeof historyCatalogHref>[1] = {}
) {
  return historyCatalogHref(
    parseHistoryCatalogQuery({
      kind: formData.get("history_kind"),
      entity: formData.get("history_entity"),
      page: formData.get("history_page"),
      events_page: formData.get("history_events_page"),
    }),
    options
  );
}
