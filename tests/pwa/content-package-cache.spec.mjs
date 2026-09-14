import { test, expect, chromium } from "@playwright/test";
import { build } from "esbuild";
import fs from "node:fs/promises";
import path from "node:path";
import http from "node:http";
import { createHash } from "node:crypto";
import { contentPackageCanonicalJson } from "../../src/planet/contentPackageProtocol.mjs";

const sha = bytes => createHash("sha256").update(bytes).digest("hex");
const sourceCommit = "89cf558d7be310503672420568b1c7a045bd8325";
const evidenceRoot = "docs/mobile/evidence/S08/content-export-20260914";
const exportRoot = process.env.S11_CONTENT_EXPORT_ROOT ?? ".tmp/content-exports";

async function preservedFixture(version) {
  const name = "a" + version, evidence = evidenceRoot + "/export-" + name;
  const inspectionBytes = await fs.readFile(evidence + "/inspection.json");
  const inspection = JSON.parse(inspectionBytes), checked = [];
  async function pinned(relative, fromEvidence = false) {
    const pin = inspection.actualPreservedFiles.find(file => file.path === relative);
    expect(pin, "Preserved S08 pin for " + relative).toBeTruthy();
    const path = fromEvidence ? evidence + "/" + relative : exportRoot + "/s08-20260914-" + name + "/" + relative;
    const bytes = await fs.readFile(path);
    expect({ bytes: bytes.length, sha256: sha(bytes) }).toEqual({ bytes: pin.bytes, sha256: pin.sha256 });
    checked.push({ path, bytes: bytes.length, sha256: sha(bytes) });
    return bytes;
  }
  // The saved QA inspection selects the public key independently. No public-key
  // URL or transport-supplied self-signed identity is accepted by the consumer.
  const trustedKey = JSON.parse(await pinned("qa-public-key.json", true));
  const envelope = JSON.parse(await pinned("signature.json"));
  const rawManifest = await pinned("manifest.json");
  expect(JSON.parse(rawManifest)).toEqual(envelope.manifest);
  const files = [];
  for (const file of envelope.manifest.files) files.push({ path: file.path, bytes: (await pinned("package/" + file.path)).toString("utf8") });
  expect(envelope.manifest).toMatchObject({ sourceCommit, version, environment: "local-qa", releaseReady: false, namespace: "adult", locales: ["ru", "en"] });
  return { fixture: { envelope, files, manifestSha256: sha(contentPackageCanonicalJson(envelope.manifest)), expected: {
    packageId: "literary-planet-adult-candidate", sourceCommit, version, namespace: "adult", childPolicy: null, readerVersion: 1,
  } }, trustedKey, evidence: { version, inspection: { path: evidence + "/inspection.json", sha256: sha(inspectionBytes) },
    canonicalManifestSha256: sha(contentPackageCanonicalJson(envelope.manifest)), rawManifestSha256: sha(rawManifest), checked } };
}

