import { webcrypto } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { childDataNamespace, type ChildDataScope } from "./childDataNamespace";
import { CHILD_PACKAGE_MAX_BYTES } from "./childPackage";
import { createNativeChildPartitionData } from "./childNativeData";
import type { ChildNativeBatchChallenge, ChildNativeDataTransport, ChildNativePartition, ChildNativePartitionChallenge } from "./childNativeData";
import { createChildNativeTransport, type ChildPrivateNativeRpc } from "./childNativeTransport";

// Explicit synthetic typed-RPC fixture. It proves wire/capacity translation;
// it is not an installed Android/iOS store, bridge, trusted time or admission.
const digest = async (bytes: Uint8Array) => Buffer.from(await webcrypto.subtle.digest("SHA-256", bytes.slice().buffer)).toString("hex");
const encoder = new TextEncoder(), signal = () => new AbortController().signal;
const owners: ChildNativeDataTransport[] = [];
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
async function settle() { for (let i = 0; i < 24; i++) await Promise.resolve(); }
function scope(locale: "ru" | "en" = "ru"): ChildDataScope {
  return { schemaVersion: 1, namespace: "child", profileId: "synthetic-child", profileRevision: 1, exactAge: 9, locale,
    policyVersion: "synthetic-policy", policyChecksum: "a".repeat(64), packageId: "synthetic-package", packageVersion: 1, packageChecksum: "b".repeat(64) };
}
function fixture(timeoutMs = 1000) {
  type Binding = { ownerToken: string; leaseToken: string; scope: ChildDataScope; generation: number; nonce: string };
  const ownerToken = "a".repeat(32), stored = new Map<string, { revision: number; bytes: Uint8Array; checksum: string }>();
  const state = { now: 0, onClock: null as (() => void) | null, binding: null as Binding | null, generation: 0, closed: false };
  const unavailable = (request: unknown) => ({ version: 1, requestId: (request as { requestId: string }).requestId, status: "unavailable" });
  const rpc: ChildPrivateNativeRpc = {
    activate: vi.fn(async input => {
      const r = input as { requestId: string; scope: ChildDataScope }; if (state.closed) return unavailable(r);
      const generation = ++state.generation; state.binding = { ownerToken, leaseToken: generation.toString(16).padStart(32, "0"), scope: r.scope, generation, nonce: (generation + 4096).toString(16).padStart(32, "0") };
      return { version: 1, requestId: r.requestId, status: "partitioned", ...state.binding };
    }),
    transact: vi.fn(async input => {
      const r = input as Binding & { requestId: string; reads: { purpose: string; key: string }[]; writes: { purpose: string; key: string; expectedRevision: number; base64: string; checksum: string }[] };
      const b = state.binding; if (state.closed || !b || r.ownerToken !== b.ownerToken || r.leaseToken !== b.leaseToken || r.generation !== b.generation || r.nonce !== b.nonce || JSON.stringify(r.scope) !== JSON.stringify(b.scope)) return unavailable(r);
      for (const w of r.writes) { const bytes = new Uint8Array(Buffer.from(w.base64, "base64"));
        if ((stored.get(w.purpose + "\n" + w.key)?.revision ?? 0) !== w.expectedRevision || await digest(bytes) !== w.checksum) return unavailable(r); }
      for (const w of r.writes) stored.set(w.purpose + "\n" + w.key, { revision: w.expectedRevision + 1, bytes: new Uint8Array(Buffer.from(w.base64, "base64")), checksum: w.checksum });
      const slots = r.reads.map(read => { const value = stored.get(read.purpose + "\n" + read.key); return { purpose: read.purpose, key: read.key, revision: value?.revision ?? 0, base64: value ? Buffer.from(value.bytes).toString("base64") : null, checksum: value?.checksum ?? null }; });
      return { version: 1, requestId: r.requestId, status: "committed", ...b, slots };
    }),
    retire: vi.fn(async input => { const r = input as Binding & { requestId: string }, b = state.binding;
      if (!b || r.leaseToken !== b.leaseToken) return unavailable(r); state.binding = null; return { version: 1, requestId: r.requestId, status: "retired", ...b }; }),
    cancel: vi.fn(async input => { const r = input as { requestId: string; targetRequestId: string }; return { version: 1, requestId: r.requestId, status: "cancellation-requested", targetRequestId: r.targetRequestId }; }),
    close: vi.fn(async input => { const r = input as { requestId: string }; state.closed = true; state.binding = null; return { version: 1, requestId: r.requestId, status: "closed", ownerToken }; }),
  };
  const hashing = vi.fn(digest), options = { rpc, digest: { sha256: hashing }, clock: { nowMs: () => { state.onClock?.(); return state.now; } }, timeoutMs };
  const transport = createChildNativeTransport(options); owners.push(transport);
  async function activate(input = scope()) {
    const challenge = Object.freeze({ ticket: 1, scope: input }), answer = await transport.activate(challenge, signal()) as { status: string; handle: object; generation: number; nonce: string };
    expect(answer.status).toBe("partitioned"); return Object.freeze({ handle: answer.handle, scope: input, generation: answer.generation, nonce: answer.nonce }) as ChildNativePartition;
  }
  function reading(partition: ChildNativePartition): ChildNativeBatchChallenge { return { partition, reads: [{ purpose: "search", key: childDataNamespace(partition.scope, "search")! }], writes: [] }; }
  return { transport, rpc, options, state, stored, hashing, ownerToken, activate, reading, unavailable };
}
afterEach(async () => { for (const owner of owners.splice(0)) void owner.close(); await settle(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe("constructor-owned private native wire transport", () => {
  it.each(["search", "history", "cache", "offline"] as const)("composed client translates %s CAS, native snapshot and independent readback", async purpose => {
    const f = fixture(), controller = createNativeChildPartitionData({ native: f.transport, digest: { sha256: digest }, clock: { nowMs: () => f.state.now }, timeoutMs: 1000, initialVisibility: "active" });
    const selected = scope(), lease = await controller.openPartition(selected); expect(lease).not.toBeNull();
    const base = childDataNamespace(selected, purpose)!, kind = purpose === "offline" ? "offline-package" : "work";
    const request = { purpose, scope: selected, key: purpose === "search" || purpose === "history" ? base : base + "/item/" + kind + "/synthetic-item", partitionLease: lease!, mayPublish: () => true };
    const value = purpose === "search" || purpose === "history" ? { schemaVersion: 1, scope: selected, references: [{ kind: purpose === "search" ? "search-result" : "recent", id: "synthetic-item", contentChecksum: "c".repeat(64) }] }
      : { schemaVersion: 1, scope: selected, entries: [{ reference: { kind, id: "synthetic-item", contentChecksum: "c".repeat(64) }, payload: { title: "Synthetic private data", text: "No reviewed child content", terms: [], references: [] } }] };
    expect(await controller.partitions[purpose].comparePartition(request, 0, value, signal())).toBe(true);
    expect(await controller.partitions[purpose].readPartition(request, signal())).toEqual({ revision: 1, value });
    const calls = vi.mocked(f.rpc.transact).mock.calls.map(([r]) => r as { reads: unknown[]; writes: unknown[] });
    expect(calls.map(r => [r.reads.length, r.writes.length])).toEqual([[0, 1], [1, 0], [1, 0]]);
    expect(JSON.stringify(calls)).not.toContain('"challenge"'); expect(JSON.stringify(calls)).not.toContain('"handle"'); expect(controller.getSnapshot().nativeAuthority).toBe(false);
    expect(await controller.dispose()).toBe(true);
  });
  it("returns original challenge identity while only native-created tokens cross the wire", async () => {
    const f = fixture(), selected = scope(), challenge: ChildNativePartitionChallenge = { ticket: 3, scope: selected };
    const answer = await f.transport.activate(challenge, signal()) as { challenge: unknown; handle: object; generation: number; nonce: string };
    expect(answer.challenge).toBe(challenge); expect(Object.keys(answer.handle)).toEqual([]);
    const request = vi.mocked(f.rpc.activate).mock.calls[0][0] as Record<string, unknown>;
    expect(Object.keys(request).sort()).toEqual(["ownerToken", "requestId", "scope", "timeoutMs", "version"]); expect(request.ownerToken).toBeNull();
    expect(request.requestId).toMatch(/^[a-f0-9]{32}$/u); expect(Object.isFrozen(request)).toBe(true);
    const batch = f.reading({ handle: answer.handle, scope: selected, generation: answer.generation, nonce: answer.nonce });
    expect((await f.transport.transact(batch, signal()) as { challenge: unknown }).challenge).toBe(batch);
  });
  it("forged handle, altered scope/generation/nonce, adult key and control key never dispatch", async () => {
    const f = fixture(), partition = await f.activate(), read = f.reading(partition);
    for (const invalid of [{ ...partition, handle: {} }, { ...partition, generation: partition.generation + 1 }, { ...partition, nonce: "f".repeat(32) }, { ...partition, scope: scope("en") }])
      expect((await f.transport.transact({ ...read, partition: invalid }, signal()) as { status: string }).status).toBe("unavailable");
    for (const key of ["adult-index", "probpera-child-v1/active-context"]) expect((await f.transport.transact({ ...read, reads: [{ purpose: "search", key }] }, signal()) as { status: string }).status).toBe("unavailable");
    expect(f.rpc.transact).not.toHaveBeenCalled();
  });
  it("copies all mutation metadata/bytes synchronously and sends only remaining native budget", async () => {
    const f = fixture(), partition = await f.activate(), bytes = encoder.encode("synthetic owned bytes"), original = bytes.slice(), checksum = await digest(bytes), wait = deferred<string>();
    vi.mocked(f.hashing).mockImplementationOnce(() => wait.promise);
    const write = { purpose: "search" as const, key: childDataNamespace(partition.scope, "search")!, expectedRevision: 0, bytes, checksum };
    const challenge: ChildNativeBatchChallenge = { partition, reads: [], writes: [write] };
    const result = f.transport.transact(challenge, signal()); bytes.fill(0); write.key = "adult-mutated-after-enqueue"; write.expectedRevision = 999;
    await settle(); f.state.now = 250; wait.resolve(checksum);
    expect((await result as { status: string }).status).toBe("committed"); const sent = vi.mocked(f.rpc.transact).mock.calls[0][0] as { writes: { base64: string }[] };
    expect(new Uint8Array(Buffer.from(sent.writes[0].base64, "base64"))).toEqual(original); expect(Object.isFrozen(sent)).toBe(true); expect(Object.isFrozen(sent.writes)).toBe(true); expect(Object.isFrozen(sent.writes[0])).toBe(true);
    expect((sent as unknown as { timeoutMs: number }).timeoutMs).toBe(750); expect((sent.writes[0] as unknown as { key: string; expectedRevision: number }).key).toBe(childDataNamespace(partition.scope, "search")); expect((sent.writes[0] as unknown as { expectedRevision: number }).expectedRevision).toBe(0);
  });
  it.each(["QR==", "QQ", "QQ===", "Q Q=", "éQ=="])("rejects noncanonical base64 %s before hashing/decoded publication", async base64 => {
    const f = fixture(), partition = await f.activate(), challenge = f.reading(partition), checksum = await digest(new Uint8Array([65]));
    vi.mocked(f.rpc.transact).mockImplementationOnce(async input => ({ version: 1, requestId: (input as { requestId: string }).requestId, status: "committed", ...f.state.binding,
      slots: [{ purpose: "search", key: challenge.reads[0].key, revision: 1, base64, checksum }] }));
    expect((await f.transport.transact(challenge, signal()) as { status: string }).status).toBe("unavailable"); expect(f.hashing).not.toHaveBeenCalled(); expect(f.rpc.close).toHaveBeenCalledTimes(1);
  });
  it("malformed own descriptors never invoke a getter and force actual owner close", async () => {
    const f = fixture(), partition = await f.activate(), challenge = f.reading(partition), getter = vi.fn(() => "QQ==");
    vi.mocked(f.rpc.transact).mockImplementationOnce(async input => { const slot = { purpose: "search", key: challenge.reads[0].key, revision: 1, checksum: "a".repeat(64) }; Object.defineProperty(slot, "base64", { enumerable: true, get: getter });
      return { version: 1, requestId: (input as { requestId: string }).requestId, status: "committed", ...f.state.binding, slots: [slot] }; });
    expect((await f.transport.transact(challenge, signal()) as { status: string }).status).toBe("unavailable"); expect(getter).not.toHaveBeenCalled(); expect(f.rpc.close).toHaveBeenCalledTimes(1);
  });
  it("decoded buffers transfer only after exact checksum validation; digest copies are wiped", async () => {
    const f = fixture(), partition = await f.activate(), challenge = f.reading(partition), bytes = encoder.encode("synthetic result"), checksum = await digest(bytes), inspected: Uint8Array[] = [];
    vi.mocked(f.hashing).mockImplementation(async value => { inspected.push(value); return digest(value); });
    vi.mocked(f.rpc.transact).mockImplementationOnce(async input => ({ version: 1, requestId: (input as { requestId: string }).requestId, status: "committed", ...f.state.binding,
      slots: [{ purpose: "search", key: challenge.reads[0].key, revision: 1, base64: Buffer.from(bytes).toString("base64"), checksum }] }));
    const answer = await f.transport.transact(challenge, signal()) as { slots: { bytes: Uint8Array }[] }; expect(answer.slots[0].bytes).toEqual(bytes); expect(inspected.every(copy => copy.every(n => n === 0))).toBe(true);
    answer.slots[0].bytes.fill(0); // Transferred caller owns final erasure.
  });
  it("snapshots response DTO metadata before the asynchronous digest callback can mutate it", async () => {
    const f = fixture(), partition = await f.activate(), challenge = f.reading(partition), bytes = encoder.encode("owned result"), checksum = await digest(bytes);
    const slot = { purpose: "search", key: challenge.reads[0].key, revision: 1, base64: Buffer.from(bytes).toString("base64"), checksum };
    vi.mocked(f.rpc.transact).mockImplementationOnce(async input => ({ version: 1, requestId: (input as { requestId: string }).requestId, status: "committed", ...f.state.binding, slots: [slot] }));
    vi.mocked(f.hashing).mockImplementationOnce(async copy => { slot.key = "adult-mutated-during-digest"; slot.base64 = "invalid"; slot.checksum = "f".repeat(64); return digest(copy); });
    const answer = await f.transport.transact(challenge, signal()) as { slots: { key: string; bytes: Uint8Array }[] };
    expect(answer.slots[0].key).toBe(challenge.reads[0].key); expect(answer.slots[0].bytes).toEqual(bytes); answer.slots[0].bytes.fill(0);
  });
  it.each(["single-value", "aggregate", "slot-count"] as const)("bounds %s before native dispatch or hash allocation", async violation => {
    const f = fixture(), partition = await f.activate(), base = childDataNamespace(partition.scope, "cache")!, bytes = new Uint8Array(CHILD_PACKAGE_MAX_BYTES + (violation === "single-value" ? 1 : 0));
    const writes = violation === "slot-count" ? [] : Array.from({ length: violation === "aggregate" ? 5 : 1 }, (_, i) => ({ purpose: "cache" as const, key: base + "/item/work/synthetic-" + i, expectedRevision: 0, bytes, checksum: "a".repeat(64) }));
    const reads = violation === "slot-count" ? Array.from({ length: 65 }, (_, i) => ({ purpose: "cache" as const, key: base + "/item/work/synthetic-" + i })) : [];
    expect((await f.transport.transact({ partition, reads, writes }, signal()) as { status: string }).status).toBe("unavailable"); expect(f.rpc.transact).not.toHaveBeenCalled(); expect(f.hashing).not.toHaveBeenCalled();
  });
  it("oversized encoded response is refused before decoding or hashing", async () => {
    const f = fixture(), partition = await f.activate(), challenge = f.reading(partition);
    vi.mocked(f.rpc.transact).mockImplementationOnce(async input => ({ version: 1, requestId: (input as { requestId: string }).requestId, status: "committed", ...f.state.binding,
      slots: [{ purpose: "search", key: challenge.reads[0].key, revision: 1, base64: "A".repeat(Math.ceil(CHILD_PACKAGE_MAX_BYTES / 3) * 4 + 4), checksum: "a".repeat(64) }] }));
    expect((await f.transport.transact(challenge, signal()) as { status: string }).status).toBe("unavailable"); expect(f.hashing).not.toHaveBeenCalled(); expect(f.rpc.close).toHaveBeenCalledTimes(1);
  });
  it("wrong session/challenge correlation cannot publish or reopen the sealed owner", async () => {
    const f = fixture(), partition = await f.activate(), original = f.rpc.transact;
    vi.mocked(f.rpc.transact).mockImplementationOnce(async request => ({ ...(await original(request) as object), ownerToken: "f".repeat(32) }));
    expect((await f.transport.transact(f.reading(partition), signal()) as { status: string }).status).toBe("unavailable");
    expect((await f.transport.activate({ ticket: 2, scope: scope() }, signal()) as { status: string }).status).toBe("unavailable"); expect(f.rpc.close).toHaveBeenCalledTimes(1);
  });
  it("out-of-order or duplicated read slots and a tampered checksum are unavailable", async () => {
    for (const malformed of ["wrong-key", "bad-checksum"] as const) {
      const f = fixture(), partition = await f.activate(), challenge = f.reading(partition);
      vi.mocked(f.rpc.transact).mockImplementationOnce(async input => ({ version: 1, requestId: (input as { requestId: string }).requestId, status: "committed", ...f.state.binding,
        slots: [{ purpose: "search", key: malformed === "wrong-key" ? "adult-index" : challenge.reads[0].key, revision: 1, base64: "QQ==", checksum: "f".repeat(64) }] }));
      expect((await f.transport.transact(challenge, signal()) as { status: string }).status).toBe("unavailable"); expect(f.rpc.close).toHaveBeenCalledTimes(1);
    }
  });
});

describe("actual ACK, cancellation and finite private owner lifetime", () => {
  it("abort invokes one actual cancellation and holds data capacity through cancel ACK until original completion", async () => {
    const f = fixture(), partition = await f.activate(), pending = deferred<unknown>(), abort = new AbortController();
    vi.mocked(f.rpc.transact).mockReturnValueOnce(pending.promise); const challenge = f.reading(partition), result = f.transport.transact(challenge, abort.signal); let settled = false; void result.then(() => { settled = true; }); await settle(); abort.abort(); await settle();
    expect(f.rpc.cancel).toHaveBeenCalledTimes(1); expect(settled).toBe(false); expect((await f.transport.transact(challenge, signal()) as { status: string }).status).toBe("unavailable"); expect(f.rpc.transact).toHaveBeenCalledTimes(1);
    const request = vi.mocked(f.rpc.transact).mock.calls[0][0]; pending.resolve(f.unavailable(request)); expect((await result as { status: string }).status).toBe("unavailable");
    expect((await f.transport.transact(challenge, signal()) as { status: string }).status).toBe("committed");
  });
  it("timeout snapshots the original budget and never releases unresolved native work", async () => {
    vi.useFakeTimers(); const f = fixture(100), partition = await f.activate(), pending = deferred<unknown>(); f.options.timeoutMs = 60_000;
    vi.mocked(f.rpc.transact).mockReturnValueOnce(pending.promise); const challenge = f.reading(partition), result = f.transport.transact(challenge, signal()); let settled = false; void result.then(() => { settled = true; }); await settle(); await vi.advanceTimersByTimeAsync(100);
    expect(settled).toBe(false); expect(f.rpc.cancel).toHaveBeenCalledTimes(1); expect((vi.mocked(f.rpc.transact).mock.calls[0][0] as { timeoutMs: number }).timeoutMs).toBe(100);
    pending.resolve(f.unavailable(vi.mocked(f.rpc.transact).mock.calls[0][0])); expect((await result as { status: string }).status).toBe("unavailable");
  });
  it("an unresolved cancellation control keeps capacity sealed even after the original work ACK", async () => {
    const f = fixture(), partition = await f.activate(), pending = deferred<unknown>(), cancel = deferred<unknown>(), abort = new AbortController();
    vi.mocked(f.rpc.transact).mockReturnValueOnce(pending.promise); vi.mocked(f.rpc.cancel).mockReturnValueOnce(cancel.promise);
    const challenge = f.reading(partition), reading = f.transport.transact(challenge, abort.signal); await settle(); abort.abort(); await settle();
    pending.resolve(f.unavailable(vi.mocked(f.rpc.transact).mock.calls[0][0])); expect((await reading as { status: string }).status).toBe("unavailable");
    expect((await f.transport.transact(challenge, signal()) as { status: string }).status).toBe("unavailable"); expect(f.rpc.transact).toHaveBeenCalledTimes(1);
    const r = vi.mocked(f.rpc.cancel).mock.calls[0][0] as { requestId: string; targetRequestId: string }; cancel.resolve({ version: 1, requestId: r.requestId, status: "cancellation-requested", targetRequestId: r.targetRequestId }); await settle();
    expect((await f.transport.transact(challenge, signal()) as { status: string }).status).toBe("committed");
  });
  it("late-created activation is retired before another data operation can dispatch", async () => {
    const f = fixture(), pending = deferred<unknown>(), retirement = deferred<unknown>(), abort = new AbortController(); vi.mocked(f.rpc.activate).mockReturnValueOnce(pending.promise); vi.mocked(f.rpc.retire).mockReturnValueOnce(retirement.promise);
    const challenge = { ticket: 1, scope: scope() }, result = f.transport.activate(challenge, abort.signal); await settle(); abort.abort(); await settle();
    const request = vi.mocked(f.rpc.activate).mock.calls[0][0] as { requestId: string }; pending.resolve({ version: 1, requestId: request.requestId, status: "partitioned", ownerToken: f.ownerToken, leaseToken: "1".repeat(32), scope: challenge.scope, generation: 1, nonce: "2".repeat(32) });
    expect((await result as { status: string }).status).toBe("unavailable"); await settle(); expect(f.rpc.retire).toHaveBeenCalledTimes(1);
    expect((await f.transport.activate({ ticket: 2, scope: scope() }, signal()) as { status: string }).status).toBe("unavailable");
    const retiring = vi.mocked(f.rpc.retire).mock.calls[0][0] as Record<string, unknown>;
    // Exact valid native retirement response (timeout is a request field only).
    const { timeoutMs: _budget, ...binding } = retiring; retirement.resolve({ ...binding, status: "retired" }); await settle();
  });
  it("lost RPC acknowledgement seals capacity until one actual owner-closed ACK", async () => {
    const f = fixture(), partition = await f.activate(), close = deferred<unknown>(); vi.mocked(f.rpc.close).mockReturnValueOnce(close.promise); vi.mocked(f.rpc.transact).mockRejectedValueOnce(new Error("synthetic lost IPC acknowledgement"));
    const result = f.transport.transact(f.reading(partition), signal()); let settled = false; void result.then(() => { settled = true; }); await settle();
    expect(settled).toBe(false); expect(f.rpc.close).toHaveBeenCalledTimes(1); expect((await f.transport.transact(f.reading(partition), signal()) as { status: string }).status).toBe("unavailable");
    const request = vi.mocked(f.rpc.close).mock.calls[0][0] as { requestId: string }; close.resolve({ version: 1, requestId: request.requestId, status: "closed", ownerToken: f.ownerToken });
    expect((await result as { status: string }).status).toBe("unavailable"); await f.transport.close(); expect(f.rpc.close).toHaveBeenCalledTimes(1);
  });
  it("owned close can finish while an RPC reply is lost and its late result cannot publish", async () => {
    const f = fixture(), partition = await f.activate(), pending = deferred<unknown>(); vi.mocked(f.rpc.transact).mockReturnValueOnce(pending.promise);
    const reading = f.transport.transact(f.reading(partition), signal()); await settle(); await f.transport.close(); expect((await reading as { status: string }).status).toBe("unavailable"); expect(f.rpc.cancel).toHaveBeenCalledTimes(1);
    pending.resolve(f.unavailable(vi.mocked(f.rpc.transact).mock.calls[0][0])); await settle(); expect(f.rpc.close).toHaveBeenCalledTimes(1);
  });
  it("queued retirement revokes its lease immediately and has independent bounded capacity", async () => {
    const f = fixture(), partition = await f.activate(), pending = deferred<unknown>(); vi.mocked(f.rpc.transact).mockReturnValueOnce(pending.promise);
    const reading = f.transport.transact(f.reading(partition), signal()); await settle(); const challenge = { partition }, retiring = f.transport.retire(challenge, signal());
    expect((await f.transport.retire(challenge, signal()) as { status: string }).status).toBe("unavailable"); expect(f.rpc.retire).not.toHaveBeenCalled();
    pending.resolve(f.unavailable(vi.mocked(f.rpc.transact).mock.calls[0][0])); await reading; expect((await retiring as { status: string; challenge: unknown })).toEqual({ status: "retired", challenge }); expect(f.rpc.retire).toHaveBeenCalledTimes(1);
  });
  it("reentrant local clock cannot reserve a second native data job", async () => {
    const f = fixture(), partition = await f.activate(); let nested: Promise<unknown> | null = null, entered = false; const challenge = f.reading(partition);
    f.state.onClock = () => { if (!entered) { entered = true; nested = f.transport.transact(challenge, signal()); } };
    expect((await f.transport.transact(challenge, signal()) as { status: string }).status).toBe("committed"); expect(await nested).toEqual(expect.objectContaining({ status: "unavailable" })); expect(f.rpc.transact).toHaveBeenCalledTimes(1);
  });
  it("finite owner operation budget closes once without token reuse or automatic owner rotation", async () => {
    const f = fixture(), partition = await f.activate(), challenge = f.reading(partition);
    for (let i = 1; i < 2048; i++) expect((await f.transport.transact(challenge, signal()) as { status: string }).status).toBe("committed");
    expect((await f.transport.transact(challenge, signal()) as { status: string }).status).toBe("unavailable"); await settle(); expect(f.rpc.close).toHaveBeenCalledTimes(1);
    const ids = [f.rpc.activate, f.rpc.transact, f.rpc.cancel, f.rpc.retire, f.rpc.close].flatMap(method => vi.mocked(method).mock.calls.map(([r]) => (r as { requestId: string }).requestId));
    expect(new Set(ids).size).toBe(ids.length); expect(ids.length).toBe(2049); expect((await f.transport.activate({ ticket: 2, scope: scope() }, signal()) as { status: string }).status).toBe("unavailable");
  });
});
