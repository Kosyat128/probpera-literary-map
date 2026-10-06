import { createHash } from "node:crypto";
import { common3dFixture } from "./childCommon3dFixture";
import { canonicalChildEngineJson, decodeChildEngineComposition } from "./childSceneEngine";
import { decodeChildNativeScene } from "./childNativeScene";
/** Project-owned synthetic seam only, never app catalog/native authority. */
export function childSceneEngineFixture() {
  const g = common3dFixture(), hash = "a".repeat(64), owner = { kind: "activity" as const, id: "synthetic-home", contentChecksum: hash };
  const slots = (["skin", "stand", "background"] as const).map(slotId => ({ slotId, assetId: slotId, entity: { kind: slotId, id: slotId, contentChecksum: hash },
    mime: "image/png", checksum: hash, encodedBytes: 128, altText: "Synthetic " + slotId }));
  const partners = { skin: ["skin"], stand: ["stand"], background: ["background"] };
  const raw = { schemaVersion: 1, profile: "canonical-scene-v1", sceneId: g.pack.packageId + ".v1", modelPackageId: g.pack.packageId, modelPackageVersion: 1,
    items: slots.map(s => ({ slotId: s.slotId, assetId: s.assetId, contentChecksum: hash, editions: ["synthetic-edition"], partners: structuredClone(partners), accessoryIds: [],
      booky: "preserve-existing", explore: true, childSafe: true, minAge: 3, maxAge: 17, platforms: ["web", "android", "ios"], tiers: ["high", "balanced", "economy"], minAppVersion: 1, minContentVersion: 1, rightsBinding: "current-native-scene" })),
    textures: slots.map(s => ({ slotId: s.slotId, assetId: s.assetId, width: 32, height: 16 })),
    anchors: { globe: "canonical-origin", booky: "existing-screen-avatar", camera: "preserve-live", stand: "canonical-below-globe", bookyPaddingPx: 12 },
    tiers: (["high", "balanced", "economy"] as const).map((tier, index) => ({ tier, classification: tier === "economy" ? "3d-lite" : "geometry",
      maxDecodedBytes: 1_048_576, maxResidentBytes: 4_194_304, maxTriangles: 1, maxEncodedCacheBytes: [4096, 2048, 1024][index] })),
    lighting: { ambientRgb: [220, 235, 255], ambientMilli: 350, keyRgb: [255, 230, 210], keyMilli: 500, exposurePermille: 950 },
    ambience: { animation: "gentle-light", amplitudePermille: 30, periodMs: 6000, audio: "silent" },
    transition: { durationMs: 300, timeoutMs: 800, reducedMotion: "instant" }, fallback: { staticAllowed: true, preserveSkin: true, preserveBooky: true } };
  const decode = (value = raw) => decodeChildEngineComposition(value)!;
  const scene = (value = raw, token = "c".repeat(32)) => {
    const engine = decode(value), engineCompositionChecksum = createHash("sha256").update(canonicalChildEngineJson(engine)).digest("hex");
    return decodeChildNativeScene({ status: "opened", sceneToken: token, sceneId: engine.sceneId, owner, skin: slots[0],
      stand: { geometryId: "stand.base.child-book-cloud", asset: slots[1] }, background: { geometryId: "background.base.library", asset: slots[2] },
      hotspots: [], remainingLifetimeMs: 5000, modelPackage: { schemaVersion: 2, modelPackage: { ...g.pack, packageVersion: value.modelPackageVersion }, engineComposition: value, engineCompositionChecksum } }, owner, engine.sceneId)!;
  };
  return { g, owner, slots, raw, engine: decode(), scene, decode };
}