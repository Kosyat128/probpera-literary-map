import { pbkdf2Sync, webcrypto } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { createParentGate, type ParentGateChallenge } from "./parentGate";
import { createParentPinVerification, createWebCryptoParentPinKdf, type ParentPinRecord,
  type ParentPinSecureStore, type ParentPinVerificationOptions } from "./parentPinVerification";

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const policy = { version: "synthetic-gate-policy", maxIterations: 600_000, backoffDelaysMs: [10, 20, 40] };
const record = (): ParentPinRecord => ({ schemaVersion: 1, policyVersion: policy.version, revision: 1,
  credentialId: "01".repeat(32), verifier: { algorithm: "PBKDF2-HMAC-SHA256", iterations: 600_000,
    saltHex: "08".repeat(32), hashHex: "07".repeat(32) },
  attempts: { count: 0, blockedUntilMs: 0, lastObservedMs: 1000, pendingAttemptId: null } });
const challenge = (sequence = 1): ParentGateChallenge => Object.freeze({ action: "exit-child-mode",
  targetChecksum: "02".repeat(32), id: sequence.toString(16).padStart(64, "0"), generation: sequence,
  expiresAtMonotonicMs: 5000, context: Object.freeze({ profileId: "synthetic-child", policyVersion: "synthetic-content-policy",
    profileRevision: 1, routeRevision: 0, mode: "child", visibility: "active" }) });
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
function fixture() {
  let stored: unknown = clone(record()), time = 1000;
  const inputs: Uint8Array[] = [], candidates: Uint8Array[] = [];
  // An in-memory synthetic CAS fixture, never an OS secure-storage proof.
  const store: ParentPinSecureStore = {
    read: vi.fn(async () => clone(stored)),
    compareAndSwap: vi.fn(async (expected, next) => {
      if (JSON.stringify(stored) !== JSON.stringify(expected)) return false;
      stored = clone(next); return true;
    }),
  };
  const readPin = vi.fn(async (): Promise<Uint8Array | null> => { const bytes = Uint8Array.of(49, 50, 51, 52); inputs.push(bytes); return bytes; });
  const derive = vi.fn(async (_pin: Uint8Array, _salt: Uint8Array, _iterations: number) => {
    const bytes = new Uint8Array(32).fill(7); candidates.push(bytes); return bytes;
  });
  const options: ParentPinVerificationOptions = { secureStore: store, inputPort: { readPin }, kdf: { derive },
    clock: { nowTrustedMs: () => time }, policy: clone(policy) };
  const engine = () => createParentPinVerification(options);
  return { store, readPin, derive, inputs, candidates, options, engine,
    set: (value: unknown) => { stored = value; }, get: () => clone(stored) as ParentPinRecord,
    advance: (delta: number) => { time += delta; }, setTime: (value: number) => { time = value; } };
}
const signal = () => new AbortController().signal;

