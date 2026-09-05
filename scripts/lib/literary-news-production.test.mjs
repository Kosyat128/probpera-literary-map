import { afterEach, describe, expect, it, vi } from "vitest";
import reviewed from "../../data/news/reviewed.json" with { type: "json" };
import { parseNewsFeed } from "../../src/news/feed.ts";
import worker, { handleNewsRequest } from "../workers/literary-news-worker.mjs";
import { buildNewsIngestion } from "./literary-news-ingestion.mjs";
import { selectReviewed } from "./literary-news-reviewed.mjs";
import { LITERARY_NEWS_SOURCES } from "./literary-news-sources.mjs";
import { NEWS_HELD_QUEUE_KEY, NEWS_SOURCE_STATE_KEY, NEWS_STATE_MAX_BYTES, parseNewsSourceState, pendingNewsSourceState } from "./literary-news-state.mjs";

const CURRENT = new Date("2026-09-05T12:00:00Z");
const EARLIER = "2026-09-05T10:00:00.000Z";
const SHA = "a".repeat(40);
const request = (suffix = "", method = "GET") => new Request(`https://news.probpera.ru/api/literary-news/feed${suffix}`, { method });
const stateStream = (value) => new Response(JSON.stringify(value)).body;
function environment(value = null) {
  return { NEWS_RELEASE_SHA: SHA, NEWS_STATE: { get: vi.fn(async () => value === null ? null : stateStream(value)) } };
}
const SOURCES = [
  { id: "one", name: "Publisher one", url: "https://one.example/news/", language: "en", linkPattern: /^\/news\/[^/]+$/ },
  { id: "two", name: "Publisher two", url: "https://two.example/news/", language: "fr", region: "europe", linkPattern: /^\/news\/[^/]+$/ },
];
const candidate = (source = SOURCES[0], slug = "book") => ({
  sourceId: source.id, source: { name: source.name, language: source.language, url: `${source.url}${slug}` },
  title: "A new literary publication", description: "Source description.", publishedAt: "2026-09-04",
  discoveredAt: EARLIER, verification: "held", reasons: ["missing_event_date"],
});
function attempt() {
  return {
    lastCheckedAt: CURRENT.toISOString(),
    sources: SOURCES.map((source) => ({ ...source, status: "ok", lastSuccessAt: CURRENT.toISOString(), candidateCount: 1 })),
  };
}

afterEach(() => vi.restoreAllMocks());

