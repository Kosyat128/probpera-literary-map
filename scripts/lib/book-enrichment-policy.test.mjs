import { describe, expect, it } from "vitest";

import {
  automaticRejectReasons,
  automaticResearchReasons,
  canonicalWorkSourceField,
  curatedRecordIssues,
  englishAnnotationIssues,
  russianAnnotationIssues,
  sourceAuthorityFamily,
  sourceLegalIssues,
} from "./book-enrichment-policy.mjs";

const annotationMetadata = {
  method: "editorial-original",
  author: "Редактор",
  createdAt: "2026-08-08",
  reviewedBy: "Выпускающий редактор",
  reviewedAt: "2026-08-08",
};

function readyRecord() {
  const sources = [
    {
      provider: "Wikidata",
      url: "https://www.wikidata.org/wiki/Q208460",
      usage: "structured-data",
      fields: ["identity", "title", "publication-year", "language"],
      license: "CC0 1.0",
      retrievedAt: "2026-08-08",
      textReuse: "none",
    },
    {
      provider: "British Library",
      url: "https://www.bl.uk/works/example",
      usage: "reference-only",
      fields: ["identity", "authorship", "description"],
      retrievedAt: "2026-08-08",
      textReuse: "none",
    },
  ];
  const factChecks = [
    "identity",
    "authorship",
    "publication-year",
    "original-language",
  ].map((field) => ({
    field,
    value: "checked",
    sourceUrls: sources.map((source) => source.url),
    checkedAt: "2026-08-08",
  }));

  return {
    recordKey: "england:writer:work",
    canonical: {
      titleRu: "Проверенная книга",
      titleEn: "A Verified Book",
      originalTitle: "A Verified Book",
      firstPublished: 1945,
      originalLanguage: "английский",
      genres: ["роман"],
    },
    annotationRu: {
      ...annotationMetadata,
      text: "Роман показывает, как частный выбор героя постепенно становится нравственным испытанием для всего сообщества. Сдержанная композиция связывает личный конфликт с историческим временем и не подменяет сюжет общими оценками.",
    },
    annotationEn: {
      ...annotationMetadata,
      text: "The novel shows how one character's private choice gradually becomes a moral test for an entire community. Its restrained structure connects personal conflict with historical change without replacing the plot with generic praise.",
    },
    sources,
    factChecks,
    rights: {
      textOrigin: "project-original",
      copiedSourceText: false,
    },
  };
}

