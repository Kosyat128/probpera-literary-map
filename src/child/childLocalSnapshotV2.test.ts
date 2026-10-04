import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { CHILD_LOCAL_SNAPSHOT_V2_MAX_BYTES, childLocalProtectedRecordV2Bytes, childLocalSnapshotV2Bytes,
  decodeChildLocalProtectedRecordV2, decodeChildLocalSnapshotV2, verifyChildLocalSnapshotV2Bytes,
  verifyChildLocalV2EnrollmentBytes } from "./childLocalSnapshotV2";

// New structural/digest boundary tests only. Explicit fixture delays are not a
// legal/product policy. No PIN derivation, native storage, time or OS proof runs.
const policy = () => ({ version: "synthetic-local-v2", checksum: "a".repeat(64), maxPinIterations: 600_000,
  backoffDelaysMs: [5, 20, 80] });
const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const digest = { async sha256(bytes: Uint8Array) { return hash(bytes); } };
function seed() {
  return { schemaVersion: 2, revision: 1, mode: "adult", selectionRevision: 1, profileRevision: 1,
    policyChecksum: policy().checksum,
    registryChecksum: "3bcb6774320bf9e7732200baf02422037aa055377d427a6b4d272ac78f462420",
    registry: { schemaVersion: 1, policyVersion: policy().version, activeProfileId: null, profiles: [] },
    pin: null, clock: { schemaVersion: 2, logicalMs: 0 } };
}
function profile(locale: "ru" | "en", locked?: boolean) {
  return { id: locale, label: locale === "ru" ? "Читатель" : "Reader", exactAge: 8, ageBand: "6-8", locale,
    ageConfirmedAt: "2026-10-01T12:00:00.000Z", readingLevel: "developing", allowedTopics: ["nature"],
    blockedTopics: ["horror"], soundEnabled: false, motion: "calm", narrationEnabled: true,
    ...(locked === undefined ? {} : { localeLocked: locked }) };
}
function fixture(count = 0, logical = 23) {
  const p = { ...seed(), revision: 2, pin: { schemaVersion: 1, policyVersion: policy().version, revision: 1,
    credentialId: "c".repeat(64), verifier: { algorithm: "PBKDF2-HMAC-SHA256", iterations: 600_000,
      saltHex: "d".repeat(64), hashHex: "e".repeat(64) },
    attempts: { count, blockedUntilMs: count ? logical + policy().backoffDelaysMs[Math.min(count - 1, 2)] : 0,
      lastObservedMs: logical, pendingAttemptId: count ? "f".repeat(64) : null } } };
  return { schemaVersion: 2, protectedRecord: p, restartJournal: { schemaVersion: 2, policyVersion: policy().version,
    policyChecksum: policy().checksum, revision: 1,
    protected: { checksum: hash(encode(p)), revision: p.revision, pinRevision: p.pin.revision, credentialId: p.pin.credentialId },
    attempts: { count, pendingAttemptId: p.pin.attempts.pendingAttemptId,
      savedCooldownMs: count ? policy().backoffDelaysMs[Math.min(count - 1, 2)] : 0 }, anchor: { logicalMs: logical } } };
}
const plain = (value: unknown) => JSON.parse(JSON.stringify(value));
function reseal(value: ReturnType<typeof fixture>) {
  const p = value.protectedRecord, j = value.restartJournal;
  p.registryChecksum = hash(encode(p.registry)); j.protected.checksum = hash(encode(p));
  j.protected.revision = p.revision; j.protected.pinRevision = p.pin.revision; j.protected.credentialId = p.pin.credentialId;
  return value;
}

