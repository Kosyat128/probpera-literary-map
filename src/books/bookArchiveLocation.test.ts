import { describe, expect, it } from "vitest";

import { normalizeBookArchiveFilterState } from "./bookArchiveFacets";
import {
  BOOK_ARCHIVE_NAVIGATION_CONTEXT_VERSION,
  BOOK_ARCHIVE_NAVIGATION_STORAGE_KEY,
  clearBookArchiveNavigationContext,
  createBookArchiveHistoryChange,
  parseBookArchiveLocation,
  parseBookArchiveNavigationContext,
  readBookArchiveNavigationContext,
  serializeBookArchiveLocation,
  serializeBookArchiveNavigationContext,
  writeBookArchiveNavigationContext,
  type BookArchiveNavigationContext,
  type BookArchiveSessionStorage,
} from "./bookArchiveLocation";

function navigationContext(): BookArchiveNavigationContext {
  const state = normalizeBookArchiveFilterState({
    quickPreset: "classic",
    authorKey: "russia:tolstoy",
    countryIds: ["russia"],
    genreIds: ["novel"],
    sort: "oldest",
  });
  return {
    version: BOOK_ARCHIVE_NAVIGATION_CONTEXT_VERSION,
    shelfId: "manual:classics",
    search: { query: "  Война и мир  ", scope: "global" },
    filters: {
      quickPreset: state.quickPreset,
      authorKey: state.authorKey,
      countryIds: state.countryIds,
      genreIds: state.genreIds,
      audienceIds: state.audienceIds,
      periods: state.periods,
      originalLanguageIds: state.originalLanguageIds,
      editorialStatuses: state.editorialStatuses,
      coverModes: state.coverModes,
      articleRelations: state.articleRelations,
      savedOnly: state.savedOnly,
      sort: state.sort,
    },
    viewMode: "shelf",
    focusedBookKey: "russia:tolstoy:war-and-peace",
    pageIndex: 2,
    scroll: { x: 12.4, y: 840.7 },
    selectedBookKey: "russia:tolstoy:war-and-peace",
  };
}

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  } satisfies BookArchiveSessionStorage;
}

describe("book archive URL contract", () => {
  it("parses normalized book and shelf keys", () => {
    expect(
      parseBookArchiveLocation(
        "?book=russia%3Atolstoy%3Awar-and-peace&archiveShelf=manual%3Aclassics"
      )
    ).toEqual({
      bookKey: "russia:tolstoy:war-and-peace",
      shelfId: "manual:classics",
    });
  });

  it("fails closed for malformed or duplicate controlled parameters", () => {
    expect(
      parseBookArchiveLocation(
        "?book=ru%3Aw%3Ab&book=ru%3Aw%3Ac&archiveShelf=%3Cscript%3E"
      )
    ).toEqual({ bookKey: null, shelfId: null });
    expect(parseBookArchiveLocation("?book=only:two")).toEqual({
      bookKey: null,
      shelfId: null,
    });
  });

  it("updates controlled values without losing other params, repeats, or hash", () => {
    const source = {
      pathname: "/archive/books",
      search: "?lang=ru&tag=classic&tag=novel&book=old%3Akey%3Aid",
      hash: "#books",
    };
    const target = serializeBookArchiveLocation(source, {
      bookKey: "russia:tolstoy:war-and-peace",
      shelfId: "manual:classics",
    });
    const parsed = new URL(target, "https://probpera.example");

    expect(parsed.searchParams.getAll("tag")).toEqual(["classic", "novel"]);
    expect(parsed.searchParams.get("lang")).toBe("ru");
    expect(parsed.searchParams.get("book")).toBe(
      "russia:tolstoy:war-and-peace"
    );
    expect(parsed.searchParams.get("archiveShelf")).toBe("manual:classics");
    expect(parsed.hash).toBe("#books");
    expect(
      serializeBookArchiveLocation(
        { pathname: parsed.pathname, search: parsed.search, hash: parsed.hash },
        { bookKey: null, shelfId: null }
      )
    ).toBe("/archive/books?lang=ru&tag=classic&tag=novel#books");
  });

  it("returns an explicit push/replace history instruction", () => {
    expect(
      createBookArchiveHistoryChange(
        { pathname: "/", search: "?section=archive", hash: "books" },
        { shelfId: "favorites" },
        "push"
      )
    ).toEqual({
      mode: "push",
      target: "/?section=archive&archiveShelf=favorites#books",
    });
  });
});

describe("book archive navigation session context", () => {
  it("round-trips a compact, versioned context and normalizes volatile values", () => {
    const serialized = serializeBookArchiveNavigationContext(navigationContext());
    expect(serialized).not.toBeNull();
    expect(serialized).toContain('"v":1');
    expect(serialized).toContain('"s":"manual:classics"');
    expect(serialized).not.toContain("quickPreset");
    expect(parseBookArchiveNavigationContext(serialized)).toEqual({
      ...navigationContext(),
      search: { query: "Война и мир", scope: "global" },
      scroll: { x: 12, y: 841 },
    });
  });

  it("restores safe defaults from the smallest valid payload", () => {
    const parsed = parseBookArchiveNavigationContext('{"v":1,"s":"all"}');
    expect(parsed).toMatchObject({
      version: 1,
      shelfId: "all",
      search: { query: "", scope: "library" },
      scroll: { x: 0, y: 0 },
      selectedBookKey: null,
    });
    expect(parsed?.filters).toEqual(
      expect.objectContaining({
        quickPreset: "all",
        authorKey: null,
        sort: "editorial-relevance",
      })
    );
  });

  it("fails closed on schema drift, extra fields, invalid filters, and bad keys", () => {
    const invalid = [
      '{"v":2,"s":"all"}',
      '{"v":1,"s":"all","unexpected":true}',
      '{"v":1,"s":"all","f":{"p":"unknown"}}',
      '{"v":1,"s":"all","f":{"g":["unknown-genre"]}}',
      '{"v":1,"s":"all","b":"only:two"}',
      '{"v":1,"s":"all","y":-1}',
      "not-json",
    ];
    invalid.forEach((value) => {
      expect(parseBookArchiveNavigationContext(value)).toBeNull();
    });
  });

  it("reads, writes, and clears through an injected session storage", () => {
    const storage = memoryStorage();
    expect(writeBookArchiveNavigationContext(storage, navigationContext())).toBe(
      true
    );
    expect(storage.getItem(BOOK_ARCHIVE_NAVIGATION_STORAGE_KEY)).not.toBeNull();
    expect(readBookArchiveNavigationContext(storage)?.shelfId).toBe(
      "manual:classics"
    );
    expect(clearBookArchiveNavigationContext(storage)).toBe(true);
    expect(readBookArchiveNavigationContext(storage)).toBeNull();
  });

  it("contains storage failures instead of leaking them into navigation", () => {
    const broken: BookArchiveSessionStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("quota");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(readBookArchiveNavigationContext(broken)).toBeNull();
    expect(writeBookArchiveNavigationContext(broken, navigationContext())).toBe(
      false
    );
    expect(clearBookArchiveNavigationContext(broken)).toBe(false);
  });
});
