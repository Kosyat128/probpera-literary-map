import { afterEach, describe, expect, it, vi } from "vitest";
import { createNativeChildPartitionData, type ChildNativeBatchChallenge, type ChildNativeDataTransport,
  type ChildNativePartitionChallenge, type ChildNativeRetirementChallenge, type ChildNativePartitionRequest } from "./childNativeData";
import { childDataNamespace, type ChildDataScope } from "./childDataNamespace";
import type { ChildIndexPurpose, ChildScopedDataPort } from "./childIndex";

type Assert<T extends true> = T;
type PartitionIsNotAdmitted = Assert<ReturnType<typeof createNativeChildPartitionData>["partitions"]["search"] extends ChildScopedDataPort ? false : true>;
const partitionTypeBoundary: PartitionIsNotAdmitted = true;

// Explicit synthetic native transport/lease/lock responses. Actual WebCrypto
// SHA-256 validates owned protocol bytes; no real OS/admission/App is supplied.
const checksum = "a".repeat(64), controllers: ReturnType<typeof createNativeChildPartitionData>[] = [];
const encoder = new TextEncoder();
async function sha(bytes: Uint8Array) { return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes.slice().buffer))].map(x => x.toString(16).padStart(2, "0")).join(""); }
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
async function settle() { for (let index = 0; index < 32; index++) await Promise.resolve(); }
function scope(locale: "ru" | "en" = "ru"): ChildDataScope { return { schemaVersion: 1, namespace: "child", profileId: "synthetic-child", profileRevision: 1,
  exactAge: 9, locale, policyVersion: "synthetic-policy", policyChecksum: checksum, packageId: "synthetic-package", packageVersion: 1, packageChecksum: checksum }; }
