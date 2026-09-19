import { useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { useAuth } from "../community/AuthContext";
import { supabase } from "../lib/supabase";

type ReadingKind = "article" | "book";
export type StoredReadingProgress = {
  progress: number;
  positionHint?: string;
  updatedAt: string;
  syncPending?: boolean;
};
export interface ReadingProgressRemote {
  read(signal: AbortSignal): PromiseLike<{ data: unknown; error: unknown }>;
  write(value: StoredReadingProgress, signal: AbortSignal): PromiseLike<{ error: unknown }>;
}
const STORAGE_KEY = "probpera-reading-progress";
export const READING_PROGRESS_REMOTE_DELAY_MS = 5_000;
export const READING_PROGRESS_REMOTE_TIMEOUT_MS = 10_000;
export const readingProgressStorageKey = (userId: string | null) => userId
  ? `${STORAGE_KEY}:user:${encodeURIComponent(userId)}` : STORAGE_KEY;

function parseProgress(value: unknown): StoredReadingProgress | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<StoredReadingProgress>;
  if (typeof item.progress !== "number" || !Number.isFinite(item.progress)) return null;
  return {
    progress: Math.max(0, Math.min(100, Math.round(item.progress))),
    ...(typeof item.positionHint === "string" && item.positionHint ? { positionHint: item.positionHint } : {}),
    updatedAt: typeof item.updatedAt === "string" && Number.isFinite(Date.parse(item.updatedAt))
      ? item.updatedAt : new Date(0).toISOString(),
    syncPending: item.syncPending === true,
  };
}
function readProgress(areaKey: string, itemKey: string): StoredReadingProgress | null {
  if (typeof window === "undefined") return null;
  try { return parseProgress(JSON.parse(window.localStorage.getItem(areaKey) || "{}")[itemKey]); }
  catch { return null; }
}
function writeProgress(areaKey: string, itemKey: string, progress: StoredReadingProgress) {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(areaKey) || "{}");
    const value = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    (value as Record<string, StoredReadingProgress>)[itemKey] = progress;
    window.localStorage.setItem(areaKey, JSON.stringify(value));
  } catch { /* Reading remains usable when local storage is unavailable. */ }
}
const sameProgress = (first: StoredReadingProgress | null, second: StoredReadingProgress | null) =>
  first?.progress === second?.progress && first?.positionHint === second?.positionHint
  && first?.updatedAt === second?.updatedAt && first?.syncPending === second?.syncPending;

function boundedRequest<T>(start: (signal: AbortSignal) => PromiseLike<T>, owner: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = new AbortController();
    let settled = false;
    const finish = (complete: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      owner.removeEventListener("abort", cancel);
      complete();
    };
    const cancel = () => finish(() => {
      request.abort();
      reject(new Error("Reading progress request interrupted"));
    });
    const deadline = setTimeout(cancel, READING_PROGRESS_REMOTE_TIMEOUT_MS);
    owner.addEventListener("abort", cancel, { once: true });
    if (owner.aborted) { cancel(); return; }
    try {
      Promise.resolve(start(request.signal)).then(
        value => finish(() => resolve(value)), error => finish(() => reject(error)),
      );
    } catch (error) { finish(() => reject(error)); }
  });
}

/** One item and adult identity. Failed uploads retain local intent; only a new
 * edit, reopening, or an online event can retry. No network IO during creation. */
