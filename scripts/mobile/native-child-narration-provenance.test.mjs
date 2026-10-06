import { describe, expect, it } from "vitest";
import { createHash, webcrypto } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { validateChildNativeNarrationProvenance, childNativeNarrationDurationMs, collectChildNativeMediaOutputs,
  childNativeMediaCanonical as canonical, CHILD_NATIVE_MEDIA_REVIEW_PREFIX } from "./native-child-media-assets.mjs";

// AUTHORED_NOT_RUN. Disposable metadata and silent PCM confer no human review,
// original voice, licensed source, native consent or OS storage authority.
const sha = value => createHash("sha256").update(value).digest("hex");
const encode = value => Buffer.from(JSON.stringify(value) + "\n", "utf8");
function pcm(dataBytes = 320) {
  const bytes = Buffer.alloc(44 + dataBytes); bytes.write("RIFF"); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write("WAVE", 8);
  bytes.write("fmt ", 12); bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(8000, 24); bytes.writeUInt32LE(16000, 28); bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34);
  bytes.write("data", 36); bytes.writeUInt32LE(dataBytes, 40); return bytes;
}
function provenance(locale = "en") { return { schemaVersion: 1, kind: "literary-planet-child-narration-provenance-v1",
  scriptId: "synthetic-script", scriptChecksum: "a".repeat(64), performerId: "synthetic-performer", licensorId: "synthetic-licensor",
  locale, accent: "Documented synthetic accent", pronunciationNotes: "Synthetic pronunciation notes.", durationMs: 20,
  loudnessReport: "Synthetic source report.", qualityReport: "Synthetic quality report.", reducedAudioFallback: "same-locale-text", voiceKind: "human-original" }; }
function asset(bytes) { return { mime: "audio/wav", payload: { role: "narration", scriptId: "synthetic-script",
  scriptChecksum: "a".repeat(64), performerId: "synthetic-performer", qualityChecksum: sha(bytes) } }; }

describe("signed narration source provenance and actual PCM duration", () => {
  it("requires source bytes pinned by the existing signed quality checksum in both locales", () => {
    for (const locale of ["ru", "en"]) { const bytes = encode(provenance(locale)), source = asset(bytes);
      expect(validateChildNativeNarrationProvenance(bytes, source, locale, childNativeNarrationDurationMs(pcm())).locale).toBe(locale);
      expect(() => validateChildNativeNarrationProvenance(Buffer.concat([bytes, Buffer.from(" ")]), source, locale, 20)).toThrow();
      expect(() => validateChildNativeNarrationProvenance(bytes, source, locale === "en" ? "ru" : "en", 20)).toThrow(); }
  });
  it("denies missing/unknown identity, cloned voices, missing reports and a different actual duration", () => {
    for (const change of [{ scriptId: "other" }, { scriptChecksum: "b".repeat(64) }, { performerId: "other" }, { licensorId: "" },
      { accent: "" }, { accent: "Line one\nLine two" }, { pronunciationNotes: "" }, { loudnessReport: "" }, { qualityReport: "" }, { durationMs: 22 },
      { reducedAudioFallback: "ru-speech" }, { voiceKind: "cloned-celebrity" }, { approved: true }, { locale: "fr" }]) {
      const bytes = encode({ ...provenance(), ...change }); expect(() => validateChildNativeNarrationProvenance(bytes, asset(bytes), "en", 20)).toThrow();
    }
    const duplicate = Buffer.from('{"schemaVersion":1,"schemaVersion":1}');
    expect(() => validateChildNativeNarrationProvenance(duplicate, asset(duplicate), "en", 20)).toThrow();
  });
  it("uses the native unrounded frame duration including submillisecond audio", () => {
    const duration = childNativeNarrationDurationMs(pcm(326));
    expect(duration).toBe(20.375);
    for (const declared of [19, 21]) {
      const bytes = encode({ ...provenance(), durationMs: declared });
      const check = () => validateChildNativeNarrationProvenance(bytes, asset(bytes), "en", duration);
      if (declared === 19) expect(check).toThrow(); else expect(check().durationMs).toBe(21);
    }
    const short = childNativeNarrationDurationMs(pcm(2)), bytes = encode({ ...provenance(), durationMs: 1 });
    expect(short).toBe(0.125);
    expect(validateChildNativeNarrationProvenance(bytes, asset(bytes), "en", short).durationMs).toBe(1);
    for (const value of [0, -1, NaN, Infinity, 60000.01])
      expect(() => validateChildNativeNarrationProvenance(bytes, asset(bytes), "en", value)).toThrow();
  });
  it("reads the PCM frame count and rejects truncated or ambiguous containers", () => {
    const bytes = pcm(); expect(childNativeNarrationDurationMs(bytes)).toBe(20);
    expect(() => childNativeNarrationDurationMs(bytes.subarray(0, bytes.length - 1))).toThrow();
    const noData = Buffer.from(bytes); noData.write("JUNK", 36); expect(() => childNativeNarrationDurationMs(noData)).toThrow();
    const invalid = Buffer.from(bytes); invalid.writeUInt16LE(0, 32); expect(() => childNativeNarrationDurationMs(invalid)).toThrow();
  });
});

