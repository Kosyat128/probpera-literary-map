import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import canonRegistry from "../../../data/book-canon-source-registry.json";
import {
  bookDescriptionProvenanceIssues,
  localizedBookTitleEvidenceIssues,
} from "../bookEvidence";
import { bookArchiveCountries } from "./index";
import {
  applyBookEvidenceV2PublicBatch06,
  applyBookEvidenceV2PublicBatch06Work,
  bookEvidenceV2PublicBatch06AuthorityDrafts,
  bookEvidenceV2PublicBatch06Holds,
  bookEvidenceV2PublicBatch06RecordKeys,
  bookEvidenceV2PublicBatch06RequiredAuthorityIds,
  bookEvidenceV2PublicBatch06ResolvedRecordKeys,
} from "./bookEvidenceV2PublicBatch06";
import type { Country, WorkLocale, WorkProfile } from "./types";

const authorityIds = new Set(
  canonRegistry.authorities.map((authority) => authority.authorityId)
);
const augmentedRegistry = {
  ...canonRegistry,
  authorities: [
    ...canonRegistry.authorities,
    ...bookEvidenceV2PublicBatch06AuthorityDrafts.filter(
      (authority) => !authorityIds.has(authority.authorityId)
    ),
  ],
};

const expected = [
  {
    recordKey: "switzerland:carl_spitteler:olympian-spring",
    ru: "Олимпийская весна",
    en: "Olympian Spring",
    origin: "switzerland",
    resolvedLocales: [] as WorkLocale[],
  },
  {
    recordKey: "usa:herman_melville:moby-dick",
    ru: "Моби Дик, или Белый Кит",
    en: "Moby-Dick; or, The Whale",
    origin: "usa",
    resolvedLocales: ["ru", "en"] as WorkLocale[],
  },
  {
    recordKey: "usa:ernest_hemingway:the-old-man-and-the-sea",
    ru: "Старик и море",
    en: "The Old Man and the Sea",
    origin: "usa",
    resolvedLocales: ["ru", "en"] as WorkLocale[],
  },
  {
    recordKey: "usa:ray_bradbury:fahrenheit-451-editorial",
    ru: "451° по Фаренгейту",
    en: "Fahrenheit 451",
    origin: "usa",
    resolvedLocales: ["ru", "en"] as WorkLocale[],
  },
  {
    recordKey:
      "usa:jerome_david_salinger:the-catcher-in-the-rye-editorial",
    ru: "Над пропастью во ржи",
    en: "The Catcher in the Rye",
    origin: "usa",
    resolvedLocales: ["ru", "en"] as WorkLocale[],
  },
  {
    recordKey: "usa:harper_lee:to-kill-a-mockingbird-editorial",
    ru: "Убить пересмешника…",
    en: "To Kill a Mockingbird",
    origin: "usa",
    resolvedLocales: ["ru", "en"] as WorkLocale[],
  },
  {
    recordKey: "usa:vladimir_nabokov:lolita-editorial",
    ru: "Лолита",
    en: "Lolita",
    origin: "usa",
    resolvedLocales: ["ru", "en"] as WorkLocale[],
  },
  {
    recordKey: "usa:suzanne_collins:the-hunger-games",
    ru: "Голодные игры",
    en: "The Hunger Games",
    origin: "usa",
    resolvedLocales: ["ru", "en"] as WorkLocale[],
  },
] as const;

const appliedCountries = applyBookEvidenceV2PublicBatch06(
  bookArchiveCountries
);

