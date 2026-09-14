import path from "node:path";
import { fileURLToPath } from "node:url";
import { readdir, readFile, realpath, lstat } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { load } from "cheerio";
import sharp from "sharp";
import ts from "typescript";
import { build as bundle } from "esbuild";
import { PWA_BOOTSTRAP_ENTRIES, CANONICAL_BOOK_SOURCE_REGISTRY, bootstrapSourcePath, bootstrapManifestKeys, normalizePwaAuthority, pwaAuthoritySha256, loadPwaAuthority } from "./pwa-artifact.mjs";
import { normalizePwaWorkerConfig } from "../../src/pwa/serviceWorkerRuntime.js";
import { PWA_BOOTSTRAP_MAX_FILES, PWA_BOOTSTRAP_MAX_FILE_BYTES, PWA_BOOTSTRAP_MAX_TOTAL_BYTES } from "../../src/pwa/pwaBootstrapBudgets.ts";
import { PWA_PORTRAIT_SELECTION_PATH, PWA_PORTRAIT_PREFIX, PWA_BOOK_COVER_PREFIX, selectPwaPortraitAssets, selectPwaBookCoverAssets } from "./pwa-portrait-selection.mjs";
import { bookDossierStaticIssues } from "../audit-book-dossier-delivery.mjs";

const SCOPE = "/planet/";
const ORIGIN = "https://probpera.ru";
const SHA = /^[a-f0-9]{64}$/u;
// These exact attribution files accompany canonical shipped flags/fonts. Other
// Markdown, including a similarly named file in the same directory, is private.
const RUNTIME_ATTRIBUTIONS = new Set([
  "assets/country-flags/ATTRIBUTION.md",
  "fonts/editorial/LICENSE.source-sans-3.md",
  "fonts/editorial/LICENSE.source-serif-4.md",
]);
const json = value => JSON.stringify(value, null, 2) + "\n";
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const fields = (value, keys) => object(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const within = (root, filename) => { const relative = path.relative(root, filename); return !!relative && relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative); };
const sameJson = (a, b) => {
  if (Array.isArray(a) || Array.isArray(b)) return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, index) => sameJson(value, b[index]));
  if (object(a) || object(b)) return object(a) && object(b) && Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(key => Object.hasOwn(b, key) && sameJson(a[key], b[key]));
  return a === b;
};
function safeRelative(value) {
  if (typeof value !== "string" || !value || value.length > 1024 || /[\\%?#:\u0000-\u0020\u007f]/u.test(value) || value.startsWith("/") || value.split("/").some(part => !part || part === "." || part === ".." || part.endsWith("."))) throw new Error("Unsafe relative path");
  return value;
}
function urlFile(value) {
  if (typeof value !== "string" || !value.startsWith(SCOPE)) throw new Error("Resource outside /planet/");
  const url = new URL(value, ORIGIN);
  if (url.origin !== ORIGIN || url.search || url.hash || url.pathname !== value) throw new Error("Resource is not an exact scoped path");
  let relative = value.slice(SCOPE.length);
  if (["", "ru/", "en/"].includes(relative)) relative += "index.html";
  return safeRelative(relative);
}
function propertyName(node) { return ts.isIdentifier(node) || ts.isStringLiteral(node) ? node.text : null; }
function literalValue(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.ExclamationToken && ts.isNumericLiteral(node.operand)) return !Number(node.operand.text);
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(literalValue);
  if (ts.isObjectLiteralExpression(node)) {
    const result = Object.create(null);
    for (const property of node.properties) {
      if (!ts.isPropertyAssignment(property)) throw new Error("Nonliteral configuration");
      const name = propertyName(property.name);
      if (name === null || name === "__proto__" || Object.hasOwn(result, name)) throw new Error("Ambiguous configuration property");
      result[name] = literalValue(property.initializer);
    }
    return result;
  }
  throw new Error("Nonliteral configuration");
}
function loopbackGuard(node, target) {
  if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression) || node.expression.name.text !== "includes" || !ts.isArrayLiteralExpression(node.expression.expression) || node.arguments.length !== 1) return false;
  let values;
  try { values = literalValue(node.expression.expression); } catch { return false; }
  const access = node.arguments[0];
  return sameJson([...values].sort(), ["127.0.0.1", "[::1]", "localhost"].sort()) && ts.isPropertyAccessExpression(access) && access.name.text === "hostname" && ts.isPropertyAccessExpression(access.expression) && access.expression.name.text === "location" && ts.isIdentifier(access.expression.expression) && access.expression.expression.text === target;
}

function assertUnambiguousStaticJson(source) {
  // JSON.parse has already validated grammar. Scan strings/brackets once to
  // retain duplicate keys that its last-value semantics would otherwise hide.
  const frames = [];
  let tokens = 0;
  for (const match of source.matchAll(/"(?:[^"\\]|\\[\s\S])*"|[{}\[\]]/gu)) {
    if (++tokens > 1_000_000) throw new Error("Static JSON token budget exceeded");
    const token = match[0];
    if (token === "{" || token === "[") {
      frames.push(token === "{" ? new Set() : null);
      if (frames.length > 256) throw new Error("Static JSON nesting budget exceeded");
    } else if (token === "}" || token === "]") frames.pop();
    else {
      let next = match.index + token.length;
      while (/[\t\r\n ]/u.test(source[next] ?? "x")) next++;
      const keys = frames[frames.length - 1];
      if (keys && source[next] === ":") {
        const key = JSON.parse(token);
        if (keys.has(key)) throw new Error("Duplicate static JSON key");
        keys.add(key);
      }
    }
  }
}

