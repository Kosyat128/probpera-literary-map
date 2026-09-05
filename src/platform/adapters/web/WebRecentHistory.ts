import { RECENT_HISTORY_LIMIT, recentEntryKey, type RecentEntry, type RecentHistoryScope, type RecentHistorySnapshot, type RecentHistoryStore, type RecentTarget } from "../../../planet/RecentHistory";
import { readWebStorage, removeWebStorage, writeWebStorage } from "../../../utils/safeWebStorage";

type BrowserHost = Pick<Window, "localStorage" | "sessionStorage" | "addEventListener" | "removeEventListener">;
export interface WebRecentHistoryOptions {
  readonly window?: BrowserHost | null;
  readonly subtle?: SubtleCrypto | null;
  readonly now?: () => number;
}
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const exact = (value: Record<string, unknown>, keys: readonly string[]) => Object.keys(value).length === keys.length && keys.every(key => Object.prototype.hasOwnProperty.call(value, key));
const id = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/u.test(value) && !["__proto__", "constructor", "prototype"].includes(value);
// Cancellation only, never a second history or authentication store. Pending
// same-window clears remain observable when Web Storage rejects a write.
type ClearMarker = { generation: string; pending: boolean };
const memoryClears = new WeakMap<object, Map<string, ClearMarker>>();
type HistoryState = { generation: string; entries: readonly RecentEntry[] };
const generation = (value: unknown): value is string => typeof value === "string" && /^(?:initial|legacy:[0-9]{1,16}|clear:[a-f0-9]{32})$/u.test(value);
function nextGeneration(): string {
  const words = new Uint32Array(4);
  try { globalThis.crypto.getRandomValues(words); }
  catch { for (let index = 0; index < words.length; index++) words[index] = Math.floor(Math.random() * 0x100000000); }
  // Equality token, not a credential, timestamp or globally ordered counter.
  return "clear:" + [...words].map(word => word.toString(16).padStart(8, "0")).join("");
}

// Namespace hashing only. Computing the key synchronously lets an operation
// observe its clear generation before asynchronous initialization. WebCrypto
// verifies the same digest before persistence; this is no security authority.
function namespaceDigest(source: string): string {
  const constants = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const input = new TextEncoder().encode(source), bytes = new Uint8Array(Math.ceil((input.length + 9) / 64) * 64);
  bytes.set(input); bytes[input.length] = 0x80;
  const view = new DataView(bytes.buffer); view.setUint32(bytes.length - 4, input.length * 8);
  const hash = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19], words = new Uint32Array(64);
  const rotate = (word: number, bits: number) => (word >>> bits) | (word << (32 - bits));
  for (let offset = 0; offset < bytes.length; offset += 64) {
    for (let index = 0; index < 64; index++) {
      if (index < 16) words[index] = view.getUint32(offset + index * 4);
      else { const a = words[index - 15], b = words[index - 2]; words[index] = words[index - 16] + (rotate(a, 7) ^ rotate(a, 18) ^ (a >>> 3)) + words[index - 7] + (rotate(b, 17) ^ rotate(b, 19) ^ (b >>> 10)); }
    }
    let [a,b,c,d,e,f,g,h] = hash;
    for (let index = 0; index < 64; index++) {
      const first = (h + (rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25)) + ((e & f) ^ (~e & g)) + constants[index] + words[index]) >>> 0;
      const second = ((rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      h = g; g = f; f = e; e = (d + first) >>> 0; d = c; c = b; b = a; a = (first + second) >>> 0;
    }
    [a,b,c,d,e,f,g,h].forEach((word, index) => { hash[index] = (hash[index] + word) >>> 0; });
  }
  return hash.map(word => word.toString(16).padStart(8, "0")).join("");
}
function target(value: unknown): RecentTarget | null {
  if (!object(value) || !id(value.countryId) || !id(value.writerId)) return null;
  if (value.kind === "writer" && exact(value, ["kind", "countryId", "writerId"])) return { kind: "writer", countryId: value.countryId, writerId: value.writerId };
  if (value.kind === "work" && exact(value, ["kind", "countryId", "writerId", "workId"]) && id(value.workId)) return { kind: "work", countryId: value.countryId, writerId: value.writerId, workId: value.workId };
  return null;
}
function decode(source: string | null): HistoryState {
  const empty = { generation: "initial", entries: [] };
  if (!source || source.length > 32_768) return empty;
  try {
    const value: unknown = JSON.parse(source);
    if (!object(value) || value.v !== 1 || !Array.isArray(value.entries) || value.entries.length > RECENT_HISTORY_LIMIT) return empty;
    const current = exact(value, ["v", "generation", "entries"]) && generation(value.generation);
    const legacy = exact(value, ["v", "entries"]) || (exact(value, ["v", "clearedAt", "entries"]) && Number.isSafeInteger(value.clearedAt) && Number(value.clearedAt) >= 0);
    if (!current && !legacy) return empty;
    const entries: RecentEntry[] = [], seen = new Set<string>();
    for (const candidate of value.entries) {
      if (!object(candidate) || !Number.isSafeInteger(candidate.openedAt) || Number(candidate.openedAt) < 0) continue;
      const { openedAt, ...rest } = candidate;
      const item = target(rest);
      if (!item || seen.has(recentEntryKey(item))) continue;
      seen.add(recentEntryKey(item)); entries.push(Object.freeze({ ...item, openedAt: Number(openedAt) }));
    }
    return { generation: current ? String(value.generation) : value.clearedAt ? "legacy:" + value.clearedAt : "initial", entries };
  } catch { return empty; }
}

