import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { articleFromSitemap } from "./helpers/article-route.mjs";

function watchErrors(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

async function stubEditorialImages(page) {
  await page.route(/^https:\/\/static\.tildacdn\.com\//u, (route) =>
    route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360"><rect width="640" height="360" fill="#e8d9c8"/><path d="M0 315 185 125l115 116 92-78 248 152" fill="#8d617f"/></svg>',
    })
  );
}

test("главная загружается без критических ошибок и горизонтального разрыва", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/");
  await expect(page.locator("body")).toBeVisible();
  await expect(page.locator("main").first()).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(2);
  expect(errors).toEqual([]);
});

test("обложка и заголовок героя сохраняют редакционный макет", async ({
  page,
  isMobile,
}) => {
  await page.goto("/");
  const heading = page.locator(".hero-editorial h1");
  const lead = heading.locator(".hero-title-lead");
  const accent = heading.locator(".hero-title-accent");
  const accentLines = accent.locator(".hero-title-accent-line");
  const cover = page.locator(".hero-cover img");

  await expect(lead).toBeVisible();
  await expect(lead).not.toContainText("-");
  await expect(accent).toBeVisible();
  await expect(accentLines).toHaveCount(2);
  await expect(accentLines.first()).toContainText("-");
  await expect(accent).toHaveCSS("color", "rgb(255, 181, 118)");
  await expect
    .poll(() => cover.evaluate((image) => image.currentSrc))
    .toContain(
      isMobile
        ? "?v=20260813-literary-nature-portrait"
        : "?v=20260813-literary-nature-final"
    );
  await expect(cover).toHaveCSS("object-fit", "cover");
  expect(
    await heading.evaluate((element) => {
      const style = getComputedStyle(element);
      return Number.parseFloat(style.lineHeight) / Number.parseFloat(style.fontSize);
    })
  ).toBeGreaterThanOrEqual(0.99);
  await expect
    .poll(() =>
      cover.evaluate((image) => ({
        complete: image.complete,
        width: image.naturalWidth,
        height: image.naturalHeight,
      }))
    )
    .toEqual(
      isMobile
        ? { complete: true, width: 941, height: 1672 }
        : { complete: true, width: 1774, height: 887 }
    );
  expect(await cover.evaluate((image) => image.naturalWidth / image.naturalHeight)).toBeCloseTo(
    isMobile ? 941 / 1672 : 2,
    2
  );
  if (!isMobile) {
    const layout = await cover.evaluate((image) => {
      const hero = image.closest(".magazine-hero");
      const heroRect = hero?.getBoundingClientRect();
      return {
        height: heroRect?.height ?? 0,
        expectedHeight:
          (heroRect?.width ?? 0) / (image.naturalWidth / image.naturalHeight),
      };
    });
    expect(Math.abs(layout.height - layout.expectedHeight)).toBeLessThanOrEqual(2);
  }

  const englishButton = page
    .locator(".site-header .interface-language-control")
    .getByRole("button", { name: /Английский язык|English/iu });
  await englishButton.click();
  await expect(heading).not.toContainText("is -");
  await expect(accentLines.first()).not.toContainText("-");
});

test("календарь, форум и редакция используют разные заставки", async ({
  page,
}) => {
  await page.goto("/");
  const titles = [
    "Литературный календарь",
    "Форум читателей",
    "О проекте и редакции",
  ];
  const backgrounds = [];

  for (const title of titles) {
    const card = page
      .locator(".section-directory-card")
      .filter({ has: page.getByRole("heading", { name: title }) });
    await expect(card).toBeVisible();
    const background = await card.evaluate(
      (element) => getComputedStyle(element).backgroundImage
    );
    expect(background).toContain("brand/sections/");
    backgrounds.push(background);
  }

  expect(new Set(backgrounds).size).toBe(3);
});

test("главная не содержит критических нарушений доступности", async ({ page }) => {
  await page.goto("/");
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const critical = result.violations.filter((item) => ["critical", "serious"].includes(item.impact || ""));
  expect(critical, JSON.stringify(critical, null, 2)).toEqual([]);
});

