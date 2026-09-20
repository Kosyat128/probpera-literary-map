import { useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { useAuth } from "../community/AuthContext";
import { supabase } from "../lib/supabase";
import { parseBookDossierProgress, sameBookDossierLocation, type BookDossierProgress } from "../books/bookDossierProgress";
import {
  createReadingLibraryStorage, parseReadingItems, pendingReadingKey, readingItemKey,
  readingStatusValue, remoteReadingProjection, validReadingForSync, READING_LIBRARY_ITEM_LIMIT,
  READING_LIBRARY_PENDING_LIMIT, type ReadingLibraryEnvelope, type ReadingLibraryPending,
  type ReadingLibraryPersistence, type ReadingLibraryStorage, type ReadingStatus, type RemoteReading, type SavedReading,
} from "./readingLibraryStorage";
export type { ReadingStatus, SavedReading } from "./readingLibraryStorage";
export type ReadingLibrarySyncSnapshot = Readonly<{
  status: "local" | "idle" | "syncing" | "pending";
  pendingCount: number;
  persistence: ReadingLibraryPersistence;
}>;
type ReadingInput = Omit<SavedReading, "addedAt" | "status">;
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
function remoteItems(value: unknown): SavedReading[] {
  return parseReadingItems(Array.isArray(value) ? value.map(row => row && typeof row === "object" ? {
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

/** One account and one serialized outbox shared by every mounted consumer.
 * Accepted local intent is durable before notification where storage permits it;
 * server errors never roll it back. Construction performs only local reads. */
export function createReadingLibraryController(options: {
  storage: ReadingLibraryStorage;
  remote?: ReadingLibraryRemote | null;
  queueRemote?: boolean;
  isCurrent?: () => boolean;
  isOnline?: () => boolean;
  listen?: (external: () => void, online: () => void) => () => void;
  onPersist?: () => void;
}) {
  const initial = options.storage.read(), account = options.queueRemote ?? !!options.remote;
  let envelope = initial.envelope, persistence = initial.persistence, blocked = initial.blocked ?? false;
  let lifetime = 0, revision = 0, sequence = 0, attempt = 0;
  let abort = new AbortController(), detach: (() => void) | undefined;
  let sending: Promise<void> | null = null, reading: Promise<void> | null = null;
  let requestOwner: { token: string; key: string; abort: AbortController } | null = null;
  const prefix = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const listeners = new Set<() => void>(), leases = new Set<() => boolean>();
  const current = (epoch = lifetime) => epoch === lifetime && leases.size > 0
    && (options.isCurrent?.() ?? true) && [...leases].some(lease => lease());
  const online = () => options.isOnline?.() ?? true;
  let sync: ReadingLibrarySyncSnapshot = Object.freeze({ status: account ? envelope.pending.length ? "pending" : "idle" : "local",
    pendingCount: envelope.pending.length, persistence });
  let notifiedItems = envelope.items, notifiedSync = sync;
  function notify() {
    const status: ReadingLibrarySyncSnapshot["status"] = !account ? "local"
      : sending ? "syncing" : envelope.pending.length ? "pending" : "idle";
    if (sync.status !== status || sync.pendingCount !== envelope.pending.length || sync.persistence !== persistence) {
      sync = Object.freeze({ status, pendingCount: envelope.pending.length, persistence });
    }
    if (notifiedItems === envelope.items && notifiedSync === sync) return;
    notifiedItems = envelope.items; notifiedSync = sync;
    for (const listener of [...listeners]) { try { listener(); } catch { /* Views cannot own mutations. */ } }
  }
  function publish(next: ReadingLibraryEnvelope, persist = true) {
    envelope = next; revision += 1;
    if (persist) {
      try { persistence = options.storage.write(next); } catch { persistence = "session-only"; }
    }
    notify();
    if (persist) { try { options.onPersist?.(); } catch { /* A local observer cannot undo accepted intent. */ } }
  }
  function syncExternal() {
    if (!current()) return;
    let incoming: ReturnType<ReadingLibraryStorage["read"]>;
    try { incoming = options.storage.read(); } catch { persistence = "session-only"; notify(); return; }
    const changed = JSON.stringify(incoming.envelope) !== JSON.stringify(envelope);
    persistence = incoming.persistence; blocked = incoming.blocked ?? false;
    if (!changed) { notify(); return; }
    const priorToken = requestOwner && envelope.pending.find(entry => pendingReadingKey(entry) === requestOwner!.key)?.token;
    envelope = incoming.envelope; revision += 1;
    // A newer local intent can already have replaced the in-flight token. An
    // external dossier-only edit must not abort that serialized predecessor.
    if (requestOwner && priorToken !== envelope.pending.find(entry => pendingReadingKey(entry) === requestOwner!.key)?.token) {
      requestOwner.abort.abort();
    }
    notify();
  }
  function persistAgain() {
    if (persistence !== "session-only" || !current()) return;
    try { persistence = options.storage.write(envelope); } catch { persistence = "session-only"; }
  }
  function hydrate(epoch: number, owner: AbortSignal): Promise<void> {
    if (!options.remote || blocked || !current(epoch) || !online()) return Promise.resolve();
    if (reading) return reading;
    const startedRevision = revision;
    const work = Promise.resolve().then(async () => {
      if (!current(epoch) || owner.aborted) return;
      try {
        const result = await boundedRequest(signal => options.remote!.read(signal), owner);
        if (!current(epoch) || !result || result.error !== null) return;
        syncExternal();
        if (!current(epoch) || blocked || revision !== startedRevision) return;
        const local = new Map(envelope.items.map(item => [readingItemKey(item), item]));
        const pending = new Map(envelope.pending.map(entry => [pendingReadingKey(entry), entry]));
        const merged = new Map<string, SavedReading>();
        [...envelope.items, ...remoteItems(result.data)].sort((a, b) => Date.parse(b.addedAt) - Date.parse(a.addedAt)).forEach(item => {
          const key = readingItemKey(item), intent = pending.get(key);
          if (intent?.operation === "delete" || merged.has(key)) return;
          const value = intent?.operation === "upsert" ? intent.item : item;
          merged.set(key, { ...value, dossierProgress: local.get(key)?.dossierProgress });
        });
        // Preserve every locally pending upsert even when remote history is full.
        const dirty = [...merged.values()].filter(item => pending.has(readingItemKey(item)));
        const clean = [...merged.values()].filter(item => !pending.has(readingItemKey(item)));
        publish({ ...envelope, items: [...dirty, ...clean].slice(0, READING_LIBRARY_ITEM_LIMIT) });
      } catch { /* Failed, aborted or superseded hydration leaves local intent intact. */ }
    }).finally(() => { if (reading === work) { reading = null; notify(); } });
    reading = work; notify(); return work;
  }
  function requestSync(): Promise<void> {
    if (!current()) return Promise.resolve();
    attempt += 1; persistAgain();
    if (!options.remote || !online()) { notify(); return Promise.resolve(); }
    if (sending) { notify(); return sending; }
    const epoch = lifetime, owner = abort.signal;
    const work = Promise.resolve().then(async () => {
      // Each explicit retry can try a token once. A newer token may follow an old
      // failure, but a failed token cannot reschedule itself indefinitely.
      const tried = new Map<string, number>();
      while (current(epoch) && !owner.aborted && online()) {
        syncExternal();
        if (!current(epoch)) break;
        const intent = envelope.pending.find(entry => (tried.get(entry.token) ?? -1) < attempt);
        if (!intent) break;
        const permission = attempt; tried.set(intent.token, permission);
        const operationAbort = new AbortController(), cancel = () => operationAbort.abort();
        requestOwner = { token: intent.token, key: pendingReadingKey(intent), abort: operationAbort };
        owner.addEventListener("abort", cancel, { once: true });
        let success = false;
        try {
          const result = await boundedRequest(signal => intent.operation === "delete"
            ? options.remote!.remove(intent.id, intent.kind, signal)
            : options.remote!.save(intent.item, signal), operationAbort.signal);
          success = !!result && result.error === null;
        } catch { /* Retain the outbox entry until a later bounded opportunity. */ }
        finally {
          owner.removeEventListener("abort", cancel);
          if (requestOwner?.abort === operationAbort) requestOwner = null;
        }
        if (!current(epoch) || owner.aborted) break;
        syncExternal();
        if (!current(epoch)) break;
        if (success && envelope.pending.some(entry => entry.token === intent.token)) {
          // An acknowledgement is a revision too: old reads must not resurrect
          // a removal after its tombstone has been successfully acknowledged.
          publish({ ...envelope, pending: envelope.pending.filter(entry => entry.token !== intent.token) });
        }
      }
    }).finally(() => { if (sending === work) { sending = null; notify(); } });
    sending = work; notify(); return work;
  }
  function accept(nextItems: SavedReading[], pending: ReadingLibraryPending | null): boolean {
    if (!current()) return false;
    const rest = pending ? envelope.pending.filter(entry => pendingReadingKey(entry) !== pendingReadingKey(pending)) : envelope.pending;
    if (pending && rest.length >= READING_LIBRARY_PENDING_LIMIT) return false;
    publish({ schemaVersion: 1, items: nextItems, pending: pending ? [...rest, pending] : rest });
    if (current()) void requestSync();
    return true;
  }
  const token = () => `${prefix}:${++sequence}`;
  function save(item: ReadingInput, status: ReadingStatus = "saved"): Promise<boolean> {
    if (!current()) return Promise.resolve(false);
    syncExternal(); if (!current()) return Promise.resolve(false);
    const key = readingItemKey(item), previous = envelope.items.find(entry => readingItemKey(entry) === key);
    const value: SavedReading = { ...item, addedAt: previous?.addedAt ?? new Date().toISOString(), status: readingStatusValue(status),
      dossierProgress: previous?.dossierProgress };
    if ((account ? !validReadingForSync(value) : parseReadingItems([value]).length !== 1)
      || !previous && envelope.items.length >= READING_LIBRARY_ITEM_LIMIT) return Promise.resolve(false);
    return Promise.resolve(accept([value, ...envelope.items.filter(entry => readingItemKey(entry) !== key)],
      account ? { token: token(), operation: "upsert", item: remoteReadingProjection(value) } : null));
  }
  function remove(id: string, kind: SavedReading["kind"] = "article"): Promise<boolean> {
    if (!current() || !id || id.length > (account ? 240 : 512) || kind !== "book" && kind !== "article") return Promise.resolve(false);
    syncExternal(); if (!current()) return Promise.resolve(false);
    const key = readingItemKey({ id, kind });
    return Promise.resolve(accept(envelope.items.filter(item => readingItemKey(item) !== key),
      account ? { token: token(), operation: "delete", id, kind } : null));
  }
  function setStatus(id: string, kind: SavedReading["kind"], status: ReadingStatus) {
    if (!current()) return;
    syncExternal(); if (!current()) return;
    const item = envelope.items.find(entry => entry.id === id && entry.kind === kind);
    // A full upsert also creates a row when the preceding offline save was not sent.
    if (item) void save(item, status);
  }
  return Object.freeze({
    getSnapshot: () => envelope.items,
    getSyncSnapshot: () => sync,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    activate(owns: () => boolean = () => true) {
      const lease = () => owns(); leases.add(lease);
      if (leases.size === 1) {
        const epoch = ++lifetime; abort = new AbortController();
        syncExternal();
        const cleanup = options.listen?.(syncExternal, () => { if (current(epoch)) { void requestSync(); void hydrate(epoch, abort.signal); } });
        if (current(epoch)) detach = cleanup; else cleanup?.();
        // StrictMode's discarded setup cannot start a lazy PostgREST request.
        void Promise.resolve().then(() => {
          if (!current(epoch)) return;
          void hydrate(epoch, abort.signal); void requestSync();
        });
      }
      let closed = false;
      return () => {
        if (closed) return; closed = true; leases.delete(lease);
        if (leases.size) return;
        lifetime += 1; abort.abort(); requestOwner?.abort.abort(); requestOwner = null;
        detach?.(); detach = undefined; sending = null; reading = null; notify();
      };
    },
    syncExternal,
    retrySync() {
      if (!current()) return Promise.resolve();
      syncExternal();
      const sent = requestSync(); void hydrate(lifetime, abort.signal); return sent;
    },
    save, remove, setStatus,
    toggle(item: ReadingInput) {
      if (!current()) return;
      syncExternal();
      void (envelope.items.some(entry => readingItemKey(entry) === readingItemKey(item)) ? remove(item.id, item.kind) : save(item));
    },
    setDossierProgress(id: string, input: BookDossierProgress) {
      if (!current()) return;
      syncExternal(); if (!current()) return;
      const progress = parseBookDossierProgress(input), item = envelope.items.find(entry => entry.id === id && entry.kind === "book");
      if (!progress || !item || sameBookDossierLocation(item.dossierProgress, progress)) return;
      publish({ ...envelope, items: envelope.items.map(entry => entry === item ? { ...entry, dossierProgress: progress } : entry) });
    },
  });
}

type Controller = ReturnType<typeof createReadingLibraryController>;
const sharedControllers = new WeakMap<Window, Map<string, Controller>>();
function sharedController(userId: string | null, configured: boolean): Controller {
  const areaKey = readingLibraryStorageKey(userId), client = configured && userId ? supabase : null;
  const cacheKey = `${client ? "remote" : "local"}:${areaKey}`;
  let cache = typeof window === "undefined" ? undefined : sharedControllers.get(window);
  if (typeof window !== "undefined" && !cache) { cache = new Map(); sharedControllers.set(window, cache); }
  const existing = cache?.get(cacheKey); if (existing) return existing;
  const source = {};
  const controller = createReadingLibraryController({
    storage: createReadingLibraryStorage(areaKey, !!userId), queueRemote: !!userId,
    isOnline: () => typeof navigator === "undefined" || navigator.onLine !== false,
    onPersist: () => {
      if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { storageKey: areaKey, source } }));
    },
    listen(external, online) {
      if (typeof window === "undefined") return () => undefined;
      const sync = (event: Event) => {
        const detail = (event as CustomEvent<{ storageKey?: string; source?: unknown }>).detail;
        if (detail?.storageKey === areaKey && detail.source !== source) external();
      };
      const syncStorage = (event: StorageEvent) => { if (event.key === areaKey || event.key === null) external(); };
      window.addEventListener(EVENT_NAME, sync); window.addEventListener("storage", syncStorage); window.addEventListener("online", online);
      return () => { window.removeEventListener(EVENT_NAME, sync); window.removeEventListener("storage", syncStorage); window.removeEventListener("online", online); };
    },
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
  cache?.set(cacheKey, controller); return controller;
}

export function useReadingLibrary() {
  const { configured, user } = useAuth();
  const userId = user?.id ?? null, current = useRef<Controller>();
  const controller = useMemo(() => sharedController(userId, configured), [configured, userId]);
  useLayoutEffect(() => {
    current.current = controller;
    return () => { if (current.current === controller) current.current = undefined; };
  }, [controller]);
  const items = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const sync = useSyncExternalStore(controller.subscribe, controller.getSyncSnapshot, controller.getSyncSnapshot);
  useEffect(() => controller.activate(() => current.current === controller), [controller]);
  // A stale callback from one view cannot borrow another view's live account lease.
  const actions = useMemo(() => ({
    save: (item: ReadingInput, status?: ReadingStatus) => current.current === controller ? controller.save(item, status) : Promise.resolve(false),
    remove: (id: string, kind?: SavedReading["kind"]) => current.current === controller ? controller.remove(id, kind) : Promise.resolve(false),
    toggle: (item: ReadingInput) => { if (current.current === controller) controller.toggle(item); },
    setStatus: (id: string, kind: SavedReading["kind"], status: ReadingStatus) => { if (current.current === controller) controller.setStatus(id, kind, status); },
    setDossierProgress: (id: string, progress: BookDossierProgress) => { if (current.current === controller) controller.setDossierProgress(id, progress); },
    retrySync: () => current.current === controller ? controller.retrySync() : Promise.resolve(),
  }), [controller]);
  return { items, sync, ...actions };
}
