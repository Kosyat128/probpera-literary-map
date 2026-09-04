import { expect, test } from "@playwright/test";
import { buildCmsTypographyStylesheet } from "../../src/data/cms/siteTypography.ts";
import {
  chooseTypographyLocale,
  japaneseCard,
  measureTypography,
  settleTypography,
  typographyViewports,
} from "../../scripts/capture-typography-evidence.mjs";

// This spec sets every viewport explicitly. Run once with --project=desktop-chromium.
test.setTimeout(150_000);

function assertReadableCard(card, label) {
  for (const [name, element] of Object.entries({ title: card.title, excerpt: card.excerpt })) {
    expect(element.text.trim(), `${label}/${name} has real content`).not.toBe("");
    expect(element.overflowX, `${label}/${name} horizontal clipping`).toBeLessThanOrEqual(1);
    // Serif glyph ink can extend beyond its line box without being clipped.
    if (element.overflowBlock !== "visible") {
      expect(element.overflowY, `${label}/${name} vertical clipping`).toBeLessThanOrEqual(1);
    }
    expect(element.clippedBy, `${label}/${name} glyph bounds inside clipping ancestors`).toEqual([]);
    expect(element.lineClamp, `${label}/${name} stays complete`).toBe("none");
    expect(element.rect.right, `${label}/${name} right edge`).toBeLessThanOrEqual(card.rect.right + 1);
    expect(element.rect.left, `${label}/${name} left edge`).toBeGreaterThanOrEqual(card.rect.left - 1);
  }
  expect(card.excerpt.rect.top, `${label}/title before excerpt`).toBeGreaterThanOrEqual(card.title.rect.bottom - 1);
  expect(card.excerpt.ink.top, `${label}/title glyphs clear excerpt glyphs`).toBeGreaterThanOrEqual(card.title.ink.bottom - 1);
  if (card.section) {
    expect(card.section.overflowX, `${label}/section link complete`).toBeLessThanOrEqual(1);
    expect(card.section.overflowY, `${label}/section link unclipped`).toBeLessThanOrEqual(1);
    expect(card.section.rect.top, `${label}/section clears copy`).toBeGreaterThanOrEqual(card.copy.rect.bottom - 1);
  }
  if (card.share.length) {
    const rowY = card.share[0].rect.y;
    for (const [index, control] of card.share.entries()) {
      expect(control.rect.width, `${label}/share ${index} width`).toBeCloseTo(44, 0);
      expect(control.rect.height, `${label}/share ${index} height`).toBeCloseTo(44, 0);
      expect(Math.abs(control.rect.y - rowY), `${label}/share controls share one row`).toBeLessThanOrEqual(1);
      expect(control.rect.left).toBeGreaterThanOrEqual(card.rect.left - 1);
      expect(control.rect.right).toBeLessThanOrEqual(card.rect.right + 1);
      expect(control.rect.bottom).toBeLessThanOrEqual(card.rect.bottom + 1);
    }
  }
}