test("статья из карты сайта открывается и имеет корректную структуру", async ({ page, request, baseURL }) => {
  await page.goto(await articleFromSitemap(request, baseURL));
  await expect(page.locator("h1").first()).toBeVisible();
  await expect(page.locator("article").first()).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /index/u);
});

test("длинные источники остаются внутри листа статьи", async ({
  page,
  request,
  baseURL,
  isMobile,
}) => {
  if (!isMobile) await page.setViewportSize({ width: 1720, height: 1000 });
  await page.goto(await articleFromSitemap(request, baseURL));

  const paper = page.locator(".article-reader-paper");
  await expect(paper).toBeVisible();
  await expect(paper.locator(".article-reader-content")).toBeVisible();
  await paper.evaluate((element) => {
    const section = document.createElement("section");
    section.className = "article-reader-sources";
    section.setAttribute("aria-labelledby", "e2e-long-sources-title");
    section.innerHTML = `
      <h2 id="e2e-long-sources-title">Источники и библиография</h2>
      <ol>
        <li>
          <a href="https://example.org" target="_blank" rel="noreferrer">
            https://example.org/archive/${"long_unbroken_bibliographic_identifier_".repeat(9)}publication
          </a>
        </li>
      </ol>
      <details class="article-reader-image-credits" open>
        <summary>Источники иллюстраций <span>1</span></summary>
        <ul>
          <li>
            <a href="https://commons.wikimedia.org" target="_blank" rel="noreferrer">
              ${"Wikimedia_Commons_image_attribution_without_breaks_".repeat(8)}.jpg
            </a>
          </li>
        </ul>
      </details>
    `;
    element.append(section);
  });

  const source = paper.locator(".article-reader-sources").last();
  const sourceLink = source.locator("a");
  await source.scrollIntoViewIfNeeded();
  await expect(source.getByRole("heading", { level: 2 })).toBeVisible();
  await expect(sourceLink.first()).toHaveCSS("overflow-wrap", "anywhere");
  if (!isMobile) await expect(page.locator(".article-reader-related")).toBeVisible();

  const desktopWidths = isMobile ? [null] : [1720, 1920];
  for (const width of desktopWidths) {
    if (width) await page.setViewportSize({ width, height: 1000 });
    await source.scrollIntoViewIfNeeded();
    const containment = await source.evaluate((element) => {
      const paperElement = element.closest(".article-reader-paper");
      const scroll = element.closest(".article-reader-scroll");
      const layout = element.closest(".article-reader-layout");
      const rail = layout?.querySelector(".article-reader-related");
      const articleContent = paperElement?.querySelector(".article-reader-content");
      const links = Array.from(element.querySelectorAll("a"));
      const sourceBox = element.getBoundingClientRect();
      const paperBox = paperElement?.getBoundingClientRect();
      const railBox = rail?.getBoundingClientRect();
      const contentBox = articleContent?.getBoundingClientRect();
      const linksInsideSource = links.every((link) =>
        Array.from(link.getClientRects()).every(
          (rect) => rect.left >= sourceBox.left - 1 && rect.right <= sourceBox.right + 1
        )
      );
      return {
        sourceOverflow: element.scrollWidth - element.clientWidth,
        scrollOverflow: scroll ? scroll.scrollWidth - scroll.clientWidth : 0,
        linksInsideSource,
        sourceLeftDelta:
          contentBox
            ? Math.abs(sourceBox.left - contentBox.left)
            : Number.POSITIVE_INFINITY,
        insidePaper:
          Boolean(paperBox) &&
          sourceBox.left >= paperBox.left - 1 &&
          sourceBox.right <= paperBox.right + 1,
        beforeRail: !railBox || railBox.width === 0 || sourceBox.right < railBox.left,
      };
    });

    expect(containment.sourceOverflow, `source overflow at ${width || "mobile"}`).toBeLessThanOrEqual(1);
    expect(containment.scrollOverflow, `reader overflow at ${width || "mobile"}`).toBeLessThanOrEqual(2);
    expect(containment.linksInsideSource).toBe(true);
    expect(containment.sourceLeftDelta).toBeLessThanOrEqual(1);
    expect(containment.insidePaper).toBe(true);
    expect(containment.beforeRail).toBe(true);
  }
});

