import path from "node:path";
import { fileURLToPath } from "node:url";
import { readdir, readFile, realpath, lstat } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { load } from "cheerio";
import ts from "typescript";
import { bookDossierStaticIssues } from "../audit-book-dossier-delivery.mjs";

const SHA = /^[a-f0-9]{64}$/u;
const json = value => JSON.stringify(value, null, 2) + "\n";
const sha = value => createHash("sha256").update(value).digest("hex");
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const fields = (value, names) => object(value) && Object.keys(value).length === names.length && names.every(name => Object.hasOwn(value, name));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const channels = { android: ["dev", "googlePlay", "ruStore"], ios: ["dev", "appStore"] };
const packages = Object.freeze({
  "@capacitor/core": "8.5.1", "@capacitor/cli": "8.5.1", "@capacitor/android": "8.5.1", "@capacitor/ios": "8.5.1",
  "@capacitor/app": "8.1.1", "@capacitor/network": "8.0.1", "@capacitor/preferences": "8.0.1", "@capacitor/browser": "8.0.4", "@capacitor/app-launcher": "8.0.1",
});
const sourceRoots = ["src", "native.html", "vite.native.config.ts", "vite.config.ts", "tsconfig.json", "package.json", "package-lock.json", "capacitor.config.json", "scripts/mobile/build-native.mjs", "scripts/mobile/native-base-assets.json", "scripts/mobile/pwa-artifact.mjs"];
const attributionFiles = new Set(["assets/country-flags/ATTRIBUTION.md", "fonts/editorial/LICENSE.source-sans-3.md", "fonts/editorial/LICENSE.source-serif-4.md"]);
const within = (root, file) => { const relative = path.relative(root, file); return relative && relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative); };
function relativePath(value) {
  if (typeof value !== "string" || !value || value.length > 1024 || /[\\%?#:\u0000-\u0020\u007f]/u.test(value) || value.startsWith("/") || value.split("/").some(part => !part || part === "." || part === ".." || part.endsWith("."))) throw new Error("Unsafe relative path");
  return value;
}
function unambiguousJson(source) {
  const value = JSON.parse(source), frames = [];
  let count = 0;
  for (const match of source.matchAll(/"(?:[^"\\]|\\[\s\S])*"|[{}\[\]]/gu)) {
    if (++count > 1_000_000) throw new Error("JSON token budget");
    const token = match[0];
    if (token === "{" || token === "[") { frames.push(token === "{" ? new Set() : null); if (frames.length > 256) throw new Error("JSON depth budget"); }
    else if (token === "}" || token === "]") frames.pop();
    else {
      let next = match.index + token.length;
      while (/[\t\r\n ]/u.test(source[next] ?? "x")) next++;
      const keys = frames[frames.length - 1];
      if (keys && source[next] === ":") { const key = JSON.parse(token); if (keys.has(key) || key === "__proto__") throw new Error("Ambiguous JSON key"); keys.add(key); }
    }
  }
  return value;
}
function privateJwk(value) {
  if (!object(value) && !Array.isArray(value)) return false;
  if (object(value) && ["EC", "RSA", "oct", "OKP"].includes(value.kty) && ["d", "p", "q", "dp", "dq", "qi", "oth", "k"].some(key => Object.hasOwn(value, key))) return true;
  return Object.values(value).some(privateJwk);
}
const propertyName = node => ts.isIdentifier(node) || ts.isStringLiteral(node) ? node.text : null;

/** Read-only bundled preparation verification. This does not attest a signed
 * native binary, native runtime behavior, rights, paid access or store readiness. */
export async function verifyNativeArtifact({ rootDir = process.cwd(), artifactDir = "dist-native", checkSourceFreshness = true } = {}) {
  const findings = [], actual = new Map(), contents = new Map();
  const counts = { files: 0, bytes: 0, scripts: 0, sourceInputs: 0, publicSources: 0, ownedChunks: 0 };
  const add = (code, file, message) => findings.push({ code, path: typeof file === "string" ? file : "artifact.json", message });
  let identity = null, root, directory, provenance = "unattested";
  const report = () => ({ pass: findings.length === 0, identity, counts, findings, releaseReady: false, sourceFreshnessChecked: checkSourceFreshness === true, sourceBinaryProvenance: provenance, limitations: [
    "Preparation integrity only; not a native APK/AAB/IPA, device test, editorial/rights approval, paid-access authority or release approval.",
    "Module ownership is self-reported build metadata checked against source and emitted bytes; it is not independent source-to-binary reproducibility or arbitrary executable-equivalence proof.",
    "Literal executable/resource paths are checked statically; constructed runtime URLs and native OS behavior require separate runtime gates.",
  ] });
  async function regular(base, relative, maximum = 64 * 1024 * 1024) {
    const filename = path.resolve(base, relativePath(relative)), stat = await lstat(filename);
    if (!within(base, filename) || !stat.isFile() || stat.isSymbolicLink() || stat.size > maximum || await realpath(filename) !== filename) throw new Error("Missing, linked, oversized or non-regular file");
    return readFile(filename);
  }
  async function readJson(base, relative) { return unambiguousJson(new TextDecoder("utf-8", { fatal: true }).decode(await regular(base, relative, 16 * 1024 * 1024))); }
  try {
    if (typeof checkSourceFreshness !== "boolean") throw new Error("Source freshness option must be boolean");
    root = await realpath(rootDir); directory = path.resolve(root, relativePath(artifactDir));
    if (!within(root, directory) || !(await lstat(directory)).isDirectory() || (await lstat(directory)).isSymbolicLink() || await realpath(directory) !== directory) throw new Error("Artifact must be a real contained directory");
    const walk = async (folder, prefix = "", depth = 0) => {
      if (depth > 12) throw new Error("Output nesting budget exceeded");
      for (const entry of await readdir(folder, { withFileTypes: true })) {
        const filename = relativePath(prefix + entry.name);
        if (entry.isSymbolicLink()) { add("LINKED_OUTPUT", filename, "Linked outputs are forbidden."); continue; }
        if (entry.isDirectory()) { await walk(path.join(folder, entry.name), filename + "/", depth + 1); continue; }
        if (!entry.isFile()) { add("NON_REGULAR_OUTPUT", filename, "Only regular output files are permitted."); continue; }
        if (++counts.files > 4096) throw new Error("Output file count budget exceeded");
        const bytes = await regular(directory, filename); counts.bytes += bytes.length;
        if (counts.bytes > 512 * 1024 * 1024) throw new Error("Output size budget exceeded");
        actual.set(filename, { bytes: bytes.length, sha256: sha(bytes) });
        if (/\.(?:json|webmanifest|html|js|css)$/iu.test(filename)) contents.set(filename, bytes);
        if ((filename !== ".vite/manifest.json" && filename.split("/").some(part => part.startsWith("."))) || /(?:^|\/)(?:src|scripts|node_modules|apps|docs|requirements|tests?|private)(?:\/|$)/iu.test(filename)
          || /(?:^|\/)(?:MANIFEST\.json|SHA256SUMS\.txt|AUTOPILOT[^/]*|NEXT_CODEX_PROMPT[^/]*|\d{2,3}[A-Z]?_[^/]+\.(?:md|txt|csv|json))$/u.test(filename)
          || (/\.(?:tsx?|jsx|map|env|pem|key|p12|pfx|zip|7z|rar|sqlite|db|md|docx?)$/iu.test(filename) && !attributionFiles.has(filename))) add("PRIVATE_OUTPUT", filename, "Private source, configuration, archives and requirements cannot be shipped.");
        if (/(?:^|\/)(?:sw\.js|service-worker\.[cm]?js|license-authority\.json|bootstrap-integrity\.json|manifest\.webmanifest)$/iu.test(filename)) add("WRONG_RUNTIME_OUTPUT", filename, "Web/PWA service workers, authority and installed manifests are not native runtime assets.");
        const text = bytes.toString("utf8");
        if (/-----BEGIN (?:EC |RSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/u.test(text)) add("PRIVATE_KEY", filename, "Private key material is forbidden.");
        if (/qaSceneProbe/iu.test(filename) || text.includes("__literaryPlanetQaScenes")) add("QA_PROBE", filename, "Native preparations cannot embed the browser QA probe.");
        const explicitJson = /\.(?:json|webmanifest)$/iu.test(filename);
        if (explicitJson || /^[\uFEFF\t\r\n ]*[\[{]/u.test(text)) {
          let value;
          try { value = unambiguousJson(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
          catch { if (explicitJson || (() => { try { JSON.parse(text); return true; } catch { return false; } })()) add("INVALID_JSON", filename, "JSON must be valid UTF-8 with unique keys and bounded structure."); continue; }
          for (const issue of bookDossierStaticIssues(value, filename)) add("PRIVATE_DOSSIER_OUTPUT", filename, issue);
          if (privateJwk(value)) add("PRIVATE_JWK", filename, "Private or symmetric JWK material is forbidden.");
        }
      }
    };
    await walk(directory);
  } catch (error) { add("OUTPUT_UNREADABLE", artifactDir, error.message); return report(); }
  let artifact;
  try { artifact = await readJson(directory, "artifact.json"); if (!object(artifact)) throw new Error(); }
  catch { add("ARTIFACT_JSON", "artifact.json", "Valid preparation metadata is required."); return report(); }
  identity = { buildId: artifact.buildId ?? null, sourceCommit: artifact.sourceCommit ?? null, platform: artifact.platform ?? null, channel: artifact.channel ?? null };
  if (artifact.schemaVersion !== 1 || artifact.kind !== "literary-planet-bundled-native-preparation" || artifact.releaseReady !== false || artifact.productionActionsAuthorized !== false) add("PREPARATION_IDENTITY", "artifact.json", "Native output must explicitly remain an unreleased preparation.");
  if (!Object.hasOwn(channels, artifact.platform) || !channels[artifact.platform]?.includes(artifact.channel) || !same(artifact.requiredLocales, ["ru", "en"]) || !SHA.test(artifact.buildId) || !/^[a-f0-9]{40}$/u.test(artifact.sourceCommit)) add("PRODUCT_IDENTITY", "artifact.json", "Exact platform/channel, equal RU/EN and build/checkpoint identities are required.");
  const git = args => execFileSync("git", ["-c", "safe.directory=" + root, ...args], { cwd: root, encoding: "utf8", maxBuffer: 4 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
  try { if (!/^[a-f0-9]{40}$/u.test(artifact.sourceCommit) || git(["cat-file", "-t", artifact.sourceCommit]).trim() !== "commit") throw new Error(); git(["merge-base", "--is-ancestor", artifact.sourceCommit, "HEAD"]); }
  catch { add("SOURCE_COMMIT", "artifact.json", "Source checkpoint must exist in current HEAD ancestry."); }
  const inventory = new Map();
  if (!Array.isArray(artifact.inventory) || artifact.inventory.length < 1 || artifact.inventory.length > 4096) add("INVALID_INVENTORY", "artifact.json", "Bounded nonempty file inventory required.");
  else for (const record of artifact.inventory) try {
    if (!fields(record, ["path", "bytes", "sha256"]) || !Number.isSafeInteger(record.bytes) || record.bytes < 0 || !SHA.test(record.sha256)) throw new Error();
    const filename = relativePath(record.path);
    if (filename === "artifact.json" || inventory.has(filename)) throw new Error();
    inventory.set(filename, record);
    if (!actual.has(filename)) add("MISSING_FILE", filename, "Inventoried file is absent.");
    else if (actual.get(filename).bytes !== record.bytes || actual.get(filename).sha256 !== record.sha256) add("INVENTORY_INTEGRITY", filename, "Actual bytes or SHA256 differ from inventory.");
  } catch { add("INVALID_INVENTORY", record?.path, "Unsafe, duplicate, self-referential or invalid inventory record."); }
  for (const filename of actual.keys()) if (filename !== "artifact.json" && !inventory.has(filename)) add("UNINVENTORIED_FILE", filename, "All output files must be inventoried.");
  const inputs = artifact.sourceInputs, inputMap = new Map();
  if (!fields(inputs, ["sha256", "files"]) || !SHA.test(inputs?.sha256) || !Array.isArray(inputs?.files) || inputs.files.length < 1 || inputs.files.length > 10000) add("SOURCE_INPUTS", "artifact.json", "An exact ordered source snapshot is required.");
  else {
    let previous = "";
    for (const record of inputs.files) try {
      if (!fields(record, ["path", "sha256"]) || !SHA.test(record.sha256)) throw new Error();
      const filename = relativePath(record.path); if (filename <= previous) throw new Error(); previous = filename;
      inputMap.set(filename, record.sha256); counts.sourceInputs++;
      if (checkSourceFreshness && sha(await regular(root, filename)) !== record.sha256) add("STALE_SOURCE", filename, "Current source differs from the recorded snapshot.");
    } catch { add("SOURCE_INPUTS", record?.path, "Invalid, missing, duplicate or linked source input."); }
    if (sha(json(inputs.files)) !== inputs.sha256) add("SOURCE_INPUT_DIGEST", "artifact.json", "Ordered source snapshot aggregate differs.");
    if (checkSourceFreshness) try {
      const expected = [...new Set(git(["ls-files", "-z", "--cached", "--others", "--exclude-standard", "--", ...sourceRoots]).split("\0"))].filter(name => name && !/\.(?:test|spec)\.[cm]?[jt]sx?$/u.test(name)).sort();
      if (!same(expected, [...inputMap.keys()])) add("SOURCE_INPUT_SET", "artifact.json", "Snapshot omits or invents a current build input.");
    } catch { add("SOURCE_INPUT_SET", "artifact.json", "Could not independently enumerate source inputs."); }
  }
  for (const required of sourceRoots.filter(name => name !== "src")) if (!inputMap.has(required)) add("SOURCE_INPUT_SET", required, "Required native build/configuration input is missing.");
  if (sha(json({ sourceCommit: artifact.sourceCommit, sourceInputsSha256: inputs?.sha256, platform: artifact.platform, channel: artifact.channel, inventory: artifact.inventory })) !== artifact.buildId) add("BUILD_ID", "artifact.json", "Build identity does not bind the exact source, platform/channel and inventory.");
  try {
    const config = await readJson(root, "capacitor.config.json");
    if (!object(config) || Object.keys(config).some(key => !["appId", "appName", "webDir", "loggingBehavior", "android", "ios", "server"].includes(key)) || config.appId !== "ru.probpera.literaryplanet" || config.webDir !== "dist-native") throw new Error();
    if (!object(config.server) || Object.keys(config.server).some(key => !["hostname", "androidScheme", "iosScheme"].includes(key)) || config.server.hostname !== "localhost" || config.server.androidScheme !== "https" || config.server.iosScheme !== "capacitor") throw new Error();
    if (!fields(config.android, ["path", "allowMixedContent"]) || config.android.path !== "apps/mobile/android" || config.android.allowMixedContent !== false || !fields(config.ios, ["path"]) || config.ios.path !== "apps/mobile/ios") throw new Error();
  } catch { add("NATIVE_CONFIG", "capacitor.config.json", "Exact bundled local runtime is required; remote URL/navigation, updater plugins and mixed content are forbidden."); }
  try {
    if (!object(artifact.nativePackages) || !same(Object.keys(artifact.nativePackages).sort(), Object.keys(packages).sort())) throw new Error();
    const pkg = await readJson(root, "package.json"), lock = await readJson(root, "package-lock.json");
    for (const [name, version] of Object.entries(packages)) {
      if (artifact.nativePackages[name] !== version || (name === "@capacitor/cli" ? pkg.devDependencies : pkg.dependencies)?.[name] !== version || lock.packages?.["node_modules/" + name]?.version !== version || !/^sha512-[A-Za-z0-9+/]+={0,2}$/u.test(lock.packages?.["node_modules/" + name]?.integrity ?? "")) throw new Error();
    }
  } catch { add("NATIVE_PACKAGES", "artifact.json", "All nine exact native versions must agree with dependencies and locked integrity metadata."); }
  const publicOutputs = new Set();
  if (!Array.isArray(artifact.assetProvenance) || artifact.assetProvenance.length > 4096) add("ASSET_PROVENANCE", "artifact.json", "Bounded canonical public-asset provenance required.");
  else for (const record of artifact.assetProvenance) try {
    if (!fields(record, ["output", "source", "sourceSha256"]) || !SHA.test(record.sourceSha256)) throw new Error();
    const output = relativePath(record.output), source = relativePath(record.source);
    if (publicOutputs.has(output) || source !== "public/" + output || !actual.has(output)) throw new Error();
    publicOutputs.add(output); counts.publicSources++;
    if (sha(await regular(root, source)) !== record.sourceSha256 || actual.get(output).sha256 !== record.sourceSha256) throw new Error();
  } catch { add("ASSET_PROVENANCE", record?.output, "Every public asset must be an unchanged copy of the exact current contained source."); }
  const resource = (value, owner, javascript = false) => {
    try {
      if (typeof value !== "string" || !value || /[\\%\u0000-\u0020\u007f]/u.test(value) || value.startsWith("//")) throw new Error();
      const url = new URL(value, "https://native.invalid/" + owner);
      if (url.origin !== "https://native.invalid" || url.username || url.password || url.hash || (javascript && url.search)) throw new Error();
      const filename = relativePath(url.pathname.slice(1));
      if (javascript && !filename.endsWith(".js")) throw new Error();
      if (!actual.has(filename) || !inventory.has(filename)) { add("MISSING_RESOURCE", owner, "Referenced local resource is absent: " + filename); return null; }
      return filename;
    } catch { add("UNSAFE_RESOURCE", owner, "Executable/resource URL must identify a contained bundled file."); return null; }
  };
  let vite;
  const emitted = new Set();
  try {
    vite = await readJson(directory, ".vite/manifest.json"); if (!object(vite) || !object(vite["native.html"]) || vite["native.html"].isEntry !== true) throw new Error();
    for (const [key, entry] of Object.entries(vite)) {
      if (!object(entry) || typeof entry.file !== "string") throw new Error();
      for (const filename of [entry.file, ...(entry.css ?? []), ...(entry.assets ?? [])]) { relativePath(filename); emitted.add(filename); if (!actual.has(filename)) add("MISSING_MODULE", key, "Vite output dependency is absent: " + filename); }
      for (const linked of [...(entry.imports ?? []), ...(entry.dynamicImports ?? [])]) if (!object(vite[linked])) add("MISSING_MODULE", key, "Vite dependency key is absent: " + linked);
    }
  } catch { add("VITE_MANIFEST", ".vite/manifest.json", "Native entry and complete Vite output graph are required."); }
  try {
    const $ = load((await regular(directory, "index.html")).toString("utf8")), script = $('script[type="module"][src]');
    if ($("#root").length !== 1 || !["ru", "en"].includes($("html").attr("lang")) || $("base").length || !/^noindex(?:,|$)/u.test($('meta[name="robots"]').attr("content") ?? "")) add("SHELL_IDENTITY", "index.html", "The unpublished canonical host shell requires one root and a supported initial language.");
    if (script.length !== 1 || script.attr("src") !== "/" + vite?.["native.html"]?.file || !vite?.["native.html"]?.file?.endsWith(".js")) add("SHELL_ENTRY", "index.html", "Shell must execute exactly the JavaScript emitted for native.html.");
    $("script").each((_, node) => { const element = $(node); if (element.attr("type") !== "module" || !element.attr("src") || element.text().trim()) add("SHELL_EXECUTABLE", "index.html", "Only the local module entry may execute."); });
    $("*").each((_, node) => { if (Object.keys(node.attribs ?? {}).some(name => /^on/iu.test(name))) add("SHELL_EXECUTABLE", "index.html", "Inline event handlers are forbidden."); });
    $("script[src],img[src],link[rel=stylesheet],link[rel=modulepreload],link[rel=preload],link[rel=icon]").each((_, node) => { const element = $(node); resource(element.attr("src") ?? element.attr("href"), "index.html", node.name === "script" || element.attr("rel") === "modulepreload"); });
    if ($("iframe,object,embed,link[rel=manifest]").length) add("SHELL_REMOTE_RUNTIME", "index.html", "Remote frames, embedded runtimes and PWA manifests are forbidden.");
    const csp = $('meta[http-equiv="Content-Security-Policy"]');
    const directives = new Map();
    for (const part of (csp.attr("content") ?? "").split(";")) { const [name, ...values] = part.trim().split(/\s+/u); if (!name) continue; if (directives.has(name)) throw new Error(); directives.set(name, values); }
    if (csp.length !== 1 || [...directives.keys()].some(key => !["default-src", "script-src", "connect-src", "img-src", "font-src", "style-src", "object-src", "base-uri", "frame-src", "form-action"].includes(key))
      || !["default-src", "script-src", "connect-src"].every(key => same(directives.get(key), ["'self'"])) || !["object-src", "base-uri", "frame-src", "form-action"].every(key => same(directives.get(key), ["'none'"]))) add("SHELL_CSP", "index.html", "Native shell must restrict executable, connection, frame and form origins without overriding directives.");
  } catch { add("SHELL_UNREADABLE", "index.html", "One regular native shell with an unambiguous CSP is required."); }
  const ownedFiles = new Set(), moduleIds = new Set();
  if (actual.has("module-ownership.json")) try {
    const ownership = await readJson(directory, "module-ownership.json");
    if (!fields(ownership, ["schemaVersion", "platform", "chunks"]) || ownership.schemaVersion !== 1 || ownership.platform !== artifact.platform || !Array.isArray(ownership.chunks) || !ownership.chunks.length || ownership.chunks.length > 4096) throw new Error();
    for (const chunk of ownership.chunks) {
      if (!fields(chunk, ["file", "sha256", "modules"]) || !SHA.test(chunk.sha256) || !Array.isArray(chunk.modules) || !chunk.modules.length || chunk.modules.length > 20000) throw new Error();
      const filename = relativePath(chunk.file);
      if (!filename.endsWith(".js") || ownedFiles.has(filename) || actual.get(filename)?.sha256 !== chunk.sha256) throw new Error();
      ownedFiles.add(filename); counts.ownedChunks++;
      let previous = "";
      for (const module of chunk.modules) {
        if (typeof module !== "string" || module <= previous || module.length > 2048) throw new Error(); previous = module;
        // Rollup/Vite virtual identifiers are metadata, not loadable file paths.
        if (module.startsWith("\0")) continue;
        const filename = relativePath(module.split("?")[0]);
        if (!filename.startsWith("src/") && !filename.startsWith("node_modules/") && filename !== "native.html") throw new Error();
        if (filename.startsWith("src/") && !inputMap.has(filename)) throw new Error();
        moduleIds.add(filename);
      }
    }
    for (const filename of actual.keys()) if (filename.endsWith(".js") && !ownedFiles.has(filename)) throw new Error();
    const platform = artifact.platform;
    for (const required of [`src/platform/adapters/${platform}/entry.ts`, `src/platform/adapters/${platform}/${platform === "android" ? "Android" : "Ios"}PlatformAdapter.ts`, "src/host/mountHostApp.tsx", "src/App.tsx"]) if (!moduleIds.has(required)) throw new Error();
    const opposite = platform === "android" ? "ios" : "android";
    if ([...moduleIds].some(name => name.startsWith(`src/platform/adapters/${opposite}/`) || ["src/main.tsx", "src/pwa/PwaEdition.tsx", "src/pwa/serviceWorkerRuntime.js", "src/pwa/qaSceneProbe.ts", "src/pwa/registerPwaWorker.ts"].includes(name))) throw new Error();
    for (const name of ["core", "app", "network", "preferences", "browser", "app-launcher"]) if (![...moduleIds].some(module => module.startsWith(`node_modules/@capacitor/${name}/`))) throw new Error();
    provenance = "self-reported-module-ownership-checked";
  } catch { add("MODULE_OWNERSHIP", "module-ownership.json", "Final chunk bytes and exact selected native entry/SDK graph must agree with contained source identities."); }
  for (const [filename, bytes] of contents) {
    const source = bytes.toString("utf8");
    if (filename.endsWith(".css")) for (const match of source.matchAll(/url\(\s*(?:(["'])(.*?)\1|([^)]*?))\s*\)/gsu)) {
      const value = (match[2] ?? match[3]).trim(); if (/^data:/iu.test(value) || value.startsWith("#")) continue; resource(value, filename);
    }
    if (filename.endsWith(".css")) for (const match of source.matchAll(/@import\s+(["'])(.*?)\1/gsu)) resource(match[2], filename);
    if (!filename.endsWith(".js")) continue;
    counts.scripts++;
    const tree = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    if (tree.parseDiagnostics.length) add("INVALID_SCRIPT", filename, "Built script contains a syntax error.");
    const scan = node => {
      let specifier, reference = false;
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) { reference = true; specifier = node.moduleSpecifier; }
      else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) { reference = true; specifier = node.arguments[0]; }
      if (reference) {
        if (!specifier || !(ts.isStringLiteral(specifier) || ts.isNoSubstitutionTemplateLiteral(specifier)) || !/^(?:\.{1,2}\/|\/)/u.test(specifier.text)) add("UNSAFE_SCRIPT_DEPENDENCY", filename, "Actual module imports must be literal bundled paths.");
        else resource(specifier.text, filename, true);
      }
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "register" && ts.isPropertyAccessExpression(node.expression.expression) && node.expression.expression.name.text === "serviceWorker") add("SERVICE_WORKER_RUNTIME", filename, "Native JavaScript cannot register a Web service worker.");
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "importScripts") add("REMOTE_EXECUTABLE", filename, "Classic worker importScripts is not part of this native bundle.");
      if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && ["Worker", "SharedWorker"].includes(node.expression.text)) {
        const url = node.arguments?.[0];
        if (url && ts.isStringLiteral(url)) resource(url.text, filename, true);
        else add("REMOTE_EXECUTABLE", filename, "Additional executable workers require explicit local provenance.");
      }
      if (ts.isObjectLiteralExpression(node)) {
        const values = new Map(node.properties.filter(ts.isPropertyAssignment).map(property => [propertyName(property.name), property.initializer]));
        if (["EC", "RSA", "oct", "OKP"].includes(values.get("kty")?.text) && ["d", "p", "q", "dp", "dq", "qi", "oth", "k"].some(key => values.has(key))) add("PRIVATE_JWK", filename, "Private or symmetric JWK material is forbidden.");
      }
      ts.forEachChild(node, scan);
    };
    scan(tree);
  }
  const generated = new Set(["artifact.json", "index.html", ".vite/manifest.json", "module-ownership.json"]);
  for (const filename of actual.keys()) if (!generated.has(filename) && !emitted.has(filename) && !publicOutputs.has(filename)) add("OUTPUT_PROVENANCE", filename, "Output must be a Vite asset, generated shell/metadata or traced canonical public copy.");
  return report();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2); let artifactDir = "dist-native", checkSourceFreshness = true;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--dir" && args[i + 1]) artifactDir = args[++i];
    else if (args[i] === "--no-source-freshness") checkSourceFreshness = false;
    else throw new Error("Use --dir <checkout-relative-directory> and optional --no-source-freshness for historical inspection.");
  }
  const result = await verifyNativeArtifact({ artifactDir, checkSourceFreshness });
  process.stdout.write(json(result)); if (!result.pass) process.exitCode = 1;
}
