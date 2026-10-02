import { describe, expect, it, vi } from "vitest";
import { createChildDurableData, createIndexedDbChildTransactionPort, type ChildDataTransaction,
  type ChildDataTransactionPort } from "./childDurableData";
import { childDataNamespace, type ChildDataScope } from "./childDataNamespace";
import type { ChildIndexPurpose, ChildScopedDataRequest } from "./childIndex";

const purposes: readonly ChildIndexPurpose[] = ["search", "history", "cache", "offline"];
const controlKey = "probpera-child-v1/active-context";
const checksum = "a".repeat(64);
const scope: ChildDataScope = Object.freeze({ schemaVersion: 1, namespace: "child", profileId: "synthetic-child-A",
  profileRevision: 1, exactAge: 8, locale: "ru", policyVersion: "synthetic-policy-v1", policyChecksum: "b".repeat(64),
  packageId: "synthetic-package", packageVersion: 1, packageChecksum: "c".repeat(64) });
const ref = (kind = "work", id = "synthetic-item") => ({ kind, id, contentChecksum: checksum });
const payload = { title: "Synthetic fixture", text: "Not approved child content", terms: [], references: [] };
const emptyValue = (selected: ChildDataScope) => ({ schemaVersion: 1, scope: selected, references: [] });
const dataValue = (purpose: ChildIndexPurpose, selected = scope) => purpose === "search"
  ? { schemaVersion: 1, scope: selected, references: [ref("search-result")] }
  : purpose === "history" ? { schemaVersion: 1, scope: selected, references: [ref("recent")] }
    : { schemaVersion: 1, scope: selected, entries: [{ reference: ref(purpose === "offline" ? "offline-package" : "work"), payload }] };
function request(purpose: ChildIndexPurpose, selected = scope, lease: object = Object.freeze({}), current = () => true): ChildScopedDataRequest {
  const base = childDataNamespace(selected, purpose)!;
  return { purpose, scope: selected, lease, key: purpose === "cache" || purpose === "offline"
    ? `${base}/item/${purpose === "offline" ? "offline-package" : "work"}/synthetic-item` : base, isCurrent: current };
}
function deferred() { let resolve!: () => void; const promise = new Promise<void>(done => { resolve = done; }); return { promise, resolve }; }

/** Explicit SYNTHETIC serializable transaction fixture, not fake-indexeddb and
 * not evidence of IndexedDB/browser durability, quota or crash behavior. */
class AtomicFixture implements ChildDataTransactionPort {
  readonly stores = new Map<ChildIndexPurpose, Map<string, unknown>>(purposes.map(purpose => [purpose, new Map()]));
  readonly accesses: { purpose: ChildIndexPurpose; key: string; write: boolean }[] = [];
  private tail: Promise<unknown> = Promise.resolve();
  closed = false;
  quotaNextWrite = false;
  corruptNextWrite = false;
  pauseNextWrite: { promise: Promise<void>; resolve(): void } | null = null;
  readonly writePauseEntered = deferred();
  afterCommit: (() => void) | null = null;
  beforeGet: (() => void) | null = null;
  transaction(work: (tx: ChildDataTransaction) => void, signal: AbortSignal, isCurrent: () => boolean): Promise<boolean> {
    const task = this.tail.then(async () => {
      let aborted = false, wrote = false;
      const cancel = () => { aborted = true; };
      const valid = () => !aborted && !this.closed && !signal.aborted && isCurrent() === true;
      signal.addEventListener("abort", cancel, { once: true });
      const copied = new Map([...this.stores].map(([purpose, entries]) => [purpose, new Map([...entries].map(([key, value]) => [key, structuredClone(value)]))]));
      const queue: (() => void)[] = [];
      const tx: ChildDataTransaction = {
        abort: cancel,
        get: (purpose, key, done) => { this.accesses.push({ purpose, key, write: false }); queue.push(() => {
          const hook = this.beforeGet; this.beforeGet = null; hook?.(); done(copied.get(purpose)!.get(key));
        }); },
        put: (purpose, key, value, done) => { this.accesses.push({ purpose, key, write: true }); queue.push(() => {
          if (this.quotaNextWrite) { this.quotaNextWrite = false; throw new Error("synthetic quota"); }
          wrote = true;const saved = structuredClone(value);
          if (this.corruptNextWrite) { this.corruptNextWrite = false;copied.get(purpose)!.set(key, { corrupted: true }); }
          else copied.get(purpose)!.set(key, saved);
          done();
        }); },
      };
      try {
        if (!valid()) return false;work(tx);
        while (queue.length && valid()) { await Promise.resolve(); if (valid()) queue.shift()!(); }
        if (wrote && this.pauseNextWrite) { const pause = this.pauseNextWrite; this.pauseNextWrite = null;this.writePauseEntered.resolve();await pause.promise; }
        if (!valid()) return false;
        this.stores.clear();for (const [purpose, entries] of copied) this.stores.set(purpose, entries);
        const hook = this.afterCommit; this.afterCommit = null;hook?.();
        return valid();
      } catch { return false; } finally { signal.removeEventListener("abort", cancel); }
    });
    this.tail = task.catch(() => {});return task;
  }
  close() { this.closed = true; }
}
function fixture(shared = new AtomicFixture()) {
  let time = 100, sequence = 0;
  const data = createChildDurableData({ backend: shared, timeoutMs: 1000, clock: { nowMs: () => time },
    nonce: () => (++sequence).toString(16).padStart(32, "0") });
  return { backend: shared, data, advance: (value: number) => { time = value; } };
}
const signal = () => new AbortController().signal;

