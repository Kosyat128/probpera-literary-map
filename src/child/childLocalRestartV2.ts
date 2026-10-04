import { childDataArray, childRecord } from "./childPackage";

/** A separately versioned LOCAL clock/attempt journal. This is not a v1 clock,
 * boot identifier, rollback checkpoint, owner permission or Parent Gate proof. */
export interface ChildLocalRestartV2Policy {
  readonly version: string; readonly checksum: string; readonly backoffDelaysMs: readonly number[];
}
export interface ChildLocalRestartV2ProtectedBinding {
  readonly checksum: string; readonly revision: number; readonly pinRevision: number; readonly credentialId: string;
}
export interface ChildLocalRestartV2Record {
  readonly schemaVersion: 2; readonly policyVersion: string; readonly policyChecksum: string; readonly revision: number;
  readonly protected: ChildLocalRestartV2ProtectedBinding;
  readonly attempts: Readonly<{ count: number; pendingAttemptId: string | null; savedCooldownMs: number }>;
  readonly anchor: Readonly<{ logicalMs: number }>;
}
export interface ChildLocalRestartV2Sample { readonly continuousMs: number }
export interface ChildLocalRestartV2OpenChallenge { readonly kind: "local-restart-v2-open" }
export interface ChildLocalRestartV2SampleChallenge { readonly kind: "local-restart-v2-sample"; readonly session: object }
export interface ChildLocalRestartV2Attempt { readonly id: string; readonly original: object }
export interface ChildLocalRestartV2CommitChallenge {
  readonly kind: "reanchor" | "charge"; readonly session: object;
  readonly expectedBytes: Uint8Array; readonly nextBytes: Uint8Array;
  readonly expectedChecksum: string; readonly nextChecksum: string;
  readonly sample: ChildLocalRestartV2Sample; readonly attempt: ChildLocalRestartV2Attempt | null;
}

/** Constructor-owned native LOCAL v2 SPI; no implementation is installed here.
 * open authenticates the existing journal AND exact full protected record under
 * the fixed vault lock. It returns {status:'authenticated',challenge,session,
 * bytes,checksum,sample}; missing/corrupt/unprovisioned never means a fresh seed.
 * session must be native-owned and valid for this actual process; a random JS id,
 * wall clock or uptime from a previous process is insufficient. No process ID,
 * boot UUID or continuous baseline is serialized in this v2 journal.
 * sample returns {status:'authenticated',challenge,session,sample} only after
 * rechecking the same live process/host and current exact durable record.
 * compareAndSwap holds the same cross-process lock, compares BOTH full protected
 * record and journal, validates the exact fixed reanchor/charge transition and
 * native original attempt admission, and durably publishes BOTH atomically.
 * Charge increments the full protected/PIN revisions and count, retains the
 * credential/verifier/non-PIN fields and stores pending debt BEFORE any KDF.
 * Reanchor changes only this v2 journal, never a v1 clock. The read-back response
 * is {status:'committed',challenge,session,bytes,checksum,sample}, with actual
 * complete journal bytes and exact full protected binding reauthenticated.
 * Ordinary separate AES sidecar writes do not implement this contract. v2 does
 * not claim v1 nonrollback guarantees; storage restoration/OS compromise remain
 * explicit unsupported boundaries, not repaired by an encrypted preference.
 * cancel/retire cover the ORIGINAL open challenge even before session exists;
 * retire joins actual work/callbacks and returns {status:'retired',challenge,
 * session}. Unknown/lost/malformed acknowledgements retain the native lane.
 * No timeout, JS cancellation flag or this module's object identities release it.
 */
