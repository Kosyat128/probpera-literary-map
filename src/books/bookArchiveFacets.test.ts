import { describe, expect, it } from "vitest";

import { bookArchiveKey, type BookArchiveEntry } from "../data/bookArchive";
import type { BookArchiveQueueItem } from "../data/bookArchiveQueue";
import type { Country, WorkProfile, WriterProfile } from "../data/countries/types";
import {
  applyBookArchiveQuickPreset,
  bookArchiveCoverModeFor,
  bookArchivePeriodFor,
  buildBookArchiveFacetIndex,
  filterBookArchiveFacetIndex,
  normalizeBookArchiveFilterState,
  normalizeBookGenreIds,
  normalizeBookLanguageIds,
  type WorkAudienceProfile,
} from "./bookArchiveFacets";

type FixtureOptions = Readonly<{
  id: string;
  title: string;
  status?: BookArchiveQueueItem["status"];
  countryId?: string;
  countryName?: string;
  writerId?: string;
  writerName?: string;
  fullWriterName?: string;
  work?: Partial<WorkProfile>;
}>;

function fixtureItem({
  id,
  title,
  status = "verified",
  countryId = "country-a",
  countryName = "Страна А",
  writerId = "writer-one",
  writerName = "Автор Один",
  fullWriterName = "Author One",
  work = {},
}: FixtureOptions): BookArchiveQueueItem {
  const writer: WriterProfile = {
    id: writerId,
    name: writerName,
    fullName: fullWriterName,
    works: [],
  };
  const country: Country = {
    id: countryId,
    name: countryName,
    code: countryId.slice(0, 2).toUpperCase(),
    writers: [writer],
  };
  const description =
    "Проверенное редакционное описание произведения для поискового индекса.";
  const book: BookArchiveEntry = {
    id,
    title,
    translations: {
      ru: {
        locale: "ru",
        title,
        description,
        sourceLanguage: "ru",
        status: "reviewed",
        sourceUrls: ["https://example.org/book"],
        method: "editorial-original",
        reviewedAt: "2026-08-25",
      },
      en: {
        locale: "en",
        title: work.originalTitle || title,
        description: "A reviewed editorial description for the search index.",
        sourceLanguage: "en",
        status: "reviewed",
        sourceUrls: ["https://example.org/book"],
        method: "editorial-original",
        reviewedAt: "2026-08-25",
      },
    },
    editorial: { status: "reviewed", reviewedAt: "2026-08-25" },
    ...work,
    countryId,
    countryName,
    writerId,
    writerName,
    writer,
    country,
  };
  return {
    key: bookArchiveKey(countryId, writerId, id),
    status,
    book,
  };
}

function reviewedAudience(
  categories: WorkAudienceProfile["categories"],
  overrides: Partial<WorkAudienceProfile> = {}
): WorkAudienceProfile {
  return {
    categories,
    status: "reviewed",
    sourceUrls: ["https://example.org/audience"],
    reviewedAt: "2026-08-25",
    ...overrides,
  };
}