function workByRecordKey(countries: Country[], recordKey: string) {
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

describe("public book evidence V2 batch 06", () => {
  it("covers exactly the eight assigned records and resolves only complete cards", () => {
    expect(new Set(bookEvidenceV2PublicBatch06RecordKeys)).toEqual(
      new Set(expected.map((item) => item.recordKey))
    );
    expect(new Set(bookEvidenceV2PublicBatch06ResolvedRecordKeys)).toEqual(
      new Set(
        expected
          .filter((item) => item.resolvedLocales.length === 2)
          .map((item) => item.recordKey)
      )
    );
    expect(bookEvidenceV2PublicBatch06Holds).toHaveLength(2);
  });

  it("applies the reviewed RU and EN display titles without canon assertions", () => {
    for (const item of expected) {
      const work = workByRecordKey(appliedCountries, item.recordKey);
      expect(work.title, `${item.recordKey}:work-title`).toBe(item.ru);
      expect(work.translations?.ru?.title).toBe(item.ru);
      expect(work.translations?.en?.title).toBe(item.en);
      expect(work).not.toHaveProperty("canon");
      expect(work.editorial?.status).toBe(
        item.resolvedLocales.length === 2 ? "verified" : "reviewed"
      );
    }
  });

  it("passes the two-record Tier A plus independent-source gate for every resolved locale", () => {
    for (const item of expected) {
      const work = workByRecordKey(appliedCountries, item.recordKey);
      for (const locale of ["ru", "en"] as WorkLocale[]) {
        const resolved = item.resolvedLocales.includes(locale);
        const profile = work.localizedTitles?.[locale];
        if (!resolved) {
          expect(profile, `${item.recordKey}:${locale}`).toBeUndefined();
          expect(work.translations?.[locale]?.titleEvidence).toBeUndefined();
          expect(
            localizedBookTitleEvidenceIssues(work, locale, {
              canonRegistry: augmentedRegistry,
            })
          ).toContain(`missing-${locale}-published-title-evidence`);
          continue;
        }

        expect(profile?.value).toBe(locale === "ru" ? item.ru : item.en);
        expect(profile?.evidence).toHaveLength(2);
        expect(
          localizedBookTitleEvidenceIssues(work, locale, {
            canonRegistry: augmentedRegistry,
          }),
          `${item.recordKey}:${locale}`
        ).toEqual([]);
        const evidence = profile?.evidence || [];
        expect(new Set(evidence.map((entry) => entry.sourceUrl)).size).toBe(2);
        expect(new Set(evidence.map((entry) => entry.authorityId)).size).toBe(
          2
        );
        expect(
          evidence.some(
            (entry) =>
              entry.authorityTier === "A" &&
              ["national-bibliography", "legal-deposit-catalog"].includes(
                entry.recordKind
              )
          )
        ).toBe(true);
      }
    }
  });

  it("records every title conflict as fail-closed evidence with exact unblock criteria", () => {
    const byCardLocale = new Map(
      bookEvidenceV2PublicBatch06Holds.map((hold) => [
        `${hold.recordKey}:${hold.locale}`,
        hold,
      ])
    );
    expect([...byCardLocale.keys()].sort()).toEqual(
      [
        "switzerland:carl_spitteler:olympian-spring:en",
        "switzerland:carl_spitteler:olympian-spring:ru",
      ].sort()
    );

    for (const hold of bookEvidenceV2PublicBatch06Holds) {
      expect(hold.status).toBe("fail-closed");
      expect(hold.candidateTitles.length).toBeGreaterThanOrEqual(1);
      expect(hold.reason.length).toBeGreaterThan(80);
      expect(hold.resolutionCriteria).toHaveLength(3);
      expect(hold.evidence.length).toBeGreaterThanOrEqual(1);
      expect(
        hold.evidence.every(
          (entry) =>
            entry.url.startsWith("https://") &&
            Boolean(entry.recordId) &&
            Boolean(entry.observedTitle) &&
            Boolean(entry.note)
        )
      ).toBe(true);
      const work = workByRecordKey(appliedCountries, hold.recordKey);
      expect(work.localizedTitles?.[hold.locale]).toBeUndefined();
      expect(work.translations?.[hold.locale]?.titleEvidence).toBeUndefined();
      expect(work.editorial?.status).toBe("reviewed");
    }
  });

  it("uses original two-sentence RU syntheses and SHA-linked human EN translations", () => {
    const authorityById = new Map(
      augmentedRegistry.authorities.map((authority) => [
        authority.authorityId,
        authority,
      ])
    );

    for (const item of expected) {
      const work = workByRecordKey(appliedCountries, item.recordKey);
      const ru = work.translations?.ru;
      const en = work.translations?.en;
      expect(ru?.method).toBe("editorial-original");
      expect(en?.method).toBe("human-translation");
      expect(ru?.descriptionProvenance?.origin).toBe(
        "official-source-synthesis"
      );
      expect(en?.descriptionProvenance?.origin).toBe("human-translation");
      expect(sentenceCount(ru?.description || "")).toBe(2);
      expect(sentenceCount(en?.description || "")).toBe(2);

      const ruHash = sha256(ru?.description || "");
      expect(en?.descriptionProvenance?.translatedFromSourceHash).toBe(ruHash);
      const context = {
        canonRegistry: augmentedRegistry,
        originCountryIds: [item.origin],
        descriptionSha256ByLocale: { ru: ruHash },
      };
      expect(
        bookDescriptionProvenanceIssues(work, "ru", context),
        `${item.recordKey}:ru-description`
      ).toEqual([]);
      expect(
        bookDescriptionProvenanceIssues(work, "en", context),
        `${item.recordKey}:en-description`
      ).toEqual([]);

      const sourceByUrl = new Map(
        (work.sources || []).map((source) => [source.url, source])
      );
      const provenanceUrls = ru?.descriptionProvenance?.sourceUrls || [];
      expect(provenanceUrls).toHaveLength(2);
      const groups = new Set(
        provenanceUrls
          .map((url) => sourceByUrl.get(url)?.authorityId)
          .map((authorityId) =>
            authorityId ? authorityById.get(authorityId) : undefined
          )
          .filter(Boolean)
          .map((authority) => authority!.independenceGroup)
      );
      expect(groups.size, item.recordKey).toBe(2);
      expect(
        provenanceUrls
          .map((url) => sourceByUrl.get(url)?.authorityId)
          .map((authorityId) =>
            authorityId ? authorityById.get(authorityId) : undefined
          )
          .some(
            (authority) => authority?.authorityCountryId === item.origin
          )
      ).toBe(true);
    }
  });

  it("declares every controlled authority needed for later registry wiring", () => {
    const declared = new Set(bookEvidenceV2PublicBatch06RequiredAuthorityIds);
    for (const item of expected) {
      const work = workByRecordKey(appliedCountries, item.recordKey);
      const authorityReferences = [
        ...(work.localizedTitles?.ru?.evidence || []),
        ...(work.localizedTitles?.en?.evidence || []),
      ].map((entry) => entry.authorityId);
      const descriptionAuthorities = (work.sources || [])
        .filter((source) => source.fields.includes("description"))
        .map((source) => source.authorityId)
        .filter((value): value is string => Boolean(value));
      for (const authorityId of [
        ...authorityReferences,
        ...descriptionAuthorities,
      ]) {
        expect(declared.has(authorityId), authorityId).toBe(true);
      }
    }
    expect(
      bookEvidenceV2PublicBatch06AuthorityDrafts.map(
        (authority) => authority.authorityId
      )
    ).toEqual([
      "swiss-national-library",
      "nobel-prize-outreach",
      "simon-schuster-us",
      "hachette-book-group-us",
      "harper-lee-official",
      "scholastic-us",
    ]);
  });

  it("is immutable, idempotent, preserves covers, and exposes the Work applier", () => {
    const sourceSnapshot = JSON.stringify(bookArchiveCountries);
    const first = applyBookEvidenceV2PublicBatch06(bookArchiveCountries);
    const second = applyBookEvidenceV2PublicBatch06(first);
    expect(JSON.stringify(bookArchiveCountries)).toBe(sourceSnapshot);
    expect(second).toEqual(first);

    for (const item of expected) {
      const [countryId, writerId] = item.recordKey.split(":");
      const before = workByRecordKey(bookArchiveCountries, item.recordKey);
      const after = workByRecordKey(first, item.recordKey);
      expect(
        applyBookEvidenceV2PublicBatch06Work(countryId, writerId, before)
      ).toEqual(after);
      expect(after.coverUrl).toBe(before.coverUrl);
      expect(after.coverThumbnailUrl).toBe(before.coverThumbnailUrl);
      expect(after.coverRights).toEqual(before.coverRights);
    }

    const unrelated: WorkProfile = { id: "unrelated", title: "Без изменений" };
    expect(
      applyBookEvidenceV2PublicBatch06Work("usa", "nobody", unrelated)
    ).toBe(unrelated);
  });

  it("fails closed when any assigned Work is absent", () => {
    expect(() => applyBookEvidenceV2PublicBatch06([])).toThrow(
      "book-evidence-v2-public-batch-06-target-cardinality"
    );
  });
});
