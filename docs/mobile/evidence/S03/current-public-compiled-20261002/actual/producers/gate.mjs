import assert from "node:assert/strict";
import path from "node:path";
import http from "node:http";
import { lstat, realpath, mkdir, readFile, writeFile, readdir, symlink } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import { createRequire, builtinModules } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

// Local proposal. Unresolved inputs make this template fail before any run/output.
const root = await realpath("C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work");
const visual = await realpath("D:/CodexData/.codex/visualizations/2026/09/20/01a0bd7e-e7b5-7111-b319-db1a60746e94");
const review = path.join(visual, "s03-public-current-compiled-review");
const here = await realpath(path.dirname(fileURLToPath(import.meta.url)));
assert.equal(here, path.join(review, "proposed"));
assert.equal(process.argv.length, 2);
const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const json = value => JSON.stringify(value, null, 2) + "\n";
const portable = value => value.split(path.sep).join("/");
const git = args => execFileSync("git", ["--no-optional-locks", "-c", "safe.directory=" + root, ...args],
  { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 16 * 1024 * 1024 });
const moduleAt = relative => import(pathToFileURL(path.join(root, relative)).href);
async function safeFile(base, relative, limit = 64 * 1024 * 1024) {
  assert.ok(relative && !path.isAbsolute(relative) && !relative.includes("\\") && !relative.includes("\0"));
  assert.ok(relative.split("/").every(part => part && ![".", ".."].includes(part) && !/^\.env(?:\.|$)/u.test(part)));
  let filename = base;
  for (const part of relative.split("/")) {
    filename = path.join(filename, part);
    assert.ok(!(await lstat(filename)).isSymbolicLink(), "Linked input: " + relative);
    assert.equal(await realpath(filename), filename, "Aliased input: " + relative);
  }
  const info = await lstat(filename);
  assert.ok(info.isFile() && info.size <= limit, "Invalid input: " + relative);
  return readFile(filename);
}
async function tree(base, prefix = "", skipNestedNodeModules = false) {
  const files = [];
  const start = path.join(base, prefix);
  assert.ok(!(await lstat(start)).isSymbolicLink());
  assert.equal(await realpath(start), start);
  async function walk(relative) {
    const directory = path.join(base, relative);
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const name = [relative, entry.name].filter(Boolean).join("/");
      assert.ok(!/^\.env(?:\.|$)/u.test(entry.name), "Private env input excluded: " + name);
      assert.ok(!entry.isSymbolicLink(), "Unreviewed linked input: " + name);
      if (entry.isDirectory()) {
        if (!(skipNestedNodeModules && entry.name === "node_modules")) await walk(name);
      }
      else {
        assert.ok(entry.isFile(), "Non-file input: " + name);
        const bytes = await safeFile(base, name);
        files.push({ path: name, bytes: bytes.length, sha256: sha(bytes) });
      }
    }
  }
  await walk(prefix);
  files.sort((a, b) => a.path.localeCompare(b.path, "en"));
  return { files };
}
const input = JSON.parse(await safeFile(here, "inputs.json"));
assert.equal(input.schemaVersion, 1);
assert.match(input.expectedBase ?? "", /^[a-f0-9]{40}$/u);
assert.equal(git(["rev-parse", "HEAD"]).trim(), input.expectedBase);
assert.equal(git(["status", "--porcelain=v1", "--untracked-files=all"]).trim(), "");
const { stagingSourceSnapshot, STAGING_SOURCE_ROOTS } = await moduleAt("scripts/mobile/pwa-staging-package.mjs");
const sourceBefore = await stagingSourceSnapshot(root);
assert.equal(sourceBefore.sourceCommit, input.expectedBase);
assert.equal(STAGING_SOURCE_ROOTS.length, 13);
const require = createRequire(path.join(root, "package.json"));
const { load } = require("cheerio");
const helperNames = ["gate.mjs", "compile.mjs", "public.config.mjs", "public-fixtures.mjs", "inputs.json"];
const helperBefore = await Promise.all(helperNames.map(async name => ({ path: name, sha256: sha(await safeFile(here, name)) })));
async function inputsSnapshot() {
  const extendedNames = new Set((await stagingSourceSnapshot(root)).files.map(file => file.path));
  for (const prefix of ["public", "apps/admin/catalog-assets"]) {
    for (const file of (await tree(root, prefix)).files) extendedNames.add(file.path);
  }
  extendedNames.add("reports/public-image-delivery.json");
  extendedNames.add("playwright.config.mjs");
  return Promise.all([...extendedNames].sort().map(async name => {
    const bytes = await safeFile(root, name);
    return { path: name, bytes: bytes.length, sha256: sha(bytes) };
  }));
}
const inputsBefore = await inputsSnapshot();
async function dependenciesSnapshot() {
  // Bind installed compiler/helper packages and source imports, without traversing unused workspace/Next packages.
  const ts = require("typescript");
  const seeds = new Set(["vite", "@vitejs/plugin-react", "vitest", "typescript", "esbuild", "sharp", "cheerio", "@playwright/test"]);
  const builtins = new Set(builtinModules.flatMap(name => [name, "node:" + name]));
  const packageName = specifier => {
    if (typeof specifier !== "string" || /^[.#/]/u.test(specifier) || specifier.startsWith("@/") || builtins.has(specifier)) return null;
    return specifier.startsWith("@") ? specifier.split("/").slice(0, 2).join("/") : specifier.split("/")[0];
  };
  for (const file of sourceBefore.files.filter(item => item.path.startsWith("src/")
    && /\.(?:tsx?|m?js)$/u.test(item.path) && !/\.(?:test|spec)\./u.test(item.path))) {
    const bytes = await safeFile(root, file.path); assert.equal(sha(bytes), file.sha256);
    const syntax = ts.createSourceFile(file.path, bytes.toString("utf8"), ts.ScriptTarget.Latest, true,
      file.path.endsWith("tsx") ? ts.ScriptKind.TSX : file.path.endsWith("js") ? ts.ScriptKind.JS : ts.ScriptKind.TS);
    const add = literal => { if (literal && ts.isStringLiteralLike(literal)) { const name = packageName(literal.text); if (name) seeds.add(name); } };
    const visit = node => {
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) add(node.moduleSpecifier);
      if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword
        || ts.isIdentifier(node.expression) && node.expression.text === "require")) add(node.arguments[0]);
      ts.forEachChild(node, visit);
    };
    visit(syntax);
  }
  async function locate(name, importer = "") {
    assert.match(name, /^(?:@[A-Za-z0-9._-]+\/)?[A-Za-z0-9._-]+$/u);
    let parent = path.join(root, importer);
    while (true) {
      const relative = portable(path.relative(root, path.join(parent, "node_modules", name)));
      try { await lstat(path.join(root, relative, "package.json")); return relative; }
      catch (error) { if (error.code !== "ENOENT" && error.code !== "ENOTDIR") throw error; }
      if (parent === root) return null;
      const next = path.dirname(parent);
      assert.ok(next === root || !path.relative(root, next).startsWith(".." + path.sep));
      parent = next;
    }
  }
  const packages = new Set(), missingOptional = new Set(), pending = [];
  for (const name of [...seeds].sort()) {
    const found = await locate(name); assert.ok(found, "Required installed source/tool package absent: " + name); pending.push(found);
  }
  while (pending.length) {
    const relative = pending.shift(); if (packages.has(relative)) continue;
    assert.ok(!(await lstat(path.join(root, relative))).isSymbolicLink(), "Linked dependency package: " + relative);
    const metadata = JSON.parse(await safeFile(root, relative + "/package.json"));
    packages.add(relative);
    const optional = metadata.optionalDependencies ?? {};
    const names = new Set([...Object.keys(metadata.dependencies ?? {}), ...Object.keys(optional), ...Object.keys(metadata.peerDependencies ?? {})]);
    for (const name of names) {
      const found = await locate(name, relative);
      if (found) pending.push(found);
      else if (name in optional || !(name in (metadata.dependencies ?? {}))) missingOptional.add(relative + ":" + name);
      else throw new Error("Required installed dependency absent: " + relative + ":" + name);
    }
  }
  const rows = new Map();
  for (const relative of [...packages].sort()) {
    for (const file of (await tree(root, relative, true)).files) rows.set(file.path, file);
  }
  const admin = path.join(root, "node_modules/@probpera/admin");
  assert.ok((await lstat(admin)).isSymbolicLink());
  assert.equal(await realpath(admin), await realpath(path.join(root, "apps/admin")));
  return { seeds: [...seeds].sort(), packages: [...packages].sort(), missingOptional: [...missingOptional].sort(),
    files: [...rows.values()].sort((a, b) => a.path.localeCompare(b.path, "en")),
    excludedAdminJunction: { path: "node_modules/@probpera/admin", target: await realpath(admin), traversed: false } };
}
const dependenciesBefore = await dependenciesSnapshot();
async function pinned(ref) {
  assert.ok(path.isAbsolute(ref.path)); assert.match(ref.sha256 ?? "", /^[a-f0-9]{64}$/u);
  const relative = path.relative(visual, ref.path);
  assert.ok(relative && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative));
  const bytes = await safeFile(visual, portable(relative)); assert.equal(sha(bytes), ref.sha256); return bytes;
}
const typecheckSource = JSON.parse(await pinned(input.appTypecheck.sourceManifest));
assert.deepEqual(typecheckSource.files, sourceBefore.files, "D252 full thirteen-root input drift");
const typecheckReceipt = JSON.parse(await pinned(input.appTypecheck.receipt));
assert.equal(typecheckReceipt.pass, true);
assert.equal(typecheckReceipt.tsc.exitCode, 0);
assert.equal(typecheckReceipt.appTypeScriptInvocations, 1);
assert.equal(path.resolve(typecheckReceipt.sourceManifest.path), path.resolve(input.appTypecheck.sourceManifest.path));
assert.equal(typecheckReceipt.sourceManifest.sha256, input.appTypecheck.sourceManifest.sha256);
const tscCommand = JSON.parse(await pinned(typecheckReceipt.tsc.command));
assert.equal(await realpath(tscCommand.cwd), root);
assert.equal(await realpath(tscCommand.executable), await realpath(process.execPath));
assert.deepEqual(tscCommand.args, ["node_modules/typescript/bin/tsc", "--project", "tsconfig.json", "--noEmit"]);
assert.equal((await pinned(typecheckReceipt.tsc.stdout)).length, 0);
assert.equal((await pinned(typecheckReceipt.tsc.stderr)).length, 0);
assert.equal(JSON.parse(await safeFile(root, "tsconfig.json")).compilerOptions.noEmit, true);
const originalCases = await safeFile(root, "tests/e2e/public-locales.spec.mjs");
const importLine = 'import { expect, test } from "@playwright/test";';
assert.equal(originalCases.toString("utf8").split(importLine).length, 2);
const fixtureLine = "import { expect, test } from " + JSON.stringify(pathToFileURL(path.join(here, "public-fixtures.mjs")).href) + ";";
const derivedCases = originalCases.toString("utf8").replace(importLine, fixtureLine);
assert.equal(derivedCases.replace(fixtureLine, importLine), originalCases.toString("utf8"));
const expectedTitles = [
  "public RU/EN shells have matching metadata before JavaScript",
  "public locale switching keeps the globe and country while updating route metadata",
];
assert.deepEqual([...derivedCases.matchAll(/test\("([^"]+)"/gu)].map(match => match[1]), expectedTitles);

const actual = path.join(review, "actual-a1");
await mkdir(actual);
const project = path.join(actual, "project"), output = path.join(project, "dist"), cache = path.join(actual, "vite-cache");
for (const name of [project, output, cache, path.join(actual, "commands"), path.join(actual, "cases"), path.join(actual, "raw")]) await mkdir(name);
const writeActual = (name, value) => writeFile(path.join(actual, name), value, { flag: "wx" });
await writeActual("source-before.json", json(sourceBefore));
await writeActual("inputs-before.json", json(inputsBefore));
await writeActual("dependencies-before.json", json(dependenciesBefore));
await writeActual("output-initial.json", json(await tree(output)));
const result = {
  schemaVersion: 1, kind: "current-public-compiled-local-working-validation", sourceCommit: input.expectedBase,
  pass: false, stageAccepted: false, releaseReady: false, editorialApproved: false, publicDeployed: false,
  productionEdgeAccepted: false, providerActivated: false, nativeInstalled: false,
  sourceRoots: STAGING_SOURCE_ROOTS, extraInputRoots: ["public", "apps/admin/catalog-assets", "reports/public-image-delivery.json", "playwright.config.mjs"],
  helperPins: helperBefore, appTypecheckReused: input.appTypecheck, appTypechecksRun: 0,
  packageBuildRun: false, cmsExportsRun: 0, publicCompilesRun: 0, pwaBuildsRun: 0,
  nativeSandboxClaimed: false, dependencyAdminJunctionTraversed: false, commands: [], raw: [],
  originalCaseSha256: sha(originalCases), derivedCaseSha256: sha(derivedCases), testBodiesUnchanged: true,
  capturesReviewed: false, noindexPreserved: false,
};
const envBase = {};
for (const key of ["PATH", "SystemRoot", "WINDIR", "COMSPEC", "PATHEXT", "USERPROFILE", "LOCALAPPDATA", "PROGRAMFILES", "PROGRAMFILES(X86)"]) {
  if (process.env[key] !== undefined) envBase[key] = process.env[key];
}
Object.assign(envBase, {
  TEMP: actual, TMP: actual, NODE_ENV: "production",
  PUBLIC_SITE_ORIGIN: "https://probpera.ru", PUBLIC_SITE_BASE_PATH: "/",
  PUBLIC_SITE_URL: "https://probpera.ru", VITE_PUBLIC_SITE_URL: "https://probpera.ru",
});
async function run(name, args, extra = {}) {
  const record = { name, executable: process.execPath, args, cwd: cache };
  result.commands.push(record);
  let outcome;
  try { outcome = { ...(await promisify(execFile)(process.execPath, args, { cwd: cache, windowsHide: true,
    timeout: 600000, maxBuffer: 32 * 1024 * 1024, env: { ...envBase, ...extra } })), exitCode: 0 }; }
  catch (error) { outcome = { stdout: error.stdout ?? "", stderr: error.stderr ?? "", exitCode: error.code, failure: error.message }; }
  for (const stream of ["stdout", "stderr"]) {
    const filename = "commands/" + name + "." + stream + ".txt";
    await writeActual(filename, outcome[stream]); record[stream] = { path: filename, sha256: sha(outcome[stream]) };
  }
  record.exitCode = outcome.exitCode; assert.equal(outcome.exitCode, 0, "Prerequisite/run failed: " + name);
}
let server;
let projectInputs = [];
try {
  // Existing read-only validators; no ordinary CMS exporter or image acquisition is called.
  await run("interface-catalog-check", [path.join(root, "scripts/export-interface-copy-catalog.mjs"), "--check"]);
  await run("retained-image-check", [path.join(root, "scripts/prepare-public-images.mjs"), "--check"]);
  // Existing globe QA and mention generator require their own repository-relative paths.
  // Their copy is external; dependency junction is read-only input and never traversed by our copier.
  projectInputs = inputsBefore.filter(file => sourceBefore.files.some(source => source.path === file.path)
    || file.path.startsWith("public/textures/") || file.path.startsWith("public/articles/")
    || file.path.startsWith("public/cms/") || file.path === "reports/public-image-delivery.json");
  for (const file of projectInputs) {
    const target = path.join(project, file.path); await mkdir(path.dirname(target), { recursive: true });
    const bytes = await safeFile(root, file.path); assert.equal(sha(bytes), file.sha256);
    await writeFile(target, bytes, { flag: "wx" });
  }
  await symlink(path.join(root, "node_modules"), path.join(project, "node_modules"), "junction");
  await symlink(path.join(root, "node_modules"), path.join(actual, "node_modules"), "junction");
  await run("retained-globe-qa", [path.join(project, "scripts/qa-globe-alignment.mjs")]);
  await run("mentions-compare", [path.join(project, "scripts/build-book-article-mentions.mjs")]);
  for (const file of projectInputs) assert.equal(sha(await safeFile(project, file.path)), file.sha256,
    "Retained input needs regeneration before this compile: " + file.path);
  await writeActual("prerequisite-inputs.json", json(projectInputs));
  result.publicCompilesRun++;
  await run("public-vite-compile", [path.join(here, "compile.mjs"), root, output, cache, path.join(actual, "compile.json")]);
  const compile = JSON.parse(await safeFile(actual, "compile.json"));
  const known = new Set([...inputsBefore, ...dependenciesBefore.files].map(file => path.join(root, file.path)));
  const observed = new Set();
  for (const item of compile.modules) {
    if (item.id.startsWith("\0")) continue;
    const filename = item.id.split("?")[0];
    if (!path.isAbsolute(filename)) continue;
    const normalized = path.resolve(filename);
    assert.ok(known.has(normalized), "Unbound compiler input: " + filename); observed.add(normalized);
  }
  for (const filename of compile.resolved.configFileDependencies) {
    assert.ok(known.has(path.resolve(filename)), "Unbound config dependency: " + filename);
  }
  result.compilerInputFiles = [...observed].map(filename => portable(path.relative(root, filename))).sort();
  await run("public-article-postprocess", [path.join(root, "scripts/build-article-pages.mjs")], { ARTICLE_BUILD_PROJECT_ROOT: project });
  // This validator's CLI uses process.cwd(); invoke its genuine function with the actual external project.
  const { auditBookDossierStaticDelivery } = await moduleAt("scripts/audit-book-dossier-delivery.mjs");
  const dossier = await auditBookDossierStaticDelivery(project); assert.ok(dossier.checked > 0); assert.deepEqual(dossier.issues, []);
  await writeActual("dossier-delivery.json", json(dossier));
  // The genuine writer requires a directory inside its own root. This byte-identical source copy satisfies that gate.
  const { writePublicLocalePages, capturePublicLocaleSourceSnapshot } = await import(pathToFileURL(path.join(project, "scripts/mobile/write-public-locale-pages.mjs")).href);
  const baseOutput = await tree(output), compiledSnapshot = await capturePublicLocaleSourceSnapshot({ directory: output });
  await writeActual("compiled-source-snapshot.json", json(compiledSnapshot));
  const manifest = await writePublicLocalePages({ directory: output });
  assert.equal(manifest.releaseReady, false); assert.equal(manifest.sitemap.reviewGate.indexingAllowed, false);
  assert.deepEqual(manifest.sitemap.entries, []);
  for (const item of manifest.artifacts) assert.equal(item.indexable, false);
  const outputBefore = await tree(output);
  const outputMap = new Map(outputBefore.files.map(file => [file.path, file]));
  for (const file of baseOutput.files) assert.deepEqual(outputMap.get(file.path), file, "Writer changed base compiled input");
  result.writerManifest = manifest; result.noindexPreserved = true;
  result.rootXmlGraphChecked = manifest.checkedSitemaps;
  await writeActual("output-before.json", json(outputBefore));
  const { createLocalizedNotFoundHandler } = await moduleAt("server/public-locales/handler.mjs");
  const logicalOrigin = "https://probpera.ru";
  const documents = Object.fromEntries(await Promise.all(["ru", "en"].map(async locale =>
    [locale, (await safeFile(output, locale + "/404.html")).toString("utf8")])));
  const mime = name => ({ ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
    ".xml": "application/xml; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png",
    ".webp": "image/webp", ".avif": "image/avif", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".woff": "font/woff", ".wasm": "application/wasm" }[path.extname(name)] ?? "application/octet-stream");
  const handler = createLocalizedNotFoundHandler({ documents, securityHeaders: {} }, async request => {
    const url = new URL(request.url); assert.equal(url.origin, logicalOrigin);
    let name = decodeURIComponent(url.pathname).slice(1);
    if (!name || name.endsWith("/")) name += "index.html";
    const file = outputMap.get(name), fallback = outputMap.get("404.html");
    const selected = file ?? fallback; assert.ok(selected);
    const bytes = await safeFile(output, selected.path); assert.equal(sha(bytes), selected.sha256);
    return new Response(request.method === "HEAD" ? null : bytes, { status: file ? 200 : 404,
      headers: { "content-type": mime(selected.path), "content-length": String(bytes.length), "cache-control": "no-store" } });
  });
  server = http.createServer(async (request, response) => {
    try {
      assert.ok(["GET", "HEAD"].includes(request.method)); assert.ok(result.raw.length < 5000);
      const logical = new Request(logicalOrigin + request.url, { method: request.method, headers: request.headers });
      const outgoing = await handler(logical), bytes = Buffer.from(await outgoing.arrayBuffer());
      const record = { method: request.method, pathname: new URL(logical.url).pathname, status: outgoing.status,
        headers: Object.fromEntries(outgoing.headers), bytes: bytes.length, sha256: sha(bytes) };
      result.raw.push(record);
      if (/^\/(?:sitemap\.xml|(?:ru|en)\/(?:$|structured-data\.json$|sitemap\.preparation\.json$|__d253_missing__$))/u.test(record.pathname)) {
        record.bodyPath = "raw/response-" + String(result.raw.length).padStart(4, "0") + ".body";
        await writeActual(record.bodyPath, bytes);
      }
      response.writeHead(outgoing.status, Object.fromEntries(outgoing.headers)); response.end(bytes);
    } catch (error) {
      result.transportFailure ??= error.message; response.writeHead(500); response.end("Local QA transport failed");
    }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const baseURL = "http://127.0.0.1:" + server.address().port;
  await writeActual("cases/public-locales.spec.mjs", derivedCases);
  await run("public-locales-two-existing-cases", [require.resolve("@playwright/test/cli"), "test", "--config", path.join(here, "public.config.mjs")], {
    D253_CANONICAL_ROOT: root, D253_PUBLIC_ORIGIN: baseURL, D253_CASE_DIRECTORY: path.join(actual, "cases"),
    D253_PUBLIC_OUTPUT: path.join(actual, "playwright-output"), D253_PUBLIC_REPORT: path.join(actual, "playwright.json"),
  });
  const report = JSON.parse(await safeFile(actual, "playwright.json"));
  const cases = [];
  const visit = suites => { for (const suite of suites) { cases.push(...(suite.specs ?? [])); visit(suite.suites ?? []); } };
  visit(report.suites);
  assert.deepEqual(cases.map(item => item.title).sort(), [...expectedTitles].sort());
  for (const item of cases) { assert.equal(item.tests.length, 1); assert.deepEqual(item.tests[0].results.map(entry => entry.status), ["passed"]); }
  assert.equal(report.stats.expected, 2); assert.equal(report.stats.unexpected, 0); assert.equal(report.stats.skipped, 0); assert.equal(report.stats.flaky, 0);
  const attachments = cases.flatMap(item => item.tests[0].results[0].attachments ?? [])
    .filter(item => ["current public EN final", "local network fence"].includes(item.name));
  assert.equal(attachments.filter(item => item.name === "current public EN final").length, 1);
  result.captureAndNetworkEvidence = [];
  for (const item of attachments) {
    assert.ok(path.isAbsolute(item.path));
    const relative = path.relative(actual, item.path); assert.ok(relative && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative));
    const bytes = await safeFile(actual, portable(relative));
    result.captureAndNetworkEvidence.push({ name: item.name, path: item.path, bytes: bytes.length, sha256: sha(bytes) });
  }
  result.existingCasesPassed = 2;
  // Retained D249 oracle, now exercised against the actual current compiled output.
  for (const locale of ["ru", "en"]) {
    for (const filename of ["structured-data.json", "sitemap.preparation.json"]) {
      const response = await fetch(baseURL + "/" + locale + "/" + filename); assert.equal(response.status, 200);
      const value = await response.json();
      if (filename === "structured-data.json") assert.ok(value["@graph"].every(node => node.inLanguage === locale));
      else { assert.equal(value.locale, locale); assert.equal(value.reviewGate.indexingAllowed, false); assert.deepEqual(value.indexableEntries, []); }
    }
    for (const method of ["GET", "HEAD"]) {
      const response = await fetch(baseURL + "/" + locale + "/__d253_missing__", { method });
      assert.equal(response.status, 404); assert.equal(response.headers.get("content-language"), locale);
      assert.equal(response.headers.get("x-robots-tag"), "noindex, follow");
      const body = await response.text();
      if (method === "HEAD") assert.equal(body, "");
      else {
        assert.equal(body, documents[locale]); const $ = load(body);
        assert.equal($("html").attr("lang"), locale); assert.equal($("body").attr("lang"), locale); assert.equal($("script").length, 0);
      }
    }
  }
  assert.equal(result.transportFailure, undefined);
  result.pass = true;
  result.artifactDirectory = output;
} catch (error) {
  result.failure = { name: error.name, message: error.message }; process.exitCode = 1;
} finally {
  if (server?.listening) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  try {
    const sourceAfter = await stagingSourceSnapshot(root), inputsAfter = await inputsSnapshot(), dependenciesAfter = await dependenciesSnapshot();
    await writeActual("source-after.json", json(sourceAfter)); await writeActual("inputs-after.json", json(inputsAfter));
    await writeActual("dependencies-after.json", json(dependenciesAfter));
    assert.deepEqual(sourceAfter, sourceBefore); assert.deepEqual(inputsAfter, inputsBefore); assert.deepEqual(dependenciesAfter, dependenciesBefore);
    for (const file of projectInputs) assert.equal(sha(await safeFile(project, file.path)), file.sha256, "Copied source/input drift: " + file.path);
    await writeActual("copied-inputs-after.json", json(projectInputs));
    for (const base of [project, actual]) {
      const link = path.join(base, "node_modules"); assert.ok((await lstat(link)).isSymbolicLink());
      assert.equal(await realpath(link), await realpath(path.join(root, "node_modules")));
    }
    for (const helper of helperBefore) assert.equal(sha(await safeFile(here, helper.path)), helper.sha256);
    await pinned(input.appTypecheck.sourceManifest); await pinned(input.appTypecheck.receipt);
    await pinned(typecheckReceipt.tsc.command); await pinned(typecheckReceipt.tsc.stdout); await pinned(typecheckReceipt.tsc.stderr);
    assert.equal(git(["rev-parse", "HEAD"]).trim(), input.expectedBase);
    assert.equal(git(["status", "--porcelain=v1", "--untracked-files=all"]).trim(), "");
    if (result.noindexPreserved) {
      const before = JSON.parse(await safeFile(actual, "output-before.json")), after = await tree(output);
      assert.deepEqual(after, before); result.outputUnchangedAfterValidation = true;
    }
    await writeActual("output-after.json", json(await tree(output)));
    result.canonicalSourceAndDependenciesUnchanged = true;
  } catch (error) { result.pass = false; result.failure ??= { name: error.name, message: error.message }; process.exitCode = 1; }
  await writeActual("result.json", json(result));
  console.log(json({ pass: result.pass, publicCompilesRun: result.publicCompilesRun, casesPassed: result.existingCasesPassed, failure: result.failure }));
}
