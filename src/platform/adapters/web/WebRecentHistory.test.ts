import { webcrypto } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createWebRecentHistory } from "./WebRecentHistory";
import type { RecentHistoryScope, RecentTarget } from "../../../planet/RecentHistory";
import { installSafeWebStorage } from "../../../utils/safeWebStorage";

const scope = { issuer: "verified-issuer", audience: "web", product: "base", subject: "verified-subject-A" };
const writer = (index: number): RecentTarget => ({ kind: "writer", countryId: "russia", writerId: "writer-" + index });
function browserFixture() {
  const values = new Map<string, string>();
  const storage: Storage = { get length() { return values.size; }, key: index => [...values.keys()][index] ?? null,
    getItem: vi.fn(key => values.get(key) ?? null), setItem: vi.fn((key, value) => { values.set(key, value); }), removeItem: vi.fn(key => { values.delete(key); }), clear: vi.fn(() => values.clear()) };
  const browser = Object.assign(new EventTarget(), { localStorage: storage, sessionStorage: storage });
  const add = vi.spyOn(browser, "addEventListener"), remove = vi.spyOn(browser, "removeEventListener");
  const create = (identity: RecentHistoryScope = scope) => createWebRecentHistory(identity, { window: browser, subtle: webcrypto.subtle as SubtleCrypto, now: () => 1234 });
  return { values, storage, browser, add, remove, create };
}
afterEach(() => vi.restoreAllMocks());