export interface ChildLocalRestartV2NativePort {
  open(challenge: ChildLocalRestartV2OpenChallenge, signal: AbortSignal): Promise<unknown>;
  sample(challenge: ChildLocalRestartV2SampleChallenge, signal: AbortSignal): Promise<unknown>;
  compareAndSwap(challenge: ChildLocalRestartV2CommitChallenge, signal: AbortSignal): Promise<unknown>;
  cancel(challenge: ChildLocalRestartV2OpenChallenge, session: object | null): Promise<void>;
  retire(challenge: ChildLocalRestartV2OpenChallenge, session: object | null): Promise<unknown>;
}
export interface ChildLocalRestartV2Observation {
  readonly status: "blocked" | "eligible"; readonly count: number; readonly pendingAttemptId: string | null;
  readonly remainingCooldownMs: number; readonly logicalMs: number;
}
export interface ChildLocalRestartV2Foundation {
  open(): Promise<ChildLocalRestartV2Observation | null>;
  observe(): Promise<ChildLocalRestartV2Observation | null>;
  /** nextProtected comes from actual native fixed charge preparation. Structural
   * validation here cannot establish its digest, original host or permission. */
  reserve(attempt: ChildLocalRestartV2Attempt, nextProtected: ChildLocalRestartV2ProtectedBinding): Promise<ChildLocalRestartV2Observation | null>;
  invalidate(): void;
  retire(): Promise<"closed" | "sealed">;
}

const MAX_BYTES = 4096, MAX_ATTEMPTS = 2048;
const safe = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
const positive = (v: unknown): v is number => safe(v) && v > 0;
const hex = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{64}$/u.test(v);
const opaque = (v: unknown): v is object => v !== null && typeof v === "object";
const equal = (a: Uint8Array, b: Uint8Array) => a.length === b.length && a.every((v, i) => v === b[i]);
const byteLength = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype), "byteLength")!.get!;
const buffer = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(Uint8Array.prototype), "buffer")!.get!;
const bufferLength = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, "byteLength")!.get!;
const resizable = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, "resizable")?.get;
function copyBytes(value: unknown): Uint8Array | null {
  try {
    if (!ArrayBuffer.isView(value) || Object.getPrototypeOf(value) !== Uint8Array.prototype) return null;
    const length = byteLength.call(value) as number, backing: unknown = buffer.call(value);
    bufferLength.call(backing); // Intrinsic brand denies SharedArrayBuffer, including prototype spoofing.
    if (length < 1 || length > MAX_BYTES || resizable?.call(backing) === true) return null;
    const copy = new Uint8Array(length); Uint8Array.prototype.set.call(copy, value as Uint8Array); return copy;
  } catch { return null; }
}
function policyOf(value: unknown): ChildLocalRestartV2Policy | null {
  try {
    const p = childRecord(value, ["version", "checksum", "backoffDelaysMs"]);
    const delays = p && childDataArray(p.backoffDelaysMs, 64);
    if (!p || typeof p.version !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/u.test(p.version)
      || !hex(p.checksum) || !delays?.length || delays.some((v, i) => !positive(v) || i > 0 && (v as number) <= (delays[i - 1] as number))) return null;
    return Object.freeze({ version: p.version, checksum: p.checksum, backoffDelaysMs: Object.freeze(delays as number[]) });
  } catch { return null; }
}
function bindingOf(value: unknown): ChildLocalRestartV2ProtectedBinding | null {
  const p = childRecord(value, ["checksum", "revision", "pinRevision", "credentialId"]);
  return p && hex(p.checksum) && positive(p.revision) && positive(p.pinRevision) && hex(p.credentialId)
    ? Object.freeze({ checksum: p.checksum, revision: p.revision, pinRevision: p.pinRevision, credentialId: p.credentialId }) : null;
}
function sampleOf(value: unknown): ChildLocalRestartV2Sample | null {
  const s = childRecord(value, ["continuousMs"]);
  return s && safe(s.continuousMs) ? Object.freeze({ continuousMs: s.continuousMs }) : null;
}
const delayFor = (p: ChildLocalRestartV2Policy, count: number) => count === 0 ? 0 : p.backoffDelaysMs[Math.min(count - 1, p.backoffDelaysMs.length - 1)];

