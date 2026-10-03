import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decodeChildProfiles } from "../../src/child/childProfile";
import { childProtectedRecordBytes, type ChildProtectedRecord, type ChildProtectedUnenrolledSeed } from "../../src/child/childProtectedState";
import { validateChildCheckpointPinTransition, type ChildCheckpointPinTransitionBinding,
  type ChildCheckpointPinTransitionInput, type ChildCheckpointPinTransitionPolicy } from "./childCheckpointPinTransition";

// Real SHA-256 and the existing canonical full-record codec, synthetic records
// only. No permission, provisioning, PIN-input/KDF proof, native time or recovery
// is supplied by these pure backend cases. No fetch, SDK, Auth or real keys.
type Mutable<T> = T extends Uint8Array ? Uint8Array : T extends readonly (infer Item)[] ? Mutable<Item>[] : T extends object ? { -readonly [Key in keyof T]: Mutable<T[Key]> } : T;
const sha = (value: Uint8Array) => createHash("sha256").update(value).digest("hex");
const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
const clone = <T>(value: T): Mutable<T> => JSON.parse(JSON.stringify(value)) as Mutable<T>;
const rules: ChildCheckpointPinTransitionPolicy = { version: "pin-transition-fixture-v1", checksum: "a".repeat(64), maxPinIterations: 600_010, iterations: 600_000 };

function fixture(action: ChildCheckpointPinTransitionBinding["action"] = "replace", locale: "ru" | "en" = "ru") {
  const registry = decodeChildProfiles({ schemaVersion: 1, policyVersion: rules.version, activeProfileId: "fixture-child",
    profiles: [{ id: "fixture-child", label: locale === "ru" ? "Читатель" : "Reader", exactAge: 9, locale,
      ageConfirmedAt: "2026-10-01T12:00:00.000Z", readingLevel: null, allowedTopics: null, blockedTopics: ["violence"],
      soundEnabled: false, motion: "calm", narrationEnabled: false }] },
  { policyVersion: rules.version, now: Date.parse("2026-10-02T12:00:00.000Z") }).registry!;
  const before: Mutable<ChildProtectedRecord | ChildProtectedUnenrolledSeed> = {
    schemaVersion: 1, revision: 7, mode: "adult", selectionRevision: 3, profileRevision: 2,
    policyChecksum: rules.checksum, registryChecksum: sha(encode(registry)), registry: clone(registry),
    pin: action === "enroll" ? null : { schemaVersion: 1, policyVersion: rules.version, revision: 5, credentialId: "b".repeat(64),
      verifier: { algorithm: "PBKDF2-HMAC-SHA256", iterations: rules.iterations, saltHex: "c".repeat(64), hashHex: "d".repeat(64) },
      attempts: { count: 2, blockedUntilMs: 1_050, lastObservedMs: 1_000, pendingAttemptId: "e".repeat(64) } },
    clock: { schemaVersion: 1, bootId: "00000000-0000-4000-8000-000000000001", uptimeAnchorMs: 100, logicalAnchorMs: 1_000, epochAnchor: null } };
  const after: Mutable<ChildProtectedRecord> = { ...clone(before), revision: 8, pin: { schemaVersion: 1, policyVersion: rules.version,
    revision: action === "enroll" ? 1 : 6, credentialId: "2".repeat(64),
    verifier: { algorithm: "PBKDF2-HMAC-SHA256", iterations: rules.iterations, saltHex: "3".repeat(64), hashHex: "4".repeat(64) },
    attempts: { count: 0, blockedUntilMs: 0, lastObservedMs: 1_010, pendingAttemptId: null } } };
  const input: Mutable<ChildCheckpointPinTransitionInput> = { action, capturedLogicalMs: 1_010, expectedRevision: 7, nextRevision: 8,
    expectedRecordSha256: "", nextRecordSha256: "", expectedBytes: new Uint8Array(), nextBytes: new Uint8Array() };
  const policy = clone(rules);
  function refresh() {
    input.expectedBytes = childProtectedRecordBytes(before); input.nextBytes = childProtectedRecordBytes(after);
    input.expectedRecordSha256 = sha(input.expectedBytes); input.nextRecordSha256 = sha(input.nextBytes);
  }
  refresh(); return { before, after, input, policy, refresh };
}
type Fixture = ReturnType<typeof fixture>;
const binding = (value: ChildCheckpointPinTransitionInput): ChildCheckpointPinTransitionBinding => ({ action: value.action,
  capturedLogicalMs: value.capturedLogicalMs, expectedRevision: value.expectedRevision, nextRevision: value.nextRevision,
  expectedRecordSha256: value.expectedRecordSha256, nextRecordSha256: value.nextRecordSha256 });

