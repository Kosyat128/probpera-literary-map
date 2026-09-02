import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import canonRegistry from "../../../data/book-canon-source-registry.json";
import { bookArchiveKey, buildBookArchive } from "../bookArchive";
import {
  bookDescriptionProvenanceIssues,
  localizedBookTitleEvidenceIssues,
} from "../bookEvidence";
import { bookArchiveCountries } from "./index";
import {
  applyBookBibliographicOverlay,
  bookBibliographicHoldsByRecordKey,
  resolvedBookBibliographicRecordKeys,
} from "./bookBibliographicOverlays";
import type { WorkLocale, WorkProfile } from "./types";

const archive = buildBookArchive(bookArchiveCountries, {
  includeUserSuppliedCovers: false,
});

const resolvedTitles: Array<{
  recordKey: string;
  ru: string;
  en: string;
}> = [
  {
    recordKey: "austria:franz_kafka:openlibrary-works-ol498556w",
    ru: "Превращение",
    en: "The Metamorphosis",
  },
  {
    recordKey: "canada:margaret_atwood:openlibrary-works-ol675783w",
    ru: "Рассказ Служанки",
    en: "The Handmaid's Tale",
  },
  {
    recordKey: "england:william_shakespeare:hamlet",
    ru: "Гамлет",
    en: "Hamlet",
  },
  {
    recordKey: "england:jane_austen:pride-and-prejudice",
    ru: "Гордость и предубеждение",
    en: "Pride and Prejudice",
  },
  {
    recordKey: "england:charles_dickens:a-tale-of-two-cities",
    ru: "Повесть о двух городах",
    en: "A Tale of Two Cities",
  },
  {
    recordKey: "england:h_g_wells:the-first-men-in-the-moon",
    ru: "Первые люди на Луне",
    en: "The First Men in the Moon",
  },
];

function workByRecordKey(recordKey: string) {
  const work = archive.find(
    (candidate) =>
      bookArchiveKey(candidate.countryId, candidate.writerId, candidate.id) ===
      recordKey
  );
  expect(work, recordKey).toBeDefined();
  return work!;
}

function descriptionAuthorityGroups(work: WorkProfile) {
  const authorityById = new Map(
    canonRegistry.authorities.map((authority) => [
      authority.authorityId,
      authority.independenceGroup,
    ])
  );
  return new Set(
    (work.sources || [])
      .filter(
        (source) =>
          source.authorityId && source.fields.includes("description")
      )
      .map((source) => authorityById.get(source.authorityId!))
      .filter((group): group is string => Boolean(group))
  );
}

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

