import { childRecord, type ChildPackageDigestPort } from "./childPackage";
import { CHILD_PROTECTED_RECORD_MAX_BYTES, childProtectedRecordBytes, decodeChildProtectedRecord,
  decodeChildProtectedUnenrolledSeed, type ChildProtectedRecord, type ChildProtectedStateOptions,
  type ChildProtectedUnenrolledSeed } from "./childProtectedState";
import { createWebCryptoParentPinKdf, type ParentPinKdf, type ParentPinRecord } from "./parentPinVerification";

export type ParentPinLifecycleAction = "enroll" | "replace" | "recover";
declare const inspectionBrand: unique symbol;
declare const mutationBrand: unique symbol;
declare const sessionBrand: unique symbol;
declare const recoveryBrand: unique symbol;
/** Only this coordinator creates the original challenge. Copies/JSON/UI values
 * have no identity or lifecycle permission. Its native owner keeps a private
 * identity registry and must reject any challenge not received at this boundary. */
export interface ParentPinEnrollmentInspection {
  readonly [inspectionBrand]: true;
  readonly id: string; readonly action: ParentPinLifecycleAction;
  readonly policyVersion: string; readonly policyChecksum: string; readonly timeoutMs: number;
}
/** Native constructor-owned opaque identities. Brands are compile-time fences;
 * native private ownership/authentication, never their JS shape, is authority. */
