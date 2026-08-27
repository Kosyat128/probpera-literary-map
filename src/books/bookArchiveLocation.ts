import {
  normalizeBookArchiveFilterState,
  type BookArchiveFilterState,
} from "./bookArchiveFacets";

export const BOOK_ARCHIVE_BOOK_PARAM = "book";
export const BOOK_ARCHIVE_SHELF_PARAM = "archiveShelf";
export const BOOK_ARCHIVE_NAVIGATION_CONTEXT_VERSION = 1 as const;
export const BOOK_ARCHIVE_NAVIGATION_STORAGE_KEY =
  "probpera:book-archive:navigation:v1";
export const BOOK_ARCHIVE_DETAIL_HISTORY_STATE_KEY = "probperaBookDetail";
export const BOOK_ARCHIVE_CONTEXT_HISTORY_STATE_KEY =
  "probperaBookArchiveContext";
export const BOOK_ARCHIVE_ARTICLE_FOCUS_HISTORY_STATE_KEY =
  "probperaArticleBookFocus";

export type BookArchiveNavigationFocusOrigin =
  | "book-author"
  | `book-article:${string}`;

export type BookArchiveLocationState = Readonly<{
  bookKey: string | null;
  shelfId: string | null;
}>;

export type BookArchiveLocationSource = Readonly<{
  pathname: string;
  search?: string;
  hash?: string;
}>;

export type BookArchiveLocationPatch = Readonly<{
  /** `undefined` preserves the current value, `null` removes it. */
  bookKey?: string | null;
  /** `undefined` preserves the current value, `null` removes it. */
  shelfId?: string | null;
}>;

export type BookArchiveHistoryMode = "push" | "replace";

export type BookArchiveHistoryChange = Readonly<{
  mode: BookArchiveHistoryMode;
  target: string;
}>;

export type BookArchiveNavigationFilters = Omit<
  BookArchiveFilterState,
  "query"
>;

export type BookArchiveNavigationContext = Readonly<{
  version: typeof BOOK_ARCHIVE_NAVIGATION_CONTEXT_VERSION;
  shelfId: string;
  search: Readonly<{
    query: string;
    scope: "library" | "archive" | "global";
  }>;
  filters: BookArchiveNavigationFilters;
  viewMode: "shelf" | "catalog";
  focusedBookKey: string | null;
  pageIndex: number;
  scroll: Readonly<{
    x: number;
    y: number;
  }>;
  selectedBookKey: string | null;
  inspectionOpen: boolean;
  focusOrigin: BookArchiveNavigationFocusOrigin | null;
}>;

export type BookArchiveSessionStorage = Readonly<{
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}>;

type StoredNavigationFilter = Readonly<{
  p?: BookArchiveFilterState["quickPreset"];
  a?: string;
  c?: readonly string[];
  g?: readonly string[];
  u?: readonly string[];
  e?: readonly string[];
  l?: readonly string[];
  t?: readonly string[];
  m?: readonly string[];
  r?: readonly string[];
  d?: boolean;
  o?: BookArchiveFilterState["sort"];
}>;

type StoredNavigationContext = Readonly<{
  v: typeof BOOK_ARCHIVE_NAVIGATION_CONTEXT_VERSION;
  s: string;
  q?: string;
  w?: "library" | "archive" | "global";
  f?: StoredNavigationFilter;
  x?: number;
  y?: number;
  b?: string;
  i?: "catalog";
  k?: string;
  n?: number;
  j?: true;
  h?: BookArchiveNavigationFocusOrigin;
}>;

type MutableBookArchiveFilterInput = {
  -readonly [Key in keyof BookArchiveFilterState]?: BookArchiveFilterState[Key];
};

