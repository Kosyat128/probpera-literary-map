import { expect, test } from "@playwright/test";

import { articleFromSitemap } from "./helpers/article-route.mjs";

const preferredArticlePath =
  "/15-krylatyh-vyrazheniy-prishedshih-k-nam-iz-drevnegrecheskoy-mifologii/";

test("ArticleReader keeps its controls and long title inside 320-1720px", async ({
  page,
  request,
  baseURL,
}) => {
  await page.goto(
    await articleFromSitemap(request, baseURL, preferredArticlePath)
  );
  await expect(page.locator(".article-reader")).toBeVisible();
  const readerContent = page.locator(".article-reader-content");
  await expect(readerContent).toBeVisible({ timeout: 30_000 });
  await readerContent.evaluate((content) => {
    const probe = document.createElement("section");
    probe.className = "e2e-overflow-probe";
    probe.innerHTML = `
      <p>${"UnbrokenEditorialToken".repeat(24)}</p>
      <a href="#probe">https://example.org/${"very-long-segment".repeat(24)}</a>
      <table><tbody><tr><td>${"LongTableCell".repeat(24)}</td><td>Second cell</td></tr></tbody></table>
      <pre>${"const_unbroken_source_token_".repeat(24)}</pre>
    `;
    content.append(probe);

    const rating = document.createElement("div");
    rating.className = "rating-summary e2e-touch-rating";
    rating.innerHTML = `<span><strong>5.0</strong><small>1 rating</small></span><div>${[1, 2, 3, 4, 5]
      .map((score) => `<button type="button" aria-label="${score} out of 5">★</button>`)
      .join("")}</div>`;
    content.append(rating);
  });

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
      const readerBox = reader.getBoundingClientRect();
      const requiredContainment = [
        paper,
        ...reader.querySelectorAll(
          ".article-reader-bar, .article-reader-lead h1, .article-reader-sources, .article-reader-more, .article-reader-finish, .article-reader-sequence, .e2e-overflow-probe"
        ),
      ];
      const visibleControlBoxes = [...bar.querySelectorAll("nav button")]
        .filter((element) => {
          const style = getComputedStyle(element);
          const box = element.getBoundingClientRect();
          return style.display !== "none" && box.width > 0 && box.height > 0;
        })
        .map((element) => element.getBoundingClientRect());
      const controlGeometry = [...bar.querySelectorAll("nav button")]
        .filter((element) => getComputedStyle(element).display !== "none")
        .map((element) => ({
          label: element.getAttribute("aria-label") || element.textContent,
          className: element.className,
          parentClassName: element.parentElement?.className,
          compactRuleMatches: element.matches(
            ".article-reader-bar .display-mode-control.is-compact button"
          ),
          computedWidth: getComputedStyle(element).width,
          computedHeight: getComputedStyle(element).height,
          computedFlex: getComputedStyle(element).flex,
          width: element.getBoundingClientRect().width,
          height: element.getBoundingClientRect().height,
        }));
      const ratingBoxes = [...reader.querySelectorAll(".e2e-touch-rating button")]
        .map((element) => element.getBoundingClientRect());

      return {
        stylesheets: [...document.styleSheets].map((sheet) => sheet.href),
        readerOverflow: reader.scrollWidth - reader.clientWidth,
        barOverflow: bar.scrollWidth - bar.clientWidth,
        closePastViewport: closeBox.right - window.innerWidth,
        titleOverflow: title.scrollWidth - title.clientWidth,
        titlePastPaper: titleBox.left + title.scrollWidth - paperBox.right,
        descendantPastViewport: Math.max(
          0,
          ...requiredContainment.map(
            (element) => element.getBoundingClientRect().right - readerBox.right
          )
        ),
        minimumControlWidth: Math.min(...visibleControlBoxes.map((box) => box.width)),
        minimumControlHeight: Math.min(...visibleControlBoxes.map((box) => box.height)),
        visibleControlCount: visibleControlBoxes.length,
        minimumRatingWidth: Math.min(...ratingBoxes.map((box) => box.width)),
        minimumRatingHeight: Math.min(...ratingBoxes.map((box) => box.height)),
        controlGeometry,
        backWidth: backBox.width,
        backHeight: backBox.height,
      };
    });

    expect(layout.readerOverflow, `reader overflow at ${width}px`).toBeLessThanOrEqual(1);
    expect(layout.barOverflow, `reader bar overflow at ${width}px`).toBeLessThanOrEqual(1);
    expect(layout.closePastViewport, `close clipping at ${width}px`).toBeLessThanOrEqual(1);
    expect(layout.titleOverflow, `title overflow at ${width}px`).toBeLessThanOrEqual(1);
    expect(layout.titlePastPaper, `title past paper at ${width}px`).toBeLessThanOrEqual(1);
    expect(
      layout.descendantPastViewport,
      `reader descendant past viewport at ${width}px`
    ).toBeLessThanOrEqual(1);
    if (width <= 360) {
      expect(layout.visibleControlCount).toBe(9);
      expect(
        layout.minimumControlWidth,
        JSON.stringify({ controls: layout.controlGeometry, stylesheets: layout.stylesheets })
      ).toBeGreaterThanOrEqual(44);
      expect(
        layout.minimumControlHeight,
        JSON.stringify(layout.controlGeometry)
      ).toBeGreaterThanOrEqual(44);
      expect(layout.minimumRatingWidth).toBeGreaterThanOrEqual(44);
      expect(layout.minimumRatingHeight).toBeGreaterThanOrEqual(44);
    }
    if (width === 320) {
      expect(layout.backWidth).toBeGreaterThanOrEqual(44);
      expect(layout.backHeight).toBeGreaterThanOrEqual(44);
    }
  }
});

