import { childDataArray, childRecord, type ChildPackageDigestPort } from "./childPackage";
import { decodeChildProfiles, type ChildProfileRegistry } from "./childProfile";
import { CHILD_LOCAL_SEED_V2_MAX_BYTES, decodeChildLocalUnenrolledSeedV2 } from "./childLocalBootstrap";
import { decodeChildLocalRestartV2Record, type ChildLocalRestartV2Record } from "./childLocalRestartV2";
import type { ParentPinRecord } from "./parentPinVerification";

export const CHILD_LOCAL_SNAPSHOT_V2_MAX_BYTES = 131_072;
export const CHILD_LOCAL_SNAPSHOT_V2_JOURNAL_MAX_BYTES = 4096;
export interface ChildLocalSnapshotV2Policy {
  readonly version: string; readonly checksum: string; readonly maxPinIterations: number;
  readonly backoffDelaysMs: readonly number[];
}
/** LOCAL v2 metadata, not a v1 clock, authenticated store or admitted child mode. */
export interface ChildLocalProtectedRecordV2 {
  readonly schemaVersion: 2; readonly revision: number; readonly mode: "adult" | "child";
  readonly selectionRevision: number; readonly profileRevision: number; readonly policyChecksum: string;
  readonly registryChecksum: string; readonly registry: ChildProfileRegistry; readonly pin: ParentPinRecord;
  /** Conservative durable lower bound only. Not the current-process baseline,
   * time provenance or an eligibility clock; J/native process own zero credit. */
  readonly clock: Readonly<{ schemaVersion: 2; logicalMs: number }>;
}
export interface ChildLocalSnapshotV2 {
  readonly schemaVersion: 2; readonly protectedRecord: ChildLocalProtectedRecordV2;
  readonly restartJournal: ChildLocalRestartV2Record;
}
/** Digest comparison data only; the supplied digest must actually hash the bytes.
 * No result authenticates storage, native time, OS ownership or Parent Gate. */
export interface ChildLocalSnapshotV2Verified {
  readonly snapshot: ChildLocalSnapshotV2; readonly protectedChecksum: string; readonly checksum: string;
}
export interface ChildLocalV2EnrollmentCandidate extends ChildLocalSnapshotV2Verified {
  readonly expectedSeedChecksum: string;
}
const rootKeys = ["schemaVersion", "revision", "mode", "selectionRevision", "profileRevision", "policyChecksum",
  "registryChecksum", "registry", "pin", "clock"] as const;
const safe = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value)
  && value >= 0 && !Object.is(value, -0);