/** Pure shape validation grants no authentication, initialization or clock credit. */
export function decodeChildLocalRestartV2Record(value: unknown, policy: ChildLocalRestartV2Policy): ChildLocalRestartV2Record | null {
  try {
    const p = policyOf(policy), r = childRecord(value, ["schemaVersion", "policyVersion", "policyChecksum", "revision", "protected", "attempts", "anchor"]);
    const b = r && bindingOf(r.protected), a = r && childRecord(r.attempts, ["count", "pendingAttemptId", "savedCooldownMs"]);
    const clock = r && childRecord(r.anchor, ["logicalMs"]);
    if (!p || !r || r.schemaVersion !== 2 || r.policyVersion !== p.version || r.policyChecksum !== p.checksum || !positive(r.revision)
      || !b || !a || !safe(a.count) || !(a.pendingAttemptId === null || hex(a.pendingAttemptId)) || !safe(a.savedCooldownMs)
      || a.savedCooldownMs !== delayFor(p, a.count) || a.count === 0 && a.pendingAttemptId !== null
      || !clock || !safe(clock.logicalMs) || !safe(clock.logicalMs + a.savedCooldownMs)) return null;
    return Object.freeze({ schemaVersion: 2, policyVersion: p.version, policyChecksum: p.checksum, revision: r.revision,
      protected: b, attempts: Object.freeze({ count: a.count, pendingAttemptId: a.pendingAttemptId, savedCooldownMs: a.savedCooldownMs }),
      anchor: Object.freeze({ logicalMs: clock.logicalMs }) });
  } catch { return null; }
}
export function childLocalRestartV2Bytes(record: ChildLocalRestartV2Record): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(record));
}
async function sha(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.length);
  let result: Uint8Array | null = null;
  try {
    copy.set(bytes);
    result = new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", copy));
    if (result.length !== 32) throw new Error("Local restart digest unavailable");
    return Array.from(result, v => v.toString(16).padStart(2, "0")).join("");
  } finally { copy.fill(0); result?.fill(0); }
}

/** This conditional LOCAL foundation deliberately has no finalize/reset/enroll,
 * verified/admission output, v1 fallback, JS time port or installed native factory.
 * A new controller always durably reanchors and reapplies the FULL saved delay.
 * Nothing subtracts time between the saved process and this actual process.
 * Old pending debt can be replaced only by another durably charged attempt after
 * its cooldown; cancellation/crash/unknown ACK never undo either charged count.
 */
