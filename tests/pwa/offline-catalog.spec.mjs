import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const qaControlPath = process.env.PWA_QA_CONTROL_PATH ?? ".tmp/pwa-qa/server.json";
const qaOrigin = process.env.PWA_QA_ORIGIN ?? "http://127.0.0.1:4293";
if (!/^\.tmp\/pwa-qa\/[A-Za-z0-9._-]+\.json$/u.test(qaControlPath)
  || !/^http:\/\/127\.0\.0\.1:\d{1,5}$/u.test(qaOrigin)) throw new Error("Invalid local PWA QA configuration");

async function readQaConfiguration() {
  const configuration = JSON.parse(await readFile(qaControlPath, "utf8"));
  if (configuration.localQaOnly !== true || configuration.origin !== qaOrigin) throw new Error("PWA QA control origin mismatch");
  return configuration;
}

async function prepare(page, request) {
  const config = await readQaConfiguration();
  const reset = await request.post(config.origin + "/__pwa_qa__/control", { headers: { Authorization: "Bearer " + config.controlToken }, data: { action: "reset" } });
  expect(reset.status()).toBe(200);
  await page.goto("/planet/ru/?country=russia#atlas");
  await expect(page.locator("[data-pwa-authorized]")).toBeVisible({ timeout: 45_000 });
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? ""), { timeout: 60_000 }).toBe(config.origin + "/planet/sw.js");
}

async function actualGlobe(page) {
  await expect(page.locator("[data-pwa-authorized]")).toBeVisible({ timeout: 45_000 });
  await expect(page.locator('[data-atlas-experience]')).toHaveAttribute("data-atlas-view", "immersive");
  await expect(page.locator(".magazine-hero, .site-header")).toHaveCount(0);
  await expect(page.locator("#atlas .literary-globe")).toHaveAttribute("data-globe-webgl-context", "ready", { timeout: 45_000 });
  await expect(page.locator(".native-planet-launch")).toBeHidden();
  await expect(page.locator("canvas")).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => typeof window.__literaryPlanetQaScenes)).toBe("function");
  const scene = await page.evaluateHandle(() => window.__literaryPlanetQaScenes().find(item => document.querySelector("#atlas").contains(item.canvas)));
  expect(await scene.evaluate(value => Boolean(value?.canvas && value.renderer && value.camera && value.scene))).toBe(true);
  return scene;
}

async function retainedGlobe(page, original) {
  await expect(page.locator("canvas")).toHaveCount(1);
  expect(await original.evaluate(previous => {
    const current = window.__literaryPlanetQaScenes().find(item => item.canvas === previous.canvas);
    return previous.canvas.isConnected && current?.renderer === previous.renderer && current?.camera === previous.camera && current?.scene === previous.scene;
  })).toBe(true);
}

async function panelNoticeLayout(page) {
  const slot = page.locator('.native-planet-panel > [data-product-notice-placement="panel"]');
  await expect(slot.locator(".product-notice-host > .pwa-notices")).toBeVisible();
  await expect(page.locator(".product-notice-host")).toHaveCount(1);
  await expect.poll(async () => {
    const notice = await slot.boundingBox(), content = await page.locator(".native-planet-panel__content").boundingBox();
    return Boolean(notice && content && notice.y + notice.height <= content.y + 1);
  }).toBe(true);
}

async function verifiedCoverImages(page, collection) {
  const targets = [
    ["england:george_orwell:nineteen-eighty-four", "nineteen-eighty-four-editorial.webp"],
    ["england:charles_dickens:a-tale-of-two-cities", "tale-of-two-cities-editorial.webp"],
    ["england:h_g_wells:ann-veronica", "ann-veronica-20260820-editorial.webp"],
    ["england:aldous_huxley:brave-new-world-editorial", "brave-new-world-editorial.webp"],
  ];
  const evidence = [];
  for (const [workKey, filename] of targets) {
    const card = collection.locator(".book-archive-grid > article").filter({ has: page.locator('.archive-book-detail[data-book-key=' + JSON.stringify(workKey) + ']') });
    // Canonical RU ordering differs from EN; the catalog initially renders
    // thirteen cards. Browse its real next batches instead of assuming that
    // these four verified works all belong to the first locale-specific page.
    const more = collection.locator(".book-archive-more");
    while (await card.count() === 0 && await more.count() > 0) {
      const previousCount = await collection.locator(".book-archive-grid > article").count();
      await more.click();
      await expect.poll(() => collection.locator(".book-archive-grid > article").count()).toBeGreaterThan(previousCount);
    }
    await expect(card).toHaveCount(1);
    // Exercise actual catalog lazy loading while browsing these four cards.
    // Selected-work reveal below is checked without any test-driven scroll.
    await card.scrollIntoViewIfNeeded();
    const image = card.locator(".archive-book-cover img");
    await expect.poll(() => image.evaluate(element => element.complete && element.naturalWidth > 0)).toBe(true);
    const loaded = await image.evaluate(element => ({ pathname: new URL(element.currentSrc).pathname, naturalWidth: element.naturalWidth, naturalHeight: element.naturalHeight }));
    expect(["/planet/brand/book-covers/" + filename, "/planet/brand/book-covers/thumbs/" + filename]).toContain(loaded.pathname);
    evidence.push({ workKey, ...loaded, offline: true });
  }
  return evidence;
}

