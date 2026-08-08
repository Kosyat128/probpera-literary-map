import { describe, expect, it } from "vitest";

import {
  dedupeOpenLibraryCandidates,
  evaluateOpenLibraryCandidate,
  suspiciousBookTitleReason,
} from "./book-import-policy.mjs";

const author = {
  key: "england:george_orwell",
  openLibraryId: "OL118077A",
  birthYear: 1903,
  deathYear: 1950,
};

function candidate(overrides = {}) {
  return {
    writerKey: author.key,
    workKey: "/works/OL1168007W",
    title: "Animal Farm",
    authorKeys: ["OL118077A"],
    firstPublished: 1945,
    editionCount: 120,
    ratingsCount: 5000,
    ...overrides,
  };
}

describe("Open Library staging policy", () => {
  it("accepts a canonical work linked to the intended single author", () => {
    const result = evaluateOpenLibraryCandidate(candidate(), author);

    expect(result.accepted).toBe(true);
    expect(result.externalId).toBe("OL1168007W");
    expect(result.reasons).toEqual([]);
  });

  it.each([
    ["Animal Farm: A Graphic Novel Adaptation", "adaptation"],
    ["Animal Farm Study Guide", "study-material"],
    ["The Orwell Anthology", "anthology-or-textbook"],
    ["Animal Farm / 1984", "combined-volume"],
  ])("rejects %s as %s", (title, reason) => {
    expect(suspiciousBookTitleReason(title)).toBe(reason);
    expect(evaluateOpenLibraryCandidate(candidate({ title }), author).reasons).toContain(
      reason
    );
  });

  it("rejects an author mismatch, multiple authors and impossible year", () => {
    const result = evaluateOpenLibraryCandidate(
      candidate({
        authorKeys: ["OL999A", "OL998A"],
        firstPublished: 1111,
      }),
      author
    );

    expect(result.reasons).toEqual(
      expect.arrayContaining([
        "author-mismatch",
        "multiple-authors-or-anthology",
        "year-before-author-lifetime",
      ])
    );
  });

  it("rejects one external work assigned to different writers globally", () => {
    const shared = {
      externalId: "OL1168007W",
      title: "Animal Farm",
      qualityScore: 90,
    };
    const result = dedupeOpenLibraryCandidates([
      { ...shared, writerKey: "england:george_orwell" },
      { ...shared, writerKey: "usa:unrelated_writer" },
    ]);

    expect(result.accepted).toEqual([]);
    expect(result.rejected).toHaveLength(2);
    expect(result.rejected[0].rejectionReasons).toContain(
      "external-id-assigned-to-multiple-writers"
    );
  });

  it("keeps only the best duplicate for the same writer and external work", () => {
    const result = dedupeOpenLibraryCandidates([
      {
        writerKey: author.key,
        externalId: "OL1168007W",
        title: "Animal Farm",
        qualityScore: 75,
      },
      {
        writerKey: author.key,
        externalId: "OL1168007W",
        title: "Animal Farm",
        qualityScore: 92,
      },
    ]);

    expect(result.rejected).toEqual([]);
    expect(result.accepted).toHaveLength(1);
    expect(result.accepted[0].qualityScore).toBe(92);
  });
});
