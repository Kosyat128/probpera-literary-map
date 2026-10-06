import { afterEach, describe, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import type { ChildNativeAppController } from "./childNativeAppBridge";
import { createChildCanonicalResources, type ChildCanonicalBundle, type ChildCanonicalRenderStage } from "./childNativeCanonicalResources";
import { childNativeAppearanceFromScene, type ChildNativeProfileAppearance } from "./childNativeAppearance";
import type { ChildNativeScene, ChildNativeSceneSlot, ChildNativeModelWebResource, ChildNativeSceneBudgetDecline } from "./childNativeScene";
import type { Common3dResource, Common3dTierId } from "./childCommon3d";
import { childSceneEngineFixture } from "./childSceneEngineFixture";
function fixture() {
  const f = childSceneEngineFixture(), events: string[] = [], images: any[] = [];
  let time = 0, opened = 0, sealed = false, paused = false, value = f.scene(), current: ChildCanonicalBundle | null = null;
  const context = { token: "b".repeat(32), profileId: "synthetic-profile", package: { id: "synthetic-text", version: 1, checksum: "a".repeat(64) } };
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
  const controller = { scenes, getSnapshot: () => ({ phase: sealed ? "sealed" : "ready", status: sealed ? "unavailable" : "child", context,
    profiles: [{ id: context.profileId, label: "Synthetic", exactAge: 9, locale: "en" }] }),
    suspend: vi.fn(async () => { sealed = true; }) } as unknown as ChildNativeAppController;
  const resources = createChildCanonicalResources(controller, context.token, () => time); resources.activate();
  const stage = vi.fn(async (bundle: ChildCanonicalBundle): Promise<ChildCanonicalRenderStage> => {
    const previous = current;
    return { residentBytes: 0, commit: vi.fn(async () => { events.push("render-commit:" + bundle.scene.sceneId); }),
      finalize: () => { events.push("finalize:" + bundle.scene.sceneId); current = bundle; },
      rollback: () => { events.push("render-rollback:" + bundle.scene.sceneId); current = previous; }, join: async () => undefined };
  });
  resources.attachRenderer!("high", stage, () => ({ editionId: "synthetic-edition", platform: "web", exploring: false, visible: true, reducedMotion: false, preloadPaused: paused }));
  function setVersion(version: number) { const raw = structuredClone(f.raw); raw.modelPackageVersion = version; raw.sceneId = f.g.pack.packageId + ".v" + version; value = f.scene(raw); }
  const decline = (s: ChildNativeScene, r: Common3dResource, tier: Common3dTierId) => ({
    status: "budget-declined" as const, sceneId: s.sceneId, slotId: r.kind, assetId: r.assetId, tier, entity: r.entity,
    mime: r.mime, checksum: r.checksum, encodedBytes: r.encodedBytes, remainingLifetimeMs: 4000, reason: "decoded-budget" as const,
  });
  return { ...f, events, images, scenes, controller, resources, stage, decline, setVersion, setScene: (s: ChildNativeScene) => { value = s; }, at: (at: number) => { time = at; }, pause: (value: boolean) => { paused = value; resources.refreshEnvironment!(); }, current: () => current, saved: () => saved };
}
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
describe("engine transaction through current synthetic native seam; no rights/device authority", () => {
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
    const f = fixture(); expect(await f.resources.select(f.owner, f.raw.sceneId)).toBe(true); f.setVersion(2);
    f.resources.subscribe(() => { throw new Error("subscriber failure"); });
    expect(await f.resources.select(f.owner, f.g.pack.packageId + ".v2")).toBe(false);
    expect(f.scenes.release).toHaveBeenCalledWith("1".padStart(32, "0")); expect(f.controller.suspend).toHaveBeenCalled(); expect(f.resources.getSnapshot().textures).toBeNull();
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
});