async function observeProductScrolling(page) {
  await page.addInitScript(() => {
    const events = [];
    const rectangle = node => node?.getBoundingClientRect().toJSON() ?? null;
    const geometry = () => {
      const panel = document.querySelector(".native-planet-panel");
      const content = document.querySelector(".native-planet-panel__content");
      return {
        viewport: { width: innerWidth, height: innerHeight },
        windowScroll: { x: scrollX, y: scrollY },
        panelScroll: panel ? { left: panel.scrollLeft, top: panel.scrollTop } : null,
        contentScroll: content ? { left: content.scrollLeft, top: content.scrollTop } : null,
        panel: rectangle(panel), content: rectangle(content),
        header: rectangle(document.querySelector(".native-planet-panel__header")),
        books: rectangle(document.getElementById("books")),
        detail: rectangle(document.getElementById("book-archive-detail")),
        heading: rectangle(document.querySelector("#book-archive-detail .book-detail-copy h3")),
      };
    };
    const relevant = node => node instanceof Element && (node.id === "books" || node.id === "atlas"
      || node.id === "book-archive-detail" || node.matches(".native-planet-panel, .native-planet-panel__content"));
    const record = (kind, node, options) => {
      if (events.length >= 200) return;
      events.push({ kind, atMs: performance.now(), id: node.id, className: node.getAttribute("class"),
        target: rectangle(node), options, ...geometry() });
    };
    for (const name of ["scrollIntoView", "scrollTo", "scroll"]) {
      const original = Element.prototype[name];
      if (typeof original !== "function") continue;
      Element.prototype[name] = function (...args) {
        const observed = relevant(this);
        const input = args[0];
        const options = input && typeof input === "object"
          ? Object.fromEntries(["behavior", "block", "inline", "top", "left"]
            .filter(key => typeof input[key] === "string" || typeof input[key] === "number")
            .map(key => [key, input[key]])) : args.filter(value => typeof value === "number" || typeof value === "boolean");
        if (observed) record(name + ":call", this, options);
        // Observe actual product callbacks without changing their arguments,
        // scheduling, return value or scrolling any target from the test.
        const result = Reflect.apply(original, this, args);
        if (observed) record(name + ":return", this, options);
        return result;
      };
    }
    document.addEventListener("scroll", event => {
      if (relevant(event.target)) record("scroll:event", event.target, null);
    }, { capture: true, passive: true });
    window.__pwaScrollSnapshot = () => ({ events: [...events], final: geometry() });
  });
}

async function selectedWorkInViewport(page, detail, testInfo, phase) {
  try {
    await expect(detail).toBeInViewport({ ratio: 0.05 });
    await expect(detail.locator(".book-detail-copy h3")).toBeInViewport({ ratio: 0.5 });
    await expect(page.locator(".native-planet-panel__header")).toBeInViewport({ ratio: 1 });
  } finally {
    const evidence = await page.evaluate(() => window.__pwaScrollSnapshot());
    await testInfo.attach("selected-work-scroll-" + phase, { body: JSON.stringify({ localQaOnly: true, phase, ...evidence }), contentType: "application/json" });
  }
}

