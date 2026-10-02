import { childDataNamespace, decodeChildDataScope, sameChildDataScope, type ChildDataScope } from "./childDataNamespace";
import { CHILD_ENTITY_KINDS } from "./childAccessPolicy";
import { CHILD_PACKAGE_MAX_BYTES, CHILD_PACKAGE_MAX_ENTITIES, childDataArray, childRecord,
  decodeChildEntityPayload, decodeChildEntityReference, type ChildEntityPayload, type ChildEntityReference } from "./childPackage";
import type { ChildIndexPurpose, ChildScopedDataPort, ChildScopedDataRequest } from "./childIndex";

export const CHILD_DURABLE_DATABASE = "probpera-child-durable-v1";
/** Resource limit for this controller's nonce journal, not a legal/access rule.
 * Exhaustion seals it; a fresh independently admitted host controller is needed. */
export const CHILD_DURABLE_MAX_NONCES = 4096;
const purposes: readonly ChildIndexPurpose[] = Object.freeze(["search", "history", "cache", "offline"]);
const controlKey = "probpera-child-v1/active-context";
const identifier = /^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/u;
const noncePattern = /^[a-f0-9]{32}$/u;
const revision = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value)
  && value >= 0 && value < Number.MAX_SAFE_INTEGER;

/** Trusted backend contract: all four child stores share ONE serializable
 * transaction. Callbacks run while it is active; abort rolls back every queued
 * write. Resolve true only after commit, with signal/current checked at every
 * callback and commit boundary. This port grants no child/parent authority. */
export interface ChildDataTransaction {
  get(purpose: ChildIndexPurpose, key: string, done: (value: unknown) => void): void;
  put(purpose: ChildIndexPurpose, key: string, value: unknown, done: () => void): void;
  abort(): void;
}
export interface ChildDataTransactionPort {
  transaction(work: (transaction: ChildDataTransaction) => void, signal: AbortSignal, isCurrent: () => boolean): Promise<boolean>;
  close(): void;
}
export interface ChildDurableDataOptions {
  backend: ChildDataTransactionPort;
  /** Operational monotonic deadline only, never age/rights/PIN clock authority. */
  clock: { nowMs(): number };
  timeoutMs: number;
  /** Trusted entropy seam. Production defaults to WebCrypto's actual128 bits;
   * tests must identify an injected generator as synthetic. */
  nonce?: () => string;
}
type Context = { scope: ChildDataScope; nonce: string; generation: number; lease: object | null };
type CopiedRequest = { purpose: ChildIndexPurpose; scope: ChildDataScope; key: string; lease: object; current: () => boolean };
type Slot = Readonly<{ revision: number; value: unknown }>;
type Control = Readonly<{ schemaVersion: 1; namespace: "child"; scope: ChildDataScope | null; nonce: string }>;

function copyRequest(input: unknown, purpose: ChildIndexPurpose): CopiedRequest | null {
  try {
    const row = childRecord(input, ["purpose", "scope", "key", "lease", "isCurrent"]);
    const scope = row && decodeChildDataScope(row.scope);
    if (!row || !scope || row.purpose !== purpose || typeof row.key !== "string" || typeof row.isCurrent !== "function"
      || !row.lease || typeof row.lease !== "object" || Array.isArray(row.lease)) return null;
    const base = childDataNamespace(scope, purpose)!;
    if (purpose === "search" || purpose === "history") { if (row.key !== base) return null; }
    else {
      if (!row.key.startsWith(base + "/item/")) return null;
      const parts = row.key.slice(base.length + 6).split("/");
      if (parts.length !== 2 || !(CHILD_ENTITY_KINDS as readonly string[]).includes(parts[0]) || !identifier.test(parts[1])
        || purpose === "offline" && parts[0] !== "offline-package") return null;
    }
    return { purpose, scope, key: row.key, lease: row.lease, current: row.isCurrent as () => boolean };
  } catch { return null; }
}
function control(value: unknown): Control | null {
  try {
    const row = childRecord(value, ["schemaVersion", "namespace", "scope", "nonce"]);
    const scope = row?.scope === null ? null : row && decodeChildDataScope(row.scope);
    return row?.schemaVersion === 1 && row.namespace === "child" && typeof row.nonce === "string" && noncePattern.test(row.nonce)
      && (row.scope === null || scope !== null) ? Object.freeze({ schemaVersion: 1, namespace: "child", scope, nonce: row.nonce }) : null;
  } catch { return null; }
}
function matchingControl(value: unknown, context: Context): boolean {
  const decoded = control(value);
  return decoded !== null && decoded.nonce === context.nonce && sameChildDataScope(decoded.scope, context.scope);
}
function references(input: unknown): readonly ChildEntityReference[] | null {
  const rows = childDataArray(input, CHILD_PACKAGE_MAX_ENTITIES);
  if (!rows) return null;
  const decoded = rows.map(decodeChildEntityReference);
  if (decoded.some(row => row === null) || new Set(decoded.map(row => `${row!.kind}/${row!.id}`)).size !== decoded.length) return null;
  return Object.freeze(decoded as ChildEntityReference[]);
}
/** Structural storage envelope only; current compiled index/review must still
 * independently admit every reference/payload before any visitor sees it. */
