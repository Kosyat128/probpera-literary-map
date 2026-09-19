import { useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { useAuth } from "../community/AuthContext";
import { supabase } from "../lib/supabase";
import { readWebStorage, writeWebStorage } from "../utils/safeWebStorage";
import { parseBookDossierProgress, sameBookDossierLocation, type BookDossierProgress } from "../books/bookDossierProgress";

export type SavedReading = {
  id: string; kind: "article" | "book"; title: string; sectionId?: string;
  sectionLabel: string; href?: string; addedAt: string; status: ReadingStatus;
  /** Private device progress; never added to remote payloads, public links or analytics. */
  dossierProgress?: BookDossierProgress;
};
export type ReadingStatus = "saved" | "reading" | "finished";
type ReadingInput = Omit<SavedReading, "addedAt" | "status">;
type RemoteReading = Omit<SavedReading, "dossierProgress">;
export interface ReadingLibraryRemote {
  read(signal: AbortSignal): PromiseLike<{ data: unknown; error: unknown }>;
  save(item: RemoteReading, signal: AbortSignal): PromiseLike<{ error: unknown }>;
  remove(id: string, kind: SavedReading["kind"], signal: AbortSignal): PromiseLike<{ error: unknown }>;
  setStatus(id: string, kind: SavedReading["kind"], status: ReadingStatus, signal: AbortSignal): PromiseLike<{ error: unknown }>;
}
const STORAGE_KEY = "probpera-reading-library";
const EVENT_NAME = "probpera:reading-library";
export const READING_LIBRARY_REMOTE_TIMEOUT_MS = 10_000;
export const readingLibraryStorageKey = (userId: string | null) => userId
  ? `${STORAGE_KEY}:user:${encodeURIComponent(userId)}` : STORAGE_KEY;
const itemKey = (item: Pick<SavedReading, "id" | "kind">) => `${item.kind}:${item.id}`;
const statusValue = (value: unknown): ReadingStatus => value === "reading" || value === "finished" ? value : "saved";
const remoteProjection = (item: SavedReading): RemoteReading => {
  const { dossierProgress: _privateProgress, ...value } = item;
  return value;
};

function parseItems(value: unknown): SavedReading[] {
  if (!Array.isArray(value)) return [];
  const parsed = new Map<string, SavedReading>();
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || typeof entry.id !== "string" || !entry.id
      || typeof entry.title !== "string" || !entry.title || typeof entry.addedAt !== "string" || !Number.isFinite(Date.parse(entry.addedAt))) continue;
    const item: SavedReading = { id: entry.id, kind: entry.kind === "book" ? "book" : "article", title: entry.title,
      sectionId: typeof entry.sectionId === "string" ? entry.sectionId : undefined,
      sectionLabel: typeof entry.sectionLabel === "string" ? entry.sectionLabel : "",
      href: typeof entry.href === "string" ? entry.href : undefined, addedAt: entry.addedAt, status: statusValue(entry.status),
      dossierProgress: entry.kind === "book" ? parseBookDossierProgress(entry.dossierProgress) : undefined };
    if (!parsed.has(itemKey(item))) parsed.set(itemKey(item), item);
    if (parsed.size >= 200) break;
  }
  return [...parsed.values()];
}
function readItems(areaKey: string): SavedReading[] {
  if (typeof window === "undefined") return [];
  try { return parseItems(JSON.parse(readWebStorage("local", areaKey) || "[]")); }
  catch { return []; }
}
function remoteItems(value: unknown): SavedReading[] {
  return parseItems(Array.isArray(value) ? value.map(row => row && typeof row === "object" ? {
    id: row.item_id, kind: row.item_type, title: row.title, sectionId: row.section_id,
    sectionLabel: row.section_label, href: row.href, addedAt: row.added_at, status: row.reading_status,
  } : null) : []);
}
function boundedRequest<T>(start: (signal: AbortSignal) => PromiseLike<T>, owner: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = new AbortController(); let settled = false;
    const finish = (complete: () => void) => {
      if (settled) return; settled = true; clearTimeout(deadline); owner.removeEventListener("abort", cancel); complete();
    };
    const cancel = () => finish(() => { request.abort(); reject(new Error("Reading library request interrupted")); });
    const deadline = setTimeout(cancel, READING_LIBRARY_REMOTE_TIMEOUT_MS);
    owner.addEventListener("abort", cancel, { once: true });
    if (owner.aborted) { cancel(); return; }
    try { Promise.resolve(start(request.signal)).then(value => finish(() => resolve(value)), error => finish(() => reject(error))); }
    catch (error) { finish(() => reject(error)); }
  });
}

/** One adult identity. Construction reads local data only; hydration never uploads
 * or attributes guest items. Remote writes are awaited outside React updaters. */
