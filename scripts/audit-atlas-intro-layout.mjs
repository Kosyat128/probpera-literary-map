import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { chooseTypographyLocale, settleTypography } from "./capture-typography-evidence.mjs";

const baseURL = process.argv.find((arg) => arg.startsWith("http")) ?? "http://127.0.0.1:4184/";
const injectSource = process.argv.includes("--source");
const directory = "reports/typography-evidence/atlas-intro-layout";
await mkdir(directory, { recursive: true });
const css = await readFile("src/styles/atlas-intro-layout.css", "utf8") + "\n" + await readFile("src/styles/site-typography.css", "utf8");
const selectedCases = process.argv.find((arg) => arg.startsWith("--cases="))?.slice("--cases=".length).split(",");
const browser = await chromium.launch({ channel: "chrome" });
const results = [];

try {
  for (const locale of ["ru", "en"]) {
    for (const width of [320, 390, 1440, 1848]) {
      if (selectedCases && !selectedCases.includes(`${locale}/${width}`)) continue;
      const context = await browser.newContext({ viewport: { width, height: 1000 }, hasTouch: width < 600, serviceWorkers: "block" });
      try {
        const page = await context.newPage();
        await page.goto(baseURL, { waitUntil: "domcontentloaded" });
        await chooseTypographyLocale(page, locale);
        await page.locator("#atlas-heading-title").scrollIntoViewIfNeeded();
        await page.waitForFunction(() => Number(document.querySelector('[data-atlas-filter="all"] .atlas-filter-count')?.textContent?.replace(/\D/gu, "")) > 0);
        if (injectSource) {
          await page.evaluate(() => {
            if (document.querySelector("#atlas .atlas-intro")) return;
            const heading = document.querySelector("#atlas .atlas-heading");
            const toolbar = document.querySelector("#atlas .atlas-toolbar");
            const intro = document.createElement("div");
            intro.className = "atlas-intro";
            heading.before(intro);
            intro.append(heading, toolbar);
          });
          await page.addStyleTag({ content: css });
        }
        await settleTypography(page);
        await page.locator("#atlas .atlas-intro").scrollIntoViewIfNeeded();
        const measurements = await page.evaluate(() => {
          const bounds = (element) => {
            const { x, y, width, height, right, bottom } = element.getBoundingClientRect();
            return { x, y, width, height, right, bottom };
          };
          const buttons = [...document.querySelectorAll("#atlas .atlas-filters button")].map((element) => ({
            text: element.textContent.trim(), ...bounds(element), overflow: element.scrollWidth - element.clientWidth,
          }));
          const input = document.querySelector("#country-search");
          const intro = document.querySelector("#atlas .atlas-intro");
          const search = document.querySelector("#atlas .country-search");
          const field = search.querySelector(".search-field");
          const title = document.querySelector("#atlas h2");
          const titleRange = document.createRange();
          titleRange.selectNodeContents(title);
          const titleInk = titleRange.getBoundingClientRect();
          const titleClippedBy = [];
          for (let ancestor = title; ancestor; ancestor = ancestor.parentElement) {
            const style = getComputedStyle(ancestor);
            const area = ancestor.getBoundingClientRect();
            if (/^(hidden|clip|auto|scroll)$/u.test(style.overflowX) && (titleInk.left < area.left - 1 || titleInk.right > area.right + 1)) titleClippedBy.push(ancestor.id || ancestor.className || ancestor.tagName);
          }
          const conflicts = buttons.flatMap((a, index) => buttons.slice(index + 1).filter((b) =>
            Math.min(a.right, b.right) - Math.max(a.x, b.x) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y) > 1
          ).map((b) => [a.text, b.text]));
          return {
            intro: bounds(intro), title: bounds(title),
            titleInk: { left: titleInk.left, right: titleInk.right, width: titleInk.width }, titleClippedBy,
            typography: {
              title: getComputedStyle(title).fontSize,
              button: getComputedStyle(document.querySelector("#atlas .atlas-filters button")).fontSize,
              count: getComputedStyle(document.querySelector("#atlas .atlas-filter-count")).fontSize,
              label: getComputedStyle(search.querySelector("label")).fontSize,
              labelTransform: getComputedStyle(search.querySelector("label")).textTransform,
              input: getComputedStyle(input).fontSize,
            },
            description: bounds(document.querySelector("#atlas .atlas-heading p")),
            search: bounds(search), field: bounds(field), input: bounds(input), buttons, conflicts,
            documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            filterOverflow: document.querySelector("#atlas .atlas-filters").scrollWidth - document.querySelector("#atlas .atlas-filters").clientWidth,
            accessibleSearchLabel: document.querySelector(`label[for="${input.id}"]`).textContent,
          };
        });
        assert.equal(measurements.buttons.length, 6);
        assert.deepEqual(measurements.titleClippedBy, [], "heading glyphs are clipped");
        assert.ok(measurements.titleInk.left >= measurements.intro.x - 1 && measurements.titleInk.right <= measurements.intro.right + 1, "heading text escapes its content column");
        assert.equal(measurements.conflicts.length, 0, "filter controls overlap");
        assert.ok(measurements.documentOverflow <= 1 && measurements.filterOverflow <= 1, "horizontal overflow");
        for (const button of measurements.buttons) {
          assert.ok(button.height >= 44 && button.overflow <= 1, "target too small or text clipped");
          assert.ok(button.x >= measurements.intro.x - 1 && button.right <= measurements.intro.right + 1, "filter outside intro");
        }
        assert.ok(measurements.input.width > measurements.field.width / 2, "input does not receive the majority of the search field");
        if (width > 960) {
          assert.ok(measurements.buttons.every((button) => button.right <= measurements.search.x - 8), "search overlaps filters");
          assert.ok(Math.abs(measurements.buttons[0].y + measurements.buttons[0].height / 2 - measurements.field.y - measurements.field.height / 2) <= 1, "first filter/search baseline differs");
          if (width >= 1440) {
            assert.ok(Math.max(...measurements.buttons.map((button) => button.y)) - Math.min(...measurements.buttons.map((button) => button.y)) <= 1, "wide filters and largest archives must share one row");
            assert.ok(measurements.buttons[5].x >= measurements.buttons[4].right + 1, "largest archives must follow the fifth filter on the right");
            assert.ok(measurements.search.width >= 220, "wide search is narrower than 220px");
          }
        } else {
          assert.ok(Math.abs(measurements.search.width - measurements.intro.width) <= 1, "mobile search is not full width");
          assert.ok(measurements.search.y >= Math.max(...measurements.buttons.map((button) => button.bottom)) + 16, "mobile search is not below filters");
        }
        await page.locator("#atlas .atlas-intro").screenshot({ path: `${directory}/${locale}-${width}.png`, animations: "disabled", style: ".site-header,.mobile-nav{visibility:hidden!important}" });
        await page.locator("#country-search").click();
        await page.locator("#country-results").waitFor({ state: "visible" });
        await page.keyboard.press("Escape");
        assert.equal(await page.locator("#country-search").getAttribute("aria-expanded"), "false");
        await page.locator('[data-atlas-archives-toggle]').click();
        await page.locator("#atlas-largest-archives").waitFor({ state: "visible" });
        const archives = await page.locator("#atlas-largest-archives").boundingBox();
        assert.ok(archives.x >= 0 && archives.x + archives.width <= width + 1, "archive dropdown leaves viewport");
        await page.keyboard.press("Escape");
        await page.locator('[data-atlas-filter="rich"]').click();
        assert.equal(await page.locator('[data-atlas-filter="rich"]').getAttribute("aria-pressed"), "true");
        await page.locator('[data-atlas-filter="all"]').click();
        let immersiveSmokePassed = null;
        if (process.argv.includes("--immersive") && locale === "ru" && width === 1440) {
          await page.locator('[data-atlas-action="enter-immersive"]').click();
          await page.locator('.atlas-experience-surface[data-atlas-view="immersive"]').waitFor({ state: "visible" });
          await page.locator('[data-atlas-action="toggle-search"]').click();
          await page.waitForFunction(() => document.activeElement?.id === "country-search");
          await page.keyboard.press("Escape");
          await page.waitForFunction(() => document.querySelector('[data-atlas-action="toggle-search"]') === document.activeElement);
          await page.locator('[data-atlas-action="toggle-filters"]').click();
          await page.waitForFunction(() => document.activeElement?.matches('[data-atlas-filter][aria-pressed="true"]'));
          await page.keyboard.press("Escape");
          await page.waitForFunction(() => document.querySelector('[data-atlas-action="toggle-filters"]') === document.activeElement);
          await page.locator('[data-atlas-action="exit-immersive"]').click();
          await page.waitForFunction(() => document.querySelector('.atlas-experience-surface')?.getAttribute("data-atlas-view") === "embedded");
          immersiveSmokePassed = true;
        }
        results.push({ locale, width, ...measurements, searchEscapePassed: true, archiveDropdownPassed: true, filterSelectionPassed: true, immersiveSmokePassed });
        await writeFile(`${directory}/measurements.json`, JSON.stringify({ baseURL, renderedFrom: injectSource ? "Current production DOM plus exact source CSS and wrapper injection; awaiting rebuilt production verification" : "Production build", results }, null, 2) + "\n");
        console.log(`${locale}/${width}: six full ${measurements.buttons[0].height}px filters, ${measurements.input.width.toFixed(1)}px input, no overflow; title clipped by=${JSON.stringify(measurements.titleClippedBy)}; search/archive/filter actions passed`);
      } finally {
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
}