export type ParentPinNativeSession = Readonly<{ [sessionBrand]: true }>;
export type ParentPinRecoveryPermission = Readonly<{ [recoveryBrand]: true }>;
export interface ParentPinEnrollmentMutation {
  readonly [mutationBrand]: true;
  readonly inspection: ParentPinEnrollmentInspection;
  readonly nativeSession: ParentPinNativeSession; readonly nativeEpoch: string;
  readonly bootId: string; readonly deadlineUptimeMs: number;
  readonly expectedRevision: number; readonly nextRevision: number;
  readonly expectedBytes: Uint8Array; readonly expectedChecksum: string;
  readonly nextBytes: Uint8Array; readonly nextChecksum: string;
  readonly recoveryPermission: ParentPinRecoveryPermission | null;
}
export interface ParentPinEnrollmentNativePort {
  /** Private authenticated native lifecycle SPI, not an arbitrary writer.
   * Require the original branded challenge. Authenticate a genuine nonrollback
   * full enrolled record, or a provisioned canonical adult full seed with
   * pin:null. Missing/corrupt/rolled-back records are NEVER unenrolled seeds.
   * Native obtains actual one-use enrollment/rotation permission, binds its
   * constructor-owned opaque session to challenge/action/exact bytes/checksum/
   * revision/epoch/boot, and creates ONE exclusive native continuous deadline.
   * Recovery does not obtain ordinary rotation permission: commit requires the
   * distinct genuine recovery authority below. No JS boolean/biometric receipt.
   * Response: {status:'enrolled'|'unenrolled',challenge:<same>,session,epoch,
   * bytes,checksum,sample:{bootId,uptimeMs},deadlineUptimeMs}.
   * A known refusal {status:'denied',challenge:<same>} guarantees no mutation
   * and that this request can be retired. Every other reply is uncertain. */
  begin(challenge: ParentPinEnrollmentInspection, signal: AbortSignal): Promise<unknown>;
  /** Under the real native cross-process durable lock: authenticate the SAME
   * owned session, exact WHOLE expected/next bytes+SHA+revisions, native epoch,
   * one-use permission for precisely this PIN replacement/attempt reset,
   * boot, original absolute deadline and cancellation at publication. Consume
   * permission once; durably publish and read back exact next bytes before ACK.
   * Recovery must validate its independently issued permission under this lock.
   * Success: {status:'committed',challenge:<same>,session:<same>,bytes,checksum}.
   * Known refusal {status:'denied',challenge:<same>,session:<same>} guarantees
   * no publication. Unknown/lost/malformed ACK retains native capacity sealed;
   * later state or a timeout cannot reconstruct success/release ownership.
   * Storage encryption alone does not implement control-rollback resistance. */
  commit(challenge: ParentPinEnrollmentMutation, signal: AbortSignal): Promise<unknown>;
  /** Flag cancellation for the original request even if begin is still pending.
   * Its receipt never proves work stopped or releases native capacity. */
  cancel(challenge: ParentPinEnrollmentInspection): Promise<unknown>;
  /** Close only this original native-owned request after ALL actual work and
   * permission retirement settle. {status:'closed',challenge:<same>}.
   * Unknown cleanup keeps ownership sealed; no timeout-based release. A closed
   * ACK cannot repair an uncertain begin/commit or imply parent authorization. */
  retire(challenge: ParentPinEnrollmentInspection): Promise<unknown>;
}
export interface ParentPinEnrollmentInputPort {
  /** Independent owned ephemeral ASCII PIN entries. Clear native/UI input,
   * respect AbortSignal, never log/retain data. Late outputs are still owned
   * by this coordinator for wiping; cancellation does not prove input stopped. */
  readPin(challenge: ParentPinEnrollmentInspection, entry: "new" | "confirm", signal: AbortSignal): Promise<unknown>;
}
export interface ParentPinRecoveryAuthority {
  /** Distinct actual native/system/account recovery dependency. Authenticate
   * recovery for this exact original inspection/session, complete old/new
   * bytes/digests/revisions, native epoch/boot and original absolute deadline.
   * {status:'authorized',challenge:<same>,permission:<opaque native-owned>}.
   * Commit adds the returned one-use permission to a new immutable challenge
   * with these SAME coordinates; native validates that binding under its lock.
   * A local flag, self-declared reset or biometric availability is insufficient. */
  authorize(challenge: ParentPinEnrollmentMutation, signal: AbortSignal): Promise<unknown>;
}
export interface ParentPinCalibrationPort {
  /** Actual device calibration prerequisite, separate from the 600k floor.
   * {status:'calibrated',challenge:<same>,iterations:<exact configured count>}.
   * No synthetic fixture/algorithm timing is promoted to device calibration. */
  verify(challenge: ParentPinEnrollmentInspection, iterations: number, signal: AbortSignal): Promise<unknown>;
}
export interface ParentPinEnrollmentOptions {
  readonly native?: ParentPinEnrollmentNativePort; readonly input?: ParentPinEnrollmentInputPort;
  readonly recovery?: ParentPinRecoveryAuthority; readonly calibration?: ParentPinCalibrationPort;
  readonly kdf?: ParentPinKdf; readonly random?: Pick<Crypto, "getRandomValues">;
  readonly digest: ChildPackageDigestPort;
  readonly policy: ChildProtectedStateOptions["policy"] & Readonly<{ iterations: number; minDigits: number; maxDigits: number }>;
  readonly clock: { nowMonotonicMs(): number }; readonly timeoutMs: number;
  readonly initialVisibility: "active" | "background";
}
export type ParentPinEnrollmentResult = Readonly<{ status: "committed"; action: ParentPinLifecycleAction }>
  | Readonly<{ status: "denied" | "unavailable" | "cancelled" }>;
const safe = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const positive = (value: unknown): value is number => safe(value) && value > 0;
const hex = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
const boot = (value: unknown): value is string => typeof value === "string"
  && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(value);
const opaque = (value: unknown): value is object => !!value && typeof value === "object" && !Array.isArray(value)
  && !ArrayBuffer.isView(value) && !(value instanceof ArrayBuffer);