describe("complete signed narration publisher output", () => {
  it("exports exact signed provenance and refuses its missing or altered bytes", async () => {
    const parent = path.resolve(".tmp"); await fs.mkdir(parent, { recursive: true });
    const root = await fs.mkdtemp(path.join(parent, "native-narration-test-"));
    const write = async (name, bytes) => { const target = path.join(root, name); await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(target, bytes); };
    try {
      // Disposable source copy contains only existing validators plus synthetic
      // keys/material. It never writes a production pin or licensed asset.
      await fs.cp(path.resolve("src"), path.join(root, "src"), { recursive: true });
      const now = 2_000_000, checksum = "a".repeat(64), transcript = "Synthetic English narration transcript only.";
      const quality = encode({ ...provenance(), scriptChecksum: sha(Buffer.from(transcript)) }), binary = pcm();
      const textPayload = { title: "Synthetic owner", text: "Synthetic current text.", terms: [], references: [] };
      const owner = { kind: "activity", id: "home", contentChecksum: sha(Buffer.from(JSON.stringify(textPayload))) };
      const payload = { role: "narration", altText: "Synthetic narration", transcript, scriptId: "synthetic-script",
        scriptChecksum: sha(Buffer.from(transcript)), performerId: "synthetic-performer", qualityChecksum: sha(quality) };
      const entity = { kind: "narration", id: "synthetic-audio", contentChecksum: sha(canonical(payload)) };
      const policy = reference => ({ id: reference.id, kind: reference.kind, sourceVersion: "synthetic-v1", policyVersion: "child-local-v2.1",
        minAge: 3, maxAge: 17, reviewStatus: "approved", localizedContent: [{ locale: "en", contentChecksum: reference.contentChecksum,
          reviewStatus: "approved", available: true, reviewerId: "synthetic-only", reviewedAt: now - 10 }], topics: [], topicTagsComplete: true,
        commercialAvailability: "included-in-base", rights: { status: "approved", basis: "original", platforms: ["android-google"],
          territories: ["RU"], validFrom: now - 100, expiresAt: now + 1000 } });
      const pack = { schemaVersion: 1, namespace: "child", packageId: "synthetic-package", packageVersion: 1, locale: "en", exactAge: 8,
        policyVersion: "child-local-v2.1", policyChecksum: checksum, validFromEpochMs: now - 100, validUntilEpochMs: now + 1000,
        home: owner, entities: [{ policy: policy(owner), payload: textPayload }] };
      const packageBytes = encode(pack), row = { assetId: "synthetic-audio", owner, entity, payload, policy: policy(entity),
        inventoryKey: "synthetic-audio.wav", sha256: sha(binary), bytes: binary.length, mime: "audio/wav" };
      const manifest = { schemaVersion: 2, kind: "literary-planet-child-native-media-manifest-v2", manifestId: "synthetic-media", manifestVersion: 1,
        packageId: pack.packageId, packageVersion: 1, packageChecksum: sha(packageBytes), policyVersion: pack.policyVersion, policyChecksum: checksum,
        locale: "en", exactAge: 8, readingLevels: [null], validFromEpochMs: now - 100, validUntilEpochMs: now + 1000, assets: [row] };
      const manifestBytes = encode(manifest);
      const signed = async (review, keyId, prefix) => {
        const pair = await webcrypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
        const key = { keyId, reviewerId: "synthetic-only", publicKeyX963Hex: Buffer.from(await webcrypto.subtle.exportKey("raw", pair.publicKey)).toString("hex") };
        review = { ...review, keyId, reviewerId: key.reviewerId };
        const signatureHex = Buffer.from(await webcrypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, pair.privateKey,
          Buffer.concat([Buffer.from(prefix), canonical(review)]))).toString("hex");
        return { key, bytes: encode({ ...review, signatureHex }) };
      };
      const common = { schemaVersion: 1, packageId: pack.packageId, packageVersion: 1, packageChecksum: sha(packageBytes), policyVersion: pack.policyVersion,
        policyChecksum: checksum, locale: "en", exactAge: 8, readingLevels: [null], platforms: ["android-google"], territories: ["RU"],
        reviewedAtEpochMs: now - 10, validFromEpochMs: now - 100, validUntilEpochMs: now + 1000 };
      const text = await signed({ ...common, kind: "literary-planet-child-release-review-v1", entityPolicyChecksums: [{ kind: owner.kind, id: owner.id,
        payloadChecksum: owner.contentChecksum, policyChecksum: sha(canonical(pack.entities[0].policy)) }] }, "child-release-review-narration-test", "LP-CHILD-RELEASE-REVIEW\0v1\0");
      const media = await signed({ ...common, schemaVersion: 2, kind: "literary-planet-child-native-media-review-v2", manifestId: manifest.manifestId,
        manifestVersion: 1, manifestChecksum: sha(manifestBytes), assetChecksums: [{ assetId: row.assetId, ownerChecksum: sha(canonical(owner)),
          entityChecksum: entity.contentChecksum, policyChecksum: sha(canonical(row.policy)), binaryChecksum: row.sha256, bytes: row.bytes, mime: row.mime }] },
      "child-media-review-narration-test", CHILD_NATIVE_MEDIA_REVIEW_PREFIX);
      const textPin = { packageId: pack.packageId, packageVersion: 1, packageChecksum: sha(packageBytes), reviewChecksum: sha(text.bytes) };
      const mediaPin = { ...textPin, manifestId: manifest.manifestId, manifestVersion: 1, manifestChecksum: sha(manifestBytes), reviewChecksum: sha(media.bytes) };
      await write("src/child/childNativeReleasePins.json", encode({ schemaVersion: 1, kind: "literary-planet-child-native-release-pins-v1", reviewKeys: [text.key], packages: [textPin] }));
      await write("src/child/childNativeMediaReleasePins.json", encode({ schemaVersion: 2, kind: "literary-planet-child-native-media-release-pins-v2", reviewKeys: [media.key], manifests: [mediaPin] }));
      await write("src/child/release-material/" + textPin.packageChecksum + "/package.json", packageBytes);
      await write("src/child/release-material/" + textPin.reviewChecksum + "/review.json", text.bytes);
      await write("src/child/media-release-material/" + mediaPin.manifestChecksum + "/manifest.json", manifestBytes);
      await write("src/child/media-release-material/" + mediaPin.reviewChecksum + "/review.json", media.bytes);
      await write("src/child/media-release-material/" + row.sha256 + "/asset.wav", binary);
      const qualityPath = "src/child/media-release-material/" + payload.qualityChecksum + "/quality.json";
      await expect(collectChildNativeMediaOutputs(root, "android", "googlePlay", now)).rejects.toThrow();
      await write(qualityPath, quality);
      const result = await collectChildNativeMediaOutputs(root, "android", "googlePlay", now);
      expect(result.outputs).toHaveLength(5);
      const output = result.outputs.find(value => value.output === "child-native/media/provenance/" + payload.qualityChecksum + ".json");
      expect(output).toMatchObject({ source: qualityPath, sourceSha256: sha(quality), outputSha256: sha(quality) });
      expect(output.bytes).toEqual(quality);
      await write(qualityPath, Buffer.concat([quality, Buffer.from(" ")]));
      await expect(collectChildNativeMediaOutputs(root, "android", "googlePlay", now)).rejects.toThrow("provenance bytes");
    } finally {
      if (path.dirname(root) !== parent || !path.basename(root).startsWith("native-narration-test-") || await fs.realpath(root) !== root)
        throw new Error("Unowned narration fixture cleanup");
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});