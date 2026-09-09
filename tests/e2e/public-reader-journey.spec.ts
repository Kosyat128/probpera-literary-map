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
    const failureText = request.failure()?.errorText || "failed";
    if (failureText === "net::ERR_ABORTED") return;

    const currentOrigin = page.url().startsWith("http")
      ? new URL(page.url()).origin
      : null;
    const requestUrl = new URL(request.url());
    if (currentOrigin && requestUrl.origin === currentOrigin) {
      diagnostics.failedSameOriginRequests.push(
        `${request.method()} ${requestUrl.pathname}: ${failureText}`
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
  return page.locator('[aria-labelledby="archive-publications"] a[href]').evaluateAll((links) => {
    const archiveOffset = window.location.pathname.indexOf('/stati/');
    const localBase = archiveOffset >= 0 ? window.location.pathname.slice(0, archiveOffset) : '';
    for (const link of links) {
      const rawHref = link.getAttribute("href");
      if (!rawHref) continue;
      const url = new URL(rawHref, window.location.href);
      const segments = url.pathname.split("/").filter(Boolean);
      const journalIndex = segments.indexOf("stati");
      if (journalIndex < 0) continue;
      if (segments.length - journalIndex < 3) continue;
      if (url.pathname.includes("/page-")) continue;
      // The archive preserves production canonical URLs. Exercise the same real
      // article in this preview, including its project base, without remote I/O.
      const articlePath = '/' + segments.slice(journalIndex).join('/') + '/';
      return new URL(
        `${localBase}${articlePath}${url.search}${url.hash}`,
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

async function journalHrefFromHome(page: Page) {
  const link = page.locator('.magazine-hero a[href$="/stati/"]');
  await expect(link).toHaveCount(1);
  // Use the real public link, including a project preview base when present.
  return link.evaluate((element) => (element as HTMLAnchorElement).href);
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

  const journalResponse = await page.goto(await journalHrefFromHome(page), {
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

  const journalResponse = await page.goto(await journalHrefFromHome(page), {
    waitUntil: "domcontentloaded",
  });
  expect(journalResponse?.status()).toBeLessThan(400);
  await expect(page.locator("h1").first()).toBeVisible();
  await expectNoHorizontalOverflow(page);

  expect(diagnostics.pageErrors).toEqual([]);
  expect(diagnostics.failedSameOriginRequests).toEqual([]);
  expect(diagnostics.serverErrors).toEqual([]);
});