function fixture(timeoutMs = 1000) {
  let handle: object | null = null, generation = 0, nonce = "", selected: ChildDataScope | null = null;
  const state = { now: 0, current: true, onClock: null as (() => void) | null }, records = new Map<string, { revision: number; bytes: Uint8Array; checksum: string }>();
  const returned: Uint8Array[] = [], events: string[] = [];
  const native: ChildNativeDataTransport = {
    activate: vi.fn(async (challenge: ChildNativePartitionChallenge) => { events.push("activate"); generation++; handle = {}; nonce = generation.toString(16).padStart(32, "0"); selected = challenge.scope;
      return { status: "partitioned", challenge, handle, generation, nonce }; }),
    transact: vi.fn(async (challenge: ChildNativeBatchChallenge, signal: AbortSignal) => {
      events.push(challenge.writes.length ? "write" : "read");
      if (signal.aborted || challenge.partition.handle !== handle || challenge.partition.generation !== generation || challenge.partition.nonce !== nonce
        || JSON.stringify(challenge.partition.scope) !== JSON.stringify(selected)) return { status: "unavailable", challenge };
      for (const write of challenge.writes) { const id = write.purpose + "\n" + write.key;
        if ((records.get(id)?.revision ?? 0) !== write.expectedRevision || await sha(write.bytes) !== write.checksum) return { status: "unavailable", challenge }; }
      for (const write of challenge.writes) records.set(write.purpose + "\n" + write.key, { revision: write.expectedRevision + 1, bytes: write.bytes.slice(), checksum: write.checksum });
      const slots = challenge.reads.map(read => { const stored = records.get(read.purpose + "\n" + read.key), bytes = stored?.bytes.slice() ?? null; if (bytes) returned.push(bytes);
        return { purpose: read.purpose, key: read.key, revision: stored?.revision ?? 0, bytes, checksum: stored?.checksum ?? null }; });
      return { status: "committed", challenge, slots };
    }),
    retire: vi.fn(async (challenge: ChildNativeRetirementChallenge) => { events.push("retire");
      if (challenge.partition.handle !== handle || challenge.partition.generation !== generation || challenge.partition.nonce !== nonce) return { status: "unavailable", challenge };
      handle = null; selected = null; return { status: "retired", challenge }; }),
    close: vi.fn(async () => { events.push("close"); handle = null; selected = null; }),
  };
  const options = { native, digest: { sha256: sha }, clock: { nowMs: () => { state.onClock?.(); return state.now; } }, timeoutMs, initialVisibility: "active" as const };
  const controller = createNativeChildPartitionData(options); controllers.push(controller);
  const dataScope = scope(); let lease: object | null = null;
  async function open(input: ChildDataScope) { lease = await controller.openPartition(input); return lease !== null; }
  function request(purpose: ChildIndexPurpose, currentScope = dataScope): ChildNativePartitionRequest {
    const base = childDataNamespace(currentScope, purpose)!;
    return { purpose, scope: currentScope, key: purpose === "cache" || purpose === "offline" ? `${base}/item/${purpose === "offline" ? "offline-package" : "work"}/synthetic-item` : base,
      partitionLease: lease!, mayPublish: () => state.current };
  }
  function value(purpose: ChildIndexPurpose, currentScope = dataScope) {
    if (purpose === "search" || purpose === "history") return { schemaVersion: 1, scope: currentScope, references: [{ kind: purpose === "search" ? "search-result" : "recent", id: "synthetic-item", contentChecksum: checksum }] };
    return { schemaVersion: 1, scope: currentScope, entries: [{ reference: { kind: purpose === "offline" ? "offline-package" : "work", id: "synthetic-item", contentChecksum: checksum },
      payload: { title: "Synthetic owned data", text: "No reviewed content.", terms: [], references: [] } }] };
  }
  return { controller, native, options, events, state, records, returned, scope: dataScope, request, value,
    open, supersedeNative() { generation++; handle = {}; nonce = generation.toString(16).padStart(32, "0"); } };
}
afterEach(async () => { for (const controller of controllers.splice(0)) { void controller.dispose(); } await settle(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe("private native child data protocol", () => {
  it.each(["search", "history", "cache", "offline"] as const)("CAS and independent readback deliver exact %s child envelope only", async purpose => {
    const f = fixture(); expect(await f.open(f.scope)).toBe(true); const request = f.request(purpose);
    expect(partitionTypeBoundary).toBe(true); expect(Object.keys(f.controller.partitions[purpose]).sort()).toEqual(["comparePartition", "readPartition"]);
    expect(await f.controller.partitions[purpose].readPartition(request, new AbortController().signal)).toEqual({ revision: 0, value: null });
    expect(await f.controller.partitions[purpose].comparePartition(request, 0, f.value(purpose), new AbortController().signal)).toBe(true);
    expect(f.events.slice(-2)).toEqual(["write", "read"]);
    expect(await f.controller.partitions[purpose].readPartition(request, new AbortController().signal)).toEqual({ revision: 1, value: f.value(purpose) });
    expect(f.returned.every(bytes => bytes.every(byte => byte === 0))).toBe(true); expect(f.controller.getSnapshot().nativeAuthority).toBe(false);
  });
  it("native supersession denies reads and writes even while the JS caller remains current", async () => {
    const f = fixture(); expect(await f.open(f.scope)).toBe(true); f.supersedeNative(); const request = f.request("search");
    expect(await f.controller.partitions.search.readPartition(request, new AbortController().signal)).toBeNull();
    expect(await f.controller.partitions.search.comparePartition(request, 0, f.value("search"), new AbortController().signal)).toBe(false);
    expect(f.records.size).toBe(0);
  });
  it("wrong purpose/full scope/adult key or control marker never reaches native dispatch", async () => {
    const f = fixture(); expect(await f.open(f.scope)).toBe(true); const request = f.request("search");
    for (const invalid of [{ ...request, purpose: "history" }, { ...request, key: "adult-index" }, { ...request, key: "probpera-child-v1/active-context" },
      { ...request, scope: { ...f.scope, exactAge: 10 } }, { ...request, scope: { ...f.scope, locale: "en" } }]) {
      expect(await f.controller.partitions.search.readPartition(invalid as ChildNativePartitionRequest, new AbortController().signal)).toBeNull(); }
    expect(f.native.transact).not.toHaveBeenCalled();
  });
  it("noncanonical response challenge and tampered digest cannot publish child values", async () => {
    const f = fixture(); expect(await f.open(f.scope)).toBe(true); const request = f.request("search");
    expect(await f.controller.partitions.search.comparePartition(request, 0, f.value("search"), new AbortController().signal)).toBe(true);
    const original = f.native.transact;
    vi.mocked(f.native.transact).mockImplementationOnce(async (challenge, signal) => ({ ...(await original(challenge, signal) as object), challenge: { ...challenge } }));
    expect(await f.controller.partitions.search.readPartition(request, new AbortController().signal)).toBeNull();
    vi.mocked(f.native.transact).mockImplementationOnce(async (challenge, signal) => ({ ...(await original(challenge, signal) as object), extra: "malformed-response" }));
    expect(await f.controller.partitions.search.readPartition(request, new AbortController().signal)).toBeNull();
    const getter = vi.fn(() => "unsafe-cleanup");
    vi.mocked(f.native.transact).mockImplementationOnce(async (challenge, signal) => {
      const result = await original(challenge, signal) as { slots: object[] };
      Object.defineProperty(result.slots[0], "extra", { enumerable: true, get: getter }); return result;
    });
    expect(await f.controller.partitions.search.readPartition(request, new AbortController().signal)).toBeNull();
    expect(getter).not.toHaveBeenCalled(); expect(f.returned.every(bytes => bytes.every(byte => byte === 0))).toBe(true);
    const stored = [...f.records.values()][0]; stored.checksum = "b".repeat(64);
    expect(await f.controller.partitions.search.readPartition(request, new AbortController().signal)).toBeNull();
  });
  it("strict canonical JSON rejects duplicate keys and malformed UTF8 even with a matching real hash", async () => {
    const f = fixture(); expect(await f.open(f.scope)).toBe(true); const request = f.request("search"), id = "search\n" + request.key;
    for (const bytes of [encoder.encode(JSON.stringify(f.value("search")).replace('"schemaVersion":1', '"schemaVersion":1,"schemaVersion":1')), new Uint8Array([0xc3, 0x28])]) {
      f.records.set(id, { revision: 1, bytes, checksum: await sha(bytes) }); expect(await f.controller.partitions.search.readPartition(request, new AbortController().signal)).toBeNull(); }
  });
  it("cache references stay within one complete stored envelope and offline starts with offline-package", async () => {
    const f = fixture(); expect(await f.open(f.scope)).toBe(true);
    const cache = f.value("cache") as { entries: { payload: { references: unknown[] } }[] }; cache.entries[0].payload.references.push({ kind: "work", id: "adult-unowned-work", contentChecksum: checksum });
    expect(await f.controller.partitions.cache.comparePartition(f.request("cache"), 0, cache, new AbortController().signal)).toBe(false);
    const offline = f.value("cache"); expect(await f.controller.partitions.offline.comparePartition(f.request("offline"), 0, offline, new AbortController().signal)).toBe(false);
    expect(f.native.transact).not.toHaveBeenCalled();
  });
  it("getters, inherited fields and wrong reference kind fail before native data writes", async () => {
    const f = fixture(); expect(await f.open(f.scope)).toBe(true); const getter = vi.fn(() => f.scope), input = { ...f.value("search") };
    Object.defineProperty(input, "scope", { enumerable: true, get: getter });
    expect(await f.controller.partitions.search.comparePartition(f.request("search"), 0, input, new AbortController().signal)).toBe(false); expect(getter).not.toHaveBeenCalled();
    expect(await f.controller.partitions.search.comparePartition(f.request("search"), 0, f.value("history"), new AbortController().signal)).toBe(false);
    const request = { ...f.request("search") }; request.mayPublish = () => { request.key = "adult-mutated-by-callback"; return true; };
    expect(await f.controller.partitions.search.readPartition(request, new AbortController().signal)).toBeNull();
    expect(f.native.transact).not.toHaveBeenCalled();
  });
  it("aggregate canonical UTF8 budget rejects repeated individually valid large entries before native dispatch", async () => {
    const f = fixture(); expect(await f.open(f.scope)).toBe(true);
    const payload = { title: "Synthetic budget input", text: "я".repeat(32768), terms: [], references: [] };
    const entries = Array.from({ length: 130 }, (_, index) => ({ reference: { kind: "work", id: index ? `synthetic-${index}` : "synthetic-item", contentChecksum: checksum }, payload }));
    expect(await f.controller.partitions.cache.comparePartition(f.request("cache"), 0, { schemaVersion: 1, scope: f.scope, entries }, new AbortController().signal)).toBe(false);
    expect(f.native.transact).not.toHaveBeenCalled(); expect(f.records.size).toBe(0);
  });
  it("CAS conflict does not perform a readback or overwrite existing data", async () => {
    const f = fixture(); expect(await f.open(f.scope)).toBe(true); const request = f.request("search");
    expect(await f.controller.partitions.search.comparePartition(request, 0, f.value("search"), new AbortController().signal)).toBe(true); f.events.length = 0;
    expect(await f.controller.partitions.search.comparePartition(request, 0, f.value("search"), new AbortController().signal)).toBe(false); expect(f.events).toEqual(["write"]);
    expect([...f.records.values()][0].revision).toBe(1);
  });
  it("unknown acknowledgement stays false despite the native fixture committing the bytes", async () => {
    const f = fixture(); expect(await f.open(f.scope)).toBe(true); const request = f.request("search"), original = f.native.transact;
    vi.mocked(f.native.transact).mockImplementationOnce(async (challenge, signal) => { f.state.current = false; await original(challenge, signal); throw new Error("synthetic-lost-ack"); });
    expect(await f.controller.partitions.search.comparePartition(request, 0, f.value("search"), new AbortController().signal)).toBe(false);
    expect([...f.records.values()][0].revision).toBe(1); // No false rollback claim.
  });
  it("a persisted readback revision/value change cannot acknowledge a previous CAS", async () => {
    const f = fixture(); expect(await f.open(f.scope)).toBe(true); const original = f.native.transact;
    vi.mocked(f.native.transact).mockImplementationOnce(async (challenge, signal) => { const answer = await original(challenge, signal); [...f.records.values()][0].revision++; return answer; });
    expect(await f.controller.partitions.search.comparePartition(f.request("search"), 0, f.value("search"), new AbortController().signal)).toBe(false);
  });
  it("malformed native partition nonce prevents a ready data partition", async () => {
    const f = fixture(); const raw = deferred<unknown>(); vi.mocked(f.native.activate).mockReturnValueOnce(raw.promise);
    const activated = f.open(f.scope); await settle(); const challenge = vi.mocked(f.native.activate).mock.calls[0][0];
    raw.resolve({ status: "partitioned", challenge, handle: {}, generation: 1, nonce: "not-native-nonce" }); expect(await activated).toBe(false);
    expect(f.controller.getSnapshot().phase).toBe("sealed");
  });
});

describe("bounded native lifecycle and capacity", () => {
  it("aborted unresolved transport settles locally but holds capacity until its actual late reply", async () => {
    const f = fixture(), pending = deferred<unknown>(); expect(await f.open(f.scope)).toBe(true);
    vi.mocked(f.native.transact).mockReturnValueOnce(pending.promise); const abort = new AbortController(), request = f.request("search");
    const reading = f.controller.partitions.search.readPartition(request, abort.signal); await settle(); abort.abort(); expect(await reading).toBeNull();
    expect(await f.controller.partitions.search.readPartition(request, new AbortController().signal)).toBeNull(); expect(f.native.transact).toHaveBeenCalledTimes(1);
    const challenge = vi.mocked(f.native.transact).mock.calls[0][0], bytes = encoder.encode(JSON.stringify(f.value("search")));
    pending.resolve({ status: "committed", challenge, slots: [{ purpose: "search", key: request.key, revision: 1, bytes, checksum: await sha(bytes) }] }); await settle();
    expect(bytes.every(byte => byte === 0)).toBe(true); expect(await f.controller.partitions.search.readPartition(request, new AbortController().signal)).toEqual({ revision: 0, value: null });
  });
  it("background queues exact native retirement and denies A→B→A old leases", async () => {
    const f = fixture(); expect(await f.open(f.scope)).toBe(true); const old = f.request("search");
    expect(await f.controller.background()).toBe(true); expect(f.events.slice(-1)).toEqual(["retire"]);
    expect(await f.open(f.scope)).toBe(false); await f.controller.foreground(); expect(await f.open(scope("en"))).toBe(true);
    expect(await f.open(f.scope)).toBe(true); expect(await f.controller.partitions.search.readPartition(old, new AbortController().signal)).toBeNull();
  });
  it("hung retirement has a bounded caller result and keeps native job capacity sealed", async () => {
    vi.useFakeTimers(); const f = fixture(100), pending = deferred<unknown>(); expect(await f.open(f.scope)).toBe(true);
    f.options.timeoutMs = 60_000; // Caller mutation cannot expand the validated budget.
    vi.mocked(f.native.retire).mockReturnValueOnce(pending.promise); const retiring = f.controller.retire(); await settle(); await vi.advanceTimersByTimeAsync(100);
    expect(await retiring).toBe(false); expect(await f.open(f.scope)).toBe(false); expect(f.controller.getSnapshot().phase).toBe("unavailable");
    const challenge = vi.mocked(f.native.retire).mock.calls[0][0]; pending.resolve({ status: "retired", challenge }); await settle();
  });
  it("dispose during a hung read settles within its budget and later closes the native owner once", async () => {
    vi.useFakeTimers(); const f = fixture(100), pending = deferred<unknown>(); expect(await f.open(f.scope)).toBe(true);
    vi.mocked(f.native.transact).mockReturnValueOnce(pending.promise); const reading = f.controller.partitions.search.readPartition(f.request("search"), new AbortController().signal); await settle();
    const disposed = f.controller.dispose(); expect(await reading).toBeNull(); await vi.advanceTimersByTimeAsync(100); expect(await disposed).toBe(false);
    const challenge = vi.mocked(f.native.transact).mock.calls[0][0]; pending.resolve({ status: "unavailable", challenge }); await settle();
    expect(f.native.retire).toHaveBeenCalledTimes(1); expect(f.native.close).toHaveBeenCalledTimes(1); expect(f.controller.getSnapshot().phase).toBe("disposed");
  });
  it("clock rollback seals publication and disposal still attempts the native close", async () => {
    const f = fixture(); f.state.now = 10; expect(await f.open(f.scope)).toBe(true); f.state.now = 9;
    expect(await f.controller.partitions.search.readPartition(f.request("search"), new AbortController().signal)).toBeNull(); expect(f.controller.getSnapshot().phase).toBe("unavailable");
    expect(await f.controller.dispose()).toBe(true); expect(f.native.close).toHaveBeenCalledTimes(1);
  });
  it("a reentrant current callback cannot issue a second native job during preflight", async () => {
    const f = fixture(), pending = deferred<unknown>(); expect(await f.open(f.scope)).toBe(true); vi.mocked(f.native.transact).mockReturnValueOnce(pending.promise);
    const request = f.request("search"), original = request.mayPublish; let nested = false, other: Promise<unknown> | null = null;
    const input = { ...request, mayPublish: () => { if (!nested) { nested = true; other = f.controller.partitions.search.readPartition(request, new AbortController().signal); } return original(); } };
    const outer = f.controller.partitions.search.readPartition(input, new AbortController().signal); await settle(); expect(await outer).toBeNull(); expect(f.native.transact).toHaveBeenCalledTimes(1);
    const challenge = vi.mocked(f.native.transact).mock.calls[0][0]; pending.resolve({ status: "committed", challenge, slots: [{ purpose: "search", key: request.key, revision: 0, bytes: null, checksum: null }] }); await settle(); expect(await other).toEqual({ revision: 0, value: null });
    // The last clock callback runs after mayPublish. Its synchronous mutation
    // must still be checked before the owned result is handed to the caller.
    const late = deferred<unknown>(); vi.mocked(f.native.transact).mockReturnValueOnce(late.promise);
    const mutable = { ...request }; let armed = false;
    mutable.mayPublish = () => { armed = true; return true; };
    const finalRead = f.controller.partitions.search.readPartition(mutable, new AbortController().signal); await settle(); armed = false;
    f.state.onClock = () => { if (armed) mutable.key = "adult-mutated-by-final-clock"; };
    const finalChallenge = vi.mocked(f.native.transact).mock.calls[1][0];
    late.resolve({ status: "committed", challenge: finalChallenge, slots: [{ purpose: "search", key: request.key, revision: 0, bytes: null, checksum: null }] });
    expect(await finalRead).toBeNull(); f.state.onClock = null;
  });
});