export function createReadingLibraryController(options: {
  readLocal(): SavedReading[];
  writeLocal(items: SavedReading[]): void;
  remote?: ReadingLibraryRemote | null;
  isCurrent?: () => boolean;
}) {
  const readLocal = () => { try { return parseItems(options.readLocal()); } catch { return []; } };
  let items = readLocal(), active = false, lifetime = 0, revision = 0, sequence = 0;
  let abort = new AbortController();
  const listeners = new Set<() => void>(), latest = new Map<string, number>(), tails = new Map<string, Promise<void>>();
  const externalRevisions = new Map<string, number>(), activeWrites = new Map<string, AbortController>();
  const current = (epoch = lifetime) => active && epoch === lifetime && (options.isCurrent?.() ?? true);
  function notify() { for (const listener of [...listeners]) { try { listener(); } catch { /* Views cannot own mutations. */ } } }
  function publish(next: SavedReading[], persist = true) {
    items = next;
    if (persist) { try { options.writeLocal(next); } catch { /* Keep local session intent if persistence is unavailable. */ } }
    notify();
  }
  async function hydrate(epoch: number, owner: AbortSignal) {
    const startedRevision = revision;
    if (!options.remote || !current(epoch)) return;
    try {
      const result = await boundedRequest(signal => options.remote!.read(signal), owner);
      if (!current(epoch) || revision !== startedRevision || !result || result.error !== null) return;
      const local = new Map(items.map(item => [itemKey(item), item]));
      const merged = new Map<string, SavedReading>();
      [...items, ...remoteItems(result.data)].sort((a, b) => Date.parse(b.addedAt) - Date.parse(a.addedAt)).forEach(item => {
        const key = itemKey(item);
        if (!merged.has(key)) merged.set(key, { ...item, dossierProgress: local.get(key)?.dossierProgress });
      });
      publish([...merged.values()].slice(0, 200));
    } catch { /* Failed or superseded hydration leaves local items intact. */ }
  }
  function mutate(key: string, next: SavedReading[], send: (signal: AbortSignal) => PromiseLike<{ error: unknown }>): Promise<boolean> {
    if (!current()) return Promise.resolve(false);
    const epoch = lifetime, owner = abort.signal, external = externalRevisions.get(key) ?? 0, token = ++sequence, previous = items.find(item => itemKey(item) === key);
    latest.set(key, token); revision += 1;
    // Reserve the queue before notifying reentrant consumers.
    const before = tails.get(key) ?? Promise.resolve();
    const result = before.then(async () => {
      if (!current(epoch) || owner.aborted || (externalRevisions.get(key) ?? 0) !== external) return false;
      if (!options.remote) return true;
      const requestOwner = new AbortController(), cancel = () => requestOwner.abort();
      activeWrites.set(key, requestOwner); owner.addEventListener("abort", cancel, { once: true });
      let success = false;
      try { const response = await boundedRequest(send, requestOwner.signal); success = !!response && response.error === null; }
      catch { /* Only the current mutation may undo its optimistic item. */ }
      finally { owner.removeEventListener("abort", cancel); if (activeWrites.get(key) === requestOwner) activeWrites.delete(key); }
      if (!success && current(epoch) && latest.get(key) === token) {
        const present = items.find(item => itemKey(item) === key), rest = items.filter(item => itemKey(item) !== key);
        revision += 1;
        const restored = previous ? { ...previous, dossierProgress: present ? present.dossierProgress : previous.dossierProgress } : null;
        publish(restored ? [restored, ...rest].slice(0, 200) : rest);
      }
      return success && current(epoch) && (externalRevisions.get(key) ?? 0) === external;
    });
    // A timed-out request releases the client queue. An unabortable server write
    // may still settle later; this is not a distributed ordering guarantee.
    const tail = result.then(() => undefined, () => undefined); tails.set(key, tail);
    void tail.then(() => { if (tails.get(key) === tail) tails.delete(key); });
    publish(next);
    return result;
  }
  function save(item: ReadingInput, status: ReadingStatus = "saved") {
    const key = itemKey(item), previous = items.find(entry => itemKey(entry) === key);
    const value: SavedReading = { ...item, addedAt: previous?.addedAt ?? new Date().toISOString(), status: statusValue(status),
      dossierProgress: previous?.dossierProgress };
    const remoteValue = remoteProjection(value);
    return mutate(key, [value, ...items.filter(entry => itemKey(entry) !== key)].slice(0, 200), signal => options.remote!.save(remoteValue, signal));
  }
  function remove(id: string, kind: SavedReading["kind"] = "article") {
    if (!current()) return Promise.resolve(false);
    const key = itemKey({ id, kind });
    if (!items.some(entry => itemKey(entry) === key)) { revision += 1; return Promise.resolve(true); }
    return mutate(key, items.filter(entry => itemKey(entry) !== key), signal => options.remote!.remove(id, kind, signal));
  }
  function setStatus(id: string, kind: SavedReading["kind"], status: ReadingStatus) {
    const key = itemKey({ id, kind });
    if (!items.some(entry => itemKey(entry) === key)) return;
    void mutate(key, items.map(entry => itemKey(entry) === key ? { ...entry, status: statusValue(status) } : entry),
      signal => options.remote!.setStatus(id, kind, statusValue(status), signal)).catch(() => undefined);
  }
  return Object.freeze({
    getSnapshot: () => items,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    activate() {
      active = true; const epoch = ++lifetime; abort = new AbortController();
      void hydrate(epoch, abort.signal);
      return () => { if (!active || lifetime !== epoch) return; active = false; lifetime += 1; abort.abort(); };
    },
    syncExternal() {
      if (!current()) return;
      const incoming = readLocal(), normalized = parseItems(items);
      if (JSON.stringify(incoming) === JSON.stringify(normalized)) return;
      // Dossier locations are local-only. Another reader advancing the same
      // book's page must not cancel an unrelated favorites/status request.
      const before = new Map(normalized.map(item => [itemKey(item), JSON.stringify(remoteProjection(item))]));
      const after = new Map(incoming.map(item => [itemKey(item), JSON.stringify(remoteProjection(item))]));
      revision += 1;
      for (const key of new Set([...before.keys(), ...after.keys()])) if (before.get(key) !== after.get(key)) {
        externalRevisions.set(key, (externalRevisions.get(key) ?? 0) + 1);
        latest.delete(key); activeWrites.get(key)?.abort();
      }
      publish(incoming, false);
    },
    save, remove, setStatus,
    toggle(item: ReadingInput) {
      const operation = items.some(entry => itemKey(entry) === itemKey(item)) ? remove(item.id, item.kind) : save(item);
      void operation.catch(() => undefined);
    },
    setDossierProgress(id: string, input: BookDossierProgress) {
      if (!current()) return;
      const progress = parseBookDossierProgress(input), item = items.find(entry => entry.id === id && entry.kind === "book");
      if (!progress || !item || sameBookDossierLocation(item.dossierProgress, progress)) return;
      revision += 1; publish(items.map(entry => entry === item ? { ...entry, dossierProgress: progress } : entry));
    },
  });
}

