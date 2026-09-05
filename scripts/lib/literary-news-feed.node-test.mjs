import assert from "node:assert/strict";
import { test } from "node:test";
import { createNewsService } from "./literary-news-feed.mjs";

const CURRENT = new Date("2026-09-05T12:00:00.000Z");
const SOURCE = {
  id: "publisher", name: "Example Publisher", url: "https://publisher.example/news/",
  language: "en", linkPattern: "^/news/[^/]+/?$",
};
const HTML = '<a href="/news/new-book?utm_source=news#top">A new book announced by its publisher</a>';
const RECORD = {
  id: "reviewed-book", kind: "news", category: "releases", eventDate: "2026-09-04",
  publishedAt: "2026-09-04", verifiedAt: "2026-09-05T10:00:00.000Z", verification: "confirmed",
  title: { ru: "Издатель анонсировал книгу", en: "Publisher announces a book" },
  summary: { ru: "Проверенное сообщение издателя.", en: "A reviewed publisher announcement." },
  source: { name: "Example Publisher", url: "https://publisher.example/news/new-book", language: "en" },
};

function response(html = HTML, init = {}) {
  return new Response(html, { headers: { "content-type": "text/html" }, ...init });
}

function service(t, options = {}) {
  const instance = createNewsService({
    sources: [SOURCE], readReviewed: () => [RECORD], now: () => CURRENT,
    fetchImpl: async () => response(), ...options,
  });
  t.after(() => instance.close());
  return instance;
}

test("first feed does not wait for discovery, while concurrent refreshes share a request", async (t) => {
  let finish;
  let requests = 0;
  const instance = service(t, {
    fetchImpl: () => { requests += 1; return new Promise((resolve) => { finish = resolve; }); },
  });
  const first = await instance.getFeed();
  assert.equal(first.sources[0].status, "pending");
  assert.equal(first.lastCheckedAt, null);
  assert.equal(first.items.length, 1);
  const a = instance.refresh();
  const b = instance.refresh();
  assert.equal(a, b);
  assert.equal(requests, 1);
  finish(response());
  await a;
  const feed = await instance.getFeed();
  assert.equal(feed.sources[0].status, "ok");
  assert.equal(feed.lastCheckedAt, CURRENT.toISOString());
  assert.equal(feed.refreshIntervalSeconds, 600);
  assert.equal(feed.pendingCount, 1);
  assert.equal(feed.items.length, 1);
  assert.deepEqual(instance.getReviewQueue()[0].reasons, ["missing_event_date", "bilingual_review_required", "topic_review_required"]);
});

test("review gates exclude incomplete, impossible, future and duplicate public records", async (t) => {
  const invalid = [
    { verification: "held" },
    { title: { ru: "Только русский" } },
    { summary: { ru: "Русский", en: "  " } },
    { eventDate: "2026-02-30" },
    { eventDate: "2026-09-06" },
    { verifiedAt: "2026-09-06T01:00:00Z" },
    { verifiedAt: "2026-02-30T01:00:00Z" },
    { verifiedAt: "2026-09-01" },
    { publishedAt: "2026-09-06" },
    { publishedAt: "2026-09-05T13:00:00Z" },
    { publishedAt: "2026-02-30" },
    { source: { ...RECORD.source, url: "javascript:alert(1)" } },
    { source: { ...RECORD.source, url: "https://user:password@publisher.example/news/book" } },
    { category: "unsupported" },
  ];
  const instance = service(t, {
    readReviewed: () => [
      RECORD,
      ...invalid.map((overrides, index) => ({
        ...RECORD,
        id: `invalid-${index}`,
        source: { ...RECORD.source, url: `https://publisher.example/news/invalid-${index}` },
        ...overrides,
      })),
      { ...RECORD, id: "url-duplicate", source: { ...RECORD.source, url: `${RECORD.source.url}?utm_medium=mail#article` } },
      { ...RECORD, source: { ...RECORD.source, url: "https://publisher.example/news/other" } },
      { ...RECORD, id: "calendar", kind: "calendar", category: "anniversaries", eventDate: "2026-09-09", publishedAt: null },
      { ...RECORD, id: "announcement", kind: "announcement", eventDate: "2026-09-10", publishedAt: null },
    ],
  });
  assert.deepEqual((await instance.getFeed()).items.map((item) => item.id), ["reviewed-book", "calendar", "announcement"]);
});

