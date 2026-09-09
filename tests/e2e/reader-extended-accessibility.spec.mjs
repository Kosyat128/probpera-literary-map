import { expect, test } from "@playwright/test";
import { articleFromSitemap } from "./helpers/article-route.mjs";

test.use({ serviceWorkers: "block" });
const preferred = "/15-krylatyh-vyrazheniy-prishedshih-k-niz-biblii/";

test("disabled community runtime exposes honest state and preserves form text without writes", async ({ page, request, baseURL }, testInfo) => {
  const writes = [];
  await page.route(/\/(?:rest|auth)\/v1\//u, route => {
    if (!["GET", "HEAD", "OPTIONS"].includes(route.request().method())) writes.push(route.request().method());
    return route.abort();
  });
  const article = await articleFromSitemap(request, baseURL, preferred);
  await page.goto(article);
  const engagement = page.locator(".article-reader-finish .engagement-card");
  await expect(engagement).toHaveClass(/is-pending/u);
  await expect(engagement).toContainText("Оценки и комментарии пока недоступны.");
  await expect(engagement.locator("button,textarea,input")).toHaveCount(0);
  await engagement.screenshot({ path: testInfo.outputPath("community-disabled.png") });
  const homepage = new URL(article);
  homepage.pathname = `${homepage.pathname.split("/stati/")[0]}/`;
  await page.goto(homepage.href);
  await page.locator(".site-header .reader-button").click();
  const dialog = page.locator('.community-hub[role="dialog"]');
  const email = dialog.getByLabel("Электронная почта");
  await email.fill("reader-fixture@example.test");
  const submit = dialog.locator("form.auth-form").getByRole("button", { name: "Войти", exact: true });
  await expect(submit).toBeDisabled();
  await submit.evaluate(button => { button.click(); button.click(); });
  await expect(email).toHaveValue("reader-fixture@example.test");
  const tabs = dialog.getByRole("navigation", { name: "Разделы сообщества" });
  await tabs.getByRole("button", { name: "Форум", exact: true }).click();
  await tabs.getByRole("button", { name: "Вход и регистрация" }).click();
  await expect(email).toHaveValue("reader-fixture@example.test");
  await expect(submit).toBeDisabled();
  await dialog.screenshot({ path: testInfo.outputPath("auth-disabled-preserved.png") });
  expect(writes).toEqual([]);
});

test("real reader and canonical semantic page retain expanded text spacing", async ({ page, request, baseURL }, testInfo) => {
  test.setTimeout(120000);
  await page.addInitScript(() => localStorage.setItem("probpera-display-mode", "light"));
  await page.goto(await articleFromSitemap(request, baseURL, preferred));
  const content = page.locator(".article-reader-content");
  await expect(content).toBeVisible();
  const originalText = await content.textContent();
  await page.addStyleTag({ content: `
    :is(.article-reader-content,.article-book-reader__text) :is(p,li,h2,h3,h4,blockquote,figcaption,a) {
      line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important;
    }
    :is(.article-reader-content,.article-book-reader__text) p { margin-bottom: 2em !important; }
  ` });
  const evidence = [];
  const inspect = async selector => page.locator(selector).evaluate(element => {
    const reader = element.closest(".article-reader");
    const style = getComputedStyle(element.querySelector("p"));
    return {
      width: innerWidth,
      readerOverflow: reader.scrollWidth - reader.clientWidth,
      barOverflow: reader.querySelector(".article-reader-bar").scrollWidth - reader.querySelector(".article-reader-bar").clientWidth,
      contentOverflow: element.scrollWidth - element.clientWidth,
      lineHeight: parseFloat(style.lineHeight) / parseFloat(style.fontSize),
      letterSpacing: parseFloat(style.letterSpacing) / parseFloat(style.fontSize),
      wordSpacing: parseFloat(style.wordSpacing) / parseFloat(style.fontSize),
    };
  });
  const assertSpacing = geometry => {
    evidence.push(geometry);
    expect(geometry.readerOverflow).toBeLessThanOrEqual(1);
    expect(geometry.barOverflow).toBeLessThanOrEqual(1);
    expect(geometry.contentOverflow).toBeLessThanOrEqual(1);
    expect(geometry.lineHeight).toBeCloseTo(1.5, 1);
    expect(geometry.letterSpacing).toBeCloseTo(.12, 2);
    expect(geometry.wordSpacing).toBeCloseTo(.16, 2);
  };
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width < 500 ? 844 : 1000 });
    assertSpacing(await inspect(".article-reader-content"));
    await expect(content).toHaveText(originalText);
    await page.locator(".article-reader-bar").screenshot({ path: testInfo.outputPath(`text-spacing-controls-${width}.png`) });
  }
  await page.getByRole("button", { name: "Режим печатной книги", exact: true }).click();
  const book = page.locator("[data-article-book-reader]");
  await expect(book).toHaveAttribute("data-book-ready", "true", { timeout: 90000 });
  const select = book.getByRole("combobox", { name: "Страница", exact: true });
  await expect(select).toBeEnabled();
  await select.selectOption("2");
  await expect(book).toHaveAttribute("data-page-index", "2");
  await book.locator("summary").click();
  await expect(book.locator("[data-article-book-page] p").first()).toBeVisible();
  assertSpacing(await inspect("[data-article-book-page]"));
  await expect(content).toHaveText(originalText);
  await expect(select).toBeVisible();
  await book.locator(".article-book-reader__text").screenshot({ path: testInfo.outputPath("semantic-text-spacing-390.png") });
  await testInfo.attach("text-spacing.json", { body: JSON.stringify(evidence, null, 2), contentType: "application/json" });
});
test("request-only complex table and verse retain semantic contents and keyboard scrolling", async ({ page, request, baseURL }, testInfo) => {
  const verse = "First fixture line\nSecond fixture line\nThird fixture line";
  const fixture = `<section id="e2e-complex-reader"><h2 id="e2e-complex-title">Local reading fixture</h2>
    <p id="e2e-verse">First fixture line<br>Second fixture line<br>Third fixture line</p>
    <table id="e2e-wide-table"><caption>Local wide table fixture</caption><thead><tr>${Array.from({length: 6}, (_, i) => `<th>Column ${i + 1}</th>`).join("")}</tr></thead><tbody>${Array.from({length: 3}, (_, row) => `<tr>${Array.from({length: 6}, (_, col) => `<td>Row ${row + 1}, item ${col + 1}</td>`).join("")}</tr>`).join("")}</tbody></table>
    <p id="e2e-fixture-end">Local fixture ending.</p></section>`;
  let intercepted = 0;
  await page.route(/\/articles\/[^?]+\.json(?:\?.*)?$/u, async route => {
    if (route.request().resourceType() !== "fetch") return route.continue();
    const response = await route.fetch();
    const document = await response.json();
    if (typeof document.contentHtml !== "string") return route.fulfill({ response });
    intercepted += 1;
    return route.fulfill({ response, json: { ...document, contentHtml: `${document.contentHtml}${fixture}` } });
  });
  await page.goto(process.env.UI_POLISH_ARTICLE_URL || await articleFromSitemap(request, baseURL, preferred));
  await expect.poll(() => intercepted).toBeGreaterThan(0);
  const poem = page.locator("#e2e-verse");
  await expect(poem).toBeVisible();
  expect(intercepted).toBeGreaterThan(0);
  await expect(poem).toHaveText(verse.replaceAll("\n", ""));
  expect(await poem.innerText()).toBe(verse);
  await expect(poem.locator("br")).toHaveCount(2);
  const table = page.locator("#e2e-wide-table");
  await expect(table.locator("th")).toHaveCount(6);
  await expect(table.locator("td")).toHaveCount(18);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width < 500 ? 844 : 1000 });
    await table.scrollIntoViewIfNeeded();
    expect(await table.evaluate(element => element.getBoundingClientRect().right <= innerWidth + 1)).toBe(true);
    if (width === 390) {
      expect(await table.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);
      await table.focus();
      await expect(table).toBeFocused();
      await page.keyboard.press("ArrowRight");
      await expect.poll(() => table.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
    }
    await table.screenshot({ path: testInfo.outputPath(`table-${width}.png`) });
  }
  await expect(poem).toHaveText(verse.replaceAll("\n", ""));
  await expect(page.locator("#e2e-fixture-end")).toHaveText("Local fixture ending.");
});