describe("Parent PIN verification behind explicit secure platform ports", () => {
  it("charges durably before derivation, finalizes before proof, and wipes owned buffers", async () => {
    const f = fixture(), c = challenge(); let pinRef: Uint8Array | null = null, saltRef: Uint8Array | null = null;
    f.derive.mockImplementationOnce(async (pin, salt, iterations) => {
      expect(f.get().attempts).toEqual({ count: 1, blockedUntilMs: 1010, lastObservedMs: 1000, pendingAttemptId: c.id });
      expect(f.get().revision).toBe(2); expect(iterations).toBe(600_000);
      pinRef = pin; saltRef = salt; expect(Array.from(pin)).toEqual([49, 50, 51, 52]);
      expect(f.inputs[0].every(byte => byte === 0)).toBe(true);
      const bytes = new Uint8Array(32).fill(7); f.candidates.push(bytes); return bytes;
    });
    const result = await f.engine().verify(c, signal());
    expect(result).toEqual({ status: "verified", challenge: c });
    if (result.status === "verified") expect(result.challenge).toBe(c);
    expect(f.get()).toMatchObject({ revision: 3, attempts: { count: 0, blockedUntilMs: 0, pendingAttemptId: null } });
    for (const bytes of [pinRef, saltRef, ...f.inputs, ...f.candidates]) expect(bytes && Array.from(bytes).every(byte => byte === 0)).toBe(true);
  });
  it("keeps increasing penalties across engine recreation and caps only at explicit policy maximum", async () => {
    const f = fixture(); f.derive.mockImplementation(async () => new Uint8Array(32));
    for (let index = 0; index < 5; index++) {
      expect(await f.engine().verify(challenge(index + 1), signal())).toEqual({ status: "denied" });
      const saved = f.get(), delay = policy.backoffDelaysMs[Math.min(index, 2)];
      expect(saved.attempts.count).toBe(index + 1);
      expect(saved.attempts.blockedUntilMs - saved.attempts.lastObservedMs).toBe(delay);
      expect(await f.engine().verify(challenge(index + 20), signal())).toEqual({ status: "blocked" });
      f.advance(delay);
    }
    expect(f.readPin).toHaveBeenCalledTimes(5); expect(f.derive).toHaveBeenCalledTimes(5);
  });
  it("rejects a repeated challenge identity and concurrent calls before reading a second PIN", async () => {
    const f = fixture(), waiting = deferred<Uint8Array>(); f.derive.mockReturnValueOnce(waiting.promise);
    const engine = f.engine(), c = challenge(), active = engine.verify(c, signal());
    await vi.waitFor(() => expect(f.derive).toHaveBeenCalledTimes(1));
    expect(await engine.verify(challenge(2), signal())).toEqual({ status: "denied" });
    waiting.resolve(new Uint8Array(32).fill(7)); expect((await active).status).toBe("verified");
    expect(await engine.verify(c, signal())).toEqual({ status: "denied" }); expect(f.readPin).toHaveBeenCalledTimes(1);
  });
  it("denies overlapping instances through atomic CAS even when both have already collected a PIN", async () => {
    const f = fixture(), readA = deferred<Uint8Array>(), readB = deferred<Uint8Array>();
    f.readPin.mockReturnValueOnce(readA.promise).mockReturnValueOnce(readB.promise);
    const a = f.engine().verify(challenge(1), signal()), b = f.engine().verify(challenge(2), signal());
    await vi.waitFor(() => expect(f.readPin).toHaveBeenCalledTimes(2));
    readA.resolve(Uint8Array.of(49)); expect((await a).status).toBe("verified");
    readB.resolve(Uint8Array.of(49)); expect(await b).toEqual({ status: "denied" }); expect(f.derive).toHaveBeenCalledTimes(1);
  });
  it.each(["reservation", "finalization"])("never grants when the %s acknowledgement is false or lost", async boundary => {
    for (const lost of [false, true]) {
      const f = fixture(), original = f.store.compareAndSwap.bind(f.store); let calls = 0;
      f.store.compareAndSwap = vi.fn(async (expected, next) => {
        calls++;
        if (calls === (boundary === "reservation" ? 1 : 2)) {
          if (lost) { await original(expected, next); throw new Error("synthetic secret must not appear"); }
          return false;
        }
        return original(expected, next);
      });
      expect((await f.engine().verify(challenge(), signal())).status).not.toBe("verified");
      expect(f.inputs[0].every(byte => byte === 0)).toBe(true);
      if (boundary === "reservation") expect(f.derive).not.toHaveBeenCalled();
    }
  });
  it("keeps an aborted/crashed reservation charged across restart and rejects a late correct derivation", async () => {
    const f = fixture(), waiting = deferred<Uint8Array>(), abort = new AbortController();
    f.derive.mockReturnValueOnce(waiting.promise);
    const active = f.engine().verify(challenge(), abort.signal);
    await vi.waitFor(() => expect(f.derive).toHaveBeenCalledTimes(1)); abort.abort();
    expect(await f.engine().verify(challenge(2), signal())).toEqual({ status: "blocked" });
    const candidate = new Uint8Array(32).fill(7); waiting.resolve(candidate);
    expect(await active).toEqual({ status: "denied" });
    expect(f.get()).toMatchObject({ revision: 2, attempts: { count: 1, pendingAttemptId: challenge().id } });
    expect(candidate.every(byte => byte === 0)).toBe(true);
  });
  it("denies stale success after a verifier change, replaced attempt or store corruption", async () => {
    for (const changed of ["verifier", "reservation", "missing"] as const) {
      const f = fixture(); f.derive.mockImplementationOnce(async () => {
        const current = f.get();
        f.set(changed === "missing" ? null : { ...current, revision: current.revision + 1,
          ...(changed === "verifier" ? { credentialId: "04".repeat(32) } :
            { attempts: { ...current.attempts, pendingAttemptId: challenge(9).id } }) });
        return new Uint8Array(32).fill(7);
      });
      expect(await f.engine().verify(challenge(), signal())).toEqual({ status: "denied" });
    }
  });
  it.each(["secureStore", "inputPort", "kdf"] as const)("stays unavailable without %s", async key => {
    const f = fixture(); delete f.options[key];
    expect(await f.engine().verify(challenge(), signal())).toEqual({ status: "unavailable" });
    expect(f.readPin).not.toHaveBeenCalled(); expect(f.derive).not.toHaveBeenCalled();
  });
  it("never enrolls or rewrites missing, newer, tampered or mismatched secure records", async () => {
    const base = record();
    const invalid: unknown[] = [null, undefined, "{}", {}, { ...base, schemaVersion: 2 }, { ...base, policyVersion: "old-policy" },
      { ...base, pin: "synthetic" }, { ...base, revision: 0 }, { ...base, credentialId: "x" },
      { ...base, verifier: { ...base.verifier, algorithm: "SHA-256" } },
      ...[1, 599_999, 600_001, Infinity].map(iterations => ({ ...base, verifier: { ...base.verifier, iterations } })),
      { ...base, verifier: { ...base.verifier, saltHex: "08" } }, { ...base, verifier: { ...base.verifier, hashHex: "07" } },
      { ...base, attempts: { ...base.attempts, count: -1 } }, { ...base, attempts: { ...base.attempts, pendingAttemptId: challenge().id } }];
    for (const value of invalid) {
      const f = fixture(); f.set(value);
      expect(await f.engine().verify(challenge(), signal())).toEqual({ status: "unavailable" });
      expect(f.store.compareAndSwap).not.toHaveBeenCalled(); expect(f.readPin).not.toHaveBeenCalled();
    }
  });
  it.each([NaN, Infinity, -1, Number.MAX_SAFE_INTEGER + 1, 999])("fails closed on unsafe or persisted rollback time %s", async time => {
    const f = fixture(); f.setTime(time);
    expect(await f.engine().verify(challenge(), signal())).toEqual({ status: "unavailable" });
    f.setTime(1000); expect(await f.engine().verify(challenge(2), signal())).toEqual({ status: "unavailable" });
    expect(f.readPin).not.toHaveBeenCalled();
  });
  it("rejects in-process clock rollback during derivation and overflow without decreasing penalties", async () => {
    const f = fixture(), engine = f.engine();
    f.derive.mockImplementationOnce(async () => { f.setTime(999); return new Uint8Array(32).fill(7); });
    expect(await engine.verify(challenge(), signal())).toEqual({ status: "unavailable" });
    expect(f.get().attempts.count).toBe(1); f.setTime(2000);
    expect(await engine.verify(challenge(2), signal())).toEqual({ status: "unavailable" });
    const overflow = fixture(); overflow.setTime(Number.MAX_SAFE_INTEGER);
    expect(await overflow.engine().verify(challenge(), signal())).toEqual({ status: "unavailable" });
    expect(overflow.store.compareAndSwap).not.toHaveBeenCalled();
  });
  it("requires an explicit valid increasing backoff policy, with no invented production defaults", async () => {
    for (const backoffDelaysMs of [[], [0], [10, 10], [20, 10], [-1], [Infinity]]) {
      const f = fixture(); f.options.policy = { ...policy, backoffDelaysMs };
      expect(await f.engine().verify(challenge(), signal())).toEqual({ status: "unavailable" });
      expect(f.readPin).not.toHaveBeenCalled();
    }
  });
  it("rejects accessors and hidden/symbol fields without invoking getters or collecting a PIN", async () => {
    for (const level of ["root", "verifier", "attempts"] as const) {
      for (const field of ["accessor", "hidden", "symbol"] as const) {
        const f = fixture(), data = clone(record()), getter = vi.fn(() => 1);
        const target = level === "root" ? data : data[level];
        if (field === "accessor") Object.defineProperty(target, level === "verifier" ? "iterations" : level === "attempts" ? "count" : "revision",
          { get: getter, enumerable: true });
        else Object.defineProperty(target, field === "symbol" ? Symbol("synthetic-extra") : "extra", { value: true, enumerable: field === "symbol" });
        f.store.read = vi.fn(async () => data);
        expect(await f.engine().verify(challenge(), signal())).toEqual({ status: "unavailable" });
        expect(getter).not.toHaveBeenCalled(); expect(f.readPin).not.toHaveBeenCalled(); expect(f.derive).not.toHaveBeenCalled();
        expect(f.store.compareAndSwap).not.toHaveBeenCalled();
      }
    }
  });
  it("rejects exotic buffer outputs and still clears the busy flag when cleanup would throw", async () => {
    class ThrowingBytes extends Uint8Array { override fill(): this { throw new Error("synthetic fill error"); } }
    const f = fixture(), engine = f.engine(), output = new ThrowingBytes(32).map(() => 7);
    f.derive.mockResolvedValueOnce(output);
    expect(await engine.verify(challenge(), signal())).toEqual({ status: "unavailable" });
    expect(Array.from(output).every(byte => byte === 0)).toBe(true);
    expect(await engine.verify(challenge(2), signal())).toEqual({ status: "blocked" });
    const other = fixture(); other.readPin.mockResolvedValueOnce(new Proxy(new Uint8Array(4), {}));
    expect(await other.engine().verify(challenge(), signal())).toEqual({ status: "denied" });
    expect(other.derive).not.toHaveBeenCalled();
  });
  it("checks intrinsic buffer lengths without invoking shadowed properties", async () => {
    const f = fixture(), getter = vi.fn(() => 32), digest = new Uint8Array(31).fill(7);
    const data = record(); f.set({ ...data, verifier: { ...data.verifier, hashHex: "07".repeat(31) + "00" } });
    Object.defineProperty(digest, "byteLength", { get: getter }); f.derive.mockResolvedValueOnce(digest);
    expect(await f.engine().verify(challenge(), signal())).toEqual({ status: "unavailable" });
    expect(getter).not.toHaveBeenCalled(); expect(Array.from(digest).every(byte => byte === 0)).toBe(true);
    const other = fixture(), large = new Uint8Array(129).fill(49), lengthGetter = vi.fn(() => 4);
    Object.defineProperty(large, "byteLength", { get: lengthGetter }); other.readPin.mockResolvedValueOnce(large);
    expect(await other.engine().verify(challenge(), signal())).toEqual({ status: "denied" });
    expect(lengthGetter).not.toHaveBeenCalled(); expect(other.derive).not.toHaveBeenCalled();
    expect(Array.from(large).every(byte => byte === 0)).toBe(true);
  });
  it("charges malformed digit submissions and denies KDF failures with wiped buffers and sanitized status", async () => {
    for (const mode of ["digit", "throw", "length"] as const) {
      const f = fixture(), buffer = Uint8Array.of(mode === "digit" ? 65 : 49);
      f.readPin.mockResolvedValueOnce(buffer);
      if (mode === "throw") f.derive.mockRejectedValueOnce(new Error("synthetic PIN/verifier detail"));
      if (mode === "length") f.derive.mockResolvedValueOnce(new Uint8Array(31));
      const result = await f.engine().verify(challenge(), signal());
      expect(result).toEqual({ status: mode === "digit" ? "denied" : "unavailable" });
      expect(buffer[0]).toBe(0); expect(f.get().attempts.count).toBe(1);
      if (mode === "digit") expect(f.derive).not.toHaveBeenCalled();
    }
  });
  it("cancels before submission without charging, and wipes late cancelled input", async () => {
    const f = fixture(); f.readPin.mockResolvedValueOnce(null);
    expect(await f.engine().verify(challenge(), signal())).toEqual({ status: "denied" });
    expect(f.store.compareAndSwap).not.toHaveBeenCalled();
    const waiting = deferred<Uint8Array>(), abort = new AbortController(); f.readPin.mockReturnValueOnce(waiting.promise);
    const active = f.engine().verify(challenge(2), abort.signal);
    await vi.waitFor(() => expect(f.readPin).toHaveBeenCalledTimes(2)); abort.abort();
    const bytes = Uint8Array.of(49); waiting.resolve(bytes);
    expect(await active).toEqual({ status: "denied" }); expect(bytes[0]).toBe(0);
    expect(f.store.compareAndSwap).not.toHaveBeenCalled();
  });
  it("connects to one-use gate authority without persisting a token or restoring it in a fresh controller", async () => {
    const f = fixture(), verificationPort = f.engine();
    const make = () => createParentGate({ verificationPort, clock: { nowMonotonicMs: () => 100 },
      policy: { capabilityLifetimeMs: 1000, verificationTimeoutMs: 1000 },
      randomSource: { getRandomValues: bytes => { bytes.fill(9); return bytes; } } });
    const gate = make(), c = challenge(); gate.setContext(c.context);
    const scope = { action: c.action, targetChecksum: c.targetChecksum }, result = await gate.request(scope);
    expect(result.status).toBe("verified"); const callback = vi.fn();
    if (result.status !== "verified") throw new Error("synthetic test expected proof");
    const restarted = make(); restarted.setContext(c.context);
    expect(restarted.consume(result.capability, scope, callback)).toBe(false);
    expect(gate.consume(result.capability, scope, callback)).toBe(true);
    expect(gate.consume(result.capability, scope, callback)).toBe(false); expect(callback).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(f.get())).not.toContain("capability"); gate.dispose(); restarted.dispose();
  });
});

