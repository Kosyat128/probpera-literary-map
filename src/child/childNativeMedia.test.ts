import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createChildNativeAppController, CHILD_NATIVE_LOCAL_POLICY_CHECKSUM, CHILD_NATIVE_LOCAL_POLICY_VERSION,
  type ChildNativeAppController, type ChildNativeAppPlugin, type ChildNativeContext } from "./childNativeAppBridge";
import { childNativeMediaOwner, decodeChildNativeMediaAsset, decodeChildNativeMediaAssets, decodeChildNativeMediaLayout,
  childNativeSlotMedia, decodeChildNativeMediaPresentation, decodeChildNativeMediaRetirement, type ChildNativeMediaAsset } from "./childNativeMedia";
import type { ChildEntityReference } from "./childPackage";
import type { PlatformSnapshot } from "../platform/ports";

// AUTHORED_NOT_RUN. Synthetic correlated replies exercise only the LOCAL2 JS
// projection and dispatch barrier. They supply no native signature, PIN, clock,
// data admission, codec approval, OS retirement or production review authority.
const HASH = "a".repeat(64), OTHER_HASH = "d".repeat(64), TOKEN = "b".repeat(32), PRESENTATION = "e".repeat(32);
const controllers: ChildNativeAppController[] = [];
function ref(kind: ChildEntityReference["kind"] = "work", id = "work-one", contentChecksum = HASH): ChildEntityReference {
  return { kind, id, contentChecksum };
}
function asset(kind: ChildEntityReference["kind"] = "image", assetId = "image-one"): ChildNativeMediaAsset {
  return { assetId, owner: ref(), entity: ref(kind, assetId), mime: kind === "narration" ? "audio/wav" : "image/png",
    role: kind === "narration" ? "narration" : "image", altText: "Reviewed fixture caption",
    transcript: kind === "narration" ? "Reviewed fixture narration." : null };
}
const layout = Object.freeze({ x: 10, y: 20, width: 100, height: 80, viewportWidth: 320, viewportHeight: 640 });
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
async function settle() { for (let i = 0; i < 48; ++i) await Promise.resolve(); }
function nativeContext(generation = 1, lifetime = 50_000): ChildNativeContext {
  return { token: generation === 1 ? TOKEN : generation.toString(16).padStart(32, "0"), generation, revision: generation + 1,
    selectionRevision: generation + 1, profileRevision: generation + 1, policyVersion: CHILD_NATIVE_LOCAL_POLICY_VERSION,
    policyChecksum: CHILD_NATIVE_LOCAL_POLICY_CHECKSUM, mode: "child", profileId: "native-profile", locale: "en",
    package: { id: "native-package", version: 1, checksum: HASH }, home: ref("activity", "home"), remainingLifetimeMs: lifetime };
}
function fixture() {
  let next = 0, native = nativeContext(), state: PlatformSnapshot = Object.freeze({ connectivity: "online", visibility: "active" });
  const listeners = new Set<() => void>(), order: string[] = [];
  const lifecycle = { getSnapshot: () => state, subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; } };
  const dataReply = (input: unknown, value: unknown) => { const r = input as { requestId: string; contextToken: string };
    return { version: 2, requestId: r.requestId, status: "ok", contextToken: r.contextToken, generation: native.generation, value }; };
  const appReply = (input: unknown, context = native) => ({ version: 2, requestId: (input as { requestId: string }).requestId,
    status: "child", reason: null, context, profiles: [{ id: "native-profile", label: "Native saved profile", exactAge: 9, locale: "en" }] });
  const plugin = {
    bootstrap: vi.fn(async (r: unknown): Promise<unknown> => { order.push("bootstrap"); return appReply(r); }),
    readContext: vi.fn(async (r: unknown): Promise<unknown> => appReply(r)),
    perform: vi.fn(async (r: unknown): Promise<unknown> => { order.push("perform"); native = nativeContext(native.generation + 1); return appReply(r); }),
    retire: vi.fn(async (r: unknown): Promise<unknown> => { order.push("retire"); const q = r as { requestId: string; contextToken: string | null };
      return { version: 2, requestId: q.requestId, status: "retired", contextToken: q.contextToken }; }),
    readEntity: vi.fn(async (r: unknown): Promise<unknown> => dataReply(r, { reference: (r as { reference: ChildEntityReference }).reference,
      payload: { title: "Fixture text", text: "Approved text-row shape only.", terms: [], references: [] } })),
    search: vi.fn(async (r: unknown): Promise<unknown> => dataReply(r, [])),
    readCollection: vi.fn(async (r: unknown): Promise<unknown> => dataReply(r, { revision: 0, references: [] })),
    writeCollection: vi.fn(async (r: unknown): Promise<unknown> => dataReply(r, { revision: 1, references: [] })),
    listMedia: vi.fn(async (r: unknown): Promise<unknown> => { order.push("list"); return dataReply(r, [asset()]); }),
    presentMedia: vi.fn(async (r: unknown): Promise<unknown> => { order.push("present"); const q = r as { assetId: string };
      return dataReply(r, { status: "presented", presentationToken: PRESENTATION, assetId: q.assetId, remainingLifetimeMs: 10_000 }); }),
    releaseMedia: vi.fn(async (r: unknown): Promise<unknown> => { order.push("release"); const q = r as { presentationToken: string | null };
      return dataReply(r, { status: "retired", presentationToken: q.presentationToken }); }),
    addListener: vi.fn(async (_name: "invalidated", _listener: (value: unknown) => void): Promise<{ remove(): Promise<void> }> => ({ remove: async () => undefined })),
  } satisfies ChildNativeAppPlugin;
  const controller = createChildNativeAppController({ plugin, lifecycle, nowMs: () => Date.now(), timeoutMs: 1_000,
    requestId: () => (++next).toString(16).padStart(32, "0") });
  controllers.push(controller); const clear = vi.fn(() => { order.push("clear"); }); controller.attachPresentationBarrier(clear);
  return { controller, plugin, order, clear, dataReply, appReply,
    setNative(value: ChildNativeContext) { native = value; },
    visibility(visibility: "active" | "background") { state = Object.freeze({ ...state, visibility }); for (const fn of listeners) fn(); } };
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(0); });
afterEach(async () => { for (const c of controllers.splice(0)) await c.dispose(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe("LOCAL2 native media descriptor projection", () => {
  it("copies exact image and narration descriptors into immutable data without granting byte access", () => {
    for (const raw of [asset(), asset("narration", "narration-one")]) {
      const copied = decodeChildNativeMediaAsset(raw);
      expect(copied).toEqual(raw); expect(copied).not.toBe(raw); expect(Object.isFrozen(copied)).toBe(true);
      expect(Object.isFrozen(copied!.owner)).toBe(true); expect(Object.isFrozen(copied!.entity)).toBe(true);
      Object.assign(raw.owner, { id: "changed-after-copy" }); expect(copied!.owner.id).toBe("work-one");
      expect(Object.keys(copied!).sort()).toEqual(["altText", "assetId", "entity", "mime", "owner", "role", "transcript"]);
    }
  });
  it("rejects accessor, inherited, hidden and symbol fields without executing caller getters", () => {
    const getter = vi.fn(() => "image-one"), accessor = { ...asset() };
    Object.defineProperty(accessor, "assetId", { enumerable: true, get: getter });
    const hidden = { ...asset() }; Object.defineProperty(hidden, "assetId", { enumerable: false, value: "image-one" });
    for (const bad of [accessor, hidden, Object.assign(Object.create(asset()), {}), { ...asset(), [Symbol("authority")]: true },
      { ...asset(), verified: true }, { ...asset(), uri: "file:///private/asset.png" }]) expect(decodeChildNativeMediaAsset(bad)).toBeNull();
    expect(getter).not.toHaveBeenCalled();
  });
  it("binds each media role to its exact entity kind and static raster or PCM MIME", () => {
    expect(decodeChildNativeMediaAsset({ ...asset(), role: "portrait" })).not.toBeNull();
    for (const kind of ["background", "skin", "stand", "accessory"] as const)
      expect(decodeChildNativeMediaAsset({ ...asset(), entity: ref(kind), role: kind, mime: "image/webp" })).not.toBeNull();
    for (const bad of [{ ...asset(), role: "narration" }, { ...asset(), mime: "audio/wav" }, { ...asset(), mime: "image/svg+xml" },
      { ...asset(), mime: "video/mp4" }, { ...asset(), entity: ref("animation"), role: "animation" },
      { ...asset("narration"), mime: "image/png" }, { ...asset("narration"), role: "portrait" },
      { ...asset(), entity: ref("skin"), role: "image" }]) expect(decodeChildNativeMediaAsset(bad)).toBeNull();
  });
  it("requires bounded nonempty captions and narration while image transcript stays null", () => {
    expect(decodeChildNativeMediaAsset({ ...asset(), altText: "x".repeat(240) })).not.toBeNull();
    expect(decodeChildNativeMediaAsset({ ...asset("narration"), transcript: "x".repeat(32768) })).not.toBeNull();
    for (const bad of [{ ...asset(), altText: "" }, { ...asset(), altText: "x".repeat(241) }, { ...asset(), altText: "\u0000" },
      { ...asset(), transcript: "caller narration" }, { ...asset("narration"), transcript: null },
      { ...asset("narration"), transcript: "" }, { ...asset("narration"), transcript: "x".repeat(32769) }])
      expect(decodeChildNativeMediaAsset(bad)).toBeNull();
  });
  it("accepts only actual text owner references and refuses paths, URLs and changed hashes", () => {
    expect(childNativeMediaOwner(ref("recent", "recent-one"))).toEqual(ref("recent", "recent-one"));
    for (const bad of [ref("image"), ref("narration"), ref("work", "../asset"), ref("work", "https://example.invalid/a"),
      ref("work", "work-one", "A".repeat(64)), { ...ref(), trustedEpoch: 1 }]) expect(childNativeMediaOwner(bad)).toBeNull();
    expect(decodeChildNativeMediaAsset({ ...asset(), assetId: "assets/one.png" })).toBeNull();
  });
  it("requires exact owner closure, unique assets and media identities within the 64 row bound", () => {
    const rows = Array.from({ length: 64 }, (_, i) => asset("image", "image-" + i));
    expect(decodeChildNativeMediaAssets(rows, ref())).toHaveLength(64);
    expect(decodeChildNativeMediaAssets([], ref())).toEqual([]);
    for (const bad of [[asset(), asset()], [asset(), { ...asset("image", "other"), entity: asset().entity }],
      [{ ...asset(), owner: ref("work", "work-one", OTHER_HASH) }], [...rows, asset("image", "image-64")], new Array(1)])
      expect(decodeChildNativeMediaAssets(bad, ref())).toBeNull();
    const getter = vi.fn(() => asset()), indexed: unknown[] = [asset()];
    Object.defineProperty(indexed, "0", { enumerable: true, get: getter });
    expect(decodeChildNativeMediaAssets(indexed, ref())).toBeNull(); expect(getter).not.toHaveBeenCalled();
  });
  it("bounds integral viewport-contained geometry without treating a caller permission as layout", () => {
    expect(decodeChildNativeMediaLayout(layout)).toEqual(layout);
    expect(decodeChildNativeMediaLayout({ x: 0, y: 0, width: 8192, height: 8192, viewportWidth: 8192, viewportHeight: 8192 })).not.toBeNull();
    for (const bad of [{ ...layout, x: -0 }, { ...layout, y: -1 }, { ...layout, width: 0 }, { ...layout, width: 1.5 },
      { ...layout, height: NaN }, { ...layout, width: true }, { ...layout, viewportWidth: 8193 },
      { ...layout, x: 300 }, { ...layout, viewportHeight: 50 }, { ...layout, visible: true }])
      expect(decodeChildNativeMediaLayout(bad)).toBeNull();
    const getter = vi.fn(() => 100), hostile = { ...layout }; Object.defineProperty(hostile, "width", { enumerable: true, get: getter });
    expect(decodeChildNativeMediaLayout(hostile)).toBeNull(); expect(getter).not.toHaveBeenCalled();
  });
  it("correlates presentation identity, native remaining lifetime and the exact known refusal", () => {
    const good = { status: "presented", presentationToken: PRESENTATION, assetId: "image-one", remainingLifetimeMs: 60000 };
    expect(decodeChildNativeMediaPresentation(good, "image-one")).toEqual(good);
    expect(decodeChildNativeMediaPresentation({ status: "unavailable", presentationToken: null, assetId: "image-one", remainingLifetimeMs: 0 }, "image-one")).not.toBeNull();
    for (const bad of [{ ...good, assetId: "other" }, { ...good, remainingLifetimeMs: 60001 }, { ...good, remainingLifetimeMs: 0 },
      { ...good, presentationToken: PRESENTATION.toUpperCase() }, { ...good, bytes: [] }, { ...good, status: "unavailable" },
      { status: "unavailable", presentationToken: null, assetId: "image-one", remainingLifetimeMs: 1 }])
      expect(decodeChildNativeMediaPresentation(bad, "image-one")).toBeNull();
  });
  it("accepts nullable full-retirement correlation and never a generic cleared or joined flag", () => {
    expect(decodeChildNativeMediaRetirement({ status: "retired", presentationToken: null }, null)).toBe(true);
    expect(decodeChildNativeMediaRetirement({ status: "retired", presentationToken: PRESENTATION }, PRESENTATION)).toBe(true);
    for (const bad of [{ status: "retired", presentationToken: null }, { status: "retired", presentationToken: "f".repeat(32) },
      { status: "retired", presentationToken: PRESENTATION, joined: true }, { cleared: true }])
      expect(decodeChildNativeMediaRetirement(bad, PRESENTATION)).toBe(false);
  });
});

describe("LOCAL2 media original native delivery barrier", () => {
  it("keeps an authentic empty media list eligible for text without any presentation or retirement", async () => {
    const f = fixture(); await f.controller.start(); f.plugin.listMedia.mockImplementation(async r => f.dataReply(r, []));
    expect(await f.controller.media!.list(ref())).toEqual([]); expect(f.controller.getSnapshot().status).toBe("child");
    expect(f.plugin.presentMedia).not.toHaveBeenCalled(); expect(f.plugin.releaseMedia).not.toHaveBeenCalled(); expect(f.plugin.retire).not.toHaveBeenCalled();
  });
  it("preserves text access when an older plugin has no media methods", async () => {
    const f = fixture(); for (const method of ["listMedia", "presentMedia", "releaseMedia"] as const) Reflect.deleteProperty(f.plugin, method);
    await f.controller.start(); expect(await f.controller.media!.list(ref())).toBeNull();
    expect(await f.controller.readEntity(ref())).toMatchObject({ reference: ref(), payload: { title: "Fixture text" } });
    expect(f.controller.getSnapshot().status).toBe("child"); expect(f.plugin.retire).not.toHaveBeenCalled();
  });
  it("sends only the current native text owner, asset identity and bounded geometry to presentation", async () => {
    const f = fixture(); await f.controller.start(); const listed = await f.controller.media!.list(ref());
    expect(listed).toEqual([asset()]); expect(await f.controller.media!.present(listed![0], layout)).toMatchObject({ status: "presented", presentationToken: PRESENTATION });
    const q = f.plugin.presentMedia.mock.calls[0][0] as Record<string, unknown>;
    expect(Object.keys(q).sort()).toEqual(["assetId", "contextToken", "layout", "owner", "requestId", "version"]);
    expect(q).toMatchObject({ version: 2, contextToken: TOKEN, owner: ref(), assetId: "image-one", layout });
    expect(await f.controller.media!.release(PRESENTATION)).toBe(true);
    expect(f.plugin.releaseMedia.mock.calls[0][0]).toMatchObject({ contextToken: TOKEN, presentationToken: PRESENTATION });
  });
  it("refuses invalid media owners, descriptors, geometry and tokens before dispatch", async () => {
    const f = fixture(); await f.controller.start();
    expect(await f.controller.media!.list(ref("image"))).toBeNull();
    expect(await f.controller.media!.present({ ...asset(), mime: "audio/wav" }, layout)).toBeNull();
    expect(await f.controller.media!.present(asset(), { ...layout, x: 8192 })).toBeNull();
    expect(await f.controller.media!.release("file:///private/pixels")).toBe(false);
    expect(f.plugin.listMedia).not.toHaveBeenCalled(); expect(f.plugin.presentMedia).not.toHaveBeenCalled(); expect(f.plugin.releaseMedia).not.toHaveBeenCalled();
    expect(f.controller.getSnapshot().status).toBe("child");
  });
  it("seals wrong-generation media replies and retires the actual original context", async () => {
    const f = fixture(); await f.controller.start();
    f.plugin.listMedia.mockImplementation(async r => ({ ...f.dataReply(r, [asset()]), generation: 2 }));
    expect(await f.controller.media!.list(ref())).toBeNull(); expect(f.controller.getSnapshot().context).toBeNull();
    expect(f.plugin.retire.mock.calls[0][0]).toMatchObject({ contextToken: TOKEN }); expect(f.plugin.bootstrap).toHaveBeenCalledTimes(1);
  });
  it("dispatches nullable revocation immediately during a held decoder and waits its native ACK before perform", async () => {
    const f = fixture(); await f.controller.start(); const decoded = deferred<unknown>(), revoked = deferred<unknown>();
    f.plugin.presentMedia.mockImplementationOnce(async () => { f.order.push("present"); return decoded.promise; });
    f.plugin.releaseMedia.mockImplementationOnce(async () => { f.order.push("release"); return revoked.promise; });
    const present = f.controller.media!.present(asset(), layout); await settle(); expect(f.plugin.presentMedia).toHaveBeenCalledOnce();
    const action = f.controller.perform("exit-child-mode"); expect(f.controller.getSnapshot().context).toBeNull(); await settle();
    expect(f.plugin.releaseMedia).toHaveBeenCalledOnce(); expect(f.plugin.releaseMedia.mock.calls[0][0]).toMatchObject({ contextToken: TOKEN, presentationToken: null });
    expect(f.plugin.perform).not.toHaveBeenCalled(); expect(f.order.lastIndexOf("clear")).toBeLessThan(f.order.lastIndexOf("release"));
    const original = f.plugin.presentMedia.mock.calls[0][0];
    decoded.resolve(f.dataReply(original, { status: "presented", presentationToken: PRESENTATION, assetId: "image-one", remainingLifetimeMs: 10_000 }));
    expect(await present).toBeNull(); await settle(); expect(f.plugin.perform).not.toHaveBeenCalled();
    revoked.resolve(f.dataReply(f.plugin.releaseMedia.mock.calls[0][0], { status: "retired", presentationToken: null }));
    expect(await action).toBe(true); expect(f.plugin.perform).toHaveBeenCalledOnce();
    expect(f.order.lastIndexOf("release")).toBeLessThan(f.order.lastIndexOf("perform")); expect(f.controller.getSnapshot().context?.generation).toBe(2);
  });
  it("retains a failed revocation while the original decoder is held and never dispatches perform", async () => {
    for (const terminalKnown of [true, false]) {
      const f = fixture(); await f.controller.start(); const decoded = deferred<unknown>();
      f.plugin.presentMedia.mockReturnValueOnce(decoded.promise);
      f.plugin.releaseMedia.mockImplementation(async r => f.dataReply(r, { status: "retired", presentationToken: PRESENTATION }));
      if (!terminalKnown) f.plugin.retire.mockImplementation(async r => ({ version: 2, requestId: (r as { requestId: string }).requestId,
        status: "unavailable", contextToken: TOKEN }));
      const pending = f.controller.media!.present(asset(), layout); await settle();
      const action = f.controller.perform("exit-child-mode"); await settle();
      expect(f.plugin.releaseMedia).toHaveBeenCalledOnce(); expect(f.plugin.perform).not.toHaveBeenCalled();
      decoded.resolve(f.dataReply(f.plugin.presentMedia.mock.calls[0][0], { status: "unavailable", presentationToken: null,
        assetId: "image-one", remainingLifetimeMs: 0 }));
      expect(await pending).toBeNull(); expect(await action).toBe(false);
      expect(f.plugin.perform).not.toHaveBeenCalled(); expect(f.plugin.releaseMedia).toHaveBeenCalledOnce();
      expect(f.plugin.retire).toHaveBeenCalledOnce(); expect(f.controller.getSnapshot().context).toBeNull();
      f.setNative(nativeContext(2)); await f.controller.refresh();
      expect(f.plugin.bootstrap).toHaveBeenCalledTimes(terminalKnown ? 2 : 1);
    }
  });
  it("joins both a concrete pending presentation and nullable native retirement before a new media route", async () => {
    const f = fixture(); await f.controller.start(); const decoded = deferred<unknown>(), revoked = deferred<unknown>();
    f.plugin.presentMedia.mockReturnValueOnce(decoded.promise); f.plugin.releaseMedia.mockReturnValueOnce(revoked.promise);
    const present = f.controller.media!.present(asset(), layout); await settle(); const close = f.controller.media!.releaseAll();
    let joined = false; void close.then(() => { joined = true; }); await settle();
    expect(f.plugin.releaseMedia).toHaveBeenCalledOnce(); expect(joined).toBe(false);
    revoked.resolve(f.dataReply(f.plugin.releaseMedia.mock.calls[0][0], { status: "retired", presentationToken: null }));
    await settle(); expect(joined).toBe(false);
    decoded.resolve(f.dataReply(f.plugin.presentMedia.mock.calls[0][0], { status: "unavailable", presentationToken: null, assetId: "image-one", remainingLifetimeMs: 0 }));
    expect(await present).toMatchObject({ status: "unavailable", presentationToken: null }); expect(await close).toBe(true);
    expect(await f.controller.media!.list(ref())).toEqual([asset()]); expect(f.controller.getSnapshot().status).toBe("child");
  });
  it("keeps an unknown release and retirement closed instead of bootstrapping a successor", async () => {
    const f = fixture(); await f.controller.start(); await f.controller.media!.present(asset(), layout);
    f.plugin.releaseMedia.mockImplementation(async r => f.dataReply(r, { status: "retired", presentationToken: PRESENTATION }));
    f.plugin.retire.mockImplementation(async r => ({ version: 2, requestId: (r as { requestId: string }).requestId, status: "retired", contextToken: null }));
    expect(await f.controller.media!.releaseAll()).toBe(false); expect(f.controller.getSnapshot().context).toBeNull();
    await f.controller.refresh(); expect(f.plugin.bootstrap).toHaveBeenCalledTimes(1); expect(f.plugin.perform).not.toHaveBeenCalled();
  });
  it("expires media with fast nullable revocation and admits a fresh bootstrap only after original retirement", async () => {
    const f = fixture(); f.setNative(nativeContext(1, 10)); await f.controller.start();
    f.plugin.presentMedia.mockImplementationOnce(async r => f.dataReply(r, { status: "presented", presentationToken: PRESENTATION,
      assetId: "image-one", remainingLifetimeMs: 5 })); await f.controller.media!.present(asset(), layout);
    const revoked = deferred<unknown>(); f.plugin.releaseMedia.mockReturnValueOnce(revoked.promise);
    await vi.advanceTimersByTimeAsync(10); expect(f.controller.getSnapshot().context).toBeNull();
    expect(f.plugin.releaseMedia.mock.calls[0][0]).toMatchObject({ contextToken: TOKEN, presentationToken: null });
    expect(f.plugin.retire).not.toHaveBeenCalled(); expect(f.plugin.bootstrap).toHaveBeenCalledTimes(1);
    f.setNative(nativeContext(2)); const q = f.plugin.releaseMedia.mock.calls[0][0] as { requestId: string; contextToken: string };
    revoked.resolve({ version: 2, requestId: q.requestId, status: "ok", contextToken: TOKEN, generation: 1, value: { status: "retired", presentationToken: null } });
    await settle(); expect(f.plugin.retire.mock.calls[0][0]).toMatchObject({ contextToken: TOKEN });
    expect(f.plugin.bootstrap).toHaveBeenCalledTimes(2); expect(f.controller.getSnapshot().context?.generation).toBe(2);
    expect(f.order.lastIndexOf("retire")).toBeLessThan(f.order.lastIndexOf("bootstrap"));
  });
  it("conceals on background before awaiting media ACK and never publishes an inactive successor", async () => {
    const f = fixture(); await f.controller.start(); await f.controller.media!.present(asset(), layout);
    const revoked = deferred<unknown>(); f.plugin.releaseMedia.mockReturnValueOnce(revoked.promise);
    f.visibility("background"); expect(f.controller.getSnapshot().context).toBeNull(); await settle();
    expect(f.plugin.releaseMedia.mock.calls[0][0]).toMatchObject({ presentationToken: null }); expect(f.plugin.retire).not.toHaveBeenCalled();
    revoked.resolve(f.dataReply(f.plugin.releaseMedia.mock.calls[0][0], { status: "retired", presentationToken: null }));
    await settle(); expect(f.plugin.retire).toHaveBeenCalledOnce(); expect(f.plugin.bootstrap).toHaveBeenCalledTimes(1);
    f.setNative(nativeContext(2)); f.visibility("active"); await settle(); expect(f.controller.getSnapshot().context?.generation).toBe(2);
  });
  it("coalesces simultaneous full releases but still requires their actual correlated native result", async () => {
    const f = fixture(); await f.controller.start(); await f.controller.media!.present(asset(), layout);
    const revoked = deferred<unknown>(); f.plugin.releaseMedia.mockReturnValueOnce(revoked.promise);
    const a = f.controller.media!.release(null), b = f.controller.media!.releaseAll(); await settle();
    expect(f.plugin.releaseMedia).toHaveBeenCalledOnce(); revoked.resolve(f.dataReply(f.plugin.releaseMedia.mock.calls[0][0], { status: "retired", presentationToken: null }));
    expect(await a).toBe(true); expect(await b).toBe(true); expect(f.controller.getSnapshot().status).toBe("child");
  });
});

describe("canonical resources are separate from native UIKit media slots",()=>{
 it("retains text-image/portrait/narration slots and excludes full scene roles after exact descriptor decoding",()=>{
  for(const kind of ["image","portrait","narration","skin","stand","background","accessory"] as const){
   const entityKind=kind==="portrait"?"image":kind;
   const raw={...asset(entityKind),role:kind,entity:ref(entityKind,kind)};
   const decoded=decodeChildNativeMediaAsset(raw)!;expect(decoded).not.toBeNull();
   expect(childNativeSlotMedia(decoded)).toBe(["image","portrait","narration"].includes(kind));
  }
 });
});
