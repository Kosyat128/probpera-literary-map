import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import canonRegistry from "../../../data/book-canon-source-registry.json";
import {
  bookDescriptionProvenanceIssues,
  localizedBookTitleEvidenceIssues,
} from "../bookEvidence";
import { bookArchiveCountries } from "./index";
import {
  applyBookEvidenceV2PublicBatch03,
  bookEvidenceV2PublicBatch03AuthorityDrafts,
  bookEvidenceV2PublicBatch03Holds,
  bookEvidenceV2PublicBatch03RecordKeys,
  bookEvidenceV2PublicBatch03RequiredAuthorityIds,
  bookEvidenceV2PublicBatch03ResolvedRecordKeys,
} from "./bookEvidenceV2PublicBatch03";
import type { Country, WorkLocale, WorkProfile } from "./types";

const authorityIds = new Set(
  canonRegistry.authorities.map((authority) => authority.authorityId)
);
const augmentedRegistry = {
  ...canonRegistry,
  authorities: [
    ...canonRegistry.authorities,
    ...bookEvidenceV2PublicBatch03AuthorityDrafts.filter(
      (authority) => !authorityIds.has(authority.authorityId)
    ),
  ],
};

const expectedTitles = [
  {
    recordKey: "england:george_orwell:animal-farm-editorial",
    ru: "Скотный двор",
    en: "Animal Farm",
    status: "resolved",
  },
  {
    recordKey: "england:george_orwell:nineteen-eighty-four",
    ru: "1984",
    en: "1984",
    status: "resolved",
  },
  {
    recordKey: "england:john_galsworthy:the-forsyte-saga",
    ru: "Сага о Форсайтах",
    en: "The Forsyte Saga",
    status: "resolved",
  },
  {
    recordKey: "england:david_mitchell:ghostwritten",
    ru: "Литературный призрак",
    en: "Ghostwritten",
    status: "hold",
  },
  {
    recordKey: "england:david_mitchell:number9dream",
    ru: "Сон № 9",
    en: "Number9Dream",
    status: "hold",
  },
  {
    recordKey:
      "england:david_mitchell:the-thousand-autumns-of-jacob-de-zoet",
    ru: "Тысяча осеней Якоба де Зута",
    en: "The Thousand Autumns of Jacob de Zoet",
    status: "resolved",
  },
  {
    recordKey: "england:david_mitchell:the-bone-clocks",
    ru: "Костяные часы",
    en: "The Bone Clocks",
    status: "hold",
  },
  {
    recordKey: "england:david_mitchell:slade-house",
    ru: "Голодный дом",
    en: "Slade House",
    status: "hold",
  },
] as const;

