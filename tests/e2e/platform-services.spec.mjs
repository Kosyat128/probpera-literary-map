import { expect, test } from "@playwright/test";

// Exercise real browser connectivity on the already loaded product. The PWA
// cache and offline launch/package coverage have separate acceptance gates.
test.use({ serviceWorkers: "block" });

test("live offline status follows RU/EN while country and DOM Canvas survive reconnects", async ({
  page,
  context,
}) => {
  // The existing desktop/mobile projects both run this same WebGL scenario.
  test.setTimeout(90_000);
  await page.goto("/?country=russia#atlas");

  const languageControl = page.locator(".site-header .interface-language-control");
  const russian = languageControl.locator("button").filter({ hasText: /^RU$/u });
  const english = languageControl.locator("button").filter({ hasText: /^EN$/u });
  await russian.click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");

  const atlas = page.locator("#atlas");
  await atlas.scrollIntoViewIfNeeded();
  const globe = atlas.locator(".literary-globe:not(.is-loading)");
  const canvas = atlas.locator("canvas");
  const country = page.locator('.atlas-country-presentation[data-atlas-country="russia"]');
  const banner = page.locator('.connectivity-status[role="status"]');
  const russianOffline = /^Нет сети\s*[-–—]\s*доступны уже открытые материалы$/u;
  const englishOffline = /^Offline\s*[-–—]\s*previously opened publications remain available$/u;

  await expect(globe).toBeVisible({ timeout: 45_000 });
  await expect(globe).toHaveAttribute("data-globe-webgl-context", "ready");
  await expect(canvas).toHaveCount(1);
  await expect(canvas).toHaveAttribute("data-engine", /^three\.js r\d+/u);
  await expect(country).toBeVisible();
  await expect(country).toHaveAttribute("aria-label", "Россия");
  await expect(banner).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(true);

  const originalCanvas = await canvas.elementHandle();
  expect(originalCanvas).not.toBeNull();

  async function expectStableSelection() {
    await expect(canvas).toHaveCount(1);
    expect(await canvas.evaluate((element, original) => element === original && original.isConnected, originalCanvas)).toBe(true);
    await expect(globe).toHaveAttribute("data-globe-webgl-context", "ready");
    await expect(country).toBeVisible();
    await expect.poll(() => new URL(page.url()).searchParams.get("country")).toBe("russia");
  }

  async function setOffline(offline, copy) {
    await context.setOffline(offline);
    await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(!offline);
    if (offline) {
      await expect(banner).toBeVisible();
      await expect(banner).toHaveText(copy);
    } else {
      await expect(banner).toHaveCount(0);
    }
    await expectStableSelection();
  }

  try {
    await setOffline(true, russianOffline);

    await english.click();
    await expect(english).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(banner).toHaveText(englishOffline);
    await expect(country).toHaveAttribute("aria-label", "Russia");
    await expectStableSelection();

    await setOffline(false);
    await setOffline(true, englishOffline);

    await russian.click();
    await expect(russian).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("html")).toHaveAttribute("lang", "ru");
    await expect(banner).toHaveText(russianOffline);
    await expect(country).toHaveAttribute("aria-label", "Россия");
    await expectStableSelection();

    await setOffline(false);
  } finally {
    await context.setOffline(false);
    await originalCanvas?.dispose();
  }
});
