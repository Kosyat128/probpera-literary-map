import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import canonRegistry from "../../../data/book-canon-source-registry.json";
import { buildBookArchive, type BookArchiveEntry } from "../bookArchive";
import { bookEvidenceV2Issues } from "../bookEvidence";
import { isPublicBook } from "../bookQuality";
import { bookArchiveCountries } from "./index";
import {
  applyBookEvidenceV2ExpansionBatch01,
  applyBookEvidenceV2ExpansionBatch01Work,
  bookEvidenceV2ExpansionBatch01RecordKeys,
} from "./bookEvidenceV2ExpansionBatch01";

const targetKey = "usa:francis_scott_fitzgerald:the-great-gatsby";
const baseArchive = buildBookArchive(bookArchiveCountries, {
  includeUserSuppliedCovers: false,
});

function entryByKey(archive: BookArchiveEntry[], key: string) {
  const matches = archive.filter(
    (entry) => `${entry.countryId}:${entry.writerId}:${entry.id}` === key
  );
  expect(matches, key).toHaveLength(1);
  return matches[0];
}

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

describe("book Evidence V2 expansion batch 01", () => {
  it("targets exactly The Great Gatsby and is deterministic and immutable", () => {
    expect(bookEvidenceV2ExpansionBatch01RecordKeys).toEqual([targetKey]);
    const original = entryByKey(baseArchive, targetKey);
    const once = applyBookEvidenceV2ExpansionBatch01Work(
      original.countryId,
      original.writerId,
      original
    );
    const twice = applyBookEvidenceV2ExpansionBatch01Work(
      original.countryId,
      original.writerId,
      once
    );
    expect(twice).toEqual(once);
    expect(entryByKey(baseArchive, targetKey)).toEqual(original);
    expect(() => applyBookEvidenceV2ExpansionBatch01([])).toThrow(
      /target-cardinality:0/u
    );
  });

  it("uses independently attested Russian and US publication titles", () => {
    const original = entryByKey(baseArchive, targetKey);
    const work = applyBookEvidenceV2ExpansionBatch01Work(
      original.countryId,
      original.writerId,
      original
    );
    expect(work.title).toBe("Великий Гэтсби");
    expect(work.localizedTitles?.ru?.value).toBe("Великий Гэтсби");
    expect(work.localizedTitles?.en?.value).toBe("The Great Gatsby");
    expect(
      work.localizedTitles?.ru?.evidence.map((item) => item.authorityId)
    ).toEqual(["neb", "ast"]);
    expect(
      work.localizedTitles?.en?.evidence.map((item) => item.authorityId)
    ).toEqual(["loc", "simon-schuster-us"]);
    expect(work.localizedTitles?.ru?.evidence[0]).toEqual(
      expect.objectContaining({
        catalogTitleExact: "Великий Гэтсби",
        publicationYear: 1965,
        translator: "Е. Д. Калашникова",
      })
    );
    expect(work.localizedTitles?.en?.evidence[1]).toEqual(
      expect.objectContaining({
        catalogTitleExact: "The Great Gatsby",
        isbn13: "9780684830421",
        editionStatement: "The Only Authorized Edition",
      })
    );
  });

  it("publishes two original, source-bound descriptions and passes the strict gate", () => {
    const original = entryByKey(baseArchive, targetKey);
    const work = applyBookEvidenceV2ExpansionBatch01Work(
      original.countryId,
      original.writerId,
      original
    );
    const ruDescription = work.translations?.ru?.description || "";
    expect(sha256(ruDescription)).toBe(
      "b3e8e9d1211d92c64aca48485471f000d041812fbdf334550de1a9c5e5ef2c75"
    );
    expect(work.translations?.en?.description).not.toContain("Великий Гэтсби");
    expect(work.translations?.ru?.descriptionProvenance?.rights).toEqual({
      textOrigin: "project-original",
      copiedSourceText: false,
    });
    expect(work.translations?.en?.descriptionProvenance).toEqual(
      expect.objectContaining({
        origin: "human-translation",
        translatedFromLocale: "ru",
        translatedFromSourceHash: sha256(ruDescription),
      })
    );
    expect(work).not.toHaveProperty("canon");
    const issues = bookEvidenceV2Issues(work, {
      canonRegistry,
      recordKey: targetKey,
      originCountryIds: ["usa"],
      descriptionSha256ByLocale: { ru: sha256(ruDescription) },
    });
    expect(issues).toEqual([]);
    expect(isPublicBook(work)).toBe(true);
  });
});