test("mobile header keeps search and 44px actions in two compact sticky rows", async ({
  page,
}) => {
  for (const width of [320, 360]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/");

    const header = page.locator(".site-header");
    const mobileNav = page.locator(".mobile-nav");
    const search = header.locator(".global-search-trigger");
    const languageButtons = header.locator(".interface-language-control button");
    const account = header.locator(".reader-button");
    await expect(search).toBeVisible();
    await expect(languageButtons).toHaveCount(2);
    await expect(languageButtons.first()).toBeVisible();
    await expect(languageButtons.last()).toBeVisible();
    await expect(account).toBeVisible();

    const geometry = await page.evaluate(() => {
      const box = (selector) => {
        const element = document.querySelector(selector);
        if (!element) throw new Error(`Missing mobile header target: ${selector}`);
        const bounds = element.getBoundingClientRect();
        return { width: bounds.width, height: bounds.height };
      };
      const heroTitle = document.querySelector(".hero-editorial h1");
      return {
        header: box(".site-header"),
        mobileNav: box(".mobile-nav"),
        search: box(".site-header .global-search-trigger"),
        languages: [...document.querySelectorAll(
          ".site-header .interface-language-control button"
        )].map((element) => {
          const bounds = element.getBoundingClientRect();
          return { width: bounds.width, height: bounds.height };
        }),
        account: box(".site-header .reader-button"),
        heroText: heroTitle?.textContent?.replace(/\s+/gu, " ").trim(),
      };
    });

    expect(geometry.header.height).toBeLessThanOrEqual(58);
    expect(geometry.mobileNav.height).toBeLessThanOrEqual(54);
    for (const target of [
      geometry.search,
      ...geometry.languages,
      geometry.account,
    ]) {
      expect(target.width).toBeGreaterThanOrEqual(44);
      expect(target.height).toBeGreaterThanOrEqual(44);
    }
    expect(geometry.heroText).toBe("Литература - это целый мир!");

    await search.click();
    await expect(page.locator(".global-search")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator(".global-search")).toHaveCount(0);
  }
});

