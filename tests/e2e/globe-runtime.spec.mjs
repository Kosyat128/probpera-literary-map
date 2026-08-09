import { expect, test } from "@playwright/test";

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
