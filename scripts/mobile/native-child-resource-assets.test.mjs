import { afterEach, describe, expect, it } from "vitest";
import { createHash, webcrypto } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, rename, rm, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { assertChildNativeResourceMediaClosure, collectChildNativeResourceOutputs,
  emitChildNativeResourceAssets, normalizeChildNativeResourcePins, CHILD_NATIVE_RESOURCE_PIN_SOURCE,
  CHILD_NATIVE_RESOURCE_CATALOG, CHILD_NATIVE_RESOURCE_TRANSFORM } from "./native-child-resource-assets.mjs";
import { CHILD_NATIVE_MEDIA_PIN_SOURCE, CHILD_NATIVE_MEDIA_CATALOG,
  CHILD_NATIVE_MEDIA_REVIEW_PREFIX, childNativeMediaCanonical as canonical } from "./native-child-media-assets.mjs";
import { CHILD_NATIVE_PIN_SOURCE, CHILD_RELEASE_REVIEW_PREFIX } from "./native-child-package-assets.mjs";

// All nonempty bindings, keys, reviews, domains and binaries below are synthetic
// test material. They never approve release pins, provide a native claim, or use
// a network provider. Empty genuine source pins remain a negative admission.
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const json = value => Buffer.from(JSON.stringify(value) + "\n");
const now = 2_000_000;
const hash = digit => digit.repeat(64);
const temporary = [];
const empty = { schemaVersion: 2, kind: "literary-planet-child-native-resource-release-pins-v2", origins: [], resources: [] };
const emptyMedia = { schemaVersion: 2, kind: "literary-planet-child-native-media-release-pins-v2", reviewKeys: [], manifests: [] };
const emptyText = { schemaVersion: 1, kind: "literary-planet-child-native-release-pins-v1", reviewKeys: [], packages: [] };
const extension = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "audio/wav": "wav" };
function optionalPins() {
  const binding = { id: "fixture-resource", packageId: "fixture-owner", packageVersion: 1,
    packageChecksum: hash("a"), policyVersion: "child-local-v2.1", policyChecksum: hash("b"),
    manifestChecksum: hash("c"), reviewChecksum: hash("d"), assetId: "fixture-portrait", assetChecksum: hash("e"),
    assetBytes: 1, mime: "image/png", originId: "fixture-origin", path: "/objects/" + hash("e") + ".png",
    validFromEpochMs: now - 100, validUntilEpochMs: now + 1000 };
  return { ...empty, origins: [{ id: binding.originId, origin: "https://resource-fixture.invalid",
    tlsPublicKeyX963Checksums: [hash("f")] }], resources: [binding] };
}
async function rootFixture() {
  await mkdir(".tmp", { recursive: true });
  const root = await mkdtemp(path.resolve(".tmp/native-resource-test-")); temporary.push(root);
  // Use the actual source validators, not a test double of the schema/compiler.
  await mkdir(path.join(root, "src/child"), { recursive: true });
  for (const file of ["childNativeResource.ts", "childPackage.ts", "childAccessPolicy.ts", "childDataNamespace.ts",
    "childProfile.ts", "childMediaDecode.ts", "childMedia.ts", "childStaticSvg.ts"])
    await cp(path.resolve("src/child", file), path.join(root, "src/child", file));
  const write = async (name, bytes) => {
    const target = path.resolve(root, name);
    if (!target.startsWith(root + path.sep)) throw new Error("Unowned resource fixture write");
    await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, bytes);
  };
  // Copy the exact genuine default release-pin bytes. Nonempty test material
  // replaces only these owned temporary copies in reviewedFixture below.
  for (const name of [CHILD_NATIVE_RESOURCE_PIN_SOURCE, CHILD_NATIVE_MEDIA_PIN_SOURCE, CHILD_NATIVE_PIN_SOURCE])
    await write(name, await readFile(path.resolve(name)));
  return { root, write };
}
afterEach(async () => {
  for (const root of temporary.splice(0)) {
    if (path.dirname(root) !== path.resolve(".tmp") || !path.basename(root).startsWith("native-resource-test-"))
      throw new Error("Unowned resource fixture cleanup");
    await rm(root, { recursive: true, force: true });
  }
});

