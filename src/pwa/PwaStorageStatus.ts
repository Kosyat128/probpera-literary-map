export type PwaStorageStatusSnapshot = Readonly<{
  busy: "estimate" | "persist" | null;
  usage: number | null;
  quota: number | null;
  persisted: boolean | null;
  canPersist: boolean;
  denied: boolean;
  error: boolean;
}>;
export interface PwaStorageStatusController {
  getSnapshot(): PwaStorageStatusSnapshot;
  subscribe(listener: () => void): () => void;
  activate(): () => void;
  refresh(): Promise<void>;
  /** Invoke in the user's click handler. Never scheduled or called on activation. */
  requestPersistence(): Promise<void>;
}
export const PWA_STORAGE_STATUS_TIMEOUT_MS = 8_000;
type StorageMethod = (this: object) => unknown;
type Capabilities = {
  owner: object | null;
  estimate: StorageMethod | null;
  persisted: StorageMethod | null;
  persist: StorageMethod | null;
  error: boolean;
};
type Operation = {
  kind: "estimate" | "persist";
  promise: Promise<void>;
  finish(next?: PwaStorageStatusSnapshot): void;
};
const initialStorage: PwaStorageStatusSnapshot = Object.freeze({
  busy: "estimate", usage: null, quota: null, persisted: null, canPersist: false, denied: false, error: false,
});
const validBytes = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;

/** A browser StorageManager request cannot be cancelled. Bound the UI wait and
 * retain rejection handlers, then fence late browser replies by operation identity.
 * Construction performs no browser reads, listener setup or permission requests. */
