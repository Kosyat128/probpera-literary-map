import { decodeChildProfiles, type ChildProfileRegistry } from "./childProfile";
import { childRecord, type ChildPackageDigestPort } from "./childPackage";
import type { ParentPinRecord, ParentPinSecureStore } from "./parentPinVerification";
import type { ChildAuthenticatedProfilePort, ChildSecureModePort, ChildSecureSelection, ChildSelectionChallenge,
  ChildStartupChallenge, ChildStartupRoute } from "./childStartup";

export const CHILD_PROTECTED_RECORD_MAX_BYTES = 131_072;
export interface ChildProtectedClockAnchor {
  readonly schemaVersion: 1; readonly bootId: string; readonly uptimeAnchorMs: number; readonly logicalAnchorMs: number;
  readonly epochAnchor: Readonly<{ epochAnchorMs: number; validUntilEpochMs: number; proofChecksum: string }> | null;
}
export interface ChildProtectedRecord {
  readonly schemaVersion: 1; readonly revision: number; readonly mode: "child" | "adult";
  readonly selectionRevision: number; readonly profileRevision: number; readonly policyChecksum: string;
  readonly registryChecksum: string; readonly registry: ChildProfileRegistry; readonly pin: ParentPinRecord;
  readonly clock: ChildProtectedClockAnchor;
}
/** Pure shape only; native authentication is a separate mandatory dependency. */
export type ChildProtectedUnenrolledSeed = Omit<ChildProtectedRecord, "mode" | "pin"> & Readonly<{ mode: "adult"; pin: null }>;
export interface ChildNativeClockSample { readonly bootId: string; readonly uptimeMs: number }
export interface ChildRecordReadChallenge { readonly generation: number }
export interface ChildRecordCASChallenge extends ChildRecordReadChallenge {
  readonly expectedBytes: Uint8Array; readonly nextBytes: Uint8Array;
  readonly expectedChecksum: string; readonly nextChecksum: string;
  readonly bootId: string; readonly deadlineUptimeMs: number;
}
/** Constructor-owned native SPI only, not a JS option/Preferences adapter.
 * Admitted read/CAS must authenticate a genuine current nonrollback checkpoint
 * and native mutation permission for the exact bytes; unsupported guarantees
 * return unavailable. Candidate Keychain/AES storage alone does not implement
 * this interface. No default driver or generic Capacitor writer is provided.
 * Read success {status:'authenticated',challenge:<same>,bytes,checksum,sample}.
 * CAS success {status:'committed',challenge:<same>,checksum:<exact next>}.
 * CAS must hold its cross-process lock, recheck exact full expected bytes and
 * boot/deadline/native permission at durable commit, then perform read-back. */
