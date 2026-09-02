import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { archiveRawBooks } from "../archive-source.ts";
import { bookArchiveCountries } from "../../src/data/countries/index.ts";
import {
  buildCanonAdditionBatchReport,
  canonAdditionBatchIssues,
  canonAdditionBatchReportIssues,
  canonAdditionCandidateFingerprint,
  canonAdditionManifestFingerprint,
} from "./book-canon-additions-batch01.mjs";

async function jsonFixture(relativePath) {
  return JSON.parse(
    await readFile(new URL(relativePath, import.meta.url), "utf8")
  );
}

async function fixtures() {
  const [manifest, canonRegistry, report] = await Promise.all([
    jsonFixture("../../data/book-canon-additions-batch01.json"),
    jsonFixture("../../data/book-canon-source-registry.json"),
    jsonFixture("../../reports/book-canon-additions-batch01.json"),
  ]);
  return { manifest, canonRegistry, report };
}

function clone(value) {
  return structuredClone(value);
}

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

describe("isolated canon additions research batch 01", () => {
  it("passes the registry, source, corpus-absence and fingerprint contract", async () => {
    const { manifest, canonRegistry } = await fixtures();

    expect(
      canonAdditionBatchIssues(manifest, {
        canonRegistry,
        archiveRecords: archiveRawBooks,
      })
    ).toEqual([]);
    expect(manifest.manifestFingerprint).toBe(
      canonAdditionManifestFingerprint(manifest)
    );
    expect(
      manifest.candidates.every(
        (candidate) =>
          candidate.reviewFingerprint ===
          canonAdditionCandidateFingerprint(candidate)
      )
    ).toBe(true);
    expect(manifest.applicationStatus).toBe("isolated-research-hold");
    expect(manifest.publicationEffect).toBe("none");
  });

  it("selects the three genuinely absent Russian NEB Work holds only", async () => {
    const { manifest, canonRegistry } = await fixtures();
    const selected = manifest.candidates.map((candidate) => ({
      ordinal: candidate.registryHoldRef.ordinal,
      itemId: candidate.registryHoldRef.itemId,
      title: candidate.work.originalTitle,
    }));

    expect(selected).toEqual([
      {
        ordinal: 14,
        itemId: "dvenadcat-stulev",
        title: "Двенадцать стульев",
      },
      {
        ordinal: 12,
        itemId: "vladimir-alekseevich-gilyarovskii-moskva-i-moskvichi",
        title: "Москва и москвичи",
      },
      { ordinal: 32, itemId: "leto-gospodne", title: "Лето Господне" },
    ]);

    const neb = canonRegistry.inventories.find(
      (inventory) => inventory.sourceId === manifest.registrySourceId
    );
    expect(neb.items.filter((item) => item.adjudicationStatus === "held")).toHaveLength(
      5
    );
    expect(
      neb.items
        .filter((item) => item.adjudicationStatus === "held")
        .map((item) => item.itemId)
        .filter(
          (itemId) =>
            !new Set(selected.map((item) => item.itemId)).has(itemId)
        )
    ).toEqual(["printsessa-turandot", "portret-doriana-greya"]);

    const normalizedArchiveTitles = new Set(
      archiveRawBooks.flatMap((book) =>
        [book.title, book.originalTitle, ...(book.alternateTitles || [])]
          .filter(Boolean)
          .map((title) => title.normalize("NFKC").toLocaleLowerCase("ru"))
      )
    );
    for (const candidate of manifest.candidates) {
      expect(
        normalizedArchiveTitles.has(
          candidate.work.originalTitle
            .normalize("NFKC")
            .toLocaleLowerCase("ru")
        ),
        candidate.candidateId
      ).toBe(false);
    }
  });

  it("keeps all proposed author links absent and models Twelve Chairs as one coauthored Work", async () => {
    const { manifest } = await fixtures();
    const activeWriterKeys = new Set(
      bookArchiveCountries.flatMap((country) =>
        country.writers.map((writer) => `${country.id}:${writer.id}`)
      )
    );
    const twelveChairs = manifest.candidates.find(
      (candidate) => candidate.candidateId === "twelve-chairs-coauthored-work"
    );

    expect(twelveChairs.authorship).toMatchObject({
      kind: "multiple",
      authors: [
        {
          position: 1,
          countryId: "russia",
          writerId: "ilya-ilf",
          linkStatus: "missing-active-writer",
        },
        {
          position: 2,
          countryId: "russia",
          writerId: "yevgeny-petrov",
          linkStatus: "missing-active-writer",
        },
      ],
    });
    for (const candidate of manifest.candidates) {
      for (const author of candidate.authorship.authors) {
        expect(
          activeWriterKeys.has(`${author.countryId}:${author.writerId}`),
          `${author.countryId}:${author.writerId}`
        ).toBe(false);
      }
    }
  });

  it("records exact RU and EN manifestation titles without literal translation", async () => {
    const { manifest } = await fixtures();
    const byId = new Map(
      manifest.candidates.map((candidate) => [candidate.candidateId, candidate])
    );

    expect(
      byId.get("twelve-chairs-coauthored-work").localizedTitles
    ).toMatchObject({
      ru: {
        status: "verified-research",
        selectedValue: "Двенадцать стульев",
        evidence: [
          { manifestationId: "RSL:009200723" },
          { isbn13: "9785171466299" },
        ],
      },
      en: {
        status: "verified-research",
        selectedValue: "The Twelve Chairs",
        evidence: [
          { manifestationId: "LCCN:2011013393" },
          { isbn13: "9780810127722" },
        ],
      },
    });
    expect(
      byId.get("moscow-and-muscovites-work").localizedTitles.en
    ).toMatchObject({
      selectedValue: "Moscow and Muscovites",
      hiddenManifestationVariants: ["Moscow & Muscovites"],
      evidence: [
        {
          manifestationId: "LCCN:2013955149",
          principalTitleExact: "Moscow & Muscovites",
        },
        { isbn13: "9781880100820" },
      ],
    });
  });

  it("pins professional two-sentence descriptions and their RU-to-EN relation", async () => {
    const { manifest } = await fixtures();
    const sourceById = new Map(
      manifest.sources.map((source) => [source.sourceId, source])
    );
    const russianOfficialAuthorities = new Set(["neb", "rsl", "ast", "azbooka"]);
    for (const candidate of manifest.candidates) {
      const { ru, en } = candidate.descriptions;
      expect(ru.text.length).toBeGreaterThanOrEqual(140);
      expect(en.text.length).toBeGreaterThanOrEqual(140);
      expect(sha256(ru.text)).toBe(ru.sha256);
      expect(sha256(en.text)).toBe(en.sha256);
      expect(ru.rights).toEqual({
        textOrigin: "project-original",
        copiedSourceText: false,
      });
      expect(en).toMatchObject({
        origin: "human-translation",
        sourceLanguage: "ru",
        translatedFromLocale: "ru",
        translatedFromSourceHash: ru.sha256,
        rights: {
          textOrigin: "project-original",
          copiedSourceText: false,
        },
      });
      expect(en.sourceIds).toEqual(ru.sourceIds);
      expect(
        ru.sourceIds.map((sourceId) => sourceById.get(sourceId)).every(
          (source) =>
            source?.evidenceClass === "current-registry" &&
            russianOfficialAuthorities.has(source.authorityId)
        )
      ).toBe(true);
      expect(ru.sentenceAttestations.map((item) => item.sentence)).toEqual([
        1,
        2,
      ]);
      for (const attestation of ru.sentenceAttestations) {
        expect(attestation.sourceIds.length).toBeGreaterThan(0);
        expect(
          attestation.sourceIds.every((sourceId) =>
            ru.sourceIds.includes(sourceId)
          )
        ).toBe(true);
      }
    }
  });

  it("withholds the unsupported English title and publication date for Лето Господне", async () => {
    const { manifest } = await fixtures();
    const candidate = manifest.candidates.find(
      (item) => item.candidateId === "year-of-the-lord-work"
    );

    expect(candidate.work.firstPublished).toBeNull();
    expect(candidate.localizedTitles.en).toMatchObject({
      status: "withheld",
      selectedValue: null,
      selectionRule: null,
      observedManifestations: [
        {
          observedTitleExact: "The Year of the Lord",
          evidenceUse: "discovery-only",
          isbn13: "9798988282402",
        },
      ],
    });
    expect(candidate.publicationAssessment.holdCodes).toEqual(
      expect.arrayContaining([
        "en-national-bibliography-missing",
        "en-authoritative-publisher-record-missing",
        "work-part-publication-year-model-unresolved",
      ])
    );
  });

  it("keeps the checked-in report deterministic against all three official inventories", async () => {
    const { manifest, canonRegistry, report } = await fixtures();
    const expectedReport = buildCanonAdditionBatchReport(
      manifest,
      canonRegistry,
      archiveRawBooks
    );

    expect(canonAdditionBatchReportIssues(report, expectedReport)).toEqual([]);
    expect(report.inventorySummary).toEqual([
      expect.objectContaining({ sourceId: manifest.registrySourceId, itemCount: 47 }),
      expect.objectContaining({
        sourceId: "loc-books-that-shaped-america-2012",
        itemCount: 96,
      }),
      expect.objectContaining({
        sourceId: "bnf-dne-education-epub-selection-2018",
        itemCount: 149,
      }),
    ]);
    expect(report.selectedCandidates.every((item) => item.rawArchiveExactTitleMatches === 0)).toBe(
      true
    );
  });

  it("fails closed on single-author coercion, literal EN promotion or a stale registry hold", async () => {
    const { manifest, canonRegistry } = await fixtures();
    const singleAuthor = clone(manifest);
    singleAuthor.candidates[0].authorship.kind = "single";
    expect(canonAdditionBatchIssues(singleAuthor, { canonRegistry })).toContain(
      "candidates[0].authorship single must have one author"
    );

    const literalPromotion = clone(manifest);
    literalPromotion.candidates[2].localizedTitles.en = {
      status: "verified-research",
      selectedValue: "The Summer of the Lord",
      market: "US",
      expressionLanguage: "en",
      selectionRule: "current-complete-authorized-edition",
      evidence: [
        ...literalPromotion.candidates[2].localizedTitles.en
          .observedManifestations,
        ...literalPromotion.candidates[2].localizedTitles.en
          .observedManifestations,
      ],
    };
    expect(canonAdditionBatchIssues(literalPromotion, { canonRegistry })).toEqual(
      expect.arrayContaining([
        "candidates[2].localizedTitles.en.evidence[0] cannot use discovery-only evidence",
        "candidates[2].localizedTitles.en lacks two independent title authorities",
        "candidates[2].localizedTitles.en lacks a Tier A national-library record",
      ])
    );

    const staleHold = clone(manifest);
    staleHold.candidates[1].registryHoldRef.itemHash = "0".repeat(64);
    expect(canonAdditionBatchIssues(staleHold, { canonRegistry })).toContain(
      "candidates[1].registryHoldRef itemHash is stale"
    );

    const foreignRuDescription = clone(manifest);
    foreignRuDescription.candidates[0].descriptions.ru.sourceIds[1] =
      "northwestern-twelve-chairs-9780810127722";
    foreignRuDescription.candidates[0].descriptions.en.sourceIds[1] =
      "northwestern-twelve-chairs-9780810127722";
    expect(
      canonAdditionBatchIssues(foreignRuDescription, { canonRegistry })
    ).toContain(
      "candidates[0].descriptions.ru.sourceIds must use Russian official registered authorities"
    );
  });
});
