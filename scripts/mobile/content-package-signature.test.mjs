import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { contentPackageCanonicalJson, prepareContentPackageManifest, signContentPackageManifest, verifyContentPackageSignature } from "./content-package-signature.mjs";

// Ephemeral synthetic keys exist only in this test process. No file, keystore,
// application key, production signature or editorial approval is involved.
const pair = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const anotherPair = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const sourceCommit = "a".repeat(40);
const keyId = "content-qa-synthetic-test";
const trustedKeys = [{ keyId, purpose: "literary-planet-content-data", environment: "local-qa", publicKey: pair.publicKey }];
const childPolicy = { policyId: "synthetic-exact-age-policy", version: "fixture-1", sha256: "b".repeat(64) };

function files(namespace = "adult") {
  return ["ru", "en"].map(locale => ({ path: `${locale}/catalog.json`, bytes: JSON.stringify({
    schemaVersion: 1, contract: "literary-planet-content-candidate-v1", locale, sourceCommit, namespace, releaseReady: false,
    units: [{ id: "synthetic-only", text: locale === "ru" ? "Тестовая запись" : "Synthetic entry" }],
  }) })).concat([{ path: "dependency-index.json", bytes: '{"schemaVersion":1,"dependencies":[]}' }]);
}

function fixture(namespace = "adult") {
  const actualFiles = files(namespace);
  const input = { packageId: "synthetic-canonical-data", version: 2, sourceCommit, namespace,
    childPolicy: namespace === "child" ? childPolicy : null, files: actualFiles };
  const manifest = prepareContentPackageManifest(input);
  const expected = { packageId: input.packageId, version: 2, sourceCommit, namespace, childPolicy: input.childPolicy, readerVersion: 1 };
  const envelope = signContentPackageManifest({ manifest, keyId, privateKey: pair.privateKey });
  return { input, manifest, envelope, files: actualFiles, expected, trustedKeys };
}

const sha = value => createHash("sha256").update(value).digest("hex");