const MAX_ROUTE_ID_LENGTH = 192;
const MAX_BOOK_KEY_LENGTH = 576;
const MAX_SEARCH_LENGTH = 320;
const MAX_FILTER_VALUES = 128;
const MAX_SCROLL_OFFSET = 100_000_000;
const routeIdPattern = /^[A-Za-z0-9](?:[A-Za-z0-9:._~-]{0,191})$/u;
const routeSegmentPattern = /^[A-Za-z0-9](?:[A-Za-z0-9._~-]{0,191})$/u;
const forbiddenControlPattern =
  /[\u0000-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/u;
const storedContextKeys = new Set([
  "v",
  "s",
  "q",
  "w",
  "f",
  "x",
  "y",
  "b",
  "i",
  "k",
  "n",
  "j",
  "h",
]);
const storedFilterKeys = new Set([
  "p",
  "a",
  "c",
  "g",
  "u",
  "e",
  "l",
  "t",
  "m",
  "r",
  "d",
  "o",
]);
const semanticFilterKeys = new Set([
  "quickPreset",
  "authorKey",
  "countryIds",
  "genreIds",
  "audienceIds",
  "periods",
  "originalLanguageIds",
  "editorialStatuses",
  "coverModes",
  "articleRelations",
  "savedOnly",
  "sort",
]);

function plainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>) {
  return Object.keys(value).every((key) => allowed.has(key));
}

function safeRouteId(value: unknown) {
  if (typeof value !== "string" || value.length > MAX_ROUTE_ID_LENGTH) {
    return null;
  }
  const normalized = value.normalize("NFC").trim();
  return routeIdPattern.test(normalized) ? normalized : null;
}

function safeRouteSegment(value: unknown) {
  if (typeof value !== "string" || value.length > MAX_ROUTE_ID_LENGTH) {
    return null;
  }
  const normalized = value.normalize("NFC").trim();
  return routeSegmentPattern.test(normalized) ? normalized : null;
}

function safeAuthorKey(value: unknown) {
  if (typeof value !== "string") return null;
  const parts = value.split(":");
  if (parts.length !== 2) return null;
  const safeParts = parts.map(safeRouteSegment);
  return safeParts.every((part): part is string => Boolean(part))
    ? safeParts.join(":")
    : null;
}

function safeSearch(value: unknown) {
  if (
    typeof value !== "string" ||
    value.length > MAX_SEARCH_LENGTH ||
    forbiddenControlPattern.test(value)
  ) {
    return null;
  }
  return value.normalize("NFC").trim();
}

function safeScrollOffset(value: unknown) {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= MAX_SCROLL_OFFSET
    ? value
    : null;
}

function safeStringArray(value: unknown, routeIds = false) {
  if (!Array.isArray(value) || value.length > MAX_FILTER_VALUES) return null;
  const result: string[] = [];
  for (const entry of value) {
    if (typeof entry !== "string" || forbiddenControlPattern.test(entry)) {
      return null;
    }
    const normalized = entry.normalize("NFC").trim();
    if (!normalized || normalized !== entry) return null;
    if (routeIds && !safeRouteSegment(normalized)) return null;
    result.push(normalized);
  }
  return result;
}

export function normalizeBookArchiveBookKey(value: unknown) {
  if (typeof value !== "string" || value.length > MAX_BOOK_KEY_LENGTH) {
    return null;
  }
  const parts = value.split(":");
  if (parts.length !== 3) return null;
  const safeParts = parts.map(safeRouteSegment);
  return safeParts.every((part): part is string => Boolean(part))
    ? safeParts.join(":")
    : null;
}

export function normalizeBookArchiveShelfId(value: unknown) {
  return safeRouteId(value);
}

export function bookArchiveArticleFocusOrigin(
  articleId: unknown
): BookArchiveNavigationFocusOrigin | null {
  const safeArticleId = safeRouteId(articleId);
  return safeArticleId ? `book-article:${safeArticleId}` : null;
}

export function normalizeBookArchiveNavigationFocusOrigin(
  value: unknown
): BookArchiveNavigationFocusOrigin | null {
  if (value === "book-author") return value;
  if (typeof value !== "string" || !value.startsWith("book-article:")) {
    return null;
  }
  return bookArchiveArticleFocusOrigin(value.slice("book-article:".length));
}

function singleParameter(params: URLSearchParams, name: string) {
  const values = params.getAll(name);
  return values.length === 1 ? values[0] : null;
}

/** Parses only the query component and rejects duplicate controlled params. */
export function parseBookArchiveLocation(search: string): BookArchiveLocationState {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const rawBookKey = singleParameter(params, BOOK_ARCHIVE_BOOK_PARAM);
  const rawShelfId = singleParameter(params, BOOK_ARCHIVE_SHELF_PARAM);
  return {
    bookKey: normalizeBookArchiveBookKey(rawBookKey),
    shelfId: normalizeBookArchiveShelfId(rawShelfId),
  };
}

