import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { settleTypography } from "./capture-typography-evidence.mjs";

const baseURL = process.argv[2] || "http://127.0.0.1:4183/probpera-literary-map/";
const browser = await chromium.launch({ channel: "chrome" });
const report = [];
try {
  for (const [locale, width] of [["ru", 1440], ["en", 390]]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.addInitScript((language) => {
      localStorage.setItem("probpera-interface-language", language);
      window.typographyShifts = [];
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) window.typographyShifts.push({
            value: entry.value, time: entry.startTime,
            sources: entry.sources.map((source) => ({ selector: source.node?.className || source.node?.nodeName, previous: source.previousRect, current: source.currentRect })),
          });
        }
      }).observe({ type: "layout-shift", buffered: true });
    }, locale);
    const requestedFonts = [];
    await page.route(/\.(?:woff2?|ttf)(?:\?|$)/u, async (route) => {
      requestedFonts.push(route.request().url());
      await new Promise((resolve) => setTimeout(resolve, 1200));
      await route.continue();
    });
    await page.goto(baseURL, { waitUntil: "domcontentloaded" });
    await page.locator(".hero-editorial h1").waitFor();
    await settleTypography(page);
    await page.waitForTimeout(300);
    const shifts = await page.evaluate(() => window.typographyShifts);
    // CLS uses the maximum session window (1s gaps, 5s maximum duration).
    let cls = 0, windowTotal = 0, windowStart = 0, previousTime = -Infinity;
    for (const shift of shifts) {
      if (shift.time - previousTime > 1000 || shift.time - windowStart > 5000) {
        windowTotal = 0;
        windowStart = shift.time;
      }
      windowTotal += shift.value;
      cls = Math.max(cls, windowTotal);
      previousTime = shift.time;
    }
    report.push({ locale, width, fontDelayMs: 1200, requestedFonts, cls, shifts });
    await context.close();
  }
  await mkdir("reports/typography-evidence", { recursive: true });
  await writeFile("reports/typography-evidence/font-loading.json", JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report.map(({ locale, width, cls, requestedFonts, shifts }) => ({ locale, width, cls, fontRequests: requestedFonts.length, shifts: shifts.length }))));
} finally {
  await browser.close();
}
