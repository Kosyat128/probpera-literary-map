import { expect, test } from "@playwright/test";

const BASE_PATH = "/probpera-literary-map/";

const roleSelectors = {
  major: [
    "#featured-journal .section-heading h2",
    ".stage5-deferred-journal[data-loading-status='ready'] .article-library-heading h2",
    "#community .community-copy h2",
  ],
  normal: [
    "#book-day .book-of-day h3",
    "#featured-journal .journal-engagement h3",
  ],
  card: [
    "#book-day .book-fact-card h3",
    "#editorial-policy summary",
  ],
  body: [
    "#book-day .book-of-day p",
    "#book-day .editorial-standard > p",
    "#community .community-copy > p",
    "#calendar .calendar-heading p",
  ],
};

async function openHomepage(page, { width, height, locale }) {
  await page.setViewportSize({ width, height });
  await page.goto(BASE_PATH, { waitUntil: "domcontentloaded" });
  await expect(page.locator(".magazine-hero")).toBeVisible();
  if (locale === "en") {
    await page.locator(".interface-language-control button").nth(1).click();
  }
  await expect(page.locator("html")).toHaveAttribute("lang", locale);
  const journalSlot = page.locator(".stage5-deferred-journal");
  await journalSlot.scrollIntoViewIfNeeded();
  await expect(journalSlot).toHaveAttribute("data-loading-status", "ready", {
    timeout: 20_000,
  });
  await page.evaluate(async () => {
    window.scrollTo(0, document.documentElement.scrollHeight);
    await document.fonts.ready;
  });
  await expect(page.locator("#calendar")).toBeVisible();
}

async function collectRoleMetrics(page) {
  return page.evaluate((selectorsByRole) => {
    const metrics = {};
    for (const [role, selectors] of Object.entries(selectorsByRole)) {
      metrics[role] = selectors.map((selector) => {
        const element = document.querySelector(selector);
        if (!element) throw new Error(`Missing Stage 5B selector: ${selector}`);
        const style = getComputedStyle(element);
        const fontSize = Number.parseFloat(style.fontSize);
        const lineHeight = Number.parseFloat(style.lineHeight);
        return {
          selector,
          fontSize,
          lineHeightRatio: lineHeight / fontSize,
        };
      });
    }
    const styleMetric = (selector, property) => {
      const element = document.querySelector(selector);
      if (!element) throw new Error(`Missing Stage 5B selector: ${selector}`);
      return Number.parseFloat(getComputedStyle(element)[property]);
    };
    return {
      metrics,
      metadata: styleMetric("#book-day .book-of-day .section-kicker", "fontSize"),
      action: styleMetric("#sections .sections-all-button", "fontSize"),
      spacing: {
        articleLibrary: styleMetric("#journal", "paddingTop"),
        trust: styleMetric("#editorial-policy", "paddingTop"),
        calendarBottom: styleMetric("#calendar", "paddingBottom"),
      },
      overflow:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
      backgrounds: ["#featured-journal", "#journal", "#community", "#authors", "#sections"]
        .map((selector) => ({
          selector,
          backgroundImage: getComputedStyle(document.querySelector(selector)).backgroundImage,
        })),
    };
  }, roleSelectors);
}

function expectRole(metrics, role, minSize, maxSize, minRatio, maxRatio) {
  for (const metric of metrics[role]) {
    expect(metric.fontSize, metric.selector).toBeGreaterThanOrEqual(minSize);
    expect(metric.fontSize, metric.selector).toBeLessThanOrEqual(maxSize + 0.1);
    expect(metric.lineHeightRatio, metric.selector).toBeGreaterThanOrEqual(minRatio);
    expect(metric.lineHeightRatio, metric.selector).toBeLessThanOrEqual(maxRatio);
  }
}

test("Stage 5B desktop RU roles and surfaces stay inside the approved scale", async ({
  page,
}) => {
  await openHomepage(page, { width: 1440, height: 900, locale: "ru" });
  const result = await collectRoleMetrics(page);

  expectRole(result.metrics, "major", 34, 44, 1.04, 1.15);
  expectRole(result.metrics, "normal", 30, 38, 1.04, 1.15);
  expectRole(result.metrics, "card", 23, 32, 1.08, 1.2);
  expectRole(result.metrics, "body", 16, 18, 1.5, 1.7);
  expect(result.metadata).toBe(12);
  expect(result.action).toBe(13);
  expect(result.spacing.articleLibrary).toBeLessThanOrEqual(96.1);
  expect(result.spacing.trust).toBeLessThanOrEqual(96.1);
  expect(result.spacing.calendarBottom).toBeLessThanOrEqual(96.1);
  expect(result.overflow).toBeLessThanOrEqual(2);
  for (const surface of result.backgrounds) {
    expect(surface.backgroundImage, surface.selector).not.toBe("none");
  }
});

test("Stage 5B mobile EN roles reflow without overflow", async ({ page }) => {
  await openHomepage(page, { width: 390, height: 844, locale: "en" });
  const result = await collectRoleMetrics(page);

  expectRole(result.metrics, "major", 27, 34, 1.04, 1.15);
  expectRole(result.metrics, "normal", 25, 32, 1.04, 1.15);
  expectRole(result.metrics, "card", 21, 28, 1.08, 1.2);
  expectRole(result.metrics, "body", 15, 17, 1.5, 1.7);
  expect(result.metadata).toBe(12);
  expect(result.action).toBe(13);
  expect(result.spacing.articleLibrary).toBeLessThanOrEqual(72.1);
  expect(result.spacing.trust).toBeLessThanOrEqual(72.1);
  expect(result.spacing.calendarBottom).toBeLessThanOrEqual(72.1);
  expect(result.overflow).toBeLessThanOrEqual(2);
});
