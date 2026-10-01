import { expect, test } from "@playwright/test";
import { load } from "cheerio";

test.use({ serviceWorkers: "block" });

test("public RU/EN shells have matching metadata before JavaScript", async ({ request }) => {
  const sitemap = await (await request.get("/sitemap.xml")).text();
  for (const locale of ["ru", "en"]) {
    const response = await request.get("/" + locale + "/");
    expect(response.status()).toBe(200);
    const $ = load(await response.text());
    expect($("html").attr("lang")).toBe(locale);
    expect($("html").attr("data-route-language")).toBe(locale);
    expect($("body").attr("lang")).toBe(locale);
    expect($('link[rel="canonical"]').attr("href")).toBe("https://probpera.ru/" + locale + "/");
    expect($('meta[property="og:url"]').attr("content")).toBe("https://probpera.ru/" + locale + "/");
    expect($('link[hreflang="ru"]').attr("href")).toBe("https://probpera.ru/ru/");
    expect($('link[hreflang="en"]').attr("href")).toBe("https://probpera.ru/en/");
    expect($('meta[name="robots"]').attr("content")).toContain("noindex");
    expect(sitemap).not.toContain("<loc>https://probpera.ru/" + locale + "/</loc>");
    expect($('script[type="module"]').length).toBe(1);
    expect($('link[rel="manifest"]').attr("href")).toBe("/site.webmanifest");
    expect($("body").text()).toContain(locale === "ru" ? "Литературная планета" : "Literary Planet");
  }
});

test("public locale switching keeps the globe and country while updating route metadata", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/en/?country=russia#atlas");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.locator("#atlas").scrollIntoViewIfNeeded();
  const globe = page.locator("#atlas .literary-globe");
  const canvas = page.locator("#atlas canvas");
  await expect(globe).toHaveAttribute("data-globe-webgl-context", "ready", { timeout: 45_000 });
  const original = await canvas.elementHandle();
  expect(original).not.toBeNull();
  for (const locale of ["ru", "en"]) {
    await page.locator(".site-header .interface-language-control button").filter({ hasText: locale.toUpperCase() }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.locator("body")).toHaveAttribute("lang", locale);
    await expect.poll(() => new URL(page.url()).pathname).toBe("/" + locale + "/");
    expect(new URL(page.url()).searchParams.get("country")).toBe("russia");
    expect(new URL(page.url()).hash).toBe("#atlas");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", "https://probpera.ru/" + locale + "/");
    await expect(page.locator('.atlas-country-presentation[data-atlas-country="russia"]')).toBeVisible();
    expect(await canvas.evaluate((element, prior) => element === prior && prior.isConnected, original)).toBe(true);
  }
  await original.dispose();
});
