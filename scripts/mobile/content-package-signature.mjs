import { createHash, createPublicKey, KeyObject, sign, verify } from "node:crypto";

const PURPOSE = "literary-planet-content-data";
const ENVIRONMENT = "local-qa";
const MANIFEST_CONTRACT = "literary-planet-data-package-v1";
const SIGNATURE_CONTRACT = "literary-planet-data-package-signature-v1";
const SHA256 = /^[a-f0-9]{64}$/u;
const MAX_FILE_BYTES = 16 * 1024 * 1024;
const MAX_PACKAGE_BYTES = 64 * 1024 * 1024;
const MANIFEST_KEYS = ["schemaVersion", "contract", "purpose", "environment", "releaseReady", "packageId", "version",
  "sourceCommit", "locales", "namespace", "childPolicy", "compatibility", "files"];
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const fail = reason => { throw new Error(reason); };
const plain = value => value !== null && typeof value === "object" && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));

function exact(value, keys, reason) {
  if (!plain(value) || Reflect.ownKeys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key)
    || !Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), "value"))) fail(reason);
}

/** Bounded sorted-key JSON. Array order and exact string values are retained.
 * This is the package protocol's canonical form, not a generic JSON signature. */
export function contentPackageCanonicalJson(value) {
  let nodes = 0;
  const active = new Set();
  function normalize(input, depth) {
    if (++nodes > 300_000 || depth > 48) fail("json-structure-limit");
    if (input === null || typeof input === "boolean" || typeof input === "string") return input;
    if (typeof input === "number" && Number.isFinite(input)) return input;
    if ((!plain(input) && !Array.isArray(input)) || active.has(input)) fail("invalid-plain-json");
    active.add(input);
    let result;
    if (Array.isArray(input)) {
      if (input.length > 100_000 || Object.keys(input).length !== input.length) fail("invalid-json-array");
      result = Array.from({ length: input.length }, (_, index) => {
        const descriptor = Object.getOwnPropertyDescriptor(input, index);
        if (!descriptor || !Object.hasOwn(descriptor, "value")) fail("json-accessor-rejected");
        return normalize(descriptor.value, depth + 1);
      });
    } else {
      result = Object.create(null);
      const keys = Reflect.ownKeys(input);
      if (keys.some(key => typeof key !== "string")) fail("unsafe-json-key");
      for (const key of keys.sort()) {
        if (["__proto__", "constructor", "prototype"].includes(key)) fail("unsafe-json-key");
        const descriptor = Object.getOwnPropertyDescriptor(input, key);
        if (!Object.hasOwn(descriptor, "value")) fail("json-accessor-rejected");
        result[key] = normalize(descriptor.value, depth + 1);
      }
    }
    active.delete(input);
    return result;
  }
  const result = JSON.stringify(normalize(value, 0));
  if (Buffer.byteLength(result) > MAX_FILE_BYTES) fail("json-byte-limit");
  return result;
}

function dataPath(value) {
  if (typeof value !== "string" || value.length > 240 || value !== value.normalize("NFC")
    || !/^[\p{L}\p{N}._-]+(?:\/[\p{L}\p{N}._-]+)*\.json$/u.test(value)
    || value.split("/").some(part => part === "." || part === ".." || part.endsWith(".")
      || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(part))
    || /^(?:assets|runtime|app|planet|scripts?|modules?)(?:\/|\.)/iu.test(value)
    || /(?:^|\/)(?:index|service-worker|sw|manifest|package|tsconfig)\.json$/iu.test(value)) fail("unsafe-data-file-path");
  return value;
}

