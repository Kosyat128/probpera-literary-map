import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const base = new URL(process.argv[2] || "http://127.0.0.1:4184/");
base.hash = "sections";
const outputDirectory = new URL("../reports/typography-evidence/", import.meta.url);
const repairDirectory = new URL("directory-repair/", outputDirectory);
await mkdir(outputDirectory, { recursive: true });
await mkdir(new URL("after/", outputDirectory), { recursive: true });
await mkdir(repairDirectory, { recursive: true });
const results = [];
const aboutMeasurements = {};
const browser = await chromium.launch({ channel: "chrome", headless: true });

async function measureDirectory(page, language, width, state) {
  const cards = await page.locator("#sections .section-directory-card").evaluateAll((articles) => {
    const rectangle = (element) => {
      if (!element) return null;
      const bounds = element.getBoundingClientRect();
      return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, bottom: bounds.bottom, right: bounds.right };
    };
    const textRectangle = (element) => {
      const range = document.createRange();
      range.selectNodeContents(element);
      return rectangle(range);
    };
    return articles.map((article, index) => {
      const content = article.firstElementChild;
      const title = content.querySelector("h3");
      const latest = content.querySelector(".section-card-latest");
      return {
        index,
        title: title.textContent,
        rectangle: rectangle(article),
        ownRows: getComputedStyle(article).gridTemplateRows,
        contentRows: getComputedStyle(content).gridTemplateRows,
        containerType: getComputedStyle(article).containerType,
        children: [...content.children].map((element) => ({
          className: element.className,
          rectangle: rectangle(element),
          ink: textRectangle(element),
          display: getComputedStyle(element).display,
          empty: !element.textContent.trim(),
        })),
        rail: rectangle(title).x,
        latest: rectangle(latest),
        latestLabel: rectangle(latest?.querySelector("span")),
        latestTitle: rectangle(latest?.querySelector("strong")),
        latestTypography: latest ? {
          fontSize: getComputedStyle(latest.querySelector("strong")).fontSize,
          fontWeight: getComputedStyle(latest.querySelector("strong")).fontWeight,
          lineHeight: getComputedStyle(latest.querySelector("strong")).lineHeight,
          gap: getComputedStyle(latest).gap,
          padding: getComputedStyle(latest).padding,
        } : null,
        arrow: rectangle(content.querySelector(".section-card-action i")),
        actionLabel: rectangle(content.querySelector(".section-card-action strong")),
        overflow: [article, title, content.querySelector("p"), latest].filter(Boolean).map((element) => ({
          horizontal: element.scrollWidth - element.clientWidth,
          vertical: element.scrollHeight - element.clientHeight,
          overflowY: getComputedStyle(element).overflowY,
        })),
      };
    });
  });

  const issues = [];
  const expectedCount = state === "expanded" ? 17 : 8;
  if (cards.length !== expectedCount) issues.push({ kind: "unexpected-card-count", expectedCount, actual: cards.length });
  const rows = [];
  for (const card of cards) {
    let row = rows.find((group) => Math.abs(group[0].rectangle.y - card.rectangle.y) <= 1);
    if (!row) { row = []; rows.push(row); }
    row.push(card);
    if (width > 680) {
      const gridLines = (value) => (value.match(/\[[^\]]*\]/gu) || []).length;
      if (!card.ownRows.startsWith("subgrid") || gridLines(card.ownRows) !== 7 || gridLines(card.contentRows) !== 7) {
        issues.push({ card: card.index, kind: "missing-six-row-subgrid", ownRows: card.ownRows, contentRows: card.contentRows });
      }
      if (card.containerType !== "normal") issues.push({ card: card.index, kind: "subgrid-containment" });
    }
    if (card.children.length !== 6) issues.push({ card: card.index, kind: "missing-semantic-row" });
    let previous = null;
    let previousInk = null;
    for (const child of card.children) {
      const bounds = child.rectangle;
      if (child.display === "none" || bounds.height === 0) {
        if (!child.empty) issues.push({ card: card.index, kind: "hidden-content", child: child.className });
        continue;
      }
      if (bounds.width <= 0 || bounds.height <= 0) issues.push({ card: card.index, kind: "zero-content-size" });
      if (previous && bounds.y < previous.bottom - 0.5) {
        issues.push({ card: card.index, kind: "overlapping-semantic-rows", previous, child: bounds });
      }
      if (bounds.bottom > card.rectangle.bottom + 1) issues.push({ card: card.index, kind: "content-outside-card" });
      if (!child.empty) {
        if (previousInk && child.ink.y < previousInk.bottom - 1) issues.push({ card: card.index, kind: "overlapping-text-ranges" });
        if (child.ink.x < card.rectangle.x - 1 || child.ink.right > card.rectangle.right + 1 ||
            child.ink.y < card.rectangle.y - 1 || child.ink.bottom > card.rectangle.bottom + 1) {
          issues.push({ card: card.index, kind: "text-outside-card" });
        }
        previousInk = child.ink;
      }
      previous = bounds;
    }
    const eyebrow = card.children[0].rectangle;
    if (eyebrow.height > 56) issues.push({ card: card.index, kind: "stretched-eyebrow", height: eyebrow.height });
    if (!card.arrow || card.arrow.width < 44 || card.arrow.width > 56 || card.arrow.height < 44 || card.arrow.height > 56) {
      issues.push({ card: card.index, kind: "invalid-action-circle", arrow: card.arrow });
    }
    if (!card.actionLabel || !card.arrow || Math.abs(
      card.actionLabel.y + card.actionLabel.height / 2 - card.arrow.y - card.arrow.height / 2
    ) > 1) {
      issues.push({ card: card.index, kind: "uncentered-action-label", label: card.actionLabel, arrow: card.arrow });
    }
    if (card.overflow.some((item) => item.horizontal > 1 || (item.vertical > 1 && ["hidden", "clip"].includes(item.overflowY)))) {
      issues.push({ card: card.index, kind: "clipped-content" });
    }
    if (card.latestTitle && (card.latestTitle.y < card.latestLabel.bottom - 1 || card.latestTitle.bottom > card.latest.bottom + 1)) {
      issues.push({ card: card.index, kind: "overlapping-or-clipped-related-title" });
    }
  }

  let maximumRowDelta = 0;
  for (const row of rows) {
    for (let index = 0; index < 6; index++) {
      const positions = row.map((card) => card.children[index]).filter((child) => child.display !== "none").map((child) => child.rectangle.y);
      const delta = positions.length ? Math.max(...positions) - Math.min(...positions) : 0;
      maximumRowDelta = Math.max(maximumRowDelta, delta);
      if (delta > 1) issues.push({ cards: row.map((card) => card.index), kind: "unaligned-semantic-row", row: index, delta });
    }
    for (const landmark of ["latest", "latestLabel", "latestTitle"]) {
      const positions = row.map((card) => card[landmark]?.y).filter((value) => value !== undefined);
      const delta = positions.length ? Math.max(...positions) - Math.min(...positions) : 0;
      maximumRowDelta = Math.max(maximumRowDelta, delta);
      if (delta > 1) issues.push({ cards: row.map((card) => card.index), kind: "unaligned-related-article", landmark, delta });
    }
  }

  const result = { language, width, state, cards: cards.length, rows: rows.length, maximumRowDelta, issues, measurements: cards };
  results.push(result);
  console.log(JSON.stringify({ ...result, measurements: undefined }));
}

