import { describe, expect, it } from "vitest";

import { normalizeShortHyphens } from "./shortHyphens";

describe("normalizeShortHyphens", () => {
  it("keeps only the ordinary short hyphen", () => {
    const entities = ["&" + "mdash;", "&#x" + "2013;"].join(" и ");
    expect(
      normalizeShortHyphens(
        `Текст\u2014продолжение, 1900\u20131945, ${entities}`
      )
    ).toBe("Текст-продолжение, 1900-1945, - и -");
  });
});