describe("native child fixed resource publisher", () => {
  it("projects genuine empty source bytes into one bounded catalog without admitting a remote asset", async () => {
    const f = await rootFixture(), source = await readFile(path.join(f.root, CHILD_NATIVE_RESOURCE_PIN_SOURCE));
    expect(JSON.parse(source)).toEqual(empty);
    const result = await collectChildNativeResourceOutputs(f.root, "android", "dev", now);
    const expected = json({ schemaVersion: 2, kind: "literary-planet-child-native-resource-catalog-v2",
      platform: null, resourcePinSourceChecksum: sha(source), origins: [], resources: [] });
    expect(result.pinSource).toEqual({ path: CHILD_NATIVE_RESOURCE_PIN_SOURCE, sha256: sha(source) });
    expect(result.outputs).toHaveLength(1);
    expect(result.outputs[0]).toEqual({ output: CHILD_NATIVE_RESOURCE_CATALOG, source: CHILD_NATIVE_RESOURCE_PIN_SOURCE,
      sourceSha256: sha(source), transformation: CHILD_NATIVE_RESOURCE_TRANSFORM, outputSha256: sha(expected), bytes: expected });
    expect(expected.length).toBeLessThanOrEqual(524288);
    expect(JSON.parse(expected).resources).toEqual([]);
  });
  it("binds raw source SHA even when harmless whitespace leaves the fixed pin semantics unchanged", async () => {
    const f = await rootFixture(), original = await collectChildNativeResourceOutputs(f.root, "android", "dev", now);
    const authentic = await readFile(path.join(f.root, CHILD_NATIVE_RESOURCE_PIN_SOURCE));
    const changed = Buffer.concat([Buffer.from(" \n"), authentic]);
    await f.write(CHILD_NATIVE_RESOURCE_PIN_SOURCE, changed);
    const result = await collectChildNativeResourceOutputs(f.root, "android", "dev", now);
    expect(result.pinSource.sha256).toBe(sha(changed));
    expect(result.pinSource.sha256).not.toBe(original.pinSource.sha256);
    expect(result.outputs[0].sourceSha256).toBe(sha(changed));
    expect(result.outputs[0].outputSha256).not.toBe(original.outputs[0].outputSha256);
    expect(JSON.parse(result.outputs[0].bytes)).toMatchObject({ origins: [], resources: [], resourcePinSourceChecksum: sha(changed) });
  });
  it.each([["ios", "appStore", "ios-ipados"], ["android", "googlePlay", "android-google"],
    ["android", "ruStore", "android-rustore"]])("binds the empty projection to the exact %s/%s audience", async (platform, channel, selected) => {
    const f = await rootFixture(), result = await collectChildNativeResourceOutputs(f.root, platform, channel, now);
    expect(JSON.parse(result.outputs[0].bytes).platform).toBe(selected);
    expect(result.outputs).toHaveLength(1);
  });
  it("requires the real empty media inventory even when remote source pins are empty", async () => {
    const f = await rootFixture();
    await f.write(CHILD_NATIVE_MEDIA_PIN_SOURCE, json({ ...emptyMedia, approved: true }));
    await expect(collectChildNativeResourceOutputs(f.root, "android", "dev", now)).rejects.toThrow();
  });
  it("rejects duplicated escaped JSON fields and caller-generated permission fields", async () => {
    const f = await rootFixture();
    await expect(normalizeChildNativeResourcePins(Buffer.from('{"schemaVersion":2,"schema\\u0056ersion":2,"kind":"literary-planet-child-native-resource-release-pins-v2","origins":[],"resources":[]}'), f.root)).rejects.toThrow("Duplicate");
    for (const field of ["profileId", "approved", "url", "permission", "resourcePinSourceChecksum"])
      await expect(normalizeChildNativeResourcePins(json({ ...empty, [field]: "caller-supplied" }), f.root)).rejects.toThrow();
  });
  it("accepts a fixed transport schema without treating it as media or native permission", async () => {
    const f = await rootFixture(), pins = optionalPins();
    await expect(normalizeChildNativeResourcePins(json(pins), f.root)).resolves.toEqual(pins);
    await f.write(CHILD_NATIVE_RESOURCE_PIN_SOURCE, json(pins));
    await expect(collectChildNativeResourceOutputs(f.root, "android", "googlePlay", now)).rejects.toThrow("pinned manifest/review/package");
    await expect(collectChildNativeResourceOutputs(f.root, "android", "dev", now)).rejects.toThrow("unselected");
  });
  it("refuses ambiguous origin identity and duplicate package-asset binding inventory", async () => {
    const f = await rootFixture(), pins = optionalPins(), origin = pins.origins[0], binding = pins.resources[0];
    const malformed = [
      { ...pins, origins: [origin, { ...origin, id: "second-origin" }] },
      { ...pins, origins: [origin, { ...origin, origin: "https://second-fixture.invalid" }] },
      { ...pins, resources: [binding, { ...binding, id: "second-resource" }] },
      { ...pins, resources: [binding, { ...binding, assetId: "second-asset" }] },
      { ...pins, resources: [{ ...binding, originId: "missing-origin" }] },
      { ...pins, resources: [] },
    ];
    for (const candidate of malformed)
      await expect(normalizeChildNativeResourcePins(json(candidate), f.root)).rejects.toThrow();
  });
});

