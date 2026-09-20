import { parseBookDossierProgress, type BookDossierProgress } from "../books/bookDossierProgress";
import { strictWebStorage } from "../utils/safeWebStorage";

export type ReadingStatus = "saved" | "reading" | "finished";
export type SavedReading = {
  id: string; kind: "article" | "book"; title: string; sectionId?: string;
  sectionLabel: string; href?: string; addedAt: string; status: ReadingStatus;
  /** Private device progress, excluded from the durable remote outbox. */
  dossierProgress?: BookDossierProgress;
};
export type RemoteReading = Omit<SavedReading, "dossierProgress">;
export type ReadingLibraryPending =
  | { token: string; operation: "upsert"; item: RemoteReading }
  | { token: string; operation: "delete"; id: string; kind: SavedReading["kind"] };
export type ReadingLibraryEnvelope = { schemaVersion: 1; items: SavedReading[]; pending: ReadingLibraryPending[] };
export type ReadingLibraryPersistence = "persistent" | "session-only";
export interface ReadingLibraryStorage {
  read(): { envelope: ReadingLibraryEnvelope; persistence: ReadingLibraryPersistence; blocked?: boolean };
  write(envelope: ReadingLibraryEnvelope): ReadingLibraryPersistence;
}
export const READING_LIBRARY_ITEM_LIMIT = 200;
export const READING_LIBRARY_PENDING_LIMIT = 256;
export const readingItemKey = (item: Pick<SavedReading, "id" | "kind">) => `${item.kind}:${item.id}`;
export const pendingReadingKey = (entry: ReadingLibraryPending) => readingItemKey(entry.operation === "upsert" ? entry.item : entry);
export const readingStatusValue = (value: unknown): ReadingStatus => value === "reading" || value === "finished" ? value : "saved";
export function remoteReadingProjection(item: SavedReading): RemoteReading {
  const { dossierProgress: _privateProgress, ...value } = item;
  return value;
}
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown, max = 4_096): value is string => typeof value === "string" && value.length > 0 && value.length <= max;
const exactKeys = (value: Record<string, unknown>, required: string[], optional: string[] = []) =>
  required.every(key => Object.prototype.hasOwnProperty.call(value, key)) && Object.keys(value).every(key => required.includes(key) || optional.includes(key));

