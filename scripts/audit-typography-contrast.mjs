import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { chooseTypographyLocale, settleTypography } from "./capture-typography-evidence.mjs";

const baseURL = process.argv[2] || "http://127.0.0.1:4183/probpera-literary-map/";
const output = "reports/typography-evidence";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
const report = [];
try {
  for (const [locale, width] of [["ru", 1440], ["en", 390]]) {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto(baseURL);
    await chooseTypographyLocale(page, locale);
    await page.locator(".hero-cover img").evaluate((image) => image.decode());
    await settleTypography(page);
    await page.screenshot({ path: `${output}/${locale}-homepage-viewport-${width}.png`, animations: "disabled" });
    const result = await new AxeBuilder({ page })
      .include("#community")
      .include(".editorial-grid")
      .include(".site-footer")
      .withRules(["color-contrast"])
      .analyze();
    const smallText = await page.locator("#community, .editorial-grid, .site-footer").evaluateAll((roots) =>
      roots.flatMap((root) => [...root.querySelectorAll("*")].filter((element) =>
        [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim()) &&
        element.getBoundingClientRect().width > 0 && parseFloat(getComputedStyle(element).fontSize) < 12
      ).map((element) => ({ text: element.textContent, selector: element.className || element.tagName, fontSize: getComputedStyle(element).fontSize })))
    );
    const simplify = (items) => items.map((item) => ({
      id: item.id, impact: item.impact,
      nodes: item.nodes.map((node) => ({ target: node.target, text: node.html, summary: node.failureSummary, checks: [...node.any, ...node.all, ...node.none].map((check) => ({ message: check.message, data: check.data })) })),
    }));
    report.push({ locale, width, violations: simplify(result.violations), incomplete: simplify(result.incomplete), smallText });
    await context.close();
  }
  await writeFile(`${output}/contrast.json`, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report.map(({ locale, width, violations, incomplete, smallText }) => ({
    locale, width, violations: violations.flatMap((item) => item.nodes), incomplete: incomplete.flatMap((item) => item.nodes).length, smallText,
  }))));
} finally {
  await browser.close();
}
