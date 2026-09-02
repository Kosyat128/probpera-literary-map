import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import canonRegistry from "../../../data/book-canon-source-registry.json";
import { buildBookArchive, type BookArchiveEntry } from "../bookArchive";
import {
  bookDescriptionProvenanceIssues,
  localizedBookTitleEvidenceIssues,
} from "../bookEvidence";
import { bookArchiveCountries } from "./index";
import {
  applyBookEvidenceV2PublicBatch04Work,
  bookEvidenceV2PublicBatch04AuthorityDrafts,
  bookEvidenceV2PublicBatch04Holds,
  bookEvidenceV2PublicBatch04RecordKeys,
  bookEvidenceV2PublicBatch04RequiredAuthorityIds,
  bookEvidenceV2PublicBatch04ResolvedRecordKeys,
} from "./bookEvidenceV2PublicBatch04";
import type { WorkLocale } from "./types";

const authorityIds = new Set(
  canonRegistry.authorities.map((authority) => authority.authorityId)
);
const augmentedRegistry = {
  ...canonRegistry,
  authorities: [
    ...canonRegistry.authorities,
    ...bookEvidenceV2PublicBatch04AuthorityDrafts.filter(
      (authority) => !authorityIds.has(authority.authorityId)
    ),
  ],
};

const expectedRecords = [
  {
    recordKey: "france:victor_hugo:les-miserables",
    ru: "Отверженные",
    en: "Les Misérables",
    originCountryId: "france",
    originLanguage: "fr",
    status: "resolved",
  },
  {
    recordKey: "france:flaubert:madame-bovary",
    ru: "Госпожа Бовари",
    en: "Madame Bovary",
    originCountryId: "france",
    originLanguage: "fr",
    status: "resolved",
  },
  {
    recordKey: "france:saint_exupery:openlibrary-works-ol10263w",
    ru: "Маленький принц",
    en: "The Little Prince",
    originCountryId: "france",
    originLanguage: "fr",
    status: "resolved",
  },
  {
    recordKey: "france:roger_martin_du_gard:the-thibaults",
    originCountryId: "france",
    originLanguage: "fr",
    status: "hold",
  },
  {
    recordKey: "germany:theodor_mommsen:history-of-rome",
    originCountryId: "germany",
    originLanguage: "de",
    status: "hold",
  },
  {
    recordKey: "germany:thomas_mann:buddenbrooks-editorial",
    ru: "Будденброки",
    en: "Buddenbrooks",
    originCountryId: "germany",
    originLanguage: "de",
    status: "resolved",
  },
  {
    recordKey: "norway:knut_hamsun:growth-of-the-soil",
    ru: "Плоды земли",
    en: "Growth of the Soil",
    originCountryId: "norway",
    originLanguage: "no",
    status: "resolved",
  },
  {
    recordKey: "poland:wladyslaw_reymont:the-peasants",
    ru: "Мужики",
    en: "The Peasants",
    originCountryId: "poland",
    originLanguage: "pl",
    status: "resolved",
  },
] as const;

const baseArchive = buildBookArchive(bookArchiveCountries, {
  includeUserSuppliedCovers: false,
});
const appliedArchive = baseArchive.map((entry) => ({
  ...entry,
  ...applyBookEvidenceV2PublicBatch04Work(
    entry.countryId,
    entry.writerId,
    entry
  ),
}));

function entryByRecordKey(
  archive: BookArchiveEntry[],
  recordKey: string
): BookArchiveEntry {
  const matches = archive.filter(
    (entry) => `${entry.countryId}:${entry.writerId}:${entry.id}` === recordKey
  );
  expect(matches, recordKey).toHaveLength(1);
  return matches[0];
}

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function sentenceCount(value: string) {
  return value.match(/[.!?](?=\s|$)/gu)?.length || 0;
}

function reviewedWorkState(entry: BookArchiveEntry) {
  return {
    id: entry.id,
    title: entry.title,
    description: entry.description,
    translations: entry.translations,
    localizedTitles: entry.localizedTitles,
    canon: entry.canon,
    sources: entry.sources,
    editorial: entry.editorial,
    coverUrl: entry.coverUrl,
    coverThumbnailUrl: entry.coverThumbnailUrl,
    coverRights: entry.coverRights,
  };
}