const appliedCountries = applyBookEvidenceV2PublicBatch03(
  bookArchiveCountries
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

describe("public book evidence V2 batch 03", () => {
  it("covers exactly the eight assigned public records", () => {
    expect(new Set(bookEvidenceV2PublicBatch03RecordKeys)).toEqual(
      new Set(expectedTitles.map((item) => item.recordKey))
    );
    expect(new Set(bookEvidenceV2PublicBatch03ResolvedRecordKeys)).toEqual(
      new Set(
        expectedTitles
          .filter((item) => item.status === "resolved")
          .map((item) => item.recordKey)
      )
    );
    expect(bookEvidenceV2PublicBatch03Holds).toHaveLength(4);
  });

  it("applies exact reviewed RU and EN display titles", () => {
    for (const expected of expectedTitles) {
      const work = workByRecordKey(appliedCountries, expected.recordKey);
      expect(work.title, `${expected.recordKey}:work`).toBe(expected.ru);
      expect(work.translations?.ru?.title, `${expected.recordKey}:ru`).toBe(
        expected.ru
      );
      expect(work.translations?.en?.title, `${expected.recordKey}:en`).toBe(
        expected.en
      );
      expect(work.localizedTitles?.en?.value).toBe(expected.en);
      expect(work).not.toHaveProperty("canon");
    }
  });

  it("passes the two-record Tier A plus independent publisher title gate for four resolved cards", () => {
    for (const recordKey of bookEvidenceV2PublicBatch03ResolvedRecordKeys) {
      const work = workByRecordKey(appliedCountries, recordKey);
      for (const locale of ["ru", "en"] as WorkLocale[]) {
        expect(
          localizedBookTitleEvidenceIssues(work, locale, {
            canonRegistry: augmentedRegistry,
          }),
          `${recordKey}:${locale}`
        ).toEqual([]);
        const evidence = work.localizedTitles?.[locale]?.evidence || [];
        expect(evidence).toHaveLength(2);
        expect(new Set(evidence.map((item) => item.authorityId)).size).toBe(2);
        expect(
          evidence.some(
            (item) =>
              item.authorityTier === "A" &&
              ["national-bibliography", "legal-deposit-catalog"].includes(
                item.recordKind
              )
          )
        ).toBe(true);
      }
      expect(work.editorial?.status).toBe("verified");
    }
  });

  it("keeps four Mitchell RU manifestations fail-closed with explicit unblock criteria", () => {
    for (const hold of bookEvidenceV2PublicBatch03Holds) {
      const work = workByRecordKey(appliedCountries, hold.recordKey);
      expect(hold).toMatchObject({
        status: "fail-closed",
        locale: "ru",
        code: "ru-national-record-unresolved",
      });
      expect(hold.resolutionCriteria).toHaveLength(3);
      expect(hold.publisherEvidence.length).toBeGreaterThanOrEqual(1);
      expect(
        hold.publisherEvidence.every(
          (evidence) => evidence.recordKind === "publisher-catalog"
        )
      ).toBe(true);
      expect(work.localizedTitles?.ru).toBeUndefined();
      expect(work.translations?.ru?.titleEvidence).toBeUndefined();
      expect(work.editorial?.status).toBe("reviewed");
      expect(work.translations?.ru?.status).toBe("reviewed");
      expect(work.translations?.en?.status).toBe("reviewed");
      expect(
        localizedBookTitleEvidenceIssues(work, "ru", {
          canonRegistry: augmentedRegistry,
        })
      ).toContain("missing-ru-published-title-evidence");
      expect(
        localizedBookTitleEvidenceIssues(work, "en", {
          canonRegistry: augmentedRegistry,
        }),
        `${hold.recordKey}:en`
      ).toEqual([]);
    }
  });

  it("uses original RU syntheses and SHA-linked manual EN translations", () => {
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
        originCountryIds: ["england"],
        descriptionSha256ByLocale: { ru: ruHash },
      };
      expect(
        bookDescriptionProvenanceIssues(work, "ru", context),
        `${expected.recordKey}:ru-description`
      ).toEqual([]);
      expect(
        bookDescriptionProvenanceIssues(work, "en", context),
        `${expected.recordKey}:en-description`
      ).toEqual([]);

      const sourceByUrl = new Map(
        (work.sources || []).map((source) => [source.url, source])
      );
      const originGroups = new Set(
        (ru?.descriptionProvenance?.sourceUrls || [])
          .map((url) => sourceByUrl.get(url)?.authorityId)
          .map((authorityId) =>
            authorityId ? authorityById.get(authorityId) : undefined
          )
          .filter(
            (authority) => authority?.authorityCountryId === "england"
          )
          .map((authority) => authority!.independenceGroup)
      );
      expect(originGroups.size, expected.recordKey).toBeGreaterThanOrEqual(2);
    }
  });

  it("is immutable, idempotent, and preserves existing cover assets", () => {
    const sourceSnapshot = JSON.stringify(bookArchiveCountries);
    const first = applyBookEvidenceV2PublicBatch03(bookArchiveCountries);
    const second = applyBookEvidenceV2PublicBatch03(first);

    expect(JSON.stringify(bookArchiveCountries)).toBe(sourceSnapshot);
    expect(second).toEqual(first);
    for (const expected of expectedTitles) {
      const before = workByRecordKey(bookArchiveCountries, expected.recordKey);
      const after = workByRecordKey(first, expected.recordKey);
      expect(after.coverUrl).toBe(before.coverUrl);
      expect(after.coverThumbnailUrl).toBe(before.coverThumbnailUrl);
      expect(after.coverRights).toEqual(before.coverRights);
    }
  });

  it("declares every controlled authority needed before registry integration", () => {
    const declared = new Set(bookEvidenceV2PublicBatch03RequiredAuthorityIds);
    for (const expected of expectedTitles) {
      const work = workByRecordKey(appliedCountries, expected.recordKey);
      const evidenceAuthorities = [
        ...(work.localizedTitles?.ru?.evidence || []),
        ...(work.localizedTitles?.en?.evidence || []),
      ].map((evidence) => evidence.authorityId);
      const provenanceAuthorities = (work.sources || [])
        .filter((source) => source.fields.includes("description"))
        .map((source) => source.authorityId)
        .filter((authorityId): authorityId is string => Boolean(authorityId));
      for (const authorityId of [
        ...evidenceAuthorities,
        ...provenanceAuthorities,
      ]) {
        expect(declared.has(authorityId), authorityId).toBe(true);
      }
    }
    expect(
      bookEvidenceV2PublicBatch03AuthorityDrafts.map(
        (authority) => authority.authorityId
      )
    ).toEqual([
      "orwell-foundation",
      "hodder-stoughton",
      "booker-prize-foundation",
      "university-of-kent",
      "david-mitchell-official",
    ]);
  });

  it("fails closed if any assigned Work is absent or duplicated", () => {
    expect(() => applyBookEvidenceV2PublicBatch03([])).toThrow(
      "book-evidence-v2-public-batch-03-target-cardinality"
    );
  });
});
