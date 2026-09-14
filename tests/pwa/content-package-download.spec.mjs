import { test, expect, chromium } from "@playwright/test";
import { build } from "esbuild";
import fs from "node:fs/promises";
import path from "node:path";
import http from "node:http";
import { createHash } from "node:crypto";
import { preservedFixture, sourceCommit } from "./support/preserved-content-package.mjs";
const sha = bytes => createHash("sha256").update(bytes).digest("hex");

test("actual HTTP download resumes verified S08 files after browser restart and preserves both generations offline", async ({}, testInfo) => {
  const versions = await Promise.all([preservedFixture(1), preservedFixture(2)]);
  const [first, second] = versions, trustedKeys = versions.map(value => value.trustedKey);
  const bundled = await build({ stdin: { contents: `
    import { createContentPackageCache } from './src/planet/contentPackageCache.ts';
    import { contentPackageHash } from './src/planet/contentPackageProtocol.mjs';
    window.__content = { createContentPackageCache, contentPackageHash };
  `, resolveDir: process.cwd(), loader: "ts" }, bundle: true, write: false, platform: "browser", format: "iife", target: "es2022", metafile: true });
  const script = bundled.outputFiles[0].text, requests = [], counts = {};
  const server = http.createServer((request, response) => {
    if (request.url === "/harness") { response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }); response.end("<!doctype html><title>Signed download QA</title>"); return; }
    const match = /^\/packages\/v([12])\/(dependency-index\.json|(?:ru|en)\/catalog\.json)$/u.exec(request.url);
    if (!match) { response.writeHead(404); response.end(); return; }
    counts[request.url] = (counts[request.url] ?? 0) + 1;
    requests.push({ path: request.url, cookie: request.headers.cookie ?? null, referrer: request.headers.referer ?? null });
    const file = versions[Number(match[1]) - 1].fixture.files.find(file => file.path === match[2]), bytes = Buffer.from(file.bytes, "utf8");
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Content-Length": bytes.length, "Cache-Control": "no-store" });
    if (request.url === "/packages/v2/ru/catalog.json" && counts[request.url] === 1) {
      // A real incomplete response, not a mocked fetch rejection.
      response.write(bytes.subarray(0, 512), () => response.destroy());
    } else response.end(bytes);
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const origin = "http://127.0.0.1:" + server.address().port;
  const profileRoot = path.resolve(process.env.S11_BROWSER_PROFILE_ROOT ?? ".tmp/s11-content-browser");
  await fs.mkdir(profileRoot, { recursive: true });
  const profile = await fs.mkdtemp(path.join(profileRoot, "s11-dl-"));
  let context; const errors = [], result = { sourceCommit, profile, qaOnly: true, sourceExports: versions.map(value => value.evidence),
    bundleSha256: sha(script), bundleInputs: Object.keys(bundled.metafile.inputs).sort(), steps: {}, pass: false };
  async function launch() { context = await chromium.launchPersistentContext(profile, { channel: "chrome", headless: true }); }
  async function open() {
    const page = await context.newPage(); page.on("pageerror", error => errors.push(error.message));
    await page.goto(origin + "/harness"); await page.addScriptTag({ content: script });
    await page.evaluate(trustedKeys => {
      window.__cache = window.__content.createContentPackageCache({ allowLocalQa: true, origin: location.origin, caches, locks: navigator.locks, trustedKeys });
      window.__progress = [];
    }, trustedKeys);
    return page;
  }
  const requestFor = version => ({ envelope: version.fixture.envelope, expected: version.fixture.expected, manifestSha256: version.fixture.manifestSha256,
    expectedCurrentManifestSha256: version === first ? null : first.fixture.manifestSha256, baseUrl: origin + "/packages/v" + version.fixture.expected.version + "/" });
  async function download(page, version) {
    return page.evaluate(request => window.__cache.download({ ...request, fetch: window.fetch.bind(window), onProgress: value => window.__progress.push(value) }), requestFor(version));
  }
  async function readProof(page, version) {
    return page.evaluate(async ({ expected, manifestSha256 }) => {
      const result = await window.__cache.read({ expected, manifestSha256 });
      if (!result.ok) return result;
      return { ok: true, manifestSha256: result.manifestSha256, activationAllowed: result.activationAllowed, releaseReady: result.releaseReady,
        files: result.files.map(file => ({ path: file.path, bytes: file.bytes.length, sha256: window.__content.contentPackageHash(file.bytes) })) };
    }, version.fixture);
  }
  function expectRead(proof, version) {
    expect(proof).toEqual({ ok: true, manifestSha256: version.fixture.manifestSha256, activationAllowed: false, releaseReady: false, files: version.fixture.envelope.manifest.files });
  }
  try {
    await launch(); const page = await open();
    await context.addCookies([{ name: "qa_cookie", value: "synthetic-only", url: origin }]);
    result.steps.first = await download(page, first); expect(result.steps.first, JSON.stringify(result.steps.first)).toMatchObject({ ok: true, activationAllowed: false });
    result.steps.interrupted = await download(page, second); expect(result.steps.interrupted).toMatchObject({ ok: false, activationAllowed: false });
    result.steps.oldAfterInterruption = await readProof(page, first); expectRead(result.steps.oldAfterInterruption, first);
    result.steps.partialRead = await readProof(page, second); expect(result.steps.partialRead).toMatchObject({ ok: false, reason: "content-generation-not-selected" });
    result.steps.partial = await page.evaluate(async hash => {
      const name = (await caches.keys()).find(name => name.endsWith("-" + hash)), cache = await caches.open(name), urls = (await cache.keys()).map(request => request.url);
      const url = location.origin + "/__literary_content_qa__/files/en/catalog.json", response = await cache.match(url);
      const bytes = new Uint8Array(await response.arrayBuffer()); bytes[bytes.length - 2] ^= 1;
      await cache.put(url, new Response(bytes, { headers: { "Content-Type": "application/json" } }));
      return { paths: urls.map(url => new URL(url).pathname).sort(), deliberatelyDamagedEnglishBytes: bytes.length };
    }, second.fixture.manifestSha256);
    expect(result.steps.partial.paths).toEqual(["/__literary_content_qa__/files/dependency-index.json", "/__literary_content_qa__/files/en/catalog.json"]);

    await context.close(); context = undefined; await launch();
    const retry = await open(), tab = await open();
    result.steps.previousAfterInterruptedBrowserRestart = await readProof(retry, first); expectRead(result.steps.previousAfterInterruptedBrowserRestart, first);
    const lockName = await retry.evaluate(async () => (await caches.keys()).find(name => /^literary-planet-content-qa-v1-[a-f0-9]{64}$/u.test(name)) + ":download");
    await retry.evaluate(name => {
      window.__held = false;
      window.__hold = navigator.locks.request(name, async () => { window.__held = true; await new Promise(resolve => { window.__release = resolve; }); });
    }, lockName);
    await expect.poll(() => retry.evaluate(() => window.__held)).toBe(true);
    await Promise.all([retry, tab].map(page => page.evaluate(request => {
      window.__pendingDownload = window.__cache.download({ ...request, fetch: window.fetch.bind(window), onProgress: value => window.__progress.push(value) });
    }, requestFor(second))));
    await expect.poll(() => retry.evaluate(async name => (await navigator.locks.query()).pending.filter(lock => lock.name === name).length, lockName)).toBe(2);
    await retry.evaluate(() => window.__release());
    result.steps.concurrentRetry = await Promise.all([retry, tab].map(page => page.evaluate(() => window.__pendingDownload)));
    for (const item of result.steps.concurrentRetry) expect(item).toMatchObject({ ok: true, manifestSha256: second.fixture.manifestSha256, previousManifestSha256: first.fixture.manifestSha256, activationAllowed: false });
    result.steps.finalProgress = await Promise.all([retry, tab].map(page => page.evaluate(() => window.__progress.at(-1))));
    for (const progress of result.steps.finalProgress) { expect(progress.phase).toBe("saved"); expect(progress.cachedBytes + progress.downloadedBytes).toBe(progress.totalBytes); }
    expect(result.steps.finalProgress.some(progress => progress.downloadedBytes === 0)).toBe(true);
    expect(counts).toEqual({ "/packages/v1/dependency-index.json": 1, "/packages/v1/en/catalog.json": 1, "/packages/v1/ru/catalog.json": 1,
      "/packages/v2/dependency-index.json": 1, "/packages/v2/en/catalog.json": 2, "/packages/v2/ru/catalog.json": 2 });
    expect(requests.every(request => request.cookie === null && request.referrer === null)).toBe(true);
    await context.close(); context = undefined; await launch();
    const offline = await open(); await context.setOffline(true); const networkBeforeReads = requests.length;
    result.steps.currentAfterCompletedBrowserRestartOffline = await readProof(offline, second);
    result.steps.previousAfterCompletedBrowserRestartOffline = await readProof(offline, first);
    expectRead(result.steps.currentAfterCompletedBrowserRestartOffline, second); expectRead(result.steps.previousAfterCompletedBrowserRestartOffline, first);
    result.offlineReadNetworkRequests = requests.length - networkBeforeReads; expect(result.offlineReadNetworkRequests).toBe(0);
    expect(errors).toEqual([]);
    Object.assign(result, { counts, requests, pageErrors: errors, browserRestarts: 2, offlineLocales: ["ru", "en"], pass: true, stageAccepted: false, releaseReady: false });
  } finally {
    await testInfo.attach("content-package-download-proof", { body: JSON.stringify(result, null, 2) + "\n", contentType: "application/json" });
    await context?.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  }
});