export function createPwaStorageStatus(options: {
  getStorage?: () => unknown;
  timeoutMs?: number;
} = {}): PwaStorageStatusController {
  const timeoutMs = options.timeoutMs ?? PWA_STORAGE_STATUS_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000) throw new RangeError("Storage timeout must be 1-60000 ms");
  const getStorage = options.getStorage ?? (() => globalThis.navigator?.storage);
  const subscribers = new Map<() => void, number>(), leases = new Set<object>();
  let snapshot = initialStorage, pending: Operation | null = null, lifetime = 0, sequence = 0;
  const current = (operation: Operation) => leases.size > 0 && pending === operation;
  function publish(next: PwaStorageStatusSnapshot) {
    if (snapshot.busy === next.busy && snapshot.usage === next.usage && snapshot.quota === next.quota
      && snapshot.persisted === next.persisted && snapshot.canPersist === next.canPersist
      && snapshot.denied === next.denied && snapshot.error === next.error) return;
    snapshot = Object.freeze(next);
    for (const listener of [...subscribers.keys()]) { try { listener(); } catch { /* Views cannot interrupt cleanup. */ } }
  }
  function capabilities(persistOnly = false): Capabilities {
    const result: Capabilities = { owner: null, estimate: null, persisted: null, persist: null, error: false };
    try {
      const owner = getStorage();
      if (owner === undefined || owner === null) return result;
      if (typeof owner !== "object") { result.error = true; return result; }
      result.owner = owner;
      const keys = persistOnly ? ["persist"] as const : ["estimate", "persisted", "persist"] as const;
      for (const key of keys) {
        try {
          const method: unknown = Reflect.get(owner, key);
          if (typeof method === "function") result[key] = method as StorageMethod;
          else if (method !== undefined && method !== null) result.error = true;
        } catch { result.error = true; }
      }
    } catch { result.error = true; }
    return result;
  }
  function begin(kind: Operation["kind"], timedOut: () => PwaStorageStatusSnapshot): Operation {
    pending?.finish(); sequence += 1;
    let resolve!: () => void;
    const promise = new Promise<void>(done => { resolve = done; });
    const operation: Operation = {
      kind, promise,
      finish(next) {
        if (pending !== operation) return;
        pending = null; clearTimeout(timer);
        // Settle before notifying: a reentrant refresh owns its own operation.
        resolve();
        if (next && leases.size) publish(next);
      },
    };
    pending = operation;
    const timer = setTimeout(() => operation.finish(timedOut()), timeoutMs);
    return operation;
  }
  function refresh(): Promise<void> {
    if (!leases.size) return Promise.resolve();
    let value: PwaStorageStatusSnapshot = { ...initialStorage, busy: null };
    const operation = begin("estimate", () => ({ ...value, error: true }));
    const storage = capabilities();
    value = { ...value, canPersist: !!storage.persist, error: storage.error };
    if (!current(operation)) return operation.promise;
    publish({ ...value, busy: "estimate" });
    let remaining = 2;
    const complete = () => { remaining -= 1; if (!remaining && current(operation)) operation.finish(value); };
    const observe = (method: StorageMethod | null, accept: (result: unknown) => void) => {
      if (!current(operation)) return;
      if (!method || !storage.owner) { complete(); return; }
      try {
        const returned = method.call(storage.owner);
        void Promise.resolve(returned).then(result => {
          if (!current(operation)) return;
          try { accept(result); } catch { value = { ...value, error: true }; }
          complete();
        }, () => {
          if (!current(operation)) return;
          value = { ...value, error: true }; complete();
        });
      } catch { if (current(operation)) { value = { ...value, error: true }; complete(); } }
    };
    observe(storage.estimate, result => {
      if (!result || typeof result !== "object" || Array.isArray(result)) { value = { ...value, error: true }; return; }
      // Accessors are guarded too: a fulfilled malformed result is not success.
      const rawUsage: unknown = Reflect.get(result, "usage"), rawQuota: unknown = Reflect.get(result, "quota");
      const usage = validBytes(rawUsage), quota = validBytes(rawQuota);
      value = { ...value, usage, quota,
        error: value.error || rawUsage !== undefined && usage === null || rawQuota !== undefined && quota === null };
    });
    observe(storage.persisted, result => {
      value = typeof result === "boolean" ? { ...value, persisted: result } : { ...value, error: true };
    });
    return operation.promise;
  }
  function requestPersistence(): Promise<void> {
    if (!leases.size) return Promise.resolve();
    if (pending?.kind === "persist") return pending.promise;
    let value: PwaStorageStatusSnapshot = { ...snapshot, busy: null, persisted: null, denied: false, error: false };
    const operation = begin("persist", () => ({ ...value, error: true }));
    const storage = capabilities(true);
    value = { ...value, canPersist: !!storage.persist, error: storage.error };
    if (!current(operation)) return operation.promise;
    if (!storage.persist || !storage.owner) { operation.finish(value); return operation.promise; }
    publish({ ...value, busy: "persist" });
    if (!current(operation)) return operation.promise;
    try {
      // Deliberately before any await/microtask: retain the explicit user gesture.
      const returned = storage.persist.call(storage.owner);
      void Promise.resolve(returned).then(result => {
        if (!current(operation)) return;
        operation.finish(typeof result === "boolean"
          ? { ...value, persisted: result, denied: result === false }
          : { ...value, error: true });
      }, () => { if (current(operation)) operation.finish({ ...value, error: true }); });
    } catch { if (current(operation)) operation.finish({ ...value, error: true }); }
    return operation.promise;
  }
  return Object.freeze({
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      subscribers.set(listener, (subscribers.get(listener) ?? 0) + 1);
      let subscribed = true;
      return () => {
        if (!subscribed) return; subscribed = false;
        const count = subscribers.get(listener) ?? 0;
        if (count <= 1) subscribers.delete(listener); else subscribers.set(listener, count - 1);
      };
    },
    activate() {
      const lease = {}; leases.add(lease);
      if (leases.size === 1) {
        const epoch = ++lifetime, before = sequence;
        void Promise.resolve().then(() => {
          if (leases.size && lifetime === epoch && sequence === before) void refresh();
        });
      }
      let active = true;
      return () => {
        if (!active) return; active = false; leases.delete(lease);
        if (leases.size) return;
        lifetime += 1; pending?.finish(); publish({ ...snapshot, busy: null });
      };
    },
    refresh, requestPersistence,
  });
}
