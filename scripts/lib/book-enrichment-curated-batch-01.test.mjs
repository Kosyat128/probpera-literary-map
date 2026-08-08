import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  countAnnotationSentences,
  curatedRecordIssues,
  sourceAuthorityFamily,
} from "./book-enrichment-policy.mjs";

const batch = JSON.parse(
  await readFile(
    new URL(
      "../../data/book-enrichment-curated-batch-01.json",
      import.meta.url
    ),
    "utf8"
  )
);

const EXPECTED_RECORD_KEYS = [
  "england:william_shakespeare:hamlet",
  "russia:tolstoy:war-and-peace",
  "russia:dostoevsky:crime-and-punishment",
  "france:victor_hugo:les-miserables",
  "england:george_orwell:nineteen-eighty-four",
  "england:j_r_r_tolkien:openlibrary-works-ol27448w",
  "france:saint_exupery:openlibrary-works-ol10263w",
  "austria:franz_kafka:openlibrary-works-ol498556w",
  "canada:margaret_atwood:openlibrary-works-ol675783w",
  "usa:jerome_david_salinger:the-catcher-in-the-rye-editorial",
  "spain:miguel_de_cervantes:openlibrary-works-ol15272537w",
  "usa:harper_lee:to-kill-a-mockingbird-editorial",
  "usa:ray_bradbury:fahrenheit-451-editorial",
  "england:aldous_huxley:brave-new-world-editorial",
  "usa:vladimir_nabokov:lolita-editorial",
  "england:george_orwell:animal-farm-editorial",
  "england:j_r_r_tolkien:the-hobbit",
  "france:flaubert:madame-bovary",
  "england:jane_austen:pride-and-prejudice",
  "usa:herman_melville:moby-dick",
];

const EXPECTED_FACTS = {
  "england:william_shakespeare:hamlet": ["William Shakespeare", 1603, "английский"],
  "russia:tolstoy:war-and-peace": ["Лев Николаевич Толстой", 1869, "русский"],
  "russia:dostoevsky:crime-and-punishment": ["Фёдор Михайлович Достоевский", 1866, "русский"],
  "france:victor_hugo:les-miserables": ["Victor Hugo", 1862, "французский"],
  "england:george_orwell:nineteen-eighty-four": ["George Orwell", 1949, "английский"],
  "england:j_r_r_tolkien:openlibrary-works-ol27448w": ["John Ronald Reuel Tolkien", 1954, "английский"],
  "france:saint_exupery:openlibrary-works-ol10263w": ["Antoine de Saint-Exupéry", 1943, "французский"],
  "austria:franz_kafka:openlibrary-works-ol498556w": ["Franz Kafka", 1915, "немецкий"],
  "canada:margaret_atwood:openlibrary-works-ol675783w": ["Margaret Atwood", 1985, "английский"],
  "usa:jerome_david_salinger:the-catcher-in-the-rye-editorial": ["Jerome David Salinger", 1951, "английский"],
  "spain:miguel_de_cervantes:openlibrary-works-ol15272537w": ["Miguel de Cervantes Saavedra", 1605, "испанский"],
  "usa:harper_lee:to-kill-a-mockingbird-editorial": ["Harper Lee", 1960, "английский"],
  "usa:ray_bradbury:fahrenheit-451-editorial": ["Ray Bradbury", 1953, "английский"],
  "england:aldous_huxley:brave-new-world-editorial": ["Aldous Huxley", 1932, "английский"],
  "usa:vladimir_nabokov:lolita-editorial": ["Vladimir Vladimirovich Nabokov", 1955, "английский"],
  "england:george_orwell:animal-farm-editorial": ["George Orwell", 1945, "английский"],
  "england:j_r_r_tolkien:the-hobbit": ["John Ronald Reuel Tolkien", 1937, "английский"],
  "france:flaubert:madame-bovary": ["Gustave Flaubert", 1857, "французский"],
  "england:jane_austen:pride-and-prejudice": ["Jane Austen", 1813, "английский"],
  "usa:herman_melville:moby-dick": ["Herman Melville", 1851, "английский"],
};

const EXPECTED_REVIEWER = "Codex factual QA — writer-quality agent";

