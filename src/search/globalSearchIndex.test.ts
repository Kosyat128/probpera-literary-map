import { describe, expect, it, vi } from "vitest";

import type { BookArchiveEntry } from "../data/bookArchive";
import type { ArticleCatalogEntry } from "../data/articles/catalog";
import type { Country, Writer } from "../data/countries";
import type { WorkLocale } from "../data/countries/types";
import {
  BOOKS_GLOBAL_SEARCH_PROFILE,
  BOOKS_LIBRARY_SEARCH_PROFILE,
  HEADER_GLOBAL_SEARCH_PROFILE,
  createGlobalSearchIndex,
  createLazyGlobalSearchArticleCatalogLoader,
  searchGlobalSearchIndex,
} from "./globalSearchIndex";

const translate = (value: string) => value;
const countryName = (_code: string | undefined, name: string) => name;

function makeWriter(id: string, label: string): Writer {
  return {
    id,
    name: label,
    fullName: label,
    genres: ["Archive genre"],
  };
}

function makeCountry(
  id: string,
  writerCount = 0
): Country {
  return {
    id,
    code: id.slice(0, 2).toUpperCase(),
    name: "Archive Country " + id,
    writers: Array.from(
      { length: writerCount },
      (_, index) =>
        makeWriter(
          "writer-" + id + "-" + index,
          "Archive Writer " + id + " " + index
        )
    ),
  };
}

function makeArticle(id: string): ArticleCatalogEntry {
  return {
    id,
    url: "https://example.org/articles/" + id,
    title: "Archive Article " + id,
    description: "Archive article description",
    sectionId: "literary-essays",
    sectionLabel: "Archive section",
    publishedLabel: "2026",
    readingMinutes: 4,
    wordCount: 600,
    headingCount: 3,
  };
}

function makeBook(
  id: string,
  country: Country,
  title = "Archive Book " + id
): BookArchiveEntry {
  const writer = country.writers[0];
  if (!writer) throw new Error("Book fixture requires a writer");
  return {
    id,
    title,
    countryId: country.id,
    countryName: country.name,
    writerId: writer.id,
    writerName: writer.name || "Archive Writer",
    writer,
    country,
    editorial: { status: "draft" },
  };
}

function makeVerifiedBook(
  id: string,
  country: Country,
  title = "Spectral Archive"
): BookArchiveEntry {
  const writer = country.writers[0];
  if (!writer) throw new Error("Book fixture requires a writer");
  const sourceUrl = "https://example.org/books/" + id;
  const ruDescription =
    "Редакционная аннотация описывает спектральную поэтику произведения, его композицию и место в литературной традиции без пересказа ключевых поворотов. Второе предложение фиксирует проверенный контекст и помогает читателю понять художественный метод автора.";
  const enDescription =
    "This editorial annotation describes the spectral poetics, structure, and literary context of the work without disclosing decisive plot turns. A second sentence records verified context and helps the reader understand the author's artistic method.";

  return {
    id,
    title,
    originalTitle: title,
    originalLanguage: "русский",
    genres: ["spectralism"],
    description: ruDescription,
    countryId: country.id,
    countryName: country.name,
    writerId: writer.id,
    writerName: writer.name || "Archive Writer",
    writer,
    country,
    editorial: {
      status: "verified",
      reviewedAt: "2026-08-26",
    },
    translations: {
      ru: {
        locale: "ru",
        title,
        description: ruDescription,
        sourceLanguage: "ru",
        status: "verified",
        sourceUrls: [sourceUrl],
        method: "editorial-original",
        reviewedAt: "2026-08-26",
      },
      en: {
        locale: "en",
        title,
        description: enDescription,
        sourceLanguage: "en",
        status: "verified",
        sourceUrls: [sourceUrl],
        method: "editorial-original",
        reviewedAt: "2026-08-26",
      },
    },
    sources: [
      {
        provider: "Example Library",
        url: sourceUrl,
        fields: [
          "identity",
          "title",
          "description",
          "genre",
        ],
        usage: "reference-only",
        retrievedAt: "2026-08-26",
      },
    ],
  };
}

