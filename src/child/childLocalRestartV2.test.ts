import { createHash, webcrypto } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { childLocalRestartV2Bytes, createChildLocalRestartV2, decodeChildLocalRestartV2Record,
  type ChildLocalRestartV2Attempt, type ChildLocalRestartV2CommitChallenge, type ChildLocalRestartV2NativePort,
  type ChildLocalRestartV2OpenChallenge, type ChildLocalRestartV2Policy, type ChildLocalRestartV2ProtectedBinding,
  type ChildLocalRestartV2Record, type ChildLocalRestartV2SampleChallenge } from "./childLocalRestartV2";

// Explicit SYNTHETIC native ports exercise this conditional protocol. They are
// not OS storage, genuine process/host admission, durable atomic full-record CAS,
// rollback resistance, installed acceptance, an owner proof or a Parent Gate.
// Test delays are supplied structural vectors, not approved product policy.
const policy: ChildLocalRestartV2Policy = { version: "synthetic-local-v2", checksum: "a".repeat(64), backoffDelaysMs: [100, 250, 500] };
const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");
type Mutable<T> = T extends readonly (infer V)[] ? Mutable<V>[] : T extends object ? { -readonly [K in keyof T]: Mutable<T[K]> } : T;
const clone = <T>(v: T): Mutable<T> => JSON.parse(JSON.stringify(v)) as Mutable<T>;
const encode = (v: unknown) => new TextEncoder().encode(JSON.stringify(v));
function record(count = 1, pendingAttemptId: string | null = "e".repeat(64)): ChildLocalRestartV2Record {
  return { schemaVersion: 2, policyVersion: policy.version, policyChecksum: policy.checksum, revision: 7,
    protected: { checksum: "b".repeat(64), revision: 4, pinRevision: 3, credentialId: "c".repeat(64) },
    attempts: { count, pendingAttemptId: count === 0 ? null : pendingAttemptId,
      savedCooldownMs: count === 0 ? 0 : policy.backoffDelaysMs[Math.min(count - 1, 2)] }, anchor: { logicalMs: 1_000 } };
}
const attempt = (id = "f".repeat(64)): ChildLocalRestartV2Attempt => ({ id, original: Object.freeze({}) });
function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve };
}
function fixture(initial = record(), continuousMs = 10) {
  const state = { record: clone(initial), bytes: childLocalRestartV2Bytes(initial), continuousMs };
  const session = Object.freeze({}), sample = () => ({ continuousMs: state.continuousMs });
  let original: ChildLocalRestartV2OpenChallenge | null = null;
  const native: ChildLocalRestartV2NativePort = {
    open: vi.fn(async c => { original = c; return { status: "authenticated", challenge: c, session,
      bytes: state.bytes.slice(), checksum: sha(state.bytes), sample: sample() }; }),
    sample: vi.fn(async c => ({ status: "authenticated", challenge: c, session, sample: sample() })),
    compareAndSwap: vi.fn(async c => {
      if (c.session !== session || sha(c.expectedBytes) !== c.expectedChecksum || sha(c.nextBytes) !== c.nextChecksum
        || sha(state.bytes) !== c.expectedChecksum) return null;
      const next = JSON.parse(new TextDecoder().decode(c.nextBytes)) as ChildLocalRestartV2Record;
      if (next.revision !== state.record.revision + 1) return null;
      if (c.kind === "reanchor" && (JSON.stringify(next.protected) !== JSON.stringify(state.record.protected)
        || JSON.stringify(next.attempts) !== JSON.stringify(state.record.attempts))) return null;
      if (c.kind === "charge" && (!c.attempt || next.attempts.count !== state.record.attempts.count + 1
        || next.attempts.pendingAttemptId !== c.attempt.id || next.protected.credentialId !== state.record.protected.credentialId
        || next.protected.revision !== state.record.protected.revision + 1 || next.protected.pinRevision !== state.record.protected.pinRevision + 1)) return null;
      state.record = clone(next); state.bytes = c.nextBytes.slice();
      return { status: "committed", challenge: c, session, bytes: state.bytes.slice(), checksum: sha(state.bytes), sample: sample() };
    }),
    cancel: vi.fn(async () => undefined),
    retire: vi.fn(async (c, s) => ({ status: "retired", challenge: c, session: s })),
  };
  const nextBinding = (): ChildLocalRestartV2ProtectedBinding => ({ checksum: sha(encode({ syntheticCharge: state.record.revision + 1 })),
    revision: state.record.protected.revision + 1, pinRevision: state.record.protected.pinRevision + 1,
    credentialId: state.record.protected.credentialId });
  return { state, session, native, sample, nextBinding, original: () => original,
    make: (p = policy) => createChildLocalRestartV2({ policy: p, native }) };
}
beforeEach(() => vi.stubGlobal("crypto", webcrypto));
afterEach(() => vi.unstubAllGlobals());