test("прямой URL статьи возвращает к полному журналу", async ({ page, request, baseURL }) => {
  await page.goto(await articleFromSitemap(request, baseURL));

  const reader = page.locator(".article-reader");
  await expect(reader).toBeVisible();
  const languageControl = reader.locator(
    ".article-reader-bar .interface-language-control"
  );
  const russianButton = languageControl.getByRole("button", {
    name: /Русский язык|Russian/iu,
  });
  const englishButton = languageControl.getByRole("button", {
    name: /Английский язык|English/iu,
  });
  await expect(languageControl).toBeVisible();
  await expect(russianButton).toHaveAttribute("aria-pressed", "true");

  await englishButton.click();
  await expect(reader).toBeVisible();
  await expect(englishButton).toHaveAttribute("aria-pressed", "true");
  await expect(
    reader.getByRole("navigation", { name: "Reading settings" })
  ).toBeVisible();
  await expect(reader.getByRole("link", { name: "Back to journal" })).toBeVisible();

  await russianButton.click();
  await expect(
    reader.getByRole("navigation", { name: "Настройки чтения" })
  ).toBeVisible();
  const journalLink = reader.getByRole("link", {
    name: /К журналу|Back to journal/iu,
  });
  const journalHref = await journalLink.getAttribute("href");
  expect(journalHref).toMatch(/\/stati\/[^/]+\/$/u);
  const journalPathname = new URL(journalHref, baseURL).pathname;
  await journalLink.click();

  await expect(page.locator(".site-header")).toBeVisible();
  await expect(page.locator("#journal")).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.location.pathname)).toBe(
    journalPathname
  );
  await expect.poll(() => page.evaluate(() => window.location.hash)).toBe("");
});

test("редакционные изображения сохраняют пропорции в ридере, галерее и слайдере", async ({
  page,
  request,
  baseURL,
}) => {
  await stubEditorialImages(page);
  await page.goto(
    await articleFromSitemap(request, baseURL, "/premiya-pen-folknera/")
  );

  const reader = page.locator(".article-reader");
  const content = reader.locator(".article-reader-content");
  await expect(content).toBeVisible();
  await content.locator(".article-gallery").first().scrollIntoViewIfNeeded();
  await expect(content.locator(".article-gallery img").first()).toBeVisible();

  await content.evaluate((element) => {
    if (element.querySelector(".article-design-block.is-slider > img")) return;
    const source = element.querySelector(".article-gallery img, figure img");
    if (!(source instanceof HTMLImageElement)) return;
    const slider = document.createElement("section");
    slider.className = "article-design-block is-slider";
    slider.dataset.e2eStyleProbe = "slider";
    const image = source.cloneNode(true);
    image.classList.add("is-active");
    slider.append(image);
    element.append(slider);
  });

  const groups = {
    reader: content.locator(":scope > figure img").first(),
    gallery: content.locator(".article-gallery img").first(),
    slider: content.locator(".article-design-block.is-slider > img.is-active").first(),
  };

  for (const [label, image] of Object.entries(groups)) {
    await image.scrollIntoViewIfNeeded();
    await expect(image, `${label}: изображение должно присутствовать`).toBeVisible();
    await expect
      .poll(() => image.evaluate((element) => element.complete && element.naturalWidth > 0))
      .toBe(true);
    const metrics = await image.evaluate((element) => {
      const box = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const renderedRatio = box.width / box.height;
      const naturalRatio = element.naturalWidth / element.naturalHeight;
      return {
        objectFit: style.objectFit,
        ratioDelta: Math.abs(renderedRatio - naturalRatio) / naturalRatio,
      };
    });
    if (label === "reader") {
      expect(
        metrics.objectFit === "contain" || metrics.ratioDelta <= 0.03,
        "reader: высота auto должна сохранять исходное соотношение сторон"
      ).toBe(true);
    } else {
      expect(
        metrics.objectFit,
        `${label}: изображение должно вписываться целиком без обрезки и растяжения`
      ).toBe("contain");
    }
  }

  const overflows = await reader.evaluate((element) => {
    const scroll = element.querySelector(".article-reader-scroll");
    return [document.documentElement, element, scroll]
      .filter(Boolean)
      .map((target) => target.scrollWidth - target.clientWidth);
  });
  expect(Math.max(...overflows)).toBeLessThanOrEqual(2);
});