test("ArticleReader lower panels stay readable in light and book modes", async ({
  page,
  request,
  baseURL,
}) => {
  await page.goto(
    await articleFromSitemap(request, baseURL, preferredArticlePath)
  );
  const reader = page.locator(".article-reader");
  await expect(reader).toBeVisible();

  await reader.locator(".article-reader-finish").evaluate((finish) => {
    const probe = document.createElement("section");
    probe.className = "engagement-card e2e-reader-engagement";
    probe.innerHTML = `
      <header class="engagement-heading">
        <div><span class="section-kicker">Reader discussion</span><h3>Reader opinions</h3></div>
        <span>2 comments</span>
      </header>
      <div class="rating-summary">
        <span><strong>4.8</strong><small>12 ratings</small></span>
        <div aria-label="Rate publication">
          ${[1, 2, 3, 4, 5]
            .map((score) => `<button type="button" aria-label="${score} out of 5">★</button>`)
            .join("")}
        </div>
      </div>
      <div class="comment-form">
        <label><span>Name</span><input placeholder="How should we address you?" /></label>
        <label><span>Comment</span><textarea placeholder="Share your thoughts"></textarea></label>
        <small>0 / 4000</small>
        <button type="button">Post comment</button>
      </div>
      <div class="comment-list">
        <article><header><strong>Reader</strong><time>Today</time></header><p>A thoughtful comment remains readable.</p></article>
      </div>
    `;
    finish.append(probe);
  });

  const modeButtons = reader.locator(
    ".article-reader-bar .display-mode-control button"
  );
  const modes = [
    { buttonIndex: 1, className: "is-light" },
    { buttonIndex: 2, className: "is-book" },
  ];

  for (const mode of modes) {
    await modeButtons.nth(mode.buttonIndex).click();
    await expect(reader).toHaveClass(new RegExp(`\\b${mode.className}\\b`, "u"));

    const audit = await reader.evaluate((root) => {
      const parseColor = (value) => {
        const srgb = value.match(
          /^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)$/u
        );
        if (srgb) {
          return [
            Number(srgb[1]) * 255,
            Number(srgb[2]) * 255,
            Number(srgb[3]) * 255,
            srgb[4] === undefined ? 1 : Number(srgb[4]),
          ];
        }
        const rgb = value.match(
          /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/u
        );
        if (rgb) {
          return [
            Number(rgb[1]),
            Number(rgb[2]),
            Number(rgb[3]),
            rgb[4] === undefined ? 1 : Number(rgb[4]),
          ];
        }
        throw new Error(`Unsupported computed color: ${value}`);
      };
      const composite = (front, back) => {
        const alpha = front[3] + back[3] * (1 - front[3]);
        if (alpha === 0) return [0, 0, 0, 0];
        return [
          (front[0] * front[3] + back[0] * back[3] * (1 - front[3])) / alpha,
          (front[1] * front[3] + back[1] * back[3] * (1 - front[3])) / alpha,
          (front[2] * front[3] + back[2] * back[3] * (1 - front[3])) / alpha,
          alpha,
        ];
      };
      const backgroundFor = (element) => {
        const chain = [];
        for (let current = element; current; current = current.parentElement) {
          chain.unshift(current);
        }
        return chain.reduce(
          (background, current) =>
            composite(parseColor(getComputedStyle(current).backgroundColor), background),
          [255, 255, 255, 1]
        );
      };
      const luminance = (color) => {
        const channels = color.slice(0, 3).map((channel) => {
          const value = channel / 255;
          return value <= 0.04045
            ? value / 12.92
            : ((value + 0.055) / 1.055) ** 2.4;
        });
        return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
      };
      const contrastFor = (selector) => {
        const element = root.querySelector(selector);
        if (!element) throw new Error(`Missing contrast target: ${selector}`);
        const background = backgroundFor(element);
        const foreground = composite(
          parseColor(getComputedStyle(element).color),
          background
        );
        const lighter = Math.max(luminance(foreground), luminance(background));
        const darker = Math.min(luminance(foreground), luminance(background));
        return (lighter + 0.05) / (darker + 0.05);
      };
      const overflowFor = (selector) => {
        const element = root.querySelector(selector);
        if (!element) throw new Error(`Missing overflow target: ${selector}`);
        return element.scrollWidth - element.clientWidth;
      };

      return {
        contrasts: {
          readerLead: contrastFor(".article-reader-lead > p"),
          shareLabel: contrastFor(".share-links > span"),
          ratingStar: contrastFor(
            ".e2e-reader-engagement .rating-summary button:first-child"
          ),
          ratingCount: contrastFor(
            ".e2e-reader-engagement .rating-summary > span small"
          ),
          commentLabel: contrastFor(
            ".e2e-reader-engagement .comment-form label > span"
          ),
          commentBody: contrastFor(
            ".e2e-reader-engagement .comment-list article p"
          ),
          recommendationTitle: contrastFor(".article-reader-more-copy strong"),
          recommendationMeta: contrastFor(".article-reader-more-copy em"),
          navigationTitle: contrastFor(".article-reader-sequence strong"),
          modeControl: contrastFor(
            ".article-reader-bar .display-mode-control button:not(.is-active)"
          ),
          languageControl: contrastFor(
            ".article-reader-bar .interface-language-control button:not(.is-active)"
          ),
        },
        overflows: {
          engagement: overflowFor(".e2e-reader-engagement"),
          rating: overflowFor(".e2e-reader-engagement .rating-summary"),
          recommendations: overflowFor(".article-reader-more"),
          navigation: overflowFor(".article-reader-sequence"),
        },
      };
    });

    expect(
      audit.contrasts.ratingStar,
      `${mode.className}: inactive rating star contrast`
    ).toBeGreaterThanOrEqual(3);
    for (const [target, ratio] of Object.entries(audit.contrasts)) {
      if (target === "ratingStar") continue;
      expect(ratio, `${mode.className}: ${target} contrast`).toBeGreaterThanOrEqual(4.5);
    }
    for (const [target, overflow] of Object.entries(audit.overflows)) {
      expect(overflow, `${mode.className}: ${target} overflow`).toBeLessThanOrEqual(1);
    }
  }
});

