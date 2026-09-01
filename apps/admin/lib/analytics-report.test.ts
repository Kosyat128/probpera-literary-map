import { describe, expect, it } from "vitest";
import {
  analyticsReportCsv,
  normalizeAnalyticsReport,
  resolveAnalyticsRange,
} from "./analytics-report";

describe("admin analytics report", () => {
  it("uses an allowlisted UTC range", () => {
    const now = new Date("2026-09-01T12:00:00.000Z");
    expect(resolveAnalyticsRange("7", now)).toEqual({
      period: 7,
      from: "2026-08-25T12:00:00.000Z",
      to: "2026-09-01T12:00:00.000Z",
    });
    expect(resolveAnalyticsRange("999", now).period).toBe(30);
  });

  it("normalizes an untrusted RPC result and exports formula-safe quoted CSV", () => {
    const report = normalizeAnalyticsReport({
      views: "12",
      topPaths: [{ path: '=HYPERLINK("bad")', views: 4 }],
      daily: [{ day: "not-a-day", views: 4 }],
    }, "from", "to");
    expect(report.views).toBe(12);
    expect(report.daily).toEqual([]);
    expect(analyticsReportCsv(report)).toContain('"\'=HYPERLINK(""bad"")"');
  });
});