for (const locale of ["ru", "en"]) {
  test(`${locale}: complete card text, footer geometry and local fonts at ten widths`, async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".editorial-grid")).toBeVisible();
    await chooseTypographyLocale(page, locale);
    for (const viewport of typographyViewports) {
      await page.setViewportSize(viewport);
      await japaneseCard(page).scrollIntoViewIfNeeded();
      await settleTypography(page);
      const geometry = await measureTypography(page);
      const label = `${locale}/${viewport.width}`;
      expect(geometry.documentOverflow, label).toBeLessThanOrEqual(1);
      expect(geometry.cards.length, label).toBeGreaterThan(2);
      for (const [index, card] of geometry.cards.entries()) assertReadableCard(card, `${label}/card${index}`);
      for (const item of geometry.footer) {
        expect(item.overflowX, `${label}/footer ${item.text}`).toBeLessThanOrEqual(1);
        expect(item.rect.left).toBeGreaterThanOrEqual(-1);
        expect(item.rect.right).toBeLessThanOrEqual(viewport.width + 1);
      }
      const reference = japaneseCard(page);
      await expect(reference.locator(".section-link")).toHaveText(
        locale === "ru" ? "Все материалы рубрики" : "All articles in this section"
      );
    }
    const loadedSources = await page.evaluate(() =>
      performance.getEntriesByType("resource").filter((entry) => /\.(?:woff2?|ttf)(?:\?|$)/u.test(entry.name)).map((entry) => entry.name)
    );
    expect(loadedSources.length).toBeGreaterThan(0);
    for (const source of loadedSources) expect(new URL(source).origin).toBe(new URL(page.url()).origin);
    expect(await japaneseCard(page).locator("h3").evaluate((element) => getComputedStyle(element).fontFamily)).toContain("Source Serif");
  });

  test(`${locale}: archive and reader reflow, body scale and heading isolation`, async ({ page }) => {
    await page.goto("/#journal");
    await chooseTypographyLocale(page, locale);
    await expect(page.locator(".article-library-grid h3").first()).toBeVisible();
    const archiveText = await page.locator(".article-library-grid").textContent();
    const articleURL = await page.locator(".article-library-grid article > a").first().evaluate((link) => link.href);
    for (const viewport of typographyViewports) {
      await page.setViewportSize(viewport);
      await settleTypography(page);
      const geometry = await measureTypography(page);
      expect(geometry.documentOverflow, `${locale}/archive/${viewport.width}`).toBeLessThanOrEqual(1);
      for (const [index, card] of geometry.cards.entries()) assertReadableCard(card, `${locale}/archive/${viewport.width}/${index}`);
    }
    expect(await page.locator(".article-library-grid").textContent()).toBe(archiveText);

    await page.goto(articleURL);
    await expect(page.locator(".article-reader-content")).toBeVisible();
    await chooseTypographyLocale(page, locale);
    const paragraph = page.locator(".article-reader-content p").first();
    const fullText = await page.locator(".article-reader-content").textContent();
    const initialSize = await paragraph.evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
    const increase = page.locator(".article-reader-bar nav > button").nth(1);
    await increase.click();
    await increase.click();
    await increase.click();
    const enlargedSize = await paragraph.evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
    expect(enlargedSize / initialSize).toBeCloseTo(1.3, 1);

    for (const viewport of typographyViewports) {
      await page.setViewportSize(viewport);
      await settleTypography(page);
      const overflow = await page.locator(".article-reader").evaluate((reader) => ({
        reader: reader.scrollWidth - reader.clientWidth,
        bar: reader.querySelector(".article-reader-bar").scrollWidth - reader.querySelector(".article-reader-bar").clientWidth,
        content: reader.querySelector(".article-reader-content").scrollWidth - reader.querySelector(".article-reader-content").clientWidth,
        title: reader.querySelector("h1").scrollWidth - reader.querySelector("h1").clientWidth,
      }));
      for (const [target, value] of Object.entries(overflow)) expect(value, `${locale}/${viewport.width}/${target}`).toBeLessThanOrEqual(1);
    }
    expect(await page.locator(".article-reader-content").textContent()).toBe(fullText);
    const decrease = page.locator(".article-reader-bar nav > button").first();
    for (let step = 0; step < 4; step++) await decrease.click();
    expect((await paragraph.evaluate((element) => parseFloat(getComputedStyle(element).fontSize))) / initialSize).toBeCloseTo(0.9, 1);
    const heading = page.locator(".article-reader-content h2, .article-reader-content h3").first();
    if (await heading.count()) {
      const initial = await heading.evaluate((element) => ({ size: getComputedStyle(element).fontSize, tag: element.tagName.toLowerCase() }));
      const style = await page.addStyleTag({ content: buildCmsTypographyStylesheet({ fonts: [], overrides: [{
        layer: "component", targetKey: "magazine", semanticScope: initial.tag, breakpoint: "base", settings: { fontSize: 37 },
      }] }) });
      expect(await heading.evaluate((element) => getComputedStyle(element).fontSize)).toBe(initial.size);
      await style.evaluate((element) => element.remove());
    }
  });
}

