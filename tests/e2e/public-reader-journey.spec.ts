import { expect, test, type Page } from "@playwright/test";

type BrowserDiagnostics = {
  pageErrors: string[];
  failedSameOriginRequests: string[];
  serverErrors: string[];
};

function collectBrowserDiagnostics(page: Page): BrowserDiagnostics {
  const diagnostics: BrowserDiagnostics = {
    pageErrors: [],
    failedSameOriginRequests: [],
    serverErrors: [],
  };

  page.on("pageerror", (error) => {
    diagnostics.pageErrors.push(error.message);
  });

  page.on("requestfailed", (request) => {
    const currentOrigin = page.url().startsWith("http")
      ? new URL(page.url()).origin
      : null;
    const requestUrl = new URL(request.url());
    if (currentOrigin && requestUrl.origin === currentOrigin) {
      diagnostics.failedSameOriginRequests.push(
        `${request.method()} ${requestUrl.pathname}: ${request.failure()?.errorText || "failed"}`
      );
    }
  });

  page.on("response", (response) => {
    const currentOrigin = page.url().startsWith("http")
      ? new URL(page.url()).origin
      : null;
    const responseUrl = new URL(response.url());
    if (
      currentOrigin &&
      responseUrl.origin === currentOrigin &&
      response.status() >= 500
    ) {
      diagnostics.serverErrors.push(
        `${response.status()} ${response.request().method()} ${responseUrl.pathname}`
      );
    }
  });

  return diagnostics;
}

async function firstArticleHref(page: Page) {
  return page.locator("a[href]").evaluateAll((links) => {
    const canonicalHref = document
      .querySelector<HTMLLinkElement>('link[rel="canonical"]')
      ?.getAttribute("href");
    const canonicalOrigin = canonicalHref
      ? new URL(canonicalHref, window.location.href).origin
      : window.location.origin;

    for (const link of links) {
      const rawHref = link.getAttribute("href");
      if (!rawHref) continue;
      const url = new URL(rawHref, window.location.href);
      if (
        url.origin !== window.location.origin &&
        url.origin !== canonicalOrigin
      ) {
        continue;
      }
      const segments = url.pathname.split("/").filter(Boolean);
      const journalIndex = segments.indexOf("stati");
      if (journalIndex < 0) continue;
      if (segments.length - journalIndex < 3) continue;
      if (url.pathname.includes("/page-")) continue;
      return new URL(
        `${url.pathname}${url.search}${url.hash}`,
        window.location.origin
      ).href;
    }
    return null;
  });
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));

  expect(
    Math.max(overflow.document, overflow.body) - overflow.viewport,
    `document width ${Math.max(overflow.document, overflow.body)} exceeds viewport ${overflow.viewport}`
  ).toBeLessThanOrEqual(2);
}

test("reader can open the journal and a real article without runtime failures", async ({
  page,
}) => {
  const diagnostics = collectBrowserDiagnostics(page);

  const homeResponse = await page.goto("/", { waitUntil: "domcontentloaded" });
  expect(homeResponse?.status()).toBeLessThan(400);
  await expect(page.locator("#root")).toBeVisible();
  await expect(page.locator("main").first()).toBeVisible();
  await expect(page.locator(".static-home-fallback")).toHaveCount(0);

  const journalResponse = await page.goto("/stati/", {
    waitUntil: "domcontentloaded",
  });
  expect(journalResponse?.status()).toBeLessThan(400);
  await expect(page.locator("h1").first()).toBeVisible();

  const articleHref = await firstArticleHref(page);
  expect(articleHref, "journal must expose at least one canonical article link").toBeTruthy();

  const articleResponse = await page.goto(articleHref!, {
    waitUntil: "domcontentloaded",
  });
  expect(articleResponse?.status()).toBeLessThan(400);
  await expect(page.locator("h1").first()).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);

  await page.waitForTimeout(250);
  expect(diagnostics.pageErrors).toEqual([]);
  expect(diagnostics.failedSameOriginRequests).toEqual([]);
  expect(diagnostics.serverErrors).toEqual([]);
});

test("home and journal remain inside a narrow mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const diagnostics = collectBrowserDiagnostics(page);

  const homeResponse = await page.goto("/", { waitUntil: "domcontentloaded" });
  expect(homeResponse?.status()).toBeLessThan(400);
  await expect(page.locator("main").first()).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.keyboard.press("Tab");
  const focusMoved = await page.evaluate(
    () => document.activeElement !== document.body && document.activeElement !== document.documentElement
  );
  expect(focusMoved).toBe(true);

  const journalResponse = await page.goto("/stati/", {
    waitUntil: "domcontentloaded",
  });
  expect(journalResponse?.status()).toBeLessThan(400);
  await expect(page.locator("h1").first()).toBeVisible();
  await expectNoHorizontalOverflow(page);

  expect(diagnostics.pageErrors).toEqual([]);
  expect(diagnostics.failedSameOriginRequests).toEqual([]);
  expect(diagnostics.serverErrors).toEqual([]);
});