function buildFixtureIndex() {
  const first = fixtureItem({
    id: "classic-novel",
    title: "Классический роман",
    work: {
      firstPublished: 1890,
      originalLanguage: "английский",
      genres: ["роман"],
      coverUrl: "/covers/classic.webp",
      coverRights: {
        status: "public-domain",
        sourceUrl: "https://example.org/classic-cover",
      },
    },
  });
  const second = fixtureItem({
    id: "early-story",
    title: "Ранний рассказ",
    countryId: "country-b",
    countryName: "Страна Б",
    work: {
      firstPublished: 1930,
      originalLanguage: "французский",
      genres: ["рассказ"],
      coverUrl: "/covers/editorial.webp",
      coverRights: {
        status: "editorial-original",
        sourceUrl: "https://example.org/editorial-cover",
      },
    },
  });
  const third = fixtureItem({
    id: "modern-novel",
    title: "Современный роман",
    countryId: "country-b",
    countryName: "Страна Б",
    writerId: "writer-two",
    writerName: "Автор Два",
    work: {
      firstPublished: 1970,
      originalLanguage: "English",
      genres: ["Novel"],
    },
  });
  const pending = fixtureItem({
    id: "pending-child-tag",
    title: "Черновая детская книга",
    status: "pending",
    writerId: "writer-two",
    writerName: "Автор Два",
    work: {
      firstPublished: 2005,
      originalLanguage: "английский",
      genres: ["детская литература"],
      tags: ["детская литература"],
      coverUrl: "/covers/unverified.webp",
      coverRights: {
        status: "unverified",
        sourceUrl: "https://example.org/unverified-cover",
      },
    },
  });
  const firstKey = first.key;
  const secondKey = second.key;
  const thirdKey = third.key;
  const pendingKey = pending.key;
  const index = buildBookArchiveFacetIndex({
    items: [first, second, third, pending],
    locale: "ru",
    audienceProfiles: {
      [firstKey]: reviewedAudience(["children"]),
      [secondKey]: reviewedAudience(["adult"], { status: "verified" }),
      [thirdKey]: reviewedAudience(["children"], { status: "draft" }),
      [pendingKey]: reviewedAudience(["children"], {
        sourceUrls: ["http://example.org/unreviewed-audience"],
      }),
    },
    mentionIndex: {
      byBook: {
        [firstKey]: [
          {
            id: "article-one",
            title: "Рецензия",
            sectionId: "reviews",
            sectionLabel: "Рецензии",
            readingMinutes: 5,
            kind: "review",
          },
        ],
      },
    },
  });
  return {
    first,
    second,
    third,
    pending,
    firstKey,
    secondKey,
    thirdKey,
    pendingKey,
    index,
  };
}

describe("book archive filter state", () => {
  it("normalizes the exact state contract and rejects malformed controlled values", () => {
    expect(normalizeBookArchiveFilterState()).toEqual({
      query: "",
      quickPreset: "all",
      authorKey: null,
      countryIds: [],
      genreIds: [],
      audienceIds: [],
      periods: [],
      originalLanguageIds: [],
      editorialStatuses: [],
      coverModes: [],
      articleRelations: [],
      savedOnly: false,
      sort: "editorial-relevance",
    });

    expect(
      normalizeBookArchiveFilterState({
        authorKey: "surname-only",
        genreIds: ["novel", "invented"] as never,
        audienceIds: ["children", "guessed"] as never,
        periods: ["xix", "future"] as never,
        originalLanguageIds: ["en", "xx"] as never,
        editorialStatuses: ["verified", "reviewed"] as never,
        coverModes: ["uploaded", "unsafe"] as never,
        articleRelations: ["review", "inferred"] as never,
        sort: "popularity" as never,
      })
    ).toMatchObject({
      authorKey: null,
      genreIds: ["novel"],
      audienceIds: ["children"],
      periods: ["xix"],
      originalLanguageIds: ["en"],
      editorialStatuses: ["verified"],
      coverModes: ["uploaded"],
      articleRelations: ["review"],
      sort: "editorial-relevance",
    });
  });

  it("materializes safe quick presets while preserving query and sort", () => {
    const source = normalizeBookArchiveFilterState({
      query: "Толстой",
      sort: "writer",
      countryIds: ["russia"],
    });

    expect(applyBookArchiveQuickPreset(source, "classic")).toMatchObject({
      query: "Толстой",
      sort: "writer",
      quickPreset: "classic",
      periods: ["pre-1800", "xix", "1900-1945"],
      editorialStatuses: ["verified"],
      countryIds: [],
    });
    expect(applyBookArchiveQuickPreset(source, "modern")).toMatchObject({
      periods: ["1946-1999", "xxi"],
      editorialStatuses: ["verified"],
    });
    expect(applyBookArchiveQuickPreset(source, "with-cover").coverModes).toEqual(
      ["uploaded", "editorial"]
    );
    expect(applyBookArchiveQuickPreset(source, "children").audienceIds).toEqual(
      ["children"]
    );
    expect(applyBookArchiveQuickPreset(source, "saved").savedOnly).toBe(true);
  });
});

