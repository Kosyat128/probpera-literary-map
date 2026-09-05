import { chromium } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const typographyViewports = [
  [320, 800], [360, 800], [390, 844], [430, 932], [768, 1024],
  [1024, 768], [1280, 800], [1366, 768], [1440, 900], [1920, 1080],
].map(([width, height]) => ({ width, height }));

export async function settleTypography(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

export async function chooseTypographyLocale(page, locale) {
  await page.locator(".interface-language-control button").nth(locale === "ru" ? 0 : 1).click();
  await page.waitForFunction((value) => document.documentElement.lang === value, locale);
  await settleTypography(page);
}

export function japaneseCard(page) {
  return page.locator(".editorial-grid article").filter({
    has: page.locator("h3", { hasText: /Семь знаковых писателей Японии|Seven landmark writers from Japan/u }),
  });
}

export async function measureTypography(page) {
  return page.evaluate(() => {
    const rect = (element) => {
      const { x, y, width, height, top, right, bottom, left } = element.getBoundingClientRect();
      return { x, y, width, height, top, right, bottom, left };
    };
    const measure = (element) => {
      const style = getComputedStyle(element);
      const range = document.createRange();
      range.selectNodeContents(element);
      const ink = range.getBoundingClientRect();
      const clippedBy = [];
      if (element.matches("h3, .article-copy > p, .library-card-copy > p, .section-link")) {
        for (let ancestor = element; ancestor; ancestor = ancestor.parentElement) {
          const ancestorStyle = getComputedStyle(ancestor);
          const bounds = ancestor.getBoundingClientRect();
          const clipsX = /^(hidden|clip)$/u.test(ancestorStyle.overflowX);
          const clipsY = /^(hidden|clip)$/u.test(ancestorStyle.overflowY);
          if ((clipsX && (ink.left < bounds.left - 1 || ink.right > bounds.right + 1)) ||
              (clipsY && (ink.top < bounds.top - 1 || ink.bottom > bounds.bottom + 1))) {
            clippedBy.push(ancestor.className || ancestor.tagName);
          }
        }
      }
      return {
        text: element.textContent,
        rect: rect(element),
        ink: { top: ink.top, right: ink.right, bottom: ink.bottom, left: ink.left },
        clippedBy,
        font: style.fontFamily,
        fontSize: parseFloat(style.fontSize),
        lineHeight: style.lineHeight,
        overflowX: element.scrollWidth - element.clientWidth,
        overflowY: element.scrollHeight - element.clientHeight,
        overflowBlock: style.overflowY,
        whiteSpace: style.whiteSpace,
        lineClamp: style.webkitLineClamp,
      };
    };
    const cards = [...document.querySelectorAll(".editorial-grid article, .article-library-grid article")]
      .map((card) => ({
        rect: rect(card),
        title: measure(card.querySelector("h3")),
        excerpt: measure(card.querySelector(".article-copy > p, .library-card-copy > p")),
        copy: measure(card.querySelector(".article-copy, .library-card-copy")),
        section: card.querySelector(".section-link") ? measure(card.querySelector(".section-link")) : null,
        share: [...card.querySelectorAll(".share-links a, .share-links button")].map(measure),
      }));
    return {
      viewport: { width: innerWidth, height: innerHeight },
      documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      fonts: [...document.fonts].filter((font) => font.status === "loaded").map((font) => ({ family: font.family, weight: font.weight })),
      cards,
      hero: [...document.querySelectorAll(".hero-editorial h1, .hero-editorial > p")].map(measure),
      footer: [...document.querySelectorAll(".site-footer h2, .site-footer p, .site-footer a, .site-footer button")].map(measure),
      reader: [...document.querySelectorAll(".article-reader-lead h1, .article-reader-content > p, .article-reader-content h2, .article-reader-content h3")].slice(0, 8).map(measure),
    };
  });
}

async function capture({ phase, baseURL, outDirectory }) {
  if (!["before", "after"].includes(phase)) throw new Error("Use --phase=before or --phase=after");
  const output = path.resolve(outDirectory, phase);
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({ channel: "chrome" });
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("pageerror", (error) => consoleErrors.push(error.message));
  const snapshots = {};
  const geometry = {};
  const directoryGeometry = {};
  const cropWidths = new Set([320, 360, 390, 430, 768, 1440]);
  try {
    for (const locale of ["ru", "en"]) {
      await page.goto(baseURL);
      await page.locator(".editorial-grid").waitFor();
      await chooseTypographyLocale(page, locale);
      for (const viewport of typographyViewports) {
        await page.setViewportSize(viewport);
        const reference = japaneseCard(page);
        await reference.scrollIntoViewIfNeeded();
        await reference.locator("img").evaluate((image) => image.decode());
        await settleTypography(page);
        geometry[`${locale}/home/${viewport.width}`] = await measureTypography(page);
        if (cropWidths.has(viewport.width)) {
          await reference.screenshot({ path: path.join(output, `${locale}-japan-card-${viewport.width}.png`), animations: "disabled", style: ".site-header, .mobile-nav { visibility: hidden !important; }" });
        }
      }
      await page.setViewportSize({ width: 1440, height: 900 });
      await settleTypography(page);
      snapshots[`${locale}/home`] = await page.locator(".site-header, .magazine-hero, .editorial-grid, .site-footer").allTextContents();
      // Return the cover to the viewport before capture. A decoded responsive
      // image after many offscreen resizes is not sufficient to prove repaint.
      await page.goto(baseURL);
      await page.locator(".hero-cover img").evaluate((image) => image.decode());
      await settleTypography(page);
      await page.locator(".magazine-hero").screenshot({ path: path.join(output, `${locale}-hero-1440.png`), animations: "disabled" });
      await page.locator(".site-footer").screenshot({ path: path.join(output, `${locale}-footer-1440.png`), animations: "disabled" });

      if (await page.locator(".section-directory-more").count()) await page.locator(".section-directory-more").click();
      const about = page.locator(".section-directory-card").filter({ has: page.locator("h3", { hasText: /О проекте и редакции|About the project and editors/u }) });
      for (const width of [320, 390, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await about.scrollIntoViewIfNeeded();
        await settleTypography(page);
        directoryGeometry[`${locale}/${width}`] = await about.evaluate((card) =>
          [...card.querySelectorAll("h3, p, .section-card-action strong, .section-card-action strong span")].map((element) => {
            const style = getComputedStyle(element);
            return { text: element.textContent, font: style.fontFamily, size: style.fontSize, weight: style.fontWeight,
              tracking: style.letterSpacing, transform: style.textTransform, lineClamp: style.webkitLineClamp,
              overflowX: element.scrollWidth - element.clientWidth, overflowY: element.scrollHeight - element.clientHeight };
          })
        );
        await about.screenshot({ path: path.join(output, `${locale}-about-project-card-${width}.png`), animations: "disabled", style: ".site-header, .mobile-nav { visibility: hidden !important; }" });
      }
      await page.setViewportSize({ width: 1440, height: 900 });
      if (phase === "after" && locale === "ru") {
        await page.screenshot({ path: path.join(output, "ru-homepage-full-1440.png"), fullPage: true, animations: "disabled", style: ".site-header, .mobile-nav { position: relative !important; }" });
      }
      if (phase === "after" && locale === "en") {
        await page.setViewportSize({ width: 390, height: 844 });
        await settleTypography(page);
        await page.screenshot({ path: path.join(output, "en-homepage-full-390.png"), fullPage: true, animations: "disabled", style: ".site-header, .mobile-nav { position: relative !important; }" });
        await page.setViewportSize({ width: 1440, height: 900 });
      }

      await page.goto(new URL("#journal", baseURL).href);
      await page.locator(".article-library-grid h3").first().waitFor();
      await settleTypography(page);
      snapshots[`${locale}/archive`] = await page.locator(".article-library").textContent();
      geometry[`${locale}/archive/1440`] = await measureTypography(page);
      await page.locator(".article-library-grid article").first().screenshot({ path: path.join(output, `${locale}-archive-card-1440.png`), animations: "disabled" });
      const articleLinks = await page.locator(".article-library-grid article > a").evaluateAll((links) => links.slice(0, 3).map((link) => link.href));
      for (let index = 0; index < articleLinks.length; index++) {
        await page.goto(articleLinks[index]);
        await page.locator(".article-reader-content").waitFor();
        await settleTypography(page);
        snapshots[`${locale}/article/${index}`] = await page.locator(".article-reader-lead, .article-reader-content").allTextContents();
        geometry[`${locale}/article/${index}/1440`] = await measureTypography(page);
        if (index === 0) await page.screenshot({ path: path.join(output, `${locale}-reader-1440.png`), animations: "disabled" });
      }
    }
    const textJSON = JSON.stringify(snapshots, null, 2) + "\n";
    await writeFile(path.join(output, "text-snapshots.json"), textJSON);
    await writeFile(path.join(output, "geometry.json"), JSON.stringify(geometry, null, 2) + "\n");
    await writeFile(path.join(output, "directory-geometry.json"), JSON.stringify(directoryGeometry, null, 2) + "\n");
    const summary = {
      phase, baseURL,
      textSha256: createHash("sha256").update(textJSON).digest("hex"),
      snapshotCount: Object.keys(snapshots).length,
      geometryCount: Object.keys(geometry).length,
      consoleErrors: [...new Set(consoleErrors)],
    };
    if (phase === "after") {
      const before = await readFile(path.resolve(outDirectory, "before/text-snapshots.json"), "utf8");
      summary.textUnchanged = before === textJSON;
      const previous = JSON.parse(before);
      summary.changedTextKeys = Object.keys(snapshots).filter((key) => JSON.stringify(previous[key]) !== JSON.stringify(snapshots[key]));
    }
    await writeFile(path.join(output, "summary.json"), JSON.stringify(summary, null, 2) + "\n");
    console.log(JSON.stringify(summary));
    if (summary.textUnchanged === false) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = Object.fromEntries(process.argv.slice(2).map((argument) => argument.replace(/^--/u, "").split("=")));
  await capture({
    phase: options.phase,
    baseURL: options.url || "http://127.0.0.1:4183/probpera-literary-map/",
    outDirectory: options.out || "reports/typography-evidence",
  });
}
