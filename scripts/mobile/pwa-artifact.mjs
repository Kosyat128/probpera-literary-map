import path from "node:path";
import { lstat, readFile, realpath } from "node:fs/promises";
import { createHash, webcrypto } from "node:crypto";
import { normalizePwaWorkerConfig } from "../../src/pwa/serviceWorkerRuntime.js";

/** Canonical public-only authority identity. Sorted object keys; array order is
 * retained. No private/symmetric JWK fields may enter the build fingerprint. */
export function normalizePwaAuthority(input) {
  if (input === null) return null;
  const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
  if (!object(input) || Object.keys(input).sort().join(",") !== "audience,issuer,product,trustedKeys" || !["issuer", "audience", "product"].every(key => typeof input[key] === "string" && /^[A-Za-z0-9:._/-]{1,128}$/u.test(input[key])) || !Array.isArray(input.trustedKeys) || input.trustedKeys.length !== 1) throw new Error("Invalid public authority");
  const key = input.trustedKeys[0];
  if (!object(key) || Object.keys(key).sort().join(",") !== "jwk,kid" || !/^[A-Za-z0-9_-]{1,64}$/u.test(key.kid) || !object(key.jwk) || Object.keys(key.jwk).some(field => !["kty", "crv", "x", "y", "ext", "key_ops", "alg", "use"].includes(field)) || key.jwk.kty !== "EC" || key.jwk.crv !== "P-256" || !/^[A-Za-z0-9_-]{43}$/u.test(key.jwk.x) || !/^[A-Za-z0-9_-]{43}$/u.test(key.jwk.y)) throw new Error("Only public P-256 authority keys are permitted");
  if (typeof key.kid !== "string" || (key.jwk.ext !== undefined && typeof key.jwk.ext !== "boolean") || (key.jwk.alg !== undefined && key.jwk.alg !== "ES256") || (key.jwk.use !== undefined && key.jwk.use !== "sig") || (key.jwk.key_ops !== undefined && (!Array.isArray(key.jwk.key_ops) || key.jwk.key_ops.length !== 1 || key.jwk.key_ops[0] !== "verify"))) throw new Error("Invalid public key verification metadata");
  const canonical = value => Array.isArray(value) ? value.map(canonical) : object(value) ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
  return canonical(input);
}
export const pwaAuthoritySha256 = input => createHash("sha256").update(JSON.stringify(normalizePwaAuthority(input))).digest("hex");