function applyControlledParameter(
  params: URLSearchParams,
  name: string,
  value: string | null | undefined,
  normalize: (candidate: unknown) => string | null
) {
  if (value === undefined) return;
  const safeValue = normalize(value);
  params.delete(name);
  if (safeValue) params.set(name, safeValue);
}

/**
 * Returns a History API target while preserving every uncontrolled query
 * parameter, its ordering, and the current hash.
 */
export function serializeBookArchiveLocation(
  location: BookArchiveLocationSource,
  patch: BookArchiveLocationPatch
) {
  const params = new URLSearchParams(
    location.search?.startsWith("?")
      ? location.search.slice(1)
      : location.search || ""
  );
  applyControlledParameter(
    params,
    BOOK_ARCHIVE_BOOK_PARAM,
    patch.bookKey,
    normalizeBookArchiveBookKey
  );
  applyControlledParameter(
    params,
    BOOK_ARCHIVE_SHELF_PARAM,
    patch.shelfId,
    normalizeBookArchiveShelfId
  );
  const search = params.toString();
  const hash = location.hash
    ? location.hash.startsWith("#")
      ? location.hash
      : `#${location.hash}`
    : "";
  return `${location.pathname}${search ? `?${search}` : ""}${hash}`;
}

export function createBookArchiveHistoryChange(
  location: BookArchiveLocationSource,
  patch: BookArchiveLocationPatch,
  mode: BookArchiveHistoryMode = "replace"
): BookArchiveHistoryChange {
  return {
    mode,
    target: serializeBookArchiveLocation(location, patch),
  };
}

function defaultNavigationFilters(): BookArchiveNavigationFilters {
  const state = normalizeBookArchiveFilterState();
  return {
    quickPreset: state.quickPreset,
    authorKey: state.authorKey,
    countryIds: state.countryIds,
    genreIds: state.genreIds,
    audienceIds: state.audienceIds,
    periods: state.periods,
    originalLanguageIds: state.originalLanguageIds,
    editorialStatuses: state.editorialStatuses,
    coverModes: state.coverModes,
    articleRelations: state.articleRelations,
    savedOnly: state.savedOnly,
    sort: state.sort,
  };
}

function parseStoredFilter(value: unknown): BookArchiveNavigationFilters | null {
  if (!plainRecord(value) || !hasOnlyKeys(value, storedFilterKeys)) return null;
  const input: MutableBookArchiveFilterInput = { query: "" };

  if ("p" in value) {
    if (typeof value.p !== "string") return null;
    input.quickPreset = value.p as BookArchiveFilterState["quickPreset"];
  }
  if ("a" in value) {
    const authorKey = safeAuthorKey(value.a);
    if (!authorKey) return null;
    input.authorKey = authorKey;
  }

  const arrayFields = [
    ["c", "countryIds", true],
    ["g", "genreIds", false],
    ["u", "audienceIds", false],
    ["e", "periods", false],
    ["l", "originalLanguageIds", false],
    ["t", "editorialStatuses", false],
    ["m", "coverModes", false],
    ["r", "articleRelations", false],
  ] as const;
  for (const [storedKey, semanticKey, routeIds] of arrayFields) {
    if (!(storedKey in value)) continue;
    const entries = safeStringArray(value[storedKey], routeIds);
    if (!entries) return null;
    (input as Record<string, unknown>)[semanticKey] = entries;
  }
  if ("d" in value) {
    if (typeof value.d !== "boolean") return null;
    input.savedOnly = value.d;
  }
  if ("o" in value) {
    if (typeof value.o !== "string") return null;
    input.sort = value.o as BookArchiveFilterState["sort"];
  }

  const normalized = normalizeBookArchiveFilterState(input);
  if ("p" in value && normalized.quickPreset !== value.p) return null;
  if ("a" in value && normalized.authorKey !== input.authorKey) return null;
  if ("o" in value && normalized.sort !== value.o) return null;
  for (const [storedKey, semanticKey] of arrayFields) {
    if (!(storedKey in value)) continue;
    const supplied = value[storedKey] as readonly string[];
    const accepted = normalized[semanticKey] as readonly string[];
    if (supplied.length !== accepted.length) return null;
    const sorted = [...supplied].sort((left, right) => left.localeCompare(right, "en"));
    if (sorted.some((entry, index) => entry !== accepted[index])) return null;
  }

  return {
    quickPreset: normalized.quickPreset,
    authorKey: normalized.authorKey,
    countryIds: normalized.countryIds,
    genreIds: normalized.genreIds,
    audienceIds: normalized.audienceIds,
    periods: normalized.periods,
    originalLanguageIds: normalized.originalLanguageIds,
    editorialStatuses: normalized.editorialStatuses,
    coverModes: normalized.coverModes,
    articleRelations: normalized.articleRelations,
    savedOnly: normalized.savedOnly,
    sort: normalized.sort,
  };
}

