import { describe, expect, it, vi } from "vitest";
import type { ChildNativeAppSnapshot, ChildNativeContext } from "./childNativeAppBridge";
import type { ChildEntityPayload, ChildEntityReference } from "./childPackage";
import { createChildReadingSession, type ChildReadingHost } from "./childReadingSession";
import type { ChildNativeReadingPosition } from "./childReadingPosition";
// Controlled presentation-only DTOs; these provide no native admission or storage.
const hash = "a".repeat(64), reference = { kind: "activity" as const, id: "Chapter-A", contentChecksum: hash };
const payload: ChildEntityPayload = { title: "Original", text: "HelloWorld", terms: [], references: [], readingAnchors: {
  schemaVersion: 1, anchorVersion: 3, segments: [{ anchorId: "Opening", text: "Hello" }, { anchorId: "End", text: "World" }], narration: null } };
function nativeContext(): ChildNativeContext { return Object.freeze({ token: "a".repeat(32), generation: 1, revision: 2,
  selectionRevision: 2, profileRevision: 2, policyVersion: "child-local-v2.1", policyChecksum: hash, mode: "child",
  profileId: "Reader-A", locale: "en", remainingLifetimeMs: 50000,
  package: { id: "package", version: 1, checksum: hash }, home: reference }); }
function fixture() {
  const context = nativeContext();
  let native: ChildNativeAppSnapshot = { phase: "ready", status: "child", reason: null, context, profiles: [] };
  const subscribers = new Set<() => void>();
  const reading = { readReadingPosition: vi.fn(async (): Promise<ChildNativeReadingPosition | null> => ({ profileId: "Reader-A", revision: 0, position: null })),
    rememberReadingPosition: vi.fn(async (_ref: ChildEntityReference, revision: number, record: Parameters<NonNullable<ChildReadingHost["reading"]>["rememberReadingPosition"]>[2]): Promise<ChildNativeReadingPosition | null> =>
      ({ profileId: "Reader-A", revision: revision + 1, position: record })) };
  const controller: ChildReadingHost = { reading, getSnapshot: () => native, subscribe: listener => {
    subscribers.add(listener); return () => { subscribers.delete(listener); }; } };
  const session = createChildReadingSession({ controller, reference, payload, contextToken: context.token, language: "en" });
  return { context, reading, controller, session, subscribers,
    replace(next: ChildNativeAppSnapshot) { native = next; for (const listener of subscribers) listener(); },
    current: () => native };
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
describe("S16 BIL009 current-context reading session", () => {
  it("performs no RPC before activation and reads authentic absence without writing or granting completion", async () => {
    const f = fixture(); expect(f.reading.readReadingPosition).not.toHaveBeenCalled(); expect(await f.session.remember("Opening")).toBe(false);
    expect(await f.session.activate()).toBe(true); expect(f.session.getSnapshot()).toMatchObject({ phase: "ready", saved: { revision: 0, position: null } });
    expect(f.reading.readReadingPosition).toHaveBeenCalledOnce(); expect(f.reading.rememberReadingPosition).not.toHaveBeenCalled(); f.session.dispose();
  });
  it("writes only an explicit known anchor and paints only exact native revision-incremented ACK", async () => {
    const f = fixture(); await f.session.activate(); expect(await f.session.remember("Unmapped")).toBe(false);
    const pending = deferred<ChildNativeReadingPosition | null>(); f.reading.rememberReadingPosition.mockImplementation(() => pending.promise);
    const saving = f.session.remember("End"); expect(f.session.getSnapshot()).toMatchObject({ saving: true, saved: { revision: 0, position: null } });
    const record = { schemaVersion: 1 as const, entity: { kind: reference.kind, id: reference.id }, anchorVersion: 3, anchorId: "End" };
    expect(f.reading.rememberReadingPosition).toHaveBeenCalledWith(reference, 0, record);
    pending.resolve({ profileId: "Reader-A", revision: 1, position: record }); expect(await saving).toBe(true);
    expect(f.session.getSnapshot()).toMatchObject({ saving: false, saved: { revision: 1, position: record } }); f.session.dispose();
  });
  it("preserves the original unknown anchor without automatic remap overwrite or retry", async () => {
    const f = fixture(), retained = { schemaVersion: 1 as const, entity: { kind: reference.kind, id: reference.id }, anchorVersion: 2, anchorId: "Old-anchor" };
    f.reading.readReadingPosition.mockResolvedValue({ profileId: "Reader-A", revision: 9, position: retained });
    await f.session.activate(); expect(f.session.getSnapshot().saved?.position).toEqual(retained);
    expect(await f.session.remember("Opening")).toBe(false); expect(f.session.getSnapshot().saved?.position).toEqual(retained);
    expect(f.reading.rememberReadingPosition).not.toHaveBeenCalled(); expect(f.reading.readReadingPosition).toHaveBeenCalledOnce(); f.session.dispose();
  });
  it("refuses same-revision sibling mismatched-anchor and null ACK without optimistic replacement", async () => {
    for (const type of ["stale", "sibling", "anchor", "null"]) {
      const f = fixture(); await f.session.activate();
      f.reading.rememberReadingPosition.mockImplementation(async (_ref, revision, position) => type === "null" ? null : ({
        profileId: type === "sibling" ? "Sibling" : "Reader-A", revision: type === "stale" ? revision : revision + 1,
        position: type === "anchor" ? { ...position, anchorId: "End" } : position }));
      expect(await f.session.remember("Opening")).toBe(false); expect(f.session.getSnapshot()).toMatchObject({
        phase: "ready", failure: "save", saved: { revision: 0, position: null } });
      expect(f.reading.rememberReadingPosition).toHaveBeenCalledOnce(); f.session.dispose();
    }
  });
  it("ignores a late read after locale generation package or selected owner changes even if the token is reused", async () => {
    for (const change of [{ locale: "ru" as const }, { generation: 2 }, { package: { id: "other", version: 1, checksum: hash } }, { profileId: "Sibling" }]) {
      const f = fixture(), pending = deferred<ChildNativeReadingPosition | null>(); f.reading.readReadingPosition.mockImplementation(() => pending.promise);
      const reading = f.session.activate(); f.replace({ ...f.current(), context: { ...f.context, ...change } });
      expect(f.session.getSnapshot()).toMatchObject({ phase: "sealed", saved: null });
      expect(f.session.isCurrentContext()).toBe(false);
      pending.resolve({ profileId: "Reader-A", revision: 0, position: null }); expect(await reading).toBe(false);
      expect(f.session.getSnapshot().saved).toBeNull(); expect(f.reading.rememberReadingPosition).not.toHaveBeenCalled(); f.session.dispose();
    }
  });
  it("ignores a late save after synchronous lifecycle sealing with no replay", async () => {
    const f = fixture(); await f.session.activate(); const pending = deferred<ChildNativeReadingPosition | null>();
    f.reading.rememberReadingPosition.mockImplementation(() => pending.promise); const saving = f.session.remember("Opening");
    const record = f.reading.rememberReadingPosition.mock.calls[0][2]; f.replace({ ...f.current(), phase: "sealed", status: "unavailable", context: null });
    expect(f.session.getSnapshot()).toMatchObject({ phase: "sealed", saved: null, saving: false });
    pending.resolve({ profileId: "Reader-A", revision: 1, position: record }); expect(await saving).toBe(false);
    expect(f.session.getSnapshot().phase).toBe("sealed"); expect(f.reading.rememberReadingPosition).toHaveBeenCalledOnce(); f.session.dispose();
  });
  it("rejects inactive expired adult package-absent and mismatched-locale contexts before dispatch", async () => {
    for (const change of [{ generation: 2 }, { remainingLifetimeMs: 0 }, { mode: "adult" as const }, { package: null }, { locale: "ru" as const }]) {
      const f = fixture(); expect(f.session.isCurrentContext()).toBe(true);
      f.replace({ ...f.current(), context: { ...f.context, ...change } }); expect(f.session.isCurrentContext()).toBe(false);
      expect(await f.session.activate()).toBe(false); expect(f.reading.readReadingPosition).not.toHaveBeenCalled(); f.session.dispose();
    }
    const f = fixture(); f.replace({ ...f.current(), phase: "transition" }); expect(await f.session.activate()).toBe(false);
    expect(f.reading.readReadingPosition).not.toHaveBeenCalled(); f.session.dispose();
  });
  it("refuses a duplicate save and refresh during an outstanding explicit write", async () => {
    const f = fixture(); await f.session.activate(); const pending = deferred<ChildNativeReadingPosition | null>();
    f.reading.rememberReadingPosition.mockImplementation(() => pending.promise); const saving = f.session.remember("Opening");
    expect(await f.session.remember("End")).toBe(false); expect(await f.session.refresh()).toBe(false);
    expect(f.reading.rememberReadingPosition).toHaveBeenCalledOnce(); expect(f.reading.readReadingPosition).toHaveBeenCalledOnce();
    pending.resolve(null); expect(await saving).toBe(false); expect(f.session.getSnapshot().failure).toBe("save"); f.session.dispose();
  });
  it("supports effect cleanup and fresh reactivation while ignoring the first late reply", async () => {
    const f = fixture(), old = deferred<ChildNativeReadingPosition | null>();
    f.reading.readReadingPosition.mockImplementationOnce(() => old.promise); const first = f.session.activate();
    f.session.deactivate(); expect(f.subscribers.size).toBe(0); expect(await f.session.activate()).toBe(true);
    old.resolve({ profileId: "Reader-A", revision: 10, position: null }); expect(await first).toBe(false);
    expect(f.session.getSnapshot().saved?.revision).toBe(0); expect(f.subscribers.size).toBe(1); f.session.dispose();
    expect(f.subscribers.size).toBe(0); expect(await f.session.activate()).toBe(false);
  });
  it("retains read/save failures honestly and retries only on an explicit refresh", async () => {
    const f = fixture(); f.reading.readReadingPosition.mockRejectedValueOnce(new Error("Native unavailable"));
    expect(await f.session.activate()).toBe(false); expect(f.session.getSnapshot()).toMatchObject({ phase: "unavailable", failure: "read" });
    expect(f.reading.readReadingPosition).toHaveBeenCalledOnce(); expect(await f.session.refresh()).toBe(true);
    f.reading.rememberReadingPosition.mockRejectedValueOnce(new Error("No durable ACK"));
    expect(await f.session.remember("End")).toBe(false); expect(f.session.getSnapshot()).toMatchObject({ failure: "save", saved: { revision: 0, position: null } });
    expect(f.reading.rememberReadingPosition).toHaveBeenCalledOnce(); f.session.dispose();
  });
  it("keeps legacy plain text and an absent native reading port free of synthetic ledger calls", async () => {
    const f = fixture(), legacy = { title: payload.title, text: payload.text, terms: [], references: [] };
    for (const params of [{ controller: f.controller, payload: legacy }, { controller: { getSnapshot: f.controller.getSnapshot, subscribe: f.controller.subscribe }, payload }]) {
      const session = createChildReadingSession({ ...params, reference, contextToken: f.context.token, language: "en" });
      expect(await session.activate()).toBe(false); expect(await session.remember("Opening")).toBe(false); session.dispose();
    }
    expect(f.reading.readReadingPosition).not.toHaveBeenCalled(); expect(f.reading.rememberReadingPosition).not.toHaveBeenCalled();
  });
});