describe("book enrichment policy", () => {
  it("researches edition identifiers and rejects obvious study/reference material", () => {
    expect(
      automaticRejectReasons({
        id: "openlibrary-works-ol19948076m",
        title: "Dr Goldsmith's Roman history",
        sourceUrl: "https://openlibrary.org/works/OL19948076M",
      })
    ).not.toContain("invalid-openlibrary-work-id");
    expect(
      automaticResearchReasons({
        id: "openlibrary-works-ol19948076m",
        title: "Dr Goldsmith's Roman history",
        sourceUrl: "https://openlibrary.org/works/OL19948076M",
      })
    ).toContain("invalid-openlibrary-work-id-needs-canonical-resolution");
    expect(
      automaticRejectReasons({
        id: "openlibrary-works-ol34355198w",
        title: "To Kill a Mockingbird Study Guide",
        sourceUrl: "https://openlibrary.org/works/OL34355198W",
      })
    ).toContain("study-material");
    expect(
      automaticRejectReasons({
        id: "openlibrary-works-ol18460630w",
        title: "Prentice Hall Literature--World Masterpieces",
        sourceUrl: "https://openlibrary.org/works/OL18460630W",
      })
    ).toContain("textbook-or-course-anthology");
    expect(
      automaticRejectReasons({
        id: "openlibrary-works-ol15237196w",
        title: "The Georgics of Virgil translated by Thomas Neville",
        sourceUrl: "https://openlibrary.org/works/OL15237196W",
      })
    ).toContain("translation-or-editor-credit-in-title");
  });

  it("keeps derivative works for research instead of deleting them", () => {
    const record = {
      id: "openlibrary-works-ol15902631w",
      title: "The Kite Runner--the graphic novel",
      sourceUrl: "https://openlibrary.org/works/OL15902631W",
      firstPublished: 2011,
      genres: ["graphic novel"],
    };
    expect(automaticRejectReasons(record)).toEqual([]);
    expect(automaticResearchReasons(record)).toContain(
      "adaptation-or-derivative"
    );
  });

  it("requires original reviewed 2-3 sentence annotations in both locales", () => {
    expect(russianAnnotationIssues(readyRecord().annotationRu)).toEqual([]);
    expect(englishAnnotationIssues(readyRecord().annotationEn)).toEqual([]);
    expect(
      russianAnnotationIssues({
        ...annotationMetadata,
        text: "Карточка связана с исходной статьёй и готовится редакцией.",
      })
    ).toEqual(
      expect.arrayContaining([
        "russian-annotation-must-have-2-or-3-sentences",
        "russian-annotation-must-have-140-to-900-characters",
        "generic-or-placeholder-annotation",
      ])
    );
    expect(
      englishAnnotationIssues({
        ...readyRecord().annotationEn,
        text: `${readyRecord().annotationEn.text} Ложная русская вставка.`,
      })
    ).toContain("english-annotation-must-not-contain-cyrillic");
  });

  it("accepts a fully sourced bilingual record and blocks a missing EN version", () => {
    const record = readyRecord();
    expect(curatedRecordIssues(record)).toEqual([]);
    expect(
      curatedRecordIssues({ ...record, annotationEn: null }).slice(0, 1)
    ).toEqual(["missing-english-annotation"]);
    expect(
      curatedRecordIssues({
        ...record,
        canonical: { ...record.canonical, titleEn: "English І title" },
      })
    ).toContain("english-title-must-not-contain-cyrillic");
  });

  it("requires revision-level attribution for Wikipedia/Wikimedia prose", () => {
    expect(
      sourceLegalIssues({
        provider: "Wikipedia",
        url: "https://en.wikipedia.org/wiki/Example",
        fields: ["description"],
        retrievedAt: "2026-08-08",
        license: "CC BY-SA 4.0",
      })
    ).toEqual(
      expect.arrayContaining([
        "wikipedia-pageTitle-required",
        "wikipedia-revisionId-required",
        "wikipedia-attribution-required",
      ])
    );
  });

  it("counts Wikidata and Wikipedia as one authority family", () => {
    const record = readyRecord();
    record.sources[1] = {
      provider: "Wikipedia",
      authority: "different-label-must-not-split-wikimedia",
      url: "https://en.wikipedia.org/wiki/Example",
      usage: "reference-only",
      fields: ["identity", "authorship"],
      license: "CC BY-SA 4.0",
      retrievedAt: "2026-08-08",
      textReuse: "none",
      pageTitle: "Example",
      revisionId: "123",
      revisionUrl:
        "https://en.wikipedia.org/w/index.php?title=Example&oldid=123",
      attribution: "Wikipedia contributors",
      authorsUrl:
        "https://en.wikipedia.org/w/index.php?title=Example&action=history",
    };
    record.factChecks = record.factChecks.map((check) => ({
      ...check,
      sourceUrls: record.sources.map((source) => source.url),
    }));

    expect(curatedRecordIssues(record)).toContain(
      "two-independent-authority-families-required"
    );
  });

  it("groups subdomains owned by one national institution as one authority", () => {
    expect(
      [
        "https://catalogue.bnf.fr/ark:/12148/example",
        "https://gallica.bnf.fr/ark:/12148/example",
      ].map((url) => sourceAuthorityFamily({ url }))
    ).toEqual(["bnf", "bnf"]);
    expect(
      sourceAuthorityFamily({
        url: "https://catalogue.bnf.fr/ark:/12148/example",
        authorityId: "declared-national-library",
      })
    ).toBe("declared-national-library");
  });

  it("validates source usage, licensed-copy rights and declared fact URLs", () => {
    expect(
      [
        "alias",
        "source-record",
        "authorship-context",
        "context",
        "first-edition",
        "original-language",
        "publication-history",
        "work-form",
      ].map(canonicalWorkSourceField)
    ).toEqual([
      "identity",
      "identity",
      "authorship",
      "description",
      "publication-year",
      "language",
      "publication-year",
      "genre",
    ]);
    expect(
      sourceLegalIssues({
        provider: "Example",
        url: "https://example.org/work",
        usage: "copied",
        fields: ["identity"],
        retrievedAt: "2026-08-08",
        textReuse: "none",
      })
    ).toContain("source-usage-invalid");
    expect(
      sourceLegalIssues({
        provider: "Example",
        url: "https://example.org/work",
        usage: "licensed-copy",
        fields: ["description"],
        retrievedAt: "2026-08-08",
      })
    ).toContain("licensed-copy-license-required");
    expect(
      sourceLegalIssues({
        provider: "Example",
        url: "https://example.org/work",
        usage: "reference-only",
        fields: ["description"],
        retrievedAt: "2026-08-08",
      })
    ).toContain("reference-source-text-reuse-must-be-none");

    const record = readyRecord();
    record.factChecks[0] = {
      ...record.factChecks[0],
      value: "",
      sourceUrls: ["https://undeclared.example/work"],
    };
    expect(curatedRecordIssues(record)).toEqual(
      expect.arrayContaining([
        "fact-check-identity-value-required",
        "fact-check-identity-source-not-declared",
      ])
    );
  });

  it("requires independently evidenced declarations for cross-writer merges", () => {
    const record = readyRecord();
    record.confirmedMerges = [
      {
        fromRecordKey: "other-country:wrong-writer:duplicate",
        externalIdentity: "wikidata:Q208460",
        relation: "same-work-wrong-writer-assignment",
        evidenceSourceUrls: record.sources.map((source) => source.url),
        note: "The reviewed identity and authorship sources confirm that this is the same work under a wrong writer relation.",
      },
    ];
    expect(curatedRecordIssues(record)).toEqual([]);

    record.confirmedMerges[0].evidenceSourceUrls = [
      "https://undeclared.example/work",
    ];
    expect(curatedRecordIssues(record)).toEqual(
      expect.arrayContaining([
        "confirmed-merge-evidence-source-invalid",
        "confirmed-merge-identity-authorship-evidence-required",
      ])
    );
  });

  it("requires ISO review dates and an independent reviewer", () => {
    const annotation = {
      ...readyRecord().annotationRu,
      reviewedBy: annotationMetadata.author,
      reviewedAt: "08.08.2026",
    };
    expect(russianAnnotationIssues(annotation)).toEqual(
      expect.arrayContaining([
        "annotation-reviewed-at-must-be-iso-date",
        "annotation-reviewer-must-differ-from-author",
      ])
    );
    expect(
      russianAnnotationIssues({
        ...readyRecord().annotationRu,
        reviewedAt: "2026-02-30",
      })
    ).toContain("annotation-reviewed-at-must-be-iso-date");
  });
});