describe("public literary news Worker", () => {
  it.each([undefined, "https://probpera.ru", "https://www.probpera.ru", "https://untrusted.example", "https://probpera.ru.untrusted.example", "null"])("keeps public cross-origin reading restricted to the canonical site (%s)", async (origin) => {
    const headers = { Accept: "application/json", ...(origin ? { Origin: origin } : {}) };
    const response = await handleNewsRequest(new Request("https://news.probpera.ru/api/literary-news/feed?timeZone=UTC", {
      headers, mode: "cors", credentials: "omit", cache: "no-store",
    }), environment(), CURRENT);
    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("https://probpera.ru");
    expect(response.headers.get("access-control-allow-credentials")).toBeNull();
    expect(response.headers.get("access-control-expose-headers")).toBe("X-Probpera-News-Release");
    expect(response.headers.get("x-probpera-news-release")).toBe(SHA);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(parseNewsFeed(await response.json()).mode).toBe("reviewed");
  });

  it("does not grant preflight access to extra methods or caller-supplied headers", async () => {
    const env = environment();
    const response = await handleNewsRequest(new Request("https://news.probpera.ru/api/literary-news/feed", {
      method: "OPTIONS",
      headers: { Origin: "https://probpera.ru", "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "Authorization" },
    }), env, CURRENT);
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET");
    expect(response.headers.get("access-control-allow-methods")).toBeNull();
    expect(response.headers.get("access-control-allow-headers")).toBeNull();
    expect(response.headers.get("access-control-allow-credentials")).toBeNull();
    expect(env.NEWS_STATE.get).not.toHaveBeenCalled();
  });

  it("all checked-in reviewed stories and every public response satisfy the complete frontend schema", async () => {
    for (const zone of ["UTC", "America/Los_Angeles", "Asia/Tokyo"]) {
      const feed = await (await handleNewsRequest(request(`?timeZone=${encodeURIComponent(zone)}`), environment(), CURRENT)).json();
      expect(() => parseNewsFeed(feed)).not.toThrow();
      // Validate authored records too, including future/expired announcements that
      // the publication gate deliberately omits from today's public response.
      expect(() => parseNewsFeed({ ...feed, items: reviewed })).not.toThrow();
    }
  });

  it("the pure gate rejects oversized fields that would invalidate the entire frontend feed", () => {
    const record = {
      ...reviewed.find((item) => item.kind === "news"),
      eventDate: "2026-09-04", publishedAt: null, verifiedAt: EARLIER,
    };
    expect(selectReviewed([record], CURRENT, "UTC")).toHaveLength(1);
    for (const overrides of [
      { id: "x".repeat(121) },
      { title: { ...record.title, en: "x".repeat(1001) } },
      { summary: { ...record.summary, ru: "x".repeat(1001) } },
      { source: { ...record.source, name: "x".repeat(161) } },
      { source: { ...record.source, url: `https://source.example/${"x".repeat(2048)}` } },
    ]) expect(selectReviewed([{ ...record, ...overrides }], CURRENT, "UTC")).toEqual([]);
  });

  it("serves reviewed stories, fixed code-owned sources and only reads the status key", async () => {
    const state = pendingNewsSourceState();
    state.lastCheckedAt = EARLIER;
    state.pendingCount = 2;
    state.sources[0] = { ...state.sources[0], status: "ok", lastSuccessAt: EARLIER, candidateCount: 2,
      name: "Untrusted replacement", url: "https://untrusted.example/" };
    state.items = [{ verification: "confirmed", title: "UNREVIEWED_PAYLOAD" }];
    state.privateQueue = "PRIVATE_CATALOG";
    const env = environment(state);
    const response = await handleNewsRequest(request("?timeZone=Asia/Tokyo&key=editorial-catalog.json"), env, CURRENT);
    const feed = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get("x-probpera-news-release")).toBe(SHA);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(env.NEWS_STATE.get).toHaveBeenCalledExactlyOnceWith(NEWS_SOURCE_STATE_KEY, "stream");
    expect(feed).toMatchObject({ mode: "reviewed", timeZone: "Asia/Tokyo", lastCheckedAt: EARLIER, pendingCount: 2 });
    expect(feed.items.length).toBeGreaterThan(0);
    expect(feed.items.every((item) => item.verification === "confirmed" && item.title.ru && item.title.en)).toBe(true);
    expect(feed.sources[0].url).toBe(LITERARY_NEWS_SOURCES[0].url);
    expect(JSON.stringify(feed)).not.toMatch(/PRIVATE_CATALOG|UNREVIEWED_PAYLOAD|Untrusted replacement/);
  });

  it.each([null, "malformed", { ...pendingNewsSourceState(), lastCheckedAt: "2035-01-01T00:00:00Z" }])("keeps honest pending status for absent or invalid KV (%j)", async (stored) => {
    const response = await handleNewsRequest(request("?timeZone=Invalid/Zone"), environment(stored), CURRENT);
    const feed = await response.json();
    expect(feed.timeZone).toBe("UTC");
    expect(feed.lastCheckedAt).toBeNull();
    expect(feed.sources.every((source) => source.status === "pending" && source.lastSuccessAt === null)).toBe(true);
    expect(feed.items.length).toBeGreaterThan(0);
  });

  it("bounds and cancels oversized status reads without exposing private data", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const cancel = vi.fn();
    const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(NEWS_STATE_MAX_BYTES + 1)); }, cancel });
    const env = { NEWS_STATE: { get: async () => stream } };
    const feed = await (await handleNewsRequest(request(), env, CURRENT)).json();
    expect(cancel).toHaveBeenCalledOnce();
    expect(feed.lastCheckedAt).toBeNull();
    expect(feed.items.length).toBeGreaterThan(0);
  });

  it("falls back on KV failure and does not publish raw errors", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const env = { NEWS_STATE: { get: async () => { throw new Error("secret-token"); } } };
    const response = await handleNewsRequest(request(), env, CURRENT);
    const feed = await response.json();
    expect(feed.lastCheckedAt).toBeNull();
    expect(JSON.stringify(feed)).not.toContain("secret-token");
    expect(warning.mock.calls.flat().join(" ")).not.toContain("secret-token");
  });

  it("rejects writes and all queue paths before accessing KV", async () => {
    const env = environment();
    const write = await handleNewsRequest(request("", "POST"), env, CURRENT);
    expect(write.status).toBe(405);
    expect(write.headers.get("allow")).toBe("GET");
    const hidden = await handleNewsRequest(new Request("https://news.probpera.ru/api/literary-news/held-queue", { headers: { Origin: "https://probpera.ru" } }), env, CURRENT);
    expect(hidden.status).toBe(404);
    expect(await hidden.json()).toEqual({ error: "not_found" });
    for (const response of [write, hidden]) {
      expect(response.headers.get("access-control-allow-origin")).toBe("https://probpera.ru");
      expect(response.headers.get("access-control-allow-credentials")).toBeNull();
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("x-probpera-news-release")).toBe(SHA);
    }
    expect(env.NEWS_STATE.get).not.toHaveBeenCalled();
  });

  it("the real fetch entry accepts a Workers execution context", async () => {
    const response = await worker.fetch(request(), environment(), { waitUntil() {} });
    expect(response.status).toBe(200);
    expect((await response.json()).mode).toBe("reviewed");
  });
});