export interface ChildNativeRecordPort {
  read(challenge: ChildRecordReadChallenge, signal: AbortSignal): Promise<unknown>;
  compareAndSwap(challenge: ChildRecordCASChallenge, signal: AbortSignal): Promise<unknown>;
}
export interface ChildEpochAnchorChallenge {
  readonly recordChecksum: string; readonly anchor: NonNullable<ChildProtectedClockAnchor["epochAnchor"]>;
  readonly sample: ChildNativeClockSample; readonly sampledEpochMs: number;
}
export interface ChildEpochAnchorAuthority {
  /** Authenticate actual anchor provenance/current validity. Stored checksum is
   * identity only. Success {status:'verified',challenge:<same>}; no wall time. */
  verify(challenge: ChildEpochAnchorChallenge, signal: AbortSignal): Promise<unknown>;
}
export interface ChildProtectedStateOptions {
  native?: ChildNativeRecordPort; digest: ChildPackageDigestPort;
  policy: Readonly<{ version: string; checksum: string; maxPinIterations: number }>;
  epochAuthority?: ChildEpochAnchorAuthority; timeoutMs: number;
  /** Explicit process-local monotonic time for operation deadlines only. It
   * never establishes PIN backoff, review expiry, boot or parent authority. */
  operationalClock: { nowMs(): number };
  initialVisibility: "active" | "background";
}
export interface ChildProtectedClockObservation {
  readonly bootId: string; readonly sampledUptimeMs: number; readonly sampledLogicalMs: number;
  /** At native capture only; delayed IPC cannot fabricate a synchronous now(). */
  readonly sampledEpochMs: number | null;
}
const safe = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const positive = (value: unknown): value is number => safe(value) && value > 0;
const hex = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
const id = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/u.test(value);
const boot = (value: unknown): value is string => typeof value === "string"
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(value);
const maximumEpochMs = 8_640_000_000_000_000;
const byteLengthGetter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype), "byteLength")!.get!;
const byteOffsetGetter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype), "byteOffset")!.get!;
const bufferGetter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype), "buffer")!.get!;
function copyBytes(value: unknown): Uint8Array | null {
  if (!ArrayBuffer.isView(value) || Object.getPrototypeOf(value) !== Uint8Array.prototype) return null;
  const length = byteLengthGetter.call(value) as number;
  if (length < 1 || length > CHILD_PROTECTED_RECORD_MAX_BYTES) return null;
  const offset = byteOffsetGetter.call(value) as number, buffer = bufferGetter.call(value) as ArrayBufferLike;
  const copy = new Uint8Array(length); Uint8Array.prototype.set.call(copy, new Uint8Array(buffer, offset, length)); return copy;
}
function isStartupRoute(route: Record<string, unknown>): route is Record<string, unknown> & ChildStartupRoute {
  return typeof route.kind === "string" && ["home", "country", "writer", "work", "storyworld"].includes(route.kind)
    && (route.kind === "home" ? route.entityId === null : id(route.entityId));
}
function startupChallenge(value: unknown, withSelection: false): ChildStartupChallenge | null;
function startupChallenge(value: unknown, withSelection: true): ChildSelectionChallenge | null;
function startupChallenge(value: unknown, withSelection: boolean): ChildStartupChallenge | ChildSelectionChallenge | null {
  try {
  const root = childRecord(value, withSelection ? ["generation", "request", "selection"] : ["generation", "request"]);
  const intent = root && childRecord(root.request, ["locale", "route"]);
  const route = intent && childRecord(intent.route, ["kind", "entityId"]);
  if (!root || !safe(root.generation) || !intent || !route || intent.locale !== "ru" && intent.locale !== "en"
    || !isStartupRoute(route)) return null;
  const challenge: ChildStartupChallenge = { generation: root.generation, request: Object.freeze({ locale: intent.locale,
    route: Object.freeze(route) }) };
  if (!withSelection) return Object.freeze(challenge);
  const selected = childRecord(root.selection, ["schemaVersion", "mode", "selectionRevision", "profileId", "profileRevision",
    "profileChecksum", "policyVersion", "policyChecksum"]);
  if (!selected || selected.schemaVersion !== 1 || selected.mode !== "child" || !positive(selected.selectionRevision)
    || !id(selected.profileId) || !positive(selected.profileRevision) || !hex(selected.profileChecksum)
    || !id(selected.policyVersion) || !hex(selected.policyChecksum)) return null;
  return Object.freeze({ ...challenge, selection: Object.freeze(selected) }) as unknown as ChildSelectionChallenge;
  } catch { return null; }
}
const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);
function pinRecord(value: unknown, policyVersion: string, maximumIterations: number): ParentPinRecord | null {
  try {
  const root = childRecord(value, ["schemaVersion", "policyVersion", "revision", "credentialId", "verifier", "attempts"]);
  const verifier = root && childRecord(root.verifier, ["algorithm", "iterations", "saltHex", "hashHex"]);
  const attempts = root && childRecord(root.attempts, ["count", "blockedUntilMs", "lastObservedMs", "pendingAttemptId"]);
  if (!root || !verifier || !attempts || root.schemaVersion !== 1 || root.policyVersion !== policyVersion || !positive(root.revision)
    || !hex(root.credentialId) || verifier.algorithm !== "PBKDF2-HMAC-SHA256" || !safe(verifier.iterations)
    || verifier.iterations < 600_000 || verifier.iterations > maximumIterations || !hex(verifier.saltHex) || !hex(verifier.hashHex)
    || !safe(attempts.count) || !safe(attempts.blockedUntilMs) || !safe(attempts.lastObservedMs)
    || attempts.pendingAttemptId !== null && !hex(attempts.pendingAttemptId)
    || attempts.count === 0 && (attempts.blockedUntilMs !== 0 || attempts.pendingAttemptId !== null)
    || attempts.count > 0 && attempts.blockedUntilMs < attempts.lastObservedMs) return null;
  return Object.freeze({ schemaVersion: 1, policyVersion, revision: root.revision, credentialId: root.credentialId,
    verifier: Object.freeze(verifier), attempts: Object.freeze(attempts) }) as unknown as ParentPinRecord;
  } catch { return null; }
}
function decodeProtectedEnvelope(value: unknown, policy: ChildProtectedStateOptions["policy"], unenrolled: boolean): ChildProtectedRecord | ChildProtectedUnenrolledSeed | null {
  try {
    const root = childRecord(value, ["schemaVersion", "revision", "mode", "selectionRevision", "profileRevision", "policyChecksum",
      "registryChecksum", "registry", "pin", "clock"]);
    if (!root || root.schemaVersion !== 1 || !positive(root.revision) || !positive(root.selectionRevision) || !positive(root.profileRevision)
      || root.mode !== "adult" && root.mode !== "child" || root.policyChecksum !== policy.checksum || !hex(root.registryChecksum)) return null;
    // Metadata parsing intentionally supplies no current epoch admission. The
    // existing startup later requires a independently trusted current clock.
    const registry = decodeChildProfiles(root.registry, { policyVersion: policy.version, now: maximumEpochMs }).registry;
    const pin = unenrolled ? null : pinRecord(root.pin, policy.version, policy.maxPinIterations);
    const clock = childRecord(root.clock, ["schemaVersion", "bootId", "uptimeAnchorMs", "logicalAnchorMs", "epochAnchor"]);
    if (!registry || !unenrolled && !pin || unenrolled && (root.pin !== null || root.mode !== "adult")
      || !clock || clock.schemaVersion !== 1 || !boot(clock.bootId) || !safe(clock.uptimeAnchorMs)
      || !safe(clock.logicalAnchorMs) || root.mode === "child" && registry.activeProfileId === null
      || pin !== null && pin.attempts.lastObservedMs < clock.logicalAnchorMs) return null;
    let epochAnchor: ChildProtectedClockAnchor["epochAnchor"] = null;
    if (clock.epochAnchor !== null) {
      const anchor = childRecord(clock.epochAnchor, ["epochAnchorMs", "validUntilEpochMs", "proofChecksum"]);
      if (!anchor || !safe(anchor.epochAnchorMs) || anchor.epochAnchorMs > maximumEpochMs || !safe(anchor.validUntilEpochMs)
        || anchor.validUntilEpochMs > maximumEpochMs || anchor.validUntilEpochMs <= anchor.epochAnchorMs || !hex(anchor.proofChecksum)) return null;
      epochAnchor = Object.freeze(anchor) as unknown as NonNullable<ChildProtectedClockAnchor["epochAnchor"]>;
    }
    return Object.freeze({ schemaVersion: 1, revision: root.revision, mode: root.mode, selectionRevision: root.selectionRevision,
      profileRevision: root.profileRevision, policyChecksum: policy.checksum, registryChecksum: root.registryChecksum, registry, pin,
      clock: Object.freeze({ schemaVersion: 1, bootId: clock.bootId, uptimeAnchorMs: clock.uptimeAnchorMs,
        logicalAnchorMs: clock.logicalAnchorMs, epochAnchor }) }) as ChildProtectedRecord | ChildProtectedUnenrolledSeed;
  } catch { return null; }
}
/** Structural projection, not enrollment, freshness or OS/parent authority. */
export function decodeChildProtectedRecord(value: unknown, policy: ChildProtectedStateOptions["policy"]): ChildProtectedRecord | null {
  return decodeProtectedEnvelope(value, policy, false) as ChildProtectedRecord | null;
}
/** Only an explicit canonical adult null-PIN envelope can be a seed. Missing,
 * corrupt or an enrolled record is never interpreted as first enrollment. */