// A complete test-only original text owner, independent P-256 text/media
// reviews and valid PNG go through the genuine production collectors.
function reviewedMaterial(options = {}) {
  const payload = { title: "Synthetic fixture owner", text: "Original test text", terms: [], references: [] };
  const owner = { kind: "activity", id: "fixture-home", contentChecksum: sha(Buffer.from(JSON.stringify(payload))) };
  const mediaPayload = { role: "portrait", altText: "Synthetic fixture portrait", transcript: null,
    scriptId: null, scriptChecksum: null, performerId: null, qualityChecksum: null };
  const entity = { kind: "image", id: "fixture-image", contentChecksum: sha(canonical(mediaPayload)) };
  function policy(reference) {
    return { id: reference.id, kind: reference.kind, sourceVersion: "fixture-source", policyVersion: "child-local-v2.1",
      minAge: 3, maxAge: 17, reviewStatus: "approved", localizedContent: [{ locale: "en",
        contentChecksum: reference.contentChecksum, reviewStatus: "approved", available: true,
        reviewerId: "human-fixture-only", reviewedAt: now - 10 }], topics: [], topicTagsComplete: true,
      commercialAvailability: "included-in-base", rights: { status: "approved", basis: "original",
        platforms: ["android-google"], territories: ["RU"], validFrom: options.rightsFrom ?? now - 100, expiresAt: options.rightsUntil ?? now + 600 } };
  }
  const pack = { schemaVersion: 1, namespace: "child", packageId: options.packageId ?? "fixture-owner", packageVersion: 1,
    locale: "en", exactAge: 8, policyVersion: "child-local-v2.1", policyChecksum: hash("b"),
    validFromEpochMs: now - 100, validUntilEpochMs: now + 1000, home: owner,
    entities: [{ policy: policy(owner), payload }] };
  const packageBytes = json(pack);
  const binary = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=", "base64");
  const asset = { assetId: "fixture-portrait", owner, entity, payload: mediaPayload, policy: policy(entity),
    inventoryKey: "fixture-portrait.png", sha256: sha(binary), bytes: binary.length, mime: "image/png" };
  const manifest = { schemaVersion: 2, kind: "literary-planet-child-native-media-manifest-v2", manifestId: "fixture-media",
    manifestVersion: 1, packageId: pack.packageId, packageVersion: pack.packageVersion, packageChecksum: sha(packageBytes),
    policyVersion: pack.policyVersion, policyChecksum: pack.policyChecksum, locale: "en", exactAge: 8, readingLevels: [null],
    validFromEpochMs: options.manifestFrom ?? now - 90, validUntilEpochMs: options.manifestUntil ?? now + 800, assets: [asset] };
  return { pack, packageBytes, manifest, manifestBytes: json(manifest), asset, binary };
}
async function signReview(review, keyId, prefix) {
  const pair = await webcrypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const key = { keyId, reviewerId: "human-fixture-only",
    publicKeyX963Hex: Buffer.from(await webcrypto.subtle.exportKey("raw", pair.publicKey)).toString("hex") };
  const unsigned = { ...review, keyId, reviewerId: key.reviewerId };
  const signature = await webcrypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, pair.privateKey,
    Buffer.concat([Buffer.from(prefix), canonical(unsigned)]));
  const signed = { ...unsigned, signatureHex: Buffer.from(signature).toString("hex") };
  return { keys: [key], review: signed, bytes: json(signed) };
}
async function reviewedFixture(options = {}) {
  const f = await rootFixture(), m = reviewedMaterial(options);
  const text = await signReview({ schemaVersion: 1, kind: "literary-planet-child-release-review-v1",
    packageId: m.pack.packageId, packageVersion: m.pack.packageVersion, packageChecksum: sha(m.packageBytes),
    policyVersion: m.pack.policyVersion, policyChecksum: m.pack.policyChecksum, locale: "en", exactAge: 8,
    readingLevels: [null], platforms: ["android-google"], territories: ["RU"], reviewedAtEpochMs: now - 10,
    validFromEpochMs: now - 100, validUntilEpochMs: now + 1000,
    entityPolicyChecksums: [{ kind: m.asset.owner.kind, id: m.asset.owner.id,
      payloadChecksum: m.asset.owner.contentChecksum, policyChecksum: sha(canonical(m.pack.entities[0].policy)) }] },
  "child-release-review-resource-fixture-only", CHILD_RELEASE_REVIEW_PREFIX);
  const media = await signReview({ schemaVersion: 2, kind: "literary-planet-child-native-media-review-v2",
    manifestId: m.manifest.manifestId, manifestVersion: m.manifest.manifestVersion, manifestChecksum: sha(m.manifestBytes),
    packageId: m.pack.packageId, packageVersion: m.pack.packageVersion, packageChecksum: sha(m.packageBytes),
    policyVersion: m.manifest.policyVersion, policyChecksum: m.manifest.policyChecksum, locale: "en", exactAge: 8,
    readingLevels: [null], platforms: ["android-google"], territories: ["RU"], reviewedAtEpochMs: now - 10,
    validFromEpochMs: options.reviewFrom ?? now - 80, validUntilEpochMs: options.reviewUntil ?? now + 700,
    assetChecksums: [{ assetId: m.asset.assetId, ownerChecksum: sha(canonical(m.asset.owner)),
      entityChecksum: m.asset.entity.contentChecksum, policyChecksum: sha(canonical(m.asset.policy)),
      binaryChecksum: m.asset.sha256, bytes: m.asset.bytes, mime: m.asset.mime }] },
  "child-media-review-resource-fixture-only", CHILD_NATIVE_MEDIA_REVIEW_PREFIX);
  const textPin = { packageId: m.pack.packageId, packageVersion: m.pack.packageVersion,
    packageChecksum: sha(m.packageBytes), reviewChecksum: sha(text.bytes) };
  const mediaPin = { manifestId: m.manifest.manifestId, manifestVersion: m.manifest.manifestVersion,
    manifestChecksum: sha(m.manifestBytes), reviewChecksum: sha(media.bytes),
    packageId: m.pack.packageId, packageVersion: m.pack.packageVersion, packageChecksum: sha(m.packageBytes) };
  const pins = optionalPins();
  Object.assign(pins.resources[0], { packageId: m.pack.packageId, packageVersion: m.pack.packageVersion,
    packageChecksum: sha(m.packageBytes), policyVersion: m.pack.policyVersion, policyChecksum: m.pack.policyChecksum,
    manifestChecksum: mediaPin.manifestChecksum, reviewChecksum: mediaPin.reviewChecksum,
    assetId: m.asset.assetId, assetChecksum: m.asset.sha256, assetBytes: m.asset.bytes, mime: m.asset.mime,
    path: "/objects/" + m.asset.sha256 + ".png", validFromEpochMs: now - 70, validUntilEpochMs: now + 500 });
  const sources = {
    package: "src/child/release-material/" + textPin.packageChecksum + "/package.json",
    textReview: "src/child/release-material/" + textPin.reviewChecksum + "/review.json",
    manifest: "src/child/media-release-material/" + mediaPin.manifestChecksum + "/manifest.json",
    mediaReview: "src/child/media-release-material/" + mediaPin.reviewChecksum + "/review.json",
    binary: "src/child/media-release-material/" + m.asset.sha256 + "/asset.png",
  };
  await f.write(CHILD_NATIVE_PIN_SOURCE, json({ ...emptyText, reviewKeys: text.keys, packages: [textPin] }));
  await f.write(CHILD_NATIVE_MEDIA_PIN_SOURCE, json({ ...emptyMedia, reviewKeys: media.keys, manifests: [mediaPin] }));
  await f.write(CHILD_NATIVE_RESOURCE_PIN_SOURCE, json(pins));
  for (const [name, bytes] of [[sources.package, m.packageBytes], [sources.textReview, text.bytes],
    [sources.manifest, m.manifestBytes], [sources.mediaReview, media.bytes], [sources.binary, m.binary]])
    await f.write(name, bytes);
  return { ...f, m, text, media, textPin, mediaPin, pins, sources };
}


