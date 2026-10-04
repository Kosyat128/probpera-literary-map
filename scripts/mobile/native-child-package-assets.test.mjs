import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash, webcrypto } from "node:crypto";
import { contentPackageCanonicalJson } from "../../src/planet/contentPackageProtocol.mjs";
import { childNativeJson, normalizeChildNativePins, verifyChildReleaseReview, emitChildNativeAssets,
  CHILD_RELEASE_REVIEW_PREFIX, CHILD_NATIVE_CATALOG } from "./native-child-package-assets.mjs";
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const bytes = value => Buffer.from(JSON.stringify(value));
const emptyPins = { schemaVersion: 1, kind: "literary-planet-child-native-release-pins-v1", reviewKeys: [], packages: [] };
async function reviewFixture() {
  // Ephemeral software key and records test mechanics only. These bytes never
  // modify or enter the source-owned production pin list.
  const pair = await webcrypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const policy = { id: "start", kind: "activity", reviewStatus: "approved", rights: { basis: "original" } };
  const packageBytes = bytes({ fixture: "isolated-review-mechanics" });
  const compiled = { scope: { policyVersion: "child-access.v12", policyChecksum: "a".repeat(64), locale: "en", exactAge: 9 }, validUntilEpochMs: 20_000,
    entities: [{ reference: { kind: "activity", id: "start", contentChecksum: "b".repeat(64) }, policy }] };
  const review = { schemaVersion: 1, kind: "literary-planet-child-release-review-v1", keyId: "child-release-review-fixture", reviewerId: "isolated-human-role",
    packageId: "fixture-package", packageVersion: 1, packageChecksum: sha(packageBytes), policyVersion: compiled.scope.policyVersion,
    policyChecksum: compiled.scope.policyChecksum, locale: "en", exactAge: 9, readingLevels: [null], platforms: ["android-google"], territories: ["RU"],
    reviewedAtEpochMs: 1000, validFromEpochMs: 1000, validUntilEpochMs: 10_000,
    entityPolicyChecksums: [{ kind: "activity", id: "start", payloadChecksum: "b".repeat(64), policyChecksum: sha(Buffer.from(contentPackageCanonicalJson(policy))) }] };
  async function sign(changed = review) {
    const unsigned = { ...changed }; delete unsigned.signatureHex;
    const signature = await webcrypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, pair.privateKey, Buffer.from(CHILD_RELEASE_REVIEW_PREFIX + contentPackageCanonicalJson(unsigned)));
    const reviewBytes = bytes({ ...unsigned, signatureHex: Buffer.from(signature).toString("hex") });
    return { reviewBytes, pin: { packageId: "fixture-package", packageVersion: 1, packageChecksum: sha(packageBytes), reviewChecksum: sha(reviewBytes) } };
  }
  const keys = [{ keyId: review.keyId, reviewerId: review.reviewerId, publicKeyX963Hex: Buffer.from(await webcrypto.subtle.exportKey("raw", pair.publicKey)).toString("hex") }];
  const verify = signed => verifyChildReleaseReview(packageBytes, signed.reviewBytes, signed.pin, keys, compiled,
    { readingLevel: null }, "android-google", "RU", 2000);
  return { packageBytes, compiled, review, keys, sign, verify };
}
async function ownedFixture(body) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "lp-child-native-assets-"));
  try {
    await fs.mkdir(path.join(root, "src/child"), { recursive: true });await fs.mkdir(path.join(root, "src/planet"));await fs.mkdir(path.join(root, "stage"));
    await fs.writeFile(path.join(root, "src/child/childNativeReleasePins.json"), bytes(emptyPins));
    await fs.writeFile(path.join(root, "src/planet/contentDownloadCatalog.ts"), "export const contentDownloadCatalog = []; export const contentDownloadTrust = [];\n");
    await body(root, path.join(root, "stage"));
  } finally {
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()));assert.match(path.basename(root), /^lp-child-native-assets-[A-Za-z0-9]+$/u);
    assert.equal(await fs.realpath(root), root);await fs.rm(root, { recursive: true, force: true });
  }
}
describe("native child package release assets", () => {
  it("rejects duplicate decoded keys and malformed UTF-8 before interpretation", () => {
    assert.throws(() => childNativeJson(Buffer.from('{"key":1,"\\u006bey":2}'), 100));
    assert.throws(() => childNativeJson(Buffer.from([0xc3, 0x28]), 100));
    assert.throws(() => childNativeJson(Buffer.from('['.repeat(18) + '0' + ']'.repeat(18)), 100));
    assert.throws(() => childNativeJson(Buffer.from('{}'), 1));
    for (const value of ['9007199254740992', '1.0', '1e3', '"\\ud800"']) assert.throws(() => childNativeJson(Buffer.from(value), 1024));
  });
  it("retains empty production trust and rejects QA keys or caller source paths", () => {
    assert.deepEqual(normalizeChildNativePins(bytes(emptyPins)), emptyPins);
    assert.throws(() => normalizeChildNativePins(bytes({ ...emptyPins, reviewKeys: [{ keyId: "local-qa-1", reviewerId: "fixture", publicKeyX963Hex: "04" + "a".repeat(128) }] })));
    assert.throws(() => normalizeChildNativePins(bytes({ ...emptyPins, packages: [{ packageId: "p", packageVersion: 1, packageChecksum: "a".repeat(64), reviewChecksum: "b".repeat(64), source: "../../outside" }] })));
  });
  it("requires distinct complete package and review release pins", async () => {
    const fixture = await reviewFixture(), signed = await fixture.sign();assert.deepEqual(await fixture.verify(signed), { validUntilEpochMs: 10_000, reviewChecksum: signed.pin.reviewChecksum });
    await assert.rejects(fixture.verify({ ...signed, pin: { ...signed.pin, reviewChecksum: "f".repeat(64) } }));
    await assert.rejects(fixture.verify({ ...signed, pin: { ...signed.pin, packageChecksum: "f".repeat(64) } }));
  });
  it("signature and flags cannot replace the independently pinned reviewer", async () => {
    const f = await reviewFixture(), s = await f.sign();
    await assert.rejects(verifyChildReleaseReview(f.packageBytes, s.reviewBytes, s.pin, [], f.compiled, { readingLevel: null }, "android-google", "RU", 2000));
    await assert.rejects(verifyChildReleaseReview(f.packageBytes, s.reviewBytes, s.pin, [{ ...f.keys[0], reviewerId: "foreign" }], f.compiled, { readingLevel: null }, "android-google", "RU", 2000));
    const review = JSON.parse(s.reviewBytes); review.signatureHex = "0".repeat(128);const corrupt = bytes(review);
    await assert.rejects(f.verify({ reviewBytes: corrupt, pin: { ...s.pin, reviewChecksum: sha(corrupt) } }));
  });
  it("binds reading level, saved age, locale, native platform and territory", async () => {
    const f = await reviewFixture(), s = await f.sign();
    for (const [profile, platform, territory] of [[{ readingLevel: "fluent" }, "android-google", "RU"], [{ readingLevel: null }, "ios-ipados", "RU"], [{ readingLevel: null }, "android-google", "US"]])
      await assert.rejects(verifyChildReleaseReview(f.packageBytes, s.reviewBytes, s.pin, f.keys, f.compiled, profile, platform, territory, 2000));
    for (const change of [{ exactAge: 8 }, { locale: "ru" }, { policyChecksum: "c".repeat(64) }]) await assert.rejects(f.verify(await f.sign({ ...f.review, ...change })));
  });
  it("enforces exclusive expiry and denies future review or publication", async () => {
    const f = await reviewFixture(), s = await f.sign();
    await assert.rejects(verifyChildReleaseReview(f.packageBytes, s.reviewBytes, s.pin, f.keys, f.compiled, { readingLevel: null }, "android-google", "RU", 10_000));
    for (const change of [{ reviewedAtEpochMs: 2001 }, { validFromEpochMs: 2001 }]) await assert.rejects(f.verify(await f.sign({ ...f.review, ...change })));
  });
  it("rejects incomplete, duplicate or substituted policy and payload review closure", async () => {
    const f = await reviewFixture(), entry = f.review.entityPolicyChecksums[0];
    for (const closure of [[], [entry, entry], [{ ...entry, policyChecksum: "c".repeat(64) }], [{ ...entry, payloadChecksum: "c".repeat(64) }]])
      await assert.rejects(f.verify(await f.sign({ ...f.review, entityPolicyChecksums: closure })));
  });
  it("a separately signed text review cannot admit unimplemented media", async () => {
    for (const kind of ["image", "external-link", "store-preview", "unknown"]) { const f = await reviewFixture();f.compiled.entities[0].reference.kind = kind;const entry = { ...f.review.entityPolicyChecksums[0], kind };
      await assert.rejects(f.verify(await f.sign({ ...f.review, entityPolicyChecksums: [entry] }))); }
  });
  it("exports only an empty fixed catalog without transport or material guesses", async () => {
    await ownedFixture(async (root, stage) => {
      const result = await emitChildNativeAssets(root, stage, "android", "dev"), catalog = JSON.parse(await fs.readFile(path.join(stage, CHILD_NATIVE_CATALOG)));
      assert.equal(catalog.platform, null);assert.deepEqual(catalog.packages, []);assert.deepEqual(catalog.reviewKeys, []);assert.equal(result.outputs.length, 1);
      assert.equal(result.outputs[0].sourceSha256, sha(bytes(emptyPins)));assert.equal(result.outputs[0].transformation, "fixed-native-pin-projection-v1");
      assert.notEqual(result.outputs[0].outputSha256, result.outputs[0].sourceSha256);
    });
  });
  it("exports exact pinned signed text through the actual shared compiler and rejects changed policy", async () => {
    await ownedFixture(async (root, stage) => {
      for (const name of ["childPackage.ts", "childAccessPolicy.ts", "childDataNamespace.ts", "childProfile.ts"])
        await fs.copyFile(new URL("../../src/child/" + name, import.meta.url), path.join(root, "src/child", name));
      const now = Date.now(), policyChecksum = "a".repeat(64), payload = { title: "Nature", text: "A tree.", terms: ["tree"], references: [] }, payloadChecksum = sha(bytes(payload));
      const policy = { id: "start", kind: "activity", sourceVersion: "source.v1", policyVersion: "child-access.v12", minAge: 3, maxAge: 17, reviewStatus: "approved",
        localizedContent: [{ locale: "en", contentChecksum: payloadChecksum, reviewStatus: "approved", available: true, reviewerId: "isolated-editor", reviewedAt: now - 1000 }],
        topics: ["nature"], topicTagsComplete: true, commercialAvailability: "included-in-base", rights: { status: "approved", basis: "original", platforms: ["android-google"], territories: ["RU"], validFrom: now - 1000, expiresAt: null } };
      const packageBytes = bytes({ schemaVersion: 1, namespace: "child", packageId: "isolated-text", packageVersion: 1, locale: "en", exactAge: 9,
        policyVersion: policy.policyVersion, policyChecksum, validFromEpochMs: now - 1000, validUntilEpochMs: now + 60000,
        home: { kind: "activity", id: "start", contentChecksum: payloadChecksum }, entities: [{ policy, payload }] });
      const pair = await webcrypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
      const key = { keyId: "child-release-review-isolated", reviewerId: "isolated-editor", publicKeyX963Hex: Buffer.from(await webcrypto.subtle.exportKey("raw", pair.publicKey)).toString("hex") };
      const review = { schemaVersion: 1, kind: "literary-planet-child-release-review-v1", keyId: key.keyId, reviewerId: key.reviewerId,
        packageId: "isolated-text", packageVersion: 1, packageChecksum: sha(packageBytes), policyVersion: policy.policyVersion, policyChecksum, locale: "en", exactAge: 9,
        readingLevels: [null], platforms: ["android-google"], territories: ["RU"], reviewedAtEpochMs: now - 1000, validFromEpochMs: now - 1000, validUntilEpochMs: now + 60000,
        entityPolicyChecksums: [{ kind: "activity", id: "start", payloadChecksum, policyChecksum: sha(Buffer.from(contentPackageCanonicalJson(policy))) }] };
      const signature = await webcrypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, pair.privateKey, Buffer.from(CHILD_RELEASE_REVIEW_PREFIX + contentPackageCanonicalJson(review)));
      const reviewBytes = bytes({ ...review, signatureHex: Buffer.from(signature).toString("hex") }), pin = { packageId: review.packageId, packageVersion: 1, packageChecksum: sha(packageBytes), reviewChecksum: sha(reviewBytes) };
      for (const [hash, name, content] of [[pin.packageChecksum, "package.json", packageBytes], [pin.reviewChecksum, "review.json", reviewBytes]]) {
        const dir = path.join(root, "src/child/release-material", hash);await fs.mkdir(dir, { recursive: true });await fs.writeFile(path.join(dir, name), content);
      }
      await fs.writeFile(path.join(root, "src/child/childNativeReleasePins.json"), bytes({ ...emptyPins, reviewKeys: [key], packages: [pin] }));
      const result = await emitChildNativeAssets(root, stage, "android", "googlePlay");assert.equal(result.outputs.length, 3);
      assert.deepEqual(await fs.readFile(path.join(stage, "child-native/packages/" + pin.packageChecksum + ".json")), packageBytes);
      assert.deepEqual(await fs.readFile(path.join(stage, "child-native/reviews/" + pin.reviewChecksum + ".json")), reviewBytes);
      await fs.writeFile(path.join(root, "src/child/release-material", pin.packageChecksum, "package.json"), Buffer.from(packageBytes.toString().replace('"approved"', '"not-reviewed"')));
      const nextStage = path.join(root, "changed-stage");await fs.mkdir(nextStage);await assert.rejects(emitChildNativeAssets(root, nextStage, "android", "googlePlay"));assert.deepEqual(await fs.readdir(nextStage), []);
    });
  });
  it("fixed catalog output cannot overwrite existing bytes", async () => {
    await ownedFixture(async (root, stage) => { await fs.mkdir(path.join(stage, "child-native"));await fs.writeFile(path.join(stage, CHILD_NATIVE_CATALOG), "retained");
      await assert.rejects(emitChildNativeAssets(root, stage, "android", "googlePlay"));assert.equal(await fs.readFile(path.join(stage, CHILD_NATIVE_CATALOG), "utf8"), "retained"); });
  });
  it("owned child output refuses a linked directory before writing outside staging", async () => {
    await ownedFixture(async (root, stage) => { const outside = path.join(root, "outside");await fs.mkdir(outside);await fs.symlink(outside, path.join(stage, "child-native"), process.platform === "win32" ? "junction" : "dir");
      await assert.rejects(emitChildNativeAssets(root, stage, "android", "googlePlay"));assert.deepEqual(await fs.readdir(outside), []); });
  });
  it("pin quotas, duplicate identity and unsafe versions fail before source loading", () => {
    const pin = { packageId: "p", packageVersion: 1, packageChecksum: "a".repeat(64), reviewChecksum: "b".repeat(64) };
    assert.throws(() => normalizeChildNativePins(bytes({ ...emptyPins, packages: [pin, pin] })));
    assert.throws(() => normalizeChildNativePins(bytes({ ...emptyPins, packages: [{ ...pin, packageVersion: Number.MAX_SAFE_INTEGER + 1 }] })));
    assert.throws(() => normalizeChildNativePins(bytes({ ...emptyPins, packages: Array(33).fill(pin) })));
  });
  it("pin source cannot be replaced by a linked external file", async () => {
    await ownedFixture(async (root, stage) => { const target = path.join(root, "pins.json");await fs.writeFile(target, bytes(emptyPins));await fs.unlink(path.join(root, "src/child/childNativeReleasePins.json"));
      // Directory junctions on Windows do not require symbolic-link privilege.
      if (process.platform === "win32") { await fs.rmdir(path.join(root, "src/child"));await fs.mkdir(path.join(root, "owned-pins"));await fs.writeFile(path.join(root, "owned-pins/childNativeReleasePins.json"), bytes(emptyPins));await fs.symlink(path.join(root, "owned-pins"), path.join(root, "src/child"), "junction"); }
      else await fs.symlink(target, path.join(root, "src/child/childNativeReleasePins.json"));
      await assert.rejects(emitChildNativeAssets(root, stage, "android", "googlePlay")); });
  });
});
