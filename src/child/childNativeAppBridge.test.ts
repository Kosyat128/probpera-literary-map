import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createChildNativeAppController, decodeChildNativeAppReply, childNativePresentationServices,
  CHILD_NATIVE_LOCAL_POLICY_CHECKSUM, CHILD_NATIVE_LOCAL_POLICY_VERSION,
  type ChildNativeAppController, type ChildNativeAppPlugin, type ChildNativeContext } from "./childNativeAppBridge";
import type { ChildEntityReference } from "./childPackage";
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
