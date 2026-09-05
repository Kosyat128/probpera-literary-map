import { chromium } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { chooseTypographyLocale, settleTypography } from "./capture-typography-evidence.mjs";

const phase = process.argv[2];
if (!["before", "after"].includes(phase)) throw new Error("Pass before or after");
const baseURL = process.argv[3] || "http://127.0.0.1:4183/probpera-literary-map/";
const directory = `reports/typography-evidence/community-${phase}`;
await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
const measurements = [];
try {
  for (const locale of ["ru", "en"]) {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      await page.goto(baseURL);
      await chooseTypographyLocale(page, locale);
      const section = page.locator("#community");
      await section.scrollIntoViewIfNeeded();
      await page.mouse.move(0, 0);
      await settleTypography(page);
      const authoredText = () => section.evaluate((element) => {
        const copy = element.cloneNode(true);
        copy.querySelector(".community-visual-stats")?.remove();
        return copy.textContent;
      });
      const sectionText = await authoredText();
      await section.screenshot({ path: `${directory}/${locale}-community-${width}.png`, animations: "disabled", style: ".site-header,.mobile-nav{visibility:hidden!important}" });
      const measure = async (root) => root.evaluate((element) => ({
        text: element.textContent,
        overflow: element.scrollWidth - element.clientWidth,
        box: element.getBoundingClientRect().toJSON(),
        textStyles: [...element.querySelectorAll("h2,blockquote,p,li,small,strong,.community-reading-notes > span,.community-visual-rule,button")].map((child) => {
          const style = getComputedStyle(child);
          return { tag: child.tagName, class: child.className, text: child.textContent, font: style.fontFamily, size: style.fontSize,
            weight: style.fontWeight, transform: style.textTransform, tracking: style.letterSpacing, wrap: style.whiteSpace,
            overflowX: child.scrollWidth - child.clientWidth, overflowY: child.scrollHeight - child.clientHeight };
        }),
      }));
      const homepage = await measure(section);
      await section.locator(".community-actions button").first().click();
      const dialog = page.locator(".community-hub");
      await dialog.waitFor();
      await settleTypography(page);
      const forum = await measure(dialog);
      await dialog.screenshot({ path: `${directory}/${locale}-forum-${width}.png`, animations: "disabled" });
      await page.keyboard.press("Escape");
      if (await dialog.count()) throw new Error("Forum did not close on Escape");
      if (await authoredText() !== sectionText) throw new Error("Opening the forum changed authored section text");
      measurements.push({ locale, width, homepage, forum });
    }
    await context.close();
  }
  await writeFile(`${directory}/measurements.json`, JSON.stringify(measurements, null, 2) + "\n");
  console.log(JSON.stringify(measurements.map(({ locale, width, homepage, forum }) => ({ locale, width, homepageOverflow: homepage.overflow, forumOverflow: forum.overflow }))));
} finally {
  await browser.close();
}