test("news day and date-only publication use Moscow midnight", async (t) => {
  const instance = service(t, {
    now: () => new Date("2026-09-04T22:00:00Z"),
    readReviewed: () => [{ ...RECORD, eventDate: "2026-09-05", publishedAt: "2026-09-05", verifiedAt: "2026-09-04T20:00:00Z" }],
  });
  assert.equal((await instance.getFeed("Europe/Moscow")).items.length, 1);
});

test("announcements expire at Moscow date rollover until reviewed for the event day", async (t) => {
  let current = new Date("2026-09-05T20:59:59Z");
  let reviewedAt = "2026-09-05T12:00:00Z";
  const instance = service(t, {
    now: () => current,
    readReviewed: () => [{
      ...RECORD, kind: "announcement", eventDate: "2026-09-06", verifiedAt: reviewedAt,
    }],
  });
  assert.equal((await instance.getFeed("Europe/Moscow")).items.length, 1);
  current = new Date("2026-09-05T21:00:00Z");
  assert.equal((await instance.getFeed("Europe/Moscow")).items.length, 0);
  reviewedAt = "2026-09-05T21:00:00Z";
  assert.equal((await instance.getFeed("Europe/Moscow")).items.length, 1);
  current = new Date("2026-09-06T21:00:00Z");
  reviewedAt = "2026-09-06T21:00:00Z";
  assert.equal((await instance.getFeed("Europe/Moscow")).items.length, 0);
});

test("the same instant ranks local days and expires announcements differently in Los Angeles and Tokyo", async (t) => {
  const make = (id, kind, eventDate, verifiedAt = "2026-09-04T20:00:00Z") => ({
    ...RECORD, id, kind, eventDate, verifiedAt,
    source: { ...RECORD.source, url: `https://publisher.example/news/${id}` },
  });
  let requests = 0;
  const instance = service(t, {
    now: () => new Date("2026-09-05T00:30:00Z"),
    fetchImpl: async () => { requests += 1; return response(); },
    readReviewed: () => [
      make("calendar-sep4", "calendar", "2026-09-04"),
      make("calendar-sep5", "calendar", "2026-09-05"),
      make("news-sep4", "news", "2026-09-04"),
      make("news-sep5", "news", "2026-09-05"),
      make("announcement-sep4", "announcement", "2026-09-04"),
      make("announcement-sep5-stale", "announcement", "2026-09-05", "2026-09-04T14:00:00Z"),
      make("announcement-sep5-fresh", "announcement", "2026-09-05"),
      make("calendar-sep6", "calendar", "2026-09-06"),
    ],
  });
  await instance.refresh();
  const [losAngeles, tokyo] = await Promise.all([
    instance.getFeed("America/Los_Angeles"), instance.getFeed("Asia/Tokyo"),
  ]);
  assert.equal(losAngeles.timeZone, "America/Los_Angeles");
  assert.equal(tokyo.timeZone, "Asia/Tokyo");
  assert.deepEqual(losAngeles.items.map((item) => item.id), [
    "announcement-sep4", "calendar-sep4", "news-sep4", "announcement-sep5-fresh",
    "announcement-sep5-stale", "calendar-sep5", "calendar-sep6",
  ]);
  assert.deepEqual(tokyo.items.map((item) => item.id), [
    "announcement-sep5-fresh", "calendar-sep5", "news-sep5", "news-sep4",
    "calendar-sep6", "calendar-sep4",
  ]);
  assert.equal(requests, 1, "time zone requests share one discovery fetch and cache");
  assert.deepEqual(losAngeles.sources, tokyo.sources);
  assert.equal(losAngeles.pendingCount, tokyo.pendingCount);
});

test("missing or invalid IANA zones use UTC and valid aliases resolve to the effective zone", async (t) => {
  const instance = service(t, {
    now: () => new Date("2026-09-04T22:00:00Z"),
    readReviewed: () => [{ ...RECORD, eventDate: "2026-09-05", verifiedAt: "2026-09-04T20:00:00Z" }],
  });
  for (const zone of [undefined, null, "", "Mars/Olympus_Mons", "+03:00", "x".repeat(101)]) {
    const actual = await instance.getFeed(zone);
    assert.equal(actual.timeZone, "UTC");
    assert.deepEqual(actual.items, []);
  }
  assert.equal((await instance.getFeed("US/Pacific")).timeZone, "America/Los_Angeles");
  assert.equal((await instance.getFeed("Europe/Moscow")).items.length, 1);
});