describe("separate local conservative restart v2 foundation", () => {
  it("decodes and owns a canonical debt journal without serialized process/boot/uptime authority", () => {
    const input = clone(record()), parsed = decodeChildLocalRestartV2Record(input, policy)!;
    expect(parsed).toEqual(input); expect(Object.isFrozen(parsed.attempts)).toBe(true);
    expect(Object.isFrozen(parsed.protected)).toBe(true); expect(Object.keys(parsed.anchor)).toEqual(["logicalMs"]);
    input.attempts = { ...input.attempts, count: 3 }; expect(parsed.attempts.count).toBe(1);
    expect(new TextDecoder().decode(childLocalRestartV2Bytes(parsed))).toBe(JSON.stringify(record()));
  });
  it("rejects absent/v1/unknown anchors and descriptor fields without evaluating accessors", () => {
    const getter = vi.fn(() => 1_000), accessor = {};
    Object.defineProperty(accessor, "logicalMs", { enumerable: true, get: getter });
    for (const value of [null, undefined, { ...record(), schemaVersion: 1 }, { ...record(), anchor: null },
      { ...record(), anchor: accessor }, { ...record(), anchor: { logicalMs: 1_000, bootId: "invented" } },
      { ...record(), nativeAuthenticated: true }, { ...record(), policyChecksum: "d".repeat(64) }]) {
      expect(decodeChildLocalRestartV2Record(value, policy)).toBeNull();
    }
    expect(getter).not.toHaveBeenCalled();
  });
  it("rejects smaller saved debt, inconsistent zero-count debt and unsafe logical sums", () => {
    for (const value of [{ ...record(), attempts: { ...record().attempts, savedCooldownMs: 99 } },
      { ...record(), attempts: { count: 0, pendingAttemptId: "e".repeat(64), savedCooldownMs: 0 } },
      { ...record(), attempts: { count: 0, pendingAttemptId: null, savedCooldownMs: 100 } },
      { ...record(), anchor: { logicalMs: Number.MAX_SAFE_INTEGER } },
      { ...record(), revision: Number.MAX_SAFE_INTEGER + 1 }]) expect(decodeChildLocalRestartV2Record(value, policy)).toBeNull();
  });
  it("requires explicit increasing dense policy and never invents a delay or native port", async () => {
    const f = fixture();
    for (const delays of [[], [0], [100, 100], [100, 99], [NaN], Array(1), Array(65).fill(100)]) {
      expect(await f.make({ ...policy, backoffDelaysMs: delays }).open()).toBeNull();
    }
    expect(f.native.open).not.toHaveBeenCalled();
    expect(await createChildLocalRestartV2({ policy }).open()).toBeNull();
    expect(decodeChildLocalRestartV2Record({ ...record(), policyVersion: "v".repeat(96) }, { ...policy, version: "v".repeat(96) })).not.toBeNull();
    expect(decodeChildLocalRestartV2Record({ ...record(), policyVersion: "v".repeat(97) }, { ...policy, version: "v".repeat(97) })).toBeNull();
  });
  it("opens only an existing valid zero-debt journal and durably reanchors before eligibility", async () => {
    const f = fixture(record(0)), result = await f.make().open();
    expect(result).toEqual({ status: "eligible", count: 0, pendingAttemptId: null, remainingCooldownMs: 0, logicalMs: 1_000 });
    expect(f.native.compareAndSwap).toHaveBeenCalledTimes(1); expect(f.state.record.revision).toBe(8);
    expect(f.state.record.protected).toEqual(record(0).protected);
  });
  it.each([1, 5_000_000_000])("reapplies full saved cooldown at new process uptime %s without outside credit", async continuous => {
    const f = fixture(record(), continuous), result = await f.make().open();
    expect(result).toEqual({ status: "blocked", count: 1, pendingAttemptId: "e".repeat(64), remainingCooldownMs: 100, logicalMs: 1_000 });
    expect(f.state.record.attempts).toEqual(record().attempts); expect(f.state.record.anchor).toEqual({ logicalMs: 1_000 });
  });
  it("does not persist a decreasing remaining delay and reapplies the full delay after reopening", async () => {
    const f = fixture(), first = f.make(); await first.open(); f.state.continuousMs += 100;
    expect((await first.observe())?.status).toBe("eligible"); expect(f.state.record.attempts.savedCooldownMs).toBe(100);
    await first.retire(); f.state.continuousMs = 1;
    expect(await f.make().open()).toMatchObject({ status: "blocked", count: 1, remainingCooldownMs: 100, logicalMs: 1_000 });
  });
  it("credits only authenticated continuous elapsed time in the original current process", async () => {
    const f = fixture(), owner = f.make(); await owner.open(); f.state.continuousMs += 40;
    expect(await owner.observe()).toMatchObject({ status: "blocked", remainingCooldownMs: 60, logicalMs: 1_040 });
    f.state.continuousMs += 60; expect(await owner.observe()).toMatchObject({ status: "eligible", remainingCooldownMs: 0, logicalMs: 1_100 });
    expect(f.native.compareAndSwap).toHaveBeenCalledTimes(1);
  });
  it("seals a backwards current-process clock rather than reanchoring/refunding in place", async () => {
    const f = fixture(), owner = f.make(); await owner.open(); f.state.continuousMs++;
    await owner.observe(); f.state.continuousMs--;
    expect(await owner.observe()).toBeNull(); expect(await owner.reserve(attempt(), f.nextBinding())).toBeNull();
    expect(await owner.retire()).toBe("sealed"); expect(f.state.record.attempts.count).toBe(1);
  });
  it("denies a foreign clock receipt even if it copies all continuous fields", async () => {
    const f = fixture(), owner = f.make(); await owner.open();
    (f.native.sample as ReturnType<typeof vi.fn>).mockImplementationOnce(async (c: ChildLocalRestartV2SampleChallenge) =>
      ({ status: "authenticated", challenge: c, session: {}, sample: f.sample() }));
    expect(await owner.observe()).toBeNull(); expect(await owner.retire()).toBe("sealed");
  });
  it("does not reserve before the saved cooldown and preserves pending debt", async () => {
    const f = fixture(), owner = f.make(); await owner.open();
    expect(await owner.reserve(attempt(), f.nextBinding())).toBeNull();
    expect(f.native.compareAndSwap).toHaveBeenCalledTimes(1); expect(f.state.record.attempts).toEqual(record().attempts);
  });
  it("durably charges count/pending/full delay and exact protected revisions before returning", async () => {
    const f = fixture(), owner = f.make(); await owner.open(); f.state.continuousMs += 100; const expected = f.nextBinding();
    expect(await owner.reserve(attempt(), expected)).toEqual({ status: "blocked", count: 2, pendingAttemptId: "f".repeat(64),
      remainingCooldownMs: 250, logicalMs: 1_100 });
    expect(f.state.record.protected).toEqual(expected); expect(f.state.record.revision).toBe(9);
    expect(f.state.record.attempts).toEqual({ count: 2, pendingAttemptId: "f".repeat(64), savedCooldownMs: 250 });
  });
  it("replaces an expired pending charge with another charge, never resetting the count", async () => {
    const f = fixture(record(3)), owner = f.make(); await owner.open(); f.state.continuousMs += 500;
    const result = await owner.reserve(attempt(), f.nextBinding());
    expect(result).toMatchObject({ count: 4, pendingAttemptId: "f".repeat(64), remainingCooldownMs: 500 });
  });
  it.each(["credential", "checksum", "rootRevision", "pinRevision"])("denies a mismatched next protected %s without charging", async field => {
    const f = fixture(record(0)), owner = f.make(); await owner.open(); const next = { ...f.nextBinding() };
    if (field === "credential") next.credentialId = "d".repeat(64);
    if (field === "checksum") next.checksum = f.state.record.protected.checksum;
    if (field === "rootRevision") next.revision++;
    if (field === "pinRevision") next.pinRevision++;
    expect(await owner.reserve(attempt(), next)).toBeNull(); expect(f.state.record.attempts.count).toBe(0);
    expect(f.native.compareAndSwap).toHaveBeenCalledTimes(1);
  });
  it("burns original attempt object and wire id even after a blocked/refused reservation", async () => {
    const f = fixture(), owner = f.make(); await owner.open(); const original = attempt();
    expect(await owner.reserve(original, f.nextBinding())).toBeNull(); f.state.continuousMs += 100;
    expect(await owner.reserve(original, f.nextBinding())).toBeNull();
    expect(await owner.reserve(attempt(original.id), f.nextBinding())).toBeNull();
    expect(await owner.reserve({ id: "1".repeat(64), original: original.original }, f.nextBinding())).toBeNull();
    expect(f.native.compareAndSwap).toHaveBeenCalledTimes(1);
  });
  it("snapshots policy and original attempt data before any injected callback", async () => {
    const p = { ...policy, backoffDelaysMs: [100, 250, 500] }, f = fixture(record(0)), owner = f.make(p);
    p.backoffDelaysMs[0] = 1; await owner.open(); const entry = { id: "f".repeat(64), original: {} };
    const current = f.native.sample as ReturnType<typeof vi.fn>;
    current.mockImplementationOnce(async (c: ChildLocalRestartV2SampleChallenge) => {
      entry.id = "d".repeat(64); return { status: "authenticated", challenge: c, session: f.session, sample: f.sample() };
    });
    expect(await owner.reserve(entry, f.nextBinding())).toMatchObject({ pendingAttemptId: "f".repeat(64), remainingCooldownMs: 100 });
  });
  it("denies maximum revision/count and logical overflow without a reset transition", async () => {
    for (const kind of ["count", "pinRevision", "protectedRevision", "logical"] as const) {
      const r = clone(record(0));
      if (kind === "count") r.attempts = { count: Number.MAX_SAFE_INTEGER, pendingAttemptId: null, savedCooldownMs: 500 };
      if (kind === "pinRevision") r.protected = { ...r.protected, pinRevision: Number.MAX_SAFE_INTEGER };
      if (kind === "protectedRevision") r.protected = { ...r.protected, revision: Number.MAX_SAFE_INTEGER };
      if (kind === "logical") r.anchor = { logicalMs: Number.MAX_SAFE_INTEGER - 50 };
      const f = fixture(r), owner = f.make(); await owner.open(); f.state.continuousMs += kind === "count" ? 500 : 0;
      expect(await owner.reserve(attempt(), f.nextBinding())).toBeNull(); expect(f.native.compareAndSwap).toHaveBeenCalledTimes(1);
    }
    const f = fixture({ ...record(), revision: Number.MAX_SAFE_INTEGER }); expect(await f.make().open()).toBeNull();
    expect(f.native.compareAndSwap).not.toHaveBeenCalled();
  });
  it("requires canonical bounded nonshared bytes and authenticates their real SHA", async () => {
    for (const kind of ["space", "wrongHash", "shared", "oversize"] as const) {
      const f = fixture(); f.native.open = vi.fn(async c => {
        let bytes: Uint8Array = f.state.bytes.slice();
        if (kind === "space") bytes = new TextEncoder().encode(` ${new TextDecoder().decode(bytes)}`);
        if (kind === "shared") { const shared = new Uint8Array(new SharedArrayBuffer(bytes.length)); shared.set(bytes); bytes = shared; }
        if (kind === "oversize") bytes = new Uint8Array(4097);
        return { status: "authenticated", challenge: c, session: f.session, bytes,
          checksum: kind === "wrongHash" ? "d".repeat(64) : sha(bytes), sample: f.sample() };
      });
      expect(await f.make().open()).toBeNull(); expect(f.native.compareAndSwap).not.toHaveBeenCalled();
    }
  });
  it("seals a borrowed CAS-byte mutation even if the port returns a plausible ACK", async () => {
    const f = fixture(); const normal = f.native.compareAndSwap;
    f.native.compareAndSwap = vi.fn(async c => { const response = await normal(c, new AbortController().signal); c.expectedBytes[0] ^= 1; return response; });
    const owner = f.make(); expect(await owner.open()).toBeNull(); expect(await owner.retire()).toBe("sealed");
  });
  it("refences retained CAS bytes after the last asynchronous digest callback", async () => {
    const f = fixture(), normal = f.native.compareAndSwap, originalDigest = webcrypto.subtle.digest.bind(webcrypto.subtle);
    let borrowed: ChildLocalRestartV2CommitChallenge | null = null, calls = 0, mutations = 0;
    f.native.compareAndSwap = vi.fn(async c => { borrowed = c; return normal(c, new AbortController().signal); });
    vi.stubGlobal("crypto", { subtle: { digest: async (algorithm: string, input: Uint8Array) => {
      const output = await originalDigest(algorithm, input as Uint8Array<ArrayBuffer>);
      if (++calls === 3 && borrowed) { borrowed.nextBytes[0] ^= 1; mutations++; } return output;
    } } });
    const owner = f.make(); expect(await owner.open()).toBeNull(); expect(mutations).toBe(1);
    expect(await owner.retire()).toBe("sealed"); expect(f.state.record.attempts).toEqual(record().attempts);
  });
  it("requires exact complete readback instead of accepting a checksum-only commit ACK", async () => {
    const f = fixture(), normal = f.native.compareAndSwap;
    f.native.compareAndSwap = vi.fn(async c => {
      const raw = await normal(c, new AbortController().signal) as Record<string, unknown>;
      return { ...raw, bytes: f.state.bytes.subarray(1) };
    });
    const owner = f.make(); expect(await owner.open()).toBeNull(); expect(await owner.retire()).toBe("sealed");
    expect(f.state.record.attempts.count).toBe(1);
  });
  it("retains a published charge after a lost ACK and never treats successful retirement as rollback repair", async () => {
    const f = fixture(record(0)), normal = f.native.compareAndSwap;
    f.native.compareAndSwap = vi.fn(async c => { const raw = await normal(c, new AbortController().signal); return c.kind === "charge" ? null : raw; });
    const owner = f.make(); await owner.open(); expect(await owner.reserve(attempt(), f.nextBinding())).toBeNull();
    expect(f.state.record.attempts.count).toBe(1); expect(f.state.record.attempts.pendingAttemptId).toBe("f".repeat(64));
    expect(await owner.retire()).toBe("sealed"); expect(await owner.open()).toBeNull();
  });
  it("keeps actual in-flight native work joined after cancel, and cancellation never refunds a late charge", async () => {
    const f = fixture(record(0)), gate = deferred<void>(), entered = deferred<void>(), normal = f.native.compareAndSwap;
    f.native.compareAndSwap = vi.fn(async c => {
      if (c.kind === "charge") { entered.resolve(); await gate.promise; }
      return normal(c, new AbortController().signal);
    });
    const owner = f.make(); await owner.open(); const pending = owner.reserve(attempt(), f.nextBinding()); await entered.promise;
    owner.invalidate(); let done = false; const retirement = owner.retire().then(v => { done = true; return v; });
    try {
      await Promise.resolve(); expect(done).toBe(false); expect(f.native.retire).not.toHaveBeenCalled();
      expect(await owner.observe()).toBeNull(); expect(await owner.reserve(attempt("1".repeat(64)), f.nextBinding())).toBeNull();
    } finally { gate.resolve(); }
    expect(await pending).toBeNull(); expect(await retirement).toBe("sealed"); expect(f.state.record.attempts.count).toBe(1);
  });
  it("joins real native cancellation before known retirement, without a deadline shortcut", async () => {
    const f = fixture(), gate = deferred<void>(), entered = deferred<void>();
    f.native.cancel = vi.fn(async () => { entered.resolve(); await gate.promise; });
    const owner = f.make(); await owner.open(); owner.invalidate(); await entered.promise;
    let done = false; const pending = owner.retire().then(v => { done = true; return v; });
    try { await Promise.resolve(); expect(done).toBe(false); expect(f.native.retire).not.toHaveBeenCalled(); }
    finally { gate.resolve(); }
    expect(await pending).toBe("closed"); expect(f.state.record.attempts).toEqual(record().attempts);
  });
  it("retains the sealed result for malformed cleanup instead of reopening capacity", async () => {
    const f = fixture(); f.native.retire = vi.fn(async () => ({ status: "retired", challenge: {}, session: f.session }));
    const owner = f.make(); await owner.open(); expect(await owner.retire()).toBe("sealed");
    expect(await owner.retire()).toBe("sealed"); expect(await owner.open()).toBeNull(); expect(f.native.retire).toHaveBeenCalledTimes(1);
  });
  it("publishes one original retirement before an abort listener can reenter and still joins actual cancellation", async () => {
    const f = fixture(), gate = deferred<void>(), entered = deferred<void>(), normal = f.native.open;
    let nested: Promise<"closed" | "sealed"> | null = null, abortEvents = 0;
    let owner!: ReturnType<typeof createChildLocalRestartV2>;
    f.native.open = vi.fn(async (c: ChildLocalRestartV2OpenChallenge, signal: AbortSignal) => {
      signal.addEventListener("abort", () => { abortEvents++; nested = owner.retire(); }, { once: true });
      return normal(c, signal);
    });
    f.native.cancel = vi.fn(async () => { entered.resolve(); await gate.promise; });
    owner = f.make();
    expect(await owner.open()).not.toBeNull();
    const pending = owner.retire();
    try {
      await entered.promise;
      expect(abortEvents).toBe(1); expect(nested).toBe(pending);
      expect(f.native.cancel).toHaveBeenCalledTimes(1); expect(f.native.retire).not.toHaveBeenCalled();
      expect(await owner.observe()).toBeNull();
    } finally { gate.resolve(); }
    expect(await pending).toBe("closed"); expect(await nested).toBe("closed");
    expect(f.native.retire).toHaveBeenCalledTimes(1); expect(f.state.record.attempts).toEqual(record().attempts);
  });
  it("cancels a queued open before invoking any native operation or manufacturing a session", async () => {
    const f = fixture(), owner = f.make(), pending = owner.open(), retirement = owner.retire();
    expect(await pending).toBeNull(); expect(await retirement).toBe("closed");
    expect(f.native.open).not.toHaveBeenCalled(); expect(f.native.cancel).not.toHaveBeenCalled(); expect(f.native.retire).not.toHaveBeenCalled();
  });
  it("wipes independent encoding/digest vectors when preparation digest fails before publication", async () => {
    const f = fixture(), encoded: Uint8Array[] = [], digestInputs: Uint8Array[] = [], digestOutputs: ArrayBuffer[] = [];
    const originalEncode = TextEncoder.prototype.encode, originalDigest = webcrypto.subtle.digest.bind(webcrypto.subtle);
    vi.spyOn(TextEncoder.prototype, "encode").mockImplementation(function (this: TextEncoder, input?: string) {
      const bytes = originalEncode.call(this, input); encoded.push(bytes); return bytes;
    });
    let calls = 0;
    vi.stubGlobal("crypto", { subtle: { digest: async (algorithm: string, input: Uint8Array) => {
      digestInputs.push(input); if (++calls === 2) throw new Error("synthetic digest failure");
      const output = await originalDigest(algorithm, input as Uint8Array<ArrayBuffer>); digestOutputs.push(output); return output;
    } } });
    try {
      const owner = f.make(); expect(await owner.open()).toBeNull(); expect(await owner.retire()).toBe("sealed");
      expect(encoded.length).toBeGreaterThan(0); expect(encoded.every(b => b.every(v => v === 0))).toBe(true);
      expect(digestInputs.every(b => b.every(v => v === 0))).toBe(true);
      expect(digestOutputs.every(b => new Uint8Array(b).every(v => v === 0))).toBe(true);
      expect(f.state.bytes.some(v => v !== 0)).toBe(true); expect(f.native.compareAndSwap).not.toHaveBeenCalled();
    } finally { vi.restoreAllMocks(); }
  });
  it("holds an actual pending digest through cancellation then wipes its input/output before cleanup completes", async () => {
    const f = fixture(), gate = deferred<void>(), entered = deferred<void>(), inputs: Uint8Array[] = [], outputs: ArrayBuffer[] = [];
    const originalDigest = webcrypto.subtle.digest.bind(webcrypto.subtle); let calls = 0;
    vi.stubGlobal("crypto", { subtle: { digest: async (algorithm: string, input: Uint8Array) => {
      inputs.push(input); if (++calls === 2) { entered.resolve(); await gate.promise; }
      const output = await originalDigest(algorithm, input as Uint8Array<ArrayBuffer>); outputs.push(output); return output;
    } } });
    const owner = f.make(), pending = owner.open(); await entered.promise; owner.invalidate();
    let done = false; const retirement = owner.retire().then(v => { done = true; return v; });
    try { await Promise.resolve(); expect(done).toBe(false); expect(inputs[inputs.length - 1].some(v => v !== 0)).toBe(true); }
    finally { gate.resolve(); }
    expect(await pending).toBeNull(); expect(await retirement).toBe("closed");
    expect(inputs.every(b => b.every(v => v === 0))).toBe(true);
    expect(outputs.every(b => new Uint8Array(b).every(v => v === 0))).toBe(true);
    expect(f.native.compareAndSwap).not.toHaveBeenCalled(); expect(f.state.record.attempts).toEqual(record().attempts);
  });
  it("reserves its exclusive lane before the first native callback and refuses reentrant open", async () => {
    const f = fixture(); let nested: Promise<unknown> | null = null; const normal = f.native.open;
    let owner!: ReturnType<typeof createChildLocalRestartV2>;
    f.native.open = vi.fn(async (c: ChildLocalRestartV2OpenChallenge, signal: AbortSignal) => {
      nested = owner.open(); return normal(c, signal);
    });
    owner = f.make();
    expect(await owner.open()).not.toBeNull(); expect(await nested).toBeNull(); expect(f.native.open).toHaveBeenCalledTimes(1);
    expect(f.original()).not.toBeNull(); expect(f.native.compareAndSwap).toHaveBeenCalledTimes(1);
  });
  it("retains an exact 2048 no-eviction spent-id bound and seals instead of promoting capacity", async () => {
    const f = fixture(), owner = f.make(); await owner.open();
    for (let i = 0; i < 2048; i++) expect(await owner.reserve(attempt(i.toString(16).padStart(64, "0")), f.nextBinding())).toBeNull();
    expect(f.native.sample).toHaveBeenCalledTimes(2048);
    expect(await owner.reserve(attempt("f".repeat(64)), f.nextBinding())).toBeNull();
    expect(f.native.sample).toHaveBeenCalledTimes(2048); expect(await owner.observe()).toBeNull();
    expect(await owner.retire()).toBe("sealed"); expect(f.native.compareAndSwap).toHaveBeenCalledTimes(1);
  });
});
