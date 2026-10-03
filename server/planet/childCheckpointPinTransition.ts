import { childRecord } from "../../src/child/childPackage";
import { CHILD_PROTECTED_RECORD_MAX_BYTES, childProtectedRecordBytes, decodeChildProtectedRecord,
  decodeChildProtectedUnenrolledSeed, type ChildProtectedRecord, type ChildProtectedUnenrolledSeed } from "../../src/child/childProtectedState";
import type { ParentPinLifecycleAction } from "../../src/child/parentPinEnrollment";

export interface ChildCheckpointPinTransitionPolicy {
  readonly version: string; readonly checksum: string; readonly maxPinIterations: number; readonly iterations: number;
}
export interface ChildCheckpointPinTransitionBinding {
  readonly action: ParentPinLifecycleAction; readonly capturedLogicalMs: number;
  readonly expectedRevision: number; readonly nextRevision: number;
  readonly expectedRecordSha256: string; readonly nextRecordSha256: string;
}
export interface ChildCheckpointPinTransitionInput extends ChildCheckpointPinTransitionBinding {
  readonly expectedBytes: Uint8Array; readonly nextBytes: Uint8Array;
}

const FIELDS = ["action", "capturedLogicalMs", "expectedRevision", "nextRevision", "expectedRecordSha256", "nextRecordSha256", "expectedBytes", "nextBytes"];
const POLICY_FIELDS = ["version", "checksum", "maxPinIterations", "iterations"];
const hash = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{64}$/u.test(value);
const safe = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const typed = Object.getPrototypeOf(Uint8Array.prototype);
const lengthOf = Object.getOwnPropertyDescriptor(typed, "byteLength")!.get!;
const offsetOf = Object.getOwnPropertyDescriptor(typed, "byteOffset")!.get!;
const bufferOf = Object.getOwnPropertyDescriptor(typed, "buffer")!.get!;
const bufferLengthOf = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, "byteLength")!.get!;
const resizableOf = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, "resizable")?.get;

function policy(value: unknown): Readonly<ChildCheckpointPinTransitionPolicy> | null {
  const copy = childRecord(value, POLICY_FIELDS);
  if (!copy || typeof copy.version !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/u.test(copy.version)
    || !hash(copy.checksum) || !safe(copy.maxPinIterations) || copy.maxPinIterations < 600_000 || copy.maxPinIterations > 0xffff_ffff
    || !safe(copy.iterations) || copy.iterations < 600_000 || copy.iterations > copy.maxPinIterations) return null;
  return Object.freeze({ version: copy.version, checksum: copy.checksum, maxPinIterations: copy.maxPinIterations, iterations: copy.iterations });
}
function bytes(value: unknown): Uint8Array | null {
  if (!ArrayBuffer.isView(value) || Object.getPrototypeOf(value) !== Uint8Array.prototype) return null;
  const length = lengthOf.call(value) as number, offset = offsetOf.call(value) as number, buffer = bufferOf.call(value) as ArrayBufferLike;
  // Prototype shape cannot authenticate the backing-store brand: a shared
  // buffer can borrow ArrayBuffer.prototype. The intrinsic rejects that spoof.
  const capacity = bufferLengthOf.call(buffer) as number;
  if (length < 1 || length > CHILD_PROTECTED_RECORD_MAX_BYTES || Object.getPrototypeOf(buffer) !== ArrayBuffer.prototype
    || !safe(capacity) || offset > capacity - length || resizableOf?.call(buffer) === true) return null;
  const owned = new Uint8Array(length);
  Uint8Array.prototype.set.call(owned, new Uint8Array(buffer, offset, length)); return owned;
}
function same(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference = 0; for (let index = 0; index < left.length; index++) difference |= left[index] ^ right[index];
  return difference === 0;
}
async function sha256(value: Uint8Array): Promise<string> {
  const disposable = new Uint8Array(value.length); Uint8Array.prototype.set.call(disposable, value);
  try {
    const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", disposable.buffer));
    if (digest.byteLength !== 32) throw new Error("Invalid SHA-256 result");
    return Array.from(digest, byte => byte.toString(16).padStart(2, "0")).join("");
  } finally { disposable.fill(0); }
}
function record(value: Uint8Array, rules: ChildCheckpointPinTransitionPolicy, seed: boolean): ChildProtectedRecord | ChildProtectedUnenrolledSeed | null {
  const raw: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(value));
  const decoded = seed ? decodeChildProtectedUnenrolledSeed(raw, rules) : decodeChildProtectedRecord(raw, rules);
  if (!decoded) return null;
  const canonical = childProtectedRecordBytes(decoded);
  try { return same(canonical, value) ? decoded : null; } finally { canonical.fill(0); }
}
async function registryMatches(value: ChildProtectedRecord | ChildProtectedUnenrolledSeed): Promise<boolean> {
  const canonical = new TextEncoder().encode(JSON.stringify(value.registry));
  try { return await sha256(canonical) === value.registryChecksum; } finally { canonical.fill(0); }
}