test("malformed reviewed data raises an error instead of resembling a valid empty feed", async (t) => {
  const instance = service(t, { readReviewed: () => ({ unexpected: [] }) });
  await assert.rejects(instance.getFeed(), /reviewed_data_invalid/);
});

test("newly appended news outranks examples with deterministic date ranking and no input mutation", async (t) => {
  const make = (id, kind, eventDate) => ({
    ...RECORD, id, kind, eventDate,
    source: { ...RECORD.source, url: `https://publisher.example/news/${id}` },
  });
  const records = [
    make("future-later", "calendar", "2026-09-09"),
    make("old-news", "news", "2026-08-01"),
    make("recent-earlier", "news", "2026-08-24"),
    make("future-sooner", "announcement", "2026-09-06"),
    make("yesterday", "news", "2026-09-04"),
    make("past-calendar", "calendar", "2026-08-20"),
    make("today-z", "news", "2026-09-05"),
    make("today-a", "news", "2026-09-05"),
  ];
  const original = structuredClone(records);
  const instance = service(t, { readReviewed: () => records });
  assert.deepEqual((await instance.getFeed()).items.map((item) => item.id), [
    "today-a", "today-z", "yesterday", "recent-earlier", "future-sooner", "future-later",
    "past-calendar", "old-news",
  ]);
  assert.deepEqual(records, original);
});

test("discovery accepts only source article paths and deduplicates tracking links", async (t) => {
  const instance = service(t, {
    readReviewed: () => [],
    fetchImpl: async (_url, options) => {
      assert.equal(options.redirect, "manual");
      return response(`${HTML}
        <a href="/news/new-book?utm_medium=mail#other">Duplicate book announcement</a>
        <a href="https://elsewhere.example/news/untrusted">Another news source article</a>
        <a href="http://publisher.example/news/insecure">An insecure article source</a>
        <a href="https://publisher.example:8443/news/other-port">Unexpected alternate origin</a>
        <a href="/about">Information about this publisher</a>
        <a href="/news/short">More</a>
        <a href="/news/encoded-image">&lt;img src="sample.jpg" alt="Article image"&gt;</a>`);
    },
  });
  await instance.refresh();
  const feed = await instance.getFeed();
  assert.equal(feed.pendingCount, 1);
  assert.deepEqual(feed.items, []);
  assert.equal(instance.getReviewQueue()[0].source.url, RECORD.source.url);
  const copy = instance.getReviewQueue();
  copy[0].verification = "confirmed";
  assert.equal(instance.getReviewQueue()[0].verification, "held");
});

test("source failure preserves candidates and last success without claiming a fresh success", async (t) => {
  let current = CURRENT;
  let fail = false;
  const instance = service(t, {
    now: () => current,
    fetchImpl: async () => {
      if (fail) throw new Error("Secret token or arbitrary upstream error");
      return response();
    },
  });
  await instance.refresh();
  current = new Date("2026-09-05T12:10:00.000Z");
  fail = true;
  await instance.refresh();
  const feed = await instance.getFeed();
  assert.equal(feed.sources[0].status, "error");
  assert.equal(feed.sources[0].error, "fetch_failed");
  assert.equal(feed.sources[0].lastSuccessAt, CURRENT.toISOString());
  assert.equal(feed.lastCheckedAt, current.toISOString());
  assert.equal(feed.pendingCount, 1);
  assert.equal(feed.items.length, 1);
});

test("an empty page is an error and cannot advance source success", async (t) => {
  const instance = service(t, { fetchImpl: async () => response("<p>No relevant articles</p>") });
  await instance.refresh();
  const feed = await instance.getFeed();
  assert.equal(feed.sources[0].status, "error");
  assert.equal(feed.sources[0].error, "no_article_links");
  assert.equal(feed.sources[0].lastSuccessAt, null);
});

