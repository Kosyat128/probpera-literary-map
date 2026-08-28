import {
  BOOK_ARCHIVE_SORTS,
  normalizeBookArchiveFilterState,
  type BookArchiveFilterState,
  type BookArchiveSort,
} from "./bookArchiveFacets";
import {
  bookScenePresetIds,
  type BookScenePresetId,
} from "./bookArchiveSceneSettings";

export const BOOK_COLLECTION_SCHEMA_VERSION = 1 as const;

export const BOOK_COLLECTION_KINDS = [
  "system",
  "manual",
  "smart",
  "editorial",
] as const;

export const BOOK_COLLECTION_SYSTEM_TYPES = [
  "library",
  "want-to-read",
  "reading",
  "finished",
] as const;

export const BOOK_COLLECTION_VISIBILITIES = [
  "private",
  "unlisted",
  "public",
] as const;

/**
 * Presentation-safe icon identifiers. Collections never persist SVG, markup,
 * CSS or remote asset URLs; the UI maps these ids to bundled brand icons.
 */
export const BOOK_COLLECTION_ICON_IDS = [
  "book",
  "star",
  "quill",
  "archive",
  "heart",
] as const;

export type BookCollectionKind = (typeof BOOK_COLLECTION_KINDS)[number];
export type BookCollectionSystemType =
  (typeof BOOK_COLLECTION_SYSTEM_TYPES)[number];
export type BookCollectionVisibility =
  (typeof BOOK_COLLECTION_VISIBILITIES)[number];
export type BookCollectionIconId = (typeof BOOK_COLLECTION_ICON_IDS)[number];

export type BookCollection = Readonly<{
  id: string;
  ownerId?: string;
  kind: BookCollectionKind;
  systemType?: BookCollectionSystemType;
  title: string;
  description?: string;
  icon?: BookCollectionIconId;
  visibility: BookCollectionVisibility;
  backgroundPreset?: BookScenePresetId;
  dynamicBookThemes: boolean;
  themeIntensity: number;
  sortMode: BookArchiveSort;
  filterState?: BookArchiveFilterState;
  schemaVersion: typeof BOOK_COLLECTION_SCHEMA_VERSION;
  createdAt: string;
  updatedAt: string;
}>;

/** A membership only: live title, writer, cover and work metadata stay in the archive. */
export type BookCollectionItem = Readonly<{
  collectionId: string;
  bookKey: string;
  position: number;
  addedAt: string;
  updatedAt: string;
}>;

/** Explicit reader favourite. It is intentionally independent from saved status. */
export type BookFavoriteMembership = Readonly<{
  bookKey: string;
  addedAt: string;
  updatedAt: string;
}>;

export type BookCollectionSnapshot = Readonly<{
  schemaVersion: typeof BOOK_COLLECTION_SCHEMA_VERSION;
  collections: readonly BookCollection[];
  items: readonly BookCollectionItem[];
  favorites: readonly BookFavoriteMembership[];
}>;

export type BookSavedEntry = Readonly<{
  id: string;
  kind: "article" | "book";
  status: "saved" | "reading" | "finished";
  addedAt: string;
  updatedAt?: string;
}>;

export type DeriveSystemBookCollectionsOptions = Readonly<{
  ownerId?: string;
  fallbackTimestamp?: string;
  titles?: Partial<Readonly<Record<BookCollectionSystemType, string>>>;
}>;

export const SYSTEM_BOOK_COLLECTION_IDS = Object.freeze({
  library: "system:library",
  "want-to-read": "system:want-to-read",
  reading: "system:reading",
  finished: "system:finished",
} satisfies Readonly<Record<BookCollectionSystemType, string>>);

const SYSTEM_BOOK_COLLECTION_TITLES = Object.freeze({
  library: "Моя библиотека",
  "want-to-read": "Хочу прочитать",
  reading: "Читаю сейчас",
  finished: "Прочитано",
} satisfies Readonly<Record<BookCollectionSystemType, string>>);

const EMPTY_TIMESTAMP = "1970-01-01T00:00:00.000Z";
const MAX_COLLECTIONS = 256;
const MAX_MEMBERSHIPS = 20_000;
const MAX_ID_LENGTH = 192;
const MAX_TITLE_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 800;
const MAX_QUERY_LENGTH = 240;
const MAX_FILTER_VALUES = 128;
const MAX_POSITION = 1_000_000;

