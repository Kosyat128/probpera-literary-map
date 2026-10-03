import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { decodeChildProfiles } from "./childProfile";
import { childProtectedRecordBytes, decodeChildProtectedRecord, decodeChildProtectedUnenrolledSeed,
  type ChildProtectedRecord, type ChildProtectedUnenrolledSeed } from "./childProtectedState";
import { createParentPinEnrollment, type ParentPinEnrollmentInspection, type ParentPinEnrollmentMutation,
  type ParentPinEnrollmentNativePort, type ParentPinEnrollmentOptions } from "./parentPinEnrollment";

// Explicit synthetic lifecycle/calibration/recovery fixtures only. Real SHA is
// used for exact-byte protocol checks; this is not installed native permission,
// nonrollback authority, genuine trusted time or device calibration evidence.
// The existing independent real 600k WebCrypto comparison remains retained;
// these lifecycle tests do not repeat it or infer calibration from that result.
const policy = { version: "synthetic-enrollment-v1", checksum: "a".repeat(64), maxPinIterations: 600_000,
  iterations: 600_000, minDigits: 4, maxDigits: 12 };
const bootId = "00000000-0000-4000-8000-000000000001";
const epoch = "e".repeat(64);
const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
const signal = () => new AbortController().signal;
type MutableOptions = { -readonly [Key in keyof ParentPinEnrollmentOptions]: ParentPinEnrollmentOptions[Key] };
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject };
}
function before(enrolled = false, locale: "ru" | "en" = "ru"): ChildProtectedRecord | ChildProtectedUnenrolledSeed {
  const registry = decodeChildProfiles({ schemaVersion: 1, policyVersion: policy.version, activeProfileId: "synthetic-child",
    profiles: [{ id: "synthetic-child", label: "Synthetic Reader", exactAge: 9, locale,
      ageConfirmedAt: "2026-10-01T12:00:00.000Z", readingLevel: null, allowedTopics: null, blockedTopics: ["violence"],
      soundEnabled: false, motion: "calm", narrationEnabled: false }] },
  { policyVersion: policy.version, now: Date.parse("2026-10-02T12:00:00.000Z") }).registry!;
  const common = { schemaVersion: 1 as const, revision: 7, mode: "adult" as const, selectionRevision: 3, profileRevision: 2,
    policyChecksum: policy.checksum, registryChecksum: sha(encode(registry)), registry };
  const clock = { schemaVersion: 1 as const, bootId, uptimeAnchorMs: 100, logicalAnchorMs: 1_000, epochAnchor: null };
  return enrolled ? { ...common, pin: { schemaVersion: 1, policyVersion: policy.version, revision: 5,
    credentialId: "b".repeat(64), verifier: { algorithm: "PBKDF2-HMAC-SHA256", iterations: 600_000,
      saltHex: "c".repeat(64), hashHex: "d".repeat(64) },
    attempts: { count: 2, blockedUntilMs: 1_050, lastObservedMs: 1_000, pendingAttemptId: "f".repeat(64) } }, clock }
    : { ...common, pin: null, clock };
}
function fixture(enrolled = false, locale: "ru" | "en" = "ru") {
  const state = { record: before(enrolled, locale), operationMs: 0, uptimeMs: 110,
    bootId, nativePermission: true, recoveryAccepted: true };
  const events: string[] = [], inputs: Uint8Array[] = [], kdfBuffers: Uint8Array[] = [], randomBuffers: Uint8Array[] = [];
  const nativeBuffers: Uint8Array[] = [];
  type Binding = { session: object; expected: Uint8Array; checksum: string; deadline: number; consumed: boolean };
  const bindings = new WeakMap<ParentPinEnrollmentInspection, Binding>();
  const authenticated = (challenge: ParentPinEnrollmentInspection) => {
    const bytes = childProtectedRecordBytes(state.record), session = Object.freeze(Object.create(null)) as object;
    nativeBuffers.push(bytes); const deadline = state.uptimeMs + 1_000;
    bindings.set(challenge, { session, expected: bytes.slice(), checksum: sha(bytes), deadline, consumed: false });
    return { status: state.record.pin ? "enrolled" : "unenrolled", challenge, session, epoch,
      bytes, checksum: sha(bytes), sample: { bootId: state.bootId, uptimeMs: state.uptimeMs }, deadlineUptimeMs: deadline };
  };
  const native: ParentPinEnrollmentNativePort = {
    begin: vi.fn(async challenge => { events.push("begin"); return authenticated(challenge); }),
    commit: vi.fn(async (challenge, abort) => {
      events.push("commit"); const binding = bindings.get(challenge.inspection);
      const refused = () => ({ status: "denied", challenge, session: challenge.nativeSession });
      if (!binding || binding.session !== challenge.nativeSession || binding.consumed || abort.aborted
        || !state.nativePermission || state.bootId !== challenge.bootId || challenge.nativeEpoch !== epoch
        || binding.deadline !== challenge.deadlineUptimeMs || state.uptimeMs >= binding.deadline
        || sha(binding.expected) !== challenge.expectedChecksum || binding.checksum !== challenge.expectedChecksum
        || sha(childProtectedRecordBytes(state.record)) !== challenge.expectedChecksum
        || sha(challenge.expectedBytes) !== challenge.expectedChecksum || sha(challenge.nextBytes) !== challenge.nextChecksum
        || state.record.revision !== challenge.expectedRevision || challenge.nextRevision !== challenge.expectedRevision + 1
        || challenge.inspection.action === "recover" && (!challenge.recoveryPermission || !state.recoveryAccepted)) return refused();
      const next = decodeChildProtectedRecord(JSON.parse(new TextDecoder().decode(challenge.nextBytes)), policy);
      if (!next || next.revision !== challenge.nextRevision
        || JSON.stringify({ ...next, pin: null, revision: state.record.revision }) !== JSON.stringify({ ...state.record, pin: null })) return refused();
      binding.consumed = true; state.record = clone(next);
      const bytes = childProtectedRecordBytes(state.record); nativeBuffers.push(bytes); events.push("locked-readback");
      return { status: "committed", challenge, session: binding.session, bytes, checksum: sha(bytes) };
    }),
    cancel: vi.fn(async () => { events.push("cancel"); return undefined; }),
    retire: vi.fn(async challenge => { events.push("retire"); return { status: "closed", challenge }; }),
  };
  const readPin = vi.fn(async (_challenge: ParentPinEnrollmentInspection, _entry: "new" | "confirm", _abort: AbortSignal): Promise<unknown> => {
    events.push("input"); const pin = Uint8Array.of(49, 50, 51, 52); inputs.push(pin); return pin;
  });
  const derive = vi.fn(async (pin: Uint8Array, salt: Uint8Array, iterations: number) => {
    events.push("derive"); expect(iterations).toBe(600_000); kdfBuffers.push(pin, salt);
    const output = new Uint8Array(32).fill(9); kdfBuffers.push(output); return output;
  });
  let randomSequence = 0;
  const options: MutableOptions = { native, input: { readPin }, kdf: { derive }, policy: clone(policy),
    digest: { sha256: async bytes => sha(bytes) }, clock: { nowMonotonicMs: () => state.operationMs }, timeoutMs: 1_000,
    initialVisibility: "active", random: { getRandomValues: <T extends ArrayBufferView | null>(bytes: T): T => {
      if (!(bytes instanceof Uint8Array)) throw new TypeError("synthetic fixture only");
      bytes.fill(++randomSequence); randomBuffers.push(bytes); return bytes;
    } },
    calibration: { verify: vi.fn(async (challenge, iterations) => { events.push("calibration"); return { status: "calibrated", challenge, iterations }; }) },
    recovery: { authorize: vi.fn(async challenge => { events.push("recovery"); return { status: "authorized", challenge,
      permission: Object.freeze(Object.create(null)) as object }; }) } };
  return { state, native, inputs, kdfBuffers, randomBuffers, nativeBuffers, events, readPin, derive, options, authenticated,
    make: () => createParentPinEnrollment(options), stored: () => clone(state.record) };
}
afterEach(() => vi.useRealTimers());

