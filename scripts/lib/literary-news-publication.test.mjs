import { describe, expect, it } from "vitest";
import reviewed from "../../data/news/reviewed.json" with { type: "json" };
import { buildPublishedNewsFeed, verifyPublishedNewsSnapshot } from "./literary-news-publication.mjs";
import { selectReviewed } from "./literary-news-reviewed.mjs";
import { pendingNewsSourceState, parseNewsSourceState } from "./literary-news-state.mjs";
import { parseNewsFeed } from "../../src/news/feed.ts";
import { readNewsFeedResponse } from "../../src/news/transport.ts";
import { receiveNewsFeed, initialNewsUpdatesState, applyPendingNews } from "../../src/news/updates.ts";
import { handleNewsRequest } from "../workers/literary-news-worker.mjs";

const current = new Date("2026-09-26T12:00:00Z");
const release = "a".repeat(40);
const news = (index) => ({ ...reviewed.find((row) => row.kind === "news"), id: `boundary-${index}`,
  eventKey: `independent-event-${index}`, eventDate: "2026-09-01", verifiedAt: "2026-09-01T12:00:00Z", publishedAt: null });
const sources = (count) => Array.from({ length: count }, (_, index) => ({ id: `source-${index}`,
  name: `Source ${index}`, url: `https://source${index}.example/news`, language: "en", sourceFamilyId: `family-${index}`,
  countryCodes: ["GB"], coverageCountryCodes: ["IN"] }));
const feed = (count = 8, sourceCount = 101, options = {}) => buildPublishedNewsFeed({
  records: Array.from({ length: count }, (_, index) => news(index)),
  state: pendingNewsSourceState(sources(sourceCount)), current, release, ...options,
});

describe("complete public literary news generations", () => {
  it.each([50, 51, 100, 101, 250])("carries %i sources through state, public builder and actual browser parser", async (count) => {
    const state = pendingNewsSourceState(sources(count));
    expect(parseNewsSourceState(state, current, sources(count)).sources).toHaveLength(count);
    const actual = parseNewsFeed(await feed(8, count));
    expect(actual.sources).toHaveLength(count);
    expect(actual.sources[0].countryCodes).toEqual(["GB"]);
    expect(actual.sources[0].coverageCountryCodes).toEqual(["IN"]);
  });
  it.each([8, 500, 501, 1001])("keeps all %i independent public events, with no UI-sized truncation", async (count) => {
    const value = await feed(count);
    const parsed = await readNewsFeedResponse(Response.json(value));
    const state = receiveNewsFeed(initialNewsUpdatesState(), parsed);
    expect(state.feed.items).toHaveLength(count);
    expect(await verifyPublishedNewsSnapshot(value)).toBe(value);
  });
  it("legacy compatibility does not truncate the negotiated full representation", async () => {
    const legacy = await feed(1001, 101, { contractVersion: 1 });
    expect(legacy.items).toHaveLength(500);
    expect(legacy.sources).toHaveLength(50);
    expect(legacy.contractVersion).toBeUndefined();
    expect((await feed(1001)).items).toHaveLength(1001);
  });
  it("keeps distinct stages at one URL, but folds syndicated copies by semantic event key", () => {
    const first = news(1), second = news(2);
    expect(selectReviewed([first, second], current, "UTC")).toHaveLength(2);
    expect(selectReviewed([first, { ...second, eventKey: first.eventKey }], current, "UTC")).toHaveLength(1);
  });
  it("rejects partial, corrupted and mixed generations before the actual reducer", async () => {
    const value = await feed();
    await expect(readNewsFeedResponse(Response.json({ ...value, items: value.items.slice(0, 3) }))).rejects.toThrow();
    const changed = structuredClone(value); changed.items[0].title.ru += " changed";
    await expect(readNewsFeedResponse(Response.json(changed))).rejects.toThrow("digest");
    const state = receiveNewsFeed(initialNewsUpdatesState(), value);
    expect(receiveNewsFeed(state, { ...value, snapshot: { ...value.snapshot, complete: false } })).toBe(state);
  });
  it("ignores heartbeat in content digest but changes representation on eligibility boundary", async () => {
    const a = await feed(), b = await feed(8, 101, { current: new Date(current.getTime() + 60000) });
    expect(a.snapshot.id).toBe(b.snapshot.id);
    const announcement = { ...news(8), kind: "announcement", eventDate: "2026-09-27" };
    const before = await feed(1, 1, { records: [announcement] });
    const after = await feed(1, 1, { records: [announcement], current: new Date("2026-09-28T12:00:00Z") });
    expect(before.items).toHaveLength(1); expect(after.items).toHaveLength(0);
    expect(before.snapshot.id).not.toBe(after.snapshot.id);
    expect(after.withdrawals).toEqual([]);
  });
  it("holds fresh arrivals, applies corrections, remembers explicit withdrawals and rejects late responses", async () => {
    const initial = await feed();
    let state = receiveNewsFeed(initialNewsUpdatesState(), initial);
    const later = new Date(current.getTime() + 60000);
    const next = await feed(9, 101, { current: later, withdrawals: [{ id: news(1).id,
      withdrawnAt: current.toISOString(), reason: "Source correction" }] });
    state = receiveNewsFeed(state, next);
    expect(state.feed.items).toHaveLength(7); expect(state.pendingItems).toHaveLength(1);
    expect(receiveNewsFeed(state, initial)).toBe(state);
    expect(applyPendingNews(state).feed.items).toHaveLength(8);
    const staleContent = await feed(9, 101, { current: new Date(later.getTime() + 60000) });
    expect(receiveNewsFeed(state, staleContent).latestFeed.items.some((row) => row.id === news(1).id)).toBe(false);
  });
  it("actual Worker negotiates v2 and preserves v1", async () => {
    const env = { NEWS_RELEASE_SHA: release, NEWS_STATE: { get: async () => null } };
    const response = await handleNewsRequest(new Request("https://news.probpera.ru/api/literary-news/feed?contract=2&timeZone=Europe/Moscow"), env, current);
    expect((await readNewsFeedResponse(response)).snapshot.release).toBe(release);
    const legacy = await handleNewsRequest(new Request("https://news.probpera.ru/api/literary-news/feed"), env, current);
    expect((await legacy.json()).contractVersion).toBeUndefined();
  });
});
