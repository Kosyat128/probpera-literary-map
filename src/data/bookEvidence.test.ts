import { describe, expect, it } from "vitest";

import {
  bookDescriptionProvenanceIssues,
  bookEvidenceV2Issues,
  isBookEvidenceV2Ready,
  localizedBookTitleEvidenceIssues,
  type BookEvidenceV2Context,
} from "./bookEvidence";
import type { WorkProfile } from "./countries/types";

const checkedAt = "2026-09-02";
const russianDescription =
  "Уинстон Смит живёт в государстве тотального контроля, где власть переписывает прошлое и наблюдает за каждым человеком. Его попытка сохранить память и личную привязанность постепенно превращается в опасное сопротивление системе.";
const russianDescriptionHash =
  "ecb4008a9030a969190b651015d6d7df88c6526c8bb4f9b4180e8d0b5b600eac";
const sourceUrls = [
  "https://search.rsl.ru/ru/record/123",
  "https://publisher.example/ru/1984",
  "https://catalog.loc.gov/vwebv/holdingsInfo?bibId=456",
  "https://publisher.example/en/nineteen-eighty-four",
];
const recordKey = "england:george_orwell:nineteen-eighty-four";

const context: BookEvidenceV2Context = {
  recordKey,
  originCountryIds: ["england"],
  descriptionSha256ByLocale: { ru: russianDescriptionHash },
  canonRegistry: {
    registryVersion: "world-canon-2026-09-v2",
    authorities: [
      {
        authorityId: "rsl",
        independenceGroup: "rsl",
        tier: "A",
        domains: ["rsl.ru"],
        allowedRoles: ["title-national-record", "description-fact"],
        markets: ["RU"],
        authorityCountryId: "russia",
      },
      {
        authorityId: "publisher-ru",
        independenceGroup: "publisher-example",
        tier: "B",
        domains: ["publisher.example"],
        allowedRoles: ["title-publisher", "description-fact"],
        markets: ["RU"],
        authorityCountryId: "russia",
      },
      {
        authorityId: "loc",
        independenceGroup: "loc",
        tier: "A",
        domains: ["loc.gov"],
        allowedRoles: [
          "title-national-record",
          "description-fact",
          "canon-selection",
        ],
        markets: ["US"],
        authorityCountryId: "usa",
      },
      {
        authorityId: "publisher-en",
        independenceGroup: "publisher-example",
        tier: "B",
        domains: ["publisher.example"],
        allowedRoles: ["title-publisher", "description-fact"],
        markets: ["US"],
        authorityCountryId: "england",
      },
      {
        authorityId: "orwell-project",
        independenceGroup: "orwell-project",
        tier: "B",
        domains: ["orwell.example"],
        allowedRoles: ["canon-selection"],
        markets: [],
        authorityCountryId: "england",
      },
    ],
    sources: [
      {
        id: "loc-shaped-books",
        authorityId: "loc",
        class: "national-library-heritage-collection",
        inventoryStatus: "adjudicated",
        coverageStatus: "adjudicated",
        snapshot: {
          snapshotStatus: "verified-content-hash",
          contentSha256: "a".repeat(64),
        },
      },
      {
        id: "orwell-scholarly-project",
        authorityId: "orwell-project",
        class: "scholarly-critical-project",
        inventoryStatus: "adjudicated",
        coverageStatus: "adjudicated",
        snapshot: {
          snapshotStatus: "verified-content-hash",
          contentSha256: "b".repeat(64),
        },
      },
    ],
    inventories: [
      {
        sourceId: "loc-shaped-books",
        items: [
          {
            ordinal: 1,
            itemId: "loc-1984",
            titleExact: "Nineteen Eighty-Four",
            candidateKind: "work",
            entityKind: "work",
            adjudicationStatus: "accepted",
            adjudicatedRecordKey: recordKey,
          },
        ],
      },
      {
        sourceId: "orwell-scholarly-project",
        items: [
          {
            ordinal: 1,
            itemId: "orwell-1984",
            titleExact: "Nineteen Eighty-Four",
            candidateKind: "work",
            entityKind: "work",
            adjudicationStatus: "accepted",
            adjudicatedRecordKey: recordKey,
          },
        ],
      },
    ],
  },
};

