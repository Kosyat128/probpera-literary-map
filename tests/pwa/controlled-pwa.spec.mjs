import { readFile } from "node:fs/promises";
import { chromium, expect, test } from "@playwright/test";

const qaControlPath = process.env.PWA_QA_CONTROL_PATH ?? ".tmp/pwa-qa/server.json";
const qaOrigin = process.env.PWA_QA_ORIGIN ?? "http://127.0.0.1:4293";
if (!/^\.tmp\/pwa-qa\/[A-Za-z0-9._-]+\.json$/u.test(qaControlPath)
  || !/^http:\/\/127\.0\.0\.1:\d{1,5}$/u.test(qaOrigin)) throw new Error("Invalid local PWA QA configuration");

async function control(request, body) {
  const configuration = JSON.parse(await readFile(qaControlPath, "utf8"));
  if (configuration.localQaOnly !== true || configuration.origin !== qaOrigin) throw new Error("PWA QA control origin mismatch");
  const response = await request.post(configuration.origin + "/__pwa_qa__/control", {
    headers: { Authorization: "Bearer " + configuration.controlToken },
    data: body,
  });
  expect(response.status()).toBe(200);
  return response.json();
}
test.beforeEach(async ({ request }) => { await control(request, { action: "reset" }); });

async function openAuthorized(page, locale = "ru") {
  await page.goto("/planet/" + locale + "/?country=russia#atlas");
  await expect(page.locator("[data-pwa-authorized]")).toBeVisible({ timeout: 45_000 });
  await expect(page.locator('[data-atlas-experience]')).toHaveAttribute("data-atlas-view", "immersive");
  await expect(page.locator(".magazine-hero, .site-header")).toHaveCount(0);
  await expect(page.locator("#atlas .literary-globe")).toHaveAttribute("data-globe-webgl-context", "ready", { timeout: 45_000 });
  await expect(page.locator(".native-planet-launch")).toBeHidden();
  await expect(page.locator("#atlas canvas")).toHaveCount(1);
  await expect(page.locator("canvas")).toHaveCount(1);
}
async function installed(page) {
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? ""), { timeout: 60_000 })
    .toBe(qaOrigin + "/planet/sw.js");
  const result = await page.evaluate(async () => {
    const names = (await caches.keys()).filter(name => name.startsWith("literary-planet-pwa-v1-"));
    for (const name of names) {
      const marker = await (await caches.open(name)).match("/planet/__pwa_complete__");
      if (marker) { const data = await marker.json(); if (data.activationSequence > 0) return data; }
    }
    return null;
  });
  expect(result?.state).toBe("COMPLETE");
  return result;
}
// Only globe-root actions enter the real Menu; Collection/access controls stay direct.
async function applicationMenu(page) {
  const chrome = page.locator(".atlas-application-chrome");
  const toggle = chrome.locator('[data-atlas-action="toggle-menu"]');
  const panel = chrome.locator("[data-atlas-application-menu-panel]");
  await expect(toggle).toBeVisible();
  if (await toggle.getAttribute("aria-expanded") !== "true") await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(panel).toBeVisible();
  return panel;
}

async function openApplicationCollection(page) {
  const menu = await applicationMenu(page);
  await menu.locator('[data-atlas-action="open-collection"]').click();
  await expect(menu).toBeHidden();
  await expect(page.locator('.atlas-application-chrome [data-atlas-action="toggle-menu"]')).toHaveAttribute("aria-expanded", "false");
}

async function selectApplicationLocale(page, locale) {
  const menu = await applicationMenu(page);
  await menu.locator('[data-interface-language="' + locale + '"]').click();
  await expect(menu).toBeHidden();
  await expect(page.locator('.atlas-application-chrome [data-atlas-action="toggle-menu"]')).toHaveAttribute("aria-expanded", "false");
}

async function selectLocale(page, locale) {
  await selectApplicationLocale(page, locale);
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
  await expect.poll(() => new URL(page.url()).pathname).toBe("/planet/" + locale + "/");
}

async function captureNoticeNodes(page) {
  // An explicit update creates a new document. Authorization and a rollback
  // notice may render before its asynchronously loaded real globe is ready.
  await expect(page.locator("#atlas .literary-globe")).toHaveAttribute("data-globe-webgl-context", "ready", { timeout: 45_000 });
  await expect(page.locator(".native-planet-launch")).toBeHidden();
  await expect.poll(() => page.evaluate(() => {
    const atlas = document.querySelector("#atlas");
    const scene = typeof window.__literaryPlanetQaScenes === "function"
      ? window.__literaryPlanetQaScenes().find(item => atlas?.contains(item.canvas)) : null;
    return Boolean(scene?.canvas?.isConnected && scene.renderer && scene.camera && scene.scene);
  }), { timeout: 45_000 }).toBe(true);
  const nodes = await page.evaluateHandle(() => ({
    host: document.querySelector(".product-notice-host"),
    notices: document.querySelector(".pwa-notices"),
    connectivity: document.querySelector(".connectivity-status"),
    scene: window.__literaryPlanetQaScenes().find(item => document.querySelector("#atlas").contains(item.canvas)),
  }));
  expect(await nodes.evaluate(value => Boolean(value.host && value.notices && value.connectivity && value.scene?.canvas && value.scene.renderer && value.scene.camera && value.scene.scene))).toBe(true);
  return nodes;
}

async function retainedNoticeNodes(page, nodes, placement) {
  await expect(page.locator(".product-notice-host")).toHaveCount(1);
  await expect(page.locator('[data-product-notice-placement="' + placement + '"] > .product-notice-host')).toHaveCount(1);
  expect(await nodes.evaluate(previous => previous.host.isConnected
    && previous.host === document.querySelector(".product-notice-host")
    && previous.notices === document.querySelector(".pwa-notices")
    && previous.connectivity === document.querySelector(".connectivity-status"))).toBe(true);
  await expect(page.locator("canvas")).toHaveCount(1);
  expect(await nodes.evaluate(previous => {
    const current = window.__literaryPlanetQaScenes().find(item => item.canvas === previous.scene.canvas);
    return previous.scene.canvas.isConnected && current?.renderer === previous.scene.renderer
      && current?.camera === previous.scene.camera && current?.scene === previous.scene.scene;
  })).toBe(true);
}

async function hitTarget(locator) {
  await expect.poll(() => locator.evaluate(element => {
    const rect = element.getBoundingClientRect();
    const target = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
    return target === element || element.contains(target);
  })).toBe(true);
}

async function noticeEvidence(page, testInfo, isMobile) {
  const viewport = page.viewportSize();
  const country = isMobile ? page.locator(".atlas-country-sheet-toggle") : page.locator('.atlas-country-presentation[data-atlas-country="russia"]');
  await expect(country).toBeVisible();
  await expect.poll(async () => {
    const notice = await page.locator(".product-notice-host").boundingBox(), target = await country.boundingBox();
    return Boolean(notice && target && (target.x + target.width <= notice.x || notice.x + notice.width <= target.x
      || target.y + target.height <= notice.y || notice.y + notice.height <= target.y));
  }).toBe(true);
  if (isMobile) await hitTarget(country);
  const bounds = await page.locator(".product-notice-host").boundingBox();
  const countryBounds = await country.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(viewport.height);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await testInfo.attach("pwa-offline-notice-bounds", { body: JSON.stringify({ viewport, bounds, countryBounds, noCountryOverlap: true, mobileDisclosureHitTarget: isMobile, locale: "en", offline: true, localQaOnly: true }), contentType: "application/json" });
  await page.screenshot({ path: testInfo.outputPath("pwa-offline-en-notices.png"), fullPage: false });
}

test("real signed access, locale and connectivity preserve the actual R3F scene", async ({ page, context, isMobile }, testInfo) => {
  const externalRequests = [];
  page.on("request", request => { if (!request.url().startsWith(qaOrigin + "/") && /^https?:/u.test(request.url())) externalRequests.push(request.url()); });
  await openAuthorized(page);
  const marker = await installed(page);
  await expect.poll(() => page.evaluate(() => typeof window.__literaryPlanetQaScenes)).toBe("function");
  const scene = await page.evaluateHandle(() => window.__literaryPlanetQaScenes().find(item => document.querySelector("#atlas").contains(item.canvas)));
  expect(await scene.evaluate(value => Boolean(value?.canvas && value.renderer && value.camera && value.scene))).toBe(true);
  const stable = async () => {
    await expect(page.locator("canvas")).toHaveCount(1);
    expect(await scene.evaluate(original => {
      const current = window.__literaryPlanetQaScenes().find(item => item.canvas === original.canvas);
      return original.canvas.isConnected && current?.renderer === original.renderer && current?.camera === original.camera && current?.scene === original.scene;
    })).toBe(true);
    await expect(page.locator('.atlas-country-presentation[data-atlas-country="russia"]')).toBeVisible();
    expect(new URL(page.url()).searchParams.get("country")).toBe("russia");
  };
  await openApplicationCollection(page);
  const collection = page.locator(".native-planet-panel");
  await expect(collection).toBeVisible();
  await expect(collection).toHaveAttribute("role", "dialog");
  const help = collection.locator(".pwa-help");
  await expect(help).toBeVisible();
  await help.locator(":scope > details > summary").click();
  await expect(help.getByRole("heading", { name: "Чтение без сети", exact: true })).toBeVisible();
  await collection.getByRole("button", { name: "Вернуться к планете", exact: true }).click();
  await expect(collection).toBeHidden();
  await stable();
  await selectLocale(page, "en");
  await stable();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://probpera.ru/planet/en/");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/planet/en/manifest.webmanifest");
  await context.setOffline(true);
  await expect(page.locator(".connectivity-status")).toContainText("offline");
  await stable();
  await noticeEvidence(page, testInfo, isMobile);
  await selectLocale(page, "ru");
  await stable();
  await context.setOffline(false);
  await expect(page.locator("[data-pwa-authorized]")).toBeVisible();
  await stable();
  expect(externalRequests).toEqual([]);
  await testInfo.attach("scene-identity-evidence", { body: JSON.stringify({ buildId: marker.manifest.buildId, canonicalCanvas: true, sameRenderer: true, sameCamera: true, sameScene: true, languages: ["ru", "en"], offlineReconnect: true, localQaOnly: true }), contentType: "application/json" });
  await page.screenshot({ path: testInfo.outputPath("ru-actual-pwa.png"), fullPage: false });
  await selectLocale(page, "en");
  await page.screenshot({ path: testInfo.outputPath("en-actual-pwa.png"), fullPage: false });
  await scene.dispose();
});

test("cold offline RU and EN launch preserve country and load first-use search", async ({ page, context }) => {
  await openAuthorized(page);
  await installed(page);
  await context.setOffline(true);
  try {
    for (const locale of ["en", "ru"]) {
      await page.goto("/planet/" + locale + "/?country=russia#atlas");
      await expect(page.locator("[data-pwa-authorized]")).toBeVisible();
      await expect(page.locator("#atlas .literary-globe")).toHaveAttribute("data-globe-webgl-context", "ready", { timeout: 45_000 });
      await expect(page.locator(".native-planet-launch")).toBeHidden();
      await expect(page.locator('[data-atlas-experience]')).toHaveAttribute("data-atlas-view", "immersive");
      await expect(page.locator(".magazine-hero, .site-header")).toHaveCount(0);
      await expect(page.locator("canvas")).toHaveCount(1);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.locator('.atlas-country-presentation[data-atlas-country="russia"]')).toBeVisible();
      await page.locator('[data-atlas-action="toggle-search"]').click();
      const search = page.locator("#country-search");
      await expect(search).toBeVisible();
      await search.fill("Dostoevsky");
      await expect(page.locator('#country-results [role="option"]').filter({ hasText: /Достоевск|Dostoevsk/iu }).first()).toBeVisible({ timeout: 30_000 });
      await page.keyboard.press("Escape");
    }
  } finally { await context.setOffline(false); }
});

