import { expect, test } from "@playwright/test";
import { PUBLIC_CONTENT_SECURITY_POLICY } from "../../scripts/cloudflare/configure-edge-security.mjs";
import { buildPublishedNewsFeed } from "../../scripts/lib/literary-news-publication.mjs";

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
const feed = (timeZone, items = [story("first")]) => buildPublishedNewsFeed({
  records: items, current: new Date(instant), timeZone, archive: true,
  release: "a".repeat(40),
  state: { lastCheckedAt: instant, refreshIntervalSeconds: 600, sources: [], pendingCount: 0 },
});

async function respondFeed(route, json, status = 200) {
  // The browser still enforces CORS on this intercepted cross-origin response.
  return route.fulfill({
    status, json: await json,
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
    expect(url.searchParams.get("contract")).toBe("2");
    expect(url.searchParams.get("view")).toBe("archive");
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
  await expect(panel.locator(".literary-news__summary")).toBeVisible();
  await expect(panel.locator("article")).toHaveAttribute("data-read", "false");
  await panel.locator(".literary-news__headline").click();
  await expect(panel.locator("article")).toHaveAttribute("data-read", "true");
  await expect(panel.locator(".literary-news__summary")).toHaveText("Проверяемая русская версия.");

  await page.locator(".interface-language-control button").nth(1).click();
  await expect(panel.locator("h2")).toHaveText("The literary briefing");
  await expect(panel.locator(".literary-news__date-hint")).toHaveText("Tomorrow");
  await expect(panel.locator(".literary-news__summary")).toHaveText("The reviewed English version.");
  await expect(panel.locator(".literary-news__item-footer a")).toHaveAttribute("href", "https://example.org/first");
  await page.evaluate(() => { window.location.hash = "about"; });
  // R08 moves the same editorial card out of news details into the discussion.
  await expect(page).toHaveURL(/#about$/u);
  await expect(page.locator("#about")).toHaveCount(1);
  await expect(page.locator("#reader-discussion > .journal-engagement > #about.editorial-standard")).toBeVisible();
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

test("the existing panel browses the full archive in place and retains reading controls", async ({ page }) => {
  const items = Array.from({ length: 54 }, (_, index) => ({ ...story(`story-${index}`),
    kind: "news", publishedAt: "2026-09-04", eventDate: "2026-09-04" }));
  items.push({ ...story("past"), publishedAt: "2026-09-03", eventDate: "2026-09-03" });
  await page.route(endpoint, route => respondFeed(route, feed("America/Los_Angeles", items)));
  await page.goto("/#book-day", { waitUntil: "domcontentloaded" });
  const panel = page.locator("#literary-news"), cards = panel.locator(".literary-news__item");
  await expect(cards).toHaveCount(8, { timeout: 30_000 });
  await panel.getByRole("button", { name: "Все новости (55)", exact: true }).click();
  await expect(cards).toHaveCount(25);
  await panel.getByRole("button", { name: "Страница 3", exact: true }).click();
  await expect(cards).toHaveCount(5);
  await expect(cards.last()).toContainText("Завершённый анонс");
  await expect(cards.last().locator(".literary-news__event-date")).toContainText("3 сент.");

  await expect(panel.getByRole("searchbox")).toBeVisible();
  await panel.getByRole("searchbox").focus();
  await expect(panel.getByRole("searchbox")).toBeFocused();
  await panel.getByRole("searchbox").fill("Тестовое событие story-53");
  await expect(cards).toHaveCount(1);
  await cards.getByRole("button", { name: /Сохранить новость/ }).click();
  await panel.getByRole("searchbox").fill("");
  await panel.getByRole("button", { name: /^Избранное/ }).click();
  await expect(cards).toHaveCount(1);
  await page.reload();
  await expect(cards).toHaveCount(8);
  await panel.getByRole("button", { name: /^Избранное/ }).click();
  await expect(cards).toHaveCount(1);
  await cards.getByRole("button", { name: /Отметить прочитанной/ }).click();
  await panel.getByRole("button", { name: "Непрочитанные", exact: true }).click();
  await expect(cards).toHaveCount(0);
  await panel.getByRole("button", { name: "Сбросить фильтры", exact: true }).click();
  await panel.locator(".literary-news__refine-toggle").click();
  await panel.getByRole("combobox", { name: "Издание", exact: true }).selectOption("https://example.org");
  await panel.getByLabel("Публикация с", { exact: true }).fill("2026-09-04");
  await panel.getByLabel("Публикация по", { exact: true }).fill("2026-09-03");
  await expect(cards).toHaveCount(0);
  await expect(panel.getByText("Начальная дата должна быть не позже конечной.")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
});
