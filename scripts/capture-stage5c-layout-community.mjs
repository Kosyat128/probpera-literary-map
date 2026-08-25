import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { chromium } from "playwright";
import sharp from "sharp";

const baseUrl =
  process.argv[2] ?? "http://127.0.0.1:4173/probpera-literary-map/";
const outputDirectory = path.resolve(
  "reports",
  "stage5c-layout-community",
  "visual"
);

const captures = [
  {
    locale: "ru",
    width: 1440,
    height: 900,
    anchors: [
      ["book-month", "#book-day"],
      ["authors", "#authors"],
      ["sections", "#sections"],
      ["calendar", "#calendar"],
      ["community", "#community"],
    ],
  },
  {
    locale: "en",
    width: 1024,
    height: 768,
    anchors: [
      ["book-month", "#book-day"],
      ["sections", "#sections"],
      ["community", "#community"],
    ],
  },
  {
    locale: "en",
    width: 390,
    height: 844,
    anchors: [
      ["book-month", "#book-day"],
      ["authors", "#authors"],
      ["sections", "#sections"],
      ["community", "#community"],
    ],
  },
];

await mkdir(outputDirectory, { recursive: true });

const browser = await chromium.launch({ channel: "chrome", headless: true });
const manifest = {
  baseUrl,
  capturedAt: new Date().toISOString(),
  browser: await browser.version(),
  method:
    "Playwright viewport captures with reduced motion, disabled transitions, and WebP encoding",
  captures: [],
  browserErrors: [],
};

try {
  for (const entry of captures) {
    const context = await browser.newContext({
      colorScheme: "light",
      locale: entry.locale === "ru" ? "ru-RU" : "en-US",
      reducedMotion: "reduce",
      serviceWorkers: "block",
      viewport: { width: entry.width, height: entry.height },
    });
    await context.addInitScript(() => {
      window.localStorage.setItem("probpera-analytics-consent-v1", "denied");
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => {
      manifest.browserErrors.push({
        locale: entry.locale,
        type: "pageerror",
        message: String(error),
      });
    });
    page.on("console", (message) => {
      if (message.type() === "error") {
        manifest.browserErrors.push({
          locale: entry.locale,
          type: "console",
          message: message.text(),
        });
      }
    });

    await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
    await page.locator(".magazine-hero").waitFor({ state: "visible" });
    if (entry.locale === "en") {
      await page.locator(".interface-language-control button").nth(1).click();
    }
    await page.waitForFunction(
      (locale) => document.documentElement.lang === locale,
      entry.locale
    );
    await page.evaluate(async () => document.fonts.ready);
    await page.addStyleTag({
      content:
        "*,*::before,*::after{animation-duration:0s!important;caret-color:transparent!important;transition-duration:0s!important}",
    });

    for (const [name, selector] of entry.anchors) {
      const locator = page.locator(selector).first();
      await locator.waitFor({ state: "visible" });
      await locator.evaluate((element) => {
        const top = window.scrollY + element.getBoundingClientRect().top;
        window.scrollTo(0, Math.max(0, top - 72));
      });
      await page.waitForTimeout(80);

      const metrics = await page.evaluate((anchorSelector) => {
        const element = document.querySelector(anchorSelector);
        if (!element) throw new Error("Missing capture anchor: " + anchorSelector);
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          anchor: {
            height: Math.round(rect.height),
            top: Math.round(rect.top),
            width: Math.round(rect.width),
          },
          backgroundImage: style.backgroundImage,
          horizontalOverflow:
            document.documentElement.scrollWidth -
            document.documentElement.clientWidth,
        };
      }, selector);

      const buffer = await page.screenshot({
        animations: "disabled",
        fullPage: false,
        type: "png",
      });
      const fileName =
        entry.locale +
        "-" +
        entry.width +
        "x" +
        entry.height +
        "-" +
        name +
        ".webp";
      await sharp(buffer)
        .webp({ quality: 82, smartSubsample: true })
        .toFile(path.join(outputDirectory, fileName));
      manifest.captures.push({
        file: fileName,
        locale: entry.locale,
        selector,
        viewport: { width: entry.width, height: entry.height },
        ...metrics,
      });
    }

    await context.close();
  }
} finally {
  await browser.close();
}

await writeFile(
  path.join(outputDirectory, "manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
  "utf8"
);

if (manifest.browserErrors.length > 0) {
  throw new Error(
    "Stage 5C visual capture recorded browser errors: " +
      JSON.stringify(manifest.browserErrors)
  );
}

if (manifest.captures.some((capture) => capture.horizontalOverflow > 2)) {
  throw new Error("Stage 5C visual capture detected horizontal overflow");
}

process.stdout.write(
  "Stage 5C visual evidence saved: " +
    manifest.captures.length +
    " captures\n"
);