// Two independently reviewed 256-asset manifests keep each actual media
// document bounded while exercising the complete 512-resource catalog boundary.
async function catalogBoundaryFixture() {
  const f = await reviewedFixture({ packageId: "fixture-owner-".padEnd(96, "p") });
  const base = f.pins.resources[0], origins = [{ ...f.pins.origins[0], id: "fixture-origin-".padEnd(96, "o") }];
  const resources = [], reviewKeys = [], manifests = [];
  const { signatureHex, keyId, reviewerId, ...reviewBase } = f.media.review;
  for (let group = 0; group < 2; group++) {
    const assets = Array.from({ length: 256 }, (_, offset) => {
      const index = group * 256 + offset, entity = { ...f.m.asset.entity, id: "fixture-image-" + index };
      return { ...f.m.asset, assetId: ("fixture-asset-" + String(index).padStart(3, "0")).padEnd(64, "a"),
        entity, policy: { ...f.m.asset.policy, id: entity.id } };
    });
    const manifest = { ...f.m.manifest, manifestId: "fixture-boundary-media-" + group, assets };
    const manifestBytes = json(manifest), manifestChecksum = sha(manifestBytes);
    const signed = await signReview({ ...reviewBase, manifestId: manifest.manifestId, manifestChecksum,
      assetChecksums: assets.map(asset => ({ assetId: asset.assetId, ownerChecksum: sha(canonical(asset.owner)),
        entityChecksum: asset.entity.contentChecksum, policyChecksum: sha(canonical(asset.policy)),
        binaryChecksum: asset.sha256, bytes: asset.bytes, mime: asset.mime })) },
    "child-media-review-catalog-boundary-fixture-" + group, CHILD_NATIVE_MEDIA_REVIEW_PREFIX);
    const reviewChecksum = sha(signed.bytes);
    expect(manifestBytes.length).toBeLessThanOrEqual(524288);
    expect(signed.bytes.length).toBeLessThanOrEqual(524288);
    await f.write("src/child/media-release-material/" + manifestChecksum + "/manifest.json", manifestBytes);
    await f.write("src/child/media-release-material/" + reviewChecksum + "/review.json", signed.bytes);
    reviewKeys.push(...signed.keys);
    manifests.push({ ...f.mediaPin, manifestId: manifest.manifestId, manifestChecksum, reviewChecksum });
    for (const asset of assets) resources.push({ ...base, id: "r" + String(resources.length).padStart(3, "0"),
      assetId: asset.assetId, originId: origins[0].id, manifestChecksum, reviewChecksum });
  }
  await f.write(CHILD_NATIVE_MEDIA_PIN_SOURCE, json({ ...emptyMedia, reviewKeys, manifests }));
  return { ...f, pins: { ...f.pins, origins, resources } };
}

