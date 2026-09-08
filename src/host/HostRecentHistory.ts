import { RECENT_HISTORY_LIMIT, recentEntryKey, type RecentEntry, type RecentHistorySnapshot, type RecentHistoryStore, type RecentTarget } from "../planet/RecentHistory";
import type { HostPreferenceBridge } from "./HostPlatformServices";

// Adult native history only. A future child profile must use a separate store.
export const HOST_RECENT_HISTORY_KEY = "probpera-planet-recent-adult-v1";
const MAX_BYTES = 32 * 1024;
type StorageStatus = "loading" | "ready" | "saving" | "error";
export interface HostRecentHistoryStore extends RecentHistoryStore {
  retry(): Promise<void>;
  dispose(): void;
}
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const exact = (value: Record<string, unknown>, keys: readonly string[]) => Object.keys(value).length === keys.length && keys.every(key => Object.prototype.hasOwnProperty.call(value, key));
const id = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/u.test(value) && !["__proto__", "constructor", "prototype"].includes(value);

function target(value: unknown): RecentTarget | null {
  if (!object(value) || !id(value.countryId) || !id(value.writerId)) return null;
  if (value.kind === "writer" && exact(value, ["kind", "countryId", "writerId"])) {
    return { kind: "writer", countryId: value.countryId, writerId: value.writerId };
  }
  if (value.kind === "work" && exact(value, ["kind", "countryId", "writerId", "workId"]) && id(value.workId)) {
    return { kind: "work", countryId: value.countryId, writerId: value.writerId, workId: value.workId };
  }
  return null;
}

function decode(source: string | null): readonly RecentEntry[] {
  if (source === null) return Object.freeze([]);
  if (source.length > MAX_BYTES || new TextEncoder().encode(source).byteLength > MAX_BYTES) throw new Error("Invalid recent history");
  const value: unknown = JSON.parse(source);
  if (!object(value) || !exact(value, ["v", "entries"]) || value.v !== 1 || !Array.isArray(value.entries) || value.entries.length > RECENT_HISTORY_LIMIT) throw new Error("Invalid recent history");
  const entries: RecentEntry[] = [];
  const seen = new Set<string>();
  for (const candidate of value.entries) {
    if (!object(candidate) || !Number.isSafeInteger(candidate.openedAt) || Number(candidate.openedAt) < 0) throw new Error("Invalid recent entry");
    const { openedAt, ...rest } = candidate;
    const item = target(rest);
    if (!item || seen.has(recentEntryKey(item))) throw new Error("Invalid recent entry");
    seen.add(recentEntryKey(item));
    entries.push(Object.freeze({ ...item, openedAt: Number(openedAt) }));
  }
  return Object.freeze(entries);
}

/** Lazy native preference controller. Session entries remain authoritative while
 * a serialized SDK operation is pending; timeouts never release its write order. */
