import { childDataNamespace, decodeChildDataScope, sameChildDataScope, type ChildDataScope } from "./childDataNamespace";
import { CHILD_ENTITY_KINDS } from "./childAccessPolicy";
import { CHILD_PACKAGE_MAX_BYTES, CHILD_PACKAGE_MAX_ENTITIES, childDataArray, childRecord, decodeChildEntityPayload,
  decodeChildEntityReference, type ChildEntityReference, type ChildPackageDigestPort } from "./childPackage";
import type { ChildIndexPurpose } from "./childIndex";

/** Partition I/O only. This is deliberately incompatible with admitted
 * ChildScopedDataRequest/ChildScopedDataPort: mayPublish controls local results,
 * never the actual native durable commit. A separately authenticated native
 * host-current binding under that commit lock is still required for admission. */
export interface ChildNativePartitionRequest {
  readonly purpose: ChildIndexPurpose; readonly scope: ChildDataScope; readonly key: string;
  /** Opaque local capability issued by openPartition; grants no child rights. */
  readonly partitionLease: object;
  mayPublish(): boolean;
}
export interface ChildNativePartitionPort {
  readPartition(request: ChildNativePartitionRequest, signal: AbortSignal): Promise<unknown>;
  comparePartition(request: ChildNativePartitionRequest, expectedRevision: number, value: unknown, signal: AbortSignal): Promise<boolean>;
}

export interface ChildNativePartitionChallenge { readonly ticket: number; readonly scope: ChildDataScope }
export interface ChildNativePartition {
  readonly handle: object; readonly scope: ChildDataScope; readonly generation: number; readonly nonce: string;
}
export interface ChildNativeBatchChallenge {
  readonly partition: ChildNativePartition;
  readonly reads: readonly Readonly<{ purpose: ChildIndexPurpose; key: string }>[];
  readonly writes: readonly Readonly<{ purpose: ChildIndexPurpose; key: string; expectedRevision: number; bytes: Uint8Array; checksum: string }>[];
}
export interface ChildNativeRetirementChallenge { readonly partition: ChildNativePartition }
/** Private, constructor-owned native transport. NO implementation/factory is
 * admitted here. It must use actual PlanetChildDataStore Lease/Cancellation,
 * check native full-scope/generation/nonce under its native shared lock, copy
 * bytes at enqueue, enforce its own continuous-time deadline and invoke actual
 * native cancellation on signal abort. JS mayPublish is never commit authority.
 * Activation returns {status:'partitioned',challenge:<same>,handle,generation,nonce}.
 * Batch returns {status:'committed',challenge:<same>,slots:[{purpose,key,revision,bytes,checksum}]},
 * with exactly its requested reads; native mutations must CAS and read back as
 * one atomic snapshot BEFORE success. Unavailable: {status:'unavailable',challenge:<same>}.
 * Result Uint8Array ownership transfers to this adapter, including late replies.
 * retire returns {status:'retired',challenge:<same>} only after actual native
 * retirement. close must retire/close that native owner, never another owner.
 * Standard native data storage grants NO PIN, reviewed content or child mode.
 */