test("print media exposes the full source once and preserves canonical book position", async ({ page, request, baseURL }, testInfo) => {
  test.setTimeout(120000);
  await page.addInitScript(() => localStorage.setItem("probpera-display-mode", "light"));
  await page.goto(await articleFromSitemap(request, baseURL, preferred));
  const content = page.locator(".article-reader-content");
  await expect(content).toBeVisible();
  const originalText = await content.textContent();
  await page.getByRole("button", { name: "Режим печатной книги", exact: true }).click();
  const book = page.locator("[data-article-book-reader]");
  await expect(book).toHaveAttribute("data-book-ready", "true", { timeout: 90000 });
  await expect(book).toHaveAttribute("data-page-index", "0");
  await expect(book).toHaveAttribute("data-reading-anchor", /^article-book:v1:/u);
  const savedPosition = await book.getAttribute("data-reading-anchor");
  const readStoredPosition = () => page.evaluate(() => Object.values(JSON.parse(localStorage.getItem("probpera-reading-progress") || "{}"))
    .map(entry => ({ progress: entry.progress, positionHint: entry.positionHint })));
  const storedPosition = await readStoredPosition();
  await page.emulateMedia({ media: "print" });
  await expect(content).toBeVisible();
  await expect(book).toBeHidden();
  const geometry = await page.locator(".article-reader").evaluate(reader => {
    const content = reader.querySelector(".article-reader-content");
    return {
      textLength: content.textContent.length,
      contentHeight: content.getBoundingClientRect().height,
      columns: getComputedStyle(content).columnCount,
      rendererDisplay: getComputedStyle(reader.querySelector("[data-article-book-reader]")).display,
      readerPosition: getComputedStyle(reader).position,
      scrollOverflow: getComputedStyle(reader.querySelector(".article-reader-scroll")).overflowY,
      scrollHeight: reader.querySelector(".article-reader-scroll").scrollHeight,
      clientHeight: reader.querySelector(".article-reader-scroll").clientHeight,
    };
  });
  await testInfo.attach("print-media.json", { body: JSON.stringify(geometry, null, 2), contentType: "application/json" });
  await page.screenshot({ path: testInfo.outputPath("print-media.png") });
  await expect(content).toHaveText(originalText);
  expect(geometry.rendererDisplay).toBe("none");
  expect(geometry.columns).toBe("auto");
  expect(geometry.contentHeight).toBeGreaterThan(1000);
  expect(geometry.readerPosition, "the reader shell must not clip the printed article").not.toBe("fixed");
  expect(geometry.scrollOverflow).toBe("visible");
  expect(geometry.scrollHeight - geometry.clientHeight).toBeLessThanOrEqual(1);
  await expect(book).toHaveAttribute("data-reading-anchor", savedPosition);
  await page.emulateMedia({ media: "screen" });
  await expect(book).toBeVisible();
  await expect(content).toBeHidden();
  await expect(book).toHaveAttribute("data-page-index", "0");
  await expect(book).toHaveAttribute("data-reading-anchor", savedPosition);
  expect(await readStoredPosition()).toEqual(storedPosition);
});
