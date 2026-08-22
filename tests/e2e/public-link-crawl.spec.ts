import { expect, test, type Page } from "@playwright/test";

const ignoredPathPrefixes = [
  "/admin",
  "/auth/callback",
  "/reset-password",
  "/api/",
  "/.well-known/",
];

function installPageErrorCollector(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

test("внутренние ссылки главной открываются без HTTP- и JavaScript-ошибок", async ({
  page,
  baseURL,
}) => {
  const landingErrors = installPageErrorCollector(page);
  const landingResponse = await page.goto("/");
  expect(landingResponse?.status() ?? 200).toBeLessThan(400);
  await expect(page.locator("#root")).not.toBeEmpty();
  await expect(page.locator("body")).toContainText(/Проба Пера|Proba Pera/iu);
  expect(landingErrors).toEqual([]);

  const origin = new URL(baseURL || page.url()).origin;
  const hrefs = await page.locator("a[href]").evaluateAll(
    (anchors, expectedOrigin) =>
      anchors
        .map((anchor) => {
          try {
            const url = new URL(
              (anchor as HTMLAnchorElement).href,
              window.location.href
            );
            return {
              href: url.href,
              origin: url.origin,
              pathname: url.pathname,
              protocol: url.protocol,
              download: (anchor as HTMLAnchorElement).hasAttribute("download"),
            };
          } catch {
            return null;
          }
        })
        .filter(
          (entry): entry is NonNullable<typeof entry> =>
            Boolean(
              entry &&
                entry.protocol === "http:" &&
                entry.origin === expectedOrigin &&
                !entry.download
            )
        ),
    origin
  );

  const routes = [
    ...new Set(
      hrefs
        .filter(
          ({ pathname }) =>
            !ignoredPathPrefixes.some((prefix) => pathname.startsWith(prefix))
        )
        .map(({ href }) => {
          const url = new URL(href);
          url.hash = "";
          return `${url.pathname}${url.search}`;
        })
    ),
  ]
    .filter((href) => href !== "/")
    .slice(0, 12);

  expect(routes.length).toBeGreaterThanOrEqual(4);

  for (const route of routes) {
    const routePage = await page.context().newPage();
    const routeErrors = installPageErrorCollector(routePage);
    const response = await routePage.goto(route, {
      waitUntil: "domcontentloaded",
    });

    expect(
      response?.status() ?? 200,
      `Маршрут ${route} вернул ошибочный HTTP-статус`
    ).toBeLessThan(400);
    await expect(
      routePage.locator("body"),
      `Маршрут ${route} отрисовал пустую страницу`
    ).not.toBeEmpty();
    await routePage.waitForTimeout(150);
    expect(routeErrors, `JavaScript-ошибки на маршруте ${route}`).toEqual([]);
    await routePage.close();
  }
});