test("Japanese card controls keep their geometry through focus, hover, active and copied states", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const reference = japaneseCard(page);
  await reference.scrollIntoViewIfNeeded();
  await settleTypography(page);
  const controls = reference.locator(".share-icon");
  const geometry = () => controls.evaluateAll((elements) => elements.map((element) => {
    const bounds = element.getBoundingClientRect();
    const parent = element.closest("article").getBoundingClientRect();
    return [bounds.x - parent.x, bounds.y - parent.y, bounds.width, bounds.height];
  }));
  const initial = await geometry();
  const unchanged = async () => {
    const current = await geometry();
    for (let index = 0; index < current.length; index++) {
      for (let axis = 0; axis < 4; axis++) expect(Math.abs(current[index][axis] - initial[index][axis])).toBeLessThanOrEqual(1);
    }
  };
  for (const control of await controls.all()) {
    await control.focus();
    await unchanged();
    await control.hover();
    await unchanged();
  }
  const copy = reference.locator(".is-copy");
  await copy.hover();
  await page.mouse.down();
  await unchanged();
  await page.mouse.up();
  await expect(copy).toHaveClass(/is-copied/u);
  await unchanged();
  await page.emulateMedia({ forcedColors: "active" });
  await unchanged();
  await expect(copy).toBeVisible();
});

test("published CMS typography wins over defaults and the layout supports 200/400 percent reflow", async ({ page }) => {
  await page.goto("/");
  const reference = japaneseCard(page);
  await reference.scrollIntoViewIfNeeded();
  await settleTypography(page);
  const stylesheet = buildCmsTypographyStylesheet({ fonts: [], overrides: [{
    layer: "component", targetKey: "magazine", semanticScope: "h3", breakpoint: "base", settings: { fontSize: 31 },
  }] });
  expect(stylesheet).not.toBe("");
  const style = await page.addStyleTag({ content: stylesheet });
  expect(await reference.locator("h3").evaluate((element) => parseFloat(getComputedStyle(element).fontSize))).toBe(31);
  await style.evaluate((element) => element.remove());
  // A 1280px desktop viewport at browser zoom 200%/400% has 640px/320px CSS width.
  // This verifies reflow geometry; it intentionally does not claim browser chrome zoom automation.
  for (const scale of [2, 4]) {
    await page.setViewportSize({ width: 1280 / scale, height: 900 });
    await settleTypography(page);
    const geometry = await measureTypography(page);
    expect(geometry.documentOverflow, `${scale * 100}% equivalent CSS viewport`).toBeLessThanOrEqual(1);
    for (const [index, card] of geometry.cards.entries()) assertReadableCard(card, `${scale * 100}%/card${index}`);
  }
});

test("project directory keeps complete copy and a consistent action label", async ({ page }) => {
  await page.goto("/");
  await page.locator(".section-directory-more").click();
  for (const locale of ["ru", "en"]) {
    await chooseTypographyLocale(page, locale);
    const about = page.locator(".section-directory-card").filter({ has: page.locator("h3", {
      hasText: /О проекте и редакции|About the project and editors/u,
    }) });
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await about.scrollIntoViewIfNeeded();
      await settleTypography(page);
      const result = await about.evaluate((card) => {
        const items = [...card.querySelectorAll("h3, p, .section-card-action strong, .section-card-action strong span")];
        return items.map((element) => {
          const style = getComputedStyle(element);
          return { tag: element.tagName, clamp: style.webkitLineClamp, font: style.fontFamily, size: style.fontSize,
            weight: style.fontWeight, tracking: style.letterSpacing, transform: style.textTransform,
            overflow: element.scrollWidth - element.clientWidth };
        });
      });
      for (const element of result) {
        expect(element.clamp, `${locale}/${width}/${element.tag} complete`).toBe("none");
        expect(element.overflow, `${locale}/${width}/${element.tag} horizontal bounds`).toBeLessThanOrEqual(1);
        if (["STRONG", "SPAN"].includes(element.tag)) {
          expect(element.font).toContain("Source Sans");
          expect(element.size).toBe("14px");
          expect(element.weight).toBe("600");
          expect(["normal", "0px"]).toContain(element.tracking);
          expect(element.transform).toBe("none");
        }
      }
    }
  }
});