test("offline PWA cross-language author search and book return retain the globe and integrated archive card", async ({ page, context, request }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await prepare(page, request);
  await context.setOffline(true);
  let scene;
  try {
    await page.goto("/planet/ru/?country=russia&writer=dostoevsky#atlas");
    scene = await actualGlobe(page);
    const toggle = page.locator(".atlas-country-sheet-toggle");
    if (await toggle.getAttribute("aria-expanded") === "false") await toggle.click();
    const writer = page.locator(".writer-detail"), detail = page.locator("#book-archive-detail");
    const observations = [];
    for (const locale of ["ru", "en"]) {
      if (locale === "en") {
        await page.locator(".atlas-immersive-chrome .interface-language-control button").filter({ hasText: "EN" }).click();
      }
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(writer.locator("h4")).toContainText(locale === "ru" ? "Достоевский" : "Dostoevsky");
      const oppositeName = locale === "ru" ? "Fyodor Dostoevsky" : "Фёдор Михайлович Достоевский";
      await page.locator('[data-atlas-action="toggle-search"]').click();
      await page.locator("#country-search").fill(oppositeName);
      const writerOption = page.locator('#country-results [data-option-key="writer:russia:dostoevsky"]');
      await expect(writerOption).toHaveAccessibleName(locale === "ru" ? "Фёдор Михайлович Достоевский" : "Fyodor Dostoevsky");
      await expect(page.locator('#country-results [data-option-key="book:russia:dostoevsky:crime-and-punishment"]')).toHaveAccessibleName(locale === "ru" ? "Преступление и наказание" : "Crime and Punishment");
      await writerOption.click();
      await expect(writer.locator("h4")).toBeInViewport();
      await retainedGlobe(page, scene);
      await writer.locator("#writer-biography-russia-tab-works").click();
      const title = locale === "ru" ? "Преступление и наказание" : "Crime and Punishment";
      await writer.locator("#writer-biography-russia-panel-works").getByRole("button", {
        name: (locale === "ru" ? "Книжный архив: " : "Book archive: ") + title, exact: true,
      }).click();
      await expect(detail).toBeVisible();
      await expect(detail.locator(".book-detail-copy h3")).toHaveText(title);
      await expect.poll(() => new URL(page.url()).searchParams.get("book")).toBe("russia:dostoevsky:crime-and-punishment");
      await detail.locator('[data-book-navigation-origin="book-author"]').click();
      await expect(detail).toBeHidden();
      await expect(page.locator(".native-planet-panel")).toBeHidden();
      await expect.poll(() => new URL(page.url()).searchParams.get("book")).toBeNull();
      await expect.poll(() => new URL(page.url()).searchParams.get("writer")).toBe("dostoevsky");
      await expect.poll(() => new URL(page.url()).searchParams.get("country")).toBe("russia");
      await expect.poll(() => new URL(page.url()).pathname).toBe(`/planet/${locale}/`);
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
      await expect(writer).toBeVisible();
      await expect(writer.locator("h4")).toBeInViewport();
      // This canonical Russia record has no capital field. Preserve its actual
      // existing fallback; the source-backed capital round trip follows below.
      await expect(page.locator(".country-heading p")).toHaveText(locale === "ru" ? "Литературное наследие страны" : "The country’s literary heritage");
      await expect.poll(() => page.locator(".country-panel").evaluate(node => node.contains(document.activeElement))).toBe(true);
      expect(await page.locator("#atlas").evaluate(node => node.inert)).toBe(false);
      await retainedGlobe(page, scene);
      await testInfo.attach(`pwa-country-writer-return-${locale}`, { body: await page.screenshot(), contentType: "image/png" });
      observations.push({ locale, oppositeName, canonicalSearchIds: true, country: "russia", writer: "dostoevsky", readerClosed: true, collectionClosed: true,
        writerRevealedByProduct: true, focusWithinCountryCard: true, sameCanvasRendererCameraScene: true, offline: true });
    }
    await page.locator('[data-atlas-action="toggle-search"]').click();
    await page.locator("#country-search").fill("Zambia");
    await page.locator('#country-results [data-option-key="country:zambia"]').click();
    await expect.poll(() => new URL(page.url()).searchParams.get("country")).toBe("zambia");
    if (await toggle.getAttribute("aria-expanded") === "false") await toggle.click();
    for (const locale of ["en", "ru", "en"]) {
      if (await page.locator("html").getAttribute("lang") !== locale) {
        await page.locator(".atlas-immersive-chrome .interface-language-control button").filter({ hasText: locale.toUpperCase() }).click();
      }
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(page.locator(".country-heading p")).toHaveText(locale === "ru" ? "Столица: Лусака" : "The country’s literary heritage");
      await retainedGlobe(page, scene);
    }
    await testInfo.attach("pwa-country-writer-return-evidence", { body: JSON.stringify({ localQaOnly: true, observations }), contentType: "application/json" });
  } finally { await scene?.dispose(); await context.setOffline(false); }
});

