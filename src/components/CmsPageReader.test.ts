import { describe, expect, it } from "vitest";

import {
  cmsPageSlugFromPath,
  formatCmsUpdatedAt,
} from "./CmsPageReader";

describe("CMS page routes", () => {
  it("extracts a normalized slug inside the configured base path", () => {
    expect(
      cmsPageSlugFromPath(
        "/probpera/stranitsy/Editorial-Policy/",
        "/probpera/"
      )
    ).toBe("editorial-policy");
  });

  it("does not confuse a similarly prefixed route with the configured base", () => {
    expect(
      cmsPageSlugFromPath(
        "/probpera-other/stranitsy/editorial-policy/",
        "/probpera/"
      )
    ).toBeNull();
  });

  it("treats malformed URL encoding as a missing CMS page", () => {
    expect(cmsPageSlugFromPath("/stranitsy/%E0%A4%A/")).toBeNull();
  });

  it("does not crash the reader on an invalid CMS update date", () => {
    expect(formatCmsUpdatedAt("not-a-date", "ru")).toBe("");
    expect(formatCmsUpdatedAt(undefined, "en")).toBe("");
  });
});
