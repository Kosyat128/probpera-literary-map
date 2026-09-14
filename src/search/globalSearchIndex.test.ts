import { describe, expect, it, vi } from "vitest";

import type { BookArchiveEntry } from "../data/bookArchive";
import type { ArticleCatalogEntry } from "../data/articles/catalog";
import { countries as canonicalCountries, type Country, type Writer } from "../data/countries";
import type { WorkLocale } from "../data/countries/types";
import * as literarySearch from "../utils/literarySearch";
import {
  BOOKS_GLOBAL_SEARCH_PROFILE,
  BOOKS_LIBRARY_SEARCH_PROFILE,
  HEADER_GLOBAL_SEARCH_PROFILE,
  createGlobalSearchIndex,
  createGlobalSearchIndexAsync,
  createLazyGlobalSearchArticleCatalogLoader,
  extendGlobalSearchIndex,
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
  it.each<WorkLocale>(["ru", "en"])("prepares %s asynchronously with the same gates, deduplication, identities and ranking", async language => {
    const country = makeCountry("async", 2);
    country.writers.push({ id: "ru-only", name: "Условный автор" });
    const book = makeVerifiedBook("async-book", country, "Visible Anchor");
    addSyntheticTitleEvidence(book, "en", "Synthetic Beacon");
    const article = makeArticle("async");
    const options = {
      countries: [country], books: [book, makeBook("draft", country), book],
      articles: [article, article], language, translate, countryName,
      extensions: [
        { kind: "genre" as const, id: "shared", label: "Old facet" },
        { kind: "genre" as const, id: "shared", label: "Current facet", aliases: ["Sea voyages"] },
        { kind: "genre" as const, id: "", label: "Ignored" },
      ],
    };
    const synchronous = createGlobalSearchIndex(options);
    const constructCountryName = vi.fn(countryName);
    const pending = createGlobalSearchIndexAsync({ ...options, countryName: constructCountryName });
    expect(constructCountryName).not.toHaveBeenCalled();
    const asynchronous = await pending;
    expect(asynchronous).toEqual(synchronous);
    expect(asynchronous.articleCount).toBe(language === "ru" ? 2 : 0);
    expect(asynchronous.documents.filter(document => document.result.kind === "book")).toHaveLength(1);
    for (const query of ["Archive", "Synthetic Beacon", "Sea voyages", "Pending Card", "Условный автор"]) {
      expect(searchGlobalSearchIndex(asynchronous, query, BOOKS_GLOBAL_SEARCH_PROFILE)).toEqual(
        searchGlobalSearchIndex(synchronous, query, BOOKS_GLOBAL_SEARCH_PROFILE)
      );
    }
    const result = asynchronous.documents.find(document => document.result.kind === "book")!.result;
    expect(result.kind === "book" && result.book).toBe(book);
  });

  it("can cancel preparation before consuming canonical documents", async () => {
    const controller = new AbortController();
    const constructCountryName = vi.fn(countryName);
    const pending = createGlobalSearchIndexAsync({
      countries: [makeCountry("aborted", 1)], books: [], language: "ru",
      translate, countryName: constructCountryName,
    }, controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(constructCountryName).not.toHaveBeenCalled();
  });

  it("yields and cancels while visiting a large rejected book queue", async () => {
    const country = makeCountry("rejected-queue", 1);
    let visited = 0;
    const books = Array.from({ length: 240 }, (_, index) => {
      const book = makeBook(`draft-${index}`, country);
      Object.defineProperty(book, "editorial", { get: () => {
        visited += 1;
        return { status: "draft" };
      } });
      return book;
    });
    const controller = new AbortController();
    const pending = createGlobalSearchIndexAsync({
      countries: [], books, language: "ru", translate, countryName,
    }, controller.signal);
    expect(visited).toBe(0);
    const cancel = setTimeout(() => controller.abort(), 0);
    try {
      await expect(pending).rejects.toMatchObject({ name: "AbortError" });
      expect(visited).toBeGreaterThan(0);
      expect(visited).toBeLessThan(books.length);
    } finally {
      clearTimeout(cancel);
    }
  });

  it.each<[WorkLocale, string[]]>([
    ["ru", ["Якорь", "Zebra"]],
    ["en", ["Zebra", "Якорь"]],
  ])("collates equally ranked labels using %s while keeping English identity tie breaks", (language, labels) => {
    const countries: Country[] = [
      { id: "latin", name: "Zebra", description: "shared", writers: [] },
      { id: "cyrillic", name: "Якорь", description: "shared", writers: [] },
    ];
    const index = makeIndex({ countries, language });
    expect(searchGlobalSearchIndex(index, "shared").groups.countries.map(result => result.label)).toEqual(labels);
    expect(searchGlobalSearchIndex(index, "shared").suggestions.map(result => result.label)).toEqual(labels);

    const tied = makeIndex({ countries: [
      { id: "я", name: "Shared", writers: [] },
      { id: "z", name: "Shared", writers: [] },
    ], language });
    expect(searchGlobalSearchIndex(tied, "shared").groups.countries.map(result => result.key)).toEqual(["country:z", "country:я"]);
  });

  it("reuses compiled base documents through extension and preprocesses each query only once", () => {
    const country = makeCountry("compiled", 1);
    const base = makeIndex({ countries: [country], books: [makeVerifiedBook("compiled", country)] });
    const baseDocuments = [...base.documents];
    const compileFields = vi.spyOn(literarySearch, "compileLiterarySearchFields");
    const compileQuery = vi.spyOn(literarySearch, "compileLiterarySearchQuery");
    try {
      const extended = extendGlobalSearchIndex(base, [{
        kind: "genre", id: "navigation", label: "Морские путешествия",
        aliases: ["Sea voyages"], keywords: ["Navigation"],
      }]);
      expect(compileFields).toHaveBeenCalled();
      for (const document of baseDocuments) {
        const retained = extended.documents.find(item => item.result.key === document.result.key);
        expect(retained).toBe(document);
        expect(retained!.compiled).toBe(document.compiled);
      }
      expect(base.documents).toEqual(baseDocuments);
      expect(extendGlobalSearchIndex(base, [])).toBe(base);
      compileFields.mockClear();
      compileQuery.mockClear();

      const first = searchGlobalSearchIndex(extended, "Sea voyages", BOOKS_GLOBAL_SEARCH_PROFILE);
      const second = searchGlobalSearchIndex(extended, "Navigation", BOOKS_GLOBAL_SEARCH_PROFILE);
      expect(first.groups.genres.map(item => item.genreId)).toEqual(["navigation"]);
      expect(second.groups.genres.map(item => item.genreId)).toEqual(["navigation"]);
      expect(compileFields).not.toHaveBeenCalled();
      expect(compileQuery).toHaveBeenCalledTimes(2);
      expect(searchGlobalSearchIndex(base, "Navigation", BOOKS_GLOBAL_SEARCH_PROFILE).groups.genres).toEqual([]);
    } finally {
      compileFields.mockRestore();
      compileQuery.mockRestore();
    }
  });

  it.each<WorkLocale>(["ru", "en"])("indexes the existing opposite-locale writer name in %s with unchanged canonical actions", locale => {
    const sourceCountry = canonicalCountries.find(country => country.id === "russia")!;
    const sourceWriter = sourceCountry.writers.find(writer => writer.id === "dostoevsky")!;
    const country = { ...sourceCountry, writers: [sourceWriter] };
    const index = makeIndex({ countries: [country], language: locale });
    for (const query of ["Fyodor Dostoevsky", "Фёдор Михайлович Достоевский"]) {
      const result = searchGlobalSearchIndex(index, query);
      expect(result.groups.writers).toHaveLength(1);
      const found = result.groups.writers[0];
      expect(found.writer).toBe(sourceWriter);
      expect(found.label).toBe(locale === "ru" ? "Фёдор Михайлович Достоевский" : "Fyodor Dostoevsky");
      expect(found.key).toBe("writer:russia:dostoevsky");
      expect(found.activateAction).toEqual({
        type: "select-writer", authorKey: "russia:dostoevsky", countryId: "russia", writerId: "dostoevsky",
      });
      expect(result.suggestions.some(item => item.key === found.key)).toBe(true);
    }
    const withoutWriter = makeIndex({ countries: [{ ...country, writers: [] }], language: locale });
    expect(searchGlobalSearchIndex(withoutWriter, "Fyodor Dostoevsky").groups.writers).toEqual([]);
  });

  it("preserves per-field stopwords, distributed words, and transliteration", () => {
    const countries: Country[] = [{
      id: "russia", name: "Россия", writers: [{
        id: "dostoevsky", name: "Фёдор Достоевский", fullName: "Фёдор Михайлович Достоевский",
      }],
    }, { id: "india", name: "India", code: "IN", writers: [] }];
    const index = makeIndex({ countries });
    expect(searchGlobalSearchIndex(index, "Dostoevsky Россия").groups.writers.map(item => item.writer.id)).toEqual(["dostoevsky"]);
    expect(searchGlobalSearchIndex(index, "in").groups.countries.map(item => item.country.id)).toEqual(["india"]);
    expect(searchGlobalSearchIndex(index, "inside").totalMatches).toBe(0);
    expect(searchGlobalSearchIndex(index, "Dostoevsky India").totalMatches).toBe(0);
  });

  it("retains visible title, author, original, alternate and metadata suggestion priorities", () => {
    const country = makeCountry("priorities", 1);
    const exact = makeVerifiedBook("exact", country, "Beacon");
    const prefix = makeVerifiedBook("prefix", country, "Beacon Letters");
    const authorCountry = makeCountry("author", 1);
    authorCountry.writers[0].name = "Beacon";
    authorCountry.writers[0].fullName = "Beacon";
    const author = makeVerifiedBook("author", authorCountry, "Collected Stories");
    const original = { ...makeVerifiedBook("original", country, "Original Anchor"), originalTitle: "Beacon" };
    const alternate = { ...makeVerifiedBook("alternate", country, "Alternate Anchor"), alternateTitles: ["Beacon"] };
    const metadata = { ...makeVerifiedBook("metadata", country, "Metadata Anchor"), genres: ["Beacon"] };
    const index = makeIndex({ books: [metadata, alternate, original, author, prefix, exact], language: "en" });
    expect(searchGlobalSearchIndex(index, "Beacon").suggestions.map(item => item.kind === "book" ? item.book.id : item.key)).toEqual([
      "exact", "prefix", "author", "original", "alternate", "metadata",
    ]);
  });

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

  it.each<WorkLocale>(["ru", "en"])("uses current canonical author names in %s book search without changing its title or actions", locale => {
    const country = makeCountry("author-fields", 1);
    country.writers[0].name = "Условный Михайлович";
    country.writers[0].fullName = "Synthetic Current Author";
    const book = makeVerifiedBook("author-work", country, "Visible Localized Anchor");
    book.writer = { ...book.writer, name: "Отображаемая подпись", fullName: "Synthetic Visible Byline" };
    book.writerName = "Synthetic Visible Byline";
    // Synthetic evidence exercises the real gate; no catalog facts are changed.
    addSyntheticTitleEvidence(book, locale, "Visible Localized Anchor");
    const index = makeIndex({ countries: [country], books: [book], language: locale });
    for (const query of ["Михайлович", "Mikhailovich"]) {
      const result = searchGlobalSearchIndex(index, query, BOOKS_GLOBAL_SEARCH_PROFILE);
      expect(result.groups.books).toHaveLength(1);
      const found = result.groups.books[0];
      expect(found.book).toBe(book);
      expect(found.label).toBe("Visible Localized Anchor");
      expect(found.bookKey).toBe("author-fields:writer-author-fields-0:author-work");
      expect(found.activateAction).toEqual({ type: "open-book", bookKey: found.bookKey });
      expect(result.suggestions.some(item => item.key === found.key)).toBe(true);
    }
    const withdrawn = { ...country, writers: [] };
    expect(searchGlobalSearchIndex(makeIndex({ countries: [withdrawn], books: [book], language: locale }), "Mikhailovich").groups.books).toEqual([]);
    delete book.localizedTitles?.[locale];
    expect(searchGlobalSearchIndex(makeIndex({ countries: [country], books: [book], language: locale }), "Mikhailovich").groups.books).toEqual([]);
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