test("discovery queue is bounded to 100 articles per source", async (t) => {
  const html = Array.from({ length: 120 }, (_, i) => `<a href="/news/article-${i}">A detailed headline for article ${i}</a>`).join("");
  const instance = service(t, { fetchImpl: async () => response(html) });
  await instance.refresh();
  assert.equal((await instance.getFeed()).pendingCount, 100);
});

test("timeouts complete refresh and abort a hanging fetch", async (t) => {
  let signal;
  const instance = service(t, {
    timeoutMs: 15,
    fetchImpl: (_url, options) => { signal = options.signal; return new Promise(() => {}); },
  });
  await instance.refresh();
  assert.equal(signal.aborted, true);
  assert.equal((await instance.getFeed()).sources[0].error, "request_timeout");
});

test("oversized streamed bodies, incompatible content and redirects fail closed", async (t) => {
  for (const [fixture, code] of [
    [() => response("x".repeat(256)), "response_too_large"],
    [() => response("small", { headers: { "content-length": "1000", "content-type": "text/html" } }), "response_too_large"],
    [() => response("{}", { headers: { "content-type": "application/json" } }), "unsupported_content_type"],
    [() => response("", { status: 302, headers: { location: "https://elsewhere.example" } }), "redirect_not_allowed"],
    [() => response("", { status: 403 }), "http_403"],
  ]) {
    const instance = service(t, { maxResponseBytes: 128, fetchImpl: async () => fixture() });
    await instance.refresh();
    assert.equal((await instance.getFeed()).sources[0].error, code);
    instance.close();
  }
});

test("close aborts outstanding work and disables further refreshes", async (t) => {
  let requests = 0;
  let signal;
  const instance = service(t, {
    fetchImpl: (_url, options) => {
      requests += 1;
      signal = options.signal;
      return new Promise((_, reject) => signal.addEventListener("abort", () => reject(new Error("aborted"))));
    },
  });
  instance.close();
  await instance.refresh();
  assert.equal(signal.aborted, true);
  assert.equal(requests, 1);
});

test("RSS candidates preserve source publication dates and plain summaries while event dates remain unverified", async (t) => {
  const rss = `<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0"><channel><title>Publisher news</title>
      <item><title><![CDATA[<b>Nuevo libro &amp; lectura</b>]]></title>
        <link>https://publisher.example/news/new-book?utm_source=rss#title</link>
        <pubDate>Fri, 04 Sep 2026 10:30:00 GMT</pubDate>
        <description><![CDATA[<p>El <strong>nuevo</strong> libro.</p><script>unsafe()</script>]]></description>
      </item>
      <item><title>Duplicate book announcement</title><link>https://publisher.example/news/new-book</link></item>
      <item><title>Una fecha de publicación imposible</title><link>https://publisher.example/news/bad-date</link><pubDate>Mon, 30 Feb 2026 10:30:00 GMT</pubDate></item>
      <item><title>External unapproved article</title><link>https://elsewhere.example/news/article</link></item>
      <item><title>Insecure article must remain rejected</title><link>http://publisher.example/news/article</link></item>
    </channel></rss>`;
  const instance = service(t, {
    sources: [{
      ...SOURCE, url: "https://feeds.example/literature.xml", format: "rss", language: "es",
      region: "latin-america", topics: ["releases", "festivals"], articleOrigins: ["https://publisher.example"],
    }],
    readReviewed: () => [],
    fetchImpl: async () => response(rss, { headers: { "content-type": "application/rss+xml; charset=UTF-8" } }),
  });
  await instance.refresh();
  const feed = await instance.getFeed();
  const queue = instance.getReviewQueue();
  assert.equal(queue.length, 2);
  assert.equal(queue[0].title, "Nuevo libro & lectura");
  assert.equal(queue[0].description, "El nuevo libro.");
  assert.equal(queue[0].publishedAt, "2026-09-04T10:30:00.000Z");
  assert.equal(queue[1].publishedAt, null);
  assert.equal(queue[0].source.language, "es");
  assert.equal(queue[0].region, "latin-america");
  assert.equal(Object.hasOwn(queue[0], "eventDate"), false);
  assert.equal(queue[0].verification, "held");
  assert.ok(queue[0].reasons.includes("missing_event_date"));
  assert.deepEqual(feed.items, []);
  assert.equal(feed.sources[0].language, "es");
  assert.equal(feed.sources[0].region, "latin-america");
  assert.deepEqual(feed.sources[0].topics, ["releases", "festivals"]);
  feed.sources[0].topics.push("awards");
  assert.deepEqual((await instance.getFeed()).sources[0].topics, ["releases", "festivals"]);
});

