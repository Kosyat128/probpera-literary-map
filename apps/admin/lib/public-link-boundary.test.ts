import { describe, expect, it } from "vitest";

import { safePublicSiteHref, safePublicSiteOrigin } from "./public-link-boundary";

describe("public link boundary", () => {
  it("accepts HTTPS production origins and local HTTP development", () => {
    expect(safePublicSiteOrigin("https://example.test/path")).toBe("https://example.test");
    expect(safePublicSiteOrigin("http://localhost:4173/path")).toBe("http://localhost:4173");
  });

  it.each(["javascript:alert(1)", "data:text/html,x", "http://evil.test", "//evil.test"])(
    "rejects an unsafe origin %s",
    (value) => expect(safePublicSiteOrigin(value)).toBe("https://probpera.ru")
  );

  it("reconstructs only same-origin, hash, or mail links", () => {
    expect(safePublicSiteHref("https://probpera.ru", "/articles/test?q=1")).toBe(
      "https://probpera.ru/articles/test?q=1"
    );
    expect(safePublicSiteHref("https://probpera.ru", "#books")).toBe(
      "https://probpera.ru/#books"
    );
    expect(safePublicSiteHref("https://probpera.ru", "javascript:alert(1)")).toBe(
      "https://probpera.ru"
    );
  });
});