const positive = (value: unknown): value is number => safe(value) && value > 0;
const hex = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
const id = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/u.test(value);
function policyOf(value: unknown): ChildLocalSnapshotV2Policy | null {
  try {
    const p = childRecord(value, ["version", "checksum", "maxPinIterations", "backoffDelaysMs"]);
    const delays = p && childDataArray(p.backoffDelaysMs, 64);
    if (!p || !id(p.version) || !hex(p.checksum) || !safe(p.maxPinIterations) || p.maxPinIterations < 600_000
      || !delays?.length || delays.some((d, i) => !positive(d) || i > 0 && (d as number) <= (delays[i - 1] as number))) return null;
    return Object.freeze({ version: p.version, checksum: p.checksum, maxPinIterations: p.maxPinIterations,
      backoffDelaysMs: Object.freeze(delays as number[]) });
  } catch { return null; }
}
function journalPolicy(p: ChildLocalSnapshotV2Policy) {
  return { version: p.version, checksum: p.checksum, backoffDelaysMs: p.backoffDelaysMs };
}
function pinOf(value: unknown, policy: ChildLocalSnapshotV2Policy): ParentPinRecord | null {
  // Same closed PIN grammar as the existing private v1 PIN decoders, without
  // fabricating a v1 envelope/boot sample or widening their exports.
  const p = childRecord(value, ["schemaVersion", "policyVersion", "revision", "credentialId", "verifier", "attempts"]);
  const v = p && childRecord(p.verifier, ["algorithm", "iterations", "saltHex", "hashHex"]);
  const a = p && childRecord(p.attempts, ["count", "blockedUntilMs", "lastObservedMs", "pendingAttemptId"]);
  if (!p || !v || !a || p.schemaVersion !== 1 || p.policyVersion !== policy.version || !positive(p.revision)
    || !hex(p.credentialId) || v.algorithm !== "PBKDF2-HMAC-SHA256" || !safe(v.iterations)
    || v.iterations < 600_000 || v.iterations > policy.maxPinIterations || !hex(v.saltHex) || !hex(v.hashHex)
    || !safe(a.count) || !safe(a.blockedUntilMs) || !safe(a.lastObservedMs)
    || a.pendingAttemptId !== null && !hex(a.pendingAttemptId)
    || a.count === 0 && (a.blockedUntilMs !== 0 || a.pendingAttemptId !== null)
    || a.count > 0 && a.blockedUntilMs < a.lastObservedMs) return null;
  return Object.freeze({ schemaVersion: 1, policyVersion: policy.version, revision: p.revision, credentialId: p.credentialId,
    verifier: Object.freeze({ algorithm: "PBKDF2-HMAC-SHA256", iterations: v.iterations, saltHex: v.saltHex, hashHex: v.hashHex }),
    attempts: Object.freeze({ count: a.count, blockedUntilMs: a.blockedUntilMs, lastObservedMs: a.lastObservedMs,
      pendingAttemptId: a.pendingAttemptId }) });
}
function protectedOf(value: unknown, policy: ChildLocalSnapshotV2Policy): ChildLocalProtectedRecordV2 | null {
  const p = childRecord(value, rootKeys), clock = p && childRecord(p.clock, ["schemaVersion", "logicalMs"]);
  if (!p || !clock || p.schemaVersion !== 2 || !positive(p.revision) || !positive(p.selectionRevision)
    || !positive(p.profileRevision) || p.mode !== "adult" && p.mode !== "child"
    || p.policyChecksum !== policy.checksum || !hex(p.registryChecksum)
    || clock.schemaVersion !== 2 || !safe(clock.logicalMs)) return null;
  // Dates are validated as metadata; the maximum accepted epoch grants no
  // current time, legal age proof or automatic re-confirmation interval.
  const registry = decodeChildProfiles(p.registry, { policyVersion: policy.version, now: 8_640_000_000_000_000 }).registry;
  const pin = pinOf(p.pin, policy);
  if (!registry || !pin || p.mode === "child" && registry.activeProfileId === null || clock.logicalMs > pin.attempts.lastObservedMs) return null;
  return Object.freeze({ schemaVersion: 2, revision: p.revision, mode: p.mode, selectionRevision: p.selectionRevision,
    profileRevision: p.profileRevision, policyChecksum: policy.checksum, registryChecksum: p.registryChecksum, registry, pin,
    clock: Object.freeze({ schemaVersion: 2, logicalMs: clock.logicalMs }) });
}
function snapshotOf(value: unknown, policy: ChildLocalSnapshotV2Policy): ChildLocalSnapshotV2 | null {
  const s = childRecord(value, ["schemaVersion", "protectedRecord", "restartJournal"]);
  const p = s && protectedOf(s.protectedRecord, policy);
  const j = s && decodeChildLocalRestartV2Record(s.restartJournal, journalPolicy(policy));
  if (!s || s.schemaVersion !== 2 || !p || !j || !safe(j.anchor.logicalMs) || !safe(j.attempts.count)
    || !safe(j.attempts.savedCooldownMs) || j.protected.revision !== p.revision || j.protected.pinRevision !== p.pin.revision
    || j.protected.credentialId !== p.pin.credentialId || j.attempts.count !== p.pin.attempts.count
    || j.attempts.pendingAttemptId !== p.pin.attempts.pendingAttemptId || j.anchor.logicalMs !== p.pin.attempts.lastObservedMs
    || p.pin.attempts.count > 0 && p.pin.attempts.blockedUntilMs !== j.anchor.logicalMs + j.attempts.savedCooldownMs) return null;
  if (!within(j, CHILD_LOCAL_SNAPSHOT_V2_JOURNAL_MAX_BYTES)) return null;
  return Object.freeze({ schemaVersion: 2, protectedRecord: p, restartJournal: j });
}
const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
function within(value: unknown, limit: number): boolean {
  const bytes = encode(value); try { return bytes.length <= limit; } finally { bytes.fill(0); }
}
function equal(a: Uint8Array, b: Uint8Array): boolean {
  // Digest receives a disposable view and may add own length/every hooks. Read
  // actual typed-array storage, never methods/properties on that exposed view.
  const size = lengthGetter.call(a) as number;
  if (size !== lengthGetter.call(b)) return false;
  for (let index = 0; index < size; index++) if (a[index] !== b[index]) return false;
  return true;
}
/** Structural projections only. Checksums are compared independently below. */
export function decodeChildLocalProtectedRecordV2(value: unknown, policyValue: unknown): ChildLocalProtectedRecordV2 | null {
  try { const p = policyOf(policyValue); return p ? protectedOf(value, p) : null; } catch { return null; }
}
export function decodeChildLocalSnapshotV2(value: unknown, policyValue: unknown): ChildLocalSnapshotV2 | null {
  try { const p = policyOf(policyValue); const s = p && snapshotOf(value, p);
    return s && within(s, CHILD_LOCAL_SNAPSHOT_V2_MAX_BYTES) ? s : null;
  } catch { return null; }
}
/** Only validated copied data is serialized; caller getters/toJSON are not used. */
export function childLocalProtectedRecordV2Bytes(value: unknown, policyValue: unknown): Uint8Array {
  const p = decodeChildLocalProtectedRecordV2(value, policyValue);
  if (!p) throw new TypeError("child-local-protected-v2-invalid");
  const bytes = encode(p);
  if (bytes.length > CHILD_LOCAL_SNAPSHOT_V2_MAX_BYTES) { bytes.fill(0); throw new TypeError("child-local-protected-v2-oversize"); }
  return bytes;
}
export function childLocalSnapshotV2Bytes(value: unknown, policyValue: unknown): Uint8Array {
  const s = decodeChildLocalSnapshotV2(value, policyValue);
  if (!s) throw new TypeError("child-local-snapshot-v2-invalid"); return encode(s);
}
const typed = Object.getPrototypeOf(Uint8Array.prototype);
const lengthGetter = Object.getOwnPropertyDescriptor(typed, "byteLength")!.get!;
const offsetGetter = Object.getOwnPropertyDescriptor(typed, "byteOffset")!.get!;
const bufferGetter = Object.getOwnPropertyDescriptor(typed, "buffer")!.get!;
const bufferLength = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, "byteLength")!.get!;
const resizable = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, "resizable")?.get;
function ownBytes(value: unknown, maximum: number): Uint8Array | null {
  try {
    if (!ArrayBuffer.isView(value) || Object.getPrototypeOf(value) !== Uint8Array.prototype) return null;
    const length = lengthGetter.call(value) as number, backing: unknown = bufferGetter.call(value), offset = offsetGetter.call(value) as number;
    bufferLength.call(backing); // Actual ArrayBuffer brand; shared/prototype-spoofed backing is denied.
    if (length < 1 || length > maximum || resizable?.call(backing) === true || Reflect.ownKeys(value).length !== length) return null;
    const copy = new Uint8Array(length); Uint8Array.prototype.set.call(copy, new Uint8Array(backing as ArrayBuffer, offset, length)); return copy;
  } catch { return null; }
}
type Digester = { readonly receiver: object; readonly sha256: ChildPackageDigestPort["sha256"] };
function digesterOf(value: unknown): Digester | null {
  try { const p = childRecord(value, ["sha256"]);
    return p && typeof p.sha256 === "function" ? { receiver: value as object, sha256: p.sha256 as ChildPackageDigestPort["sha256"] } : null;
  } catch { return null; }
}
async function digestExact(bytes: Uint8Array, digest: Digester): Promise<string | null> {
  const borrowed = bytes.slice();
  try { const result = await digest.sha256.call(digest.receiver, borrowed);
    return hex(result) && equal(borrowed, bytes) ? result : null;
  } catch { return null; }
  finally { try { Uint8Array.prototype.fill.call(borrowed, 0); } catch { /* Detached borrowed output has no admissible digest. */ } }
}
type Prepared = { snapshot: ChildLocalSnapshotV2; bytes: Uint8Array; protectedBytes: Uint8Array; registryBytes: Uint8Array };
function prepare(value: unknown, policy: ChildLocalSnapshotV2Policy): Prepared | null {
  const bytes = ownBytes(value, CHILD_LOCAL_SNAPSHOT_V2_MAX_BYTES); if (!bytes) return null;
  let adopted = false, protectedBytes: Uint8Array | null = null, registryBytes: Uint8Array | null = null;
  try {
    const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
    const snapshot = snapshotOf(JSON.parse(text), policy);
    if (!snapshot || text !== JSON.stringify(snapshot)) return null;
    protectedBytes = encode(snapshot.protectedRecord); registryBytes = encode(snapshot.protectedRecord.registry);
    adopted = true; return { snapshot, bytes, protectedBytes, registryBytes };
  } catch { return null; }
  finally { if (!adopted) { bytes.fill(0); protectedBytes?.fill(0); registryBytes?.fill(0); } }
}
function wipe(prepared: Prepared | null): void {
  prepared?.bytes.fill(0); prepared?.protectedBytes.fill(0); prepared?.registryBytes.fill(0);
}
async function verify(prepared: Prepared, digest: Digester): Promise<ChildLocalSnapshotV2Verified | null> {
  const registryChecksum = await digestExact(prepared.registryBytes, digest);
  if (registryChecksum !== prepared.snapshot.protectedRecord.registryChecksum) return null;
  const protectedChecksum = await digestExact(prepared.protectedBytes, digest);
  if (protectedChecksum !== prepared.snapshot.restartJournal.protected.checksum) return null;
  const checksum = await digestExact(prepared.bytes, digest);
  return checksum && protectedChecksum ? Object.freeze({ snapshot: prepared.snapshot, protectedChecksum, checksum }) : null;
}
/** Owns wire/policy copies before the first digest. This still requires a trusted
 * real digest implementation, and grants no native provenance or IO permission. */