describe("bounded unsigned canonical data package preparation", () => {
  it("is deterministic, hashes exact actual bytes, and keeps RU/EN and source identity together", () => {
    const f = fixture();
    const reversed = prepareContentPackageManifest({ ...f.input, files: [...f.files].reverse() });
    expect(reversed).toEqual(f.manifest);
    expect(f.manifest).toMatchObject({ version: 2, locales: ["ru", "en"], environment: "local-qa", releaseReady: false,
      sourceCommit, namespace: "adult", childPolicy: null });
    for (const actual of f.files) expect(f.manifest.files.find(file => file.path === actual.path))
      .toEqual({ path: actual.path, bytes: Buffer.byteLength(actual.bytes), sha256: sha(actual.bytes) });
    expect(f.manifest).not.toHaveProperty("signature");
  });

  it("retains literary quotations and factual source links as plain data", () => {
    const actualFiles = files();
    const content = JSON.parse(actualFiles[1].bytes);
    content.units[0].text = 'The manuscript quotes "<script>" while discussing JavaScript; nothing is executed.';
    content.units[0].sourceUrl = "https://example.org/factual-source.html";
    actualFiles[1].bytes = JSON.stringify(content);
    expect(prepareContentPackageManifest({ packageId: "synthetic", version: 1, sourceCommit, files: actualFiles }).files).toHaveLength(3);
  });

  it.each(["../catalog.json", "en\\catalog.json", "https://remote.invalid/catalog.json", "/en/catalog.json", "en/catalog.js", "en/index.html",
    "en/worker.wasm", "runtime/config.json", "assets/config.json", "planet/en/catalog.json", "en/index.json", "en/CON.json", "en/%2e%2e.json"])
  ("rejects executable, routed or unsafe data path %s", path => {
    const actualFiles = files(); actualFiles[1].path = path;
    expect(() => prepareContentPackageManifest({ packageId: "synthetic", version: 1, sourceCommit, files: actualFiles })).toThrow("unsafe-data-file-path");
  });

  it.each(["duplicate", "case-duplicate", "missing-en", "wrong-locale", "wrong-source", "adult-as-child"])("rejects %s data identity", mode => {
    const f = fixture(); const actualFiles = [...f.files];
    if (mode === "duplicate") actualFiles.push({ ...actualFiles[0] });
    if (mode === "case-duplicate") actualFiles.push({ ...actualFiles[0], path: "RU/catalog.json" });
    if (mode === "missing-en") actualFiles.splice(1, 1);
    if (mode === "wrong-locale") actualFiles[0] = { ...actualFiles[0], bytes: actualFiles[1].bytes };
    if (mode === "wrong-source") actualFiles[0] = { ...actualFiles[0], bytes: actualFiles[0].bytes.replace(sourceCommit, "c".repeat(40)) };
    expect(() => prepareContentPackageManifest({ ...f.input, files: actualFiles,
      ...(mode === "adult-as-child" ? { namespace: "child", childPolicy } : {}) })).toThrow();
  });

  it.each([
    '{"locale":"ru","locale":"en"}', '{"locale":"ru","\\u006cocale":"ru"}',
    '{"runtime":"https://remote.invalid/app.js"}', '{"moduleUrl":"https://remote.invalid/app"}',
    '{"url":"https://remote.invalid/app.js"}', '{"url":"javascript:alert(1)"}',
    '{"__proto__":{"polluted":true}}', 'not-json', 'true',
  ])("rejects malformed, ambiguous or executable JSON bytes %s", bytes => {
    const actualFiles = files(); actualFiles[2] = { path: "dependency-index.json", bytes };
    expect(() => prepareContentPackageManifest({ packageId: "synthetic", version: 1, sourceCommit, files: actualFiles })).toThrow();
  });

  it("rejects invalid UTF8 bytes and getters without executing them", () => {
    const actualFiles = files(); actualFiles[2] = { path: "dependency-index.json", bytes: Uint8Array.from([123, 34, 192, 175, 34, 58, 49, 125]) };
    expect(() => prepareContentPackageManifest({ packageId: "synthetic", version: 1, sourceCommit, files: actualFiles })).toThrow("invalid-utf8-json-data");
    const getter = vi.fn(() => "never");
    expect(() => contentPackageCanonicalJson(Object.defineProperty({}, "text", { get: getter, enumerable: true }))).toThrow("json-accessor-rejected");
    const array = []; Object.defineProperty(array, 0, { get: getter, enumerable: true });
    expect(() => contentPackageCanonicalJson(array)).toThrow("json-accessor-rejected");
    expect(getter).not.toHaveBeenCalled();
  });

  it.each([0, -1, 1.5, "2", Number.MAX_SAFE_INTEGER + 1])("rejects invalid generation %j", version => {
    const f = fixture();
    expect(() => prepareContentPackageManifest({ ...f.input, version })).toThrow("invalid-package-identity");
  });

  it("rejects cyclic, sparse and deeply nested structures", () => {
    const cycle = {}; cycle.self = cycle;
    expect(() => contentPackageCanonicalJson(cycle)).toThrow("invalid-plain-json");
    expect(() => contentPackageCanonicalJson(new Array(3))).toThrow("invalid-json-array");
    let deep = {}; for (let index = 0; index < 50; index++) deep = { child: deep };
    expect(() => contentPackageCanonicalJson(deep)).toThrow("json-structure-limit");
  });
});

