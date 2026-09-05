import { afterEach, describe, expect, it, vi } from "vitest";

import { calendarDay, eventDateHint, formatNewsDate, getVisitorTimeZone, timeZoneLabel } from "./dates";

afterEach(() => vi.restoreAllMocks());

describe("visitor literary news dates", () => {
  const instant = Date.parse("2026-09-05T00:30:00.000Z");

  it("uses the browser's zone and falls back to UTC when it is missing", () => {
    const options = Intl.DateTimeFormat().resolvedOptions();
    const resolve = vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions");
    resolve.mockReturnValue({ ...options, timeZone: "Asia/Tokyo" });
    expect(getVisitorTimeZone()).toBe("Asia/Tokyo");
    resolve.mockReturnValue({ ...options, timeZone: "" });
    expect(getVisitorTimeZone()).toBe("UTC");
    resolve.mockImplementation(() => { throw new Error("Timezone unavailable"); });
    expect(getVisitorTimeZone()).toBe("UTC");
  });

  it("shows different Today and Tomorrow hints in Los Angeles and Tokyo at the same instant", () => {
    const losAngelesDay = calendarDay(instant, "America/Los_Angeles");
    const tokyoDay = calendarDay(instant, "Asia/Tokyo");
    expect(losAngelesDay).toBe("2026-09-04");
    expect(tokyoDay).toBe("2026-09-05");
    expect(eventDateHint("2026-09-05", losAngelesDay, "en")).toBe("Tomorrow");
    expect(eventDateHint("2026-09-05", tokyoDay, "en")).toBe("Today");
  });

  it("preserves date-only events in every zone, including when time was requested", () => {
    for (const language of ["ru", "en"] as const) {
      const expected = formatNewsDate("2028-02-29", language, "UTC");
      expect(expected).toMatch(/^29\D/);
      expect(expected).toContain("2028");
      for (const zone of ["America/Los_Angeles", "Asia/Tokyo", "Pacific/Kiritimati"]) {
        expect(formatNewsDate("2028-02-29", language, zone)).toBe(expected);
        expect(formatNewsDate("2028-02-29", language, zone, true)).toBe(expected);
      }
    }
  });

  it("converts publication/check timestamps to the viewer's day and clock", () => {
    expect(formatNewsDate("2026-09-05T00:30:00.000Z", "en", "America/Los_Angeles", true)).toMatch(/^4\D.*2026.*17:30$/);
    expect(formatNewsDate("2026-09-05T00:30:00.000Z", "en", "Asia/Tokyo", true)).toMatch(/^5\D.*2026.*09:30$/);
    expect(formatNewsDate("2026-09-05T02:30:00+02:00", "en", "Asia/Tokyo", true)).toBe(formatNewsDate("2026-09-05T00:30:00Z", "en", "Asia/Tokyo", true));
  });

  it("handles year boundaries and leap days as calendar differences", () => {
    const newYear = Date.parse("2026-12-31T16:30:00Z");
    expect(calendarDay(newYear, "Asia/Tokyo")).toBe("2027-01-01");
    expect(calendarDay(newYear, "America/Los_Angeles")).toBe("2026-12-31");
    expect(eventDateHint("2027-01-01", "2026-12-31", "ru")).toBe("Завтра");
    expect(eventDateHint("2028-03-01", "2028-02-28", "en")).toBe("In 2 days");
    expect(eventDateHint("2028-02-29", "2028-02-29", "ru")).toBe("Сегодня");
  });

  it("does not let daylight-saving clock changes change a calendar hint", () => {
    const beforeJump = calendarDay(Date.parse("2026-03-08T09:30:00Z"), "America/Los_Angeles");
    const afterJump = calendarDay(Date.parse("2026-03-08T10:30:00Z"), "America/Los_Angeles");
    expect(beforeJump).toBe("2026-03-08");
    expect(afterJump).toBe(beforeJump);
    expect(eventDateHint("2026-03-09", afterJump, "en")).toBe("Tomorrow");
  });

  it("uses the correct Russian day forms", () => {
    expect(eventDateHint("2026-09-26", "2026-09-05", "ru")).toBe("Через 21 день");
    expect(eventDateHint("2026-09-27", "2026-09-05", "ru")).toBe("Через 22 дня");
    expect(eventDateHint("2026-09-30", "2026-09-05", "ru")).toBe("Через 25 дней");
  });

  it("never gives future hints to past events or invalid calendar dates", () => {
    expect(eventDateHint("2026-09-04", "2026-09-05", "ru")).toBeNull();
    expect(eventDateHint("2027-02-29", "2027-02-28", "en")).toBeNull();
    expect(eventDateHint("2026-09-05T00:00:00Z", "2026-09-05", "en")).toBeNull();
    expect(eventDateHint("2026-09-05", "invalid", "en")).toBeNull();
    expect(() => formatNewsDate("2027-02-29", "en", "Asia/Tokyo")).toThrow(RangeError);
  });

  it("falls back to UTC for unsupported time zones", () => {
    expect(calendarDay(instant, "Not/AZone")).toBe("2026-09-05");
    expect(formatNewsDate("2026-09-05T00:30:00Z", "en", "Not/AZone", true)).toBe(formatNewsDate("2026-09-05T00:30:00Z", "en", "UTC", true));
    expect(timeZoneLabel(instant, "en", "Not/AZone")).toBe("UTC");
  });

  it("provides a localized zone name for the visitor's current season", () => {
    const english = timeZoneLabel(instant, "en", "Asia/Tokyo");
    const russian = timeZoneLabel(instant, "ru", "Asia/Tokyo");
    expect(english).toMatch(/Japan/i);
    expect(russian).toMatch(/[А-Яа-яЁё]/);
    expect(russian).not.toBe(english);
    expect(timeZoneLabel(instant, "en", "America/Los_Angeles")).toMatch(/Daylight/i);
  });
});
