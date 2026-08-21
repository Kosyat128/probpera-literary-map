import { expect, test } from "@playwright/test";

test("главная не показывает SEO-заглушку, пока загружается приложение", async ({
  page,
}) => {
  let releaseMainBundle = () => undefined;
  let mainBundleRequested = false;
  const mainBundleGate = new Promise((resolve) => {
    releaseMainBundle = resolve;
  });

  await page.route(/\/assets\/index-[^/]+\.js(?:\?.*)?$/u, async (route) => {
    mainBundleRequested = true;
    await mainBundleGate;
    await route.continue();
  });

  try {
    await page.goto("/", { waitUntil: "commit" });
    await expect.poll(() => mainBundleRequested).toBe(true);

    const staticFallback = page.locator("[data-static-seo]");
    await expect(staticFallback).toHaveCount(1);
    await expect(staticFallback).toBeHidden();
  } finally {
    releaseMainBundle();
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