function makeIndex(options: {
  countries?: Country[];
  books?: BookArchiveEntry[];
  articles?: ArticleCatalogEntry[];
  extensions?: Parameters<
    typeof createGlobalSearchIndex
  >[0]["extensions"];
  language?: "ru" | "en";
} = {}) {
  return createGlobalSearchIndex({
    countries: options.countries || [],
    books: options.books || [],
    articles: options.articles || [],
    extensions: options.extensions || [],
    language: options.language || "ru",
    translate,
    countryName,
  });
}

// Synthetic title records validate the real registry-backed alias path without
// asserting that these test titles or URLs identify published books.
function addSyntheticTitleEvidence(book: BookArchiveEntry, locale: WorkLocale, title: string) {
  const ru = locale === "ru";
  const market = ru ? "RU" : "US";
  const language = ru ? "Russian" : "English";
  const authorityIds = ru ? ["rsl", "eksmo"] : ["loc", "penguin-random-house"];
  const domains = ru ? ["search.rsl.ru", "eksmo.ru"] : ["catalog.loc.gov", "penguinrandomhouse.com"];
  const evidence = domains.map((domain, index) => ({
    entityKind: "manifestation" as const,
    manifestationId: `synthetic:${locale}:${index}`,
    sourceUrl: `https://${domain}/codex-synthetic-test/search-${locale}`,
    provider: "Synthetic test provider", authorityId: authorityIds[index],
    authorityTier: index === 0 ? "A" as const : "B" as const,
    recordKind: index === 0 ? "national-bibliography" as const : "publisher-catalog" as const,
    recordId: `synthetic:${locale}:${index}`, catalogTitleExact: title,
    locale, market, expressionLanguage: language,
    retrievedAt: "2026-09-08", checkedAt: "2026-09-08",
    checkedBy: "Synthetic test reviewer; not an editorial approval",
  }));
  book.translations![locale] = {
    ...book.translations![locale]!, title, sourceLanguage: language,
    sourceUrls: evidence.map(record => record.sourceUrl),
  };
  book.localizedTitles = {
    ...book.localizedTitles,
    [locale]: {
      entityKind: "expression", expressionId: `synthetic:${locale}`, locale,
      value: title, status: "verified-published", expressionLanguage: language,
      market, selectionRule: "earliest-authorized-edition", evidence,
    },
  };
  book.sources!.push(...evidence.map(record => ({
    provider: record.provider, url: record.sourceUrl, authorityId: record.authorityId,
    recordId: record.recordId, recordKind: record.recordKind,
      language, market, fields: ["title" as const, "description" as const],
    usage: "reference-only" as const, retrievedAt: "2026-09-08",
  })));
}

