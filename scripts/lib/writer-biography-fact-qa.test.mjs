import { describe, expect, it } from "vitest";

import {
  auditWriterBiographyRecord,
  buildStagingIdentityIndex,
  buildWriterBiographyFactQaReport,
  compareCardDateWithWikidata,
  extractBiographyClaims,
  parsePartialDate,
  parseWikidataTimeClaim,
  partialDatesConflict,
  resolveReliableStagingIdentity,
} from "./writer-biography-fact-qa.mjs";

const sourceConfirmed = {
  status: "source-confirmed",
  source: "https://www.wikidata.org/wiki/Q1",
  issues: [],
};

function staging(writers) {
  return buildStagingIdentityIndex({ test: writers });
}

function wikidataTime({
  value,
  precision = 11,
  calendarId = "Q1985727",
  rank = "normal",
  referenced = true,
  claimId = "Q1$date",
}) {
  return {
    claimId,
    rank,
    referenced,
    referenceCount: referenced ? 1 : 0,
    time: `${value}T00:00:00Z`,
    precision,
    calendarmodel: `http://www.wikidata.org/entity/${calendarId}`,
  };
}

describe("writer biography fact QA", () => {
  it("distinguishes lifespan ranges from years of service", () => {
    expect(
      extractBiographyClaims(
        "Армянский поэт и общественный деятель, живший в 1875-1957 годах."
      ).lifeYearPairs
    ).toEqual([
      { birthYear: 1875, deathYear: 1957, text: "1875-1957" },
    ]);
    expect(
      extractBiographyClaims(
        "В 1950-1952 годах занимал пост министра образования Египта."
      ).lifeYearPairs
    ).toEqual([]);
  });

  it("compares partial dates only at their shared precision", () => {
    expect(parsePartialDate("+1911-12-11")).toEqual({
      year: 1911,
      month: 12,
      day: 11,
      precision: "day",
    });
    expect(partialDatesConflict("1911", "1911-12-11")).toBe(false);
    expect(partialDatesConflict("1911-12", "1911-12-11")).toBe(false);
    expect(partialDatesConflict("1911-11", "1911-12-11")).toBe(true);
    expect(partialDatesConflict("1912", "1911-12-11")).toBe(true);
    expect(parsePartialDate("551 до н. э.")?.year).toBe(-551);
    expect(parsePartialDate("1715 или 1724")).toBeNull();
  });

  it("preserves Wikidata time precision/calendar and distinguishes corroboration from conflicts", () => {
    expect(
      parseWikidataTimeClaim(
        wikidataTime({ value: "+001925-02-00", precision: 10 })
      )
    ).toMatchObject({
      value: "1925-02",
      precision: "month",
      calendarId: "Q1985727",
    });

    expect(
      compareCardDateWithWikidata("1925-02", [
        wikidataTime({ value: "+001925-02-00", precision: 10 }),
      ]).status
    ).toBe("exact-gregorian-match");
    expect(
      compareCardDateWithWikidata("1925-02-14", [
        wikidataTime({ value: "+001925-02-00", precision: 10 }),
      ]).status
    ).toBe("compatible-at-shared-precision");
    expect(
      compareCardDateWithWikidata("1925-02-14", [
        wikidataTime({ value: "+001925-03-14", precision: 11 }),
      ]).status
    ).toBe("wikidata-date-discrepancy");
    expect(
      compareCardDateWithWikidata("1877-11-22", [
        wikidataTime({
          value: "+001877-11-22",
          precision: 11,
          calendarId: "Q1985786",
        }),
      ]).status
    ).toBe("compatible-calendar-unresolved");
    expect(
      compareCardDateWithWikidata("1875-10-30", [
        wikidataTime({
          value: "+001875-10-18",
          precision: 11,
          calendarId: "Q1985786",
        }),
      ])
    ).toMatchObject({
      status: "calendar-equivalent",
      convertedGregorianValue: "1875-10-30",
    });
  });

  it("extracts claim types and exact Nobel/work claims without certifying them", () => {
    const claims = extractBiographyClaims(
      "Русский писатель, лауреат Нобелевской премии 1970 года. Автор романа «Тест» и один из крупнейших прозаиков."
    );
    expect(claims.claimTypes).toEqual(
      expect.arrayContaining(["identity-role", "nobel", "awards", "works", "critical-ranking"])
    );
    expect(claims.nobelYears).toEqual([1970]);

    const lifespanAndNobel = extractBiographyClaims(
      "Дорис Лессинг (1919-2013) - британская писательница, получившая Нобелевскую премию по литературе в 2007 году."
    );
    expect(lifespanAndNobel.nobelYears).toEqual([2007]);
    expect(claims.workTitles).toEqual(["Тест"]);

    const references = extractBiographyClaims(
      "Автор концепции «чудесной реальности». Героиня из романа «Джейн Эйр». Архив «Пробы Пера»."
    );
    expect(references.workTitles).toEqual([]);

    const roleOnly = extractBiographyClaims(
      "Алжирский писатель и романист, писавший по-французски."
    );
    expect(roleOnly.claimTypes).toContain("identity-role");
    expect(roleOnly.claimTypes).not.toContain("works");
  });

  it("accepts a curated key/QID only when the staging identity name agrees", () => {
    const index = staging([
      {
        id: "wikidata-q1",
        fullName: "Иван Петров",
        wikidataId: "Q1",
        birthDate: "1900-01-01",
        verification: sourceConfirmed,
      },
    ]);
    const match = resolveReliableStagingIdentity(
      {
        countryId: "ru",
        writer: { id: "ivan", name: "Иван Петров", birthDate: "1900" },
      },
      index,
      {
        "ru:ivan": {
          wikidataId: "Q1",
          identityRule: "exact-label-and-birth-year",
          sourceUrl: "https://www.wikidata.org/wiki/Q1",
          checkedAt: "2026-08-02",
        },
      }
    );
    expect(match.status).toBe("reliable-match");
    expect(match.method).toBe("curated-key-to-wikidata-id");

    const rejected = resolveReliableStagingIdentity(
      {
        countryId: "ru",
        writer: { id: "other", name: "Другой человек", birthDate: "1900" },
      },
      index,
      {
        "ru:other": {
          wikidataId: "Q1",
          identityRule: "exact-label-and-birth-year",
        },
      }
    );
    expect(rejected.status).toBe("no-reliable-match");
  });

  it("separates year contradictions from day/calendar discrepancies", () => {
    const index = staging([
      {
        id: "wikidata-q1",
        fullName: "Иван Петров",
        wikidataId: "Q1",
        birthDate: "1901-01-01",
        deathDate: "1980-01-02",
        occupationIds: ["Q36180"],
        verification: sourceConfirmed,
        sourceUrl: "https://www.wikidata.org/wiki/Q1",
      },
    ]);
    const audited = auditWriterBiographyRecord(
      {
        countryId: "ru",
        countryName: "Россия",
        writer: {
          id: "ivan",
          name: "Иван Петров",
          birthDate: "1900-01-01",
          deathDate: "1980-01-01",
          bio: "Русский писатель.",
        },
      },
      index,
      {
        "ru:ivan": {
          wikidataId: "Q1",
          identityRule: "exact-label-and-birth-year",
          sourceUrl: "https://www.wikidata.org/wiki/Q1",
          checkedAt: "2026-08-02",
        },
      }
    );
    expect(audited.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "card-birthDate-staging-conflict",
          severity: "high-confidence-source-conflict",
        }),
        expect.objectContaining({
          code: "card-deathDate-staging-conflict",
          severity: "calendar-or-source-discrepancy",
        }),
      ])
    );
    expect(audited.priority).toBe("P0");
  });

  it("keeps a field-specific manual source resolution out of the error queue", () => {
    const index = buildStagingIdentityIndex({
      mali: [
        {
          id: "wikidata-q1",
          fullName: "Амаду Ампате Ба",
          wikidataId: "Q1",
          birthDate: "1900",
          occupationIds: ["Q36180"],
          verification: sourceConfirmed,
        },
      ],
    });
    const audited = auditWriterBiographyRecord(
      {
        countryId: "mali",
        countryName: "Мали",
        writer: {
          id: "amadou_hampate_ba",
          name: "Амаду Ампате Ба",
          birthDate: "1901",
          bio: "Малийский писатель.",
        },
      },
      index,
      {
        "mali:amadou_hampate_ba": {
          wikidataId: "Q1",
          identityRule: "exact-label-and-birth-year",
          sourceUrl: "https://www.wikidata.org/wiki/Q1",
          checkedAt: "2026-08-02",
        },
      }
    );

    expect(audited.issues).toEqual([]);
    expect(audited.manualResolutions).toEqual([
      expect.objectContaining({
        field: "birthDate",
        cardValue: "1901",
        observedStagingValue: "1900",
        decision: "retain-current-card",
      }),
    ]);
    expect(audited.automatedCoverage.manualSourceResolutionApplied).toBe(true);
  });

  it("does not turn BCE or explicitly approximate year labels into contradictions", () => {
    const index = staging([]);
    const confucius = auditWriterBiographyRecord(
      {
        countryId: "china",
        countryName: "Китай",
        writer: {
          id: "confucius",
          name: "Конфуций",
          years: "551-479 до н. э.",
          birthDate: "551 до н. э.",
          deathDate: "479 до н. э.",
          bio: "Китайский мыслитель.",
        },
      },
      index
    );
    const avvakum = auditWriterBiographyRecord(
      {
        countryId: "russia",
        countryName: "Россия",
        writer: {
          id: "avvakum",
          name: "Аввакум",
          years: "1620/1621-1682",
          birthDate: "1620",
          deathDate: "1682",
          bio: "Русский автор.",
        },
      },
      index
    );
    expect(confucius.issues).toEqual([]);
    expect(avvakum.issues).toEqual([]);
  });

  it("reports Nobel/works metadata gaps without promoting any status", () => {
    const audited = auditWriterBiographyRecord(
      {
        countryId: "ru",
        countryName: "Россия",
        writer: {
          id: "ivan",
          name: "Иван Петров",
          bio: "Писатель, лауреат Нобелевской премии 1970 года. Автор романа «Тест».",
          works: [],
        },
      },
      staging([])
    );
    expect(audited.issues.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        "nobel-claim-missing-structured-year",
        "named-work-not-in-structured-list",
      ])
    );
    expect(audited).not.toHaveProperty("editorial");
    expect(audited.automatedCoverage.completeClaimLevelFactCheck).toBe(false);
  });

  it("builds a stable all-record queue regardless of public input order", () => {
    const publicRecords = [
      {
        countryId: "b",
        countryName: "B",
        writer: { id: "two", name: "Два", bio: "Писатель." },
      },
      {
        countryId: "a",
        countryName: "A",
        writer: { id: "one", name: "Один", bio: "Поэт." },
      },
    ];
    const options = { stagingPayload: {}, curatedQids: {} };
    const first = buildWriterBiographyFactQaReport({ publicRecords, ...options });
    const second = buildWriterBiographyFactQaReport({
      publicRecords: [...publicRecords].reverse(),
      ...options,
    });
    expect(first.records.map((record) => record.key)).toEqual(["a:one", "b:two"]);
    expect(second.records).toEqual(first.records);
    expect(second.sourceFingerprint).toEqual(first.sourceFingerprint);
    expect(first.scope.claimLevelFactChecksCompletedByAutomation).toBe(0);
    expect(first.scope.statusesChanged).toBe(false);
  });

  it("uses the offline Wikidata snapshot only as a separate structured triage layer", () => {
    const report = buildWriterBiographyFactQaReport({
      publicRecords: [
        {
          countryId: "test",
          countryName: "Test",
          writer: {
            id: "writer",
            name: "Writer",
            birthDate: "1900-01-02",
            bio: "Writer.",
          },
        },
      ],
      stagingPayload: {},
      curatedQids: {
        "test:writer": {
          wikidataId: "Q1",
          identityRule: "exact-label-and-birth-year",
          sourceUrl: "https://www.wikidata.org/wiki/Q1",
          checkedAt: "2026-08-02",
        },
      },
      wikidataSnapshot: {
        retrievedAt: "2026-08-09T00:00:00.000Z",
        source: { qidSetSha256: "fixture", properties: ["P569", "P106"] },
        counts: { requestedQids: 1, returnedEntities: 1 },
        entities: [
          {
            qid: "Q1",
            labels: { en: "Writer" },
            claims: {
              P31: [{ entityId: "Q5" }],
              P106: [{ entityId: "Q36180" }],
              P569: [
                wikidataTime({ value: "+001910-01-02", precision: 11 }),
              ],
            },
          },
        ],
      },
    });

    expect(report.summary.wikidataSnapshotCandidateRecords).toBe(1);
    expect(report.summary.wikidataIdentityDiscrepantRecords).toBe(1);
    expect(report.summary.wikidataUnresolvedDateDiscrepancies).toBe(1);
    expect(report.wikidataDateDiscrepancyQueue).toEqual([
      expect.objectContaining({
        key: "test:writer",
        qid: "Q1",
        field: "birthDate",
        cardValue: "1900-01-02",
        classification: "likely-bad-qid-mapping-or-identity",
      }),
    ]);
    expect(report.records[0].issues).toEqual([]);
    expect(report.scope.claimLevelFactChecksCompletedByAutomation).toBe(0);
    expect(report.scope.statusesChanged).toBe(false);
  });
});
