import { describe, expect, it, vi } from "vitest";
import { verifyContentPackage } from "./verifyContentPackage";
import { verifyContentPackageSignature } from "../../scripts/mobile/content-package-signature.mjs";
import { contentPackageFixture, contentTestSubtle, otherPair } from "../../tests/support/content-package-fixtures.mjs";

describe("portable signed content integrity", () => {
  it.each(["adult", "child"])("matches the Node signature verifier for the exact %s package without activation", async namespace => {
    const f = contentPackageFixture(2, namespace);
    const result = await verifyContentPackage(f);
    expect(result).toEqual(verifyContentPackageSignature({ ...f, trustedKeys: f.nodeTrustedKeys }));
    expect(result).toMatchObject({ verified: true, manifestSha256: f.manifestSha256, activationAllowed: false, childModeEnabled: false, releaseReady: false });
  });
  it.each(["same-size data", "missing file", "extra file", "signature", "source", "version", "reader", "child-policy", "digest-array", "unsafe-path", "release-flag", "environment"])
  ("rejects %s instead of accepting a partial or incompatible package", async damage => {
    const f = contentPackageFixture(2);
    if (damage === "same-size data") f.files[1].bytes = f.files[1].bytes.replace("Test", "Fake");
    if (damage === "missing file") f.files.pop();
    if (damage === "extra file") f.files.push({ path: "extra.json", bytes: "{}" });
    if (damage === "signature") f.envelope.signature = (f.envelope.signature[0] === "A" ? "B" : "A") + f.envelope.signature.slice(1);
    if (damage === "source") f.expected.sourceCommit = "c".repeat(40);
    if (damage === "version") f.expected.version = 3;
    if (damage === "reader") f.expected.readerVersion = 2;
    if (damage === "child-policy") { f.expected.namespace = "child"; f.expected.childPolicy = { policyId: "synthetic", version: "1", sha256: "d".repeat(64) }; }
    if (damage === "digest-array") f.envelope.manifest.files[0].sha256 = [f.envelope.manifest.files[0].sha256];
    if (damage === "unsafe-path") f.envelope.manifest.files[0].path = "../app.json";
    if (damage === "release-flag") f.envelope.manifest.releaseReady = true;
    if (damage === "environment") f.envelope.manifest.environment = "production";
    expect(await verifyContentPackage(f)).toMatchObject({ verified: false, manifestSha256: null, activationAllowed: false, releaseReady: false });
  });
  it.each(["absent", "unknown", "duplicate id", "duplicate point", "wrong point", "private", "wrong purpose", "wrong environment", "wrong usage", "noncanonical coordinate", "invalid point"])
  ("rejects %s trust without accepting transport-provided authority", async damage => {
    const f = contentPackageFixture();
    if (damage === "absent") f.trustedKeys = [];
    if (damage === "unknown") f.trustedKeys[0].keyId = "content-qa-not-selected";
    if (damage === "duplicate id") f.trustedKeys.push({ ...f.trustedKeys[0] });
    if (damage === "duplicate point") f.trustedKeys.push({ ...f.trustedKeys[0], keyId: "content-qa-another-alias" });
    if (damage === "wrong point") f.trustedKeys[0].jwk = otherPair.publicKey.export({ format: "jwk" });
    if (damage === "private") f.trustedKeys[0].jwk.d = "a".repeat(43);
    if (damage === "wrong purpose") f.trustedKeys[0].purpose = "literary-planet-paid-license";
    if (damage === "wrong environment") f.trustedKeys[0].environment = "production";
    if (damage === "wrong usage") f.trustedKeys[0].jwk.key_ops = ["sign"];
    if (damage === "noncanonical coordinate") f.trustedKeys[0].jwk.x += "=";
    if (damage === "invalid point") { f.trustedKeys[0].jwk.x = "A".repeat(43); f.trustedKeys[0].jwk.y = "A".repeat(43); }
    expect(await verifyContentPackage(f)).toMatchObject({ verified: false, activationAllowed: false });
  });
  it("requires crypto and rejects getters without executing them", async () => {
    const f = contentPackageFixture();
    expect(await verifyContentPackage({ ...f, subtle: null })).toMatchObject({ verified: false, reason: "crypto-unavailable" });
    const getter = vi.fn(() => f.trustedKeys[0].jwk);
    Object.defineProperty(f.trustedKeys[0], "jwk", { get: getter });
    expect(await verifyContentPackage(f)).toMatchObject({ verified: false });
    expect(getter).not.toHaveBeenCalled();
  });
  it("binds inputs before an asynchronous key import rather than accepting later caller mutation", async () => {
    const f = contentPackageFixture();
    const publicKey = await contentTestSubtle.importKey("jwk", f.trustedKeys[0].jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
    let release;
    const subtle = { importKey: () => new Promise(resolve => { release = resolve; }), verify: contentTestSubtle.verify.bind(contentTestSubtle) };
    const pending = verifyContentPackage({ ...f, subtle });
    f.envelope.manifest.version = 900; f.envelope.signature = "changed";
    f.trustedKeys[0].jwk.x = "changed"; f.files[0].bytes = "changed"; f.expected.version = 900;
    release(publicKey);
    expect(await pending).toMatchObject({ verified: true, manifestSha256: f.manifestSha256 });
  });
  it("cancels a pending verification without emitting a verified receipt", async () => {
    const f = contentPackageFixture(), controller = new AbortController();
    const subtle = { importKey: vi.fn(() => new Promise(() => {})), verify: vi.fn() };
    const pending = verifyContentPackage({ ...f, subtle, signal: controller.signal });
    controller.abort();
    expect(await pending).toMatchObject({ verified: false, reason: "cancelled", manifestSha256: null });
    expect(subtle.verify).not.toHaveBeenCalled();
  });
});