test("orange PWA launch and bilingual recovery lead to the retained offline literary globe", async ({ page, context, browser, request }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const config = await readQaConfiguration();
  const reset = await request.post(config.origin + "/__pwa_qa__/control", { headers: { Authorization: "Bearer " + config.controlToken }, data: { action: "reset" } });
  expect(reset.status()).toBe(200);
  const staticContext = await browser.newContext({ javaScriptEnabled: false, baseURL: config.origin,
    viewport: { width: 390, height: 844 }, reducedMotion: "reduce", colorScheme: "light" });
  const staticPage = await staticContext.newPage();
  const observations = [];
  try {
    for (const locale of ["ru", "en"]) {
      await staticPage.goto(`/planet/${locale}/`);
      await expect(staticPage.locator("html")).toHaveAttribute("lang", locale);
      await expect(staticPage.locator("[data-pwa-startup-noscript]")).toBeVisible();
      await expect(staticPage.locator(".pwa-startup-status")).toBeHidden();
      await expect(staticPage.locator('a[href*="/stati/"]')).toHaveCount(0);
      expect(await staticPage.locator("body").evaluate(node => getComputedStyle(node).backgroundColor)).toBe("rgb(246, 117, 24)");
      await staticPage.locator("[data-pwa-startup-recovery] summary").click();
      const recovery = staticPage.locator(`[data-pwa-startup-recovery] a[href="/planet/${locale}/"]`);
      await expect(recovery).toBeVisible();
      const box = await recovery.boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(44);
      await testInfo.attach(`pwa-bilingual-no-js-${locale}`, { body: await staticPage.screenshot(), contentType: "image/png" });
      observations.push({ phase: "no-js", locale, recovery: await recovery.getAttribute("href"), orangeSurface: true });
    }
    await staticPage.goto("/planet/");
    await expect(staticPage.locator("html")).toHaveAttribute("lang", "");
    await expect(staticPage.locator("html")).not.toHaveAttribute("data-route-language");
    await staticPage.goto("/planet/en/404.html");
    await expect(staticPage.locator('[data-pwa-startup-shell="not-found"]')).toBeVisible();
    await expect(staticPage.locator("script")).toHaveCount(0);
    await expect(staticPage.locator('[data-pwa-startup-shell="not-found"]')).toContainText("Page not found. Return to Literary Planet.");
    await staticPage.emulateMedia({ forcedColors: "active" });
    await expect(staticPage.locator('a[href="/planet/en/"]')).toBeVisible();
    expect(await staticPage.locator("main").evaluate(node => getComputedStyle(node).backgroundColor)).toBe("rgb(255, 255, 255)");
  } finally { await staticContext.close(); }

  let resumeModules;
  const modulesReady = new Promise(resolve => { resumeModules = resolve; });
  await page.route("**/planet/assets/*.js", async route => { await modulesReady; await route.continue(); });
  try {
    await page.goto("/planet/en/?country=france#atlas", { waitUntil: "commit" });
    await expect(page.locator('[data-pwa-startup-shell="loading"]')).toBeVisible();
    await expect(page.locator(".pwa-startup-status")).toHaveText("Opening Literary Planet…");
    await expect(page.locator("canvas")).toHaveCount(0);
    await expect(page.locator("body")).toHaveCSS("background-color", "rgb(246, 117, 24)");
    const logo = page.locator(".pwa-startup-logo");
    await expect.poll(() => logo.evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
    await testInfo.attach("pwa-bilingual-before-js-en", { body: await page.screenshot(), contentType: "image/png" });
  } finally { resumeModules(); }
  const scene = await actualGlobe(page);
  try {
    await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? ""), { timeout: 60_000 }).toBe(config.origin + "/planet/sw.js");
    await page.unroute("**/planet/assets/*.js");
    await context.setOffline(true);
    const input = page.locator("#country-search");
    const key = "russia:dostoevsky:crime-and-punishment";
    for (const locale of ["en", "ru"]) {
      if (locale === "ru") {
        await page.locator(".atlas-immersive-chrome .interface-language-control button").filter({ hasText: "RU" }).click();
        await expect(page.locator("html")).toHaveAttribute("lang", "ru");
      }
      await page.locator('[data-atlas-action="toggle-search"]').click();
      await input.fill(locale === "en" ? "Михайлович" : "Mikhailovich");
      const option = page.locator('#country-results [data-option-key="book:' + key + '"]');
      const title = locale === "en" ? "Crime and Punishment" : "Преступление и наказание";
      await expect(option).toHaveAccessibleName(title);
      await option.click();
      const panel = page.locator(".native-planet-panel");
      await expect(panel.locator("#book-archive-detail")).toHaveAccessibleName(title);
      await expect.poll(() => new URL(page.url()).searchParams.get("book")).toBe(key);
      await retainedGlobe(page, scene);
      await panel.getByRole("button", { name: locale === "ru" ? "Вернуться к планете" : "Return to the planet", exact: true }).click();
      await expect(panel).toBeHidden();
      await expect.poll(() => new URL(page.url()).searchParams.get("book")).toBeNull();
      observations.push({ phase: "offline-author-search", locale, title, key, sameGlobe: true });
    }
    await testInfo.attach("pwa-bilingual-complete", { body: JSON.stringify({ actualBuiltArtifact: true, observations,
      isolatedServiceWorker: true, singleGlobe: true, installedOsObserved: false }), contentType: "application/json" });
  } finally { await context.setOffline(false); await scene.dispose(); }
});