test("Atom uses alternate article links and published dates, never modified dates or non-article links", async (t) => {
  const atom = `<atom:feed xmlns:atom="http://www.w3.org/2005/Atom">
    <atom:entry><atom:title>新刊のお知らせ</atom:title>
      <atom:link rel="self" href="https://publisher.example/api/entry" />
      <atom:link rel="alternate" type="text/html" href="https://publisher.example/news/japanese-book" />
      <atom:published>2026-09-04T18:30:00+09:00</atom:published><atom:updated>2026-09-05T01:00:00Z</atom:updated>
      <atom:summary type="html">&lt;p&gt;新しい&lt;b&gt;本&lt;/b&gt;です。&lt;/p&gt;</atom:summary>
    </atom:entry>
    <atom:entry><atom:title>Only a modified date</atom:title>
      <atom:link href="https://publisher.example/news/modified" />
      <atom:updated>2026-09-05T01:00:00Z</atom:updated>
    </atom:entry>
    <atom:entry><atom:title>Not an article link</atom:title>
      <atom:link rel="enclosure" href="https://publisher.example/news/audio.mp3" />
    </atom:entry>
  </atom:feed>`;
  const instance = service(t, {
    sources: [{ ...SOURCE, format: "atom", language: "ja", region: "asia", linkPattern: undefined }],
    fetchImpl: async () => response(atom, { headers: { "content-type": "application/atom+xml" } }),
  });
  await instance.refresh();
  const queue = instance.getReviewQueue();
  assert.equal(queue.length, 2);
  assert.equal(queue[0].title, "新刊のお知らせ");
  assert.equal(queue[0].publishedAt, "2026-09-04T09:30:00.000Z");
  assert.equal(queue[0].description, "新しい本です。");
  assert.equal(queue[1].publishedAt, null);
  assert.ok(queue.every((item) => item.verification === "held" && !Object.hasOwn(item, "eventDate")));
});

test("feed collection rejects unexpected documents and unsafe configured article origins", async (t) => {
  const instance = service(t, {
    sources: [{ ...SOURCE, format: "rss" }],
    fetchImpl: async () => response("<html><body>A challenge page</body></html>", { headers: { "content-type": "application/xml" } }),
  });
  await instance.refresh();
  assert.equal((await instance.getFeed()).sources[0].error, "unexpected_feed_format");
  assert.deepEqual(instance.getReviewQueue(), []);
  assert.throws(() => createNewsService({
    sources: [{ ...SOURCE, articleOrigins: ["http://publisher.example"] }], readReviewed: () => [],
  }), /Invalid news article origin/);
  assert.throws(() => createNewsService({
    sources: [{ ...SOURCE, region: "invented-region" }], readReviewed: () => [],
  }), /Invalid news source configuration/);
});

test("reviewed records accept world source languages and regions and deduplicate only explicitly shared events", async (t) => {
  const make = (id, language, region, eventKey) => ({
    ...RECORD, id, region, ...(eventKey ? { eventKey } : {}),
    source: { ...RECORD.source, language, url: `https://publisher.example/news/${id}` },
  });
  const instance = service(t, {
    readReviewed: () => [
      make("a-fr", "fr", "europe", "official-prize-2026"),
      make("b-same-event", "de", "europe", "official-prize-2026"),
      make("c-similar-title", "es", "latin-america"),
      make("d-pt", "pt-BR", "latin-america"),
      make("e-ja", "ja", "asia"),
      make("f-ko", "ko", "asia"),
      make("g-ar", "ar", "africa"),
      make("h-bad-language", "english!", "global"),
      make("i-bad-region", "en", "unknown"),
    ],
  });
  const feed = await instance.getFeed();
  assert.deepEqual(feed.items.map((item) => item.id), ["a-fr", "c-similar-title", "d-pt", "e-ja", "f-ko", "g-ar"]);
  assert.equal(feed.items[0].eventKey, "official-prize-2026");
});