describe("identity-scoped recent preference store", () => {
  it("does not read storage or attach listeners during construction and keeps snapshots immutable and stable", async () => {
    const env = browserFixture(), store = env.create();
    expect(env.storage.getItem).not.toHaveBeenCalled(); expect(env.add).not.toHaveBeenCalled();
    const initial = store.getSnapshot(); expect(store.getSnapshot()).toBe(initial); expect(Object.isFrozen(initial)).toBe(true);
    const listener = vi.fn(), first = store.subscribe(listener), second = store.subscribe(listener);
    await vi.waitFor(() => expect(store.getSnapshot().loaded).toBe(true));
    expect(env.add).toHaveBeenCalledOnce();
    first(); first(); expect(env.remove).not.toHaveBeenCalled();
    await store.record(writer(1));
    const snapshot = store.getSnapshot();
    expect(Object.isFrozen(snapshot.entries)).toBe(true); expect(Object.isFrozen(snapshot.entries[0])).toBe(true);
    expect(store.getSnapshot()).toBe(snapshot);
    second(); expect(env.remove).toHaveBeenCalledOnce();
  });
  it("retains at most 20 distinct canonical targets, treats work and writer separately, and deduplicates StrictMode replay", async () => {
    const env = browserFixture(), store = env.create();
    for (let index = 0; index < 25; index++) await store.record(writer(index));
    expect(store.getSnapshot().entries).toHaveLength(20);
    expect(store.getSnapshot().entries[0]).toMatchObject(writer(24));
    const before = store.getSnapshot(); await store.record(writer(24)); expect(store.getSnapshot()).toBe(before);
    await store.record({ kind: "work", countryId: "russia", writerId: "writer-24", workId: "canonical-work" });
    expect(store.getSnapshot().entries.slice(0, 2).map(entry => entry.kind)).toEqual(["work", "writer"]);
    const source = [...env.values.values()][0];
    expect(source).not.toMatch(/verified-subject|issuer|paid|title|biography|entitlement/u);
    expect([...env.values.keys()][0]).toMatch(/^literary-planet-recent-v1:[a-f0-9]{64}$/u);
  });
  it.each(["subject", "issuer", "audience", "product"] as const)("isolates %s and restores only the original verified scope", async field => {
    const env = browserFixture(), first = env.create(); await first.record(writer(1));
    const changed = env.create({ ...scope, [field]: "different-value" }); await changed.record(writer(2));
    expect(changed.getSnapshot().entries).toHaveLength(1);
    const restored = env.create(); const stop = restored.subscribe(() => undefined);
    await vi.waitFor(() => expect(restored.getSnapshot().loaded).toBe(true));
    expect(restored.getSnapshot().entries).toEqual(first.getSnapshot().entries); stop();
    await changed.clear(); expect(env.values.size).toBe(2);
    expect([...env.values.values()].filter(value => JSON.parse(value).entries.length > 0)).toHaveLength(1);
  });
  it("serializes pending initialization, record and clear without resurrecting existing history", async () => {
    const env = browserFixture(); await env.create().record(writer(1));
    let release!: (value: ArrayBuffer) => void;
    const hash = await webcrypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify([scope.issuer, scope.audience, scope.product, scope.subject])));
    const subtle = { digest: vi.fn(() => new Promise<ArrayBuffer>(resolve => { release = resolve; })) } as unknown as SubtleCrypto;
    const pending = createWebRecentHistory(scope, { window: env.browser, subtle, now: () => 2345 });
    const add = pending.record(writer(2)), clear = pending.clear(); release(hash); await Promise.all([add, clear]);
    expect(pending.getSnapshot().entries).toEqual([]);
    expect([...env.values.values()].map(value => JSON.parse(value).entries)).toEqual([[]]);
    expect([...env.values.values()][0]).not.toContain("writer-");
  });
  it("uses current storage before mutation so a cross-tab clear wins over a delayed storage event", async () => {
    const env = browserFixture(), first = env.create(), second = env.create();
    await first.record(writer(1)); await second.record(writer(2)); await first.clear();
    await second.record(writer(3));
    expect(second.getSnapshot().entries).toEqual([{ ...writer(3), openedAt: 1234 }]);
  });
  it("observes cross-tab changes and rereads after a StrictMode unsubscribe/resubscribe gap", async () => {
    const env = browserFixture(), first = env.create(), second = env.create();
    const stop = first.subscribe(() => undefined); await first.record(writer(1)); await second.clear();
    env.browser.dispatchEvent(Object.assign(new Event("storage"), { key: null }));
    await vi.waitFor(() => expect(first.getSnapshot().entries).toEqual([])); stop();
    await second.record(writer(2)); const stopAgain = first.subscribe(() => undefined);
    await vi.waitFor(() => expect(first.getSnapshot().entries[0]).toMatchObject(writer(2))); stopAgain();
    expect(env.add).toHaveBeenCalledTimes(2); expect(env.remove).toHaveBeenCalledTimes(2);
  });
  it("keeps a usable bounded current-page history with unavailable crypto/storage", async () => {
    const store = createWebRecentHistory(scope, { window: null, subtle: null, now: () => 1234 });
    await store.record(writer(1)); await store.record(writer(2));
    expect(store.getSnapshot().entries).toHaveLength(2); await store.clear(); expect(store.getSnapshot().entries).toEqual([]);
    const env = browserFixture(); vi.mocked(env.storage.setItem).mockImplementation(() => { throw new Error("Quota"); });
    const blocked = env.create(); await blocked.record(writer(1)); await blocked.record(writer(2));
    expect(blocked.getSnapshot().entries).toHaveLength(2);
  });
  it("preserves same-page entries when the actual safe-storage compatibility patch swallows quota errors", async () => {
    let denied = false;
    class TestStorage implements Storage {
      values = new Map<string, string>(); get length() { return this.values.size; }
      key(index: number) { return [...this.values.keys()][index] ?? null; }
      getItem(key: string) { return this.values.get(key) ?? null; }
      setItem(key: string, value: string) { if (denied) throw new DOMException("Quota", "QuotaExceededError"); this.values.set(key, value); }
      removeItem(key: string) { this.values.delete(key); } clear() { this.values.clear(); }
    }
    const host = Object.assign(new EventTarget(), { localStorage: new TestStorage(), sessionStorage: new TestStorage() });
    installSafeWebStorage(host, TestStorage.prototype);
    const store = createWebRecentHistory(scope, { window: host, subtle: webcrypto.subtle as SubtleCrypto, now: () => 1234 });
    await store.record(writer(1)); denied = true; await store.record(writer(2)); await store.record(writer(3));
    expect(store.getSnapshot().entries.map(entry => entry.writerId)).toEqual(["writer-3", "writer-2", "writer-1"]);
    await store.clear(); expect(store.getSnapshot().entries).toEqual([]);
    expect(host.localStorage.length).toBe(0);
  });
  it.each([false, true])("an older pending visit cannot outlive another instance's clear (separate host=%s)", async separateHost => {
    const env = browserFixture(), first = env.create(); await first.record(writer(1));
    let release!: (value: ArrayBuffer) => void;
    const hash = await webcrypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify([scope.issuer, scope.audience, scope.product, scope.subject])));
    const host = separateHost ? Object.assign(new EventTarget(), { localStorage: env.storage, sessionStorage: env.storage }) : env.browser;
    const pending = createWebRecentHistory(scope, { window: host, subtle: { digest: () => new Promise<ArrayBuffer>(resolve => { release = resolve; }) } as unknown as SubtleCrypto, now: () => 1234 });
    const visit = pending.record(writer(2)); await first.clear(); release(hash); await visit;
    expect(pending.getSnapshot().entries).toEqual([]);
    expect([...env.values.values()][0]).not.toContain("writer-");
    await pending.record(writer(3)); expect(pending.getSnapshot().entries).toEqual([{ ...writer(3), openedAt: 1234 }]);
  });
  it.each([1000, 20000])("accepts post-clear visits from an independent tab module with wall clock %s", async wallClock => {
    const env = browserFixture();
    vi.resetModules(); const { createWebRecentHistory: createFirstTab } = await import("./WebRecentHistory");
    vi.resetModules(); const { createWebRecentHistory: createSecondTab } = await import("./WebRecentHistory");
    const first = createFirstTab(scope, { window: env.browser, subtle: webcrypto.subtle as SubtleCrypto, now: () => 20000 });
    const host = Object.assign(new EventTarget(), { localStorage: env.storage, sessionStorage: env.storage });
    const second = createSecondTab(scope, { window: host, subtle: webcrypto.subtle as SubtleCrypto, now: () => wallClock });
    await first.record(writer(1)); await first.clear(); await second.record(writer(2));
    expect(second.getSnapshot().entries).toEqual([{ ...writer(2), openedAt: wallClock }]);
    await second.clear(); await first.record(writer(3));
    expect(first.getSnapshot().entries).toEqual([{ ...writer(3), openedAt: 20000 }]);
  });
  it("cancels a pending visit in an independent module without comparing its clock to the clearer", async () => {
    const env = browserFixture(); await env.create().record(writer(1));
    vi.resetModules(); const { createWebRecentHistory: createOtherTab } = await import("./WebRecentHistory");
    let release!: (value: ArrayBuffer) => void;
    const digest = await webcrypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify([scope.issuer, scope.audience, scope.product, scope.subject])));
    const host = Object.assign(new EventTarget(), { localStorage: env.storage, sessionStorage: env.storage });
    const pending = createOtherTab(scope, { window: host, subtle: { digest: () => new Promise<ArrayBuffer>(resolve => { release = resolve; }) } as unknown as SubtleCrypto, now: () => 999999 });
    const visit = pending.record(writer(2)); await env.create().clear(); release(digest); await visit;
    expect(pending.getSnapshot().entries).toEqual([]);
    await pending.record(writer(3)); expect(pending.getSnapshot().entries).toEqual([{ ...writer(3), openedAt: 999999 }]);
  });
  it.each(["x", "x".repeat(55), "x".repeat(56), "x".repeat(63), "x".repeat(64), "x".repeat(65), "x".repeat(128), "x".repeat(1024), "😀я".repeat(300)])("matches the established WebCrypto namespace for UTF-8 scope length %s", async subject => {
    const env = browserFixture(), identity = { ...scope, subject }, store = env.create(identity);
    await store.record(writer(1));
    const digest = await webcrypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify([identity.issuer, identity.audience, identity.product, identity.subject])));
    const expected = "literary-planet-recent-v1:" + [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, "0")).join("");
    expect([...env.values.keys()]).toEqual([expected]); expect(JSON.parse(env.values.get(expected)!).entries).toHaveLength(1);
  });
  it("rejects unknown stored fields, prototype keys and private flags without treating them as history", async () => {
    const env = browserFixture(), first = env.create(); await first.record(writer(1));
    const key = [...env.values.keys()][0];
    env.values.set(key, JSON.stringify({ v: 1, entries: [{ ...writer(1), openedAt: 1234, title: "untrusted" }, { kind: "writer", countryId: "russia", writerId: "constructor", openedAt: 1234 }], paid: true }));
    const restored = env.create(); const stop = restored.subscribe(() => undefined);
    await vi.waitFor(() => expect(restored.getSnapshot().loaded).toBe(true)); expect(restored.getSnapshot().entries).toEqual([]);
    await restored.record({ ...writer(1), paid: true } as unknown as RecentTarget); expect(restored.getSnapshot().entries).toEqual([]); stop();
  });
});
