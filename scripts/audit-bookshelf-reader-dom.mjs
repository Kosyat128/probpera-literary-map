import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const baseURL = process.argv[2] || "http://127.0.0.1:4185/";
const out = path.resolve("reports/bookshelf-owner-evidence/reader-dom");
await mkdir(out, { recursive: true });
const reportName = process.argv[5] || "reader-dom-audit";
const widths = (process.argv[4] || "320,390,767,1024,1366,1920").split(",").map(Number);
const injectedCSS = process.argv[6] === "source-css" ? await readFile("src/styles/book-dossier.css", "utf8") : null;
const prior = process.argv[3] && !process.argv[5] ? await readFile(path.join(out, `${reportName}.json`), "utf8").then(JSON.parse).catch(() => null) : null;
const report = prior || { url: baseURL, capturedAt: new Date().toISOString(), cases: [], flows: [], accessibility: [], errors: [] };
report.errors = [];
report.sourceCSSInjected = Boolean(injectedCSS);
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 1920, height: 1000 }, deviceScaleFactor: 1 });
const page = await context.newPage();
page.setDefaultTimeout(12000);

async function settle() {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

async function measure(label) {
  await settle();
  const result = await page.evaluate(() => {
    const visible = element => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden";
    const metrics = [];
    for (const element of document.querySelectorAll(".book-dossier-reader :is(h4,p,dt,dd,summary,input,a,button), .book-detail-copy > p, .book-detail-copy h3, .book-detail-actions button, .book-detail-close, .book-shelf-controls :is(button,input), .book-shelf-navigation button, .archive-book-save, .archive-book-detail")) {
      if (!visible(element)) continue;
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const range = document.createRange(); range.selectNodeContents(element);
      const ink = range.getBoundingClientRect();
      const clippedBy = [];
      let scrollsY = false;
      for (let parent = element; parent && !parent.classList.contains("book-shelf-frame"); parent = parent.parentElement) {
        const parentStyle = getComputedStyle(parent), bounds = parent.getBoundingClientRect();
        if (/^(auto|scroll)$/u.test(parentStyle.overflowY) && parent.scrollHeight > parent.clientHeight) scrollsY = true;
        if (ink.width > 0 && ink.height > 0 && ((/^(hidden|clip)$/u.test(parentStyle.overflowX) && (ink.left < bounds.left - 1 || ink.right > bounds.right + 1)) ||
            (!scrollsY && /^(hidden|clip)$/u.test(parentStyle.overflowY) && (ink.top < bounds.top - 1 || ink.bottom > bounds.bottom + 1)))) clippedBy.push(parent.className || parent.tagName);
      }
      metrics.push({ tag: element.tagName, className: element.className, text: element.textContent?.trim(),
        x: rect.x, y: rect.y, width: rect.width, height: rect.height, fontSize: parseFloat(style.fontSize), fontFamily: style.fontFamily,
        weight: style.fontWeight, lineHeight: style.lineHeight, textTransform: style.textTransform,
        touchTarget: element.matches("button,input,summary"), disabled: Boolean(element.disabled), clippedBy });
    }
    const reader = document.querySelector(".book-dossier-reader__page");
    const range = document.createRange(); range.selectNodeContents(reader);
    const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
    const copied = selection.toString().replace(/\s+/gu, " ").trim();
    const expected = reader.innerText.replace(/\s+/gu, " ").trim();
    selection.removeAllRanges();
    return { viewport: { width: innerWidth, height: innerHeight }, mode: document.querySelector(".book-shelf-frame")?.getAttribute("data-book-shelf-mode"),
      pageOverflow: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
      documentGeometry: { scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth, zoom: getComputedStyle(document.documentElement).zoom, bodyWidth: document.body.getBoundingClientRect().width }, metrics,
      smallTargets: metrics.filter(item => item.touchTarget && !item.disabled && (item.width < 43.99 || item.height < 43.99)),
      clipped: metrics.filter(item => item.clippedBy.length), tinyText: metrics.filter(item => item.fontSize < 12),
      selectionMatchesVisibleText: copied === expected, copiedCharacters: copied.length,
      sourceLinks: [...reader.querySelectorAll("a")].map(link => ({ text: link.textContent, href: link.href })) };
  });
  report.cases.push({ label, ...result });
  return result;
}

async function crop(name) {
  await page.locator(".book-shelf-frame__detail").scrollIntoViewIfNeeded();
  const box = await page.locator(".book-shelf-frame__detail").boundingBox();
  const viewport = page.viewportSize();
  const x = Math.max(0, box.x), y = Math.max(0, box.y);
  const width = Math.min(box.x + box.width, viewport.width) - x;
  const height = Math.min(box.y + box.height, viewport.height) - y;
  if (width > 0 && height > 0) await page.screenshot({ path: path.join(out, name), clip: { x, y, width, height } });
}

async function buttonStates(locale) {
  const button = page.locator(".book-detail-read-dossier");
  await button.scrollIntoViewIfNeeded();
  const snapshot = () => button.evaluate(element => {
    const style = getComputedStyle(element), rect = element.getBoundingClientRect();
    return { width: rect.width, height: rect.height, font: style.fontFamily, size: style.fontSize, weight: style.fontWeight,
      transform: style.transform, textTransform: style.textTransform, color: style.color, background: style.backgroundColor,
      shadow: style.boxShadow, outline: style.outline, focusVisible: element.matches(":focus-visible"), active: element.matches(":active") };
  });
  await page.mouse.move(0, 0);
  const normal = await snapshot();
  await button.hover();
  await settle();
  const hover = await snapshot();
  const box = await button.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await settle();
  const pressed = await snapshot();
  await page.mouse.up();
  await button.focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  const focus = await snapshot();
  report.flows.push({ locale, label: "primary-button-states", viewport: page.viewportSize(), normal, hover, pressed, focus });
  await page.locator(".book-detail-actions").screenshot({ path: path.join(out, `${reportName}-${locale}-detail-actions.png`) });
}

try {
  for (const locale of (process.argv[3] || "ru,en").split(",")) {
    await page.emulateMedia({ reducedMotion: "reduce", forcedColors: "none" });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(new URL("#books", baseURL).href, { waitUntil: "domcontentloaded" });
    if (injectedCSS) await page.addStyleTag({ content: injectedCSS });
    await page.locator(".interface-language-control button").filter({ hasText: locale.toUpperCase() }).first().click();
    await page.waitForFunction(value => document.documentElement.lang === value, locale);
    await page.locator(".book-shelf-controls__views > button").nth(1).click();
    const trigger = page.locator('.archive-book-detail[data-book-key="england:george_orwell:nineteen-eighty-four"]');
    await trigger.click();
    await page.locator(".book-dossier-reader").waitFor();
    const reader = page.locator(".book-dossier-reader");
    await buttonStates(locale);
    const title = reader.locator("h4");
    const firstTitle = await title.innerText();
    const next = reader.locator(".book-dossier-reader__pager button").last();
    await next.click();
    await settle();
    const nextTitle = await title.innerText();
    await reader.locator(".book-dossier-reader__pager button").first().click();
    await settle();
    const returnedTitle = await title.innerText();
    await reader.locator(".book-dossier-reader__header button").click();
    const entries = reader.locator("nav button");
    const entryCount = await entries.count();
    const targetTitle = await entries.last().innerText();
    await entries.last().click();
    await settle();
    const contentsTitle = await title.innerText();
    const sources = reader.locator(".book-dossier-reader__sources summary");
    if (await sources.count()) await sources.click();
    report.flows.push({ locale, firstTitle, nextTitle, returnedTitle, nextChanged: nextTitle !== firstTitle, previousReturned: returnedTitle === firstTitle, entryCount, targetTitle, contentsTitle, contentsNavigated: targetTitle === contentsTitle });
    await reader.locator(".book-dossier-reader__header button").click();
    const sourceEntry = reader.locator("nav button").filter({ hasText: /Источники и права|Sources and rights/u });
    if (await sourceEntry.count()) {
      await sourceEntry.click();
      await reader.locator(".book-dossier-reader__sources summary").click();
      report.flows.push({ locale, label: "real-source-section", links: await reader.locator(".book-dossier-reader__sources a").count() });
    } else {
      await reader.locator(".book-dossier-reader__header button").click();
      report.errors.push(`${locale}: real source section unavailable`);
    }
    for (const width of widths) {
      await page.setViewportSize({ width, height: 1000 });
      if (width === 320 && locale === "ru") await page.locator(".book-shelf-controls").screenshot({ path: path.join(out, `${reportName}-ru-controls-320.png`) });
      await page.locator(".book-detail-read-dossier").click();
      await reader.locator(".book-dossier-reader__pager button").last().scrollIntoViewIfNeeded();
      await measure(`${locale}-${width}`);
      if (width === 390 || width === 1920) await crop(`${reportName === "reader-dom-audit" ? "" : `${reportName}-`}${locale}-reader-${width}.png`);
    }
    const accessibility = await new AxeBuilder({ page }).include("#book-archive-detail").withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
    report.accessibility.push({ label: `${locale}-${widths[widths.length - 1]}`, violations: accessibility.violations.map(violation => ({ id: violation.id, impact: violation.impact, description: violation.description, nodes: violation.nodes.map(node => ({ target: node.target, summary: node.failureSummary })) })) });
    if (locale === "ru") {
      // Browser zoom halves the layout viewport and changes media queries.
      // A CSS zoom transform does not, so use the equivalent reflow width.
      await page.setViewportSize({ width: 960, height: 500 });
      await measure("ru-1920-zoom-200-equivalent-reflow");
      await crop(`${reportName}-ru-zoom-200.png`);
      await page.setViewportSize({ width: 1920, height: 1000 });
      await page.emulateMedia({ reducedMotion: "reduce", forcedColors: "active" });
      await measure("ru-forced-colors-reduced-motion");
      const button = reader.locator(".book-dossier-reader__header button");
      await button.focus();
      await page.keyboard.press("Tab");
      report.flows.push({ label: "keyboard-focus-forced-colors", ...(await page.evaluate(() => {
        const element = document.activeElement, style = getComputedStyle(element);
        return { tag: element.tagName, text: element.textContent?.trim(), matchesFocusVisible: element.matches(":focus-visible"), outline: style.outline, outlineOffset: style.outlineOffset, transitionDuration: style.transitionDuration };
      })) });
      await page.emulateMedia({ reducedMotion: "reduce", forcedColors: "none" });
    }
    await page.locator(".book-detail-close").click();
    await settle();
    report.flows.push({ locale, label: "focus-return", ...(await page.evaluate(() => ({ focusedBookKey: document.activeElement?.getAttribute("data-book-key"), detailClosed: !document.querySelector("#book-archive-detail") }))) });
  }
} catch (error) {
  report.errors.push(String(error));
} finally {
  await writeFile(path.join(out, `${reportName}.json`), `${JSON.stringify(report, null, 2)}\n`);
  await browser.close();
}
console.log(JSON.stringify({ cases: report.cases.length, flows: report.flows, issues: report.cases.filter(item => item.pageOverflow || item.clipped.length || item.smallTargets.length || item.tinyText.length || !item.selectionMatchesVisibleText).map(item => ({ label: item.label, overflow: item.pageOverflow, clipped: item.clipped.map(node => ({ text: node.text?.slice(0, 80), clippedBy: node.clippedBy })), smallTargets: item.smallTargets.map(node => ({ text: node.text, width: node.width, height: node.height })), tinyText: item.tinyText.map(node => ({ text: node.text, fontSize: node.fontSize })), selection: item.selectionMatchesVisibleText })), accessibility: report.accessibility, errors: report.errors }));