const typed = Object.getPrototypeOf(Uint8Array.prototype);
const lengthOf = Object.getOwnPropertyDescriptor(typed, "byteLength")!.get!;
const offsetOf = Object.getOwnPropertyDescriptor(typed, "byteOffset")!.get!;
const bufferOf = Object.getOwnPropertyDescriptor(typed, "buffer")!.get!;
function copy(input: unknown, maximum: number): Uint8Array | null {
  if (!ArrayBuffer.isView(input) || Object.getPrototypeOf(input) !== Uint8Array.prototype) return null;
  const length = lengthOf.call(input) as number, offset = offsetOf.call(input) as number;
  const buffer = bufferOf.call(input) as ArrayBufferLike;
  if (length < 1 || length > maximum || !(buffer instanceof ArrayBuffer)
    || Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, "resizable")?.get?.call(buffer) === true) return null;
  const owned = new Uint8Array(length); Uint8Array.prototype.set.call(owned, new Uint8Array(buffer, offset, length)); return owned;
}
function wipe(value: unknown) {
  try { if (ArrayBuffer.isView(value)) Uint8Array.prototype.fill.call(value, 0); } catch { /* Detached output is unusable. */ }
}
function ownedData(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object") return undefined;
  const field = Object.getOwnPropertyDescriptor(value, key);
  return field && "value" in field ? field.value : undefined;
}
const toHex = (bytes: Uint8Array) => [...bytes].map(byte => byte.toString(16).padStart(2, "0")).join("");
const sameBytes = (a: Uint8Array, b: Uint8Array) => lengthOf.call(a) === lengthOf.call(b)
  && Uint8Array.prototype.every.call(a, (byte: number, index: number) => byte === b[index]);
const result = (status: "denied" | "unavailable" | "cancelled"): ParentPinEnrollmentResult => Object.freeze({ status });
type Snapshot = { before: ChildProtectedRecord | ChildProtectedUnenrolledSeed; bytes: Uint8Array; checksum: string;
  session: ParentPinNativeSession; epoch: string; bootId: string; deadlineUptimeMs: number; logicalMs: number };
type Job = { generation: number; deadline: number; inspection: ParentPinEnrollmentInspection;
  abort: AbortController; external: AbortSignal; cancel(): void; timer: ReturnType<typeof setTimeout> | null;
  cancelled: boolean; uncertain: boolean; finish(value: ParentPinEnrollmentResult): void;
  cancellation: Promise<unknown> | null };

/** Credential lifecycle coordinator only; intentionally unregistered. There is
 * no default genuine native/recovery/calibration/input adapter. Missing ports
 * stay unavailable. It supplies no ParentGate or child/admission capability.
 * Actual installed lifecycle/rollback/time guarantees remain native dependencies.
 * WebCrypto's nonextractable key lifecycle cannot be explicitly erased from JS. */
