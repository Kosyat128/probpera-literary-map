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

async function respondFeed(route, json, status = 200, headers = {}) {
  // The browser still enforces CORS on this intercepted cross-origin response.
  return route.fulfill({
    status, json: await json,
    headers: { "access-control-allow-origin": route.request().headers().origin, ...headers },
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

test("a transient busy reader retries automatically without requesting the fallback", async ({ page }) => {
  const requests = [];
  let fallbacks = 0;
  await page.route("**/literary-news-snapshot.json", route => {
    fallbacks++;
    return route.fulfill({ status: 503, json: { error: "unexpected_fallback" } });
  });
  await page.route(endpoint, route => {
    requests.push({ url: route.request().url(), at: Date.now() });
    return requests.length === 1
      ? respondFeed(route, { error: "snapshot_unavailable" }, 503, {
        "retry-after": "1", "access-control-expose-headers": "Retry-After",
      })
      : respondFeed(route, feed("America/Los_Angeles"));
  });
  await page.goto("/#book-day", { waitUntil: "domcontentloaded" });
  const panel = page.locator("#literary-news");
  await expect(panel.locator("article")).toHaveCount(1, { timeout: 30_000 });
  await expect(panel.locator(".literary-news__refresh")).toBeEnabled();
  expect(requests).toHaveLength(2);
  expect(requests[1].url).toBe(requests[0].url);
  // This measures real server-side receipt time, not the page's fixed Date.now.
  expect(requests[1].at - requests[0].at).toBeGreaterThanOrEqual(900);
  expect(fallbacks).toBe(0);
  await panel.locator(".literary-news__feed-details > summary").click();
  await expect(panel.locator(".literary-news__warning")).toHaveCount(0);
});

test("a persistently busy reader stops after three attempts and shows an honest fallback", async ({ page }) => {
  let attempts = 0, fallbacks = 0;
  const fallback = await buildPublishedNewsFeed({
    records: [story("retained")], current: new Date(instant), timeZone: "America/Los_Angeles",
    release: "a".repeat(40),
    state: { lastCheckedAt: instant, refreshIntervalSeconds: 600, sources: [], pendingCount: 0 },
  });
  await page.route("**/literary-news-snapshot.json", route => {
    fallbacks++;
    return route.fulfill({ json: fallback });
  });
  await page.route(endpoint, route => {
    attempts++;
    return respondFeed(route, { error: "snapshot_unavailable" }, 503, {
      "retry-after": "1", "access-control-expose-headers": "Retry-After",
    });
  });
  await page.goto("/#book-day", { waitUntil: "domcontentloaded" });
  const panel = page.locator("#literary-news");
  await expect(panel.locator("article")).toHaveCount(1, { timeout: 30_000 });
  await expect(panel.locator(".literary-news__headline")).toHaveText("Тестовое событие retained");
  await expect(panel.locator(".literary-news__refresh")).toBeEnabled();
  expect(attempts).toBe(3);
  expect(fallbacks).toBe(1);
  await panel.locator(".literary-news__feed-details > summary").click();
  await expect(panel.locator(".literary-news__warning")).toContainText("Архив временно недоступен");
  // Observe beyond the server's retry interval: no fourth attempt is scheduled.
  await page.waitForTimeout(1200);
  expect(attempts).toBe(3);
  expect(fallbacks).toBe(1);
});

test("unmounting the news panel aborts its pending retry and does not request a fallback", async ({ page }) => {
  let attempts = 0, fallbacks = 0;
  // The intentional render error must not be sent to the live diagnostics store.
  await page.route("**/rest/v1/rpc/submit_client_error", route => route.fulfill({
    status: 204,
    headers: { "access-control-allow-origin": "*", "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "*" },
  }));
  await page.addInitScript(() => {
    window.__newsRequestSignals = [];
    const nativeFetch = window.fetch;
    window.fetch = function (input, init) {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.startsWith("https://news.probpera.ru/api/literary-news/feed")) window.__newsRequestSignals.push(init.signal);
      return nativeFetch.call(this, input, init);
    };
  });
  await page.route("**/literary-news-snapshot.json", route => {
    fallbacks++;
    return route.fulfill({ status: 503, json: { error: "unexpected_fallback" } });
  });
  await page.route(endpoint, route => {
    attempts++;
    return respondFeed(route, { error: "snapshot_unavailable" }, 503, {
      "retry-after": "2", "access-control-expose-headers": "Retry-After",
    });
  });
  const busy = page.waitForResponse(response => response.url().startsWith("https://news.probpera.ru/api/literary-news/feed") && response.status() === 503);
  await page.goto("/#book-day", { waitUntil: "domcontentloaded" });
  await busy;
  const panel = page.locator("#literary-news");
  await expect(panel.getByRole("searchbox")).toBeVisible();
  // Exercise actual React cleanup through the production error boundary. Merely
  // navigating away would destroy timers even if the component forgot to abort.
  await page.evaluate(() => {
    Intl.DisplayNames = class { constructor() { throw new Error("test-only news unmount"); } };
    const input = document.querySelector("#literary-news input[type='search']");
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, "unmount");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await expect(panel).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__newsRequestSignals.length > 0 && window.__newsRequestSignals.every(signal => signal.aborted))).toBe(true);
  await page.waitForTimeout(2300);
  expect(attempts).toBe(1);
  expect(fallbacks).toBe(0);
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