test("лайтбокс удерживает Tab, закрывается по Escape и возвращает фокус", async ({
  page,
  request,
  baseURL,
}) => {
  await stubEditorialImages(page);
  await page.goto(
    await articleFromSitemap(request, baseURL, "/premiya-pen-folknera/")
  );

  const trigger = page.locator(".article-reader-content img[role='button']").first();
  await trigger.scrollIntoViewIfNeeded();
  await expect(trigger).toBeVisible();
  await trigger.click();

  const lightbox = page.getByRole("dialog", {
    name: /Просмотр иллюстрации|Illustration viewer/iu,
  });
  const closeButton = lightbox.getByRole("button", {
    name: /Закрыть изображение|Close image/iu,
  });
  await expect(lightbox).toBeVisible();
  await expect(closeButton).toBeFocused();

  const focusableCount = await lightbox
    .locator('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')
    .count();
  expect(focusableCount).toBeGreaterThan(0);
  for (let index = 0; index < focusableCount + 2; index += 1) {
    await page.keyboard.press(index === 0 ? "Shift+Tab" : "Tab");
    expect(
      await lightbox.evaluate((element) => element.contains(document.activeElement)),
      "Фокус не должен выходить из открытого лайтбокса"
    ).toBe(true);
  }

  await page.keyboard.press("Escape");
  await expect(lightbox).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("глобус загружается только после приближения к атласу и принимает управление", async ({
  page,
  isMobile,
}) => {
  // The test intentionally decodes both full-resolution localized textures before
  // exercising WebGL controls. Cold CI runners can need more than the suite's
  // default 45 seconds without indicating a loading or interaction failure.
  test.setTimeout(90_000);
  const errors = watchErrors(page);
  if (isMobile) await page.setViewportSize({ width: 320, height: 820 });
  await page.goto("/");
  await page.locator("#atlas").scrollIntoViewIfNeeded();
  const naturalEarthButton = page.locator(
    '[data-globe-edition-option="natural-earth-2026"]'
  );
  const nasaButton = page.locator(
    '[data-globe-edition-option="nasa-blue-marble"]'
  );
  await expect(naturalEarthButton).toBeVisible({ timeout: 30_000 });
  await expect(nasaButton).toBeVisible({ timeout: 30_000 });
  await expect(naturalEarthButton).toHaveAccessibleName(
    "Natural Earth: литературный атлас, 2026"
  );
  const initialViewport = page.viewportSize();
  const checkedWidths = isMobile ? [320, 360] : [initialViewport?.width ?? 1280, 700];
  for (const width of checkedWidths) {
    await page.setViewportSize({ width, height: isMobile ? 820 : 900 });
    const styleButtons = page.locator(".globe-style-switch button");
    for (let index = 0; index < (await styleButtons.count()); index += 1) {
      const buttonMetrics = await styleButtons.nth(index).evaluate((element) => ({
        clientWidth: element.clientWidth,
        label: element.getAttribute("data-globe-edition-option") || element.textContent,
        scrollWidth: element.scrollWidth,
      }));
      expect(
        buttonMetrics.scrollWidth,
        `${width}px ${buttonMetrics.label} edition label must fit its button`
      ).toBeLessThanOrEqual(buttonMetrics.clientWidth);
    }
  }
  if (initialViewport) await page.setViewportSize(initialViewport);
  const canvas = page.locator("#atlas canvas").first();
  await expect(canvas).toBeVisible({ timeout: 30_000 });
  const russianFilename = isMobile
    ? "modern-atlas-2026-ru-mobile.webp"
    : "modern-atlas-2026-ru.webp";
  const russianTextureResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname.endsWith(`/textures/${russianFilename}`) &&
      response.status() === 200
  );
  await naturalEarthButton.click();
  const loadedRussianTexture = await russianTextureResponse;
  expect(loadedRussianTexture.ok()).toBe(true);
  await expect(page.locator(".literary-globe")).toHaveAttribute(
    "data-globe-edition",
    "natural-earth-2026"
  );
  await expect(page.locator(".literary-globe")).toHaveAttribute(
    "data-globe-style",
    "modern"
  );
  await expect(page.locator(".globe-modern-badge")).toContainText(
    "Классический атлас · 2026"
  );
  await expect(page.locator("#atlas canvas")).toHaveCount(1);
  const russianTextureDimensions = await page.evaluate(async (textureUrl) => {
    const image = new Image();
    image.src = textureUrl;
    await image.decode();
    return { width: image.naturalWidth, height: image.naturalHeight };
  }, loadedRussianTexture.url());
  expect(russianTextureDimensions).toEqual(
    isMobile ? { width: 2048, height: 1024 } : { width: 4096, height: 2048 }
  );

  const englishFilename = isMobile
    ? "modern-atlas-2026-en-mobile.webp"
    : "modern-atlas-2026-en.webp";
  const englishTextureResponse = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname.endsWith(`/textures/${englishFilename}`) &&
      response.status() === 200
  );
  await page
    .locator(".site-header .interface-language-control")
    .getByRole("button", { name: /Английский язык|English/iu })
    .click();
  const loadedEnglishTexture = await englishTextureResponse;
  expect(loadedEnglishTexture.ok()).toBe(true);
  await expect(page.locator(".literary-globe")).toHaveAttribute(
    "data-globe-edition",
    "natural-earth-2026"
  );
  await expect(page.locator(".literary-globe")).toHaveAttribute(
    "data-globe-style",
    "modern"
  );
  await expect(naturalEarthButton).toHaveAccessibleName(
    "Natural Earth - Literary Atlas, 2026"
  );
  await expect(page.locator(".globe-modern-badge")).toContainText(
    "Classic atlas · 2026"
  );
  const englishTextureDimensions = await page.evaluate(async (textureUrl) => {
    const image = new Image();
    image.src = textureUrl;
    await image.decode();
    return { width: image.naturalWidth, height: image.naturalHeight };
  }, loadedEnglishTexture.url());
  expect(englishTextureDimensions).toEqual(
    isMobile ? { width: 2048, height: 1024 } : { width: 4096, height: 2048 }
  );
  const box = await canvas.boundingBox();
  expect(box).toBeTruthy();
  if (box) {
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.62, box.y + box.height * 0.5, { steps: 5 });
    await page.mouse.up();
  }
  expect(errors).toEqual([]);
});

