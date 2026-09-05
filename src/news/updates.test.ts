import { describe, expect, it } from "vitest";
import type { NewsFeed, NewsItem } from "./types";
import { applyPendingNews, initialNewsUpdatesState, receiveNewsFeed } from "./updates";

function item(id: string, title = id): NewsItem {
  return {
    id, category: "releases", kind: "news", eventDate: "2026-09-05",
    publishedAt: "2026-09-05", verifiedAt: "2026-09-05T12:00:00Z",
    title: { ru: title, en: title }, summary: { ru: `Описание ${id}`, en: `Summary ${id}` },
    source: { name: "Publisher", url: `https://publisher.example/news/${id}`, language: "en" },
    verification: "confirmed",
  };
}

function feed(items: NewsItem[], generatedAt = "2026-09-05T12:00:00Z"): NewsFeed {
  return {
    mode: "local-prototype", generatedAt, lastCheckedAt: generatedAt,
    refreshIntervalSeconds: 600, timeZone: "Europe/Moscow", sources: [], pendingCount: 0, items,
  };
}

const ids = (items: NewsItem[] | undefined) => items?.map((value) => value.id);

describe("literary news updates", () => {
  it("shows the first feed immediately without counting its cards as new", () => {
    const firstFeed = feed([item("first"), item("second")]);
    const state = receiveNewsFeed(initialNewsUpdatesState(), firstFeed);
    expect(state.feed).toBe(firstFeed);
    expect(state.latestFeed).toBe(firstFeed);
    expect(state.pendingItems).toEqual([]);
  });

  it("preserves visible order while applying corrections, withdrawals and fresh metadata immediately", () => {
    const originalFeed = feed([item("first"), item("removed"), item("second")]);
    const previous = receiveNewsFeed(initialNewsUpdatesState(), originalFeed);
    const latest = feed([item("new"), item("second"), item("first", "Corrected title")], "2026-09-05T12:10:00Z");
    latest.pendingCount = 4;
    latest.sources = [{
      id: "publisher", name: "Publisher", url: "https://publisher.example/news",
      status: "error", lastSuccessAt: "2026-09-05T12:00:00Z", candidateCount: 4, error: "http_503",
    }];
    const before = structuredClone(previous);
    const nextBefore = structuredClone(latest);

    const state = receiveNewsFeed(previous, latest);

    expect(ids(state.feed?.items)).toEqual(["first", "second"]);
    expect(state.feed?.items[0].title.en).toBe("Corrected title");
    expect(state.feed?.lastCheckedAt).toBe(latest.lastCheckedAt);
    expect(state.feed?.sources).toEqual(latest.sources);
    expect(state.feed?.pendingCount).toBe(4);
    expect(ids(state.pendingItems)).toEqual(["new"]);
    expect(state.latestFeed).toBe(latest);
    expect(previous).toEqual(before);
    expect(latest).toEqual(nextBefore);
  });

  it("replaces pending cards on every poll so repeat polls do not duplicate them and withdrawn cards disappear", () => {
    let state = receiveNewsFeed(initialNewsUpdatesState(), feed([item("visible")]));
    const next = feed([item("pending-a"), item("pending-b"), item("visible")]);
    state = receiveNewsFeed(state, next);
    state = receiveNewsFeed(state, next);
    expect(ids(state.pendingItems)).toEqual(["pending-a", "pending-b"]);

    state = receiveNewsFeed(state, feed([item("pending-b", "Updated pending title"), item("visible")]));
    expect(ids(state.pendingItems)).toEqual(["pending-b"]);
    expect(state.pendingItems[0].title.en).toBe("Updated pending title");
    expect(ids(state.feed?.items)).toEqual(["visible"]);
  });

  it("applying pending news uses the latest canonical order and does not restore withdrawn cards", () => {
    let state = receiveNewsFeed(initialNewsUpdatesState(), feed([item("first"), item("second")]));
    state = receiveNewsFeed(state, feed([item("withdrawn-pending"), item("second"), item("first")]));
    const latest = feed([item("second"), item("new"), item("first", "Latest correction")]);
    state = receiveNewsFeed(state, latest);
    const before = structuredClone(state);

    const applied = applyPendingNews(state);

    expect(applied.feed).toBe(latest);
    expect(ids(applied.feed?.items)).toEqual(["second", "new", "first"]);
    expect(applied.feed?.items[2].title.en).toBe("Latest correction");
    expect(applied.pendingItems).toEqual([]);
    expect(state).toEqual(before);
    expect(receiveNewsFeed(applied, latest).pendingItems).toEqual([]);
  });

  it("handles an empty feed, complete withdrawals and applying without pending cards", () => {
    const initial = initialNewsUpdatesState();
    expect(applyPendingNews(initial)).toBe(initial);

    let state = receiveNewsFeed(initial, feed([]));
    state = receiveNewsFeed(state, feed([item("later")]));
    expect(state.feed?.items).toEqual([]);
    expect(ids(state.pendingItems)).toEqual(["later"]);
    state = applyPendingNews(state);
    const empty = feed([]);
    state = receiveNewsFeed(state, empty);
    expect(state.feed?.items).toEqual([]);
    expect(state.pendingItems).toEqual([]);
    expect(applyPendingNews(state).feed).toBe(empty);
  });
});
