import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import batchManifestJson from "../../data/book-canon-additions-batch01.json";
import {
  bookCanonResearchCatalog,
  bookCanonResearchCatalogSummary,
  buildBookCanonResearchCatalog,
} from "./bookCanonResearchCatalog";
import {
  buildBookArchive,
  buildPublicBookArchive,
} from "./bookArchive";
import {
  bookPublicationIssues,
  isPublicBook,
} from "./bookQuality";
import {
  bookCanonAdditionsBatch01ManifestFingerprint,
  bookCanonAdditionsBatch01Overlay,
  buildBookCanonAdditionsBatch01Overlay,
} from "./countries/bookCanonAdditionsBatch01";
import { bookArchiveCountries } from "./countries/index";

const expectedResearchTitles = [
  "Двенадцать стульев",
  "Москва и москвичи",
  "Лето Господне",
];
const batch01CandidateIds = new Set([
  "twelve-chairs-coauthored-work",
  "moscow-and-muscovites-work",
  "year-of-the-lord-work",
]);
const batch01CatalogEntries = bookCanonResearchCatalog.filter((entry) =>
  batch01CandidateIds.has(entry.candidateId)
);

function normalizedTitle(value: string) {
  return value.normalize("NFKC").trim().toLocaleLowerCase("ru");
}