export function createHostRecentHistory(
  bridge: HostPreferenceBridge | undefined,
  options: { now?: () => number; timeoutMs?: number } = {}
): HostRecentHistoryStore {
  const now = options.now ?? Date.now;
  const timeoutMs = options.timeoutMs ?? 5_000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 2_147_483_647) throw new RangeError("Invalid history confirmation timeout");
  let entries: readonly RecentEntry[] = Object.freeze([]);
  let snapshot: RecentHistorySnapshot = Object.freeze({ available: true, loaded: false, entries, storageStatus: "loading" });
  let started = false;
  let disposed = false;
  let running = false;
  let phase: "unread" | "reading" | "ready" | "failed" = "unread";
  let dirty = false;
  let cleared = false;
  let revision = 0;
  let requested = 0;
  let processed = 0;
  const listeners = new Map<() => void, number>();
  let confirmation: {
    revision: number;
    promise: Promise<void>;
    resolve: () => void;
    timer: ReturnType<typeof setTimeout>;
  } | null = null;

  function updateEntries(next: readonly RecentEntry[]) {
    if (entries.length === next.length && entries.every((entry, index) => recentEntryKey(entry) === recentEntryKey(next[index]) && entry.openedAt === next[index].openedAt)) return;
    entries = Object.freeze([...next]);
  }
  function publish(status: StorageStatus, loaded: boolean) {
    if (disposed || (snapshot.entries === entries && snapshot.loaded === loaded && snapshot.storageStatus === status)) return;
    snapshot = Object.freeze({ available: true, loaded, entries, storageStatus: status });
    for (const listener of [...listeners.keys()]) {
      if (disposed) break;
      if (!listeners.has(listener)) continue;
      try { listener(); } catch { /* Isolate view subscribers. */ }
    }
  }
  function settleConfirmation(expected?: number) {
    if (!confirmation || (expected !== undefined && confirmation.revision !== expected)) return;
    const pending = confirmation;
    confirmation = null;
    clearTimeout(pending.timer);
    pending.resolve();
  }
  function finish(expected: number, status: "ready" | "error") {
    if (disposed || expected !== revision) return;
    publish(status, true);
    settleConfirmation(expected);
  }
  function begin(status: "loading" | "saving"): Promise<void> {
    settleConfirmation();
    const expected = revision;
    let resolve!: () => void;
    const promise = new Promise<void>(done => { resolve = done; });
    const timer = setTimeout(() => finish(expected, "error"), timeoutMs);
    confirmation = { revision: expected, promise, resolve, timer };
    publish(status, status === "saving" || snapshot.loaded);
    return promise;
  }
  async function readValue(): Promise<string | null> {
    if (!bridge || disposed) throw new Error("Recent storage unavailable");
    const response: unknown = await bridge.get({ key: HOST_RECENT_HISTORY_KEY });
    if (!object(response) || !exact(response, ["value"]) || (response.value !== null && typeof response.value !== "string")) throw new Error("Invalid recent storage response");
    return response.value;
  }
  function mergeLoaded(stored: readonly RecentEntry[]) {
    if (cleared) return;
    const keys = new Set(entries.map(recentEntryKey));
    updateEntries([...entries, ...stored.filter(entry => !keys.has(recentEntryKey(entry)))].slice(0, RECENT_HISTORY_LIMIT));
  }
  async function pump() {
    try {
      if (!bridge) {
        phase = "failed";
        processed = requested;
        finish(revision, "error");
        return;
      }
      if (phase === "unread") {
        phase = "reading";
        try {
          const stored = decode(await readValue());
          if (disposed) return;
          mergeLoaded(stored);
          phase = "ready";
        } catch {
          if (disposed) return;
          phase = cleared ? "ready" : "failed";
        }
      }
      if (phase === "failed") {
        processed = requested;
        finish(revision, "error");
        return;
      }
      while (!disposed) {
        processed = requested;
        if (!dirty) { finish(revision, "ready"); return; }
        const writing = revision;
        const source = JSON.stringify({ v: 1, entries });
        try {
          await bridge.set({ key: HOST_RECENT_HISTORY_KEY, value: source });
          if (disposed) return;
          // An obsolete write is awaited, then replaced by the newest intent.
          if (writing !== revision) continue;
          const readback = await readValue();
          if (disposed) return;
          if (writing !== revision) continue;
          if (readback !== source) { finish(writing, "error"); return; }
          dirty = false;
          finish(writing, "ready");
        } catch {
          if (disposed) return;
          if (writing !== revision) continue;
          finish(writing, "error");
        }
        return;
      }
    } finally {
      running = false;
      // A subscriber may issue a new action while receiving the final snapshot.
      if (!disposed && requested !== processed) schedule();
    }
  }
  function schedule() {
    if (disposed || running) return;
    running = true;
    void Promise.resolve().then(() => {
      if (!disposed) return pump();
      running = false;
    }).catch(() => {
      running = false;
      processed = requested;
      finish(revision, "error");
    });
  }
  function request(status: "loading" | "saving") {
    started = true;
    requested += 1;
    const pending = begin(status);
    schedule();
    return pending;
  }

  return Object.freeze({
    persistence: "best-effort" as const,
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      if (disposed) return () => undefined;
      listeners.set(listener, (listeners.get(listener) ?? 0) + 1);
      if (!started) void request("loading");
      let subscribed = true;
      return () => {
        if (!subscribed) return;
        subscribed = false;
        const count = listeners.get(listener) ?? 0;
        if (count > 1) listeners.set(listener, count - 1);
        else listeners.delete(listener);
      };
    },
    record(value: RecentTarget) {
      if (disposed) return Promise.resolve();
      const item = target(value);
      if (!item) return Promise.resolve();
      let openedAt: number;
      try { openedAt = now(); } catch { return Promise.resolve(); }
      if (!Number.isSafeInteger(openedAt) || openedAt < 0) return Promise.resolve();
      const key = recentEntryKey(item);
      if (entries[0] && recentEntryKey(entries[0]) === key) return confirmation?.promise ?? Promise.resolve();
      revision += 1;
      dirty = true;
      updateEntries([Object.freeze({ ...item, openedAt }), ...entries.filter(entry => recentEntryKey(entry) !== key)].slice(0, RECENT_HISTORY_LIMIT));
      return request("saving");
    },
    clear() {
      if (disposed) return Promise.resolve();
      revision += 1;
      cleared = true;
      dirty = true;
      // An authoritative clear needs no old value, but still awaits pending I/O.
      if (phase === "unread" || phase === "failed") phase = "ready";
      updateEntries([]);
      return request("saving");
    },
    retry() {
      if (disposed || (started && snapshot.storageStatus === "ready")) return Promise.resolve();
      revision += 1;
      if (phase === "failed") phase = "unread";
      return request(dirty ? "saving" : "loading");
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      settleConfirmation();
      listeners.clear();
    },
  });
}
