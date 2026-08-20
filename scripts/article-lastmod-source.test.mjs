import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const exportSource = await readFile(
  new URL("./export-published-content.mjs", import.meta.url),
  "utf8"
);
const builderSource = await readFile(
  new URL("./build-article-pages.mjs", import.meta.url),
  "utf8"
);

describe("article modification dates", () => {
  it("exports the real updated_at value for Russian and English articles", () => {
    expect(exportSource).toContain("published_at,updated_at,featured");
    expect(exportSource).toContain("updatedAt: article.updated_at");
    expect(exportSource).toContain("updatedAt: englishTranslation.updated_at");
  });

  it("prefers the English translation update for JSON-LD and sitemap lastmod", () => {
    expect(builderSource.match(/englishTranslation\.updatedAt \|\|/gu)).toHaveLength(2);
  });
});
