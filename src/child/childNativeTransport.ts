import { CHILD_ENTITY_KINDS } from "./childAccessPolicy";
import { childDataNamespace, decodeChildDataScope, sameChildDataScope, type ChildDataScope } from "./childDataNamespace";
import { CHILD_PACKAGE_MAX_BYTES, childDataArray, childRecord, type ChildPackageDigestPort } from "./childPackage";
import type { ChildIndexPurpose } from "./childIndex";
import type { ChildNativeBatchChallenge, ChildNativeDataTransport,
  ChildNativePartitionChallenge, ChildNativeRetirementChallenge } from "./childNativeData";

/** Private typed DTO boundary, supplied by the owner constructing the native
 * coordinator. No raw wrapper JSON, global plugin lookup or default fixture.
 * Own-data dictionaries use version=1, 32-lowerhex request IDs and exact fields.
 * Correlated unavailable replies are actual completion ACKs. RPC rejection or
 * malformed replies do NOT establish native completion. cancel only requests
 * cancellation; close must accept a control request while a data job is held
 * and ACK only after all this native owner's work and leases have finished.
 * Actual JNI/Swift host registration and admitted host-current remain separate.
 */
export interface ChildPrivateNativeRpc {
  activate(request: unknown): Promise<unknown>;
  transact(request: unknown): Promise<unknown>;
  retire(request: unknown): Promise<unknown>;
  cancel(request: unknown): Promise<unknown>;
  close(request: unknown): Promise<unknown>;
}
export interface ChildNativeTransportOptions {
  readonly rpc: ChildPrivateNativeRpc;
  readonly digest: ChildPackageDigestPort;
  readonly clock: { nowMs(): number };
  readonly timeoutMs: number;
}
const MAX_SLOTS = 64, MAX_BATCH_BYTES = 32 * 1024 * 1024, MAX_DATA_JOBS = 2048;
const token = (v: unknown): v is string => typeof v === "string" && /^[a-f0-9]{32}$/u.test(v);
const hash = (v: unknown): v is string => typeof v === "string" && /^[a-f0-9]{64}$/u.test(v);
const revision = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0 && v < Number.MAX_SAFE_INTEGER;
const purposes: readonly ChildIndexPurpose[] = ["search", "history", "cache", "offline"];
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const bytePrototype = Object.getPrototypeOf(Uint8Array.prototype);
const byteLength = Object.getOwnPropertyDescriptor(bytePrototype, "byteLength")!.get!;
const byteOffset = Object.getOwnPropertyDescriptor(bytePrototype, "byteOffset")!.get!;
const byteBuffer = Object.getOwnPropertyDescriptor(bytePrototype, "buffer")!.get!;
function copyBytes(value: unknown, remaining = CHILD_PACKAGE_MAX_BYTES): Uint8Array | null {
  try {
    if (!ArrayBuffer.isView(value) || Object.getPrototypeOf(value) !== Uint8Array.prototype) return null;
    const size = byteLength.call(value) as number, offset = byteOffset.call(value) as number, buffer = byteBuffer.call(value) as ArrayBufferLike;
    if (size < 1 || size > Math.min(CHILD_PACKAGE_MAX_BYTES, remaining) || Object.getPrototypeOf(buffer) !== ArrayBuffer.prototype) return null;
    return new Uint8Array(new Uint8Array(buffer, offset, size));
  } catch { return null; }
}
function wipe(bytes: Uint8Array) { try { Uint8Array.prototype.fill.call(bytes, 0); } catch { /* Detached owned transfer. */ } }
function encoded(bytes: Uint8Array): string {
  // At most 8 MiB; chunks avoid a variadic call or repeated whole-string copy.
  const chunks: string[] = []; let chunk = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const left = bytes.length - i, n = bytes[i] * 65536 + (left > 1 ? bytes[i + 1] * 256 : 0) + (left > 2 ? bytes[i + 2] : 0);
    chunk += alphabet[n >>> 18] + alphabet[(n >>> 12) & 63] + (left > 1 ? alphabet[(n >>> 6) & 63] : "=") + (left > 2 ? alphabet[n & 63] : "=");
    if (chunk.length >= 16384) { chunks.push(chunk); chunk = ""; }
  }
  if (chunk) chunks.push(chunk); return chunks.join("");
}
function base64Size(value: unknown): number | null {
  // Check encoded and decoded bounds BEFORE allocating the decoded buffer.
  if (typeof value !== "string" || value.length < 4 || value.length > Math.ceil(CHILD_PACKAGE_MAX_BYTES / 3) * 4 || value.length % 4 !== 0) return null;
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0, length = value.length / 4 * 3 - padding;
  if (length < 1 || length > CHILD_PACKAGE_MAX_BYTES) return null;
  for (let i = 0; i < value.length - padding; i++) if (alphabet.indexOf(value[i]) < 0) return null;
  if (padding === 2 && (alphabet.indexOf(value[value.length - 3]) & 15) !== 0 || padding === 1 && (alphabet.indexOf(value[value.length - 2]) & 3) !== 0) return null;
  return length;
}
function decoded(value: string, length: number): Uint8Array {
  const bytes = new Uint8Array(length); let offset = 0;
  for (let i = 0; i < value.length; i += 4) {
    const n = alphabet.indexOf(value[i]) * 262144 + alphabet.indexOf(value[i + 1]) * 4096
      + (value[i + 2] === "=" ? 0 : alphabet.indexOf(value[i + 2]) * 64) + (value[i + 3] === "=" ? 0 : alphabet.indexOf(value[i + 3]));
    bytes[offset++] = n >>> 16; if (offset < length) bytes[offset++] = (n >>> 8) & 255; if (offset < length) bytes[offset++] = n & 255;
  }
  return bytes;
}
function keyAllowed(scope: ChildDataScope, purpose: unknown, key: unknown): purpose is ChildIndexPurpose {
  if (!(purposes as readonly unknown[]).includes(purpose) || typeof key !== "string") return false;
  const base = childDataNamespace(scope, purpose)!;
  if (purpose === "search" || purpose === "history") return key === base;
  if (!key.startsWith(base + "/item/")) return false;
  const parts = key.slice(base.length + 6).split("/");
  return parts.length === 2 && (CHILD_ENTITY_KINDS as readonly string[]).includes(parts[0])
    && /^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/u.test(parts[1]) && (purpose !== "offline" || parts[0] === "offline-package");
}
type Lease = { handle: object; ownerToken: string; leaseToken: string; scope: ChildDataScope; generation: number; nonce: string; live: boolean };
type Job = { id: string; signal: AbortSignal | null; deadline: number; cancelled: boolean; dispatched: boolean; acknowledged: boolean; cancelSent: boolean; owned: Uint8Array[]; cancel(): void };
type Read = Readonly<{ purpose: ChildIndexPurpose; key: string }>;
type Write = Readonly<{ purpose: ChildIndexPurpose; key: string; expectedRevision: number; bytes: Uint8Array; checksum: string }>;
type QueuedRetirement = { lease: Lease; challenge: ChildNativeRetirementChallenge; signal: AbortSignal | null; resolve(value: unknown): void; started: boolean };
const unavailable = (challenge: unknown) => Object.freeze({ status: "unavailable", challenge });