test("cold offline writer biography and works use the canonical catalog", async ({ page, context, request, isMobile }) => {
  await prepare(page, request);
  await context.setOffline(true);
  try {
    await page.reload();
    await expect(page.locator("[data-pwa-authorized]")).toBeVisible();
    await expect(page.locator(".native-planet-launch")).toBeHidden();
    await page.locator('[data-atlas-action="toggle-search"]').click();
    // This exact canonical writer/work passes both the writer-panel and the
    // enriched book publication selectors (verifiedBookSupplements.ts).
    await page.locator("#country-search").fill("Galsworthy");
    const author = page.locator('#country-results [role="option"]').filter({ hasText: /Голсуорси|Galsworthy/iu }).first();
    await expect(author).toBeVisible();
    await author.click();
    if (isMobile) {
      const toggle = page.locator(".atlas-country-sheet-toggle");
      if (await toggle.getAttribute("aria-expanded") === "false") await toggle.click();
    }
    const detail = page.locator(".writer-detail");
    await expect(detail.locator("h4")).toContainText(/Голсуорси|Galsworthy/iu);
    await detail.getByRole("tab", { name: "Биография", exact: true }).click();
    await expect(detail.getByRole("tabpanel")).toBeVisible();
    expect((await detail.getByRole("tabpanel").innerText()).trim().length).toBeGreaterThan(120);
    await detail.getByRole("tab", { name: "Произведения и награды", exact: true }).click();
    const work = detail.getByRole("button", { name: "Книжный архив: Сага о Форсайтах", exact: true });
    await expect(work).toBeVisible();
    await work.click();
    await expect(page.locator("#book-archive-detail")).toBeVisible({ timeout: 30_000 });
    await expect.poll(() => new URL(page.url()).searchParams.get("book")).toBe("england:john_galsworthy:the-forsyte-saga");
    await expect(page.locator(".book-detail-copy h3")).not.toBeEmpty();
    await expect(page.locator("[data-pwa-authorized]")).toBeVisible();
    // Persisted recent IDs must restore the real canonical writer after a cold
    // offline document load, without a second search or copied catalog.
    await page.reload();
    const recent = page.locator("[data-recent-history]");
    await expect(recent).toBeVisible({ timeout: 30_000 });
    await recent.locator("summary").click();
    const previousWriter = recent.locator("[data-recent-entry]").filter({ hasText: /Голсуорси|Galsworthy/iu }).filter({ has: page.locator("span", { hasText: "Автор" }) });
    await expect(previousWriter).toHaveCount(1);
    await previousWriter.click();
    if (isMobile) {
      const toggle = page.locator(".atlas-country-sheet-toggle");
      if (await toggle.getAttribute("aria-expanded") === "false") await toggle.click();
    }
    await expect(page.locator(".writer-detail h4")).toBeVisible();
    await expect(page.locator(".writer-detail h4")).toContainText(/Голсуорси|Galsworthy/iu);
  } finally { await context.setOffline(false); }
});