/** Lazy, bounded, identity-scoped local preference storage. It stores no labels,
 * credentials, receipts or entitlements, and performs no network requests. */
export function createWebRecentHistory(scope: RecentHistoryScope, options: WebRecentHistoryOptions = {}): RecentHistoryStore {
  if (!scope || ![scope.issuer, scope.audience, scope.product, scope.subject].every(value => typeof value === "string" && value.length > 0 && value.length <= 1024 && !/[\u0000-\u001f\u007f]/u.test(value))) throw new Error("Invalid verified history scope");
  const scopeTuple = JSON.stringify([scope.issuer, scope.audience, scope.product, scope.subject]);
  const browser = options.window === undefined ? (typeof window === "undefined" ? null : window) : options.window;
  const now = options.now ?? Date.now;
  let snapshot: RecentHistorySnapshot = Object.freeze({ available: true, loaded: false, entries: Object.freeze([]) });
  let key: string | null = null, storageEnabled = false;
  let memoryState: HistoryState = { generation: "initial", entries: [] };
  let localClear: ClearMarker | null = null;
  let initialization: Promise<void> | null = null;
  let tail = Promise.resolve();
  const subscribers = new Map<() => void, number>();
  function prepareKey() {
    const subtle = options.subtle === undefined ? globalThis.crypto?.subtle : options.subtle;
    if (!key && !initialization && browser && subtle) {
      key = "literary-planet-recent-v1:" + namespaceDigest(scopeTuple);
      storageEnabled = true;
    }
  }
  function publish(entries: readonly RecentEntry[], loaded = true) {
    if (snapshot.loaded === loaded && JSON.stringify(snapshot.entries) === JSON.stringify(entries)) return;
    snapshot = Object.freeze({ available: true, loaded, entries: Object.freeze(entries.map(entry => Object.freeze({ ...entry }))) });
    for (const listener of [...subscribers.keys()]) { try { listener(); } catch { /* Isolate consumers. */ } }
  }
  function readState(): HistoryState {
    const persisted = storageEnabled && key ? decode(readWebStorage("local", key, browser)) : memoryState;
    const clear = browser ? memoryClears.get(browser)?.get(scopeTuple) : localClear;
    memoryState = clear?.pending && persisted.generation !== clear.generation ? { generation: clear.generation, entries: [] } : persisted;
    return memoryState;
  }
  function persist(state: HistoryState) {
    memoryState = state;
    if (!key) return;
    const source = JSON.stringify({ v: 1, generation: state.generation, entries: state.entries });
    // The canonical compatibility patch can swallow quota errors. Only a
    // matching readback permits the next mutation to use persisted state.
    storageEnabled = writeWebStorage("local", key, source, browser) && readWebStorage("local", key, browser) === source;
  }
  function initialize() {
    prepareKey();
    return initialization ??= (async () => {
      try {
        const subtle = options.subtle === undefined ? globalThis.crypto?.subtle : options.subtle;
        if (subtle && browser) {
          const digest = await subtle.digest("SHA-256", new TextEncoder().encode(scopeTuple));
          const verifiedKey = "literary-planet-recent-v1:" + [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, "0")).join("");
          if (key !== verifiedKey) throw new Error("Recent namespace digest mismatch");
          publish(readState().entries);
        } else publish(readState().entries);
      } catch { key = null; storageEnabled = false; publish(readState().entries); }
    })();
  }
  function enqueue(action: () => void): Promise<void> {
    const ready = initialize();
    const job = tail.then(() => ready).then(action);
    tail = job.catch(() => undefined);
    return job;
  }
  function storageChanged(event: StorageEvent) {
    if (key && (event.key === key || event.key === null)) void enqueue(() => {
      if (key) publish(readState().entries);
    });
  }
  return Object.freeze({
    persistence: "best-effort" as const,
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      const first = subscribers.size === 0;
      subscribers.set(listener, (subscribers.get(listener) ?? 0) + 1);
      if (first) {
        browser?.addEventListener("storage", storageChanged);
        void enqueue(() => { if (key && storageEnabled) publish(readState().entries); });
      }
      let subscribed = true;
      return () => {
        if (!subscribed) return; subscribed = false;
        const count = subscribers.get(listener) ?? 0;
        if (count > 1) subscribers.set(listener, count - 1); else subscribers.delete(listener);
        if (!subscribers.size) browser?.removeEventListener("storage", storageChanged);
      };
    },
    record(value: RecentTarget) {
      const item = target(value);
      if (!item) return Promise.resolve();
      const timestamp = now();
      if (!Number.isSafeInteger(timestamp) || timestamp < 0) return Promise.resolve();
      prepareKey();
      const observedGeneration = readState().generation;
      return enqueue(() => {
        // Read current persisted state before mutation so a delayed cross-tab
        // storage event cannot resurrect another window's cleared history.
        const state = readState(), entries = state.entries;
        if (observedGeneration !== state.generation) { publish(entries); return; }
        if (entries[0] && recentEntryKey(entries[0]) === recentEntryKey(item)) { publish(entries); return; }
        const next = [{ ...item, openedAt: timestamp }, ...entries.filter(entry => recentEntryKey(entry) !== recentEntryKey(item))].slice(0, RECENT_HISTORY_LIMIT);
        publish(next);
        persist({ generation: state.generation, entries: next });
      });
    },
    clear() {
      prepareKey();
      const marker: ClearMarker = { generation: nextGeneration(), pending: true };
      localClear = marker;
      if (browser) {
        let clears = memoryClears.get(browser);
        if (!clears) { clears = new Map(); memoryClears.set(browser, clears); }
        clears.delete(scopeTuple); clears.set(scopeTuple, marker);
        if (clears.size > 128) clears.delete(clears.keys().next().value!);
      }
      return enqueue(() => {
        const currentMarker = browser ? memoryClears.get(browser)?.get(scopeTuple) : localClear;
        if (currentMarker !== marker) { publish(readState().entries); return; }
        publish([]);
        const cleared = { generation: marker.generation, entries: [] };
        persist(cleared);
        if (key && !storageEnabled) { removeWebStorage("local", key, browser); persist(cleared); }
        marker.pending = !storageEnabled;
      });
    },
  });
}
