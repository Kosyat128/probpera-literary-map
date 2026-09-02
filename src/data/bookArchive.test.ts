import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  applyCrossCountryReviewedCanonMerges,
  applyBookEnrichmentActions,
  applyBookArchiveWriterPresentationOverride,
  bookArchiveKey,
  buildBookArchive,
  filterRejectedBookCandidates,
  mergeReviewedCanonWorkIdentity,
  mergeWriterWorkCandidates,
  resolveBookArchiveAuthorTargets,
  type BookEnrichmentActionsPayload,
} from "./bookArchive";
import {
  selectBookAuthorByline,
  selectBookAuthorRefs,
  selectBookWriterName,
} from "./bookLocalization";
import { isPublicBook } from "./bookQuality";
import { bookArchiveCountries } from "./countries";
import enrichmentActionsJson from "./countries/generated/books.enrichment-actions.json";
import type { Country, WorkProfile } from "./countries/types";

const archive = buildBookArchive(bookArchiveCountries);
const rawArchive = buildBookArchive(bookArchiveCountries, {
  includeReviewedGenerated: false,
  applyEnrichmentActions: false,
  includeUserSuppliedCovers: false,
});
const archiveBeforeEnrichmentActions = buildBookArchive(bookArchiveCountries, {
  applyEnrichmentActions: false,
  includeUserSuppliedCovers: false,
});
const archiveAfterEnrichmentActions = buildBookArchive(bookArchiveCountries, {
  includeUserSuppliedCovers: false,
});
const checkedInEnrichmentActions =
  enrichmentActionsJson as BookEnrichmentActionsPayload;
const reviewedCanonMergeCases = [
  {
    label: "Franklin / The Way to Wealth",
    from: "usa:benjamin_franklin:openlibrary-works-ol2514745w",
    into: "usa:benjamin_franklin:openlibrary-works-ol26610w",
    canonicalTitle: "The Way to Wealth",
    expectedYear: 1758,
  },
  {
    label: "Thoreau / Walden",
    from: "usa:henry_david_thoreau:openlibrary-works-ol21138836w",
    into: "usa:henry_david_thoreau:openlibrary-works-ol55649w",
    canonicalTitle: "Walden; or, Life in the Woods",
    expectedYear: 1854,
  },
  {
    label: "London / The Call of the Wild",
    from: "usa:jack_london:openlibrary-works-ol144705w",
    into: "usa:jack_london:openlibrary-works-ol14942956w",
    canonicalTitle: "The Call of the Wild",
    expectedYear: 1903,
  },
  {
    label: "Faulkner / The Sound and the Fury",
    from: "usa:william_faulkner:openlibrary-works-ol82870w",
    into: "usa:william_faulkner:the-sound-and-the-fury-editorial",
    canonicalTitle: "The Sound and the Fury",
    expectedYear: 1929,
  },
  {
    label: "Steinbeck / The Grapes of Wrath",
    from: "usa:john_steinbeck:openlibrary-works-ol23205w",
    into: "usa:john_steinbeck:the-grapes-of-wrath-editorial",
    canonicalTitle: "The Grapes of Wrath",
    expectedYear: 1939,
  },
  {
    label: "Hemingway / For Whom the Bell Tolls",
    from: "usa:ernest_hemingway:openlibrary-works-ol63009w",
    into: "usa:ernest_hemingway:for-whom-the-bell-tolls-editorial",
    canonicalTitle: "For Whom the Bell Tolls",
    expectedYear: 1940,
  },
  {
    label: "Maupassant / Une vie",
    from: "france:maupassant:openlibrary-works-ol93822w",
    into: "france:maupassant:openlibrary-works-ol93840w",
    canonicalTitle: "Une vie",
    expectedYear: 1883,
  },
  {
    label: "Zola / Therese Raquin",
    from: "france:emile_zola:openlibrary-works-ol3521623w",
    into: "france:emile_zola:openlibrary-works-ol7982341w",
    canonicalTitle: "Thérèse Raquin",
    expectedYear: 1867,
  },
  {
    label: "Wilde / English legacy card",
    from: "england:oscar_wilde:legacy-oscar_wilde-портрет-дориана-грея",
    into: "ireland:oscar_wilde:legacy-oscar_wilde-портрет-дориана-грея",
    canonicalTitle: "The Picture of Dorian Gray",
    expectedYear: undefined,
  },
  {
    label: "Wilde / Open Library card",
    from: "england:oscar_wilde:openlibrary-works-ol8193416w",
    into: "ireland:oscar_wilde:legacy-oscar_wilde-портрет-дориана-грея",
    canonicalTitle: "The Picture of Dorian Gray",
    expectedYear: undefined,
  },
] as const;
const editorialSeries = [
  ["Три мушкетёра", 1844, "verified"],
  ["Вишнёвый сад", 1904, "verified"],
  ["Морской волк", 1904, "verified"],
  ["1984", 1949, "verified"],
  ["Хоббит, или Туда и обратно", 1937, "verified"],
  ["Отцы и дети", 1862, "verified"],
] as const;