test("cold offline Dostoevsky enrichment preserves writer, works tab and actual scene across RU/EN", async ({ page, context, request, isMobile }, testInfo) => {
  const config = await readQaConfiguration();
  const requests = [], fetchAttempts = [];
  page.on("request", request => requests.push(request.url()));
  // Observe real fetch calls, including attempts rejected by CSP/offline mode;
  // the original transport and response remain unchanged.
  await page.addInitScript(() => {
    window.__pwaCatalogObservedFetches = [];
    const original = window.fetch;
    window.fetch = function(input, options) {
      const source = typeof input === "string" || input instanceof URL ? input : input.url;
      try { window.__pwaCatalogObservedFetches.push(new URL(source, location.href).href); } catch { /* Native fetch still handles malformed input. */ }
      return Reflect.apply(original, this, [input, options]);
    };
  });
  await prepare(page, request);
  fetchAttempts.push(...await page.evaluate(() => window.__pwaCatalogObservedFetches));
  await context.setOffline(true);
  let original;
  try {
    // New offline document: no writer search or warm book-runtime import first.
    await page.goto("/planet/ru/?country=russia&writer=dostoevsky#atlas");
    await expect(page.locator("[data-pwa-authorized]")).toBeVisible();
    const savedVerification = page.locator('[data-pwa-access-verification="saved"]');
    await expect(savedVerification).toHaveText("Используется сохранённое подтверждение доступа.");
    await expect(savedVerification).toHaveAttribute("role", "status");
    await expect(page.locator("#atlas .literary-globe")).toHaveAttribute("data-globe-webgl-context", "ready", { timeout: 45_000 });
    await expect(page.locator(".native-planet-launch")).toBeHidden();
    await expect(page.locator("#atlas canvas")).toHaveCount(1);
    await expect(page.locator("canvas")).toHaveCount(1);
    if (isMobile) {
      const toggle = page.locator(".atlas-country-sheet-toggle");
      if (await toggle.getAttribute("aria-expanded") === "false") await toggle.click();
    }
    const detail = page.locator(".writer-detail");
    await expect(detail.locator("h4")).toContainText("Достоевский");
    await detail.getByRole("tab", { name: "Произведения и награды", exact: true }).click();
    const worksTab = detail.locator('#writer-biography-russia-tab-works');
    const worksPanel = detail.locator('#writer-biography-russia-panel-works');
    // Exact publication-gated titles from the same canonical enriched record;
    // these are asserted independently of whatever text the UI currently emits.
    const titles = { ru: "Преступление и наказание", en: "Crime and Punishment" };
    await expect(worksPanel.getByRole("button", { name: "Книжный архив: " + titles.ru, exact: true })).toBeVisible({ timeout: 30_000 });
    await expect.poll(() => page.evaluate(() => typeof window.__literaryPlanetQaScenes)).toBe("function");
    original = await page.evaluateHandle(() => ({
      document, detail: document.querySelector(".writer-detail"),
      tab: document.getElementById("writer-biography-russia-tab-works"),
      panel: document.getElementById("writer-biography-russia-panel-works"),
      scene: window.__literaryPlanetQaScenes().find(item => document.querySelector("#atlas").contains(item.canvas)),
    }));
    expect(await original.evaluate(value => Boolean(value.detail && value.tab && value.panel && value.scene?.canvas && value.scene.renderer && value.scene.camera && value.scene.scene))).toBe(true);
    for (const locale of ["en", "ru"]) {
      await page.locator(".atlas-immersive-chrome .interface-language-control button").filter({ hasText: locale.toUpperCase() }).click();
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect(savedVerification).toHaveText(locale === "ru"
        ? "Используется сохранённое подтверждение доступа."
        : "Using saved access verification.");
      await expect.poll(() => new URL(page.url()).pathname).toBe("/planet/" + locale + "/");
      expect(new URL(page.url()).searchParams.get("country")).toBe("russia");
      expect(new URL(page.url()).searchParams.get("writer")).toBe("dostoevsky");
      await expect(detail.locator("h4")).toContainText(locale === "ru" ? "Достоевский" : "Dostoevsky");
      await expect(worksTab).toHaveAttribute("aria-selected", "true");
      await expect(worksPanel).toBeVisible();
      await expect(worksPanel.getByRole("button", { name: (locale === "ru" ? "Книжный архив: " : "Book archive: ") + titles[locale], exact: true })).toBeVisible();
      await expect(page.locator("#atlas canvas")).toHaveCount(1);
      await expect(page.locator("canvas")).toHaveCount(1);
      expect(await original.evaluate(previous => {
        const current = window.__literaryPlanetQaScenes().find(item => item.canvas === previous.scene.canvas);
        return previous.document === document && previous.detail === document.querySelector(".writer-detail")
          && previous.tab === document.getElementById("writer-biography-russia-tab-works")
          && previous.panel === document.getElementById("writer-biography-russia-panel-works")
          && previous.scene.canvas.isConnected && current?.renderer === previous.scene.renderer
          && current?.camera === previous.scene.camera && current?.scene === previous.scene.scene;
      })).toBe(true);
    }
    await worksPanel.getByRole("button", { name: "Книжный архив: " + titles.ru, exact: true }).click();
    const book = page.locator("#book-archive-detail");
    await expect(book).toBeVisible({ timeout: 30_000 });
    await expect.poll(() => new URL(page.url()).searchParams.get("book")).toBe("russia:dostoevsky:crime-and-punishment");
    await expect(book.locator(".book-detail-copy h3")).toHaveText(titles.ru);
    await expect(page.locator("[data-pwa-authorized]")).toBeVisible();
    await expect(page.locator(".literary-news-slot")).toHaveCount(0);
    await expect(page.locator(".literary-news")).toHaveCount(0);
    fetchAttempts.push(...await page.evaluate(() => window.__pwaCatalogObservedFetches));
    const observed = [...new Set([...requests, ...fetchAttempts])];
    const external = observed.filter(url => /^https?:/u.test(url) && new URL(url).origin !== config.origin);
    const remoteDelivery = observed.filter(url => /literary-news|book_dossier|book-dossier/iu.test(url));
    expect(external).toEqual([]);
    expect(remoteDelivery).toEqual([]);
    await testInfo.attach("dostoevsky-offline-locale-evidence", { body: JSON.stringify({
      scope: "actual local QA artifact", book: "russia:dostoevsky:crime-and-punishment", titles,
      locales: ["ru", "en", "ru"], coldOffline: true, sameDocument: true, sameWriterDetail: true,
      sameWorksTab: true, sameWorksPanel: true, sameCanvas: true, sameRenderer: true, sameCamera: true,
      sameScene: true, externalRequests: external, remoteNewsOrDossierRequests: remoteDelivery,
    }), contentType: "application/json" });
  } finally { await original?.dispose(); await context.setOffline(false); }
});

