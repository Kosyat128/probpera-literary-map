import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createChildNativeAppController, decodeChildNativeAppReply, childNativePresentationServices,
  CHILD_NATIVE_LOCAL_POLICY_CHECKSUM, CHILD_NATIVE_LOCAL_POLICY_VERSION,
  type ChildNativeAppController, type ChildNativeAppPlugin, type ChildNativeContext } from "./childNativeAppBridge";
import type { ChildEntityReference } from "./childPackage";
import { childNativeAppearanceFromScene } from "./childNativeAppearance";
import { decodeChildNativeScene } from "./childNativeScene";
import type { PlatformServices, PlatformSnapshot } from "../platform/ports";

// AUTHORED_NOT_RUN. Synthetic correlated native DTOs exercise presentation
// lifecycle/wire refusal only; none supplies native PIN, storage or rights proof.
const HASH = "a".repeat(64), TOKEN = "b".repeat(32), REQUEST = "c".repeat(32);
const controllers: ChildNativeAppController[] = [];
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
async function settle() { for (let i = 0; i < 32; i++) await Promise.resolve(); }
function ref(kind: ChildEntityReference["kind"] = "activity", id = "home"): ChildEntityReference { return { kind, id, contentChecksum: HASH }; }
function nativeContext(generation = 1, mode: "adult" | "child" = "child", admitted = true, lifetime = 50_000): ChildNativeContext {
  return { token: generation === 1 ? TOKEN : generation.toString(16).padStart(32, "0"), generation, revision: generation + 1,
    selectionRevision: generation + 1, profileRevision: generation + 1, policyVersion: CHILD_NATIVE_LOCAL_POLICY_VERSION,
    policyChecksum: CHILD_NATIVE_LOCAL_POLICY_CHECKSUM, mode, profileId: "native-profile", locale: "en",
    package: mode === "child" && admitted ? { id: "native-package", version: 1, checksum: HASH } : null,
    home: mode === "child" && admitted ? ref() : null, remainingLifetimeMs: lifetime };
}
function appReply(input: unknown, current: ChildNativeContext | null = nativeContext(), status = current?.mode ?? "first-install-required", reason: string | null = null) {
  const r = input as { requestId: string };
  return { version: 2, requestId: r.requestId, status, reason, context: current,
    profiles: current ? [{ id: "native-profile", label: "Native saved profile", exactAge: 9, locale: "en" }] : [] };
}
function entity(reference = ref()) { return { reference, payload: { title: "Synthetic approved-row shape", text: "Fixture bytes only.", terms: [], references: [] } }; }
function fixture() {
  let next = 0, snapshot: PlatformSnapshot = Object.freeze({ connectivity: "online", visibility: "active" });
  let native = nativeContext(), event: ((raw: unknown) => void) | null = null;
  const lifecycleListeners = new Set<() => void>(), order: string[] = [], remove = vi.fn(async () => undefined);
  const lifecycle = { getSnapshot: () => snapshot, subscribe: (listener: () => void) => { lifecycleListeners.add(listener); return () => { lifecycleListeners.delete(listener); }; } };
  const dataReply = (input: unknown, value: unknown) => { const r = input as { requestId: string; contextToken: string }; return { version: 2, requestId: r.requestId, status: "ok", contextToken: r.contextToken, generation: native.generation, value }; };
  const plugin = {
    bootstrap: vi.fn(async (r: unknown): Promise<unknown> => { order.push("bootstrap"); return appReply(r, native); }),
    readContext: vi.fn(async (r: unknown): Promise<unknown> => appReply(r, native)),
    perform: vi.fn(async (r: unknown): Promise<unknown> => { order.push("perform"); native = nativeContext(native.generation + 1, "adult"); return appReply(r, native); }),
    retire: vi.fn(async (r: unknown): Promise<unknown> => { order.push("retire"); const q = r as { requestId: string; contextToken: string | null }; return { version: 2, requestId: q.requestId, status: "retired", contextToken: q.contextToken }; }),
    readEntity: vi.fn(async (r: unknown): Promise<unknown> => dataReply(r, entity((r as { reference: ChildEntityReference }).reference))),
    search: vi.fn(async (r: unknown): Promise<unknown> => dataReply(r, [])),
    readCollection: vi.fn(async (r: unknown): Promise<unknown> => dataReply(r, { revision: 0, references: [] })),
    writeCollection: vi.fn(async (r: unknown): Promise<unknown> => { const q = r as { expectedRevision: number; references: ChildEntityReference[] }; return dataReply(r, { revision: q.expectedRevision + 1, references: q.references }); }),
    addListener: vi.fn(async (_name: "invalidated", listener: (value: unknown) => void): Promise<{ remove(): Promise<void> }> => { order.push("listener"); event = listener; return { remove }; }),
  } satisfies ChildNativeAppPlugin;
  const controller = createChildNativeAppController({ plugin, lifecycle, nowMs: () => Date.now(), timeoutMs: 1_000, requestId: () => (++next).toString(16).padStart(32, "0") });
  controllers.push(controller);
  const clear = vi.fn(() => { order.push("clear"); });
  controller.attachPresentationBarrier(clear);
  return { controller, plugin, lifecycle, order, clear, remove, dataReply,
    setNative(value: ChildNativeContext) { native = value; },
    event(raw: unknown) { if (!event) throw new Error("Native listener was not registered"); event(raw); },
    visibility(value: "active" | "background") { snapshot = Object.freeze({ ...snapshot, visibility: value }); for (const listener of lifecycleListeners) listener(); } };
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); });
afterEach(async () => { for (const controller of controllers.splice(0)) await controller.dispose(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe("LOCAL2 native app DTO projection", () => {
  it("sends only exact route identity and current passport revision and requires a correlated durable route receipt", async () => {
    const f = fixture(), route = { journeyId: "journey-a", journeyVersion: 1, contentVersion: 1, title: "Synthetic route", description: "Text only.", nodeCount: 2,
      snapshotChecksum: HASH, byteLength: 1024, media: { locale: "en", audioStatus: "text-only", audioItemCount: 0,
        imageItemCount: 0, transcriptByteLength: 0, mediaByteLength: 0 } };
    const saveJourneyRoute = vi.fn(async (r: unknown) => f.dataReply(r, { profileId: "native-profile", locale: "en", generation: 1, revision: 5, route }));
    Object.assign(f.plugin, { saveJourneyRoute }); await f.controller.start();
    expect(await f.controller.passport!.saveJourneyRoute!("journey-a", 4)).toMatchObject({ revision: 5, route: { snapshotChecksum: HASH } });
    expect(saveJourneyRoute.mock.calls[0][0]).toEqual({ version: 2, requestId: "2".padStart(32, "0"), contextToken: TOKEN, journeyId: "journey-a", expectedRevision: 4 });
    expect(await f.controller.passport!.saveJourneyRoute!("../journey-a", 4)).toBeNull(); expect(saveJourneyRoute).toHaveBeenCalledTimes(1);
  });
  it("seals an uncorrelated route save without replaying it or refreshing an uncertain commit", async () => {
    const f = fixture(), saveJourneyRoute = vi.fn(async (r: unknown) => ({ ...f.dataReply(r, {}), requestId: "e".repeat(32) }));
    Object.assign(f.plugin, { saveJourneyRoute }); await f.controller.start();
    expect(await f.controller.passport!.saveJourneyRoute!("journey-a", 4)).toBeNull(); expect(f.controller.getSnapshot().phase).toBe("sealed");
    const bootstraps = f.plugin.bootstrap.mock.calls.length; await f.controller.refresh();
    expect(saveJourneyRoute).toHaveBeenCalledTimes(1); expect(f.plugin.bootstrap).toHaveBeenCalledTimes(bootstraps);
  });
  it("sends download removal only through the original parent action and an existing exact profile target", async () => {
    const f = fixture(); await f.controller.start();
    expect(await f.controller.perform("delete-child-data", { profileId: "native-profile", scope: "downloads" })).toBe(true);
    expect(f.plugin.perform.mock.calls[0][0]).toMatchObject({ action: "delete-child-data", target: { profileId: "native-profile", scope: "downloads" } });
  });
  it("rejects V1, caller clock/authority fields and noncorrelated replies without invoking accessors", () => {
    const good = appReply({ requestId: REQUEST });
    expect(decodeChildNativeAppReply(good, REQUEST)?.status).toBe("child");
    for (const bad of [{ ...good, version: 1 }, { ...good, requestId: TOKEN }, { ...good, verified: true },
      { ...good, trustedWall: 1 }, { ...good, context: { ...good.context, trustedBootEpoch: "js" } },
      { ...good, context: { ...good.context, remainingLifetimeMs: 60_001 } },
      { ...good, context: { ...good.context, policyChecksum: "b".repeat(64) } }]) expect(decodeChildNativeAppReply(bad, REQUEST)).toBeNull();
    const getter = vi.fn(() => good.context), accessor = { ...good };
    Object.defineProperty(accessor, "context", { enumerable: true, get: getter });
    expect(decodeChildNativeAppReply(accessor, REQUEST)).toBeNull(); expect(getter).not.toHaveBeenCalled();
  });
  it("keeps blocked child distinct from adult, unavailable and admitted child", () => {
    const blocked = appReply({ requestId: REQUEST }, nativeContext(1, "child", false), "blocked-child", "missing-pins");
    expect(decodeChildNativeAppReply(blocked, REQUEST)).toMatchObject({ status: "blocked-child", context: { mode: "child", package: null, home: null } });
    for (const bad of [{ ...blocked, status: "child" }, { ...blocked, status: "adult" }, { ...blocked, status: "unavailable" },
      { ...blocked, profiles: [] }, { ...blocked, profiles: [...blocked.profiles, ...blocked.profiles] },
      { ...blocked, context: { ...blocked.context, package: { id: "forged", version: 1, checksum: HASH } } }]) expect(decodeChildNativeAppReply(bad, REQUEST)).toBeNull();
    expect(decodeChildNativeAppReply(appReply({ requestId: REQUEST }, null), REQUEST)?.status).toBe("first-install-required");
  });
});

describe("LOCAL2 native owner presentation lifecycle", () => {
  it("requires a concrete presentation barrier and registers native invalidation before bootstrap", async () => {
    const f = fixture(); expect(f.plugin.bootstrap).not.toHaveBeenCalled(); expect(f.controller.getSnapshot().context).toBeNull();
    await f.controller.start(); expect(f.order.indexOf("listener")).toBeLessThan(f.order.indexOf("bootstrap"));
    expect(f.order.indexOf("clear")).toBeLessThan(f.order.indexOf("bootstrap"));
    expect(f.plugin.bootstrap.mock.calls[0][0]).toEqual({ version: 2, requestId: "1".padStart(32, "0") });
    const noHost = createChildNativeAppController({ plugin: f.plugin, lifecycle: f.lifecycle, requestId: () => REQUEST }); controllers.push(noHost);
    await noHost.start(); expect(f.plugin.bootstrap).toHaveBeenCalledTimes(1); expect(noHost.getSnapshot().context).toBeNull();
  });
  it("missing native invalidation registration keeps the first screen sealed", async () => {
    const f = fixture(); f.plugin.addListener.mockRejectedValueOnce(new Error("Native lifecycle unavailable"));
    await f.controller.start(); expect(f.controller.getSnapshot().context).toBeNull(); expect(f.plugin.bootstrap).not.toHaveBeenCalled();
  });
  it("stalled native event registration is bounded and a late handle is actually removed", async () => {
    const f = fixture(), held = deferred<{ remove(): Promise<void> }>(), remove = vi.fn(async () => undefined);
    f.plugin.addListener.mockReturnValueOnce(held.promise); const start = f.controller.start(); await settle();
    await vi.advanceTimersByTimeAsync(1_000); await start; expect(f.controller.getSnapshot().context).toBeNull(); expect(f.plugin.bootstrap).not.toHaveBeenCalled();
    held.resolve({ remove }); await settle(); expect(remove).toHaveBeenCalledOnce(); expect(f.plugin.bootstrap).not.toHaveBeenCalled();
  });
  it("first install is an explicit native action with no JS PIN, grant or retirement acknowledgement", async () => {
    const f = fixture(); f.plugin.bootstrap.mockImplementation(async r => appReply(r, null));
    // An unenrolled native root has no saved child profile summaries.
    f.plugin.perform.mockImplementation(async r => ({ ...appReply(r, { ...nativeContext(1, "adult"), profileId: null }, "unenrolled"), profiles: [] }));
    await f.controller.start(); expect(await f.controller.perform("enroll-pin")).toBe(false); expect(f.plugin.perform).not.toHaveBeenCalled();
    expect(await f.controller.perform("first-install", { locale: "en" })).toBe(false);
    expect(f.plugin.perform).not.toHaveBeenCalled();
    expect(await f.controller.perform("first-install")).toBe(true);
    expect(f.plugin.perform.mock.calls[0][0]).toEqual({ version: 2, requestId: "2".padStart(32, "0"), contextToken: null, action: "first-install", target: null });
    expect(f.controller.getSnapshot().status).toBe("unenrolled"); expect(f.plugin.retire).not.toHaveBeenCalled();
  });
  it("blocked child keeps only correlated parent actions and cannot request private data", async () => {
    const f = fixture(); f.plugin.bootstrap.mockImplementation(async r => appReply(r, nativeContext(1, "child", false), "blocked-child", "missing-pins"));
    await f.controller.start(); expect(await f.controller.readEntity(ref())).toBeNull(); expect(await f.controller.search("test")).toBeNull(); expect(await f.controller.readCollection("favorites")).toBeNull();
    expect(f.plugin.readEntity).not.toHaveBeenCalled(); expect(f.plugin.search).not.toHaveBeenCalled();
    expect(await f.controller.perform("exit-child-mode")).toBe(true); expect(f.plugin.perform.mock.calls[0][0]).toMatchObject({ contextToken: TOKEN, action: "exit-child-mode", target: null });
    expect(f.controller.getSnapshot().status).toBe("adult");
  });
  it("seals synchronously and joins tracked old data deliveries before dispatching the native action", async () => {
    const f = fixture(); await f.controller.start(); const held = deferred<unknown>(); f.plugin.readEntity.mockReturnValueOnce(held.promise);
    const read = f.controller.readEntity(ref()); await settle(); const clearBefore = f.clear.mock.calls.length;
    const action = f.controller.perform("exit-child-mode"); expect(f.clear.mock.calls.length).toBe(clearBefore + 1); expect(f.controller.getSnapshot().phase).toBe("transition");
    await settle(); expect(f.plugin.perform).not.toHaveBeenCalled();
    held.resolve(f.dataReply(f.plugin.readEntity.mock.calls[0][0], entity())); expect(await read).toBeNull(); expect(await action).toBe(true);
    expect(f.plugin.retire).not.toHaveBeenCalled(); expect(f.order.indexOf("clear", f.order.indexOf("bootstrap") + 1)).toBeLessThan(f.order.indexOf("perform"));
  });
  it("copies bounded action proposals without getters or mutable caller arrays", async () => {
    const f = fixture(); await f.controller.start(); const target = { label: "Fixture", blockedTopics: ["fear"], exactAge: 9 };
    const action = f.controller.perform("create-profile", target); target.blockedTopics.push("war"); target.label = "Mutated"; await action;
    const request = f.plugin.perform.mock.calls[0][0] as { target: typeof target }; expect(request.target).toEqual({ label: "Fixture", blockedTopics: ["fear"], exactAge: 9 }); expect(Object.isFrozen(request.target.blockedTopics)).toBe(true);
    const calls = f.plugin.perform.mock.calls.length, getter = vi.fn(() => "secret"); const invalid = Object.defineProperty({}, "pin", { enumerable: true, get: getter });
    expect(await f.controller.perform("recover-pin", invalid)).toBe(false); expect(getter).not.toHaveBeenCalled(); expect(f.plugin.perform).toHaveBeenCalledTimes(calls);
    expect(await f.controller.perform("grant-without-pin" as never)).toBe(false);
  });
  it("idle background hides presentation immediately and awaits correlated native retirement", async () => {
    const f = fixture(); await f.controller.start(); const held = deferred<unknown>(); f.plugin.retire.mockReturnValueOnce(held.promise);
    f.visibility("background"); expect(f.controller.getSnapshot().context).toBeNull(); await settle();
    expect(f.plugin.retire.mock.calls[0][0]).toMatchObject({ contextToken: TOKEN }); expect(f.plugin.bootstrap).toHaveBeenCalledTimes(1);
    held.resolve({ version: 2, requestId: (f.plugin.retire.mock.calls[0][0] as { requestId: string }).requestId, status: "retired", contextToken: TOKEN }); await settle();
    f.visibility("active"); await settle(); expect(f.plugin.bootstrap).toHaveBeenCalledTimes(2);
  });
  it("a native owner UI pause seals JS while the original busy native action completes", async () => {
    const f = fixture(); await f.controller.start(); const held = deferred<unknown>(); f.plugin.perform.mockReturnValueOnce(held.promise);
    const action = f.controller.perform("recover-pin"); await settle(); f.visibility("background"); expect(f.controller.getSnapshot().context).toBeNull(); expect(f.plugin.retire).not.toHaveBeenCalled();
    const next = nativeContext(2, "adult"); held.resolve(appReply(f.plugin.perform.mock.calls[0][0], next)); expect(await action).toBe(false);
    expect(f.plugin.retire.mock.calls[0][0]).toMatchObject({ contextToken: next.token }); expect(f.plugin.bootstrap).toHaveBeenCalledTimes(1);
  });
  it("ignores stale native events and seals immediately for the exact active token/generation", async () => {
    const f = fixture(); await f.controller.start();
    f.event({ version: 2, contextToken: "d".repeat(32), generation: 1, reason: "expired" }); expect(f.controller.getSnapshot().status).toBe("child");
    f.event({ version: 2, contextToken: TOKEN, generation: 2, reason: "corrupt" }); expect(f.controller.getSnapshot().status).toBe("child");
    f.event({ version: 2, contextToken: TOKEN, generation: 1, reason: "pending" }); expect(f.controller.getSnapshot()).toMatchObject({ phase: "sealed", reason: "pending", context: null });
    await settle(); expect(f.plugin.retire.mock.calls[0][0]).toMatchObject({ contextToken: TOKEN });
  });
  it("serializes concrete native data calls and discards old replies after a seal", async () => {
    const f = fixture(); await f.controller.start(); const held = deferred<unknown>(); f.plugin.readEntity.mockReturnValueOnce(held.promise);
    const first = f.controller.readEntity(ref("work", "one")), second = f.controller.readEntity(ref("work", "two")); await settle(); expect(f.plugin.readEntity).toHaveBeenCalledTimes(1);
    held.resolve(f.dataReply(f.plugin.readEntity.mock.calls[0][0], entity(ref("work", "one")))); expect(await first).toEqual(entity(ref("work", "one"))); expect(await second).toEqual(entity(ref("work", "two"))); expect(f.plugin.readEntity).toHaveBeenCalledTimes(2);
    const late = deferred<unknown>(); f.plugin.readEntity.mockReturnValueOnce(late.promise); const read = f.controller.readEntity(ref()); await settle(); const suspend = f.controller.suspend();
    late.resolve(f.dataReply(f.plugin.readEntity.mock.calls[2][0], entity())); expect(await read).toBeNull(); await suspend; expect(f.controller.getSnapshot().context).toBeNull();
  });
  it("rejects wrong-token native data and makes actual retirement precede any later bootstrap", async () => {
    const f = fixture(); await f.controller.start(); f.plugin.readEntity.mockImplementation(async r => ({ ...f.dataReply(r, entity()), contextToken: "d".repeat(32) }));
    expect(await f.controller.readEntity(ref())).toBeNull(); expect(f.controller.getSnapshot().context).toBeNull(); expect(f.plugin.retire).toHaveBeenCalledTimes(1);
    await f.controller.refresh(); expect(f.order.lastIndexOf("retire")).toBeLessThan(f.order.lastIndexOf("bootstrap"));
  });
  it("does not reopen an unknown retirement acknowledgement", async () => {
    const f = fixture(); await f.controller.start(); f.plugin.retire.mockImplementation(async r => ({ version: 2, requestId: (r as { requestId: string }).requestId, status: "retired", contextToken: null }));
    await f.controller.refresh(); expect(f.controller.getSnapshot().context).toBeNull(); expect(f.plugin.bootstrap).toHaveBeenCalledTimes(1); await f.controller.refresh(); expect(f.plugin.bootstrap).toHaveBeenCalledTimes(1);
  });
  it("late timed-out bootstrap replies cannot reopen or start an unproven successor lane", async () => {
    const f = fixture(), held = deferred<unknown>(); f.plugin.bootstrap.mockReturnValueOnce(held.promise); const start = f.controller.start(); await settle(); await vi.advanceTimersByTimeAsync(1_000); await settle();
    expect(f.controller.getSnapshot().context).toBeNull(); expect(f.plugin.retire).toHaveBeenCalledTimes(1);
    held.resolve(appReply(f.plugin.bootstrap.mock.calls[0][0])); await start; await f.controller.refresh(); expect(f.controller.getSnapshot().context).toBeNull(); expect(f.plugin.bootstrap).toHaveBeenCalledTimes(1);
  });
  it("expiry creates a fresh native bootstrap only after retiring the original token", async () => {
    const f = fixture(); f.setNative(nativeContext(1, "child", true, 10)); await f.controller.start(); const held = deferred<unknown>(); f.plugin.retire.mockReturnValueOnce(held.promise);
    await vi.advanceTimersByTimeAsync(10); expect(f.controller.getSnapshot().context).toBeNull(); expect(f.plugin.bootstrap).toHaveBeenCalledTimes(1);
    const request = f.plugin.retire.mock.calls[0][0] as { requestId: string; contextToken: string }; f.setNative(nativeContext(2)); held.resolve({ version: 2, requestId: request.requestId, status: "retired", contextToken: TOKEN }); await settle();
    expect(f.plugin.bootstrap).toHaveBeenCalledTimes(2); expect(f.controller.getSnapshot().context?.generation).toBe(2);
    expect(Object.keys(f.plugin.bootstrap.mock.calls[1][0] as object).sort()).toEqual(["requestId", "version"]);
  });
  it("long native PIN UI retires the expired conservative successor before a fresh bootstrap", async () => {
    const f = fixture(), published: (string | null)[] = []; f.controller.subscribe(() => { published.push(f.controller.getSnapshot().context?.token ?? null); });
    await f.controller.start(); const held = deferred<unknown>(), retired = deferred<unknown>();
    f.plugin.perform.mockReturnValueOnce(held.promise); f.plugin.retire.mockReturnValueOnce(retired.promise);
    const action = f.controller.perform("recover-pin"); await settle(); expect(f.controller.getSnapshot().context).toBeNull();
    // The genuine native original deadline can still be live, while the JS
    // dispatch-origin projection is already too conservative to display it.
    await vi.advanceTimersByTimeAsync(600); const successor = nativeContext(2, "child", true, 200), fresh = nativeContext(3);
    f.setNative(fresh); held.resolve(appReply(f.plugin.perform.mock.calls[0][0], successor)); await settle();
    expect(f.controller.getSnapshot().context).toBeNull(); expect(published).not.toContain(successor.token); expect(f.plugin.bootstrap).toHaveBeenCalledTimes(1);
    const originalRetire = f.plugin.retire.mock.calls[0][0] as { version: number; requestId: string; contextToken: string };
    expect(originalRetire).toMatchObject({ version: 2, contextToken: successor.token });
    retired.resolve({ version: 2, requestId: originalRetire.requestId, status: "retired", contextToken: successor.token });
    expect(await action).toBe(false); await settle(); expect(f.plugin.bootstrap).toHaveBeenCalledTimes(2);
    expect(f.order.lastIndexOf("retire")).toBeLessThan(f.order.lastIndexOf("bootstrap")); expect(published).not.toContain(successor.token);
    expect(f.controller.getSnapshot().context?.token).toBe(fresh.token); expect(f.controller.getSnapshot().context?.generation).toBe(3);
    expect(Object.keys(f.plugin.bootstrap.mock.calls[1][0] as object).sort()).toEqual(["requestId", "version"]);
  });
  it("data wire admits text references and bounded wrapper collections, never media", async () => {
    const f = fixture(); await f.controller.start(); expect(await f.controller.readEntity(ref("image", "one"))).toBeNull(); expect(f.plugin.readEntity).not.toHaveBeenCalled();
    expect(await f.controller.writeCollection("favorites", 0, [ref("favorite", "one"), ref("favorite", "one")])).toBeNull();
    const tooMany = Array.from({ length: 65 }, (_, i) => ref("favorite", "f" + i)); expect(await f.controller.writeCollection("favorites", 0, tooMany)).toBeNull(); expect(f.plugin.writeCollection).not.toHaveBeenCalled();
    expect(await f.controller.writeCollection("favorites", 0, [ref("favorite", "one")])).toEqual({ revision: 1, references: [ref("favorite", "one")] });
    expect(f.plugin.writeCollection.mock.calls[0][0]).toMatchObject({ version: 2, contextToken: TOKEN, expectedRevision: 0, references: [ref("favorite", "one")] });
  });
  it("accepts 100 actual recent wrappers and seals search replies above 64", async () => {
    const f = fixture(); await f.controller.start(); const recent = Array.from({ length: 100 }, (_, i) => ref("recent", "r" + i));
    f.plugin.readCollection.mockImplementation(async r => f.dataReply(r, { revision: 7, references: recent })); expect(await f.controller.readCollection("recent")).toEqual({ revision: 7, references: recent });
    f.plugin.search.mockImplementation(async r => f.dataReply(r, Array.from({ length: 65 }, (_, i) => entity(ref("search-result", "r" + i))))); expect(await f.controller.search("fixture")).toBeNull(); expect(f.controller.getSnapshot().context).toBeNull();
  });
  it("child platform projection keeps only read-only Booky size and lifecycle ports", async () => {
    const preferences = { persistence: "durable" as const, get: vi.fn(async () => "large"), set: vi.fn(async () => true), remove: vi.fn(async () => true) };
    const snapshot: PlatformSnapshot = { connectivity: "offline", visibility: "active" };
    const adult = { kind: "ios", channel: "appStore", preferences, getSnapshot: () => snapshot, subscribe: () => () => undefined, getSystemLanguages: () => ["en"], openExternalLink: vi.fn(() => "opened"), secureStorage: {}, recentHistory: {}, downloads: {}, navigation: {} } as unknown as PlatformServices;
    const child = childNativePresentationServices(adult); expect(child.secureStorage).toBeUndefined(); expect(child.recentHistory).toBeUndefined(); expect(child.downloads).toBeUndefined(); expect(child.navigation).toBeUndefined();
    expect(await child.preferences.get("adult-history")).toBeNull(); expect(await child.preferences.get("probpera-booky-size-v1")).toBe("large"); expect(await child.preferences.set("probpera-booky-size-v1", "compact")).toBe(false);
    expect(await child.preferences.remove("adult-history")).toBe(false); expect(child.openExternalLink("https://example.invalid")).toBe("blocked"); expect(adult.openExternalLink).not.toHaveBeenCalled(); expect(preferences.set).not.toHaveBeenCalled();
  });
});

describe("canonical native scene dispatch and joined original recipients",()=>{
 it("seals real recipient immediately and awaits its actual cleanup before the next native action",async()=>{
  const f=fixture();await f.controller.start();const cleanup=deferred<void>();
  const clear=vi.fn(()=>f.order.push("renderer-clear")),join=vi.fn(()=>cleanup.promise);
  f.controller.scenes!.attachRecipient({clear,join});
  const action=f.controller.perform("exit-child-mode");expect(clear).toHaveBeenCalledOnce();await settle();
  expect(join).toHaveBeenCalledOnce();expect(f.plugin.perform).not.toHaveBeenCalled();
  cleanup.resolve();expect(await action).toBe(true);expect(f.plugin.perform).toHaveBeenCalledOnce();
 });
 it("does not accept an unknown decoder/GPU join as retirement acknowledgement",async()=>{
  const f=fixture();await f.controller.start();
  f.controller.scenes!.attachRecipient({clear:vi.fn(),join:async()=>{throw Error("GPU completion unknown");}});
  expect(await f.controller.perform("exit-child-mode")).toBe(false);
  expect(f.plugin.perform).not.toHaveBeenCalled();expect(f.controller.getSnapshot().context).toBeNull();
 });
 it("uses the native exact owner proposal and rejects scene metadata carrying public authority fields",async()=>{
  const f=fixture();await f.controller.start();
  const list=vi.fn(async(r:unknown)=>f.dataReply(r,[{sceneId:"fixture",title:"Fixture",owner:ref(),approved:true}]));
  Object.assign(f.plugin,{listScenes:list});
  expect(await f.controller.scenes!.list(ref())).toBeNull();expect(list.mock.calls[0][0]).toMatchObject({version:2,contextToken:TOKEN,owner:ref()});
  expect(f.controller.getSnapshot().context).toBeNull();
 });
});

describe("media revocation retires a canonical recipient in the same context",()=>{
 it("clears and joins the canonical renderer before dispatching native media release",async()=>{
  const f=fixture();await f.controller.start();const cleanup=deferred<void>();
  const clear=vi.fn(),join=vi.fn(()=>cleanup.promise);
  f.controller.scenes!.attachRecipient({clear,join});
  const release=vi.fn(async(r:unknown)=>f.dataReply(r,{status:"retired",presentationToken:(r as {presentationToken:string}).presentationToken}));
  Object.assign(f.plugin,{releaseMedia:release});
  const result=f.controller.media!.release("d".repeat(32));
  expect(clear).toHaveBeenCalledOnce();await settle();expect(release).not.toHaveBeenCalled();
  cleanup.resolve();expect(await result).toBe(true);expect(release).toHaveBeenCalledOnce();
 });
});

describe("native protected appearance data commands (synthetic wire only)",()=>{
 const slot=(kind:"skin"|"stand"|"background")=>({slotId:kind,assetId:kind,entity:ref(kind,kind),mime:"image/png",checksum:HASH,encodedBytes:16,altText:kind});
 const scene=()=>decodeChildNativeScene({status:"opened",sceneToken:"d".repeat(32),sceneId:"choice",owner:ref(),skin:slot("skin"),
  stand:{geometryId:"stand.base.child-book-cloud",asset:slot("stand")},background:{geometryId:"background.base.library",asset:slot("background")},hotspots:[],remainingLifetimeMs:5000},ref(),"choice")!;
 it("reads an exact profile-bound stable choice and sends only native scene token/revision to remember",async()=>{
  const f=fixture(),plugin=f.plugin as ChildNativeAppPlugin,selection=childNativeAppearanceFromScene(scene())!;
  plugin.readSceneSelection=vi.fn(async r=>f.dataReply(r,{profileId:"native-profile",revision:1,selection}));
  plugin.rememberSceneSelection=vi.fn(async r=>f.dataReply(r,{profileId:"native-profile",revision:2,selection}));
  await f.controller.start();const saved=await f.controller.scenes!.readSelection();expect(saved?.revision).toBe(1);
  expect(await f.controller.scenes!.remember(scene(),1)).toMatchObject({revision:2,selection});
  const request=(plugin.rememberSceneSelection as ReturnType<typeof vi.fn>).mock.calls[0][0];
  expect(Object.keys(request).sort()).toEqual(["version","requestId","contextToken","sceneToken","expectedRevision"].sort());
 });
 it("refuses a caller-correlated response for another native profile and seals before publishing",async()=>{
  const f=fixture(),plugin=f.plugin as ChildNativeAppPlugin;
  plugin.readSceneSelection=vi.fn(async r=>f.dataReply(r,{profileId:"other",revision:0,selection:null}));
  await f.controller.start();expect(await f.controller.scenes!.readSelection()).toBeNull();
  expect(f.controller.getSnapshot().phase).toBe("sealed");expect(f.clear).toHaveBeenCalled();
 });
 it("correlates restore with original saved revision/triad and a new native scene",async()=>{
  const f=fixture(),plugin=f.plugin as ChildNativeAppPlugin,selection=childNativeAppearanceFromScene(scene())!;
  const saved={profileId:"native-profile",revision:2,selection};
  plugin.restoreSceneSelection=vi.fn(async r=>f.dataReply(r,{status:"restored",...saved,scene:scene()}));
  plugin.releaseScene=vi.fn(async r=>f.dataReply(r,{status:"retired",sceneToken:(r as {sceneToken:string|null}).sceneToken}));
  await f.controller.start();expect(await f.controller.scenes!.restore(saved)).toMatchObject({status:"restored",revision:2});
  await f.controller.scenes!.releaseAll();expect(plugin.releaseScene).toHaveBeenCalled();
 });
 it("latches an uncertain native save and blocks same-host refresh or lifecycle retry",async()=>{
  const f=fixture(),plugin=f.plugin as ChildNativeAppPlugin,selection=childNativeAppearanceFromScene(scene())!;
  plugin.rememberSceneSelection=vi.fn(async r=>f.dataReply(r,{profileId:"native-profile",revision:9,selection}));
  await f.controller.start();expect(await f.controller.scenes!.remember(scene(),1)).toBeNull();
  const bootstrapCalls=f.plugin.bootstrap.mock.calls.length;
  await f.controller.refresh();f.visibility("background");f.visibility("active");await settle();
  expect(f.controller.getSnapshot().phase).toBe("sealed");expect(f.plugin.bootstrap).toHaveBeenCalledTimes(bootstrapCalls);
  expect(await f.controller.scenes!.remember(scene(),1)).toBeNull();expect(plugin.rememberSceneSelection).toHaveBeenCalledOnce();
 });
 it("late protected selection reads cannot survive lifecycle retirement",async()=>{
  const f=fixture(),plugin=f.plugin as ChildNativeAppPlugin,late=deferred<unknown>();
  plugin.readSceneSelection=vi.fn(()=>late.promise);await f.controller.start();
  const pending=f.controller.scenes!.readSelection();await settle();f.visibility("background");
  late.resolve(f.dataReply((plugin.readSceneSelection as ReturnType<typeof vi.fn>).mock.calls[0][0],{profileId:"native-profile",revision:0,selection:null}));
  expect(await pending).toBeNull();expect(f.controller.getSnapshot().phase).toBe("sealed");
 });
});

/** New synthetic protocol/lifecycle cases. No fixture supplies native storage
 * admission or current release approval. */
function journeyFixture(){
  const f=fixture(),plugin=f.plugin as ChildNativeAppPlugin;
  const progress={schemaVersion:1,journeyId:"journey",journeyVersion:1,contentVersion:1,currentNodeId:"country",completedNodeIds:[] as string[],
    selectedCountryId:"country",selectedWriterId:null,selectedWorkId:null,lastSafeRoute:"journey"};
  const info={journeyId:"journey",journeyVersion:1,contentVersion:1,title:"Synthetic journey",description:"Protocol only.",nodeCount:2};
  const value=(revision=1)=>({status:"opened",profileId:"native-profile",revision,progress:{...progress},journey:{...info,nodeIds:["country","writer"]},node:entity(ref("country","country"))});
  const list=vi.fn(async(r:unknown)=>f.dataReply(r,[info])),read=vi.fn(async(r:unknown)=>f.dataReply(r,{profileId:"native-profile",revision:0,progress:null}));
  const open=vi.fn(async(r:unknown)=>f.dataReply(r,value())),advance=vi.fn(async(r:unknown)=>f.dataReply(r,{...value(2),progress:{...progress,currentNodeId:"writer",completedNodeIds:["country"]},node:entity(ref("writer","writer"))}));
  const close=vi.fn(async(r:unknown)=>f.dataReply(r,{status:"retired"}));Object.assign(plugin,{listJourneys:list,readJourneyProgress:read,openJourney:open,advanceJourney:advance,closeJourney:close});
  return {...f,list,read,open,advance,close,value};
}
describe("native child journey authority and protected semantic continuation",()=>{
  it("uses dedicated child native methods and sends canonical intent only",async()=>{
    const f=journeyFixture();await f.controller.start();expect((await f.controller.journeys!.list())?.[0].journeyId).toBe("journey");
    expect(await f.controller.journeys!.readProgress()).toMatchObject({profileId:"native-profile",revision:0,progress:null});
    expect(await f.controller.journeys!.open("journey",0)).toMatchObject({progress:{currentNodeId:"country"}});
    expect(f.open.mock.calls[0][0]).toMatchObject({contextToken:TOKEN,journeyId:"journey",expectedRevision:0});
    expect(Object.keys(f.open.mock.calls[0][0] as object).sort()).toEqual(["contextToken","expectedRevision","journeyId","requestId","version"]);
    expect(await f.controller.journeys!.advance(1,"journey","country","complete")).toMatchObject({revision:2,progress:{currentNodeId:"writer",completedNodeIds:["country"]}});
    expect(f.plugin.perform).not.toHaveBeenCalled();expect(await f.controller.journeys!.close()).toBe(true);
  });
  it("adult or blocked child mode cannot dispatch any journey authority",async()=>{
    for(const native of [nativeContext(1,"adult"),nativeContext(1,"child",false)]){
      const f=journeyFixture();f.setNative(native);f.plugin.bootstrap.mockImplementation(async r=>appReply(r,native,native.mode==="adult"?"adult":"blocked-child","missing-pins"));await f.controller.start();
      expect(await f.controller.journeys!.list()).toBeNull();expect(await f.controller.journeys!.open("journey",0)).toBeNull();expect(f.list).not.toHaveBeenCalled();expect(f.open).not.toHaveBeenCalled();
    }
  });
  it("rejects caller URLs malformed nodes unsafe revisions and empty completion before dispatch",async()=>{
    const f=journeyFixture();await f.controller.start();
    expect(await f.controller.journeys!.open("https://adult.example",0)).toBeNull();expect(await f.controller.journeys!.open("journey",Number.MAX_SAFE_INTEGER)).toBeNull();
    expect(await f.controller.journeys!.advance(1,"journey",null,"complete")).toBeNull();expect(await f.controller.journeys!.advance(1,"journey","../node","restart")).toBeNull();expect(f.open).not.toHaveBeenCalled();expect(f.advance).not.toHaveBeenCalled();
  });
  it("a mismatched profile or readback after dispatched open seals the host without replay",async()=>{
    const f=journeyFixture();await f.controller.start();f.open.mockImplementation(async r=>f.dataReply(r,{...f.value(),profileId:"another-profile"}));
    expect(await f.controller.journeys!.open("journey",0)).toBeNull();expect(f.controller.getSnapshot().phase).toBe("sealed");
    await f.controller.refresh();expect(f.plugin.bootstrap).toHaveBeenCalledOnce();expect(f.open).toHaveBeenCalledOnce();
  });
  it("background retirement joins an already dispatched journey save and prevents retired node publication",async()=>{
    const f=journeyFixture(),held=deferred<ReturnType<typeof f.dataReply>>();await f.controller.start();f.open.mockReturnValueOnce(held.promise);
    const pending=f.controller.journeys!.open("journey",0);await settle();const request=f.open.mock.calls[0][0];f.visibility("background");expect(f.clear).toHaveBeenCalled();expect(f.controller.getSnapshot().context).toBeNull();
    held.resolve(f.dataReply(request,f.value()));expect(await pending).toBeNull();await settle();f.visibility("active");await settle();expect(f.plugin.bootstrap).toHaveBeenCalledOnce();expect(f.open).toHaveBeenCalledOnce();
  });
  it("fresh native context after a known read preserves semantic progress but returns fresh locale text",async()=>{
    const f=journeyFixture();await f.controller.start();expect(await f.controller.journeys!.open("journey",0)).not.toBeNull();
    f.setNative({...nativeContext(2),locale:"ru"});await f.controller.refresh();
    f.read.mockImplementation(async r=>f.dataReply(r,{profileId:"native-profile",revision:1,progress:f.value().progress}));
    f.open.mockImplementation(async r=>f.dataReply(r,{...f.value(),status:"restored",node:{...entity(ref("country","country")),payload:{title:"Свежая страна",text:"Новый DTO.",terms:[],references:[]}}}));
    expect(await f.controller.journeys!.readProgress()).toMatchObject({revision:1});expect(await f.controller.journeys!.open("journey",1)).toMatchObject({node:{payload:{title:"Свежая страна"}}});
    expect((f.open.mock.calls[1][0] as {contextToken:string}).contextToken).not.toBe(TOKEN);expect(f.advance).not.toHaveBeenCalled();
  });
});
// New whole Discovery/Passport stage: AUTHORED_NOT_RUN.
describe("native child discovery/passport original controller integration", () => {
  const identity = () => ({ profileId: "native-profile", locale: "en", generation: 1 });
  const emptyPassport = () => ({ schemaVersion: 1, ...identity(), revision: 0, countries: [], writers: [], works: [], journeys: [],
    unresolvedCompletedNodeIds: [], badges: { status: "unavailable", items: [] }, downloadedRoutes: { status: "unavailable", items: [] } });
  it("discovery/Home/passport reads do not create an open or study credit; exact explicit country command does", async () => {
    const f = fixture(), country = ref("country", "country-a");
    const methods = Object.assign(f.plugin, {
      listDiscovery: vi.fn(async (r: unknown) => f.dataReply(r, { ...identity(), shelf: (r as { shelf: string }).shelf, items: [] })),
      readPassport: vi.fn(async (r: unknown) => f.dataReply(r, emptyPassport())),
      recordCountryOpen: vi.fn(async (r: unknown) => f.dataReply(r, { ...identity(), revision: 1, country: entity((r as { reference: ChildEntityReference }).reference) })),
    });
    await f.controller.start();
    expect(await f.controller.discovery!.list("writers")).toMatchObject({ shelf: "writers", items: [] });
    expect(await f.controller.passport!.read()).toMatchObject({ revision: 0, writers: [] });
    await f.controller.readEntity(country); await f.controller.readCollection("recent");
    expect(methods.recordCountryOpen).not.toHaveBeenCalled(); expect(f.plugin.writeCollection).not.toHaveBeenCalled();
    expect(await f.controller.passport!.recordCountryOpen(country)).toMatchObject({ revision: 1, country: { reference: country } });
    expect(methods.recordCountryOpen).toHaveBeenCalledTimes(1);
    expect(await f.controller.passport!.recordCountryOpen(ref("writer", "writer-a"))).toBeNull();
    expect(methods.recordCountryOpen).toHaveBeenCalledTimes(1);
  });
  it("retires late native shelf replies after a profile/lifecycle seal", async () => {
    const f = fixture(), held = deferred<unknown>(); let original: unknown;
    const methods = Object.assign(f.plugin, { listDiscovery: vi.fn((r: unknown) => { original = r; return held.promise; }) });
    await f.controller.start(); const reading = f.controller.discovery!.list("writers"); await settle();
    expect(methods.listDiscovery).toHaveBeenCalledTimes(1); f.visibility("background");
    held.resolve(f.dataReply(original, { ...identity(), shelf: "writers", items: [entity(ref("writer", "retired-writer"))] }));
    expect(await reading).toBeNull(); expect(f.controller.getSnapshot().context).toBeNull();
  });
  it("rejects inner locale/profile correlation even when the outer native reply matches", async () => {
    const f = fixture(); Object.assign(f.plugin, { readPassport: vi.fn(async (r: unknown) => f.dataReply(r, { ...emptyPassport(), locale: "ru" })) });
    await f.controller.start(); expect(await f.controller.passport!.read()).toBeNull(); expect(f.controller.getSnapshot().phase).toBe("sealed");
  });
  it("an uncorrelated country-write reply seals without replay or optimistic passport credit", async () => {
    const f = fixture(); const methods = Object.assign(f.plugin, {
      recordCountryOpen: vi.fn(async (r: unknown) => ({ ...(f.dataReply(r, { ...identity(), revision: 1, country: entity(ref("country", "country-a")) })), requestId: "e".repeat(32) })),
    });
    await f.controller.start(); expect(await f.controller.passport!.recordCountryOpen(ref("country", "country-a"))).toBeNull();
    const bootstraps = f.plugin.bootstrap.mock.calls.length; await f.controller.refresh(); f.visibility("background"); f.visibility("active"); await settle();
    expect(methods.recordCountryOpen).toHaveBeenCalledTimes(1); expect(f.plugin.bootstrap).toHaveBeenCalledTimes(bootstraps);
    expect(f.controller.getSnapshot().context).toBeNull();
  });
  it("binds original delete-child-data to one existing profile and explicit history/profile scope before dispatch", async () => {
    const f = fixture(); await f.controller.start();
    for (const bad of [null, { profileId: "native-profile", scope: "all" }, { profileId: "sibling-not-in-native-registry", scope: "history" },
      { profileId: "native-profile", scope: "history", approved: true }]) expect(await f.controller.perform("delete-child-data", bad)).toBe(false);
    expect(f.plugin.perform).not.toHaveBeenCalled(); expect(f.controller.getSnapshot().status).toBe("child");
    expect(await f.controller.perform("delete-child-data", { profileId: "native-profile", scope: "history" })).toBe(true);
    expect(f.plugin.perform.mock.calls[0][0]).toMatchObject({ action: "delete-child-data", contextToken: TOKEN,
      target: { profileId: "native-profile", scope: "history" } });
    expect(f.order.indexOf("clear")).toBeLessThan(f.order.indexOf("perform"));
  });
  it("lost original removal acknowledgement cannot be replayed by refresh or another deletion", async () => {
    const f = fixture(); f.plugin.perform.mockImplementation(async () => { throw new Error("Fixture unknown durable outcome"); });
    await f.controller.start(); expect(await f.controller.perform("delete-child-data", { profileId: "native-profile", scope: "profile" })).toBe(false);
    const boots = f.plugin.bootstrap.mock.calls.length; await f.controller.refresh();
    expect(await f.controller.perform("delete-child-data", { profileId: "native-profile", scope: "profile" })).toBe(false);
    expect(f.plugin.perform).toHaveBeenCalledTimes(1); expect(f.plugin.bootstrap).toHaveBeenCalledTimes(boots); expect(f.controller.getSnapshot().context).toBeNull();
  });
});
// Astra regression: original-removal cancellation during async cleanup and gate wait.
describe("original child removal cancellation fences", () => {
  it("cancels before native dispatch while an earlier read is draining", async () => {
    const f = fixture(), held = deferred<unknown>(); await f.controller.start();
    f.plugin.readEntity.mockReturnValueOnce(held.promise);
    const reading = f.controller.readEntity(ref("country", "country-a")); await settle();
    const request = f.plugin.readEntity.mock.calls[0][0];
    const removing = f.controller.perform("delete-child-data", { profileId: "native-profile", scope: "history" });
    await settle(); expect(f.plugin.perform).not.toHaveBeenCalled();
    const cancelling = f.controller.suspend(); await settle();
    held.resolve(f.dataReply(request, entity(ref("country", "country-a"))));
    expect(await reading).toBeNull(); expect(await removing).toBe(false); await cancelling;
    expect(f.plugin.perform).not.toHaveBeenCalled(); expect(f.controller.getSnapshot().context).toBeNull();
  });
  it("a changed removal target revokes the original gate without dispatching a replacement", async () => {
    const f = fixture(), held = deferred<unknown>(); let original: unknown;
    await f.controller.start();
    f.plugin.perform.mockImplementationOnce(r => { original = r; return held.promise; });
    f.plugin.retire.mockImplementation(async r => {
      held.resolve(appReply(original, nativeContext(2), "child", "blocked"));
      const q = r as { requestId: string; contextToken: string | null };
      return { version: 2, requestId: q.requestId, status: "retired", contextToken: q.contextToken };
    });
    const removing = f.controller.perform("delete-child-data", { profileId: "native-profile", scope: "history" });
    await settle(); expect(f.plugin.perform).toHaveBeenCalledOnce();
    expect(await f.controller.perform("delete-child-data", { profileId: "native-profile", scope: "profile" })).toBe(false);
    expect(await removing).toBe(false); expect(f.plugin.perform).toHaveBeenCalledOnce();
    expect(f.plugin.retire.mock.calls[0][0]).toMatchObject({ contextToken: null });
    expect(f.controller.getSnapshot().context).toBeNull();
  });
});
