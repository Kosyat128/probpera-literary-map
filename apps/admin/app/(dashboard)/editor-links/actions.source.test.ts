import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");

describe("authorized internal editor link search", () => {
  it("requires a staff session and returns published article/page paths only", () => {
    expect(source).toContain("await requireStaff()");
    expect(source).toContain('.from("articles")');
    expect(source).toContain('.from("pages")');
    expect(source.match(/\.eq\("status", "published"\)/gu)).toHaveLength(2);
    expect(source.match(/\.is\("deleted_at", null\)/gu)).toHaveLength(2);
    expect(source).toContain("articlePublicPath(");
    expect(source).toContain("/stranitsy/${");
  });

  it("bounds the result and validates every generated internal href", () => {
    expect(source).toContain("EDITOR_INTERNAL_LINK_SEARCH_LIMIT");
    expect(source).toContain("validateEditorLinkHref(item.href)");
    expect(source).toContain('validation.href.startsWith("/")');
    expect(source).not.toContain("content_html");
    expect(source).not.toContain("content_json");
  });
});