export function decodeChildProtectedUnenrolledSeed(value: unknown, policy: ChildProtectedStateOptions["policy"]): ChildProtectedUnenrolledSeed | null {
  return decodeProtectedEnvelope(value, policy, true) as ChildProtectedUnenrolledSeed | null;
}
export function childProtectedRecordBytes(record: ChildProtectedRecord | ChildProtectedUnenrolledSeed): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(record));
}
type NativeSnapshot = { record: ChildProtectedRecord; bytes: Uint8Array; checksum: string; sample: ChildNativeClockSample; logicalMs: number };

/** Unintegrated coordinator. Native guarantees are prerequisites, not flags
 * derived from successful local tests. Missing native/anchor ports stay sealed;
 * no auto-enrollment, rollback repair, PIN reset or adult fallback occurs. */
export function createChildProtectedState(options: ChildProtectedStateOptions) {
  const policy = Object.freeze({ ...options.policy });
  if (!id(policy.version) || !hex(policy.checksum) || !safe(policy.maxPinIterations) || policy.maxPinIterations < 600_000
    || policy.maxPinIterations > 0xffff_ffff || !positive(options.timeoutMs) || options.timeoutMs > 2_147_483_647
    || typeof options.digest?.sha256 !== "function" || typeof options.operationalClock?.nowMs !== "function"
    || options.initialVisibility !== "active" && options.initialVisibility !== "background")
    throw new TypeError("Explicit protected child policy/ports required");
  const read = options.native?.read.bind(options.native), cas = options.native?.compareAndSwap.bind(options.native);
  const digest = options.digest.sha256.bind(options.digest), epochProof = options.epochAuthority?.verify.bind(options.epochAuthority);
  const timeoutMs = options.timeoutMs;
  const operationalClock = options.operationalClock.nowMs.bind(options.operationalClock);
  let generation = 0, disposed = false, visible = options.initialVisibility === "active", failedClock = false;
  let lastBoot: string | null = null, lastUptime = -1, lastLogical = -1;
  let lastRevision = -1, lastChecksum: string | null = null;
  const operations = new Set<AbortController>();
  const deadlines = new WeakMap<AbortSignal, number>();
  let lastOperationTime = -1;
  const snapshot = () => Object.freeze({ phase: disposed ? "disposed" as const : "sealed" as const });
  function invalidate() {
    const old = [...operations]; old.forEach(operation => operations.delete(operation));
    if (generation === Number.MAX_SAFE_INTEGER) failedClock = true; else generation++;
    const ticket = generation; old.forEach(operation => operation.abort()); return ticket;
  }
  function operationTime(): number | null {
    if (disposed || failedClock) return null;
    try {
      const value = operationalClock();
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > Number.MAX_SAFE_INTEGER || value < lastOperationTime) {
        failedClock = true; invalidate(); return null;
      }
      lastOperationTime = value; return value;
    } catch { failedClock = true; invalidate(); return null; }
  }
  async function bounded<T>(signal: AbortSignal, task: (abort: AbortSignal, ticket: number) => Promise<T>, limit: number | null): Promise<T | null> {
    if (!read || !cas || disposed || failedClock || !visible || signal.aborted) return null;
    const at = operationTime(); if (at === null) return null;
    if (limit === null) return null;
    const ticket = generation, abort = new AbortController(), deadline = Math.min(at + timeoutMs, limit);
    if (!Number.isFinite(deadline) || deadline > Number.MAX_SAFE_INTEGER || deadline <= at) return null;
    deadlines.set(abort.signal, deadline); operations.add(abort);
    return new Promise(resolve => {
      let complete = false;
      const finish = (value: T | null) => { if (complete) return; complete = true; clearTimeout(timer); signal.removeEventListener("abort", cancel);
        abort.signal.removeEventListener("abort", cancel); operations.delete(abort); resolve(value); };
      const cancel = () => { if (!abort.signal.aborted) abort.abort(); finish(null); };
      const timer = setTimeout(cancel, deadline - at);
      signal.addEventListener("abort", cancel, { once: true }); abort.signal.addEventListener("abort", cancel, { once: true });
      Promise.resolve().then(() => current(abort.signal, ticket) && !signal.aborted ? task(abort.signal, ticket) : null)
        .then(value => finish(current(abort.signal, ticket) && !signal.aborted ? value : null), () => finish(null));
    });
  }
  function current(signal: AbortSignal, ticket: number) {
    if (signal.aborted || disposed || failedClock || !visible || generation !== ticket) return false;
    const at = operationTime(), deadline = deadlines.get(signal);
    return at !== null && deadline !== undefined && at < deadline && !signal.aborted && generation === ticket && !disposed && visible;
  }
  function operationDeadline(): number | null {
    const at = operationTime();
    return at !== null && at + timeoutMs <= Number.MAX_SAFE_INTEGER && at + timeoutMs > at ? at + timeoutMs : null;
  }
  function hostCurrent(ticket: number, deadline: number | null) {
    if (deadline === null || disposed || failedClock || !visible || generation !== ticket) return false;
    const at = operationTime();
    return at !== null && at < deadline && !disposed && !failedClock && visible && generation === ticket;
  }
  async function nativeSnapshot(signal: AbortSignal, ticket: number): Promise<NativeSnapshot | null> {
    if (!current(signal, ticket)) return null;
    const challenge: ChildRecordReadChallenge = Object.freeze({ generation: ticket });
    const response = childRecord(await read!(challenge, signal), ["status", "challenge", "bytes", "checksum", "sample"]);
    if (!current(signal, ticket) || !response || response.status !== "authenticated" || response.challenge !== challenge
      || !hex(response.checksum)) return null;
    const bytes = copyBytes(response.bytes); if (!bytes) return null;
    const rawSample = childRecord(response.sample, ["bootId", "uptimeMs"]);
    if (!rawSample || !boot(rawSample.bootId) || !safe(rawSample.uptimeMs)) return null;
    const sample: ChildNativeClockSample = Object.freeze({ bootId: rawSample.bootId, uptimeMs: rawSample.uptimeMs });
    const checksum = response.checksum;
    if (await digest(bytes.slice()) !== checksum || !current(signal, ticket)) return null;
    const record = decodeChildProtectedRecord(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)), policy);
    if (!record || new TextDecoder().decode(childProtectedRecordBytes(record)) !== new TextDecoder().decode(bytes)) return null;
    if (await digest(new TextEncoder().encode(JSON.stringify(record.registry))) !== record.registryChecksum || !current(signal, ticket)) return null;
    if (record.revision < lastRevision || record.revision === lastRevision && lastChecksum !== checksum) {
      failedClock = true; invalidate(); return null;
    }
    if (sample.bootId !== record.clock.bootId || sample.uptimeMs < record.clock.uptimeAnchorMs
      || lastBoot !== null && lastBoot !== sample.bootId || sample.uptimeMs < lastUptime) {
      failedClock = true; invalidate(); return null;
    }
    const logicalMs = record.clock.logicalAnchorMs + sample.uptimeMs - record.clock.uptimeAnchorMs;
    if (!safe(logicalMs) || logicalMs < lastLogical || logicalMs < record.pin.attempts.lastObservedMs) {
      failedClock = true; invalidate(); return null;
    }
    if (!current(signal, ticket)) return null;
    lastBoot = sample.bootId; lastUptime = sample.uptimeMs; lastLogical = logicalMs;
    lastRevision = record.revision; lastChecksum = checksum;
    return { record, bytes, checksum, logicalMs, sample };
  }
  function selection(record: ChildProtectedRecord): ChildSecureSelection | null {
    const profileId = record.registry.activeProfileId;
    return record.mode === "child" && profileId !== null ? Object.freeze({ schemaVersion: 1, mode: "child", selectionRevision: record.selectionRevision,
      profileId, profileRevision: record.profileRevision, profileChecksum: record.registryChecksum,
      policyVersion: policy.version, policyChecksum: policy.checksum }) : null;
  }
  function matches(record: ChildProtectedRecord, challenge: ChildSelectionChallenge): boolean {
    const restored = selection(record);
    return restored !== null && JSON.stringify(restored) === JSON.stringify(challenge.selection);
  }
  const modePort: ChildSecureModePort = Object.freeze({ async restore(challenge: ChildStartupChallenge, signal: AbortSignal) {
    const ticket = generation, deadline = operationDeadline();
    const captured = startupChallenge(challenge, false);
    if (!captured) return Object.freeze({ status: "unavailable", challenge });
    const restored = await bounded(signal, async (abort, ticket) => { const value = await nativeSnapshot(abort, ticket);
      return value && same(startupChallenge(challenge, false), captured) ? selection(value.record) : null; }, deadline);
    return restored && hostCurrent(ticket, deadline) && !signal.aborted && same(startupChallenge(challenge, false), captured)
      ? Object.freeze({ status: "restored", challenge, selection: restored })
      : Object.freeze({ status: "unavailable", challenge });
  } });
  const profilePort: ChildAuthenticatedProfilePort = Object.freeze({ async restore(challenge: ChildSelectionChallenge, signal: AbortSignal) {
    const ticket = generation, deadline = operationDeadline();
    const captured = startupChallenge(challenge, true);
    if (!captured) return Object.freeze({ status: "unavailable", challenge });
    const registry = await bounded(signal, async (abort, ticket) => { const value = await nativeSnapshot(abort, ticket);
      return value && matches(value.record, captured) && same(startupChallenge(challenge, true), captured) ? value.record.registry : null; }, deadline);
    return registry && hostCurrent(ticket, deadline) && !signal.aborted && same(startupChallenge(challenge, true), captured)
      ? Object.freeze({ status: "restored", challenge, registry })
      : Object.freeze({ status: "unavailable", challenge });
  } });
  const equalBytes = (left: Uint8Array, right: Uint8Array) => byteLengthGetter.call(left) === byteLengthGetter.call(right)
    && Uint8Array.prototype.every.call(left, (value: number, index: number) => value === right[index]);
  async function commit(value: NativeSnapshot, nextRecord: ChildProtectedRecord, abort: AbortSignal, ticket: number): Promise<boolean> {
    const nextBytes = childProtectedRecordBytes(nextRecord), nextChecksum = await digest(nextBytes.slice());
    if (!hex(nextChecksum) || !current(abort, ticket)) return false;
    const at = operationTime(), limit = deadlines.get(abort);
    if (at === null || limit === undefined) return false;
    const remainingMs = Math.floor(limit - at), deadlineUptimeMs = value.sample.uptimeMs + remainingMs;
    if (!positive(remainingMs) || remainingMs > timeoutMs || !safe(deadlineUptimeMs) || !current(abort, ticket)) return false;
    const challenge: ChildRecordCASChallenge = Object.freeze({ generation: ticket, expectedBytes: value.bytes.slice(), nextBytes: nextBytes.slice(),
      expectedChecksum: value.checksum, nextChecksum, bootId: value.sample.bootId, deadlineUptimeMs });
    const result = childRecord(await cas!(challenge, abort), ["status", "challenge", "checksum"]);
    if (!current(abort, ticket) || result?.status !== "committed" || result.challenge !== challenge || result.checksum !== nextChecksum
      || !equalBytes(challenge.expectedBytes, value.bytes) || !equalBytes(challenge.nextBytes, nextBytes)) return false;
    // Native SPI already requires locked durable read-back. Reauthenticate the
    // complete current record before acknowledging to callers; a lost or raced
    // acknowledgement is false, never a reconstructed success.
    const committed = await nativeSnapshot(abort, ticket);
    return !!committed && current(abort, ticket) && committed.checksum === nextChecksum && equalBytes(committed.bytes, nextBytes);
  }
  const selectionStore = Object.freeze({
    /** Internal native Parent Gate coordinator only; never a plugin/UI mutation
     * API. Native permission must bind the actual verified one-use action to
     * the exact full record. Records themselves do not convey permission. */
    async read(signal = new AbortController().signal): Promise<ChildProtectedRecord | null> {
      const ticket = generation, deadline = operationDeadline();
      const value = await bounded(signal, async (abort, operation) => (await nativeSnapshot(abort, operation))?.record ?? null, deadline);
      return hostCurrent(ticket, deadline) && !signal.aborted ? value : null;
    },
    async compareAndSwap(expected: ChildProtectedRecord, next: ChildProtectedRecord, signal = new AbortController().signal): Promise<boolean> {
      const ticket = generation, deadline = operationDeadline();
      const before = decodeChildProtectedRecord(expected, policy), after = decodeChildProtectedRecord(next, policy);
      if (!before || !after || before.revision === Number.MAX_SAFE_INTEGER || after.revision !== before.revision + 1
        || !same(before.pin, after.pin) || !same(before.clock, after.clock)) return false;
      const registryChanged = !same(before.registry, after.registry) || before.registryChecksum !== after.registryChecksum;
      const modeChanged = before.mode !== after.mode;
      if (!registryChanged && !modeChanged || after.profileRevision !== before.profileRevision + (registryChanged ? 1 : 0)
        || after.selectionRevision !== before.selectionRevision + 1 || !safe(after.profileRevision) || !safe(after.selectionRevision)) return false;
      const accepted = await bounded(signal, async (abort, ticket) => {
        const value = await nativeSnapshot(abort, ticket);
        if (!value || !same(value.record, before) || !current(abort, ticket)) return false;
        if (await digest(new TextEncoder().encode(JSON.stringify(after.registry))) !== after.registryChecksum || !current(abort, ticket)) return false;
        return commit(value, after, abort, ticket);
      }, deadline);
      return accepted === true && hostCurrent(ticket, deadline) && !signal.aborted;
    },
  });
  const pinStore: ParentPinSecureStore = Object.freeze({
    async read() {
      const ticket = generation, deadline = operationDeadline();
      const value = await bounded(new AbortController().signal, async (abort, operation) => (await nativeSnapshot(abort, operation))?.record.pin ?? null, deadline);
      return hostCurrent(ticket, deadline) ? value : null;
    },
    async compareAndSwap(expected: ParentPinRecord, next: ParentPinRecord) {
      const ticket = generation, deadline = operationDeadline();
      const expectedPin = pinRecord(expected, policy.version, policy.maxPinIterations), nextPin = pinRecord(next, policy.version, policy.maxPinIterations);
      if (!expectedPin || !nextPin || nextPin.revision !== expectedPin.revision + 1 || nextPin.credentialId !== expectedPin.credentialId
        || JSON.stringify(nextPin.verifier) !== JSON.stringify(expectedPin.verifier)) return false;
      const committed = await bounded(new AbortController().signal, async (abort, ticket) => {
        const value = await nativeSnapshot(abort, ticket);
        if (!value || JSON.stringify(value.record.pin) !== JSON.stringify(expectedPin) || !current(abort, ticket)
          || nextPin.attempts.lastObservedMs < expectedPin.attempts.lastObservedMs || nextPin.attempts.lastObservedMs > value.logicalMs
          || value.record.revision === Number.MAX_SAFE_INTEGER) return false;
        return commit(value, Object.freeze({ ...value.record, revision: value.record.revision + 1, pin: nextPin }), abort, ticket);
      }, deadline);
      return committed === true && hostCurrent(ticket, deadline);
    },
  });
  return Object.freeze({ modePort, profilePort, pinStore, selectionStore, getSnapshot: snapshot,
    invalidate() { invalidate(); }, background() { visible = false; invalidate(); },
    foreground() { if (!disposed) { visible = true; invalidate(); } }, dispose() { if (!disposed) { disposed = true; invalidate(); } },
    async readClockObservation(signal = new AbortController().signal): Promise<ChildProtectedClockObservation | null> {
      const generationAtCall = generation, deadline = operationDeadline();
      const observation = await bounded(signal, async (abort, ticket) => {
        const value = await nativeSnapshot(abort, ticket); if (!value) return null;
        let sampledEpochMs: number | null = null; const anchor = value.record.clock.epochAnchor;
        if (anchor && epochProof) {
          const proposed = anchor.epochAnchorMs + value.sample.uptimeMs - value.record.clock.uptimeAnchorMs;
          if (!safe(proposed) || proposed > maximumEpochMs || proposed >= anchor.validUntilEpochMs) return null;
          const challenge: ChildEpochAnchorChallenge = Object.freeze({ recordChecksum: value.checksum, anchor, sample: value.sample, sampledEpochMs: proposed });
          const result = childRecord(await epochProof(challenge, abort), ["status", "challenge"]);
          if (!current(abort, ticket) || result?.status !== "verified" || result.challenge !== challenge) return null;
          sampledEpochMs = proposed;
        }
        return Object.freeze({ bootId: value.sample.bootId, sampledUptimeMs: value.sample.uptimeMs,
          sampledLogicalMs: value.logicalMs, sampledEpochMs });
      }, deadline);
      return hostCurrent(generationAtCall, deadline) && !signal.aborted ? observation : null;
    },
  });
}

