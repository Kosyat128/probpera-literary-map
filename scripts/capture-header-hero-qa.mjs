import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const stage = process.argv[2];
const baseUrl = process.argv[3] ?? "http://127.0.0.1:4173/";

if (!stage || !/^(?:before|after)$/u.test(stage)) {
  throw new Error("Usage: node scripts/capture-header-hero-qa.mjs <before|after> [baseUrl]");
}

const outputDirectory = path.resolve("docs", "ui-header-hero-artifacts", stage);
await mkdir(outputDirectory, { recursive: true });

const matrices = {
  ru: [
    [320, 800],
    [360, 800],
    [390, 844],
    [430, 932],
    [768, 1024],
    [1024, 768],
    [1280, 800],
    [1366, 768],
    [1440, 900],
    [1920, 1080],
  ],
  en: [
    [360, 800],
    [768, 1024],
    [1440, 900],
    [1920, 1080],
  ],
};

const browser = await chromium.launch({ channel: "chrome", headless: true });

async function saveScreenshot(page, name, screenshotOptions) {
  const buffer = await page.screenshot({ animations: "disabled", ...screenshotOptions });
  await sharp(buffer).webp({ quality: 84, smartSubsample: true }).toFile(
    path.join(outputDirectory, `${name}.webp`)
  );
}

async function settle(page, locale) {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.locator(".magazine-hero").waitFor({ state: "visible" });
  const localeIndex = locale === "ru" ? 0 : 1;
  await page.locator(".interface-language-control button").nth(localeIndex).click();
  await page.locator("html").waitFor({ state: "visible" });
  await page.waitForFunction(
    (expected) => document.documentElement.lang === expected,
    locale
  );
  await page.evaluate(async () => {
    await document.fonts.ready;
    const images = [...document.images].filter((image) => {
      const box = image.getBoundingClientRect();
      return box.bottom > 0 && box.top < window.innerHeight * 1.4;
    });
    await Promise.all(
      images.map((image) =>
        image.complete
          ? Promise.resolve()
          : new Promise((resolve) => {
              image.addEventListener("load", resolve, { once: true });
              image.addEventListener("error", resolve, { once: true });
            })
      )
    );
  });
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-delay: 0s !important;
        animation-duration: 0s !important;
        caret-color: transparent !important;
        transition-delay: 0s !important;
        transition-duration: 0s !important;
      }
    `,
  });
  await page.waitForTimeout(80);
}

async function captureMatrix(locale, width, height) {
  const context = await browser.newContext({
    colorScheme: "light",
    locale: locale === "ru" ? "ru-RU" : "en-US",
    reducedMotion: "reduce",
    viewport: { width, height },
  });
  await context.addInitScript(() => {
    window.localStorage.setItem("probpera-analytics-consent-v1", "denied");
  });
  const page = await context.newPage();
  await settle(page, locale);
  const prefix = `${locale}-${width}x${height}`;

  const headerEnd = await page.evaluate(() => {
    const nodes = [
      document.querySelector(".topline"),
      document.querySelector(".site-header"),
      document.querySelector(".mobile-nav"),
    ].filter(Boolean);
    return Math.ceil(Math.max(...nodes.map((node) => node.getBoundingClientRect().bottom)));
  });
  await saveScreenshot(page, `${prefix}-header`, {
    clip: { x: 0, y: 0, width, height: Math.max(1, headerEnd) },
  });
  await saveScreenshot(page, `${prefix}-hero`, {
    clip: await page.locator(".magazine-hero").boundingBox(),
  });
  const heroBottom = await page.locator(".magazine-hero").evaluate((element) =>
    Math.ceil(element.getBoundingClientRect().bottom)
  );
  await saveScreenshot(page, `${prefix}-header-hero`, {
    clip: { x: 0, y: 0, width, height: Math.max(1, heroBottom) },
  });

  await context.close();
}

for (const [locale, viewports] of Object.entries(matrices)) {
  for (const [width, height] of viewports) {
    await captureMatrix(locale, width, height);
  }
}

async function captureState(name, viewport, action) {
  const context = await browser.newContext({
    colorScheme: "light",
    locale: "ru-RU",
    reducedMotion: "reduce",
    viewport,
  });
  await context.addInitScript(() => {
    window.localStorage.setItem("probpera-analytics-consent-v1", "denied");
  });
  const page = await context.newPage();
  await settle(page, "ru");
  await action(page);
  await saveScreenshot(page, name, { fullPage: false });
  await context.close();
}

await captureState("ru-1440x900-articles-menu", { width: 1440, height: 900 }, async (page) => {
  await page.locator(".articles-menu > summary").click();
  await page.locator(".articles-mega-menu").waitFor({ state: "visible" });
});
await captureState("ru-1440x900-sections-menu", { width: 1440, height: 900 }, async (page) => {
  await page.locator(".sections-menu > summary").click();
  await page.locator(".sections-mega-menu").waitFor({ state: "visible" });
});
await captureState("ru-360x800-mobile-navigation", { width: 360, height: 800 }, async (page) => {
  await page.locator(".mobile-nav").evaluate((element) => {
    element.scrollLeft = Math.max(0, element.scrollWidth - element.clientWidth);
  });
});
await captureState("ru-1440x900-sticky-header", { width: 1440, height: 900 }, async (page) => {
  await page.evaluate(() => window.scrollTo(0, Math.min(900, document.body.scrollHeight / 3)));
  await page.waitForTimeout(80);
});
await captureState("ru-1440x900-footer-menu", { width: 1440, height: 900 }, async (page) => {
  await page.locator(".site-footer").scrollIntoViewIfNeeded();
  await page.waitForTimeout(80);
});

await browser.close();
console.log(`Header/Hero ${stage} screenshots saved to ${outputDirectory}`);