describe("public book evidence V2 batch 04", () => {
  it("targets the eight exact post-merge archive keys once each", () => {
    expect(new Set(bookEvidenceV2PublicBatch04RecordKeys)).toEqual(
      new Set(expectedRecords.map((record) => record.recordKey))
    );
    expect(new Set(bookEvidenceV2PublicBatch04ResolvedRecordKeys)).toEqual(
      new Set(
        expectedRecords
          .filter((record) => record.status === "resolved")
          .map((record) => record.recordKey)
      )
    );
    expect(bookEvidenceV2PublicBatch04Holds).toHaveLength(2);

    for (const record of expectedRecords) {
      const count = baseArchive.filter(
        (entry) =>
          `${entry.countryId}:${entry.writerId}:${entry.id}` ===
          record.recordKey
      ).length;
      expect(count, record.recordKey).toBe(1);
    }
  });

  it("publishes exact reviewed RU and EN titles only for the six resolved Works", () => {
    for (const record of expectedRecords.filter(
      (item) => item.status === "resolved"
    )) {
      const work = entryByRecordKey(appliedArchive, record.recordKey);
      expect(work.title).toBe(record.ru);
      expect(work.translations?.ru?.title).toBe(record.ru);
      expect(work.translations?.en?.title).toBe(record.en);
      expect(work.localizedTitles?.ru?.value).toBe(record.ru);
      expect(work.localizedTitles?.en?.value).toBe(record.en);
      expect(work.editorial?.status).toBe("verified");
      expect(work).not.toHaveProperty("canon");
    }

    expect(
      entryByRecordKey(
        appliedArchive,
        "norway:knut_hamsun:growth-of-the-soil"
      ).title
    ).toBe("Плоды земли");
  });

  it("passes the two-independent-manifestation, Tier A, and national-record title gates", () => {
    for (const record of expectedRecords.filter(
      (item) => item.status === "resolved"
    )) {
      const work = entryByRecordKey(appliedArchive, record.recordKey);
      for (const locale of ["ru", "en"] as WorkLocale[]) {
        expect(
          localizedBookTitleEvidenceIssues(work, locale, {
            canonRegistry: augmentedRegistry,
          }),
          `${record.recordKey}:${locale}`
        ).toEqual([]);
        const evidence = work.localizedTitles?.[locale]?.evidence || [];
        expect(evidence).toHaveLength(2);
        expect(new Set(evidence.map((item) => item.sourceUrl)).size).toBe(2);
        const groups = new Set(
          evidence.map(
            (item) =>
              augmentedRegistry.authorities.find(
                (authority) => authority.authorityId === item.authorityId
              )?.independenceGroup
          )
        );
        expect(groups.size, `${record.recordKey}:${locale}:groups`).toBe(2);
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
    }
  });

  it("keeps the two scope-ambiguous cards fail-closed without publishing guessed titles", () => {
    for (const hold of bookEvidenceV2PublicBatch04Holds) {
      const before = entryByRecordKey(baseArchive, hold.recordKey);
      const after = entryByRecordKey(appliedArchive, hold.recordKey);
      expect(hold).toMatchObject({
        status: "fail-closed",
        code: "work-expression-scope-unresolved",
      });
      expect(hold.resolutionCriteria).toHaveLength(3);
      expect(hold.evidence.ru.length).toBeGreaterThanOrEqual(2);
      expect(hold.evidence.en).toHaveLength(2);
      expect(after.title).toBe(before.title);
      expect(after.description).toBe(before.description);
      expect(after.translations?.ru?.title).toBe(
        before.translations?.ru?.title
      );
      expect(after.translations?.en?.title).toBe(
        before.translations?.en?.title
      );
      expect(after.localizedTitles?.ru).toBeUndefined();
      expect(after.localizedTitles?.en).toBeUndefined();
      expect(after.translations?.ru?.titleEvidence).toBeUndefined();
      expect(after.translations?.en?.titleEvidence).toBeUndefined();
      expect(after.editorial?.status).toBe("reviewed");
      expect(after).not.toHaveProperty("canon");
      for (const locale of ["ru", "en"] as WorkLocale[]) {
        expect(
          localizedBookTitleEvidenceIssues(after, locale, {
            canonRegistry: augmentedRegistry,
          }).length,
          `${hold.recordKey}:${locale}`
        ).toBeGreaterThan(0);
      }
    }

    const thibaults = bookEvidenceV2PublicBatch04Holds.find(
      (hold) => hold.recordKey.includes("the-thibaults")
    )!;
    expect(new Set(thibaults.evidence.en.map((item) => item.authorityId))).toEqual(
      new Set(["loc"])
    );
    const rome = bookEvidenceV2PublicBatch04Holds.find((hold) =>
      hold.recordKey.includes("history-of-rome")
    )!;
    expect(new Set(rome.evidence.ru.map((item) => item.catalogTitleExact)).size).toBe(
      3
    );
    expect(
      rome.evidence.en.some(
        (item) => item.catalogTitleExact === "A History of Rome"
      )
    ).toBe(false);
  });

  it("uses two origin-country sources for each original RU synthesis and exact-SHA human EN translation", () => {
    const authorityById = new Map(
      augmentedRegistry.authorities.map((authority) => [
        authority.authorityId,
        authority,
      ])
    );

    for (const record of expectedRecords.filter(
      (item) => item.status === "resolved"
    )) {
      const work = entryByRecordKey(appliedArchive, record.recordKey);
      const ru = work.translations?.ru;
      const en = work.translations?.en;
      expect(work.description).toBe(ru?.description);
      expect(ru?.method).toBe("editorial-original");
      expect(en?.method).toBe("human-translation");
      expect(ru?.descriptionProvenance?.origin).toBe(
        "official-source-synthesis"
      );
      expect(ru?.descriptionProvenance?.sourceLanguage).toBe(
        record.originLanguage
      );
      expect(en?.descriptionProvenance?.origin).toBe("human-translation");
      expect(en?.descriptionProvenance?.sourceLanguage).toBe("ru");
      expect(sentenceCount(ru?.description || "")).toBeGreaterThanOrEqual(2);
      expect(sentenceCount(ru?.description || "")).toBeLessThanOrEqual(3);
      expect(sentenceCount(en?.description || "")).toBeGreaterThanOrEqual(2);
      expect(sentenceCount(en?.description || "")).toBeLessThanOrEqual(3);

      const ruHash = sha256(ru?.description || "");
      expect(en?.descriptionProvenance?.translatedFromSourceHash).toBe(ruHash);
      const context = {
        canonRegistry: augmentedRegistry,
        originCountryIds: [record.originCountryId],
        descriptionSha256ByLocale: { ru: ruHash },
      };
      expect(
        bookDescriptionProvenanceIssues(work, "ru", context),
        `${record.recordKey}:ru-description`
      ).toEqual([]);
      expect(
        bookDescriptionProvenanceIssues(work, "en", context),
        `${record.recordKey}:en-description`
      ).toEqual([]);

      const sourceByUrl = new Map(
        (work.sources || []).map((source) => [source.url, source])
      );
      const sourceAuthorities = (
        ru?.descriptionProvenance?.sourceUrls || []
      ).map((url) => sourceByUrl.get(url)?.authorityId);
      expect(sourceAuthorities).toHaveLength(2);
      const originGroups = new Set(
        sourceAuthorities.map((authorityId) => {
          const authority = authorityId
            ? authorityById.get(authorityId)
            : undefined;
          expect(authority?.authorityCountryId, authorityId).toBe(
            record.originCountryId
          );
          return authority?.independenceGroup;
        })
      );
      expect(originGroups.size, record.recordKey).toBe(2);
    }
  });

  it("is immutable, idempotent, cover-preserving, and a strict no-op off target", () => {
    const sourceSnapshots = new Map(
      expectedRecords.map((record) => [
        record.recordKey,
        JSON.stringify(
          reviewedWorkState(entryByRecordKey(baseArchive, record.recordKey))
        ),
      ])
    );
    const once = baseArchive.map((entry) => ({
      ...entry,
      ...applyBookEvidenceV2PublicBatch04Work(
        entry.countryId,
        entry.writerId,
        entry
      ),
    }));
    const twice = once.map((entry) => ({
      ...entry,
      ...applyBookEvidenceV2PublicBatch04Work(
        entry.countryId,
        entry.writerId,
        entry
      ),
    }));
    for (const record of expectedRecords) {
      expect(
        JSON.stringify(
          reviewedWorkState(entryByRecordKey(baseArchive, record.recordKey))
        )
      ).toBe(sourceSnapshots.get(record.recordKey));
      expect(
        reviewedWorkState(entryByRecordKey(twice, record.recordKey))
      ).toEqual(reviewedWorkState(entryByRecordKey(once, record.recordKey)));
    }

    for (const record of expectedRecords) {
      const before = entryByRecordKey(baseArchive, record.recordKey);
      const after = entryByRecordKey(once, record.recordKey);
      expect(after.coverUrl).toBe(before.coverUrl);
      expect(after.coverThumbnailUrl).toBe(before.coverThumbnailUrl);
      expect(after.coverRights).toEqual(before.coverRights);
    }

    const nonTarget = baseArchive.find(
      (entry) =>
        !bookEvidenceV2PublicBatch04RecordKeys.includes(
          `${entry.countryId}:${entry.writerId}:${entry.id}`
        )
    )!;
    expect(
      applyBookEvidenceV2PublicBatch04Work(
        nonTarget.countryId,
        nonTarget.writerId,
        nonTarget
      )
    ).toBe(nonTarget);
  });

  it("declares every authority ID and exact new authority contract needed for integration", () => {
    const declared = new Set(bookEvidenceV2PublicBatch04RequiredAuthorityIds);
    for (const record of expectedRecords.filter(
      (item) => item.status === "resolved"
    )) {
      const work = entryByRecordKey(appliedArchive, record.recordKey);
      const used = [
        ...(work.localizedTitles?.ru?.evidence || []).map(
          (evidence) => evidence.authorityId
        ),
        ...(work.localizedTitles?.en?.evidence || []).map(
          (evidence) => evidence.authorityId
        ),
        ...(work.sources || [])
          .filter((source) => source.fields.includes("description"))
          .map((source) => source.authorityId)
          .filter((authorityId): authorityId is string => Boolean(authorityId)),
      ];
      for (const authorityId of used) {
        expect(declared.has(authorityId), authorityId).toBe(true);
      }
    }
    for (const hold of bookEvidenceV2PublicBatch04Holds) {
      for (const evidence of [...hold.evidence.ru, ...hold.evidence.en]) {
        expect(declared.has(evidence.authorityId), evidence.authorityId).toBe(
          true
        );
      }
    }

    expect(bookEvidenceV2PublicBatch04AuthorityDrafts).toEqual([
      {
        authorityId: "maisons-victor-hugo",
        provider: "maisons-victor-hugo-paris-musees",
        authorityCountryId: "france",
        independenceGroup: "paris-musees-maisons-victor-hugo",
        tier: "B",
        allowedRoles: ["description-fact"],
        domains: ["maisonsvictorhugo.paris.fr"],
        markets: [],
      },
      {
        authorityId: "university-rouen-flaubert",
        provider: "university-of-rouen-centre-flaubert",
        authorityCountryId: "france",
        independenceGroup: "university-of-rouen",
        tier: "B",
        allowedRoles: ["description-fact"],
        domains: ["univ-rouen.fr"],
        markets: [],
      },
      {
        authorityId: "little-prince-official",
        provider: "le-petit-prince-official",
        authorityCountryId: "france",
        independenceGroup: "saint-exupery-estate-pomase",
        tier: "B",
        allowedRoles: ["description-fact"],
        domains: ["lepetitprince.com"],
        markets: [],
      },
      {
        authorityId: "buddenbrookhaus",
        provider: "buddenbrookhaus-luebeck-museums",
        authorityCountryId: "germany",
        independenceGroup: "luebeck-museums-buddenbrookhaus",
        tier: "B",
        allowedRoles: ["description-fact"],
        domains: ["buddenbrookhaus.de"],
        markets: [],
      },
      {
        authorityId: "goethe-institut",
        provider: "goethe-institut",
        authorityCountryId: "germany",
        independenceGroup: "goethe-institut",
        tier: "B",
        allowedRoles: ["description-fact"],
        domains: ["goethe.de"],
        markets: [],
      },
      {
        authorityId: "hamsun-centre",
        provider: "hamsun-centre",
        authorityCountryId: "norway",
        independenceGroup: "nordland-museum-hamsun-centre",
        tier: "B",
        allowedRoles: ["description-fact"],
        domains: ["hamsunsenteret.no"],
        markets: [],
      },
      {
        authorityId: "gyldendal-norway",
        provider: "gyldendal-norway",
        authorityCountryId: "norway",
        independenceGroup: "gyldendal-norway",
        tier: "B",
        allowedRoles: ["description-fact"],
        domains: ["gyldendal.no"],
        markets: [],
      },
      {
        authorityId: "polish-national-library",
        provider: "polish-national-library",
        authorityCountryId: "poland",
        independenceGroup: "polish-national-library",
        tier: "A",
        allowedRoles: ["description-fact"],
        domains: ["bn.org.pl"],
        markets: [],
      },
      {
        authorityId: "culture-pl",
        provider: "adam-mickiewicz-institute-culture-pl",
        authorityCountryId: "poland",
        independenceGroup: "adam-mickiewicz-institute",
        tier: "B",
        allowedRoles: ["description-fact"],
        domains: ["culture.pl"],
        markets: [],
      },
      {
        authorityId: "routledge",
        provider: "routledge-taylor-francis",
        authorityCountryId: "england",
        independenceGroup: "taylor-and-francis",
        tier: "B",
        allowedRoles: ["title-publisher"],
        domains: ["routledge.com"],
        markets: ["US", "GB"],
      },
    ]);
  });
});
