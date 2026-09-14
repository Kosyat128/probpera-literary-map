import { createPublicKey, KeyObject, sign, verify } from "node:crypto";
import {
  CONTENT_PACKAGE_PURPOSE as PURPOSE, CONTENT_PACKAGE_ENVIRONMENT as ENVIRONMENT,
  CONTENT_PACKAGE_SIGNATURE_CONTRACT as SIGNATURE_CONTRACT,
  contentPackageCanonicalJson, contentPackageHash as hash, contentPackageExact as exact,
  validateContentPackageKeyId as keyId, contentPackageSigningBytes as protectedBytes,
  normalizeContentPackageManifest as normalizeManifest, contentPackageFileInventory as actualInventory,
  inspectContentPackageEnvelope, decodeContentPackageSignature,
} from "../../src/planet/contentPackageProtocol.mjs";
export { contentPackageCanonicalJson, prepareContentPackageManifest } from "../../src/planet/contentPackageProtocol.mjs";

const fail = reason => { throw new Error(reason); };

function dedicatedKey(key, type) {
  if (!(key instanceof KeyObject) || key.type !== type || key.asymmetricKeyType !== "ec") fail("explicit-p256-key-object-required");
  const publicKey = type === "private" ? createPublicKey(key) : key;
  const jwk = publicKey.export({ format: "jwk" });
  if (jwk.kty !== "EC" || jwk.crv !== "P-256") fail("explicit-p256-key-object-required");
  return key;
}

/** The caller must provision a dedicated content key. No license/app key is
 * discovered or reused, and no key is generated or persisted by this module. */
export function signContentPackageManifest({ manifest, keyId: id, privateKey } = {}) {
  const normalized = normalizeManifest(manifest);
  keyId(id); dedicatedKey(privateKey, "private");
  const signature = sign("sha256", protectedBytes(normalized, id), { key: privateKey, dsaEncoding: "ieee-p1363" });
  return { contract: SIGNATURE_CONTRACT, algorithm: "ES256", keyId: id, manifest: normalized, signature: signature.toString("base64url") };
}

/** Integrity verification is explicitly not activation authorization. Exact
 * caller-pinned namespace and child policy are required independently; an
 * adult package or declared flag can never enable a child experience. */
export function verifyContentPackageSignature({ envelope, files, trustedKeys, expected } = {}) {
  const result = { verified: false, activationAllowed: false, childModeEnabled: false, releaseReady: false,
    environment: ENVIRONMENT, manifestSha256: null, reason: null };
  try {
    const { manifest } = inspectContentPackageEnvelope(envelope, expected);
    if (!Array.isArray(trustedKeys) || !trustedKeys.length || trustedKeys.length > 8) fail("trusted-content-keys-required");
    const seen = new Set(), fingerprints = new Set(); let selected;
    for (const key of trustedKeys) {
      exact(key, ["keyId", "purpose", "environment", "publicKey"], "invalid-trusted-content-key");
      keyId(key.keyId);
      if (key.purpose !== PURPOSE || key.environment !== ENVIRONMENT || seen.has(key.keyId)) fail("invalid-trusted-content-key");
      seen.add(key.keyId); dedicatedKey(key.publicKey, "public");
      const fingerprint = hash(key.publicKey.export({ type: "spki", format: "der" }));
      if (fingerprints.has(fingerprint)) fail("duplicate-trusted-content-key");
      fingerprints.add(fingerprint);
      if (key.keyId === envelope.keyId) selected = key.publicKey;
    }
    if (!selected) fail("unknown-content-key");
    const signature = decodeContentPackageSignature(envelope.signature);
    if (!verify("sha256", protectedBytes(manifest, envelope.keyId), { key: selected, dsaEncoding: "ieee-p1363" }, signature)) fail("invalid-content-signature");
    if (contentPackageCanonicalJson(actualInventory(files, manifest)) !== contentPackageCanonicalJson(manifest.files)) fail("package-file-integrity-mismatch");
    result.manifestSha256 = hash(contentPackageCanonicalJson(manifest));
    result.verified = true;
  } catch (error) {
    result.reason = error instanceof Error ? error.message : "invalid-package-input";
  }
  return result;
}
