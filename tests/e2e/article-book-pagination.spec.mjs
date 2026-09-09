import { expect, test } from "@playwright/test";
import { articleFromSitemap } from "./helpers/article-route.mjs";

const preferred = "/15-krylatyh-vyrazheniy-prishedshih-k-niz-biblii/";
const bookSelector = "[data-article-book-reader]";
async function ready(book) {
  await expect(book).toHaveAttribute("data-renderer", "three");
  await expect(book).toHaveAttribute("data-book-ready", "true", { timeout: 90000 });
  await expect(book.getByRole("combobox", { name: "Страница", exact: true })).toBeEnabled();
}

// Full text, illustrations, page boundaries and physical dragging are covered by
// main's article-book-reading and article-book-zoom suites. These cover integration.
test("canonical book keeps the source fragment through reflow, sizing, mode changes and reopening", async ({ page, request, baseURL }) => {
  test.setTimeout(150000);
  await page.addInitScript(() => localStorage.setItem("probpera-display-mode", "light"));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(await articleFromSitemap(request, baseURL, preferred));
  const content = page.locator(".article-reader-content");
  await expect(content).toBeVisible();
  const originalText = await content.textContent();
  await page.getByRole("button", { name: "Режим печатной книги", exact: true }).click();
  const book = page.locator(bookSelector);
  await ready(book);
  await book.getByRole("combobox", { name: "Страница", exact: true }).selectOption("2");
  await expect(book).toHaveAttribute("data-page-index", "2");
  await ready(book);
  await book.locator("summary").click();
  const semantic = book.locator("[data-article-book-page]");
  const fragment = (await semantic.innerText()).trim().slice(0, 24);
  const anchor = await book.getAttribute("data-reading-anchor");
  expect(anchor).toMatch(/^article-book:v1:ru:[a-z0-9-]+:\d+$/u);
  const initialCount = Number(await book.getAttribute("data-page-count"));
  await page.setViewportSize({ width: 320, height: 844 });
  await expect.poll(async () => Number(await book.getAttribute("data-page-count"))).toBeGreaterThan(initialCount);
  await ready(book);
  await expect(book).toHaveAttribute("data-reading-anchor", anchor);
  await expect(semantic).toContainText(fragment, { useInnerText: true });
  const countBeforeFont = Number(await book.getAttribute("data-page-count"));
  await page.getByRole("button", { name: "Увеличить шрифт", exact: true }).click();
  await expect.poll(async () => Number(await book.getAttribute("data-page-count"))).toBeGreaterThan(countBeforeFont);
  await ready(book);
  await expect(book).toHaveAttribute("data-reading-anchor", anchor);
  await expect(semantic).toContainText(fragment, { useInnerText: true });
  await page.getByRole("button", { name: "Светлый режим", exact: true }).click();
  await expect(book).toHaveCount(0);
  await expect(content).toHaveText(originalText);
  await page.getByRole("button", { name: "Режим печатной книги", exact: true }).click();
  await ready(book);
  await expect(book).toHaveAttribute("data-reading-anchor", anchor);
  await book.locator("summary").click();
  await expect(semantic).toContainText(fragment, { useInnerText: true });
  const address = page.url();
  await page.getByRole("button", { name: "Закрыть", exact: true }).click();
  await expect(page.locator(".article-reader")).toHaveCount(0);
  await page.goto(address);
  // The initialization above fixes the first entry mode; the stored anchor still
  // restores when the reader explicitly chooses the canonical book again.
  await expect(content).toBeVisible();
  await page.getByRole("button", { name: "Режим печатной книги", exact: true }).click();
  await ready(book);
  await expect(book).toHaveAttribute("data-reading-anchor", anchor);
  await book.locator("summary").click();
  await expect(semantic).toContainText(fragment, { useInnerText: true });
  await expect(content).toHaveText(originalText);

  const progressKey = `article:${await page.locator(".article-reader").getAttribute("data-cms-entity-id")}`;
  const storedProgress = () => page.evaluate(key => JSON.parse(localStorage.getItem("probpera-reading-progress") || "{}")[key], progressKey);
  await expect.poll(async () => (await storedProgress())?.positionHint).toBe(anchor);
  await page.getByRole("button", { name: "Светлый режим", exact: true }).click();
  await expect(content).toBeVisible();
  const beforeWheel = await storedProgress();
  await page.locator(".article-reader-scroll").hover();
  await page.mouse.wheel(0, 1200);
  await expect.poll(async () => (await storedProgress())?.progress).toBeGreaterThan(beforeWheel.progress);
  await expect.poll(async () => (await storedProgress())?.positionHint).not.toBe(anchor);

  await page.getByRole("button", { name: "Режим печатной книги", exact: true }).click();
  await ready(book);
  await book.focus();
  await page.keyboard.press("End");
  await expect(book.getByRole("button", { name: "Следующая страница", exact: true })).toBeDisabled();
  await expect.poll(async () => (await storedProgress())?.progress).toBe(100);
  await page.getByRole("button", { name: "Закрыть", exact: true }).click();
  await expect(page.locator(".article-reader")).toHaveCount(0);
  await page.goto(address);
  await expect(content).toBeVisible();
  await page.getByRole("button", { name: "Режим печатной книги", exact: true }).click();
  await ready(book);
  await expect(book).toHaveAttribute("data-page-index", "0");
  await expect(book.getByRole("button", { name: "Предыдущая страница", exact: true })).toBeDisabled();
  await expect(book).not.toHaveAttribute("data-reading-anchor", "article-book:v1:ru:end:0");
});