describe("standard Web Crypto PIN derivation", () => {
  it("matches an independent PBKDF2-SHA256 implementation at the real work-factor floor", async () => {
    const cryptoPort = webcrypto as unknown as Crypto, kdf = createWebCryptoParentPinKdf(cryptoPort)!;
    const pin = Uint8Array.of(49, 50, 51, 52), salt = new Uint8Array(32).fill(8);
    const expected = pbkdf2Sync(pin, salt, 600_000, 32, "sha256"), actual = await kdf.derive(pin, salt, 600_000);
    expect(Array.from(actual)).toEqual(Array.from(expected)); expect(Array.from(pin)).toEqual([49, 50, 51, 52]);
    pin.fill(0); salt.fill(0); expected.fill(0); actual.fill(0);
  });
  it("has no weak crypto fallback and rejects a lowered work factor or wrong salt size", async () => {
    expect(createWebCryptoParentPinKdf({} as Crypto)).toBeUndefined();
    const kdf = createWebCryptoParentPinKdf(webcrypto as unknown as Crypto)!;
    await expect(kdf.derive(Uint8Array.of(49), new Uint8Array(32), 599_999)).rejects.toThrow("unavailable");
    await expect(kdf.derive(Uint8Array.of(49), new Uint8Array(16), 600_000)).rejects.toThrow("unavailable");
  });
});