describe("native child resource independent media closure", () => {
  it("accepts an exact 524288-byte reviewed catalog and refuses its first excess byte while source pins still fit", async () => {
    const f = await catalogBoundaryFixture(), pins = f.pins;
    // Size the actual closed fixture, not a mock of the collector. The SHA
    // placeholder has the same fixed 64-byte spelling as the real source SHA.
    const projectedBytes = () => json({ schemaVersion: 2, kind: "literary-planet-child-native-resource-catalog-v2",
      platform: "android-google", resourcePinSourceChecksum: hash("0"), origins: pins.origins, resources: pins.resources }).length;
    let padding = 524288 - projectedBytes();
    expect(padding).toBeGreaterThanOrEqual(0);
    for (const binding of pins.resources) {
      const added = Math.min(padding, 96 - binding.id.length); binding.id += "r".repeat(added); padding -= added;
    }
    expect(padding).toBe(0);
    expect(projectedBytes()).toBe(524288);
    const exactSource = json(pins);
    expect(exactSource.length).toBeLessThanOrEqual(524288);
    await f.write(CHILD_NATIVE_RESOURCE_PIN_SOURCE, exactSource);
    const exact = await collectChildNativeResourceOutputs(f.root, "android", "googlePlay", now);
    expect(exact.outputs[0].bytes.length).toBe(524288);
    expect(exact.outputs[0].outputSha256).toBe(sha(exact.outputs[0].bytes));
    const extensible = pins.resources.find(binding => binding.id.length < 96);
    expect(extensible).toBeDefined(); extensible.id += "r";
    const excessSource = json(pins);
    expect(excessSource.length).toBe(exactSource.length + 1);
    expect(excessSource.length).toBeLessThanOrEqual(524288);
    expect(projectedBytes()).toBe(524289);
    await expect(normalizeChildNativeResourcePins(excessSource, f.root)).resolves.toEqual(pins);
    await f.write(CHILD_NATIVE_RESOURCE_PIN_SOURCE, excessSource);
    await expect(collectChildNativeResourceOutputs(f.root, "android", "googlePlay", now)).rejects.toThrow("bounded resource catalog");
  }, 30_000);
  it("projects only an actually collected independently reviewed owner/media/binary tuple", async () => {
    const f = await reviewedFixture(), result = await collectChildNativeResourceOutputs(f.root, "android", "googlePlay", now);
    expect(result.outputs).toHaveLength(1);
    const catalog = JSON.parse(result.outputs[0].bytes);
    expect(catalog.platform).toBe("android-google");
    expect(catalog.resources).toEqual(f.pins.resources);
    expect(catalog.origins).toEqual(f.pins.origins);
    expect(result.outputs[0].sourceSha256).toBe(sha(json(f.pins)));
    expect(result.outputs[0].outputSha256).toBe(sha(result.outputs[0].bytes));
    expect(result.outputs[0].bytes.length).toBeLessThanOrEqual(524288);
  });
  it("refuses each substituted package/review/policy/asset identity despite well-formed transport pins", async () => {
    const f = await reviewedFixture(), binding = f.pins.resources[0];
    const changes = [{ packageId: "another-owner" }, { packageVersion: 2 }, { packageChecksum: hash("1") },
      { manifestChecksum: hash("2") }, { reviewChecksum: hash("3") }, { policyVersion: "another-policy" },
      { policyChecksum: hash("4") }, { assetId: "another-asset" },
      { assetChecksum: hash("5"), path: "/objects/" + hash("5") + ".png" }, { assetBytes: binding.assetBytes + 1 },
      { mime: "image/jpeg", path: "/objects/" + binding.assetChecksum + ".jpg" }];
    for (const change of changes) {
      const candidate = { ...f.pins, resources: [{ ...binding, ...change }] };
      await expect(normalizeChildNativeResourcePins(json(candidate), f.root)).resolves.toEqual(candidate);
      await f.write(CHILD_NATIVE_RESOURCE_PIN_SOURCE, json(candidate));
      await expect(collectChildNativeResourceOutputs(f.root, "android", "googlePlay", now)).rejects.toThrow();
    }
  });
  it.each(["package", "textReview", "manifest", "mediaReview", "binary"])
    ("refuses changed independently pinned %s bytes before a resource catalog exists", async name => {
      const f = await reviewedFixture(), bytes = await readFile(path.join(f.root, f.sources[name]));
      await f.write(f.sources[name], Buffer.concat([bytes, Buffer.from(" ")]));
      await expect(collectChildNativeResourceOutputs(f.root, "android", "googlePlay", now)).rejects.toThrow();
    });
  it("does not accept a media release pin after its independent text owner is removed", async () => {
    const f = await reviewedFixture(); await f.write(CHILD_NATIVE_PIN_SOURCE, json(emptyText));
    await expect(collectChildNativeResourceOutputs(f.root, "android", "googlePlay", now)).rejects.toThrow("text owner");
  });
  it("does not accept signed media bytes after the fixed independent reviewer key is removed", async () => {
    const f = await reviewedFixture();
    await f.write(CHILD_NATIVE_MEDIA_PIN_SOURCE, json({ ...emptyMedia, reviewKeys: f.text.keys, manifests: [f.mediaPin] }));
    await expect(collectChildNativeResourceOutputs(f.root, "android", "googlePlay", now)).rejects.toThrow();
  });
  it("restricts transport lifetime to the intersection of manifest, independent review and asset rights", async () => {
    const f = await reviewedFixture(), binding = f.pins.resources[0];
    const accepted = { ...f.pins, resources: [{ ...binding, validFromEpochMs: now - 80, validUntilEpochMs: now + 600 }] };
    await f.write(CHILD_NATIVE_RESOURCE_PIN_SOURCE, json(accepted));
    await expect(collectChildNativeResourceOutputs(f.root, "android", "googlePlay", now)).resolves.toHaveProperty("outputs");
    for (const change of [{ validFromEpochMs: now - 81 }, { validUntilEpochMs: now + 601 },
      { validFromEpochMs: now + 1 }, { validUntilEpochMs: now }]) {
      await f.write(CHILD_NATIVE_RESOURCE_PIN_SOURCE, json({ ...f.pins, resources: [{ ...binding, ...change }] }));
      await expect(collectChildNativeResourceOutputs(f.root, "android", "googlePlay", now)).rejects.toThrow();
    }
  });
  it("enforces each authentic signed manifest/review/rights boundary independently", async () => {
    for (const options of [{ manifestUntil: now + 400 }, { reviewUntil: now + 400 }, { rightsUntil: now + 400 },
      { manifestFrom: now - 60 }, { reviewFrom: now - 60 }, { rightsFrom: now - 60 }]) {
      const f = await reviewedFixture(options);
      await expect(collectChildNativeResourceOutputs(f.root, "android", "googlePlay", now)).rejects.toThrow("rights lifetime");
      const shorter = { ...f.pins, resources: [{ ...f.pins.resources[0], validFromEpochMs: now - 60, validUntilEpochMs: now + 400 }] };
      await f.write(CHILD_NATIVE_RESOURCE_PIN_SOURCE, json(shorter));
      await expect(collectChildNativeResourceOutputs(f.root, "android", "googlePlay", now)).resolves.toHaveProperty("outputs");
    }
  });
  it("requires actual manifest, review and exact binary inventory bytes rather than provenance labels", async () => {
    const f = await reviewedFixture();
    const { collectChildNativeMediaOutputs } = await import("./native-child-media-assets.mjs");
    const original = await collectChildNativeMediaOutputs(f.root, "android", "googlePlay", now);
    for (const row of original.outputs) {
      expect(() => assertChildNativeResourceMediaClosure(f.pins.resources[0],
        { outputs: original.outputs.filter(candidate => candidate !== row) })).toThrow();
      const changed = { ...row, bytes: Buffer.concat([row.bytes, Buffer.from([0])]) };
      expect(() => assertChildNativeResourceMediaClosure(f.pins.resources[0],
        { outputs: original.outputs.map(candidate => candidate === row ? changed : candidate) })).toThrow();
    }
  });
});

