import { describe, expect, it } from "vitest";
import { articleScheduleInput, normalizeArticleScheduledAt } from "./article-schedule";

describe("article publication schedule", () => {
  it("round trips 14:30 Moscow from the editor to the stored UTC time", () => {
    const stored = normalizeArticleScheduledAt("2026-11-27T14:30");
    expect(stored).toBe("2026-11-27T11:30:00.000Z");
    expect(articleScheduleInput(stored)).toBe("2026-11-27T14:30");
  });

  it("displays an existing UTC timestamp in Moscow across midnight", () => {
    expect(articleScheduleInput("2026-11-27T22:30:00.123456+00:00")).toBe("2026-11-28T01:30");
    expect(articleScheduleInput()).toBe("");
  });

  it("preserves explicit offsets and fractional seconds from scripted callers", () => {
    const explicit = "2026-11-27T07:30:15.123456-04:00";
    expect(normalizeArticleScheduledAt(explicit)).toBe(explicit);
    expect(articleScheduleInput(explicit)).toBe("2026-11-27T14:30");
    expect(normalizeArticleScheduledAt("2026-11-27T14:30:15.123456")).toBe("2026-11-27T11:30:15.123456Z");
  });

  it.each(["", "2026-02-29T14:30", "2026-11-27T24:00", "2026-11-27T14:30+03:70"])(
    "rejects an invalid date or offset %j", (value) => {
      expect(normalizeArticleScheduledAt(value)).toBeNull();
      expect(articleScheduleInput(value)).toBe("");
    }
  );
});