test("canonical book favorite survives cold offline reload and locale route change", async ({ page, context, request }, testInfo) => {
  await observeProductScrolling(page);
  await prepare(page, request);
  await context.setOffline(true);
  let scene;
  try {
    await page.goto("/planet/ru/");
    scene = await actualGlobe(page);
    await expect(page.locator(".native-planet-panel")).toBeHidden();
    await page.locator('[data-atlas-action="open-collection"]').click();
    const collection = page.locator(".native-planet-panel");
    await expect(collection).toBeVisible();
    await expect(collection).toHaveAttribute("role", "dialog");
    await expect(page.locator(".interface-language-control")).toHaveCount(1);
    await panelNoticeLayout(page);
    const coverImages = await verifiedCoverImages(page, collection);
    await testInfo.attach("canonical-offline-cover-images", { body: JSON.stringify({ localQaOnly: true, coverImages }), contentType: "application/json" });
    const item = page.locator(".archive-book-detail").first();
    await expect(item).toBeVisible({ timeout: 30_000 });
    await item.click();
    const detail = page.locator("#book-archive-detail");
    await expect(detail).toBeVisible();
    await selectedWorkInViewport(page, detail, testInfo, "warm-ru");
    await retainedGlobe(page, scene);
    await page.screenshot({ path: testInfo.outputPath("pwa-collection-ru-book.png"), fullPage: false });
    // Opening a book updates canonical history without rendering Help. Both
    // native account links must capture this new selection when used.
    const help = collection.locator(".pwa-help");
    await expect(help).toBeVisible();
    await help.locator("summary").click();
    for (const name of ["Восстановить доступ", "Заявка на удаление аккаунта"]) {
      const accountLink = help.getByRole("link", { name, exact: true });
      await accountLink.focus();
      const target = new URL(await accountLink.getAttribute("href"));
      const current = new URL(page.url());
      expect(target.origin).toBe("https://probpera.ru");
      expect(target.searchParams.get("returnTo")).toBe(current.pathname + current.search + current.hash);
    }
    await help.locator("summary").click();
    const favorite = detail.getByRole("button", { name: "В избранное", exact: true });
    await favorite.click();
    await expect(detail.getByRole("button", { name: "В избранном", exact: true })).toHaveAttribute("aria-pressed", "true");
    const selected = new URL(page.url());
    expect(selected.searchParams.get("book")).toBeTruthy();
    const title = (await detail.locator(".book-detail-copy h3").innerText()).trim();
    await collection.locator(".book-detail-close").click();
    await expect(detail).toBeHidden();
    await expect(collection).toBeVisible();
    await retainedGlobe(page, scene);
    await collection.getByRole("button", { name: "Вернуться к планете", exact: true }).click();
    await expect(collection).toBeHidden();
    await expect.poll(() => new URL(page.url()).searchParams.get("book")).toBeNull();
    await retainedGlobe(page, scene);
    await page.locator('[data-atlas-action="open-collection"]').click();
    await collection.locator('.archive-book-detail[data-book-key=' + JSON.stringify(selected.searchParams.get("book")) + ']').click();
    await expect(detail).toBeVisible();
    await expect(detail.getByRole("button", { name: "В избранном", exact: true })).toHaveAttribute("aria-pressed", "true");
    await retainedGlobe(page, scene);
    await scene.dispose();
    scene = undefined;
    await page.reload();
    scene = await actualGlobe(page);
    await expect(page.locator("#book-archive-detail")).toBeVisible({ timeout: 30_000 });
    await selectedWorkInViewport(page, detail, testInfo, "cold-ru");
    await expect(page.locator("#book-archive-detail .book-detail-copy h3")).toHaveText(title);
    await expect(page.locator("#book-archive-detail").getByRole("button", { name: "В избранном", exact: true })).toHaveAttribute("aria-pressed", "true");
    await scene.dispose();
    scene = undefined;
    await page.goto("/planet/en/" + selected.search + selected.hash);
    scene = await actualGlobe(page);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("#book-archive-detail")).toBeVisible({ timeout: 30_000 });
    await selectedWorkInViewport(page, detail, testInfo, "cold-en");
    await panelNoticeLayout(page);
    expect(new URL(page.url()).searchParams.get("book")).toBe(selected.searchParams.get("book"));
    await expect(page.locator("#book-archive-detail .book-detail-actions button.is-saved").filter({ has: page.locator(".brand-heart-icon") })).not.toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath("pwa-collection-en-book.png"), fullPage: false });
    await help.locator("summary").click();
    await expect(help.getByRole("heading", { name: "Reading offline", exact: true })).toBeVisible();
    await expect(help.getByRole("heading", { name: "Data on this device", exact: true })).toBeVisible();
    await expect(help.getByRole("link", { name: "Email support", exact: true })).toHaveAttribute("href", "mailto:probperasite@yandex.ru");
    const restore = new URL(await help.getByRole("link", { name: "Restore access", exact: true }).getAttribute("href"));
    expect(restore.origin).toBe("https://probpera.ru");
    expect(restore.searchParams.get("returnTo")).toBe("/planet/en/" + selected.search + selected.hash);
    await page.screenshot({ path: testInfo.outputPath("pwa-collection-en-help.png"), fullPage: false });
    const selectedBook = await page.locator("#book-archive-detail").elementHandle();
    await expect(page.locator(".interface-language-control")).toHaveCount(1);
    await collection.locator(".native-planet-panel__header .interface-language-control button").filter({ hasText: "RU" }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "ru");
    await expect.poll(() => new URL(page.url()).pathname).toBe("/planet/ru/");
    await expect(help.getByRole("heading", { name: "Чтение без сети", exact: true })).toBeVisible();
    await expect(help.locator("details")).toHaveAttribute("open", "");
    await panelNoticeLayout(page);
    expect(await page.locator("#book-archive-detail").evaluate((node, previous) => node === previous, selectedBook)).toBe(true);
    await retainedGlobe(page, scene);
    await selectedBook.dispose();
    await page.screenshot({ path: testInfo.outputPath("pwa-collection-ru-help.png"), fullPage: false });
    const recent = page.locator("[data-recent-history]");
    await recent.locator("summary").click();
    await expect(recent.locator("[data-recent-entry]")).not.toHaveCount(0);
    await recent.locator("[data-recent-clear]").click();
    await expect(recent.locator("[data-recent-entry]")).toHaveCount(0);
    await expect(recent.locator("[data-recent-clear]")).toBeDisabled();
    await expect(page.locator("#book-archive-detail").getByRole("button", { name: "В избранном", exact: true })).toHaveAttribute("aria-pressed", "true");
    await collection.getByRole("button", { name: "Вернуться к планете", exact: true }).click();
    await expect(detail).toBeHidden();
    await expect(collection).toBeHidden();
    await expect.poll(() => new URL(page.url()).searchParams.get("book")).toBeNull();
    await retainedGlobe(page, scene);
    await expect(page.locator(".interface-language-control")).toHaveCount(1);
    await expect(page.locator(".atlas-immersive-chrome .interface-language-control")).toBeVisible();
    await testInfo.attach("canonical-pwa-collection-evidence", { body: JSON.stringify({
      localQaOnly: true, selectedBook: selected.searchParams.get("book"), coldOffline: true,
      singleCanvasPerDocument: true, sameCanvasRendererCameraSceneAcrossCollectionAndLocale: true,
      sameBookDetailAcrossLocale: true, helpOpenStateAcrossLocale: true,
      singleSharedLanguageControl: true, closeFlows: ["detail then collection", "top return while detail open"],
      noticeSlotAboveContent: true, selectedWorkRevealedInViewport: true, coverImages,
    }), contentType: "application/json" });
    await page.screenshot({ path: testInfo.outputPath("pwa-offline-collection-return.png"), fullPage: false });
  } finally { await scene?.dispose(); await context.setOffline(false); }
});

