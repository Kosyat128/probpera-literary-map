import { describe, expect, it } from "vitest";

import { isBookEvidenceV2Ready } from "../bookEvidence";
import { isPublicBook } from "../bookQuality";
import { bookArchiveCountries } from "./index";
import {
  applyBookEvidenceV2LegacyVerifiedReaudit01,
  applyBookEvidenceV2LegacyVerifiedReaudit01Work,
  bookEvidenceV2LegacyVerifiedReaudit01AcceptedRecordKeys,
  bookEvidenceV2LegacyVerifiedReaudit01Counts,
  bookEvidenceV2LegacyVerifiedReaudit01Holds,
  bookEvidenceV2LegacyVerifiedReaudit01RecordKeys,
  bookEvidenceV2LegacyVerifiedReaudit01Urls,
} from "./bookEvidenceV2LegacyVerifiedReaudit01";

function findWork(
  countries: typeof bookArchiveCountries,
  recordKey: string
) {
  const [countryId, writerId, workId] = recordKey.split(":");
  const work = countries
    .find((country) => country.id === countryId)
    ?.writers.find((writer) => writer.id === writerId)
    ?.workDetails?.find((candidate) => candidate.id === workId);
  expect(work, recordKey).toBeDefined();
  return work!;
}

describe("book Evidence V2 legacy verified re-audit 01", () => {
  it("reviews the exact five requested keys and holds all five fail-closed", () => {
    expect(bookEvidenceV2LegacyVerifiedReaudit01RecordKeys).toEqual([
      "chile:pablo_neruda:twenty-love-poems",
      "egypt:naguib_mahfouz:cairo-trilogy",
      "egypt:naguib_mahfouz:midaq-alley",
      "egypt:naguib_mahfouz:the-thief-and-the-dogs",
      "india:rabindranath_tagore:gitanjali",
    ]);
    expect(bookEvidenceV2LegacyVerifiedReaudit01AcceptedRecordKeys).toEqual([]);
    expect(bookEvidenceV2LegacyVerifiedReaudit01Counts).toEqual({
      reviewed: 5,
      accepted: 0,
      held: 5,
    });
    expect(bookEvidenceV2LegacyVerifiedReaudit01Holds).toHaveLength(5);
    expect(
      bookEvidenceV2LegacyVerifiedReaudit01Holds.map((hold) => hold.recordKey)
    ).toEqual(bookEvidenceV2LegacyVerifiedReaudit01RecordKeys);
    expect(
      bookEvidenceV2LegacyVerifiedReaudit01Holds.every(
        (hold) => hold.status === "fail-closed"
      )
    ).toBe(true);
  });

  it("retains only official or institutional research URLs", () => {
    const allowedHosts = new Set([
      "lccn.loc.gov",
      "www.penguinrandomhouse.com",
      "www.memoriachilena.gob.cl",
      "cultura.fundacionneruda.org",
      "aucpress.com",
      "sis.gov.eg",
      "search.rsl.ru",
      "static.macmillan.com",
      "www.visvabharati.ac.in",
      "www.hcicolombo.gov.in",
    ]);

    expect(new Set(bookEvidenceV2LegacyVerifiedReaudit01Urls).size).toBe(
      bookEvidenceV2LegacyVerifiedReaudit01Urls.length
    );
    for (const hold of bookEvidenceV2LegacyVerifiedReaudit01Holds) {
      expect(hold.sources.length, hold.recordKey).toBeGreaterThanOrEqual(3);
      expect(new Set(hold.sources.map((source) => source.url)).size).toBe(
        hold.sources.length
      );
      for (const source of hold.sources) {
        const url = new URL(source.url);
        expect(url.protocol, source.url).toBe("https:");
        expect(allowedHosts.has(url.hostname), source.url).toBe(true);
      }
      expect(hold.descriptionDisposition).toBe(
        "not-published-until-title-and-entity-resolution"
      );
    }
  });

  it("records the title-specific blockers without promoting research to evidence", () => {
    const holds = new Map(
      bookEvidenceV2LegacyVerifiedReaudit01Holds.map((hold) => [
        hold.recordKey,
        hold,
      ])
    );

    expect(
      holds.get("chile:pablo_neruda:twenty-love-poems")?.reason
    ).toContain("разночтение заглавия");
    expect(
      holds
        .get("egypt:naguib_mahfouz:cairo-trilogy")
        ?.sources.map((source) => source.url)
    ).toEqual(
      expect.arrayContaining([
        "https://lccn.loc.gov/2001277061",
        expect.stringContaining("penguinrandomhouse.com/books/106192/"),
      ])
    );
    expect(
      holds.get("egypt:naguib_mahfouz:midaq-alley")?.reason
    ).toContain("неофициальные переводы");
    expect(
      holds.get("egypt:naguib_mahfouz:the-thief-and-the-dogs")
    ).toEqual(
      expect.objectContaining({
        code: "ru-independent-attestation-missing",
        sources: expect.arrayContaining([
          expect.objectContaining({
            url: "https://search.rsl.ru/ru/record/01006403702",
            role: "ru-title",
            outcome: "partial",
          }),
          expect.objectContaining({
            url: "https://lccn.loc.gov/89007892",
          }),
          expect.objectContaining({
            url: "https://aucpress.com/9789774167041/",
          }),
        ]),
      })
    );
    expect(holds.get("india:rabindranath_tagore:gitanjali")).toEqual(
      expect.objectContaining({
        code: "work-expression-boundary-unresolved",
        unresolvedLocales: ["ru", "en"],
        reason: expect.stringMatching(/157.*103/),
      })
    );
  });

  it("downgrades every target while preserving its bibliographic payload", () => {
    const output = applyBookEvidenceV2LegacyVerifiedReaudit01(
      bookArchiveCountries
    );
    const holdsByKey = new Map(
      bookEvidenceV2LegacyVerifiedReaudit01Holds.map((hold) => [
        hold.recordKey,
        hold,
      ])
    );

    for (const recordKey of bookEvidenceV2LegacyVerifiedReaudit01RecordKeys) {
      const before = findWork(bookArchiveCountries, recordKey);
      const after = findWork(output, recordKey);
      expect(after.title, recordKey).toBe(before.title);
      expect(after.description, recordKey).toBe(before.description);
      expect(after.localizedTitles, recordKey).toEqual(before.localizedTitles);
      expect(after.canon, recordKey).toEqual(before.canon);
      expect(after.sources, recordKey).toEqual(before.sources);
      expect(after.editorial?.status, recordKey).toBe("draft");
      expect(after.editorial?.reviewedAt, recordKey).toBe("2026-09-02");
      expect(
        (after as typeof after & { evidenceV2Hold?: unknown }).evidenceV2Hold,
        recordKey
      ).toEqual(holdsByKey.get(recordKey));
      if (after.translations?.ru) {
        expect(after.translations.ru.status, recordKey).toBe("draft");
      }
      if (after.translations?.en) {
        expect(after.translations.en.status, recordKey).toBe("draft");
      }
      expect(isPublicBook(after), recordKey).toBe(false);
      expect(isBookEvidenceV2Ready(after), recordKey).toBe(false);
    }
  });

  it("is immutable, idempotent by value, and a reference no-op outside scope", () => {
    const input = {
      id: "unrelated-work",
      title: "Другая книга",
      editorial: { status: "verified" as const },
    };
    expect(
      applyBookEvidenceV2LegacyVerifiedReaudit01Work(
        "chile",
        "pablo_neruda",
        input
      )
    ).toBe(input);

    const once = applyBookEvidenceV2LegacyVerifiedReaudit01(
      bookArchiveCountries
    );
    const twice = applyBookEvidenceV2LegacyVerifiedReaudit01(once);
    for (const recordKey of bookEvidenceV2LegacyVerifiedReaudit01RecordKeys) {
      expect(findWork(twice, recordKey), recordKey).toEqual(
        findWork(once, recordKey)
      );
    }
  });

  it("fails closed if any of the five target records is absent", () => {
    expect(() => applyBookEvidenceV2LegacyVerifiedReaudit01([])).toThrow(
      /target-cardinality/
    );
  });
});