const kindSet = new Set<string>(BOOK_COLLECTION_KINDS);
const systemTypeSet = new Set<string>(BOOK_COLLECTION_SYSTEM_TYPES);
const visibilitySet = new Set<string>(BOOK_COLLECTION_VISIBILITIES);
const iconSet = new Set<string>(BOOK_COLLECTION_ICON_IDS);
const presetSet = new Set<string>(bookScenePresetIds);
const sortSet = new Set<string>(BOOK_ARCHIVE_SORTS);
const idPattern = /^[A-Za-z0-9](?:[A-Za-z0-9:_-]{0,191})$/u;
const unsafeTextPattern = /[<>]|(?:javascript|vbscript)\s*:|data\s*:\s*text\/html/iu;
const forbiddenControlPattern =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/u;

const collectionKeys = new Set([
  "id",
  "ownerId",
  "kind",
  "systemType",
  "title",
  "description",
  "icon",
  "visibility",
  "backgroundPreset",
  "dynamicBookThemes",
  "themeIntensity",
  "sortMode",
  "filterState",
  "schemaVersion",
  "createdAt",
  "updatedAt",
]);
const itemKeys = new Set([
  "collectionId",
  "bookKey",
  "position",
  "addedAt",
  "updatedAt",
]);
const favoriteKeys = new Set(["bookKey", "addedAt", "updatedAt"]);
const snapshotKeys = new Set([
  "schemaVersion",
  "collections",
  "items",
  "favorites",
]);
const filterKeys = new Set<string>([
  "query",
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

type MutableBookArchiveFilterInput = {
  -readonly [Key in keyof BookArchiveFilterState]?: BookArchiveFilterState[Key];
};

function plainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>
) {
  return Object.keys(value).every((key) => allowed.has(key));
}

function safeId(value: unknown) {
  if (typeof value !== "string" || value.length > MAX_ID_LENGTH) return null;
  const normalized = value.trim();
  return idPattern.test(normalized) ? normalized : null;
}

function safeText(value: unknown, maximum: number) {
  if (typeof value !== "string" || forbiddenControlPattern.test(value)) {
    return null;
  }
  const normalized = value.normalize("NFC").replace(/\s+/gu, " ").trim();
  if (
    !normalized ||
    normalized.length > maximum ||
    unsafeTextPattern.test(normalized)
  ) {
    return null;
  }
  return normalized;
}

function safeOptionalText(value: unknown, maximum: number) {
  return value === undefined ? undefined : safeText(value, maximum);
}

function safeTimestamp(value: unknown) {
  if (typeof value !== "string" || value.length > 40) return null;
  if (
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/u.test(
      value
    )
  ) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function safeStringArray(value: unknown, ids = false) {
  if (!Array.isArray(value) || value.length > MAX_FILTER_VALUES) return null;
  const result: string[] = [];
  for (const entry of value) {
    const safe = ids ? safeId(entry) : safeText(entry, MAX_ID_LENGTH);
    if (safe === null) return null;
    result.push(safe);
  }
  return result;
}

function normalizedFilterState(value: unknown) {
  if (!plainRecord(value) || !hasOnlyKeys(value, filterKeys)) return null;
  const input: MutableBookArchiveFilterInput = {};

  if ("query" in value) {
    if (typeof value.query !== "string" || forbiddenControlPattern.test(value.query)) {
      return null;
    }
    const query = value.query.normalize("NFC").trim();
    if (query.length > MAX_QUERY_LENGTH || unsafeTextPattern.test(query)) return null;
    input.query = query;
  }
  if ("quickPreset" in value) {
    if (typeof value.quickPreset !== "string") return null;
    input.quickPreset = value.quickPreset as BookArchiveFilterState["quickPreset"];
  }
  if ("authorKey" in value) {
    if (value.authorKey !== null && safeId(value.authorKey) === null) return null;
    input.authorKey = value.authorKey === null ? null : String(value.authorKey).trim();
  }

  const arrayFields = [
    "countryIds",
    "genreIds",
    "audienceIds",
    "periods",
    "originalLanguageIds",
    "editorialStatuses",
    "coverModes",
    "articleRelations",
  ] as const;
  for (const field of arrayFields) {
    if (!(field in value)) continue;
    const entries = safeStringArray(value[field], field === "countryIds");
    if (!entries) return null;
    (input as unknown as Record<string, unknown>)[field] = entries;
  }
  if ("savedOnly" in value) {
    if (typeof value.savedOnly !== "boolean") return null;
    input.savedOnly = value.savedOnly;
  }
  if ("sort" in value) {
    if (typeof value.sort !== "string") return null;
    input.sort = value.sort as BookArchiveSort;
  }

  const normalized = normalizeBookArchiveFilterState(input);
  if ("quickPreset" in value && normalized.quickPreset !== value.quickPreset) return null;
  if ("authorKey" in value && normalized.authorKey !== input.authorKey) return null;
  if ("sort" in value && normalized.sort !== value.sort) return null;
  for (const field of arrayFields) {
    if (!(field in value)) continue;
    const supplied = [...new Set(input[field] as readonly string[])].sort();
    const accepted = [...normalized[field]].sort();
    if (supplied.length !== accepted.length) return null;
    if (supplied.some((entry, index) => entry !== accepted[index])) return null;
  }
  return normalized;
}

export function parseBookCollection(value: unknown): BookCollection | null {
  if (!plainRecord(value) || !hasOnlyKeys(value, collectionKeys)) return null;
  const id = safeId(value.id);
  const ownerId = value.ownerId === undefined ? undefined : safeId(value.ownerId);
  const title = safeText(value.title, MAX_TITLE_LENGTH);
  const description = safeOptionalText(value.description, MAX_DESCRIPTION_LENGTH);
  const icon =
    value.icon === undefined
      ? undefined
      : typeof value.icon === "string" && iconSet.has(value.icon)
        ? (value.icon as BookCollectionIconId)
        : null;
  const createdAt = safeTimestamp(value.createdAt);
  const updatedAt = safeTimestamp(value.updatedAt);
  const filterState =
    value.filterState === undefined
      ? undefined
      : normalizedFilterState(value.filterState);

  if (
    !id ||
    (value.ownerId !== undefined && !ownerId) ||
    !title ||
    (value.description !== undefined && !description) ||
    (value.icon !== undefined && !icon) ||
    !createdAt ||
    !updatedAt ||
    Date.parse(updatedAt) < Date.parse(createdAt) ||
    value.schemaVersion !== BOOK_COLLECTION_SCHEMA_VERSION ||
    typeof value.kind !== "string" ||
    !kindSet.has(value.kind) ||
    typeof value.visibility !== "string" ||
    !visibilitySet.has(value.visibility) ||
    typeof value.dynamicBookThemes !== "boolean" ||
    typeof value.themeIntensity !== "number" ||
    !Number.isInteger(value.themeIntensity) ||
    (value.themeIntensity as number) < 0 ||
    (value.themeIntensity as number) > 100 ||
    typeof value.sortMode !== "string" ||
    !sortSet.has(value.sortMode) ||
    (value.backgroundPreset !== undefined &&
      (typeof value.backgroundPreset !== "string" ||
        !presetSet.has(value.backgroundPreset))) ||
    (value.filterState !== undefined && !filterState)
  ) {
    return null;
  }

  const kind = value.kind as BookCollectionKind;
  const systemType =
    value.systemType === undefined
      ? undefined
      : typeof value.systemType === "string" && systemTypeSet.has(value.systemType)
        ? (value.systemType as BookCollectionSystemType)
        : null;
  if (
    (kind === "system" && !systemType) ||
    (kind !== "system" && value.systemType !== undefined) ||
    (kind === "smart" && !filterState)
  ) {
    return null;
  }

  return {
    id,
    ...(ownerId ? { ownerId } : {}),
    kind,
    ...(systemType ? { systemType } : {}),
    title,
    ...(description ? { description } : {}),
    ...(icon ? { icon } : {}),
    visibility: value.visibility as BookCollectionVisibility,
    ...(value.backgroundPreset
      ? { backgroundPreset: value.backgroundPreset as BookScenePresetId }
      : {}),
    dynamicBookThemes: value.dynamicBookThemes,
    themeIntensity: value.themeIntensity as number,
    sortMode: value.sortMode as BookArchiveSort,
    ...(filterState ? { filterState } : {}),
    schemaVersion: BOOK_COLLECTION_SCHEMA_VERSION,
    createdAt,
    updatedAt,
  };
}

export function parseBookCollectionItem(value: unknown): BookCollectionItem | null {
  if (!plainRecord(value) || !hasOnlyKeys(value, itemKeys)) return null;
  const collectionId = safeId(value.collectionId);
  const bookKey = safeId(value.bookKey);
  const addedAt = safeTimestamp(value.addedAt);
  const updatedAt = safeTimestamp(value.updatedAt);
  if (
    !collectionId ||
    !bookKey ||
    !addedAt ||
    !updatedAt ||
    Date.parse(updatedAt) < Date.parse(addedAt) ||
    typeof value.position !== "number" ||
    !Number.isInteger(value.position) ||
    (value.position as number) < 0 ||
    (value.position as number) > MAX_POSITION
  ) {
    return null;
  }
  return {
    collectionId,
    bookKey,
    position: value.position as number,
    addedAt,
    updatedAt,
  };
}

export function parseBookFavoriteMembership(
  value: unknown
): BookFavoriteMembership | null {
  if (!plainRecord(value) || !hasOnlyKeys(value, favoriteKeys)) return null;
  const bookKey = safeId(value.bookKey);
  const addedAt = safeTimestamp(value.addedAt);
  const updatedAt = safeTimestamp(value.updatedAt);
  if (
    !bookKey ||
    !addedAt ||
    !updatedAt ||
    Date.parse(updatedAt) < Date.parse(addedAt)
  ) {
    return null;
  }
  return { bookKey, addedAt, updatedAt };
}

function membershipKey(item: Pick<BookCollectionItem, "collectionId" | "bookKey">) {
  return `${item.collectionId}\u0000${item.bookKey}`;
}

function compareCollectionItems(left: BookCollectionItem, right: BookCollectionItem) {
  return (
    left.collectionId.localeCompare(right.collectionId, "en") ||
    left.position - right.position ||
    left.bookKey.localeCompare(right.bookKey, "en")
  );
}

export function createEmptyBookCollectionSnapshot(): BookCollectionSnapshot {
  return {
    schemaVersion: BOOK_COLLECTION_SCHEMA_VERSION,
    collections: [],
    items: [],
    favorites: [],
  };
}

export function parseBookCollectionSnapshot(
  value: unknown
): BookCollectionSnapshot | null {
  if (!plainRecord(value) || !hasOnlyKeys(value, snapshotKeys)) return null;
  if (
    value.schemaVersion !== BOOK_COLLECTION_SCHEMA_VERSION ||
    !Array.isArray(value.collections) ||
    !Array.isArray(value.items) ||
    !Array.isArray(value.favorites) ||
    value.collections.length > MAX_COLLECTIONS ||
    value.items.length > MAX_MEMBERSHIPS ||
    value.favorites.length > MAX_MEMBERSHIPS
  ) {
    return null;
  }

  const collections = value.collections.map(parseBookCollection);
  const items = value.items.map(parseBookCollectionItem);
  const favorites = value.favorites.map(parseBookFavoriteMembership);
  if (
    collections.some((entry) => entry === null) ||
    items.some((entry) => entry === null) ||
    favorites.some((entry) => entry === null)
  ) {
    return null;
  }

  const safeCollections = collections as BookCollection[];
  const safeItems = items as BookCollectionItem[];
  const safeFavorites = favorites as BookFavoriteMembership[];
  const collectionIds = new Set<string>();
  const membershipKeys = new Set<string>();
  const favoriteKeys = new Set<string>();
  for (const collection of safeCollections) {
    if (collectionIds.has(collection.id)) return null;
    collectionIds.add(collection.id);
  }
  for (const item of safeItems) {
    const key = membershipKey(item);
    if (!collectionIds.has(item.collectionId) || membershipKeys.has(key)) return null;
    membershipKeys.add(key);
  }
  for (const favorite of safeFavorites) {
    if (favoriteKeys.has(favorite.bookKey)) return null;
    favoriteKeys.add(favorite.bookKey);
  }

  return {
    schemaVersion: BOOK_COLLECTION_SCHEMA_VERSION,
    collections: [...safeCollections].sort((left, right) =>
      left.id.localeCompare(right.id, "en")
    ),
    items: [...safeItems].sort(compareCollectionItems),
    favorites: [...safeFavorites].sort(
      (left, right) =>
        Date.parse(left.addedAt) - Date.parse(right.addedAt) ||
        left.bookKey.localeCompare(right.bookKey, "en")
    ),
  };
}

function stableWinner<T extends { updatedAt: string }>(left: T, right: T) {
  const leftTime = Date.parse(left.updatedAt);
  const rightTime = Date.parse(right.updatedAt);
  if (leftTime !== rightTime) return leftTime > rightTime ? left : right;
  return JSON.stringify(left) >= JSON.stringify(right) ? left : right;
}

function earliestTimestamp(left: string, right: string) {
  return Date.parse(left) <= Date.parse(right) ? left : right;
}

function latestTimestamp(left: string, right: string) {
  return Date.parse(left) >= Date.parse(right) ? left : right;
}

/**
 * Deterministic first-login policy: newer collection metadata wins; for equal
 * timestamps canonical JSON breaks ties. Server order stays authoritative for
 * existing memberships and local-only memberships are appended in local order.
 */
export function mergeBookCollectionSnapshots(
  local: BookCollectionSnapshot,
  remote: BookCollectionSnapshot
): BookCollectionSnapshot {
  const safeLocal = parseBookCollectionSnapshot(local);
  const safeRemote = parseBookCollectionSnapshot(remote);
  if (!safeLocal && !safeRemote) return createEmptyBookCollectionSnapshot();
  if (!safeLocal) return safeRemote!;
  if (!safeRemote) return safeLocal;

  const collections = new Map<string, BookCollection>();
  for (const collection of [...safeLocal.collections, ...safeRemote.collections]) {
    const previous = collections.get(collection.id);
    if (!previous) {
      collections.set(collection.id, collection);
      continue;
    }
    const winner = stableWinner(previous, collection);
    collections.set(collection.id, {
      ...winner,
      createdAt: earliestTimestamp(previous.createdAt, collection.createdAt),
      updatedAt: latestTimestamp(previous.updatedAt, collection.updatedAt),
    });
  }

  const localByCollection = new Map<string, BookCollectionItem[]>();
  const remoteByCollection = new Map<string, BookCollectionItem[]>();
  for (const [source, target] of [
    [safeLocal.items, localByCollection],
    [safeRemote.items, remoteByCollection],
  ] as const) {
    for (const item of source) {
      const values = target.get(item.collectionId) || [];
      values.push(item);
      target.set(item.collectionId, values);
    }
  }

  const mergedItems: BookCollectionItem[] = [];
  for (const collectionId of [...collections.keys()].sort()) {
    const localItems = [...(localByCollection.get(collectionId) || [])].sort(
      (left, right) => left.position - right.position || left.bookKey.localeCompare(right.bookKey, "en")
    );
    const remoteItems = [...(remoteByCollection.get(collectionId) || [])].sort(
      (left, right) => left.position - right.position || left.bookKey.localeCompare(right.bookKey, "en")
    );
    const localMap = new Map(localItems.map((item) => [item.bookKey, item]));
    const remoteMap = new Map(remoteItems.map((item) => [item.bookKey, item]));
    const order = [
      ...remoteItems.map(({ bookKey }) => bookKey),
      ...localItems
        .filter(({ bookKey }) => !remoteMap.has(bookKey))
        .map(({ bookKey }) => bookKey),
    ];
    order.forEach((bookKey, position) => {
      const localItem = localMap.get(bookKey);
      const remoteItem = remoteMap.get(bookKey);
      const winner =
        localItem && remoteItem
          ? stableWinner(localItem, remoteItem)
          : localItem || remoteItem;
      if (!winner) return;
      mergedItems.push({
        ...winner,
        collectionId,
        bookKey,
        position,
        addedAt:
          localItem && remoteItem
            ? earliestTimestamp(localItem.addedAt, remoteItem.addedAt)
            : winner.addedAt,
        updatedAt:
          localItem && remoteItem
            ? latestTimestamp(localItem.updatedAt, remoteItem.updatedAt)
            : winner.updatedAt,
      });
    });
  }

  const favorites = new Map<string, BookFavoriteMembership>();
  for (const favorite of [...safeLocal.favorites, ...safeRemote.favorites]) {
    const previous = favorites.get(favorite.bookKey);
    favorites.set(
      favorite.bookKey,
      previous
        ? {
            bookKey: favorite.bookKey,
            addedAt: earliestTimestamp(previous.addedAt, favorite.addedAt),
            updatedAt: latestTimestamp(previous.updatedAt, favorite.updatedAt),
          }
        : favorite
    );
  }

  return {
    schemaVersion: BOOK_COLLECTION_SCHEMA_VERSION,
    collections: [...collections.values()].sort((left, right) =>
      left.id.localeCompare(right.id, "en")
    ),
    items: mergedItems.sort(compareCollectionItems),
    favorites: [...favorites.values()].sort(
      (left, right) =>
        Date.parse(left.addedAt) - Date.parse(right.addedAt) ||
        left.bookKey.localeCompare(right.bookKey, "en")
    ),
  };
}

function safeSavedEntry(value: BookSavedEntry) {
  const bookKey = value.kind === "book" ? safeId(value.id) : null;
  const addedAt = safeTimestamp(value.addedAt);
  const updatedAt = safeTimestamp(value.updatedAt ?? value.addedAt);
  if (
    !bookKey ||
    !addedAt ||
    !updatedAt ||
    Date.parse(updatedAt) < Date.parse(addedAt) ||
    !["saved", "reading", "finished"].includes(value.status)
  ) {
    return null;
  }
  return { bookKey, status: value.status, addedAt, updatedAt };
}

/** Builds the four system shelves without mutating or re-labelling legacy data. */
export function deriveSystemBookCollections(
  savedEntries: readonly BookSavedEntry[],
  options: DeriveSystemBookCollectionsOptions = {}
): BookCollectionSnapshot {
  const ownerId = options.ownerId === undefined ? undefined : safeId(options.ownerId);
  if (options.ownerId !== undefined && !ownerId) return createEmptyBookCollectionSnapshot();
  const fallbackTimestamp = safeTimestamp(options.fallbackTimestamp) || EMPTY_TIMESTAMP;
  const entries = new Map<
    string,
    NonNullable<ReturnType<typeof safeSavedEntry>>
  >();
  for (const source of savedEntries) {
    const entry = safeSavedEntry(source);
    if (!entry) continue;
    const previous = entries.get(entry.bookKey);
    if (!previous) {
      entries.set(entry.bookKey, entry);
      continue;
    }
    entries.set(entry.bookKey, stableWinner(previous, entry));
  }

  const systemTypes = [...BOOK_COLLECTION_SYSTEM_TYPES];
  const allEntries = [...entries.values()].sort(
    (left, right) =>
      Date.parse(right.addedAt) - Date.parse(left.addedAt) ||
      left.bookKey.localeCompare(right.bookKey, "en")
  );
  const memberships: Readonly<Record<BookCollectionSystemType, typeof allEntries>> = {
    library: allEntries,
    "want-to-read": allEntries.filter(({ status }) => status === "saved"),
    reading: allEntries.filter(({ status }) => status === "reading"),
    finished: allEntries.filter(({ status }) => status === "finished"),
  };

  const collections = systemTypes.map((systemType): BookCollection => {
    const shelfEntries = memberships[systemType];
    const createdAt = shelfEntries.length
      ? shelfEntries
          .slice(1)
          .reduce(
            (earliest, entry) => earliestTimestamp(earliest, entry.addedAt),
            shelfEntries[0].addedAt
          )
      : fallbackTimestamp;
    const updatedAt = shelfEntries.length
      ? shelfEntries
          .slice(1)
          .reduce(
            (latest, entry) => latestTimestamp(latest, entry.updatedAt),
            shelfEntries[0].updatedAt
          )
      : fallbackTimestamp;
    const requestedTitle = options.titles?.[systemType];
    const title = requestedTitle
      ? safeText(requestedTitle, MAX_TITLE_LENGTH) || SYSTEM_BOOK_COLLECTION_TITLES[systemType]
      : SYSTEM_BOOK_COLLECTION_TITLES[systemType];
    return {
      id: SYSTEM_BOOK_COLLECTION_IDS[systemType],
      ...(ownerId ? { ownerId } : {}),
      kind: "system",
      systemType,
      title,
      icon:
        systemType === "library"
          ? "archive"
          : systemType === "finished"
            ? "star"
            : "book",
      visibility: "private",
      dynamicBookThemes: true,
      themeIntensity: 72,
      sortMode: "recent",
      schemaVersion: BOOK_COLLECTION_SCHEMA_VERSION,
      createdAt,
      updatedAt,
    };
  });

  const items = systemTypes.flatMap((systemType) =>
    memberships[systemType].map(
      (entry, position): BookCollectionItem => ({
        collectionId: SYSTEM_BOOK_COLLECTION_IDS[systemType],
        bookKey: entry.bookKey,
        position,
        addedAt: entry.addedAt,
        updatedAt: entry.updatedAt,
      })
    )
  );

  return {
    schemaVersion: BOOK_COLLECTION_SCHEMA_VERSION,
    collections: collections.sort((left, right) => left.id.localeCompare(right.id, "en")),
    items: items.sort(compareCollectionItems),
    favorites: [],
  };
}