describe("reviewed book bibliographic overlays", () => {
  it("publishes exact verified RU and EN display titles for six resolved Works", () => {
    expect(new Set(resolvedBookBibliographicRecordKeys)).toEqual(
      new Set(resolvedTitles.map((item) => item.recordKey))
    );

    for (const expected of resolvedTitles) {
      const work = workByRecordKey(expected.recordKey);
      expect(work.title, `${expected.recordKey}:work-title`).toBe(expected.ru);
      expect(work.translations?.ru?.title, `${expected.recordKey}:ru`).toBe(
        expected.ru
      );
      expect(work.translations?.en?.title, `${expected.recordKey}:en`).toBe(
        expected.en
      );
      expect(work.localizedTitles?.ru?.value).toBe(expected.ru);
      expect(work.localizedTitles?.en?.value).toBe(expected.en);
    }
  });

  it("passes the V2 manifestation-title contract in both locales", () => {
    for (const { recordKey } of resolvedTitles) {
      const work = workByRecordKey(recordKey);
      for (const locale of ["ru", "en"] as WorkLocale[]) {
        expect(
          localizedBookTitleEvidenceIssues(work, locale, {
            canonRegistry,
          }),
          `${recordKey}:${locale}`
        ).toEqual([]);

        const profile = work.localizedTitles?.[locale];
        expect(profile?.evidence).toHaveLength(2);
        expect(
          new Set(profile?.evidence.map((evidence) => evidence.authorityId))
            .size
        ).toBe(2);
        expect(
          profile?.evidence.some((evidence) =>
            ["national-bibliography", "legal-deposit-catalog"].includes(
              evidence.recordKind
            )
          )
        ).toBe(true);
      }
    }
  });

  it("publishes reviewed RU synthesis and linked EN translation with exact hashes", () => {
    for (const { recordKey } of resolvedTitles) {
      const work = workByRecordKey(recordKey);
      expect(descriptionAuthorityGroups(work).size, recordKey).toBeGreaterThanOrEqual(
        2
      );
      const ru = work.translations?.ru;
      const en = work.translations?.en;
      expect(ru?.method).toBe("editorial-original");
      expect(en?.method).toBe("human-translation");
      expect(ru?.descriptionProvenance?.origin).toBe(
        "official-source-synthesis"
      );
      expect(en?.descriptionProvenance?.origin).toBe("human-translation");
      const ruHash = sha256(ru?.description || "");
      expect(en?.descriptionProvenance?.translatedFromSourceHash).toBe(ruHash);

      const context = {
        canonRegistry,
        originCountryIds: [work.countryId],
        descriptionSha256ByLocale: { ru: ruHash },
      };
      expect(
        bookDescriptionProvenanceIssues(work, "ru", context),
        `${recordKey}:ru-description`
      ).toEqual([]);
      expect(
        bookDescriptionProvenanceIssues(work, "en", context),
        `${recordKey}:en-description`
      ).toEqual([]);

      const sourceByUrl = new Map(
        (work.sources || []).map((source) => [source.url, source])
      );
      const authorityById = new Map(
        canonRegistry.authorities.map((authority) => [
          authority.authorityId,
          authority,
        ])
      );
      const originGroups = new Set(
        (ru?.descriptionProvenance?.sourceUrls || [])
          .map((url) => sourceByUrl.get(url)?.authorityId)
          .map((authorityId) =>
            authorityId ? authorityById.get(authorityId) : undefined
          )
          .filter(
            (authority) => authority?.authorityCountryId === work.countryId
          )
          .map((authority) => authority!.independenceGroup)
      );
      expect(originGroups.size, `${recordKey}:origin-description-sources`).toBeGreaterThanOrEqual(
        2
      );
    }
  });

  it("replaces only reviewed text fields while preserving cover and editorial state", () => {
    const fixture: WorkProfile = {
      id: "openlibrary-works-ol498556w",
      title: "Превращение",
      description: "Существующее описание Work.",
      translations: {
        ru: {
          locale: "ru",
          title: "Превращение",
          description: "Существующее русское описание.",
          sourceLanguage: "ru",
          status: "reviewed",
          sourceUrls: [],
          method: "editorial-original",
        },
        en: {
          locale: "en",
          title: "The Metamorphosis",
          description: "Existing English description.",
          sourceLanguage: "en",
          status: "reviewed",
          sourceUrls: [],
          method: "editorial-original",
        },
      },
      coverUrl: "brand/book-covers/existing.webp",
      editorial: { status: "reviewed", reviewedAt: "2026-08-08" },
    };

    const overlaid = applyBookBibliographicOverlay(
      "austria",
      "franz_kafka",
      fixture
    );
    expect(overlaid.description).not.toBe(fixture.description);
    expect(overlaid.translations?.ru?.description).not.toBe(
      fixture.translations?.ru?.description
    );
    expect(overlaid.translations?.en?.description).not.toBe(
      fixture.translations?.en?.description
    );
    expect(overlaid.translations?.ru?.descriptionProvenance?.origin).toBe(
      "official-source-synthesis"
    );
    expect(overlaid.translations?.en?.descriptionProvenance?.origin).toBe(
      "human-translation"
    );
    expect(overlaid.editorial).toEqual(fixture.editorial);
    expect(overlaid.coverUrl).toBe(fixture.coverUrl);
    expect(overlaid).not.toHaveProperty("canon");
  });

  it("retains the Life of Pi hold history and accepts the later exact Russian print record", () => {
    const recordKey = "canada:yann_martel:life-of-pi";
    const work = workByRecordKey(recordKey);
    const hold = bookBibliographicHoldsByRecordKey[recordKey];

    expect(hold).toMatchObject({
      status: "fail-closed",
      locale: "ru",
      code: "ru-national-record-unresolved",
    });
    expect(hold.resolutionCriteria).toHaveLength(3);
    expect(work.localizedTitles?.ru).toMatchObject({
      value: "Жизнь Пи",
      locale: "ru",
      market: "RU",
      status: "verified-published",
    });
    expect(
      work.localizedTitles?.ru?.evidence.map((item) => item.authorityId)
    ).toEqual(["nlr", "eksmo"]);
    expect(
      localizedBookTitleEvidenceIssues(work, "ru", { canonRegistry })
    ).toEqual([]);
  });

  it("retains both Sleeper lineages and publishes only the evidenced 1899 expression", () => {
    const recordKey = "england:h_g_wells:when-the-sleeper-wakes";
    const work = workByRecordKey(recordKey);
    const hold = bookBibliographicHoldsByRecordKey[recordKey];

    expect(hold).toMatchObject({
      status: "fail-closed",
      locale: "en",
      code: "english-lineage-unresolved",
    });
    expect(hold.lineages).toEqual([
      expect.objectContaining({
        lineageId: "original-1899",
        titleEn: "When the Sleeper Wakes",
      }),
      expect.objectContaining({
        lineageId: "revised-1910",
        titleEn: "The Sleeper Awakes",
      }),
    ]);
    expect(work.localizedTitles?.en).toMatchObject({
      value: "When the Sleeper Wakes",
      locale: "en",
      market: "US",
      status: "verified-published",
      selectionRule: "earliest-authorized-edition",
    });
    expect(work.localizedTitles?.en?.value).not.toBe("The Sleeper Awakes");
    expect(
      localizedBookTitleEvidenceIssues(work, "en", { canonRegistry })
    ).toEqual([]);
  });

  it("uses only controlled authority IDs and adds no canon signals", () => {
    const authorityIds = new Set(
      canonRegistry.authorities.map((authority) => authority.authorityId)
    );
    for (const recordKey of [
      ...resolvedBookBibliographicRecordKeys,
      ...Object.keys(bookBibliographicHoldsByRecordKey),
    ]) {
      const work = workByRecordKey(recordKey);
      for (const source of work.sources || []) {
        if (source.authorityId) {
          expect(authorityIds.has(source.authorityId), source.authorityId).toBe(
            true
          );
        }
      }
      expect(work.canon).toBeUndefined();
    }
  });
});
