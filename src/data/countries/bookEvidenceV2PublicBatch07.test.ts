import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import canonRegistry from "../../../data/book-canon-source-registry.json";
import { buildBookArchive, type BookArchiveEntry } from "../bookArchive";
import {
  bookDescriptionProvenanceIssues,
  isBookEvidenceV2Ready,
  localizedBookTitleEvidenceIssues,
} from "../bookEvidence";
import { isPublicBook } from "../bookQuality";
import { bookArchiveCountries } from "./index";
import {
  applyBookEvidenceV2PublicBatch07,
  applyBookEvidenceV2PublicBatch07Work,
  bookEvidenceV2PublicBatch07AuthorityDrafts,
  bookEvidenceV2PublicBatch07Holds,
  bookEvidenceV2PublicBatch07RecordKeys,
  bookEvidenceV2PublicBatch07RequiredAuthorityIds,
  bookEvidenceV2PublicBatch07ResolvedRecordKeys,
} from "./bookEvidenceV2PublicBatch07";
import type { WorkLocale } from "./types";

const authorityIds = new Set(
  canonRegistry.authorities.map((authority) => authority.authorityId)
);
const augmentedRegistry = {
  ...canonRegistry,
  authorities: [
    ...canonRegistry.authorities,
    ...bookEvidenceV2PublicBatch07AuthorityDrafts.filter(
      (authority) => !authorityIds.has(authority.authorityId)
    ),
  ],
};

const expectedRecords = [
  {
    recordKey: "france:roger_martin_du_gard:the-thibaults",
    originCountryId: "france",
    status: "hold",
  },
  {
    recordKey: "germany:theodor_mommsen:history-of-rome",
    originCountryId: "germany",
    ru: "Римская история",
    en: "The History of Rome",
    status: "resolved",
  },
  {
    recordKey: "russia:chekhov:the-black-monk",
    originCountryId: "russia",
    ru: "Черный монах",
    en: "The Black Monk",
    status: "resolved",
  },
  {
    recordKey: "russia:chekhov:the-man-in-a-case",
    originCountryId: "russia",
    ru: "Человек в футляре",
    en: "The Man in a Case",
    status: "resolved",
  },
  {
    recordKey: "russia:chekhov:the-lady-with-the-dog",
    originCountryId: "russia",
    ru: "Дама с собачкой",
    en: "The Lady with the Dog",
    status: "resolved",
  },
] as const;

