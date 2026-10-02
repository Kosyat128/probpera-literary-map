import { strictWebStorage } from "../utils/safeWebStorage";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
export const readerPrivateStorageKeys = (subject: string) => {
  if (!uuid.test(subject)) throw new TypeError("Invalid reader subject");
  const suffix = `:user:${encodeURIComponent(subject)}`;
  return ["probpera-reading-library" + suffix, "probpera-reading-progress" + suffix, "probpera-reader-subscriptions" + suffix] as const;
};
export const readerPrivateDatabaseName = (subject: string) => {
  readerPrivateStorageKeys(subject); return `probpera-book-collections:user:${subject}`;
};
type Phase = "clearing" | "error" | "sealed";
/** Exact own-user namespaces only. SDK Auth storage remains owned by the SDK.
 * Seal memory/controllers before asynchronous durable cleanup can yield. */
export function createReaderPrivacyCoordinator(ports: {
  remove(key: string): void;
  read(key: string): string | null;
  deleteDatabase(name: string): Promise<void>;
  timeoutMs: number;
}) {
  if (!Number.isSafeInteger(ports.timeoutMs) || ports.timeoutMs < 1 || ports.timeoutMs > 30_000) throw new TypeError("Invalid privacy timeout");
  const states = new Map<string, { phase: Phase; permanent: boolean; pending?: Promise<boolean> }>();
  const caches = new Map<string, Set<() => void>>(), listeners = new Set<() => void>();
  let revision = 0;
  const notify = () => { revision++; for (const listener of [...listeners]) { try { listener(); } catch { /* No authority in view callbacks. */ } } };
  return Object.freeze({
    getSnapshot: () => revision,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    phase: (subject: string | null) => subject ? states.get(subject)?.phase ?? null : null,
    isBlocked: (subject: string | null) => !!subject && states.has(subject),
    isPermanent: (subject: string | null) => !!subject && states.get(subject)?.permanent === true,
    resume(subject: string) {
      const state = states.get(subject);
      if (state && !state.permanent && state.phase === "sealed") { states.delete(subject); notify(); }
    },
    register(subject: string, seal: () => void) {
      readerPrivateStorageKeys(subject);
      if (states.has(subject)) { seal(); return () => {}; }
      let set = caches.get(subject); if (!set) { set = new Set(); caches.set(subject, set); }
      set.add(seal);
      return () => { set!.delete(seal); if (!set!.size && caches.get(subject) === set) caches.delete(subject); };
    },
    clear(subject: string, permanent = false): Promise<boolean> {
      const keys = readerPrivateStorageKeys(subject), existing = states.get(subject);
      if (existing?.pending) { existing.permanent ||= permanent; return existing.pending; }
      const state: { phase: Phase; permanent: boolean; pending?: Promise<boolean> } = { phase: "clearing", permanent: permanent || !!existing?.permanent };
      states.set(subject, state);
      const owned = caches.get(subject); caches.delete(subject);
      let sealingFailed = false;
      for (const seal of owned ?? []) { try { seal(); } catch { sealingFailed = true; } }
      notify();
      let timer: ReturnType<typeof setTimeout>;
      // A late successful delete cannot clear an error or unblock a new login.
      const cleanup = Promise.resolve().then(async () => {
        let failed = sealingFailed;
        for (const key of keys) {
          try { ports.remove(key); if (ports.read(key) !== null) failed = true; } catch { failed = true; }
        }
        try { await ports.deleteDatabase(readerPrivateDatabaseName(subject)); } catch { failed = true; }
        return !failed;
      });
      const deadline = new Promise<boolean>(resolve => { timer = setTimeout(() => resolve(false), ports.timeoutMs); });
      const pending = Promise.race([cleanup, deadline]).then(success => {
        clearTimeout(timer);
        if (states.get(subject) === state) { state.pending = undefined; state.phase = success ? "sealed" : "error"; notify(); }
        return success;
      });
      state.pending = pending; return pending;
    },
  });
}
export const readerPrivacy = createReaderPrivacyCoordinator({
  timeoutMs: 10_000,
  remove(key) {
    // Remove the site's resilient in-memory overlay as well as original bytes.
    if (typeof window === "undefined") throw new Error("Private storage unavailable");
    window.localStorage.removeItem(key); strictWebStorage("local").removeItem(key);
  },
  read: key => strictWebStorage("local").getItem(key),
  deleteDatabase(name) {
    return new Promise<void>((resolve, reject) => {
      let factory: IDBFactory;
      try { factory = indexedDB; } catch { reject(new Error("Private storage unavailable")); return; }
      const request = factory.deleteDatabase(name);
      request.onsuccess = () => resolve(); request.onerror = () => reject(new Error("Private cleanup unavailable"));
      request.onblocked = () => reject(new Error("Private cleanup blocked"));
    });
  },
});