describe("curated book enrichment batch 01", () => {
  it("contains the exact 20 unique canonical records selected from the manifest", () => {
    expect(batch.schemaVersion).toBe(1);
    expect(batch.batchId).toBe("curated-01");
    expect(batch.updatedAt).toBe("2026-08-08");
    expect(batch.records).toHaveLength(20);
    expect(batch.records.map((record) => record.recordKey)).toEqual(
      EXPECTED_RECORD_KEYS
    );
    expect(new Set(batch.records.map((record) => record.recordKey)).size).toBe(
      20
    );
  });

  it("pins the researched authors, first-publication years, and original languages", () => {
    for (const record of batch.records) {
      const [author, year, language] = EXPECTED_FACTS[record.recordKey];
      const authorship = record.factChecks.find(
        (check) => check.field === "authorship"
      );

      expect(authorship?.value, record.recordKey).toBe(author);
      expect(record.canonical.firstPublished, record.recordKey).toBe(year);
      expect(record.canonical.originalLanguage, record.recordKey).toBe(language);
    }
  });

  it("promotes only the records independently reviewed in both locales", () => {
    for (const record of batch.records) {
      expect(record.requestedStatus, record.recordKey).toBe("ready");
      for (const annotation of [record.annotationRu, record.annotationEn]) {
        expect(annotation.author, record.recordKey).toBe(
          "Codex editorial draft"
        );
        expect(annotation.reviewedBy, record.recordKey).toBe(EXPECTED_REVIEWER);
        expect(annotation.reviewedAt, record.recordKey).toBe("2026-08-08");
        expect(annotation.reviewedBy, record.recordKey).not.toBe(
          annotation.author
        );
      }
      expect(curatedRecordIssues(record), record.recordKey).toEqual([]);
    }
  });

  it("has original, non-repeated RU and EN annotations of exactly two sentences", () => {
    const russianTexts = new Set();
    const englishTexts = new Set();

    for (const record of batch.records) {
      for (const [locale, annotation] of [
        ["ru", record.annotationRu],
        ["en", record.annotationEn],
      ]) {
        expect(countAnnotationSentences(annotation.text), `${record.recordKey}:${locale}`).toBe(2);
        expect(annotation.text.length, `${record.recordKey}:${locale}`).toBeGreaterThanOrEqual(140);
        expect(annotation.text.length, `${record.recordKey}:${locale}`).toBeLessThanOrEqual(900);
        expect(annotation.method, `${record.recordKey}:${locale}`).toBe(
          "editorial-original"
        );
      }
      russianTexts.add(record.annotationRu.text);
      englishTexts.add(record.annotationEn.text);
    }

    expect(russianTexts.size).toBe(20);
    expect(englishTexts.size).toBe(20);
  });

  it("declares every fact-check URL and cites at least two authority families", () => {
    const requiredFactFields = [
      "authorship",
      "identity",
      "original-language",
      "publication-year",
    ];

    for (const record of batch.records) {
      const sourceUrls = new Set(record.sources.map((source) => source.url));
      const authorityFamilies = new Set(
        record.sources.map(sourceAuthorityFamily).filter(Boolean)
      );
      const factFields = record.factChecks
        .map((check) => check.field)
        .sort();

      expect(factFields, record.recordKey).toEqual(requiredFactFields);
      expect(authorityFamilies.size, record.recordKey).toBeGreaterThanOrEqual(2);
      for (const source of record.sources) {
        expect(source.url, record.recordKey).toMatch(/^https:\/\//u);
        expect(source.textReuse, record.recordKey).toBe("none");
      }
      for (const check of record.factChecks) {
        expect(check.sourceUrls.length, `${record.recordKey}:${check.field}`).toBeGreaterThan(0);
        for (const sourceUrl of check.sourceUrls) {
          expect(sourceUrls.has(sourceUrl), `${record.recordKey}:${check.field}:${sourceUrl}`).toBe(true);
        }
      }
    }
  });

  it("declares the independently verified legacy Lolita identity correction", () => {
    expect(
      batch.records
        .filter((record) => (record.confirmedMerges || []).length > 0)
        .map((record) => record.recordKey)
    ).toEqual(["usa:vladimir_nabokov:lolita-editorial"]);
    const lolita = batch.records.find(
      (record) =>
        record.recordKey === "usa:vladimir_nabokov:lolita-editorial"
    );
    const declaredSourceUrls = new Set(
      lolita.sources.map((source) => source.url)
    );

    expect(lolita.confirmedMerges).toEqual([
      {
        fromRecordKey: "russia:nabrakov:openlibrary-works-ol627084w",
        externalIdentity: "openlibrary:OL627084W",
        relation: "same-work-wrong-writer-assignment",
        evidenceSourceUrls: [
          "https://openlibrary.org/works/OL627084W",
          "https://findingaids.loc.gov/repositories/19/resources/2037",
        ],
        note: expect.stringMatching(/misspells Nabokov.*corrects the writer relation/iu),
      },
    ]);
    for (const sourceUrl of lolita.confirmedMerges[0].evidenceSourceUrls) {
      expect(declaredSourceUrls.has(sourceUrl), sourceUrl).toBe(true);
    }
    expect(
      batch.records.some(
        (record) => record.recordKey === lolita.confirmedMerges[0].fromRecordKey
      )
    ).toBe(false);
  });

  it("records the required publication-history distinctions", () => {
    const byKey = new Map(
      batch.records.map((record) => [record.recordKey, record])
    );

    expect(byKey.get("russia:tolstoy:war-and-peace").editorialNotes).toMatch(
      /1865.*1867.*1868–1869/u
    );
    expect(
      byKey.get("spain:miguel_de_cervantes:openlibrary-works-ol15272537w")
        .editorialNotes
    ).toMatch(/1605.*1615/u);
    expect(
      byKey.get("england:j_r_r_tolkien:openlibrary-works-ol27448w")
        .editorialNotes
    ).toMatch(/1954.*1955/u);
    expect(byKey.get("france:flaubert:madame-bovary").editorialNotes).toMatch(
      /1857.*1856/u
    );
  });
});