test("globe search metadata and instructions stay readable inside 320-1720px", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#atlas")).toBeVisible();

  for (const width of [320, 360]) {
    await page.setViewportSize({ width, height: 800 });
    const search = page.locator("#country-search");
    await search.click();
    await search.fill("США");
    await expect(search).toHaveValue("США");
    const results = page.locator("#country-results");
    await expect(results).toBeVisible();
    const flag = results.locator(".country-result-flag").first();
    await expect(flag).toBeVisible();
    const flagVisual = await flag.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        width: box.width,
        height: box.height,
        radius: style.borderRadius,
        fit: style.objectFit,
      };
    });

    await search.fill("Моби Дик, или Белый Кит");
    await expect(search).toHaveValue("Моби Дик, или Белый Кит");
    await expect(results.locator(".country-result-book").first()).toBeVisible({
      timeout: 15_000,
    });

    const containment = await results.evaluate((root) => {
      const rootBox = root.getBoundingClientRect();
      const bookRows = [...root.querySelectorAll("button")].filter((button) =>
        button.querySelector(".country-result-book")
      );
      if (bookRows.length === 0) {
        throw new Error("Globe search regression target is missing");
      }

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
      };
    });

    expect(containment.rootOverflow, `search root overflow at ${width}px`).toBeLessThanOrEqual(1);
    expect(containment.rowOverflow, `search row overflow at ${width}px`).toBeLessThanOrEqual(1);
    expect(containment.descendantPastRoot, `search child overflow at ${width}px`).toBeLessThanOrEqual(1);
    expect(flagVisual.width).toBe(24);
    expect(flagVisual.height).toBe(24);
    expect(flagVisual.radius).toBe("50%");
    expect(flagVisual.fit).toBe("cover");
    await search.press("Escape");
  }

  for (const width of [320, 360, 1440, 1720]) {
    await page.setViewportSize({ width, height: width < 500 ? 800 : 1000 });
    const navigationLabel = page.locator(".globe-navigation-label");
    await expect(navigationLabel).toBeVisible();
    await expect(navigationLabel).toHaveText(
      "Интерактивный глобус · ручная навигация"
    );
    const instruction = await navigationLabel.evaluate((element) => {
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
