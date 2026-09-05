import os from "node:os";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { crossEngineSettings } from "./support/cross-engine-server.mjs";

const settings = crossEngineSettings();
let configuration, session;
test.beforeEach(async () => {
  // The shared server becomes HTTP-ready just before the thin wrapper writes
  // its separate evidence record. Await that record without rebuilding/reusing
  // any previous session when Playwright's readiness poll wins the race.
  await expect.poll(async () => {
    try { return JSON.parse(await readFile(path.join(settings.outputPath, "session.json"), "utf8")).runId; }
    catch (error) { if (error.code === "ENOENT") return null; throw error; }
  }).toBe(settings.runId);
  configuration = JSON.parse(await readFile(path.join(settings.root, settings.controlPath), "utf8"));
  session = JSON.parse(await readFile(path.join(settings.outputPath, "session.json"), "utf8"));
  expect(configuration.localQaOnly).toBe(true);
  expect(configuration.origin).toBe(settings.origin);
  expect(session.runId).toBe(settings.runId);
  expect(session.artifact.localQaAuthority).toBe(true);
  expect(session.artifact.releaseReady).toBe(false);
  // Keep the ephemeral control token out of Playwright's API-request traces.
  const response = await fetch(settings.origin + "/__pwa_qa__/control", {
    method: "POST", headers: { Authorization: "Bearer " + configuration.controlToken, "Content-Type": "application/json" },
    body: JSON.stringify({ action: "reset" }), signal: AbortSignal.timeout(10_000),
  });
  expect(response.status).toBe(200);
});

async function observe(page, browser, browserName, testInfo) {
  const evidence = {
    schemaVersion: 1, runId: settings.runId, artifact: session.artifact,
    project: testInfo.project.name, engine: browserName, runtimeBrowserVersion: browser.version(),
    host: { platform: process.platform, architecture: process.arch, release: os.release() },
    physicalMobileDevice: false, safariVerification: false, nativeInstallationVerified: false,
    measurements: [], completedChecks: [], outcome: "INCOMPLETE", externalRequests: [],
    limits: ["Service Worker COMPLETE and a manifest are not native OS installation evidence.", "Presence of an API or an install event does not prove its complete browser/OS behavior.", "Recovery/support checks cover offline instructions and exact links, not a live merchant/account transaction."],
  };
  page.on("request", request => {
    const url = request.url();
    if (/^https?:/u.test(url) && new URL(url).origin !== settings.origin) evidence.externalRequests.push(url);
  });
  await page.addInitScript(() => {
    window.__pwaCrossEngineSignals = { beforeInstallPrompt: 0, appInstalled: 0 };
    window.addEventListener("beforeinstallprompt", () => { window.__pwaCrossEngineSignals.beforeInstallPrompt++; });
    window.addEventListener("appinstalled", () => { window.__pwaCrossEngineSignals.appInstalled++; });
  });
  evidence.capture = async label => {
    const measurement = await page.evaluate(async () => {
      const optional = async operation => {
        if (!operation) return { available: false, value: null };
        let timer;
        try { return { available: true, value: await Promise.race([operation(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("probe-timeout")), 1000); })]) }; }
        catch (error) { return { available: true, error: error.name === "Error" ? error.message : error.name }; }
        finally { clearTimeout(timer); }
      };
      const storage = { roundTrip: false, error: null };
      const key = "literary-planet-cross-engine-probe-" + Date.now() + "-" + Math.random();
      try { localStorage.setItem(key, "probe"); storage.roundTrip = localStorage.getItem(key) === "probe"; }
      catch (error) { storage.error = error.name; }
      finally { try { localStorage.removeItem(key); } catch { /* Unavailable storage is recorded above. */ } }
      const actual = typeof window.__literaryPlanetQaScenes === "function"
        ? window.__literaryPlanetQaScenes().find(item => document.querySelector("#atlas")?.contains(item.canvas)) : null;
      const gl = actual?.renderer.getContext();
      return {
        userAgent: navigator.userAgent, navigatorPlatform: navigator.platform, languages: [...navigator.languages],
        secureContext: window.isSecureContext, online: navigator.onLine, location: location.pathname + location.search + location.hash,
        serviceWorker: typeof navigator.serviceWorker?.register === "function", cacheStorage: typeof globalThis.caches?.open === "function",
        subtleCrypto: typeof globalThis.crypto?.subtle?.verify === "function", indexedDB: typeof globalThis.indexedDB?.open === "function",
        localStorage: storage, storageEstimate: await optional(navigator.storage?.estimate ? () => navigator.storage.estimate() : null),
        storagePersisted: await optional(navigator.storage?.persisted ? () => navigator.storage.persisted() : null),
        viewport: { width: innerWidth, height: innerHeight, pixelRatio: devicePixelRatio },
        displayMode: ["browser", "standalone", "minimal-ui", "fullscreen"].filter(mode => matchMedia("(display-mode: " + mode + ")").matches),
        navigatorStandalone: typeof navigator.standalone === "boolean" ? navigator.standalone : null,
        beforeInstallPromptInterface: "onbeforeinstallprompt" in window, installEvents: window.__pwaCrossEngineSignals,
        controllerScript: navigator.serviceWorker?.controller?.scriptURL ?? null,
        actualGlobe: actual ? { contextLost: gl.isContextLost(), version: gl.getParameter(gl.VERSION), renderer: gl.getParameter(gl.RENDERER),
          canvasWidth: actual.canvas.width, canvasHeight: actual.canvas.height } : null,
      };
    });
    evidence.measurements.push({ label, ...measurement });
    return measurement;
  };
  evidence.finish = async success => {
    evidence.outcome = success ? "PASSED_BEHAVIOR_CHECKS" : "FAILED_OR_INCOMPLETE";
    try { await evidence.capture("final"); } catch (error) { evidence.finalProbeError = error.message; }
    const { capture, finish, ...report } = evidence;
    await testInfo.attach("cross-engine-capabilities-and-behavior", { body: JSON.stringify(report, null, 2), contentType: "application/json" });
  };
  return evidence;
}

