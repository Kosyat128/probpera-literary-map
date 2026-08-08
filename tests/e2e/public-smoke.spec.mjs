import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

function watchErrors(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

const sitemapCandidates = ["/sitemap.xml", "/probpera-literary-map/sitemap.xml"];

async function articleFromSitemap(request, baseURL, preferredPath = "") {
  let sitemap = "";
  let previewBasePath = "";
  for (const candidate of sitemapCandidates) {
    const response = await request.get(new URL(candidate, baseURL).toString());
    const body = await response.text();
    if (response.ok() && body.includes("<urlset")) {
      sitemap = body;
      previewBasePath = candidate.replace(/\/sitemap\.xml$/u, "");
      break;
    }
  }

  const articleUrls = [...sitemap.matchAll(/<loc>([^<]+\/stati\/[^<]+)<\/loc>/gu)].map(
    (match) => match[1]
  );
  expect(
    articleUrls.length,
    "В карте сайта должна быть хотя бы одна опубликованная статья"
  ).toBeGreaterThan(0);

  const articleUrl =
    articleUrls.find((candidate) => candidate.includes(preferredPath)) || articleUrls[0];
  const articlePath = new URL(articleUrl).pathname;
  const previewArticlePath =
    previewBasePath && !articlePath.startsWith(`${previewBasePath}/`)
      ? `${previewBasePath}${articlePath}`
      : articlePath;

  return new URL(previewArticlePath, baseURL).toString();
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
  await expect(
    reader.getByRole("button", { name: "Back to journal" })
  ).toBeVisible();

  await russianButton.click();
  await expect(
    reader.getByRole("navigation", { name: "Настройки чтения" })
  ).toBeVisible();
  await reader.getByRole("button", { name: /К журналу|Back to journal/iu }).click();

  await expect(page.locator(".site-header")).toBeVisible();
  await expect(page.locator("#journal")).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.location.hash)).toBe("#journal");
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

test("глобус загружается только после приближения к атласу и принимает управление", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/");
  await page.locator("#atlas").scrollIntoViewIfNeeded();
  const canvas = page.locator("#atlas canvas").first();
  await expect(canvas).toBeVisible({ timeout: 30_000 });
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

test("поиск глобуса находит непроверенную книгу без чернового описания", async ({ page }) => {
  await page.goto("/#atlas");
  const search = page.locator("#country-search");
  await search.fill("Морской волк");
  const result = page.getByRole("option", { name: /^Морской волк/u });
  await expect(result).toBeVisible();
  await result.click();
  await expect(page.locator(".book-detail-copy h3")).toHaveText("Морской волк");
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