export function createReadingProgressController(options: {
  readLocal(): StoredReadingProgress | null;
  writeLocal(value: StoredReadingProgress): void;
  remote?: ReadingProgressRemote | null;
  isCurrent?: () => boolean;
  now?: () => number;
}) {
  const readLocal = () => { try { return parseProgress(options.readLocal()); } catch { return null; } };
  let local = readLocal(), restored = local?.progress ?? null;
  let observedStorage = local;
  const store = (value: StoredReadingProgress) => {
    try { options.writeLocal(value); } catch { /* Keep session intent. */ }
    const persisted = readLocal();
    if (persisted) observedStorage = persisted;
  };
  let pending = options.remote && local?.syncPending ? local : null;
  let active = false, lifetime = 0, revision = 0, needsHydration = !!options.remote;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abort: AbortController | undefined;
  let sending: { epoch: number; promise: Promise<void> } | undefined;
  let reading: { epoch: number; promise: Promise<void> } | undefined;
  const listeners = new Set<() => void>();
  const current = (epoch: number) => active && lifetime === epoch && (options.isCurrent?.() ?? true);
  const clearTimer = () => { if (timer !== undefined) clearTimeout(timer); timer = undefined; };
  function publish(value: number | null) {
    if (restored === value) return;
    restored = value;
    for (const listener of [...listeners]) { try { listener(); } catch { /* View callbacks do not own progress. */ } }
  }
  function schedule(epoch: number) {
    if (!current(epoch) || !pending || !options.remote || timer !== undefined) return;
    timer = setTimeout(() => { timer = undefined; void flush(epoch); }, READING_PROGRESS_REMOTE_DELAY_MS);
  }
  function flush(epoch = lifetime): Promise<void> {
    if (!current(epoch) || !pending || !options.remote || !abort) return Promise.resolve();
    if (sending?.epoch === epoch) return sending.promise;
    clearTimer();
    let value = pending;
    const signal = abort.signal;
    const operation = { epoch, promise: Promise.resolve() };
    operation.promise = Promise.resolve().then(async () => {
      if (!current(epoch)) return;
      try {
        const persisted = readLocal();
        // A later edit in another reader owns this scope, including a reset to
        // zero. An unchanged/older fallback after failed storage must not erase
        // the session's unpersisted intent.
        if (persisted && !sameProgress(persisted, observedStorage)
          && (observedStorage || Date.parse(persisted.updatedAt) >= Date.parse(value.updatedAt))) {
          observedStorage = local = persisted;
          pending = persisted.syncPending ? persisted : null;
          revision += 1;
        }
        if (!pending) return;
        value = pending;
        const response = await boundedRequest(requestSignal => options.remote!.write(value, requestSignal), signal);
        if (!current(epoch) || !response || response.error !== null || pending !== value) return;
        pending = null;
        local = { ...value, syncPending: false };
        // Another reader/tab may already hold a newer intent in this scope.
        if (sameProgress(readLocal(), value)) store(local);
      } catch { /* Keep the dirty value for an explicit later retry. */ }
    }).finally(() => {
      if (sending === operation) sending = undefined;
      // New edits arriving during a request get one turn; failed identical
      // writes never schedule themselves indefinitely.
      if (current(epoch) && pending && pending !== value) schedule(epoch);
    });
    sending = operation;
    return operation.promise;
  }
  function hydrate(epoch = lifetime): Promise<void> {
    if (!current(epoch) || !needsHydration || !options.remote || !abort) return Promise.resolve();
    if (reading?.epoch === epoch) return reading.promise;
    const startedRevision = revision, initial = local, signal = abort.signal;
    const operation = { epoch, promise: Promise.resolve() };
    operation.promise = Promise.resolve().then(async () => {
      if (!current(epoch)) return;
      try {
        const response = await boundedRequest(requestSignal => options.remote!.read(requestSignal), signal);
        if (!current(epoch) || !response || response.error !== null) return;
        needsHydration = false;
        if (revision !== startedRevision || pending || !sameProgress(readLocal(), initial)) return;
        if (!response.data || typeof response.data !== "object") return;
        const row = response.data as Record<string, unknown>;
        if (typeof row.updated_at !== "string" || !Number.isFinite(Date.parse(row.updated_at))) return;
        const remote = parseProgress({ progress: row.progress_percent, positionHint: row.position_hint, updatedAt: row.updated_at });
        if (!remote || (local && Date.parse(local.updatedAt) > Date.parse(remote.updatedAt))) return;
        local = remote;
        store(remote); // Preserve the server timestamp; reading is not a local edit.
        publish(remote.progress);
      } catch { /* A later online event can retry this read. */ }
    }).finally(() => { if (reading === operation) reading = undefined; });
    reading = operation;
    return operation.promise;
  }
  function saveProgress(rawProgress: number, positionHint?: string) {
    if (!current(lifetime) || !Number.isFinite(rawProgress)) return;
    revision += 1;
    local = { progress: Math.max(0, Math.min(100, Math.round(rawProgress))),
      ...(positionHint ? { positionHint } : {}), updatedAt: new Date((options.now ?? Date.now)()).toISOString(),
      syncPending: !!options.remote };
    store(local);
    pending = options.remote ? local : null;
    schedule(lifetime);
  }
  return Object.freeze({
    getSnapshot: () => restored,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    activate() {
      active = true;
      const epoch = ++lifetime;
      abort = new AbortController();
      void hydrate(epoch);
      schedule(epoch);
      return () => {
        if (!active || lifetime !== epoch) return;
        active = false; lifetime += 1;
        clearTimer(); abort?.abort(); abort = undefined;
        // Do not start an upload from cleanup after user/item ownership changed.
        // Persisted dirty progress is retried when this scope is opened again.
      };
    },
    retry() { return pending ? flush() : hydrate(); },
    saveProgress,
    markCompleted(positionHint?: string) {
      if (!current(lifetime)) return;
      saveProgress(100, positionHint);
      publish(100);
    },
  });
}

export function useReadingProgress(kind: ReadingKind, id: string) {
  const { configured, user } = useAuth();
  const userId = user?.id ?? null;
  const current = useRef<ReturnType<typeof createReadingProgressController>>();
  const controller = useMemo(() => {
    const areaKey = readingProgressStorageKey(userId), itemKey = `${kind}:${id}`;
    const client = configured && userId ? supabase : null;
    const next = createReadingProgressController({
      readLocal: () => readProgress(areaKey, itemKey),
      writeLocal: value => writeProgress(areaKey, itemKey, value),
      isCurrent: () => current.current === next,
      remote: client && userId ? {
        read: signal => client.from("reader_progress").select("progress_percent,position_hint,updated_at")
          .eq("user_id", userId).eq("item_type", kind).eq("item_id", id).abortSignal(signal).maybeSingle(),
        write: (value, signal) => client.from("reader_progress").upsert({
          user_id: userId, item_type: kind, item_id: id, progress_percent: value.progress,
          position_hint: value.positionHint || null, completed_at: value.progress >= 96 ? value.updatedAt : null,
          updated_at: value.updatedAt,
        }, { onConflict: "user_id,item_type,item_id" }).abortSignal(signal),
      } : null,
    });
    return next;
  }, [configured, userId, kind, id]);
  useLayoutEffect(() => {
    current.current = controller;
    return () => { if (current.current === controller) current.current = undefined; };
  }, [controller]);
  const restoredProgress = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => {
    const deactivate = controller.activate();
    const online = () => { void controller.retry(); };
    window.addEventListener("online", online);
    return () => { window.removeEventListener("online", online); deactivate(); };
  }, [controller]);
  return { restoredProgress, saveProgress: controller.saveProgress, markCompleted: controller.markCompleted };
}