describe("shared global search index", () => {
  it.each<[WorkLocale, WorkLocale, string]>([
    ["ru", "en", "Synthetic Beacon"],
    ["en", "ru", "Условный маяк"],
  ])("finds an evidenced %s book by its %s title with the same identity", (locale, oppositeLocale, query) => {
    const country = makeCountry("bilingual", 1);
    const book = makeVerifiedBook("bilingual-work", country, "Visible Localized Anchor");
    addSyntheticTitleEvidence(book, oppositeLocale, query);
    const index = makeIndex({ countries: [country], books: [book], language: locale });
    const result = searchGlobalSearchIndex(index, query);
    expect(result.groups.books).toHaveLength(1);
    const found = result.groups.books[0];
    expect(found.book).toBe(book);
    expect(found.label).toBe("Visible Localized Anchor");
    expect(found.bookKey).toBe("bilingual:writer-bilingual-0:bilingual-work");
    expect(found.activateAction).toEqual({ type: "open-book", bookKey: found.bookKey });
    expect(found.focusAction).toEqual({ type: "focus-book", bookKey: found.bookKey });
  });

  it("ranks the visible exact title before an opposite-locale alias and drops a stale alias on rebuild", () => {
    const country = makeCountry("rank", 1);
    const aliasBook = makeVerifiedBook("alias", country, "Visible Anchor");
    addSyntheticTitleEvidence(aliasBook, "en", "Synthetic Beacon");
    const exactBook = makeVerifiedBook("exact", country, "Synthetic Beacon");
    const books = [aliasBook, exactBook];
    const result = searchGlobalSearchIndex(makeIndex({ books }), "Synthetic Beacon");
    expect(result.groups.books.map(item => item.book.id)).toEqual(["exact", "alias"]);
    expect(result.suggestions.map(item => item.key)).toEqual([
      "book:rank:writer-rank-0:exact", "book:rank:writer-rank-0:alias",
    ]);
    aliasBook.translations!.en!.title = "Unreviewed Mutation";
    expect(searchGlobalSearchIndex(makeIndex({ books }), "Synthetic Beacon").groups.books.map(item => item.book.id)).toEqual(["exact"]);
    expect(searchGlobalSearchIndex(makeIndex({ books }), "Unreviewed Mutation").groups.books).toEqual([]);
  });

  it("does not infer an opposite title alias from publication status alone", () => {
    const country = makeCountry("no-title-evidence", 1);
    const book = makeVerifiedBook("not-an-alias", country, "Visible Anchor");
    book.translations!.en!.title = "Unsubstantiated Opposite Title";
    expect(searchGlobalSearchIndex(makeIndex({ books: [book] }), "Unsubstantiated Opposite Title").groups.books).toEqual([]);
  });

  it("preserves Header groups, limits, and deterministic ordering", () => {
    const countries = Array.from(
      { length: 6 },
      (_, index) =>
        makeCountry("country-" + index, 2)
    );
    const books = Array.from(
      { length: 7 },
      (_, index) =>
        makeVerifiedBook(
          "book-" + index,
          countries[0]
        )
    );
    const articles = Array.from(
      { length: 8 },
      (_, index) => makeArticle("article-" + index)
    );

    const first = searchGlobalSearchIndex(
      makeIndex({ countries, books, articles }),
      "archive",
      HEADER_GLOBAL_SEARCH_PROFILE
    );
    const reversed = searchGlobalSearchIndex(
      makeIndex({
        countries: [...countries].reverse(),
        books: [...books].reverse(),
        articles: [...articles].reverse(),
      }),
      "archive",
      HEADER_GLOBAL_SEARCH_PROFILE
    );

    expect(first.groups.countries).toHaveLength(5);
    expect(first.groups.writers).toHaveLength(7);
    expect(first.groups.books).toHaveLength(6);
    expect(first.groups.articles).toHaveLength(7);
    expect(first.groups.genres).toEqual([]);
    expect({
      countries: first.groups.countries.map(({ key }) => key),
      writers: first.groups.writers.map(({ key }) => key),
      books: first.groups.books.map(({ key }) => key),
      articles: first.groups.articles.map(({ key }) => key),
    }).toEqual({
      countries: reversed.groups.countries.map(({ key }) => key),
      writers: reversed.groups.writers.map(({ key }) => key),
      books: reversed.groups.books.map(({ key }) => key),
      articles: reversed.groups.articles.map(({ key }) => key),
    });
  });

  it("keeps Complete Shelf suggestions bounded while retaining full matches", () => {
    const country = makeCountry("shelf", 14);
    const books = Array.from(
      { length: 14 },
      (_, index) => makeVerifiedBook("shelf-" + index, country)
    );
    const articles = Array.from(
      { length: 5 },
      (_, index) => makeArticle("shelf-" + index)
    );
    const index = makeIndex({
      countries: [country],
      books,
      articles,
      extensions: [
        {
          kind: "genre",
          id: "archive-genre",
          label: "Archive Genre",
        },
      ],
    });

    const result = searchGlobalSearchIndex(
      index,
      "archive",
      BOOKS_GLOBAL_SEARCH_PROFILE
    );

    expect(result.suggestions).toHaveLength(10);
    expect(result.allMatches.length).toBeGreaterThan(10);
    expect(result.totalMatches).toBe(result.allMatches.length);
  });

  it("returns controller-safe identities and separates book focus from open", () => {
    const country = makeCountry("exact-country", 1);
    const book = makeVerifiedBook(
      "exact-book",
      country,
      "Exact Beacon"
    );
    const pushState = vi.fn();
    vi.stubGlobal("window", {
      history: { pushState },
    });

    const index = makeIndex({
      countries: [country],
      books: [book],
      extensions: [
        {
          kind: "genre",
          id: "controlled-genre",
          label: "Controlled Genre",
        },
      ],
    });
    const bookResult = searchGlobalSearchIndex(
      index,
      "Exact Beacon",
      BOOKS_GLOBAL_SEARCH_PROFILE
    ).suggestions[0];
    const writerResult = searchGlobalSearchIndex(
      index,
      country.writers[0].name || "",
      BOOKS_GLOBAL_SEARCH_PROFILE
    ).allMatches.find(({ kind }) => kind === "writer");
    const countryResult = searchGlobalSearchIndex(
      index,
      country.name,
      BOOKS_GLOBAL_SEARCH_PROFILE
    ).allMatches.find(({ kind }) => kind === "country");
    const genreResult = searchGlobalSearchIndex(
      index,
      "Controlled Genre",
      BOOKS_GLOBAL_SEARCH_PROFILE
    ).allMatches.find(({ kind }) => kind === "genre");

    expect(bookResult).toMatchObject({
      kind: "book",
      bookKey: "exact-country:writer-exact-country-0:exact-book",
      focusAction: {
        type: "focus-book",
        bookKey: "exact-country:writer-exact-country-0:exact-book",
      },
      activateAction: {
        type: "open-book",
        bookKey: "exact-country:writer-exact-country-0:exact-book",
      },
    });
    expect(writerResult?.activateAction).toEqual({
      type: "select-writer",
      authorKey: "exact-country:writer-exact-country-0",
      countryId: "exact-country",
      writerId: "writer-exact-country-0",
    });
    expect(countryResult?.activateAction).toEqual({
      type: "select-country",
      countryId: "exact-country",
    });
    expect(genreResult?.activateAction).toEqual({
      type: "apply-facet",
      facet: "genre",
      ids: ["controlled-genre"],
    });
    expect(pushState).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
  it("keeps library-only controlled entities outside Header results", () => {
    expect(HEADER_GLOBAL_SEARCH_PROFILE).toEqual({
      minQueryLength: 2,
      groups: ["countries", "writers", "books", "articles"],
      groupLimits: {
        countries: 5,
        writers: 7,
        books: 6,
        articles: 7,
      },
      suggestionLimit: 25,
    });
    const result = searchGlobalSearchIndex(
      makeIndex({
        extensions: [
          {
            kind: "period",
            id: "archive-period",
            label: "Archive Period",
          },
          {
            kind: "editorial-shelf",
            id: "archive-editorial",
            label: "Archive Editorial Shelf",
          },
          {
            kind: "personal-shelf",
            id: "archive-personal",
            label: "Archive Personal Shelf",
          },
        ],
      }),
      "archive",
      HEADER_GLOBAL_SEARCH_PROFILE
    );

    expect(result.suggestions).toEqual([]);
    expect(result.groups.periods).toEqual([]);
    expect(result.groups.editorialShelves).toEqual([]);
    expect(result.groups.personalShelves).toEqual([]);
  });

  it("offers writers, countries, and controlled shelf entities in the library profile", () => {
    expect(BOOKS_LIBRARY_SEARCH_PROFILE.groups).toEqual([
      "books",
      "writers",
      "countries",
      "genres",
      "audiences",
      "periods",
      "editorialShelves",
      "personalShelves",
    ]);
    const sourceCountry = makeCountry("library", 1);
    const country: Country = {
      ...sourceCountry,
      name: "Silver Library Country",
      writers: sourceCountry.writers.map((writer) => ({
        ...writer,
        name: "Silver Library Writer",
        fullName: "Silver Library Writer",
      })),
    };
    const extensions = [
      {
        kind: "period" as const,
        id: "silver-age",
        label: "Silver Library Period",
      },
      {
        kind: "editorial-shelf" as const,
        id: "silver-editorial",
        label: "Silver Library Editorial Shelf",
      },
      ...Array.from({ length: 11 }, (_, index) => ({
        kind: "personal-shelf" as const,
        id: "silver-personal-" + index,
        label: "Silver Library Personal Shelf " + index,
      })),
    ];
    const result = searchGlobalSearchIndex(
      makeIndex({
        countries: [country],
        books: [
          makeVerifiedBook(
            "silver-library-book",
            country,
            "Silver Library Book"
          ),
        ],
        extensions,
      }),
      "silver library",
      BOOKS_LIBRARY_SEARCH_PROFILE
    );
    const libraryGroups = new Set<string>(
      BOOKS_LIBRARY_SEARCH_PROFILE.groups
    );

    expect(result.groups.periods[0]).toMatchObject({
      kind: "period",
      periodId: "silver-age",
      activateAction: {
        type: "apply-facet",
        facet: "period",
        ids: ["silver-age"],
      },
    });
    expect(result.groups.editorialShelves[0]).toMatchObject({
      kind: "editorial-shelf",
      collectionId: "silver-editorial",
    });
    expect(result.groups.personalShelves).toHaveLength(10);
    expect(result.suggestions).toHaveLength(10);
    expect(result.allMatches.length).toBeGreaterThan(10);
    expect(
      result.allMatches.every(({ group }) =>
        libraryGroups.has(group)
      )
    ).toBe(true);
    expect(result.groups.countries).toHaveLength(1);
    expect(result.groups.writers).toHaveLength(1);
    expect(result.groups.articles).toEqual([]);
  });
});

describe("publication and loading gates", () => {
  it("never indexes pending books or their draft metadata as public search text", () => {
    const country = makeCountry("quality", 1);
    const pending = {
      ...makeBook("pending", country, "Pending Card"),
      description: "spectralism private draft metadata",
      genres: ["spectralism"],
    };
    const verified = makeVerifiedBook("verified", country);
    const result = searchGlobalSearchIndex(
      makeIndex({
        countries: [country],
        books: [pending, verified],
      }),
      "spectralism",
      HEADER_GLOBAL_SEARCH_PROFILE
    );

    expect(
      result.groups.books.map(({ book }) => book.id)
    ).toEqual(["verified"]);

    const titleResult = searchGlobalSearchIndex(
      makeIndex({
        countries: [country],
        books: [pending, verified],
      }),
      "Pending Card",
      HEADER_GLOBAL_SEARCH_PROFILE
    );
    expect(titleResult.groups.books).toEqual([]);
  });

  it("keeps English writer and article release gates unchanged", () => {
    const country: Country = {
      id: "ru-only",
      name: "Россия",
      code: "RU",
      writers: [
        {
          id: "ru-only-writer",
          name: "Автор без английского имени",
        },
      ],
    };
    const index = makeIndex({
      countries: [country],
      articles: [makeArticle("ru-only")],
      language: "en",
    });
    const result = searchGlobalSearchIndex(
      index,
      "Автор",
      HEADER_GLOBAL_SEARCH_PROFILE
    );

    expect(index.articleCount).toBe(0);
    expect(result.groups.writers).toEqual([]);
    expect(result.groups.articles).toEqual([]);
  });

  it("does not search until the profile minimum query length is met", () => {
    const country = makeCountry("minimum", 1);
    const result = searchGlobalSearchIndex(
      makeIndex({ countries: [country] }),
      "a",
      HEADER_GLOBAL_SEARCH_PROFILE
    );

    expect(result.totalMatches).toBe(0);
    expect(result.suggestions).toEqual([]);
  });

  it("shares one lazy article request and retries after a rejection", async () => {
    const catalog = [makeArticle("singleton")];
    const successfulImporter = vi.fn(
      async () => ({ articleCatalog: catalog })
    );
    const loadSuccessful =
      createLazyGlobalSearchArticleCatalogLoader(
        successfulImporter
      );

    const first = loadSuccessful();
    const second = loadSuccessful();
    expect(first).toBe(second);
    await expect(first).resolves.toBe(catalog);
    expect(successfulImporter).toHaveBeenCalledTimes(1);

    const retryImporter = vi
      .fn()
      .mockRejectedValueOnce(new Error("temporary"))
      .mockResolvedValue({ articleCatalog: catalog });
    const loadWithRetry =
      createLazyGlobalSearchArticleCatalogLoader(
        retryImporter
      );

    await expect(loadWithRetry()).rejects.toThrow("temporary");
    await expect(loadWithRetry()).resolves.toBe(catalog);
    expect(retryImporter).toHaveBeenCalledTimes(2);
  });
});
