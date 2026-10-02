export type ReaderSubscription = Readonly<{ type: "country" | "writer" | "section"; id: string; label: string; createdAt: string }>;
type Pending = { key: string; token: string; item: ReaderSubscription | null };
export type ReaderSubscriptionsEnvelope = { schemaVersion: 1; items: readonly ReaderSubscription[]; pending: readonly Pending[] };
export interface ReaderSubscriptionsRemote {
  read(signal: AbortSignal): PromiseLike<{ data: unknown; error: unknown }>;
  save(item: ReaderSubscription, signal: AbortSignal): PromiseLike<{ error: unknown }>;
  remove(type: ReaderSubscription["type"], id: string, signal: AbortSignal): PromiseLike<{ error: unknown }>;
}
const keyOf = (item: Pick<ReaderSubscription, "type" | "id">) => `${item.type}:${item.id}`;
export const readerSubscriptionsStorageKey = (userId: string | null) => userId
  ? `probpera-reader-subscriptions:user:${encodeURIComponent(userId)}` : "probpera-reader-subscriptions:anonymous";
function parseItem(value: unknown): ReaderSubscription | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (Object.keys(row).sort().join(",") !== "createdAt,id,label,type" || typeof row.type !== "string" || !["country", "writer", "section"].includes(row.type)
    || typeof row.id !== "string" || !row.id || row.id.length > 240 || /[\u0000-\u001f\u007f]/u.test(row.id)
    || typeof row.label !== "string" || !row.label.trim() || row.label.length > 240 || /[\u0000-\u001f\u007f]/u.test(row.label)
    || typeof row.createdAt !== "string" || !Number.isFinite(Date.parse(row.createdAt))) return null;
  return Object.freeze({ type: row.type as ReaderSubscription["type"], id: row.id, label: row.label, createdAt: row.createdAt });
}
function parseItems(value: unknown): ReaderSubscription[] | null {
  if (!Array.isArray(value) || value.length > 100) return null;
  const items = value.map(parseItem);
  return items.some(item => !item) || new Set(items.map(item => item && keyOf(item))).size !== items.length ? null : items as ReaderSubscription[];
}
export function decodeReaderSubscriptions(value: unknown): ReaderSubscriptionsEnvelope | null {
  try {
    if (value === null) return { schemaVersion: 1, items: [], pending: [] };
    if (typeof value === "string") { if (value.length > 131_072) return null; value = JSON.parse(value); }
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const row = value as Record<string, unknown>, items = parseItems(row.items);
    if (Object.keys(row).sort().join(",") !== "items,pending,schemaVersion" || row.schemaVersion !== 1 || !items
      || !Array.isArray(row.pending) || row.pending.length > 100) return null;
    const pending: Pending[] = [];
    for (const item of row.pending) {
      if (!item || typeof item !== "object" || Array.isArray(item) || Object.keys(item).sort().join(",") !== "item,key,token"
        || typeof item.key !== "string" || !/^(country|writer|section):[^\u0000-\u001f\u007f]{1,240}$/u.test(item.key)
        || typeof item.token !== "string" || !item.token || item.token.length > 100) return null;
      const parsed = item.item === null ? null : parseItem(item.item);
      if (item.item !== null && (!parsed || keyOf(parsed) !== item.key)) return null;
      pending.push({ key: item.key, token: item.token, item: parsed });
    }
    if (new Set(pending.map(item => item.key)).size !== pending.length || new Set(pending.map(item => item.token)).size !== pending.length) return null;
    return { schemaVersion: 1, items, pending };
  } catch { return null; }
}
function bounded<T>(start: (signal: AbortSignal) => PromiseLike<T>, owner: AbortSignal, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const controller = new AbortController(); let settled = false;
    const finish = (callback: () => void) => { if (settled) return; settled = true; clearTimeout(timer); owner.removeEventListener("abort", cancel); callback(); };
    const cancel = () => finish(() => { controller.abort(); reject(new Error("Subscription request interrupted")); });
    const timer = setTimeout(cancel, timeoutMs); owner.addEventListener("abort", cancel, { once: true });
    if (owner.aborted) { cancel(); return; }
    try { Promise.resolve(start(controller.signal)).then(value => finish(() => resolve(value)), () => cancel()); }
    catch { cancel(); }
  });
}

/** One exact account namespace and serialized durable intent. The old global
 * key has uncertain ownership and is preserved, never exposed or auto-uploaded.
 * Auth, account transitions and RLS are owned by their existing boundaries. */
