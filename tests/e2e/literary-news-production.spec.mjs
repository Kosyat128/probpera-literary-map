import { expect, test } from "@playwright/test";
import { PUBLIC_CONTENT_SECURITY_POLICY } from "../../scripts/cloudflare/configure-edge-security.mjs";

test.setTimeout(150_000);
// Failure fixtures must reach route handlers instead of the offline asset cache.
test.use({ timezoneId: "America/Los_Angeles", serviceWorkers: "block" });

const endpoint = "https://news.probpera.ru/api/literary-news/feed*";
const instant = "2026-09-05T00:30:00Z";
const story = (id) => ({
  id, category: "festivals", region: "asia", kind: "announcement",
  eventDate: "2026-09-05", publishedAt: null, verifiedAt: instant,
  title: { ru: `Тестовое событие ${id}`, en: `Test event ${id}` },
  summary: { ru: "Проверяемая русская версия.", en: "The reviewed English version." },
  source: { name: "Test source", url: `https://example.org/${id}`, language: "en" },
  verification: "confirmed",
});
const feed = (timeZone, items = [story("first")]) => ({
  mode: "reviewed", generatedAt: instant, lastCheckedAt: instant,
  refreshIntervalSeconds: 600, timeZone, sources: [], pendingCount: 0, items,
});

function respondFeed(route, json, status = 200) {
  // The browser still enforces CORS on this intercepted cross-origin response.
  return route.fulfill({
    status, json,
    headers: { "access-control-allow-origin": route.request().headers().origin },
  });
}

test.beforeEach(async ({ page, baseURL }) => {
  await page.addInitScript((now) => {
    Date.now = () => Date.parse(now);
    window.localStorage.setItem("probpera-interface-language", "ru");
  }, instant);
  await page.route(new URL("/", baseURL).href, async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: { ...response.headers(), "content-security-policy": PUBLIC_CONTENT_SECURITY_POLICY },
    });
  });
});

test("public news loads near the book feature and follows language and visitor dates", async ({ page }) => {
  const requests = [];
  const chunks = [];
  page.on("request", (request) => {
    if (/\/LiteraryNewsPanel-[^/]+\.js/u.test(request.url())) chunks.push(request.url());
  });
  await page.route(endpoint, (route) => {
    const url = new URL(route.request().url());
    expect(url.origin).toBe("https://news.probpera.ru");
    const timeZone = url.searchParams.get("timeZone");
    requests.push(timeZone);
    return respondFeed(route, feed(timeZone));
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".magazine-hero")).toBeVisible();
  await expect(page.locator(".literary-news-slot")).toHaveAttribute("data-loading-status", "idle");
  expect(requests).toEqual([]);
  expect(chunks).toEqual([]);

  await page.locator("#book-day").scrollIntoViewIfNeeded();
  const panel = page.locator("#literary-news");
  await expect(panel).toHaveAttribute("data-news-mode", "reviewed", { timeout: 30_000 });
  expect(requests).toContain("America/Los_Angeles");
  await expect(panel.locator(".literary-news__prototype")).toHaveCount(0);
  await expect(panel.locator(".literary-news__date-hint")).toHaveText("Завтра");
  await expect(panel.locator(".literary-news__event-date")).toContainText("5 сент.");
  await panel.locator(".literary-news__headline").click();
  await expect(panel.locator(".literary-news__summary")).toHaveText("Проверяемая русская версия.");

  await page.locator(".interface-language-control button").nth(1).click();
  await expect(panel.locator("h2")).toHaveText("The literary briefing");
  await expect(panel.locator(".literary-news__date-hint")).toHaveText("Tomorrow");
  await expect(panel.locator(".literary-news__summary")).toHaveText("The reviewed English version.");
  await expect(panel.locator(".literary-news__item-footer a")).toHaveAttribute("href", "https://example.org/first");
  await page.evaluate(() => { window.location.hash = "about"; });
  await expect(page.locator(".news-editorial-context")).toHaveAttribute("open", "");
  await expect(page.locator(".news-editorial-context #about")).toBeVisible();
});

test("a failed refresh preserves reviewed stories and new arrivals wait for the reader", async ({ page }) => {
  let unavailable = false;
  let items = [story("first")];
  await page.route(endpoint, (route) => unavailable
    ? respondFeed(route, { error: "unavailable" }, 503)
    : respondFeed(route, feed("America/Los_Angeles", items)));
  await page.goto("/#book-day", { waitUntil: "domcontentloaded" });
  const panel = page.locator("#literary-news");
  await expect(panel.locator("article")).toHaveCount(1, { timeout: 30_000 });
  unavailable = true;
  await panel.locator(".literary-news__refresh").click();
  await expect(panel.locator(".literary-news__refresh")).toBeEnabled();
  await panel.locator(".literary-news__feed-details > summary").click();
  await expect(panel.locator(".literary-news__warning")).toContainText("Показаны последние полученные события");
  await expect(panel.locator("article")).toHaveCount(1);

  unavailable = false;
  items = [story("incoming"), story("first")];
  await panel.locator(".literary-news__refresh").click();
  await expect(panel.locator(".literary-news__apply-updates")).toBeVisible();
  await expect(panel.locator("article")).toHaveCount(1);
  await panel.locator(".literary-news__apply-updates").click();
  await expect(panel.locator("article")).toHaveCount(2);
  await expect(panel.locator(".literary-news__content")).toBeFocused();
});

test("an unavailable news chunk leaves the homepage usable and offers recovery", async ({ page }) => {
  let blocked = true;
  await page.route(/\/assets\/LiteraryNewsPanel-[^/]+\.js(?:\?.*)?$/u, (route) => blocked ? route.abort() : route.continue());
  await page.route(endpoint, (route) => respondFeed(route, feed("America/Los_Angeles")));
  await page.goto("/#book-day", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".literary-news-slot")).toHaveAttribute("data-loading-status", "error", { timeout: 30_000 });
  await expect(page.locator(".book-of-day")).toBeVisible();
  await expect(page.locator(".site-header")).toBeVisible();
  blocked = false;
  await page.getByRole("button", { name: "Перезагрузить страницу" }).click();
  await expect(page.locator("#literary-news")).toHaveAttribute("data-news-mode", "reviewed", { timeout: 30_000 });
});
