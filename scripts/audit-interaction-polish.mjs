import { chromium, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { chooseTypographyLocale, settleTypography } from "./capture-typography-evidence.mjs";

const baseURL = process.argv[2] || "http://127.0.0.1:4184/";
const selectedCases = process.argv.find((argument) => argument.startsWith("--cases="))?.slice(8).split(",");
const output = "reports/typography-evidence/interaction-polish";
await mkdir(output, { recursive: true });
const results = [];
const browser = await chromium.launch({ channel: "chrome" });
const snapshot = (control) => control.evaluate((element) => {
  const bounds = element.getBoundingClientRect();
  const parent = element.closest("article, .community-actions").getBoundingClientRect();
  const style = getComputedStyle(element);
  const label = element.querySelector("strong");
  const circle = element.querySelector("i");
  const center = (node) => { const r = node.getBoundingClientRect(); return r.y + r.height / 2; };
  return {
    rect: [bounds.x - parent.x, bounds.y - parent.y, bounds.width, bounds.height],
    centerDifference: label && circle ? Math.abs(center(label) - center(circle)) : null,
    background: style.backgroundColor, border: style.borderColor, shadow: style.boxShadow,
    outline: { style: style.outlineStyle, width: parseFloat(style.outlineWidth), color: style.outlineColor },
    focusVisible: element.matches(":focus-visible"), active: element.matches(":active"),
  };
});
const sameGeometry = (before, after) => {
  before.rect.forEach((value, axis) => expect(Math.abs(value - after.rect[axis])).toBeLessThanOrEqual(1));
  if (after.centerDifference !== null) expect(after.centerDifference).toBeLessThanOrEqual(1);
};
async function controlStates(page, control, screenshot) {
  await control.scrollIntoViewIfNeeded();
  await page.mouse.move(0, 0);
  await settleTypography(page);
  const normal = await snapshot(control);
  if (normal.centerDifference !== null) expect(normal.centerDifference).toBeLessThanOrEqual(1);
  await control.focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  const focus = await snapshot(control);
  expect(focus.focusVisible).toBe(true);
  expect(focus.outline.width).toBeGreaterThanOrEqual(2);
  expect(focus.outline.style).not.toBe("none");
  sameGeometry(normal, focus);
  if (screenshot?.focus) await control.locator("..").screenshot({ path: screenshot.focus, animations: "disabled" });
  await control.hover();
  await page.waitForTimeout(240);
  const hover = await snapshot(control);
  sameGeometry(normal, hover);
  // Focus and lazy-landmark scrolling may change viewport coordinates while
  // leaving the control's geometry inside its card unchanged. Hit-test again
  // immediately before pressing instead of reusing an earlier hover point.
  await control.scrollIntoViewIfNeeded();
  await settleTypography(page);
  const bounds = await control.boundingBox();
  const point = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  await page.mouse.move(point.x, point.y);
  const hit = await control.evaluate((element, position) => {
    const target = document.elementFromPoint(position.x, position.y);
    return { ...position, withinControl: !!target && element.contains(target), tag: target?.tagName, className: target?.getAttribute("class") };
  }, point);
  expect(hit.withinControl, JSON.stringify(hit)).toBe(true);
  await page.mouse.down();
  await page.waitForTimeout(150);
  const active = await snapshot(control);
  expect(active.active).toBe(true);
  sameGeometry(normal, active);
  if (screenshot?.active) await control.locator("..").screenshot({ path: screenshot.active, animations: "disabled" });
  await page.mouse.move(0, 0);
  await page.mouse.up(); // Release away from the target, avoiding navigation or dialog activation.
  return { normal, focus, hover, active, pressedHitTarget: hit };
}
async function seriesMetrics(locator, coarse) {
  const items = await locator.evaluateAll((elements) => elements.map((element) => {
    const style = getComputedStyle(element); const rect = element.getBoundingClientRect();
    return { text: element.textContent, font: style.fontFamily, size: parseFloat(style.fontSize), width: rect.width, height: rect.height };
  }));
  for (const item of items) {
    expect(item.size).toBe(15);
    expect(item.font).toContain("Onest Local");
    if (coarse) { expect(item.width).toBeGreaterThanOrEqual(44); expect(item.height).toBeGreaterThanOrEqual(44); }
  }
  return items;
}
async function seriesFixture(page, family, coarse) {
  await page.evaluate((kind) => {
    const nav = document.createElement("nav");
    nav.dataset.interactionFixture = kind;
    nav.className = kind === "directory" ? "section-card-series" : "article-library-series";
    const control = document.createElement(kind === "directory" ? "a" : "button");
    control.textContent = "QA series fixture";
    if (kind === "directory") control.href = "#";
    else control.type = "button";
    nav.append(control);
    document.querySelector(kind === "directory" ? ".section-card-series-slot" : ".article-library").append(nav);
  }, family);
  const fixture = page.locator(`[data-interaction-fixture="${family}"]`);
  const metrics = await seriesMetrics(fixture.locator("a, button"), coarse);
  await fixture.evaluate((element) => element.remove());
  return { kind: "temporary DOM fixture; not published content", metrics };
}
try {
  for (const locale of ["ru", "en"]) for (const width of [390, 1440]) {
    if (selectedCases && !selectedCases.includes(`${locale}/${width}`)) continue;
    const context = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: width === 390, reducedMotion: "no-preference" });
    const page = await context.newPage();
    page.setDefaultTimeout(12000);
    await page.goto(baseURL);
    await chooseTypographyLocale(page, locale);
    const coarse = await page.evaluate(() => matchMedia("(any-pointer: coarse)").matches);
    expect(coarse).toBe(width === 390);
    const capture = (locale === "ru" && width === 390) || (locale === "en" && width === 1440);
    const about = page.locator(".section-directory-card").filter({ has: page.locator("h3", { hasText: /О проекте и редакции|About the project and editors/u }) });
    const footer = await controlStates(page, about.locator(".section-card-action > a"), capture ? { focus: `${output}/${locale}-footer-focus-${width}.png` } : null);
    if (coarse) expect(footer.normal.rect[3]).toBeGreaterThanOrEqual(44);
    const primary = await controlStates(page, page.locator("#community .community-actions .ui-action--primary"), capture ? { active: `${output}/${locale}-primary-active-${width}.png` } : null);
    expect(primary.active.background).not.toBe(primary.hover.background);
    expect(primary.active.shadow).not.toBe(primary.hover.shadow);
    expect(primary.normal.rect[3]).toBeGreaterThanOrEqual(44);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const more = page.locator(".section-directory-more");
    await more.scrollIntoViewIfNeeded();
    await page.mouse.move(0, 0);
    const moreArrowBase = await more.locator(".brand-arrow-icon").evaluate((element) => getComputedStyle(element).transform);
    await more.hover();
    // Brand arrows have a static 0.25px optical offset. Reduced motion must
    // preserve that resting transform instead of introducing hover movement.
    await expect(more.locator(".brand-arrow-icon")).toHaveCSS("transform", moreArrowBase);
    await more.click();
    await expect(page.locator(".section-directory-card")).toHaveCount(17);
    const directorySeries = await seriesMetrics(page.locator(".section-card-series a"), coarse);
    const directorySeriesFixture = directorySeries.length ? null : await seriesFixture(page, "directory", coarse);
    await page.locator(".editorial-grid article").first().hover();
    await expect(page.locator(".editorial-grid .article-image > img").first()).toHaveCSS("transform", "none");
    await page.goto(new URL("#journal", baseURL).href);
    await chooseTypographyLocale(page, locale);
    const libraryCard = page.locator(".article-library-grid article").first();
    await libraryCard.hover();
    await expect(libraryCard.locator(".library-card-image > img")).toHaveCSS("transform", "none");
    await expect(libraryCard.locator(".library-card-copy > strong i")).toHaveCSS("transform", "none");
    const archiveSeries = await seriesMetrics(page.locator(".article-library-series button"), coarse);
    const archiveSeriesFixture = archiveSeries.length ? null : await seriesFixture(page, "archive", coarse);
    results.push({ locale, width, coarse, footer, primary, directorySeries, archiveSeries, directorySeriesFixture, archiveSeriesFixture,
      reducedMotion: { directoryArrow: { resting: moreArrowBase, hover: moreArrowBase }, editorialImage: "none", libraryImage: "none", libraryArrow: "none" } });
    await writeFile(`${output}/measurements.json`, JSON.stringify({ baseURL, scope: "Content controls only; Header/Hero excluded", selectedCases: selectedCases || "all four", results }, null, 2) + "\n");
    await context.close();
  }
  const screenshotsWritten = results.filter(({ locale, width }) => (locale === "ru" && width === 390) || (locale === "en" && width === 1440)).length * 2;
  console.log(JSON.stringify({ passed: results.length, screenshotsWritten, widths: [390, 1440], locales: ["ru", "en"] }));
} finally { await browser.close(); }