try {
  for (const language of ["ru", "en"]) {
    for (const width of [320, 768, 1024, 1440, 1767, 1920]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 } });
      await context.addInitScript((language) => localStorage.setItem("probpera-interface-language", language), language);
      const page = await context.newPage();
      await page.goto(base.href, { waitUntil: "domcontentloaded" });
      await page.locator("#sections .section-directory-card").first().waitFor();
      await measureDirectory(page, language, width, "initial-collapsed");
      await page.evaluate(() => document.fonts.ready);
      await measureDirectory(page, language, width, "loaded-collapsed");
      const expand = page.locator("#sections .section-directory-more");
      if (await expand.count()) await expand.evaluate((element) => element.click());
      await page.waitForFunction(() => document.querySelectorAll("#sections .section-directory-card").length === 17);
      await measureDirectory(page, language, width, "expanded");
      if (width === 1767 || width === 1920) {
        await page.locator("#sections .section-directory-card").evaluateAll((cards) => Promise.all(cards.map(async (card) => {
          const source = getComputedStyle(card).getPropertyValue("--section-art").trim().match(/^url\((["']?)(.*?)\1\)$/u)?.[2];
          if (!source) return;
          const artwork = new Image();
          artwork.src = source;
          await artwork.decode();
        })));
        const hiddenNavigation = await page.addStyleTag({ content: ".site-header, .mobile-nav { visibility: hidden !important; }" });
        await page.locator("#sections .sections-directory-grid").screenshot({
          path: fileURLToPath(new URL(`${language}-directory-expanded-${width}.png`, repairDirectory)),
        });
        const firstRow = await page.locator("#sections .section-directory-card").evaluateAll((cards) => {
          const first = cards[0].getBoundingClientRect();
          const last = cards[3].getBoundingClientRect();
          return { x: first.x + scrollX, y: first.y + scrollY, width: last.right - first.left, height: first.height };
        });
        await page.screenshot({
          path: fileURLToPath(new URL(`${language}-directory-first-row-${width}.png`, repairDirectory)),
          fullPage: true,
          clip: firstRow,
        });
        await hiddenNavigation.evaluate((element) => element.remove());
      }
      await context.close();
    }
    const context = await browser.newContext({ viewport: { width: 320, height: 1000 } });
    await context.addInitScript((language) => localStorage.setItem("probpera-interface-language", language), language);
    const page = await context.newPage();
    await page.goto(base.href);
    await page.locator("#sections .section-directory-more").click();
    const about = page.locator("#sections .section-directory-card").filter({
      has: page.locator("h3", { hasText: /О проекте и редакции|About the project and editors/u }),
    });
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await about.scrollIntoViewIfNeeded();
      await page.mouse.move(0, 0);
      await page.evaluate(async () => {
        await document.fonts.ready;
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      });
      aboutMeasurements[`${language}/${width}`] = await about.evaluate((card) =>
        [...card.querySelectorAll("h3, p, .section-card-action strong, .section-card-action strong span")].map((element) => {
          const style = getComputedStyle(element);
          return { text: element.textContent, font: style.fontFamily, size: style.fontSize, weight: style.fontWeight,
            tracking: style.letterSpacing, transform: style.textTransform, lineClamp: style.webkitLineClamp,
            overflowX: element.scrollWidth - element.clientWidth, overflowY: element.scrollHeight - element.clientHeight };
        })
      );
      await about.screenshot({
        path: fileURLToPath(new URL(`after/${language}-about-project-card-${width}.png`, outputDirectory)),
        animations: "disabled",
        style: ".site-header, .mobile-nav { visibility: hidden !important; }",
      });
      if (language === "ru" && width === 390) {
        const norway = page.locator("#sections .section-card-latest").filter({ hasText: /Норвегия/u });
        await norway.scrollIntoViewIfNeeded();
        await norway.evaluate(async (link) => {
          const source = getComputedStyle(link.closest("article")).getPropertyValue("--section-art").trim().match(/^url\((["']?)(.*?)\1\)$/u)?.[2];
          if (!source) return;
          const artwork = new Image();
          artwork.src = source;
          await artwork.decode();
        });
        await page.mouse.move(0, 0);
        await norway.screenshot({
          path: fileURLToPath(new URL("ru-norway-related-article-390.png", repairDirectory)),
          animations: "disabled",
          style: ".site-header, .mobile-nav { visibility: hidden !important; }",
        });
      }
    }
    await context.close();
  }
} finally {
  await writeFile(new URL("directory-alignment.json", outputDirectory), JSON.stringify(results, null, 2));
  await writeFile(new URL("after/directory-geometry.json", outputDirectory), JSON.stringify(aboutMeasurements, null, 2));
  await browser.close();
}

if (results.some((result) => result.issues.length > 0)) process.exitCode = 1;