export function useReadingLibrary() {
  const { configured, user } = useAuth();
  const userId = user?.id ?? null, areaKey = readingLibraryStorageKey(userId);
  const current = useRef<ReturnType<typeof createReadingLibraryController>>();
  const source = useMemo(() => ({}), [configured, userId]);
  const controller = useMemo(() => {
    const client = configured && userId ? supabase : null;
    const next = createReadingLibraryController({
      readLocal: () => readItems(areaKey),
      writeLocal: items => {
        writeWebStorage("local", areaKey, JSON.stringify(items));
        window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { storageKey: areaKey, source } }));
      },
      isCurrent: () => current.current === next,
      remote: client && userId ? {
        read: signal => client.from("reader_favorites").select("item_type,item_id,title,section_id,section_label,href,added_at,reading_status")
          .eq("user_id", userId).order("added_at", { ascending: false }).abortSignal(signal),
        save: (item, signal) => client.from("reader_favorites").upsert({ user_id: userId, item_type: item.kind, item_id: item.id,
          title: item.title, section_id: item.sectionId || null, section_label: item.sectionLabel, href: item.href || null,
          added_at: item.addedAt, reading_status: item.status }, { onConflict: "user_id,item_type,item_id" }).abortSignal(signal),
        remove: (id, kind, signal) => client.from("reader_favorites").delete().eq("user_id", userId).eq("item_type", kind).eq("item_id", id).abortSignal(signal),
        setStatus: (id, kind, status, signal) => client.from("reader_favorites").update({ reading_status: status })
          .eq("user_id", userId).eq("item_type", kind).eq("item_id", id).abortSignal(signal),
      } : null,
    });
    return next;
  }, [configured, userId, areaKey, source]);
  useLayoutEffect(() => {
    current.current = controller;
    return () => { if (current.current === controller) current.current = undefined; };
  }, [controller]);
  const items = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => {
    const deactivate = controller.activate();
    const sync = (event: Event) => {
      const detail = (event as CustomEvent<{ storageKey?: string; source?: unknown }>).detail;
      if (detail?.storageKey === areaKey && detail.source !== source) controller.syncExternal();
    };
    const syncStorage = (event: StorageEvent) => { if (event.key === areaKey || event.key === null) controller.syncExternal(); };
    window.addEventListener(EVENT_NAME, sync); window.addEventListener("storage", syncStorage);
    return () => { window.removeEventListener(EVENT_NAME, sync); window.removeEventListener("storage", syncStorage); deactivate(); };
  }, [controller, areaKey, source]);
  return { items, toggle: controller.toggle, save: controller.save, remove: controller.remove,
    setStatus: controller.setStatus, setDossierProgress: controller.setDossierProgress };
}