/** Functional private RPC transport for PlanetChildDataStore coordinators.
 * Tokens map only to their native-issued owner/lease and actual generation/
 * nonce; JS handles and challenge identity never cross the typed wire. This
 * grants partition I/O only, no ChildScopedDataPort, host-current, PIN, review,
 * profile/package authority or child mode. One data job, cancellation control,
 * close control and queued retirement bound unresolved native work. Each owner
 * permits at most 2048 data jobs and one cancellation per job plus one close,
 * thus at most 4097 never-reused wire IDs; exhaustion seals and closes the owner.
 * Native replay tombstones must independently enforce the same finite bound.
 * Local abort
 * never releases a native job; only its exact completion or owner-closed ACK
 * does. Unknown ACKs seal the owner and trigger its actual private close.
 */
export function createChildNativeTransport(options: ChildNativeTransportOptions): ChildNativeDataTransport {
  const timeoutMs = options?.timeoutMs;
  if (!options || !Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 60_000
    || typeof options.clock?.nowMs !== "function" || typeof options.digest?.sha256 !== "function"
    || ["activate", "transact", "retire", "cancel", "close"].some(method => typeof options.rpc?.[method as keyof ChildPrivateNativeRpc] !== "function")) throw new TypeError("Explicit owned private native RPC required");
  const rpc = Object.freeze({ activate: options.rpc.activate.bind(options.rpc), transact: options.rpc.transact.bind(options.rpc),
    retire: options.rpc.retire.bind(options.rpc), cancel: options.rpc.cancel.bind(options.rpc), close: options.rpc.close.bind(options.rpc) });
  const digest = options.digest.sha256.bind(options.digest), clock = options.clock.nowMs.bind(options.clock);
  const handles = new WeakMap<object, Lease>(), usedLeases = new Set<string>(), usedNonces = new Set<string>();
  let ownerToken: string | null = null, active: Lease | null = null, job: Job | null = null, cancellation: Promise<void> | null = null;
  let retirement: QueuedRetirement | null = null, preparing = false, closing = false, closeStarted = false, closed = false, broken = false, sequence = 0, dataJobs = 0, lastNow = -1;
  let closeWaiter: (() => void) | null = null;
  let resolveClosed!: () => void; const closedAck = new Promise<void>(resolve => { resolveClosed = resolve; });
  function nextId() { if (!Number.isSafeInteger(++sequence) || sequence >= Number.MAX_SAFE_INTEGER) throw new RangeError("Private operation budget exhausted"); return sequence.toString(16).padStart(32, "0"); }
  function now(): number | null {
    try { const value = clock(); if (!Number.isFinite(value) || value < 0 || value < lastNow) { broken = true; return null; } lastNow = value; return value; }
    catch { broken = true; return null; }
  }
  function alive(op: Job) { const value = now(); return value !== null && value < op.deadline && !op.cancelled && !op.signal?.aborted && !closed && !closing && !broken; }
  function budget(op: Job, cleanup = false): number | null {
    const at = now(), remaining = at === null ? 0 : Math.floor(op.deadline - at);
    if (cleanup) return Math.max(1, Math.min(timeoutMs, remaining));
    return remaining > 0 && !op.cancelled && !op.signal?.aborted && !closed && !closing && !broken ? Math.min(timeoutMs, remaining) : null;
  }
  function header(raw: unknown, id: string, fields: readonly string[]) {
    const row = childRecord(raw, fields); return row?.version === 1 && row.requestId === id ? row : null;
  }
  function unavailableAck(raw: unknown, op: Job) { const row = header(raw, op.id, ["version", "requestId", "status"]); if (row?.status !== "unavailable") return false; op.acknowledged = true; return true; }
  function wireLease(lease: Lease) { return { ownerToken: lease.ownerToken, leaseToken: lease.leaseToken, scope: lease.scope, generation: lease.generation, nonce: lease.nonce }; }
  function matchesLease(row: Record<string, unknown>, lease: Lease) { return row.ownerToken === lease.ownerToken && row.leaseToken === lease.leaseToken
    && row.generation === lease.generation && row.nonce === lease.nonce && sameChildDataScope(row.scope, lease.scope); }
  function capturePartition(input: unknown): Lease | null {
    try { const row = childRecord(input, ["handle", "scope", "generation", "nonce"]), lease = row?.handle && typeof row.handle === "object" ? handles.get(row.handle) : null;
      return lease && lease.live && active === lease && row!.generation === lease.generation && row!.nonce === lease.nonce && sameChildDataScope(row!.scope, lease.scope) ? lease : null;
    } catch { return null; }
  }
  async function checksum(bytes: Uint8Array, op: Job) {
    const owned = bytes.slice(); op.owned.push(owned); try { return await digest(owned); } finally { wipe(owned); }
  }
  function requestClose() {
    closing = true; if (active) active.live = false; active = null; job?.cancel();
    if (closeStarted) return closedAck; closeStarted = true;
    const request = Object.freeze({ version: 1, requestId: nextId(), timeoutMs, ownerToken });
    // Dedicated native owner-close control is allowed while data/cancel work
    // is held. Its native coordinator must queue actual cleanup and then ACK.
    void Promise.resolve().then(() => rpc.close(request)).then(raw => {
      const row = header(raw, request.requestId, ["version", "requestId", "status", "ownerToken"]);
      if (row?.status !== "closed" || !token(row.ownerToken) || ownerToken !== null && row.ownerToken !== ownerToken) { broken = true; return; }
      ownerToken = row.ownerToken; closed = true; for (const bytes of job?.owned ?? []) wipe(bytes);
      if (retirement) { retirement.resolve(unavailable(retirement.challenge)); retirement = null; } closeWaiter?.(); resolveClosed();
    }, () => { broken = true; });
    return closedAck;
  }
  function cancelNative(op: Job) {
    if (!op.dispatched || op.cancelSent || closed) return; op.cancelSent = true;
    if (cancellation) { broken = true; void requestClose(); return; }
    const request = Object.freeze({ version: 1, requestId: nextId(), targetRequestId: op.id });
    const pending = Promise.resolve().then(() => rpc.cancel(request)).then(raw => {
      const row = header(raw, request.requestId, ["version", "requestId", "status", "targetRequestId"]);
      if (row?.status !== "cancellation-requested" || row.targetRequestId !== op.id) { broken = true; void requestClose(); }
    }, () => { broken = true; void requestClose(); }).finally(() => { if (cancellation === pending) cancellation = null; pumpRetirement(); });
    cancellation = pending;
  }
  function normalAvailable() { return !preparing && !job && !cancellation && !retirement && !closing && !closed && !broken; }
  function run(challenge: unknown, signal: AbortSignal | null, task: (op: Job) => Promise<unknown>, cleanup = false, initialOwned: Uint8Array[] = []): Promise<unknown> {
    if (job || !cleanup && !normalAvailable()) { initialOwned.forEach(wipe); return Promise.resolve(unavailable(challenge)); }
    if (dataJobs >= MAX_DATA_JOBS) { initialOwned.forEach(wipe); broken = true; void requestClose(); return Promise.resolve(unavailable(challenge)); }
    dataJobs++;
    const op: Job = { id: nextId(), signal, deadline: 0, cancelled: signal?.aborted === true, dispatched: false, acknowledged: false, cancelSent: false, owned: initialOwned,
      cancel() { op.cancelled = true; for (const bytes of op.owned) wipe(bytes); cancelNative(op); } };
    job = op; const started = now(); op.deadline = started === null ? 0 : started + timeoutMs;
    if (started === null || !cleanup && signal?.aborted) { initialOwned.forEach(wipe); job = null; if (broken) void requestClose(); return Promise.resolve(unavailable(challenge)); }
    const abort = () => op.cancel(), timer = setTimeout(abort, timeoutMs); signal?.addEventListener("abort", abort, { once: true });
    const taskResult = Promise.resolve().then(() => task(op)).catch(async () => {
      if (op.dispatched && !op.acknowledged) { broken = true; await requestClose(); } return unavailable(challenge);
    }).then(async result => {
      if (op.dispatched && !op.acknowledged) { broken = true; await requestClose(); }
      return result;
    });
    // Only one removable close waiter. Attaching a permanent closedAck.then
    // per successful job would retain every previous challenge/byte buffer.
    let onClosed!: () => void;
    const ownerEnded = new Promise<unknown>(resolve => { onClosed = () => resolve(unavailable(challenge)); closeWaiter = onClosed; });
    return Promise.race([taskResult, ownerEnded]).finally(() => {
      clearTimeout(timer); signal?.removeEventListener("abort", abort); for (const bytes of op.owned) wipe(bytes);
      if (closeWaiter === onClosed) closeWaiter = null; op.owned.length = 0;
      if (job === op) job = null; if (broken && !closing) void requestClose(); pumpRetirement();
    });
  }
  function enqueueRetirement(lease: Lease, challenge: ChildNativeRetirementChallenge, signal: AbortSignal | null): Promise<unknown> {
    if (retirement || closing || closed) return Promise.resolve(unavailable(challenge));
    lease.live = false; if (active === lease) active = null;
    return new Promise(resolve => { retirement = { lease, challenge, signal, resolve, started: false }; pumpRetirement(); });
  }
  function pumpRetirement() {
    const queued = retirement; if (!queued || queued.started || job || cancellation || closing || closed) return;
    queued.started = true;
    void run(queued.challenge, queued.signal, async op => {
      const request = Object.freeze({ version: 1, requestId: op.id, timeoutMs: budget(op, true)!, ...wireLease(queued.lease) });
      op.dispatched = true; if (op.cancelled) cancelNative(op);
      const raw = await rpc.retire(request); if (unavailableAck(raw, op)) return unavailable(queued.challenge);
      const row = header(raw, op.id, ["version", "requestId", "status", "ownerToken", "leaseToken", "scope", "generation", "nonce"]);
      if (row?.status !== "retired" || !matchesLease(row, queued.lease)) return unavailable(queued.challenge);
      op.acknowledged = true; return alive(op) ? Object.freeze({ status: "retired", challenge: queued.challenge }) : unavailable(queued.challenge);
    }, true).then(result => { if (retirement === queued) retirement = null; queued.resolve(result); if ((result as { status: string }).status !== "retired" && !closing) { broken = true; void requestClose(); } });
  }
  async function activate(challenge: ChildNativePartitionChallenge, signal: AbortSignal): Promise<unknown> {
    let scope: ChildDataScope | null = null;
    try { const row = childRecord(challenge, ["ticket", "scope"]); scope = row && revision(row.ticket) && row.ticket > 0 ? decodeChildDataScope(row.scope) : null; } catch { /* Invalid data descriptors. */ }
    if (!scope || !(signal instanceof AbortSignal)) return unavailable(challenge); const ownedScope = scope;
    return run(challenge, signal, async op => {
      if (!alive(op)) return unavailable(challenge);
      const remaining = budget(op); if (remaining === null) return unavailable(challenge);
      const request = Object.freeze({ version: 1, requestId: op.id, timeoutMs: remaining, ownerToken, scope: ownedScope });
      op.dispatched = true; const raw = await rpc.activate(request); if (unavailableAck(raw, op)) return unavailable(challenge);
      const row = header(raw, op.id, ["version", "requestId", "status", "ownerToken", "leaseToken", "scope", "generation", "nonce"]);
      if (row?.status !== "partitioned" || !token(row.ownerToken) || ownerToken !== null && row.ownerToken !== ownerToken || !token(row.leaseToken)
        || !revision(row.generation) || row.generation < 1 || !token(row.nonce) || !sameChildDataScope(row.scope, ownedScope)
        || usedLeases.has(row.leaseToken) || usedNonces.has(row.nonce) || usedLeases.size >= 4096) return unavailable(challenge);
      if (closed || closing) { op.acknowledged = true; return unavailable(challenge); }
      ownerToken = row.ownerToken; usedLeases.add(row.leaseToken); usedNonces.add(row.nonce);
      const lease: Lease = { handle: Object.freeze({}), ownerToken, leaseToken: row.leaseToken, scope: ownedScope, generation: row.generation, nonce: row.nonce, live: true };
      if (active) active.live = false; handles.set(lease.handle, lease); active = lease; op.acknowledged = true;
      if (!alive(op)) { if (!closing) void enqueueRetirement(lease, Object.freeze({ partition: Object.freeze({ handle: lease.handle, scope: lease.scope, generation: lease.generation, nonce: lease.nonce }) }), null); return unavailable(challenge); }
      return Object.freeze({ status: "partitioned", challenge, handle: lease.handle, generation: lease.generation, nonce: lease.nonce });
    });
  }
  async function transact(challenge: ChildNativeBatchChallenge, signal: AbortSignal): Promise<unknown> {
    if (!(signal instanceof AbortSignal) || !normalAvailable()) return unavailable(challenge);
    // Capture before this async method returns, and before clock/digest/RPC
    // callbacks. The reserved preparation lane prevents reentrant enqueue.
    const owned: Uint8Array[] = []; let snapshot: { lease: Lease; reads: Read[]; writes: Write[] } | null = null;
    preparing = true;
    try {
      const row = childRecord(challenge, ["partition", "reads", "writes"]), lease = row && capturePartition(row.partition);
      const rawReads = row && childDataArray(row.reads, MAX_SLOTS), rawWrites = row && childDataArray(row.writes, MAX_SLOTS);
      if (!lease || !rawReads || !rawWrites || rawReads.length + rawWrites.length > MAX_SLOTS || rawReads.length + rawWrites.length < 1) return unavailable(challenge);
      const reads: Read[] = [], writes: Write[] = []; let remaining = MAX_BATCH_BYTES;
      for (const input of rawReads) { const r = childRecord(input, ["purpose", "key"]); if (!r || !keyAllowed(lease.scope, r.purpose, r.key)) return unavailable(challenge); reads.push(Object.freeze({ purpose: r.purpose, key: r.key as string })); }
      for (const input of rawWrites) { const w = childRecord(input, ["purpose", "key", "expectedRevision", "bytes", "checksum"]);
        if (!w || !keyAllowed(lease.scope, w.purpose, w.key) || !revision(w.expectedRevision) || w.expectedRevision >= Number.MAX_SAFE_INTEGER - 1 || !hash(w.checksum)) return unavailable(challenge);
        const bytes = copyBytes(w.bytes, remaining); if (!bytes) return unavailable(challenge); owned.push(bytes); remaining -= bytes.length;
        writes.push(Object.freeze({ purpose: w.purpose, key: w.key as string, expectedRevision: w.expectedRevision, bytes, checksum: w.checksum })); }
      if (new Set(reads.map(r => r.purpose + "\n" + r.key)).size !== reads.length || new Set(writes.map(w => w.purpose + "\n" + w.key)).size !== writes.length) return unavailable(challenge);
      snapshot = { lease, reads, writes };
    } catch { return unavailable(challenge); }
    finally { preparing = false; if (!snapshot) owned.forEach(wipe); }
    const { lease, reads, writes } = snapshot;
    return run(challenge, signal, async op => {
      if (!alive(op)) return unavailable(challenge);
      for (const w of writes) if (await checksum(w.bytes, op) !== w.checksum || !alive(op)) return unavailable(challenge);
      const wireWrites = writes.map(w => Object.freeze({ purpose: w.purpose, key: w.key, expectedRevision: w.expectedRevision, base64: encoded(w.bytes), checksum: w.checksum }));
      if (!alive(op) || !lease.live || active !== lease) return unavailable(challenge);
      const wireRemaining = budget(op); if (wireRemaining === null || !lease.live || active !== lease) return unavailable(challenge);
      const request = Object.freeze({ version: 1, requestId: op.id, timeoutMs: wireRemaining, ...wireLease(lease), reads: Object.freeze(reads), writes: Object.freeze(wireWrites) });
      op.dispatched = true; const raw = await rpc.transact(request); if (unavailableAck(raw, op)) return unavailable(challenge);
      const answer = header(raw, op.id, ["version", "requestId", "status", "ownerToken", "leaseToken", "scope", "generation", "nonce", "slots"]);
      const rawSlots = answer && childDataArray(answer.slots, MAX_SLOTS);
      if (answer?.status !== "committed" || !matchesLease(answer, lease) || !rawSlots || rawSlots.length !== reads.length) return unavailable(challenge);
      const metadata: { purpose: ChildIndexPurpose; key: string; revision: number; base64: string | null; checksum: string | null; size: number }[] = []; let remaining = MAX_BATCH_BYTES;
      for (let i = 0; i < rawSlots.length; i++) {
        const s = childRecord(rawSlots[i], ["purpose", "key", "revision", "base64", "checksum"]);
        if (!s || s.purpose !== reads[i].purpose || s.key !== reads[i].key || !revision(s.revision)) return unavailable(challenge);
        const size = s.revision === 0 ? s.base64 === null && s.checksum === null ? 0 : null : hash(s.checksum) ? base64Size(s.base64) : null;
        if (size === null || size > remaining) return unavailable(challenge); remaining -= size;
        metadata.push({ purpose: reads[i].purpose, key: reads[i].key, revision: s.revision, base64: s.base64 as string | null, checksum: s.checksum as string | null, size });
      }
      // An aborted late ACK is validated without allocating decoded bytes.
      if (!alive(op) || !lease.live || active !== lease) { op.acknowledged = true; return unavailable(challenge); }
      const slots: { purpose: ChildIndexPurpose; key: string; revision: number; bytes: Uint8Array | null; checksum: string | null }[] = [];
      for (const s of metadata) { const bytes = s.base64 === null ? null : decoded(s.base64, s.size); if (bytes) { op.owned.push(bytes); if (await checksum(bytes, op) !== s.checksum || !alive(op)) return unavailable(challenge); }
        slots.push(Object.freeze({ purpose: s.purpose, key: s.key, revision: s.revision, bytes, checksum: s.checksum })); }
      if (!alive(op) || !lease.live || active !== lease) return unavailable(challenge);
      op.acknowledged = true;
      // Ownership transfers only after every slot validates; outer partition
      // decoder wipes these exact Uint8Arrays, including discarded replies.
      for (const s of slots) if (s.bytes) op.owned.splice(op.owned.indexOf(s.bytes), 1);
      return Object.freeze({ status: "committed", challenge, slots: Object.freeze(slots) });
    }, false, owned);
  }
  function retire(challenge: ChildNativeRetirementChallenge, signal: AbortSignal): Promise<unknown> {
    try { const row = childRecord(challenge, ["partition"]), lease = row && capturePartition(row.partition);
      return lease && signal instanceof AbortSignal ? enqueueRetirement(lease, challenge, signal) : Promise.resolve(unavailable(challenge));
    } catch { return Promise.resolve(unavailable(challenge)); }
  }
  return Object.freeze({ activate, transact, retire, close: () => requestClose() });
}
