import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { decodeChildProfiles } from "./childProfile";
import { childProtectedRecordBytes, createChildProtectedState, decodeChildProtectedRecord,
  type ChildEpochAnchorChallenge, type ChildNativeRecordPort, type ChildProtectedRecord, type ChildRecordReadChallenge } from "./childProtectedState";
import type { ChildSelectionChallenge, ChildStartupChallenge } from "./childStartup";

// Trusted synthetic SPI contracts only. These fixtures are not an OS vault,
// genuine rollback checkpoint, authenticated epoch or parent approval witness.
const policy = { version: "synthetic-child-v1", checksum: "a".repeat(64), maxPinIterations: 600_000 };
const bootId = "00000000-0000-4000-8000-000000000001";
const epoch = Date.parse("2026-10-02T12:00:00.000Z");
const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
type Mutable<T> = T extends readonly (infer Entry)[] ? Mutable<Entry>[] : T extends object ? { -readonly [Key in keyof T]: Mutable<T[Key]> } : T;
function record(locale: "ru" | "en" = "ru"): Mutable<ChildProtectedRecord> {
  const registry = decodeChildProfiles({ schemaVersion: 1, policyVersion: policy.version, activeProfileId: "synthetic-child",
    profiles: [{ id: "synthetic-child", label: "Synthetic Reader", exactAge: 9, locale,
      ageConfirmedAt: "2026-10-01T12:00:00.000Z", readingLevel: null, allowedTopics: null, blockedTopics: ["violence"],
      soundEnabled: false, motion: "calm", narrationEnabled: false }] }, { policyVersion: policy.version, now: epoch }).registry!;
  return { schemaVersion: 1, revision: 1, mode: "child", selectionRevision: 1, profileRevision: 1, policyChecksum: policy.checksum,
    registryChecksum: sha(new TextEncoder().encode(JSON.stringify(registry))), registry: clone(registry) as Mutable<typeof registry>,
    pin: { schemaVersion: 1, policyVersion: policy.version, revision: 1, credentialId: "b".repeat(64),
      verifier: { algorithm: "PBKDF2-HMAC-SHA256", iterations: 600_000, saltHex: "c".repeat(64), hashHex: "d".repeat(64) },
      attempts: { count: 0, blockedUntilMs: 0, lastObservedMs: 1_000, pendingAttemptId: null } },
    clock: { schemaVersion: 1, bootId, uptimeAnchorMs: 100, logicalAnchorMs: 1_000, epochAnchor: null } };
}
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function fixture(initial = record(), initialVisibility: "active" | "background" = "active") {
  const state = { record: initial, uptimeMs: 110, bootId, operationMs: 0 };
  const response = (challenge: ChildRecordReadChallenge) => {
    const bytes = childProtectedRecordBytes(state.record);
    return { status: "authenticated", challenge, bytes, checksum: sha(bytes), sample: { bootId: state.bootId, uptimeMs: state.uptimeMs } };
  };
  const native: ChildNativeRecordPort = {
    read: vi.fn(async challenge => response(challenge)),
    compareAndSwap: vi.fn(async challenge => {
      if (state.bootId !== challenge.bootId || state.uptimeMs >= challenge.deadlineUptimeMs
        || sha(childProtectedRecordBytes(state.record)) !== challenge.expectedChecksum
        || sha(challenge.expectedBytes) !== challenge.expectedChecksum || sha(challenge.nextBytes) !== challenge.nextChecksum) return null;
      state.record = JSON.parse(new TextDecoder().decode(challenge.nextBytes)) as Mutable<ChildProtectedRecord>;
      return { status: "committed", challenge, checksum: challenge.nextChecksum };
    }),
  };
  const options = { native, digest: { sha256: async (bytes: Uint8Array) => sha(bytes) }, policy, timeoutMs: 100,
    operationalClock: { nowMs: () => state.operationMs }, initialVisibility };
  return { state, native, response, options, make: () => createChildProtectedState(options) };
}
const intent = (locale: "ru" | "en" = "ru"): Mutable<ChildStartupChallenge> => ({ generation: 1, request: { locale, route: { kind: "home", entityId: null } } });
const scoped = (value: ChildProtectedRecord, locale: "ru" | "en" = "ru"): Mutable<ChildSelectionChallenge> => ({ ...intent(locale), selection: {
  schemaVersion: 1, mode: "child", selectionRevision: value.selectionRevision, profileId: value.registry.activeProfileId!,
  profileRevision: value.profileRevision, profileChecksum: value.registryChecksum, policyVersion: policy.version, policyChecksum: policy.checksum } });
