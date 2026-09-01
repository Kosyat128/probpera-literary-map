import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

async function source(relativePath) {
  return readFile(new URL(relativePath, new URL("../", import.meta.url)), "utf8");
}

function declarationBlock(contents, start, end) {
  const startIndex = contents.indexOf(start);
  expect(startIndex, `${start} declaration`).toBeGreaterThanOrEqual(0);
  const endIndex = contents.indexOf(end, startIndex + start.length);
  expect(endIndex, `${start} terminator`).toBeGreaterThan(startIndex);
  return contents.slice(startIndex, endIndex + end.length);
}

describe("writer portrait editorial governance", () => {
  it("keeps portrait provenance out of both export allowlists", async () => {
    const [catalogExporter, publishedExporter] = await Promise.all([
      source("scripts/export-editorial-catalog.mjs"),
      source("scripts/export-published-content.mjs"),
    ]);
    const catalogFields = declarationBlock(
      catalogExporter,
      "const writerFields = [",
      "];"
    );
    const publishedFields = declarationBlock(
      publishedExporter,
      "const writerOverrideFields = new Set([",
      "]);"
    );

    for (const block of [catalogFields, publishedFields]) {
      expect(block).not.toMatch(
        /"portrait(?:Alt|SourceUrl|Rights)?"/u
      );
    }
  });

  it("does not render partial portrait controls in either admin editor", async () => {
    const [profilePage, libraryPage] = await Promise.all([
      source("apps/admin/app/(dashboard)/editorial-database/page.tsx"),
      source("apps/admin/app/(dashboard)/library/page.tsx"),
    ]);

    for (const page of [profilePage, libraryPage]) {
      expect(page).not.toMatch(/field="portrait(?:Alt|SourceUrl)?"/u);
    }
  });

  it("keeps the generated private catalog free of portrait overrides", async () => {
    const catalog = JSON.parse(
      await source("apps/admin/catalog-assets/editorial-catalog.json")
    );
    const violations = catalog.countries.flatMap((country) =>
      country.writers.flatMap((writer) =>
        Object.keys(writer.fields)
          .filter((field) =>
            [
              "portrait",
              "portraitAlt",
              "portraitSourceUrl",
              "portraitRights",
            ].includes(field)
          )
          .map((field) => `${country.id}:${writer.id}:${field}`)
      )
    );

    expect(violations).toEqual([]);
  });
});
