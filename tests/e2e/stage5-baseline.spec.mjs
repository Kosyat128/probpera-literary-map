import { expect, test } from "@playwright/test";
import { installObservers } from "../../scripts/lib/bookshelf-physics-observer.mjs";

const PHASE_5C_LANDMARKS = [
  "#atlas",
  "#book-day",
  "#books",
  "#featured-journal",
  "#journal",
  "#authors",
  "#sections",
  "#calendar",
  "#community",
  "#editorial-policy",
  ".site-footer",
];

test.setTimeout(150_000);

test("bookshelf empty clicks return closed and open books without treating orbit or drag as dismissal", async ({ page, isMobile }) => {
  await page.addInitScript(installObservers);
  await page.goto("/#books");
  const workspace = page.locator(".book-shelf-frame__workspace");
  await workspace.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => window.__shelfAudit.read()?.books.length);
  await page.evaluate(() => document.fonts.ready);
  const activate = async (point) => isMobile
    ? page.touchscreen.tap(point.x, point.y)
    : page.mouse.click(point.x, point.y);

  for (const openCover of [false, true]) {
    await workspace.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => window.__shelfAudit.read()?.pendingFrames === 0);
    await activate(await page.evaluate(() => window.__shelfAudit.read().books[0]));
    await page.waitForFunction(() => window.__shelfAudit.read()?.phase === "INSPECTION_CLOSED");
    if (openCover) {
      await page.locator(".book-detail-open-cover").click();
      await page.waitForFunction(() => window.__shelfAudit.read()?.phase === "BOOK_OPEN");
    }
    await page.waitForFunction(() => window.__shelfAudit.read()?.pendingFrames === 0);
    const empty = await page.evaluate(() => {
      const { canvas, insets } = window.__shelfAudit.read();
      const point = { x: canvas.x + insets.left + 5, y: canvas.y + insets.top + 5 };
      const outside = { x: Math.max(0, canvas.x - 8), y: point.y };
      return { ...point, element: document.elementFromPoint(point.x, point.y)?.tagName,
        outside: { ...outside, element: document.elementFromPoint(outside.x, outside.y)?.tagName } };
    });
    expect(empty.element).toBe("CANVAS");
    if (!isMobile) {
      await page.keyboard.down("Alt");
      await page.mouse.click(empty.x, empty.y);
      await page.keyboard.up("Alt");
      await page.mouse.move(empty.x, empty.y);
      await page.mouse.down();
      await page.mouse.move(empty.x + 60, empty.y + 16, { steps: 8 });
      await page.mouse.up();
      await page.mouse.move(empty.x, empty.y);
      await page.mouse.down();
      await page.mouse.move(empty.x + 60, empty.y + 16, { steps: 8 });
      await page.mouse.move(empty.x, empty.y, { steps: 8 });
      await page.mouse.up();
      expect(empty.outside.element).not.toBe("CANVAS");
      await page.mouse.down();
      await page.mouse.move(empty.outside.x, empty.outside.y, { steps: 8 });
      await page.mouse.move(empty.x, empty.y, { steps: 8 });
      await page.mouse.up();
      expect(await page.evaluate(() => window.__shelfAudit.read()?.selectedKey)).toBeTruthy();
    }
    await activate(empty);
    await page.waitForFunction(() => window.__shelfAudit.read()?.phase === "SHELF_IDLE");
    await expect(page.locator(".book-shelf-frame__detail")).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => ({
      selected: window.__shelfAudit.read()?.selectedKey,
      focusInShelf: document.querySelector("#books")?.contains(document.activeElement),
    }))).toEqual({ selected: null, focusInShelf: true });
  }
});

async function openHomepage(page, locale = "ru") {
  await page.goto("/");
  await expect(page.locator(".magazine-hero")).toBeVisible();
  await page
    .locator(".interface-language-control button")
    .nth(locale === "ru" ? 0 : 1)
    .click();
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
  await page.evaluate(() => document.fonts.ready);
}

test("phase 5C pins the current public database order without horizontal overflow", async ({
  page,
}) => {
  await openHomepage(page);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));

  for (const selector of PHASE_5C_LANDMARKS) {
    await expect(page.locator(selector), selector).toHaveCount(1);
  }

  const baseline = await page.evaluate((selectors) => {
    const entries = selectors.map((selector) => {
      const element = document.querySelector(selector);
      if (!element) return { selector, top: Number.NaN };
      return { selector, top: element.getBoundingClientRect().top + window.scrollY };
    });
    return {
      entries,
      overflow:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    };
  }, PHASE_5C_LANDMARKS);

  expect(baseline.overflow).toBeLessThanOrEqual(2);
  for (let index = 1; index < baseline.entries.length; index += 1) {
    expect(
      baseline.entries[index].top,
      `${baseline.entries[index].selector} follows ${baseline.entries[index - 1].selector}`,
    ).toBeGreaterThan(baseline.entries[index - 1].top);
  }
});

test("200 percent equivalent reflow and forced colors keep controls reachable", async ({
  page,
}) => {
  await page.setViewportSize({ width: 640, height: 900 });
  await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
  await openHomepage(page, "en");

  const search = page.locator(".site-header .global-search-trigger");
  await expect(search).toBeVisible();
  await search.focus();
  await expect(search).toBeFocused();

  const result = await page.evaluate(() => {
    return {
      overflow:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
      activeControl: document.activeElement?.classList.contains(
        "global-search-trigger",
      ),
    };
  });

  expect(result.overflow).toBeLessThanOrEqual(2);
  expect(result.activeControl).toBe(true);
  await expect(page.locator("#atlas")).toHaveCount(1);
  await expect(page.locator("#books")).toHaveCount(1);
});
