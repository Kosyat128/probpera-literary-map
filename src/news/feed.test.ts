import { describe, expect, it } from "vitest";
import { parseNewsFeed } from "./feed";

const feed = {
  mode: "local-prototype", generatedAt: "2026-09-05T12:00:00Z", lastCheckedAt: null,
  refreshIntervalSeconds: 600, timeZone: "UTC", sources: [], pendingCount: 0, items: [],
};

describe("worldwide literary news contract", () => {
  it("accepts published reviewed feeds and keeps the explicit local preview mode", () => {
    for (const mode of ["reviewed", "local-prototype"] as const) {
      expect(parseNewsFeed({ ...feed, mode }).mode).toBe(mode);
    }
    for (const mode of ["live", "draft", "", null]) {
      expect(() => parseNewsFeed({ ...feed, mode })).toThrow();
    }
  });

  it("never relaxes review, translation or source requirements for public feeds", () => {
    const story = {
      id: "test-story", category: "awards", kind: "announcement", eventDate: "2026-09-06",
      publishedAt: null, verifiedAt: "2026-09-05T12:00:00Z", verification: "confirmed",
      title: { ru: "Тестовая новость", en: "Test story" },
      summary: { ru: "Тестовое описание", en: "Test summary" },
      source: { name: "Test source", url: "https://example.org/story", language: "en" },
    };
    const published = { ...feed, mode: "reviewed", items: [story] };
    expect(parseNewsFeed(published).items).toHaveLength(1);
    for (const item of [
      { ...story, verification: "pending" },
      { ...story, summary: { ru: "Тестовое описание", en: "" } },
      { ...story, source: { ...story.source, url: "javascript:alert(1)" } },
    ]) expect(() => parseNewsFeed({ ...published, items: [item] })).toThrow();
    expect(() => parseNewsFeed({ ...published, items: [story, story] })).toThrow();
  });

  it("accepts supported geographic zones and rejects unknown or numeric zones", () => {
    for (const timeZone of ["UTC", "America/Los_Angeles", "Asia/Tokyo", "Europe/Moscow"]) {
      expect(parseNewsFeed({ ...feed, timeZone }).timeZone).toBe(timeZone);
    }
    for (const timeZone of ["Unknown/City", "+03:00", "", null, 3]) {
      expect(() => parseNewsFeed({ ...feed, timeZone })).toThrow();
    }
  });

  it("requires an explicit offset for instants so they mean the same moment worldwide", () => {
    expect(() => parseNewsFeed({ ...feed, generatedAt: "2026-09-05T12:00:00" })).toThrow();
    expect(parseNewsFeed({ ...feed, generatedAt: "2026-09-05T15:00:00+03:00" }).generatedAt)
      .toBe("2026-09-05T15:00:00+03:00");
  });
});