const actions = ["enroll", "replace", "recover"] as const;
const positiveCases = actions.flatMap(action => (["ru", "en"] as const).map(locale => [action, locale] as const));
const mutations: Array<[string, (value: Fixture) => void]> = [
  ["root revision jump", f => { f.after.revision = 9; }],
  ["PIN revision jump", f => { f.after.pin.revision = 7; }],
  ["reused credential", f => { f.after.pin.credentialId = f.before.pin!.credentialId; }],
  ["reused salt", f => { f.after.pin.verifier.saltHex = f.before.pin!.verifier.saltHex; }],
  ["different configured iterations", f => { f.after.pin.verifier.iterations++; }],
  ["nonzero attempts", f => { f.after.pin.attempts.count = 1; f.after.pin.attempts.blockedUntilMs = 1_200; }],
  ["nonzero blocked time", f => { f.after.pin.attempts.blockedUntilMs = 1_200; }],
  ["pending attempt", f => { f.after.pin.attempts.pendingAttemptId = "f".repeat(64); }],
  ["reset timestamp differs from capture", f => { f.after.pin.attempts.lastObservedMs++; }],
  ["reset behind prior observation", f => { f.before.pin!.attempts.lastObservedMs = 1_020; f.before.pin!.attempts.blockedUntilMs = 1_050; }],
  ["mode change", f => { f.after.mode = "child"; }],
  ["selection revision change", f => { f.after.selectionRevision++; }],
  ["profile revision change", f => { f.after.profileRevision++; }],
  ["registry change with valid new digest", f => { f.after.registry.profiles[0].label = "Changed"; f.after.registryChecksum = sha(encode(f.after.registry)); }],
  ["boot change", f => { f.after.clock.bootId = "00000000-0000-4000-8000-000000000002"; }],
  ["epoch anchor replacement", f => { f.after.clock.epochAnchor = { epochAnchorMs: 1_800_000_000_000,
    validUntilEpochMs: 1_800_000_000_100, proofChecksum: "8".repeat(64) }; }],
];
const malformed: Array<[string, (value: Fixture) => void]> = [
  ["wrong expected whole digest", f => { f.input.expectedRecordSha256 = "0".repeat(64); }],
  ["wrong next whole digest", f => { f.input.nextRecordSha256 = "f".repeat(64); }],
  ["fractional expected revision", f => { f.input.expectedRevision = 7.5; }],
  ["nonconsecutive next revision", f => { f.input.nextRevision = 9; }],
  ["noncanonical uppercase digest", f => { f.input.expectedRecordSha256 = "A".repeat(64); }],
  ["unknown action", f => { f.input.action = "reset" as never; }],
];
const noncanonical: Array<[string, (value: Uint8Array) => Uint8Array]> = [
  ["leading whitespace", value => new TextEncoder().encode(" " + new TextDecoder().decode(value))],
  ["duplicate root key", value => new TextEncoder().encode(new TextDecoder().decode(value).replace('{"schemaVersion":1,', '{"schemaVersion":1,"schemaVersion":1,'))],
  ["invalid UTF-8", value => { const copy = value.slice(); copy[0] = 0xff; return copy; }],
  ["UTF-8 BOM", value => { const copy = new Uint8Array(value.length + 3); copy.set([0xef, 0xbb, 0xbf]); copy.set(value, 3); return copy; }],
  ["unknown root field", value => { const parsed = JSON.parse(new TextDecoder().decode(value)) as Record<string, unknown>; parsed.authorized = true; return encode(parsed); }],
];
const containers: Array<[string, (value: Uint8Array) => unknown]> = [
  ["empty", () => new Uint8Array()],
  ["oversized", () => new Uint8Array(131_073)],
  ["DataView", value => new DataView(value.slice().buffer as ArrayBuffer)],
  ["subclass", value => { class ForeignBytes extends Uint8Array {} return new ForeignBytes(value); }],
  ["shared", value => { const shared = new Uint8Array(new SharedArrayBuffer(value.length)); shared.set(value); return shared; }],
  ["prototype-spoofed shared", value => { const shared = new Uint8Array(new SharedArrayBuffer(value.length)); shared.set(value);
    Object.setPrototypeOf(shared.buffer, ArrayBuffer.prototype); return shared; }],
  ["detached", value => { const detached = value.slice(); structuredClone(detached.buffer, { transfer: [detached.buffer as ArrayBuffer] }); return detached; }],
  ["resizable", value => { const buffer = Reflect.construct(ArrayBuffer, [value.length, { maxByteLength: value.length + 1 }]) as ArrayBuffer;
    expect(Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, "resizable")?.get?.call(buffer)).toBe(true);
    const copy = new Uint8Array(buffer); copy.set(value); return copy; }],
];

