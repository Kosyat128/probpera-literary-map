import { describe, expect, it, vi } from "vitest";
import { dailyNewsDay } from "./literary-news-daily-profile.mjs";

describe("shared Moscow admission day formatter", () => {
  it.each([
    ["2026-09-29T20:59:59.999Z", "2026-09-29"],
    ["2026-09-29T21:00:00.000Z", "2026-09-30"],
    ["2026-12-31T21:00:00.000Z", "2027-01-01"],
    ["2027-09-29T20:59:59.999Z", "2027-09-29"],
    ["2027-09-29T21:00:00.000Z", "2027-09-30"]
  ])("preserves %s at the Moscow boundary", (value, day) => expect(dailyNewsDay(new Date(value))).toBe(day));
  it("year-ledger repeated calls reuse the fixed formatter without weakening invalid date rejection", () => {
    const constructor = vi.spyOn(Intl, "DateTimeFormat");
    try {
      for (let index = 0; index < 5490 * 2; index++) expect(dailyNewsDay(new Date("2026-09-30T12:00:00Z"))).toBe("2026-09-30");
      expect(constructor).not.toHaveBeenCalled();
      expect(() => dailyNewsDay(new Date(NaN))).toThrow(RangeError);
    } finally { constructor.mockRestore(); }
  });
});