describe("purpose-separated local QA content signatures", () => {
  it("verifies the explicit content key and all exact files without allowing activation or release", () => {
    const f = fixture();
    expect(verifyContentPackageSignature(f)).toEqual({ verified: true, activationAllowed: false, childModeEnabled: false,
      releaseReady: false, environment: "local-qa", manifestSha256: sha(contentPackageCanonicalJson(f.manifest)), reason: null });
    expect(f.envelope.signature).toMatch(/^[A-Za-z0-9_-]{86}$/u);
  });

  it.each(["changed", "missing", "added"])("rejects %s actual file bytes without accepting a partial package", mode => {
    const f = fixture();
    if (mode === "changed") f.files[1].bytes = f.files[1].bytes.replace("Synthetic entry", "Changed entry");
    if (mode === "missing") f.files.pop();
    if (mode === "added") f.files.push({ path: "extra.json", bytes: "{}" });
    expect(verifyContentPackageSignature(f)).toMatchObject({ verified: false, reason: "package-file-integrity-mismatch", activationAllowed: false });
  });

  it.each(["sourceCommit", "version", "namespace", "packageId", "readerVersion"])("rejects incompatible caller-pinned %s", field => {
    const f = fixture();
    if (field === "sourceCommit") f.expected.sourceCommit = "d".repeat(40);
    if (field === "version") f.expected.version = 3; // older signed generation cannot satisfy the current caller checkpoint.
    if (field === "namespace") { f.expected.namespace = "child"; f.expected.childPolicy = childPolicy; }
    if (field === "packageId") f.expected.packageId = "another-canonical-package";
    if (field === "readerVersion") f.expected.readerVersion = 2;
    expect(verifyContentPackageSignature(f)).toMatchObject({ verified: false, activationAllowed: false });
  });

  it("binds exact child policy independently and never derives child-mode permission", () => {
    const f = fixture("child");
    expect(verifyContentPackageSignature(f)).toMatchObject({ verified: true, activationAllowed: false, childModeEnabled: false });
    f.expected.childPolicy = { ...childPolicy, sha256: "c".repeat(64) };
    expect(verifyContentPackageSignature(f)).toMatchObject({ verified: false, reason: "package-context-mismatch" });
    expect(() => prepareContentPackageManifest({ ...f.input, childPolicy: true })).toThrow("exact-child-policy-required");
  });

  it.each(["production-manifest", "release-flag", "license-purpose", "production-key", "duplicate-key", "duplicate-public-key", "private-trust-key", "unknown-key", "wrong-public-key"])
  ("rejects %s instead of reusing application authorization", mode => {
    const f = fixture(); f.trustedKeys = trustedKeys.map(key => ({ ...key }));
    if (mode === "production-manifest") f.envelope.manifest.environment = "production";
    if (mode === "release-flag") f.envelope.manifest.releaseReady = true;
    if (mode === "license-purpose") f.trustedKeys[0].purpose = "literary-planet-paid-license";
    if (mode === "production-key") f.trustedKeys[0].environment = "production";
    if (mode === "duplicate-key") f.trustedKeys.push({ ...f.trustedKeys[0] });
    if (mode === "duplicate-public-key") f.trustedKeys.push({ ...f.trustedKeys[0], keyId: "content-qa-another-alias" });
    if (mode === "private-trust-key") f.trustedKeys[0].publicKey = pair.privateKey;
    if (mode === "unknown-key") f.trustedKeys[0].keyId = "content-qa-unknown";
    if (mode === "wrong-public-key") f.trustedKeys[0].publicKey = anotherPair.publicKey;
    expect(verifyContentPackageSignature(f)).toMatchObject({ verified: false, releaseReady: false });
  });

  it("rejects signature/header/payload tampering and bare JSON signatures from another purpose", () => {
    const f = fixture();
    f.envelope.signature = sign("sha256", Buffer.from(contentPackageCanonicalJson(f.manifest)), { key: pair.privateKey, dsaEncoding: "ieee-p1363" }).toString("base64url");
    expect(verifyContentPackageSignature(f)).toMatchObject({ verified: false, reason: "invalid-content-signature" });
    f.envelope = signContentPackageManifest({ manifest: f.manifest, keyId, privateKey: pair.privateKey });
    f.envelope.manifest.files[0].sha256 = "e".repeat(64);
    expect(verifyContentPackageSignature(f)).toMatchObject({ verified: false, reason: "invalid-content-signature" });
    f.envelope.algorithm = "none";
    expect(verifyContentPackageSignature(f)).toMatchObject({ verified: false, reason: "unsupported-signature-contract" });
  });

  it.each(["missing-private-key", "public-as-private", "wrong-curve", "license-key-id", "production-manifest"])("does not sign with %s", mode => {
    const f = fixture(); let privateKey = pair.privateKey, id = keyId;
    if (mode === "missing-private-key") privateKey = undefined;
    if (mode === "public-as-private") privateKey = pair.publicKey;
    if (mode === "wrong-curve") privateKey = generateKeyPairSync("ec", { namedCurve: "secp384r1" }).privateKey;
    if (mode === "license-key-id") id = "app-license-key";
    if (mode === "production-manifest") f.manifest.environment = "production";
    expect(() => signContentPackageManifest({ manifest: f.manifest, keyId: id, privateKey })).toThrow();
  });

  it("fails closed on missing context, additional manifest keys, malformed signature and no trusted keys", () => {
    const f = fixture();
    expect(verifyContentPackageSignature({ ...f, expected: undefined })).toMatchObject({ verified: false, reason: "exact-reader-context-required" });
    expect(verifyContentPackageSignature({ ...f, trustedKeys: [] })).toMatchObject({ verified: false, reason: "trusted-content-keys-required" });
    f.envelope.signature += "=";
    expect(verifyContentPackageSignature(f)).toMatchObject({ verified: false, reason: "invalid-signature-encoding" });
    f.envelope.manifest.childSafe = true;
    expect(verifyContentPackageSignature(f)).toMatchObject({ verified: false, reason: "invalid-package-manifest-schema" });
  });
});