export function createReaderSubscriptionsController(options: {
  storage: { read(): unknown; write(value: ReaderSubscriptionsEnvelope): void };
  remote?: ReaderSubscriptionsRemote | null;
  isOnline?: () => boolean;
  listen?: (external: () => void, online: () => void) => () => void;
  timeoutMs?: number;
  now?: () => number;
}) {
  const timeoutMs = options.timeoutMs ?? 10_000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30_000) throw new TypeError("Invalid subscription timeout");
  let envelope: ReaderSubscriptionsEnvelope = { schemaVersion: 1, items: [], pending: [] }, blocked = false, observed = "";
  try { const decoded = decodeReaderSubscriptions(options.storage.read()); blocked = decoded === null; if (decoded) envelope = decoded; observed = JSON.stringify(decoded); }
  catch { /* Optional persistence failure leaves current session local. */ }
  let sealed = false;
  let generation = 0, revision = 0, sequence = 0, sending: Promise<void> | null = null, reading: Promise<void> | null = null;
  const prefix = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  let abort = new AbortController(), detach: (() => void) | undefined;
  const listeners = new Set<() => void>(), leases = new Set<() => boolean>();
  const current = (epoch = generation) => !sealed && epoch === generation && leases.size > 0 && [...leases].some(lease => lease());
  const online = () => options.isOnline?.() ?? true;
  const notify = () => { for (const listener of [...listeners]) { try { listener(); } catch { /* A view cannot own synchronization. */ } } };
  function publish(value: ReaderSubscriptionsEnvelope) {
    envelope = value; revision++;
    try { options.storage.write(value); observed = JSON.stringify(value); } catch { /* Preserve dirty session intent. */ }
    notify();
  }
  function external() {
    if (!current()) return;
    try {
      const decoded = decodeReaderSubscriptions(options.storage.read()), encoded = JSON.stringify(decoded);
      if (encoded === observed) return;
      observed = encoded; blocked = decoded === null;
      if (decoded) { envelope = decoded; revision++; notify(); }
    } catch { /* Do not replace local intent on failed reads. */ }
  }
  function hydrate(epoch: number): Promise<void> {
    if (reading || !options.remote || !current(epoch) || !online() || blocked) return reading ?? Promise.resolve();
    const startedRevision = revision, owner = abort.signal;
    const work = Promise.resolve().then(async () => {
      try {
        if (!current(epoch) || owner.aborted) return;
        const response = await bounded(signal => options.remote!.read(signal), owner, timeoutMs);
        if (!current(epoch) || response.error !== null) return;
        external(); if (!current(epoch) || blocked || revision !== startedRevision) return;
        const remote = parseItems(response.data); if (!remote) return;
        const next = new Map(remote.map(item => [keyOf(item), item]));
        for (const mutation of envelope.pending) { if (mutation.item) next.set(mutation.key, mutation.item); else next.delete(mutation.key); }
        publish({ ...envelope, items: [...next.values()].slice(0, 100) });
      } catch { /* Explicit retry/online is the next opportunity. */ }
    }).finally(() => { if (reading === work) reading = null; });
    reading = work; return work;
  }
  function flush(epoch = generation): Promise<void> {
    if (sending || !options.remote || !current(epoch) || !online() || blocked) return sending ?? Promise.resolve();
    const owner = abort.signal;
    const work = Promise.resolve().then(async () => {
      const tried = new Set<string>();
      while (current(epoch) && !owner.aborted && online()) {
        external(); if (!current(epoch) || blocked) break;
        const mutation = envelope.pending.find(item => !tried.has(item.token)); if (!mutation) break;
        tried.add(mutation.token);
        try {
          const separator = mutation.key.indexOf(":"), type = mutation.key.slice(0, separator) as ReaderSubscription["type"], id = mutation.key.slice(separator + 1);
          const response = await bounded(signal => mutation.item ? options.remote!.save(mutation.item, signal) : options.remote!.remove(type, id, signal), owner, timeoutMs);
          if (!current(epoch) || response.error !== null) continue;
          external(); if (!current(epoch) || blocked) break;
          if (envelope.pending.some(item => item.token === mutation.token)) publish({ ...envelope, pending: envelope.pending.filter(item => item.token !== mutation.token) });
        } catch { /* Keep each failed token; no automatic retry loop. */ }
      }
    }).finally(() => { if (sending === work) sending = null; });
    sending = work; return work;
  }
  return Object.freeze({
    getSnapshot: () => envelope.items,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    forget() {
      sealed = true; generation++; abort.abort(); detach?.(); detach = undefined; leases.clear(); reading = null; sending = null;
      envelope = { schemaVersion: 1, items: [], pending: [] }; notify();
    },
    activate(lease: () => boolean) {
      if (sealed) return () => {};
      const first = leases.size === 0; leases.add(lease);
      if (first) { generation++; abort = new AbortController(); detach = options.listen?.(external, () => { void hydrate(generation); void flush(); }); }
      const epoch = generation; void hydrate(epoch); void flush(epoch);
      return () => { leases.delete(lease); if (!leases.size) { generation++; abort.abort(); detach?.(); detach = undefined; reading = null; sending = null; } };
    },
    toggle(input: Omit<ReaderSubscription, "createdAt">): boolean {
      if (!current()) return false;
      external(); if (!current() || blocked) return false;
      const item = parseItem({ ...input, createdAt: new Date((options.now ?? Date.now)()).toISOString() }); if (!item) return false;
      const key = keyOf(item), exists = envelope.items.some(value => keyOf(value) === key);
      const pending = envelope.pending.filter(value => value.key !== key);
      if (!exists && envelope.items.length >= 100 || options.remote && pending.length >= 100) return false;
      publish({ schemaVersion: 1, items: exists ? envelope.items.filter(value => keyOf(value) !== key) : [item, ...envelope.items],
        pending: options.remote ? [...pending, { key, token: `${prefix}:${++sequence}`, item: exists ? null : item }] : [] });
      if (current()) void flush(); return true;
    },
    retry(): Promise<void> { if (!current()) return Promise.resolve(); external(); return Promise.all([hydrate(generation), flush()]).then(() => {}); },
  });
}
