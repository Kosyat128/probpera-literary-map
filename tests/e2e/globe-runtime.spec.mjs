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
  const globeShell = page.locator("#atlas .world-map-stage").first();
  await expect(globeShell).toBeAttached({ timeout: 30_000 });
  const globeTop = await globeShell.evaluate(
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

test("all globe surfaces use the same seamless star background", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#atlas").scrollIntoViewIfNeeded();
  const globe = page.locator(".literary-globe:not(.is-loading)");
  await expect(globe).toBeVisible({ timeout: 30_000 });

  const modern = page.getByRole("button", { name: "Современный", exact: true });
  await modern.click();
  await expect(globe).toHaveAttribute("data-globe-style", "earth");
  const activeModernButton = page.locator(
    '.globe-style-switch button[data-globe-style-option="earth"].is-active'
  );
  // Chrome serializes an opaque color as either rgb() or rgba(..., 1),
  // depending on the browser build. Wait for the CSS transition to settle and
  // assert the same semantic color in both serializations.
  await expect(activeModernButton).toHaveCSS(
    "color",
    /^rgba?\(156,\s*240,\s*207(?:,\s*1)?\)$/u
  );
  await expect(activeModernButton).toHaveCSS(
    "border-top-color",
    "rgba(128, 211, 255, 0.72)"
  );
  const modernPresentation = await globe.evaluate((element) => ({
      scene: getComputedStyle(element).getPropertyValue("--globe-scene-theme").trim(),
      background: getComputedStyle(element).backgroundImage,
      controls: getComputedStyle(
        element.querySelector(".globe-controls")
      ).backgroundColor,
      switcher: getComputedStyle(
        element.querySelector(".globe-style-switch")
      ).backgroundColor,
      vignette: getComputedStyle(
        element.querySelector(".globe-vignette")
      ).boxShadow,
    }));
  expect(modernPresentation).toMatchObject({
    scene: "shared-starry",
    controls: "rgba(30, 9, 45, 0.9)",
    switcher: "rgba(32, 10, 48, 0.92)",
  });
  expect(modernPresentation.background).toContain("radial-gradient");

  const classic = page.getByRole("button", { name: "Классический", exact: true });
  await classic.click();
  await expect(globe).toHaveAttribute("data-globe-style", "modern");
  await expect
    .poll(() =>
      globe.evaluate((element) =>
        getComputedStyle(element).getPropertyValue("--globe-scene-theme").trim()
      )
    )
    .toBe("shared-starry");
  expect(
    await globe.evaluate((element) => ({
      background: getComputedStyle(element).backgroundImage,
      vignette: getComputedStyle(
        element.querySelector(".globe-vignette")
      ).boxShadow,
    }))
  ).toMatchObject({
    background: modernPresentation.background,
    vignette: modernPresentation.vignette,
  });

  const antique = page.getByRole("button", { name: "Старинный", exact: true });
  await antique.click();
  await expect(globe).toHaveAttribute("data-globe-style", "antique");
  expect(
    await globe.evaluate((element) => ({
      background: getComputedStyle(element).backgroundImage,
      vignette: getComputedStyle(
        element.querySelector(".globe-vignette")
      ).boxShadow,
    }))
  ).toMatchObject({
    background: modernPresentation.background,
    vignette: modernPresentation.vignette,
  });
});

test("atlas URL restores selections, supports history and mounts the index on demand", async ({
  page,
}) => {
  await page.goto("/?atlas=verified&country=russia&writer=chekhov#atlas");
  await expect(page.locator('[data-atlas-filter="verified"]')).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await expect(page.locator(".country-panel")).toContainText("Россия", {
    timeout: 30_000,
  });
  await expect(page).toHaveURL(/atlas=verified.*country=russia.*writer=chekhov/iu);

  const countryIndex = page.locator(".atlas-country-index");
  await expect(countryIndex.locator(":scope > div")).toHaveCount(0);
  await countryIndex.locator("summary").click();
  await expect(countryIndex.locator(":scope > div")).toHaveCount(1);
  await expect(countryIndex.locator(":scope > div > button")).toHaveCount(190);

  await page.locator('[data-atlas-filter="all"]').click();
  await expect(page).not.toHaveURL(/atlas=verified/iu);
  await expect(page).toHaveURL(/country=russia/iu);
  const search = page.locator("#country-search");
  await search.fill("Чехов");
  await expect(search).toHaveValue("Чехов");
  await page.goBack();
  await expect(search).toHaveValue("");
  await expect(search).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator('[data-atlas-filter="verified"]')).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  await expect(page.locator(".country-panel")).toContainText("Россия");
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

  const filters = ["all", "nobel", "rich", "portrait", "verified"];

  for (const filter of filters) {
    const filterButton = page.locator(`[data-atlas-filter="${filter}"]`);
    const count = (
      await filterButton.locator(".atlas-filter-count").textContent()
    )?.trim();
    expect(count).toMatch(/^\d+$/u);
    await filterButton.click();
    await expect(filterButton).toHaveAttribute("aria-pressed", "true");
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
  isMobile,
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
  if (isMobile) {
    const sheetToggle = page.locator(".atlas-country-sheet-toggle");
    await expect(sheetToggle).toBeVisible();
    await expect(sheetToggle).toHaveAttribute("aria-expanded", "false");
    await sheetToggle.click();
    await expect(sheetToggle).toHaveAttribute("aria-expanded", "true");
  }
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
