import { generateKeyPairSync, webcrypto } from "node:crypto";
import { prepareContentPackageManifest, signContentPackageManifest } from "../../scripts/mobile/content-package-signature.mjs";
import { contentPackageCanonicalJson, contentPackageHash } from "../../src/planet/contentPackageProtocol.mjs";

// Ephemeral synthetic keys only. This module is never bundled into the application.
const pair = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
export const otherPair = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
export const contentTestSubtle = webcrypto.subtle;
export function contentPackageFixture(version = 1, namespace = "adult") {
  const keyId = "content-qa-browser-fixture", sourceCommit = "a".repeat(40);
  const files = ["ru", "en"].map(locale => ({ path: `${locale}/catalog.json`, bytes: JSON.stringify({
    schemaVersion: 1, contract: "literary-planet-content-candidate-v1", sourceCommit, namespace, locale, releaseReady: false,
    units: [{ id: "synthetic-fixture", text: locale === "ru" ? "Тест" : "Test", version }],
  }) }));
  files.push({ path: "dependency-index.json", bytes: '{"schemaVersion":1,"dependencies":[]}' });
  const childPolicy = namespace === "child" ? { policyId: "synthetic-policy", version: "1", sha256: "b".repeat(64) } : null;
  const manifest = prepareContentPackageManifest({ packageId: "synthetic-canonical-package", version, sourceCommit, namespace, childPolicy, files });
  const envelope = signContentPackageManifest({ manifest, keyId, privateKey: pair.privateKey });
  const expected = { packageId: manifest.packageId, version, sourceCommit, namespace, childPolicy, readerVersion: 1 };
  const trustedKeys = [{ keyId, purpose: manifest.purpose, environment: manifest.environment, jwk: pair.publicKey.export({ format: "jwk" }) }];
  return { envelope, expected, files, trustedKeys, subtle: contentTestSubtle,
    manifestSha256: contentPackageHash(contentPackageCanonicalJson(manifest)),
    nodeTrustedKeys: [{ keyId, purpose: manifest.purpose, environment: manifest.environment, publicKey: pair.publicKey }] };
}
