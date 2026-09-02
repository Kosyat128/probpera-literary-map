import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import canonRegistry from "../../../data/book-canon-source-registry.json";
import {
  bookDescriptionProvenanceIssues,
  localizedBookTitleEvidenceIssues,
} from "../bookEvidence";
import { bookArchiveCountries } from "./index";
import {
  applyBookEvidenceV2PublicHolds01Work,
  bookEvidenceV2PublicHolds01AuthorityDrafts,
  bookEvidenceV2PublicHolds01Holds,
  bookEvidenceV2PublicHolds01RecordKeys,
  bookEvidenceV2PublicHolds01RequiredAuthorityIds,
  bookEvidenceV2PublicHolds01ResolvedRecordKeys,
} from "./bookEvidenceV2PublicHolds01";
import type { Country, WorkLocale, WorkProfile } from "./types";

const authorityIds = new Set(
  canonRegistry.authorities.map((authority) => authority.authorityId)
);
const augmentedRegistry = {
  ...canonRegistry,
  authorities: [
    ...canonRegistry.authorities,
    ...bookEvidenceV2PublicHolds01AuthorityDrafts.filter(
      (authority) => !authorityIds.has(authority.authorityId)
    ),
  ],
};

const expected = [
  {
    recordKey: "canada:yann_martel:life-of-pi",
    ru: "Жизнь Пи",
    en: "Life of Pi",
    originCountryId: "canada",
  },
  {
    recordKey: "england:h_g_wells:when-the-sleeper-wakes",
    ru: "Когда спящий проснется",
    en: "When the Sleeper Wakes",
    originCountryId: "england",
  },
  {
    recordKey: "england:h_g_wells:ann-veronica",
    ru: "Анна-Вероника",
    en: "Ann Veronica",
    originCountryId: "england",
  },
  {
    recordKey: "england:david_mitchell:ghostwritten",
    ru: "Литературный призрак",
    en: "Ghostwritten",
    originCountryId: "england",
  },
  {
    recordKey: "england:david_mitchell:number9dream",
    ru: "Сон № 9",
    en: "Number9Dream",
    originCountryId: "england",
  },
  {
    recordKey: "england:david_mitchell:the-bone-clocks",
    ru: "Костяные часы",
    en: "The Bone Clocks",
    originCountryId: "england",
  },
  {
    recordKey: "england:david_mitchell:slade-house",
    ru: "Голодный дом",
    en: "Slade House",
    originCountryId: "england",
  },
] as const;

const targetKeys: Set<string> = new Set(
  expected.map((item) => item.recordKey)
);

function applyAssignedWorks(countries: Country[]) {
  return countries.map((country) => ({
    ...country,
    writers: country.writers.map((writer) => ({
      ...writer,
      workDetails: writer.workDetails?.map((work) =>
        applyBookEvidenceV2PublicHolds01Work(country.id, writer.id, work)
      ),
    })),
  }));
}

const appliedCountries = applyAssignedWorks(bookArchiveCountries);

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

