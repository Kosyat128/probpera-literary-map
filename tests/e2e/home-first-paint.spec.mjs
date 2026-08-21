import { expect, test } from "@playwright/test";

test("главная не показывает SEO-заглушку до загрузки CSS и приложения", async ({
  page,
}) => {
  let releaseAssets = () => undefined;
  let mainBundleRequested = false;
  let stylesheetRequested = false;
  const assetGate = new Promise((resolve) => {
    releaseAssets = resolve;
  });

  await page.route(/\/assets\/index-[^/]+\.(?:css|js)(?:\?.*)?$/u, async (route) => {
    if (/\.js(?:\?|$)/u.test(route.request().url())) {
      mainBundleRequested = true;
    } else {
      stylesheetRequested = true;
    }
    await assetGate;
    await route.continue();
  });

  try {
    await page.goto("/", { waitUntil: "commit" });
    await expect
      .poll(() => mainBundleRequested && stylesheetRequested)
      .toBe(true);

    const staticFallback = page.locator("[data-static-seo]");
    await expect(staticFallback).toHaveCount(1);
    await expect(staticFallback).toBeHidden();
    await expect(page.locator('head > style[data-home-prepaint]')).toHaveCount(1);
    await expect(page.locator('head > script[type="module"]')).toHaveCount(1);
  } finally {
    releaseAssets();
  }

  await expect(page.locator(".magazine-app")).toBeVisible();
});

test("без JavaScript главная сохраняет доступную статическую версию", async ({
  browser,
  baseURL,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "desktop-chromium",
    "Проверка no-script нужна один раз на сборку."
  );

  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  try {
    await page.goto(new URL("/", baseURL).href, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator("[data-static-seo]")).toBeVisible();
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /Проба Пера — статьи о книгах/iu,
      })
    ).toBeVisible();
  } finally {
    await context.close();
  }
});

test("статический архив журнала не скрывается защитой главной", async ({
  page,
}) => {
  await page.goto("/stati/", { waitUntil: "domcontentloaded" });
  await expect(page.locator('script[type="module"]')).toHaveCount(0);
  await expect(page.locator("[data-static-seo]")).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 1, name: /Все статьи литературного журнала/iu })
  ).toBeVisible();
});
