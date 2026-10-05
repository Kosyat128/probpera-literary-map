import { afterEach, describe, expect, it } from "vitest";
import path from "node:path";
import { createHash, webcrypto } from "node:crypto";
import { mkdir, mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { collectChildNativePassportOutputs, emitChildNativePassportAssets, normalizeChildNativePassportPins,
  verifyChildNativePassportReview, CHILD_NATIVE_PASSPORT_PIN_SOURCE, CHILD_NATIVE_PASSPORT_CATALOG, CHILD_NATIVE_PASSPORT_REVIEW_DOMAIN } from "./native-child-passport-assets.mjs";
import { contentPackageCanonicalJson } from "../../src/planet/contentPackageProtocol.mjs";

// AUTHORED_NOT_RUN. Fixture signers never enter genuine source release pins.
const roots = [], sha = value => createHash("sha256").update(value).digest("hex"), json = value => JSON.stringify(value) + "\n";
const empty = { schemaVersion: 1, kind: "literary-planet-child-passport-program-release-pins-v1", reviewKeys: [], programs: [] };
async function fixture() {
  await mkdir(".tmp", { recursive: true }); const root = await mkdtemp(path.resolve(".tmp/native-passport-test-")); roots.push(root);
  async function put(relative, bytes) { await mkdir(path.dirname(path.join(root, relative)), { recursive: true }); await writeFile(path.join(root, relative), bytes); }
  for (const name of ["childNativePassportProgram.ts", "childNativeJourney.ts", "childPackage.ts", "childAccessPolicy.ts", "childDataNamespace.ts", "childProfile.ts"])
    await put("src/child/" + name, await readFile(new URL("../../src/child/" + name, import.meta.url)));
  await put(CHILD_NATIVE_PASSPORT_PIN_SOURCE, json(empty));
  return { root, put };
}
afterEach(async () => { for (const root of roots.splice(0)) {
  if (path.dirname(root) !== path.resolve(".tmp") || !path.basename(root).startsWith("native-passport-test-")) throw Error("Unowned fixture cleanup");
  await rm(root, { recursive: true, force: true });
} });
describe("source-owned native passport review export", () => {
  it("emits exact genuine empty review pins without granting a badge or a route file", async () => {
    const f = await fixture(), result = await collectChildNativePassportOutputs(f.root, "android", "dev", 1500);
    expect(result.outputs).toHaveLength(1); expect(result.outputs[0].output).toBe(CHILD_NATIVE_PASSPORT_CATALOG);
    expect(JSON.parse(result.outputs[0].bytes).programs).toEqual([]); expect(JSON.parse(result.outputs[0].bytes).reviewKeys).toEqual([]);
    const staging = path.join(f.root, "staging"); await mkdir(staging);
    const emitted = await emitChildNativePassportAssets(f.root, staging, "android", "dev");
    expect(sha(await readFile(path.join(staging, CHILD_NATIVE_PASSPORT_CATALOG)))).toBe(emitted.outputs[0].outputSha256);
    await expect(emitChildNativePassportAssets(f.root, staging, "android", "dev")).rejects.toThrow();
  });
  it("rejects review booleans, escaped duplicate keys and fabricated program pins before exporting", async () => {
    const f = await fixture();
    await expect(normalizeChildNativePassportPins(Buffer.from(json({ ...empty, approved: true })), f.root)).rejects.toThrow();
    await expect(normalizeChildNativePassportPins(Buffer.from('{"schemaVersion":1,"schemaVersion":1}'), f.root)).rejects.toThrow();
    await f.put(CHILD_NATIVE_PASSPORT_PIN_SOURCE, json({ ...empty, programs: [{ programId: "invented" }] }));
    await expect(collectChildNativePassportOutputs(f.root, "android", "googlePlay", 1500)).rejects.toThrow();
  });
  it("requires an actual independent domain-bound signature with exact program package policy age and review window", async () => {
    const pair = await webcrypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    const key = { keyId: "child-passport-review-fixture", reviewerId: "fixture-reviewer", publicKeyX963Hex: Buffer.from(await webcrypto.subtle.exportKey("raw", pair.publicKey)).toString("hex") };
    const hash = "a".repeat(64), program = { programId: "fixture-program", programVersion: 2, packageId: "fixture-package", packageVersion: 3,
      packageChecksum: hash, policyVersion: "fixture-policy", policyChecksum: hash, locale: "en", exactAge: 9, validFromEpochMs: 1000, validUntilEpochMs: 2000 };
    const review = { schemaVersion: 1, kind: "literary-planet-child-passport-program-review-v1", keyId: key.keyId, reviewerId: key.reviewerId,
      ...program, programChecksum: hash, platforms: ["android-google"], territories: ["RU"], reviewedAtEpochMs: 1200 };
    review.signatureHex = Buffer.from(await webcrypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, pair.privateKey,
      Buffer.from(CHILD_NATIVE_PASSPORT_REVIEW_DOMAIN + contentPackageCanonicalJson(review), "utf8"))).toString("hex");
    await expect(verifyChildNativePassportReview(program, review, { programChecksum: hash }, [key], 1500)).resolves.toBeUndefined();
    for (const changed of [{ ...program, exactAge: 10 }, { ...program, policyVersion: "other" }, { ...program, packageChecksum: "b".repeat(64) }])
      await expect(verifyChildNativePassportReview(changed, review, { programChecksum: hash }, [key], 1500)).rejects.toThrow();
    await expect(verifyChildNativePassportReview(program, review, { programChecksum: hash }, [{ ...key, reviewerId: "other" }], 1500)).rejects.toThrow();
    await expect(verifyChildNativePassportReview(program, review, { programChecksum: hash }, [key], 2000)).rejects.toThrow();
    await expect(verifyChildNativePassportReview(program, { ...review, validUntilEpochMs: 2001 }, { programChecksum: hash }, [key], 1500)).rejects.toThrow();
  });
});
