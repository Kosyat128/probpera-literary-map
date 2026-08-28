import { describe, expect, it } from "vitest";

import {
  editorialArtworkAssetUrl,
  editorialArtworkCountFromRelation,
  editorialArtworkDigest,
  editorialArtworkProvenanceView,
  editorialArtworkSecondaryCount,
} from "./literary-work-cover-artwork";

describe("literary work editorial artwork", () => {
  it("resolves only HTTPS or allowlisted local cover assets", () => {
    expect(
      editorialArtworkAssetUrl(
        "brand/book-covers/thumbs/war-and-peace-editorial.webp",
        "https://probpera.ru/subpath"
      )
    ).toBe(
      "https://probpera.ru/brand/book-covers/thumbs/war-and-peace-editorial.webp"
    );
    expect(editorialArtworkAssetUrl("https://cdn.example/cover.webp")).toBe(
      "https://cdn.example/cover.webp"
    );
    expect(editorialArtworkAssetUrl("javascript:alert(1)")).toBe("");
    expect(editorialArtworkAssetUrl("https://")).toBe("");
    expect(editorialArtworkAssetUrl("https://user:secret@example.test/a.webp")).toBe("");
    expect(editorialArtworkAssetUrl("brand/other/file.webp")).toBe("");
    expect(
      editorialArtworkAssetUrl(
        "brand/book-covers/valid.webp",
        "http://probpera.test"
      )
    ).toBe("");
  });

  it("normalizes relation counts and derives the secondary total", () => {
    expect(editorialArtworkCountFromRelation([{ count: 2 }])).toBe(2);
    expect(editorialArtworkCountFromRelation({ count: 1 })).toBe(1);
    expect(editorialArtworkCountFromRelation([{ count: -1 }])).toBe(0);
    expect(editorialArtworkSecondaryCount(43, 31)).toBe(12);
    expect(editorialArtworkSecondaryCount(2, 3)).toBe(0);
  });

  it("exposes bounded provenance fields and abbreviated validated hashes", () => {
    expect(
      editorialArtworkProvenanceView({
        kind: " user-supplied ",
        matchBasis: "exact-author-and-title",
        sourceEvidence: "archive-manifest",
        note: "Editorial illustration",
        ignored: "not part of the UI contract",
      })
    ).toEqual({
      kind: "user-supplied",
      matchBasis: "exact-author-and-title",
      sourceEvidence: "archive-manifest",
      note: "Editorial illustration",
    });
    expect(editorialArtworkDigest("a".repeat(64))).toBe(
      `${"a".repeat(12)}…${"a".repeat(8)}`
    );
    expect(editorialArtworkDigest("not-a-digest")).toBe("-");
  });
});
