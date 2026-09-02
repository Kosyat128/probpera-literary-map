import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import canonRegistry from "../../../data/book-canon-source-registry.json";
import {
  bookDescriptionProvenanceIssues,
  localizedBookTitleEvidenceIssues,
} from "../bookEvidence";
import { bookArchiveCountries } from "./index";
import {
  applyBookEvidenceV2PublicBatch05,
  applyBookEvidenceV2PublicBatch05Work,
  bookEvidenceV2PublicBatch05AuthorityDrafts,
  bookEvidenceV2PublicBatch05Holds,
  bookEvidenceV2PublicBatch05RecordKeys,
  bookEvidenceV2PublicBatch05RequiredAuthorityIds,
  bookEvidenceV2PublicBatch05ResolvedRecordKeys,
} from "./bookEvidenceV2PublicBatch05";
import type { Country, WorkLocale, WorkProfile } from "./types";

const authorityIds = new Set(
  canonRegistry.authorities.map((authority) => authority.authorityId)
);
const augmentedRegistry = {
  ...canonRegistry,
  authorities: [
    ...canonRegistry.authorities,
    ...bookEvidenceV2PublicBatch05AuthorityDrafts.filter(
      (authority) => !authorityIds.has(authority.authorityId)
    ),
  ],
};

const expectedTitles = [
  {
    recordKey: "russia:dostoevsky:crime-and-punishment",
    ru: "Преступление и наказание",
    en: "Crime and Punishment",
    origin: "russia",
    status: "resolved",
  },
  {
    recordKey: "russia:tolstoy:war-and-peace",
    ru: "Война и мир",
    en: "War and Peace",
    origin: "russia",
    status: "resolved",
  },
  {
    recordKey: "russia:chekhov:the-duel",
    ru: "Дуэль",
    en: "The Duel",
    origin: "russia",
    status: "resolved",
  },
  {
    recordKey: "russia:chekhov:the-black-monk",
    ru: "Черный монах",
    en: "The Black Monk",
    origin: "russia",
    status: "hold",
  },
  {
    recordKey: "russia:chekhov:uncle-vanya",
    ru: "Дядя Ваня",
    en: "Uncle Vanya",
    origin: "russia",
    status: "resolved",
  },
  {
    recordKey: "russia:chekhov:the-man-in-a-case",
    ru: "Человек в футляре",
    en: "The Man in a Case",
    origin: "russia",
    status: "hold",
  },
  {
    recordKey: "russia:chekhov:the-lady-with-the-dog",
    ru: "Дама с собачкой",
    en: "The Lady with the Dog",
    origin: "russia",
    status: "hold",
  },
  {
    recordKey:
      "spain:miguel_de_cervantes:openlibrary-works-ol15272537w",
    ru: "Дон Кихот",
    en: "Don Quixote",
    origin: "spain",
    status: "resolved",
  },
] as const;

const donQuixoteFixture: WorkProfile = {
  id: "openlibrary-works-ol15272537w",
  title: "Don Quixote",
};

const batchFixtureCountries: Country[] = bookArchiveCountries.map((country) =>
  country.id !== "spain"
    ? country
    : {
        ...country,
        writers: country.writers.map((writer) =>
          writer.id !== "miguel_de_cervantes"
            ? writer
            : {
                ...writer,
                workDetails: [
                  ...(writer.workDetails || []),
                  donQuixoteFixture,
                ],
              }
        ),
      }
);

const appliedCountries = applyBookEvidenceV2PublicBatch05(
  batchFixtureCountries
);

function workByRecordKey(
  countries: Country[],
  recordKey: string
): WorkProfile {
  const [countryId, writerId, workId] = recordKey.split(":");
  const work = countries
    .find((country) => country.id === countryId)
    ?.writers.find((writer) => writer.id === writerId)
    ?.workDetails?.find((candidate) => candidate.id === workId);
  expect(work, recordKey).toBeDefined();
  return work!;
}

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function sentenceCount(value: string) {
  return value.match(/[.!?](?=\s|$)/gu)?.length || 0;
}

