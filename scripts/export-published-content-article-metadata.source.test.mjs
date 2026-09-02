import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./export-published-content.mjs", import.meta.url),
  "utf8"
);

describe("published article document metadata", () => {
  it("reuses normalized English metadata in standalone article documents", () => {
    const documentWriter = source.slice(
      source.indexOf("const normalizedEnglishEntry = entry.translations?.en;"),
      source.indexOf("const {\n  homepageBlocks: publicHomepageBlocks")
    );

    expect(documentWriter).toContain(
      "const normalizedEnglishEntry = entry.translations?.en;"
    );
    expect(documentWriter).toContain("normalizedEnglishEntry && englishDocument");
    expect(documentWriter).toContain("...normalizedEnglishEntry");
    expect(documentWriter).not.toContain("...englishEntry");
    expect(documentWriter).toContain(
      "payload: normalizeArticlePublicMetadata(\n      applyEditorialPublicationFix(articleDocument)\n    )"
    );
  });
});
