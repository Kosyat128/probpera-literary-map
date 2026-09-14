import { createHash } from "node:crypto";
import { contentPackageCanonicalJson, prepareContentPackageManifest } from "./content-package-signature.mjs";

const PACKAGE_PATHS = ["dependency-index.json", "en/catalog.json", "ru/catalog.json"];
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const plain = value => value !== null && typeof value === "object" && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const fail = reason => { throw new Error(reason); };

function parseBytes(bytes, maximum, label) {
  if (!(bytes instanceof Uint8Array) || !bytes.byteLength || bytes.byteLength > maximum) fail(`Invalid previous ${label} bytes`);
  let source, parsed;
  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    parsed = JSON.parse(source);
  } catch { fail(`Invalid previous ${label} UTF8/JSON`); }
  // Reject duplicate keys, including escaped spellings. Candidate diagnostics
  // have a larger bound than downloadable JSON and are never packaged here.
  const stack = []; let tokens = 0;
  for (const match of source.matchAll(/"(?:\\.|[^"\\])*"|[{}\[\],]/gu)) {
    if (++tokens > 8_000_000 || stack.length > 64) fail(`Previous ${label} JSON structure exceeds bound`);
    const token = match[0], current = stack.at(-1);
    if (token === "{") stack.push({ keys: new Set(), expectingKey: true });
    else if (token === "[") stack.push(null);
    else if (token === "}" || token === "]") stack.pop();
    else if (token === "," && current) current.expectingKey = true;
    else if (token.startsWith('"') && current?.expectingKey) {
      const key = JSON.parse(token);
      if (current.keys.has(key) || ["__proto__", "prototype", "constructor"].includes(key)) fail(`Ambiguous previous ${label} JSON key`);
      current.keys.add(key); current.expectingKey = false;
    }
  }
  return parsed;
}

/** Verifies a caller-pinned previous local generation before its dependency
 * state is reused. The pin hashes EXACT raw manifest bytes, not canonical JSON.
 * This detects local corruption; it authenticates neither editorial approval
 * nor a self-supplied signing key. compareContentCandidates must subsequently
 * validate candidate units and the dependency index's currentCandidateHash. */
export function verifyPreviousContentExport({ candidateBytes, manifestBytes, files, expectedManifestSha256 } = {}) {
  if (typeof expectedManifestSha256 !== "string" || !/^[a-f0-9]{64}$/u.test(expectedManifestSha256)) {
    fail("An external exact previous manifest SHA256 is required");
  }
  if (!(manifestBytes instanceof Uint8Array) || !manifestBytes.byteLength || manifestBytes.byteLength > 1024 * 1024) {
    fail("Invalid previous manifest bytes");
  }
  const manifestSha256 = hash(manifestBytes);
  if (manifestSha256 !== expectedManifestSha256) fail("Previous manifest does not match its external SHA256 pin");
  const manifest = parseBytes(manifestBytes, 1024 * 1024, "manifest");
  const candidate = parseBytes(candidateBytes, 64 * 1024 * 1024, "candidate");
  if (!plain(candidate) || Object.keys(candidate).sort().join(",") !== "contract,held,namespace,releaseReady,requiredLocales,schemaVersion,sourceCommit,units"
    || candidate.schemaVersion !== 1 || candidate.contract !== "literary-planet-content-candidate-v1"
    || candidate.namespace !== "adult" || candidate.releaseReady !== false
    || typeof candidate.sourceCommit !== "string" || !/^[a-f0-9]{40}$/u.test(candidate.sourceCommit)
    || !Array.isArray(candidate.requiredLocales) || candidate.requiredLocales.length !== 2
    || candidate.requiredLocales[0] !== "ru" || candidate.requiredLocales[1] !== "en"
    || !Array.isArray(candidate.units) || candidate.units.length > 200_000
    || !Array.isArray(candidate.held) || candidate.held.length > 200_000) fail("Invalid previous adult content candidate");
  if (!plain(manifest) || manifest.packageId !== "literary-planet-adult-candidate" || manifest.namespace !== "adult"
    || manifest.sourceCommit !== candidate.sourceCommit || manifest.childPolicy !== null) fail("Previous candidate and manifest context differ");
  if (!Array.isArray(files) || files.length !== 3 || !Array.isArray(manifest.files) || manifest.files.length !== 3
    || files.map(file => file?.path).sort().join(",") !== PACKAGE_PATHS.join(",")
    || manifest.files.map(file => file?.path).sort().join(",") !== PACKAGE_PATHS.join(",")) fail("Previous package must contain exactly its three canonical data files");

  const rebuilt = prepareContentPackageManifest({ packageId: manifest.packageId, version: manifest.version,
    sourceCommit: candidate.sourceCommit, namespace: "adult", childPolicy: null, compatibility: manifest.compatibility, files });
  if (contentPackageCanonicalJson(rebuilt) !== contentPackageCanonicalJson(manifest)) fail("Previous package manifest/file integrity mismatch");
  const dependencyFile = files.find(file => file.path === "dependency-index.json");
  const dependencyBytes = typeof dependencyFile.bytes === "string" ? Buffer.from(dependencyFile.bytes, "utf8") : dependencyFile.bytes;
  const dependencies = parseBytes(dependencyBytes, 16 * 1024 * 1024, "dependency index");
  if (!plain(dependencies) || dependencies.schemaVersion !== 1 || dependencies.contract !== "literary-planet-content-dependencies-v1"
    || dependencies.sourceCommit !== candidate.sourceCommit || dependencies.releaseReady !== false
    || typeof dependencies.currentCandidateHash !== "string" || !/^[a-f0-9]{64}$/u.test(dependencies.currentCandidateHash)
    || !Array.isArray(dependencies.staleUnitIds) || dependencies.staleUnitIds.length > candidate.units.length
    || dependencies.staleUnitIds.some(id => typeof id !== "string" || !id || id.length > 1000)
    || new Set(dependencies.staleUnitIds).size !== dependencies.staleUnitIds.length) fail("Invalid previous source-bound dependency index");
  return { candidate, dependencies, manifestSha256, version: rebuilt.version };
}