function semanticFilterToStored(value: unknown): StoredNavigationFilter | null {
  if (!plainRecord(value) || !hasOnlyKeys(value, semanticFilterKeys)) return null;
  const complete: StoredNavigationFilter = {
    p: value.quickPreset as BookArchiveFilterState["quickPreset"],
    ...(value.authorKey ? { a: String(value.authorKey) } : {}),
    c: value.countryIds as readonly string[],
    g: value.genreIds as readonly string[],
    u: value.audienceIds as readonly string[],
    e: value.periods as readonly string[],
    l: value.originalLanguageIds as readonly string[],
    t: value.editorialStatuses as readonly string[],
    m: value.coverModes as readonly string[],
    r: value.articleRelations as readonly string[],
    d: value.savedOnly as boolean,
    o: value.sort as BookArchiveFilterState["sort"],
  };
  const normalized = parseStoredFilter(complete);
  if (!normalized) return null;
  const defaults = defaultNavigationFilters();
  return {
    ...(normalized.quickPreset !== defaults.quickPreset
      ? { p: normalized.quickPreset }
      : {}),
    ...(normalized.authorKey ? { a: normalized.authorKey } : {}),
    ...(normalized.countryIds.length ? { c: normalized.countryIds } : {}),
    ...(normalized.genreIds.length ? { g: normalized.genreIds } : {}),
    ...(normalized.audienceIds.length ? { u: normalized.audienceIds } : {}),
    ...(normalized.periods.length ? { e: normalized.periods } : {}),
    ...(normalized.originalLanguageIds.length
      ? { l: normalized.originalLanguageIds }
      : {}),
    ...(normalized.editorialStatuses.length
      ? { t: normalized.editorialStatuses }
      : {}),
    ...(normalized.coverModes.length ? { m: normalized.coverModes } : {}),
    ...(normalized.articleRelations.length
      ? { r: normalized.articleRelations }
      : {}),
    ...(normalized.savedOnly ? { d: true } : {}),
    ...(normalized.sort !== defaults.sort ? { o: normalized.sort } : {}),
  };
}

function parseStoredContext(value: unknown): BookArchiveNavigationContext | null {
  if (!plainRecord(value) || !hasOnlyKeys(value, storedContextKeys)) return null;
  if (value.v !== BOOK_ARCHIVE_NAVIGATION_CONTEXT_VERSION) return null;
  const shelfId = normalizeBookArchiveShelfId(value.s);
  if (!shelfId) return null;
  const query = value.q === undefined ? "" : safeSearch(value.q);
  if (query === null) return null;
  const scope = value.w === undefined ? "library" : value.w;
  if (scope !== "library" && scope !== "archive" && scope !== "global") return null;
  const filters = value.f === undefined ? defaultNavigationFilters() : parseStoredFilter(value.f);
  if (!filters) return null;
  const x = value.x === undefined ? 0 : safeScrollOffset(value.x);
  const y = value.y === undefined ? 0 : safeScrollOffset(value.y);
  if (x === null || y === null) return null;
  const selectedBookKey =
    value.b === undefined ? null : normalizeBookArchiveBookKey(value.b);
  if (value.b !== undefined && !selectedBookKey) return null;
  const viewMode = value.i === undefined ? "shelf" : value.i;
  if (viewMode !== "shelf" && viewMode !== "catalog") return null;
  const focusedBookKey =
    value.k === undefined ? null : normalizeBookArchiveBookKey(value.k);
  if (value.k !== undefined && !focusedBookKey) return null;
  const pageIndex = value.n === undefined ? 0 : value.n;
  if (
    typeof pageIndex !== "number" ||
    !Number.isSafeInteger(pageIndex) ||
    pageIndex < 0 ||
    pageIndex > 10_000
  ) {
    return null;
  }
  if (value.j !== undefined && value.j !== true) return null;
  const inspectionOpen = value.j === true;
  const focusOrigin =
    value.h === undefined
      ? null
      : normalizeBookArchiveNavigationFocusOrigin(value.h);
  if (value.h !== undefined && !focusOrigin) return null;

  return {
    version: BOOK_ARCHIVE_NAVIGATION_CONTEXT_VERSION,
    shelfId,
    search: { query, scope },
    filters,
    viewMode,
    focusedBookKey,
    pageIndex,
    scroll: { x, y },
    selectedBookKey,
    inspectionOpen,
    focusOrigin,
  };
}