test("identical canonical article URLs from separate sources appear once in the review queue", async (t) => {
  const rss = `<rss version="2.0"><channel><item><title>A shared book announcement</title>
    <link>https://publisher.example/news/shared?utm_source=feed</link></item></channel></rss>`;
  const instance = service(t, {
    sources: ["first", "second"].map((id) => ({
      ...SOURCE, id, format: "rss", url: `https://publisher.example/feed/${id}`,
    })),
    fetchImpl: async () => response(rss, { headers: { "content-type": "text/xml" } }),
  });
  await instance.refresh();
  assert.equal(instance.getReviewQueue().length, 1);
  assert.equal((await instance.getFeed()).pendingCount, 1);
});

test("a maximum of four concurrent fetches covers all sources even when one fails", { timeout: 2000 }, async (t) => {
  let active = 0;
  let maximum = 0;
  let started = 0;
  let completed = 0;
  let pending = [];
  const instance = service(t, {
    sources: Array.from({ length: 11 }, (_, index) => ({ ...SOURCE, id: `source-${index}`, url: `https://publisher.example/feed-${index}` })),
    fetchImpl: (url) => new Promise((resolve, reject) => {
      active += 1;
      started += 1;
      maximum = Math.max(maximum, active);
      pending.push(() => {
        active -= 1;
        completed += 1;
        if (url.endsWith("feed-5")) reject(new Error("Upstream unavailable"));
        else resolve(response());
      });
    }),
  });
  assert.equal(started, 4);
  const refreshing = instance.refresh();
  while (completed < 11) {
    const batch = pending;
    pending = [];
    for (const complete of batch) complete();
    await new Promise((resolve) => setImmediate(resolve));
  }
  await refreshing;
  assert.equal(maximum, 4);
  assert.equal(started, 11);
  const feed = await instance.getFeed();
  assert.equal(feed.sources.filter((source) => source.status === "ok").length, 10);
  assert.equal(feed.sources.find((source) => source.id === "source-5").error, "fetch_failed");
});

test("closing stops queued sources and completes active refresh even when a fetch ignores abort", { timeout: 2000 }, async (t) => {
  const signals = [];
  const instance = service(t, {
    sources: Array.from({ length: 9 }, (_, index) => ({ ...SOURCE, id: `source-${index}` })),
    fetchImpl: (_url, options) => { signals.push(options.signal); return new Promise(() => {}); },
  });
  const refreshing = instance.refresh();
  instance.close();
  await refreshing;
  assert.equal(signals.length, 4);
  assert.ok(signals.every((signal) => signal.aborted));
});

test("HTML icon links use their enclosing event heading without borrowing nearby headings", async (t) => {
  const instance = service(t, {
    fetchImpl: async () => response(`<h2 class="event">Authors and Global Stories
      <a href="/news/hay-event"><svg aria-hidden="true"></svg></a></h2>
      <h2>Unrelated event heading</h2><a href="/news/outside-heading">More</a>`),
  });
  await instance.refresh();
  const queue = instance.getReviewQueue();
  assert.equal(queue.length, 1);
  assert.equal(queue[0].title, "Authors and Global Stories");
  assert.equal(queue[0].source.url, "https://publisher.example/news/hay-event");
});

test("configured HTML card titles remain inside each link's own article container and keep its own URL", async (t) => {
  const instance = service(t, {
    sources: [{ ...SOURCE, articleContainer: ".card-item", titleSelector: "h3.title" }],
    fetchImpl: async () => response(`<div class="card-item">
      <h3 class="title"><a href="/info/overview">First international book fair</a></h3>
      <a class="read-more" href="/news/first-fair">Read More</a></div>
      <div class="card-item"><h3 class="title">Second international book fair</h3>
      <a class="read-more" href="/news/second-fair">Read More</a></div>
      <a class="read-more" href="/news/outside-card">Read More</a>`),
  });
  await instance.refresh();
  assert.deepEqual(instance.getReviewQueue().map((item) => ({ title: item.title, url: item.source.url })), [
    { title: "First international book fair", url: "https://publisher.example/news/first-fair" },
    { title: "Second international book fair", url: "https://publisher.example/news/second-fair" },
  ]);
});
