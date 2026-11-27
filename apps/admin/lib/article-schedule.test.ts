import { describe, expect, it } from "vitest";
import {
  ARTICLE_SCHEDULE_TIME_ZONE,
  articleScheduleInput,
  articleScheduleSubmission,
  normalizeArticleScheduledAt,
  restoreArticleScheduleInput,
} from "./article-schedule";

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

  it("keeps the full stored instant when a legacy recovery snapshot retained the old UTC field", () => {
    const stored = "2026-11-27T22:30:15.123456+00:00";
    const recovered = restoreArticleScheduleInput("2026-11-27T22:30", stored);
    expect(recovered).toBe("2026-11-28T01:30");
    expect(normalizeArticleScheduledAt(articleScheduleSubmission(recovered, stored))).toBe(stored);
  });

  it("keeps explicitly changed legacy values and marked Moscow snapshots in the editor timezone", () => {
    const stored = "2026-11-27T11:30:00.000Z";
    expect(restoreArticleScheduleInput("2026-11-27T15:00", stored)).toBe("2026-11-27T15:00");
    const marked = restoreArticleScheduleInput("2026-11-27T11:30", stored, ARTICLE_SCHEDULE_TIME_ZONE);
    expect(marked).toBe("2026-11-27T11:30");
    expect(normalizeArticleScheduledAt(articleScheduleSubmission(marked, stored))).toBe("2026-11-27T08:30:00.000Z");
    expect(restoreArticleScheduleInput(undefined, stored)).toBe("");
    expect(restoreArticleScheduleInput("2026-11-27T15:00", null)).toBe("2026-11-27T15:00");
  });

  it.each(["", "2026-02-29T14:30", "2026-11-27T24:00", "2026-11-27T14:30+03:70"])(
    "rejects an invalid date or offset %j", (value) => {
      expect(normalizeArticleScheduledAt(value)).toBeNull();
      expect(articleScheduleInput(value)).toBe("");
    }
  );
});
