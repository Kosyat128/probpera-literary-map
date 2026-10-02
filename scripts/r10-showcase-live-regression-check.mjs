import { chromium, expect } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const origin = process.env.SHOWCASE_QA_ORIGIN || "http://127.0.0.1:5193/probpera-literary-map/";
const snapshotPath = new URL("../../r10-live-regressions-cache/published-content-20261002.json", import.meta.url);
const output = "reports/r10/showcase/live-regression-20261002";
const snapshotBytes = await readFile(snapshotPath);
const snapshot = JSON.parse(snapshotBytes);
await mkdir(output, { recursive: true });
const report = {
  checkedAt: new Date().toISOString(),
  source: "Current local source with the unchanged canonical public CMS snapshot injected for QA",
  snapshot: { url: "https://probpera.ru/cms/published-content.json", generatedAt: snapshot.generatedAt, count: snapshot.articles.length, sha256: createHash("sha256").update(snapshotBytes).digest("hex") },
  mediaTransport: "Node fetch forwards the original public image bytes because direct Chrome requests reset in this environment",
  humanReview: false,
  desktop: [], mobile: [], navigation: [], fixtures: [],
};
const imageCache = new Map();
const browser = await chromium.launch({ channel: "chrome", headless: true });
report.browser = browser.version();

async function setup(page, entries = snapshot.articles) {
  await page.route("**/src/data/articles/catalog.ts*", route => route.fulfill({ contentType: "application/javascript", body: `export const articleCatalog=${JSON.stringify(entries)};` }));
  await page.route("https://*.supabase.co/storage/v1/object/public/editorial-media/**", async route => {
    const url = route.request().url();
    if (!imageCache.has(url)) imageCache.set(url, fetch(url, { signal: AbortSignal.timeout(20000) }).then(async response => ({ status: response.status, contentType: response.headers.get("content-type") || "image/webp", body: Buffer.from(await response.arrayBuffer()) })));
    await route.fulfill(await imageCache.get(url));
  });
  await page.goto(origin);
}

async function open(page) {
  await page.locator(".articles-menu > summary").click();
  await expect(page.locator(".articles-mega-content a")).toHaveCount(7);
  await page.locator(".articles-mega-lead img").evaluate(image => image.decode());
  await page.evaluate(() => document.fonts.ready);
}

function geometry(page) {
  return page.locator(".articles-mega-menu").evaluate(panel => {
    const box = node => node.getBoundingClientRect().toJSON();
    const lead = panel.querySelector(".articles-mega-lead"), image = lead.querySelector("img");
    const cards = [...panel.querySelectorAll(".articles-mega-card")];
    return { panel: box(panel), lead: box(lead), image: image && box(image), ratio: image && image.naturalWidth / image.naturalHeight, imageFit: image && getComputedStyle(image).objectFit,
      scroll: panel.scrollHeight - panel.clientHeight, documentOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      nestedOverflow: [lead, ...cards].map(node => [node.scrollWidth - node.clientWidth, node.scrollHeight - node.clientHeight]),
      cards: cards.map(node => ({ bounds: box(node), title: node.querySelector("strong").textContent, excerpt: node.querySelector("p")?.textContent || "", href: node.getAttribute("href"), image: node.querySelector("img")?.currentSrc || "", imageNatural: node.querySelector("img")?.naturalWidth || 0 })),
      leadTitle: lead.querySelector("strong").textContent, leadDescription: lead.querySelector("p").textContent, count: panel.querySelector("footer span").textContent,
      titleFont: getComputedStyle(lead.querySelector("strong")).fontSize, leadBackground: getComputedStyle(lead).backgroundColor };
  });
}

