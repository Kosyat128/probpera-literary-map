import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import heldReviewBatchJson from "../../../data/book-canon-loc-held-review-batch01.json";
import {
  bookCanonResearchCatalog,
  bookCanonResearchCatalogSummary,
  buildBookCanonResearchCatalog,
} from "../bookCanonResearchCatalog";
import {
  bookCanonLocHeldResearchBatch01ManifestFingerprint,
  bookCanonLocHeldResearchBatch01Overlay,
  buildBookCanonLocHeldResearchBatch01Overlay,
} from "./bookCanonLocHeldResearchBatch01";
import { bookArchiveCountries } from "./index";

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, canonicalize(nested)])
  );
}

function reviewFingerprint(value: unknown) {
  return sha256(JSON.stringify(canonicalize(value)));
}

describe("LoC held research production overlay batch 01", () => {
  it("keeps nine absent Works and one mapping in a fail-closed research catalog", () => {
    const drafts = bookCanonLocHeldResearchBatch01Overlay.filter(
      (entry) => entry.researchDisposition === "draft-addition"
    );
    const mappings = bookCanonLocHeldResearchBatch01Overlay.filter(
      (entry) => entry.researchDisposition === "accepted-mapping"
    );

    expect(bookCanonLocHeldResearchBatch01Overlay).toHaveLength(10);
    expect(drafts).toHaveLength(9);
    expect(mappings).toHaveLength(1);
    expect(
      bookCanonLocHeldResearchBatch01Overlay.every(
        (entry) =>
          entry.integrationStatus === "research-hold" &&
          entry.publicationEffect === "none" &&
          entry.canonClaim === null &&
          entry.work.editorial?.status === "draft" &&
          entry.work.canon === undefined &&
          entry.work.localizedTitles === undefined &&
          entry.researchVisibility.visitorArchive === "excluded" &&
          entry.researchVisibility.publicSearch === "excluded"
      )
    ).toBe(true);
    expect(
      drafts.every(
        (entry) =>
          entry.archiveIdentityResult.exactTitleMatchRecordKeys.length === 0 &&
          entry.archiveIdentityResult.writerMatchKeys.length === 0
      )
    ).toBe(true);
  });

  it("pins the exact RU and EN research titles to official manifestation evidence", () => {
    expect(
      bookCanonLocHeldResearchBatch01Overlay.map((entry) => [
        entry.titleResearch.ru.selectedValue,
        entry.titleResearch.en.selectedValue,
      ])
    ).toEqual([
      [
        "Хижина дяди Тома",
        "Uncle Tom’s Cabin; or, Life Among the Lowly.",
      ],
      ["Маленькие женщины", "Little Women, or, Meg, Jo, Beth, and Amy."],
      ["Удивительный волшебник из Страны Оз", "The Wonderful Wizard of Oz."],
      ["Джунгли", "The Jungle."],
      ["Унесенные ветром", "Gone With the Wind."],
      ["Паутина Шарлотты", "Charlotte’s Web."],
      ["Атлант расправил плечи", "Atlas Shrugged."],
      ["Безмолвная весна", "Silent Spring."],
      [
        "Хладнокровное убийство",
        "In Cold Blood: A True Account of a Multiple Murder and Its Consequences.",
      ],
      ["Возлюбленная", "Beloved"],
    ]);

    for (const entry of bookCanonLocHeldResearchBatch01Overlay) {
      const ruEvidence = entry.titleResearch.ru.evidence?.[0];
      const enEvidence = entry.titleResearch.en.evidence?.[0];
      expect(ruEvidence?.catalogTitleExact).toBe(
        entry.titleResearch.ru.selectedValue
      );
      expect(enEvidence?.catalogTitleExact).toBe(
        entry.identityResearch.titleTranscriptionExact
      );
      const sourceHosts = (entry.work.sources || []).map(
        (source) => new URL(source.url).hostname
      );
      expect(sourceHosts.some((hostname) => hostname.endsWith("loc.gov"))).toBe(
        true
      );
      expect(
        [
          "search.rsl.ru",
          "rusneb.ru",
          "ast.ru",
          "azbooka.ru",
          "eksmo.ru",
        ].some((hostname) => sourceHosts.includes(hostname))
      ).toBe(true);
    }
  });

  it("hashes the two aligned descriptions and records EN as a human translation of RU", () => {
    for (const entry of bookCanonLocHeldResearchBatch01Overlay) {
      const ru = entry.work.translations?.ru;
      const en = entry.work.translations?.en;

      expect(ru).toBeDefined();
      expect(en).toBeDefined();
      expect(sha256(ru?.description || "")).toBe(
        entry.descriptionDraftHashes.ru
      );
      expect(sha256(en?.description || "")).toBe(
        entry.descriptionDraftHashes.en
      );
      expect(ru?.descriptionProvenance).toMatchObject({
        origin: "official-source-synthesis",
        sourceLanguage: "en",
        sourceCountry: "usa",
        rights: { textOrigin: "project-original", copiedSourceText: false },
      });
      expect(en).toMatchObject({
        method: "human-translation",
        sourceLanguage: "ru",
        descriptionProvenance: {
          origin: "human-translation",
          sourceLanguage: "ru",
          sourceCountry: "usa",
          translatedFromLocale: "ru",
          translatedFromSourceHash: entry.descriptionDraftHashes.ru,
          rights: { textOrigin: "project-original", copiedSourceText: false },
        },
      });
      expect(
        ru?.descriptionProvenance?.sourceUrls.every(
          (url) => new URL(url).hostname.endsWith("loc.gov")
        )
      ).toBe(true);
      expect(en?.descriptionProvenance?.sourceUrls).toEqual(
        ru?.descriptionProvenance?.sourceUrls
      );
    }
  });

  it("preserves Work and Manifestation boundaries and the corrected Gone With the Wind anchor", () => {
    const jungle = bookCanonLocHeldResearchBatch01Overlay.find(
      (entry) => entry.candidateId === "upton-sinclair-the-jungle"
    );
    const gone = bookCanonLocHeldResearchBatch01Overlay.find(
      (entry) => entry.candidateId === "margaret-mitchell-gone-with-the-wind"
    );

    expect(jungle).toMatchObject({
      work: {
        firstPublished: 1906,
        edition: {
          title: "The Jungle.",
          publisher: "Doubleday, Page & Company",
          publicationYear: 1945,
        },
      },
      identityResearch: {
        entityKind: "work",
        workFirstPublishedYear: 1906,
        displayedManifestation: {
          entityKind: "manifestation",
          year: 1945,
        },
      },
    });
    expect(jungle?.workModelNote).toContain(
      "1945 date must never replace firstPublished=1906"
    );

    expect(gone?.identityResearch.registryItemUrl).toMatch(/#obj17$/u);
    expect(gone?.identityResearch.currentLocItemUrl).toMatch(/#obj18$/u);
    expect(gone?.work.sourceUrl).toMatch(/#obj18$/u);
    expect(gone?.work.edition?.sourceUrl).toMatch(/#obj18$/u);
    expect(gone?.work.sources?.[0]?.url).toMatch(/#obj18$/u);
  });

  it("maps Beloved as one manifestation-title alias of the existing Work", () => {
    const mapping = bookCanonLocHeldResearchBatch01Overlay.find(
      (entry) => entry.researchDisposition === "accepted-mapping"
    );
    const usa = bookArchiveCountries.find((country) => country.id === "usa");
    const morrison = usa?.writers.find(
      (writer) => writer.id === "tony_morrison"
    );
    const beloved = morrison?.workDetails?.find((work) => work.id === "beloved");

    expect(mapping).toMatchObject({
      candidateId: "toni-morrison-beloved",
      suggestedRecordKey: "usa:tony_morrison:beloved",
      researchDisposition: "accepted-mapping",
      mappingAlias: {
        targetRecordKey: "usa:tony_morrison:beloved",
        aliasExact: "Beloved: A Novel.",
        aliasEntityKind: "manifestation-title",
        createsWork: false,
      },
      archiveIdentityResult: {
        exactTitleMatchRecordKeys: ["usa:tony_morrison:beloved"],
        writerMatchKeys: ["usa:tony_morrison"],
      },
    });
    expect(beloved).toMatchObject({
      title: "Возлюбленная",
      originalTitle: "Beloved",
      firstPublished: 1987,
    });
    expect(
      bookCanonLocHeldResearchBatch01Overlay.filter(
        (entry) => entry.mappingAlias?.targetRecordKey === mapping?.suggestedRecordKey
      )
    ).toHaveLength(1);
  });

  it("surfaces combined catalog counts without visitor, publication, or canon visibility", () => {
    expect(bookCanonResearchCatalogSummary).toEqual({
      total: 13,
      draftAdditions: 12,
      acceptedMappings: 1,
      holdRecords: 13,
      visitorVisible: 0,
      publicationEffect: 0,
      canonClaims: 0,
      unresolvedWriterLinks: 13,
      unresolvedAuthorities: 2,
    });
    expect(
      bookCanonLocHeldResearchBatch01Overlay.every((overlay) =>
        bookCanonResearchCatalog.some(
          (entry) => entry.candidateId === overlay.candidateId
        )
      )
    ).toBe(true);
  });

  it("keeps the research modules outside the visitor archive import graph", async () => {
    const [archiveModule, countryIndex] = await Promise.all([
      readFile(new URL("../bookArchive.ts", import.meta.url), "utf8"),
      readFile(new URL("./index.ts", import.meta.url), "utf8"),
    ]);

    expect(archiveModule).not.toContain("bookCanonResearchCatalog");
    expect(archiveModule).not.toContain("bookCanonLocHeldResearchBatch01");
    expect(countryIndex).not.toContain("bookCanonResearchCatalog");
    expect(countryIndex).not.toContain("bookCanonLocHeldResearchBatch01");
  });

  it("pins review fingerprints and rejects tampering before catalog construction", () => {
    expect(bookCanonLocHeldResearchBatch01ManifestFingerprint).toBe(
      heldReviewBatchJson.batchFingerprint
    );
    expect(
      heldReviewBatchJson.reviews.map((review) => reviewFingerprint(review))
    ).toEqual(
      bookCanonLocHeldResearchBatch01Overlay.map(
        (entry) => entry.reviewFingerprint
      )
    );

    const staleFingerprint = structuredClone(heldReviewBatchJson);
    staleFingerprint.batchFingerprint = "0".repeat(64);
    expect(() =>
      buildBookCanonLocHeldResearchBatch01Overlay(staleFingerprint)
    ).toThrow(/batch-fingerprint-not-reviewed/u);

    const staleAbsence = structuredClone(heldReviewBatchJson);
    staleAbsence.reviews[0].archiveReview.exactTitleMatchRecordKeys = [
      "usa:fixture:fixture",
    ];
    expect(() => buildBookCanonLocHeldResearchBatch01Overlay(staleAbsence)).toThrow(
      /draft-must-remain-absent/u
    );

    const unsafeOverlay = structuredClone(
      bookCanonLocHeldResearchBatch01Overlay[0]
    );
    if (unsafeOverlay.work.editorial) {
      unsafeOverlay.work.editorial.status = "verified";
    }
    expect(() =>
      buildBookCanonResearchCatalog(bookArchiveCountries, [unsafeOverlay])
    ).toThrow(/work-must-remain-draft/u);
  });
});