describe("book archive controlled facets", () => {
  it("normalizes only controlled genre and language aliases", () => {
    expect(normalizeBookGenreIds(["роман", "Novel", "неизвестный жанр"])).toEqual([
      "novel",
    ]);
    expect(
      normalizeBookLanguageIds(["английский", "English", "неизвестный"])
    ).toEqual(["en"]);
  });

  it("uses exact period boundaries and hides unverified years", () => {
    expect(bookArchivePeriodFor(1799, "verified")).toBe("pre-1800");
    expect(bookArchivePeriodFor(1800, "verified")).toBe("xix");
    expect(bookArchivePeriodFor(1899, "verified")).toBe("xix");
    expect(bookArchivePeriodFor(1900, "verified")).toBe("1900-1945");
    expect(bookArchivePeriodFor(1945, "verified")).toBe("1900-1945");
    expect(bookArchivePeriodFor(1946, "verified")).toBe("1946-1999");
    expect(bookArchivePeriodFor(1999, "verified")).toBe("1946-1999");
    expect(bookArchivePeriodFor(2000, "verified")).toBe("xxi");
    expect(bookArchivePeriodFor(1890, "pending")).toBe("unknown");
    expect(bookArchivePeriodFor(undefined, "verified")).toBe("unknown");
  });

  it("classifies artwork only through the existing rights gates", () => {
    const uploaded = fixtureItem({
      id: "uploaded",
      title: "Uploaded",
      work: {
        coverUrl: "/uploaded.webp",
        coverRights: {
          status: "licensed",
          sourceUrl: "https://example.org/uploaded",
        },
      },
    });
    const editorial = fixtureItem({
      id: "editorial",
      title: "Editorial",
      work: {
        coverUrl: "/editorial.webp",
        coverRights: {
          status: "editorial-original",
          sourceUrl: "https://example.org/editorial",
        },
      },
    });
    const unsafe = fixtureItem({
      id: "unsafe",
      title: "Unsafe",
      work: {
        coverUrl: "/unsafe.webp",
        coverRights: {
          status: "unverified",
          sourceUrl: "https://example.org/unsafe",
        },
      },
    });

    expect(bookArchiveCoverModeFor(uploaded)).toBe("uploaded");
    expect(bookArchiveCoverModeFor(editorial)).toBe("editorial");
    expect(bookArchiveCoverModeFor(unsafe)).toBe("typographic");
  });

  it("builds exact author indexes and never exposes pending metadata facets", () => {
    const { index, pendingKey } = buildFixtureIndex();
    const pending = index.byKey.get(pendingKey);

    expect(index.indexes.author.get("country-a:writer-one")).toEqual([0]);
    expect(index.indexes.author.get("country-b:writer-one")).toEqual([1]);
    expect(index.indexes.author.has("writer-one")).toBe(false);
    expect(pending).toMatchObject({
      period: "unknown",
      genreIds: [],
      originalLanguageIds: [],
      coverMode: "typographic",
    });
    expect(pending?.sourceGenreLabels).toEqual(["детская литература"]);
    expect(pending?.sourceOriginalLanguage).toBe("английский");
  });

  it("indexes one coauthored card under both factual author refs", () => {
    const coauthored = fixtureItem({
      id: "the-twelve-chairs",
      title: "Двенадцать стульев",
      countryId: "russia",
      writerId: "ilya-ilf",
      writerName: "Илья Ильф",
      fullWriterName: "Ilya Ilf",
      work: {
        authorship: {
          kind: "multiple",
          authors: [
            {
              countryId: "russia",
              writerId: "ilya-ilf",
              creditNames: { ru: "Илья Ильф", en: "Ilya Ilf" },
            },
            {
              countryId: "russia",
              writerId: "yevgeny-petrov",
              creditNames: {
                ru: "Евгений Петров",
                en: "Yevgeny Petrov",
              },
            },
          ],
        },
      },
    });
    const index = buildBookArchiveFacetIndex({
      items: [coauthored],
      locale: "ru",
    });
    const document = index.documents[0];

    expect(index.documents).toHaveLength(1);
    expect(document.authorKey).toBe("russia:ilya-ilf");
    expect(document.authorKeys).toEqual([
      "russia:ilya-ilf",
      "russia:yevgeny-petrov",
    ]);
    expect(document.writerLabel).toBe("Илья Ильф и Евгений Петров");
    expect(index.indexes.author.get("russia:ilya-ilf")).toEqual([0]);
    expect(index.indexes.author.get("russia:yevgeny-petrov")).toEqual([0]);
    expect(
      filterBookArchiveFacetIndex(
        index,
        normalizeBookArchiveFilterState({
          authorKey: "russia:yevgeny-petrov",
        })
      ).documents.map(({ key }) => key)
    ).toEqual([coauthored.key]);
    expect(
      filterBookArchiveFacetIndex(
        index,
        normalizeBookArchiveFilterState({ query: "Евгений Петров" })
      ).bestMatchKey
    ).toBe(coauthored.key);
  });

  it("applies OR within categories and AND across categories", () => {
    const { index, firstKey, thirdKey } = buildFixtureIndex();
    const withinCountry = filterBookArchiveFacetIndex(
      index,
      normalizeBookArchiveFilterState({
        countryIds: ["country-a", "country-b"],
        genreIds: ["novel"],
        editorialStatuses: ["verified"],
      })
    );
    expect(withinCountry.documents.map(({ key }) => key).sort()).toEqual(
      [firstKey, thirdKey].sort()
    );

    const withAudience = filterBookArchiveFacetIndex(
      index,
      normalizeBookArchiveFilterState({
        countryIds: ["country-a", "country-b"],
        genreIds: ["novel"],
        audienceIds: ["children"],
        editorialStatuses: ["verified"],
      })
    );
    expect(withAudience.documents.map(({ key }) => key)).toEqual([firstKey]);
  });

  it("keeps audience fail-closed and never guesses children from title or tags", () => {
    const { index, firstKey, thirdKey, pendingKey } = buildFixtureIndex();
    const children = filterBookArchiveFacetIndex(
      index,
      normalizeBookArchiveFilterState({ audienceIds: ["children"] })
    );

    expect(children.documents.map(({ key }) => key)).toEqual([firstKey]);
    expect(children.documents.map(({ key }) => key)).not.toContain(thirdKey);
    expect(children.documents.map(({ key }) => key)).not.toContain(pendingKey);
    expect(index.diagnostics).toMatchObject({
      audienceProfilesAccepted: 2,
      audienceProfilesRejected: 2,
      audienceProfilesUnavailable: 2,
      audienceFacetStatus: "available",
    });
  });

  it("marks audience and relations unavailable instead of inventing empty truth", () => {
    const item = fixtureItem({ id: "only", title: "Only" });
    const index = buildBookArchiveFacetIndex({
      items: [item],
      locale: "ru",
      audienceProfiles: {
        [item.key]: reviewedAudience(["children"], {
          status: "draft",
        }),
      },
    });

    expect(index.diagnostics).toMatchObject({
      audienceProfilesAccepted: 0,
      audienceProfilesRejected: 1,
      audienceFacetStatus: "unavailable",
      relationFacetStatus: "unavailable",
    });
    expect(index.byKey.get(item.key)?.audienceIds).toEqual([]);
    expect(index.byKey.get(item.key)?.articleRelations).toEqual([]);
    expect(index.indexes.relation.size).toBe(0);
  });

  it("uses the supplied relation index only", () => {
    const { index, firstKey, secondKey } = buildFixtureIndex();
    const reviewed = filterBookArchiveFacetIndex(
      index,
      normalizeBookArchiveFilterState({ articleRelations: ["review"] })
    );
    const unrelated = filterBookArchiveFacetIndex(
      index,
      normalizeBookArchiveFilterState({ articleRelations: ["unrelated"] })
    );

    expect(reviewed.documents.map(({ key }) => key)).toEqual([firstKey]);
    expect(unrelated.documents.map(({ key }) => key)).toContain(secondKey);
    expect(unrelated.documents.map(({ key }) => key)).not.toContain(firstKey);
    expect(index.diagnostics.relationFacetStatus).toBe("available");
  });

  it("applies all quick presets without rebuilding saved state into the index", () => {
    const {
      index,
      firstKey,
      secondKey,
      thirdKey,
      pendingKey,
    } = buildFixtureIndex();
    const initial = normalizeBookArchiveFilterState();
    const resultFor = (
      preset: Exclude<
        Parameters<typeof applyBookArchiveQuickPreset>[1],
        "custom"
      >
    ) =>
      filterBookArchiveFacetIndex(
        index,
        applyBookArchiveQuickPreset(initial, preset),
        { savedBookKeys: new Set([pendingKey]) }
      ).documents.map(({ key }) => key);

    expect(resultFor("verified")).toEqual(
      expect.arrayContaining([firstKey, secondKey, thirdKey])
    );
    expect(resultFor("verified")).not.toContain(pendingKey);
    expect(resultFor("classic")).toEqual(
      expect.arrayContaining([firstKey, secondKey])
    );
    expect(resultFor("modern")).toEqual([thirdKey]);
    expect(resultFor("children")).toEqual([firstKey]);
    expect(resultFor("with-cover")).toEqual(
      expect.arrayContaining([firstKey, secondKey])
    );
    expect(resultFor("with-cover")).not.toContain(pendingKey);
    expect(resultFor("saved")).toEqual([pendingKey]);
  });
});