export function createChildLocalRestartV2(options: { readonly policy: ChildLocalRestartV2Policy; readonly native?: ChildLocalRestartV2NativePort }): ChildLocalRestartV2Foundation {
  const policy = policyOf(options.policy), native = options.native;
  const open = native?.open?.bind(native), sample = native?.sample?.bind(native), cas = native?.compareAndSwap?.bind(native);
  const cancel = native?.cancel?.bind(native), close = native?.retire?.bind(native);
  const challenge: ChildLocalRestartV2OpenChallenge = Object.freeze({ kind: "local-restart-v2-open" });
  const controller = new AbortController(), seenObjects = new WeakSet<object>(), seenIds = new Set<string>();
  let started = false, nativeStarted = false, busy = false, invalid = false, sealed = false, retired = false, session: object | null = null;
  let record: ChildLocalRestartV2Record | null = null, bytes: Uint8Array | null = null, checksum = "", lastContinuous = -1, baselineContinuous = -1;
  let work: Promise<unknown> | null = null, cancellation: Promise<void> | null = null, retirement: Promise<"closed" | "sealed"> | null = null;
  const configured = () => !!policy && !!open && !!sample && !!cas && !!cancel && !!close && !!globalThis.crypto?.subtle;
  const live = () => !invalid && !sealed && !retired && !controller.signal.aborted;
  function wipe() { bytes?.fill(0); bytes = null; record = null; }
  function fail() { sealed = true; controller.abort(); if (!busy) wipe(); return null; }
  function invalidate() {
    if (invalid || retired) return; invalid = true; controller.abort();
    if (nativeStarted && cancel) cancellation = Promise.resolve().then(() => cancel(challenge, session)).catch(() => { sealed = true; });
  }
  function acceptSample(value: unknown): ChildLocalRestartV2Sample | null {
    const s = sampleOf(value);
    if (!s || !record || s.continuousMs < baselineContinuous || s.continuousMs < lastContinuous) return fail();
    lastContinuous = s.continuousMs; return s;
  }
  function observation(s: ChildLocalRestartV2Sample): ChildLocalRestartV2Observation | null {
    if (!record || !live()) return null;
    const elapsed = s.continuousMs - baselineContinuous, logicalMs = record.anchor.logicalMs + elapsed;
    if (!safe(logicalMs)) return fail();
    const remainingCooldownMs = Math.max(0, record.attempts.savedCooldownMs - elapsed);
    return Object.freeze({ status: remainingCooldownMs > 0 ? "blocked" : "eligible", count: record.attempts.count,
      pendingAttemptId: record.attempts.pendingAttemptId, remainingCooldownMs, logicalMs });
  }
  async function current(): Promise<ChildLocalRestartV2Sample | null> {
    if (!session || !record || !live()) return null;
    const c: ChildLocalRestartV2SampleChallenge = Object.freeze({ kind: "local-restart-v2-sample", session });
    const raw = childRecord(await sample!(c, controller.signal), ["status", "challenge", "session", "sample"]);
    if (!live()) return null;
    if (!raw || raw.status !== "authenticated" || raw.challenge !== c || raw.session !== session) return fail();
    return acceptSample(raw.sample);
  }
  async function commit(next: ChildLocalRestartV2Record, s: ChildLocalRestartV2Sample, attempt: ChildLocalRestartV2Attempt | null): Promise<ChildLocalRestartV2Sample | null> {
    if (!record || !bytes || !session || !live()) return null;
    const before = bytes.slice(); let after: Uint8Array | null = null, expectedWire: Uint8Array | null = null,
      nextWire: Uint8Array | null = null, readback: Uint8Array | null = null;
    try {
      after = childLocalRestartV2Bytes(next); const nextChecksum = await sha(after);
      if (!live()) return null;
      expectedWire = before.slice(); nextWire = after.slice();
      const c: ChildLocalRestartV2CommitChallenge = Object.freeze({ kind: attempt ? "charge" : "reanchor", session,
        expectedBytes: expectedWire, nextBytes: nextWire, expectedChecksum: checksum, nextChecksum, sample: s, attempt });
      const raw = childRecord(await cas!(c, controller.signal), ["status", "challenge", "session", "bytes", "checksum", "sample"]);
      // A borrowed mutation, unknown ACK or late commit may have published: seal.
      if (!equal(expectedWire, before) || !equal(nextWire, after) || !raw || raw.status !== "committed" || raw.challenge !== c
        || raw.session !== session || raw.checksum !== nextChecksum) return fail();
      const returnedSample = sampleOf(raw.sample); readback = copyBytes(raw.bytes);
      if (!readback || !equal(readback, after) || await sha(readback) !== nextChecksum) return fail();
      if (!returnedSample || !equal(expectedWire, before) || !equal(nextWire, after) || !live()) return fail();
      bytes.fill(0); bytes = readback; record = next; checksum = nextChecksum; baselineContinuous = s.continuousMs;
      return acceptSample(returnedSample);
    } finally { before.fill(0); after?.fill(0); expectedWire?.fill(0); nextWire?.fill(0); if (readback !== bytes) readback?.fill(0); }
  }
  async function run<T>(task: () => Promise<T>): Promise<T | null> {
    if (busy || !live()) return null; busy = true;
    const pending = Promise.resolve().then(() => live() ? task() : null); work = pending;
    try { return await pending; } catch { return fail(); }
    finally { if (work === pending) work = null; busy = false; if (invalid || sealed) wipe(); }
  }
  return Object.freeze({
    async open() {
      if (started || !configured() || !live()) return null; started = true;
      return run(async () => {
        nativeStarted = true;
        const raw = childRecord(await open!(challenge, controller.signal), ["status", "challenge", "session", "bytes", "checksum", "sample"]);
        if (!raw || raw.status !== "authenticated" || raw.challenge !== challenge || !opaque(raw.session) || !hex(raw.checksum)) return fail();
        session = raw.session; const original = copyBytes(raw.bytes); let canonical: Uint8Array | null = null;
        try {
          const s = sampleOf(raw.sample);
          if (!original || !s || !live()) return fail();
          const parsed = decodeChildLocalRestartV2Record(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(original)), policy!);
          if (!parsed) return fail(); canonical = childLocalRestartV2Bytes(parsed);
          if (!equal(canonical, original) || await sha(original) !== raw.checksum || !live()) return fail();
          record = parsed; bytes = original; checksum = raw.checksum;
          const revision = parsed.revision + 1;
          if (!positive(revision)) return fail();
          // DO NOT compare previous process uptime, boot or wall time. No outside credit.
          const next: ChildLocalRestartV2Record = Object.freeze({ ...parsed, revision,
            anchor: Object.freeze({ logicalMs: parsed.anchor.logicalMs }) });
          lastContinuous = s.continuousMs; baselineContinuous = s.continuousMs; const confirmed = await commit(next, s, null);
          return confirmed ? observation(confirmed) : null;
        } finally { canonical?.fill(0); if (original !== bytes) original?.fill(0); }
      });
    },
    async observe() { return run(async () => { const s = await current(); return s ? observation(s) : null; }); },
    async reserve(attempt: ChildLocalRestartV2Attempt, nextProtected: ChildLocalRestartV2ProtectedBinding) {
      if (!session || !record || busy || !live()) return null;
      let a: Record<string, unknown> | null, b: ChildLocalRestartV2ProtectedBinding | null;
      try { a = childRecord(attempt, ["id", "original"]); b = bindingOf(nextProtected); } catch { return null; }
      if (!a || !hex(a.id) || !opaque(a.original) || !b || seenObjects.has(a.original) || seenIds.has(a.id)) return null;
      if (seenIds.size >= MAX_ATTEMPTS) return fail();
      seenObjects.add(a.original); seenIds.add(a.id);
      const ownedAttempt: ChildLocalRestartV2Attempt = Object.freeze({ id: a.id, original: a.original });
      return run(async () => {
        const s = await current(), observed = s && observation(s), before = record;
        if (!s || !observed || observed.status !== "eligible" || !before) return null;
        const count = before.attempts.count + 1, revision = before.revision + 1;
        if (!positive(count) || !positive(revision) || !positive(before.protected.revision + 1) || !positive(before.protected.pinRevision + 1)
          || b.credentialId !== before.protected.credentialId || b.checksum === before.protected.checksum
          || b.revision !== before.protected.revision + 1 || b.pinRevision !== before.protected.pinRevision + 1) return null;
        const savedCooldownMs = delayFor(policy!, count);
        if (!safe(observed.logicalMs + savedCooldownMs)) return null;
        const next: ChildLocalRestartV2Record = Object.freeze({ ...before, revision, protected: b,
          attempts: Object.freeze({ count, pendingAttemptId: ownedAttempt.id, savedCooldownMs }),
          anchor: Object.freeze({ logicalMs: observed.logicalMs }) });
        const confirmed = await commit(next, s, ownedAttempt); return confirmed ? observation(confirmed) : null;
      });
    },
    invalidate,
    retire() {
      if (retirement) return retirement;
      // Publish the original retirement before abort listeners can reenter.
      // Its deferred body observes the cancellation scheduled by invalidate().
      retirement = Promise.resolve().then(async () => {
        // Promises track actual calls. No timer turns a hung call into settlement.
        if (work) await work.catch(() => undefined);
        if (cancellation) await cancellation;
        if (!nativeStarted) { retired = true; wipe(); return "closed" as const; }
        if (!close) { sealed = true; wipe(); return "sealed" as const; }
        try {
          const raw = childRecord(await close(challenge, session), ["status", "challenge", "session"]);
          if (!raw || raw.status !== "retired" || raw.challenge !== challenge || raw.session !== session) sealed = true;
        } catch { sealed = true; }
        retired = !sealed; wipe(); return sealed ? "sealed" as const : "closed" as const;
      });
      invalidate(); return retirement;
    },
  });
}