function titleEvidence(
  locale: "ru" | "en",
  value: string,
  market: "RU" | "US"
) {
  const records =
    locale === "ru"
      ? [
          {
            sourceUrl: sourceUrls[0],
            provider: "Российская государственная библиотека",
            authorityId: "rsl",
            authorityTier: "A" as const,
            recordKind: "national-bibliography" as const,
            recordId: "RSL-123",
          },
          {
            sourceUrl: sourceUrls[1],
            provider: "Official Russian publisher",
            authorityId: "publisher-ru",
            authorityTier: "B" as const,
            recordKind: "publisher-catalog" as const,
            recordId: "ISBN-9780000000001",
          },
        ]
      : [
          {
            sourceUrl: sourceUrls[2],
            provider: "Library of Congress",
            authorityId: "loc",
            authorityTier: "A" as const,
            recordKind: "legal-deposit-catalog" as const,
            recordId: "LCCN-456",
          },
          {
            sourceUrl: sourceUrls[3],
            provider: "Official English-language publisher",
            authorityId: "publisher-en",
            authorityTier: "B" as const,
            recordKind: "publisher-catalog" as const,
            recordId: "ISBN-9780000000002",
          },
        ];

  return {
    entityKind: "expression" as const,
    expressionId: `expression:${locale}:1984`,
    locale,
    value,
    status: "verified-published" as const,
    expressionLanguage: locale === "ru" ? "Russian" : "English",
    market,
    selectionRule: "earliest-authorized-edition" as const,
    evidence: records.map((record) => ({
      ...record,
      entityKind: "manifestation" as const,
      manifestationId: record.recordId,
      catalogTitleExact: value,
      locale,
      market,
      expressionLanguage: locale === "ru" ? "Russian" : "English",
      publicationYear: 2020,
      retrievedAt: checkedAt,
      checkedAt,
      checkedBy: "Independent bibliography reviewer",
    })),
  };
}

function fixture(): WorkProfile {
  const titleRu = "1984";
  const titleEn = "Nineteen Eighty-Four";
  const localizedTitles = {
    ru: titleEvidence("ru", titleRu, "RU"),
    en: titleEvidence("en", titleEn, "US"),
  };
  const descriptionProvenance = {
    origin: "official-source-synthesis" as const,
    sourceLanguage: "English",
    sourceCountry: "england",
    sourceUrls,
    transformations: ["condensed" as const, "spoiler-limited" as const],
    rights: {
      textOrigin: "project-original" as const,
      copiedSourceText: false as const,
    },
    author: "Book editorial writer",
    createdAt: checkedAt,
    reviewedBy: "Independent book editor",
    reviewedAt: checkedAt,
  };

  return {
    id: "nineteen-eighty-four",
    title: titleRu,
    originalTitle: titleEn,
    translations: {
      ru: {
        locale: "ru",
        title: titleRu,
        description: russianDescription,
        sourceLanguage: "Russian",
        sourceUrls,
        status: "reviewed",
        method: "editorial-original",
        reviewedAt: checkedAt,
        descriptionProvenance,
      },
      en: {
        locale: "en",
        title: titleEn,
        description:
          "Winston Smith lives under total state surveillance while the regime continuously rewrites the past. His attempt to preserve memory and personal loyalty gradually becomes a dangerous act of resistance against the system.",
        sourceLanguage: "Russian",
        sourceUrls,
        status: "reviewed",
        method: "human-translation",
        reviewedAt: checkedAt,
        descriptionProvenance: {
          ...descriptionProvenance,
          origin: "human-translation",
          translatedFromLocale: "ru",
          translatedFromSourceHash: russianDescriptionHash,
        },
      },
    },
    localizedTitles,
    sources: Object.values(localizedTitles).flatMap((localizedTitle) =>
      localizedTitle.evidence.map((evidence) => ({
        provider: evidence.provider,
        authorityId: evidence.authorityId,
        authorityTier: evidence.authorityTier,
        market: evidence.market,
        language: evidence.expressionLanguage,
        recordKind: evidence.recordKind,
        recordId: evidence.recordId,
        url: evidence.sourceUrl,
        fields: ["identity", "title", "description"] as const,
        usage: "reference-only" as const,
        retrievedAt: checkedAt,
      }))
    ),
    canon: {
      status: "canonical-classic",
      registryVersion: "world-canon-2026-09-v2",
      reviewedAt: checkedAt,
      reviewedBy: "Independent canon reviewer",
      evidence: [
        {
          registrySourceId: "loc-shaped-books",
          registryItemOrdinal: 1,
          class: "national-library-heritage-collection",
          sourceUrl: "https://www.loc.gov/exhibits/books-that-shaped-america/",
          provider: "Library of Congress",
          authorityId: "loc",
          authorityTier: "A",
          itemId: "loc-1984",
          assertion: "The work is included in a curated national-library collection.",
          snapshotAt: checkedAt,
        },
        {
          registrySourceId: "orwell-scholarly-project",
          registryItemOrdinal: 1,
          class: "scholarly-critical-project",
          sourceUrl: "https://orwell.example/nineteen-eighty-four",
          provider: "Independent Orwell research project",
          authorityId: "orwell-project",
          authorityTier: "B",
          itemId: "orwell-1984",
          assertion: "The project treats the novel as a major work in Orwell's corpus.",
          snapshotAt: checkedAt,
        },
      ],
    },
    editorial: { status: "reviewed", reviewedAt: checkedAt },
  };
}

