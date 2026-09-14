import {
  CONTENT_PACKAGE_ENVIRONMENT, CONTENT_PACKAGE_PURPOSE,
  contentPackageCanonicalJson, contentPackageExact, contentPackageFileInventory, contentPackageHash,
  contentPackageSigningBytes, decodeContentPackageSignature, inspectContentPackageEnvelope, validateContentPackageKeyId,
} from "./contentPackageProtocol.mjs";

export interface ContentPackageTrustKey {
  readonly keyId: string;
  readonly purpose: "literary-planet-content-data";
  readonly environment: "local-qa";
  /** Selected independently by the application/QA harness, never from a downloaded envelope. */
  readonly jwk: JsonWebKey;
}
export interface ContentPackageVerification {
  readonly verified: boolean;
  readonly activationAllowed: false;
  readonly childModeEnabled: false;
  readonly releaseReady: false;
  readonly environment: "local-qa";
  readonly manifestSha256: string | null;
  readonly reason: string | null;
}
export interface ContentPackageVerificationInput {
  readonly envelope: unknown;
  readonly files: unknown;
  readonly expected: unknown;
  readonly trustedKeys: unknown;
  readonly signal?: AbortSignal;
  /** Absent uses native WebCrypto. Null explicitly disables this capability. */
  readonly subtle?: SubtleCrypto | null;
}

function fail(reason: string): never { throw new Error(reason); }
const hasOwn = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);
function coordinate(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{43}$/u.test(value)) return fail("invalid-trusted-content-key");
  const decoded = atob(value.replace(/-/gu, "+").replace(/_/gu, "/") + "=");
  if (decoded.length !== 32 || btoa(decoded).replace(/\+/gu, "-").replace(/\//gu, "_").replace(/=+$/u, "") !== value) return fail("invalid-trusted-content-key");
  return value;
}

/** Copies all public key fields before the first async call; caller mutation
 * cannot change a verification already in flight. No private material allowed. */
export function normalizeContentPackageTrust(value: unknown): readonly ContentPackageTrustKey[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 8) return fail("trusted-content-keys-required");
  contentPackageCanonicalJson(value);
  const ids = new Set<string>(), points = new Set<string>();
  return Object.freeze(value.map(item => {
    contentPackageExact(item, ["keyId", "purpose", "environment", "jwk"], "invalid-trusted-content-key");
    const id = validateContentPackageKeyId(item.keyId);
    if (item.purpose !== CONTENT_PACKAGE_PURPOSE || item.environment !== CONTENT_PACKAGE_ENVIRONMENT || ids.has(id)) return fail("invalid-trusted-content-key");
    ids.add(id);
    const key = item.jwk;
    if (!key || typeof key !== "object" || Array.isArray(key)
      || Object.keys(key).some(field => !["kty", "crv", "x", "y", "alg", "use", "key_ops", "ext", "kid"].includes(field))
      || key.kty !== "EC" || key.crv !== "P-256"
      || (hasOwn(key, "alg") && key.alg !== "ES256") || (hasOwn(key, "use") && key.use !== "sig")
      || (hasOwn(key, "ext") && typeof key.ext !== "boolean")
      || (hasOwn(key, "kid") && key.kid !== id)
      || (hasOwn(key, "key_ops") && (!Array.isArray(key.key_ops) || key.key_ops.length !== 1 || key.key_ops[0] !== "verify"))) return fail("invalid-trusted-content-key");
    const x = coordinate(key.x), y = coordinate(key.y), point = x + ":" + y;
    if (points.has(point)) return fail("duplicate-trusted-content-key");
    points.add(point);
    return Object.freeze({ keyId: id, purpose: CONTENT_PACKAGE_PURPOSE, environment: CONTENT_PACKAGE_ENVIRONMENT,
      jwk: Object.freeze({ kty: "EC", crv: "P-256", x, y }) });
  }));
}

/** Cancelling WebCrypto cannot undo computation, but it suppresses acceptance. */
async function abortable<T>(operation: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return operation;
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error: unknown, value?: T) => {
      if (settled) return;
      settled = true; signal.removeEventListener("abort", abort);
      if (error) reject(error); else resolve(value as T);
    };
    const abort = () => finish(new Error("cancelled"));
    operation.then(value => finish(null, value), error => finish(error));
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
  });
}

/** Portable integrity verifier for the S08 data-only protocol. This cannot
 * approve editorial content, authorize a purchase or enable an adult/child view.
 * The returned digest is canonical JSON, not the pretty on-disk manifest hash. */
export async function verifyContentPackage(input: ContentPackageVerificationInput): Promise<ContentPackageVerification> {
  const signal = input.signal;
  const result = { verified: false, activationAllowed: false as const, childModeEnabled: false as const,
    releaseReady: false as const, environment: CONTENT_PACKAGE_ENVIRONMENT, manifestSha256: null as string | null, reason: null as string | null };
  try {
    if (signal?.aborted) fail("cancelled");
    const { manifest, keyId, signature: encoded } = inspectContentPackageEnvelope(input.envelope, input.expected);
    const trusted = normalizeContentPackageTrust(input.trustedKeys);
    if (!trusted.some(key => key.keyId === keyId)) fail("unknown-content-key");
    const signature = decodeContentPackageSignature(encoded), signingBytes = contentPackageSigningBytes(manifest, keyId);
    // Hash the bounded synchronous snapshot before awaiting crypto; later caller
    // mutation cannot change the byte inventory whose signature is checked.
    const inventory = contentPackageFileInventory(input.files, manifest);
    if (contentPackageCanonicalJson(inventory) !== contentPackageCanonicalJson(manifest.files)) fail("package-file-integrity-mismatch");
    const manifestHash = contentPackageHash(contentPackageCanonicalJson(manifest));
    const subtle = input.subtle === undefined ? globalThis.crypto?.subtle : input.subtle;
    if (!subtle) fail("crypto-unavailable");
    let selected: CryptoKey | undefined;
    for (const key of trusted) {
      let imported: CryptoKey;
      try { imported = await abortable(subtle.importKey("jwk", { ...key.jwk }, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]), signal); }
      catch { fail(signal?.aborted ? "cancelled" : "invalid-trusted-content-key"); }
      if (key.keyId === keyId) selected = imported!;
    }
    if (!selected) fail("unknown-content-key");
    let valid: boolean;
    try { valid = await abortable(subtle.verify({ name: "ECDSA", hash: "SHA-256" }, selected, signature, signingBytes), signal); }
    catch { fail(signal?.aborted ? "cancelled" : "invalid-content-signature"); }
    if (!valid!) fail("invalid-content-signature");
    if (signal?.aborted) fail("cancelled");
    result.verified = true; result.manifestSha256 = manifestHash;
  } catch (error) { result.reason = error instanceof Error ? error.message : "invalid-package-input"; }
  return Object.freeze(result);
}