describe("public book Evidence V2 holds 01", () => {
  it("resolves exactly the seven assigned fail-closed public cards", () => {
    expect(new Set(bookEvidenceV2PublicHolds01RecordKeys)).toEqual(targetKeys);
    expect(new Set(bookEvidenceV2PublicHolds01ResolvedRecordKeys)).toEqual(
      targetKeys
    );
    expect(bookEvidenceV2PublicHolds01Holds).toEqual([]);

    for (const item of expected) {
      const matches = bookArchiveCountries.flatMap((country) =>
        country.writers.flatMap((writer) =>
          (writer.workDetails || []).filter(
            (work) => `${country.id}:${writer.id}:${work.id}` === item.recordKey
          )
        )
      );
      expect(matches, item.recordKey).toHaveLength(1);
    }
  });

  it("publishes the exact reviewed RU and EN display titles", () => {
    for (const item of expected) {
      const work = workByRecordKey(appliedCountries, item.recordKey);
      expect(work.title, `${item.recordKey}:work`).toBe(item.ru);
      expect(work.translations?.ru?.title, `${item.recordKey}:ru`).toBe(
        item.ru
      );
      expect(work.translations?.en?.title, `${item.recordKey}:en`).toBe(
        item.en
      );
      expect(work.localizedTitles?.ru?.value).toBe(item.ru);
      expect(work.localizedTitles?.en?.value).toBe(item.en);
      expect(work.editorial?.status).toBe("verified");
      expect(work.translations?.ru?.status).toBe("verified");
      expect(work.translations?.en?.status).toBe("verified");
    }
  });

  it("passes both locale title gates with two independent records and Tier A national evidence", () => {
    for (const item of expected) {
      const work = workByRecordKey(appliedCountries, item.recordKey);
      for (const locale of ["ru", "en"] as WorkLocale[]) {
        expect(
          localizedBookTitleEvidenceIssues(work, locale, {
            canonRegistry: augmentedRegistry,
          }),
          `${item.recordKey}:${locale}`
        ).toEqual([]);

        const evidence = work.localizedTitles?.[locale]?.evidence || [];
        expect(evidence, `${item.recordKey}:${locale}:count`).toHaveLength(2);
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

  it("resolves Life of Pi against exact RU and US manifestations", () => {
    const work = workByRecordKey(
      appliedCountries,
      "canada:yann_martel:life-of-pi"
    );
    const ru = work.localizedTitles?.ru?.evidence || [];
    const en = work.localizedTitles?.en?.evidence || [];

    expect(ru.map((entry) => entry.authorityId)).toEqual(["nlr", "eksmo"]);
    expect(ru.map((entry) => entry.isbn13)).toEqual([
      "9785699369348",
      "9785699369348",
    ]);
    expect(en.map((entry) => entry.authorityId)).toEqual([
      "loc",
      "harpercollins-us",
    ]);
    expect(en.map((entry) => entry.isbn13)).toEqual([
      "9780151008117",
      "9780151008117",
    ]);
    expect(en[0]).toMatchObject({
      recordId: "LOC-2001039737",
      isbn10: "0151008116",
      publicationYear: 2001,
      catalogTitleExact: "Life of Pi",
    });
  });

  it("keeps the 1899 Sleeper lineage separate from the 1910 revision", () => {
    const work = workByRecordKey(
      appliedCountries,
      "england:h_g_wells:when-the-sleeper-wakes"
    );
    const ruProfile = work.localizedTitles?.ru;
    const enProfile = work.localizedTitles?.en;

    expect(ruProfile?.selectionRule).toBe("earliest-authorized-edition");
    expect(ruProfile?.evidence.map((entry) => entry.authorityId)).toEqual([
      "neb",
      "nlr",
    ]);
    expect(
      ruProfile?.evidence.every(
        (entry) =>
          entry.catalogTitleExact === "Когда спящий проснется" &&
          entry.publicationYear === 1909 &&
          entry.translator === "Екатерина Прейс"
      )
    ).toBe(true);
    expect(enProfile?.selectionRule).toBe("earliest-authorized-edition");
    expect(enProfile?.evidence.map((entry) => entry.recordId)).toEqual([
      "LOC-99002363",
      "PG-EBOOK-775",
    ]);
    expect(
      enProfile?.evidence.every(
        (entry) => entry.catalogTitleExact === "When the Sleeper Wakes"
      )
    ).toBe(true);
    expect(
      enProfile?.evidence.some((entry) =>
        entry.sourceUrl.includes("99015153")
      )
    ).toBe(false);
    expect(
      enProfile?.evidence.some(
        (entry) => entry.catalogTitleExact === "The Sleeper Awakes"
      )
    ).toBe(false);
  });

  it("uses the hyphen in Ann Veronica only under the formal authoritative rule", () => {
    const work = workByRecordKey(
      appliedCountries,
      "england:h_g_wells:ann-veronica"
    );
    const profile = work.localizedTitles?.ru;
    expect(profile?.selectionRule).toBe("authoritative-uniform-title");
    expect(profile?.value).toBe("Анна-Вероника");
    expect(profile?.evidence.map((entry) => entry.authorityId)).toEqual([
      "rsl",
      "nlr",
    ]);
    expect(
      profile?.evidence.every(
        (entry) => entry.catalogTitleExact === "Анна-Вероника"
      )
    ).toBe(true);
    expect(
      work.translations?.ru?.sourceUrls.some((url) =>
        url.includes("rugram-shop.ru")
      )
    ).toBe(false);
    expect(profile?.selectionNote).toContain("Бесдефисная форма");
  });

  it("records rather than smooths Mitchell publication-year discrepancies", () => {
    const cases = [
      {
        recordKey: "england:david_mitchell:ghostwritten",
        years: [2021, 2022],
        note: "не сглажено",
      },
      {
        recordKey: "england:david_mitchell:number9dream",
        years: [2022, 2022],
        note: "совпадают",
      },
      {
        recordKey: "england:david_mitchell:the-bone-clocks",
        years: [2019, 2022],
        note: "2020 [т. е. 2019]",
      },
      {
        recordKey: "england:david_mitchell:slade-house",
        years: [2017, 2023],
        note: "оставлены",
      },
    ] as const;

    for (const item of cases) {
      const profile = workByRecordKey(
        appliedCountries,
        item.recordKey
      ).localizedTitles?.ru;
      expect(profile?.evidence.map((entry) => entry.authorityId)).toEqual([
        "nlr",
        "azbooka",
      ]);
      expect(profile?.evidence.map((entry) => entry.publicationYear)).toEqual(
        item.years
      );
      expect(profile?.selectionNote).toContain(item.note);
    }
  });

  it("uses original RU syntheses and SHA-linked human EN translations", () => {
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
      expect(sentenceCount(ru?.description || "")).toBeGreaterThanOrEqual(2);
      expect(sentenceCount(ru?.description || "")).toBeLessThanOrEqual(3);
      expect(sentenceCount(en?.description || "")).toBeGreaterThanOrEqual(2);
      expect(sentenceCount(en?.description || "")).toBeLessThanOrEqual(3);

      const ruHash = sha256(ru?.description || "");
      expect(en?.descriptionProvenance?.translatedFromSourceHash).toBe(ruHash);
      const context = {
        canonRegistry: augmentedRegistry,
        originCountryIds: [item.originCountryId],
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
    }
  });

  it("uses two independent description fact sources including an origin-country authority", () => {
    const authorityById = new Map(
      augmentedRegistry.authorities.map((authority) => [
        authority.authorityId,
        authority,
      ])
    );

    for (const item of expected) {
      const work = workByRecordKey(appliedCountries, item.recordKey);
      const sourceByUrl = new Map(
        (work.sources || []).map((source) => [source.url, source])
      );
      const descriptionSources = (
        work.translations?.ru?.descriptionProvenance?.sourceUrls || []
      ).map((url) => sourceByUrl.get(url));
      expect(descriptionSources, item.recordKey).toHaveLength(2);
      expect(
        new Set(descriptionSources.map((source) => source?.authorityId)).size
      ).toBe(2);
      expect(
        descriptionSources.some((source) => {
          const authority = source?.authorityId
            ? authorityById.get(source.authorityId)
            : undefined;
          return authority?.authorityCountryId === item.originCountryId;
        }),
        item.recordKey
      ).toBe(true);
    }
  });

  it("is immutable, idempotent, preserves covers, and is an identity no-op outside scope", () => {
    const sourceSnapshot = JSON.stringify(bookArchiveCountries);
    const first = applyAssignedWorks(bookArchiveCountries);
    const second = applyAssignedWorks(first);

    expect(JSON.stringify(bookArchiveCountries)).toBe(sourceSnapshot);
    expect(second).toEqual(first);
    for (const item of expected) {
      const before = workByRecordKey(bookArchiveCountries, item.recordKey);
      const after = workByRecordKey(first, item.recordKey);
      expect(after.coverUrl).toBe(before.coverUrl);
      expect(after.coverThumbnailUrl).toBe(before.coverThumbnailUrl);
      expect(after.coverRights).toEqual(before.coverRights);
    }

    const unrelated = bookArchiveCountries
      .flatMap((country) =>
        country.writers.flatMap((writer) =>
          (writer.workDetails || []).map((work) => ({ country, writer, work }))
        )
      )
      .find(
        ({ country, writer, work }) =>
          !targetKeys.has(`${country.id}:${writer.id}:${work.id}`)
      );
    expect(unrelated).toBeDefined();
    expect(
      applyBookEvidenceV2PublicHolds01Work(
        unrelated!.country.id,
        unrelated!.writer.id,
        unrelated!.work
      )
    ).toBe(unrelated!.work);
  });

  it("declares every authority and only drafts the missing NLR authority", () => {
    const declared = new Set(bookEvidenceV2PublicHolds01RequiredAuthorityIds);
    for (const item of expected) {
      const work = workByRecordKey(appliedCountries, item.recordKey);
      const usedAuthorities = [
        ...(work.localizedTitles?.ru?.evidence || []),
        ...(work.localizedTitles?.en?.evidence || []),
      ].map((entry) => entry.authorityId);
      const descriptionAuthorities = (work.sources || [])
        .filter((source) => source.fields.includes("description"))
        .map((source) => source.authorityId)
        .filter((authorityId): authorityId is string => Boolean(authorityId));
      for (const authorityId of [
        ...usedAuthorities,
        ...descriptionAuthorities,
      ]) {
        expect(declared.has(authorityId), authorityId).toBe(true);
      }
    }
    expect(
      bookEvidenceV2PublicHolds01AuthorityDrafts.map(
        (authority) => authority.authorityId
      )
    ).toEqual(["nlr"]);
  });
});