describe("isolated child durable data (synthetic transactional boundary)", () => {
  it("stays sealed before explicit scope activation, without touching a store", async () => {
    const f = fixture();expect(await f.data.ports.history.read(request("history"), signal())).toBeNull();
    expect(f.backend.accesses).toEqual([]);expect(f.data.getSnapshot().phase).toBe("sealed");
  });
  it.each(purposes)("persists %s exact envelopes with transactional and post-complete readback", async purpose => {
    const f = fixture();expect(await f.data.activate(scope)).toBe(true);const req = request(purpose);
    expect(await f.data.ports[purpose].read(req, signal())).toEqual({ revision: 0, value: null });
    expect(await f.data.ports[purpose].compareAndSet(req, 0, dataValue(purpose), signal())).toBe(true);
    expect(await f.data.ports[purpose].read(req, signal())).toEqual({ revision: 1, value: dataValue(purpose) });
    expect(f.backend.accesses.filter(row => row.key !== controlKey).every(row => row.purpose === purpose)).toBe(true);
  });
  it("restores exact scope data in a new synthetic controller after close/restart", async () => {
    const f = fixture();await f.data.activate(scope);const req = request("history");
    expect(await f.data.ports.history.compareAndSet(req, 0, dataValue("history"), signal())).toBe(true);
    // Restart fixture uses the same durable records, with a fresh process nonce.
    const restart = createChildDurableData({ backend: f.backend, timeoutMs: 1000, clock: { nowMs: () => 200 }, nonce: () => "f".repeat(32) });
    expect(await restart.activate(scope)).toBe(true);
    expect(await restart.ports.history.read(request("history"), signal())).toEqual({ revision: 1, value: dataValue("history") });
    expect(await f.data.ports.history.read(req, signal())).toBeNull();
  });
  it.each([
    { profileId: "synthetic-child-B" }, { profileRevision: 2 }, { exactAge: 9 }, { locale: "en" },
    { policyVersion: "synthetic-policy-v2" }, { policyChecksum: "d".repeat(64) }, { packageId: "synthetic-other" },
    { packageVersion: 2 }, { packageChecksum: "e".repeat(64) },
  ] as const)("never inherits data after a full scope coordinate changes: %o", async delta => {
    const f = fixture();await f.data.activate(scope);const req = request("history");
    await f.data.ports.history.compareAndSet(req, 0, dataValue("history"), signal());
    const next = { ...scope, ...delta } as ChildDataScope;expect(await f.data.activate(next)).toBe(true);
    expect(await f.data.ports.history.read(request("history", next), signal())).toEqual({ revision: 0, value: null });
    expect(await f.data.ports.history.read(req, signal())).toBeNull();
  });
  it("lets exactly one concurrent CAS win one expected revision", async () => {
    const f = fixture();await f.data.activate(scope);const req = request("history");
    const results = await Promise.all([f.data.ports.history.compareAndSet(req, 0, dataValue("history"), signal()),
      f.data.ports.history.compareAndSet(req, 0, emptyValue(scope), signal())]);
    expect(results.filter(result => result === true)).toHaveLength(1);
    expect((await f.data.ports.history.read(req, signal()) as { revision: number }).revision).toBe(1);
  });
  it("history accepts only canonical recent references and denies incompatible stored kinds", async () => {
    const f = fixture();await f.data.activate(scope);const req = request("history"), before = f.backend.accesses.length;
    for (const kind of ["work", "search-result"])
      expect(await f.data.ports.history.compareAndSet(req, 0, { schemaVersion: 1, scope, references: [ref(kind)] }, signal())).toBe(false);
    expect(f.backend.accesses).toHaveLength(before);
    expect(await f.data.ports.history.compareAndSet(req, 0, dataValue("history"), signal())).toBe(true);
    const stored = f.backend.stores.get("history")!.get(req.key) as Record<string, unknown>;
    const incompatible = { ...stored, value: { schemaVersion: 1, scope, references: [ref("work")] } };
    f.backend.stores.get("history")!.set(req.key, incompatible);
    expect(await f.data.ports.history.read(req, signal())).toBeNull();
    expect(await f.data.ports.history.compareAndSet(req, 1, dataValue("history"), signal())).toBe(false);
    expect(f.backend.stores.get("history")!.get(req.key)).toEqual(incompatible);
  });
  it("rejects a purpose/key swap, path traversal, adult keys and unknown request fields", async () => {
    const f = fixture();await f.data.activate(scope);const req = request("history");
    for (const bad of [{ ...req, purpose: "search" }, { ...req, key: "adult/history" }, { ...req, key: req.key + "/../adult" }, { ...req, approval: true }])
      expect(await f.data.ports.history.read(bad as ChildScopedDataRequest, signal())).toBeNull();
    expect(f.backend.accesses.filter(row => row.key.includes("adult"))).toEqual([]);
  });
  it("requires the same bound opaque index lease within one activation", async () => {
    const f = fixture();await f.data.activate(scope);const first = request("history");
    expect(await f.data.ports.history.read(first, signal())).toEqual({ revision: 0, value: null });
    expect(await f.data.ports.history.read(request("history"), signal())).toBeNull();
  });
  it("denies malformed/throwing current callbacks rather than accepting truthy state", async () => {
    const f = fixture();await f.data.activate(scope);
    expect(await f.data.ports.history.read(request("history", scope, {}, () => "yes" as unknown as boolean), signal())).toBeNull();
    expect(await f.data.ports.history.read(request("history", scope, {}, () => { throw new Error("synthetic"); }), signal())).toBeNull();
  });
  it("rejects invalid scopes and never repairs corrupt durable control metadata", async () => {
    const f = fixture();expect(await f.data.activate({ ...scope, namespace: "adult" })).toBe(false);
    f.backend.stores.get("search")!.set(controlKey, { parentApproved: true });
    expect(await f.data.activate(scope)).toBe(false);expect(f.backend.stores.get("search")!.get(controlKey)).toEqual({ parentApproved: true });
  });
  it("refuses corrupt stored slots and does not overwrite them as empty revision0", async () => {
    const f = fixture();await f.data.activate(scope);const req = request("history");
    f.backend.stores.get("history")!.set(req.key, { revision: 0, value: null });
    expect(await f.data.ports.history.read(req, signal())).toBeNull();
    expect(await f.data.ports.history.compareAndSet(req, 0, dataValue("history"), signal())).toBe(false);
    expect(f.backend.stores.get("history")!.get(req.key)).toEqual({ revision: 0, value: null });
  });
  it("rejects envelope scope mismatch, sparse references, getters and malformed payloads", async () => {
    const f = fixture();await f.data.activate(scope);const req = request("history"), getter = vi.fn();
    const accessor = { schemaVersion: 1, scope, get references() { getter();return []; } };
    const sparse = Array(1);
    for (const bad of [{ ...dataValue("history"), scope: { ...scope, locale: "en" } }, { schemaVersion: 1, scope, references: sparse }, accessor,
      { schemaVersion: 1, scope, references: [{ ...ref("recent"), id: "../adult" }] }])
      expect(await f.data.ports.history.compareAndSet(req, 0, bad, signal())).toBe(false);
    expect(getter).not.toHaveBeenCalled();
  });
  it("bounds reference inventories before store access", async () => {
    const f = fixture();await f.data.activate(scope);const req = request("history");
    const before = f.backend.accesses.length;
    expect(await f.data.ports.history.compareAndSet(req, 0, { schemaVersion: 1, scope, references: Array(4097).fill(ref("recent")) }, signal())).toBe(false);
    expect(f.backend.accesses).toHaveLength(before);
  });
  it("bounds the complete cache envelope by the existing package byte limit", async () => {
    const f = fixture();await f.data.activate(scope);const req = request("cache"), before = f.backend.accesses.length;
    const entries = Array.from({ length: 260 }, (_, index) => ({ reference: ref("work", index === 0 ? "synthetic-item" : `synthetic-${index}`),
      payload: { ...payload, text: "x".repeat(32768) } }));
    expect(await f.data.ports.cache.compareAndSet(req, 0, { schemaVersion: 1, scope, entries }, signal())).toBe(false);
    expect(f.backend.accesses).toHaveLength(before);
  });
  it("rejects malformed and overflow revisions without a write", async () => {
    const f = fixture();await f.data.activate(scope);const req = request("history");
    for (const bad of [-1, NaN, 0.5, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER - 1])
      expect(await f.data.ports.history.compareAndSet(req, bad, dataValue("history"), signal())).toBe(false);
    expect(f.backend.stores.get("history")!.size).toBe(0);
  });
  it("cache/offline roots and their exact checksum relationships must form a complete stored closure", async () => {
    const f = fixture();await f.data.activate(scope);const lease = Object.freeze({}), req = request("cache", scope, lease);
    const entry = { reference: ref(), payload: { ...payload, references: [ref("work", "missing-child")] } };
    expect(await f.data.ports.cache.compareAndSet(req, 0, { schemaVersion: 1, scope, entries: [entry] }, signal())).toBe(false);
    expect(await f.data.ports.cache.compareAndSet(req, 0, { schemaVersion: 1, scope, entries: [{ reference: ref("work", "wrong-root"), payload }] }, signal())).toBe(false);
    expect(await f.data.ports.offline.read({ ...request("offline", scope, lease), key: childDataNamespace(scope, "offline") + "/item/work/synthetic-item" }, signal())).toBeNull();
  });
  it("quota failure and corrupt within-transaction readback roll back all data", async () => {
    const f = fixture();await f.data.activate(scope);const req = request("history");
    f.backend.quotaNextWrite = true;expect(await f.data.ports.history.compareAndSet(req, 0, dataValue("history"), signal())).toBe(false);
    f.backend.corruptNextWrite = true;expect(await f.data.ports.history.compareAndSet(req, 0, dataValue("history"), signal())).toBe(false);
    expect(await f.data.ports.history.read(req, signal())).toEqual({ revision: 0, value: null });
  });
  it("post-commit readback discrepancy denies success without fabricating rollback", async () => {
    const f = fixture();await f.data.activate(scope);const req = request("history");
    f.backend.afterCommit = () => { f.backend.stores.get("history")!.set(req.key, { corruptedAfterCommit: true }); };
    expect(await f.data.ports.history.compareAndSet(req, 0, dataValue("history"), signal())).toBe(false);
    expect(f.backend.stores.get("history")!.get(req.key)).toEqual({ corruptedAfterCommit: true });
  });
  it("abort before commit rolls back an already queued CAS", async () => {
    const f = fixture();await f.data.activate(scope);const req = request("history"), abort = new AbortController(), pause = deferred();
    f.backend.pauseNextWrite = pause;const pending = f.data.ports.history.compareAndSet(req, 0, dataValue("history"), abort.signal);
    await f.backend.writePauseEntered.promise;abort.abort();pause.resolve();
    expect(await pending).toBe(false);expect(await f.data.ports.history.read(req, signal())).toEqual({ revision: 0, value: null });
  });
  it("A→B→A fences an old pending write even when the final exact scope is identical", async () => {
    const f = fixture();await f.data.activate(scope);const old = request("history"), pause = deferred();
    f.backend.pauseNextWrite = pause;const pending = f.data.ports.history.compareAndSet(old, 0, dataValue("history"), signal());
    await f.backend.writePauseEntered.promise;const b = f.data.activate({ ...scope, profileId: "synthetic-child-B" });pause.resolve();
    expect(await pending).toBe(false);expect(await b).toBe(true);expect(await f.data.activate(scope)).toBe(true);
    expect(await f.data.ports.history.read(request("history"), signal())).toEqual({ revision: 0, value: null });
    expect(await f.data.ports.history.read(old, signal())).toBeNull();
  });
  it("snapshots mutable value bytes before the asynchronous transaction", async () => {
    const f = fixture();await f.data.activate(scope);const req = request("history"), pause = deferred();
    const original = { schemaVersion: 1, scope: { ...scope }, references: [ref("recent")] };
    f.backend.pauseNextWrite = pause;const pending = f.data.ports.history.compareAndSet(req, 0, original, signal());
    await f.backend.writePauseEntered.promise;original.references[0].id = "mutated-after-copy";pause.resolve();
    expect(await pending).toBe(true);expect(await f.data.ports.history.read(req, signal())).toEqual({ revision: 1, value: dataValue("history") });
  });
  it("a queued transaction cannot renew its original operation deadline", async () => {
    const f = fixture();await f.data.activate(scope);const req = request("history"), pause = deferred();
    f.backend.pauseNextWrite = pause;const pending = f.data.ports.history.compareAndSet(req, 0, dataValue("history"), signal());
    await f.backend.writePauseEntered.promise;f.advance(1100);pause.resolve();
    expect(await pending).toBe(false);expect(f.backend.stores.get("history")!.size).toBe(0);
  });
  it("mutable original request/scope cannot change a transaction's exact coordinates", async () => {
    const f = fixture();await f.data.activate(scope);const selected = { ...scope }, req = request("history", selected);
    f.backend.beforeGet = () => { selected.locale = "en"; };
    expect(await f.data.ports.history.compareAndSet(req, 0, dataValue("history"), signal())).toBe(false);
    expect(f.backend.stores.get("history")!.size).toBe(0);
  });
  it("background retirement clears the durable active marker and seals all four ports", async () => {
    const f = fixture();await f.data.activate(scope);const lease = Object.freeze({});
    expect(await f.data.background()).toBe(true);expect(f.data.getSnapshot().phase).toBe("sealed");
    for (const purpose of purposes) expect(await f.data.ports[purpose].read(request(purpose, scope, lease), signal())).toBeNull();
    expect((f.backend.stores.get("search")!.get(controlKey) as { scope: unknown }).scope).toBeNull();
  });
  it("retiring an old controller cannot clear a newer controller's durable context", async () => {
    const f = fixture();await f.data.activate(scope);
    const next = createChildDurableData({ backend: f.backend, timeoutMs: 1000, clock: { nowMs: () => 200 }, nonce: () => "f".repeat(32) });
    const nextScope = { ...scope, locale: "en" } as const;expect(await next.activate(nextScope)).toBe(true);
    expect(await f.data.retire()).toBe(true);expect(await next.ports.history.read(request("history", nextScope), signal())).toEqual({ revision: 0, value: null });
  });
  it("reentrant isCurrent retirement cannot publish or commit old data", async () => {
    const f = fixture();await f.data.activate(scope);let retirement: Promise<boolean> | null = null;
    const req = request("history", scope, {}, () => { retirement = f.data.retire();return true; });
    expect(await f.data.ports.history.compareAndSet(req, 0, dataValue("history"), signal())).toBe(false);
    await retirement;expect(f.data.getSnapshot().phase).toBe("sealed");
  });
  it("exclusive deadline reached by a callback denies the write even before timer dispatch", async () => {
    const f = fixture();await f.data.activate(scope);let checked = 0;
    const req = request("history", scope, {}, () => { if (++checked > 3) f.advance(1100);return true; });
    expect(await f.data.ports.history.compareAndSet(req, 0, dataValue("history"), signal())).toBe(false);
    expect(f.backend.stores.get("history")!.size).toBe(0);
  });
  it("clock rollback permanently seals this controller", async () => {
    const f = fixture();await f.data.activate(scope);f.advance(99);
    expect(await f.data.ports.history.read(request("history"), signal())).toBeNull();
    expect(await f.data.activate(scope)).toBe(false);expect(f.data.getSnapshot().phase).toBe("sealed");
  });
  it("duplicate or malformed nonce never creates a new active context", async () => {
    const backend = new AtomicFixture();const data = createChildDurableData({ backend, timeoutMs: 1000,
      clock: { nowMs: () => 100 }, nonce: () => "f".repeat(32) });
    expect(await data.activate(scope)).toBe(true);expect(await data.activate(scope)).toBe(false);
    expect(data.getSnapshot().phase).toBe("sealed");
  });
  it("bounds the nonce journal without forgetting/reusing old context identities", async () => {
    const f = fixture();for (let index = 0; index < 4096; index++) expect(await f.data.activate(scope)).toBe(true);
    const before = f.backend.accesses.length;
    expect(await f.data.activate(scope)).toBe(false);expect(f.data.getSnapshot().phase).toBe("sealed");
    expect(f.backend.accesses).toHaveLength(before);
    expect(await f.data.ports.history.read(request("history"), signal())).toBeNull();
  });
  it("dispose revokes current work and cannot reopen data ports", async () => {
    const f = fixture();await f.data.activate(scope);expect(await f.data.dispose()).toBe(true);
    expect(f.data.getSnapshot().phase).toBe("disposed");expect(await f.data.activate(scope)).toBe(false);
    expect(await f.data.ports.history.read(request("history"), signal())).toBeNull();
  });
  it("missing IndexedDB capability has no Preferences, adult or in-memory fallback", () => {
    expect(createIndexedDbChildTransactionPort(null)).toBeNull();
  });
});