async function openAuthorized(page, evidence, testInfo) {
  await page.goto("/planet/ru/?country=russia#atlas");
  const probe = await evidence.capture("initial-document");
  const missing = ["secureContext", "serviceWorker", "cacheStorage", "subtleCrypto"].filter(name => !probe[name]);
  if (!probe.localStorage.roundTrip) missing.push("localStorage round-trip");
  if (missing.length) testInfo.annotations.push({ type: "unsupported-environment", description: missing.join(", ") });
  // Unsupported core capability is a visible failure with evidence, never a
  // passing no-op or a skip that could be counted as validated PWA behavior.
  expect(missing, "Required core capabilities unavailable; see the attached measured boundary").toEqual([]);
  await expect(page.locator("[data-pwa-authorized]")).toBeVisible({ timeout: 45_000 });
  evidence.completedChecks.push("ephemeral QA ES256 grant accepted by actual access boundary");
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? ""), { timeout: 60_000 }).toBe(settings.origin + "/planet/sw.js");
  const marker = await page.evaluate(async buildId => {
    const name = "literary-planet-pwa-v1-" + buildId;
    if (!await caches.has(name)) return null;
    const cache = await caches.open(name);
    const response = await cache.match("/planet/__pwa_complete__");
    return response ? response.json() : null;
  }, session.artifact.buildId);
  expect(marker?.state).toBe("COMPLETE");
  expect(marker?.manifest?.buildId).toBe(session.artifact.buildId);
  expect(marker?.activationSequence).toBeGreaterThan(0);
  evidence.completedChecks.push("same-build COMPLETE cache and active scoped Service Worker");
}