test("expanded portrait base installs and verifies real offline bytes with saved graphics and bilingual scene", async ({ page, context }, testInfo) => {
  const errors = [], assetFailures = [], checks = [], portraits = [], coldLaunches = [];
  page.on("pageerror", error => errors.push(error.message));
  const isAsset = url => url.startsWith(qaOrigin + "/planet/assets/");
  page.on("response", response => { if (isAsset(response.url()) && response.status() >= 400) assetFailures.push({ url: response.url(), status: response.status() }); });
  page.on("requestfailed", request => { if (isAsset(request.url())) assetFailures.push({ url: request.url(), failure: request.failure()?.errorText }); });
  await page.addInitScript(() => {
    window.__portraitReadinessReplies = [];
    navigator.serviceWorker.addEventListener("message", event => {
      if (event.source === navigator.serviceWorker.controller && event.data?.type === "PLANET_OFFLINE_READINESS_RESULT") {
        const { status, engineBuildId, activeBuildId, fileCount, bytes, reason } = event.data;
        window.__portraitReadinessReplies.push({ status, engineBuildId, activeBuildId, fileCount, bytes, reason });
      }
    });
  });
  const selection = JSON.parse(await readFile("scripts/mobile/native-base-assets.json", "utf8"));
  const selectedPortraits = selection.files.filter(file => file.output.startsWith("assets/writer-portraits/"));
  await openAuthorized(page);
  const marker = await installed(page);
  expect(marker.manifest.files.length).toBeGreaterThan(512);
  expect(marker.manifest.files.length).toBeLessThanOrEqual(2048);
  const expectedBytes = marker.manifest.files.reduce((total, file) => total + file.bytes, 0);
  expect(expectedBytes).toBeLessThanOrEqual(64 * 1024 * 1024);
  const manifestPortraits = marker.manifest.files.filter(file => file.url.startsWith("/planet/assets/writer-portraits/"));
  expect(manifestPortraits.length).toBe(selectedPortraits.length);
  for (const portrait of selectedPortraits) expect(manifestPortraits.find(file => file.url === "/planet/" + portrait.output)?.sha256).toBe(portrait.sourceSha256);
  const capture = async () => {
    await expect.poll(() => page.evaluate(() => typeof window.__literaryPlanetQaScenes)).toBe("function");
    const scene = await page.evaluateHandle(() => window.__literaryPlanetQaScenes().find(item => document.querySelector("#atlas").contains(item.canvas)));
    expect(await scene.evaluate(value => Boolean(value?.canvas && value.renderer && value.camera && value.scene))).toBe(true);
    return scene;
  };
  const stable = async scene => {
    await expect(page.locator("canvas")).toHaveCount(1);
    expect(await scene.evaluate(previous => {
      const now = window.__literaryPlanetQaScenes().find(item => item.canvas === previous.canvas);
      return previous.canvas.isConnected && now?.renderer === previous.renderer && now?.camera === previous.camera && now?.scene === previous.scene;
    })).toBe(true);
    expect(new URL(page.url()).searchParams.get("country")).toBe("russia");
    await expect(page.locator("#atlas .literary-globe")).toHaveAttribute("data-globe-quality-tier", "balanced");
    await expect.poll(() => scene.evaluate(value => ({ dpr: value.renderer.getPixelRatio(), stars: (() => {
      const counts = []; value.scene.traverse(object => { if (object.isPoints && object.geometry?.attributes.position) counts.push(object.geometry.attributes.position.count); }); return counts;
    })() }))).toEqual({ dpr: 1.25, stars: [1600] });
  };
  const collection = page.locator(".native-planet-panel");
  const openCollection = async () => { await openApplicationCollection(page); await expect(collection).toBeVisible(); };
  const closeCollection = async locale => { await collection.getByRole("button", { name: locale === "ru" ? "Вернуться к планете" : "Return to the planet", exact: true }).click(); await expect(collection).toBeHidden(); };
  let scene = await capture();
  const worker = context.serviceWorkers().find(item => item.url() === qaOrigin + "/planet/sw.js");
  expect(worker).toBeTruthy();
  await worker.evaluate(() => {
    const original = globalThis.fetch;
    globalThis.__portraitFetchObservation = { original, armed: false, attempts: 0 };
    globalThis.fetch = function (...args) {
      if (globalThis.__portraitFetchObservation.armed) globalThis.__portraitFetchObservation.attempts++;
      return Reflect.apply(original, this, args);
    };
  });
  try {
    await openCollection();
    const graphics = collection.locator("[data-planet-graphics-settings]");
    await graphics.locator("summary").click();
    await graphics.locator('[data-planet-quality-option="balanced"]').check();
    await expect(graphics.locator("[data-planet-quality-save-state]")).toHaveAttribute("data-planet-quality-save-state", "idle");
    await stable(scene);
    const help = collection.locator(".pwa-help");
    await help.locator(":scope > details > summary").click();
    await worker.evaluate(() => { globalThis.__portraitFetchObservation.armed = true; });
    const checkStarted = Date.now();
    await help.getByRole("button", { name: "Проверить офлайн-файлы", exact: true }).click();
    await expect(help.locator("[data-pwa-offline-readiness]")).toHaveAttribute("data-pwa-offline-readiness", "complete", { timeout: 35_000 });
    const reply = await page.evaluate(() => window.__portraitReadinessReplies.at(-1));
    expect(reply).toMatchObject({ status: "complete", engineBuildId: marker.manifest.buildId, activeBuildId: marker.manifest.buildId,
      fileCount: marker.manifest.files.length, bytes: expectedBytes });
    const networkAttempts = await worker.evaluate(() => { globalThis.__portraitFetchObservation.armed = false; return globalThis.__portraitFetchObservation.attempts; });
    expect(networkAttempts).toBe(0);
    checks.push({ ...reply, durationMs: Date.now() - checkStarted, networkAttempts });
    await closeCollection("ru");
    await stable(scene);
    await context.setOffline(true);
    await scene.dispose(); scene = null;
    await page.goto("/planet/ru/?country=russia#atlas", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-pwa-authorized]")).toBeVisible();
    await expect(page.locator("#atlas .literary-globe")).toHaveAttribute("data-globe-webgl-context", "ready", { timeout: 45_000 });
    await expect(page.locator(".native-planet-launch")).toHaveCount(0);
    await expect(page.locator("[data-pwa-access-verification]")).toHaveAttribute("data-pwa-access-verification", "saved");
    scene = await capture();
    await stable(scene);
    const firstPortrait = page.locator('.writer-list img[src$="/assets/writer-portraits/q45087.webp"]');
    await firstPortrait.scrollIntoViewIfNeeded();
    await expect.poll(() => firstPortrait.evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
    portraits.push(await firstPortrait.evaluate(image => ({ locale: document.documentElement.lang, src: image.currentSrc, width: image.naturalWidth, height: image.naturalHeight })));
    await page.screenshot({ path: testInfo.outputPath("expanded-offline-russian-writer-list.png"), fullPage: false });
    await page.locator(".writer-list .writer-row").filter({ hasText: /Достоевск|Dostoevsk/iu }).click();
    await expect(page.locator(".writer-detail h4")).toContainText(/Достоевск|Dostoevsk/iu);
    expect(new URL(page.url()).searchParams.get("writer")).toBe("dostoevsky");
    const writerPortrait = page.locator(".writer-detail-portrait img");
    await writerPortrait.scrollIntoViewIfNeeded();
    await expect.poll(() => writerPortrait.evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
    await selectLocale(page, "en");
    await stable(scene);
    expect(new URL(page.url()).searchParams.get("writer")).toBe("dostoevsky");
    await expect(page.locator(".writer-detail h4")).toContainText("Dostoevsky");
    await writerPortrait.scrollIntoViewIfNeeded();
    await expect.poll(() => writerPortrait.evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
    portraits.push(await writerPortrait.evaluate(image => ({ locale: document.documentElement.lang, src: image.currentSrc, width: image.naturalWidth, height: image.naturalHeight })));
    await page.screenshot({ path: testInfo.outputPath("expanded-offline-english-writer.png"), fullPage: false });
    coldLaunches.push({ locale: "ru", followedBy: "en", sameCanvasRendererCameraScene: true, selectedWriter: "dostoevsky", savedQuality: "balanced" });
    await scene.dispose(); scene = null;
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("#atlas .literary-globe")).toHaveAttribute("data-globe-webgl-context", "ready", { timeout: 45_000 });
    await expect(page.locator(".native-planet-launch")).toHaveCount(0);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("[data-pwa-access-verification]")).toHaveAttribute("data-pwa-access-verification", "saved");
    scene = await capture(); await stable(scene);
    expect(new URL(page.url()).searchParams.get("writer")).toBe("dostoevsky");
    await expect(page.locator(".writer-detail h4")).toContainText("Dostoevsky");
    coldLaunches.push({ locale: "en", selectedWriter: "dostoevsky", savedQuality: "balanced", newDocument: true });
    expect(errors).toEqual([]); expect(assetFailures).toEqual([]);
  } finally {
    await worker.evaluate(() => { if (globalThis.__portraitFetchObservation) { globalThis.fetch = globalThis.__portraitFetchObservation.original; delete globalThis.__portraitFetchObservation; } }).catch(() => undefined);
    await scene?.dispose();
    await context.setOffline(false);
    await testInfo.attach("expanded-portrait-offline-evidence", { body: JSON.stringify({ localQaOnly: true, buildId: marker.manifest.buildId,
      manifestFiles: marker.manifest.files.length, manifestBytes: expectedBytes, manifestPortraits: manifestPortraits.length,
      checks, portraits, coldLaunches, errors, assetFailures, actualServiceWorker: true, cacheMutationByTest: false,
      actualOsInstallation: false, releaseReady: false }, null, 2), contentType: "application/json" });
  }
});

test("device preparation restores real offline bytes and keeps simulated browser decisions truthful", async ({ page, context }, testInfo) => {
  const desktopCompact = testInfo.project.name === "pwa-desktop";
  // Only installation/persistence decisions are simulated. The signed access,
  // app, globe, service worker, manifest, cached bytes and hash checks are real.
  // These disposable browser fixtures never invoke an OS installation prompt.
  await page.addInitScript(() => {
    const qa = window.__pwaDeviceQa = { prompts: [], persistence: [], readiness: [], resolveChoice: null };
    window.addEventListener("beforeinstallprompt", event => {
      if (event.isTrusted) { event.preventDefault(); event.stopImmediatePropagation(); }
    }, true);
    Object.defineProperties(navigator.storage, {
      persisted: { configurable: true, value: async () => false },
      persist: { configurable: true, value: () => {
        qa.persistence.push({ userActivation: navigator.userActivation.isActive });
        return Promise.resolve(false);
      } },
    });
    qa.offerPrompt = () => {
      const event = new Event("beforeinstallprompt", { cancelable: true });
      const userChoice = new Promise(resolve => { qa.resolveChoice = resolve; });
      Object.defineProperties(event, {
        userChoice: { value: userChoice },
        prompt: { value: () => {
          qa.prompts.push({ userActivation: navigator.userActivation.isActive });
          return Promise.resolve();
        } },
      });
      window.dispatchEvent(event);
    };
    navigator.serviceWorker.addEventListener("message", event => {
      const data = event.data;
      if (event.source !== navigator.serviceWorker.controller) return;
      if (data?.type === "PLANET_OFFLINE_REPAIR_RESULT") {
        (qa.repairs ??= []).push({ status: data.status, engineBuildId: data.engineBuildId, activeBuildId: data.activeBuildId,
          ...(data.status === "complete" ? { fileCount: data.fileCount, bytes: data.bytes, repairedFiles: data.repairedFiles, repairedBytes: data.repairedBytes } : { reason: data.reason }) });
        return;
      }
      if (data?.type !== "PLANET_OFFLINE_READINESS_RESULT") return;
      qa.readiness.push({ status: data.status, engineBuildId: data.engineBuildId, activeBuildId: data.activeBuildId,
        ...(data.status === "complete" ? { fileCount: data.fileCount, bytes: data.bytes } : {}) });
    });
  });
  if (desktopCompact) await page.setViewportSize({ width: 1280, height: page.viewportSize().height });
  await openAuthorized(page);
  const marker = await installed(page);
  const target = marker.manifest.files.find(file => file.kind === "shell" && file.url === marker.manifest.entrypoints.en);
  expect(target).toBeTruthy();
  const cacheName = "literary-planet-pwa-v1-" + marker.manifest.buildId;
  await expect.poll(() => page.evaluate(() => typeof window.__literaryPlanetQaScenes)).toBe("function");
  const scene = await page.evaluateHandle(() => window.__literaryPlanetQaScenes().find(item => document.querySelector("#atlas").contains(item.canvas)));
  expect(await scene.evaluate(value => Boolean(value?.canvas && value.renderer && value.camera && value.scene))).toBe(true);
  const worker = context.serviceWorkers().find(item => item.url() === qaOrigin + "/planet/sw.js");
  expect(worker).toBeTruthy();
  // Transparent worker fetch observation: count attempts, including failures
  // while offline, and always call the original API with its original receiver.
  await worker.evaluate(() => {
    const original = globalThis.fetch;
    globalThis.__pwaDeviceFetchQa = { original, armed: false, count: 0, urls: [] };
    globalThis.fetch = function (...args) {
      if (globalThis.__pwaDeviceFetchQa.armed) {
        globalThis.__pwaDeviceFetchQa.count++;
        globalThis.__pwaDeviceFetchQa.urls.push(typeof args[0] === "string" ? args[0] : args[0].url);
      }
      return Reflect.apply(original, this, args);
    };
  });
  let backup = null;
  let restored = false;
  const evidence = { localQaOnly: true, buildId: marker.manifest.buildId, ownedCacheEntry: target,
    simulatedApis: ["beforeinstallprompt.prompt/userChoice", "StorageManager.persist/persisted"],
    actualOsInstallation: false, checks: [], repairs: [], screenshots: [], headerBounds: [], actionSpacing: [], themes: [], compactEdition: [], coldOffline: [] };
  const globe = page.locator("#atlas .literary-globe");
  const compactEditionEvidence = async (style, edition) => {
    if (!desktopCompact) return;
    expect(page.viewportSize().width).toBe(1280);
    expect(new URL(page.url()).searchParams.get("country")).toBe("russia");
    await expect(page.locator(".atlas-experience-surface")).toHaveAttribute("data-atlas-panel-state", "open");
    await expect(page.locator('.atlas-country-presentation[data-atlas-country="russia"] .country-panel:not(.panel-loading)')).toBeVisible();
    await expect(globe).toHaveAttribute("data-globe-edition", edition);
    await expect(page.locator(".native-planet-app")).toHaveAttribute("data-planet-edition", edition);
    const select = globe.locator(".globe-edition-compact-select select");
    await expect(select).toBeVisible();
    await expect(select).toHaveValue(edition);
    // Hover has its own intentional raised color. Measure the settled base
    // palette with the real pointer away, without overriding CSS or focus.
    await page.mouse.move(0, 0);
    const readColors = () => select.evaluate(element => {
      const css = getComputedStyle(element);
      const token = name => {
        const hex = css.getPropertyValue(name).trim();
        if (!/^#[a-f0-9]{6}$/i.test(hex)) throw new Error("Expected opaque palette token: " + name);
        return "rgb(" + [1, 3, 5].map(index => Number.parseInt(hex.slice(index, index + 2), 16)).join(", ") + ")";
      };
      const luminance = color => {
        const rgb = color.match(/^rgb\((\d+), (\d+), (\d+)\)$/);
        if (!rgb) throw new Error("Expected an opaque rendered palette color");
        const channels = rgb.slice(1).map(Number).map(value => value / 255)
          .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
        return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
      };
      const text = css.color, background = css.backgroundColor;
      const foregroundLuminance = luminance(text), backgroundLuminance = luminance(background);
      return { value: element.value, text, background, backgroundImage: css.backgroundImage,
        expectedText: token("--planet-on-dark"), expectedBackground: token("--planet-chrome"),
        hovered: element.matches(":hover"), height: element.getBoundingClientRect().height,
        contrastRatio: (Math.max(foregroundLuminance, backgroundLuminance) + .05)
          / (Math.min(foregroundLuminance, backgroundLuminance) + .05),
        options: [...element.options].map(option => ({ value: option.value,
          text: getComputedStyle(option).color, background: getComputedStyle(option).backgroundColor })) };
    });
    await expect.poll(async () => {
      const colors = await readColors();
      return colors.background === colors.expectedBackground && colors.text === colors.expectedText
        && colors.backgroundImage === "none" && !colors.hovered;
    }).toBe(true);
    const colors = await readColors();
    expect(colors.contrastRatio).toBeGreaterThanOrEqual(4.5);
    expect(colors.height).toBeGreaterThanOrEqual(44);
    expect(colors.options.length).toBeGreaterThan(1);
    for (const option of colors.options) {
      expect(option.text).toBe(colors.expectedText);
      expect(option.background).toBe(colors.expectedBackground);
    }
    await hitTarget(select);
    await expect(page.locator("canvas")).toHaveCount(1);
    expect(await scene.evaluate(original => {
      const current = window.__literaryPlanetQaScenes().find(item => item.canvas === original.canvas);
      return original.canvas.isConnected && current?.renderer === original.renderer
        && current?.camera === original.camera && current?.scene === original.scene;
    })).toBe(true);
    evidence.compactEdition.push({ style, edition, viewport: page.viewportSize(), country: "russia",
      countryPanelOpen: true, sameCanvasRendererCameraScene: true, nativeOsPopupCaptured: false, ...colors });
    const filename = "device-compact-edition-" + style + ".png";
    await page.screenshot({ path: testInfo.outputPath(filename), fullPage: false });
    evidence.screenshots.push(filename);
  };
  try {
    await compactEditionEvidence("antique", "rand-mcnally-1887");
    // Offer before opening Help; its later mount must not lose the deferred event.
    await page.evaluate(() => window.__pwaDeviceQa.offerPrompt());
    expect(await page.evaluate(() => window.__pwaDeviceQa.prompts.length)).toBe(0);
    await openApplicationCollection(page);
    const collection = page.locator(".native-planet-panel");
    const header = collection.locator(".native-planet-panel__header");
    const help = collection.locator(".pwa-help");
    await help.locator(":scope > details > summary").click();
    const device = help.locator(".pwa-device");
    await expect(device.getByRole("heading", { name: "Приложение на устройстве", exact: true })).toBeVisible();
    const nodes = await page.evaluateHandle(() => ({ header: document.querySelector(".native-planet-panel__header"),
      help: document.querySelector(".pwa-help details"), device: document.querySelector(".pwa-device") }));
    const readiness = device.locator("[data-pwa-offline-readiness]");
    const helpColors = () => help.evaluate(element => {
      const card = element.querySelector("[data-pwa-offline-readiness]").parentElement;
      const button = card.querySelector("button");
      return { helpBackground: getComputedStyle(element).backgroundColor,
        cardBackground: getComputedStyle(card).backgroundColor, cardText: getComputedStyle(card).color,
        buttonBackground: getComputedStyle(button).backgroundColor, buttonText: getComputedStyle(button).color };
    });
    await expect(globe).toHaveAttribute("data-globe-style", "antique");
    await expect(page.locator(".native-planet-app")).toHaveAttribute("data-planet-edition", "rand-mcnally-1887");
    const antiqueColors = await helpColors();
    evidence.themes.push({ phase: "initial", style: "antique", colors: antiqueColors });
    // Change the actual canonical globe edition through its existing controls.
    // Help stays mounted; the app theme must follow the committed globe style.
    await header.getByRole("button", { name: "Вернуться к планете", exact: true }).click();
    await expect(collection).toBeHidden();
    const editionSelect = globe.locator(".globe-edition-compact-select select");
    if (await editionSelect.isVisible()) {
      await editionSelect.selectOption("nasa-blue-marble");
    } else {
      if (await globe.getAttribute("data-globe-edition-rail") === "hidden") {
        await globe.locator('[data-globe-control="edition-rail-toggle"]').click();
      }
      await globe.locator('[data-globe-edition-option="nasa-blue-marble"]').click();
    }
    await expect(globe).toHaveAttribute("data-globe-edition", "nasa-blue-marble");
    await expect(globe).toHaveAttribute("data-globe-style", "earth");
    await expect(globe).toHaveAttribute("data-globe-edition-transition", "idle");
    await expect(page.locator(".native-planet-app")).toHaveAttribute("data-planet-edition", "nasa-blue-marble");
    await compactEditionEvidence("earth", "nasa-blue-marble");
    await openApplicationCollection(page);
    await expect(device).toBeVisible();
    const earthColors = await helpColors();
    expect(earthColors.helpBackground).not.toBe(antiqueColors.helpBackground);
    expect(earthColors.cardBackground).not.toBe(antiqueColors.cardBackground);
    expect(earthColors.buttonBackground).not.toBe(antiqueColors.buttonBackground);
    evidence.themes.push({ phase: "actual-edition-change", style: "earth", edition: "nasa-blue-marble", colors: earthColors });
    await expect(readiness).toHaveAttribute("data-pwa-offline-readiness", "unchecked");
    expect(await page.evaluate(() => ({ prompts: window.__pwaDeviceQa.prompts.length,
      persistence: window.__pwaDeviceQa.persistence.length, checks: window.__pwaDeviceQa.readiness.length })))
      .toEqual({ prompts: 0, persistence: 0, checks: 0 });
    const stable = async (locale, phase) => {
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      expect(new URL(page.url()).pathname).toBe("/planet/" + locale + "/");
      expect(new URL(page.url()).searchParams.get("country")).toBe("russia");
      await expect(page.locator("canvas")).toHaveCount(1);
      expect(await scene.evaluate(original => {
        const current = window.__literaryPlanetQaScenes().find(item => item.canvas === original.canvas);
        return original.canvas.isConnected && current?.renderer === original.renderer
          && current?.camera === original.camera && current?.scene === original.scene;
      })).toBe(true);
      expect(await nodes.evaluate(original => original.header === document.querySelector(".native-planet-panel__header")
        && original.help === document.querySelector(".pwa-help details") && original.help.open
        && original.device === document.querySelector(".pwa-device"))).toBe(true);
      await expect(globe).toHaveAttribute("data-globe-edition", "nasa-blue-marble");
      await expect(globe).toHaveAttribute("data-globe-style", "earth");
      await expect(page.locator(".native-planet-app")).toHaveAttribute("data-planet-edition", "nasa-blue-marble");
      expect(await helpColors()).toEqual(earthColors);
      const spacing = await readiness.evaluate(element => {
        const card = element.parentElement;
        const check = card.querySelector(":scope > button").getBoundingClientRect();
        const repair = card.querySelector(".pwa-device__actions > button").getBoundingClientRect();
        return { gap: repair.top - check.bottom, checkHeight: check.height, repairHeight: repair.height };
      });
      expect(spacing.gap).toBeGreaterThanOrEqual(8);
      expect(spacing.checkHeight).toBeGreaterThanOrEqual(44);
      expect(spacing.repairHeight).toBeGreaterThanOrEqual(44);
      evidence.actionSpacing.push({ phase, locale, ...spacing });
      evidence.themes.push({ phase, locale, style: "earth", colors: earthColors });
      await expect(header).toBeInViewport({ ratio: 1 });
      await hitTarget(header.getByRole("button", { name: locale === "ru" ? "Вернуться к планете" : "Return to the planet", exact: true }));
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      evidence.headerBounds.push({ phase, locale, viewport: page.viewportSize(), bounds: await header.boundingBox() });
    };
    const locale = async value => {
      await header.locator('[data-interface-language="' + value + '"]').click();
      await expect(page.locator("html")).toHaveAttribute("lang", value);
    };
    const screenshot = async name => {
      await page.screenshot({ path: testInfo.outputPath(name + ".png"), fullPage: false });
      evidence.screenshots.push(name + ".png");
    };
    const check = async (language, expected) => {
      const before = await page.evaluate(() => window.__pwaDeviceQa.readiness.length);
      await worker.evaluate(() => { globalThis.__pwaDeviceFetchQa.count = 0; globalThis.__pwaDeviceFetchQa.armed = true; });
      let networkAttempts;
      try {
        await device.getByRole("button", { name: language === "ru" ? "Проверить офлайн-файлы" : "Check offline files", exact: true }).click();
        await expect(readiness).toHaveAttribute("data-pwa-offline-readiness", expected, { timeout: 35_000 });
        await expect.poll(() => page.evaluate(() => window.__pwaDeviceQa.readiness.length)).toBe(before + 1);
      } finally {
        networkAttempts = await worker.evaluate(() => {
          globalThis.__pwaDeviceFetchQa.armed = false;
          return globalThis.__pwaDeviceFetchQa.count;
        });
      }
      const reply = await page.evaluate(() => window.__pwaDeviceQa.readiness.at(-1));
      evidence.checks.push({ locale: language, networkAttempts, ...reply });
      expect(networkAttempts).toBe(0);
      expect(reply).toMatchObject({ status: expected, engineBuildId: marker.manifest.buildId, activeBuildId: marker.manifest.buildId });
      if (expected === "complete") expect(reply).toMatchObject({ fileCount: marker.manifest.files.length,
        bytes: marker.manifest.files.reduce((sum, file) => sum + file.bytes, 0) });
      await stable(language, expected);
    };
    await check("ru", "complete");
    await expect(readiness).toHaveText("Все базовые файлы прошли проверку на этом устройстве.");
    await screenshot("device-ru-complete");
    await device.getByRole("button", { name: "Установить приложение", exact: true }).click();
    await expect(device.getByRole("status").filter({ hasText: "Завершите выбор в окне браузера." })).toBeVisible();
    await locale("en");
    await expect(device.getByRole("status").filter({ hasText: "Complete your choice in the browser dialog." })).toBeVisible();
    await page.evaluate(() => window.__pwaDeviceQa.resolveChoice({ outcome: "accepted", platform: "qa-simulated" }));
    await expect(device.getByRole("status").filter({ hasText: "Request accepted. Wait for the browser to finish installing the app." })).toBeVisible();
    await expect(device.getByRole("button", { name: "Install app", exact: true })).toHaveCount(0);
    await expect(device.getByText("The browser reported an installation. The shortcut will appear when it finishes.", { exact: true })).toHaveCount(0);
    await expect(device.getByText("The planet is open in its own app window.", { exact: true })).toHaveCount(0);
    await stable("en", "simulated-install-accepted");
    await screenshot("device-en-simulated-install-accepted");
    await context.setOffline(true);
    backup = await page.evaluateHandle(async ({ cacheName, target }) => {
      if (!await caches.has(cacheName)) throw new Error("The exact QA build cache is absent");
      const response = await caches.match(target.url, { cacheName });
      if (!response) throw new Error("The exact manifest entry is absent before the test");
      const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", await response.clone().arrayBuffer()))]
        .map(value => value.toString(16).padStart(2, "0")).join("");
      if (hash !== target.sha256) throw new Error("The baseline cached bytes do not match the manifest");
      return { cacheName, url: target.url, hash };
    }, { cacheName, target });
    expect(await backup.evaluate(async value => (await caches.open(value.cacheName)).delete(value.url))).toBe(true);
    await check("en", "incomplete");
    expect(await backup.evaluate(async value => Boolean(await caches.match(value.url, { cacheName: value.cacheName })))).toBe(false);
    await expect(readiness).toHaveText("Some base files are missing or damaged. Connect to the internet and restore the offline files before travelling.");
    await screenshot("device-en-incomplete");
    await device.getByRole("button", { name: "Request persistent storage", exact: true }).click();
    await expect(device.getByRole("status").filter({ hasText: "The browser did not grant persistent storage." })).toBeVisible();
    await stable("en", "simulated-persistence-denied");
    await screenshot("device-en-simulated-persistence-denied");
    await locale("ru");
    await expect(readiness).toHaveAttribute("data-pwa-offline-readiness", "incomplete");
    await expect(readiness).toHaveText("Часть базовых файлов отсутствует или повреждена. Подключитесь к сети и восстановите офлайн-файлы перед поездкой.");
    await expect(device.getByRole("status").filter({ hasText: "Браузер не разрешил постоянное хранение." })).toBeVisible();
    await stable("ru", "retained-incomplete-and-denied");
    // Restoration is a real product action through the real worker/network.
    // QA only removes the exact known file; it never writes the repair bytes.
    await context.setOffline(false);
    await worker.evaluate(() => { globalThis.__pwaDeviceFetchQa.count = 0; globalThis.__pwaDeviceFetchQa.urls = []; globalThis.__pwaDeviceFetchQa.armed = true; });
    await device.getByRole("button", { name: "Восстановить офлайн-файлы", exact: true }).click();
    const repairStatus = device.locator("[data-pwa-offline-repair]");
    await expect(repairStatus).toHaveAttribute("data-pwa-offline-repair", "complete", { timeout: 125_000 });
    await expect(readiness).toHaveAttribute("data-pwa-offline-readiness", "complete");
    const transfer = await worker.evaluate(() => { globalThis.__pwaDeviceFetchQa.armed = false;
      return { networkAttempts: globalThis.__pwaDeviceFetchQa.count, urls: globalThis.__pwaDeviceFetchQa.urls }; });
    expect(transfer).toEqual({ networkAttempts: 1, urls: [qaOrigin + target.url] });
    const repaired = await page.evaluate(() => window.__pwaDeviceQa.repairs.at(-1));
    expect(repaired).toEqual({ status: "complete", engineBuildId: marker.manifest.buildId, activeBuildId: marker.manifest.buildId,
      fileCount: marker.manifest.files.length, bytes: marker.manifest.files.reduce((sum, file) => sum + file.bytes, 0), repairedFiles: 1, repairedBytes: target.bytes });
    evidence.repairs.push({ locale: "ru", ...transfer, ...repaired });
    restored = true;
    await stable("ru", "real-offline-repair-complete"); await screenshot("device-ru-repaired");
    await locale("en");
    await expect(repairStatus).toHaveText("Base files have been restored and passed a full check on this device.");
    await stable("en", "repair-result-survives-locale"); await screenshot("device-en-repaired");
    await locale("ru");
    await check("ru", "complete");
    await expect(repairStatus).toHaveCount(0);
    const decisions = await page.evaluate(() => ({ prompts: window.__pwaDeviceQa.prompts, persistence: window.__pwaDeviceQa.persistence }));
    expect(decisions).toEqual({ prompts: [{ userActivation: true }], persistence: [{ userActivation: true }] });
    evidence.simulatedDecisions = decisions;
    await header.getByRole("button", { name: "Вернуться к планете", exact: true }).click();
    await expect(collection).toBeHidden();
    await openApplicationCollection(page);
    await stable("ru", "collection-reopened");
    await expect(device.getByRole("status").filter({ hasText: "Запрос принят. Дождитесь завершения установки браузером." })).toBeVisible();
    await expect(readiness).toHaveAttribute("data-pwa-offline-readiness", "complete");
    await nodes.dispose();
    // Reload creates one new document/scene per launch. Locale changes within
    // each document still retain its canonical Canvas; no cross-reload identity
    // claim is made. Both actual locale shells must launch without any network.
    await context.setOffline(true);
    for (const language of ["ru", "en"]) {
      const destination = new URL(page.url()); destination.pathname = "/planet/" + language + "/";
      await page.goto(destination.href, { waitUntil: "domcontentloaded" });
      await expect(page.locator("html")).toHaveAttribute("lang", language);
      await expect(page.locator("[data-pwa-authorized]")).toBeVisible();
      await expect(page.locator("#atlas canvas")).toHaveCount(1);
      await expect.poll(() => page.evaluate(() => window.__literaryPlanetQaScenes?.().filter(item => document.querySelector("#atlas")?.contains(item.canvas)).length)).toBe(1);
      await expect(page.locator("#atlas .literary-globe")).toHaveAttribute("data-globe-webgl-context", "ready", { timeout: 45_000 });
      // Canvas creation precedes the real launch curtain's exit. Capture the
      // usable cold-start surface only after its overlay and input lock leave.
      await expect(page.locator(".native-planet-launch")).toHaveCount(0);
      await expect(page.locator("#atlas .literary-globe")).toHaveAttribute("data-globe-edition", "nasa-blue-marble");
      await expect(page.locator("#atlas .literary-globe")).toHaveAttribute("data-globe-style", "earth");
      await expect(page.locator(".native-planet-app")).toHaveAttribute("data-planet-edition", "nasa-blue-marble");
      const cold = await page.evaluate(() => ({ language: document.documentElement.lang,
        country: new URL(location.href).searchParams.get("country"), canvasCount: document.querySelectorAll("canvas").length,
        launchOverlayCount: document.querySelectorAll(".native-planet-launch").length,
        savedAccess: document.querySelector("[data-pwa-access-verification]")?.getAttribute("data-pwa-access-verification") }));
      expect(cold).toMatchObject({ language, country: "russia", canvasCount: 1, launchOverlayCount: 0, savedAccess: "saved" });
      evidence.coldOffline.push(cold); await screenshot("device-repaired-cold-" + language);
    }
  } finally {
    if (backup) {
      evidence.restoredSha256 = await page.evaluate(async ({ cacheName, target }) => {
        const response = await caches.match(target.url, { cacheName });
        if (!response) return null;
        return [...new Uint8Array(await crypto.subtle.digest("SHA-256", await response.arrayBuffer()))]
          .map(item => item.toString(16).padStart(2, "0")).join("");
      }, { cacheName, target });
      await backup.dispose().catch(() => undefined);
    }
    await worker.evaluate(() => { globalThis.fetch = globalThis.__pwaDeviceFetchQa.original; delete globalThis.__pwaDeviceFetchQa; });
    await context.setOffline(false);
    await scene.dispose().catch(() => undefined);
    await testInfo.attach("device-preparation-evidence", { body: JSON.stringify(evidence, null, 2), contentType: "application/json" });
    if (restored) expect(evidence.restoredSha256).toBe(target.sha256);
  }
});

test("known revocation closes access and cannot be resurrected by offline reload", async ({ page, context, request }) => {
  await openAuthorized(page);
  await installed(page);
  await control(request, { action: "license", state: { session: "revoked" } });
  await context.setOffline(true);
  await context.setOffline(false);
  await expect(page.locator("[data-pwa-authorized]")).toHaveCount(0);
  await expect(page.locator("[data-pwa-access-state]")).toHaveAttribute("data-pwa-access-state", "closed");
  await expect(page.locator(".pwa-access__status")).toContainText("больше не действует");
  await context.setOffline(true);
  try {
    await page.reload();
    await expect(page.locator(".pwa-access")).toBeVisible();
    await expect(page.locator("[data-pwa-authorized]")).toHaveCount(0);
    await expect(page.locator("#atlas canvas")).toHaveCount(0);
  } finally { await context.setOffline(false); }
});

test("unsigned local paid flags and cached foreign identity cannot grant access", async ({ page, request }) => {
  await control(request, { action: "license", state: { identity: "denied", session: "denied" } });
  await page.addInitScript(() => {
    localStorage.setItem("paid", "true");
    localStorage.setItem("entitlements", JSON.stringify({ base: true }));
    localStorage.setItem("literary-planet-license", JSON.stringify({ paid: true, subject: "invented" }));
  });
  await page.goto("/planet/en/");
  await expect(page.locator(".pwa-access")).toBeVisible();
  await expect(page.locator("[data-pwa-access-state]")).toHaveAttribute("data-pwa-access-state", "closed");
  await expect(page.locator("[data-pwa-authorized]")).toHaveCount(0);
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(page.locator(".interface-language-control")).toHaveCount(1);
});

test("a corrupt candidate preserves the active build; explicit update and rollback select whole verified generations", async ({ page, context, request }, testInfo) => {
  await openAuthorized(page);
  const previous = await installed(page);
  const originalDocument = await page.evaluateHandle(() => document);
  const asset = previous.manifest.files.find(file => file.url.endsWith(".js"));
  expect(asset).toBeTruthy();
  const bad = await control(request, { action: "candidate", corruptPath: asset.url });
  await page.evaluate(async () => { const registration = await navigator.serviceWorker.getRegistration("/planet/"); await registration.update(); });
  await expect.poll(() => page.evaluate(async () => (await navigator.serviceWorker.getRegistration("/planet/")).installing?.state ?? "none"), { timeout: 60_000 }).toBe("none");
  const rejected = await page.evaluate(async id => {
    const cacheName = "literary-planet-pwa-v1-" + id;
    if (!(await caches.keys()).includes(cacheName)) return null;
    const candidate = await caches.match("/planet/__pwa_candidate__", { cacheName });
    if (!candidate) return null;
    const bytes = await candidate.arrayBuffer();
    if (bytes.byteLength > 1024) throw new Error("Candidate observation exceeds its metadata bound");
    const registration = await navigator.serviceWorker.getRegistration("/planet/");
    return { candidate: JSON.parse(new TextDecoder().decode(bytes)),
      complete: Boolean(await caches.match("/planet/__pwa_complete__", { cacheName })),
      installing: Boolean(registration.installing), waiting: Boolean(registration.waiting) };
  }, bad.buildId);
  expect(rejected).toEqual({ candidate: { schemaVersion: 1, state: "CANDIDATE", buildId: bad.buildId,
    manifestSha256: expect.stringMatching(/^[a-f0-9]{64}$/u) }, complete: false, installing: false, waiting: false });
  // The real installer retains verified partial files for retry. Its marker and
  // the corrupt download prove failure occurred after executable setup.
  const badRequests = (await control(request, { action: "status" })).requests;
  const controls = badRequests.flatMap((row, index) => row.method === "POST" && row.pathname === "/__pwa_qa__/control" ? [index] : []);
  expect(controls.length).toBeGreaterThanOrEqual(2);
  const candidateRequests = badRequests.slice(controls.at(-2) + 1, controls.at(-1));
  expect(candidateRequests.some(row => row.method === "GET" && row.pathname === asset.url)).toBe(true);
  expect(await originalDocument.evaluate(original => original === document)).toBe(true);
  expect(await page.evaluate(id => caches.has("literary-planet-pwa-v1-" + id), previous.manifest.buildId)).toBe(true);
  const activeBytes = await page.evaluate(async pathname => {
    const response = await fetch(pathname), bytes = await response.arrayBuffer();
    return { buildId: response.headers.get("X-Literary-Planet-Build"), sha256: [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(value => value.toString(16).padStart(2, "0")).join("") };
  }, asset.url);
  expect(activeBytes).toEqual({ buildId: previous.manifest.buildId, sha256: asset.sha256 });
  const good = await control(request, { action: "candidate" });
  await page.evaluate(async () => { const registration = await navigator.serviceWorker.getRegistration("/planet/"); await registration.update(); });
  const update = page.locator(".connectivity-status button").filter({ hasText: "Обновить" });
  await expect(update).toBeVisible({ timeout: 60_000 });
  expect(await originalDocument.evaluate(original => original === document)).toBe(true);
  const collection = page.locator(".native-planet-panel");
  const closeCollection = collection.getByRole("button", { name: "Вернуться к планете", exact: true });
  const updateNodes = await captureNoticeNodes(page);
  await openApplicationCollection(page);
  await expect(collection).toBeVisible();
  await retainedNoticeNodes(page, updateNodes, "panel");
  await closeCollection.click();
  await expect(collection).toBeHidden();
  await retainedNoticeNodes(page, updateNodes, "root");
  await openApplicationCollection(page);
  await expect(collection).toBeVisible();
  await retainedNoticeNodes(page, updateNodes, "panel");
  await closeCollection.focus();
  await page.keyboard.press("Tab");
  await expect(update).toBeFocused();
  await hitTarget(update);
  await page.screenshot({ path: testInfo.outputPath("pwa-collection-keyboard-update.png"), fullPage: false });
  await updateNodes.dispose();
  await Promise.all([page.waitForEvent("domcontentloaded"), page.keyboard.press("Enter")]);
  await expect(page.locator("[data-pwa-authorized]")).toBeVisible();
  expect(new URL(page.url()).searchParams.get("country")).toBe("russia");
  const names = await page.evaluate(() => caches.keys());
  expect(names).toContain("literary-planet-pwa-v1-" + previous.manifest.buildId);
  expect(names).toContain("literary-planet-pwa-v1-" + good.buildId);
  expect(names).not.toContain("literary-planet-pwa-v1-" + bad.buildId);
  const updatedDocument = await page.evaluateHandle(() => document);
  const rollback = page.getByRole("button", { name: "Вернуть предыдущую версию", exact: true });
  await expect(rollback).toBeVisible({ timeout: 60_000 });
  const updatedBytes = await page.evaluate(async pathname => {
    const response = await fetch(pathname), bytes = await response.arrayBuffer();
    return { buildId: response.headers.get("X-Literary-Planet-Build"), sha256: [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(value => value.toString(16).padStart(2, "0")).join("") };
  }, good.changedPath);
  const oldFile = previous.manifest.files.find(file => file.url === good.changedPath);
  expect(updatedBytes.buildId).toBe(good.buildId);
  expect(updatedBytes.sha256).not.toBe(oldFile.sha256);
  expect(await updatedDocument.evaluate(original => original === document)).toBe(true);
  await context.setOffline(true);
  try {
    const rollbackNodes = await captureNoticeNodes(page);
    await openApplicationCollection(page);
    await expect(collection).toBeVisible();
    await retainedNoticeNodes(page, rollbackNodes, "panel");
    await closeCollection.focus();
    await page.keyboard.press("Tab");
    // Offline status remains an accessible native disclosure before the action.
    await expect(page.locator(".connectivity-status .pwa-status-card__details > summary")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(rollback).toBeFocused();
    await hitTarget(rollback);
    await page.screenshot({ path: testInfo.outputPath("pwa-collection-keyboard-rollback.png"), fullPage: false });
    await rollbackNodes.dispose();
    await Promise.all([page.waitForEvent("domcontentloaded"), page.keyboard.press("Enter")]);
    await expect(page.locator("[data-pwa-authorized]")).toBeVisible();
    await expect(rollback).toHaveCount(0);
    for (const locale of ["en", "ru"]) {
      const response = await page.goto("/planet/" + locale + "/?country=russia#atlas");
      expect(response.headers()["x-literary-planet-build"]).toBe(previous.manifest.buildId);
      await expect(page.locator("[data-pwa-authorized]")).toBeVisible();
      await expect(page.locator("#atlas .literary-globe")).toHaveAttribute("data-globe-webgl-context", "ready", { timeout: 45_000 });
      await expect(page.locator("#atlas canvas")).toHaveCount(1);
      await expect(page.locator("canvas")).toHaveCount(1);
      await expect(page.locator('[data-atlas-experience]')).toHaveAttribute("data-atlas-view", "immersive");
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      const restored = await page.evaluate(async pathname => {
        const response = await fetch(pathname), bytes = await response.arrayBuffer();
        return { buildId: response.headers.get("X-Literary-Planet-Build"), sha256: [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(value => value.toString(16).padStart(2, "0")).join("") };
      }, good.changedPath);
      expect(restored).toEqual({ buildId: previous.manifest.buildId, sha256: oldFile.sha256 });
    }
    const state = await page.evaluate(async () => {
      const worker = navigator.serviceWorker.controller;
      return new Promise((resolve, reject) => {
        const requestId = "qa-rollback-status-" + Date.now();
        const timeout = setTimeout(() => { navigator.serviceWorker.removeEventListener("message", listener); reject(new Error("Rollback status timed out")); }, 10_000);
        const listener = event => {
          if (event.source !== worker || event.data?.requestId !== requestId) return;
          clearTimeout(timeout); navigator.serviceWorker.removeEventListener("message", listener); resolve(event.data);
        };
        navigator.serviceWorker.addEventListener("message", listener);
        worker.postMessage({ type: "PLANET_ROLLBACK_STATUS", requestId });
      });
    });
    expect(state).toMatchObject({ engineBuildId: good.buildId, activeBuildId: previous.manifest.buildId, rollbackBuildId: null, ready: false });
    await testInfo.attach("pwa-update-notice-host-evidence", { body: JSON.stringify({ localQaOnly: true,
      sameNoticeHostAndConnectivityAcrossCollection: true, sameCanvasRendererCameraSceneBeforeExplicitActivation: true,
      keyboardUpdateAndRollbackFromCollectionClose: true, corruptedCandidateRejected: true,
      corruptCandidateEnteredInstall: true, failedCandidateState: "CANDIDATE",
      selectedWholeVerifiedGenerations: [previous.manifest.buildId, good.buildId, previous.manifest.buildId],
    }), contentType: "application/json" });
  } finally { await context.setOffline(false); }
  await updatedDocument.dispose();
  await originalDocument.dispose();
});

test("site worker activation preserves controlled and unrelated caches", async ({ page, context }) => {
  await openAuthorized(page);
  const current = await installed(page);
  await page.evaluate(async () => { await caches.open("unrelated-application-cache"); });
  const site = await context.newPage();
  await site.goto("/site-qa/");
  await site.evaluate(async () => { await navigator.serviceWorker.register("/sw.js", { scope: "/" }); await navigator.serviceWorker.ready; });
  await expect.poll(() => site.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? "")).toBe(qaOrigin + "/sw.js");
  const names = await page.evaluate(() => caches.keys());
  expect(names).toContain("unrelated-application-cache");
  expect(names).toContain("literary-planet-pwa-v1-" + current.manifest.buildId);
  for (const name of names.filter(value => value.startsWith("probpera-"))) {
    const paths = await site.evaluate(async cache => (await (await caches.open(cache)).keys()).map(request => new URL(request.url).pathname), name);
    expect(paths.filter(value => value.startsWith("/planet/"))).toEqual([]);
  }
  await site.close();
  await page.reload();
  await expect(page.locator("[data-pwa-authorized]")).toBeVisible();
});

test("verified offline sizes and runtime locale metadata follow real repair", async ({ page, context }, testInfo) => {
  test.setTimeout(240_000);
  await openAuthorized(page);
  const marker = await installed(page);
  const manifest = marker.manifest;
  const totals = { fileCount: manifest.files.length, bytes: manifest.files.reduce((sum, file) => sum + file.bytes, 0) };
  const target = manifest.files.find(file => file.kind === "shell" && file.url === manifest.entrypoints.en);
  expect(target).toBeTruthy();
  expect(target.bytes).toBeGreaterThanOrEqual(1_000);
  expect(target.bytes).toBeLessThan(1_000_000);
  const cacheName = "literary-planet-pwa-v1-" + manifest.buildId;
  const initialUrl = new URL(page.url());
  expect(initialUrl.searchParams.get("country")).toBe("russia");
  expect(initialUrl.hash).toBe("#atlas");
  await expect.poll(() => page.evaluate(() => typeof window.__literaryPlanetQaScenes)).toBe("function");
  const original = await page.evaluateHandle(() => ({ document,
    scene: window.__literaryPlanetQaScenes().find(item => document.querySelector("#atlas").contains(item.canvas)) }));
  expect(await original.evaluate(value => Boolean(value.scene?.canvas && value.scene.renderer && value.scene.camera && value.scene.scene))).toBe(true);
  const evidence = { localQaOnly: true, buildId: manifest.buildId, totals, removedFile: target,
    simulatedApis: [], liveProgressChecked: false, actualOsInstallation: false, browserProcessReopened: false,
    publicSeoAcceptance: false, stageAccepted: false, headSnapshots: [], checks: [], repairs: [], offlineHelpChecks: [], screenshots: [], completed: false };
  await page.evaluate(() => {
    const controller = navigator.serviceWorker.controller;
    if (!controller) throw new Error("The real controlling worker is required");
    const qa = window.__pwaSizesQa = { readiness: [], repairs: [], listener: null };
    qa.listener = event => {
      if (event.source !== controller || event.origin !== location.origin) return;
      if (event.data?.type === "PLANET_OFFLINE_READINESS_RESULT") qa.readiness.push(structuredClone(event.data));
      if (event.data?.type === "PLANET_OFFLINE_REPAIR_RESULT") qa.repairs.push(structuredClone(event.data));
    };
    navigator.serviceWorker.addEventListener("message", qa.listener);
  });
  let initialAssets;
  const verifyHead = async language => {
    const head = await page.evaluate(() => {
      const one = (selector, attribute) => {
        const nodes = document.head.querySelectorAll(selector);
        if (nodes.length !== 1) throw new Error("Expected one owned head field: " + selector);
        return nodes[0].getAttribute(attribute);
      };
      const names = ["description", "robots", "twitter:card", "twitter:title", "twitter:description", "twitter:image:alt"];
      const properties = ["og:type", "og:title", "og:description", "og:site_name", "og:url", "og:locale", "og:locale:alternate", "og:image:alt"];
      return { title: document.title, htmlLang: document.documentElement.lang,
        routeLanguage: document.documentElement.getAttribute("data-route-language"),
        pathname: location.pathname, search: location.search, hash: location.hash,
        canonical: one('link[rel="canonical"]', "href"), manifest: one('link[rel="manifest"]', "href"),
        alternates: Object.fromEntries(["ru", "en", "x-default"].map(value => [value, one(`link[rel="alternate"][hreflang="${value}"]`, "href")])),
        names: Object.fromEntries(names.map(value => [value, one(`meta[name="${value}"]`, "content")])),
        properties: Object.fromEntries(properties.map(value => [value, one(`meta[property="${value}"]`, "content")])),
        assets: [...document.head.querySelectorAll('link[href]:not([rel="canonical"]):not([rel="manifest"]):not([hreflang]),script[src],meta[property="og:image"],meta[name="twitter:image"]')]
          .map(node => [node.tagName, node.getAttribute("rel") ?? node.getAttribute("property") ?? node.getAttribute("name"),
            node.getAttribute("href") ?? node.getAttribute("src") ?? node.getAttribute("content")].join(":")).sort() };
    });
    const title = language === "ru" ? "Литературная планета" : "Literary Planet";
    const canonical = "https://probpera.ru/planet/" + language + "/";
    expect(head).toMatchObject({ title, htmlLang: language, routeLanguage: language,
      pathname: "/planet/" + language + "/", search: initialUrl.search, hash: initialUrl.hash,
      canonical, manifest: "/planet/" + language + "/manifest.webmanifest" });
    expect(head.alternates).toEqual({ ru: "https://probpera.ru/planet/ru/", en: "https://probpera.ru/planet/en/", "x-default": "https://probpera.ru/planet/" });
    expect(head.names).toEqual({ description: title, robots: "noindex,nofollow", "twitter:card": "summary",
      "twitter:title": title, "twitter:description": title, "twitter:image:alt": title });
    expect(head.properties).toEqual({ "og:type": "website", "og:title": title, "og:description": title, "og:site_name": title,
      "og:url": canonical, "og:locale": language === "ru" ? "ru_RU" : "en_US",
      "og:locale:alternate": language === "ru" ? "en_US" : "ru_RU", "og:image:alt": title });
    expect(head.assets.some(value => value.startsWith("META:og:image:https://"))).toBe(true);
    expect(head.assets.some(value => value.startsWith("META:twitter:image:https://"))).toBe(true);
    if (initialAssets) expect(head.assets).toEqual(initialAssets); else initialAssets = head.assets;
    await expect(page.locator("canvas")).toHaveCount(1);
    expect(await original.evaluate(previous => {
      const current = window.__literaryPlanetQaScenes().find(item => item.canvas === previous.scene.canvas);
      return previous.document === document && previous.scene.canvas.isConnected && current?.renderer === previous.scene.renderer
        && current?.camera === previous.scene.camera && current?.scene === previous.scene.scene;
    })).toBe(true);
    evidence.headSnapshots.push(head);
  };
  const size = (bytes, language) => {
    const divisor = bytes >= 1_000_000_000 ? 1_000_000_000 : bytes >= 1_000_000 ? 1_000_000 : 1_000;
    const unit = divisor === 1_000_000_000 ? language === "ru" ? "ГБ" : "GB"
      : divisor === 1_000_000 ? language === "ru" ? "МБ" : "MB" : language === "ru" ? "КБ" : "kB";
    return new Intl.NumberFormat(language === "ru" ? "ru-RU" : "en-US", { maximumFractionDigits: 1 }).format(bytes / divisor) + " " + unit;
  };
  try {
    await openApplicationCollection(page);
    const collection = page.locator(".native-planet-panel");
    const header = collection.locator(".native-planet-panel__header");
    const help = collection.locator(".pwa-help");
    await help.locator(":scope > details > summary").click();
    const device = help.locator(".pwa-device");
    const readiness = device.locator("[data-pwa-offline-readiness]");
    const offlineHelp = device.locator(".pwa-device__offline-help");
    await expect(offlineHelp).not.toHaveAttribute("open", "");
    const verifiedText = language => (language === "ru" ? "Проверенный набор: " : "Verified base package: ")
      + totals.fileCount + " · " + size(totals.bytes, language);
    const restoredText = language => (language === "ru" ? "Восстановлено за попытку: " : "Restored this attempt: ")
      + "1 · " + size(target.bytes, language);
    const check = async (language, expected) => {
      const before = await page.evaluate(() => window.__pwaSizesQa.readiness.length);
      await device.getByRole("button", { name: language === "ru" ? "Проверить офлайн-файлы" : "Check offline files", exact: true }).click();
      await expect(readiness).toHaveAttribute("data-pwa-offline-readiness", expected, { timeout: 35_000 });
      await expect.poll(() => page.evaluate(() => window.__pwaSizesQa.readiness.length)).toBe(before + 1);
      const reply = await page.evaluate(() => window.__pwaSizesQa.readiness.at(-1));
      expect(reply).toMatchObject({ status: expected, engineBuildId: manifest.buildId, activeBuildId: manifest.buildId });
      if (expected === "complete") expect(reply).toMatchObject(totals);
      else { expect(Object.hasOwn(reply, "fileCount")).toBe(false); expect(Object.hasOwn(reply, "bytes")).toBe(false); }
      evidence.checks.push({ language, ...reply });
    };
    const locale = async language => {
      await header.locator('[data-interface-language="' + language + '"]').click();
      await expect(page.locator("html")).toHaveAttribute("lang", language);
      await verifyHead(language);
    };
    await check("ru", "complete");
    await expect(device.getByText(verifiedText("ru"), { exact: true })).toBeVisible();
    // Capture build asset URLs after the real collection/help chunks are mounted.
    await verifyHead("ru");
    await locale("en");
    await expect(device.getByText(verifiedText("en"), { exact: true })).toBeVisible();
    await context.setOffline(true);
    evidence.baseline = await page.evaluate(async ({ cacheName, target }) => {
      if (!await caches.has(cacheName)) throw new Error("The exact build cache is absent");
      const response = await caches.match(target.url, { cacheName });
      if (!response) throw new Error("The exact EN shell is absent before deletion");
      const bytes = await response.arrayBuffer();
      const sha256 = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(value => value.toString(16).padStart(2, "0")).join("");
      if (sha256 !== target.sha256 || bytes.byteLength !== target.bytes) throw new Error("Baseline cached bytes do not match the manifest");
      if (!await (await caches.open(cacheName)).delete(target.url)) throw new Error("The exact EN shell was not deleted");
      return { url: target.url, sha256, bytes: bytes.byteLength };
    }, { cacheName, target });
    await check("en", "incomplete");
    await expect(device.getByText(verifiedText("en"), { exact: true })).toHaveCount(0);
    await expect(device.getByText(verifiedText("ru"), { exact: true })).toHaveCount(0);
    expect(await page.evaluate(async ({ cacheName, target }) => Boolean(await caches.match(target.url, { cacheName })), { cacheName, target })).toBe(false);
    await context.setOffline(false);
    await device.getByRole("button", { name: "Restore offline files", exact: true }).click();
    await expect(device.locator("[data-pwa-offline-repair]")).toHaveAttribute("data-pwa-offline-repair", "complete", { timeout: 125_000 });
    await expect(readiness).toHaveAttribute("data-pwa-offline-readiness", "complete");
    await expect.poll(() => page.evaluate(() => window.__pwaSizesQa.repairs.length)).toBe(1);
    const repaired = await page.evaluate(() => window.__pwaSizesQa.repairs[0]);
    expect(repaired).toMatchObject({ status: "complete", engineBuildId: manifest.buildId, activeBuildId: manifest.buildId,
      ...totals, repairedFiles: 1, repairedBytes: target.bytes });
    evidence.repairs.push(repaired);
    evidence.restored = await page.evaluate(async ({ cacheName, target }) => {
      const response = await caches.match(target.url, { cacheName });
      if (!response) throw new Error("The product repair did not restore the EN shell");
      const bytes = await response.arrayBuffer();
      const sha256 = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(value => value.toString(16).padStart(2, "0")).join("");
      return { url: target.url, sha256, bytes: bytes.byteLength };
    }, { cacheName, target });
    expect(evidence.restored).toEqual(evidence.baseline);
    for (const language of ["ru", "en"]) {
      await locale(language);
      const totalNote = device.getByText(verifiedText(language), { exact: true });
      const repairNote = device.getByText(restoredText(language), { exact: true });
      await expect(totalNote).toBeVisible(); await expect(repairNote).toBeVisible();
      const summary = offlineHelp.locator(":scope > summary");
      await expect(summary).toHaveText(language === "ru" ? "Как работает офлайн" : "How offline works");
      const caveats = language === "ru" ? [
        "Загружаются только недостающие или повреждённые базовые файлы. Восстановление использует интернет и не продлевает доступ.",
        "Проверка не продлевает право доступа и не включает дополнительные материалы. Браузер может удалить сохранённые файлы позднее.",
      ] : [
        "Only missing or damaged base files are downloaded. Restoration uses the internet and does not extend access.",
        "This check does not extend access or include additional content. The browser may remove saved files later.",
      ];
      await expect(offlineHelp).not.toHaveAttribute("open", "");
      for (const text of caveats) await expect(offlineHelp.getByText(text, { exact: true })).toBeHidden();
      await summary.click();
      await expect(offlineHelp).toHaveAttribute("open", "");
      for (const text of caveats) await expect(offlineHelp.getByText(text, { exact: true })).toBeVisible();
      await summary.click();
      await expect(offlineHelp).not.toHaveAttribute("open", "");
      evidence.offlineHelpChecks.push({ language, originalCaveatsRetained: true, nativeOpenClose: true, closedForPhoto: true });
      await collection.locator(".native-planet-panel__content").evaluate(container => {
        const card = container.querySelector("[data-pwa-offline-readiness]")?.parentElement;
        if (!card) throw new Error("The native offline preparation card is absent");
        container.scrollTop += card.getBoundingClientRect().top - container.getBoundingClientRect().top - 8;
      });
      await expect(totalNote).toBeInViewport({ ratio: 1 }); await expect(repairNote).toBeInViewport({ ratio: 1 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      const filename = "pwa-offline-sizes-" + language + ".png";
      await page.screenshot({ path: testInfo.outputPath(filename), fullPage: false });
      evidence.screenshots.push(filename);
    }
    evidence.completed = true;
  } finally {
    await context.setOffline(false);
    await page.evaluate(() => { if (window.__pwaSizesQa) navigator.serviceWorker.removeEventListener("message", window.__pwaSizesQa.listener); delete window.__pwaSizesQa; }).catch(() => {});
    await original.dispose();
    await testInfo.attach("pwa-offline-sizes-and-runtime-head", { body: JSON.stringify(evidence, null, 2), contentType: "application/json" });
  }
});

test("saved paid PWA survives a full persistent browser restart offline", async ({ request }, testInfo) => {
  test.setTimeout(180_000);
  const { lstat, mkdir, mkdtemp, realpath, rm, rmdir } = await import("node:fs/promises");
  const { dirname, join, resolve, sep } = await import("node:path");
  const checkout = await realpath(process.cwd());
  const temporary = resolve(".tmp");
  const temporaryStat = await lstat(temporary);
  const temporaryRoot = await realpath(temporary);
  if (!temporaryStat.isDirectory() || temporaryStat.isSymbolicLink() || temporaryRoot !== join(checkout, ".tmp")) {
    throw new Error("A real checkout temporary directory is required");
  }
  const profileRoot = await mkdtemp(join(temporaryRoot, "pwa-cold-profile-"));
  const profile = join(profileRoot, "profile");
  await mkdir(profile);
  let context, scene;
  const errors = [];
  const evidence = { localQaOnly: true, browserChannel: "msedge", persistentLaunches: 0, restarts: 0, firstContextClosed: false,
    sameDisposableProfile: true, offlineBeforeFirstNavigation: false, positiveOfflineRestart: false,
    knownRevocationOfflineRestart: false, documents: [], locales: [], screenshots: [],
    actualOsInstallation: false, realStorePurchase: false, productionProvider: false, stageAccepted: false,
    releaseReady: false, completed: false, profileRemoved: false };
  const licenseRequests = status => status.requests.filter(item => item.method === "POST"
    && ["/planet/api/license/identity", "/planet/api/license/session"].includes(item.pathname));
  const launch = async offline => {
    context = await chromium.launchPersistentContext(profile, { channel: "msedge", headless: true,
      baseURL: qaOrigin, viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true,
      serviceWorkers: "allow", reducedMotion: "reduce", offline });
    evidence.persistentLaunches++;
    if (evidence.persistentLaunches > 1) evidence.restarts++;
    const page = context.pages()[0] ?? await context.newPage();
    expect(context.pages()).toHaveLength(1);
    expect(page.url()).toBe("about:blank");
    page.on("pageerror", error => errors.push(error.name));
    return page;
  };
  const capture = async (page, phase) => {
    await expect(page.locator("canvas")).toHaveCount(1);
    await expect.poll(() => page.evaluate(() => window.__literaryPlanetQaScenes?.()
      .filter(item => document.querySelector("#atlas")?.contains(item.canvas)).length)).toBe(1);
    const handle = await page.evaluateHandle(() => ({ document,
      scene: window.__literaryPlanetQaScenes().find(item => document.querySelector("#atlas").contains(item.canvas)) }));
    const observed = await handle.evaluate(value => ({ canvasCount: document.querySelectorAll("canvas").length,
      connectedCanvas: value.scene.canvas.isConnected, realRenderer: Boolean(value.scene.renderer),
      realCamera: Boolean(value.scene.camera), realScene: Boolean(value.scene.scene), online: navigator.onLine }));
    expect(observed).toMatchObject({ canvasCount: 1, connectedCanvas: true, realRenderer: true, realCamera: true, realScene: true });
    evidence.documents.push({ phase, ...observed });
    return handle;
  };
  try {
    const online = await launch(false);
    await openAuthorized(online);
    const marker = await installed(online);
    evidence.buildId = marker.manifest.buildId;
    scene = await capture(online, "online-prime");
    const selection = new URL(online.url());
    expect(selection.searchParams.get("country")).toBe("russia");
    expect(selection.hash).toBe("#atlas");
    expect(await online.evaluate(() => navigator.onLine)).toBe(true);
    await scene.dispose(); scene = undefined;
    // Closing a persistent context closes its browser; the next launch starts
    // a new browser on the same profile, not a new document in the old process.
    await context.close(); context = undefined;
    expect(online.isClosed()).toBe(true);
    evidence.firstContextClosed = true;
    const before = licenseRequests(await control(request, { action: "status" }));
    expect(before.some(item => item.pathname.endsWith("/identity"))).toBe(true);
    expect(before.some(item => item.pathname.endsWith("/session"))).toBe(true);

    const cold = await launch(true);
    expect(await cold.evaluate(() => navigator.onLine)).toBe(false);
    evidence.offlineBeforeFirstNavigation = true;
    await openAuthorized(cold);
    expect((await installed(cold)).manifest.buildId).toBe(marker.manifest.buildId);
    scene = await capture(cold, "reopened-offline");
    for (const [index, locale] of ["ru", "en", "ru"].entries()) {
      if (index > 0) await selectLocale(cold, locale);
      await expect(cold.locator("html")).toHaveAttribute("lang", locale);
      const current = new URL(cold.url());
      expect(current.origin).toBe(selection.origin);
      expect(current.pathname).toBe("/planet/" + locale + "/");
      expect(current.search).toBe(selection.search);
      expect(current.hash).toBe(selection.hash);
      await expect(cold.locator('.atlas-country-presentation[data-atlas-country="russia"]')).toBeVisible();
      await expect(cold.locator("[data-pwa-authorized]")).toBeVisible();
      expect(await cold.evaluate(() => navigator.onLine)).toBe(false);
      const details = cold.locator(".pwa-status-card__details");
      await expect(details).not.toHaveAttribute("open", "");
      await details.locator(":scope > summary").click();
      const saved = details.locator("[data-pwa-access-verification]");
      await expect(saved).toHaveAttribute("data-pwa-access-verification", "saved");
      await expect(saved).toBeVisible();
      await details.locator(":scope > summary").click();
      await expect(details).not.toHaveAttribute("open", "");
      await expect(cold.locator("canvas")).toHaveCount(1);
      expect(await scene.evaluate(previous => {
        const current = window.__literaryPlanetQaScenes().find(item => item.canvas === previous.scene.canvas);
        return previous.document === document && previous.scene.canvas.isConnected && current?.renderer === previous.scene.renderer
          && current?.camera === previous.scene.camera && current?.scene === previous.scene.scene;
      })).toBe(true);
      evidence.locales.push({ locale, selectedCountry: "russia", savedVerification: true, sameSceneWithinReopenedDocument: true });
      if (index < 2) {
        const filename = "pwa-cold-profile-" + locale + ".png";
        await cold.screenshot({ path: testInfo.outputPath(filename), fullPage: false });
        evidence.screenshots.push(filename);
      }
    }
    const after = licenseRequests(await control(request, { action: "status" }));
    expect(after).toEqual(before);
    evidence.offlineLicenseApiRequests = after.length - before.length;
    evidence.positiveOfflineRestart = true;

    await control(request, { action: "license", state: { session: "revoked" } });
    await context.setOffline(false);
    await expect(cold.locator("[data-pwa-access-state]")).toHaveAttribute("data-pwa-access-state", "closed", { timeout: 45_000 });
    await expect(cold.locator("[data-pwa-authorized]")).toHaveCount(0);
    await expect(cold.locator("canvas")).toHaveCount(0);
    await expect(cold.locator(".pwa-access__status")).toContainText("больше не действует");
    await scene.dispose(); scene = undefined;
    await context.close(); context = undefined;
    expect(cold.isClosed()).toBe(true);
    const denied = await launch(true);
    expect(await denied.evaluate(() => navigator.onLine)).toBe(false);
    await denied.goto(selection.href, { waitUntil: "domcontentloaded" });
    expect((await installed(denied)).manifest.buildId).toBe(marker.manifest.buildId);
    await expect(denied.locator("html")).toHaveAttribute("lang", "ru");
    await expect(denied.locator(".pwa-access")).toBeVisible();
    await expect(denied.locator("[data-pwa-access-state]")).toHaveAttribute("data-pwa-access-state", "closed", { timeout: 45_000 });
    await expect(denied.locator("[data-pwa-authorized]")).toHaveCount(0);
    await expect(denied.locator("[data-pwa-access-verification]")).toHaveCount(0);
    await expect(denied.locator("canvas")).toHaveCount(0);
    expect(new URL(denied.url()).search).toBe(selection.search);
    expect(new URL(denied.url()).hash).toBe(selection.hash);
    expect(await denied.evaluate(() => navigator.onLine)).toBe(false);
    evidence.documents.push({ phase: "revoked-offline-restart", online: false, authorizedCount: 0, canvasCount: 0 });
    evidence.knownRevocationOfflineRestart = true;
    expect(errors).toEqual([]);
    expect(evidence.persistentLaunches).toBe(3);
    expect(evidence.restarts).toBe(2);
    evidence.completed = true;
  } finally {
    try {
      await scene?.dispose().catch(() => undefined);
      if (context) await context.close();
      const parentStat = await lstat(dirname(profileRoot)), rootStat = await lstat(profileRoot), profileStat = await lstat(profile);
      const actualParent = await realpath(dirname(profileRoot)), actualRoot = await realpath(profileRoot), actualProfile = await realpath(profile);
      if (!parentStat.isDirectory() || parentStat.isSymbolicLink() || !rootStat.isDirectory() || rootStat.isSymbolicLink()
        || !profileStat.isDirectory() || profileStat.isSymbolicLink() || resolve(profile) !== profile
        || actualParent !== temporaryRoot || actualRoot !== profileRoot || actualProfile !== profile
        || dirname(profileRoot) !== temporaryRoot || !profileRoot.startsWith(join(temporaryRoot, "pwa-cold-profile-"))
        || dirname(profile) !== profileRoot || !actualProfile.startsWith(actualRoot + sep)) {
        throw new Error("Refuse cleanup outside the exact disposable profile");
      }
      await rm(profile, { recursive: true, force: true });
      await rmdir(profileRoot);
      evidence.profileRemoved = true;
    } finally {
      await testInfo.attach("pwa-cold-profile-restart", { body: JSON.stringify(evidence, null, 2), contentType: "application/json" });
    }
  }
});


test("explicit rollback survives a full persistent browser restart offline under the newer worker engine", async ({ request }, testInfo) => {
  test.setTimeout(240_000);
  const { lstat, mkdir, mkdtemp, realpath, rm, rmdir } = await import("node:fs/promises");
  const { dirname, join, resolve, sep } = await import("node:path");
  const checkout = await realpath(process.cwd()), temporary = resolve(".tmp");
  const temporaryStat = await lstat(temporary), temporaryRoot = await realpath(temporary);
  if (!temporaryStat.isDirectory() || temporaryStat.isSymbolicLink() || temporaryRoot !== join(checkout, ".tmp")) {
    throw new Error("A real checkout temporary directory is required");
  }
  const profileRoot = await mkdtemp(join(temporaryRoot, "pwa-rollback-profile-")), profile = join(profileRoot, "profile");
  await mkdir(profile);
  let context, scene;
  const errors = [], blockedRequests = [];
  const evidence = { localQaOnly: true, browserChannel: "msedge", persistentLaunches: 0, restarts: 0,
    sameDisposableProfile: true, firstContextClosed: false, offlineBeforeFirstNavigation: false,
    documents: [], locales: [], screenshots: [], capturesReviewed: false, profileRemoved: false,
    actualOsInstallation: false, realStorePurchase: false, productionProvider: false,
    stageAccepted: false, releaseReady: false, completed: false };
  const licenseRequests = status => status.requests.filter(item => item.method === "POST"
    && ["/planet/api/license/identity", "/planet/api/license/session"].includes(item.pathname));
  const launch = async offline => {
    context = await chromium.launchPersistentContext(profile, { channel: "msedge", headless: true, baseURL: qaOrigin,
      viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true,
      serviceWorkers: "allow", reducedMotion: "reduce", offline });
    await context.route("**/*", route => {
      const url = new URL(route.request().url());
      if (["data:", "blob:"].includes(url.protocol) || url.origin === qaOrigin) return route.continue();
      blockedRequests.push({ origin: url.origin, pathname: url.pathname }); return route.abort();
    });
    evidence.persistentLaunches++; if (evidence.persistentLaunches > 1) evidence.restarts++;
    const page = context.pages()[0] ?? await context.newPage();
    expect(context.pages()).toHaveLength(1); expect(page.url()).toBe("about:blank");
    page.on("pageerror", error => errors.push(error.name)); return page;
  };
  const stamp = (page, buildId) => page.evaluate(async id => {
    const cache = await caches.open("literary-planet-pwa-v1-" + id), response = await cache.match("/planet/__pwa_complete__");
    if (!response) throw new Error("Verified generation stamp is absent");
    return response.json();
  }, buildId);
  const selection = page => page.evaluate(async () => {
    const worker = navigator.serviceWorker.controller;
    if (!worker) throw new Error("No active worker");
    return new Promise((resolve, reject) => {
      const requestId = "qa-persistent-rollback-" + Date.now();
      const timeout = setTimeout(() => { navigator.serviceWorker.removeEventListener("message", listener); reject(new Error("Rollback status timed out")); }, 10_000);
      const listener = event => {
        if (event.source !== worker || event.data?.requestId !== requestId) return;
        clearTimeout(timeout); navigator.serviceWorker.removeEventListener("message", listener); resolve(event.data);
      };
      navigator.serviceWorker.addEventListener("message", listener); worker.postMessage({ type: "PLANET_ROLLBACK_STATUS", requestId });
    });
  });
  const persisted = (page, engineId) => page.evaluate(async id => {
    const cache = await caches.open("literary-planet-pwa-v1-" + id), response = await cache.match("/planet/__pwa_selection__");
    if (!response) throw new Error("Persisted rollback selection is absent");
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > 4096) throw new Error("Rollback selection exceeds its metadata bound");
    return { value: JSON.parse(new TextDecoder().decode(bytes)), bytes: bytes.byteLength,
      sha256: [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(value => value.toString(16).padStart(2, "0")).join("") };
  }, engineId);
  const executable = (page, pathname) => page.evaluate(async url => {
    const response = await fetch(url); if (!response.ok) throw new Error("Executable response unavailable");
    const bytes = await response.arrayBuffer();
    return { buildId: response.headers.get("X-Literary-Planet-Build"), bytes: bytes.byteLength,
      sha256: [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(value => value.toString(16).padStart(2, "0")).join("") };
  }, pathname);
  const authorizedGlobe = async page => {
    await expect(page.locator("[data-pwa-authorized]")).toBeVisible({ timeout: 45_000 });
    await expect(page.locator("#atlas .literary-globe")).toHaveAttribute("data-globe-webgl-context", "ready", { timeout: 45_000 });
    await expect(page.locator('[data-atlas-experience]')).toHaveAttribute("data-atlas-view", "immersive");
    await expect(page.locator(".magazine-hero, .site-header")).toHaveCount(0);
    await expect(page.locator(".native-planet-launch")).toBeHidden();
    await expect(page.locator("#atlas canvas")).toHaveCount(1); await expect(page.locator("canvas")).toHaveCount(1);
  };
  try {
    const online = await launch(false); await openAuthorized(online);
    const previous = await installed(online), originalUrl = new URL(online.url());
    const good = await control(request, { action: "candidate" });
    const oldFile = previous.manifest.files.find(file => file.url === good.changedPath);
    expect(oldFile).toMatchObject({ kind: "asset", url: expect.stringMatching(/\.js$/u) });
    const previousBytes = { buildId: previous.manifest.buildId, bytes: oldFile.bytes, sha256: oldFile.sha256 };
    expect(await executable(online, good.changedPath)).toEqual(previousBytes);
    await online.evaluate(async () => { const registration = await navigator.serviceWorker.getRegistration("/planet/"); await registration.update(); });
    const update = online.locator(".connectivity-status button").filter({ hasText: "Обновить" });
    await expect(update).toBeVisible({ timeout: 60_000 });
    await Promise.all([online.waitForEvent("domcontentloaded"), update.click()]); await authorizedGlobe(online);
    const next = await stamp(online, good.buildId), nextFile = next.manifest.files.find(file => file.url === good.changedPath);
    expect(next).toMatchObject({ state: "COMPLETE", manifest: { buildId: good.buildId,
      rollbackReference: { buildId: previous.manifest.buildId, manifestSha256: previous.manifestSha256 } } });
    expect(next.activationSequence).toBeGreaterThan(previous.activationSequence);
    expect(nextFile.sha256).not.toBe(oldFile.sha256);
    expect(await executable(online, good.changedPath)).toEqual({ buildId: good.buildId, bytes: nextFile.bytes, sha256: nextFile.sha256 });
    await context.setOffline(true);
    const rollback = online.getByRole("button", { name: "Вернуть предыдущую версию", exact: true });
    await expect(rollback).toBeVisible({ timeout: 60_000 });
    await Promise.all([online.waitForEvent("domcontentloaded"), rollback.click()]); await authorizedGlobe(online);
    await expect(rollback).toHaveCount(0);
    expect(await executable(online, good.changedPath)).toEqual(previousBytes);
    const expectedStatus = { engineBuildId: good.buildId, activeBuildId: previous.manifest.buildId, rollbackBuildId: null, ready: false };
    const beforeState = await selection(online); expect(beforeState).toMatchObject(expectedStatus);
    const beforeSelection = await persisted(online, good.buildId);
    expect(beforeSelection.value).toMatchObject({ schemaVersion: 1, engineBuildId: good.buildId,
      buildId: previous.manifest.buildId, manifestSha256: previous.manifestSha256, requestedBy: expect.any(String) });
    expect(beforeSelection.value.requestedBy.length).toBeGreaterThan(0);
    const beforeStamp = await stamp(online, previous.manifest.buildId);
    expect(beforeStamp).toEqual(previous);
    expect(await stamp(online, good.buildId)).toEqual(next);
    evidence.builds = { previous: previous.manifest.buildId, engine: good.buildId, changedPath: good.changedPath,
      previousManifestSha256: previous.manifestSha256, engineManifestSha256: next.manifestSha256,
      previousActivationSequence: previous.activationSequence, engineActivationSequence: next.activationSequence,
      previousExecutable: previousBytes, engineExecutable: { buildId: good.buildId, bytes: nextFile.bytes, sha256: nextFile.sha256 } };
    evidence.selectionBeforeClose = { status: beforeState, persisted: beforeSelection };
    const filename = "pwa-rollback-before-close.png";
    await online.screenshot({ path: testInfo.outputPath(filename), fullPage: false }); evidence.screenshots.push(filename);
    const before = licenseRequests(await control(request, { action: "status" }));
    expect(before.some(item => item.pathname.endsWith("/identity"))).toBe(true);
    expect(before.some(item => item.pathname.endsWith("/session"))).toBe(true);
    await context.close(); context = undefined; expect(online.isClosed()).toBe(true); evidence.firstContextClosed = true;

    const cold = await launch(true); expect(await cold.evaluate(() => navigator.onLine)).toBe(false);
    evidence.offlineBeforeFirstNavigation = true;
    // Real navigation binds the new worker client before probes of selected A resources.
    const response = await cold.goto(originalUrl.href, { waitUntil: "domcontentloaded" });
    expect(response.status()).toBe(200); expect(response.headers()["x-literary-planet-build"]).toBe(previous.manifest.buildId);
    await authorizedGlobe(cold);
    expect(await cold.evaluate(() => navigator.serviceWorker.controller.scriptURL)).toBe(qaOrigin + "/planet/sw.js");
    const reopenedState = await selection(cold); expect(reopenedState).toMatchObject(expectedStatus);
    const reopenedSelection = await persisted(cold, good.buildId); expect(reopenedSelection).toEqual(beforeSelection);
    expect(await stamp(cold, previous.manifest.buildId)).toEqual(previous); expect(await stamp(cold, good.buildId)).toEqual(next);
    evidence.selectionAfterReopen = { status: reopenedState, persisted: reopenedSelection };
    await expect.poll(() => cold.evaluate(() => window.__literaryPlanetQaScenes?.()
      .filter(item => document.querySelector("#atlas")?.contains(item.canvas)).length), { timeout: 45_000 }).toBe(1);
    scene = await cold.evaluateHandle(() => ({ document,
      scene: window.__literaryPlanetQaScenes().find(item => document.querySelector("#atlas").contains(item.canvas)) }));
    evidence.documents.push({ phase: "reopened-offline", engineBuildId: reopenedState.engineBuildId,
      servedBuildId: response.headers()["x-literary-planet-build"], distinctFromClosedDocument: true });
    for (const [index, locale] of ["ru", "en", "ru"].entries()) {
      if (index > 0) await selectLocale(cold, locale);
      await expect(cold.locator("html")).toHaveAttribute("lang", locale); await authorizedGlobe(cold);
      const current = new URL(cold.url());
      expect(current.origin).toBe(originalUrl.origin); expect(current.pathname).toBe("/planet/" + locale + "/");
      expect(current.search).toBe(originalUrl.search); expect(current.hash).toBe(originalUrl.hash);
      await expect(cold.locator('.atlas-country-presentation[data-atlas-country="russia"]')).toBeVisible();
      expect(await cold.evaluate(() => navigator.onLine)).toBe(false);
      expect(await executable(cold, good.changedPath)).toEqual(previousBytes);
      expect(await selection(cold)).toMatchObject(expectedStatus);
      const details = cold.locator(".pwa-status-card__details");
      if (await details.getAttribute("open") === null) await details.locator(":scope > summary").click();
      await expect(details.locator('[data-pwa-access-verification="saved"]')).toBeVisible();
      await details.locator(":scope > summary").click();
      expect(await scene.evaluate(previous => {
        const current = window.__literaryPlanetQaScenes().find(item => item.canvas === previous.scene.canvas);
        return previous.document === document && previous.scene.canvas.isConnected && Boolean(current?.renderer && current.camera && current.scene)
          && current.renderer === previous.scene.renderer && current.camera === previous.scene.camera && current.scene === previous.scene.scene;
      })).toBe(true);
      evidence.locales.push({ locale, selectedCountry: "russia", savedVerification: true, wholePreviousGeneration: true, sameSceneWithinReopenedDocument: true });
      if (index < 2) { const screenshot = "pwa-rollback-reopened-" + locale + ".png";
        await cold.screenshot({ path: testInfo.outputPath(screenshot), fullPage: false }); evidence.screenshots.push(screenshot); }
    }
    const after = licenseRequests(await control(request, { action: "status" })); expect(after).toEqual(before);
    evidence.offlineLicenseApiRequests = after.length - before.length;
    expect(errors).toEqual([]); expect(blockedRequests).toEqual([]);
    expect(evidence.persistentLaunches).toBe(2); expect(evidence.restarts).toBe(1); evidence.completed = true;
  } finally {
    try {
      await scene?.dispose().catch(() => undefined); if (context) await context.close();
      const parentStat = await lstat(dirname(profileRoot)), rootStat = await lstat(profileRoot), profileStat = await lstat(profile);
      const actualParent = await realpath(dirname(profileRoot)), actualRoot = await realpath(profileRoot), actualProfile = await realpath(profile);
      if (!parentStat.isDirectory() || parentStat.isSymbolicLink() || !rootStat.isDirectory() || rootStat.isSymbolicLink()
        || !profileStat.isDirectory() || profileStat.isSymbolicLink() || resolve(profile) !== profile
        || actualParent !== temporaryRoot || actualRoot !== profileRoot || actualProfile !== profile
        || dirname(profileRoot) !== temporaryRoot || !profileRoot.startsWith(join(temporaryRoot, "pwa-rollback-profile-"))
        || dirname(profile) !== profileRoot || !actualProfile.startsWith(actualRoot + sep)) {
        throw new Error("Refuse cleanup outside the exact disposable profile");
      }
      await rm(profile, { recursive: true, force: true }); await rmdir(profileRoot); evidence.profileRemoved = true;
    } finally { evidence.blockedRequests = blockedRequests;
      await testInfo.attach("pwa-persistent-rollback-generation", { body: JSON.stringify(evidence, null, 2), contentType: "application/json" }); }
  }
});