describe("parent PIN lifecycle with explicit native ownership dependencies", () => {
  it("decodes only explicit adult null-PIN seeds while enrolled decoder remains strict", () => {
    const seed = before(false), decoded = decodeChildProtectedUnenrolledSeed(seed, policy)!;
    expect(decoded).toEqual(seed); expect(Object.isFrozen(decoded.registry)).toBe(true);
    expect(decodeChildProtectedRecord(seed, policy)).toBeNull();
    expect(decodeChildProtectedUnenrolledSeed(before(true), policy)).toBeNull();
    const { pin: _pin, ...absent } = seed;
    for (const invalid of [null, absent, { ...seed, mode: "child" }, { ...seed, pin: undefined }, { ...seed, permission: true },
      { ...seed, clock: { ...seed.clock, bootId: "bad" } }, { ...seed, registry: null }])
      expect(decodeChildProtectedUnenrolledSeed(invalid, policy)).toBeNull();
  });
  it.each(["ru", "en"] as const)("enrolls from exact %s seed without changing profiles/selection/clock or granting admission", async locale => {
    const f = fixture(false, locale), old = f.stored(), engine = f.make();
    expect(await engine.request("enroll", signal())).toEqual({ status: "committed", action: "enroll" });
    const next = f.stored(); expect(next.revision).toBe(old.revision + 1); expect(next.pin!.revision).toBe(1);
    expect({ ...next, pin: null, revision: old.revision }).toEqual(old);
    expect(next.pin!.verifier).toEqual({ algorithm: "PBKDF2-HMAC-SHA256", iterations: 600_000,
      saltHex: "02".repeat(32), hashHex: "09".repeat(32) });
    expect(next.pin!.credentialId).toBe("03".repeat(32));
    expect(next.pin!.attempts).toEqual({ count: 0, blockedUntilMs: 0, lastObservedMs: 1_010, pendingAttemptId: null });
    expect(f.events).toEqual(["begin", "calibration", "input", "input", "derive", "commit", "locked-readback", "retire"]);
    for (const bytes of [...f.inputs, ...f.kdfBuffers, ...f.randomBuffers, ...f.nativeBuffers]) expect([...bytes].every(byte => byte === 0)).toBe(true);
    expect(engine.getSnapshot()).toEqual({ phase: "idle" }); expect(JSON.stringify(engine.getSnapshot())).not.toContain("Synthetic Reader");
  });
  it("replaces credential/verifier and attempts only through exact full native CAS permission", async () => {
    const f = fixture(true), old = f.stored(); expect(await f.make().request("replace", signal())).toEqual({ status: "committed", action: "replace" });
    const next = f.stored(); expect(next.pin!.revision).toBe(old.pin!.revision + 1);
    expect(next.pin!.credentialId).not.toBe(old.pin!.credentialId); expect(next.pin!.verifier.saltHex).not.toBe(old.pin!.verifier.saltHex);
    expect({ ...next, pin: null, revision: old.revision }).toEqual({ ...old, pin: null });
  });
  it.each(["native", "input", "calibration"] as const)("stays unavailable without the %s dependency", async missing => {
    const f = fixture(); const options = { ...f.options, [missing]: undefined };
    expect(await createParentPinEnrollment(options).request("enroll", signal())).toEqual({ status: "unavailable" });
    expect(f.native.begin).not.toHaveBeenCalled(); expect(f.readPin).not.toHaveBeenCalled();
  });
  it("rejects policies below the KDF floor and invalid PIN length/timing bounds", () => {
    const f = fixture();
    for (const patch of [{ iterations: 599_999 }, { maxPinIterations: 599_999 }, { minDigits: 0 }, { minDigits: 3 }, { maxDigits: 129 }, { minDigits: 13 }])
      expect(() => createParentPinEnrollment({ ...f.options, policy: { ...policy, ...patch } })).toThrow(TypeError);
    expect(() => createParentPinEnrollment({ ...f.options, timeoutMs: 0 })).toThrow(TypeError);
    expect(() => createParentPinEnrollment({ ...f.options, timeoutMs: 60_001 })).toThrow(TypeError);
  });
  it.each(["enroll", "replace", "recover"] as const)("rejects %s with the wrong enrolled-state kind without KDF/publication", async action => {
    const f = fixture(action === "enroll"); expect(await f.make().request(action, signal())).toEqual({ status: "denied" });
    expect(f.derive).not.toHaveBeenCalled(); expect(f.native.commit).not.toHaveBeenCalled();
  });
  it("honors a known native refusal and permits another request only after owned retirement", async () => {
    const f = fixture(); f.native.begin = vi.fn(async challenge => ({ status: "denied", challenge })); const engine = f.make();
    expect(await engine.request("enroll", signal())).toEqual({ status: "denied" }); expect(engine.getSnapshot()).toEqual({ phase: "idle" });
    expect(await engine.request("enroll", signal())).toEqual({ status: "denied" }); expect(f.native.retire).toHaveBeenCalledTimes(2);
  });
  it.each(["boolean", "copied-challenge", "wrong-sha", "noncanonical", "missing-seed", "child-seed", "registry-sha", "bad-clock", "bad-epoch", "extra-field"])(
    "seals uncertain native begin %s and never creates a default credential", async fault => {
      const f = fixture(); let raw: Uint8Array | null = null;
      f.native.begin = vi.fn(async challenge => {
        const reply = f.authenticated(challenge); raw = reply.bytes;
        if (fault === "boolean") return true;
        if (fault === "copied-challenge") return { ...reply, challenge: { ...challenge } };
        if (fault === "wrong-sha") return { ...reply, checksum: "f".repeat(64) };
        if (fault === "noncanonical") { raw = new TextEncoder().encode(" " + new TextDecoder().decode(reply.bytes)); return { ...reply, bytes: raw, checksum: sha(raw) }; }
        if (fault === "missing-seed") return { ...reply, bytes: null };
        if (fault === "child-seed" || fault === "registry-sha") {
          raw = encode({ ...f.state.record, ...(fault === "child-seed" ? { mode: "child" } : { registryChecksum: "f".repeat(64) }) });
          return { ...reply, bytes: raw, checksum: sha(raw) };
        }
        if (fault === "bad-clock") return { ...reply, sample: { bootId, uptimeMs: 99 } };
        if (fault === "bad-epoch") return { ...reply, epoch: "unknown" };
        return { ...reply, permission: true };
      });
      const engine = f.make(); expect(await engine.request("enroll", signal())).toEqual({ status: "unavailable" });
      expect(engine.getSnapshot()).toEqual({ phase: "unavailable" }); expect(await engine.request("enroll", signal())).toEqual({ status: "unavailable" });
      expect(f.state.record.pin).toBeNull(); expect(f.derive).not.toHaveBeenCalled(); expect(f.native.begin).toHaveBeenCalledTimes(1);
      if (raw && !["boolean", "missing-seed"].includes(fault)) expect([...raw].every(byte => byte === 0)).toBe(true);
    });
  it("captures immutable native bytes/sample before asynchronous digest verification", async () => {
    const f = fixture(), entered = deferred<void>(), release = deferred<void>(); let reply!: ReturnType<typeof f.authenticated>;
    f.native.begin = vi.fn(async challenge => { reply = f.authenticated(challenge); return reply; });
    let first = true; f.options.digest.sha256 = async bytes => { if (first) { first = false; entered.resolve(); await release.promise; } return sha(bytes); };
    const pending = f.make().request("enroll", signal()); await entered.promise;
    reply.bytes.fill(0); reply.sample.uptimeMs = 0; release.resolve();
    expect(await pending).toEqual({ status: "committed", action: "enroll" });
  });
  it.each([null, Uint8Array.of(49), Uint8Array.of(49, 50, 51, 120), new Uint8Array(129).fill(49)])(
    "rejects invalid first PIN and wipes owned supplied buffers before derivation", async entry => {
      const f = fixture(); f.readPin.mockResolvedValueOnce(entry);
      expect(await f.make().request("enroll", signal())).toEqual({ status: "denied" }); expect(f.derive).not.toHaveBeenCalled();
      if (entry) expect([...entry].every(byte => byte === 0)).toBe(true); expect(f.native.commit).not.toHaveBeenCalled();
    });
  it.each([Uint8Array.of(49, 50, 51), Uint8Array.of(49, 50, 51, 53), null])("requires explicit matching confirmation", async repeated => {
    const f = fixture(); f.readPin.mockResolvedValueOnce(Uint8Array.of(49, 50, 51, 52)).mockResolvedValueOnce(repeated);
    expect(await f.make().request("enroll", signal())).toEqual({ status: "denied" }); expect(f.derive).not.toHaveBeenCalled();
    if (repeated) expect([...repeated].every(byte => byte === 0)).toBe(true);
  });
  it("refuses uncalibrated or copied calibration receipts before PIN input", async () => {
    for (const fault of ["boolean", "copy", "iterations"]) {
      const f = fixture(); f.options.calibration = { verify: async (challenge, iterations) => fault === "boolean" ? true
        : { status: "calibrated", challenge: fault === "copy" ? { ...challenge } : challenge, iterations: iterations + (fault === "iterations" ? 1 : 0) } };
      expect(await f.make().request("enroll", signal())).toEqual({ status: "unavailable" }); expect(f.readPin).not.toHaveBeenCalled();
    }
  });
  it.each([31, 33])("rejects malformed %i-byte derivation and wipes the late owned output", async size => {
    const f = fixture(), malformed = new Uint8Array(size).fill(9); f.derive.mockResolvedValueOnce(malformed);
    expect(await f.make().request("enroll", signal())).toEqual({ status: "unavailable" });
    expect([...malformed].every(byte => byte === 0)).toBe(true); expect(f.native.commit).not.toHaveBeenCalled();
  });
  it("wipes transferred KDF input/salt when real work rejects", async () => {
    const f = fixture(); let pin!: Uint8Array, salt!: Uint8Array;
    f.derive.mockImplementationOnce(async (p, s) => { pin = p; salt = s; throw new Error("synthetic derivation failure"); });
    expect(await f.make().request("enroll", signal())).toEqual({ status: "unavailable" });
    expect([...pin].every(byte => byte === 0)).toBe(true); expect([...salt].every(byte => byte === 0)).toBe(true);
    expect(f.native.commit).not.toHaveBeenCalled();
  });
  it("retains exclusive capacity after cancellation until late input buffers and native cleanup settle", async () => {
    const f = fixture(), entered = deferred<void>(), delayed = deferred<unknown>(), close = deferred<unknown>();
    f.readPin.mockImplementationOnce(async () => { entered.resolve(); return delayed.promise; });
    let retirement!: ParentPinEnrollmentInspection; f.native.retire = vi.fn(async challenge => { retirement = challenge; return close.promise; });
    const engine = f.make(), abort = new AbortController(), pending = engine.request("enroll", abort.signal); await entered.promise;
    abort.abort(); expect(await pending).toEqual({ status: "cancelled" }); expect(await engine.request("enroll", signal())).toEqual({ status: "denied" });
    const late = Uint8Array.of(49, 50, 51, 52); delayed.resolve(late);
    await vi.waitFor(() => expect(f.native.retire).toHaveBeenCalledTimes(1)); expect([...late]).toEqual([0, 0, 0, 0]);
    expect(await engine.request("enroll", signal())).toEqual({ status: "denied" }); close.resolve({ status: "closed", challenge: retirement });
    await vi.waitFor(() => expect(engine.getSnapshot()).toEqual({ phase: "idle" })); expect(f.derive).not.toHaveBeenCalled();
  });
  it("wipes late KDF buffers and does not release capacity while real derivation is still running", async () => {
    const f = fixture(), entered = deferred<void>(), derived = deferred<Uint8Array<ArrayBuffer>>(); let pin!: Uint8Array, salt!: Uint8Array;
    f.derive.mockImplementationOnce(async (p, s) => { pin = p; salt = s; entered.resolve(); return derived.promise; });
    const engine = f.make(), pending = engine.request("enroll", signal()); await entered.promise; engine.background();
    expect(await pending).toEqual({ status: "cancelled" }); engine.foreground();
    expect(await engine.request("enroll", signal())).toEqual({ status: "denied" });
    const late = new Uint8Array(32).fill(7); derived.resolve(late);
    await vi.waitFor(() => expect(engine.getSnapshot()).toEqual({ phase: "idle" }));
    for (const owned of [pin, salt, late, ...f.inputs, ...f.randomBuffers]) expect([...owned].every(byte => byte === 0)).toBe(true);
    expect(f.native.commit).not.toHaveBeenCalled();
  });
  it("times out promptly without promoting a late successful native commit to success", async () => {
    vi.useFakeTimers(); const f = fixture(), entered = deferred<void>(), waiting = deferred<unknown>();
    let mutation!: ParentPinEnrollmentMutation; const original = f.native.commit.bind(f.native);
    f.native.commit = vi.fn(async (challenge, abort) => { mutation = challenge; const result = await original(challenge, abort); entered.resolve(); await waiting.promise; return result; });
    const engine = f.make(), pending = engine.request("enroll", signal()); await entered.promise;
    await vi.advanceTimersByTimeAsync(1_000); expect(await pending).toEqual({ status: "cancelled" });
    expect(f.state.record.pin).not.toBeNull(); expect(await engine.request("replace", signal())).toEqual({ status: "denied" });
    waiting.resolve(undefined); await vi.waitFor(() => expect(engine.getSnapshot()).toEqual({ phase: "idle" }));
    expect([...mutation.nextBytes].every(byte => byte === 0)).toBe(true); expect([...mutation.expectedBytes].every(byte => byte === 0)).toBe(true);
  });
  it("checks the exclusive local deadline at the boundary even when its timer has not fired", async () => {
    const f = fixture(); f.derive.mockImplementationOnce(async () => { f.state.operationMs = 1_000; return new Uint8Array(32).fill(9); });
    expect(await f.make().request("enroll", signal())).toEqual({ status: "unavailable" }); expect(f.native.commit).not.toHaveBeenCalled();
  });
  it("reuses the one native absolute deadline and refuses expiry under the commit lock", async () => {
    const f = fixture(); let deadline = 0; const originalBegin = f.native.begin.bind(f.native), originalCommit = f.native.commit.bind(f.native);
    f.native.begin = vi.fn(async (challenge, abort) => { const reply = await originalBegin(challenge, abort) as ReturnType<typeof f.authenticated>; deadline = reply.deadlineUptimeMs; return reply; });
    f.native.commit = vi.fn(async (challenge, abort) => { expect(challenge.deadlineUptimeMs).toBe(deadline); f.state.uptimeMs = deadline; return originalCommit(challenge, abort); });
    expect(await f.make().request("enroll", signal())).toEqual({ status: "denied" }); expect(f.state.record.pin).toBeNull();
  });
  it("native CAS detects a full unrelated record race and preserves its current record", async () => {
    const f = fixture(), original = f.native.commit.bind(f.native);
    f.native.commit = vi.fn(async (challenge, abort) => { f.state.record = { ...f.state.record, revision: f.state.record.revision + 1, selectionRevision: 4 };
      return original(challenge, abort); });
    expect(await f.make().request("enroll", signal())).toEqual({ status: "denied" }); expect(f.state.record.pin).toBeNull(); expect(f.state.record.selectionRevision).toBe(4);
  });
  it.each(["permission", "boot"])("does not reset charged attempts when native %s refuses rotation", async fault => {
    const f = fixture(true), old = f.stored(), original = f.native.commit.bind(f.native);
    f.native.commit = vi.fn(async (challenge, abort) => { if (fault === "permission") f.state.nativePermission = false;
      else f.state.bootId = "00000000-0000-4000-8000-000000000002"; return original(challenge, abort); });
    expect(await f.make().request("replace", signal())).toEqual({ status: "denied" }); expect(f.stored()).toEqual(old);
  });
  it.each(["lost", "boolean", "copied-challenge", "copied-session", "wrong-readback", "wrong-sha", "mutated-expected", "extra-field"])(
    "seals after %s native commit ACK even when durable record changed", async fault => {
      const f = fixture(), original = f.native.commit.bind(f.native); let raw: Uint8Array | null = null;
      f.native.commit = vi.fn(async (challenge, abort) => {
        const reply = await original(challenge, abort) as { status: string; challenge: ParentPinEnrollmentMutation; session: object; bytes: Uint8Array; checksum: string }; raw = reply.bytes;
        if (fault === "lost") throw new Error("synthetic lost acknowledgement");
        if (fault === "boolean") return true;
        if (fault === "copied-challenge") return { ...reply, challenge: { ...challenge } };
        if (fault === "copied-session") return { ...reply, session: {} };
        if (fault === "wrong-readback") { reply.bytes[0] ^= 1; return reply; }
        if (fault === "wrong-sha") return { ...reply, checksum: "f".repeat(64) };
        if (fault === "mutated-expected") { challenge.expectedBytes.fill(0); return reply; }
        return { ...reply, permission: true };
      });
      const engine = f.make(); expect(await engine.request("enroll", signal())).toEqual({ status: "unavailable" });
      expect(f.state.record.pin).not.toBeNull(); expect(engine.getSnapshot()).toEqual({ phase: "unavailable" });
      expect(await engine.request("replace", signal())).toEqual({ status: "unavailable" }); expect(f.native.begin).toHaveBeenCalledTimes(1);
      if (raw && !["lost", "boolean"].includes(fault)) expect([...raw].every(byte => byte === 0)).toBe(true);
    });
  it.each(["lost", "boolean", "copy"])("retains sealed capacity after %s cleanup ACK", async fault => {
    const f = fixture(); f.native.retire = vi.fn(async challenge => { if (fault === "lost") throw new Error("synthetic cleanup lost");
      return fault === "boolean" ? true : { status: "closed", challenge: { ...challenge } }; });
    const engine = f.make(); expect(await engine.request("enroll", signal())).toEqual({ status: "unavailable" });
    expect(engine.getSnapshot()).toEqual({ phase: "unavailable" }); expect(await engine.request("replace", signal())).toEqual({ status: "unavailable" });
  });
  it("retains capacity while cleanup hangs; timeout cannot make it idle", async () => {
    vi.useFakeTimers(); const f = fixture(), entered = deferred<void>(), forever = deferred<unknown>();
    f.native.retire = vi.fn(async () => { entered.resolve(); return forever.promise; });
    const engine = f.make(), pending = engine.request("enroll", signal()); await entered.promise;
    await vi.advanceTimersByTimeAsync(1_000); expect(await pending).toEqual({ status: "cancelled" });
    expect(engine.getSnapshot()).toEqual({ phase: "working" }); expect(await engine.request("replace", signal())).toEqual({ status: "denied" });
  });
  it("recovery requires the distinct authority and native validation instead of a reset flag", async () => {
    const omitted = fixture(true); expect(await createParentPinEnrollment({ ...omitted.options, recovery: undefined }).request("recover", signal())).toEqual({ status: "unavailable" });
    expect(omitted.native.begin).not.toHaveBeenCalled();
    const f = fixture(true); expect(await f.make().request("recover", signal())).toEqual({ status: "committed", action: "recover" });
    expect(f.events.indexOf("recovery")).toBeLessThan(f.events.indexOf("commit"));
    const refused = fixture(true); refused.state.recoveryAccepted = false;
    expect(await refused.make().request("recover", signal())).toEqual({ status: "denied" }); expect(refused.state.record.pin!.attempts.count).toBe(2);
  });
  it.each(["boolean", "copy", "permission"])("rejects %s recovery receipts before native commit", async fault => {
    const f = fixture(true); f.options.recovery = { authorize: async challenge => fault === "boolean" ? true
      : { status: "authorized", challenge: fault === "copy" ? { ...challenge } : challenge, permission: fault === "permission" ? true : {} } };
    expect(await f.make().request("recover", signal())).toEqual({ status: "unavailable" }); expect(f.native.commit).not.toHaveBeenCalled();
  });
  it("fences recovery mutations to exact expected AND next bytes before native publication", async () => {
    const f = fixture(true); f.options.recovery = { authorize: async challenge => { challenge.nextBytes.fill(0);
      return { status: "authorized", challenge, permission: {} }; } };
    expect(await f.make().request("recover", signal())).toEqual({ status: "unavailable" }); expect(f.native.commit).not.toHaveBeenCalled();
  });
  it("rejects reused native session identity across otherwise successful lifecycle requests", async () => {
    const f = fixture(), original = f.native.begin.bind(f.native); let reused: object | null = null;
    f.native.begin = vi.fn(async (challenge, abort) => { const reply = await original(challenge, abort) as ReturnType<typeof f.authenticated>;
      if (reused) return { ...reply, session: reused }; reused = reply.session; return reply; });
    const engine = f.make(); expect((await engine.request("enroll", signal())).status).toBe("committed");
    expect(await engine.request("replace", signal())).toEqual({ status: "unavailable" }); expect(f.native.commit).toHaveBeenCalledTimes(1);
  });
  it("rejects a repeated wire inspection ID even when object/session identities differ", async () => {
    const f = fixture(); f.native.begin = vi.fn(async challenge => ({ status: "denied", challenge }));
    f.options.random = { getRandomValues: <T extends ArrayBufferView | null>(bytes: T): T => {
      if (bytes instanceof Uint8Array) bytes.fill(7); return bytes;
    } };
    const engine = f.make(); expect(await engine.request("enroll", signal())).toEqual({ status: "denied" });
    expect(await engine.request("enroll", signal())).toEqual({ status: "unavailable" }); expect(f.native.begin).toHaveBeenCalledTimes(1);
    expect(engine.getSnapshot()).toEqual({ phase: "unavailable" });
  });
  it("bounds lifetime inspection IDs without evicting old native wire identities", async () => {
    const f = fixture(); f.native.begin = vi.fn(async challenge => ({ status: "denied", challenge })); let sequence = 0;
    f.options.random = { getRandomValues: <T extends ArrayBufferView | null>(bytes: T): T => {
      if (bytes instanceof Uint8Array) { bytes.fill(0); new DataView(bytes.buffer).setUint32(0, ++sequence); } return bytes;
    } };
    const engine = f.make();
    for (let index = 0; index < 2_048; index++) expect(await engine.request("enroll", signal())).toEqual({ status: "denied" });
    expect(await engine.request("enroll", signal())).toEqual({ status: "unavailable" }); expect(f.native.begin).toHaveBeenCalledTimes(2_048);
  });
  it("refuses recovery token reuse across distinct owned mutations/sessions", async () => {
    const f = fixture(true), permission = Object.freeze(Object.create(null)) as object;
    f.options.recovery = { authorize: async challenge => ({ status: "authorized", challenge, permission }) };
    const engine = f.make(); expect((await engine.request("recover", signal())).status).toBe("committed");
    expect(await engine.request("recover", signal())).toEqual({ status: "unavailable" }); expect(f.native.commit).toHaveBeenCalledTimes(1);
  });
  it("latches a regressing monotonic clock without permitting another request", async () => {
    const f = fixture(); f.options.calibration = { verify: async (challenge, iterations) => { f.state.operationMs = -1;
      return { status: "calibrated", challenge, iterations }; } };
    const engine = f.make(); expect(await engine.request("enroll", signal())).toEqual({ status: "unavailable" });
    f.state.operationMs = 0; expect(await engine.request("enroll", signal())).toEqual({ status: "unavailable" }); expect(f.readPin).not.toHaveBeenCalled();
  });
  it.each(["clock", "random"] as const)("reserves exclusive preparation before reentrant initial %s callbacks", async port => {
    const f = fixture(); let engine!: ReturnType<typeof createParentPinEnrollment>, nested: Promise<unknown> | null = null, first = true;
    if (port === "clock") f.options.clock = { nowMonotonicMs: () => { if (first) { first = false; nested = engine.request("enroll", signal()); } return 0; } };
    else { const fill = f.options.random!.getRandomValues.bind(f.options.random!) as Crypto["getRandomValues"];
      f.options.random = { getRandomValues: <T extends ArrayBufferView | null>(bytes: T): T => {
        if (first) { first = false; nested = engine.request("enroll", signal()); } return fill(bytes as Exclude<T, null>) as T;
      } }; }
    engine = f.make(); expect(await engine.request("enroll", signal())).toEqual({ status: "committed", action: "enroll" });
    expect(await nested).toEqual({ status: "denied" }); expect(f.native.begin).toHaveBeenCalledTimes(1); expect(f.native.commit).toHaveBeenCalledTimes(1);
  });
  it("fences invalidation during initial random preparation before native begin", async () => {
    const f = fixture(); let engine!: ReturnType<typeof createParentPinEnrollment>;
    f.options.random = { getRandomValues: <T extends ArrayBufferView | null>(bytes: T): T => { engine.background(); return bytes; } };
    engine = f.make(); expect(await engine.request("enroll", signal())).toEqual({ status: "cancelled" }); expect(f.native.begin).not.toHaveBeenCalled();
  });
  it("awaits cancellation created by final clock and obtains a new close before releasing capacity", async () => {
    const f = fixture(), cancelEntered = deferred<void>(), cancelRelease = deferred<unknown>();
    let engine!: ReturnType<typeof createParentPinEnrollment>, afterClose = false, fired = false;
    const retire = f.native.retire.bind(f.native);
    f.native.retire = vi.fn(async challenge => { const receipt = await retire(challenge); afterClose = true; return receipt; });
    f.native.cancel = vi.fn(async () => { cancelEntered.resolve(); return cancelRelease.promise; });
    f.options.clock = { nowMonotonicMs: () => { if (afterClose && !fired) { fired = true; engine.invalidate(); } return 0; } };
    engine = f.make(); const pending = engine.request("enroll", signal()); await cancelEntered.promise;
    expect(await pending).toEqual({ status: "cancelled" }); expect(await engine.request("replace", signal())).toEqual({ status: "denied" });
    expect(f.native.retire).toHaveBeenCalledTimes(1); cancelRelease.resolve(undefined);
    await vi.waitFor(() => expect(engine.getSnapshot()).toEqual({ phase: "idle" })); expect(f.native.retire).toHaveBeenCalledTimes(2);
  });
  it("does not derive after crypto-random salt generation reenters cancellation", async () => {
    const f = fixture(); let engine!: ReturnType<typeof createParentPinEnrollment>, calls = 0;
    const fill = f.options.random!.getRandomValues.bind(f.options.random!) as Crypto["getRandomValues"];
    f.options.random = { getRandomValues: <T extends ArrayBufferView | null>(bytes: T): T => {
      const output = fill(bytes as Exclude<T, null>); if (++calls === 2) engine.invalidate(); return output as T;
    } };
    engine = f.make(); expect(await engine.request("enroll", signal())).toEqual({ status: "cancelled" });
    await vi.waitFor(() => expect(engine.getSnapshot()).toEqual({ phase: "idle" })); expect(f.derive).not.toHaveBeenCalled();
    for (const bytes of f.randomBuffers) expect([...bytes].every(byte => byte === 0)).toBe(true);
  });
  it.each(["background", "invalidate", "dispose"] as const)("%s cancels the original challenge and observes late begin output", async action => {
    const f = fixture(), entered = deferred<void>(), delayed = deferred<unknown>(); let challenge!: ParentPinEnrollmentInspection;
    f.native.begin = vi.fn(async value => { challenge = value; entered.resolve(); return delayed.promise; });
    const engine = f.make(), pending = engine.request("enroll", signal()); await entered.promise; engine[action]();
    expect(await pending).toEqual({ status: "cancelled" }); const reply = f.authenticated(challenge); delayed.resolve(reply);
    await vi.waitFor(() => expect(f.native.retire).toHaveBeenCalledTimes(1)); expect([...reply.bytes].every(byte => byte === 0)).toBe(true);
    expect(f.readPin).not.toHaveBeenCalled();
  });
});