export async function verifyChildLocalSnapshotV2Bytes(value: unknown, policyValue: unknown,
  digestValue: ChildPackageDigestPort): Promise<ChildLocalSnapshotV2Verified | null> {
  const policy = policyOf(policyValue), digest = digesterOf(digestValue); if (!policy || !digest) return null;
  const prepared = prepare(value, policy); if (!prepared) return null;
  try { return await verify(prepared, digest); } finally { wipe(prepared); }
}
/** Pure exact seed→enrolled candidate comparison. The logical argument is data,
 * not a clock. No native owner/input/KDF/calibration proof is established here.
 * Missing/corrupt state, replacement/recovery and later journal transitions have
 * no fallback; actual atomic native publication is a separate pending slice. */
export async function verifyChildLocalV2EnrollmentBytes(seedValue: unknown, nextValue: unknown, logicalMs: unknown,
  policyValue: unknown, digestValue: ChildPackageDigestPort): Promise<ChildLocalV2EnrollmentCandidate | null> {
  const policy = policyOf(policyValue), digest = digesterOf(digestValue);
  if (!policy || !digest || !safe(logicalMs)) return null;
  const seedBytes = ownBytes(seedValue, CHILD_LOCAL_SEED_V2_MAX_BYTES), next = prepare(nextValue, policy);
  let registryBytes: Uint8Array | null = null;
  try {
    if (!seedBytes || !next) return null;
    const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(seedBytes);
    const seed = decodeChildLocalUnenrolledSeedV2(JSON.parse(text), { version: policy.version, checksum: policy.checksum });
    const p = next.snapshot.protectedRecord, j = next.snapshot.restartJournal;
    if (!seed || text !== JSON.stringify(seed) || p.revision !== 2 || p.mode !== seed.mode
      || p.selectionRevision !== seed.selectionRevision || p.profileRevision !== seed.profileRevision
      || p.policyChecksum !== seed.policyChecksum || p.registryChecksum !== seed.registryChecksum
      || JSON.stringify(p.registry) !== JSON.stringify(seed.registry) || JSON.stringify(p.clock) !== JSON.stringify(seed.clock)
      || p.pin.revision !== 1 || p.pin.attempts.count !== 0 || p.pin.attempts.blockedUntilMs !== 0
      || p.pin.attempts.pendingAttemptId !== null || p.pin.attempts.lastObservedMs !== logicalMs
      || j.revision !== 1 || j.anchor.logicalMs !== logicalMs) return null;
    registryBytes = encode(seed.registry);
    if (await digestExact(registryBytes, digest) !== seed.registryChecksum) return null;
    const expectedSeedChecksum = await digestExact(seedBytes, digest); if (!expectedSeedChecksum) return null;
    const verified = await verify(next, digest);
    return verified ? Object.freeze({ ...verified, expectedSeedChecksum }) : null;
  } catch { return null; }
  finally { seedBytes?.fill(0); registryBytes?.fill(0); wipe(next); }
}
