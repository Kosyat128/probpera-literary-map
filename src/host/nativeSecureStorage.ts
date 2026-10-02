/** Secrets only. This is not a child PIN/selection anti-rollback CAS store. */
export interface NativeSecretStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<boolean>;
  remove(key: string): Promise<boolean>;
}
export interface NativeSecureStoreBridge {
  get(options: { key: string }): Promise<unknown>;
  set(options: { key: string; value: string }): Promise<unknown>;
  remove(options: { key: string }): Promise<unknown>;
}
export class NativeSecureStorageError extends Error {
  constructor() { super("native-secure-storage-unavailable"); this.name = "NativeSecureStorageError"; }
}
export const NATIVE_SECRET_MAX_BYTES = 131_072;
export const nativeSecretKey = (key: unknown): key is string => typeof key === "string"
  && /^auth-(?:session|pkce|user)-v1:[a-z0-9]{20}$/u.test(key);
const validValue = (value: unknown): value is string => typeof value === "string" && value.length > 0
  && value.length <= NATIVE_SECRET_MAX_BYTES && new TextEncoder().encode(value).length <= NATIVE_SECRET_MAX_BYTES;
function response(input: unknown, name: string): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new NativeSecureStorageError();
  const prototype = Object.getPrototypeOf(input), descriptors = Object.getOwnPropertyDescriptors(input);
  const keys = Reflect.ownKeys(descriptors);
  if (prototype !== Object.prototype && prototype !== null || keys.length !== 1 || keys[0] !== name
    || !descriptors[name].enumerable || !("value" in descriptors[name])) throw new NativeSecureStorageError();
  return descriptors[name].value;
}

/** Native methods are captured once. Each key remains ordered even after a
 * public timeout; late work never publishes a successful result. The native
 * queue must also serialize operations and never fall back to Preferences.
 * A timeout cannot prove a write was rolled back; callers must reconcile/clear.
 * Construction performs no native IO and missing plugins deny every operation. */
export function createNativeSecureStorage(bridge: NativeSecureStoreBridge | null, timeoutMs = 1500): NativeSecretStore {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 10_000) throw new RangeError("Invalid secure-storage timeout");
  const get = bridge && typeof bridge.get === "function" ? bridge.get.bind(bridge) : null;
  const set = bridge && typeof bridge.set === "function" ? bridge.set.bind(bridge) : null;
  const remove = bridge && typeof bridge.remove === "function" ? bridge.remove.bind(bridge) : null;
  const tails = new Map<string, Promise<void>>();
  function ordered<T>(key: string, work: () => Promise<T>): Promise<T> {
    if (!nativeSecretKey(key) || !get || !set || !remove) return Promise.reject(new NativeSecureStorageError());
    const operation = (tails.get(key) ?? Promise.resolve()).then(work);
    const tail = operation.then(() => undefined, () => undefined);
    tails.set(key, tail);
    void tail.then(() => { if (tails.get(key) === tail) tails.delete(key); });
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new NativeSecureStorageError()), timeoutMs);
      void operation.then(value => { clearTimeout(timer); resolve(value); }, () => { clearTimeout(timer); reject(new NativeSecureStorageError()); });
    });
  }
  async function read(key: string): Promise<string | null> {
    const value = response(await get!({ key }), "value");
    if (value !== null && !validValue(value)) throw new NativeSecureStorageError();
    return value as string | null;
  }
  return Object.freeze({
    get(key: string) { return ordered(key, () => read(key)); },
    set(key: string, value: string) {
      if (!validValue(value)) return Promise.reject(new NativeSecureStorageError());
      return ordered(key, async () => {
        if (response(await set!({ key, value }), "stored") !== true || await read(key) !== value) throw new NativeSecureStorageError();
        return true;
      });
    },
    remove(key: string) {
      return ordered(key, async () => {
        if (response(await remove!({ key }), "removed") !== true || await read(key) !== null) throw new NativeSecureStorageError();
        return true;
      });
    },
  });
}

/** Only an explicitly identified old store can implement this interface.
 * compareAndRemove must atomically remove this exact key iff its value is still
 * expected; no key scans, Preferences fallback, or broad storage clear. */
export interface LegacyNativeSessionStore {
  getItem(key: string): Promise<string | null>;
  compareAndRemove(key: string, expected: string): Promise<boolean>;
}
export type NativeSessionMigration = "migrated" | "not-needed";

/** SDK-compatible async storage for one explicit canonical project. Does not
 * create an Auth client, validate a JWT, grant access, or activate native Auth.
 * clear seals this instance before IO, fences refresh/migration, and removes
 * all three project-private records. New login/account needs a new instance.
 * The future consumer must await successful clear before constructing the next
 * instance for the same project: instance fences do not serialize its writes
 * against another instance's pending logout. A failed clear keeps Auth sealed.
 * dispose only revokes pending publication; it does not claim disk deletion. */
