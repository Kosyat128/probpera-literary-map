import { describe, expect, it } from "vitest";
import { assertCoverOverlayPublicationInvariant } from "./cover-overlay-publication-guard.mjs";

const makeBooks = publicCount => Array.from({ length: 80 }, (_, index) => ({
  countryId: "country", writerId: "writer", id: `book-${index}`, public: index < publicCount,
}));
const check = (baseline, current) => assertCoverOverlayPublicationInvariant(baseline, current, book => book.public);

describe("cover overlays preserve the current CMS publication identities", () => {
  it.each([46, 65])("accepts an unchanged %i-public-book CMS snapshot with only cover additions", publicCount => {
    const baseline = makeBooks(publicCount);
    const current = baseline.map(book => ({ ...book, coverUrl: "/approved-cover.webp" })).reverse();
    expect(() => check(baseline, current)).not.toThrow();
  });
  it("rejects equal-count public membership swaps", () => {
    const baseline = makeBooks(46), current = structuredClone(baseline);
    current[0].public = false; current[79].public = true;
    expect(() => check(baseline, current)).toThrow("cover_overlay_publication_changed");
  });
  it.each(["promotion", "demotion"])("rejects a publication %s", change => {
    const baseline = makeBooks(65), current = structuredClone(baseline);
    current[change === "promotion" ? 79 : 0].public = change === "promotion";
    expect(() => check(baseline, current)).toThrow("cover_overlay_publication_changed");
  });
  it.each(["baseline", "current"])("rejects duplicate identities on the %s side", side => {
    const baseline = makeBooks(46), current = structuredClone(baseline);
    const books = side === "baseline" ? baseline : current;
    books[1] = { ...books[0] };
    expect(() => check(baseline, current)).toThrow("cover_overlay_identity_duplicate");
  });
  it.each(["countryId", "writerId", "id"])("rejects a missing %s identity component", field => {
    const baseline = makeBooks(46), current = structuredClone(baseline);
    delete current[79][field];
    expect(() => check(baseline, current)).toThrow("cover_overlay_identity_missing");
  });
  it("rejects replacing even a nonpublic identity while counts remain equal", () => {
    const baseline = makeBooks(46), current = structuredClone(baseline);
    current[79].id = "different-pending-book";
    expect(() => check(baseline, current)).toThrow("cover_overlay_archive_identity_changed");
  });
});
