import { expect, test } from "@playwright/test";
import sharp from "sharp";

async function meanPixelDifference(firstPng, secondPng) {
  const [{ data: first, info }, { data: second }] = await Promise.all([
    sharp(firstPng).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(secondPng).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
  ]);
  expect(second).toHaveLength(first.length);

  let difference = 0;
  for (let index = 0; index < first.length; index += 4) {
    difference += Math.abs(first[index] - second[index]);
    difference += Math.abs(first[index + 1] - second[index + 1]);
    difference += Math.abs(first[index + 2] - second[index + 2]);
  }
  return difference / (info.width * info.height * 3);
}

test("globe preloads near the viewport but renders only while visible", async ({
  page,
}) => {
  await page.goto("/");
  const loadingGlobe = page.locator(".literary-globe").first();
  await expect(loadingGlobe).toBeAttached({ timeout: 30_000 });
  const globeTop = await loadingGlobe.evaluate(
    (element) => element.getBoundingClientRect().top + window.scrollY
  );

  await page.evaluate((top) => {
    window.scrollTo(0, Math.max(0, top - window.innerHeight - 100));
  }, globeTop);

  const globe = page.locator(".literary-globe:not(.is-loading)");
  await expect(page.locator("#atlas canvas")).toHaveCount(1, { timeout: 30_000 });
  await expect(globe).toHaveAttribute("data-globe-render-loop", "paused");

  await globe.scrollIntoViewIfNeeded();
  await expect(globe).toHaveAttribute("data-globe-render-loop", "active");
});

test("globe style preview reuses decoded texture assets", async ({
  page,
  isMobile,
}) => {
  await page.addInitScript(() => {
    window.__globeTextureAssignments = [];
    const descriptor = Object.getOwnPropertyDescriptor(
      HTMLImageElement.prototype,
      "src"
    );
    if (!descriptor?.get || !descriptor.set) return;

    Object.defineProperty(HTMLImageElement.prototype, "src", {
      configurable: descriptor.configurable,
      enumerable: descriptor.enumerable,
      get: descriptor.get,
      set(value) {
        if (String(value).includes("/textures/")) {
          window.__globeTextureAssignments.push(String(value));
        }
        return descriptor.set.call(this, value);
      },
    });
  });

  await page.goto("/");
  await page.locator("#atlas").scrollIntoViewIfNeeded();
  await expect(page.locator("#atlas canvas")).toHaveCount(1, { timeout: 30_000 });

  for (const style of ["modern", "earth", "modern"]) {
    await page.locator(`[data-globe-style-option="${style}"]`).click();
    await expect(page.locator(".literary-globe")).toHaveAttribute(
      "data-globe-style",
      style
    );
  }

  const textureAssignments = await page.evaluate(
    () => window.__globeTextureAssignments
  );
  const modernAsset = isMobile
    ? "/textures/modern-atlas-2026-ru-mobile.webp"
    : "/textures/modern-atlas-2026-ru.webp";
  const earthAsset = isMobile
    ? "/textures/earth-blue-marble-mobile.webp"
    : "/textures/earth-blue-marble.webp";
  expect(
    textureAssignments.filter((source) => source.endsWith(modernAsset))
  ).toHaveLength(1);
  expect(
    textureAssignments.filter((source) => source.endsWith(earthAsset))
  ).toHaveLength(1);
});

test("globe filters update the collection without rebuilding the 3D atlas", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.goto("/");
  await page.locator("#atlas").scrollIntoViewIfNeeded();

  const globe = page.locator(".literary-globe:not(.is-loading)");
  const canvas = page.locator("#atlas canvas").first();
  await expect(globe).toBeVisible({ timeout: 30_000 });
  await expect(canvas).toBeVisible();

  await canvas.evaluate((element) => {
    element.dataset.filterTestIdentity = "stable-atlas";
  });

  const filters = [
    ["all", 200],
    ["nobel", 44],
    ["rich", 45],
    ["portrait", 157],
    ["verified", 20],
  ];

  for (const [filter, count] of filters) {
    await page.locator(`[data-atlas-filter="${filter}"]`).click();
    await expect(
      page.locator(`[data-atlas-filter="${filter}"]`)
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".atlas-filter-status")).toContainText(
      String(count)
    );
    await expect(page.locator(".literary-globe.is-loading")).toHaveCount(0);
    await expect(page.locator("#atlas canvas")).toHaveCount(1);
    await expect(
      page.locator('#atlas canvas[data-filter-test-identity="stable-atlas"]')
    ).toHaveCount(1);
  }
});

