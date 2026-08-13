import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { isBookCmsEditable } from "./BookArchiveSection";

const writerPanelSource = readFileSync(
  new URL("./WriterPanel.tsx", import.meta.url),
  "utf8"
);
const bookArchiveSource = readFileSync(
  new URL("./BookArchiveSection.tsx", import.meta.url),
  "utf8"
);
const appSource = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");

describe("public visual editor markers", () => {
  it("marks the writer identity, portrait, name, years, biography and arrays", () => {
    expect(writerPanelSource).toContain("activeWriterSubscriptionId");
    for (const field of ["portrait", "name", "years", "bio", "works", "awards"]) {
      expect(writerPanelSource).toContain(`"${field}"`);
    }
    expect(writerPanelSource).toContain("cmsEntityFieldMarker(");
  });

  it("uses the full archive key for work links and editable fields", () => {
    expect(appSource).toContain(
      "work_id=${encodeURIComponent(`${bookOfMonth.countryId}:${bookOfMonth.writerId}:${bookOfMonth.id}`)}"
    );
    expect(bookArchiveSource).toContain("bookKey(selectedBook)");
    expect(bookArchiveSource).toContain(
      "work_id=${encodeURIComponent(bookKey(selectedBook))}"
    );
    for (const field of [
      "title",
      "originalTitle",
      "firstPublished",
      "originalLanguage",
      "description",
    ]) {
      expect(bookArchiveSource).toContain(`"${field}"`);
    }
  });

  it("does not expose unpublished archive entries to direct inline editing", () => {
    expect(isBookCmsEditable({ status: "pending" })).toBe(false);
    expect(isBookCmsEditable({ status: "verified" })).toBe(true);
    expect(bookArchiveSource).toContain('"data-cms-ignore": "true"');
  });
});
