import { describe, expect, it } from "vitest";

import { normalizeViewPath, viewPathVariants } from "./view-path";

describe("view path normalization", () => {
  it("removes query strings, hashes, trailing slashes and the old GitHub prefix", () => {
    expect(
      normalizeViewPath(
        "https://probpera.ru/probpera-literary-map/stati/mnenie/material/?from=old#text"
      )
    ).toBe("/stati/mnenie/material");
  });

  it("creates exact variants used by the public deployments", () => {
    expect(viewPathVariants("/stati/mnenie/material/")).toEqual([
      "/stati/mnenie/material",
      "/stati/mnenie/material/",
      "/probpera-literary-map/stati/mnenie/material",
      "/probpera-literary-map/stati/mnenie/material/",
    ]);
  });
});