describe("local v2 full snapshot comparisons without native admission", () => {
  it.each([0, 23])("accepts exact seed→enrolled bytes at supplied logical data %s while preserving seed clock zero", async logical => {
    const value = fixture(0, logical), bytes = encode(value);
    const result = await verifyChildLocalV2EnrollmentBytes(encode(seed()), bytes, logical, policy(), digest);
    expect(result?.checksum).toBe(hash(bytes)); expect(result?.expectedSeedChecksum).toBe(hash(encode(seed())));
    expect(result?.protectedChecksum).toBe(hash(encode(value.protectedRecord)));
    expect(result?.snapshot.protectedRecord.clock).toEqual({ schemaVersion: 2, logicalMs: 0 });
    expect(result?.snapshot.restartJournal.anchor.logicalMs).toBe(logical);
    expect(Reflect.ownKeys(result!)).toEqual(["snapshot", "protectedChecksum", "checksum", "expectedSeedChecksum"]);
  });
  it("decodes actual RU/EN registry grammar and retains optional locale lock without treating dates as current-time proof", async () => {
    const value = plain(fixture(2)); value.protectedRecord.mode = "child";
    value.protectedRecord.registry.activeProfileId = "ru";
    value.protectedRecord.registry.profiles = [profile("ru"), profile("en", false)]; reseal(value);
    const result = await verifyChildLocalSnapshotV2Bytes(encode(value), policy(), digest);
    expect(result?.snapshot.protectedRecord.registry.profiles.map(p => p.locale)).toEqual(["ru", "en"]);
    expect(Object.prototype.hasOwnProperty.call(result!.snapshot.protectedRecord.registry.profiles[0], "localeLocked")).toBe(false);
    expect(result!.snapshot.protectedRecord.registry.profiles[1].localeLocked).toBe(false);
    expect(result?.snapshot.restartJournal.attempts).toEqual({ count: 2, pendingAttemptId: "f".repeat(64), savedCooldownMs: 20 });
  });
  it("copies and freezes every metadata branch without exposing a native capability or wire alias", async () => {
    const input = fixture(), result = await verifyChildLocalSnapshotV2Bytes(encode(input), policy(), digest);
    input.protectedRecord.pin.verifier.hashHex = "0".repeat(64); input.restartJournal.anchor.logicalMs = 99;
    expect(result?.snapshot.protectedRecord.pin.verifier.hashHex).toBe("e".repeat(64));
    for (const value of [result, result?.snapshot, result?.snapshot.protectedRecord, result?.snapshot.protectedRecord.registry,
      result?.snapshot.protectedRecord.registry.profiles, result?.snapshot.protectedRecord.pin,
      result?.snapshot.protectedRecord.pin.verifier, result?.snapshot.protectedRecord.pin.attempts,
      result?.snapshot.protectedRecord.clock, result?.snapshot.restartJournal, result?.snapshot.restartJournal.protected,
      result?.snapshot.restartJournal.attempts, result?.snapshot.restartJournal.anchor]) expect(Object.isFrozen(value)).toBe(true);
    expect(result).not.toHaveProperty("verified"); expect(result).not.toHaveProperty("permission");
    expect(result).not.toHaveProperty("nativeSession");
  });
  it("keeps P checksum independent of journal bytes and external whole checksum distinct", async () => {
    const first = fixture(), second = plain(first); second.restartJournal.revision++;
    const a = await verifyChildLocalSnapshotV2Bytes(encode(first), policy(), digest);
    const b = await verifyChildLocalSnapshotV2Bytes(encode(second), policy(), digest);
    expect(a?.protectedChecksum).toBe(b?.protectedChecksum); expect(a?.checksum).not.toBe(b?.checksum);
    expect(first.restartJournal.protected.checksum).toBe(a?.protectedChecksum);
    expect(first.protectedRecord).not.toHaveProperty("restartJournal");
  });
  it("distinguishes structural checksum strings from independently digested exact registry and P bytes", async () => {
    const value = fixture(); value.protectedRecord.registryChecksum = "b".repeat(64); reseal(value);
    // Resealing computes registry digest: instead change only the P registry hash
    // and make J genuinely bind those changed P bytes.
    value.protectedRecord.registryChecksum = "b".repeat(64); value.restartJournal.protected.checksum = hash(encode(value.protectedRecord));
    expect(decodeChildLocalSnapshotV2(value, policy())).not.toBeNull();
    expect(await verifyChildLocalSnapshotV2Bytes(encode(value), policy(), digest)).toBeNull();
    const wrongP = fixture(); wrongP.restartJournal.protected.checksum = "b".repeat(64);
    expect(decodeChildLocalSnapshotV2(wrongP, policy())).not.toBeNull();
    expect(await verifyChildLocalSnapshotV2Bytes(encode(wrongP), policy(), digest)).toBeNull();
  });
  it.each(["root-revision", "pin-revision", "credential", "count", "pending", "anchor", "delay", "policy", "lower-bound"])(
    "denies cross-component %s disagreement before any digest callback", async kind => {
      const s = fixture(2), j = s.restartJournal;
      if (kind === "root-revision") j.protected.revision++;
      if (kind === "pin-revision") j.protected.pinRevision++;
      if (kind === "credential") j.protected.credentialId = "0".repeat(64);
      if (kind === "count") { j.attempts.count = 3; j.attempts.savedCooldownMs = 80; }
      if (kind === "pending") j.attempts.pendingAttemptId = "0".repeat(64);
      if (kind === "anchor") j.anchor.logicalMs++;
      if (kind === "delay") s.protectedRecord.pin.attempts.blockedUntilMs++;
      if (kind === "policy") j.policyVersion = "other";
      if (kind === "lower-bound") s.protectedRecord.clock.logicalMs = 24;
      const sha256 = vi.fn(digest.sha256);
      expect(decodeChildLocalSnapshotV2(s, policy())).toBeNull();
      expect(await verifyChildLocalSnapshotV2Bytes(encode(s), policy(), { sha256 })).toBeNull(); expect(sha256).not.toHaveBeenCalled();
    });
  it("accepts equal/lower durable clock bounds and finalized mismatch debt, without requiring triple anchor equality", async () => {
    const value = fixture(2); value.restartJournal.attempts.pendingAttemptId = null;
    value.protectedRecord.pin.attempts.pendingAttemptId = null; value.protectedRecord.clock.logicalMs = 23; reseal(value);
    expect(await verifyChildLocalSnapshotV2Bytes(encode(value), policy(), digest)).not.toBeNull();
    value.protectedRecord.clock.logicalMs = 0; reseal(value);
    expect(await verifyChildLocalSnapshotV2Bytes(encode(value), policy(), digest)).not.toBeNull();
  });
  it.each(["floor", "salt", "algorithm", "pin-revision", "unsafe-revision", "unsafe-time", "zero-debt-pending", "boot-clock"])(
    "preserves closed PIN/v2 clock denial for %s", async kind => {
      const s = plain(fixture()), p = s.protectedRecord;
      if (kind === "floor") p.pin.verifier.iterations = 599_999;
      if (kind === "salt") p.pin.verifier.saltHex = "D".repeat(64);
      if (kind === "algorithm") p.pin.verifier.algorithm = "SHA-256";
      if (kind === "pin-revision") p.pin.revision = 0;
      if (kind === "unsafe-revision") p.revision = Number.MAX_SAFE_INTEGER + 1;
      if (kind === "unsafe-time") p.pin.attempts.lastObservedMs = Number.MAX_SAFE_INTEGER + 1;
      if (kind === "zero-debt-pending") p.pin.attempts.pendingAttemptId = "f".repeat(64);
      if (kind === "boot-clock") p.clock.bootId = "00000000-0000-0000-0000-000000000000";
      expect(decodeChildLocalProtectedRecordV2(p, policy())).toBeNull();
      expect(await verifyChildLocalSnapshotV2Bytes(encode(s), policy(), digest)).toBeNull();
    });
  it("enforces supplied iteration ceiling and safe cooldown addition without inventing new delay values", async () => {
    const s = fixture(); s.protectedRecord.pin.verifier.iterations = 600_001;
    expect(decodeChildLocalProtectedRecordV2(s.protectedRecord, policy())).toBeNull();
    const p = policy(); p.maxPinIterations = 600_001; reseal(s);
    expect(await verifyChildLocalSnapshotV2Bytes(encode(s), p, digest)).not.toBeNull();
    const overflow = fixture(1, Number.MAX_SAFE_INTEGER - 4);
    expect(decodeChildLocalSnapshotV2(overflow, policy())).toBeNull();
    const safeMaximum = fixture(); safeMaximum.protectedRecord.revision = Number.MAX_SAFE_INTEGER; reseal(safeMaximum);
    expect(await verifyChildLocalSnapshotV2Bytes(encode(safeMaximum), policy(), digest)).not.toBeNull();
    expect(await verifyChildLocalV2EnrollmentBytes(encode(seed()), encode(safeMaximum), 23, policy(), digest)).toBeNull();
  });
  it.each(["padding", "bom", "duplicate", "order", "escape", "utf8", "oversize", "extra"])(
    "rejects noncanonical/oversized %s whole wire bytes before hashing", async kind => {
      const text = JSON.stringify(fixture()); let bytes = new TextEncoder().encode(text);
      if (kind === "padding") bytes = new TextEncoder().encode(text + "\n");
      if (kind === "bom") bytes = new TextEncoder().encode("\ufeff" + text);
      if (kind === "duplicate") bytes = new TextEncoder().encode(text.replace('"revision":2', '"revision":2,"revision":2'));
      if (kind === "order") bytes = new TextEncoder().encode(text.replace('"schemaVersion":2,"protectedRecord":', '"protectedRecord":') .replace(/\}$/u, ',"schemaVersion":2}'));
      if (kind === "escape") bytes = new TextEncoder().encode(text.replace("synthetic-local-v2", "synthetic-\\u006cocal-v2"));
      if (kind === "utf8") bytes = new Uint8Array([255]);
      if (kind === "oversize") bytes = new Uint8Array(CHILD_LOCAL_SNAPSHOT_V2_MAX_BYTES + 1);
      if (kind === "extra") bytes = encode({ ...fixture(), approved: true });
      const sha256 = vi.fn(digest.sha256);
      expect(await verifyChildLocalSnapshotV2Bytes(bytes, policy(), { sha256 })).toBeNull(); expect(sha256).not.toHaveBeenCalled();
    });
  it("does not reinterpret bare seed, null journal, pin-null wrapper or corrupted old state as enrolled", async () => {
    expect(decodeChildLocalSnapshotV2(seed(), policy())).toBeNull();
    expect(decodeChildLocalProtectedRecordV2(seed(), policy())).toBeNull();
    expect(await verifyChildLocalSnapshotV2Bytes(encode({ schemaVersion: 2, protectedRecord: seed(), restartJournal: null }), policy(), digest)).toBeNull();
    expect(await verifyChildLocalV2EnrollmentBytes(null, encode(fixture()), 23, policy(), digest)).toBeNull();
    expect(await verifyChildLocalV2EnrollmentBytes(new Uint8Array([255]), encode(fixture()), 23, policy(), digest)).toBeNull();
    const prior = seed(); prior.revision = 2;
    expect(await verifyChildLocalV2EnrollmentBytes(encode(prior), encode(fixture()), 23, policy(), digest)).toBeNull();
    expect(await verifyChildLocalV2EnrollmentBytes(encode(fixture()), encode(fixture()), 23, policy(), digest)).toBeNull();
  });
  it.each(["root-revision", "pin-revision", "journal-revision", "clock", "registry", "charged", "logical"])(
    "refuses later/reset/non-PIN %s changes in the only seed enrollment transition", async kind => {
      const s = plain(fixture()); let logical: unknown = 23;
      if (kind === "root-revision") s.protectedRecord.revision = 3;
      if (kind === "pin-revision") s.protectedRecord.pin.revision = 2;
      if (kind === "journal-revision") s.restartJournal.revision = 2;
      if (kind === "clock") s.protectedRecord.clock.logicalMs = 1;
      if (kind === "registry") { s.protectedRecord.registry.profiles = [profile("ru")]; s.protectedRecord.profileRevision = 2; }
      if (kind === "charged") {
        s.protectedRecord.pin.attempts = { count: 1, blockedUntilMs: 28, lastObservedMs: 23, pendingAttemptId: "f".repeat(64) };
        s.restartJournal.attempts = { count: 1, pendingAttemptId: "f".repeat(64), savedCooldownMs: 5 };
      }
      if (kind === "logical") logical = 24;
      reseal(s);
      expect(await verifyChildLocalSnapshotV2Bytes(encode(s), policy(), digest)).not.toBeNull();
      expect(await verifyChildLocalV2EnrollmentBytes(encode(seed()), encode(s), logical, policy(), digest)).toBeNull();
    });
  it("denies unsafe policy, accessors and serializer hooks without invoking caller getters", async () => {
    const getter = vi.fn(() => "unsafe"), p = policy(), s = fixture();
    Object.defineProperty(p, "version", { enumerable: true, get: getter });
    expect(decodeChildLocalSnapshotV2(s, p)).toBeNull();
    Object.defineProperty(s.protectedRecord.pin.verifier, "hashHex", { enumerable: true, get: getter });
    expect(() => childLocalProtectedRecordV2Bytes(s.protectedRecord, policy())).toThrow();
    expect(() => childLocalSnapshotV2Bytes(s, policy())).toThrow(); expect(getter).not.toHaveBeenCalled();
    const port = Object.defineProperty({}, "sha256", { enumerable: true, get: getter });
    expect(await verifyChildLocalSnapshotV2Bytes(encode(fixture()), policy(), port as typeof digest)).toBeNull();
    expect(getter).not.toHaveBeenCalled();
    for (const delays of [[], [0], [5, 5], [20, 5], [Number.MAX_SAFE_INTEGER + 1]]) {
      expect(decodeChildLocalSnapshotV2(fixture(), { ...policy(), backoffDelaysMs: delays })).toBeNull();
    }
    expect(decodeChildLocalSnapshotV2(fixture(), { ...policy(), version: "x".repeat(97) })).toBeNull();
    const negative = fixture(); negative.protectedRecord.clock.logicalMs = -0;
    expect(decodeChildLocalProtectedRecordV2(negative.protectedRecord, policy())).toBeNull();
  });
  it("snapshots both enrollment wires and policy before a delayed external digest", async () => {
    const before = encode(seed()), after = encode(fixture()), p = policy(); let release!: () => void;
    const barrier = new Promise<void>(resolve => { release = resolve; });
    const pending = verifyChildLocalV2EnrollmentBytes(before, after, 23, p, { async sha256(bytes) { await barrier; return hash(bytes); } });
    before.fill(0); after.fill(0); p.version = "changed"; p.checksum = "b".repeat(64); p.backoffDelaysMs[0] = 99; release();
    const result = await pending;
    expect(result?.snapshot.restartJournal.policyVersion).toBe("synthetic-local-v2");
    expect(result?.snapshot.protectedRecord.policyChecksum).toBe("a".repeat(64));
  });
  it("denies borrowed digest mutation and wipes all actually exposed digest buffers on success or failure", async () => {
    const borrowed: Uint8Array[] = [];
    const result = await verifyChildLocalSnapshotV2Bytes(encode(fixture()), policy(), { async sha256(bytes) {
      borrowed.push(bytes); const answer = hash(bytes); bytes.fill(7); return answer;
    } });
    expect(result).toBeNull(); expect(borrowed).toHaveLength(1); expect(borrowed.every(bytes => bytes.every(b => b === 0))).toBe(true);
    borrowed.length = 0;
    const everyHook = vi.fn(() => true), lengthHook = vi.fn();
    const hooked = await verifyChildLocalSnapshotV2Bytes(encode(fixture()), policy(), { async sha256(bytes) {
      borrowed.push(bytes); const answer = hash(bytes), size = bytes.length; bytes.fill(7);
      Object.defineProperty(bytes, "every", { value: everyHook });
      Object.defineProperty(bytes, "length", { get() { lengthHook(); return size; } }); return answer;
    } });
    expect(hooked).toBeNull(); expect(everyHook).not.toHaveBeenCalled(); expect(lengthHook).not.toHaveBeenCalled();
    expect(borrowed).toHaveLength(1);
    expect(borrowed.every(bytes => Uint8Array.prototype.every.call(bytes, (byte: number) => byte === 0))).toBe(true);
    borrowed.length = 0;
    expect(await verifyChildLocalSnapshotV2Bytes(encode(fixture()), policy(), { async sha256(bytes) { borrowed.push(bytes); return hash(bytes); } })).not.toBeNull();
    expect(borrowed).toHaveLength(3); expect(borrowed.every(bytes => bytes.every(b => b === 0))).toBe(true);
    borrowed.length = 0;
    expect(await verifyChildLocalV2EnrollmentBytes(encode(seed()), encode(fixture()), 23, policy(), { async sha256(bytes) {
      borrowed.push(bytes); throw new Error("digest unavailable");
    } })).toBeNull(); expect(borrowed.every(bytes => bytes.every(b => b === 0))).toBe(true);
  });
  it("denies shared/spoofed/extended views and failed digests without granting a fresh-seed fallback", async () => {
    const shared = new SharedArrayBuffer(16), view = new Uint8Array(shared); Object.setPrototypeOf(shared, ArrayBuffer.prototype);
    const extended = encode(fixture()); Object.defineProperty(extended, "approved", { value: true });
    for (const bytes of [view, extended, new DataView(new ArrayBuffer(16))]) {
      const sha256 = vi.fn(digest.sha256);
      expect(await verifyChildLocalSnapshotV2Bytes(bytes, policy(), { sha256 })).toBeNull(); expect(sha256).not.toHaveBeenCalled();
    }
    expect(await verifyChildLocalSnapshotV2Bytes(encode(fixture()), policy(), { async sha256() { return "approved"; } })).toBeNull();
    expect(await verifyChildLocalSnapshotV2Bytes(encode(fixture()), policy(), { async sha256() { throw new Error("missing"); } })).toBeNull();
    expect(await verifyChildLocalSnapshotV2Bytes(encode(fixture()), policy(), { async sha256(bytes) {
      const answer = hash(bytes), buffer = bytes.buffer as ArrayBuffer;
      structuredClone(buffer, { transfer: [buffer] }); return answer;
    } })).toBeNull(); // Malformed digest detachment is denied, not a cleanup exception or a wipe-of-transferred-memory claim.
  });
});
