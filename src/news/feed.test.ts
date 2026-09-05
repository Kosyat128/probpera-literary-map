import { describe, expect, it } from "vitest";
import { parseNewsFeed } from "./feed";

const feed = {
  mode: "local-prototype", generatedAt: "2026-09-05T12:00:00Z", lastCheckedAt: null,
  refreshIntervalSeconds: 600, timeZone: "UTC", sources: [], pendingCount: 0, items: [],
};

describe("worldwide literary news contract", () => {
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
