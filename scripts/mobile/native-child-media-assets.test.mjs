import { afterEach, describe, expect, it } from "vitest";
import { createHash, webcrypto } from "node:crypto";
import { mkdtemp, mkdir, writeFile, readFile, rm, cp } from "node:fs/promises";
import path from "node:path";
import { normalizeChildNativeMediaPins, validateChildNativeMediaManifest, verifyChildNativeMediaReview,
  collectChildNativeMediaOutputs, emitChildNativeMediaAssets, CHILD_NATIVE_MEDIA_PIN_SOURCE,
  CHILD_NATIVE_MEDIA_CATALOG, CHILD_NATIVE_MEDIA_REVIEW_PREFIX, childNativeMediaCanonical as canonical } from "./native-child-media-assets.mjs";
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const json = value => Buffer.from(JSON.stringify(value) + "\n");
const now = 2_000_000, hash = "a".repeat(64), temporary = [];
const empty = { schemaVersion: 2, kind: "literary-planet-child-native-media-release-pins-v2", reviewKeys: [], manifests: [] };
function material() {
  const payload = { title: "Reviewed owner", text: "Original text", terms: [], references: [] };
  const owner = { kind: "activity", id: "home", contentChecksum: sha(Buffer.from(JSON.stringify(payload))) };
  const mediaPayload = { role: "portrait", altText: "Reviewed portrait", transcript: null, scriptId: null,
    scriptChecksum: null, performerId: null, qualityChecksum: null };
  const entity = { kind: "image", id: "portrait", contentChecksum: sha(canonical(mediaPayload)) };
  function policy(kind, id, checksum) { return { id, kind, sourceVersion: "source1", policyVersion: "child-local-v2.1",
    minAge: 3, maxAge: 17, reviewStatus: "approved", localizedContent: [{ locale: "en", contentChecksum: checksum,
      reviewStatus: "approved", available: true, reviewerId: "human-fixture-only", reviewedAt: now - 10 }],
    topics: [], topicTagsComplete: true, commercialAvailability: "included-in-base", rights: { status: "approved",
      basis: "original", platforms: ["android-google"], territories: ["RU"], validFrom: now - 100, expiresAt: now + 1000 } }; }
  const pack = { schemaVersion: 1, namespace: "child", packageId: "owner-package", packageVersion: 1,
    locale: "en", exactAge: 8, policyVersion: "child-local-v2.1", policyChecksum: hash,
    validFromEpochMs: now - 100, validUntilEpochMs: now + 1000, home: owner,
    entities: [{ policy: policy(owner.kind, owner.id, owner.contentChecksum), payload }] };
  const packageBytes = json(pack), binary = Buffer.from("independent source fixture bytes");
  const asset = { assetId: "portrait1", owner, entity, payload: mediaPayload, policy: policy(entity.kind, entity.id, entity.contentChecksum),
    inventoryKey: "portrait.png", sha256: sha(binary), bytes: binary.length, mime: "image/png" };
  const manifest = { schemaVersion: 2, kind: "literary-planet-child-native-media-manifest-v2", manifestId: "media1",
    manifestVersion: 1, packageId: pack.packageId, packageVersion: pack.packageVersion, packageChecksum: sha(packageBytes),
    policyVersion: pack.policyVersion, policyChecksum: pack.policyChecksum, locale: "en", exactAge: 8, readingLevels: [null],
    validFromEpochMs: now - 100, validUntilEpochMs: now + 1000, assets: [asset] };
  const manifestBytes = json(manifest), pin = { manifestId: "media1", manifestVersion: 1, manifestChecksum: sha(manifestBytes),
    reviewChecksum: hash, packageId: pack.packageId, packageVersion: 1, packageChecksum: sha(packageBytes) };
  return { pack, packageBytes, manifest, manifestBytes, pin, asset, binary };
}
async function signed(f, keyPair) {
  const raw = Buffer.from(await webcrypto.subtle.exportKey("raw", keyPair.publicKey));
  const keys = [{ keyId: "child-media-review-test-only", reviewerId: "human-fixture-only", publicKeyX963Hex: raw.toString("hex") }];
  const review = { schemaVersion: 2, kind: "literary-planet-child-native-media-review-v2", keyId: keys[0].keyId,
    reviewerId: keys[0].reviewerId, manifestId: f.manifest.manifestId, manifestVersion: f.manifest.manifestVersion,
    manifestChecksum: f.pin.manifestChecksum, packageId: f.pin.packageId, packageVersion: f.pin.packageVersion,
    packageChecksum: f.pin.packageChecksum, policyVersion: f.manifest.policyVersion, policyChecksum: f.manifest.policyChecksum,
    locale: "en", exactAge: 8, readingLevels: [null], platforms: ["android-google"], territories: ["RU"],
    reviewedAtEpochMs: now - 10, validFromEpochMs: now - 100, validUntilEpochMs: now + 1000,
    assetChecksums: [{ assetId: f.asset.assetId, ownerChecksum: sha(canonical(f.asset.owner)),
      entityChecksum: f.asset.entity.contentChecksum, policyChecksum: sha(canonical(f.asset.policy)), binaryChecksum: f.asset.sha256,
      bytes: f.asset.bytes, mime: f.asset.mime }] };
  const message = Buffer.concat([Buffer.from(CHILD_NATIVE_MEDIA_REVIEW_PREFIX), canonical(review)]);
  review.signatureHex = Buffer.from(await webcrypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, keyPair.privateKey, message)).toString("hex");
  const bytes = json(review); return { keys, review, bytes, pin: { ...f.pin, reviewChecksum: sha(bytes) } };
}
async function rootFixture() {
  await mkdir(".tmp", { recursive: true }); const root = await mkdtemp(path.resolve(".tmp/native-media-test-")); temporary.push(root);
  const write = async (name, bytes) => { const target = path.join(root, name); await mkdir(path.dirname(target), { recursive: true }); await writeFile(target, bytes); };
  await write(CHILD_NATIVE_MEDIA_PIN_SOURCE, json(empty));
  await write("src/child/childNativeReleasePins.json", json({ schemaVersion: 1, kind: "literary-planet-child-native-release-pins-v1", reviewKeys: [], packages: [] }));
  return { root, write };
}
afterEach(async () => { for (const root of temporary.splice(0)) {
  if (path.dirname(root) !== path.resolve(".tmp") || !path.basename(root).startsWith("native-media-test-")) throw new Error("Unowned fixture cleanup");
  await rm(root, { recursive: true, force: true });
} });
describe("native child fixed media publisher", () => {
  it("projects authentic empty media pins without manufacturing review or binary approval", async () => {
    const f = await rootFixture(), result = await collectChildNativeMediaOutputs(f.root, "android", "dev", now);
    expect(result.outputs).toHaveLength(1); expect(result.outputs[0].output).toBe(CHILD_NATIVE_MEDIA_CATALOG);
    expect(JSON.parse(result.outputs[0].bytes)).toMatchObject({ platform: null, reviewKeys: [], manifests: [] });
    expect(result.outputs[0].sourceSha256).toBe(sha(json(empty)));
  });
  it("rejects duplicate escaped pin fields and unknown generated-profile authority", () => {
    expect(() => normalizeChildNativeMediaPins(Buffer.from('{"schemaVersion":2,"schema\\u0056ersion":2,"kind":"literary-planet-child-native-media-release-pins-v2","reviewKeys":[],"manifests":[]}'))).toThrow();
    expect(() => normalizeChildNativeMediaPins(json({ ...empty, profileId: "caller-profile" }))).toThrow();
    expect(() => normalizeChildNativeMediaPins(json({ ...empty, reviewKeys: [{ keyId: "child-release-review-text", reviewerId: "text", publicKeyX963Hex: "04" + "1".repeat(128) }] }))).toThrow();
  });
  it("binds a fixed audience to the original ordered compiled owner text bytes", () => {
    const f = material(); expect(validateChildNativeMediaManifest(f.manifestBytes, f.pin, f.packageBytes, now).assets[0].owner).toEqual(f.asset.owner);
    const wrong = { ...f.manifest, assets: [{ ...f.asset, owner: { ...f.asset.owner, contentChecksum: sha(canonical(f.pack.entities[0].payload)) } }] };
    const bytes = json(wrong); expect(() => validateChildNativeMediaManifest(bytes, { ...f.pin, manifestChecksum: sha(bytes) }, f.packageBytes, now)).toThrow();
  });
  it("refuses active formats, stale rights, incomplete locale review and caller profile fields", () => {
    const f = material();
    for (const change of [
      { mime: "image/svg+xml" }, { inventoryKey: "../portrait.png" },
      { policy: { ...f.asset.policy, rights: { ...f.asset.policy.rights, expiresAt: now } } },
      { policy: { ...f.asset.policy, localizedContent: [] } },
    ]) { const bytes = json({ ...f.manifest, assets: [{ ...f.asset, ...change }] });
      expect(() => validateChildNativeMediaManifest(bytes, { ...f.pin, manifestChecksum: sha(bytes) }, f.packageBytes, now)).toThrow(); }
    const bytes = json({ ...f.manifest, profileId: "runtime-uid" });
    expect(() => validateChildNativeMediaManifest(bytes, { ...f.pin, manifestChecksum: sha(bytes) }, f.packageBytes, now)).toThrow();
  });
  it("requires a separate release-pinned P256 media signature and exact relation closure", async () => {
    const f = material(), pair = await webcrypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    const s = await signed(f, pair);
    await expect(verifyChildNativeMediaReview(f.manifestBytes, s.bytes, s.pin, s.keys, f.manifest, now)).resolves.toMatchObject({ validUntilEpochMs: now + 1000 });
    await expect(verifyChildNativeMediaReview(f.manifestBytes, s.bytes, s.pin, [], f.manifest, now)).rejects.toThrow();
    const altered = json({ ...s.review, assetChecksums: [{ ...s.review.assetChecksums[0], binaryChecksum: "b".repeat(64) }] });
    await expect(verifyChildNativeMediaReview(f.manifestBytes, altered, { ...s.pin, reviewChecksum: sha(altered) }, s.keys, f.manifest, now)).rejects.toThrow();
  });
  it("denies an absent independently reviewed text owner even when media pins exist", async () => {
    const f = await rootFixture(), m = material(), pair = await webcrypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]), s = await signed(m, pair);
    await f.write(CHILD_NATIVE_MEDIA_PIN_SOURCE, json({ ...empty, reviewKeys: s.keys, manifests: [s.pin] }));
    // Copy only actual source validators into the bounded temporary fixture.
    await cp(path.resolve("src"), path.join(f.root, "src"), { recursive: true });
    await f.write(CHILD_NATIVE_MEDIA_PIN_SOURCE, json({ ...empty, reviewKeys: s.keys, manifests: [s.pin] }));
    await f.write("src/child/childNativeReleasePins.json", json({ schemaVersion: 1, kind: "literary-planet-child-native-release-pins-v1", reviewKeys: [], packages: [] }));
    await expect(collectChildNativeMediaOutputs(f.root, "android", "googlePlay", now)).rejects.toThrow("text owner");
  });
  it("writes the source-owned catalog once and refuses replacing an existing output", async () => {
    const f = await rootFixture(), staging = path.join(f.root, "stage"); await mkdir(staging);
    const result = await emitChildNativeMediaAssets(f.root, staging, "ios", "dev");
    expect(result.outputs).toHaveLength(1); expect(result.outputs[0]).not.toHaveProperty("bytes");
    expect(await readFile(path.join(staging, CHILD_NATIVE_MEDIA_CATALOG))).toEqual((await collectChildNativeMediaOutputs(f.root, "ios", "dev", now)).outputs[0].bytes);
    await expect(emitChildNativeMediaAssets(f.root, staging, "ios", "dev")).rejects.toThrow();
  });
  it("rejects nonempty media material in an unselected development audience", async () => {
    const f = await rootFixture(), m = material(), pair = await webcrypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]), s = await signed(m, pair);
    await f.write(CHILD_NATIVE_MEDIA_PIN_SOURCE, json({ ...empty, reviewKeys: s.keys, manifests: [s.pin] }));
    await expect(collectChildNativeMediaOutputs(f.root, "android", "dev", now)).rejects.toThrow("unselected");
  });
});

