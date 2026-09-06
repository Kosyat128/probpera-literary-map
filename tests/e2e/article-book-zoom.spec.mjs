import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const article = JSON.parse(readFileSync(new URL("../../public/cms/articles/cms-0e262528-70b9-43c4-8160-7cfb5c6b101c.json", import.meta.url), "utf8"));

test("the physical article book enlarges, pans and resets without repagination or accidental page turns", async ({ page, context, request, baseURL, isMobile }, testInfo) => {
  test.setTimeout(90_000);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (/inert/iu.test(message.text()) && ["error", "warning"].includes(message.type())) errors.push(message.text()); });
  let articleUrl;
  for (const prefix of ["", "/probpera-literary-map"]) {
    const response = await request.get(new URL(`${prefix}/${article.documentPath}`, baseURL).href);
    const value = await response.json().catch(() => null);
    if (value?.id === article.id) {
      articleUrl = new URL(prefix + new URL(article.url).pathname, baseURL).href;
      break;
    }
  }
  expect(articleUrl).toBeTruthy();
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem("probpera-interface-language", "ru");
    localStorage.setItem("probpera-display-mode", "dark");
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: isMobile ? 320 : 1440, height: 1000 });
  await page.goto(articleUrl);
  await page.locator(".article-reader-bar").getByRole("button", { name: "Режим печатной книги", exact: true }).click();
  const book = page.locator("[data-article-book-reader]");
  await expect(book).toHaveAttribute("data-book-ready", "true", { timeout: 30_000 });
  await expect(book).toHaveAttribute("data-renderer", "three");
  await book.locator("select").selectOption("2");
  await expect(book.locator("select")).toBeEnabled({ timeout: 15_000 });
  const pageCount = await book.getAttribute("data-page-count");
  const canvas = book.locator("canvas");
  const viewport = book.locator("[data-article-book-pan]");
  const baseline = await canvas.evaluate(node => {
    node.dataset.zoomIdentity = "original-canvas";
    const rect = node.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  });
  const pageText = await book.locator("[data-article-book-page]").textContent();

  for (const scale of [1.15, 1.3]) {
    await book.getByRole("button", { name: "Приблизить книгу", exact: true }).click();
    await expect(book).toHaveAttribute("data-book-view-scale", String(scale));
    await expect(canvas).toHaveAttribute("data-zoom-identity", "original-canvas");
    await expect(book).toHaveAttribute("data-page-count", pageCount);
    await expect(book).toHaveAttribute("data-page-index", "2");
    expect(await book.locator("[data-article-book-page]").textContent()).toBe(pageText);
    await expect.poll(() => canvas.evaluate(node => node.getBoundingClientRect().width)).toBeGreaterThan(baseline.width * (scale - .05));
    const size = await canvas.boundingBox();
    expect(size.width / baseline.width).toBeCloseTo(scale, 1);
    expect(size.height / baseline.height).toBeCloseTo(scale, 1);
  }
  await expect(book.getByRole("button", { name: "Приблизить книгу", exact: true })).toBeDisabled();
  await expect(book.locator(".article-book-reader__surface")).toHaveAttribute("inert", "");
  expect(await book.locator(".article-book-reader__surface").evaluate(node => node.inert)).toBe(true);
  expect(await viewport.evaluate(node => /pinch-zoom|manipulation/u.test(getComputedStyle(node).touchAction))).toBe(true);
  await viewport.scrollIntoViewIfNeeded();
  await viewport.evaluate(node => node.scrollTo(0, 0));
  const rect = await viewport.boundingBox();
  const start = { x: rect.x + rect.width * .75, y: rect.y + rect.height * .65 };
  const end = { x: rect.x + rect.width * .35, y: rect.y + rect.height * .45 };
  if (isMobile) {
    const cdp = await context.newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [start] });
    for (let step = 1; step <= 12; step++) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: start.x + (end.x - start.x) * step / 12, y: start.y + (end.y - start.y) * step / 12 }] });
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await cdp.detach();
  } else {
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 12 });
    await page.mouse.up();
  }
  await expect.poll(() => viewport.evaluate(node => node.scrollLeft)).toBeGreaterThan(10);
  await expect.poll(() => viewport.evaluate(node => node.scrollTop)).toBeGreaterThan(10);
  await expect(book).toHaveAttribute("data-page-index", "2");
  await viewport.evaluate(node => node.scrollTo(node.scrollWidth, node.scrollHeight));
  const edges = await viewport.evaluate(node => ({
    rightRemaining: node.scrollWidth - node.clientWidth - node.scrollLeft,
    bottomRemaining: node.scrollHeight - node.clientHeight - node.scrollTop,
  }));
  expect(Math.abs(edges.rightRemaining)).toBeLessThanOrEqual(1);
  expect(Math.abs(edges.bottomRemaining)).toBeLessThanOrEqual(1);
  await viewport.evaluate(node => node.scrollTo(0, 0));
  await viewport.focus();
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => viewport.evaluate(node => node.scrollLeft)).toBeGreaterThan(0);
  await expect(book).toHaveAttribute("data-page-index", "2");
  await viewport.evaluate(node => node.scrollTo((node.scrollWidth - node.clientWidth) / 2, (node.scrollHeight - node.clientHeight) / 2));
  await book.screenshot({ path: testInfo.outputPath("book-enlarged.png") });

  await book.getByRole("button", { name: "Следующая страница", exact: true }).click();
  await expect(book).toHaveAttribute("data-page-index", "3");
  await expect(book.locator("select")).toBeEnabled({ timeout: 15_000 });
  await expect(book).toHaveAttribute("data-book-view-scale", "1.3");
  await book.getByRole("button", { name: "Отдалить книгу", exact: true }).click();
  await expect(book).toHaveAttribute("data-book-view-scale", "1.15");
  await book.getByRole("button", { name: "Обычный размер книги", exact: true }).click();
  await expect(book).toHaveAttribute("data-book-view-scale", "1");
  await expect(book.locator(".article-book-reader__surface")).not.toHaveAttribute("inert", "");
  await expect(canvas).toHaveAttribute("data-zoom-identity", "original-canvas");
  await expect(book).toHaveAttribute("data-page-count", pageCount);
  const geometry = await book.evaluate(node => ({
    overflow: node.scrollWidth - node.clientWidth,
    readerOverflow: document.querySelector(".article-reader").scrollWidth - document.querySelector(".article-reader").clientWidth,
    controls: [...node.querySelectorAll("button, select")].map(control => ({ width: control.getBoundingClientRect().width, height: control.getBoundingClientRect().height })),
    pan: { left: node.querySelector("[data-article-book-pan]").scrollLeft, top: node.querySelector("[data-article-book-pan]").scrollTop },
  }));
  expect(geometry.overflow).toBeLessThanOrEqual(1);
  expect(geometry.readerOverflow).toBeLessThanOrEqual(1);
  expect(geometry.controls.every(control => control.width >= 44 && control.height >= 44)).toBe(true);
  expect(geometry.pan).toEqual({ left: 0, top: 0 });
  expect(errors).toEqual([]);
  await book.screenshot({ path: testInfo.outputPath("book-normal.png") });
  await testInfo.attach("book-zoom-geometry", { body: JSON.stringify({ baseline, pageCount, edges, geometry }, null, 2), contentType: "application/json" });
});
