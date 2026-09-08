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

test("cold offline writer biography and works use the canonical catalog", async ({ page, context, request, isMobile }) => {
  await prepare(page, request);
  await context.setOffline(true);
  try {
    await page.reload();
    await expect(page.locator("[data-pwa-authorized]")).toBeVisible();
    await page.locator(".global-search-trigger").click();
    // This exact canonical writer/work passes both the writer-panel and the
    // enriched book publication selectors (verifiedBookSupplements.ts).
    await page.locator(".global-search").getByRole("searchbox").fill("Galsworthy");
    const author = page.locator(".global-search-results button").filter({ hasText: /Голсуорси|Galsworthy/iu }).first();
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
    await page.locator("#atlas").scrollIntoViewIfNeeded();
    await expect(page.locator("#atlas .literary-globe")).toHaveAttribute("data-globe-webgl-context", "ready", { timeout: 45_000 });
    await expect(page.locator("#atlas canvas")).toHaveCount(1);
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
      await page.locator(".site-header .interface-language-control button").filter({ hasText: locale.toUpperCase() }).click();
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

test("canonical book favorite survives cold offline reload and locale route change", async ({ page, context, request }) => {
  await prepare(page, request);
  await context.setOffline(true);
  try {
    await page.goto("/planet/ru/#books");
    await expect(page.locator("[data-pwa-authorized]")).toBeVisible();
    const catalog = page.getByRole("button", { name: "Каталог", exact: true });
    await expect(catalog).toBeVisible({ timeout: 30_000 });
    await catalog.click();
    const item = page.locator(".archive-book-detail").first();
    await expect(item).toBeVisible({ timeout: 30_000 });
    await item.click();
    const detail = page.locator("#book-archive-detail");
    await expect(detail).toBeVisible();
    // Opening a book updates canonical history without rendering Help. Both
    // native account links must capture this new selection when used.
    const help = page.locator(".pwa-help");
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
    await page.reload();
    await expect(page.locator("#book-archive-detail")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("#book-archive-detail .book-detail-copy h3")).toHaveText(title);
    await expect(page.locator("#book-archive-detail").getByRole("button", { name: "В избранном", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.goto("/planet/en/" + selected.search + selected.hash);
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.locator("#book-archive-detail")).toBeVisible({ timeout: 30_000 });
    expect(new URL(page.url()).searchParams.get("book")).toBe(selected.searchParams.get("book"));
    await expect(page.locator("#book-archive-detail .book-detail-actions button.is-saved").filter({ has: page.locator(".brand-heart-icon") })).not.toHaveCount(0);
    await help.locator("summary").click();
    await expect(help.getByRole("heading", { name: "Reading offline", exact: true })).toBeVisible();
    await expect(help.getByRole("heading", { name: "Data on this device", exact: true })).toBeVisible();
    await expect(help.getByRole("link", { name: "Email support", exact: true })).toHaveAttribute("href", "mailto:probperasite@yandex.ru");
    const restore = new URL(await help.getByRole("link", { name: "Restore access", exact: true }).getAttribute("href"));
    expect(restore.origin).toBe("https://probpera.ru");
    expect(restore.searchParams.get("returnTo")).toBe("/planet/en/" + selected.search + selected.hash);
    const selectedBook = await page.locator("#book-archive-detail").elementHandle();
    await page.locator(".site-header .interface-language-control button").filter({ hasText: "RU" }).click();
    await expect(help.getByRole("heading", { name: "Чтение без сети", exact: true })).toBeVisible();
    await expect(help.locator("details")).toHaveAttribute("open", "");
    expect(await page.locator("#book-archive-detail").evaluate((node, previous) => node === previous, selectedBook)).toBe(true);
    await selectedBook.dispose();
    const recent = page.locator("[data-recent-history]");
    await recent.locator("summary").click();
    await expect(recent.locator("[data-recent-entry]")).not.toHaveCount(0);
    await recent.locator("[data-recent-clear]").click();
    await expect(recent.locator("[data-recent-entry]")).toHaveCount(0);
    await expect(recent.locator("[data-recent-clear]")).toBeDisabled();
    await expect(page.locator("#book-archive-detail").getByRole("button", { name: "В избранном", exact: true })).toHaveAttribute("aria-pressed", "true");
  } finally { await context.setOffline(false); }
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
    const filter = page.locator('[data-atlas-filter="nobel"]');
    await filter.click();
    await expect(filter).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator('[data-atlas-country="albania"]')).toHaveCount(0);
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