const baseArchive = buildBookArchive(bookArchiveCountries, {
  includeUserSuppliedCovers: false,
});
const appliedArchive = baseArchive.map((entry) => ({
  ...entry,
  ...applyBookEvidenceV2PublicBatch07Work(
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

describe("public book evidence V2 batch 07", () => {
  it("targets the exact five predecessor holds once, resolves four, and keeps one explicit hold", () => {
    expect(new Set(bookEvidenceV2PublicBatch07RecordKeys)).toEqual(
      new Set(expectedRecords.map((record) => record.recordKey))
    );
    expect(new Set(bookEvidenceV2PublicBatch07ResolvedRecordKeys)).toEqual(
      new Set(
        expectedRecords
          .filter((record) => record.status === "resolved")
          .map((record) => record.recordKey)
      )
    );
    expect(bookEvidenceV2PublicBatch07Holds).toHaveLength(1);

    for (const record of expectedRecords) {
      expect(
        baseArchive.filter(
          (entry) =>
            `${entry.countryId}:${entry.writerId}:${entry.id}` ===
            record.recordKey
        ),
        record.recordKey
      ).toHaveLength(1);
    }
  });

  it("publishes the four exact RU/EN display titles with both title gates and description provenance closed", () => {
    for (const record of expectedRecords.filter(
      (item) => item.status === "resolved"
    )) {
      const work = entryByRecordKey(appliedArchive, record.recordKey);
      expect(work.title).toBe(record.ru);
      expect(work.translations?.ru?.title).toBe(record.ru);
      expect(work.translations?.en?.title).toBe(record.en);
      expect(work.localizedTitles?.ru?.value).toBe(record.ru);
      expect(work.localizedTitles?.en?.value).toBe(record.en);
      expect(work.translations?.ru?.status).toBe("verified");
      expect(work.translations?.en?.status).toBe("verified");
      expect(work.editorial?.status).toBe("verified");
      expect(work).not.toHaveProperty("canon");
      expect(isPublicBook(work), `${record.recordKey}:public`).toBe(true);

      for (const locale of ["ru", "en"] as WorkLocale[]) {
        expect(
          localizedBookTitleEvidenceIssues(work, locale, {
            canonRegistry: augmentedRegistry,
          }),
          `${record.recordKey}:${locale}:title`
        ).toEqual([]);
      }

      const ruHash = sha256(work.translations?.ru?.description || "");
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
      expect(isBookEvidenceV2Ready(work, context), record.recordKey).toBe(true);
    }
  });

  it("proves Chekhov analytic titles only through exact container relationships", () => {
    for (const recordKey of [
      "russia:chekhov:the-black-monk",
      "russia:chekhov:the-man-in-a-case",
    ]) {
      const work = entryByRecordKey(appliedArchive, recordKey);
      const displayTitle = work.translations?.en?.title;
      const evidence = work.localizedTitles?.en?.evidence || [];
      expect(evidence).toHaveLength(2);
      expect(
        evidence.every(
          (item) =>
            item.titleRelation === "contained-work" &&
            item.analyticTitleExact === displayTitle &&
            item.containerTitleExact === item.catalogTitleExact &&
            item.containedInField === "table-of-contents"
        )
      ).toBe(true);
      for (const item of evidence) {
        const source = work.sources?.find(
          (candidate) => candidate.url === item.sourceUrl
        );
        expect(source?.fields).toEqual(
          expect.arrayContaining([
            "title",
            "container-title",
            "contained-title",
          ])
        );
      }
    }

    const lady = entryByRecordKey(
      appliedArchive,
      "russia:chekhov:the-lady-with-the-dog"
    );
    expect(lady.localizedTitles?.en?.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          authorityId: "loc",
          titleRelation: "contained-work",
          analyticTitleExact: "The lady with the dog",
          containerTitleExact: "The lady with the dog and other stories",
        }),
        expect.objectContaining({
          authorityId: "open-road-media",
          catalogTitleExact: "The Lady with the Dog",
        }),
      ])
    );
  });

  it("keeps the complete History of Rome distinct from the rejected abridged compendium", () => {
    const work = entryByRecordKey(
      appliedArchive,
      "germany:theodor_mommsen:history-of-rome"
    );
    expect(work.localizedTitles?.ru?.value).toBe("Римская история");
    expect(work.localizedTitles?.en?.value).toBe("The History of Rome");
    expect(
      work.sources?.some(
        (source) =>
          source.recordId === "ISBN-9785041679996" ||
          source.url.includes("ITD1265309")
      )
    ).toBe(false);
    expect(
      work.localizedTitles?.ru?.evidence.some(
        (evidence) => evidence.catalogTitleExact === "История Рима"
      )
    ).toBe(false);
  });

  it("quarantines the incomplete Thibaults evidence as draft and preserves the exact two-component LoC finding", () => {
    const recordKey = "france:roger_martin_du_gard:the-thibaults";
    const before = entryByRecordKey(baseArchive, recordKey);
    const after = entryByRecordKey(appliedArchive, recordKey);
    const hold = bookEvidenceV2PublicBatch07Holds[0];

    expect(after.title).toBe(before.title);
    expect(after.description).toBe(before.description);
    expect(after.translations?.ru?.description).toBe(
      before.translations?.ru?.description
    );
    expect(after.translations?.en?.description).toBe(
      before.translations?.en?.description
    );
    expect(after.editorial?.status).toBe("draft");
    expect(after.translations?.ru?.status).toBe("draft");
    expect(after.translations?.en?.status).toBe("draft");
    expect(isPublicBook(after)).toBe(false);
    expect(
      (after as BookArchiveEntry & { evidenceV2Hold?: unknown }).evidenceV2Hold
    ).toEqual(hold);
    expect(after.localizedTitles?.ru).toBeUndefined();
    expect(after.localizedTitles?.en).toBeUndefined();

    const englishComponents = hold.componentEvidence.filter(
      (item) => item.locale === "en"
    );
    expect(englishComponents).toEqual([
      expect.objectContaining({
        recordId: "LCCN-39027260",
        observedTitle: "The Thibaults",
        disposition: "required-component",
      }),
      expect.objectContaining({
        recordId: "LCCN-41051575",
        observedTitle: "Summer, 1914",
        disposition: "required-component",
      }),
    ]);
    expect(new Set(englishComponents.map((item) => item.authorityId))).toEqual(
      new Set(["loc"])
    );
  });

  it("declares every authority and remains deterministic, immutable, and cardinality-closed", () => {
    const augmentedAuthorityIds = new Set(
      augmentedRegistry.authorities.map((authority) => authority.authorityId)
    );
    expect(
      bookEvidenceV2PublicBatch07RequiredAuthorityIds.every((authorityId) =>
        augmentedAuthorityIds.has(authorityId)
      )
    ).toBe(true);

    for (const record of expectedRecords) {
      const original = entryByRecordKey(baseArchive, record.recordKey);
      const once = applyBookEvidenceV2PublicBatch07Work(
        original.countryId,
        original.writerId,
        original
      );
      const twice = applyBookEvidenceV2PublicBatch07Work(
        original.countryId,
        original.writerId,
        once
      );
      expect(twice, `${record.recordKey}:idempotent`).toEqual(once);
      expect(
        entryByRecordKey(baseArchive, record.recordKey),
        `${record.recordKey}:immutable`
      ).toEqual(original);
    }

    expect(() => applyBookEvidenceV2PublicBatch07([])).toThrow(
      /book-evidence-v2-public-batch-07-target-cardinality/u
    );
  });
});