function inspectDataBytes(value) {
  if (typeof value !== "string" && !(value instanceof Uint8Array)) fail("data-file-bytes-required");
  const bytes = typeof value === "string" ? Buffer.from(value, "utf8") : Buffer.from(value);
  if (!bytes.length || bytes.length > MAX_FILE_BYTES) fail("data-file-byte-limit");
  let source, parsed;
  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    parsed = JSON.parse(source);
  } catch { fail("invalid-utf8-json-data"); }
  if (!plain(parsed) && !Array.isArray(parsed)) fail("structured-json-data-required");
  // JSON.parse accepts duplicate keys. Reject even escaped duplicate spellings
  // before accepting content that another reader might interpret differently.
  const stack = []; let tokens = 0;
  for (const match of source.matchAll(/"(?:\\.|[^"\\])*"|[{}\[\],]/gu)) {
    if (++tokens > 600_000) fail("json-structure-limit");
    const token = match[0], current = stack.at(-1);
    if (token === "{") stack.push({ keys: new Set(), expectingKey: true });
    else if (token === "[") stack.push(null);
    else if (token === "}" || token === "]") stack.pop();
    else if (token === "," && current) current.expectingKey = true;
    else if (token.startsWith('"') && current?.expectingKey) {
      const key = JSON.parse(token);
      if (current.keys.has(key)) fail("duplicate-json-data-key");
      current.keys.add(key); current.expectingKey = false;
    }
  }
  contentPackageCanonicalJson(parsed);
  function inspect(item, field = "") {
    if (typeof item === "string") {
      // Text is rendered as text by the canonical projector; quotations about
      // code and ordinary evidence links are not executable package resources.
      if (/^(?:text|description|biography|title|quote|label|sourceUrl|evidenceUrl)$/u.test(field)) return;
      if (/^\s*(?:javascript:|data:|file:|blob:)/iu.test(item)
        || /^(?:https?:)?\/\/[^\s]+\.(?:[cm]?js|wasm)(?:[?#]|$)/iu.test(item)) fail("executable-data-reference-rejected");
    } else if (Array.isArray(item)) item.forEach(child => inspect(child, field));
    else if (plain(item)) for (const [key, child] of Object.entries(item)) {
      if (/^(?:scripts?|executable|runtime|remoteRuntime|module(?:Source|Url)?|webview(?:Url)?|onload|onerror)$/iu.test(key)) {
        fail("executable-data-field-rejected");
      }
      inspect(child, key);
    }
  }
  inspect(parsed);
  return { bytes, header: plain(parsed) ? parsed : null };
}

function actualInventory(files, context) {
  if (!Array.isArray(files) || files.length < 2 || files.length > 128) fail("invalid-data-file-count");
  const seen = new Set(); let total = 0;
  const result = files.map(file => {
    exact(file, ["path", "bytes"], "invalid-data-file");
    const path = dataPath(file.path), key = path.toLowerCase();
    if (seen.has(key)) fail("duplicate-data-file-path");
    seen.add(key);
    const { bytes, header } = inspectDataBytes(file.bytes);
    const expectedLocale = /^(ru|en)\//u.exec(path)?.[1];
    if (expectedLocale && header?.locale !== expectedLocale) fail("data-file-locale-mismatch");
    if (expectedLocale && (header.schemaVersion !== 1 || header.contract !== "literary-planet-content-candidate-v1"
      || header.sourceCommit !== context.sourceCommit || header.namespace !== context.namespace || header.releaseReady !== false)) {
      fail("data-file-context-mismatch");
    }
    total += bytes.length;
    if (total > MAX_PACKAGE_BYTES) fail("package-byte-limit");
    return { path, bytes: bytes.length, sha256: hash(bytes) };
  }).sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
  if (!["ru/", "en/"].every(prefix => result.some(file => file.path.startsWith(prefix)))) fail("bilingual-data-files-required");
  return result;
}

function policy(value, namespace) {
  if (namespace === "adult") { if (value !== null) fail("adult-child-policy-conflict"); return null; }
  if (namespace !== "child") fail("invalid-package-namespace");
  exact(value, ["policyId", "version", "sha256"], "exact-child-policy-required");
  if (typeof value.policyId !== "string" || !/^[a-z0-9][a-z0-9._-]{0,95}$/u.test(value.policyId)
    || typeof value.version !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/u.test(value.version)
    || typeof value.sha256 !== "string" || !SHA256.test(value.sha256)) fail("invalid-child-policy");
  return { policyId: value.policyId, version: value.version, sha256: value.sha256 };
}

function normalizeManifest(input) {
  contentPackageCanonicalJson(input);
  exact(input, MANIFEST_KEYS, "invalid-package-manifest-schema");
  if (input.schemaVersion !== 1 || input.contract !== MANIFEST_CONTRACT || input.purpose !== PURPOSE
    || input.environment !== ENVIRONMENT || input.releaseReady !== false) fail("unsupported-package-purpose-or-environment");
  if (typeof input.packageId !== "string" || !/^[a-z0-9][a-z0-9._-]{0,95}$/u.test(input.packageId)
    || !Number.isSafeInteger(input.version) || input.version < 1
    || typeof input.sourceCommit !== "string" || !/^[a-f0-9]{40}$/u.test(input.sourceCommit)) fail("invalid-package-identity");
  if (!Array.isArray(input.locales) || input.locales.length !== 2 || input.locales[0] !== "ru" || input.locales[1] !== "en") fail("exact-bilingual-locales-required");
  const childPolicy = policy(input.childPolicy, input.namespace);
  exact(input.compatibility, ["catalogSchemaVersion", "minimumReaderVersion", "maximumReaderVersion"], "invalid-package-compatibility");
  if (input.compatibility.catalogSchemaVersion !== 1 || !Number.isSafeInteger(input.compatibility.minimumReaderVersion)
    || !Number.isSafeInteger(input.compatibility.maximumReaderVersion) || input.compatibility.minimumReaderVersion < 1
    || input.compatibility.maximumReaderVersion > 1_000_000 || input.compatibility.maximumReaderVersion < input.compatibility.minimumReaderVersion) fail("invalid-package-compatibility");
  if (!Array.isArray(input.files) || input.files.length < 2 || input.files.length > 128) fail("invalid-data-file-count");
  const seen = new Set(); let total = 0;
  const files = input.files.map(file => {
    exact(file, ["path", "bytes", "sha256"], "invalid-file-inventory-record");
    const path = dataPath(file.path), key = path.toLowerCase();
    if (seen.has(key)) fail("duplicate-data-file-path");
    seen.add(key);
    if (!Number.isSafeInteger(file.bytes) || file.bytes < 1 || file.bytes > MAX_FILE_BYTES || !SHA256.test(file.sha256)) fail("invalid-file-inventory-record");
    total += file.bytes;
    if (total > MAX_PACKAGE_BYTES) fail("package-byte-limit");
    return { path, bytes: file.bytes, sha256: file.sha256 };
  }).sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
  if (!["ru/", "en/"].every(prefix => files.some(file => file.path.startsWith(prefix)))) fail("bilingual-data-files-required");
  return { schemaVersion: 1, contract: MANIFEST_CONTRACT, purpose: PURPOSE, environment: ENVIRONMENT, releaseReady: false,
    packageId: input.packageId, version: input.version, sourceCommit: input.sourceCommit, locales: ["ru", "en"],
    namespace: input.namespace, childPolicy, compatibility: { ...input.compatibility }, files };
}

/** Preparation alone never creates a signature, approves editorial content or
 * enables application/child-mode activation. Files contain data only. */
export function prepareContentPackageManifest({ packageId, version, sourceCommit, namespace = "adult", childPolicy = null,
  compatibility = { catalogSchemaVersion: 1, minimumReaderVersion: 1, maximumReaderVersion: 1 }, files } = {}) {
  return normalizeManifest({ schemaVersion: 1, contract: MANIFEST_CONTRACT, purpose: PURPOSE, environment: ENVIRONMENT,
    releaseReady: false, packageId, version, sourceCommit, locales: ["ru", "en"], namespace, childPolicy, compatibility,
    files: actualInventory(files, { sourceCommit, namespace }) });
}

function keyId(value) {
  if (typeof value !== "string" || !/^content-qa-[A-Za-z0-9_-]{1,64}$/u.test(value)) fail("dedicated-content-qa-key-id-required");
  return value;
}

function dedicatedKey(key, type) {
  if (!(key instanceof KeyObject) || key.type !== type || key.asymmetricKeyType !== "ec") fail("explicit-p256-key-object-required");
  const publicKey = type === "private" ? createPublicKey(key) : key;
  const jwk = publicKey.export({ format: "jwk" });
  if (jwk.kty !== "EC" || jwk.crv !== "P-256") fail("explicit-p256-key-object-required");
  return key;
}

function protectedBytes(manifest, id) {
  return Buffer.from(`${SIGNATURE_CONTRACT}\u0000${contentPackageCanonicalJson({ algorithm: "ES256", contract: SIGNATURE_CONTRACT,
    purpose: PURPOSE, environment: ENVIRONMENT, keyId: id, manifest })}`, "utf8");
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
    contentPackageCanonicalJson(envelope);
    exact(envelope, ["contract", "algorithm", "keyId", "manifest", "signature"], "invalid-signature-envelope");
    if (envelope.contract !== SIGNATURE_CONTRACT || envelope.algorithm !== "ES256") fail("unsupported-signature-contract");
    keyId(envelope.keyId);
    const manifest = normalizeManifest(envelope.manifest);
    exact(expected, ["packageId", "version", "sourceCommit", "namespace", "childPolicy", "readerVersion"], "exact-reader-context-required");
    policy(expected.childPolicy, expected.namespace);
    if (!["packageId", "version", "sourceCommit", "namespace"].every(key => expected[key] === manifest[key])
      || contentPackageCanonicalJson(expected.childPolicy) !== contentPackageCanonicalJson(manifest.childPolicy)) fail("package-context-mismatch");
    if (!Number.isSafeInteger(expected.readerVersion) || expected.readerVersion < manifest.compatibility.minimumReaderVersion
      || expected.readerVersion > manifest.compatibility.maximumReaderVersion) fail("incompatible-package-reader");
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
    if (typeof envelope.signature !== "string" || !/^[A-Za-z0-9_-]{86}$/u.test(envelope.signature)) fail("invalid-signature-encoding");
    const signature = Buffer.from(envelope.signature, "base64url");
    if (signature.length !== 64 || signature.toString("base64url") !== envelope.signature) fail("invalid-signature-encoding");
    if (!verify("sha256", protectedBytes(manifest, envelope.keyId), { key: selected, dsaEncoding: "ieee-p1363" }, signature)) fail("invalid-content-signature");
    if (contentPackageCanonicalJson(actualInventory(files, manifest)) !== contentPackageCanonicalJson(manifest.files)) fail("package-file-integrity-mismatch");
    result.manifestSha256 = hash(contentPackageCanonicalJson(manifest));
    result.verified = true;
  } catch (error) {
    result.reason = error instanceof Error ? error.message : "invalid-package-input";
  }
  return result;
}