describe("native child fixed media binary source closure", () => {
  it("collects only the independently reviewed owner manifest review and actual static binary source bytes", async () => {
    const f=await rootFixture();await cp(path.resolve("src"),path.join(f.root,"src"),{recursive:true});
    const m=material();
    const binary=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=","base64");
    m.asset.sha256=sha(binary);m.asset.bytes=binary.length;m.manifestBytes=json(m.manifest);m.pin.manifestChecksum=sha(m.manifestBytes);
    const textPair=await webcrypto.subtle.generateKey({name:"ECDSA",namedCurve:"P-256"},true,["sign","verify"]);
    const textKeys=[{keyId:"child-release-review-fixture-only",reviewerId:"human-fixture-only",
      publicKeyX963Hex:Buffer.from(await webcrypto.subtle.exportKey("raw",textPair.publicKey)).toString("hex")}];
    const textReview={schemaVersion:1,kind:"literary-planet-child-release-review-v1",keyId:textKeys[0].keyId,reviewerId:textKeys[0].reviewerId,
      packageId:m.pack.packageId,packageVersion:1,packageChecksum:sha(m.packageBytes),policyVersion:m.pack.policyVersion,policyChecksum:m.pack.policyChecksum,
      locale:"en",exactAge:8,readingLevels:[null],platforms:["android-google"],territories:["RU"],reviewedAtEpochMs:now-10,validFromEpochMs:now-100,validUntilEpochMs:now+1000,
      entityPolicyChecksums:[{kind:m.asset.owner.kind,id:m.asset.owner.id,payloadChecksum:m.asset.owner.contentChecksum,
        policyChecksum:sha(canonical(m.pack.entities[0].policy))}]};
    textReview.signatureHex=Buffer.from(await webcrypto.subtle.sign({name:"ECDSA",hash:"SHA-256"},textPair.privateKey,
      Buffer.concat([Buffer.from("LP-CHILD-RELEASE-REVIEW\0v1\0"),canonical(textReview)]))).toString("hex");
    const textBytes=json(textReview),textPin={packageId:m.pack.packageId,packageVersion:1,packageChecksum:sha(m.packageBytes),reviewChecksum:sha(textBytes)};
    const mediaPair=await webcrypto.subtle.generateKey({name:"ECDSA",namedCurve:"P-256"},true,["sign","verify"]),s=await signed(m,mediaPair);
    await f.write("src/child/childNativeReleasePins.json",json({schemaVersion:1,kind:"literary-planet-child-native-release-pins-v1",reviewKeys:textKeys,packages:[textPin]}));
    await f.write(CHILD_NATIVE_MEDIA_PIN_SOURCE,json({...empty,reviewKeys:s.keys,manifests:[s.pin]}));
    await f.write("src/child/release-material/"+textPin.packageChecksum+"/package.json",m.packageBytes);
    await f.write("src/child/release-material/"+textPin.reviewChecksum+"/review.json",textBytes);
    await f.write("src/child/media-release-material/"+s.pin.manifestChecksum+"/manifest.json",m.manifestBytes);
    await f.write("src/child/media-release-material/"+s.pin.reviewChecksum+"/review.json",s.bytes);
    const source="src/child/media-release-material/"+m.asset.sha256+"/asset.png";await f.write(source,binary);
    const result=await collectChildNativeMediaOutputs(f.root,"android","googlePlay",now);
    expect(result.outputs).toHaveLength(4);const row=result.outputs.find(row=>row.source===source);
    expect(row.bytes).toEqual(binary);expect(row.sourceSha256).toBe(m.asset.sha256);
    await f.write(source,Buffer.concat([binary,Buffer.from([0])]));
    await expect(collectChildNativeMediaOutputs(f.root,"android","googlePlay",now)).rejects.toThrow("binary bytes");
  });
});