const nextPin = (value: ChildProtectedRecord) => ({ ...clone(value.pin), revision: value.pin.revision + 1,
  attempts: { count: 1, blockedUntilMs: 1_100, lastObservedMs: 1_010, pendingAttemptId: "e".repeat(64) } });
afterEach(() => vi.useRealTimers());

describe("conditional protected child record foundation", () => {
  it("strictly decodes and freezes a canonical full record without claiming authority", () => {
    const source = record(), parsed = decodeChildProtectedRecord(source, policy)!;
    expect(parsed).toEqual(source); expect(Object.isFrozen(parsed.pin.attempts)).toBe(true);
    source.registry.profiles[0].blockedTopics.push("changed");
    expect(parsed.registry.profiles[0].blockedTopics).toEqual(["violence"]);
    expect(decodeChildProtectedRecord({ ...record(), schemaVersion: 2 }, policy)).toBeNull();
    expect(decodeChildProtectedRecord({ ...record(), parentApproved: true }, policy)).toBeNull();
  });
  it("rejects malformed policy, PIN journal, future fields and accessors without invoking them", () => {
    const source = record(), getter = vi.fn(() => "child");
    for (const value of [{ ...source, mode: true }, { ...source, policyChecksum: "f".repeat(64) },
      { ...source, pin: { ...source.pin, attempts: { ...source.pin.attempts, count: 0, blockedUntilMs: 1 } } },
      { ...source, pin: { ...source.pin, verifier: { ...source.pin.verifier, iterations: 1 } } },
      Object.defineProperty({ ...source }, "mode", { get: getter, enumerable: true })])
      expect(decodeChildProtectedRecord(value, policy)).toBeNull();
    expect(getter).not.toHaveBeenCalled();
  });
  it.each(["ru", "en"] as const)("restores exact child selection and authenticated %s registry, with sealed PII-free snapshots", async locale => {
    const f = fixture(record(locale)), coordinator = f.make(), challenge = intent(locale);
    expect(await coordinator.modePort.restore(challenge, new AbortController().signal)).toEqual({ status: "restored", challenge,
      selection: scoped(f.state.record, locale).selection });
    const profileChallenge = scoped(f.state.record, locale);
    expect(await coordinator.profilePort.restore(profileChallenge, new AbortController().signal)).toEqual({ status: "restored",
      challenge: profileChallenge, registry: f.state.record.registry });
    expect(coordinator.getSnapshot()).toEqual({ phase: "sealed" });
    expect(JSON.stringify(coordinator.getSnapshot())).not.toContain("Synthetic Reader");
  });
  it("missing native guarantees, explicit adult mode and absent child selection never publish readiness", async () => {
    const f = fixture(), coordinator = createChildProtectedState({ ...f.options, native: undefined });
    expect(await coordinator.pinStore.read()).toBeNull();
    expect(await coordinator.modePort.restore(intent(), new AbortController().signal)).toMatchObject({ status: "unavailable" });
    f.state.record = { ...record(), mode: "adult" };
    expect(await f.make().modePort.restore(intent(), new AbortController().signal)).toMatchObject({ status: "unavailable" });
    const empty = { ...record(), registry: { ...record().registry, activeProfileId: null } };
    expect(decodeChildProtectedRecord(empty, policy)).toBeNull();
  });
  it("denies raw booleans and copied read challenges rather than treating encryption metadata as authority", async () => {
    const f = fixture();
    for (const output of [true, { authenticated: true }, "authenticated"]) {
      f.native.read = vi.fn(async () => output);
      expect(await f.make().pinStore.read()).toBeNull();
    }
    f.native.read = vi.fn(async challenge => ({ ...f.response(challenge), challenge: { ...challenge } }));
    expect(await f.make().pinStore.read()).toBeNull();
  });
  it("requires actual complete-record and registry hashes plus canonical UTF-8 bytes", async () => {
    for (const kind of ["record-hash", "registry-hash", "noncanonical", "invalid-utf8"]) {
      const f = fixture();
      if (kind === "registry-hash") f.state.record = { ...record(), registryChecksum: "f".repeat(64) };
      f.native.read = vi.fn(async challenge => {
        const response = f.response(challenge);
        if (kind === "record-hash") response.checksum = "f".repeat(64);
        if (kind === "noncanonical") response.bytes = new TextEncoder().encode(" " + new TextDecoder().decode(response.bytes));
        if (kind === "invalid-utf8") response.bytes = Uint8Array.from([0xc3, 0x28]);
        if (kind !== "record-hash") response.checksum = sha(response.bytes);
        return response;
      });
      expect(await f.make().pinStore.read()).toBeNull();
    }
  });
  it("rejects profile digest/revision mismatches and mutable request changes while native IO waits", async () => {
    const f = fixture(), coordinator = f.make();
    const wrong = scoped(f.state.record); wrong.selection = { ...wrong.selection, profileRevision: 2 };
    expect(await coordinator.profilePort.restore(wrong, new AbortController().signal)).toMatchObject({ status: "unavailable" });
    const entered = deferred<void>(), gate = deferred<void>();
    f.native.read = vi.fn(async challenge => { entered.resolve(); await gate.promise; return f.response(challenge); });
    const mutable = intent(), pending = f.make().modePort.restore(mutable, new AbortController().signal);
    await entered.promise; mutable.request = { locale: "en", route: { kind: "work", entityId: "different-work" } }; gate.resolve();
    expect(await pending).toMatchObject({ status: "unavailable" });
  });
  it("captures immutable native sample and bytes before asynchronous digest verification", async () => {
    const f = fixture(), entered = deferred<void>(), gate = deferred<void>();
    let returned: ReturnType<typeof f.response>;
    f.native.read = vi.fn(async challenge => { returned = f.response(challenge); return returned; });
    let first = true;
    f.options.digest.sha256 = async bytes => { if (first) { first = false; entered.resolve(); await gate.promise; } return sha(bytes); };
    const pending = f.make().readClockObservation(); await entered.promise;
    returned!.sample.uptimeMs = 0; returned!.bytes.fill(0); gate.resolve();
    expect(await pending).toEqual({ bootId, sampledUptimeMs: 110, sampledLogicalMs: 1_010, sampledEpochMs: null });
  });
  it("preserves sampled logical backoff across independent process coordinators in one synthetic boot", async () => {
    const f = fixture();
    const first = await f.make().readClockObservation(); f.state.uptimeMs = 150;
    const afterRestart = await f.make().readClockObservation();
    expect(first?.sampledLogicalMs).toBe(1_010); expect(afterRestart?.sampledLogicalMs).toBe(1_050);
    expect(afterRestart?.sampledEpochMs).toBeNull();
  });
  it("boot change and counter rollback latch closed without resetting PIN state or falling back to wall time", async () => {
    for (const change of ["boot", "counter"] as const) {
      const f = fixture(), coordinator = f.make(); expect(await coordinator.readClockObservation()).not.toBeNull();
      if (change === "boot") f.state.bootId = "00000000-0000-4000-8000-000000000002"; else f.state.uptimeMs = 109;
      expect(await coordinator.readClockObservation()).toBeNull(); f.state.bootId = bootId; f.state.uptimeMs = 120;
      expect(await coordinator.pinStore.read()).toBeNull(); expect(f.state.record.pin.attempts.lastObservedMs).toBe(1_000);
      expect(f.native.compareAndSwap).not.toHaveBeenCalled();
    }
  });
  it("same-process full-record revision rollback and divergent equal revisions remain sealed", async () => {
    for (const kind of ["older", "divergent"]) {
      const f = fixture(), coordinator = f.make(), original = clone(f.state.record);
      f.state.record = { ...original, revision: 2 };
      expect(await coordinator.pinStore.read()).not.toBeNull();
      f.state.record = kind === "older" ? original : { ...original, revision: 2, mode: "adult" };
      f.state.uptimeMs = 120; expect(await coordinator.pinStore.read()).toBeNull();
      f.state.record = { ...original, revision: 3 }; expect(await coordinator.pinStore.read()).toBeNull();
    }
  });
  it("stored epoch metadata is never authority; exact independently verified anchors yield sampled observations only", async () => {
    const f = fixture(); f.state.record.clock = { ...f.state.record.clock, epochAnchor: { epochAnchorMs: epoch,
      validUntilEpochMs: epoch + 1_000, proofChecksum: "f".repeat(64) } };
    expect((await f.make().readClockObservation())?.sampledEpochMs).toBeNull();
    const proof = vi.fn(async (challenge: ChildEpochAnchorChallenge) => ({ status: "verified", challenge }));
    expect((await createChildProtectedState({ ...f.options, epochAuthority: { verify: proof } }).readClockObservation())?.sampledEpochMs).toBe(epoch + 10);
    expect(proof).toHaveBeenCalledOnce();
    expect(await createChildProtectedState({ ...f.options, epochAuthority: { verify: async () => true } }).readClockObservation()).toBeNull();
  });
  it("epoch expiry is exclusive and copied anchor proofs cannot publish trusted time", async () => {
    const f = fixture(); f.state.record.clock = { ...f.state.record.clock, epochAnchor: { epochAnchorMs: epoch,
      validUntilEpochMs: epoch + 10, proofChecksum: "f".repeat(64) } };
    const proof = vi.fn(async (challenge: ChildEpochAnchorChallenge) => ({ status: "verified", challenge }));
    expect(await createChildProtectedState({ ...f.options, epochAuthority: { verify: proof } }).readClockObservation()).toBeNull();
    expect(proof).not.toHaveBeenCalled(); f.state.uptimeMs = 109;
    expect(await createChildProtectedState({ ...f.options, epochAuthority: { verify: async challenge => ({ status: "verified", challenge: { ...challenge } }) } })
      .readClockObservation()).toBeNull();
  });
  it("PIN attempt CAS advances the entire record durably and preserves protected mode/profile/clock", async () => {
    const f = fixture(), before = clone(f.state.record), coordinator = f.make(), next = nextPin(before);
    expect(await coordinator.pinStore.compareAndSwap(before.pin, next)).toBe(true);
    expect(f.state.record).toEqual({ ...before, revision: 2, pin: next });
    expect(await coordinator.pinStore.read()).toEqual(next);
    expect(f.native.compareAndSwap).toHaveBeenCalledOnce();
  });
  it("PIN CAS denies stale full state, changed verifier and journal times beyond native sampled time", async () => {
    const f = fixture(), coordinator = f.make(), initial = clone(f.state.record), next = nextPin(initial);
    expect(await coordinator.pinStore.compareAndSwap(initial.pin, { ...next, credentialId: "f".repeat(64) })).toBe(false);
    expect(await coordinator.pinStore.compareAndSwap(initial.pin, { ...next, attempts: { ...next.attempts, lastObservedMs: 1_011 } })).toBe(false);
    f.state.record = { ...f.state.record, pin: next };
    expect(await coordinator.pinStore.compareAndSwap(initial.pin, next)).toBe(false);
    expect(f.native.compareAndSwap).not.toHaveBeenCalled();
  });
  it("a concurrent protected mode change cannot be overwritten by an old PIN-only full-record CAS", async () => {
    const f = fixture(), before = clone(f.state.record), commit = f.native.compareAndSwap;
    f.native.compareAndSwap = vi.fn(async (challenge, signal) => {
      f.state.record = { ...f.state.record, revision: 2, selectionRevision: 2, mode: "adult" };
      return commit(challenge, signal);
    });
    expect(await f.make().pinStore.compareAndSwap(before.pin, nextPin(before))).toBe(false);
    expect(f.state.record.mode).toBe("adult"); expect(f.state.record.pin).toEqual(before.pin);
  });
  it("mode/profile CAS requires exact revision changes and preserves the complete PIN journal", async () => {
    const f = fixture(), coordinator = f.make(), before = clone(f.state.record);
    const adult = { ...before, revision: 2, mode: "adult" as const, selectionRevision: 2 };
    expect(await coordinator.selectionStore.compareAndSwap(before, adult)).toBe(true);
    expect(f.state.record.pin).toEqual(before.pin);
    const registry = { ...adult.registry, profiles: adult.registry.profiles.map(profile => ({ ...profile, locale: "en" as const })) };
    const changed = { ...adult, revision: 3, selectionRevision: 3, profileRevision: 2, registry,
      registryChecksum: sha(new TextEncoder().encode(JSON.stringify(registry))) };
    expect(await coordinator.selectionStore.compareAndSwap(adult, changed)).toBe(true);
    expect(f.state.record.registry.profiles[0].locale).toBe("en");
    expect(await coordinator.selectionStore.compareAndSwap(changed, { ...changed, revision: 4, mode: "child" })).toBe(false);
    expect(await coordinator.selectionStore.compareAndSwap(changed, { ...changed, revision: 4, mode: "child", selectionRevision: 4,
      pin: { ...changed.pin, attempts: { count: 0, blockedUntilMs: 0, lastObservedMs: 0, pendingAttemptId: null } } })).toBe(false);
  });
  it("a commit-shaped reply without actual full-record durable readback never acknowledges success", async () => {
    const f = fixture(), next = nextPin(f.state.record);
    f.native.compareAndSwap = vi.fn(async challenge => ({ status: "committed", challenge, checksum: challenge.nextChecksum }));
    expect(await f.make().pinStore.compareAndSwap(f.state.record.pin, next)).toBe(false);
    expect(f.state.record.revision).toBe(1);
  });
  it("detects mutable CAS byte buffers and copied commit challenges", async () => {
    for (const kind of ["bytes", "challenge"]) {
      const f = fixture(), next = nextPin(f.state.record);
      f.native.compareAndSwap = vi.fn(async challenge => {
        if (kind === "bytes") challenge.nextBytes.fill(0);
        return { status: "committed", challenge: kind === "challenge" ? { ...challenge } : challenge, checksum: challenge.nextChecksum };
      });
      expect(await f.make().pinStore.compareAndSwap(f.state.record.pin, next)).toBe(false);
    }
  });
  it("enforces elapsed operation deadlines before timer delivery and performs no late native mutation", async () => {
    vi.useFakeTimers(); const f = fixture(), entered = deferred<void>(), gate = deferred<void>();
    f.native.read = vi.fn(async challenge => { entered.resolve(); await gate.promise; return f.response(challenge); });
    const pending = f.make().pinStore.compareAndSwap(f.state.record.pin, nextPin(f.state.record));
    await entered.promise; f.state.operationMs = 100; gate.resolve();
    expect(await pending).toBe(false); expect(f.native.compareAndSwap).not.toHaveBeenCalled();
  });
  it("does not renew the native commit budget after slow read/digest work", async () => {
    vi.useFakeTimers(); const f = fixture(), before = clone(f.state.record), originalCAS = f.native.compareAndSwap;
    f.native.read = vi.fn(async challenge => { f.state.operationMs = 50; f.state.uptimeMs = 150; return f.response(challenge); });
    let digests = 0;
    f.options.digest.sha256 = async bytes => { if (++digests === 3) f.state.operationMs = 90; return sha(bytes); };
    f.native.compareAndSwap = vi.fn(async (challenge, signal) => {
      f.state.operationMs = 120; f.state.uptimeMs = 220;
      expect(challenge.deadlineUptimeMs).toBeLessThan(f.state.uptimeMs);
      return originalCAS(challenge, signal);
    });
    expect(await f.make().pinStore.compareAndSwap(before.pin, nextPin(before))).toBe(false);
    expect(f.state.record).toEqual(before);
  });
  it("timeout consumes late rejection and a late old answer cannot reopen a newer generation", async () => {
    vi.useFakeTimers(); const f = fixture(), entered = deferred<void>(), gate = deferred<unknown>(); let calls = 0;
    f.native.read = vi.fn(async challenge => { if (++calls === 1) { entered.resolve(); return gate.promise; } return f.response(challenge); });
    const controlled = f.make(), pending = controlled.pinStore.read(); await entered.promise;
    await vi.advanceTimersByTimeAsync(100); expect(await pending).toBeNull(); controlled.invalidate();
    expect(await controlled.pinStore.read()).toEqual(f.state.record.pin); gate.reject(new Error("synthetic late failure"));
    await Promise.resolve(); await Promise.resolve(); expect(controlled.getSnapshot()).toEqual({ phase: "sealed" });
    expect(await controlled.pinStore.read()).toEqual(f.state.record.pin);
  });
  it("background is latched and foreground requires fresh IO; background/foreground cycles retire old proof", async () => {
    const f = fixture(record(), "background"), coordinator = f.make();
    expect(await coordinator.pinStore.read()).toBeNull(); expect(f.native.read).not.toHaveBeenCalled();
    coordinator.foreground(); expect(await coordinator.pinStore.read()).toEqual(f.state.record.pin);
    const entered = deferred<void>(), gate = deferred<void>();
    f.native.read = vi.fn(async challenge => { entered.resolve(); await gate.promise; return f.response(challenge); });
    const controlled = f.make(); controlled.foreground(); const pending = controlled.pinStore.read(); await entered.promise;
    controlled.background(); controlled.foreground(); gate.resolve(); expect(await pending).toBeNull();
  });
  it("external cancellation and disposal deny pending observations without exposing stored data", async () => {
    const f = fixture(), entered = deferred<void>(), gate = deferred<void>();
    f.native.read = vi.fn(async challenge => { entered.resolve(); await gate.promise; return f.response(challenge); });
    const coordinator = f.make(), abort = new AbortController(), pending = coordinator.readClockObservation(abort.signal);
    await entered.promise; abort.abort(); expect(await pending).toBeNull(); coordinator.dispose(); gate.resolve();
    expect(await coordinator.pinStore.read()).toBeNull(); expect(coordinator.getSnapshot()).toEqual({ phase: "disposed" });
  });
  it("reentrant abort listeners create only fresh work and cannot have it aborted by old operation retirement", async () => {
    const f = fixture(), entered = deferred<void>(), gate = deferred<void>(); let reentered: Promise<unknown> | null = null, calls = 0;
    const coordinator = createChildProtectedState({ ...f.options, native: { ...f.native, read: async (challenge, signal) => {
      if (++calls === 1) { signal.addEventListener("abort", () => { reentered = coordinator.pinStore.read(); }, { once: true });
        entered.resolve(); await gate.promise; }
      return f.response(challenge);
    } } });
    const old = coordinator.pinStore.read(); await entered.promise; coordinator.invalidate(); gate.resolve();
    expect(await old).toBeNull(); expect(await reentered).toEqual(f.state.record.pin);
  });
  it("rejects missing operational clock and latches local deadline rollback independently of native authority", async () => {
    const f = fixture(); expect(() => createChildProtectedState({ ...f.options, operationalClock: undefined! })).toThrow(TypeError);
    f.state.operationMs = 10; const coordinator = f.make(); expect(await coordinator.pinStore.read()).not.toBeNull();
    f.state.operationMs = 9; expect(await coordinator.pinStore.read()).toBeNull(); f.state.operationMs = 11;
    expect(await coordinator.pinStore.read()).toBeNull();
  });
});
