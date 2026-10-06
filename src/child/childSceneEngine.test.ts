import { describe, expect, it } from "vitest";
import { childEngineCompatible, childEngineTierCandidates, decodeChildEngineComposition, canonicalChildEngineJson } from "./childSceneEngine";
import { decodeCommon3dPackage } from "./childCommon3d";
import { decodeChildNativeSceneBudgetDecline, decodeChildNativeModelWebResource } from "./childNativeScene";
import { childSceneEngineFixture } from "./childSceneEngineFixture";
const view = { editionId: "synthetic-edition", platform: "web" as const, exactAge: 9, contentVersion: 1, exploring: false, visible: true, reducedMotion: false };
describe("strict signed engine presentation constraints, without native admission", () => {
  it("requires exact tuple/edition/platform/age/content/explore/tier compatibility and never converts metadata into rights", () => {
    const f = childSceneEngineFixture(), s = f.scene();
    expect(childEngineCompatible(f.engine, s, view, "high")).toBe(true);
    for (const bad of [{ editionId: "other" }, { platform: "ios-untrusted" }, { exactAge: 2 }, { exactAge: 18 }, { contentVersion: 0 }, { visible: false }])
      expect(childEngineCompatible(f.engine, s, { ...view, ...bad } as typeof view, "high")).toBe(false);
    const raw = structuredClone(f.raw); raw.items[0].explore = false;
    expect(childEngineCompatible(f.decode(raw), s, { ...view, exploring: true }, "high")).toBe(false);
    raw.items[0].tiers = ["economy"];
    expect(childEngineCompatible(f.decode(raw), s, view, "balanced")).toBe(false);
    expect(childEngineCompatible(f.decode(raw), s, view, "balanced", false)).toBe(true);
  });
  it("rejects unknown fields, accessors, actor/camera replacement, noninteger lighting, inflated Economy caps and accessories", () => {
    const f = childSceneEngineFixture(), changes: Array<(r: any) => void> = [
      r => r.approved = true, r => r.anchors.camera = "replace", r => r.items[0].booky = "replace",
      r => r.items[0].accessoryIds = ["unreviewed"], r => r.lighting.exposurePermille = 999.5,
      r => r.tiers[2].maxResidentBytes++, r => r.fallback.preserveBooky = false,
      r => r.textures[0].height++, r => r.items[0].rightsBinding = "approved",
    ];
    for (const change of changes) { const raw = structuredClone(f.raw); change(raw); expect(decodeChildEngineComposition(raw)).toBeNull(); }
    let read = 0; const raw = structuredClone(f.raw); Object.defineProperty(raw, "sceneId", { get() { ++read; return f.raw.sceneId; }, enumerable: true });
    expect(decodeChildEngineComposition(raw)).toBeNull(); expect(read).toBe(0);
  });
  it("preserves exact core1 and binds only a closed envelope2; canonical integer projection is stable", () => {
    const f = childSceneEngineFixture(), s = f.scene();
    expect(s.modelPackage?.engineComposition).toEqual(f.engine); expect(s.modelPackage?.schemaVersion).toBe(1);
    expect(decodeCommon3dPackage({ ...f.g.pack, engineComposition: f.raw })).toBeNull();
    const envelope = { schemaVersion: 2, modelPackage: f.g.pack, engineComposition: f.raw, engineCompositionChecksum: "a".repeat(64) };
    expect(decodeCommon3dPackage({ ...envelope, approved: true })).toBeNull();
    expect(decodeCommon3dPackage({ ...envelope, modelPackage: envelope })).toBeNull();
    expect(canonicalChildEngineJson(f.decode(structuredClone(f.raw)))).toBe(canonicalChildEngineJson(f.engine));
    expect(Object.isFrozen(f.engine.items[0].partners.skin)).toBe(true);
    expect(childEngineTierCandidates("balanced", f.engine)).toEqual([{ tier: "balanced", staticFallback: false }, { tier: "economy", staticFallback: false }, { tier: "economy", staticFallback: true }]);
  });
  it("correlates native capacity declines without any permit URI and requires actual dimensions on v4 model textures", () => {
    const f = childSceneEngineFixture(), s = f.scene(), r = f.g.model.model;
    const decline = { status: "budget-declined", sceneId: s.sceneId, slotId: r.kind, assetId: r.assetId, tier: "high", entity: r.entity,
      mime: r.mime, checksum: r.checksum, encodedBytes: r.encodedBytes, remainingLifetimeMs: 1000, reason: "decoded-budget" };
    expect(decodeChildNativeSceneBudgetDecline(decline, s, r, "high")).toBeTruthy();
    for (const bad of [{ tier: "economy" }, { assetId: "other" }, { remainingLifetimeMs: 0 }, { reason: "rights" }, { uri: "file://untrusted" }])
      expect(decodeChildNativeSceneBudgetDecline({ ...decline, ...bad }, s, r, "high")).toBeNull();
    expect(decodeChildNativeSceneBudgetDecline(decline, { ...s, modelPackage: f.g.pack }, r, "high")).toBeNull();
    const texture = { ...r, assetId: "synthetic-texture", kind: "texture" as const, mime: "image/png" as const, alias: "texture.png" };
    const available = { status: "available", sceneToken: s.sceneToken, slotId: "texture", resourceToken: "d".repeat(32), assetId: texture.assetId, entity: texture.entity,
      mime: texture.mime, checksum: texture.checksum, encodedBytes: texture.encodedBytes, uri: "planet-child-resource://local/" + "d".repeat(32), remainingLifetimeMs: 1000 };
    expect(decodeChildNativeModelWebResource(available, s, texture)).toBeNull();
    expect(decodeChildNativeModelWebResource({ ...available, dimensions: { width: 32, height: 16 } }, s, texture)?.dimensions).toEqual({ width: 32, height: 16 });
    expect(decodeChildNativeModelWebResource({ ...available, dimensions: { width: 4097, height: 16 } }, s, texture)).toBeNull();
  });
});