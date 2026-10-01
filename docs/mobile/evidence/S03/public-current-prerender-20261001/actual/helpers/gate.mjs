import assert from "node:assert/strict";
import path from "node:path";
import http from "node:http";
import { lstat, realpath, mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = await realpath("C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work");
const visualRoot = "D:/CodexData/.codex/visualizations/2026/09/20/01a0bd7e-e7b5-7111-b319-db1a60746e94";
const declaredHere = path.dirname(fileURLToPath(import.meta.url)), here = await realpath(declaredHere);
const review = path.join(await realpath(visualRoot), "s03-public-prerender-current-generator-review");
assert.equal(here, declaredHere); assert.equal(here, path.join(review, "proposed"));
assert.ok(!(await lstat(here)).isSymbolicLink());
const expectedHead = "b27817d44f4b7aedb4556c39ee8d9e541dee67c8", logicalOrigin = "https://probpera.ru";
const expectedTitle = "public RU/EN shells have matching metadata before JavaScript";
const expectedInputs = new Map([
  ["index.html", "fabb90d77b33951c3f8808befca6a6d35a5e87749b74252e8348d9197d41dfe5"],
  ["sitemap.xml", "9f8ea222e5948e228b6703384b8689755a7c4a0faf708bb6d40455ee5223c746"],
]);
const sha = bytes => createHash("sha256").update(bytes).digest("hex"), json = value => JSON.stringify(value, null, 2) + "\n";
const utf8 = bytes => new TextDecoder("utf-8", { fatal: true }).decode(bytes);
const git = args => execFileSync("git", ["--no-optional-locks", "-c", "safe.directory=" + root, ...args],
  { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 8 * 1024 * 1024 });
assert.equal(await realpath(process.cwd()), root); assert.equal(process.argv.length, 2);
assert.equal(git(["rev-parse", "HEAD"]).trim(), expectedHead);
assert.equal(git(["status", "--porcelain=v1", "--untracked-files=all"]).trim(), "");
const require = createRequire(path.join(root, "package.json")), { load } = require("cheerio");
const moduleAt = relative => import(pathToFileURL(path.join(root, relative)).href);
const { stagingSourceSnapshot, STAGING_SOURCE_ROOTS } = await moduleAt("scripts/mobile/pwa-staging-package.mjs");
const { writePublicLocalePages } = await moduleAt("scripts/mobile/write-public-locale-pages.mjs");
const { createLocalizedNotFoundHandler } = await moduleAt("server/public-locales/handler.mjs");
const sourceBefore = await stagingSourceSnapshot(root); assert.equal(sourceBefore.sourceCommit, expectedHead);
assert.equal(sourceBefore.files.length, 2141); assert.equal(STAGING_SOURCE_ROOTS.length, 13);
assert.equal(sourceBefore.files.find(file => file.path === "tests/e2e/public-locales.spec.mjs")?.sha256,
  "894843cc76aa7e5346fadbcc8f37f04f9362391c2f846552b061556d18997d9b");
const exportDependencies = ["scripts/mobile/pwa-staging-package.mjs", "scripts/mobile/write-public-locale-pages.mjs",
  "scripts/mobile/public-locale-pages.mjs", "scripts/mobile/public-locale-review.mjs", "scripts/mobile/account-pages.mjs",
  "scripts/mobile/pwa-artifact.mjs", "src/pwa/accountCopy.ts", "src/pwa/serviceWorkerRuntime.js",
  "src/pwa/pwaBootstrapBudgets.ts", "server/public-locales/handler.mjs", "tests/e2e/public-locales.spec.mjs",
  "package.json", "package-lock.json"];
for (const dependency of exportDependencies) assert.ok(sourceBefore.files.some(file => file.path === dependency));

async function safeFile(base, relative, limit = 2_000_000) {
  assert.ok(relative && !relative.startsWith("/") && !relative.includes("\\") && !relative.includes("%"));
  assert.ok(relative.split("/").every(part => /^[A-Za-z0-9._-]+$/u.test(part) && ![".", ".."].includes(part) && !part.startsWith(".env")));
  assert.equal(await realpath(base), base); assert.ok(!(await lstat(base)).isSymbolicLink());
  let filename = base;
  for (const part of relative.split("/")) {
    filename = path.join(filename, part);
    assert.ok(!(await lstat(filename)).isSymbolicLink()); assert.equal(await realpath(filename), filename);
  }
  const stat = await lstat(filename); assert.ok(stat.isFile() && stat.size <= limit);
  const bytes = await readFile(filename); assert.ok(bytes.length <= limit); return bytes;
}
async function retainedInputs() {
  const base = path.join(root, "dist"), files = new Map();
  const home = await safeFile(base, "index.html"); assert.equal(sha(home), expectedInputs.get("index.html")); files.set("index.html", home);
  const pending = ["sitemap.xml"]; let total = 0;
  while (pending.length) {
    const relative = pending.shift(); if (files.has(relative)) continue;
    assert.ok(files.size <= 32 && expectedInputs.has(relative), "Unprovisioned retained XML input");
    const bytes = await safeFile(base, relative); assert.equal(sha(bytes), expectedInputs.get(relative));
    total += bytes.length; assert.ok(total <= 8 * 1024 * 1024); files.set(relative, bytes);
    const $ = load(utf8(bytes), { xmlMode: true }); assert.equal($("sitemapindex").length + $("urlset").length, 1);
    for (const node of $("sitemap > loc").get()) {
      const url = new URL($(node).text().trim());
      assert.ok(url.origin === logicalOrigin && !url.search && !url.hash && url.pathname.endsWith(".xml"));
      pending.push(decodeURIComponent(url.pathname).slice(1));
    }
  }
  assert.equal(files.size, expectedInputs.size); return files;
}
const inventory = files => [...files].map(([filename, bytes]) => ({ path: filename, bytes: bytes.length, sha256: sha(bytes) })).sort((a, b) => a.path.localeCompare(b.path, "en"));
const inputs = await retainedInputs(), helpers = new Map();
for (const filename of ["gate.mjs", "pwa.config.mjs"]) helpers.set(filename, await safeFile(here, filename));
const temporary = path.join(root, ".tmp"); assert.equal(await realpath(temporary), temporary); assert.ok(!(await lstat(temporary)).isSymbolicLink());
const artifact = path.join(temporary, "public-prerender-d249-a1"), actual = path.join(review, "actual-a1");
assert.equal(await realpath(review), review); await mkdir(actual); await mkdir(path.join(actual, "raw")); await mkdir(artifact);
assert.equal(await realpath(artifact), artifact);
const writeActual = (filename, value) => writeFile(path.join(actual, filename), value, { flag: "wx" });
await writeActual("source-manifest-before.json", json(sourceBefore)); await writeActual("retained-inputs-before.json", json(inventory(inputs)));
const result = { schemaVersion: 1, kind: "public-current-generator-retained-entry-working-validation", sourceCommit: expectedHead,
  nodeVersion: process.version,
  mode: "current-generator/retained-entry", pass: false, writerInvocations: 0, sourceRoots: STAGING_SOURCE_ROOTS,
  exportDependencies, helperDirectory: here, helpers: inventory(helpers), retainedInputCompilationIsCurrent: false,
  sourceManifestBefore: { path: path.join(actual, "source-manifest-before.json"), sha256: sha(json(sourceBefore)) },
  currentAppRuntime: false, assetPresenceOrClosureVerified: false, JavaScriptExecuted: false, browserStarted: false,
  publicBuildsRun: 0, pwaBuildsRun: 0, licenseSigned: false, editorialApprovalCreated: false, indexingEnabled: false,
  productionEdgeAccepted: false, nativeInstalled: false, realStorePurchase: false, stageAccepted: false, releaseReady: false, raw: [] };
let originServer, gateServer;
try {
  for (const [filename, bytes] of inputs) {
    await mkdir(path.dirname(path.join(artifact, filename)), { recursive: true });
    await writeFile(path.join(artifact, filename), bytes, { flag: "wx" });
  }
  result.writerInvocations++;
  const manifest = await writePublicLocalePages({ directory: artifact });
  assert.equal(manifest.files.length, 12); assert.equal(manifest.artifacts.length, 12);
  assert.equal(manifest.releaseReady, false); assert.equal(manifest.sitemap.reviewGate.indexingAllowed, false);
  assert.deepEqual(manifest.sitemap.entries, []); assert.equal(manifest.checkedSitemaps, inputs.size - 1);
  const emitted = new Map();
  for (const entry of manifest.artifacts) {
    const bytes = await safeFile(artifact, entry.path); assert.equal(sha(bytes), entry.sha256); assert.equal(entry.indexable, false); emitted.set(entry.path, bytes);
  }
  emitted.set("locale-routes.json", await safeFile(artifact, "locale-routes.json"));
  assert.deepEqual(JSON.parse(utf8(emitted.get("locale-routes.json"))), manifest);
  const actualNames = [];
  async function walk(relative = "") {
    for (const entry of await readdir(path.join(artifact, relative), { withFileTypes: true })) {
      const name = path.posix.join(relative, entry.name); assert.ok(!entry.isSymbolicLink());
      if (entry.isDirectory()) await walk(name); else { assert.ok(entry.isFile()); actualNames.push(name); }
    }
  }
  await walk(); assert.deepEqual(actualNames.sort(), [...inputs.keys(), ...emitted.keys()].sort());
  const publicFiles = new Map([...inputs].filter(([name]) => name.endsWith(".xml")));
  for (const [name, bytes] of emitted) if (/^(?:ru|en)\/(?:index\.html|404\.html|structured-data\.json|sitemap\.preparation\.json)$/u.test(name)) publicFiles.set(name, bytes);
  const mime = name => name.endsWith(".html") ? "text/html; charset=utf-8" : name.endsWith(".xml") ? "application/xml; charset=utf-8" : "application/json; charset=utf-8";
  originServer = http.createServer((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    let name = url.pathname.slice(1); if (["ru/", "en/"].includes(name)) name += "index.html";
    const bytes = publicFiles.get(name);
    if (!["GET", "HEAD"].includes(request.method)) { response.writeHead(405); response.end(); return; }
    response.writeHead(bytes ? 200 : 404, { "content-type": bytes ? mime(name) : "text/html; charset=utf-8", "cache-control": "no-store" });
    response.end(request.method === "HEAD" ? undefined : bytes ?? "Not found");
  });
  await new Promise(resolve => originServer.listen(0, "127.0.0.1", resolve));
  const origin = "http://127.0.0.1:" + originServer.address().port;
  const handler = createLocalizedNotFoundHandler({ documents: Object.fromEntries(["ru", "en"].map(locale => [locale, utf8(emitted.get(locale + "/404.html"))])), securityHeaders: {} },
    request => { const url = new URL(request.url); assert.equal(url.origin, logicalOrigin);
      const headers = new Headers(request.headers);
      for (const name of ["host", "connection", "content-length", "transfer-encoding", "upgrade"]) headers.delete(name);
      return fetch(origin + url.pathname + url.search, { method: request.method, headers, redirect: "manual", signal: AbortSignal.timeout(15000) }); });
  let rawRequests = 0, rawBytes = 0;
  gateServer = http.createServer(async (request, response) => {
    try {
      const ordinal = ++rawRequests; assert.ok(ordinal <= 80);
      const logical = new Request(logicalOrigin + request.url, { method: request.method, headers: request.headers });
      const forwarded = await handler(logical), bytes = Buffer.from(await forwarded.arrayBuffer());
      rawBytes += bytes.length; assert.ok(bytes.length <= 2_000_000 && rawBytes <= 12 * 1024 * 1024);
      assert.equal(forwarded.headers.has("set-cookie"), false);
      const filename = "raw/response-" + String(ordinal).padStart(2, "0") + ".body";
      await writeActual(filename, bytes);
      result.raw.push({ method: request.method, pathname: new URL(logical.url).pathname, status: forwarded.status,
        headers: Object.fromEntries(forwarded.headers), body: { path: path.join(actual, filename), bytes: bytes.length, sha256: sha(bytes) } });
      response.writeHead(forwarded.status, Object.fromEntries(forwarded.headers)); response.end(bytes);
    } catch (error) { response.writeHead(500, { "content-type": "text/plain" }); response.end("Local QA transport failed"); result.transportFailure = error.message; }
  });
  await new Promise(resolve => gateServer.listen(0, "127.0.0.1", resolve));
  const baseURL = "http://127.0.0.1:" + gateServer.address().port;
  const reportPath = path.join(actual, "playwright.json"), config = path.join(here, "pwa.config.mjs");
  const command = [require.resolve("@playwright/test/cli"), "test", "--config", config];
  result.command = { executable: process.execPath, args: command, cwd: root, expectedCase: expectedTitle, localOrigin: baseURL, logicalOrigin };
  let run;
  try { run = { ...(await promisify(execFile)(process.execPath, command, { cwd: root, windowsHide: true, timeout: 90000, maxBuffer: 8 * 1024 * 1024,
    env: { ...process.env, D249_PUBLIC_ORIGIN: baseURL, D249_PUBLIC_OUTPUT: path.join(actual, "playwright-output"), D249_PUBLIC_REPORT: reportPath } })), exitCode: 0 }; }
  catch (error) { run = { stdout: error.stdout ?? "", stderr: error.stderr ?? "", exitCode: error.code, failure: error.message }; }
  await writeActual("playwright.stdout.txt", run.stdout); await writeActual("playwright.stderr.txt", run.stderr);
  result.stdout = { path: path.join(actual, "playwright.stdout.txt"), sha256: sha(run.stdout) };
  result.stderr = { path: path.join(actual, "playwright.stderr.txt"), sha256: sha(run.stderr) };
  result.exitCode = run.exitCode; assert.equal(run.exitCode, 0);
  const reportBytes = await safeFile(actual, "playwright.json", 8 * 1024 * 1024), report = JSON.parse(utf8(reportBytes));
  const specs = []; const visit = suites => { for (const suite of suites) { specs.push(...(suite.specs ?? [])); visit(suite.suites ?? []); } }; visit(report.suites);
  assert.equal(specs.length, 1); assert.equal(specs[0].title, expectedTitle); assert.equal(specs[0].tests.length, 1);
  assert.deepEqual(specs[0].tests[0].results.map(item => item.status), ["passed"]);
  assert.equal(report.stats.expected, 1); assert.equal(report.stats.unexpected, 0); assert.equal(report.stats.skipped, 0); assert.equal(report.stats.flaky, 0);
  result.playwrightReport = { path: reportPath, sha256: sha(reportBytes), cases: 1, browserFixtureUsed: false };
  assert.equal(result.raw.length, 3); result.homeChecks = [];
  for (const locale of ["ru", "en"]) {
    const raw = result.raw.find(item => item.pathname === "/" + locale + "/"); assert.ok(raw && raw.status === 200);
    const bytes = await readFile(raw.body.path); assert.equal(sha(bytes), raw.body.sha256); const $ = load(utf8(bytes));
    const title = $("h1").text(), description = $("main p").text();
    assert.equal($("title").text(), title); assert.equal($('meta[name="description"]').attr("content"), description);
    for (const name of ["og:title", "twitter:title"]) assert.equal($(name.startsWith("og:") ? `meta[property="${name}"]` : `meta[name="${name}"]`).attr("content"), title);
    for (const name of ["og:description", "twitter:description"]) assert.equal($(name.startsWith("og:") ? `meta[property="${name}"]` : `meta[name="${name}"]`).attr("content"), description);
    assert.equal($('meta[property="og:locale"]').attr("content"), locale === "ru" ? "ru_RU" : "en_US");
    assert.equal($('link[hreflang="x-default"]').attr("href"), logicalOrigin + "/");
    assert.equal($('meta[name="public-locale-indexing"]').length, 0);
    const blocks = $('script[type="application/ld+json"]'); assert.equal(blocks.length, 1); const schema = JSON.parse(blocks.text());
    assert.deepEqual(schema["@graph"].map(node => node["@type"]), ["WebSite", "WebPage"]);
    for (const node of schema["@graph"]) assert.equal(node.inLanguage, locale);
    assert.equal(schema["@graph"][1].url, logicalOrigin + "/" + locale + "/");
    if (locale === "en") assert.ok(!/\p{Script=Cyrillic}/u.test($("body").text()));
    for (const filename of ["structured-data.json", "sitemap.preparation.json"]) {
      const response = await fetch(baseURL + "/" + locale + "/" + filename); assert.equal(response.status, 200); const value = await response.json();
      if (filename === "structured-data.json") assert.deepEqual(value, schema);
      else { assert.equal(value.locale, locale); assert.equal(value.reviewGate.indexingAllowed, false); assert.deepEqual(value.indexableEntries, []); }
    }
    for (const method of ["GET", "HEAD"]) {
      const response = await fetch(baseURL + "/" + locale + "/__d249_missing__", { method });
      assert.equal(response.status, 404); assert.equal(response.headers.get("content-language"), locale); assert.equal(response.headers.get("x-robots-tag"), "noindex, follow");
      const body = await response.text(); if (method === "HEAD") assert.equal(body, "");
      else { assert.equal(body, utf8(emitted.get(locale + "/404.html"))); const recovery = load(body);
        assert.equal(recovery("html").attr("lang"), locale); assert.equal(recovery("body").attr("lang"), locale); assert.equal(recovery("script").length, 0);
        assert.equal(recovery('meta[name="robots"]').attr("content"), "noindex,follow"); }
    }
    await writeActual("public-" + locale + "-head-body.json", json({ locale, title, description, head: $("head").html(), body: $("body").html(), schema }));
    result.homeChecks.push({ locale, rawBeforeJavaScript: true, localizedSocialAndSchema: true, actualLocalHttp404GetAndHead: true });
  }
  assert.equal(result.transportFailure, undefined); assert.equal(result.raw.length, 11);
  for (const [name, bytes] of inputs) assert.equal(sha(await safeFile(artifact, name)), sha(bytes));
  for (const [name, bytes] of emitted) assert.equal(sha(await safeFile(artifact, name)), sha(bytes));
  result.emitted = inventory(emitted); result.retainedInputs = inventory(inputs);
  result.artifactDirectory = artifact; result.rootXmlGraphChecked = manifest.checkedSitemaps; result.localHttpRequests = result.raw.length; result.writerManifest = manifest;
  result.pass = true;
} catch (error) { result.failure = { name: error.name, message: error.message }; process.exitCode = 1; }
finally {
  for (const server of [gateServer, originServer]) if (server?.listening) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  try {
    const sourceAfter = await stagingSourceSnapshot(root), inputsAfter = inventory(await retainedInputs());
    await writeActual("source-manifest-after.json", json(sourceAfter)); await writeActual("retained-inputs-after.json", json(inputsAfter));
    result.sourceManifestAfter = { path: path.join(actual, "source-manifest-after.json"), sha256: sha(json(sourceAfter)) };
    assert.deepEqual(sourceAfter, sourceBefore); assert.deepEqual(inputsAfter, inventory(inputs));
    for (const [name, bytes] of helpers) assert.equal(sha(await safeFile(here, name)), sha(bytes));
    assert.equal(git(["status", "--porcelain=v1", "--untracked-files=all"]).trim(), "");
    result.sourceAndInputsUnchanged = true;
  } catch (error) { result.pass = false; result.failure ??= { name: error.name, message: error.message }; process.exitCode = 1; }
  await writeActual("result.json", json(result)); console.log(json({ pass: result.pass, mode: result.mode, emittedFiles: result.emitted?.length, requests: result.localHttpRequests, failure: result.failure }));
}