for (const locale of ["ru", "en"]) {
  test(`${locale}: directory content never overlaps before or after expanding at wide viewports`, async ({ page }) => {
    const assertDirectory = async (width, state, expectedCount) => {
      const cards = page.locator("#sections .section-directory-card");
      await expect(cards).toHaveCount(expectedCount);
      const measurements = await cards.evaluateAll((elements) => {
        const rect = (element) => {
          const { left, right, top, bottom, width, height } = element.getBoundingClientRect();
          return { left, right, top, bottom, width, height };
        };
        const ink = (element) => {
          const range = document.createRange();
          range.selectNodeContents(element);
          return rect(range);
        };
        return elements.map((card) => ({
          title: card.querySelector("h3").textContent.trim(),
          bounds: rect(card),
          rows: [...card.firstElementChild.children].filter((element) => element.textContent.trim()).map((element) => ({
            name: element.className || element.tagName,
            bounds: rect(element),
            ink: ink(element),
          })),
          arrow: rect(card.querySelector(".section-card-action i")),
          eyebrow: rect(card.querySelector(".section-card-eyebrow")),
          text: [...card.querySelectorAll("h3, p, .section-card-latest, .section-card-action strong")].map((element) => ({
            ink: ink(element),
            horizontalOverflow: element.scrollWidth - element.clientWidth,
            verticalOverflow: element.scrollHeight - element.clientHeight,
            clipsVertically: ["hidden", "clip"].includes(getComputedStyle(element).overflowY),
          })),
        }));
      });
      for (const card of measurements) {
        const label = `${locale}/${width}/${state}/${card.title}`;
        expect(card.rows.length, `${label}: visible semantic rows`).toBeGreaterThanOrEqual(4);
        let previousBottom = card.bounds.top;
        let previousInkBottom = card.bounds.top;
        for (const row of card.rows) {
          expect(row.bounds.height, `${label}/${row.name}: visible height`).toBeGreaterThan(0);
          expect(row.bounds.width, `${label}/${row.name}: visible width`).toBeGreaterThan(0);
          expect(row.bounds.top, `${label}/${row.name}: clears preceding content`).toBeGreaterThanOrEqual(previousBottom - 1);
          expect(row.bounds.bottom, `${label}/${row.name}: stays inside card`).toBeLessThanOrEqual(card.bounds.bottom + 1);
          expect(row.bounds.left).toBeGreaterThanOrEqual(card.bounds.left - 1);
          expect(row.bounds.right).toBeLessThanOrEqual(card.bounds.right + 1);
          expect(row.ink.top, `${label}/${row.name}: glyphs clear preceding text`).toBeGreaterThanOrEqual(previousInkBottom - 1);
          previousBottom = row.bounds.bottom;
          previousInkBottom = row.ink.bottom;
        }
        expect(card.eyebrow.height, `${label}: category pill stays compact`).toBeLessThanOrEqual(56);
        for (const dimension of ["width", "height"]) {
          expect(card.arrow[dimension], `${label}: action ${dimension}`).toBeGreaterThanOrEqual(44);
          expect(card.arrow[dimension], `${label}: action ${dimension}`).toBeLessThanOrEqual(56);
        }
        for (const text of card.text) {
          expect(text.ink.left, `${label}: text range left`).toBeGreaterThanOrEqual(card.bounds.left - 1);
          expect(text.ink.right, `${label}: text range right`).toBeLessThanOrEqual(card.bounds.right + 1);
          expect(text.ink.top, `${label}: text range top`).toBeGreaterThanOrEqual(card.bounds.top - 1);
          expect(text.ink.bottom, `${label}: text range bottom`).toBeLessThanOrEqual(card.bounds.bottom + 1);
          expect(text.horizontalOverflow, `${label}: complete text width`).toBeLessThanOrEqual(1);
          if (text.clipsVertically) expect(text.verticalOverflow, `${label}: unclipped text height`).toBeLessThanOrEqual(1);
        }
      }
    };

    for (const width of [1767, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
      // Same-hash navigation preserves React expansion state; start a fresh document.
      await page.goto("about:blank");
      await page.goto("/#sections");
      await chooseTypographyLocale(page, locale);
      await assertDirectory(width, "initial collapsed", 8);
      await settleTypography(page);
      await assertDirectory(width, "loaded collapsed", 8);
      await page.locator("#sections .section-directory-more").click();
      await settleTypography(page);
      await assertDirectory(width, "expanded", 17);
    }
  });
}
