import { expect, test } from "@playwright/test";

const articlePath =
  "/probpera-literary-map/stati/russkiy-yazyk/15-krylatyh-vyrazheniy-prishedshih-k-nam-iz-drevnegrecheskoy-mifologii/";

test("ArticleReader keeps its controls and long title inside 320–1720px", async ({
  page,
}) => {
  await page.goto(articlePath);
  await expect(page.locator(".article-reader")).toBeVisible();

  for (const width of [320, 360, 1440, 1720]) {
    await page.setViewportSize({ width, height: width < 500 ? 800 : 1000 });

    const layout = await page.locator(".article-reader").evaluate((reader) => {
      const bar = reader.querySelector(".article-reader-bar");
      const close = reader.querySelector(".reader-close");
      const back = reader.querySelector(".reader-back");
      const title = reader.querySelector(".article-reader-lead h1");
      const paper = reader.querySelector(".article-reader-paper");
      if (!bar || !close || !back || !title || !paper) {
        throw new Error("ArticleReader regression target is missing");
      }

      const closeBox = close.getBoundingClientRect();
      const backBox = back.getBoundingClientRect();
      const titleBox = title.getBoundingClientRect();
      const paperBox = paper.getBoundingClientRect();

      return {
        barOverflow: bar.scrollWidth - bar.clientWidth,
        closePastViewport: closeBox.right - window.innerWidth,
        titleOverflow: title.scrollWidth - title.clientWidth,
        titlePastPaper: titleBox.left + title.scrollWidth - paperBox.right,
        backWidth: backBox.width,
        backHeight: backBox.height,
      };
    });

    expect(layout.barOverflow, `reader bar overflow at ${width}px`).toBeLessThanOrEqual(1);
    expect(layout.closePastViewport, `close clipping at ${width}px`).toBeLessThanOrEqual(1);
    expect(layout.titleOverflow, `title overflow at ${width}px`).toBeLessThanOrEqual(1);
    expect(layout.titlePastPaper, `title past paper at ${width}px`).toBeLessThanOrEqual(1);
    if (width === 320) {
      expect(layout.backWidth).toBeGreaterThanOrEqual(44);
      expect(layout.backHeight).toBeGreaterThanOrEqual(44);
    }
  }
});

test("globe search metadata and instructions stay readable inside 320–1720px", async ({
  page,
}) => {
  await page.goto("/probpera-literary-map/");
  await expect(page.locator("#atlas")).toBeVisible();

  for (const width of [320, 360]) {
    await page.setViewportSize({ width, height: 800 });
    const search = page.locator("#country-search");
    await search.fill("");
    await search.pressSequentially("Индия");
    const results = page.locator(".search-results");
    await expect(results).toBeVisible();

    const containment = await results.evaluate((root) => {
      const rootBox = root.getBoundingClientRect();
      const bookRows = [...root.querySelectorAll("button")].filter((button) =>
        button.querySelector(".country-result-book")
      );
      const flag = root.querySelector(".country-result-flag");
      if (!flag || bookRows.length === 0) {
        throw new Error("Globe search regression target is missing");
      }
      const flagBox = flag.getBoundingClientRect();
      const flagStyle = getComputedStyle(flag);

      return {
        rootOverflow: root.scrollWidth - root.clientWidth,
        rowOverflow: Math.max(
          ...bookRows.map((button) => button.scrollWidth - button.clientWidth)
        ),
        descendantPastRoot: Math.max(
          0,
          ...bookRows.flatMap((button) =>
            [...button.querySelectorAll("*")].map(
              (element) => element.getBoundingClientRect().right - rootBox.right
            )
          )
        ),
        flagWidth: flagBox.width,
        flagHeight: flagBox.height,
        flagRadius: flagStyle.borderRadius,
        flagFit: flagStyle.objectFit,
      };
    });

    expect(containment.rootOverflow, `search root overflow at ${width}px`).toBeLessThanOrEqual(1);
    expect(containment.rowOverflow, `search row overflow at ${width}px`).toBeLessThanOrEqual(1);
    expect(containment.descendantPastRoot, `search child overflow at ${width}px`).toBeLessThanOrEqual(1);
    expect(containment.flagWidth).toBe(24);
    expect(containment.flagHeight).toBe(24);
    expect(containment.flagRadius).toBe("50%");
    expect(containment.flagFit).toBe("cover");
    await search.press("Escape");
  }

  for (const width of [320, 360, 1440, 1720]) {
    await page.setViewportSize({ width, height: width < 500 ? 800 : 1000 });
    const instruction = await page.locator(".globe-instruction").evaluate((element) => {
      const box = element.getBoundingClientRect();
      const globeBox = element.closest(".literary-globe")?.getBoundingClientRect();
      const style = getComputedStyle(element);
      const alphaMatch = style.color.match(/rgba?\([^,]+,[^,]+,[^,]+(?:,\s*([\d.]+))?\)/u);
      return {
        fontSize: Number.parseFloat(style.fontSize),
        alpha: alphaMatch?.[1] ? Number.parseFloat(alphaMatch[1]) : 1,
        overflow: element.scrollWidth - element.clientWidth,
        insideGlobe:
          Boolean(globeBox) &&
          box.left >= globeBox.left - 1 &&
          box.right <= globeBox.right + 1,
      };
    });

    expect(instruction.fontSize).toBeGreaterThanOrEqual(10);
    expect(instruction.alpha).toBeGreaterThanOrEqual(0.68);
    expect(instruction.overflow).toBeLessThanOrEqual(1);
    expect(instruction.insideGlobe).toBe(true);
  }
});
