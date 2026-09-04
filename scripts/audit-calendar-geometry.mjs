import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const base = process.argv[2] || "http://127.0.0.1:4183/";
const calendarUrl = new URL(base);
calendarUrl.hash = "calendar";
const outputDirectory = new URL("../reports/typography-evidence/", import.meta.url);
await mkdir(outputDirectory, { recursive: true });

const results = [];
const browser = await chromium.launch({ channel: "chrome", headless: true });

async function measureCalendar(page, language, width, state) {
  // Load the local SVGs for every measured row, including rows below the viewport.
  await page.locator(".calendar-country-flag").evaluateAll((images) => {
    images.forEach((image) => {
      if (image.tagName === "IMG") image.loading = "eager";
    });
  });
  await page.waitForFunction(() =>
    [...document.querySelectorAll(".calendar-country-flag")].every(
      (image) => image.tagName === "IMG" && image.complete && image.naturalWidth > 0
    )
  );

  const data = await page.locator(".calendar-card").evaluate((calendar) => {
    const rectangle = (element) => {
      const bounds = element.getBoundingClientRect();
      return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
    };
    const rows = [...calendar.querySelectorAll(".calendar-agenda-event")].map((event) => {
      const writer = event.querySelector(".calendar-agenda-writer");
      const country = event.querySelector(".calendar-agenda-country");
      const flag = country.querySelector("img");
      return {
        writer: rectangle(writer),
        country: rectangle(country),
        flag: rectangle(flag),
        label: country.getAttribute("aria-label"),
        title: country.getAttribute("title"),
        text: country.textContent,
        source: flag.getAttribute("src"),
        alt: flag.getAttribute("alt"),
        overflow: writer.scrollWidth - writer.clientWidth,
      };
    });
    return {
      rows,
      // The card deliberately clips a decorative ::after outside its box.
      // Check the actual content boxes so decoration is not reported as text overflow.
      overflow: [...calendar.children].some((child) => child.scrollWidth > child.clientWidth + 1),
      days: calendar.querySelectorAll(".calendar-agenda-day").length,
    };
  });

  const issues = [];
  let maxFlagAlignment = 0;
  let maxWriterAlignment = 0;
  for (const row of data.rows) {
    maxFlagAlignment = Math.max(maxFlagAlignment, Math.abs(row.country.x - data.rows[0].country.x));
    maxWriterAlignment = Math.max(maxWriterAlignment, Math.abs(row.writer.x - data.rows[0].writer.x));
    if (row.country.width !== 44 || row.country.height !== 44 || row.flag.width !== 28 || row.flag.height !== 28) {
      issues.push("dimensions");
    }
    if (Math.abs(row.country.y + 22 - row.writer.y - row.writer.height / 2) > 0.5) {
      issues.push("row-center");
    }
    if (!row.label || !row.title || row.text.trim() || row.alt !== "" || !row.source.endsWith(".svg")) {
      issues.push("flag-semantics");
    }
    if (row.overflow > 1) issues.push("writer-overflow");
  }
  if (maxFlagAlignment > 1 || maxWriterAlignment > 1 || data.overflow) issues.push("alignment");
  const result = {
    language, width, state, days: data.days, events: data.rows.length,
    maxFlagAlignment, maxWriterAlignment, issues,
  };
  results.push(result);
  console.log(JSON.stringify(result));
}

try {
  for (const language of ["ru", "en"]) {
    for (const width of [320, 390, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 } });
      await context.addInitScript((language) => {
        localStorage.setItem("probpera-interface-language", language);
      }, language);
      const page = await context.newPage();
      // The hash expresses the normal load intent for the deferred country archive.
      await page.goto(calendarUrl.href, { waitUntil: "domcontentloaded" });
      await page.locator("#calendar").scrollIntoViewIfNeeded();
      await page.locator(".calendar-country-flag").first().waitFor();
      await page.evaluate(() => document.fonts.ready);

      await measureCalendar(page, language, width, "compact");
      const hideNavigation = await page.addStyleTag({
        content: ".topline,.site-header,.mobile-nav{visibility:hidden!important}",
      });
      await page.locator(".calendar-agenda").screenshot({
        path: fileURLToPath(new URL(`${language}-calendar-flags-${width}.png`, outputDirectory)),
        animations: "disabled",
      });
      await hideNavigation.evaluate((element) => element.remove());

      const more = page.locator(".calendar-agenda-more");
      if (await more.count()) {
        await more.evaluate((element) => element.click());
        await measureCalendar(page, language, width, "full-month");
      }
      const denseDay = await page.locator(".calendar-day.has-event").evaluateAll((buttons) =>
        buttons.map((button, index) => ({
          index,
          count: Number(button.getAttribute("aria-label").split(":").at(-1).trim()),
        })).sort((first, second) => second.count - first.count)[0].index
      );
      await page.locator(".calendar-day.has-event").nth(denseDay).evaluate((element) => element.click());
      await measureCalendar(page, language, width, "dense-selected");
      await page.locator(".calendar-day.is-selected").evaluate((element) => element.click());
      await measureCalendar(page, language, width, "deselected");

      const country = page.locator(".calendar-agenda-country").first();
      await country.scrollIntoViewIfNeeded();
      const controlBox = () => country.evaluate((element) => {
        const button = element.getBoundingClientRect();
        const event = element.closest(".calendar-agenda-event").getBoundingClientRect();
        return [button.x - event.x, button.y - event.y, button.width, button.height];
      });
      const states = { normal: await controlBox() };
      await country.hover({ force: true });
      states.hover = await controlBox();
      await country.focus();
      states.focus = await controlBox();
      const issues = new Set(Object.values(states).map(JSON.stringify)).size === 1 ? [] : ["state-shift"];
      results.push({ language, width, state: "control-states", states, issues });
      console.log(JSON.stringify({ language, width, state: "control-states", issues }));
      await context.close();
    }
  }
} finally {
  await writeFile(new URL("calendar-geometry.json", outputDirectory), JSON.stringify(results, null, 2));
  await browser.close();
}

if (results.some((result) => result.issues.length > 0)) process.exitCode = 1;
