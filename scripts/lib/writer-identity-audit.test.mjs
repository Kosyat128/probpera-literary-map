import { describe, expect, it } from "vitest";

import {
  auditWriterIdentityRecord,
  namesCompatible,
  summarizeWriterIdentityAudit,
  yearFromValue,
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

  it("compares zero-padded years numerically", () => {
    expect(yearFromValue("+01801-08-17T00:00:00Z")).toBe("1801");
    expect(yearFromValue("01801-08-17")).toBe("1801");

    const record = auditWriterIdentityRecord({
      key: "finland:fredrika_bremer",
      mapping: { wikidataId: "Q262145" },
      writer: {
        id: "fredrika_bremer",
        name: "Fredrika Bremer",
        birthDate: "1801-08-17",
      },
      entity: entity({
        qid: "Q262145",
        label: "Fredrika Bremer",
        birth: "+01801-08-17T00:00:00Z",
      }),
    });

    expect(record.birth).toMatchObject({
      status: "match",
      localYear: "1801",
      externalYears: ["1801"],
    });
    expect(record.classification).toBe("corroborated");
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

  it("accepts an authority-backed identity when Wikidata carries the wrong birth year", () => {
    const record = auditWriterIdentityRecord({
      key: "guatemala:luis_cardoza_y_aragon",
      mapping: { wikidataId: "Q6700406" },
      writer: {
        id: "luis_cardoza_y_aragon",
        name: "Luis Cardoza y Aragon",
        birthDate: "1901-06-21",
      },
      entity: entity({
        qid: "Q6700406",
        label: "Luis Cardoza y Aragon",
        birth: "+1904-06-21T00:00:00Z",
      }),
      manualConfirmation: {
        qid: "Q6700406",
        note: "Two official Guatemalan biographies establish the identity and date.",
        sources: [
          { title: "RENAP", url: "https://www.renap.gob.gt/example.pdf" },
          { title: "MCD", url: "https://mcd.gob.gt/example.pdf" },
        ],
      },
    });

    expect(record.birth.status).toBe("conflict");
    expect(record.classification).toBe("corroborated");
    expect(record.manuallyCorroborated).toBe(true);
    expect(record.manualConfirmation?.qid).toBe("Q6700406");
    expect(record.issues).not.toContain("birth-year-conflict");
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
