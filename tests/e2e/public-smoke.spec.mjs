import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

function watchErrors(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
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
  const sitemap = await (await request.get("/sitemap.xml")).text();
  const articleUrl = sitemap.match(/<loc>([^<]+\/stati\/[^<]+)<\/loc>/u)?.[1];
  expect(articleUrl).toBeTruthy();
  const articlePath = new URL(articleUrl).pathname;
  await page.goto(new URL(articlePath, baseURL).toString());
  await expect(page.locator("h1").first()).toBeVisible();
  await expect(page.locator("article").first()).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /index/u);
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