test("actual Chrome retains signed S08 RUEN bytes through failure, concurrent retry and browser restart offline", async ({}, testInfo) => {
  const [first, second] = await Promise.all([preservedFixture(1), preservedFixture(2)]);
  const trustedKeys = [first.trustedKey, second.trustedKey];
  const bundle = await build({ stdin: { contents: `
    import { createContentPackageCache } from './src/planet/contentPackageCache.ts';
    import { contentPackageHash } from './src/planet/contentPackageProtocol.mjs';
    window.__content = { createContentPackageCache, contentPackageHash };
  `, resolveDir: process.cwd(), loader: "ts" }, bundle: true, write: false, platform: "browser", format: "iife", target: "es2022", metafile: true });
  expect(Object.keys(bundle.metafile.inputs).some(file => file.startsWith("scripts/"))).toBe(false);
  const script = bundle.outputFiles[0].text, requests = [];
  const server = http.createServer((request, response) => {
    requests.push(request.url);
    if (request.url === "/harness") { response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }); response.end("<!doctype html><title>Signed content storage QA</title>"); }
    else { response.writeHead(404); response.end(); }
  });
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
  const origin = "http://127.0.0.1:" + server.address().port;
  // CacheStorage adds hashed subdirectories. Keep the persistent profile short
  // enough for Windows native storage APIs; preserve it for the restart proof.
  const profileRoot = path.resolve(process.env.S11_BROWSER_PROFILE_ROOT ?? ".tmp/s11-content-browser");
  await fs.mkdir(profileRoot, { recursive: true });
  const profile = await fs.mkdtemp(path.join(profileRoot, "s11-")), errors = [];
  let context;
  async function launch() {
    context = await chromium.launchPersistentContext(profile, { channel: "chrome", headless: true });
    return context;
  }
  async function openPage() {
    const page = await context.newPage(); page.on("pageerror", error => errors.push(error.message));
    await page.goto(origin + "/harness"); await page.addScriptTag({ content: script });
    await page.evaluate(keys => {
      window.__keys = keys;
      window.__packageCache = window.__content.createContentPackageCache({ allowLocalQa: true, origin: location.origin, trustedKeys: keys, caches, locks: navigator.locks });
    }, trustedKeys);
    return page;
  }
  async function readProof(page, fixture) {
    return page.evaluate(async ({ expected, manifestSha256 }) => {
      const result = await window.__packageCache.read({ expected, manifestSha256 });
      if (!result.ok) return result;
      return { ok: result.ok, manifestSha256: result.manifestSha256, activationAllowed: result.activationAllowed, releaseReady: result.releaseReady,
        files: result.files.map(file => ({ path: file.path, bytes: file.bytes.length, sha256: window.__content.contentPackageHash(file.bytes) })) };
    }, fixture);
  }
  const expectRead = (proof, fixture) => expect(proof).toEqual({ ok: true, manifestSha256: fixture.manifestSha256,
    activationAllowed: false, releaseReady: false, files: fixture.envelope.manifest.files });
  const result = { sourceCommit, qaOnly: true, sourceExports: [first.evidence, second.evidence],
    profile, bundleSha256: sha(script), bundleInputs: Object.keys(bundle.metafile.inputs).sort(), steps: {} };
  try {
    await launch(); const page = await openPage();
    result.capabilities = await page.evaluate(() => ({ secureContext: isSecureContext, cacheStorage: !!window.caches, webLocks: !!navigator.locks, webCrypto: !!crypto.subtle, userAgent: navigator.userAgent }));
    expect(result.capabilities).toMatchObject({ secureContext: true, cacheStorage: true, webLocks: true, webCrypto: true });
    result.steps.first = await page.evaluate(f => window.__packageCache.save({ ...f, expectedCurrentManifestSha256: null }), first.fixture);
    expect(result.steps.first, JSON.stringify(result.steps.first)).toMatchObject({ ok: true, activationAllowed: false, previousManifestSha256: null });
    // Fault injection wraps a real Cache.put. Previous bytes and subsequent retry
    // use the actual browser storage and cryptography, with no in-memory substitute.
    result.steps.interrupted = await page.evaluate(async ({ fixture, prior }) => {
      const storage = { keys: caches.keys.bind(caches), delete: caches.delete.bind(caches), match: caches.match.bind(caches),
        async open(name) { const real = await caches.open(name); return { async put(url, response) {
          if (name.endsWith(fixture.manifestSha256) && String(url).endsWith("/files/en/catalog.json")) throw new DOMException("controlled-storage-quota", "QuotaExceededError");
          return real.put(url, response);
        } }; } };
      const candidate = window.__content.createContentPackageCache({ allowLocalQa: true, origin: location.origin, trustedKeys: window.__keys, caches: storage, locks: navigator.locks });
      return candidate.save({ ...fixture, expectedCurrentManifestSha256: prior });
    }, { fixture: second.fixture, prior: first.fixture.manifestSha256 });
    expect(result.steps.interrupted).toMatchObject({ ok: false, reason: "controlled-storage-quota" });
    result.steps.oldAfterFailure = await readProof(page, first.fixture); expectRead(result.steps.oldAfterFailure, first.fixture);
    result.steps.partialRead = await readProof(page, second.fixture);
    expect(result.steps.partialRead).toMatchObject({ ok: false, reason: "content-generation-not-selected" });

    // Two real documents deliberately overlap at the same named Web Lock.
    const tab = await openPage();
    await page.evaluate(() => {
      window.__held = false;
      window.__release = null;
    });
    const lockName = await page.evaluate(async () => (await caches.keys()).find(name => /^literary-planet-content-qa-v1-[a-f0-9]{64}$/u.test(name)));
    await page.evaluate(name => {
      window.__hold = navigator.locks.request(name, async () => { window.__held = true; await new Promise(resolve => { window.__release = resolve; }); });
    }, lockName);
    await expect.poll(() => page.evaluate(() => window.__held)).toBe(true);
    const replacement = { ...second.fixture, expectedCurrentManifestSha256: first.fixture.manifestSha256 };
    await Promise.all([page, tab].map(target => target.evaluate(f => { window.__save = window.__packageCache.save(f); }, replacement)));
    await expect.poll(async () => page.evaluate(async name => (await navigator.locks.query()).pending.filter(lock => lock.name === name).length, lockName)).toBe(2);
    await page.evaluate(() => window.__release());
    result.steps.concurrentRetry = await Promise.all([page, tab].map(target => target.evaluate(() => window.__save)));
    expect(result.steps.concurrentRetry).toHaveLength(2);
    for (const outcome of result.steps.concurrentRetry) expect(outcome).toMatchObject({ ok: true, previousManifestSha256: first.fixture.manifestSha256, manifestSha256: second.fixture.manifestSha256, activationAllowed: false });
    result.steps.newAfterRetry = await readProof(tab, second.fixture); expectRead(result.steps.newAfterRetry, second.fixture);

    await context.close(); context = undefined;
    await launch(); const reopened = await openPage();
    await context.setOffline(true);
    const requestsBeforeReads = requests.length;
    result.steps.currentAfterBrowserRestartOffline = await readProof(reopened, second.fixture);
    result.steps.previousAfterBrowserRestartOffline = await readProof(reopened, first.fixture);
    expectRead(result.steps.currentAfterBrowserRestartOffline, second.fixture);
    expectRead(result.steps.previousAfterBrowserRestartOffline, first.fixture);
    expect(requests.length).toBe(requestsBeforeReads);
    result.offlineReadNetworkRequests = requests.length - requestsBeforeReads;
    result.browserRestarted = true; result.offlineLocales = ["ru", "en"];
    result.steps.corruptionDenied = await reopened.evaluate(async fixture => {
      const name = (await caches.keys()).find(name => name.endsWith("-" + fixture.manifestSha256));
      const cache = await caches.open(name), url = location.origin + "/__literary_content_qa__/files/en/catalog.json";
      const response = await cache.match(url), bytes = new Uint8Array(await response.arrayBuffer());
      bytes[bytes.length - 2] ^= 1;
      await cache.put(url, new Response(bytes, { headers: { "Content-Type": "application/json" } }));
      return window.__packageCache.read({ expected: fixture.expected, manifestSha256: fixture.manifestSha256 });
    }, second.fixture);
    expect(result.steps.corruptionDenied).toMatchObject({ ok: false, activationAllowed: false });
    result.steps.previousAfterCorruption = await readProof(reopened, first.fixture); expectRead(result.steps.previousAfterCorruption, first.fixture);
    expect(errors).toEqual([]);
    result.pageErrors = errors; result.pass = true; result.stageAccepted = false; result.releaseReady = false;
  } finally {
    await testInfo.attach("content-package-cache-proof", { body: JSON.stringify(result, null, 2) + "\n", contentType: "application/json" });
    await context?.close();
    await new Promise(resolve => server.close(resolve));
  }
});