/** Explicit public configuration; neither option starts a signer or a deploy. */
export async function loadPwaAuthority(root, args) {
  if (!Array.isArray(args)) throw new Error("Invalid authority options");
  if (args.length === 0) return { authority: null, localQaAuthority: false, authoritySource: null };
  if (args.length !== 2 || !["--authority", "--qa-authority"].includes(args[0])) throw new Error("Use exactly one of --authority <checkout-relative-json> or --qa-authority <.tmp/pwa-qa/json>");
  const relative = artifactPath(args[1]);
  const localQaAuthority = args[0] === "--qa-authority";
  if (!relative.endsWith(".json") || (localQaAuthority && !relative.startsWith(".tmp/pwa-qa/"))) throw new Error("Authority requires a contained JSON file; QA configuration must remain in .tmp/pwa-qa");
  if (await realpath(path.resolve(root, relative)) !== path.resolve(root, relative)) throw new Error("Authority source must not use symlinks or junctions");
  const source = await containedFile(root, relative);
  if (source.size > 16_384) throw new Error("Public authority exceeds size limit");
  const authority = normalizePwaAuthority(JSON.parse(source.bytes.toString("utf8")));
  if (authority === null) throw new Error("An explicit authority must contain a public verification key");
  await webcrypto.subtle.importKey("jwk", authority.trustedKeys[0].jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  return { authority, localQaAuthority, authoritySource: { path: relative, sha256: source.sha256 } };
}

/** Previous artifacts are local preparation outputs, not an arbitrary runtime
 * manifest service. Missing/legacy/incompatible output is not a rollback target. */
export async function previousPwaGeneration(directory, authoritySha256, localQaAuthority = false) {
  if (await realpath(directory) !== path.resolve(directory) || (await lstat(directory)).isSymbolicLink()) throw new Error("Previous artifact must be a real local directory");
  const metadata = JSON.parse((await containedFile(directory, "artifact.json")).bytes);
  if (typeof localQaAuthority !== "boolean" || metadata.schemaVersion !== 1 || metadata.kind !== "literary-planet-controlled-pwa-preparation" || metadata.releaseReady !== false || metadata.productionActionsAuthorized !== false || metadata.authoritySha256 !== authoritySha256 || metadata.localQaAuthority !== localQaAuthority || !/^[a-f0-9]{64}$/u.test(metadata.sourceInputs?.sha256)) return null;
  const authority = JSON.parse((await containedFile(directory, "license-authority.json")).bytes);
  if (pwaAuthoritySha256(authority) !== authoritySha256 || (localQaAuthority && authority === null)) return null;
  const manifest = normalizePwaWorkerConfig(JSON.parse((await containedFile(directory, "bootstrap-integrity.json")).bytes));
  if (manifest.buildId !== metadata.buildId) throw new Error("Previous artifact build identity mismatch");
  if (!Array.isArray(metadata.inventory) || metadata.inventory.length > 4096) throw new Error("Invalid previous inventory");
  const inventory = new Map(metadata.inventory.map(record => [record.path, record]));
  for (const file of manifest.files) {
    let relative = file.url.slice(PWA_SCOPE.length);
    if (file.kind === "shell") relative += "index.html";
    const actual = await containedFile(directory, relative), record = inventory.get(relative);
    if (actual.size !== file.bytes || actual.sha256 !== file.sha256 || record?.bytes !== actual.size || record?.sha256 !== actual.sha256) throw new Error("Previous core integrity mismatch");
  }
  const manifestSha256 = createHash("sha256").update(JSON.stringify(manifest)).digest("hex");
  return { schemaVersion: 1, authoritySha256, localQaAuthority, manifest, reference: { buildId: manifest.buildId, manifestSha256, routes: manifest.files.flatMap(file => [file.url, ...file.aliases]).sort() } };
}

export const PWA_SCOPE = "/planet/";
export const PWA_BOOTSTRAP_ENTRIES = Object.freeze([
  "index.html",
  "src/planet/catalog.ts",
  "src/planet/books.ts",
  "src/data/articles/catalog.ts",
  "src/components/LiteraryGlobe.tsx",
  "src/components/WriterPanel.tsx",
  "src/components/GlobalSearch.tsx",
  "src/components/CmsHomepageContent.tsx",
  "src/components/SectionsDirectory.tsx",
  "src/components/LiteraryCalendar.tsx",
  "src/components/NobelArchiveStrip.tsx",
  "src/components/ArticleLibrarySection.tsx",
  "src/components/BookArchiveSection.tsx",
  "src/components/BookShelfSceneCanvas.tsx?stage5Load=primary",
  "src/components/BookShelfSceneCanvas.tsx?stage5Load=retry",
]);

/** Queries identify distinct compiled modules, never aliases of another source. */
export function bootstrapSourcePath(source) {
  if (typeof source !== "string") throw new Error("Invalid bootstrap source");
  const [filename, query, ...extra] = source.split("?");
  if (extra.length || (query !== undefined && (filename !== "src/components/BookShelfSceneCanvas.tsx" || !/^stage5Load=(?:primary|retry)$/u.test(query)))) throw new Error("Unexpected bootstrap source query");
  return artifactPath(filename);
}

/** Capture exact finalized Rollup ownership before module metadata is discarded
 * by Vite's public manifest. No chunk-name or substring inference. */
export function capturePwaModuleOwnership(root, bundle, sourceInputs, entries = PWA_BOOTSTRAP_ENTRIES) {
  const sources = new Map(sourceInputs.files.map(file => [file.path, file.sha256]));
  const chunks = Object.values(bundle).filter(chunk => chunk?.type === "chunk");
  return { schemaVersion: 1, sourceInputsSha256: sourceInputs.sha256, entries: [...entries].sort().map(source => {
    const filename = bootstrapSourcePath(source), suffix = source.slice(filename.length);
    const moduleId = path.resolve(root, filename).replaceAll("\\", "/") + suffix;
    const sourceSha256 = sources.get(filename);
    if (!/^[a-f0-9]{64}$/u.test(sourceSha256)) throw new Error("Missing captured source input: " + source);
    const files = chunks.filter(chunk => Object.keys(chunk.modules ?? {}).some(id => id.replaceAll("\\", "/") === moduleId) || chunk.facadeModuleId?.replaceAll("\\", "/") === moduleId)
      .map(chunk => ({ file: artifactPath(chunk.fileName), sha256: createHash("sha256").update(chunk.code).digest("hex") })).sort((a, b) => a.file < b.file ? -1 : a.file > b.file ? 1 : 0);
    if (!files.length) throw new Error("Missing exact Rollup module ownership: " + source);
    return { source, sourceSha256, files };
  }) };
}

/** Vite's internal import-analysis generateBundle runs after user post plugins
 * and rewrites preload tables. writeBundle sees those final bytes, after Rollup
 * writes them. The builder still independently compares every hash with disk. */
export function createPwaModuleOwnershipPlugin(root, sourceInputs, entries, receive) {
  return {
    name: "literary-planet-exact-bootstrap-ownership",
    enforce: "post",
    writeBundle: {
      order: "post",
      sequential: true,
      handler(_options, output) { receive(capturePwaModuleOwnership(root, output, sourceInputs, entries)); },
    },
  };
}

/** Resolve only hash-bound exact source→output evidence to public manifest keys. */
export function bootstrapManifestKeys(manifest, entries, ownership) {
  if (!ownership || ownership.schemaVersion !== 1 || !/^[a-f0-9]{64}$/u.test(ownership.sourceInputsSha256) || Object.keys(ownership).sort().join(",") !== "entries,schemaVersion,sourceInputsSha256" || !Array.isArray(ownership.entries) || ownership.entries.length !== entries.length) throw new Error("Invalid bootstrap ownership");
  const wanted = [...entries].sort(), keys = new Set();
  for (const [index, record] of ownership.entries.entries()) {
    if (!record || Object.keys(record).sort().join(",") !== "files,source,sourceSha256" || record.source !== wanted[index] || !/^[a-f0-9]{64}$/u.test(record.sourceSha256) || !Array.isArray(record.files) || !record.files.length || record.files.length > 512) throw new Error("Invalid exact source ownership");
    bootstrapSourcePath(record.source);
    let previous = "";
    for (const file of record.files) {
      if (!file || Object.keys(file).sort().join(",") !== "file,sha256" || !/^[a-f0-9]{64}$/u.test(file.sha256) || artifactPath(file.file) <= previous || !file.file.endsWith(".js")) throw new Error("Invalid owned module file");
      previous = file.file;
      const matches = Object.entries(manifest).filter(([, entry]) => entry?.file === file.file).map(([key]) => key);
      if (!matches.length) throw new Error("Owned Rollup output missing from Vite manifest: " + record.source);
      for (const key of matches) keys.add(key);
    }
    const direct = manifest[record.source];
    if (direct && !record.files.some(file => file.file === direct.file)) throw new Error("Vite source disagrees with exact Rollup ownership: " + record.source);
  }
  return [...keys].sort();
}

export function artifactPath(value) {
  if (typeof value !== "string" || !value || /[\\%?#:\u0000-\u0020]/u.test(value)
    || value.startsWith("/") || value.split("/").some(part => !part || part === "." || part === "..")) {
    throw new Error("Invalid controlled artifact path");
  }
  return value;
}

/** Follow actual static dependencies, including shared book/article metadata. */
export function bootstrapClosure(manifest, entries = PWA_BOOTSTRAP_ENTRIES, ownership) {
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) throw new Error("Invalid Vite manifest");
  const visited = new Set(), files = new Set();
  const visit = key => {
    if (typeof key !== "string" || !Object.hasOwn(manifest, key)) throw new Error(`Missing bootstrap module: ${key}`);
    if (visited.has(key)) return;
    visited.add(key);
    const record = manifest[key];
    if (!record || typeof record !== "object" || Array.isArray(record)) throw new Error(`Invalid module: ${key}`);
    files.add(artifactPath(record.file));
    for (const field of ["css", "assets", "imports"]) {
      if (record[field] !== undefined && (!Array.isArray(record[field]) || record[field].some(item => typeof item !== "string"))) {
        throw new Error(`Invalid ${field} for ${key}`);
      }
    }
    for (const asset of [...(record.css ?? []), ...(record.assets ?? [])]) files.add(artifactPath(asset));
    for (const dependency of record.imports ?? []) visit(dependency);
    // Optional dynamic chunks are included only when explicitly listed as an
    // essential entry. A filename substring is never an exclusion criterion.
  };
  if (!Array.isArray(entries) || !entries.length) throw new Error("Bootstrap entry list is empty");
  (ownership ? bootstrapManifestKeys(manifest, entries, ownership) : entries).forEach(visit);
  return [...files].sort();
}

/** Scope the canonical project's literal public CSS URLs before Vite hashing. */
export function scopeCanonicalCssUrls(source) {
  const assets = new Set();
  const css = source.replace(/url\(\s*(?:(["'])(.*?)\1|([^)]*?))\s*\)/gsu, (whole, quote, quoted, plain) => {
    const url = (quoted ?? plain).trim();
    if (/^data:/iu.test(url) || url.startsWith("#")) return whole;
    if (url.includes("\\")) throw new Error("Escaped CSS URL requires explicit canonical asset handling");
    if (/^(?:https?:)?\/\//iu.test(url)) throw new Error("Remote CSS resource in controlled PWA");
    if (!url.startsWith("/")) return whole;
    const relative = artifactPath(url.startsWith(PWA_SCOPE) ? url.slice(PWA_SCOPE.length) : url.slice(1));
    if (url.startsWith(PWA_SCOPE + "assets/")) {
      assets.add(relative);
      return whole;
    }
    if (!/^(?:brand|fonts|flags|textures)\//u.test(relative)) throw new Error(`Unsupported public CSS asset: ${relative}`);
    assets.add(relative);
    if (url.startsWith(PWA_SCOPE)) return whole;
    const delimiter = quote || '"';
    return `url(${delimiter}${PWA_SCOPE}${relative}${delimiter})`;
  });
  return { css, assets: [...assets].sort() };
}

/** Reject junction/symlink escapes before reading files into an artifact. */
export async function containedFile(directory, relative) {
  artifactPath(relative);
  const root = await realpath(directory), filename = path.resolve(root, relative);
  const resolved = await realpath(filename);
  const remainder = path.relative(root, resolved);
  if (remainder === ".." || remainder.startsWith(`..${path.sep}`) || path.isAbsolute(remainder)) throw new Error("Artifact input escapes its source root");
  const stat = await lstat(filename);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("Artifact input is not a regular file");
  const bytes = await readFile(filename);
  return { bytes, size: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
}
