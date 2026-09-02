import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import canonRegistry from "../../../data/book-canon-source-registry.json";
import {
  bookDescriptionProvenanceIssues,
  localizedBookTitleEvidenceIssues,
} from "../bookEvidence";
import { bookArchiveCountries } from "./index";
import { reviewedBooksForWriter } from "./generated/generatedBooks";
import {
  applyBookEvidenceV2PublicBatch02,
  bookEvidenceV2PublicBatch02AuthorityDrafts,
  bookEvidenceV2PublicBatch02Holds,
  bookEvidenceV2PublicBatch02RecordKeys,
  bookEvidenceV2PublicBatch02RequiredAuthorityIds,
  bookEvidenceV2PublicBatch02ResolvedRecordKeys,
} from "./bookEvidenceV2PublicBatch02";
import type { Country, WorkLocale, WorkProfile } from "./types";

const authorityIds = new Set(
  canonRegistry.authorities.map((authority) => authority.authorityId)
);
const augmentedRegistry = {
  ...canonRegistry,
  authorities: [
    ...canonRegistry.authorities,
    ...bookEvidenceV2PublicBatch02AuthorityDrafts.filter(
      (authority) => !authorityIds.has(authority.authorityId)
    ),
  ],
};

const expectedTitles = [
  {
    recordKey: "england:h_g_wells:the-food-of-the-gods",
    ru: "Пища богов",
    en: "The Food of the Gods and How It Came to Earth",
    status: "resolved",
  },
  {
    recordKey: "england:h_g_wells:the-world-set-free",
    ru: "Освобожденный мир",
    en: "The World Set Free",
    status: "resolved",
  },
  {
    recordKey: "england:h_g_wells:men-like-gods",
    ru: "Люди как боги",
    en: "Men Like Gods",
    status: "resolved",
  },
  {
    recordKey: "england:h_g_wells:ann-veronica",
    ru: "Анна-Вероника",
    en: "Ann Veronica",
    status: "hold",
  },
  {
    recordKey: "england:h_g_wells:the-history-of-mr-polly",
    ru: "История мистера Полли",
    en: "The History of Mr. Polly",
    status: "resolved",
  },
  {
    recordKey: "england:aldous_huxley:brave-new-world-editorial",
    ru: "О дивный новый мир",
    en: "Brave New World",
    status: "resolved",
  },
  {
    recordKey: "england:j_r_r_tolkien:openlibrary-works-ol27448w",
    ru: "Властелин колец",
    en: "The Lord of the Rings",
    status: "resolved",
  },
  {
    recordKey: "england:j_r_r_tolkien:the-hobbit",
    ru: "Хоббит, или Туда и обратно",
    en: "The Hobbit: Or, There and Back Again",
    status: "resolved",
  },
] as const;

const reviewedLordOfTheRings = reviewedBooksForWriter(
  "england",
  "j_r_r_tolkien"
).find((work) => work.id === "openlibrary-works-ol27448w");
if (!reviewedLordOfTheRings) {
  throw new Error("batch-02-reviewed-lord-of-the-rings-fixture-missing");
}

// The country corpus intentionally excludes reviewed-only generated Works;
// production merges them in buildBookArchive before applying work overlays.
const batchInputCountries: Country[] = bookArchiveCountries.map((country) =>
  country.id !== "england"
    ? country
    : {
        ...country,
        writers: country.writers.map((writer) =>
          writer.id !== "j_r_r_tolkien" ||
          writer.workDetails?.some(
            (work) => work.id === reviewedLordOfTheRings.id
          )
            ? writer
            : {
                ...writer,
                workDetails: [
                  ...(writer.workDetails || []),
                  reviewedLordOfTheRings,
                ],
              }
        ),
      }
);

