import { describe, expect, it } from "vitest";

import {
  ARTICLE_COPY_SEARCH_MAX_QUERY,
  articleCopySearchPattern,
  normalizeArticleCopySearch,
} from "./article-copy-search";

describe("article copy search", () => {
  it("normalizes whitespace and bounds the server query", () => {
    expect(normalizeArticleCopySearch("  Морфий   Булгаков  ")).toBe(
      "Морфий Булгаков"
    );
    expect(normalizeArticleCopySearch("я".repeat(500))).toHaveLength(
      ARTICLE_COPY_SEARCH_MAX_QUERY
    );
  });

  it("requires a meaningful query and escapes ilike wildcards", () => {
    expect(articleCopySearchPattern("а")).toBeNull();
    expect(articleCopySearchPattern("100%_книга\\архив")).toBe(
      "%100\\%\\_книга\\\\архив%"
    );
  });
});