test("archive CTA opens the canonical book and reader metrics and layers preserve focus", async ({ page, request, baseURL }) => {
  test.setTimeout(120000);
  const article = await articleFromSitemap(request, baseURL, preferred);
  const journal = new URL(article);
  journal.pathname = `${journal.pathname.split("/stati/")[0]}/`;
  journal.hash = "journal";
  await page.addInitScript(() => localStorage.setItem("probpera-display-mode", "light"));
  await page.goto(journal.href);
  await page.locator("#journal").evaluate(element => element.scrollIntoView({ block: "start", behavior: "instant" }));
  const archive = page.locator('#journal[data-typography-component="journal"]');
  await expect(archive).toBeVisible();
  await archive.scrollIntoViewIfNeeded();
  const trigger = page.locator(".article-library-grid > article > a").first();
  const title = await trigger.locator("h3").innerText();
  const href = await trigger.getAttribute("href");
  await trigger.click();
  const reader = page.locator(".article-reader");
  await expect(reader).toHaveClass(/\bis-book\b/u);
  await expect(page.locator("#article-reader-title")).toHaveText(title);
  expect(new URL(page.url()).pathname).toBe(new URL(href, journal).pathname);
  const book = page.locator(bookSelector);
  await ready(book);
  await expect(book).toHaveCount(1);
  await expect(page.locator(".article-book-viewport,.article-book-navigation")).toHaveCount(0);
  await page.getByRole("button", { name: "Светлый режим", exact: true }).click();
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: width < 500 ? 844 : 1000 });
    const metrics = await page.locator(".article-reader-metrics").evaluate(panel => ({
      overflow: panel.scrollWidth - panel.clientWidth,
      cells: [...panel.children].map(cell => ({ height: cell.getBoundingClientRect().height, size: parseFloat(getComputedStyle(cell).fontSize) })),
      languageWeights: [...document.querySelectorAll(".article-reader-bar .interface-language-control button")].map(button => getComputedStyle(button).fontWeight),
    }));
    expect(metrics.overflow).toBeLessThanOrEqual(1);
    expect(metrics.languageWeights).toEqual(["400", "400"]);
    expect(metrics.cells.every(cell => cell.height >= 84 && cell.size >= 13)).toBe(true);
  }
  const image = page.getByRole("button", { name: "Открыть главное изображение", exact: true });
  if (await image.count()) {
    await image.click();
    await expect(page.locator(".article-media-viewer")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(".article-media-viewer")).toHaveCount(0);
    await expect(reader).toBeVisible();
    await expect(image).toBeFocused();
  }
  await page.locator(".reader-back").focus();
  await page.keyboard.press("Shift+Tab");
  expect(await reader.evaluate(element => element.contains(document.activeElement))).toBe(true);
  await page.getByRole("button", { name: "Закрыть", exact: true }).click();
  await expect(reader).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
});