describe("book archive search and deterministic sort", () => {
  it("ranks exact title before exact writer, original and alternate title", () => {
    const exactTitle = fixtureItem({
      id: "title",
      title: "Искомое",
      writerName: "Другой Автор",
    });
    const exactWriter = fixtureItem({
      id: "writer",
      title: "Вторая книга",
      writerName: "Искомое",
    });
    const exactOriginal = fixtureItem({
      id: "original",
      title: "Третья книга",
      work: { originalTitle: "Искомое" },
    });
    const exactAlternate = fixtureItem({
      id: "alternate",
      title: "Четвёртая книга",
      work: { alternateTitles: ["Искомое"] },
    });
    const index = buildBookArchiveFacetIndex({
      items: [exactAlternate, exactOriginal, exactWriter, exactTitle],
      locale: "ru",
    });
    const result = filterBookArchiveFacetIndex(
      index,
      normalizeBookArchiveFilterState({ query: "Искомое" })
    );

    expect(result.documents.map(({ key }) => key)).toEqual([
      exactTitle.key,
      exactWriter.key,
      exactOriginal.key,
      exactAlternate.key,
    ]);
    expect(result.bestMatchKey).toBe(exactTitle.key);
  });

  it("keeps user sort authoritative while returning the best search focus", () => {
    const laterTitle = fixtureItem({
      id: "exact",
      title: "Якорь",
      work: { firstPublished: 2001 },
    });
    const earlierAlphabetic = fixtureItem({
      id: "writer",
      title: "Альфа",
      writerName: "Якорь",
      work: { firstPublished: 1901 },
    });
    const index = buildBookArchiveFacetIndex({
      items: [laterTitle, earlierAlphabetic],
      locale: "ru",
    });
    const result = filterBookArchiveFacetIndex(
      index,
      normalizeBookArchiveFilterState({
        query: "Якорь",
        sort: "title",
      })
    );

    expect(result.documents.map(({ key }) => key)).toEqual([
      earlierAlphabetic.key,
      laterTitle.key,
    ]);
    expect(result.bestMatchKey).toBe(laterTitle.key);
  });

  it("keeps the established Cyrillic-to-Latin writer search behavior", () => {
    const dostoevsky = fixtureItem({
      id: "crime-and-punishment",
      title: "Преступление и наказание",
      writerName: "Фёдор Достоевский",
    });
    const index = buildBookArchiveFacetIndex({
      items: [dostoevsky],
      locale: "ru",
    });

    expect(
      filterBookArchiveFacetIndex(
        index,
        normalizeBookArchiveFilterState({ query: "Dostoevsky" })
      ).bestMatchKey
    ).toBe(dostoevsky.key);
  });
  it("uses verified review timestamps for recent and never fake popularity", () => {
    const olderReview = fixtureItem({
      id: "older-review",
      title: "Бета",
      work: { editorial: { status: "reviewed", reviewedAt: "2026-01-01" } },
    });
    const newerReview = fixtureItem({
      id: "newer-review",
      title: "Альфа",
      work: { editorial: { status: "reviewed", reviewedAt: "2026-08-01" } },
    });
    const index = buildBookArchiveFacetIndex({
      items: [olderReview, newerReview],
      locale: "ru",
    });
    const result = filterBookArchiveFacetIndex(
      index,
      normalizeBookArchiveFilterState({ sort: "recent" })
    );

    expect(result.documents.map(({ key }) => key)).toEqual([
      newerReview.key,
      olderReview.key,
    ]);
  });
});