describe("production canon research catalog", () => {
  it("consumes the fingerprint-pinned batch as three held draft additions", () => {
    expect(bookCanonAdditionsBatch01ManifestFingerprint).toBe(
      "c3b4fb2d1628799832b6bc81c498c2bfa389a5f70100455f37ae5fc5adbd8ea4"
    );
    expect(bookCanonAdditionsBatch01Overlay).toHaveLength(3);
    expect(batch01CatalogEntries.map((entry) => entry.work.title)).toEqual(
      expectedResearchTitles
    );
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

    for (const entry of batch01CatalogEntries) {
      expect(entry).toMatchObject({
        researchDisposition: "draft-addition",
        integrationStatus: "research-hold",
        publicationEffect: "none",
        canonClaim: null,
        work: { editorial: { status: "draft" } },
      });
      expect(entry.work.canon).toBeUndefined();
      expect(entry.work.localizedTitles).toBeUndefined();
      expect(entry.effectiveHoldCodes).toEqual(
        expect.arrayContaining([
          "research-catalog-only",
          "visitor-archive-excluded",
          "runtime-writer-links-unresolved",
        ])
      );
      expect(isPublicBook(entry.work)).toBe(false);
    }
  });

  it("uses every registered research overlay when called with default options", () => {
    const rebuilt = buildBookCanonResearchCatalog(bookArchiveCountries);

    expect(rebuilt).toHaveLength(13);
    expect(rebuilt.map((entry) => entry.candidateId)).toEqual(
      bookCanonResearchCatalog.map((entry) => entry.candidateId)
    );
  });

  it("keeps all missing writer and proposed-authority links explicit", () => {
    const byId = new Map(
      bookCanonResearchCatalog.map((entry) => [entry.candidateId, entry])
    );
    const twelveChairs = byId.get("twelve-chairs-coauthored-work");
    const moscow = byId.get("moscow-and-muscovites-work");
    const year = byId.get("year-of-the-lord-work");

    expect(twelveChairs?.work.authorship).toEqual({
      kind: "multiple",
      authors: [
        {
          countryId: "russia",
          writerId: "ilya-ilf",
          creditNames: { ru: "Илья Ильф", en: "Ilya Ilf" },
          attribution: "credited",
        },
        {
          countryId: "russia",
          writerId: "yevgeny-petrov",
          creditNames: { ru: "Евгений Петров", en: "Evgeny Petrov" },
          attribution: "credited",
        },
      ],
    });
    expect(twelveChairs?.unresolvedWriterLinks.map((link) => link.key)).toEqual([
      "russia:ilya-ilf",
      "russia:yevgeny-petrov",
    ]);
    expect(twelveChairs?.unresolvedAuthorityIds).toEqual([
      "northwestern-university-press",
    ]);
    expect(moscow?.unresolvedWriterLinks.map((link) => link.key)).toEqual([
      "russia:vladimir-gilyarovsky",
    ]);
    expect(moscow?.unresolvedAuthorityIds).toEqual(["russian-life-books"]);
    expect(year?.unresolvedWriterLinks.map((link) => link.key)).toEqual([
      "russia:ivan-shmelev",
    ]);
    expect(year?.unresolvedAuthorityIds).toEqual([]);
  });

  it("retains exact research titles but never promotes them to published title evidence", () => {
    const [twelveChairs, moscow, year] = batch01CatalogEntries;

    expect(twelveChairs?.titleResearch).toMatchObject({
      ru: { status: "verified-research", selectedValue: "Двенадцать стульев" },
      en: { status: "verified-research", selectedValue: "The Twelve Chairs" },
    });
    expect(twelveChairs?.work.translations).toMatchObject({
      ru: { title: "Двенадцать стульев", status: "draft" },
      en: { title: "The Twelve Chairs", status: "draft" },
    });
    expect(moscow?.titleResearch.en).toMatchObject({
      status: "verified-research",
      selectedValue: "Moscow and Muscovites",
      hiddenManifestationVariants: ["Moscow & Muscovites"],
    });
    expect(moscow?.work.translations?.en?.title).toBe(
      "Moscow and Muscovites"
    );

    expect(year?.titleResearch.en).toMatchObject({
      status: "withheld",
      selectedValue: null,
      selectionRule: null,
    });
    expect(year?.work.firstPublished).toBeUndefined();
    expect(year?.work.translations?.en).toBeUndefined();
    expect(year?.discoveryOnlySourceIds).toEqual([
      "lulu-year-of-the-lord-9798988282402",
    ]);
    expect(year?.work.sources?.some((source) => source.url.includes("lulu.com"))).toBe(
      false
    );
  });

  it("grounds RU descriptions and their EN translations only in Russian official sources", () => {
    const allowedAuthorityIds = new Set(["neb", "rsl", "ast", "azbooka"]);
    for (const entry of batch01CatalogEntries) {
      const research = entry.descriptionResearch;
      expect(research).toBeDefined();
      expect(research?.en.sourceIds).toEqual(research?.ru.sourceIds);
      expect(research?.ru.sentenceAttestations?.map((item) => item.sentence)).toEqual([
        1,
        2,
      ]);
      const descriptionSourceUrls = new Set(
        entry.work.translations?.ru?.descriptionProvenance?.sourceUrls || []
      );
      expect(
        entry.work.translations?.en?.descriptionProvenance?.sourceUrls ||
          [...descriptionSourceUrls]
      ).toEqual([...descriptionSourceUrls]);
      for (const sourceId of research?.ru.sourceIds || []) {
        const source = batchManifestJson.sources.find(
          (item) => item.sourceId === sourceId
        );
        expect(source?.evidenceClass).toBe("current-registry");
        expect(allowedAuthorityIds.has(source?.authorityId || "")).toBe(true);
      }
    }
  });

  it("is rejected by the ordinary publication gate for independent reasons", () => {
    const [twelveChairs, moscow, year] = batch01CatalogEntries;
    for (const entry of [twelveChairs, moscow]) {
      expect(bookPublicationIssues(entry!.work)).toEqual(
        expect.arrayContaining([
          "перевод ru не прошёл редакционную проверку",
          "перевод en не прошёл редакционную проверку",
        ])
      );
    }
    expect(bookPublicationIssues(year!.work)).toEqual(
      expect.arrayContaining([
        "перевод ru не прошёл редакционную проверку",
        "нет перевода en",
      ])
    );
  });

  it("does not change the ordinary archive, visitor archive or searchable corpus", () => {
    const archive = buildBookArchive(bookArchiveCountries);
    const publicArchive = buildPublicBookArchive(bookArchiveCountries);
    const researchTitles = new Set(expectedResearchTitles.map(normalizedTitle));

    expect(
      archive.filter((book) => researchTitles.has(normalizedTitle(book.title)))
    ).toEqual([]);
    expect(
      publicArchive.filter((book) => researchTitles.has(normalizedTitle(book.title)))
    ).toEqual([]);
    expect(bookCanonResearchCatalog.every((entry) => !isPublicBook(entry.work))).toBe(
      true
    );
  });

  it("has no import path from book archive, visitor UI or search modules", async () => {
    const protectedModules = [
      "./bookArchive.ts",
      "../App.tsx",
      "../components/BookArchiveSection.tsx",
      "../components/GlobalSearch.tsx",
      "../search/globalSearchIndex.ts",
      "../search/globalSearchRuntime.ts",
    ];
    for (const relativePath of protectedModules) {
      const source = await readFile(new URL(relativePath, import.meta.url), "utf8");
      expect(source, relativePath).not.toContain("bookCanonResearchCatalog");
      expect(source, relativePath).not.toContain("bookCanonAdditionsBatch01");
      expect(source, relativePath).not.toContain("bookCanonLocHeldResearchBatch01");
    }
  });

  it("fails closed if the research manifest or runtime envelope is promoted", () => {
    const publicEffect = structuredClone(batchManifestJson) as unknown as {
      publicationEffect: string;
    };
    publicEffect.publicationEffect = "public";
    expect(() => buildBookCanonAdditionsBatch01Overlay(publicEffect)).toThrow(
      "publication-effect-must-remain-none"
    );

    const canonClaim = structuredClone(batchManifestJson) as unknown as {
      candidates: Array<{ canonAssessment: { status: string } }>;
    };
    canonClaim.candidates[0]!.canonAssessment.status = "canonical-classic";
    expect(() => buildBookCanonAdditionsBatch01Overlay(canonClaim)).toThrow(
      "canon-status"
    );

    const inventedEnglishTitle = structuredClone(batchManifestJson) as unknown as {
      candidates: Array<{
        localizedTitles: { en: { status: string; selectedValue: string | null } };
      }>;
    };
    inventedEnglishTitle.candidates[2]!.localizedTitles.en.status =
      "verified-research";
    inventedEnglishTitle.candidates[2]!.localizedTitles.en.selectedValue =
      "The Summer of the Lord";
    expect(() =>
      buildBookCanonAdditionsBatch01Overlay(inventedEnglishTitle)
    ).toThrow("year-of-the-lord-en-title-must-remain-withheld");

    const promotedOverlay = structuredClone(bookCanonAdditionsBatch01Overlay[0]!);
    promotedOverlay.work.editorial = { status: "reviewed" };
    expect(() =>
      buildBookCanonResearchCatalog(bookArchiveCountries, [promotedOverlay])
    ).toThrow("work-must-remain-draft");
  });
});