/** Read-only preparation audit. Success does not approve editorial content or a release. */
export async function verifyPwaArtifact({ rootDir = process.cwd(), artifactDir = "dist-pwa", allowQa = false } = {}) {
  const findings = [];
  const add = (code, filename, message) => findings.push({ code, path: filename, message });
  const counts = { files: 0, bytes: 0, bootstrapFiles: 0, bootstrapBytes: 0, sourceInputs: 0, publicSources: 0, scripts: 0 };
  let identity = null;
  let root, directory;
  const contents = new Map();
  const actual = new Map();
  const report = () => ({ pass: findings.length === 0, identity, counts, findings, releaseReady: false, limitations: ["Preparation integrity and current source-input freshness only; not an RC, editorial/rights approval, entitlement authority or deployment approval.", "Static module/HTML/worker configuration checks do not prove browser behavior or arbitrary executable equivalence; real browser and native gates remain required."] });
  async function regular(base, relative, maxBytes = 64 * 1024 * 1024) {
    safeRelative(relative);
    const filename = path.join(base, relative);
    const stat = await lstat(filename);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > maxBytes || await realpath(filename) !== filename || !within(base, filename)) throw new Error("Missing, linked, oversized or non-regular file");
    return readFile(filename);
  }
  async function parseFile(relative) {
    try {
      const bytes = contents.get(relative) ?? await regular(directory, relative, 8 * 1024 * 1024);
      return JSON.parse(bytes.toString("utf8"));
    } catch { add("INVALID_JSON", relative, "Expected a bounded regular JSON artifact file."); return null; }
  }
  try {
    root = await realpath(rootDir);
    safeRelative(artifactDir);
    directory = path.resolve(root, artifactDir);
    if (!within(root, directory) || (await lstat(directory)).isSymbolicLink() || await realpath(directory) !== directory) throw new Error("Artifact directory leaves the checkout or is linked");
    const walk = async (current, prefix = "", depth = 0) => {
      if (depth > 12) throw new Error("Artifact directory nesting exceeds budget");
      for (const entry of await readdir(current, { withFileTypes: true })) {
        const relative = safeRelative(prefix + entry.name);
        if (entry.isSymbolicLink()) { add("LINKED_OUTPUT", relative, "Linked outputs are forbidden."); continue; }
        if (entry.isDirectory()) { await walk(path.join(current, entry.name), relative + "/", depth + 1); continue; }
        if (!entry.isFile()) { add("NON_REGULAR_OUTPUT", relative, "Only regular output files are permitted."); continue; }
        if (++counts.files > 4096) throw new Error("Artifact file count exceeds budget");
        const bytes = await regular(directory, relative);
        counts.bytes += bytes.length;
        if (counts.bytes > 512 * 1024 * 1024) throw new Error("Artifact size exceeds budget");
        actual.set(relative, { bytes: bytes.length, sha256: digest(bytes) });
        if (/\.(?:json|webmanifest|html|js|css|txt)$/u.test(relative) || relative === "_headers") contents.set(relative, bytes);
        const permittedHidden = relative === ".vite/manifest.json";
        if ((!permittedHidden && relative.split("/").some(part => part.startsWith("."))) || /(?:^|\/)(?:src|scripts|node_modules|apps|docs|requirements|tests?|private)(?:\/|$)/iu.test(relative)
          || /(?:^|\/)(?:MANIFEST\.json|SHA256SUMS\.txt|AUTOPILOT[^/]*|NEXT_CODEX_PROMPT[^/]*|\d{2,3}[A-Z]?_[^/]+\.(?:md|txt|csv|json))$/u.test(relative)
          || (/\.(?:tsx?|jsx|map|env|pem|key|p12|pfx|zip|7z|rar|sqlite|db|md|docx?)$/iu.test(relative) && !RUNTIME_ATTRIBUTIONS.has(relative))) add("PRIVATE_OUTPUT", relative, "Private source, configuration, archive or requirement material is not a runtime asset.");
        const text = bytes.toString("utf8");
        if (/-----BEGIN (?:EC |RSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/u.test(text)) add("PRIVATE_KEY", relative, "Private key material is forbidden in every artifact.");
        // Canonical live-only dossier banks must not enter the controlled static
        // package under an innocent asset name, even with consistent hashes.
        const jsonFormat = /\.(?:json|webmanifest)$/iu.test(relative);
        // Public assets have no universal extension allowlist. Inspect valid
        // plain JSON objects/arrays even when named .txt/.dat; this does not
        // decode compressed/binary payloads or arbitrary JavaScript expressions.
        if (jsonFormat || /^[\uFEFF\t\r\n ]*[\[{]/u.test(text)) {
          let source, value, parsed = false;
          try {
            source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
            value = JSON.parse(source);
            parsed = true;
          } catch {
            if (jsonFormat) add("INVALID_JSON", relative, "Static JSON must be valid UTF-8 JSON.");
          }
          if (parsed) try {
            assertUnambiguousStaticJson(source);
            for (const issue of bookDossierStaticIssues(value, relative)) {
              add("PRIVATE_DOSSIER_OUTPUT", relative, issue);
            }
          } catch { add("INVALID_JSON", relative, "Static JSON must have unambiguous keys and bounded inspectable structure."); }
        }
      }
    };
    await walk(directory);
  } catch (error) { add("OUTPUT_UNREADABLE", artifactDir, error.message); return report(); }
  const artifact = await parseFile("artifact.json");
  if (!object(artifact)) return report();
  identity = { buildId: artifact.buildId ?? null, sourceCommit: artifact.sourceCommit ?? null, localQaAuthority: artifact.localQaAuthority ?? null };
  if (artifact.schemaVersion !== 1 || artifact.kind !== "literary-planet-controlled-pwa-preparation" || artifact.releaseReady !== false || artifact.productionActionsAuthorized !== false) add("PREPARATION_IDENTITY", "artifact.json", "Artifact must explicitly remain a preparation with no release/production approval.");
  if (artifact.profile !== "SAFE_PAID_BILINGUAL_V1" || artifact.commercialModel !== "PAID_UPFRONT_WITH_OPTIONAL_NON_CONSUMABLES" || artifact.scopePath !== SCOPE || !sameJson(artifact.requiredLocales, ["ru", "en"]) || !SHA.test(artifact.buildId) || !/^[a-f0-9]{40}$/u.test(artifact.sourceCommit)) add("PRODUCT_IDENTITY", "artifact.json", "Profile, commercial model, source commit and equal RU/EN identity must be exact.");
  try {
    if (!/^[a-f0-9]{40}$/u.test(artifact.sourceCommit)) throw new Error("Invalid checkpoint");
    const options = { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] };
    const gitPrefix = ["-c", "safe.directory=" + root];
    if (execFileSync("git", [...gitPrefix, "cat-file", "-t", artifact.sourceCommit], options).trim() !== "commit") throw new Error("Checkpoint is not a commit");
    execFileSync("git", [...gitPrefix, "merge-base", "--is-ancestor", artifact.sourceCommit, "HEAD"], options);
  } catch { add("SOURCE_COMMIT", "artifact.json", "Source checkpoint must be an existing commit in current HEAD ancestry; later evidence-only commits are permitted."); }
  if (typeof artifact.localQaAuthority !== "boolean" || (artifact.localQaAuthority && !allowQa)) add("QA_NOT_ALLOWED", "artifact.json", "QA artifacts require explicit --allow-qa and a boolean QA identity.");
  const authority = await parseFile("license-authority.json");
  try {
    normalizePwaAuthority(authority);
    if (artifact.authoritySha256 !== pwaAuthoritySha256(authority) || (artifact.localQaAuthority && authority === null)) throw new Error("Authority identity mismatch");
  } catch { add("AUTHORITY_IDENTITY", "license-authority.json", "Artifact must bind one exact public authority or default null; QA requires an authority."); }
  try {
    if (authority === null) {
      if (artifact.authoritySource !== null) throw new Error("Default authority must have no source");
    } else {
      const source = artifact.authoritySource;
      if (!fields(source, ["path", "sha256"]) || !SHA.test(source.sha256) || typeof source.path !== "string" || !source.path.endsWith(".json") || (artifact.localQaAuthority && !source.path.startsWith(".tmp/pwa-qa/"))) throw new Error("Invalid public authority source");
      const verified = await loadPwaAuthority(root, [artifact.localQaAuthority ? "--qa-authority" : "--authority", safeRelative(source.path)]);
      if (verified.authoritySource.sha256 !== source.sha256 || !sameJson(verified.authority, normalizePwaAuthority(authority))) throw new Error("Changed public authority source");
    }
  } catch { add("AUTHORITY_SOURCE", "artifact.json", "The exact contained public authority source must remain current and match the emitted public configuration."); }
  const inventory = new Map();
  if (!Array.isArray(artifact.inventory) || artifact.inventory.length > 4096) add("INVALID_INVENTORY", "artifact.json", "A bounded file inventory is required.");
  else for (const entry of artifact.inventory) {
    try {
      if (!fields(entry, ["path", "bytes", "sha256"]) || !Number.isSafeInteger(entry.bytes) || entry.bytes < 0 || !SHA.test(entry.sha256)) throw new Error("Invalid record");
      const filename = safeRelative(entry.path);
      if (filename === "artifact.json" || inventory.has(filename)) throw new Error("Duplicate/self inventory");
      inventory.set(filename, entry);
      if (!actual.has(filename)) add("MISSING_FILE", filename, "Inventoried file is absent.");
      else if (actual.get(filename).bytes !== entry.bytes || actual.get(filename).sha256 !== entry.sha256) add("INVENTORY_INTEGRITY", filename, "Actual bytes do not match inventory size/SHA256.");
    } catch { add("INVALID_INVENTORY", entry?.path ?? "artifact.json", "Invalid, duplicate or unsafe inventory record."); }
  }
  for (const filename of actual.keys()) if (filename !== "artifact.json" && !inventory.has(filename)) add("UNINVENTORIED_FILE", filename, "Every emitted file except artifact.json must be inventoried.");
  const inputMap = new Map();
  const inputs = artifact.sourceInputs;
  if (!fields(inputs, ["sha256", "files"]) || !SHA.test(inputs?.sha256) || !Array.isArray(inputs?.files) || inputs.files.length < 1 || inputs.files.length > 10000) add("SOURCE_INPUTS", "artifact.json", "The current source-input snapshot is required.");
  else {
    let previous = "";
    for (const entry of inputs.files) {
      try {
        if (!fields(entry, ["path", "sha256"]) || !SHA.test(entry.sha256)) throw new Error("Invalid input");
        const filename = safeRelative(entry.path);
        if (filename <= previous) throw new Error("Unsorted/duplicate input");
        previous = filename; inputMap.set(filename, entry.sha256); counts.sourceInputs++;
        if (digest(await regular(root, filename)) !== entry.sha256) add("STALE_SOURCE", filename, "Source bytes differ from the artifact's recorded input snapshot.");
      } catch { add("SOURCE_INPUTS", entry?.path ?? "artifact.json", "Invalid, missing or linked source input."); }
    }
    if (digest(json(inputs.files)) !== inputs.sha256) add("SOURCE_INPUT_DIGEST", "artifact.json", "Source-input aggregate digest does not match the ordered records.");
    try {
      const names = execFileSync("git", ["-c", "safe.directory=" + root, "ls-files", "-z", "--cached", "--others", "--exclude-standard", "--", "src", "index.html", "vite.config.ts", "vite.pwa.config.ts", "tsconfig.json", "package.json", "package-lock.json", "scripts/mobile/build-pwa.mjs", "scripts/mobile/pwa-artifact.mjs", "scripts/mobile/pwa-shell.mjs", "scripts/mobile/pwa-portrait-selection.mjs", PWA_PORTRAIT_SELECTION_PATH, CANONICAL_BOOK_SOURCE_REGISTRY], { cwd: root, encoding: "utf8", maxBuffer: 4 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] }).split("\0");
      const expected = [...new Set([...names, CANONICAL_BOOK_SOURCE_REGISTRY])].filter(name => name && !/\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(name)).sort();
      if (!sameJson(expected, [...inputMap.keys()])) add("SOURCE_INPUT_SET", "artifact.json", "Snapshot does not cover the current tracked/untracked build-input set.");
    } catch { add("SOURCE_INPUT_SET", "artifact.json", "Cannot independently enumerate current Git source inputs."); }
  }
  if (!SHA.test(artifact.workerSourceSha256) || inputMap.get("src/pwa/serviceWorkerRuntime.js") !== artifact.workerSourceSha256) add("WORKER_SOURCE", "artifact.json", "Worker source must be identified by the same source snapshot.");

  const config = await parseFile("bootstrap-integrity.json");
  const bootstrap = new Map();
  const shellPaths = { root: "/planet/", ru: "/planet/ru/", en: "/planet/en/" };
  if (!fields(config, ["schemaVersion", "scopePath", "buildId", "entrypoints", "files", ...(Object.hasOwn(config ?? {}, "rollbackReference") ? ["rollbackReference"] : [])]) || config.schemaVersion !== 1 || config.scopePath !== SCOPE || config.buildId !== artifact.buildId || !sameJson(config.entrypoints, shellPaths) || !Array.isArray(config.files)) add("BOOTSTRAP_IDENTITY", "bootstrap-integrity.json", "Worker bootstrap and artifact must identify the same exact bilingual shell.");
  try { normalizePwaWorkerConfig(config); } catch { add("BOOTSTRAP_IDENTITY", "bootstrap-integrity.json", "Worker configuration does not satisfy the executable protocol schema."); }
  if (!Object.hasOwn(artifact, "rollbackReference") || !sameJson(artifact.rollbackReference, config?.rollbackReference ?? null)) add("ROLLBACK_IDENTITY", "artifact.json", "Artifact and worker must bind the same explicit rollback reference or null.");
  if (config?.rollbackReference) {
    const prior = await parseFile("rollback-manifest.json");
    try {
      if (!fields(prior, ["schemaVersion", "authoritySha256", "localQaAuthority", "manifest", "reference"]) || prior.schemaVersion !== 1 || prior.authoritySha256 !== artifact.authoritySha256 || prior.localQaAuthority !== artifact.localQaAuthority || !sameJson(prior.reference, config.rollbackReference)) throw new Error("Rollback authority/mode/reference mismatch");
      const normalized = normalizePwaWorkerConfig(prior.manifest);
      if (normalized.buildId !== config.rollbackReference.buildId || digest(JSON.stringify(normalized)) !== config.rollbackReference.manifestSha256 || !sameJson(normalized.files.flatMap(file => [file.url, ...file.aliases]).sort(), config.rollbackReference.routes)) throw new Error("Rollback manifest mismatch");
    } catch { add("ROLLBACK_IDENTITY", "rollback-manifest.json", "Rollback must identify a complete exact same-authority prior manifest and route set."); }
  } else if (actual.has("rollback-manifest.json")) add("ROLLBACK_IDENTITY", "rollback-manifest.json", "Unanchored rollback metadata is forbidden.");
  if (Array.isArray(config?.files)) {
    const urls = new Set();
    for (const file of config.files) {
      try {
        if (!object(file) || !Object.keys(file).every(key => ["url", "bytes", "sha256", "kind", "aliases"].includes(key)) || !Number.isSafeInteger(file.bytes) || file.bytes < 1 || file.bytes > PWA_BOOTSTRAP_MAX_FILE_BYTES || !SHA.test(file.sha256) || !["shell", "asset"].includes(file.kind)) throw new Error("Invalid bootstrap record");
        const filename = urlFile(file.url);
        if (urls.has(file.url) || /\/(?:api|auth|license|licenses|entitlements|private|admin|cms|child|children|parent|purchase|billing|payments)(?:\/|$)/iu.test(file.url) || filename.startsWith("__pwa_")) throw new Error("Unsafe/duplicate bootstrap URL");
        if ((file.kind === "shell") !== Object.values(shellPaths).includes(file.url)) throw new Error("Unexpected shell ownership");
        urls.add(file.url); bootstrap.set(filename, file); counts.bootstrapFiles++; counts.bootstrapBytes += file.bytes;
        if (!inventory.has(filename) || !actual.has(filename) || actual.get(filename).bytes !== file.bytes || actual.get(filename).sha256 !== file.sha256) add("BOOTSTRAP_INTEGRITY", filename, "Essential file is missing or does not match its immutable bytes/hash.");
        const aliases = file.aliases ?? [];
        if (!Array.isArray(aliases) || aliases.length > 4 || (file.kind === "shell" && aliases.length)) throw new Error("Invalid aliases");
        for (const alias of aliases) {
          if (typeof alias !== "string" || !alias.startsWith(file.url + "?v=") || !/^[A-Za-z0-9._-]{1,96}$/u.test(alias.slice(file.url.length + 3)) || urls.has(alias)) throw new Error("Invalid alias");
          urls.add(alias);
        }
      } catch { add("BOOTSTRAP_RECORD", file?.url ?? "bootstrap-integrity.json", "Invalid, private, duplicate or out-of-scope essential file/alias."); }
    }
    if (counts.bootstrapFiles > PWA_BOOTSTRAP_MAX_FILES || counts.bootstrapBytes > PWA_BOOTSTRAP_MAX_TOTAL_BYTES || artifact.bootstrap?.files !== counts.bootstrapFiles || artifact.bootstrap?.bytes !== counts.bootstrapBytes) add("BOOTSTRAP_BUDGET", "artifact.json", "Bootstrap bounds/counts must equal actual verified entries.");
    const expectedBuildId = digest(json({ sourceCommit: artifact.sourceCommit, sourceInputsSha256: inputs?.sha256, workerSourceSha256: artifact.workerSourceSha256, authoritySha256: artifact.authoritySha256, localQaAuthority: artifact.localQaAuthority, authoritySource: artifact.authoritySource, rollbackReference: artifact.rollbackReference, files: config.files }));
    if (expectedBuildId !== artifact.buildId) add("BUILD_ID", "artifact.json", "Build ID does not bind the source snapshot, worker source and essential files.");
  }
  function checkResource(url, owner, essential = false) {
    try {
      const filename = urlFile(url);
      if (!actual.has(filename) || !inventory.has(filename)) add("MISSING_RESOURCE", owner, "Referenced local resource is missing: " + filename);
      if (essential && !bootstrap.has(filename)) add("MISSING_CORE_RESOURCE", owner, "Boot resource is absent from the verified offline package: " + filename);
      return filename;
    } catch { add("UNSAFE_RESOURCE", owner, "Resource must use an exact local scoped pathname."); return null; }
  }
  const vite = await parseFile(".vite/manifest.json");
  const ownership = await parseFile("module-ownership.json");
  const bootstrapEntries = [...PWA_BOOTSTRAP_ENTRIES, ...(artifact.localQaAuthority ? ["src/pwa/qaSceneProbe.ts"] : [])];
  let ownedKeys = [];
  try {
    if (!object(vite)) throw new Error("Missing Vite manifest");
    ownedKeys = bootstrapManifestKeys(vite, bootstrapEntries, ownership);
    if (ownership.sourceInputsSha256 !== inputs?.sha256 || !bootstrap.has("module-ownership.json")) throw new Error("Ownership must bind current source inputs and belong to verified bootstrap");
    const sources = new Map((inputs?.files ?? []).map(file => [file.path, file.sha256]));
    for (const entry of ownership.entries) {
      if (sources.get(bootstrapSourcePath(entry.source)) !== entry.sourceSha256) throw new Error("Ownership source checksum differs from captured source");
      for (const file of entry.files) if (actual.get(file.file)?.sha256 !== file.sha256) throw new Error("Owned Rollup output checksum differs from artifact bytes");
    }
  } catch (error) { add("MODULE_OWNERSHIP", "module-ownership.json", error.message); }
  const emittedModules = new Set();
  if (object(vite)) {
    const visited = new Set();
    const visit = key => {
      if (visited.has(key)) return;
      visited.add(key);
      const entry = Object.hasOwn(vite, key) ? vite[key] : null;
      if (!object(entry) || typeof entry.file !== "string") { add("MISSING_CORE_MODULE", ".vite/manifest.json", "Missing essential module: " + key); return; }
      for (const filename of [entry.file, ...(Array.isArray(entry.css) ? entry.css : []), ...(Array.isArray(entry.assets) ? entry.assets : [])]) {
        try {
          safeRelative(filename);
          if (!actual.has(filename) || !bootstrap.has(filename)) add("MISSING_CORE_MODULE", filename, "Essential module closure is absent from inventory/bootstrap.");
        } catch { add("MISSING_CORE_MODULE", ".vite/manifest.json", "Invalid core module output path."); }
      }
      if (entry.imports !== undefined && !Array.isArray(entry.imports)) add("MISSING_CORE_MODULE", key, "Invalid static import graph.");
      else for (const dependency of entry.imports ?? []) visit(dependency);
    };
    for (const entry of ownedKeys) visit(entry);
    for (const [key, entry] of Object.entries(vite)) {
      if (!object(entry)) { add("VITE_MANIFEST", key, "Invalid emitted module metadata."); continue; }
      const lists = Object.create(null);
      for (const name of ["css", "assets", "imports", "dynamicImports"]) {
        if (entry[name] !== undefined && (!Array.isArray(entry[name]) || entry[name].some(value => typeof value !== "string"))) add("VITE_MANIFEST", key, "Module " + name + " metadata must be an array of strings.");
        lists[name] = Array.isArray(entry[name]) ? entry[name] : [];
      }
      for (const filename of [entry.file, ...lists.css, ...lists.assets]) {
        try { emittedModules.add(safeRelative(filename)); if (!actual.has(filename)) add("MISSING_MODULE_OUTPUT", key, "Emitted module references a missing file."); }
        catch { add("VITE_MANIFEST", key, "Invalid emitted module output path."); }
      }
      for (const dependency of [...lists.imports, ...lists.dynamicImports]) if (typeof dependency !== "string" || !Object.hasOwn(vite, dependency)) add("MISSING_MODULE_REFERENCE", key, "Static/dynamic module metadata references a missing entry.");
    }
  }
  const provenance = await parseFile("asset-provenance.json");
  const publicOutputs = new Set();
  const publicSourceHashes = new Map();
  if (!fields(provenance, ["schemaVersion", "sourceCommit", "files"]) || provenance.schemaVersion !== 1 || provenance.sourceCommit !== artifact.sourceCommit || !Array.isArray(provenance.files) || provenance.files.length > 4096) add("ASSET_PROVENANCE", "asset-provenance.json", "Exact source checkpoint and bounded public-asset provenance are required.");
  else for (const record of provenance.files) {
    try {
      const resized = /^resize-contain-(192|512)-png$/u.exec(record?.transformation);
      if (!fields(record, resized ? ["output", "source", "sourceSha256", "transformation", "purpose"] : ["output", "source", "sourceSha256", "transformation"]) || !SHA.test(record.sourceSha256)) throw new Error("Invalid provenance record");
      const output = safeRelative(record.output), source = safeRelative(record.source);
      if (!source.startsWith("public/") || publicOutputs.has(output) || !actual.has(output)) throw new Error("Missing, duplicate or unsafe public output");
      publicOutputs.add(output);
      const input = await regular(root, source);
      counts.publicSources++;
      publicSourceHashes.set(source, digest(input));
      if (publicSourceHashes.get(source) !== record.sourceSha256) add("STALE_PUBLIC_SOURCE", source, "Canonical public source differs from the artifact's recorded asset input.");
      if (record.transformation === "none") {
        if (source !== "public/" + output || actual.get(output).sha256 !== record.sourceSha256) throw new Error("Untransformed public output differs from canonical input");
      } else if (resized && record.purpose === "any" && source === "public/brand/probpera-logo.png" && output === `icons/icon-${resized[1]}.png`) {
        const size = Number(resized[1]);
        const expected = await sharp(input).resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
        if (actual.get(output).sha256 !== digest(expected)) throw new Error("Icon does not derive from the current canonical logo");
      } else throw new Error("Unsupported public transformation");
    } catch { add("ASSET_PROVENANCE", record?.output ?? "asset-provenance.json", "Public asset requires contained current source and exact copy/approved icon transformation."); }
  }
  const pinnedAssetScopes = [
    { prefix: PWA_PORTRAIT_PREFIX, label: "portrait", code: "PORTRAIT", select: selectPwaPortraitAssets },
    { prefix: PWA_BOOK_COVER_PREFIX, label: "book cover", code: "COVER", select: selectPwaBookCoverAssets },
  ];
  try {
    const selectionBytes = await regular(root, PWA_PORTRAIT_SELECTION_PATH);
    if (inputMap.get(PWA_PORTRAIT_SELECTION_PATH) !== digest(selectionBytes)) throw new Error("Canonical asset selection must match the recorded source-input snapshot");
    const selection = JSON.parse(selectionBytes);
    const records = new Map((Array.isArray(provenance?.files) ? provenance.files : []).map(record => [record?.output, record]));
    for (const scope of pinnedAssetScopes) try {
      const pins = scope.select(selection), selected = new Set(pins.map(pin => pin.output));
      for (const pin of pins) {
        const record = records.get(pin.output);
        if (!actual.has(pin.output) || !bootstrap.has(pin.output) || !publicOutputs.has(pin.output) || !record) {
          add(scope.code + "_COVERAGE", pin.output, "Every selected canonical " + scope.label + " must belong to the actual, traced offline bootstrap.");
        } else if (!sameJson(record, pin) || actual.get(pin.output).sha256 !== pin.sourceSha256
          || bootstrap.get(pin.output).sha256 !== pin.sourceSha256 || publicSourceHashes.get(pin.source) !== pin.sourceSha256) {
          add(scope.code + "_PIN", pin.output, "Canonical " + scope.label + " source, output, provenance and offline bytes must match the native selection pin.");
        }
      }
      for (const filename of actual.keys()) if (filename.toLowerCase().startsWith(scope.prefix) && !selected.has(filename)) {
        add(scope.code + "_SELECTION", filename, "A packaged " + scope.label + " is absent from the canonical native selection.");
      }
    } catch (error) { add(scope.code + "_SELECTION", PWA_PORTRAIT_SELECTION_PATH, error.message); }
  } catch (error) {
    for (const scope of pinnedAssetScopes) add(scope.code + "_SELECTION", PWA_PORTRAIT_SELECTION_PATH, error.message);
  }
  const generatedOutputs = new Set(["artifact.json", "bootstrap-integrity.json", "module-ownership.json", "asset-provenance.json", "license-authority.json", "rollback-manifest.json", "sw.js", "_headers", ".vite/manifest.json", "pwa-shell.css"]);
  for (const prefix of ["", "ru/", "en/"]) for (const name of ["index.html", "404.html", "manifest.webmanifest"]) generatedOutputs.add(prefix + name);
  for (const filename of actual.keys()) if (!generatedOutputs.has(filename) && !emittedModules.has(filename) && !publicOutputs.has(filename)) add("ASSET_PROVENANCE_COVERAGE", filename, "Output is neither a built module, generated shell material nor a traced canonical public asset.");
  for (const locale of [null, "ru", "en"]) {
    const prefix = locale ? locale + "/" : "";
    const manifestPath = prefix + "manifest.webmanifest";
    const manifest = await parseFile(manifestPath);
    if (!object(manifest) || manifest.id !== SCOPE || manifest.scope !== SCOPE || manifest.start_url !== SCOPE + prefix || manifest.display !== "standalone" || manifest.dir !== "ltr" || (locale ? manifest.lang !== locale : Object.hasOwn(manifest, "lang")) || typeof manifest.name !== "string" || !manifest.name.trim() || !Array.isArray(manifest.icons) || manifest.icons.length !== 2) add("MANIFEST_IDENTITY", manifestPath, "Installed identity/start URL/locale/icons must preserve the canonical bilingual app.");
    for (const size of [192, 512]) {
      const matches = Array.isArray(manifest?.icons) ? manifest.icons.filter(icon => icon?.sizes === `${size}x${size}`) : [];
      if (matches.length !== 1 || matches[0].type !== "image/png" || matches[0].purpose !== "any" || matches[0].src !== `${SCOPE}icons/icon-${size}.png`) { add("MANIFEST_ICON", manifestPath, "Exactly one canonical PNG icon at each required size is required."); continue; }
      const filename = checkResource(matches[0].src, manifestPath, true);
      if (filename) try {
        const metadata = await sharp(await regular(directory, filename, 8 * 1024 * 1024)).metadata();
        if (metadata.format !== "png" || metadata.width !== size || metadata.height !== size || (metadata.pages ?? 1) !== 1) throw new Error("Wrong icon metadata");
      } catch { add("ICON_BYTES", filename, "Icon bytes must be an actual single-page PNG of the declared dimensions."); }
    }
    for (const notFound of [false, true]) {
      const filename = prefix + (notFound ? "404.html" : "index.html");
      if (!contents.has(filename)) { add("MISSING_SHELL", filename, "Every explicit locale and neutral recovery shell is required."); continue; }
      const $ = load(contents.get(filename).toString("utf8"));
      const suffix = notFound ? "404.html" : "";
      if ($("html").attr("lang") !== (locale ?? "") || (locale ? $("html").attr("data-route-language") !== locale : $("html").attr("data-pwa-neutral-entry") === undefined || $("html").attr("data-route-language") !== undefined) || $("#root").length !== 1 || $("base").length || !/^noindex(?:,|$)/u.test($('meta[name="robots"]').attr("content") ?? "")) add("SHELL_IDENTITY", filename, "Shell language, root ownership and unpublished indexing policy are invalid.");
      const canonical = $('link[rel="canonical"]');
      if (canonical.length !== 1 || canonical.attr("href") !== ORIGIN + SCOPE + prefix + suffix) add("SHELL_CANONICAL", filename, "Canonical URL must identify this exact shell.");
      for (const language of ["ru", "en", "x-default"]) {
        const links = $(`link[rel="alternate"][hreflang="${language}"]`);
        const expected = ORIGIN + SCOPE + (language === "x-default" ? "" : language + "/") + suffix;
        if (links.length !== 1 || links.attr("href") !== expected) add("SHELL_HREFLANG", filename, "Each shell needs synchronized exact RU/EN/x-default links.");
      }
      if ($('link[rel="manifest"]').length !== 1 || $('link[rel="manifest"]').attr("href") !== SCOPE + manifestPath) add("SHELL_MANIFEST", filename, "Shell links to the wrong locale manifest.");
      if (notFound ? $("script").length !== 0 : $('script[type="module"][src]').length !== 1) add("SHELL_SCRIPT", filename, "Recovery shells cannot execute JS; app shells need one local module entry.");
      if (!notFound && (typeof vite?.["index.html"]?.file !== "string" || !vite["index.html"].file.endsWith(".js") || $('script[type="module"][src]').attr("src") !== SCOPE + vite["index.html"].file)) add("SHELL_ENTRY_MODULE", filename, "App shell must execute the actual JavaScript entry emitted for index.html.");
      $("script").each((_, node) => { const element = $(node); if (element.attr("type") !== "module" || !element.attr("src") || element.text().trim()) add("SHELL_SCRIPT", filename, "Only external built module scripts are permitted."); });
      $("*").each((_, node) => { for (const name of Object.keys(node.attribs ?? {})) if (/^on/iu.test(name)) add("SHELL_SCRIPT", filename, "Inline event handlers are forbidden."); });
      $("script[src],img[src],link[rel=stylesheet],link[rel=modulepreload],link[rel=preload],link[rel=manifest],link[rel=icon],link[rel=apple-touch-icon]").each((_, node) => {
        const element = $(node); checkResource(element.attr("src") ?? element.attr("href"), filename, true);
      });
    }
  }
  const workerConfigs = [];
  let probeCount = 0;
  for (const [filename, bytes] of contents) {
    const source = bytes.toString("utf8");
    if (!artifact.localQaAuthority && (/qaSceneProbe/iu.test(filename) || source.includes("__literaryPlanetQaScenes") || (filename === ".vite/manifest.json" && /["']src\/pwa\/qaSceneProbe\.ts["']/u.test(source)))) add("QA_CODE_IN_DEFAULT", filename, "Default artifacts cannot contain QA probe files, symbols or module manifest entries.");
    if (filename.endsWith(".css")) {
      for (const match of source.matchAll(/url\(\s*(?:(["'])(.*?)\1|([^)]*?))\s*\)/gsu)) {
        const value = (match[2] ?? match[3]).trim();
        if (/^data:/iu.test(value) || value.startsWith("#")) continue;
        checkResource(value, filename, bootstrap.has(filename));
      }
    }
    if (!filename.endsWith(".js") && !filename.endsWith(".json") && !filename.endsWith(".webmanifest")) continue;
    if (!filename.endsWith(".js")) {
      let value; try { value = JSON.parse(source); } catch { continue; }
      const scan = node => { if (!object(node) && !Array.isArray(node)) return; if (object(node) && ["EC", "RSA", "oct", "OKP"].includes(node.kty) && ["d", "p", "q", "dp", "dq", "qi", "oth", "k"].some(key => Object.hasOwn(node, key))) add("PRIVATE_JWK", filename, "Private/symmetric JWK material is forbidden."); for (const child of Object.values(node)) scan(child); };
      scan(value); continue;
    }
    counts.scripts++;
    const tree = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    if (tree.parseDiagnostics.length) add("INVALID_SCRIPT", filename, "Built executable contains a syntax error.");
    const scan = node => {
      let specifier, moduleReference = false, essential = false;
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) { specifier = node.moduleSpecifier; moduleReference = true; essential = bootstrap.has(filename); }
      else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) { specifier = node.arguments[0]; moduleReference = true; }
      if (moduleReference) {
        try {
          if (!specifier || !(ts.isStringLiteral(specifier) || ts.isNoSubstitutionTemplateLiteral(specifier))) throw new Error("Nonliteral module import");
          const value = specifier.text;
          if ((!value.startsWith("./") && !value.startsWith("../") && !value.startsWith(SCOPE)) || /[\\%?#\u0000-\u0020\u007f]/u.test(value)) throw new Error("Unsafe module specifier");
          const url = new URL(value, ORIGIN + SCOPE + filename);
          const dependency = urlFile(url.pathname);
          if (url.origin !== ORIGIN || !dependency.endsWith(".js")) throw new Error("Non-JavaScript module or remote import");
          if (!actual.has(dependency) || !inventory.has(dependency)) add("MISSING_SCRIPT_DEPENDENCY", filename, "Actual executable imports an absent module: " + dependency);
          else if (essential && !bootstrap.has(dependency)) add("MISSING_CORE_SCRIPT_DEPENDENCY", filename, "Actual static module dependency is absent from the offline bootstrap: " + dependency);
        } catch { add("UNSAFE_SCRIPT_DEPENDENCY", filename, "Actual static/dynamic module imports must resolve to literal local JavaScript files."); }
      }
      if (ts.isObjectLiteralExpression(node)) {
        const values = new Map(node.properties.filter(ts.isPropertyAssignment).map(property => [propertyName(property.name), property.initializer]));
        if (["EC", "RSA", "oct", "OKP"].includes(values.get("kty")?.text) && ["d", "p", "q", "dp", "dq", "qi", "oth", "k"].some(key => values.has(key))) add("PRIVATE_JWK", filename, "Private/symmetric JWK material is forbidden.");
        if (filename === "sw.js" && values.has("schemaVersion") && values.has("entrypoints") && ts.isStringLiteral(values.get("buildId") ?? tree) && values.has("files")) {
          try { workerConfigs.push(literalValue(node)); } catch { add("WORKER_CONFIGURATION", filename, "Worker configuration must remain one exact immutable literal."); }
        }
      }
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.expression.getText(tree) === "Object" && node.expression.name.text === "defineProperty" && node.arguments[1]?.text === "__literaryPlanetQaScenes") {
        probeCount++;
        const target = node.arguments[0]; const parent = node.parent;
        if (!artifact.localQaAuthority || !ts.isIdentifier(target) || !ts.isBinaryExpression(parent) || parent.operatorToken.kind !== ts.SyntaxKind.AmpersandAmpersandToken || parent.right !== node || !loopbackGuard(parent.left, target.text)) add("QA_LOOPBACK_GUARD", filename, "Diagnostic global must be guarded by the exact loopback hostname predicate.");
      }
      ts.forEachChild(node, scan);
    };
    scan(tree);
  }
  if (!actual.has("sw.js") || workerConfigs.length !== 1 || !sameJson(workerConfigs[0], config)) add("WORKER_CONFIGURATION", "sw.js", "Bundled worker must embed exactly the audited bootstrap configuration.");
  try {
    if (!object(config) || !actual.has("sw.js")) throw new Error("Missing worker/configuration");
    // Build only this small worker in memory. Comparing executable bytes also
    // catches a matching but unused config object, omitted installation, and
    // extra injected behavior. No app build, execution, or output write occurs.
    const expected = await bundle({
      stdin: { contents: "import { installPwaWorker } from './src/pwa/serviceWorkerRuntime.js';\ninstallPwaWorker(self, " + JSON.stringify(config) + ");", resolveDir: root, sourcefile: "controlled-pwa-worker.js" },
      absWorkingDir: root, bundle: true, write: false, format: "iife", platform: "browser", target: "es2020", minify: true, logLevel: "silent",
    });
    if (expected.outputFiles.length !== 1 || digest(expected.outputFiles[0].contents) !== actual.get("sw.js").sha256) throw new Error("Worker executable differs");
  } catch { add("WORKER_EXECUTABLE", "sw.js", "Worker must exactly match the current source installed with the audited configuration."); }
  if (artifact.localQaAuthority && probeCount !== 1) add("QA_LOOPBACK_GUARD", "artifact.json", "QA artifact must contain one guarded diagnostic probe.");
  return report();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    let artifactDir = "dist-pwa", allowQa = false;
    const args = process.argv.slice(2);
    for (let index = 0; index < args.length; index++) {
      if (args[index] === "--allow-qa") allowQa = true;
      else if (args[index] === "--dir" && args[index + 1]) artifactDir = args[++index];
      else throw new Error("Usage: verify-pwa-artifact.mjs [--dir checkout-relative-output] [--allow-qa]");
    }
    const result = await verifyPwaArtifact({ artifactDir, allowQa });
    console.log(JSON.stringify(result, null, 2)); process.exitCode = result.pass ? 0 : 1;
  } catch (error) { console.log(JSON.stringify({ pass: false, error: error.message })); process.exitCode = 2; }
}