/** Legacy arrays may contain obsolete records; they are never themselves upload intent. */
export function parseReadingItems(value: unknown): SavedReading[] {
  if (!Array.isArray(value)) return [];
  const parsed = new Map<string, SavedReading>();
  for (const entry of value) {
    if (!object(entry) || !text(entry.id, 512) || !text(entry.title) || !text(entry.addedAt, 64) || !Number.isFinite(Date.parse(entry.addedAt))) continue;
    const item: SavedReading = { id: entry.id, kind: entry.kind === "book" ? "book" : "article", title: entry.title,
      sectionId: typeof entry.sectionId === "string" ? entry.sectionId : undefined,
      sectionLabel: typeof entry.sectionLabel === "string" ? entry.sectionLabel : "",
      href: typeof entry.href === "string" ? entry.href : undefined, addedAt: entry.addedAt, status: readingStatusValue(entry.status),
      dossierProgress: entry.kind === "book" ? parseBookDossierProgress(entry.dossierProgress) : undefined };
    if (!parsed.has(readingItemKey(item))) parsed.set(readingItemKey(item), item);
    if (parsed.size >= READING_LIBRARY_ITEM_LIMIT) break;
  }
  return [...parsed.values()];
}
function validRemote(value: unknown): value is RemoteReading {
  return object(value) && exactKeys(value, ["id", "kind", "title", "sectionLabel", "addedAt", "status"], ["sectionId", "href"])
    && text(value.id, 240) && (value.kind === "book" || value.kind === "article") && text(value.title, 300)
    && text(value.sectionLabel, 240)
    && (value.sectionId === undefined || typeof value.sectionId === "string" && value.sectionId.length <= 120)
    && (value.href === undefined || typeof value.href === "string" && value.href.length <= 500)
    && text(value.addedAt, 64) && Number.isFinite(Date.parse(value.addedAt))
    && (value.status === "saved" || value.status === "reading" || value.status === "finished");
}
export const validReadingForSync = (item: SavedReading) => validRemote(remoteReadingProjection(item));
function parseEnvelope(raw: string | null, adult: boolean): { envelope: ReadingLibraryEnvelope; blocked: boolean } {
  const empty: ReadingLibraryEnvelope = { schemaVersion: 1, items: [], pending: [] };
  if (raw === null) return { envelope: empty, blocked: false };
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return { envelope: empty, blocked: true }; }
  if (Array.isArray(value)) return { envelope: { ...empty, items: parseReadingItems(value) }, blocked: false };
  const items = object(value) ? parseReadingItems(value.items) : [];
  const invalid = () => ({ envelope: { ...empty, items }, blocked: true });
  if (!adult || !object(value) || !exactKeys(value, ["schemaVersion", "items", "pending"]) || value.schemaVersion !== 1
    || !Array.isArray(value.items) || value.items.length > READING_LIBRARY_ITEM_LIMIT || items.length !== value.items.length
    || !Array.isArray(value.pending) || value.pending.length > READING_LIBRARY_PENDING_LIMIT) return invalid();
  const pending: ReadingLibraryPending[] = [], keys = new Set<string>(), tokens = new Set<string>();
  for (const entry of value.pending) {
    if (!object(entry) || !text(entry.token, 128)) return invalid();
    let parsed: ReadingLibraryPending;
    if (entry.operation === "upsert" && exactKeys(entry, ["token", "operation", "item"]) && validRemote(entry.item)) {
      parsed = { token: entry.token, operation: "upsert", item: entry.item };
      const local = items.find(item => readingItemKey(item) === readingItemKey(entry.item as RemoteReading));
      if (!local || JSON.stringify(remoteReadingProjection(local)) !== JSON.stringify(remoteReadingProjection(parseReadingItems([entry.item])[0]))) return invalid();
    } else if (entry.operation === "delete" && exactKeys(entry, ["token", "operation", "id", "kind"])
      && text(entry.id, 240) && (entry.kind === "book" || entry.kind === "article")) {
      parsed = { token: entry.token, operation: "delete", id: entry.id, kind: entry.kind };
      if (items.some(item => readingItemKey(item) === readingItemKey(parsed as Extract<ReadingLibraryPending, { operation: "delete" }>))) return invalid();
    } else return invalid();
    const key = pendingReadingKey(parsed);
    if (keys.has(key) || tokens.has(parsed.token)) return invalid();
    keys.add(key); tokens.add(parsed.token); pending.push(parsed);
  }
  return { envelope: { schemaVersion: 1, items, pending }, blocked: false };
}

/** One atomic record; original storage methods bypass the site's resilient facade,
 * whose successful setItem can mean only an in-memory write. Corrupt outboxes are
 * preserved on disk and quarantined as a whole, never partially replayed. */
export function createReadingLibraryStorage(key: string, adult: boolean,
  getPort: () => Pick<Storage, "getItem" | "setItem"> = () => strictWebStorage("local")): ReadingLibraryStorage {
  let envelope: ReadingLibraryEnvelope = { schemaVersion: 1, items: [], pending: [] };
  let persistence: ReadingLibraryPersistence = "session-only", sessionDirty = false, blocked = false;
  let lastRaw: string | null | undefined;
  return {
    read() {
      if (!sessionDirty && !blocked) {
        try {
          const raw = getPort().getItem(key);
          // Keep the identity and property order of our own confirmed write.
          // Re-parsing unchanged bytes would make local coalescing appear external.
          if (raw !== lastRaw) {
            const parsed = parseEnvelope(raw, adult);
            envelope = parsed.envelope; blocked = parsed.blocked; lastRaw = raw;
          }
          persistence = blocked ? "session-only" : "persistent";
        } catch { persistence = "session-only"; blocked = true; }
      }
      return { envelope, persistence, blocked };
    },
    write(next) {
      envelope = next; sessionDirty = true; persistence = "session-only";
      if (blocked) return persistence;
      try {
        const raw = JSON.stringify(adult ? next : next.items), port = getPort();
        port.setItem(key, raw);
        if (port.getItem(key) === raw) { lastRaw = raw; sessionDirty = false; persistence = "persistent"; }
      } catch { /* The shared controller retains the complete session intent. */ }
      return persistence;
    },
  };
}
