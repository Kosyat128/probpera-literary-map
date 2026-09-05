import { describe, expect, it } from "vitest";
import { parseBookDossierProgress, sameBookDossierLocation } from "./bookDossierProgress";

const progress = {
  anchor: { sectionId: "passport", blockId: "facts", dossierVersion: "v2", locale: "ru" as const, readingMode: "BEFORE_READING" as const },
  pageId: "passport:0", updatedAt: "2026-09-05T00:00:00Z",
};

describe("private dossier location in the existing reading library", () => {
  it("projects only a bounded semantic position from untrusted storage", () => {
    expect(parseBookDossierProgress({ ...progress, notes: "private text", html: "<script>", anchor: { ...progress.anchor, content: "not a position" } })).toEqual(progress);
    expect(parseBookDossierProgress({ ...progress, pageId: "x".repeat(241) })).toBeUndefined();
    expect(parseBookDossierProgress({ ...progress, anchor: { ...progress.anchor, locale: "zz" } })).toBeUndefined();
  });
  it("ignores damaged timestamps and unknown modes rather than restoring an invalid reader", () => {
    expect(parseBookDossierProgress({ ...progress, updatedAt: "invalid" })).toBeUndefined();
    expect(parseBookDossierProgress({ ...progress, anchor: { ...progress.anchor, readingMode: "ALL" } })).toBeUndefined();
    expect(parseBookDossierProgress(null)).toBeUndefined();
  });
  it("does not write storage repeatedly for the same location and detects version or language changes", () => {
    expect(sameBookDossierLocation(progress, { ...progress, updatedAt: "2026-09-06T00:00:00Z" })).toBe(true);
    expect(sameBookDossierLocation(progress, { ...progress, anchor: { ...progress.anchor, locale: "en" } })).toBe(false);
    expect(sameBookDossierLocation(progress, { ...progress, anchor: { ...progress.anchor, dossierVersion: "v3" } })).toBe(false);
  });
});
