import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

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
  await page.locator("#atlas").scrollIntoViewIfNeeded();
  await expect(page.locator("#atlas .literary-globe")).toHaveAttribute("data-globe-webgl-context", "ready", { timeout: 45_000 });
  await expect(page.locator("#atlas canvas")).toHaveCount(1);
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
async function selectLocale(page, locale) {
  await page.locator(".site-header .interface-language-control button").filter({ hasText: locale.toUpperCase() }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
  await expect.poll(() => new URL(page.url()).pathname).toBe("/planet/" + locale + "/");
}

test("real signed access, locale and connectivity preserve the actual R3F scene", async ({ page, context, isMobile }, testInfo) => {
  const externalRequests = [];
  page.on("request", request => { if (!request.url().startsWith(qaOrigin + "/") && /^https?:/u.test(request.url())) externalRequests.push(request.url()); });
  await openAuthorized(page);
  if (isMobile) {
    await expect(page.locator(".articles-menu summary")).toBeHidden();
    await expect(page.locator('.mobile-nav a[href="#journal"]')).toHaveCount(1);
  } else {
    await page.locator(".articles-menu summary").click();
    await expect(page.locator(".articles-menu")).toHaveAttribute("open", "");
    await page.locator(".articles-menu summary").press("Escape");
  }
  const marker = await installed(page);
  await expect.poll(() => page.evaluate(() => typeof window.__literaryPlanetQaScenes)).toBe("function");
  const scene = await page.evaluateHandle(() => window.__literaryPlanetQaScenes().find(item => document.querySelector("#atlas").contains(item.canvas)));
  expect(await scene.evaluate(value => Boolean(value?.canvas && value.renderer && value.camera && value.scene))).toBe(true);
  const stable = async () => {
    expect(await scene.evaluate(original => {
      const current = window.__literaryPlanetQaScenes().find(item => item.canvas === original.canvas);
      return original.canvas.isConnected && current?.renderer === original.renderer && current?.camera === original.camera && current?.scene === original.scene;
    })).toBe(true);
    await expect(page.locator('.atlas-country-presentation[data-atlas-country="russia"]')).toBeVisible();
    expect(new URL(page.url()).searchParams.get("country")).toBe("russia");
  };
  await selectLocale(page, "en");
  await stable();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://probpera.ru/planet/en/");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/planet/en/manifest.webmanifest");
  await context.setOffline(true);
  await expect(page.locator(".connectivity-status")).toContainText("offline");
  await stable();
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
      await page.locator("#atlas").scrollIntoViewIfNeeded();
      await expect(page.locator("#atlas .literary-globe")).toHaveAttribute("data-globe-webgl-context", "ready", { timeout: 45_000 });
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.locator('.atlas-country-presentation[data-atlas-country="russia"]')).toBeVisible();
      await page.locator(".global-search-trigger").click();
      const search = page.getByRole("searchbox");
      await expect(search).toBeVisible();
      await search.fill("Dostoevsky");
      await expect(page.locator(".global-search-results button").filter({ hasText: /Достоевск|Dostoevsk/iu }).first()).toBeVisible({ timeout: 30_000 });
      await page.keyboard.press("Escape");
    }
  } finally { await context.setOffline(false); }
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

test("a corrupt candidate preserves the active build; explicit update and rollback select whole verified generations", async ({ page, context, request }) => {
  await openAuthorized(page);
  const previous = await installed(page);
  const originalDocument = await page.evaluateHandle(() => document);
  const asset = previous.manifest.files.find(file => file.url.endsWith(".js"));
  expect(asset).toBeTruthy();
  const bad = await control(request, { action: "candidate", corruptPath: asset.url });
  await page.evaluate(async () => { const registration = await navigator.serviceWorker.getRegistration("/planet/"); await registration.update(); });
  await expect.poll(() => page.evaluate(async () => (await navigator.serviceWorker.getRegistration("/planet/")).installing?.state ?? "none"), { timeout: 60_000 }).toBe("none");
  expect(await page.evaluate(id => caches.has("literary-planet-pwa-v1-" + id), bad.buildId)).toBe(false);
  expect(await originalDocument.evaluate(original => original === document)).toBe(true);
  expect(await page.evaluate(id => caches.has("literary-planet-pwa-v1-" + id), previous.manifest.buildId)).toBe(true);
  const good = await control(request, { action: "candidate" });
  await page.evaluate(async () => { const registration = await navigator.serviceWorker.getRegistration("/planet/"); await registration.update(); });
  const update = page.locator(".connectivity-status button").filter({ hasText: "Обновить" });
  await expect(update).toBeVisible({ timeout: 60_000 });
  expect(await originalDocument.evaluate(original => original === document)).toBe(true);
  await Promise.all([page.waitForEvent("domcontentloaded"), update.click()]);
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
    await Promise.all([page.waitForEvent("domcontentloaded"), rollback.click()]);
    await expect(page.locator("[data-pwa-authorized]")).toBeVisible();
    await expect(rollback).toHaveCount(0);
    for (const locale of ["en", "ru"]) {
      const response = await page.goto("/planet/" + locale + "/?country=russia#atlas");
      expect(response.headers()["x-literary-planet-build"]).toBe(previous.manifest.buildId);
      await expect(page.locator("[data-pwa-authorized]")).toBeVisible();
      await page.locator("#atlas").scrollIntoViewIfNeeded();
      await expect(page.locator("#atlas .literary-globe")).toHaveAttribute("data-globe-webgl-context", "ready", { timeout: 45_000 });
      await expect(page.locator("#atlas canvas")).toHaveCount(1);
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