describe("native child resource fixed origin, URL and input bounds", () => {
  it("allows only canonical HTTPS DNS origins without ports, credentials or local addresses", async () => {
    const f = await rootFixture(), pins = optionalPins();
    for (const origin of ["http://resource-fixture.invalid", "https://Resource-fixture.invalid", "https://resource-fixture.invalid/",
      "https://resource-fixture.invalid:443", "https://resource-fixture.invalid:8443", "https://user:pass@resource-fixture.invalid",
      "https://resource-fixture.invalid?grant=1", "https://resource-fixture.invalid#grant", "https://resource-fixture.invalid/path",
      "https://localhost", "https://fixture.local", "https://fixture.internal", "https://fixture.lan", "https://fixture.home",
      "https://127.0.0.1", "https://169.254.169.254", "https://[::1]", "https://fixture..invalid", "https://-fixture.invalid",
      "https://fixture-.invalid", "https://fixture.invalid.", "https://fixture%2einvalid", "https://fixture\\invalid"])
      await expect(normalizeChildNativeResourcePins(json({ ...pins, origins: [{ ...pins.origins[0], origin }] }), f.root)).rejects.toThrow();
  });
  it("requires one to four unique lower-case SHA256 TLS X963 key checksums", async () => {
    const f = await rootFixture(), pins = optionalPins();
    const accepted = { ...pins, origins: [{ ...pins.origins[0], tlsPublicKeyX963Checksums: [hash("1"), hash("2"), hash("3"), hash("4")] }] };
    await expect(normalizeChildNativeResourcePins(json(accepted), f.root)).resolves.toEqual(accepted);
    for (const keys of [[], [hash("1"), hash("1")], ["04" + "1".repeat(128)], ["A".repeat(64)], ["1".repeat(63)],
      [hash("1"), hash("2"), hash("3"), hash("4"), hash("5")]])
      await expect(normalizeChildNativeResourcePins(json({ ...pins, origins: [{ ...pins.origins[0], tlsPublicKeyX963Checksums: keys }] }), f.root)).rejects.toThrow();
  });
  it("requires the exact content-addressed MIME path and fixed binary checksum", async () => {
    const f = await rootFixture(), pins = optionalPins(), binding = pins.resources[0];
    for (const value of ["../asset.png", "/objects/../asset.png", "/objects/" + binding.assetChecksum + ".jpg",
      "/objects/" + binding.assetChecksum + ".png?grant=1", "/objects/" + binding.assetChecksum + ".png#fragment",
      "https://resource-fixture.invalid" + binding.path, binding.path.replace("/objects/", "/objects/%2e%2e/"),
      binding.path.replace("/objects/", "\\objects\\"), "/objects/" + binding.assetChecksum.toUpperCase() + ".png"])
      await expect(normalizeChildNativeResourcePins(json({ ...pins, resources: [{ ...binding, path: value }] }), f.root)).rejects.toThrow();
    for (const change of [{ assetChecksum: "E".repeat(64) }, { assetChecksum: "e".repeat(63) },
      { packageChecksum: "not-a-sha" }, { policyChecksum: "B".repeat(64) }, { mime: "image/svg+xml" }, { mime: "text/html" },
      { packageVersion: 0 }, { assetBytes: 0 }, { validFromEpochMs: now, validUntilEpochMs: now }])
      await expect(normalizeChildNativeResourcePins(json({ ...pins, resources: [{ ...binding, ...change }] }), f.root)).rejects.toThrow();
  });
  it("enforces the exact encoded raster and audio byte ceilings before any collection", async () => {
    const f = await rootFixture(), pins = optionalPins();
    for (const [mime, ceiling] of [["image/png", 33554432], ["image/jpeg", 33554432], ["image/webp", 33554432], ["audio/wav", 25165824]]) {
      const binding = { ...pins.resources[0], mime, assetBytes: ceiling,
        path: "/objects/" + pins.resources[0].assetChecksum + "." + extension[mime] };
      await expect(normalizeChildNativeResourcePins(json({ ...pins, resources: [binding] }), f.root)).resolves.toHaveProperty("resources");
      await expect(normalizeChildNativeResourcePins(json({ ...pins, resources: [{ ...binding, assetBytes: ceiling + 1 }] }), f.root)).rejects.toThrow();
    }
  });
  it("bounds complete source inventory to eight used origins and 512 unique package-asset tuples", async () => {
    const f = await rootFixture(), pins = optionalPins();
    const origins = Array.from({ length: 8 }, (_, i) => ({ ...pins.origins[0], id: "fixture-origin-" + i,
      origin: "https://fixture-" + i + ".invalid" }));
    const resources = Array.from({ length: 512 }, (_, i) => ({ ...pins.resources[0], id: "fixture-resource-" + i,
      assetId: "fixture-asset-" + i, originId: origins[i % origins.length].id }));
    const accepted = { ...pins, origins, resources };
    expect(json(accepted).length).toBeLessThanOrEqual(524288);
    await expect(normalizeChildNativeResourcePins(json(accepted), f.root)).resolves.toHaveProperty("resources.length", 512);
    await expect(normalizeChildNativeResourcePins(json({ ...accepted,
      resources: [...resources, { ...resources[0], id: "extra-resource", assetId: "extra-asset" }] }), f.root)).rejects.toThrow();
    await expect(normalizeChildNativeResourcePins(json({ ...accepted,
      origins: [...origins, { ...origins[0], id: "extra-origin", origin: "https://extra-fixture.invalid" }],
      resources: resources.map((binding, i) => i === 0 ? { ...binding, originId: "extra-origin" } : binding) }), f.root)).rejects.toThrow();
  });
  it("rejects malformed, empty, oversized, invalid UTF8 and noncanonical integer source bytes", async () => {
    const f = await rootFixture();
    const candidates = [Buffer.alloc(0), Buffer.alloc(524289, 0x20), Buffer.from([0xc3, 0x28]),
      Buffer.from('{"schemaVersion":2.0,"kind":"literary-planet-child-native-resource-release-pins-v2","origins":[],"resources":[]}'),
      Buffer.from('{"schemaVersion":2e0,"kind":"literary-planet-child-native-resource-release-pins-v2","origins":[],"resources":[]}'),
      Buffer.from('{"schemaVersion":2,"kind":"literary-planet-child-native-resource-release-pins-v2","origins":[],"resources":[]} garbage')];
    for (const bytes of candidates) {
      await f.write(CHILD_NATIVE_RESOURCE_PIN_SOURCE, bytes);
      await expect(collectChildNativeResourceOutputs(f.root, "android", "dev", now)).rejects.toThrow();
    }
  });
  it("rejects invalid current time and unselected platform/channel pairs", async () => {
    const f = await rootFixture();
    for (const value of [-1, -0, 0.5, Number.NaN, Number.POSITIVE_INFINITY, 8640000000000001])
      await expect(collectChildNativeResourceOutputs(f.root, "android", "dev", value)).rejects.toThrow("current source time");
    for (const [platform, channel] of [["android", "appStore"], ["ios", "googlePlay"], ["web", "production"], ["ios", "unknown"], ["web", "dev"], [undefined, "dev"], [null, "dev"], [false, "dev"], [new String("android"), "dev"]])
      await expect(collectChildNativeResourceOutputs(f.root, platform, channel, now)).rejects.toThrow("unselected");
  });
});