export interface ChildNativeDataTransport {
  activate(challenge: ChildNativePartitionChallenge, signal: AbortSignal): Promise<unknown>;
  transact(challenge: ChildNativeBatchChallenge, signal: AbortSignal): Promise<unknown>;
  retire(challenge: ChildNativeRetirementChallenge, signal: AbortSignal): Promise<unknown>;
  close(): Promise<void>;
}
export interface ChildNativeDataOptions {
  readonly native: ChildNativeDataTransport; readonly digest: ChildPackageDigestPort;
  /** Local operation budget only; never review/PIN/OS time authority. */
  readonly clock: { nowMs(): number }; readonly timeoutMs: number;
  readonly initialVisibility: "active" | "background";
}
const purposes: readonly ChildIndexPurpose[] = ["search", "history", "cache", "offline"];
const id = /^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/u, hash = /^[a-f0-9]{64}$/u, nonce = /^[a-f0-9]{32}$/u;
const revision = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value < Number.MAX_SAFE_INTEGER;
const positive = (value: unknown): value is number => revision(value) && value > 0;
const bytePrototype = Object.getPrototypeOf(Uint8Array.prototype), byteLength = Object.getOwnPropertyDescriptor(bytePrototype, "byteLength")!.get!;
const byteOffset = Object.getOwnPropertyDescriptor(bytePrototype, "byteOffset")!.get!, byteBuffer = Object.getOwnPropertyDescriptor(bytePrototype, "buffer")!.get!;
function rawBytes(value: unknown, max: number): Uint8Array | null {
  try {
    if (!ArrayBuffer.isView(value) || Object.getPrototypeOf(value) !== Uint8Array.prototype) return null;
    const size = byteLength.call(value) as number, offset = byteOffset.call(value) as number, buffer = byteBuffer.call(value) as ArrayBufferLike;
    if (size < 1 || size > max || Object.getPrototypeOf(buffer) !== ArrayBuffer.prototype) return null;
    return new Uint8Array(buffer, offset, size);
  } catch { return null; }
}
function copyBytes(value: unknown): Uint8Array | null { const bytes = rawBytes(value, CHILD_PACKAGE_MAX_BYTES); return bytes ? new Uint8Array(bytes) : null; }
function wipe(bytes: Uint8Array) { try { Uint8Array.prototype.fill.call(bytes, 0); } catch { /* Detached native/crypto transfer is unusable. */ } }
function wipeResult(input: unknown) {
  // Cleanup is independent of decoder acceptance. Inspect only owned data
  // fields, at most 64 slots and 32 MiB; never enumerate fields or run getters.
  try {
    if (!input || typeof input !== "object") return;
    const descriptor = Object.getOwnPropertyDescriptor(input, "slots"), slots = descriptor && "value" in descriptor ? descriptor.value : null;
    if (!Array.isArray(slots)) return;
    const length = Object.getOwnPropertyDescriptor(slots, "length"), size: unknown = length && "value" in length ? length.value : null;
    if (typeof size !== "number" || !Number.isSafeInteger(size) || size < 0) return;
    let remaining = 32 * 1024 * 1024;
    for (let index = 0; index < Math.min(size, 64) && remaining > 0; index++) {
      try { const item = Object.getOwnPropertyDescriptor(slots, String(index)), slot = item && "value" in item ? item.value : null;
        if (!slot || typeof slot !== "object") continue;
        const field = Object.getOwnPropertyDescriptor(slot, "bytes"), bytes = field && "value" in field ? rawBytes(field.value, 32 * 1024 * 1024) : null;
        if (bytes) { const count = Math.min(bytes.length, remaining); Uint8Array.prototype.fill.call(bytes, 0, 0, count); remaining -= count; }
      } catch { /* A malformed descriptor cannot prevent cleanup of later slots. */ }
    }
  } catch { /* An inaccessible transfer cannot be decoded or safely traversed. */ }
}
function keyAllowed(scope: ChildDataScope, purpose: ChildIndexPurpose, key: unknown): key is string {
  if (typeof key !== "string") return false; const base = childDataNamespace(scope, purpose)!;
  if (purpose === "search" || purpose === "history") return key === base;
  if (!key.startsWith(base + "/item/")) return false;
  const parts = key.slice(base.length + 6).split("/");
  return parts.length === 2 && (CHILD_ENTITY_KINDS as readonly string[]).includes(parts[0]) && id.test(parts[1])
    && (purpose !== "offline" || parts[0] === "offline-package");
}
function copyReferences(input: unknown): readonly ChildEntityReference[] | null {
  const rows = childDataArray(input, CHILD_PACKAGE_MAX_ENTITIES); if (!rows) return null;
  const refs = rows.map(decodeChildEntityReference);
  return refs.some(ref => !ref) || new Set(refs.map(ref => `${ref!.kind}/${ref!.id}`)).size !== refs.length ? null : Object.freeze(refs as ChildEntityReference[]);
}
function canonicalSize(value: unknown) {
  const text = JSON.stringify(value); let bytes = 0;
  // Count exact UTF-8 without allocating a byte array. JSON escapes lone
  // surrogates, and its strings are bounded to one decoded entry at a time.
  for (let index = 0; index < text.length; index++) {
    const unit = text.charCodeAt(index);
    if (unit <= 0x7f) bytes++; else if (unit <= 0x7ff) bytes += 2;
    else if (unit >= 0xd800 && unit <= 0xdbff && index + 1 < text.length && text.charCodeAt(index + 1) >= 0xdc00 && text.charCodeAt(index + 1) <= 0xdfff) { bytes += 4; index++; }
    else bytes += 3;
  }
  return bytes;
}
/** Structural child data only. Current index/review still admits each entity. */
function envelope(input: unknown, scope: ChildDataScope, purpose: ChildIndexPurpose, key: string): unknown | null {
  try {
    if (purpose === "search" || purpose === "history") {
      const row = childRecord(input, ["schemaVersion", "scope", "references"]), refs = row && copyReferences(row.references);
      const copied = row?.schemaVersion === 1 && sameChildDataScope(row.scope, scope) && refs
        && refs.every(ref => ref.kind === (purpose === "search" ? "search-result" : "recent"))
        ? Object.freeze({ schemaVersion: 1, scope, references: refs }) : null;
      return copied && canonicalSize(copied) <= CHILD_PACKAGE_MAX_BYTES ? copied : null;
    }
    const row = childRecord(input, ["schemaVersion", "scope", "entries"]), raw = row && childDataArray(row.entries, CHILD_PACKAGE_MAX_ENTITIES);
    if (row?.schemaVersion !== 1 || !sameChildDataScope(row.scope, scope) || !raw?.length) return null;
    const entries: Readonly<{ reference: ChildEntityReference; payload: NonNullable<ReturnType<typeof decodeChildEntityPayload>> }>[] = [];
    let size = canonicalSize({ schemaVersion: 1, scope, entries: [] });
    for (const input of raw) { const entry = childRecord(input, ["reference", "payload"]), reference = entry && decodeChildEntityReference(entry.reference), payload = entry && decodeChildEntityPayload(entry.payload);
      if (!reference || !payload) return null; const copied = Object.freeze({ reference, payload });
      const increment = canonicalSize(copied) + (entries.length ? 1 : 0);
      if (increment > CHILD_PACKAGE_MAX_BYTES - size) return null;
      size += increment; entries.push(copied); }
    const keys = new Map(entries.map(entry => [`${entry.reference.kind}/${entry.reference.id}`, entry.reference.contentChecksum]));
    if (keys.size !== entries.length || key !== `${childDataNamespace(scope, purpose)}/item/${entries[0].reference.kind}/${entries[0].reference.id}`
      || entries.some(entry => entry.payload.references.some(ref => keys.get(`${ref.kind}/${ref.id}`) !== ref.contentChecksum))) return null;
    return Object.freeze({ schemaVersion: 1, scope, entries: Object.freeze(entries) });
  } catch { return null; }
}
type Context = { partition: ChildNativePartition; ticket: number; lease: object };
type Request = { purpose: ChildIndexPurpose; key: string; scope: ChildDataScope; lease: object; current: () => boolean };
type Slot = Readonly<{ revision: number; value: unknown }>;
type Operation = { abort: AbortController; valid(): boolean; finish(value: unknown): void; cleanups: (() => void)[] };

