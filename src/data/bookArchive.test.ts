import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  applyBookEnrichmentActions,
  applyBookArchiveWriterPresentationOverride,
  buildBookArchive,
  filterRejectedBookCandidates,
  mergeWriterWorkCandidates,
  type BookEnrichmentActionsPayload,
} from "./bookArchive";
import { selectBookWriterName } from "./bookLocalization";
import { isPublicBook } from "./bookQuality";
import { bookArchiveCountries } from "./countries";
import type { Country, WorkProfile } from "./countries/types";

const archive = buildBookArchive(bookArchiveCountries);
const editorialSeries = [
  ["Три мушкетёра", 1844, "verified"],
  ["Вишнёвый сад", 1904, "verified"],
  ["Морской волк", 1904, "verified"],
  ["1984", 1949, "reviewed"],
  ["Хоббит, или Туда и обратно", 1937, "reviewed"],
  ["Отцы и дети", 1862, "verified"],
] as const;

describe("редакционная серия книжного архива", () => {
  it("applies CMS author names to archive/search presentation without mutating source membership", () => {
    const source = {
      id: "fixture-country",
      name: "Тестовая страна",
      writers: [
        {
          id: "fixture-writer",
          name: "Исходное имя",
          fullName: "Original Name",
          bio: "Проверенная биография",
          works: ["Исходный список"],
          workDetails: [
            {
              id: "verified-work",
              title: "Проверенное произведение",
              editorial: { status: "draft" as const },
            },
          ],
        },
      ],
    } as Country;
    const overrides = {
      "fixture-country:fixture-writer": {
        name: "Имя из CMS",
        fullName: "CMS Display Name",
        bio: "Не должно заменять проверенную биографию архива",
        works: ["Не должно создавать книгу"],
      },
    };

    const archiveWithOverride = buildBookArchive([source], {
      includeReviewedGenerated: false,
      applyEnrichmentActions: false,
      includeUserSuppliedCovers: false,
      writerProfileOverrides: overrides,
    });

    expect(archiveWithOverride).toHaveLength(2);
    expect(archiveWithOverride.map((book) => book.title)).toEqual([
      "Проверенное произведение",
      "Исходный список",
    ]);
    expect(archiveWithOverride[0].writerName).toBe("Имя из CMS");
    expect(selectBookWriterName(archiveWithOverride[0], "ru")).toBe(
      "Имя из CMS"
    );
    expect(selectBookWriterName(archiveWithOverride[0], "en")).toBe(
      "CMS Display Name"
    );
    expect(archiveWithOverride[0].writer.bio).toBe("Проверенная биография");
    expect(source.writers).toHaveLength(1);
    expect(source.writers[0].name).toBe("Исходное имя");
    expect(source.writers[0].fullName).toBe("Original Name");

    expect(
      applyBookArchiveWriterPresentationOverride(
        source.id,
        source.writers[0],
        {}
      )
    ).toBe(source.writers[0]);
  });

  it.each(editorialSeries)(
    "связывает «%s» с автором, годом и собственной обложкой",
    (title, year, editorialStatus) => {
      const book = archive.find((entry) => entry.title === title);

      expect(book).toBeDefined();
      expect(book?.firstPublished).toBe(year);
      expect(book?.writerName).toBeTruthy();
      expect(book?.coverRights?.status).toBe("editorial-original");
      expect(book?.editorial?.status).toBe(editorialStatus);

      const coverPath = fileURLToPath(
        new URL(`../../public/${book?.coverUrl}`, import.meta.url)
      );
      expect(existsSync(coverPath)).toBe(true);
    }
  );

  it("не хранит названия подробных карточек второй раз в legacy-списках", () => {
    const duplicates = bookArchiveCountries.flatMap((country) =>
      country.writers.flatMap((writer) => {
        const legacyTitles = new Set(
          (writer.works || []).map((title) => title.toLocaleLowerCase("ru"))
        );
        return (writer.workDetails || [])
          .filter((work) =>
            legacyTitles.has(work.title.toLocaleLowerCase("ru"))
          )
          .map(
            (work) =>
              `${country.name}: ${writer.name || writer.fullName}: ${work.title}`
          );
      })
    );

    expect(duplicates).toEqual([]);
  });

  it("reviewed overlay заменяет draft-карточку и сохраняет её обложку", () => {
    const sourceUrls = [
      "https://www.wikidata.org/wiki/Q1",
      "https://openlibrary.org/works/OL1W",
    ];
    const draft: WorkProfile = {
      id: "openlibrary-works-ol1w",
      title: "Original title",
      coverUrl: "/covers/original.webp",
      coverRights: {
        status: "editorial-original",
        sourceUrl: "https://example.org/cover",
        checkedAt: "2026-08-08",
      },
      editorial: { status: "draft" },
    };
    const reviewed: WorkProfile = {
      id: draft.id,
      title: "Проверенное название",
      description:
        "Герой сталкивается с нравственным выбором, который меняет его отношения с близкими и заставляет по-новому увидеть прошлое. Роман последовательно раскрывает цену этого решения через конкретный конфликт и развитие характеров.",
      translations: {
        ru: {
          locale: "ru",
          title: "Проверенное название",
          description:
            "Герой сталкивается с нравственным выбором, который меняет его отношения с близкими и заставляет по-новому увидеть прошлое. Роман последовательно раскрывает цену этого решения через конкретный конфликт и развитие характеров.",
          sourceLanguage: "ru",
          status: "reviewed",
          sourceUrls,
          method: "editorial-original",
          reviewedAt: "2026-08-08",
        },
        en: {
          locale: "en",
          title: "Verified title",
          description:
            "The protagonist faces a moral choice that changes close relationships and forces a different understanding of the past. The novel traces the cost of that decision through a concrete conflict and carefully developed characters.",
          sourceLanguage: "en",
          status: "reviewed",
          sourceUrls,
          method: "editorial-original",
          reviewedAt: "2026-08-08",
        },
      },
      sources: [
        {
          provider: "Wikidata",
          url: sourceUrls[0],
          fields: ["identity", "authorship"],
          license: "CC0 1.0",
          usage: "structured-data",
          retrievedAt: "2026-08-08",
        },
        {
          provider: "Open Library",
          url: sourceUrls[1],
          fields: ["identity", "title"],
          usage: "reference-only",
          retrievedAt: "2026-08-08",
        },
      ],
      editorial: { status: "reviewed", reviewedAt: "2026-08-08" },
    };

    const [merged] = mergeWriterWorkCandidates([[reviewed], [draft]]);

    expect(merged.coverUrl).toBe(draft.coverUrl);
    expect(merged.title).toBe(reviewed.title);
    expect(merged.editorial?.status).toBe("reviewed");
    expect(isPublicBook(merged)).toBe(true);
  });

  it("применяет только safe merge/reject, сохраняя research вне публикации", () => {
    const actions: BookEnrichmentActionsPayload = {
      generatedAt: "2026-08-08T00:00:00.000Z",
      sourceManifestFingerprint: "fixture",
      source: "test fixture",
      rejects: [
        {
          recordKey: "england:writer:reject-me",
          reasonCodes: ["study-material"],
        },
      ],
      merges: [
        {
          from: "england:writer:alias",
          into: "england:writer:canonical",
          basis: "same-writer-exact-editorial-title-alias",
          preserveWriterRelation: true,
        },
      ],
    };
    const canonical: WorkProfile = {
      id: "canonical",
      title: "Каноническая карточка",
      editorial: { status: "draft" },
    };
    const result = applyBookEnrichmentActions(
      "england",
      "writer",
      [
        canonical,
        {
          id: "alias",
          title: "Canonical card",
          coverUrl: "/covers/alias.webp",
          editorial: { status: "draft" },
        },
        {
          id: "reject-me",
          title: "Study guide",
          editorial: { status: "draft" },
        },
        {
          id: "research",
          title: "Needs research",
          editorial: { status: "draft" },
        },
      ],
      actions
    );

    expect(result.map((work) => work.id)).toEqual(["canonical", "research"]);
    expect(result[0].coverUrl).toBe("/covers/alias.webp");
    expect(result.filter(isPublicBook)).toEqual([]);
  });

  it("не позволяет rejected-дублю передать поля canonical-карточке", () => {
    const actions: BookEnrichmentActionsPayload = {
      generatedAt: "2026-08-08T00:00:00.000Z",
      sourceManifestFingerprint: "fixture",
      source: "test fixture",
      rejects: [
        {
          recordKey: "england:writer:rejected-duplicate",
          reasonCodes: ["study-material"],
        },
      ],
      merges: [],
    };
    const canonical: WorkProfile = {
      id: "canonical",
      title: "Same title",
      editorial: { status: "draft" },
    };
    const rejectedDuplicate: WorkProfile = {
      id: "rejected-duplicate",
      title: "Same title",
      tags: ["leaked-tag"],
      coverUrl: "/covers/rejected.webp",
      sourceUrl: "https://example.org/rejected",
      editorial: { status: "draft" },
    };
    const filtered = filterRejectedBookCandidates(
      "england",
      "writer",
      [canonical, rejectedDuplicate],
      actions
    );
    const [merged] = mergeWriterWorkCandidates([filtered]);

    expect(filtered).toEqual([canonical]);
    expect(merged.tags).toBeUndefined();
    expect(merged.coverUrl).toBeUndefined();
    expect(merged.sourceUrl).toBeUndefined();
  });

  it("удаляет неверную cross-writer связь только по reviewed correction action", () => {
    const wrongRelation: WorkProfile = {
      id: "openlibrary-works-ol1w",
      title: "Wrong writer relation",
      editorial: { status: "draft" },
    };
    const actions: BookEnrichmentActionsPayload = {
      generatedAt: "2026-08-08T00:00:00.000Z",
      sourceManifestFingerprint: "fixture",
      source: "test fixture",
      rejects: [],
      merges: [
        {
          from: "russia:wrong-writer:openlibrary-works-ol1w",
          into: "usa:correct-writer:canonical-work",
          basis: "curated-reviewed-cross-writer-authorship-correction",
          preserveWriterRelation: false,
        },
      ],
    };

    expect(
      applyBookEnrichmentActions(
        "russia",
        "wrong-writer",
        [wrongRelation],
        actions
      )
    ).toEqual([]);

    const undeclared = structuredClone(actions);
    undeclared.merges[0].basis = "identical-external-work-identifier";
    expect(
      applyBookEnrichmentActions(
        "russia",
        "wrong-writer",
        [wrongRelation],
        undeclared
      )
    ).toEqual([wrongRelation]);
  });
});