test("recent writer opens outside the active country filter without replacing the globe", async ({ page, context, request, isMobile }) => {
  await prepare(page, request);
  await context.setOffline(true);
  try {
    // These IDs come from the current canonical albania.ts record.
    await page.goto("/planet/ru/?country=albania&writer=ismail_kadare#atlas");
    await expect(page.locator('[data-atlas-country="albania"]')).toHaveCount(1);
    if (isMobile) {
      const toggle = page.locator(".atlas-country-sheet-toggle");
      if (await toggle.getAttribute("aria-expanded") === "false") await toggle.click();
    }
    await expect(page.locator(".writer-detail h4")).toBeVisible();
    await expect(page.locator(".writer-detail h4")).toContainText("Кадаре");
    await expect(page.locator("#atlas canvas")).toBeVisible();
    const canvas = await page.locator("#atlas canvas").elementHandle();
    await page.locator('[data-atlas-action="toggle-filters"]').click();
    const filter = page.locator('[data-atlas-filter="nobel"]');
    await filter.click();
    await expect(filter).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator('[data-atlas-country="albania"]')).toHaveCount(0);
    await page.locator('[data-atlas-action="open-collection"]').click();
    const recent = page.locator("[data-recent-history]");
    await recent.locator("summary").click();
    const writer = recent.locator("[data-recent-entry]").filter({ hasText: "Кадаре" }).filter({ has: page.locator("span", { hasText: "Автор" }) });
    await expect(writer).toHaveCount(1);
    await writer.click();
    await expect(page.locator('[data-atlas-filter="all"]')).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator('[data-atlas-country="albania"]')).toHaveCount(1);
    if (isMobile) {
      const toggle = page.locator(".atlas-country-sheet-toggle");
      if (await toggle.getAttribute("aria-expanded") === "false") await toggle.click();
    }
    await expect(page.locator(".writer-detail h4")).toBeVisible();
    await expect(page.locator(".writer-detail h4")).toContainText("Кадаре");
    await expect.poll(() => new URL(page.url()).searchParams.get("writer")).toBe("ismail_kadare");
    expect(await page.locator("#atlas canvas").evaluate((node, original) => node === original, canvas)).toBe(true);
    await canvas.dispose();
  } finally { await context.setOffline(false); }
});
