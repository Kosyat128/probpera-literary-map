import { afterEach, describe, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import type { ChildNativeAppController } from "./childNativeAppBridge";
import { createChildCanonicalResources, type ChildCanonicalBundle, type ChildCanonicalRenderStage } from "./childNativeCanonicalResources";
import { childNativeAppearanceFromScene, type ChildNativeProfileAppearance } from "./childNativeAppearance";
import type { ChildNativeScene, ChildNativeSceneSlot, ChildNativeModelWebResource, ChildNativeSceneBudgetDecline } from "./childNativeScene";
import type { Common3dResource, Common3dTierId } from "./childCommon3d";
import { childSceneEngineFixture } from "./childSceneEngineFixture";
function fixture(deferRenderer = false) {
  const f = childSceneEngineFixture(), events: string[] = [], images: any[] = [];
  let time = 0, opened = 0, sealed = false, paused = false, exploring = false, reducedMotion = false, value = f.scene(), current: ChildCanonicalBundle | null = null;
  const context = { token: "b".repeat(32), profileId: "synthetic-profile", package: { id: "synthetic-text", version: 1, checksum: "a".repeat(64) } };
  let visible = true, currentContext = context;
  let saved: ChildNativeProfileAppearance = { profileId: context.profileId, revision: 0, selection: null };
  const prior = new Map<string, { saved: ChildNativeProfileAppearance; revision: number }>();
  class ImageFixture {
    naturalWidth = 32; naturalHeight = 16; crossOrigin = ""; decoding = ""; value = ""; onload: (() => void) | null = null; onerror: (() => void) | null = null;
    constructor() { images.push(this); }
    set src(uri: string) { this.value = uri; queueMicrotask(() => this.onload?.()); } get src() { return this.value; }
    removeAttribute() { this.value = ""; } async decode() {}
  }
  vi.stubGlobal("Image", ImageFixture); vi.stubGlobal("crypto", webcrypto);
  const scenes = {
    readSelection: vi.fn(async () => { events.push("read:" + saved.revision); return saved; }),
    open: vi.fn(async () => { ++opened; events.push("open:" + opened); return { ...value, sceneToken: opened.toString(16).padStart(32, "0") }; }),
    restore: vi.fn(async () => ({ ...saved, status: saved.selection ? "restored" : "absent", scene: saved.selection ? value : null })),
    remember: vi.fn(async (s: ChildNativeScene, revision: number) => {
      events.push("remember:" + s.sceneId); if (revision !== saved.revision) return null; const old = saved;
      saved = { profileId: context.profileId, revision: revision + 1, selection: childNativeAppearanceFromScene(s) };
      prior.set(s.sceneToken, { saved: old, revision: saved.revision }); return saved;
    }),
    rollback: vi.fn(async (s: ChildNativeScene, revision: number) => {
      events.push("native-rollback:" + s.sceneId); const old = prior.get(s.sceneToken);
      if (!old || old.revision !== revision || saved.revision !== revision) return null;
      prior.delete(s.sceneToken); saved = { ...old.saved, revision: revision + 1 }; return saved;
    }),
    acquire: vi.fn(async (s: ChildNativeScene, slot: ChildNativeSceneSlot) => ({
      status: "available" as const, sceneToken: s.sceneToken, slotId: slot.slotId, resourceToken: "d".repeat(32), assetId: slot.assetId, entity: slot.entity,
      mime: slot.mime, checksum: slot.checksum, encodedBytes: slot.encodedBytes, uri: "planet-child-resource://local/" + slot.assetId, remainingLifetimeMs: 4000,
    })),
    acquireModel: vi.fn(async (s: ChildNativeScene, r: Common3dResource, _tier: Common3dTierId): Promise<ChildNativeModelWebResource | ChildNativeSceneBudgetDecline | null> => ({
      status: "available", sceneToken: s.sceneToken, slotId: r.kind, resourceToken: "e".repeat(32), assetId: r.assetId, entity: r.entity,
      mime: r.mime, checksum: r.checksum, encodedBytes: r.encodedBytes, uri: "planet-child-resource://local/" + r.assetId, remainingLifetimeMs: 4000,
    })),
    readModelChunk: vi.fn(async (s: ChildNativeScene, output: ChildNativeModelWebResource, r: Common3dResource, offset: number, length: number) => ({
      status: "available", sceneToken: s.sceneToken, resourceToken: output.resourceToken, offset, totalBytes: r.encodedBytes, mime: r.mime,
      encodedBase64: Buffer.from((r.kind === "model" ? f.g.bytes : f.g.buffer).subarray(offset, offset + length)).toString("base64"), remainingLifetimeMs: 3500,
    })),
    release: vi.fn(async (token: string | null) => { events.push("release:" + token); return true; }),
    releaseAll: vi.fn(async () => true), releaseResource: vi.fn(async () => true), attachRecipient: vi.fn(() => () => undefined),
  };
  const controller = { scenes, getSnapshot: () => ({ phase: sealed ? "sealed" : "ready", status: sealed ? "unavailable" : "child", context: currentContext,
    profiles: [{ id: context.profileId, label: "Synthetic", exactAge: 9, locale: "en" }] }),
    suspend: vi.fn(async () => { sealed = true; }) } as unknown as ChildNativeAppController;
  const resources = createChildCanonicalResources(controller, context.token, () => time); resources.activate();
  const stage = vi.fn(async (bundle: ChildCanonicalBundle): Promise<ChildCanonicalRenderStage> => {
    const previous = current;
    return { residentBytes: 0, commit: vi.fn(async () => { events.push("render-commit:" + bundle.scene.sceneId); }),
      presentPreview: () => { events.push("preview:" + bundle.scene.sceneId); current = bundle; },
      finalize: () => { events.push("finalize:" + bundle.scene.sceneId); current = bundle; },
      rollback: () => { events.push("render-rollback:" + bundle.scene.sceneId); current = previous; }, join: async () => undefined };
  });
  const attachRenderer = (nextTier: Common3dTierId = "high") => resources.attachRenderer!(nextTier, stage,
    () => ({ editionId: "synthetic-edition", platform: "web", exploring, visible, reducedMotion, preloadPaused: paused }));
  if (!deferRenderer) attachRenderer();
  function setVersion(version: number) { const raw = structuredClone(f.raw); raw.modelPackageVersion = version; raw.sceneId = f.g.pack.packageId + ".v" + version; value = f.scene(raw); }
  const decline = (s: ChildNativeScene, r: Common3dResource, tier: Common3dTierId) => ({
    status: "budget-declined" as const, sceneId: s.sceneId, slotId: r.kind, assetId: r.assetId, tier, entity: r.entity,
    mime: r.mime, checksum: r.checksum, encodedBytes: r.encodedBytes, remainingLifetimeMs: 4000, reason: "decoded-budget" as const,
  });
  return { ...f, events, images, scenes, controller, resources, stage, decline, setVersion, attachRenderer,
    savedChoice: () => { saved = { profileId: context.profileId, revision: 1, selection: childNativeAppearanceFromScene(value) }; },
    show: (next: boolean) => { visible = next; resources.refreshEnvironment!(); },
    replaceContext: () => { currentContext = { ...context }; resources.refreshEnvironment!(); },
    setScene: (s: ChildNativeScene) => { value = s; }, at: (at: number) => { time = at; }, pause: (value: boolean) => { paused = value; resources.refreshEnvironment!(); }, current: () => current, saved: () => saved,
    inspect: (value: boolean, calm = false) => { exploring = value; reducedMotion = calm; resources.refreshEnvironment!(); } };
}
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe("engine transaction through current synthetic native seam; no rights/device authority", () => {
  it("joins the renderer inspection exit before restoring A without reopening or extending its original lease", async () => {
    const f = fixture(), originalScene = { ...f.scene(), remainingLifetimeMs: 1200 };
    f.setScene(originalScene); f.savedChoice(); f.inspect(true);
    const pending = f.resources.restore!(); await vi.waitFor(() => expect(f.scenes.restore).toHaveBeenCalledOnce());
    expect(f.scenes.acquire).not.toHaveBeenCalled(); expect(f.scenes.acquireModel).not.toHaveBeenCalled();
    expect(f.stage).not.toHaveBeenCalled(); expect(f.scenes.remember).not.toHaveBeenCalled();
    f.at(500); f.inspect(false); expect(await pending).toBe(true);
    expect(f.scenes.readSelection).toHaveBeenCalledOnce(); expect(f.scenes.restore).toHaveBeenCalledOnce();
    expect(f.scenes.open).not.toHaveBeenCalled(); expect(f.scenes.acquire).toHaveBeenCalledTimes(3);
    expect(f.stage.mock.calls[0][0].preparation!.absoluteDeadline).toBe(1200);
    expect(f.scenes.remember).toHaveBeenCalledExactlyOnceWith(originalScene, 1);
    expect(f.saved()).toMatchObject({ revision: 2, selection: { sceneId: f.raw.sceneId } });
    expect(f.resources.getSnapshot().phase).toBe("ready"); await f.resources.dispose();
  });
  it.each(["cancel", "expiry", "readiness-bound"] as const)("%s while awaiting inspection exit retires the original restoration without late acquisition", async reason => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const f = fixture(), scene = { ...f.scene(), remainingLifetimeMs: reason === "readiness-bound" ? 8000 : 1200 };
    f.setScene(scene); f.savedChoice(); f.inspect(true);
    const pending = f.resources.restore!();
    for (let n = 0; n < 30; n++) await Promise.resolve();
    expect(f.scenes.restore).toHaveBeenCalledOnce(); expect(f.scenes.acquire).not.toHaveBeenCalled();
    if (reason === "cancel") expect(await f.resources.cancelAndWait()).toBe(true);
    else { const elapsed = reason === "expiry" ? 1200 : 5000; f.at(elapsed); await vi.advanceTimersByTimeAsync(elapsed); }
    expect(await pending).toBe(false); await f.resources.join();
    expect(f.scenes.release).toHaveBeenCalledExactlyOnceWith(scene.sceneToken, scene);
    f.inspect(false); await Promise.resolve();
    expect(f.scenes.restore).toHaveBeenCalledOnce(); expect(f.scenes.open).not.toHaveBeenCalled();
    expect(f.scenes.acquire).not.toHaveBeenCalled(); expect(f.scenes.acquireModel).not.toHaveBeenCalled();
    expect(f.stage).not.toHaveBeenCalled(); expect(f.scenes.remember).not.toHaveBeenCalled();
    expect(f.saved().revision).toBe(1); await f.resources.dispose();
  });
  it("still aborts a new inspection change after restoration has begun acquiring resources", async () => {
    const f = fixture(); f.savedChoice();
    let release!: () => void; const held = new Promise<void>(resolve => { release = resolve; });
    const acquire = f.scenes.acquire.getMockImplementation()!;
    f.scenes.acquire.mockImplementationOnce(async (scene, slot) => { await held; return acquire(scene, slot); });
    const pending = f.resources.restore!(); await vi.waitFor(() => expect(f.scenes.acquire).toHaveBeenCalledOnce());
    f.inspect(true); release(); expect(await pending).toBe(false);
    expect(f.scenes.restore).toHaveBeenCalledOnce(); expect(f.scenes.acquire).toHaveBeenCalledOnce();
    expect(f.scenes.acquireModel).not.toHaveBeenCalled(); expect(f.stage).not.toHaveBeenCalled();
    expect(f.scenes.remember).not.toHaveBeenCalled(); expect(f.scenes.release).toHaveBeenCalledOnce();
    f.inspect(false); await Promise.resolve(); expect(f.scenes.restore).toHaveBeenCalledOnce();
    expect(f.saved().revision).toBe(1); await f.resources.dispose();
  });
  it("joins delayed Canvas attachment and visibility in one original restore lease, using the attached tier", async () => {
    const f = fixture(true); f.savedChoice(); f.show(false);
    const pending = f.resources.restore!(); await vi.waitFor(() => expect(f.scenes.restore).toHaveBeenCalledOnce());
    f.resources.setTier!("economy"); f.attachRenderer("economy"); await Promise.resolve();
    expect(f.scenes.acquire).not.toHaveBeenCalled(); expect(f.scenes.open).not.toHaveBeenCalled();
    f.show(true); expect(await pending).toBe(true);
    expect(f.scenes.restore).toHaveBeenCalledOnce(); expect(f.scenes.acquire).toHaveBeenCalledTimes(3);
    expect(f.stage.mock.calls[0][0].tier).toBe("economy"); expect(f.scenes.remember).toHaveBeenCalledOnce();
    expect(f.resources.getSnapshot().phase).toBe("ready"); await f.resources.dispose();
  });
  it("does not replay a fresh restoration when the Canvas tier attaches during its pending native selection read", async () => {
    const f = fixture(true); f.savedChoice();
    let release!: () => void; const held = new Promise<void>(resolve => { release = resolve; });
    const read = f.scenes.readSelection.getMockImplementation()!;
    f.scenes.readSelection.mockImplementationOnce(async () => { await held; return read(); });
    const pending = f.resources.restore!(); await vi.waitFor(() => expect(f.scenes.readSelection).toHaveBeenCalledOnce());
    f.resources.setTier!("economy"); f.attachRenderer("economy"); await Promise.resolve();
    expect(f.scenes.restore).not.toHaveBeenCalled(); expect(f.scenes.acquire).not.toHaveBeenCalled();
    release(); expect(await pending).toBe(true);
    expect(f.scenes.readSelection).toHaveBeenCalledOnce(); expect(f.scenes.restore).toHaveBeenCalledOnce();
    expect(f.scenes.open).not.toHaveBeenCalled(); expect(f.stage.mock.calls[0][0].tier).toBe("economy");
    expect(f.scenes.acquire).toHaveBeenCalledTimes(3); expect(f.scenes.remember).toHaveBeenCalledOnce(); await f.resources.dispose();
  });
  it("renderer readiness cannot admit stale signed engine metadata from a delayed restore", async () => {
    const f = fixture(true), scene = f.scene();
    const stale = { ...scene, modelPackage: { ...scene.modelPackage!, engineCompositionChecksum: "0".repeat(64) } };
    f.setScene(stale); f.savedChoice();
    const pending = f.resources.restore!(); await vi.waitFor(() => expect(f.scenes.restore).toHaveBeenCalledOnce());
    f.attachRenderer(); expect(await pending).toBe(false);
    expect(f.scenes.restore).toHaveBeenCalledOnce(); expect(f.scenes.open).not.toHaveBeenCalled();
    expect(f.scenes.acquire).not.toHaveBeenCalled(); expect(f.scenes.acquireModel).not.toHaveBeenCalled();
    expect(f.stage).not.toHaveBeenCalled(); expect(f.scenes.remember).not.toHaveBeenCalled();
    expect(f.scenes.release).toHaveBeenCalledExactlyOnceWith(stale.sceneToken, stale);
    expect(f.controller.suspend).not.toHaveBeenCalled(); await f.resources.dispose();
  });
  it.each(["cancel", "clear", "context", "detach"] as const)("joins %s during fresh renderer admission and never replays the retired lease", async reason => {
    const f = fixture(true); f.savedChoice(); f.show(false);
    const pending = f.resources.restore!(); await vi.waitFor(() => expect(f.scenes.restore).toHaveBeenCalledOnce());
    if (reason === "cancel") expect(await f.resources.cancelAndWait()).toBe(true);
    else if (reason === "clear") f.resources.clear();
    else if (reason === "context") f.replaceContext();
    else f.attachRenderer()();
    expect(await pending).toBe(false); await f.resources.join();
    f.show(true); if (reason !== "context") f.attachRenderer(); await Promise.resolve();
    expect(f.scenes.restore).toHaveBeenCalledOnce(); expect(f.scenes.acquire).not.toHaveBeenCalled();
    expect(f.scenes.remember).not.toHaveBeenCalled(); expect(f.scenes.release).toHaveBeenCalledOnce();
    expect(f.scenes.release.mock.calls[0][0]).toBe(f.scene().sceneToken);
    expect(f.controller.suspend).not.toHaveBeenCalled(); await f.resources.dispose();
  });
  it.each([1200, 8000])("renderer admission expires inside the unchanged %i ms original lease and cannot replay on late attachment", async lifetime => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const f = fixture(true); f.setScene({ ...f.scene(), remainingLifetimeMs: lifetime }); f.savedChoice();
    const pending = f.resources.restore!();
    for (let n = 0; n < 30; n++) await Promise.resolve();
    expect(f.scenes.restore).toHaveBeenCalledOnce(); expect(f.scenes.acquire).not.toHaveBeenCalled();
    const elapsed = Math.min(lifetime, 5000); f.at(elapsed); await vi.advanceTimersByTimeAsync(elapsed);
    expect(await pending).toBe(false); expect(f.scenes.release).toHaveBeenCalledOnce();
    f.attachRenderer(); await Promise.resolve();
    expect(f.scenes.restore).toHaveBeenCalledOnce(); expect(f.scenes.acquire).not.toHaveBeenCalled();
    expect(f.scenes.remember).not.toHaveBeenCalled(); await f.resources.dispose();
  });
  it("a newer explicit selection cancels renderer admission and is the only later native acquisition", async () => {
    const f = fixture(true); f.savedChoice();
    const pending = f.resources.restore!(); await vi.waitFor(() => expect(f.scenes.restore).toHaveBeenCalledOnce());
    f.setVersion(2); const next = f.resources.select(f.owner, f.g.pack.packageId + ".v2"); f.attachRenderer();
    expect(await pending).toBe(false); expect(await next).toBe(true);
    expect(f.scenes.restore).toHaveBeenCalledOnce(); expect(f.scenes.open).toHaveBeenCalledOnce();
    expect(f.scenes.acquire).toHaveBeenCalledTimes(3); expect(f.scenes.remember).toHaveBeenCalledOnce();
    expect(f.resources.getSnapshot().scene?.sceneId).toBe(f.g.pack.packageId + ".v2"); await f.resources.dispose();
  });
  it("keeps A until B transition completion and rolls native B back before the queued latest C reads", async () => {
    const f = fixture(); expect(await f.resources.select(f.owner, f.raw.sceneId)).toBe(true); const a = f.resources.getSnapshot().textures!.skin;
    f.setVersion(2); let started = false;
    f.stage.mockImplementationOnce(async bundle => ({ residentBytes: 0, commit: options => new Promise<void>((_resolve, reject) => {
      started = true; options!.signal.addEventListener("abort", () => reject(new Error("cancelled")), { once: true });
    }), finalize: () => { throw new Error("Obsolete B must never finalize"); }, rollback: () => { f.events.push("render-rollback:" + bundle.scene.sceneId); }, join: async () => undefined }));
    const b = f.resources.select(f.owner, f.g.pack.packageId + ".v2"); await vi.waitFor(() => expect(started).toBe(true));
    expect(f.resources.getSnapshot().textures?.skin).toBe(a); expect(a.image).not.toBeNull();
    f.setVersion(3); const c = f.resources.select(f.owner, f.g.pack.packageId + ".v3");
    expect(await b).toBe(false); expect(await c).toBe(true); expect(f.resources.getSnapshot().scene?.sceneId).toBe(f.g.pack.packageId + ".v3");
    expect(f.events.indexOf("native-rollback:" + f.g.pack.packageId + ".v2")).toBeLessThan(f.events.indexOf("read:3"));
    expect(a.image).toBeNull(); expect(f.saved().selection?.sceneId).toBe(f.g.pack.packageId + ".v3"); await f.resources.dispose();
  });
  it("seals an unknown durable rollback and never finalizes the obsolete scene", async () => {
    const f = fixture(); expect(await f.resources.select(f.owner, f.raw.sceneId)).toBe(true); f.setVersion(2);
    f.stage.mockImplementationOnce(async () => ({ residentBytes: 0, commit: async () => { throw new Error("original renderer timed out"); }, rollback: () => undefined, join: async () => undefined }));
    f.scenes.rollback.mockResolvedValueOnce(null); expect(await f.resources.select(f.owner, f.g.pack.packageId + ".v2")).toBe(false);
    expect(f.controller.suspend).toHaveBeenCalled(); expect(f.resources.getSnapshot().textures).toBeNull();
    await expect(f.resources.join()).rejects.toThrow("cleanup failed");
  });
  it("releases each failed native tier before a fresh lease, skips only excluded tiers and preserves the original deadline", async () => {
    const f = fixture(), raw = structuredClone(f.raw); raw.items.forEach(i => { i.tiers = ["high", "economy"]; }); f.setScene(f.scene(raw));
    const original = f.scenes.acquireModel.getMockImplementation()!;
    f.scenes.acquireModel.mockImplementation(async (s, r, tier) => tier === "high" ? (f.at(3000), f.decline(s, r, tier)) : original(s, r, tier));
    expect(await f.resources.select(f.owner, raw.sceneId)).toBe(true);
    expect(f.scenes.open).toHaveBeenCalledTimes(3); expect(f.scenes.acquireModel.mock.calls.map(c => c[2])).toEqual(["high", "economy", "economy"]);
    expect(f.events.indexOf("release:" + "1".padStart(32, "0"))).toBeLessThan(f.events.indexOf("open:2"));
    expect(f.events.indexOf("release:" + "2".padStart(32, "0"))).toBeLessThan(f.events.indexOf("open:3"));
    expect(f.resources.getSnapshot().renderClass).toBe("3d-lite"); f.at(4001); expect(f.resources.isCurrent()).toBe(false); await f.resources.dispose();
  });
  it("allows only signed static fallback with two real images and no stand/model output; null is a fatal generic refusal", async () => {
    const f = fixture(); f.scenes.acquireModel.mockImplementation(async (s, r, tier) => f.decline(s, r, tier));
    expect(await f.resources.select(f.owner, f.raw.sceneId)).toBe(true);
    expect(f.scenes.open).toHaveBeenCalledTimes(4); expect(f.scenes.acquire.mock.calls.slice(-2).map(c => c[1].slotId)).toEqual(["skin", "background"]);
    expect(f.resources.getSnapshot().textures?.stand).toBeNull(); expect(f.resources.getSnapshot().models?.size).toBe(0);
    expect(f.resources.getSnapshot().renderClass).toBe("static"); await f.resources.dispose();
    const denied = fixture(); denied.scenes.acquireModel.mockResolvedValue(null);
    expect(await denied.resources.select(denied.owner, denied.raw.sceneId)).toBe(false); expect(denied.scenes.open).toHaveBeenCalledTimes(1); await denied.resources.dispose();
  });
  it("rejects stale metadata hash and signed dimension mismatches before native remember", async () => {
    const f = fixture(), s = f.scene();
    f.setScene({ ...s, modelPackage: { ...s.modelPackage!, engineCompositionChecksum: "b".repeat(64) } });
    expect(await f.resources.select(f.owner, s.sceneId)).toBe(false); expect(f.scenes.acquire).not.toHaveBeenCalled(); expect(f.scenes.remember).not.toHaveBeenCalled(); await f.resources.dispose();
    const dimensions = fixture(), raw = structuredClone(dimensions.raw); raw.textures[1].width = 16; dimensions.setScene(dimensions.scene(raw));
    expect(await dimensions.resources.select(dimensions.owner, raw.sceneId)).toBe(false); expect(dimensions.scenes.remember).not.toHaveBeenCalled(); await dimensions.resources.dispose();
  });
  it("uses cache only after fresh native acquire and carries the earlier checked chunk expiry", async () => {
    const f = fixture(); expect(await f.resources.select(f.owner, f.raw.sceneId)).toBe(true);
    expect(f.scenes.readModelChunk).toHaveBeenCalledTimes(2); f.at(3400);
    expect(await f.resources.select(f.owner, f.raw.sceneId)).toBe(true);
    expect(f.scenes.acquireModel).toHaveBeenCalledTimes(4); expect(f.scenes.readModelChunk).toHaveBeenCalledTimes(2);
    f.at(3501); expect(f.resources.isCurrent()).toBe(false); await f.resources.dispose();
  });
  it("releases prior native owners even when a subscriber throws after finalized commit", async () => {
    const f = fixture(); expect(await f.resources.select(f.owner, f.raw.sceneId)).toBe(true); const previous = f.resources.getSnapshot().scene; f.setVersion(2);
    f.resources.subscribe(() => { throw new Error("subscriber failure"); });
    expect(await f.resources.select(f.owner, f.g.pack.packageId + ".v2")).toBe(false);
    expect(f.scenes.release).toHaveBeenCalledWith("1".padStart(32, "0"), previous); expect(f.controller.suspend).toHaveBeenCalled(); expect(f.resources.getSnapshot().textures).toBeNull();
  });
  it("pauses new acquisition during original camera gestures and resumes within the same original lease", async () => {
    const f = fixture(); f.pause(true); const select = f.resources.select(f.owner, f.raw.sceneId);
    await vi.waitFor(() => expect(f.scenes.open).toHaveBeenCalledOnce()); expect(f.scenes.acquire).not.toHaveBeenCalled();
    f.pause(false); expect(await select).toBe(true); expect(f.scenes.open).toHaveBeenCalledOnce(); await f.resources.dispose();
    const expired = fixture(); expired.pause(true); const pending = expired.resources.select(expired.owner, expired.raw.sceneId);
    await vi.waitFor(() => expect(expired.scenes.open).toHaveBeenCalledOnce()); expired.at(5000); expired.pause(false);
    expect(await pending).toBe(false); expect(expired.scenes.acquire).not.toHaveBeenCalled(); await expired.resources.dispose();
  });
  it("never resurrects a finalized renderer candidate after a synchronous owner clear", async () => {
    const f = fixture(); f.stage.mockImplementationOnce(async () => ({ residentBytes: 0, commit: async () => undefined,
      finalize: () => f.resources.clear(), rollback: () => undefined, join: async () => undefined }));
    expect(await f.resources.select(f.owner, f.raw.sceneId)).toBe(false); expect(f.resources.getSnapshot().textures).toBeNull(); expect(f.controller.suspend).toHaveBeenCalled();
    await expect(f.resources.join()).rejects.toThrow("cleanup failed");
  });
  it("joins a throwing renderer rollback exactly once before sealing uncertain ownership", async () => {
    const f = fixture(), rollback = vi.fn(() => { throw new Error("rollback observer failed"); }), join = vi.fn(async () => undefined);
    f.stage.mockImplementationOnce(async () => ({ residentBytes: 0, commit: async () => { throw new Error("commit refused"); }, rollback, join }));
    expect(await f.resources.select(f.owner, f.raw.sceneId)).toBe(false);
    expect(rollback).toHaveBeenCalledOnce(); expect(join).toHaveBeenCalledOnce(); expect(f.controller.suspend).toHaveBeenCalled();
    await expect(f.resources.join()).rejects.toThrow("cleanup failed");
  });
  it("never starts a fallback lease when the declined native owner cannot be released", async () => {
    const f = fixture(); f.scenes.acquireModel.mockImplementation(async (s, r, tier) => f.decline(s, r, tier)); f.scenes.release.mockResolvedValue(false);
    expect(await f.resources.select(f.owner, f.raw.sceneId)).toBe(false); expect(f.scenes.open).toHaveBeenCalledOnce(); expect(f.controller.suspend).toHaveBeenCalled();
    await expect(f.resources.join()).rejects.toThrow("cleanup failed");
  });
  it("shows B without native persistence and cancels back to the exact retained A resources", async () => {
    const f = fixture(); expect(await f.resources.select(f.owner, f.raw.sceneId)).toBe(true);
    const baseline = f.resources.getSnapshot(), saved = f.saved(); f.setVersion(2);
    expect(await f.resources.preview(f.owner, f.g.pack.packageId + ".v2")).toBe(true);
    const held = f.resources.getSnapshot().preview!, candidate = f.current()!;
    expect(held).toMatchObject({ phase: "ready", scene: { sceneId: candidate.scene.sceneId } });
    expect(f.resources.getSnapshot().textures).toBe(baseline.textures); expect(f.saved()).toBe(saved);
    expect(f.scenes.remember).toHaveBeenCalledOnce(); expect(f.resources.isCurrent()).toBe(true);
    expect(await f.resources.cancelPreview(held.revision)).toBe(true);
    expect(f.resources.getSnapshot()).toMatchObject({ phase: "ready", preview: null, persistence: "saved" });
    expect(f.resources.getSnapshot().textures).toBe(baseline.textures); expect(f.current()?.textures).toBe(baseline.textures);
    expect(baseline.textures!.skin.image).not.toBeNull(); expect(candidate.textures.skin.image).toBeNull();
    expect(f.saved()).toBe(saved); expect(f.scenes.rollback).not.toHaveBeenCalled();
    expect(f.scenes.release).toHaveBeenCalledWith(candidate.scene.sceneToken, candidate.scene); await f.resources.dispose();
  });
  it("applies only the exact ready revision after a fresh native read, retaining A until CAS acknowledgement", async () => {
    const f = fixture(); await f.resources.select(f.owner, f.raw.sceneId); const baseline = f.resources.getSnapshot(); f.setVersion(2);
    expect(await f.resources.preview(f.owner, f.g.pack.packageId + ".v2")).toBe(true);
    const revision = f.resources.getSnapshot().preview!.revision, candidate = f.current()!;
    expect(await f.resources.applyPreview(revision - 1)).toBe(false);
    const remember = f.scenes.remember.getMockImplementation()!; let release!: () => void;
    const wait = new Promise<void>(resolve => { release = resolve; });
    f.scenes.remember.mockImplementationOnce(async (scene, expected) => { await wait; return remember(scene, expected); });
    const applied = f.resources.applyPreview(revision);
    expect(f.resources.getSnapshot().preview).toMatchObject({ phase: "applying", revision });
    expect(await f.resources.applyPreview(revision)).toBe(false);
    await vi.waitFor(() => expect(f.scenes.remember).toHaveBeenCalledTimes(2));
    expect(f.scenes.readSelection).toHaveBeenCalledTimes(3); expect(f.resources.getSnapshot().textures).toBe(baseline.textures);
    expect(baseline.textures!.skin.image).not.toBeNull(); release(); expect(await applied).toBe(true);
    expect(f.resources.getSnapshot().preview).toBeNull(); expect(f.resources.getSnapshot().textures).toBe(candidate.textures);
    expect(baseline.textures!.skin.image).toBeNull(); expect(f.saved().selection?.sceneId).toBe(candidate.scene.sceneId);
    expect(f.events.filter(event => event === "finalize:" + candidate.scene.sceneId)).toHaveLength(1); await f.resources.dispose();
  });
  it("does not grant older cancel navigation after its subscriber starts a newer preview", async () => {
    const f=fixture();await f.resources.select(f.owner,f.raw.sceneId);f.setVersion(2);
    expect(await f.resources.preview(f.owner,f.g.pack.packageId+".v2")).toBe(true);
    const revision=f.resources.getSnapshot().preview!.revision;let armed=true,replacement:Promise<boolean>|null=null;
    const stop=f.resources.subscribe(()=>{
      if(armed&&!f.resources.getSnapshot().preview){armed=false;f.setVersion(3);replacement=f.resources.preview(f.owner,f.g.pack.packageId+".v3");}
    });
    expect(await f.resources.cancelPreview(revision)).toBe(false);stop();expect(await replacement).toBe(true);
    const current=f.resources.getSnapshot().preview!;expect(current.scene?.sceneId).toBe(f.g.pack.packageId+".v3");
    expect(await f.resources.applyPreview(revision)).toBe(false);expect(await f.resources.cancelPreview(current.revision)).toBe(true);
    await f.resources.dispose();
  });
  it("joins a cancelled B before preparing C and refuses stale apply without writing either preview", async () => {
    const f = fixture(); await f.resources.select(f.owner, f.raw.sceneId); const saved = f.saved(); f.setVersion(2);
    const prepare = f.stage.getMockImplementation()!; let release!: () => void;
    const wait = new Promise<void>(resolve => { release = resolve; });
    f.stage.mockImplementationOnce(async bundle => ({ ...await prepare(bundle), join: () => wait }));
    expect(await f.resources.preview(f.owner, f.g.pack.packageId + ".v2")).toBe(true);
    const previous = f.resources.getSnapshot().preview!.revision; f.setVersion(3);
    const latest = f.resources.preview(f.owner, f.g.pack.packageId + ".v3");
    await vi.waitFor(() => expect(f.events).toContain("render-rollback:" + f.g.pack.packageId + ".v2"));
    expect(f.scenes.open).toHaveBeenCalledTimes(2); expect(await f.resources.applyPreview(previous)).toBe(false);
    release(); expect(await latest).toBe(true); expect(f.scenes.open).toHaveBeenCalledTimes(3);
    expect(f.events.indexOf("release:" + "2".padStart(32, "0"))).toBeLessThan(f.events.indexOf("open:3"));
    expect(f.saved()).toBe(saved); expect(f.scenes.remember).toHaveBeenCalledOnce();
    await f.resources.cancelPreview(f.resources.getSnapshot().preview!.revision); await f.resources.dispose();
  });
  it("keeps a compatible inspection and calm change inside the same preview lease and revision", async () => {
    const f = fixture(); await f.resources.select(f.owner, f.raw.sceneId); f.setVersion(2);
    expect(await f.resources.preview(f.owner, f.g.pack.packageId + ".v2")).toBe(true);
    const held = f.resources.getSnapshot().preview!, opened = f.scenes.open.mock.calls.length;
    const deadline = f.current()!.preparation!.absoluteDeadline;
    f.inspect(true, true); f.inspect(false);
    expect(f.resources.getSnapshot().preview).toEqual(held); expect(f.resources.isCurrent()).toBe(true);
    expect(f.scenes.open).toHaveBeenCalledTimes(opened); expect(f.current()!.preparation!.absoluteDeadline).toBe(deadline);
    await f.resources.cancelPreview(held.revision); await f.resources.dispose();
  });
  it("expires a held shorter candidate back to A without a write or lease renewal", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const f = fixture(); await f.resources.select(f.owner, f.raw.sceneId); const baseline = f.resources.getSnapshot();
    f.setVersion(2); const raw = structuredClone(f.raw); raw.modelPackageVersion = 2; raw.sceneId = f.g.pack.packageId + ".v2";
    f.setScene({ ...f.scene(raw), remainingLifetimeMs: 1200 });
    expect(await f.resources.preview(f.owner, raw.sceneId)).toBe(true); f.at(1199); await vi.advanceTimersByTimeAsync(1199);
    expect(f.resources.getSnapshot().preview?.phase).toBe("ready"); f.at(1200); await vi.advanceTimersByTimeAsync(1);
    expect(f.resources.getSnapshot().preview).toBeNull(); expect(f.resources.getSnapshot().textures).toBe(baseline.textures);
    expect(baseline.textures!.skin.image).not.toBeNull(); expect(f.resources.isCurrent()).toBe(true);
    expect(f.scenes.remember).toHaveBeenCalledOnce(); expect(f.scenes.open).toHaveBeenCalledTimes(2); await f.resources.dispose();
  });
  it("bounds the preview by the original baseline deadline even when the candidate has a longer lease", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const f = fixture(); f.setScene({ ...f.scene(), remainingLifetimeMs: 1200 }); await f.resources.select(f.owner, f.raw.sceneId);
    f.at(500); await vi.advanceTimersByTimeAsync(500); f.setVersion(2);
    expect(await f.resources.preview(f.owner, f.g.pack.packageId + ".v2")).toBe(true);
    expect(f.current()!.preparation!.absoluteDeadline).toBe(1200); f.at(1200); await vi.advanceTimersByTimeAsync(700);
    expect(f.resources.getSnapshot().preview).toBeNull(); expect(f.resources.isCurrent()).toBe(false);
    expect(f.scenes.remember).toHaveBeenCalledOnce(); expect(f.scenes.open).toHaveBeenCalledTimes(2); await f.resources.dispose();
  });
  it("rolls back an acknowledged apply when Cancel wins while native CAS is pending", async () => {
    const f = fixture(); await f.resources.select(f.owner, f.raw.sceneId); const saved = f.saved(); f.setVersion(2);
    await f.resources.preview(f.owner, f.g.pack.packageId + ".v2"); const revision = f.resources.getSnapshot().preview!.revision;
    const candidate = f.current()!, remember = f.scenes.remember.getMockImplementation()!; let release!: () => void;
    const wait = new Promise<void>(resolve => { release = resolve; });
    f.scenes.remember.mockImplementationOnce(async (scene, expected) => { await wait; return remember(scene, expected); });
    const applied = f.resources.applyPreview(revision); await vi.waitFor(() => expect(f.scenes.remember).toHaveBeenCalledTimes(2));
    const cancelled = f.resources.cancelPreview(revision); release();
    expect(await applied).toBe(false); expect(await cancelled).toBe(true);
    expect(f.saved().selection).toEqual(saved.selection); expect(f.scenes.rollback).toHaveBeenCalledWith(candidate.scene, 2);
    expect(f.events.indexOf("render-rollback:" + candidate.scene.sceneId)).toBeLessThan(f.events.indexOf("native-rollback:" + candidate.scene.sceneId));
    expect(f.events).not.toContain("finalize:" + candidate.scene.sceneId); await f.resources.dispose();
  });
  it("joins a publicly hidden cancellation through native rollback acknowledgement and candidate release before navigation", async () => {
    const f=fixture();expect(await f.resources.select(f.owner,f.raw.sceneId)).toBe(true);
    const baseline=f.resources.getSnapshot(),saved=f.saved();f.setVersion(2);
    expect(await f.resources.preview(f.owner,f.g.pack.packageId+".v2")).toBe(true);
    const revision=f.resources.getSnapshot().preview!.revision,candidate=f.current()!;
    const remember=f.scenes.remember.getMockImplementation()!,rollback=f.scenes.rollback.getMockImplementation()!,release=f.scenes.release.getMockImplementation()!;
    let acknowledgeRemember!:()=>void,acknowledgeRollback!:()=>void,acknowledgeRelease!:()=>void,written!:()=>void;
    const remembered=new Promise<void>(resolve=>{acknowledgeRemember=resolve;}),rolledBack=new Promise<void>(resolve=>{acknowledgeRollback=resolve;}),
      released=new Promise<void>(resolve=>{acknowledgeRelease=resolve;}),committed=new Promise<void>(resolve=>{written=resolve;});
    f.scenes.remember.mockImplementationOnce(async(scene,expected)=>{
      const reply=await remember(scene,expected);written();await remembered;return reply;
    });
    f.scenes.rollback.mockImplementationOnce(async(scene,expected)=>{
      const reply=await rollback(scene,expected);await rolledBack;f.events.push("rollback-ack");return reply;
    });
    f.scenes.release.mockImplementationOnce(async token=>{
      const reply=await release(token);await released;f.events.push("candidate-release-ack");return reply;
    });
    const applying=f.resources.applyPreview(revision);await committed;
    expect(f.saved()).toMatchObject({revision:2,selection:{sceneId:candidate.scene.sceneId}});
    const cancelling=f.resources.cancelPreview(revision);expect(f.resources.getSnapshot().preview).toBeNull();
    let settled=false;const leaving=f.resources.cancelAndWait().then(value=>{settled=true;return value;});
    await Promise.resolve();await Promise.resolve();expect(settled).toBe(false);
    expect(f.resources.getSnapshot().textures).toBe(baseline.textures);expect(baseline.textures!.skin.image).not.toBeNull();
    acknowledgeRemember();await vi.waitFor(()=>expect(f.scenes.rollback).toHaveBeenCalledOnce());expect(settled).toBe(false);
    expect(f.scenes.release).not.toHaveBeenCalledWith(candidate.scene.sceneToken, candidate.scene);
    acknowledgeRollback();await vi.waitFor(()=>expect(f.scenes.release).toHaveBeenCalledWith(candidate.scene.sceneToken, candidate.scene));expect(settled).toBe(false);
    acknowledgeRelease();expect(await applying).toBe(false);await cancelling;expect(await leaving).toBe(true);
    expect(f.saved()).toEqual({...saved,revision:3});expect(f.current()?.textures).toBe(baseline.textures);
    expect(candidate.textures.skin.image).toBeNull();expect(baseline.textures!.skin.image).not.toBeNull();
    expect(f.scenes.release).not.toHaveBeenCalledWith(baseline.scene!.sceneToken);
    expect(f.events).not.toContain("finalize:"+candidate.scene.sceneId);expect(f.controller.suspend).not.toHaveBeenCalled();
    // The existing route may clear and freshly read only after this grant.
    f.resources.clear();await f.resources.join();expect(await f.scenes.readSelection()).toEqual({...saved,revision:3});
    expect(f.events.indexOf("rollback-ack")).toBeLessThan(f.events.indexOf("candidate-release-ack"));
    expect(f.events.indexOf("candidate-release-ack")).toBeLessThan(f.events.lastIndexOf("read:3"));await f.resources.dispose();
  });
  it("refuses an old navigation grant when cancellation publication synchronously starts a new preview", async () => {
    const f=fixture();expect(await f.resources.select(f.owner,f.raw.sceneId)).toBe(true);
    const baseline=f.resources.getSnapshot(),saved=f.saved();f.setVersion(2);
    expect(await f.resources.preview(f.owner,f.g.pack.packageId+".v2")).toBe(true);const oldCandidate=f.current()!;
    let armed=true,replacement:Promise<boolean>|null=null;
    const stop=f.resources.subscribe(()=>{
      if(armed&&!f.resources.getSnapshot().preview){armed=false;f.setVersion(3);replacement=f.resources.preview(f.owner,f.g.pack.packageId+".v3");}
    });
    const leaving=f.resources.cancelAndWait();expect(await leaving).toBe(false);stop();expect(await replacement).toBe(true);
    const current=f.resources.getSnapshot().preview!;
    expect(current).toMatchObject({phase:"ready",scene:{sceneId:f.g.pack.packageId+".v3"}});
    expect(f.current()?.scene.sceneToken).toBe(current.scene!.sceneToken);expect(f.current()?.textures.skin.image).not.toBeNull();
    expect(oldCandidate.textures.skin.image).toBeNull();expect(f.resources.getSnapshot().textures).toBe(baseline.textures);
    expect(f.saved()).toBe(saved);expect(f.scenes.remember).toHaveBeenCalledOnce();expect(f.controller.suspend).not.toHaveBeenCalled();
    expect(await f.resources.cancelPreview(current.revision)).toBe(true);await f.resources.dispose();
  });
  it("refuses preview without reversible rendering and refuses apply after the durable baseline changed", async () => {
    const f = fixture(); f.stage.mockImplementationOnce(async () => ({ residentBytes: 0, commit: vi.fn(), finalize: vi.fn(), rollback: vi.fn() }));
    expect(await f.resources.preview(f.owner, f.raw.sceneId)).toBe(false); expect(f.scenes.remember).not.toHaveBeenCalled();
    await f.resources.select(f.owner, f.raw.sceneId); f.setVersion(2); await f.resources.preview(f.owner, f.g.pack.packageId + ".v2");
    const revision = f.resources.getSnapshot().preview!.revision;
    f.scenes.readSelection.mockResolvedValueOnce({ ...f.saved(), revision: f.saved().revision + 1 });
    expect(await f.resources.applyPreview(revision)).toBe(false); expect(f.scenes.remember).toHaveBeenCalledOnce();
    expect(f.resources.getSnapshot().preview).toBeNull(); expect(f.resources.isCurrent()).toBe(true); await f.resources.dispose();
  });
});