describe("persistent held discovery", () => {
  it("retains failed-source candidates and success timestamps across process restarts", () => {
    const before = buildNewsIngestion({ feed: attempt(), candidates: SOURCES.map((source) => candidate(source)), sources: SOURCES, current: CURRENT });
    const later = new Date("2026-09-05T12:30:00Z");
    const feed = attempt();
    feed.lastCheckedAt = later.toISOString();
    feed.sources[0].lastSuccessAt = later.toISOString();
    feed.sources[1] = { ...feed.sources[1], status: "error", lastSuccessAt: null, candidateCount: 0, error: "http_403" };
    const previousCopy = structuredClone(before);
    const result = buildNewsIngestion({
      feed, candidates: [{ ...candidate(), title: "The updated original title", discoveredAt: later.toISOString() }, candidate(SOURCES[0], "second")],
      previousState: before.state, previousQueue: before.queue, sources: SOURCES, current: later,
    });
    expect(result.state.sources[1]).toMatchObject({ status: "error", error: "http_403", lastSuccessAt: CURRENT.toISOString(), candidateCount: 1 });
    expect(result.queue.items.find((item) => item.sourceId === "one" && item.source.url.endsWith("/book"))).toMatchObject({ title: "The updated original title", discoveredAt: EARLIER });
    expect(result.queue.items.find((item) => item.sourceId === "two")).toEqual(before.queue.items[1]);
    expect(result.state.pendingCount).toBe(3);
    expect(result.queue.lastCheckedAt).toBe(result.state.lastCheckedAt);
    expect(before).toEqual(previousCopy);
    expect(result.bulk.map((entry) => entry.key)).toEqual([NEWS_SOURCE_STATE_KEY, NEWS_HELD_QUEUE_KEY]);
    expect(result.queue.items.every((item) => item.verification === "held" && !Object.hasOwn(item, "eventDate"))).toBe(true);
  });

  it("keeps prior unseen items on successful polls and deduplicates canonical URLs", () => {
    const before = buildNewsIngestion({ feed: attempt(), candidates: [candidate()], sources: SOURCES, current: CURRENT });
    const result = buildNewsIngestion({ feed: attempt(), candidates: [candidate(SOURCES[0], "next"), { ...candidate(SOURCES[0], "next"), source: { ...candidate().source, url: "https://one.example/news/next?utm_source=feed#top" } }], previousState: before.state, previousQueue: before.queue, sources: SOURCES, current: CURRENT });
    expect(result.queue.items.map((item) => item.source.url)).toEqual(["https://one.example/news/next", "https://one.example/news/book"]);
  });

  it("rejects incomplete/corrupt prior snapshots instead of preparing destructive replacement", () => {
    const args = { feed: attempt(), candidates: [], sources: SOURCES, current: CURRENT };
    expect(() => buildNewsIngestion({ ...args, previousState: {} })).toThrow("previous_snapshot_incomplete");
    expect(() => buildNewsIngestion({ ...args, previousState: {}, previousQueue: {} })).toThrow("previous_state_invalid");
    const before = buildNewsIngestion(args);
    expect(() => buildNewsIngestion({ ...args, previousState: before.state, previousQueue: { ...before.queue, verification: "confirmed" } })).toThrow("previous_queue_invalid");
  });

  it("never imports confirmed, arbitrary-origin or HTML candidates into the held snapshot", () => {
    const item = candidate();
    const result = buildNewsIngestion({ feed: attempt(), sources: SOURCES, current: CURRENT, candidates: [
      item, { ...item, verification: "confirmed" }, { ...item, title: "<script>bad</script>" },
      { ...item, source: { ...item.source, url: "https://127.0.0.1/news/private" } },
    ] });
    expect(result.queue.items).toHaveLength(1);
    expect(result.queue.items[0].reasons).toContain("bilingual_review_required");
    expect(result.queue.items[0].publishedAt).toBe("2026-09-04");
    expect(selectReviewed(result.queue.items, CURRENT, "UTC")).toEqual([]);
    expect(parseNewsSourceState(result.state, CURRENT, SOURCES)).not.toBeNull();
  });
});