describe("private canonical backend PIN-only full-record validation", () => {
  it.each(positiveCases)("validates existing %s semantics with unchanged %s full metadata", async (action, locale) => {
    const f = fixture(action, locale), old = f.input.expectedBytes.slice(), next = f.input.nextBytes.slice();
    const result = await validateChildCheckpointPinTransition(f.input, f.policy);
    expect(result).toEqual(binding(f.input)); expect(Object.isFrozen(result)).toBe(true);
    expect(f.input.expectedBytes).toEqual(old); expect(f.input.nextBytes).toEqual(next);
    expect(f.before.registry.profiles[0].locale).toBe(locale);
  });
  it("preserves an already selected child mode without issuing adult access", async () => {
    const f = fixture("recover"); f.before.mode = "child"; f.after.mode = "child"; f.refresh();
    expect(await validateChildCheckpointPinTransition(f.input, f.policy)).toEqual(binding(f.input));
    expect(f.before.mode).toBe("child"); expect(f.after.mode).toBe("child");
  });
  it("uses safe logical-counter limits rather than substituting epoch or server time", async () => {
    const f = fixture(); f.before.revision = f.input.expectedRevision = Number.MAX_SAFE_INTEGER - 1;
    f.after.revision = f.input.nextRevision = Number.MAX_SAFE_INTEGER;
    f.before.pin!.revision = Number.MAX_SAFE_INTEGER - 1; f.after.pin.revision = Number.MAX_SAFE_INTEGER;
    f.after.pin.attempts.lastObservedMs = f.input.capturedLogicalMs = Number.MAX_SAFE_INTEGER; f.refresh();
    expect(await validateChildCheckpointPinTransition(f.input, f.policy)).toEqual(binding(f.input));
  });
  it("accepts a previous configured KDF count and checks only the exact replacement count", async () => {
    const f = fixture(); f.before.pin!.verifier.iterations++; f.refresh();
    expect(await validateChildCheckpointPinTransition(f.input, f.policy)).toEqual(binding(f.input));
  });
  it.each(["enroll-enrolled", "replace-unenrolled", "recover-unenrolled"] as const)("denies %s without seed or recovery fallback", async kind => {
    const f = fixture(kind === "enroll-enrolled" ? "replace" : "enroll");
    f.input.action = kind === "enroll-enrolled" ? "enroll" : kind === "replace-unenrolled" ? "replace" : "recover";
    expect(await validateChildCheckpointPinTransition(f.input, f.policy)).toBeNull();
  });
  it.each(mutations)("denies exact full-record transition violation: %s", async (_name, mutate) => {
    const f = fixture(); mutate(f); f.refresh();
    expect(sha(f.input.expectedBytes)).toBe(f.input.expectedRecordSha256); expect(sha(f.input.nextBytes)).toBe(f.input.nextRecordSha256);
    expect(await validateChildCheckpointPinTransition(f.input, f.policy)).toBeNull();
  });
  it.each(malformed)("denies malformed comparison tuple: %s", async (_name, mutate) => {
    const f = fixture(); mutate(f); expect(await validateChildCheckpointPinTransition(f.input, f.policy)).toBeNull();
  });
  it.each(noncanonical)("denies %s even when the entire supplied bytes have the expected digest", async (_name, transform) => {
    const f = fixture(); f.input.expectedBytes = transform(f.input.expectedBytes); f.input.expectedRecordSha256 = sha(f.input.expectedBytes);
    expect(await validateChildCheckpointPinTransition(f.input, f.policy)).toBeNull();
  });
  it.each(["old", "next"] as const)("verifies the actual %s registry digest independently of the full supplied digest", async side => {
    const f = fixture(); (side === "old" ? f.before : f.after).registryChecksum = "9".repeat(64); f.refresh();
    expect(sha(f.input.expectedBytes)).toBe(f.input.expectedRecordSha256); expect(sha(f.input.nextBytes)).toBe(f.input.nextRecordSha256);
    expect(await validateChildCheckpointPinTransition(f.input, f.policy)).toBeNull();
  });
  it.each(["request", "policy"] as const)("refuses %s accessors without invoking them", async target => {
    const f = fixture(); let invoked = 0;
    Object.defineProperty(target === "request" ? f.input : f.policy, target === "request" ? "action" : "iterations",
      { enumerable: true, configurable: true, get() { invoked++; throw new Error("getter must not execute"); } });
    const result = await validateChildCheckpointPinTransition(f.input, f.policy);
    expect(result).toBeNull(); expect(invoked).toBe(0);
  });
  it.each(containers)("refuses %s byte storage before relying on a caller digest", async (_name, container) => {
    const f = fixture(); f.input.expectedBytes = container(f.input.expectedBytes) as Uint8Array;
    expect(await validateChildCheckpointPinTransition(f.input, f.policy)).toBeNull();
  });
  it("snapshots both complete byte arrays, fixed action, hashes, revisions and policy before the first await", async () => {
    const f = fixture("recover"), expected = binding(f.input), old = f.input.expectedBytes, next = f.input.nextBytes;
    const pending = validateChildCheckpointPinTransition(f.input, f.policy);
    old.fill(0); next.fill(0); f.input.action = "enroll"; f.input.expectedRevision = 999; f.input.nextRevision = 1000;
    f.input.expectedRecordSha256 = "0".repeat(64); f.input.nextRecordSha256 = "0".repeat(64); f.input.capturedLogicalMs = 0;
    f.policy.version = "mutated"; f.policy.iterations = 1; f.policy.checksum = "0".repeat(64);
    const result = await pending;
    expect(result).toEqual(expected); expect(Object.isFrozen(result)).toBe(true); expect(old.every(byte => byte === 0)).toBe(true);
    expect(next.every(byte => byte === 0)).toBe(true);
  });
  it("denies foreign request shape and malformed logical counters without inventing context or timeout fields", async () => {
    const f = fixture();
    for (const value of [{ ...f.input, authorized: true }, { ...f.input, operationSha256: "1".repeat(64) },
      Object.assign(Object.create({ action: "replace" }) as object, f.input), { ...f.input, [Symbol("permission")]: true },
      { ...f.input, capturedLogicalMs: Number.NaN }, { ...f.input, capturedLogicalMs: Number.MAX_SAFE_INTEGER + 1 },
      { ...f.input, capturedLogicalMs: -1 }, { ...f.input, capturedLogicalMs: 999 }]) {
      expect(await validateChildCheckpointPinTransition(value, f.policy)).toBeNull();
    }
  });
  it("rejects malformed or wider policy rather than claiming device calibration", async () => {
    const f = fixture();
    for (const value of [{ ...f.policy, iterations: 599_999 }, { ...f.policy, iterations: 600_011 },
      { ...f.policy, maxPinIterations: 0x1_0000_0000 }, { ...f.policy, maxPinIterations: 599_999 },
      { ...f.policy, version: "wrong-policy" }, { ...f.policy, checksum: "0".repeat(64) }, { ...f.policy, calibrated: true }]) {
      expect(await validateChildCheckpointPinTransition(f.input, value)).toBeNull();
    }
  });
  it("copies bounded offset views through intrinsic byte access without caller getters or methods", async () => {
    const f = fixture(), expected = binding(f.input); let invoked = 0;
    for (const key of ["expectedBytes", "nextBytes"] as const) {
      const backing = new Uint8Array(f.input[key].length + 8); backing.set(f.input[key], 4);
      const view = new Uint8Array(backing.buffer, 4, f.input[key].length);
      for (const own of ["byteLength", "byteOffset", "buffer", "slice", "set"]) Object.defineProperty(view, own,
        { configurable: true, get() { invoked++; throw new Error("borrowed byte accessor must not execute"); } });
      f.input[key] = view;
    }
    const result = await validateChildCheckpointPinTransition(f.input, f.policy);
    expect(result).toEqual(expected); expect(invoked).toBe(0);
  });
  it("returns only frozen primitive comparison metadata, including for descriptor-safe null-prototype input", async () => {
    const f = fixture("recover"), request = Object.assign(Object.create(null) as object, f.input);
    const result = await validateChildCheckpointPinTransition(request, f.policy);
    expect(result).toEqual(binding(f.input)); expect(Object.isFrozen(result)).toBe(true);
    expect(Object.keys(result!)).toEqual(["action", "capturedLogicalMs", "expectedRevision", "nextRevision", "expectedRecordSha256", "nextRecordSha256"]);
    expect(Object.values(result!).every(value => typeof value === "string" || typeof value === "number")).toBe(true);
    expect(Reflect.set(result!, "action", "enroll")).toBe(false); expect(result!.action).toBe("recover");
  });
});
