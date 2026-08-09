import { describe, expect, it } from "vitest";

import {
  mergeIdentityCandidates,
  selectUniqueWriterCandidate,
} from "./curated-writer-identity.mjs";

describe("curated writer identity resolution", () => {
  it("rejects a unique exact-label human whose birth year conflicts", () => {
    const result = selectUniqueWriterCandidate(
      [
        {
          qid: "Q3261882",
          human: true,
          birthYears: ["1910"],
          literaryOccupationIds: ["Q36180"],
        },
      ],
      "1888"
    );

    expect(result).toEqual({
      candidate: null,
      reason: "birth-year-mismatch-or-missing",
    });
  });

  it("does not treat a missing candidate birth year as a match", () => {
    const result = selectUniqueWriterCandidate(
      [
        {
          qid: "Q1",
          human: true,
          birthYears: [],
          literaryOccupationIds: ["Q49757"],
        },
      ],
      "1952"
    );

    expect(result.reason).toBe("birth-year-mismatch-or-missing");
    expect(result.candidate).toBeNull();
  });

  it("requires a literary occupation or literary description", () => {
    const result = selectUniqueWriterCandidate(
      [
        {
          qid: "Q3611840",
          human: true,
          birthYears: ["1970"],
          literaryOccupationIds: [],
          descriptions: { en: "British tennis umpire" },
        },
      ],
      ""
    );

    expect(result.reason).toBe("literary-identity-not-established");
    expect(result.candidate).toBeNull();
  });

  it("accepts a single human with matching year and literary evidence", () => {
    const result = selectUniqueWriterCandidate(
      [
        {
          qid: "Q37767",
          human: true,
          birthYears: ["1888"],
          literaryOccupationIds: ["Q36180"],
        },
      ],
      "1888"
    );

    expect(result.reason).toBeNull();
    expect(result.candidate?.qid).toBe("Q37767");
  });

  it("merges repeated SPARQL rows before deciding uniqueness", () => {
    const merged = mergeIdentityCandidates([
      {
        qid: "Q37767",
        birthYears: ["1888"],
        literaryOccupationIds: ["Q36180"],
      },
      {
        qid: "Q37767",
        birthYears: ["1888"],
        literaryOccupationIds: ["Q49757"],
        descriptions: { en: "American-British poet and writer" },
      },
    ]);

    expect(merged).toHaveLength(1);
    expect(merged[0].literaryOccupationIds).toEqual(["Q36180", "Q49757"]);
  });
});