export function createParentPinEnrollment(options: ParentPinEnrollmentOptions) {
  const policy = Object.freeze({ ...options.policy }), timeoutMs = options.timeoutMs;
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/u.test(policy.version) || !hex(policy.checksum)
    || !positive(policy.maxPinIterations) || policy.maxPinIterations > 0xffff_ffff
    || !positive(policy.iterations) || policy.iterations < 600_000 || policy.iterations > policy.maxPinIterations
    // Technical defensive floors/limits only, not human policy approval or
    // a device timing calibration. Explicit policy can require more digits.
    || !positive(policy.minDigits) || policy.minDigits < 4 || !positive(policy.maxDigits) || policy.minDigits > policy.maxDigits || policy.maxDigits > 128
    || !positive(timeoutMs) || timeoutMs > 60_000 || typeof options.clock?.nowMonotonicMs !== "function"
    || typeof options.digest?.sha256 !== "function" || options.initialVisibility !== "active" && options.initialVisibility !== "background")
    throw new TypeError("Explicit parent PIN enrollment policy, clock and digest required");
  const clock = options.clock.nowMonotonicMs.bind(options.clock), digest = options.digest.sha256.bind(options.digest);
  const begin = options.native?.begin?.bind(options.native), commit = options.native?.commit?.bind(options.native);
  const cancelNative = options.native?.cancel?.bind(options.native), retireNative = options.native?.retire?.bind(options.native);
  const readPin = options.input?.readPin?.bind(options.input), calibration = options.calibration?.verify?.bind(options.calibration);
  const recovery = options.recovery?.authorize?.bind(options.recovery), kdf = options.kdf ?? createWebCryptoParentPinKdf();
  const derive = kdf?.derive?.bind(kdf), random = options.random ?? globalThis.crypto;
  const fillRandom = random?.getRandomValues?.bind(random);
  let generation = 0, active: Job | null = null, preparation: object | null = null;
  let visible = options.initialVisibility === "active", disposed = false;
  let failed = false, lastNow = -1;
  const inspections = new WeakSet<object>(), sessions = new WeakMap<object, ParentPinEnrollmentInspection>();
  const inspectionIds = new Set<string>(), recoveryPermissions = new WeakSet<object>();
  const maximumLifetimeInspections = 2_048;
  function now(): number | null {
    try { const at = clock(); if (!safe(at) || at < lastNow) failed = true;
      if (failed) return null; lastNow = at; return at; } catch { failed = true; return null; }
  }
  function current(job: Job): boolean {
    const at = now(); return active === job && inspections.has(job.inspection) && generation === job.generation
      && !disposed && !failed && visible && !job.cancelled && !job.abort.signal.aborted
      && !job.external.aborted && at !== null && at < job.deadline;
  }
  function cancel(job: Job) {
    if (job.cancelled) return;
    // Commit state before synchronous abort callbacks can reenter.
    job.cancelled = true; job.finish(result("cancelled"));
    if (job.timer !== null) clearTimeout(job.timer); job.timer = null;
    job.abort.abort();
    if (cancelNative) {
      try { job.cancellation = Promise.resolve(cancelNative(job.inspection)); }
      catch { job.cancellation = Promise.resolve(null); failed = true; job.uncertain = true; }
      void job.cancellation.catch(() => { failed = true; });
    }
  }
  function invalidate() { if (generation >= Number.MAX_SAFE_INTEGER) failed = true; else generation++;
    const job = active; if (job) cancel(job); }
  async function checksum(bytes: Uint8Array): Promise<string | null> {
    const owned = bytes.slice(); try { const value = await digest(owned); return hex(value) ? value : null; } finally { owned.fill(0); }
  }
  function randomBytes(): Uint8Array {
    const bytes = new Uint8Array(32);
    try { if (fillRandom?.(bytes) !== bytes) throw new Error("parent-pin-unavailable"); return bytes; }
    catch (error) { bytes.fill(0); throw error; }
  }
  async function inspect(job: Job): Promise<Snapshot | "denied" | null> {
    let raw: unknown, bytes: Uint8Array | null = null;
    try {
      const reply = await begin!(job.inspection, job.abort.signal);
      raw = ownedData(reply, "bytes");
      const refusal = childRecord(reply, ["status", "challenge"]);
      if (refusal?.status === "denied" && refusal.challenge === job.inspection) return "denied";
      const status = childRecord(reply, ["status", "challenge", "session", "epoch", "bytes", "checksum", "sample", "deadlineUptimeMs"]);
      bytes = copy(raw, CHILD_PROTECTED_RECORD_MAX_BYTES); wipe(raw);
      if (!status || status.challenge !== job.inspection || !opaque(status.session) || sessions.has(status.session)
        || !hex(status.epoch) || !hex(status.checksum) || !bytes
        || status.status !== "enrolled" && status.status !== "unenrolled") { job.uncertain = true; return null; }
      sessions.set(status.session, job.inspection);
      if (!current(job)) return null;
      const sample = childRecord(status.sample, ["bootId", "uptimeMs"]);
      if (!sample || !boot(sample.bootId) || !safe(sample.uptimeMs) || !safe(status.deadlineUptimeMs)
        || status.deadlineUptimeMs <= sample.uptimeMs || status.deadlineUptimeMs - sample.uptimeMs > timeoutMs) {
        job.uncertain = true; return null;
      }
      const decoded: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
      const before = status.status === "enrolled" ? decodeChildProtectedRecord(decoded, policy) : decodeChildProtectedUnenrolledSeed(decoded, policy);
      if (!before || !sameBytes(childProtectedRecordBytes(before), bytes) || await checksum(bytes) !== status.checksum) {
        job.uncertain = true; return null;
      }
      const registryBytes = new TextEncoder().encode(JSON.stringify(before.registry));
      try { if (await checksum(registryBytes) !== before.registryChecksum) { job.uncertain = true; return null; } }
      finally { registryBytes.fill(0); }
      if (before.clock.bootId !== sample.bootId || sample.uptimeMs < before.clock.uptimeAnchorMs) { job.uncertain = true; return null; }
      const logicalMs = before.clock.logicalAnchorMs + sample.uptimeMs - before.clock.uptimeAnchorMs;
      if (!safe(logicalMs) || before.pin && logicalMs < before.pin.attempts.lastObservedMs) { job.uncertain = true; return null; }
      if (!current(job)) return null;
      if (job.inspection.action === "enroll" ? status.status !== "unenrolled" : status.status !== "enrolled") return "denied";
      const retained = bytes; bytes = null;
      return { before, bytes: retained, checksum: status.checksum, session: status.session as ParentPinNativeSession,
        epoch: status.epoch, bootId: sample.bootId, deadlineUptimeMs: status.deadlineUptimeMs, logicalMs };
    } catch { job.uncertain = true; return null; } finally { bytes?.fill(0); wipe(raw); }
  }
  async function work(job: Job): Promise<ParentPinEnrollmentResult> {
    let snapshot: Snapshot | null = null, first: Uint8Array | null = null, confirmation: Uint8Array | null = null;
    let salt: Uint8Array | null = null, credential: Uint8Array | null = null, derived: Uint8Array | null = null;
    let nextBytes: Uint8Array | null = null, expectedCopy: Uint8Array | null = null, challengeBytes: Uint8Array | null = null;
    try {
      const inspected = await inspect(job);
      if (inspected === "denied") return result("denied");
      snapshot = inspected; if (!snapshot || !current(job)) return result("unavailable");
      const measured = childRecord(await calibration!(job.inspection, policy.iterations, job.abort.signal), ["status", "challenge", "iterations"]);
      if (!current(job) || measured?.status !== "calibrated" || measured.challenge !== job.inspection || measured.iterations !== policy.iterations) return result("unavailable");
      const entered = await readPin!(job.inspection, "new", job.abort.signal);
      try { first = copy(entered, policy.maxDigits); } finally { wipe(entered); }
      if (!first || !current(job) || first.length < policy.minDigits || !first.every(byte => byte >= 48 && byte <= 57)) return result("denied");
      const repeated = await readPin!(job.inspection, "confirm", job.abort.signal);
      try { confirmation = copy(repeated, policy.maxDigits); } finally { wipe(repeated); }
      if (!confirmation || !current(job) || confirmation.length !== first.length) return result("denied");
      let difference = 0; for (let index = 0; index < first.length; index++) difference |= first[index] ^ confirmation[index];
      confirmation.fill(0); confirmation = null; if (difference !== 0) return result("denied");
      salt = randomBytes(); credential = randomBytes();
      if (!current(job)) return result("cancelled");
      const kdfPin = first.slice(), kdfSalt = salt.slice();
      try {
        const output = await derive!(kdfPin, kdfSalt, policy.iterations);
        try { derived = copy(output, 32); } finally { wipe(output); }
      } finally { kdfPin.fill(0); kdfSalt.fill(0); first.fill(0); first = null; }
      if (!derived || derived.length !== 32 || !current(job)) return result("unavailable");
      const pinRevision = snapshot.before.pin ? snapshot.before.pin.revision + 1 : 1;
      const pin: ParentPinRecord = Object.freeze({ schemaVersion: 1, policyVersion: policy.version, revision: pinRevision,
        credentialId: toHex(credential), verifier: Object.freeze({ algorithm: "PBKDF2-HMAC-SHA256", iterations: policy.iterations,
          saltHex: toHex(salt), hashHex: toHex(derived) }), attempts: Object.freeze({ count: 0, blockedUntilMs: 0,
          lastObservedMs: snapshot.logicalMs, pendingAttemptId: null }) });
      if (!positive(pinRevision) || snapshot.before.pin && (pin.credentialId === snapshot.before.pin.credentialId
        || pin.verifier.saltHex === snapshot.before.pin.verifier.saltHex)) return result("unavailable");
      const next = decodeChildProtectedRecord({ ...snapshot.before, revision: snapshot.before.revision + 1, pin }, policy);
      if (!next || !current(job)) return result("unavailable");
      nextBytes = childProtectedRecordBytes(next); const nextChecksum = await checksum(nextBytes);
      if (!nextChecksum || nextBytes.length > CHILD_PROTECTED_RECORD_MAX_BYTES || !current(job)) return result("unavailable");
      expectedCopy = snapshot.bytes.slice(); challengeBytes = nextBytes.slice();
      const core = { inspection: job.inspection, nativeSession: snapshot.session, nativeEpoch: snapshot.epoch,
        bootId: snapshot.bootId, deadlineUptimeMs: snapshot.deadlineUptimeMs, expectedRevision: snapshot.before.revision,
        nextRevision: next.revision, expectedBytes: expectedCopy, expectedChecksum: snapshot.checksum,
        nextBytes: challengeBytes, nextChecksum, recoveryPermission: null };
      let mutation = Object.freeze(core) as ParentPinEnrollmentMutation;
      if (job.inspection.action === "recover") {
        const recoveryChallenge = mutation;
        const authorization = childRecord(await recovery!(recoveryChallenge, job.abort.signal), ["status", "challenge", "permission"]);
        if (!current(job) || authorization?.status !== "authorized" || authorization.challenge !== recoveryChallenge
          || !opaque(authorization.permission) || recoveryPermissions.has(authorization.permission)) return result("unavailable");
        recoveryPermissions.add(authorization.permission);
        mutation = Object.freeze({ ...core, recoveryPermission: authorization.permission as ParentPinRecoveryPermission }) as ParentPinEnrollmentMutation;
      }
      // Dependency callbacks may mutate transferred buffers. Fence before native
      // publication as well as after; the native lock independently does this.
      if (!current(job) || sessions.get(snapshot.session) !== job.inspection
        || !sameBytes(expectedCopy, snapshot.bytes) || !sameBytes(challengeBytes, nextBytes)) return result("unavailable");
      let raw: unknown, readback: Uint8Array | null = null;
      try {
        let response: unknown;
        try { response = await commit!(mutation, job.abort.signal); } catch { job.uncertain = true; return result("unavailable"); }
        raw = ownedData(response, "bytes");
        const refusal = childRecord(response, ["status", "challenge", "session"]);
        if (refusal?.status === "denied" && refusal.challenge === mutation && refusal.session === snapshot.session) return result("denied");
        const reply = childRecord(response, ["status", "challenge", "session", "bytes", "checksum"]);
        readback = copy(raw, CHILD_PROTECTED_RECORD_MAX_BYTES); wipe(raw);
        if (!reply || reply.status !== "committed" || reply.challenge !== mutation || reply.session !== snapshot.session
          || reply.checksum !== nextChecksum || !readback || !sameBytes(readback, nextBytes)
          || !sameBytes(mutation.nextBytes, nextBytes) || !sameBytes(mutation.expectedBytes, snapshot.bytes)
          || await checksum(readback) !== nextChecksum) { job.uncertain = true; return result("unavailable"); }
        if (!current(job)) return result("cancelled");
        return Object.freeze({ status: "committed", action: job.inspection.action });
      } catch { job.uncertain = true; return result("unavailable"); } finally { readback?.fill(0); wipe(raw); }
    } catch { return result("unavailable"); }
    finally {
      first?.fill(0); confirmation?.fill(0); salt?.fill(0); credential?.fill(0); derived?.fill(0);
      snapshot?.bytes.fill(0); nextBytes?.fill(0); expectedCopy?.fill(0); challengeBytes?.fill(0);
    }
  }
  async function complete(job: Job, observed: ParentPinEnrollmentResult) {
    // The timer/external listener stay live while actual native cleanup runs.
    // Public cancellation is prompt, but active capacity remains until all
    // genuine operations AND their cleanup settle; unknown ownership seals it.
    const cancellationAtClose = job.cancellation;
    if (cancellationAtClose) await cancellationAtClose.catch(() => { job.uncertain = true; });
    let closed = false;
    try { const receipt = childRecord(await retireNative!(job.inspection), ["status", "challenge"]);
      closed = receipt?.status === "closed" && receipt.challenge === job.inspection; } catch { /* Unknown owner remains sealed. */ }
    const accepted = current(job);
    // Native close or the final injected clock may synchronously cancel. Its
    // actual side-call must finish and be covered by a new genuine close ACK.
    // The cancelled path performs no further injected clock before release.
    if (job.cancellation !== cancellationAtClose) {
      await job.cancellation?.catch(() => { job.uncertain = true; });
      try { const receipt = childRecord(await retireNative!(job.inspection), ["status", "challenge"]);
        closed = closed && receipt?.status === "closed" && receipt.challenge === job.inspection; } catch { closed = false; }
    }
    if (job.timer !== null) clearTimeout(job.timer); job.timer = null;
    job.external.removeEventListener("abort", job.cancel);
    if (!closed || job.uncertain) { failed = true; job.finish(result("unavailable")); return; }
    if (active === job) active = null;
    job.abort.abort(); job.finish(accepted ? observed : job.cancelled ? result("cancelled") : result("unavailable"));
  }
  return Object.freeze({
    getSnapshot() { return Object.freeze({ phase: disposed ? "disposed" as const : failed ? "unavailable" as const
      : active || preparation ? "working" as const : visible ? "idle" as const : "sealed" as const }); },
    invalidate() { invalidate(); }, background() { visible = false; invalidate(); },
    foreground() { if (!disposed) { visible = true; invalidate(); } }, dispose() { if (!disposed) { disposed = true; invalidate(); } },
    async request(action: ParentPinLifecycleAction, external: AbortSignal): Promise<ParentPinEnrollmentResult> {
      if (!begin || !commit || !cancelNative || !retireNative || !readPin || !derive || !fillRandom || !calibration
        || action === "recover" && !recovery || failed || disposed || !visible) return result("unavailable");
      if (!["enroll", "replace", "recover"].includes(action) || !(external instanceof AbortSignal) || external.aborted || active || preparation) return result("denied");
      const reservation = Object.freeze(Object.create(null)) as object, ticket = generation;
      preparation = reservation;
      let idBytes: Uint8Array | null = null;
      try {
        const at = now(); if (at === null || !safe(at + timeoutMs) || at + timeoutMs <= at) return result("unavailable");
        if (preparation !== reservation || generation !== ticket || disposed || !visible || external.aborted) return result("cancelled");
        idBytes = randomBytes(); const inspectionId = toHex(idBytes);
        // Native transports bind the wire ID as well as local object identity.
        // Collision/exhaustion seals this constructor; never evict an old ID.
        if (inspectionIds.has(inspectionId) || inspectionIds.size >= maximumLifetimeInspections) { failed = true; return result("unavailable"); }
        inspectionIds.add(inspectionId);
        const inspection = Object.freeze({ id: inspectionId, action,
          policyVersion: policy.version, policyChecksum: policy.checksum, timeoutMs }) as ParentPinEnrollmentInspection;
        idBytes.fill(0); idBytes = null; inspections.add(inspection);
        if (preparation !== reservation || generation !== ticket || disposed || !visible || external.aborted) return result("cancelled");
        return await new Promise<ParentPinEnrollmentResult>(resolve => {
          let settled = false;
          const job: Job = { generation, deadline: at + timeoutMs, inspection, abort: new AbortController(), external,
            cancel: () => cancel(job), timer: null, cancelled: false, uncertain: false, cancellation: null,
            finish(value) { if (!settled) { settled = true; resolve(value); } } };
          active = job; preparation = null; external.addEventListener("abort", job.cancel, { once: true });
          job.timer = setTimeout(() => cancel(job), timeoutMs);
          if (!current(job)) { cancel(job); void complete(job, result("cancelled")); return; }
          void work(job).then(value => complete(job, value), () => complete(job, result("unavailable"))).catch(() => {
            failed = true; job.finish(result("unavailable"));
          });
        });
      } catch { return result("unavailable"); } finally { idBytes?.fill(0); if (preparation === reservation) preparation = null; }
    },
  });
}