describe("native child resource source and output ownership", () => {
  it("writes only the fixed catalog once and returns byte-free exact provenance", async () => {
    const f = await rootFixture(), staging = path.join(f.root, "stage"); await mkdir(staging);
    const expected = await collectChildNativeResourceOutputs(f.root, "ios", "dev", now);
    const result = await emitChildNativeResourceAssets(f.root, staging, "ios", "dev");
    expect(result.pinSource).toEqual(expected.pinSource);
    expect(result.outputs).toEqual(expected.outputs.map(({ bytes, ...row }) => row));
    expect(result.outputs[0]).not.toHaveProperty("bytes");
    const catalog = path.join(staging, CHILD_NATIVE_RESOURCE_CATALOG);
    expect(await readFile(catalog)).toEqual(expected.outputs[0].bytes);
    await expect(emitChildNativeResourceAssets(f.root, staging, "ios", "dev")).rejects.toThrow();
    expect(await readFile(catalog)).toEqual(expected.outputs[0].bytes);
  });
  it("preserves a pre-existing fixed output instead of overwriting it", async () => {
    const f = await rootFixture(), staging = path.join(f.root, "stage"), target = path.join(staging, CHILD_NATIVE_RESOURCE_CATALOG);
    await mkdir(path.dirname(target), { recursive: true }); const sentinel = Buffer.from("owned-existing-output");
    await writeFile(target, sentinel);
    await expect(emitChildNativeResourceAssets(f.root, staging, "android", "dev")).rejects.toThrow();
    expect(await readFile(target)).toEqual(sentinel);
  });
  it("refuses a linked pin-source parent even when linked bytes contain valid empty pins", async () => {
    const f = await rootFixture(), child = path.join(f.root, "src/child"), actual = path.join(f.root, "src/child-owned");
    await rename(child, actual); await symlink(actual, child, process.platform === "win32" ? "junction" : "dir");
    await expect(collectChildNativeResourceOutputs(f.root, "android", "dev", now)).rejects.toThrow("unlinked source");
  });
  it("refuses an aliased staging root rather than writing through its link", async () => {
    const f = await rootFixture(), staging = path.join(f.root, "stage"), alias = path.join(f.root, "stage-alias");
    await mkdir(staging); await symlink(staging, alias, process.platform === "win32" ? "junction" : "dir");
    await expect(emitChildNativeResourceAssets(f.root, alias, "android", "dev")).rejects.toThrow("owned actual staging");
  });
  it("refuses a linked output directory and leaves its owned target untouched", async () => {
    const f = await rootFixture(), staging = path.join(f.root, "stage"), target = path.join(f.root, "linked-target");
    await mkdir(path.join(staging, "child-native"), { recursive: true }); await mkdir(target);
    const sentinel = path.join(target, "sentinel"); await writeFile(sentinel, "unchanged");
    await symlink(target, path.join(staging, "child-native/resources"), process.platform === "win32" ? "junction" : "dir");
    await expect(emitChildNativeResourceAssets(f.root, staging, "android", "dev")).rejects.toThrow("owned resource output directory");
    expect(await readFile(sentinel, "utf8")).toBe("unchanged");
    await expect(readFile(path.join(target, "catalog-v2.json"))).rejects.toThrow();
  });
});