test("globe honors reduced motion without presenting auto-rotation as active", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.locator("#atlas").scrollIntoViewIfNeeded();

  const globe = page.locator(".literary-globe:not(.is-loading)");
  await expect(globe).toHaveAttribute("data-globe-render-loop", "active", {
    timeout: 30_000,
  });
  await expect(globe).toHaveAttribute(
    "data-globe-auto-rotate",
    "reduced-motion"
  );
  await expect(globe).toHaveAttribute("data-globe-frame-mode", "demand");

  const autoRotate = globe.locator('[data-globe-control="auto-rotate"]');
  await expect(autoRotate).toBeDisabled();
  await expect(autoRotate).toHaveAttribute("aria-pressed", "false");
  await expect(autoRotate).toHaveAttribute(
    "aria-label",
    /уменьшения движения|reduced-motion/iu
  );
});

test("selected Indonesia remains centered after the focus animation", async ({
  page,
}) => {
  // A cold software-WebGL start can consume most of the suite's 45 s default
  // before the deliberate five-second stability window begins in CI.
  test.setTimeout(90_000);

  await page.goto("/");
  await page.locator("#atlas").scrollIntoViewIfNeeded();
  const globe = page.locator(".literary-globe:not(.is-loading)");
  const canvas = page.locator("#atlas canvas");
  const bringCanvasIntoView = async () => {
    await canvas.evaluate((element) => {
      element.scrollIntoView({ block: "center", inline: "center" });
    });
    await expect(canvas).toBeInViewport();
  };
  await expect(globe).toHaveAttribute("data-globe-render-loop", "active", {
    timeout: 45_000,
  });
  await expect(canvas).toHaveCount(1);
  await expect(canvas).toBeVisible();

  await page.locator('[data-globe-style-option="modern"]').click();
  await expect(page.locator(".literary-globe")).toHaveAttribute(
    "data-globe-style",
    "modern"
  );

  await page.locator("#country-search").fill("Индонезия");
  const indonesiaResult = page
    .locator(".search-results button")
    .filter({ hasText: "Индонезия" })
    .first();
  await expect(indonesiaResult).toBeVisible({ timeout: 15_000 });
  await indonesiaResult.click();
  const countryPanel = page.locator(".country-panel");
  await expect(countryPanel).toBeVisible();
  await expect(countryPanel).toContainText("Индонезия");
  await bringCanvasIntoView();
  await expect(globe).toHaveAttribute("data-globe-frame-mode", "demand");
  await expect(
    page.locator(
      '.globe-country-label[data-country-code="id"][data-country-label-source="selection"]'
    )
  ).toContainText("Индонезия");

  const biographyTab = countryPanel.getByRole("tab", {
    name: "Биография",
    exact: true,
  });
  const worksTab = countryPanel.getByRole("tab", {
    name: "Произведения и награды",
    exact: true,
  });
  const sourcesTab = countryPanel.getByRole("tab", {
    name: "Источники и материалы",
    exact: true,
  });
  await biographyTab.focus();
  await biographyTab.press("End");
  await expect(sourcesTab).toBeFocused();
  await expect(sourcesTab).toHaveAttribute("aria-selected", "true");
  const sourcesTabId = await sourcesTab.getAttribute("id");
  expect(sourcesTabId).toBeTruthy();
  await expect(countryPanel.getByRole("tabpanel")).toHaveAttribute(
    "aria-labelledby",
    sourcesTabId
  );
  await sourcesTab.press("ArrowLeft");
  await expect(worksTab).toBeFocused();
  await expect(worksTab).toHaveAttribute("aria-selected", "true");

  await bringCanvasIntoView();
  await expect(globe).toHaveAttribute("data-globe-frame-mode", "demand");
  await page.waitForTimeout(1_800);
  const focused = await canvas.screenshot();
  // This interval is deliberately longer than the former delayed auto-rotate
  // restart (1.75 s), so the regression cannot hide behind the camera tween.
  await page.waitForTimeout(3_200);
  const stillFocused = await canvas.screenshot();

  expect(await meanPixelDifference(focused, stillFocused)).toBeLessThan(0.9);

  await page
    .locator(".site-header .interface-language-control")
    .getByRole("button", { name: /Английский язык|English/iu })
    .click();
  await expect(
    page.locator(
      '.globe-country-label[data-country-code="id"][data-country-label-source="selection"]'
    )
  ).toContainText("Indonesia");
});