export function createNativeSessionStorage(options: {
  secureStorage: NativeSecretStore; storageKey: string; legacy?: LegacyNativeSessionStore; legacyTimeoutMs?: number;
}) {
  const legacyTimeoutMs = options.legacyTimeoutMs ?? 1500;
  if (!Number.isInteger(legacyTimeoutMs) || legacyTimeoutMs < 1 || legacyTimeoutMs > 10_000) throw new NativeSecureStorageError();
  const match = /^sb-([a-z0-9]{20})-auth-token$/u.exec(options.storageKey);
  if (!match || !options.secureStorage || ["get", "set", "remove"].some(name => typeof options.secureStorage[name as keyof NativeSecretStore] !== "function"))
    throw new NativeSecureStorageError();
  const store = Object.freeze({ get: options.secureStorage.get.bind(options.secureStorage), set: options.secureStorage.set.bind(options.secureStorage),
    remove: options.secureStorage.remove.bind(options.secureStorage) }), project = match[1], base = options.storageKey;
  const mapping = new Map([[base, `auth-session-v1:${project}`], [`${base}-code-verifier`, `auth-pkce-v1:${project}`], [`${base}-user`, `auth-user-v1:${project}`]]);
  const legacyRead = options.legacy?.getItem.bind(options.legacy), legacyRemove = options.legacy?.compareAndRemove.bind(options.legacy);
  let sealed = false, revision = 0, tail: Promise<void> = Promise.resolve();
  const secretKey = (key: string) => { const result = mapping.get(key); if (!result) throw new NativeSecureStorageError(); return result; };
  const current = (ticket: number, signal?: AbortSignal) => !sealed && ticket === revision && !signal?.aborted;
  // A bounded legacy call observes late rejection. Timeout/cancellation denies
  // publication, but cannot assert that an already dispatched atomic deletion
  // was rolled back. It never changes the native store's per-key ordering.
  function legacyCall<T>(work: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      let settled = false;
      const finish = (value?: T, failed = false) => {
        if (settled) return; settled = true; clearTimeout(timer); signal?.removeEventListener("abort", cancel);
        if (failed) reject(new NativeSecureStorageError()); else resolve(value as T);
      };
      const cancel = () => finish(undefined, true), timer = setTimeout(cancel, legacyTimeoutMs);
      signal?.addEventListener("abort", cancel, { once: true });
      if (signal?.aborted) { cancel(); return; }
      void Promise.resolve().then(() => { if (signal?.aborted) throw new NativeSecureStorageError(); return work(); })
        .then(value => finish(value), () => finish(undefined, true));
    });
  }
  function serial<T>(work: (ticket: number) => Promise<T>): Promise<T> {
    const ticket = revision;
    const result = tail.then(async () => { if (!current(ticket)) throw new NativeSecureStorageError(); return work(ticket); });
    tail = result.then(() => undefined, () => undefined);
    return result.catch(() => { throw new NativeSecureStorageError(); });
  }
  return Object.freeze({
    getItem(key: string): Promise<string | null> {
      return serial(async ticket => { const value = await store.get(secretKey(key)); if (!current(ticket)) throw new NativeSecureStorageError(); return value; });
    },
    setItem(key: string, value: string): Promise<void> {
      return serial(async ticket => { if (!validValue(value) || await store.set(secretKey(key), value) !== true || !current(ticket)) throw new NativeSecureStorageError(); });
    },
    removeItem(key: string): Promise<void> {
      return serial(async ticket => { if (await store.remove(secretKey(key)) !== true || !current(ticket)) throw new NativeSecureStorageError(); });
    },
    migrateLegacy(signal?: AbortSignal): Promise<NativeSessionMigration> {
      return serial(async ticket => {
        if (!current(ticket, signal)) throw new NativeSecureStorageError();
        if (!legacyRead || !legacyRemove) return "not-needed";
        let migrated = false;
        for (const [legacyKey, key] of mapping) {
          const previous = await legacyCall(() => legacyRead(legacyKey), signal);
          if (!current(ticket, signal)) throw new NativeSecureStorageError();
          if (previous === null) continue;
          if (!validValue(previous)) throw new NativeSecureStorageError();
          const existing = await store.get(key);
          if (!current(ticket, signal) || existing !== null && existing !== previous) throw new NativeSecureStorageError();
          if (existing === null && await store.set(key, previous) !== true) throw new NativeSecureStorageError();
          if (!current(ticket, signal) || await store.get(key) !== previous || !current(ticket, signal)) throw new NativeSecureStorageError();
          if (await legacyCall(() => legacyRemove(legacyKey, previous), signal) !== true || !current(ticket, signal)) throw new NativeSecureStorageError();
          migrated = true;
        }
        return migrated ? "migrated" : "not-needed";
      });
    },
    clear(): Promise<void> {
      sealed = true; revision++;
      const result = tail.then(async () => {
        let failed = false;
        for (const [legacyKey, key] of mapping) {
          try {
            if (await store.remove(key) !== true) failed = true;
            if (legacyRead && legacyRemove) {
              const previous = await legacyCall(() => legacyRead(legacyKey));
              if (previous !== null && (typeof previous !== "string" || previous.length > NATIVE_SECRET_MAX_BYTES
                || await legacyCall(() => legacyRemove(legacyKey, previous)) !== true)) failed = true;
            }
          } catch { failed = true; }
        }
        if (failed) throw new NativeSecureStorageError();
      });
      tail = result.then(() => undefined, () => undefined);
      return result.catch(() => { throw new NativeSecureStorageError(); });
    },
    dispose(): void { sealed = true; revision++; },
  });
}