try {
  for (const [width, height] of [[1440, 900], [1280, 720], [1280, 600]]) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    await setup(page); await open(page);
    const panel = page.locator(".articles-mega-menu");
    await panel.evaluate(node => node.scrollTop = node.scrollHeight);
    await expect(panel.locator("footer a")).toBeInViewport();
    await page.locator(".articles-mega-card img").evaluateAll(images => Promise.all(images.map(image => image.decode())));
    await panel.evaluate(node => node.scrollTop = 0);
    const g = await geometry(page);
    expect(g.panel.bottom).toBeLessThanOrEqual(height);
    expect(g.documentOverflow).toBeLessThanOrEqual(1);
    expect(g.image.width).toBeCloseTo(g.lead.width - 1, 0);
    expect(Math.abs(g.image.width / g.image.height - g.ratio)).toBeLessThan(.01);
    expect(g.imageFit).toBe("contain");
    expect(g.cards.every(card => card.imageNatural > 0 && card.excerpt)).toBe(true);
    expect(g.nestedOverflow.every(([x, y]) => x <= 1 && y <= 1)).toBe(true);
    expect(g.leadTitle).toBe(snapshot.articles[0].title);
    expect(g.leadDescription).toBe(snapshot.articles[0].description);
    await page.screenshot({ path: `${output}/after-live174-${width}x${height}.png` });
    await page.keyboard.press("Escape"); await expect(page.locator(".articles-menu > summary")).toBeFocused();
    await page.keyboard.press("Space"); await page.keyboard.press("Tab");
    await expect(page.locator(".articles-mega-lead")).toBeFocused();
    await page.mouse.move(4, height - 4); await expect(page.locator(".articles-menu")).toHaveAttribute("open", "");
    report.desktop.push({ width, height, ...g, footerReachable: true, keyboardAndMouse: true });
    await page.close();
  }

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await setup(page); await open(page);
  await page.route("**/cms/articles/*.json", async route => {
    const path = new URL(route.request().url()).pathname.replace(new URL(origin).pathname, "/");
    const response = await fetch(`https://probpera.ru${path}`, { signal: AbortSignal.timeout(20000) });
    await route.fulfill({ status: response.status, contentType: "application/json", body: await response.text() });
  });
  const links = await page.locator(".articles-mega-content a").evaluateAll(anchors => anchors.map(anchor => ({ id: anchor.dataset.articleId, href: anchor.getAttribute("href"), title: anchor.querySelector("strong").textContent })));
  for (const link of links) {
    await page.locator(`a[data-article-id="${link.id}"]`).click();
    await expect(page.locator(".article-reader-content")).toBeVisible();
    await expect(page.locator(".article-reader-content")).not.toBeEmpty();
    expect(new URL(page.url()).pathname).toBe(link.href);
    report.navigation.push({ ...link, readerOpened: true });
    await page.goto(origin); await open(page);
  }
  await page.close();

  for (const width of [320, 390, 430, 1259, 1260, 1261]) {
    const mobile = await browser.newPage({ viewport: { width, height: 900 } });
    await setup(mobile);
    const rail = mobile.locator(".mobile-nav");
    const railVisible = await rail.isVisible();
    expect(railVisible).toBe(width <= 1260);
    const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    if (railVisible) await expect(rail.getByRole("link", { name: "Статьи", exact: true })).toHaveAttribute("href", "#journal");
    if (width === 320 || width === 390) await mobile.screenshot({ path: `${output}/mobile-${width}.png` });
    report.mobile.push({ width, railVisible, overflow, articleLink: railVisible ? "#journal" : null });
    await mobile.close();
  }

  const missing = await browser.newPage({ viewport: { width: 1280, height: 600 } });
  await missing.route("**/showcase-missing-fixture.webp", route => route.fulfill({ status: 404, body: "missing" }));
  await setup(missing, snapshot.articles.slice(0, 7).map(article => ({ ...article, imageUrl: "/showcase-missing-fixture.webp" })));
  await missing.locator(".articles-menu > summary").click();
  await expect(missing.locator(".articles-mega-image-fallback")).toBeVisible();
  const fallback = await missing.locator(".articles-mega-lead-media").boundingBox();
  const fallbackLead = await missing.locator(".articles-mega-lead").boundingBox();
  expect(fallback.width).toBeCloseTo(fallbackLead.width - 1, 0);
  await missing.screenshot({ path: `${output}/image-fallback-1280x600.png` });
  report.fixtures.push({ name: "404 full-width lead fallback", width: fallback.width, leadWidth: fallbackLead.width, passed: true });
  await missing.close();

  const portrait = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="320"><rect x="2" y="2" width="156" height="316" fill="#f3ede5" stroke="#572273" stroke-width="4"/><path d="M0 0L160 320M160 0L0 320" stroke="#df6411" stroke-width="3"/></svg>');
  const stressEntries = snapshot.articles.slice(0, 7).map((article, index) => ({ ...article, id: `stress-${index}`, sectionId: `stress-${index}`, publishedAt: "2026-09-01T00:00:00Z", imageUrl: portrait,
    title: `Часть 10. ${"Полное длинное литературное название со словами и «кавычками». ".repeat(5)}`, description: "Полный авторский анонс главной статьи. ".repeat(15),
    translations: { en: { locale: "en", title: `Part 10. ${"A complete long literary title with words and quotes. ".repeat(5)}`, description: "A complete original editorial announcement. ".repeat(15), sectionLabel: "Literary studies", publishedLabel: "1 September 2026", publishedAt: "2026-09-01T00:00:00Z", readingMinutes: 5, wordCount: 1000, headingCount: 3, translationStatus: "published" } } }));
  for (const language of ["ru", "en"]) {
    const stress = await browser.newPage({ viewport: { width: 1280, height: 600 } });
    await setup(stress, stressEntries);
    if (language === "en") await stress.locator(".interface-language-control button").nth(1).click();
    await open(stress);
    const expectedTitle = language === "ru" ? stressEntries[0].title : stressEntries[0].translations.en.title;
    await expect(stress.locator(".articles-mega-lead strong")).toHaveText(expectedTitle);
    await stress.evaluate(() => {
      const nodes = [...document.querySelectorAll(".articles-mega-menu :is(strong,p,small,em,span,a)")];
      const sizes = nodes.map(node => parseFloat(getComputedStyle(node).fontSize));
      nodes.forEach((node, index) => node.style.setProperty("font-size", `${sizes[index] * 2}px`, "important"));
    });
    await stress.addStyleTag({ content: ".articles-mega-menu :is(strong,p,small,em,span,a){line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}.articles-mega-menu p{margin-bottom:2em!important}" });
    const g = await geometry(stress);
    expect(g.documentOverflow).toBeLessThanOrEqual(1);
    expect(g.nestedOverflow.every(([x, y]) => x <= 1 && y <= 1)).toBe(true);
    expect(g.image.width / g.image.height).toBeCloseTo(.5, 2);
    await stress.locator(".articles-mega-menu").evaluate(node => node.scrollTop = node.scrollHeight);
    await expect(stress.locator(".articles-mega-menu > footer a")).toBeInViewport();
    await stress.screenshot({ path: `${output}/stress-${language}-text-spacing-footer.png` });
    report.fixtures.push({ name: `Long ${language} titles, portrait, 200 percent text and spacing`, documentOverflow: g.documentOverflow, scroll: g.scroll, fullTitle: true, footerReachable: true });
    await stress.close();
  }
  report.status = "passed";
} catch (error) {
  report.status = "failed"; report.error = String(error); process.exitCode = 1;
} finally {
  await browser.close();
  report.sourceHashes = Object.fromEntries(await Promise.all(["src/components/HeaderArticlesMenu.tsx", "src/styles/header-showcase-r10.css"].map(async path => [path, createHash("sha256").update(await readFile(path)).digest("hex")])));
  await writeFile(`${output}/focused-qa.json`, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ status: report.status, desktop: report.desktop.length, navigation: report.navigation.length, mobile: report.mobile.length, error: report.error }));
}