describe("book evidence v2 contract", () => {
  it("accepts a fully reviewed numeric Russian title with registered evidence", () => {
    const work = fixture();
    expect(localizedBookTitleEvidenceIssues(work, "ru", context)).toEqual([]);
    expect(bookEvidenceV2Issues(work, context)).toEqual([]);
    expect(isBookEvidenceV2Ready(work, context)).toBe(true);
  });

  it("does not force an ordinary verified work to claim canonical status", () => {
    const work = fixture();
    delete work.canon;

    expect(bookEvidenceV2Issues(work, context)).toEqual([]);
    expect(isBookEvidenceV2Ready(work, context)).toBe(true);
  });

  it("fails closed without authority, origin and hash context", () => {
    expect(bookEvidenceV2Issues(fixture())).toEqual(
      expect.arrayContaining([
        "canon-registry-context-required",
        "ru-title-evidence-1-authority-not-registered",
        "ru-description-origin-country-context-required",
        "en-description-translation-hash-context-required",
      ])
    );
  });

  it("composes the existing publication gate and rejects a bogus draft", () => {
    const work = fixture();
    work.editorial = { status: "draft" };
    work.translations!.ru!.status = "draft";
    work.translations!.ru!.description = "";
    work.translations!.ru!.method = "invented" as "editorial-original";
    work.translations!.ru!.descriptionProvenance!.origin =
      "invented" as "official-source-synthesis";
    work.localizedTitles!.ru!.selectionRule =
      "invented" as "earliest-authorized-edition";
    work.canon!.status = "invented" as "canonical-classic";
    work.canon!.evidence[0].class =
      "invented" as "national-library-heritage-collection";

    const issues = bookEvidenceV2Issues(work, context);
    expect(issues.some((issue) => issue.startsWith("publication:"))).toBe(true);
    expect(issues).toEqual(
      expect.arrayContaining([
        "ru-title-selection-rule-invalid",
        "ru-description-origin-invalid",
        "canon-status-invalid",
        "canon-evidence-1-class-invalid",
      ])
    );
    expect(isBookEvidenceV2Ready(work, context)).toBe(false);
  });

  it("rejects conflicting duplicate title-evidence storage", () => {
    const work = fixture();
    work.translations!.ru!.titleEvidence = {
      ...work.localizedTitles!.ru!,
      expressionId: "stale-expression",
    };
    expect(localizedBookTitleEvidenceIssues(work, "ru", context)).toContain(
      "ru-title-evidence-storage-conflict"
    );
  });

  it("rejects self-declared authorities and duplicate independence groups", () => {
    const work = fixture();
    work.localizedTitles!.en!.evidence[1].authorityId = "LOC";
    work.sources!.find(
      (source) =>
        source.url === work.localizedTitles!.en!.evidence[1].sourceUrl
    )!.authorityId = "LOC";

    expect(localizedBookTitleEvidenceIssues(work, "en", context)).toEqual(
      expect.arrayContaining([
        "en-title-evidence-2-authority-domain-mismatch",
        "en-title-two-independent-authorities-required",
      ])
    );
  });

  it("accepts exact contained-work titles only when the container relation is fully declared", () => {
    const work = fixture();
    const titleProfile = work.localizedTitles!.en!;
    titleProfile.evidence.forEach((evidence, index) => {
      const containerTitle = `Chekhov stories, volume ${index + 1}`;
      evidence.titleRelation = "contained-work";
      evidence.analyticTitleExact = titleProfile.value;
      evidence.containerTitleExact = containerTitle;
      evidence.catalogTitleExact = containerTitle;
      evidence.containedInField =
        index === 0 ? "contents-note" : "table-of-contents";
      const source = work.sources!.find(
        (candidate) => candidate.url === evidence.sourceUrl
      )!;
      source.fields = [
        ...source.fields,
        "container-title",
        "contained-title",
      ];
    });

    expect(localizedBookTitleEvidenceIssues(work, "en", context)).toEqual([]);
  });

  it("rejects a contained-work claim with an inexact analytic, mismatched container, or unstructured relation", () => {
    const work = fixture();
    const evidence = work.localizedTitles!.en!.evidence[0];
    evidence.titleRelation = "contained-work";
    evidence.analyticTitleExact = "A different story";
    evidence.containerTitleExact = "Selected stories";
    evidence.catalogTitleExact = "Collected stories";
    delete evidence.containedInField;

    expect(localizedBookTitleEvidenceIssues(work, "en", context)).toEqual(
      expect.arrayContaining([
        "en-title-evidence-1-exact-analytic-title-mismatch",
        "en-title-evidence-1-exact-container-title-mismatch",
        "en-title-evidence-1-contained-in-field-invalid",
        "en-title-evidence-1-structured-container-title-required",
        "en-title-evidence-1-structured-contained-title-required",
      ])
    );
  });

  it("does not let principal records smuggle analytic metadata or unknown relations", () => {
    const work = fixture();
    work.localizedTitles!.en!.evidence[0].analyticTitleExact =
      "Nineteen Eighty-Four";
    work.localizedTitles!.en!.evidence[1].titleRelation =
      "aggregate" as "principal";

    expect(localizedBookTitleEvidenceIssues(work, "en", context)).toEqual(
      expect.arrayContaining([
        "en-title-evidence-1-unexpected-contained-work-metadata",
        "en-title-evidence-2-title-relation-invalid",
      ])
    );
  });

  it("checks the actual source-description hash", () => {
    const work = fixture();
    const badContext = {
      ...context,
      descriptionSha256ByLocale: { ru: "a".repeat(64) },
    };
    expect(bookDescriptionProvenanceIssues(work, "en", badContext)).toContain(
      "en-description-translation-source-hash-mismatch"
    );
  });

  it("does not accept canon evidence from incomplete or unhashed source inventories", () => {
    const incompleteContext = structuredClone(context);
    const sources = incompleteContext.canonRegistry!.sources as Array<{
      coverageStatus?: string;
      snapshot?: { snapshotStatus?: string; contentSha256?: string | null };
    }>;
    const source = sources[0];
    source.coverageStatus = "in-progress";
    source.snapshot = {
      snapshotStatus: "unverified-content-hash",
      contentSha256: null,
    };

    expect(bookEvidenceV2Issues(fixture(), incompleteContext)).toEqual(
      expect.arrayContaining([
        "canon-evidence-1-registry-coverage-not-adjudicated",
        "canon-evidence-1-registry-snapshot-not-content-verified",
      ])
    );
  });

  it("accepts strict Work and authorship entity pairs from the canon registry", () => {
    for (const [candidateKind, entityKind] of [
      ["work-cycle", "aggregate-work"],
      ["coauthored-work", "work"],
    ] as const) {
      const pairedContext = structuredClone(context);
      const inventories = pairedContext.canonRegistry!.inventories as Array<{
        items: Array<{ candidateKind?: string; entityKind?: string }>;
      }>;
      inventories[0].items[0].candidateKind = candidateKind;
      inventories[0].items[0].entityKind = entityKind;

      expect(bookEvidenceV2Issues(fixture(), pairedContext)).not.toContain(
        "canon-evidence-1-registry-item-is-not-work"
      );
    }
  });

  it("keeps edition aggregates and manifestations out of canon claims", () => {
    const manifestationContext = structuredClone(context);
    const inventories = manifestationContext.canonRegistry!.inventories as Array<{
      items: Array<{ candidateKind?: string; entityKind?: string }>;
    }>;
    inventories[0].items[0].candidateKind = "edition-aggregate";
    inventories[0].items[0].entityKind = "manifestation";

    expect(bookEvidenceV2Issues(fixture(), manifestationContext)).toContain(
      "canon-evidence-1-registry-item-is-not-work"
    );
  });

  it("reports malformed imported arrays instead of throwing", () => {
    const work = fixture() as unknown as {
      localizedTitles: { ru: { evidence: unknown } };
      translations: {
        ru: {
          sourceUrls: unknown;
          descriptionProvenance: {
            sourceUrls: unknown;
            sourceCountry: unknown;
            rights: unknown;
          };
        };
      };
      canon: { evidence: unknown };
    };
    work.localizedTitles.ru.evidence = [null];
    work.translations.ru.sourceUrls = null;
    work.translations.ru.descriptionProvenance.sourceUrls = [null];
    work.translations.ru.descriptionProvenance.sourceCountry = null;
    work.translations.ru.descriptionProvenance.rights = null;
    work.canon.evidence = [null];

    expect(() =>
      bookEvidenceV2Issues(work as unknown as WorkProfile, context)
    ).not.toThrow();
    expect(
      bookEvidenceV2Issues(work as unknown as WorkProfile, context)
    ).toEqual(
      expect.arrayContaining([
        "ru-title-evidence-1-malformed",
        "ru-description-source-country-required",
        "canon-evidence-1-malformed",
      ])
    );
  });
});