test("поиск глобуса сохраняет запрос при ленивой загрузке и не раскрывает черновое описание", async ({ page }) => {
  test.setTimeout(90_000);
  await page.route(/\/assets\/countries-[^/?]+\.js(?:\?.*)?$/u, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    await route.continue();
  });
  await page.goto("/#atlas");
  const search = page.locator("#country-search");
  await search.fill("Морской волк");
  const result = page.getByRole("option", { name: /^Морской волк/u });
  await expect(result).toBeVisible();
  await expect(search).toHaveValue("Морской волк");
  await result.click();
  await expect(page.locator(".book-detail-copy h3")).toHaveText("Морской волк", {
    timeout: 30_000,
  });
  await expect(page.locator(".book-detail-copy .section-kicker")).toHaveText(
    "Не проверено"
  );
  await expect(page.locator(".book-detail-copy > p")).toHaveCount(0);
});

test("режим чтения не имеет горизонтального разрыва и не повторяет рекомендации", async ({ page }) => {
  await page.goto("/#journal");
  await page.locator(".article-library-grid article a").first().click();
  const reader = page.locator(".article-reader");
  await expect(reader).toBeVisible();
  await expect(reader.locator(".article-reader-lead h1")).toBeVisible();

  const overflow = await reader.evaluate(
    (element) => element.scrollWidth - element.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(2);

  const visibleRecommendations = await reader
    .locator(
      ".article-reader-related button:visible strong, .article-reader-more button:visible strong"
    )
    .allTextContents();
  expect(new Set(visibleRecommendations).size).toBe(visibleRecommendations.length);
});
