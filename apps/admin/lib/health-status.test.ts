import { describe, expect, it } from "vitest";

import {
  healthStatusLabels,
  healthStatuses,
  redactHealthDiagnosticText,
  safeDiagnosticPath,
} from "./health-status";

describe("operational health boundary", () => {
  it("uses the closed operational status vocabulary", () => {
    expect(healthStatuses).toEqual([
      "OK",
      "DEGRADED",
      "FAILED",
      "NOT CONFIGURED",
      "UNKNOWN",
    ]);
    expect(Object.keys(healthStatusLabels)).toEqual([...healthStatuses]);
  });

  it("redacts secrets before rendering diagnostics", () => {
    const value = redactHealthDiagnosticText(
      "authorization: Bearer abc.def.ghi password=hunter2 sk-proj-abcdefghijk"
    );
    expect(value).not.toContain("hunter2");
    expect(value).not.toContain("sk-proj-");
    expect(value).toContain("[скрыто]");
  });

  it("removes query strings and rejects external-looking paths", () => {
    expect(safeDiagnosticPath("/admin?token=secret#part")).toBe("/admin");
    expect(safeDiagnosticPath("//evil.test/path")).toBe("/");
    expect(safeDiagnosticPath("https://evil.test/path")).toBe("/");
  });
});
