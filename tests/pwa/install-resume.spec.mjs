import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { chromium, expect, test } from "@playwright/test";

// Real browser CacheStorage and service-worker registration/re-registration.
// Tiny transport fixtures exercise the bundled production worker; these are
// not application screenshots, paid access grants or a release candidate.
test("re-registration resumes verified files after interrupted first installation", async ({}, testInfo) => {
  const buildId = "c".repeat(64);
  const cacheName = "literary-planet-pwa-v1-" + buildId;
  const markerPath = "/planet/__pwa_complete__";
  const bodies = new Map([
    ["/planet/assets/app.js", 'export const fixture = "install-resume";'],
    ["/planet/en/", '<!doctype html><html lang="en"><meta charset="utf-8"><body>English offline fixture</body></html>'],
    ["/planet/ru/", '<!doctype html><html lang="ru"><meta charset="utf-8"><body>Русский офлайн-набор</body></html>'],
    ["/planet/textures/fixture.webp", "immutable local transport fixture"],
  ]);
  const digest = value => createHash("sha256").update(value).digest("hex");
  const config = {
    schemaVersion: 1, scopePath: "/planet/", buildId,
    entrypoints: { ru: "/planet/ru/", en: "/planet/en/" },
    files: [...bodies].map(([url, body]) => ({ url, bytes: Buffer.byteLength(body), sha256: digest(body), kind: url.endsWith("/") ? "shell" : "asset" })),
  };
  const bundled = await build({
    stdin: { resolveDir: fileURLToPath(new URL("../../", import.meta.url)), contents:
      'import {installPwaWorker} from "./src/pwa/serviceWorkerRuntime.js"; installPwaWorker(self, ' + JSON.stringify(config) + ');' },
    bundle: true, write: false, format: "iife", platform: "browser", target: "es2020", logLevel: "silent",
  });
  const workerBytes = bundled.outputFiles[0].contents;
  const counts = new Map();
  let interrupt = true;
  const server = createServer((request, response) => {
    const pathname = new URL(request.url, "http://127.0.0.1").pathname;
    const headers = { "Cache-Control": "no-cache" };
    if (pathname === "/planet/sw.js") {
      response.writeHead(200, { ...headers, "Content-Type": "text/javascript; charset=utf-8", "Service-Worker-Allowed": "/planet/" });
      response.end(workerBytes); return;
    }
    if (pathname === "/planet/harness") {
      response.writeHead(200, { ...headers, "Content-Type": "text/html; charset=utf-8" });
      response.end('<!doctype html><html><meta charset="utf-8"><body>Service worker transport test</body></html>'); return;
    }
    if (!bodies.has(pathname)) { response.writeHead(404); response.end(); return; }
    counts.set(pathname, (counts.get(pathname) ?? 0) + 1);
    if (interrupt && pathname.endsWith("fixture.webp")) { response.writeHead(503); response.end(); return; }
    const mime = pathname.endsWith("/") ? "text/html; charset=utf-8" : pathname.endsWith(".js") ? "text/javascript; charset=utf-8" : "application/octet-stream";
    response.writeHead(200, { ...headers, "Content-Type": mime }); response.end(bodies.get(pathname));
  });
  let browser, context;
  try {
    await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
    const origin = "http://127.0.0.1:" + server.address().port;
    browser = await chromium.launch({ channel: "chrome", headless: true });
    context = await browser.newContext({ serviceWorkers: "allow" });
    let page = await context.newPage();
    await page.goto(origin + "/planet/harness");
    async function register() {
      return page.evaluate(async () => {
        const registration = await navigator.serviceWorker.register("/planet/sw.js", { scope: "/planet/", updateViaCache: "none" });
        const worker = registration.installing ?? registration.waiting ?? registration.active;
        if (!worker) throw new Error("No registered worker");
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => { cleanup(); reject(new Error("Worker lifecycle timed out")); }, 15000);
          const cleanup = () => { clearTimeout(timer); worker.removeEventListener("statechange", check); };
          const check = () => {
            if (["redundant", "activated"].includes(worker.state)) { cleanup(); resolve(worker.state); }
          };
          worker.addEventListener("statechange", check); check();
        });
      });
    }
    expect(await register()).toBe("redundant");
    const partial = await page.evaluate(async ({ cacheName, markerPath }) => {
      const cache = await caches.open(cacheName);
      const paths = (await cache.keys()).map(request => new URL(request.url).pathname).sort();
      const complete = !!await cache.match(markerPath);
      const registered = await navigator.serviceWorker.getRegistration("/planet/");
      // Deliberate corruption must be detected before any partial file is reused.
      const english = await cache.match("/planet/en/");
      const original = await english.text(), corrupt = original.replace("English", "Altered");
      if (corrupt === original || new TextEncoder().encode(corrupt).length !== new TextEncoder().encode(original).length) throw new Error("Expected same-byte-length corruption");
      await cache.put("/planet/en/", new Response(corrupt, { headers: english.headers }));
      return { paths, complete, active: !!registered?.active, controlled: !!navigator.serviceWorker.controller };
    }, { cacheName, markerPath });
    expect(partial).toMatchObject({ complete: false, active: false, controlled: false });
    expect(partial.paths.filter(path => !path.includes("__pwa_"))).toEqual([
      "/planet/assets/app.js", "/planet/en/", "/planet/ru/",
    ]);
    const initialCounts = Object.fromEntries(counts);
    expect(Object.values(initialCounts)).toEqual([1, 1, 1, 1]);
    await page.close();
    page = await context.newPage();
    await page.goto(origin + "/planet/harness");
    interrupt = false;
    expect(await register()).toBe("activated");
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    const final = await page.evaluate(async ({ cacheName, markerPath, files }) => {
      const cache = await caches.open(cacheName), marker = await (await cache.match(markerPath)).json();
      const verified = [];
      for (const file of files) {
        const response = await cache.match(file.url);
        const bytes = await response.arrayBuffer();
        const sha256 = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(value => value.toString(16).padStart(2, "0")).join("");
        verified.push({ url: file.url, bytes: bytes.byteLength, sha256 });
      }
      return { state: marker.state, activationSequence: marker.activationSequence, buildId: marker.manifest.buildId,
        paths: (await cache.keys()).map(request => new URL(request.url).pathname).sort(), verified };
    }, { cacheName, markerPath, files: config.files });
    expect(final).toMatchObject({ state: "COMPLETE", activationSequence: 1, buildId });
    expect(final.paths).toEqual([...bodies.keys(), markerPath].sort());
    expect(final.verified).toEqual(config.files.map(({ kind, ...file }) => file));
    expect(Object.fromEntries(counts)).toEqual({
      "/planet/assets/app.js": 1, "/planet/en/": 2, "/planet/ru/": 1, "/planet/textures/fixture.webp": 2,
    });
    await context.setOffline(true);
    await page.goto(origin + "/planet/ru/");
    await expect(page.locator("body")).toHaveText("Русский офлайн-набор");
    expect(await page.evaluate(() => document.characterSet)).toBe("UTF-8");
    await page.goto(origin + "/planet/en/");
    await expect(page.locator("body")).toHaveText("English offline fixture");
    await testInfo.attach("install-resume-proof", { contentType: "application/json", body: Buffer.from(JSON.stringify({
      schemaVersion: 1, browser: browser.version(), sourceWorkerBundleSha256: digest(workerBytes),
      initialCounts, finalCounts: Object.fromEntries(counts), partial, final, offlineLocales: ["ru", "en"],
      scope: "Actual Chrome SW lifecycle with bundled current runtime and small transport fixtures; not a full application artifact or native/store acceptance.",
    }, null, 2)) });
  } finally {
    await context?.close(); await browser?.close();
    await new Promise((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); server.closeAllConnections(); });
  }
});