/** Pure private backend validation of the existing canonical PIN-only transition.
 * Hashes/revisions/action are comparison coordinates, not authenticated inputs.
 * capturedLogicalMs is the original explicit native-capture comparison value:
 * this function creates no trusted time, expiry, enrollment, recovery permission,
 * issuer witness, installation/account binding or actual PIN/KDF/calibration proof.
 * A future admitted caller must obtain those independently and retain the same
 * original operation/deadline. No operation/context wire hash is invented here.
 * Only detached frozen primitive metadata is returned; complete byte snapshots
 * are validated before release and never returned, logged, stored or published. */
export async function validateChildCheckpointPinTransition(value: unknown, policyValue: unknown): Promise<Readonly<ChildCheckpointPinTransitionBinding> | null> {
  let expected: Uint8Array | null = null, next: Uint8Array | null = null, planned: Uint8Array | null = null;
  try {
    const input = childRecord(value, FIELDS), rules = policy(policyValue);
    if (!input || !rules || input.action !== "enroll" && input.action !== "replace" && input.action !== "recover"
      || !safe(input.capturedLogicalMs) || !safe(input.expectedRevision) || input.expectedRevision < 1
      || input.expectedRevision >= Number.MAX_SAFE_INTEGER || !safe(input.nextRevision) || input.nextRevision !== input.expectedRevision + 1
      || !hash(input.expectedRecordSha256) || !hash(input.nextRecordSha256) || input.expectedRecordSha256 === input.nextRecordSha256) return null;
    const binding = Object.freeze({ action: input.action, capturedLogicalMs: input.capturedLogicalMs,
      expectedRevision: input.expectedRevision, nextRevision: input.nextRevision,
      expectedRecordSha256: input.expectedRecordSha256, nextRecordSha256: input.nextRecordSha256 });
    expected = bytes(input.expectedBytes); next = bytes(input.nextBytes);
    if (!expected || !next) return null;
    // Snapshot both full records and all comparison/policy primitives before
    // the first digest await; no later read consults caller-owned input.
    const [expectedDigest, nextDigest] = await Promise.all([sha256(expected), sha256(next)]);
    if (expectedDigest !== binding.expectedRecordSha256 || nextDigest !== binding.nextRecordSha256) return null;
    const before = record(expected, rules, binding.action === "enroll"), after = record(next, rules, false) as ChildProtectedRecord | null;
    if (!before || !after || before.revision !== binding.expectedRevision || after.revision !== binding.nextRevision
      || !await registryMatches(before) || !await registryMatches(after)) return null;
    const oldPin = before.pin, newPin = after.pin, attempts = newPin.attempts;
    if (oldPin ? oldPin.revision >= Number.MAX_SAFE_INTEGER || newPin.revision !== oldPin.revision + 1
      || newPin.credentialId === oldPin.credentialId || newPin.verifier.saltHex === oldPin.verifier.saltHex : newPin.revision !== 1) return null;
    if (newPin.verifier.iterations !== rules.iterations || attempts.count !== 0 || attempts.blockedUntilMs !== 0
      || attempts.pendingAttemptId !== null || attempts.lastObservedMs !== binding.capturedLogicalMs
      || binding.capturedLogicalMs < before.clock.logicalAnchorMs || oldPin && binding.capturedLogicalMs < oldPin.attempts.lastObservedMs) return null;
    // Exactly the root revision and PIN segment may change. Preserve the full
    // canonical registry/profile/mode/selection/policy/clock/epoch-anchor bytes.
    planned = childProtectedRecordBytes({ ...before, revision: binding.nextRevision, pin: newPin });
    if (!same(planned, next)) return null;
    return binding;
  } catch { return null; }
  finally { expected?.fill(0); next?.fill(0); planned?.fill(0); }
}