describe("public book evidence V2 batch 05", () => {
  it("covers exactly the eight assigned records and resolves five", () => {
    expect(new Set(bookEvidenceV2PublicBatch05RecordKeys)).toEqual(
      new Set(expectedTitles.map((item) => item.recordKey))
    );
    expect(new Set(bookEvidenceV2PublicBatch05ResolvedRecordKeys)).toEqual(
      new Set(
        expectedTitles
          .filter((item) => item.status === "resolved")
          .map((item) => item.recordKey)
      )
    );
    expect(bookEvidenceV2PublicBatch05Holds).toHaveLength(3);
  });

  it("applies exact reviewed RU and EN display titles without canon claims", () => {
    for (const expected of expectedTitles) {
      const work = workByRecordKey(appliedCountries, expected.recordKey);
      expect(work.title, `${expected.recordKey}:work`).toBe(expected.ru);
      expect(work.translations?.ru?.title, `${expected.recordKey}:ru`).toBe(
        expected.ru
      );
      expect(work.translations?.en?.title, `${expected.recordKey}:en`).toBe(
        expected.en
      );
      expect(work.localizedTitles?.ru?.value).toBe(expected.ru);
      expect(work).not.toHaveProperty("canon");
    }
  });

  it("passes the Tier A plus independent-edition title gate for all resolved locales", () => {
    for (const expected of expectedTitles) {
      const work = workByRecordKey(appliedCountries, expected.recordKey);
      expect(
        localizedBookTitleEvidenceIssues(work, "ru", {
          canonRegistry: augmentedRegistry,
        }),
        `${expected.recordKey}:ru`
      ).toEqual([]);

      const ruEvidence = work.localizedTitles?.ru?.evidence || [];
      expect(ruEvidence).toHaveLength(2);
      expect(new Set(ruEvidence.map((item) => item.authorityId)).size).toBe(2);
      expect(
        ruEvidence.some(
          (item) =>
            item.authorityTier === "A" &&
            ["national-bibliography", "legal-deposit-catalog"].includes(
              item.recordKind
            )
        )
      ).toBe(true);

      if (expected.status === "resolved") {
        expect(
          localizedBookTitleEvidenceIssues(work, "en", {
            canonRegistry: augmentedRegistry,
          }),
          `${expected.recordKey}:en`
        ).toEqual([]);
        const enEvidence = work.localizedTitles?.en?.evidence || [];
        expect(enEvidence).toHaveLength(2);
        expect(new Set(enEvidence.map((item) => item.authorityId)).size).toBe(
          2
        );
        expect(
          enEvidence.some(
            (item) =>
              item.authorityTier === "A" &&
              ["national-bibliography", "legal-deposit-catalog"].includes(
                item.recordKind
              )
          )
        ).toBe(true);
        expect(work.editorial?.status).toBe("verified");
      }
    }
  });

  it("keeps three unresolved EN manifestations explicitly fail-closed", () => {
    for (const hold of bookEvidenceV2PublicBatch05Holds) {
      const work = workByRecordKey(appliedCountries, hold.recordKey);
      expect(hold).toMatchObject({
        status: "fail-closed",
        locale: "en",
        code: "en-exact-national-record-unresolved",
      });
      expect(hold.reviewedCatalogs).toHaveLength(2);
      expect(hold.rejectedAggregateTitles.length).toBeGreaterThanOrEqual(1);
      expect(hold.resolutionCriteria).toHaveLength(3);
      expect(work.localizedTitles?.en).toBeUndefined();
      expect(work.translations?.en?.titleEvidence).toBeUndefined();
      expect(work.editorial?.status).toBe("reviewed");
      expect(work.translations?.ru?.status).toBe("reviewed");
      expect(work.translations?.en?.status).toBe("reviewed");
      expect(
        localizedBookTitleEvidenceIssues(work, "en", {
          canonRegistry: augmentedRegistry,
        })
      ).toContain("missing-en-published-title-evidence");
    }
  });

  it("uses two-source original RU syntheses and SHA-linked manual EN translations", () => {
    const authorityById = new Map(
      augmentedRegistry.authorities.map((authority) => [
        authority.authorityId,
        authority,
      ])
    );

    for (const expected of expectedTitles) {
      const work = workByRecordKey(appliedCountries, expected.recordKey);
      const ru = work.translations?.ru;
      const en = work.translations?.en;
      expect(ru?.method).toBe("editorial-original");
      expect(en?.method).toBe("human-translation");
      expect(ru?.descriptionProvenance?.origin).toBe(
        "official-source-synthesis"
      );
      expect(en?.descriptionProvenance?.origin).toBe("human-translation");
      expect(sentenceCount(ru?.description || "")).toBeGreaterThanOrEqual(2);
      expect(sentenceCount(ru?.description || "")).toBeLessThanOrEqual(3);
      expect(sentenceCount(en?.description || "")).toBeGreaterThanOrEqual(2);
      expect(sentenceCount(en?.description || "")).toBeLessThanOrEqual(3);

      const ruHash = sha256(ru?.description || "");
      expect(en?.descriptionProvenance?.translatedFromSourceHash).toBe(ruHash);
      const context = {
        canonRegistry: augmentedRegistry,
        originCountryIds: [expected.origin],
        descriptionSha256ByLocale: { ru: ruHash },
      };
      for (const locale of ["ru", "en"] as WorkLocale[]) {
        expect(
          bookDescriptionProvenanceIssues(work, locale, context),
          `${expected.recordKey}:${locale}-description`
        ).toEqual([]);
      }

      const sourceByUrl = new Map(
        (work.sources || []).map((source) => [source.url, source])
      );
      const descriptionSources = (
        ru?.descriptionProvenance?.sourceUrls || []
      ).map((url) => sourceByUrl.get(url)!);
      expect(descriptionSources).toHaveLength(2);
      expect(
        new Set(
          descriptionSources.map(
            (source) =>
              authorityById.get(source.authorityId!)?.independenceGroup
          )
        ).size,
        expected.recordKey
      ).toBeGreaterThanOrEqual(2);
      expect(
        descriptionSources.some(
          (source) =>
            authorityById.get(source.authorityId!)?.authorityCountryId ===
            expected.origin
        )
      ).toBe(true);
    }
  });

  it("exports a pure work-level applicator and is immutable and idempotent", () => {
    const sourceSnapshot = JSON.stringify(batchFixtureCountries);
    const first = applyBookEvidenceV2PublicBatch05(batchFixtureCountries);
    const second = applyBookEvidenceV2PublicBatch05(first);
    expect(JSON.stringify(batchFixtureCountries)).toBe(sourceSnapshot);
    expect(second).toEqual(first);

    for (const expected of expectedTitles) {
      const before = workByRecordKey(batchFixtureCountries, expected.recordKey);
      const [countryId, writerId] = expected.recordKey.split(":");
      const direct = applyBookEvidenceV2PublicBatch05Work(
        countryId,
        writerId,
        before
      );
      const after = workByRecordKey(first, expected.recordKey);
      expect(direct).toEqual(after);
      expect(after.coverUrl).toBe(before.coverUrl);
      expect(after.coverThumbnailUrl).toBe(before.coverThumbnailUrl);
      expect(after.coverRights).toEqual(before.coverRights);
    }
  });

  it("declares every controlled authority needed before registry integration", () => {
    const declared = new Set(bookEvidenceV2PublicBatch05RequiredAuthorityIds);
    for (const expected of expectedTitles) {
      const work = workByRecordKey(appliedCountries, expected.recordKey);
      const authorityIds = (work.sources || [])
        .map((source) => source.authorityId)
        .filter((authorityId): authorityId is string => Boolean(authorityId));
      for (const authorityId of authorityIds) {
        expect(declared.has(authorityId), authorityId).toBe(true);
      }
    }
    expect(
      bookEvidenceV2PublicBatch05AuthorityDrafts.map(
        (authority) => authority.authorityId
      )
    ).toEqual([
      "feb-web",
      "dostoevsky-museum-spb",
      "tolstoy-museum",
      "chekhov-museum-melikhovo",
      "bne",
      "instituto-cervantes",
      "grove-atlantic",
    ]);
  });

  it("fails closed if any assigned Work is absent", () => {
    expect(() => applyBookEvidenceV2PublicBatch05([])).toThrow(
      "book-evidence-v2-public-batch-05-target-cardinality"
    );
  });
});
