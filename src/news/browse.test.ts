import { describe, expect, it } from "vitest";
import { browseNewsItems, newsPublicationDay, paginateNewsItems, newsPageNumbers, newsPageForAnchor, type NewsBrowseFilters } from "./browse";
import type { NewsItem } from "./types";

const filters: NewsBrowseFilters = { period: "all", topic: "all", region: "all", query: "", source: "", publishedFrom: "", publishedTo: "", sort: "newest" };
const story = (id: string, overrides: Partial<NewsItem> = {}): NewsItem => ({
  id, category: "awards", region: "europe", kind: "news", eventDate: "2026-10-09", publishedAt: "2026-10-09T07:00:00Z",
  verifiedAt: "2026-10-09T08:00:00Z", title: { ru: "Новая премия для Всёдорова", en: "A new literary prize" },
  summary: { ru: "Книга писателя получила награду.", en: "The author's book received an award." },
  source: { name: "Publisher", url: `https://publisher.example/${id}`, language: "en" }, verification: "confirmed", ...overrides,
});
const browse = (items: NewsItem[], overrides: Partial<NewsBrowseFilters> = {}) => browseNewsItems(items, { ...filters, ...overrides }, "2026-10-09", "Europe/Moscow");

describe("complete website news browsing", () => {
  it("retains every reviewed news record and never mutates the verified snapshot ordering", () => {
    const items = Array.from({ length: 651 }, (_, index) => story(`story-${index}`, { publishedAt: "2026-09-01" }));
    expect(browse(items)).toHaveLength(651);
    expect(items.map((item) => item.id)).toEqual(browse(items).map((item) => item.id));
    expect(browse(items, { sort: "briefing" })).toEqual(items);
  });
  it("sorts by stated publication dates and keeps unknown dates last without inventing them", () => {
    const items = [story("unknown", { publishedAt: null }), story("old", { publishedAt: "2026-09-01" }), story("new")];
    expect(browse(items).map((item) => item.id)).toEqual(["new", "old", "unknown"]);
    expect(browse(items, { sort: "oldest" }).map((item) => item.id)).toEqual(["old", "new", "unknown"]);
    expect(items[0].publishedAt).toBeNull();
  });
  it("filters publication days in the visitor's zone and leaves date-only source dates unchanged", () => {
    const items = [story("instant", { publishedAt: "2026-10-08T22:30:00Z" }), story("date", { publishedAt: "2026-10-08" }), story("unknown", { publishedAt: null })];
    expect(browse(items, { publishedFrom: "2026-10-09", publishedTo: "2026-10-09" }).map((item) => item.id)).toEqual(["instant"]);
    expect(newsPublicationDay(items[1], "America/Los_Angeles")).toBe("2026-10-08");
    expect(browse(items, { publishedFrom: "2026-10-09", publishedTo: "2026-10-08" })).toEqual([]);
  });
  it("combines source, topic, region and accent-insensitive bilingual search", () => {
    const wanted = story("wanted");
    expect(browse([wanted, story("other", { category: "festivals" }), story("host", { source: { name: "Other", url: "https://other.example/", language: "en" } })],
      { topic: "awards", region: "europe", source: "https://publisher.example", query: "вседоров премия" })).toEqual([wanted]);
    expect(browse([wanted], { query: "literary prize" })).toEqual([wanted]);
  });
  it("keeps the existing current announcement policy and distinguishes publication from event filters", () => {
    const upcoming = story("upcoming", { kind: "announcement", eventDate: "2026-10-10" });
    expect(browse([upcoming, story("expired", { kind: "announcement", eventDate: "2026-10-08" })], { period: "upcoming" })).toEqual([upcoming]);
    expect(browse([upcoming], { period: "today" })).toEqual([]);
  });
  it("retains expired announcements only in an explicitly requested archive projection", () => {
    const expired = story("expired", { kind: "announcement", eventDate: "2026-10-08" });
    expect(browse([expired])).toEqual([]);
    expect(browseNewsItems([expired], filters, "2026-10-09", "Europe/Moscow", { archive: true })).toEqual([expired]);
  });
  it("reaches the entire archive in 25-card pages and clamps after withdrawals", () => {
    const items = Array.from({ length: 654 }, (_, index) => index);
    const pages = Array.from({ length: 27 }, (_, index) => paginateNewsItems(items, index + 1).items);
    expect(pages.flat()).toEqual(items);
    expect(pages[0]).toHaveLength(25);
    expect(pages[26]).toHaveLength(4);
    expect(paginateNewsItems(items.slice(0, 20), 27)).toMatchObject({ page: 1, start: 1, end: 20, totalPages: 1 });
    expect(paginateNewsItems([], 27)).toMatchObject({ page: 1, start: 0, end: 0, items: [] });
    expect(newsPageNumbers(14, 27)).toEqual([1, null, 13, 14, 15, null, 27]);
  });
  it("keeps the reader's anchor reachable when arrivals move it across a 25-card boundary", () => {
    const original = Array.from({ length: 50 }, (_, index) => ({ id: `story-${index}` }));
    const next = [{ id: "new-story" }, ...original];
    expect(newsPageForAnchor(original, "story-24", 1)).toBe(1);
    const page = newsPageForAnchor(next, "story-24", 1);
    expect(page).toBe(2);
    expect(paginateNewsItems(next, page).items.some((item) => item.id === "story-24")).toBe(true);
    expect(newsPageForAnchor(next, "withdrawn-story", 20)).toBe(3);
  });
});
