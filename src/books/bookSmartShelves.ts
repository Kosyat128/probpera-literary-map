import {
  normalizeBookArchiveFilterState,
  type BookArchiveFilterState,
} from "./bookArchiveFacets";

export const BOOK_SMART_SHELVES_STORAGE_KEY = "probpera:book-smart-shelves:v1";
export const BOOK_SMART_SHELVES_LIMIT = 20;

export interface BookSmartShelf {
  readonly id: string;
  readonly label: string;
  readonly filterState: BookArchiveFilterState;
}

export interface BookSmartShelfInput {
  readonly id: string;
  readonly label: string;
  readonly filterState: Partial<BookArchiveFilterState>;
}

export interface BookSmartShelfStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface BookSmartShelfSaveResult {
  readonly shelf: BookSmartShelf | null;
  readonly shelves: readonly BookSmartShelf[];
  readonly persisted: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const normalizeId = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return /^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/.test(normalized)
    ? normalized
    : null;
};

const normalizeLabel = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized || normalized.length > 80) return null;
  return normalized;
};

const normalizeFilterState = (value: unknown): BookArchiveFilterState | null => {
  if (!isRecord(value)) return null;
  try {
    const normalized = normalizeBookArchiveFilterState(
      value as unknown as Partial<BookArchiveFilterState>,
    );
    return { ...normalized, query: normalized.query.trim() };
  } catch {
    return null;
  }
};

const normalizeShelf = (value: unknown): BookSmartShelf | null => {
  if (!isRecord(value)) return null;
  const id = normalizeId(value.id);
  const label = normalizeLabel(value.label);
  const filterState = normalizeFilterState(value.filterState);
  if (!id || !label || !filterState) return null;
  return { id, label, filterState };
};

const resolveLocalStorage = (): BookSmartShelfStorage | null => {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
};

export const applyBookSmartShelf = (
  value: unknown,
): BookArchiveFilterState | null => {
  const shelf = normalizeShelf(value);
  return shelf ? normalizeBookArchiveFilterState(shelf.filterState) : null;
};

export const readBookSmartShelves = (
  storage: BookSmartShelfStorage | null = resolveLocalStorage(),
): readonly BookSmartShelf[] => {
  if (!storage) return [];

  let parsed: unknown;
  try {
    const serialized = storage.getItem(BOOK_SMART_SHELVES_STORAGE_KEY);
    if (!serialized) return [];
    parsed = JSON.parse(serialized) as unknown;
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) return [];
  const shelves: BookSmartShelf[] = [];
  const ids = new Set<string>();
  for (const candidate of parsed) {
    const shelf = normalizeShelf(candidate);
    if (!shelf || ids.has(shelf.id)) continue;
    shelves.push(shelf);
    ids.add(shelf.id);
    if (shelves.length === BOOK_SMART_SHELVES_LIMIT) break;
  }
  return shelves;
};

export const saveBookSmartShelf = (
  input: BookSmartShelfInput,
  storage: BookSmartShelfStorage | null = resolveLocalStorage(),
): BookSmartShelfSaveResult => {
  const current = readBookSmartShelves(storage);
  const shelf = normalizeShelf(input);
  if (!shelf) return { shelf: null, shelves: current, persisted: false };

  const shelves = [
    shelf,
    ...current.filter((candidate) => candidate.id !== shelf.id),
  ].slice(0, BOOK_SMART_SHELVES_LIMIT);

  if (!storage) return { shelf, shelves, persisted: false };
  try {
    storage.setItem(BOOK_SMART_SHELVES_STORAGE_KEY, JSON.stringify(shelves));
    return { shelf, shelves, persisted: true };
  } catch {
    return { shelf, shelves, persisted: false };
  }
};