async function globeReady(page, evidence) {
  await page.locator("#atlas").scrollIntoViewIfNeeded();
  await expect(page.locator("#atlas .literary-globe")).toHaveAttribute("data-globe-webgl-context", "ready", { timeout: 45_000 });
  await expect(page.locator("#atlas canvas")).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => typeof window.__literaryPlanetQaScenes)).toBe("function");
  const probe = await evidence.capture("actual-core-scene");
  expect(probe.actualGlobe).not.toBeNull();
  expect(probe.actualGlobe.contextLost).toBe(false);
}
async function locale(page, language) {
  await page.locator(".site-header .interface-language-control button").filter({ hasText: language.toUpperCase() }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", language);
  await expect.poll(() => new URL(page.url()).pathname).toBe("/planet/" + language + "/");
}

test("verified SW installation and global RU/EN metadata keep the same actual core scene", async ({ page, browser, browserName }, testInfo) => {
  const evidence = await observe(page, browser, browserName, testInfo);
  let original, success = false;
  try {
    await openAuthorized(page, evidence, testInfo);
    await globeReady(page, evidence);
    original = await page.evaluateHandle(() => ({ document,
      scene: window.__literaryPlanetQaScenes().find(item => document.querySelector("#atlas").contains(item.canvas)),
    }));
    for (const language of ["en", "ru"]) {
      await locale(page, language);
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://probpera.ru/planet/" + language + "/");
      await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/planet/" + language + "/manifest.webmanifest");
      for (const alternate of ["ru", "en"]) await expect(page.locator(`link[rel="alternate"][hreflang="${alternate}"]`)).toHaveAttribute("href", "https://probpera.ru/planet/" + alternate + "/");
      expect(new URL(page.url()).searchParams.get("country")).toBe("russia");
      await expect(page.locator('.atlas-country-presentation[data-atlas-country="russia"]')).toBeVisible();
      expect(await original.evaluate(previous => {
        const current = window.__literaryPlanetQaScenes().find(item => item.canvas === previous.scene.canvas);
        return previous.document === document && previous.scene.canvas.isConnected && current?.renderer === previous.scene.renderer
          && current?.camera === previous.scene.camera && current?.scene === previous.scene.scene;
      })).toBe(true);
      await expect(page.locator("#atlas canvas")).toHaveCount(1);
    }
    evidence.completedChecks.push("RU→EN→RU locale route/canonical/hreflang/manifest", "same document, country, actual Canvas/renderer/camera/scene");
    expect(evidence.externalRequests).toEqual([]);
    success = true;
  } finally { await original?.dispose(); await evidence.finish(success); }
});

test("cold offline core/search and bilingual support retain truthful recovery boundaries", async ({ page, context, browser, browserName }, testInfo) => {
  const evidence = await observe(page, browser, browserName, testInfo);
  let success = false;
  try {
    await openAuthorized(page, evidence, testInfo);
    await context.setOffline(true);
    await page.goto("/planet/en/?country=russia#atlas");
    await expect(page.locator("[data-pwa-authorized]")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await globeReady(page, evidence);
    await expect(page.locator(".connectivity-status")).toContainText("offline");
    await page.locator(".global-search-trigger").click();
    await page.getByRole("searchbox").fill("Dostoevsky");
    const writers = page.locator(".global-search-results section").filter({ has: page.getByRole("heading", { name: "Writers", exact: true }) });
    const writer = writers.getByRole("button").filter({ hasText: "Fyodor Dostoevsky" });
    await expect(writer).toHaveCount(1);
    await writer.click();
    await expect(page.locator(".writer-detail h4")).toContainText("Dostoevsky");
    expect(new URL(page.url()).searchParams.get("country")).toBe("russia");
    expect(new URL(page.url()).searchParams.get("writer")).toBe("dostoevsky");
    const help = page.locator(".pwa-help");
    await help.locator("summary").click();
    for (const language of ["en", "ru"]) {
      if (language === "ru") await locale(page, "ru");
      await expect(help.getByRole("heading", { name: language === "en" ? "Reading offline" : "Чтение без сети", exact: true })).toBeVisible();
      await expect(help.getByRole("heading", { name: language === "en" ? "Data on this device" : "Данные на этом устройстве", exact: true })).toBeVisible();
      await expect(help).toContainText(language === "en" ? "Account actions and sending email require an internet connection." : "Для работы с аккаунтом и отправки письма требуется интернет.");
      for (const [pageName, label] of language === "en" ? [["planet-account", "Restore access"], ["delete-account", "Request account deletion"]] : [["planet-account", "Восстановить доступ"], ["delete-account", "Заявка на удаление аккаунта"]]) {
        const link = help.getByRole("link", { name: label, exact: true });
        await link.focus();
        const href = new URL(await link.getAttribute("href")), current = new URL(page.url());
        expect(href.origin).toBe("https://probpera.ru");
        expect(href.pathname).toBe(`/${language}/${pageName}/`);
        expect(href.searchParams.get("returnTo")).toBe(current.pathname + current.search + current.hash);
      }
      await expect(help.getByRole("link", { name: language === "en" ? "Email support" : "Написать в поддержку", exact: true })).toHaveAttribute("href", "mailto:probperasite@yandex.ru");
    }
    evidence.completedChecks.push("new offline EN document authorized by stored signed grant", "first-use offline canonical writer search", "RU/EN offline help and exact canonical recovery/deletion returnTo links", "email/account network requirement disclosed; no external action performed");
    expect(evidence.externalRequests).toEqual([]);
    success = true;
  } finally { await evidence.finish(success); await context.setOffline(false); }
});
