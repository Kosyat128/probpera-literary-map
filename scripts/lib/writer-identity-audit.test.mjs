import { describe, expect, it } from "vitest";

import {
  auditWriterIdentityRecord,
  namesCompatible,
  summarizeWriterIdentityAudit,
} from "./writer-identity-audit.mjs";

function entity({
  qid = "Q1",
  label = "Test Writer",
  description = "writer and poet",
  birth = "+1901-00-00T00:00:00Z",
  occupations = ["Q36180"],
} = {}) {
  return {
    qid,
    labels: { en: label },
    descriptions: { en: description },
    claims: {
      P31: [{ entityId: "Q5" }],
      P569: birth ? [{ time: birth }] : [],
      P106: occupations.map((entityId) => ({ entityId })),
    },
  };
}

describe("writer identity audit", () => {
  it("accepts initials and established short-name forms", () => {
    expect(
      namesCompatible(["Thomas Stearns Eliot"], ["T. S. Eliot"])
    ).toBe("compatible");
    expect(namesCompatible(["Leslie Allan Murray"], ["Les Murray"])).toBe(
      "compatible"
    );
  });

  it("corroborates a human literary identity only with a matching birth year", () => {
    const record = auditWriterIdentityRecord({
      key: "test:test_writer",
      mapping: { wikidataId: "Q1" },
      writer: {
        id: "test_writer",
        name: "Test Writer",
        birthDate: "1901-05-06",
      },
      entity: entity(),
    });

    expect(record.classification).toBe("corroborated");
    expect(record.issues).toEqual([]);
  });

  it("routes date conflicts and non-literary descriptions to review", () => {
    const record = auditWriterIdentityRecord({
      key: "test:test_writer",
      mapping: { wikidataId: "Q2" },
      writer: {
        id: "test_writer",
        name: "Test Writer",
        birthDate: "1901",
      },
      entity: entity({
        qid: "Q2",
        description: "British tennis umpire",
        birth: "+1970-00-00T00:00:00Z",
        occupations: [],
      }),
    });

    expect(record.classification).toBe("review-required");
    expect(record.issues).toEqual(
      expect.arrayContaining([
        "birth-year-conflict",
        "literary-role-not-corroborated",
      ])
    );
  });

  it("summarizes every audited record exactly once", () => {
    const summary = summarizeWriterIdentityAudit([
      { classification: "corroborated", nameStatus: "exact", human: true },
      {
        classification: "review-required",
        nameStatus: "compatible",
        human: true,
        literaryEvidence: true,
        literaryOccupationIds: [],
      },
      { classification: "blocked", nameStatus: "conflict", human: false },
    ]);

    expect(summary.activeMappingsAudited).toBe(3);
    expect(summary.classificationCounts).toEqual({
      blocked: 1,
      corroborated: 1,
      "review-required": 1,
    });
  });
});
