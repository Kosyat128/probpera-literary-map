import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveRedirectArtifactPath } from "./redirect-artifact-path.mjs";

const distDirectory = path.resolve("dist-fixture");
const siteOrigin = "https://probpera.ru";

function resolve(sourceValue) {
  return resolveRedirectArtifactPath({
    distDirectory,
    siteOrigin,
    sourceValue,
  });
}

describe("redirect artifact path containment", () => {
  it("maps same-origin route and file aliases inside dist", () => {
    expect(resolve("/articles/a-book")).toBe(
      path.join(distDirectory, "articles", "a-book", "index.html")
    );
    expect(resolve("/legacy/feed.xml")).toBe(
      path.join(distDirectory, "legacy", "feed.xml")
    );
  });

  it.each([
    "/a/%2e%2e%2foutside",
    "/a/%2e%2e%5coutside",
    "/a/..%2Foutside",
    "/a/..%5Coutside",
    "/a/%2e%2e/outside",
  ])("rejects encoded slash and backslash traversal: %s", (sourceValue) => {
    expect(() => resolve(sourceValue)).toThrow(/unsafe path segment/u);
  });

  it.each([
    "https://example.com/articles/a-book",
    "/articles/a-book?preview=1",
    "/articles/a-book#fragment",
    "/articles/a%00book",
  ])("rejects a source that cannot map to one safe artifact: %s", (sourceValue) => {
    expect(() => resolve(sourceValue)).toThrow();
  });
});
