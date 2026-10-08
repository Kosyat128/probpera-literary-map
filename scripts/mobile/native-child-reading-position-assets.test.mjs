import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { validateChildNativeMediaManifest, childNativeMediaCanonical as canonical } from "./native-child-media-assets.mjs";
// Synthetic pure validator material only: no keys, signing, files, native grant or publication.
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const json = value => Buffer.from(JSON.stringify(value) + "\n"), now = 2000000, hash = "a".repeat(64);
function material(withAnchors, narration = false) {
  const payload = { title: "Original", text: "HelloWorld", terms: [], references: [], ...(withAnchors ? { readingAnchors: {
    schemaVersion: 1, anchorVersion: 3, segments: [{ anchorId: "Opening", text: "Hello" }, { anchorId: "End", text: "World" }],
    narration: narration ? { assetId: "Narration-A", sha256: hash, sampleRate: 8000, frameCount: 16000,
      cues: [{ anchorId: "Opening", startFrame: 0, endFrame: 8000 }, { anchorId: "End", startFrame: 8000, endFrame: 16000 }] } : null } } : {}) };
  const owner = { kind: "activity", id: "Chapter-A", contentChecksum: sha(Buffer.from(JSON.stringify(payload))) };
  function policy(kind, id, checksum) { return { id, kind, sourceVersion: "source1", policyVersion: "child-local-v2.1",
    minAge: 3, maxAge: 17, reviewStatus: "approved", localizedContent: [{ locale: "en", contentChecksum: checksum,
      reviewStatus: "approved", available: true, reviewerId: "synthetic-validator-only", reviewedAt: now - 10 }],
    topics: [], topicTagsComplete: true, commercialAvailability: "included-in-base", rights: { status: "approved",
      basis: "original", platforms: ["android-google"], territories: ["RU"], validFrom: now - 100, expiresAt: now + 1000 } }; }
  const mediaPayload = narration ? { role: "narration", altText: "Narration", transcript: "HelloWorld", scriptId: "script",
    scriptChecksum: sha(Buffer.from("HelloWorld")), performerId: "performer", qualityChecksum: hash }
    : { role: "portrait", altText: "Portrait", transcript: null, scriptId: null, scriptChecksum: null, performerId: null, qualityChecksum: null };
  const entity = { kind: narration ? "narration" : "image", id: "media", contentChecksum: sha(canonical(mediaPayload)) };
  const pack = { schemaVersion: 1, namespace: "child", packageId: "package", packageVersion: 1, locale: "en", exactAge: 8,
    policyVersion: "child-local-v2.1", policyChecksum: hash, validFromEpochMs: now - 100, validUntilEpochMs: now + 1000,
    home: owner, entities: [{ policy: policy(owner.kind, owner.id, owner.contentChecksum), payload }] };
  const asset = { assetId: narration ? "Narration-A" : "portrait", owner, entity, payload: mediaPayload,
    policy: policy(entity.kind, entity.id, entity.contentChecksum), inventoryKey: narration ? "narration.wav" : "portrait.png",
    sha256: hash, bytes: 100, mime: narration ? "audio/wav" : "image/png" };
  const manifest = { schemaVersion: 2, kind: "literary-planet-child-native-media-manifest-v2", manifestId: "media1", manifestVersion: 1,
    packageId: pack.packageId, packageVersion: 1, packageChecksum: sha(json(pack)), policyVersion: pack.policyVersion,
    policyChecksum: hash, locale: "en", exactAge: 8, readingLevels: [null], validFromEpochMs: now - 100,
    validUntilEpochMs: now + 1000, assets: [asset] };
  const validate = () => { const packageBytes = json(pack), manifestBytes = json({ ...manifest, packageChecksum: sha(packageBytes) });
    return validateChildNativeMediaManifest(manifestBytes, { manifestId: "media1", manifestVersion: 1,
      manifestChecksum: sha(manifestBytes), reviewChecksum: hash, packageId: "package", packageVersion: 1,
      packageChecksum: sha(packageBytes) }, packageBytes, now); };
  return { pack, asset, validate };
}
describe("S16 BIL009 signed logical anchor publisher seams", () => {
  it("retains the exact legacy owner hash and includes explicit anchor bytes in the reviewed localized owner", () => {
    for (const anchored of [false, true]) { const f = material(anchored);
      expect(f.validate().assets[0].owner).toEqual(f.asset.owner);
      if (anchored) { const legacy = { title: f.pack.entities[0].payload.title, text: f.pack.entities[0].payload.text, terms: [], references: [] };
        f.asset.owner.contentChecksum = sha(Buffer.from(JSON.stringify(legacy))); expect(f.validate).toThrow("owner belongs"); }
    }
  });
  it("requires a real matching narration relation for the explicit signed cue asset and checksum", () => {
    const f = material(true, true); expect(f.validate().assets[0].assetId).toBe("Narration-A");
    f.asset.sha256 = "b".repeat(64); expect(f.validate).toThrow("logical narration");
    const missing = material(true, true); missing.asset.assetId = "other"; expect(missing.validate).toThrow("logical narration");
  });
  it("refuses invalid optional alignment instead of upgrading or silently stripping it", () => {
    const f = material(true); f.pack.entities[0].payload.readingAnchors.segments[1].anchorId = "Opening";
    expect(f.validate).toThrow("logical anchors");
    const changed = material(true); changed.pack.entities[0].payload.text = "Other";
    expect(changed.validate).toThrow("logical anchors");
  });
});
