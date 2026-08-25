import { expect, test } from "@playwright/test";

const PHASE_5A_LANDMARKS = [
  "#atlas",
  "#book-day",
  "#books",
  "#featured-journal",
  "#journal",
  "#community",
  "#authors",
  "#sections",
  "#editorial-policy",
  "#calendar",
  ".site-footer",
];

test.setTimeout(150_000);

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

test("phase 5A pins the current public database order without horizontal overflow", async ({
  page,
}) => {
  await openHomepage(page);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));

  for (const selector of PHASE_5A_LANDMARKS) {
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
  }, PHASE_5A_LANDMARKS);

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
