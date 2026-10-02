import { expect, test } from "@playwright/test";
import { load } from "cheerio";

test.use({ serviceWorkers: "block" });

test("built canonical account routes remain private, bilingual and outside the globe runtime", async ({ page, request }) => {
  const errors = [], requests = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", value => requests.push(value.url()));
  for (const name of ["planet-account", "delete-account"]) {
    const response = await request.get(`/en/${name}/`); expect(response.status()).toBe(200);
    const $ = load(await response.text());
    expect($("html").attr("data-planet-account-entry")).toBe(name === "planet-account" ? "access" : "deletion");
    expect($('meta[name="robots"]').attr("content")).toBe("noindex,nofollow");
    expect($('script[type="module"]')).toHaveLength(1);
    expect(JSON.parse($('script[data-planet-account-structured-data]').text()).inLanguage).toBe("en");
    await page.goto(`/en/${name}/?returnTo=%2Fplanet%2Fen%2F%3Fcountry%3Drussia%23atlas#account-state`);
    await expect(page.locator("main[data-planet-account]")).toBeVisible();
    await expect(page.locator(".interface-language-control")).toHaveCount(1);
    await expect(page.locator("#atlas,canvas,.site-header,[data-cms-edit-root]")).toHaveCount(0);
    const original = await page.locator("main[data-planet-account]").elementHandle();
    for (const locale of ["ru", "en"]) {
      await page.locator(`.planet-account__header [data-interface-language="${locale}"]`).click();
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await expect.poll(() => new URL(page.url()).pathname).toBe(`/${locale}/${name}/`);
      expect(new URL(page.url()).searchParams.get("returnTo")).toBe("/planet/en/?country=russia#atlas");
      expect(new URL(page.url()).hash).toBe("#account-state");
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `https://probpera.ru/${locale}/${name}/`);
      expect(await page.locator("main[data-planet-account]").evaluate((node, previous) => node === previous, original)).toBe(true);
    }
    await original.dispose();
    await expect(page.locator('a[href="mailto:probperasite@yandex.ru"]')).toBeVisible();
    if (name === "delete-account") {
      await expect(page.locator('.planet-account__consent input')).toBeDisabled();
      await expect(page.locator('.planet-account__disclosure')).toContainText("unavailable");
    }
  }
  expect(requests.filter(url => /(?:mc\.yandex|\/api\/cms|\/api\/admin)/u.test(url))).toEqual([]);
  expect(errors).toEqual([]);
});