const appliedCountries = applyBookEvidenceV2PublicBatch02(
  batchInputCountries
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

describe("public book evidence V2 batch 02", () => {
  it("covers exactly the eight assigned public records", () => {
    expect(new Set(bookEvidenceV2PublicBatch02RecordKeys)).toEqual(
      new Set(expectedTitles.map((item) => item.recordKey))
    );
    expect(new Set(bookEvidenceV2PublicBatch02ResolvedRecordKeys)).toEqual(
      new Set(
        expectedTitles
          .filter((item) => item.status === "resolved")
          .map((item) => item.recordKey)
      )
    );
    expect(bookEvidenceV2PublicBatch02Holds).toHaveLength(1);
  });

  it("applies the exact reviewed RU and EN display titles", () => {
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
    }
  });

  it("passes two independent exact records with a Tier A national or deposit record for seven resolved cards", () => {
    const authorityById = new Map(
      augmentedRegistry.authorities.map((authority) => [
        authority.authorityId,
        authority,
      ])
    );
    for (const recordKey of bookEvidenceV2PublicBatch02ResolvedRecordKeys) {
      const work = workByRecordKey(appliedCountries, recordKey);
      for (const locale of ["ru", "en"] as WorkLocale[]) {
        expect(
          localizedBookTitleEvidenceIssues(work, locale, {
            canonRegistry: augmentedRegistry,
          }),
          `${recordKey}:${locale}`
        ).toEqual([]);
        const profile = work.localizedTitles?.[locale];
        const evidence = profile?.evidence || [];
        expect(evidence).toHaveLength(2);
        expect(
          evidence.every(
            (item) => item.catalogTitleExact === profile?.value
          ),
          `${recordKey}:${locale}:exact-title`
        ).toBe(true);
        expect(new Set(evidence.map((item) => item.sourceUrl)).size).toBe(2);
        expect(
          new Set(
            evidence.map(
              (item) =>
                authorityById.get(item.authorityId)?.independenceGroup
            )
          ).size
        ).toBe(2);
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

  it("keeps Ann Veronica RU fail-closed and preserves both conflicting manifestation spellings", () => {
    const hold = bookEvidenceV2PublicBatch02Holds[0];
    const work = workByRecordKey(appliedCountries, hold.recordKey);
    expect(hold).toMatchObject({
      recordKey: "england:h_g_wells:ann-veronica",
      status: "fail-closed",
      locale: "ru",
      code: "ru-title-orthography-conflict",
      candidateTitles: ["Анна-Вероника", "Анна Вероника"],
    });
    expect(hold.resolutionCriteria).toHaveLength(3);
    expect(
      hold.resolutionCriteria.some((criterion) =>
        criterion.includes("не по поисковому сниппету")
      )
    ).toBe(true);
    expect(
      hold.manifestationEvidence.map((item) => item.catalogTitleExact)
    ).toEqual(["Анна-Вероника", "Анна Вероника"]);
    expect(
      hold.manifestationEvidence.map((item) => item.authorityId)
    ).toEqual(["rsl", "rugram-t8"]);
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
      })
    ).toEqual([]);
  });

  it("uses two-source English-origin fact synthesis and exact SHA-linked manual EN translation", () => {
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
      const provenanceAuthorities = (
        ru?.descriptionProvenance?.sourceUrls || []
      ).map((url) => {
        const authorityId = sourceByUrl.get(url)?.authorityId;
        return authorityId ? authorityById.get(authorityId) : undefined;
      });
      expect(provenanceAuthorities).toHaveLength(2);
      expect(
        provenanceAuthorities.every(
          (authority) => authority?.authorityCountryId === "england"
        ),
        `${expected.recordKey}:origin-country`
      ).toBe(true);
      expect(
        new Set(
          provenanceAuthorities.map(
            (authority) => authority?.independenceGroup
          )
        ).size,
        `${expected.recordKey}:description-independence`
      ).toBe(2);
    }
  });

  it("is immutable and idempotent, preserves cover assets, and never creates or alters canon signals", () => {
    const archiveSnapshot = JSON.stringify(bookArchiveCountries);
    const sourceSnapshot = JSON.stringify(batchInputCountries);
    const first = applyBookEvidenceV2PublicBatch02(batchInputCountries);
    const second = applyBookEvidenceV2PublicBatch02(first);

    expect(JSON.stringify(bookArchiveCountries)).toBe(archiveSnapshot);
    expect(JSON.stringify(batchInputCountries)).toBe(sourceSnapshot);
    expect(second).toEqual(first);
    for (const expected of expectedTitles) {
      const before = workByRecordKey(batchInputCountries, expected.recordKey);
      const after = workByRecordKey(first, expected.recordKey);
      expect(after.coverUrl).toBe(before.coverUrl);
      expect(after.coverThumbnailUrl).toBe(before.coverThumbnailUrl);
      expect(after.coverRights).toEqual(before.coverRights);
      expect(after.canon).toEqual(before.canon);
    }
  });

  it("declares every controlled authority needed before registry integration", () => {
    const declared = new Set(bookEvidenceV2PublicBatch02RequiredAuthorityIds);
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
    for (const hold of bookEvidenceV2PublicBatch02Holds) {
      for (const evidence of hold.manifestationEvidence) {
        expect(declared.has(evidence.authorityId)).toBe(true);
      }
    }
    expect(
      bookEvidenceV2PublicBatch02AuthorityDrafts.map(
        (authority) => authority.authorityId
      )
    ).toEqual([
      "yurait",
      "rugram-t8",
      "project-gutenberg",
      "standard-ebooks",
      "mit-press",
      "dover-publications",
      "harpercollins-us",
      "orion-books",
      "cambridge-university-press",
      "university-of-manchester",
      "university-of-oxford",
      "tolkien-estate",
      "harpercollins-uk",
    ]);
  });

  it("fails closed if any assigned Work is absent or duplicated", () => {
    expect(() => applyBookEvidenceV2PublicBatch02([])).toThrow(
      "book-evidence-v2-public-batch-02-target-cardinality"
    );
  });
});