/** Functional private four-purpose data PARTITION protocol adapter. It does
 * NOT implement ChildScopedDataPort or ChildDataTransactionPort: admitted
 * host-current checks must participate in the native durable commit lock,
 * whereas this API's mayPublish callback only controls local publication.
 * One unresolved job and one queued retirement prevent IPC/byte accumulation.
 * Local abort settles promptly; native capacity remains sealed until the real
 * promise completes. Host must erase its views before lifecycle changes. No App
 * registration, actual native transport, installed OS or child activation is
 * supplied by this module. CAS false can mean conflict or unknown committed ack.
 */
export function createNativeChildPartitionData(options: ChildNativeDataOptions) {
  const timeoutMs = options?.timeoutMs;
  if (!options || typeof options.native?.activate !== "function" || typeof options.native?.transact !== "function"
    || typeof options.native?.retire !== "function" || typeof options.native?.close !== "function" || typeof options.digest?.sha256 !== "function"
    || typeof options.clock?.nowMs !== "function" || !Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 60_000
    || options.initialVisibility !== "active" && options.initialVisibility !== "background") throw new TypeError("Explicit private native data transport required");
  const native = options.native, digest = options.digest.sha256.bind(options.digest), clock = options.clock.nowMs.bind(options.clock);
  let ticket = 0, active: Context | null = null, busy = false, disposed = false, broken = false, visible = options.initialVisibility === "active", lastNow = -1;
  let operation: Operation | null = null, retiring: { context: Context; start: () => void; answer: Promise<boolean> } | null = null;
  let closeRequested = false, closeStarted = false, closeAnswer: Promise<boolean> | null = null, resolveClose: ((value: boolean) => void) | null = null;
  const handles = new WeakSet<object>(), nonces = new Set<string>();
  function now() { try { const at = clock(); if (!Number.isFinite(at) || at < 0 || at < lastNow) { broken = true; return null; } lastNow = at; return at; } catch { broken = true; return null; } }
  function invalidate() { const old = active; active = null; ticket++; operation?.abort.abort(); return old; }
  function capture(input: unknown, purpose: ChildIndexPurpose): { request: Request; context: Context } | null {
    try { const row = childRecord(input, ["purpose", "scope", "key", "partitionLease", "mayPublish"]), scope = row && decodeChildDataScope(row.scope), context = active;
    if (!row || !scope || !context || row.purpose !== purpose || !keyAllowed(scope, purpose, row.key) || !sameChildDataScope(scope, context.partition.scope)
      || row.partitionLease !== context.lease || typeof row.mayPublish !== "function") return null;
    const request = { purpose, key: row.key, scope, lease: context.lease, current: row.mayPublish as () => boolean };
    return current(input, request, context) ? { request, context } : null;
    } catch { return null; }
  }
  function binding(input: unknown, request: Request, context: Context) {
    try { const row = childRecord(input, ["purpose", "scope", "key", "partitionLease", "mayPublish"]);
      const same = row?.purpose === request.purpose && row.key === request.key && row.partitionLease === request.lease && row.mayPublish === request.current
        && sameChildDataScope(row.scope, request.scope);
      return same && !disposed && !broken && visible && active === context && ticket === context.ticket && context.lease === request.lease;
    } catch { return false; }
  }
  function current(input: unknown, request: Request, context: Context) {
    try { return binding(input, request, context) && request.current() === true && binding(input, request, context); } catch { return false; }
  }
  function run<T>(external: AbortSignal | null, valid: () => boolean, task: (op: Operation) => Promise<T>, bypassRetirement = false, stable: () => boolean = () => true): Promise<T | null> {
    const started = now(); if (busy || !bypassRetirement && retiring || started === null || external?.aborted || !valid() || !stable()) return Promise.resolve(null);
    if (busy || !bypassRetirement && retiring || external?.aborted) return Promise.resolve(null); // Reentrant preflight cannot acquire a second job.
    busy = true;
    return new Promise(resolve => {
      let settled = false; const deadline = started + timeoutMs;
      const op: Operation = { abort: new AbortController(), cleanups: [], valid() { const before = now(); if (before === null || before >= deadline || op.abort.signal.aborted || external?.aborted || !valid()) return false;
        if (!valid()) return false; const after = now(); return after !== null && after < deadline && !op.abort.signal.aborted && !external?.aborted && stable(); },
        finish(value) { if (settled) return; settled = true; clearTimeout(timer); external?.removeEventListener("abort", cancel); op.abort.signal.removeEventListener("abort", cancel); resolve(value as T | null); } };
      const cancel = () => { if (!op.abort.signal.aborted) op.abort.abort(); for (const cleanup of op.cleanups) cleanup(); op.finish(null); };
      const timer = setTimeout(cancel, timeoutMs); external?.addEventListener("abort", cancel, { once: true }); op.abort.signal.addEventListener("abort", cancel, { once: true }); operation = op;
      const completed = (value: T | null) => {
        const allowed = op.valid(); for (const cleanup of op.cleanups) cleanup();
        if (operation === op) operation = null; busy = false;
        // Actual completion releases capacity BEFORE successful publication.
        // Early abort/timeout still leaves it held until this path runs.
        op.finish(allowed ? value : null); retiring?.start(); flushClose();
      };
      void Promise.resolve().then(() => op.valid() ? task(op) : null).then(completed, () => completed(null));
    });
  }
  function queueRetirement(context: Context | null): Promise<boolean> {
    if (!context) return retiring?.answer ?? Promise.resolve(true); if (retiring) return retiring.answer;
    let resolve!: (value: boolean) => void, started = false, answered = false;
    const answer = new Promise<boolean>(done => { resolve = value => { if (!answered) { answered = true; clearTimeout(timer); done(value); } }; });
    const timer = setTimeout(() => resolve(false), timeoutMs);
    const queued = { context, answer, start() { if (busy || started) return; started = true;
      const challenge = Object.freeze({ partition: context.partition });
      void run(null, () => true, async op => {
        const raw = await native.retire(challenge, op.abort.signal), row = childRecord(raw, ["status", "challenge"]);
        return row?.status === "retired" && row.challenge === challenge;
      }, true).then(value => { if (retiring === queued) retiring = null; if (value !== true) broken = true; resolve(value === true); flushClose(); });
    } }; retiring = queued; queued.start(); return answer;
  }
  function flushClose() {
    if (!closeRequested || closeStarted || busy || retiring) return; closeStarted = true; busy = true;
    void Promise.resolve().then(() => native.close()).then(() => resolveClose?.(true), () => { broken = true; resolveClose?.(false); }).finally(() => { busy = false; });
  }
  async function checksumOwned(bytes: Uint8Array, op: Operation) {
    const owned = bytes.slice(); op.cleanups.push(() => wipe(owned));
    try { return await digest(owned); } finally { wipe(owned); }
  }
  function partition(raw: unknown, challenge: ChildNativePartitionChallenge): ChildNativePartition | null {
    const row = childRecord(raw, ["status", "challenge", "handle", "generation", "nonce"]);
    if (!row || row.status !== "partitioned" || row.challenge !== challenge || !row.handle || typeof row.handle !== "object" || Array.isArray(row.handle)
      || !positive(row.generation) || typeof row.nonce !== "string" || !nonce.test(row.nonce) || handles.has(row.handle) || nonces.has(row.nonce) || nonces.size >= 4096) return null;
    handles.add(row.handle); nonces.add(row.nonce);
    return Object.freeze({ handle: row.handle, scope: challenge.scope, generation: row.generation, nonce: row.nonce });
  }
  async function readNative(op: Operation, context: Context, request: Request): Promise<Slot | null> {
    const challenge: ChildNativeBatchChallenge = Object.freeze({ partition: context.partition, reads: Object.freeze([Object.freeze({ purpose: request.purpose, key: request.key })]), writes: Object.freeze([]) });
    const raw = await native.transact(challenge, op.abort.signal);
    try {
      const row = childRecord(raw, ["status", "challenge", "slots"]), slots = row && childDataArray(row.slots, 1);
      if (!op.valid() || row?.status !== "committed" || row.challenge !== challenge || slots?.length !== 1) return null;
      const slot = childRecord(slots[0], ["purpose", "key", "revision", "bytes", "checksum"]);
      if (!slot || slot.purpose !== request.purpose || slot.key !== request.key || !revision(slot.revision)) return null;
      if (slot.revision === 0) return slot.bytes === null && slot.checksum === null ? Object.freeze({ revision: 0, value: null }) : null;
      if (typeof slot.checksum !== "string" || !hash.test(slot.checksum)) return null;
      const bytes = copyBytes(slot.bytes); if (!bytes) return null; op.cleanups.push(() => wipe(bytes));
      const actual = await checksumOwned(bytes, op); if (!op.valid() || actual !== slot.checksum) return null;
      let decoded: unknown; try { decoded = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); } catch { return null; }
      const copied = envelope(decoded, request.scope, request.purpose, request.key);
      // Native stores validate duplicate keys. Canonical exact bytes here also
      // reject duplicate/unknown/alternate JSON before returning a TS envelope.
      if (copied === null || JSON.stringify(copied) !== new TextDecoder().decode(bytes)) return null;
      return op.valid() ? Object.freeze({ revision: slot.revision, value: copied }) : null;
    } finally { wipeResult(raw); }
  }
  async function read(input: ChildNativePartitionRequest, purpose: ChildIndexPurpose, signal: AbortSignal): Promise<Slot | null> {
    if (!(signal instanceof AbortSignal)) return null; const captured = capture(input, purpose); if (!captured) return null;
    return run(signal, () => current(input, captured.request, captured.context), op => readNative(op, captured.context, captured.request), false, () => binding(input, captured.request, captured.context));
  }
  async function compare(input: ChildNativePartitionRequest, purpose: ChildIndexPurpose, expected: number, value: unknown, signal: AbortSignal) {
    if (!(signal instanceof AbortSignal) || !revision(expected) || expected >= Number.MAX_SAFE_INTEGER - 1) return false;
    const captured = capture(input, purpose); if (!captured) return false;
    const { request, context } = captured;
    const result = await run(signal, () => current(input, request, context), async op => {
      const copied = envelope(value, request.scope, purpose, request.key); if (copied === null) return false;
      const bytes = new TextEncoder().encode(JSON.stringify(copied)); if (bytes.length > CHILD_PACKAGE_MAX_BYTES) { wipe(bytes); return false; }
      const sent = bytes.slice(); op.cleanups.push(() => wipe(bytes), () => wipe(sent));
      const checksum = await checksumOwned(bytes, op); if (!op.valid() || typeof checksum !== "string" || !hash.test(checksum)) return false;
      const challenge: ChildNativeBatchChallenge = Object.freeze({ partition: context.partition, reads: Object.freeze([]), writes: Object.freeze([Object.freeze({ purpose, key: request.key, expectedRevision: expected, bytes: sent, checksum })]) });
      const raw = await native.transact(challenge, op.abort.signal);
      try { const row = childRecord(raw, ["status", "challenge", "slots"]), slots = row && childDataArray(row.slots, 0);
        if (!op.valid() || row?.status !== "committed" || row.challenge !== challenge || !slots || slots.length !== 0 || sent.length !== bytes.length || sent.some((byte, index) => byte !== bytes[index])) return false;
      } finally { wipeResult(raw); }
      const actual = await readNative(op, context, request);
      return op.valid() && actual?.revision === expected + 1 && JSON.stringify(actual.value) === JSON.stringify(copied);
    }, false, () => binding(input, request, context)); return result === true;
  }
  const partitions = Object.freeze(Object.fromEntries(purposes.map(purpose => [purpose, Object.freeze({
    readPartition: (request: ChildNativePartitionRequest, signal: AbortSignal) => read(request, purpose, signal),
    comparePartition: (request: ChildNativePartitionRequest, expected: number, value: unknown, signal: AbortSignal) => compare(request, purpose, expected, value, signal),
  })])) as Readonly<Record<ChildIndexPurpose, ChildNativePartitionPort>>);
  return Object.freeze({ partitions,
    async openPartition(input: unknown): Promise<object | null> {
      const previous = invalidate(), capturedTicket = ticket, scope = decodeChildDataScope(input);
      if (!scope || disposed || !visible || broken || !await queueRetirement(previous) || ticket !== capturedTicket) return null;
      const challenge = Object.freeze({ ticket: capturedTicket, scope });
      const result = await run(null, () => !disposed && visible && !broken && ticket === capturedTicket, async op => {
        const raw = await native.activate(challenge, op.abort.signal), owned = partition(raw, challenge);
        if (!owned) return null;
        const context: Context = { partition: owned, ticket: capturedTicket, lease: Object.freeze({}) };
        if (!op.valid()) { void queueRetirement(context); return null; }
        active = context; return context.lease;
      }, false, () => !disposed && visible && !broken && ticket === capturedTicket); return result;
    },
    retire() { return queueRetirement(invalidate()); },
    background() { visible = false; return queueRetirement(invalidate()); },
    foreground() { const retired = queueRetirement(invalidate()); if (!disposed && !broken) visible = true; return retired; },
    dispose() {
      if (closeAnswer) return closeAnswer; const previous = invalidate(); disposed = true; closeRequested = true;
      let answered = false; closeAnswer = new Promise<boolean>(resolve => { resolveClose = value => { if (!answered) { answered = true; clearTimeout(timer); resolve(value); } };
        const timer = setTimeout(() => resolveClose?.(false), timeoutMs);
      }); void queueRetirement(previous); flushClose(); return closeAnswer;
    },
    getSnapshot() { return Object.freeze({ phase: disposed ? "disposed" as const : broken ? "unavailable" as const : active ? "ready" as const : "sealed" as const,
      scope: active?.partition.scope ?? null, nativeAuthority: false }); },
  });
}