export function parseBookArchiveNavigationContext(
  serialized: string | null | undefined
): BookArchiveNavigationContext | null {
  if (!serialized) return null;
  try {
    return parseStoredContext(JSON.parse(serialized) as unknown);
  } catch {
    return null;
  }
}

export function serializeBookArchiveNavigationContext(
  context: BookArchiveNavigationContext
): string | null {
  if (context.version !== BOOK_ARCHIVE_NAVIGATION_CONTEXT_VERSION) return null;
  const shelfId = normalizeBookArchiveShelfId(context.shelfId);
  const query = safeSearch(context.search?.query);
  const scope = context.search?.scope;
  const filters = semanticFilterToStored(context.filters);
  const x = safeScrollOffset(Math.round(context.scroll?.x));
  const y = safeScrollOffset(Math.round(context.scroll?.y));
  const selectedBookKey = context.selectedBookKey
    ? normalizeBookArchiveBookKey(context.selectedBookKey)
    : null;
  const focusedBookKey = context.focusedBookKey
    ? normalizeBookArchiveBookKey(context.focusedBookKey)
    : null;
  const viewMode = context.viewMode;
  const pageIndex = context.pageIndex;
  const inspectionOpen = context.inspectionOpen;
  const focusOrigin = context.focusOrigin
    ? normalizeBookArchiveNavigationFocusOrigin(context.focusOrigin)
    : null;
  if (
    !shelfId ||
    query === null ||
    (scope !== "library" && scope !== "archive" && scope !== "global") ||
    !filters ||
    x === null ||
    y === null ||
    (context.selectedBookKey !== null && !selectedBookKey) ||
    (context.focusedBookKey !== null && !focusedBookKey) ||
    (viewMode !== "shelf" && viewMode !== "catalog") ||
    !Number.isSafeInteger(pageIndex) ||
    pageIndex < 0 ||
    pageIndex > 10_000 ||
    typeof inspectionOpen !== "boolean" ||
    (context.focusOrigin !== null && !focusOrigin)
  ) {
    return null;
  }

  const stored: StoredNavigationContext = {
    v: BOOK_ARCHIVE_NAVIGATION_CONTEXT_VERSION,
    s: shelfId,
    ...(query ? { q: query } : {}),
    ...(scope !== "library" ? { w: scope } : {}),
    f: filters,
    ...(x ? { x } : {}),
    ...(y ? { y } : {}),
    ...(selectedBookKey ? { b: selectedBookKey } : {}),
    ...(viewMode === "catalog" ? { i: viewMode } : {}),
    ...(focusedBookKey ? { k: focusedBookKey } : {}),
    ...(pageIndex ? { n: pageIndex } : {}),
    ...(inspectionOpen ? { j: true } : {}),
    ...(focusOrigin ? { h: focusOrigin } : {}),
  };
  return JSON.stringify(stored);
}

export function readBookArchiveNavigationContext(
  storage: BookArchiveSessionStorage,
  key = BOOK_ARCHIVE_NAVIGATION_STORAGE_KEY
) {
  try {
    return parseBookArchiveNavigationContext(storage.getItem(key));
  } catch {
    return null;
  }
}

export function writeBookArchiveNavigationContext(
  storage: BookArchiveSessionStorage,
  context: BookArchiveNavigationContext,
  key = BOOK_ARCHIVE_NAVIGATION_STORAGE_KEY
) {
  const serialized = serializeBookArchiveNavigationContext(context);
  if (!serialized) return false;
  try {
    storage.setItem(key, serialized);
    return true;
  } catch {
    return false;
  }
}

export function clearBookArchiveNavigationContext(
  storage: BookArchiveSessionStorage,
  key = BOOK_ARCHIVE_NAVIGATION_STORAGE_KEY
) {
  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