describe("редакционная серия книжного архива", () => {
  it("сохраняет полный corpus baseline и все проверенные safe merge/reject", () => {
    expect(rawArchive).toHaveLength(10_057);
    expect(archive).toHaveLength(9_761);
    expect(rawArchive.length - archive.length).toBe(296);
    expect(archive.filter(isPublicBook)).toHaveLength(46);
  });

  it("applies reviewed identity resolutions without promoting held dates", () => {
    const byKey = new Map(
      archive.map((work) => [
        bookArchiveKey(work.countryId, work.writerId, work.id),
        work,
      ])
    );
    expect(
      byKey.has("france:emile_zola:openlibrary-works-ol3521623w")
    ).toBe(false);
    expect(
      byKey.get("france:emile_zola:openlibrary-works-ol7982341w")
        ?.firstPublished
    ).toBe(1867);

    const twain = byKey.get(
      "usa:mark_twain:openlibrary-works-ol53908w"
    );
    expect(twain?.firstPublished).toBeUndefined();
    expect(twain?.alternateTitles).toContain(
      "The Adventures of Huckleberry Finn (Tom Sawyer’s Comrade)."
    );
    expect(twain && isPublicBook(twain)).toBe(false);

    const faulkner = byKey.get(
      "usa:william_faulkner:the-sound-and-the-fury-editorial"
    );
    expect(faulkner?.title).toBe("Шум и ярость");
    expect(faulkner?.firstPublished).toBe(1929);
    expect(faulkner?.coverRights?.status).toBe("editorial-original");
    expect(faulkner?.alternateTitles).toContain("The Sound and the Fury");
    expect(faulkner?.externalIds).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scheme: "openlibrary",
          value: "OL82870W",
        }),
      ])
    );

    expect(
      byKey.has(
        "england:oscar_wilde:legacy-oscar_wilde-портрет-дориана-грея"
      )
    ).toBe(false);
    expect(
      byKey.has("england:oscar_wilde:openlibrary-works-ol8193416w")
    ).toBe(false);
    const wilde = byKey.get(
      "ireland:oscar_wilde:legacy-oscar_wilde-портрет-дориана-грея"
    );
    expect(wilde?.firstPublished).toBeUndefined();
    expect(wilde?.originalTitle).toBe("The Picture of Dorian Gray");
    expect(wilde?.externalIds).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scheme: "openlibrary",
          value: "OL8193416W",
        }),
      ])
    );
  });

  it.each(reviewedCanonMergeCases)(
    "losslessly applies reviewed merge: $label",
    ({ from, into, canonicalTitle, expectedYear }) => {
      expect(reviewedCanonMergeCases).toHaveLength(10);
      const beforeByKey = new Map(
        archiveBeforeEnrichmentActions.map((work) => [
          bookArchiveKey(work.countryId, work.writerId, work.id),
          work,
        ])
      );
      const afterByKey = new Map(
        archiveAfterEnrichmentActions.map((work) => [
          bookArchiveKey(work.countryId, work.writerId, work.id),
          work,
        ])
      );
      const source = beforeByKey.get(from);
      const survivorBefore = beforeByKey.get(into);
      const survivorAfter = afterByKey.get(into);

      expect(source, `missing pre-merge source ${from}`).toBeDefined();
      expect(
        survivorBefore,
        `missing pre-merge survivor ${into}`
      ).toBeDefined();
      expect(afterByKey.has(from)).toBe(false);
      expect(survivorAfter, `missing post-merge survivor ${into}`).toBeDefined();
      if (!source || !survivorBefore || !survivorAfter) return;

      expect(survivorAfter).toMatchObject({
        id: survivorBefore.id,
        countryId: survivorBefore.countryId,
        writerId: survivorBefore.writerId,
        title: survivorBefore.title,
        editorial: survivorBefore.editorial,
      });
      expect(survivorAfter.firstPublished).toBe(expectedYear);
      expect(isPublicBook(survivorAfter)).toBe(false);

      const searchableTitles = new Set([
        survivorAfter.title,
        survivorAfter.originalTitle,
        ...(survivorAfter.alternateTitles || []),
      ]);
      expect(searchableTitles.has(canonicalTitle)).toBe(true);
      for (const title of [
        source.title,
        source.originalTitle,
        ...(source.alternateTitles || []),
      ].filter(Boolean)) {
        expect(searchableTitles.has(title)).toBe(true);
      }

      for (const genre of [
        ...(source.genres || []),
        ...(survivorBefore.genres || []),
      ]) {
        expect(survivorAfter.genres).toContain(genre);
      }
      for (const tag of [
        ...(source.tags || []),
        ...(survivorBefore.tags || []),
      ]) {
        expect(survivorAfter.tags).toContain(tag);
      }
      for (const sourceRecord of [
        ...(source.sources || []),
        ...(survivorBefore.sources || []),
      ]) {
        expect(survivorAfter.sources).toEqual(
          expect.arrayContaining([sourceRecord])
        );
      }
      for (const externalId of [
        ...(source.externalIds || []),
        ...(survivorBefore.externalIds || []),
      ]) {
        expect(survivorAfter.externalIds).toEqual(
          expect.arrayContaining([externalId])
        );
      }
      for (const distinction of [
        ...(source.distinctions || []),
        ...(survivorBefore.distinctions || []),
      ]) {
        expect(survivorAfter.distinctions).toEqual(
          expect.arrayContaining([distinction])
        );
      }

      const expectedTranslations =
        source.translations || survivorBefore.translations
          ? {
              ...(source.translations || {}),
              ...(survivorBefore.translations || {}),
            }
          : undefined;
      const expectedLocalizedTitles =
        source.localizedTitles || survivorBefore.localizedTitles
          ? {
              ...(source.localizedTitles || {}),
              ...(survivorBefore.localizedTitles || {}),
            }
          : undefined;
      expect(survivorAfter.translations).toEqual(expectedTranslations);
      expect(survivorAfter.localizedTitles).toEqual(expectedLocalizedTitles);

      for (const field of [
        "authorship",
        "originalLanguage",
        "description",
        "canon",
        "edition",
      ] as const) {
        const expectedValue =
          survivorBefore[field] !== undefined
            ? survivorBefore[field]
            : source[field];
        expect(survivorAfter[field]).toEqual(expectedValue);
      }

      const openLibraryId = source.sourceUrl
        ?.toUpperCase()
        .match(/OL\d+W/u)?.[0];
      if (openLibraryId) {
        expect(survivorAfter.externalIds).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              scheme: "openlibrary",
              value: openLibraryId,
            }),
          ])
        );
      }

      for (const field of [
        "coverUrl",
        "coverThumbnailUrl",
        "coverWidth",
        "coverHeight",
        "coverThumbnailWidth",
        "coverThumbnailHeight",
        "coverSourceUrl",
        "coverRights",
      ] as const) {
        const expectedValue =
          survivorBefore[field] !== undefined
            ? survivorBefore[field]
            : source[field];
        expect(survivorAfter[field]).toEqual(expectedValue);
      }
    }
  );

  it("leaves the held Thoreau multiwork manifestation byte-for-byte unchanged", () => {
    const heldKey =
      "usa:henry_david_thoreau:openlibrary-works-ol55661w";
    const before = archiveBeforeEnrichmentActions.find(
      (work) =>
        bookArchiveKey(work.countryId, work.writerId, work.id) === heldKey
    );
    const after = archiveAfterEnrichmentActions.find(
      (work) =>
        bookArchiveKey(work.countryId, work.writerId, work.id) === heldKey
    );

    expect(before).toBeDefined();
    expect(after).toStrictEqual(before);
    expect(after && isPublicBook(after)).toBe(false);
  });

  it("persists Twain's withheld-year alias decision in checked-in actions", () => {
    const action = checkedInEnrichmentActions.aliases?.find(
      (candidate) =>
        candidate.resolutionId ===
        "alias-loc-full-huckleberry-title-to-ol53908w"
    );

    expect(action).toBeDefined();
    if (!action) return;
    const roundTripped = JSON.parse(JSON.stringify(action)) as typeof action;
    expect(roundTripped).toMatchObject({
      recordKey: "usa:mark_twain:openlibrary-works-ol53908w",
      workFirstPublishedStatus: "withheld",
      workFirstPublished: null,
      resolutionId: "alias-loc-full-huckleberry-title-to-ol53908w",
    });
    expect(roundTripped.resolutionFingerprint).toMatch(/^[a-f0-9]{64}$/u);
    expect(roundTripped.targetFingerprint).toMatch(/^[a-f0-9]{64}$/u);
    expect(roundTripped.targetMergeProjectionFingerprint).toMatch(
      /^[a-f0-9]{64}$/u
    );
  });

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
    expect(
      bookArchiveKey(
        archiveWithOverride[0].countryId,
        archiveWithOverride[0].writerId,
        archiveWithOverride[0].id
      )
    ).toBe("fixture-country:fixture-writer:verified-work");
    expect(selectBookAuthorRefs(archiveWithOverride[0])).toEqual([
      {
        countryId: "fixture-country",
        writerId: "fixture-writer",
        creditNames: { ru: "Имя из CMS", en: "CMS Display Name" },
        attribution: "credited",
      },
    ]);
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

  it("хранит соавторство в одной карточке, не меняя legacy key", () => {
    const source: Country = {
      id: "russia-fixture",
      name: "Россия",
      writers: [
        {
          id: "ilya-ilf",
          name: "Илья Ильф",
          fullName: "Ilya Ilf",
          workDetails: [
            {
              id: "the-twelve-chairs",
              title: "Двенадцать стульев",
              authorship: {
                kind: "multiple",
                authors: [
                  {
                    countryId: "russia-fixture",
                    writerId: "ilya-ilf",
                    creditNames: { ru: "Илья Ильф", en: "Ilya Ilf" },
                  },
                  {
                    countryId: "russia-fixture",
                    writerId: "yevgeny-petrov",
                    creditNames: {
                      ru: "Евгений Петров",
                      en: "Yevgeny Petrov",
                    },
                  },
                ],
              },
              editorial: { status: "draft" },
            },
          ],
        },
        {
          id: "yevgeny-petrov",
          name: "Евгений Петров",
          fullName: "Yevgeny Petrov",
        },
      ],
    };
    const archiveWithAuthorship = buildBookArchive([source], {
      includeReviewedGenerated: false,
      applyEnrichmentActions: false,
      includeUserSuppliedCovers: false,
      writerProfileOverrides: {},
    });
    const [book] = archiveWithAuthorship;

    expect(book).toBeDefined();
    expect(archiveWithAuthorship).toHaveLength(1);
    expect(bookArchiveKey(book.countryId, book.writerId, book.id)).toBe(
      "russia-fixture:ilya-ilf:the-twelve-chairs"
    );
    expect(selectBookAuthorByline(book, "ru")).toBe(
      "Илья Ильф и Евгений Петров"
    );
    expect(selectBookAuthorByline(book, "en")).toBe(
      "Ilya Ilf and Yevgeny Petrov"
    );
    expect(selectBookAuthorRefs(book).map(({ writerId }) => writerId)).toEqual([
      "ilya-ilf",
      "yevgeny-petrov",
    ]);
    expect(
      resolveBookArchiveAuthorTargets([source], book).map(
        ({ writer }) => writer.id
      )
    ).toEqual(["ilya-ilf", "yevgeny-petrov"]);

    const reversed = {
      ...book,
      authorship: {
        ...book.authorship!,
        authors: [...book.authorship!.authors].reverse(),
      },
    };
    expect(
      bookArchiveKey(reversed.countryId, reversed.writerId, reversed.id)
    ).toBe(bookArchiveKey(book.countryId, book.writerId, book.id));
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

  it("losslessly unions reviewed Work identity fields and applies the reviewed year", () => {
    const source: WorkProfile = {
      id: "openlibrary-works-ol1w",
      title: "The Reviewed Work",
      firstPublished: 2001,
      genres: ["novel"],
      tags: ["Open Library"],
      sourceUrl: "https://openlibrary.org/works/OL1W",
      editorial: { status: "draft" },
    };
    const survivor: WorkProfile = {
      id: "editorial-survivor",
      title: "Проверенное произведение",
      coverUrl: "/covers/editorial.webp",
      coverRights: {
        status: "editorial-original",
        sourceUrl: "/covers/editorial.webp",
      },
      editorial: { status: "draft" },
    };
    const action: BookEnrichmentActionsPayload["merges"][number] = {
      from: "usa:writer:openlibrary-works-ol1w",
      into: "usa:writer:editorial-survivor",
      basis: "canon-reviewed-work-identity-resolution",
      preserveWriterRelation: true,
      workFirstPublishedStatus: "authority-backed",
      workFirstPublished: 1901,
      canonicalTitle: "The Reviewed Work",
    };

    const merged = mergeReviewedCanonWorkIdentity(source, survivor, action);
    expect(merged).toMatchObject({
      id: "editorial-survivor",
      title: "Проверенное произведение",
      originalTitle: "The Reviewed Work",
      firstPublished: 1901,
      coverUrl: "/covers/editorial.webp",
      coverRights: { status: "editorial-original" },
    });
    expect(merged.alternateTitles).toContain("The Reviewed Work");
    expect(merged.genres).toEqual(["novel"]);
    expect(merged.externalIds).toEqual([
      {
        scheme: "openlibrary",
        value: "OL1W",
        sourceUrl: "https://openlibrary.org/works/OL1W",
      },
    ]);
    expect(mergeReviewedCanonWorkIdentity(source, merged, action)).toEqual(
      merged
    );
  });

  it("applies exact reviewed aliases and durably withholds an uncertified year", () => {
    const actions: BookEnrichmentActionsPayload = {
      generatedAt: "2026-09-02T00:00:00.000Z",
      sourceManifestFingerprint: "fixture",
      source: "test fixture",
      rejects: [],
      merges: [],
      aliases: [
        {
          recordKey: "usa:mark_twain:work",
          title:
            "The Adventures of Huckleberry Finn (Tom Sawyer’s Comrade).",
          sourceId: "loc-twain-huckleberry-finn",
          basis: "canon-reviewed-exact-title-alias",
          resolutionId: "alias-loc-full-huckleberry-title-to-ol53908w",
          resolutionFingerprint: "a".repeat(64),
          targetFingerprint: "b".repeat(64),
          targetMergeProjectionFingerprint: "c".repeat(64),
          workFirstPublishedStatus: "withheld",
          workFirstPublished: null,
        },
      ],
    };
    const [result] = applyBookEnrichmentActions(
      "usa",
      "mark_twain",
      [
        {
          id: "work",
          title: "Adventures of Huckleberry Finn",
          firstPublished: 1876,
          editorial: { status: "draft" },
        },
      ],
      actions
    );

    expect(result.firstPublished).toBeUndefined();
    expect(result.alternateTitles).toEqual([
      "The Adventures of Huckleberry Finn (Tom Sawyer’s Comrade).",
    ]);
    expect(isPublicBook(result)).toBe(false);
  });

  it("re-homes reviewed cross-country duplicates only when both endpoints exist", () => {
    const action: BookEnrichmentActionsPayload["merges"][number] = {
      from: "england:oscar_wilde:source",
      into: "ireland:oscar_wilde:survivor",
      basis: "canon-reviewed-work-identity-resolution",
      preserveWriterRelation: false,
      workFirstPublishedStatus: "withheld",
      workFirstPublished: null,
      canonicalTitle: "The Picture of Dorian Gray",
    };
    const actions: BookEnrichmentActionsPayload = {
      generatedAt: "2026-09-02T00:00:00.000Z",
      sourceManifestFingerprint: "fixture",
      source: "test fixture",
      rejects: [],
      merges: [action],
    };
    const source = {
      id: "source",
      title: "The Picture of Dorian Gray",
      firstPublished: 1890,
      sourceUrl: "https://openlibrary.org/works/OL1W",
      editorial: { status: "draft" as const },
      countryId: "england",
      writerId: "oscar_wilde",
    };
    const survivor = {
      id: "survivor",
      title: "Портрет Дориана Грея",
      editorial: { status: "draft" as const },
      countryId: "ireland",
      writerId: "oscar_wilde",
    };

    const [merged] = applyCrossCountryReviewedCanonMerges(
      [source, survivor] as Parameters<
        typeof applyCrossCountryReviewedCanonMerges
      >[0],
      actions
    );
    expect(merged).toMatchObject({
      id: "survivor",
      countryId: "ireland",
      writerId: "oscar_wilde",
      originalTitle: "The Picture of Dorian Gray",
    });
    expect(merged.firstPublished).toBeUndefined();
    expect(merged.externalIds).toEqual([
      expect.objectContaining({ value: "OL1W" }),
    ]);
    expect(
      applyCrossCountryReviewedCanonMerges(
        [source] as Parameters<
          typeof applyCrossCountryReviewedCanonMerges
        >[0],
        actions
      )
    ).toEqual([source]);
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