function envelope(input: unknown, request: CopiedRequest): unknown | null {
  try {
    let result: unknown;
    if (request.purpose === "search" || request.purpose === "history") {
      const row = childRecord(input, ["schemaVersion", "scope", "references"]), refs = row && references(row.references);
      if (!row || row.schemaVersion !== 1 || !sameChildDataScope(row.scope, request.scope) || !refs
        || request.purpose === "search" && refs.some(ref => ref.kind !== "search-result")
        || request.purpose === "history" && refs.some(ref => ref.kind !== "recent")) return null;
      result = Object.freeze({ schemaVersion: 1, scope: request.scope, references: refs });
    } else {
      const row = childRecord(input, ["schemaVersion", "scope", "entries"]), raw = row && childDataArray(row.entries, CHILD_PACKAGE_MAX_ENTITIES);
      if (!row || row.schemaVersion !== 1 || !sameChildDataScope(row.scope, request.scope) || !raw || raw.length === 0) return null;
      const entries: Readonly<{ reference: ChildEntityReference; payload: ChildEntityPayload }>[] = [];
      for (const item of raw) {
        const entry = childRecord(item, ["reference", "payload"]), reference = entry && decodeChildEntityReference(entry.reference);
        const payload = entry && decodeChildEntityPayload(entry.payload);
        if (!entry || !reference || !payload) return null;
        entries.push(Object.freeze({ reference, payload }));
      }
      const keys = new Map(entries.map(entry => [`${entry.reference.kind}/${entry.reference.id}`, entry.reference.contentChecksum]));
      const base = childDataNamespace(request.scope, request.purpose)!;
      if (keys.size !== entries.length || request.key !== `${base}/item/${entries[0].reference.kind}/${entries[0].reference.id}`
        || entries.some(entry => entry.payload.references.some(ref => keys.get(`${ref.kind}/${ref.id}`) !== ref.contentChecksum))) return null;
      result = Object.freeze({ schemaVersion: 1, scope: request.scope, entries: Object.freeze(entries) });
    }
    return new TextEncoder().encode(JSON.stringify(result)).byteLength <= CHILD_PACKAGE_MAX_BYTES ? result : null;
  } catch { return null; }
}
function storedSlot(input: unknown, request: CopiedRequest): Slot | null {
  if (input === undefined) return Object.freeze({ revision: 0, value: null });
  try {
    const row = childRecord(input, ["schemaVersion", "namespace", "purpose", "scope", "key", "revision", "value"]);
    if (!row || row.schemaVersion !== 1 || row.namespace !== "child" || row.purpose !== request.purpose || row.key !== request.key
      || !sameChildDataScope(row.scope, request.scope) || !revision(row.revision) || row.revision === 0) return null;
    const value = envelope(row.value, request);
    return value === null || new TextEncoder().encode(JSON.stringify(nextRecord(request, row.revision, value))).byteLength > CHILD_PACKAGE_MAX_BYTES
      ? null : Object.freeze({ revision: row.revision, value });
  } catch { return null; }
}
function nextRecord(request: CopiedRequest, nextRevision: number, value: unknown) {
  return Object.freeze({ schemaVersion: 1, namespace: "child", purpose: request.purpose, scope: request.scope,
    key: request.key, revision: nextRevision, value });
}
function webNonce(): string {
  const bytes = new Uint8Array(16); globalThis.crypto.getRandomValues(bytes);
  return [...bytes].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

/** Separate durable CHILD data, never a package/profile/PIN approval receipt.
 * Host must activate an independently selected exact scope BEFORE using index
 * ports, and retire on every scope/lifecycle transition. Activation is solely a
 * storage partition; parent authority and reviewed child content stay external.
 * No adult index, global SW, cloud, localStorage or Preferences fallback exists.
 * IndexedDB may be evicted and strict durability is a user-agent hint, not an OS
 * anti-rollback or power-loss guarantee. Already delivered copies cannot be erased. */
export function createChildDurableData(options: ChildDurableDataOptions) {
  if (!options || typeof options.backend?.transaction !== "function" || typeof options.backend?.close !== "function"
    || typeof options.clock?.nowMs !== "function" || !Number.isSafeInteger(options.timeoutMs) || options.timeoutMs <= 0
    || options.timeoutMs > 2_147_483_647 || options.nonce !== undefined && typeof options.nonce !== "function") throw new TypeError("Explicit child transaction/clock options required");
  const transact = options.backend.transaction.bind(options.backend), close = options.backend.close.bind(options.backend);
  const readClock = options.clock.nowMs.bind(options.clock), random = options.nonce ?? webNonce, timeoutMs = options.timeoutMs;
  let generation = 0, active: Context | null = null, disposed = false, brokenClock = false, lastNow = -1;
  const operations = new Set<AbortController>(), seenNonces = new Set<string>(), revokedLeases = new WeakSet<object>();
  function invalidate() {
    const previous = active, pending = [...operations]; active = null; operations.clear();
    if (previous?.lease) revokedLeases.add(previous.lease);
    if (generation === Number.MAX_SAFE_INTEGER) brokenClock = true; else generation++;
    const ticket = generation;
    for (const operation of pending) operation.abort();
    return { previous, ticket };
  }
  function now(): number | null {
    if (brokenClock) return null;
    try { const at = readClock();
      if (!Number.isFinite(at) || at < 0 || at < lastNow) { brokenClock = true; invalidate(); return null; }
      lastNow = at; return at;
    } catch { brokenClock = true; invalidate(); return null; }
  }
  function nonce(): string | null {
    if (seenNonces.size >= CHILD_DURABLE_MAX_NONCES) return null;
    try { const value = random();if (typeof value !== "string" || !noncePattern.test(value) || seenNonces.has(value)) return null;
      seenNonces.add(value); return value;
    } catch { return null; }
  }
  async function bounded<T>(external: AbortSignal | null, current: () => boolean, task: (signal: AbortSignal, current: () => boolean) => Promise<T>): Promise<T | null> {
    const at = now();if (at === null || external?.aborted || current() !== true) return null;
    const deadline = at + timeoutMs;if (!Number.isFinite(deadline) || deadline <= at) return null;
    const abort = new AbortController(), operationGeneration = generation;operations.add(abort);
    return new Promise(resolve => {
      let settled = false;
      const valid = () => {
        const before = now();
        if (abort.signal.aborted || external?.aborted || before === null || before >= deadline || current() !== true) return false;
        const after = now();
        return generation === operationGeneration && !abort.signal.aborted && !external?.aborted && after !== null && after < deadline;
      };
      const finish = (value: T | null) => { if (settled) return;settled = true;clearTimeout(timer);external?.removeEventListener("abort", cancel);abort.signal.removeEventListener("abort", cancel);operations.delete(abort);resolve(value); };
      const cancel = () => { if (!abort.signal.aborted) abort.abort();finish(null); };
      const timer = setTimeout(cancel, timeoutMs);external?.addEventListener("abort", cancel, { once: true });abort.signal.addEventListener("abort", cancel, { once: true });
      Promise.resolve().then(() => valid() ? task(abort.signal, valid) : null).then(value => finish(valid() ? value : null), () => finish(null));
    });
  }
  function currentRequest(original: unknown, copied: CopiedRequest, context: Context): boolean {
    if (disposed || brokenClock || active !== context || generation !== context.generation || context.lease !== copied.lease) return false;
    const current = copyRequest(original, copied.purpose);
    if (!current || current.key !== copied.key || current.lease !== copied.lease || current.current !== copied.current
      || !sameChildDataScope(current.scope, copied.scope)) return false;
    let admitted = false;try { admitted = copied.current() === true; } catch { /* Unknown caller state denies. */ }
    return admitted && !disposed && active === context && generation === context.generation && context.lease === copied.lease;
  }
  function capture(original: unknown, purpose: ChildIndexPurpose): { request: CopiedRequest; context: Context } | null {
    const request = copyRequest(original, purpose), context = active;
    if (!request || !context || revokedLeases.has(request.lease) || !sameChildDataScope(request.scope, context.scope) || disposed || brokenClock) return null;
    let admitted = false;try { admitted = request.current() === true; } catch { /* Fail closed. */ }
    if (!admitted || active !== context || context.generation !== generation || disposed) return null;
    if (context.lease === null) context.lease = request.lease;
    return currentRequest(original, request, context) ? { request, context } : null;
  }
  async function readScoped(original: ChildScopedDataRequest, purpose: ChildIndexPurpose, signal: AbortSignal): Promise<Slot | null> {
    const captured = capture(original, purpose);if (!captured || signal.aborted) return null;
    const { request, context } = captured;
    return bounded(signal, () => currentRequest(original, request, context), async (childSignal, valid) => {
      let saved: Slot | null = null;
      const committed = await transact(tx => tx.get("search", controlKey, marker => {
        if (!valid() || !matchingControl(marker, context)) { tx.abort();return; }
        tx.get(purpose, request.key, value => { if (!valid()) { tx.abort();return; }saved = storedSlot(value, request);if (!saved) tx.abort(); });
      }), childSignal, valid);
      return committed === true && valid() ? saved : null;
    });
  }
  async function compareScoped(original: ChildScopedDataRequest, purpose: ChildIndexPurpose, expectedRevision: number, input: unknown, signal: AbortSignal): Promise<boolean> {
    const captured = capture(original, purpose);
    if (!captured || !revision(expectedRevision) || expectedRevision >= Number.MAX_SAFE_INTEGER - 1 || signal.aborted) return false;
    const { request, context } = captured, copied = envelope(input, request);if (copied === null) return false;
    const result = await bounded(signal, () => currentRequest(original, request, context), async (childSignal, valid) => {
      const record = nextRecord(request, expectedRevision + 1, copied);let checked = false;
      if (new TextEncoder().encode(JSON.stringify(record)).byteLength > CHILD_PACKAGE_MAX_BYTES) return false;
      const committed = await transact(tx => tx.get("search", controlKey, marker => {
        if (!valid() || !matchingControl(marker, context)) { tx.abort();return; }
        tx.get(purpose, request.key, previous => {
          const before = storedSlot(previous, request);
          if (!before || before.revision !== expectedRevision || !valid()) { tx.abort();return; }
          tx.put(purpose, request.key, record, () => {
            if (!valid()) { tx.abort();return; }
            tx.get(purpose, request.key, value => {
              const after = storedSlot(value, request);
              checked = valid() && after !== null && after.revision === expectedRevision + 1 && JSON.stringify(after.value) === JSON.stringify(copied);
              if (!checked) tx.abort();
            });
          });
        });
      }), childSignal, valid);
      if (committed !== true || !checked || !valid()) return false;
      // A separate post-complete transaction proves actual persisted read-back.
      let durable = false;
      const readBack = await transact(tx => tx.get("search", controlKey, marker => {
        if (!valid() || !matchingControl(marker, context)) { tx.abort();return; }
        tx.get(purpose, request.key, value => {
          const after = storedSlot(value, request);
          durable = valid() && after !== null && after.revision === expectedRevision + 1 && JSON.stringify(after.value) === JSON.stringify(copied);
          if (!durable) tx.abort();
        });
      }), childSignal, valid);
      return readBack === true && durable && valid();
    });
    return result === true;
  }
  async function retireOwned(closeAfter = false): Promise<boolean> {
    const { previous, ticket } = invalidate();if (closeAfter) disposed = true;
    if (!previous || brokenClock || generation !== ticket) { if (closeAfter) close();return previous === null; }
    const fresh = nonce();if (!fresh) { if (closeAfter) close();return false; }
    const cleared = await bounded(null, () => generation === ticket, async (signal, valid) => {
      let checked = false;
      const committed = await transact(tx => tx.get("search", controlKey, marker => {
        const decoded = control(marker);
        if (!valid() || !decoded) { tx.abort();return; }
        if (!matchingControl(marker, previous)) { checked = true;return; } // Never clear another instance's newer context.
        tx.put("search", controlKey, Object.freeze({ schemaVersion: 1, namespace: "child", scope: null, nonce: fresh }), () => {
          if (!valid()) { tx.abort();return; }
          tx.get("search", controlKey, value => {
            const saved = control(value);checked = valid() && saved !== null && saved.scope === null && saved.nonce === fresh;
            if (!checked) tx.abort();
          });
        });
      }), signal, valid);
      if (committed !== true || !checked || !valid()) return false;
      let durable = false;
      const readBack = await transact(tx => tx.get("search", controlKey, value => {
        const saved = control(value);durable = valid() && saved !== null && !matchingControl(saved, previous);
        if (!durable) tx.abort();
      }), signal, valid);
      return readBack === true && durable && valid();
    });
    if (closeAfter) close();return cleared === true;
  }
  const ports = Object.freeze(Object.fromEntries(purposes.map(purpose => [purpose, Object.freeze({
    read: (request: ChildScopedDataRequest, signal: AbortSignal) => readScoped(request, purpose, signal),
    compareAndSet: (request: ChildScopedDataRequest, expectedRevision: number, value: unknown, signal: AbortSignal) => compareScoped(request, purpose, expectedRevision, value, signal),
  })])) as Readonly<Record<ChildIndexPurpose, ChildScopedDataPort>>);
  return Object.freeze({ ports,
    async activate(input: unknown): Promise<boolean> {
      const { ticket } = invalidate(), scope = decodeChildDataScope(input), fresh = nonce();
      if (!scope || !fresh || disposed || brokenClock || generation !== ticket) return false;
      const context: Context = { scope, nonce: fresh, generation: ticket, lease: null };
      const result = await bounded(null, () => !disposed && generation === ticket, async (signal, valid) => {
        let checked = false;
        const committed = await transact(tx => tx.get("search", controlKey, previous => {
          if (!valid() || previous !== undefined && !control(previous) || control(previous)?.nonce === fresh) { tx.abort();return; }
          tx.put("search", controlKey, Object.freeze({ schemaVersion: 1, namespace: "child", scope, nonce: fresh }), () => tx.get("search", controlKey, value => {
            checked = valid() && matchingControl(value, context);if (!checked) tx.abort();
          }));
        }), signal, valid);
        if (committed !== true || !checked || !valid()) return false;
        let persisted = false;
        const readBack = await transact(tx => tx.get("search", controlKey, value => {
          persisted = valid() && matchingControl(value, context);if (!persisted) tx.abort();
        }), signal, valid);
        return readBack === true && persisted && valid();
      });
      if (result !== true || disposed || generation !== ticket) return false;
      active = context;return true;
    },
    retire: () => retireOwned(), background: () => retireOwned(), dispose: () => retireOwned(true),
    getSnapshot() { return Object.freeze({ phase: disposed ? "disposed" : active ? "ready" : "sealed", scope: active?.scope ?? null }); },
  });
}

/** Actual Web IndexedDB implementation. No native/PIN/secure-storage claim.
 * Four fixed child stores only; every transaction locks their combined scope.
 * Strict durability is a hint (https://w3c.github.io/IndexedDB/#transaction-durability-hint).
 * An abort after the UA has already committed cannot undo that commit. The
 * controller still denies late publication and the old exact namespace remains
 * separate. Host/frame/lifecycle/browser crash proof requires real integration. */
export function createIndexedDbChildTransactionPort(factory: IDBFactory | null): ChildDataTransactionPort | null {
  if (!factory || typeof factory.open !== "function") return null;
  let closed = false;
  const connections = new Set<IDBDatabase>();
  const names = purposes.map(purpose => "child-" + purpose);
  const safeKey = (purpose: ChildIndexPurpose, key: string) => purposes.includes(purpose) && typeof key === "string"
    && (purpose === "search" && key === controlKey || key.startsWith(`probpera-child-v1/${purpose}/`));
  return Object.freeze({
    transaction(work: (transaction: ChildDataTransaction) => void, signal: AbortSignal, isCurrent: () => boolean): Promise<boolean> {
      return new Promise(resolve => {
        let db: IDBDatabase | null = null, tx: IDBTransaction | null = null, settled = false;
        const valid = () => { try {
          if (closed || signal.aborted) return false;
          const admitted = isCurrent() === true;
          return admitted && !closed && !signal.aborted;
        } catch { return false; } };
        const finish = (value: boolean) => { if (settled) return;settled = true;signal.removeEventListener("abort", cancel);if (db) { connections.delete(db);db.close(); }resolve(value); };
        const cancel = () => { try { tx?.abort(); } catch { /* Committed/finished cannot be undone. */ }finish(false); };
        if (!valid()) { finish(false);return; }signal.addEventListener("abort", cancel, { once: true });
        let opening: IDBOpenDBRequest;
        try { opening = factory.open(CHILD_DURABLE_DATABASE, 1); } catch { finish(false);return; }
        opening.onblocked = () => cancel();opening.onerror = () => finish(false);
        opening.onupgradeneeded = () => {
          if (settled || !valid()) { try { opening.transaction?.abort(); } catch { /* Denied upgrade. */ }return; }
          try { for (const name of names) opening.result.createObjectStore(name); } catch { opening.transaction?.abort(); }
        };
        opening.onsuccess = () => {
          db = opening.result;
          if (settled || !valid()) { db.close();finish(false);return; }
          connections.add(db);db.onversionchange = () => cancel();
          if (db.objectStoreNames.length !== names.length || names.some(name => !db!.objectStoreNames.contains(name))) { cancel();return; }
          try {
            tx = db.transaction(names, "readwrite", { durability: "strict" });
            if (tx.durability !== "strict") { cancel();return; }
            tx.onabort = () => finish(false);tx.onerror = () => cancel();tx.oncomplete = () => finish(valid());
            const enqueue = (purpose: ChildIndexPurpose, key: string, value: unknown, write: boolean, done: (value: unknown) => void) => {
              if (!valid() || !safeKey(purpose, key)) { cancel();return; }
              const request = write ? tx!.objectStore("child-" + purpose).put(value, key) : tx!.objectStore("child-" + purpose).get(key);
              request.onerror = () => cancel();request.onsuccess = () => {
                if (!valid()) { cancel();return; }
                try { const completion: unknown = done(write ? undefined : request.result);
                  if (completion !== undefined) { void Promise.resolve(completion).catch(() => {});cancel();return; }
                  if (!valid()) cancel();
                } catch { cancel(); }
              };
            };
            const transaction: ChildDataTransaction = Object.freeze({
              get: (purpose: ChildIndexPurpose, key: string, done: (value: unknown) => void) => enqueue(purpose, key, undefined, false, done),
              put: (purpose: ChildIndexPurpose, key: string, value: unknown, done: () => void) => enqueue(purpose, key, value, true, done), abort: cancel,
            });
            const completion: unknown = work(transaction);
            if (completion !== undefined) { void Promise.resolve(completion).catch(() => {});cancel();return; }
            if (!valid()) cancel();
          } catch { cancel(); }
        };
      });
    },
    close() { closed = true;for (const db of [...connections]) { try { db.close(); } catch { /* Deny further work. */ } }connections.clear(); },
  });
}
