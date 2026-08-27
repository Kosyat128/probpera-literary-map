import { describe, expect, it } from "vitest";

import {
  BOOK_COLLECTION_SCHEMA_VERSION,
  SYSTEM_BOOK_COLLECTION_IDS,
  createEmptyBookCollectionSnapshot,
  deriveSystemBookCollections,
  mergeBookCollectionSnapshots,
  parseBookCollection,
  parseBookCollectionItem,
  parseBookCollectionSnapshot,
  parseBookFavoriteMembership,
  type BookCollection,
  type BookCollectionItem,
  type BookCollectionSnapshot,
  type BookFavoriteMembership,
} from "./bookCollections";

const firstTimestamp = "2026-08-20T10:00:00.000Z";
const secondTimestamp = "2026-08-21T10:00:00.000Z";
const thirdTimestamp = "2026-08-22T10:00:00.000Z";

function collection(
  overrides: Partial<BookCollection> = {}
): BookCollection {
  return {
    id: "collection:manual-one",
    ownerId: "reader-1",
    kind: "manual",
    title: "Русская классика",
    description: "Личная подборка произведений",
    visibility: "private",
    backgroundPreset: "midnight-archive",
    dynamicBookThemes: true,
    themeIntensity: 72,
    sortMode: "manual",
    schemaVersion: BOOK_COLLECTION_SCHEMA_VERSION,
    createdAt: firstTimestamp,
    updatedAt: firstTimestamp,
    ...overrides,
  };
}

function item(
  collectionId: string,
  bookKey: string,
  position: number,
  overrides: Partial<BookCollectionItem> = {}
): BookCollectionItem {
  return {
    collectionId,
    bookKey,
    position,
    addedAt: firstTimestamp,
    updatedAt: firstTimestamp,
    ...overrides,
  };
}

function favorite(
  bookKey: string,
  overrides: Partial<BookFavoriteMembership> = {}
): BookFavoriteMembership {
  return {
    bookKey,
    addedAt: firstTimestamp,
    updatedAt: firstTimestamp,
    ...overrides,
  };
}

function snapshot(
  collections: readonly BookCollection[],
  items: readonly BookCollectionItem[] = [],
  favorites: readonly BookFavoriteMembership[] = []
): BookCollectionSnapshot {
  return {
    schemaVersion: BOOK_COLLECTION_SCHEMA_VERSION,
    collections,
    items,
    favorites,
  };
}

describe("book collection contracts", () => {
  it("accepts only the versioned model and normalizes validated smart filters", () => {
    const parsed = parseBookCollection({
      ...collection({
        id: "collection:smart-one",
        kind: "smart",
        sortMode: "title",
      }),
      filterState: {
        query: "  Достоевский  ",
        countryIds: ["russia"],
        genreIds: ["novel"],
        savedOnly: false,
        sort: "title",
      },
    });

    expect(parsed).toMatchObject({
      id: "collection:smart-one",
      kind: "smart",
      schemaVersion: 1,
      filterState: {
        query: "Достоевский",
        countryIds: ["russia"],
        genreIds: ["novel"],
        sort: "title",
      },
    });
    expect(parsed?.filterState?.quickPreset).toBe("all");
  });

  it("accepts only bundled icon ids while keeping legacy v1 collections valid", () => {
    const legacy = parseBookCollection(collection());
    const branded = parseBookCollection(collection({ icon: "quill" }));

    expect(legacy).not.toBeNull();
    expect(legacy).not.toHaveProperty("icon");
    expect(branded?.icon).toBe("quill");
    expect(parseBookCollection({ ...collection(), icon: "https://example.test/icon.svg" }))
      .toBeNull();
    expect(parseBookCollection({ ...collection(), icon: "<svg />" })).toBeNull();
    expect(parseBookCollection({ ...collection(), icon: "custom" })).toBeNull();
  });

  it("fails closed for malformed ids, enums, themes, filters and duplicated metadata", () => {
    expect(parseBookCollection({ ...collection(), id: "../../escape" })).toBeNull();
    expect(parseBookCollection({ ...collection(), kind: "shared" })).toBeNull();
    expect(
      parseBookCollection({ ...collection(), backgroundPreset: "custom-css" })
    ).toBeNull();
    expect(parseBookCollection({ ...collection(), themeIntensity: 101 })).toBeNull();
    expect(parseBookCollection({ ...collection(), sortMode: "SQL(title)" })).toBeNull();
    expect(
      parseBookCollection({
        ...collection({ id: "collection:smart", kind: "smart" }),
      })
    ).toBeNull();
    expect(
      parseBookCollection({
        ...collection({ id: "collection:smart", kind: "smart" }),
        filterState: { sort: "title", expression: "book => true" },
      })
    ).toBeNull();
    expect(
      parseBookCollectionItem({
        ...item("collection:manual-one", "russia:writer:work", 0),
        title: "A copied title must not be stored here",
      })
    ).toBeNull();
    expect(
      parseBookCollection({
        ...collection(),
        schemaVersion: 2,
      })
    ).toBeNull();
  });

  it("rejects XSS payloads and invisible control characters", () => {
    expect(
      parseBookCollection({ ...collection(), title: "<script>alert(1)</script>" })
    ).toBeNull();
    expect(
      parseBookCollection({ ...collection(), description: "javascript:alert(1)" })
    ).toBeNull();
    expect(
      parseBookCollection({ ...collection(), title: "Безопасно\u202Egpj.exe" })
    ).toBeNull();
    expect(
      parseBookCollectionItem(
        item("collection:manual-one", "russia:writer:\u0000work", 0)
      )
    ).toBeNull();
    expect(
      parseBookFavoriteMembership({
        ...favorite("russia:writer:work"),
        bookKey: "data:text/html,<script>",
      })
    ).toBeNull();
  });
});

describe("derived system shelves", () => {
  it("derives four shelves, permits multiple memberships and keeps favorites separate", () => {
    const derived = deriveSystemBookCollections(
      [
        {
          id: "russia:tolstoy:war-and-peace",
          kind: "book",
          status: "saved",
          addedAt: firstTimestamp,
        },
        {
          id: "england:austen:pride-and-prejudice",
          kind: "book",
          status: "reading",
          addedAt: secondTimestamp,
          updatedAt: thirdTimestamp,
        },
        {
          id: "article-1",
          kind: "article",
          status: "finished",
          addedAt: thirdTimestamp,
        },
      ],
      { ownerId: "reader-1", fallbackTimestamp: firstTimestamp }
    );

    expect(derived.collections).toHaveLength(4);
    expect(derived.collections.every(({ kind }) => kind === "system")).toBe(true);
    expect(derived.collections.every(({ visibility }) => visibility === "private")).toBe(true);
    expect(
      derived.items.filter(
        ({ bookKey }) => bookKey === "russia:tolstoy:war-and-peace"
      ).map(({ collectionId }) => collectionId).sort()
    ).toEqual(
      [SYSTEM_BOOK_COLLECTION_IDS.library, SYSTEM_BOOK_COLLECTION_IDS["want-to-read"]].sort()
    );
    expect(
      derived.items.filter(
        ({ bookKey }) => bookKey === "england:austen:pride-and-prejudice"
      ).map(({ collectionId }) => collectionId).sort()
    ).toEqual(
      [SYSTEM_BOOK_COLLECTION_IDS.library, SYSTEM_BOOK_COLLECTION_IDS.reading].sort()
    );
    expect(derived.items.some(({ bookKey }) => bookKey === "article-1")).toBe(false);
    expect(derived.favorites).toEqual([]);
  });

  it("does not infer an explicit favorite from saved status", () => {
    const derived = deriveSystemBookCollections([
      {
        id: "usa:bradbury:fahrenheit-451",
        kind: "book",
        status: "saved",
        addedAt: firstTimestamp,
      },
    ]);
    const explicitFavorite = parseBookFavoriteMembership(
      favorite("usa:bradbury:fahrenheit-451")
    );

    expect(derived.favorites).toHaveLength(0);
    expect(explicitFavorite?.bookKey).toBe("usa:bradbury:fahrenheit-451");
  });
});

describe("safe local and remote merge", () => {
  it("keeps unique memberships and stable server order while appending local-only books", () => {
    const shelf = collection();
    const local = snapshot(
      [shelf],
      [
        item(shelf.id, "book:shared", 0, { updatedAt: secondTimestamp }),
        item(shelf.id, "book:local-only", 1),
      ]
    );
    const remote = snapshot(
      [collection({ updatedAt: secondTimestamp, title: "Облачное название" })],
      [
        item(shelf.id, "book:remote-first", 0),
        item(shelf.id, "book:shared", 1),
      ]
    );

    const merged = mergeBookCollectionSnapshots(local, remote);
    expect(merged.collections[0].title).toBe("Облачное название");
    expect(merged.items.map(({ bookKey }) => bookKey)).toEqual([
      "book:remote-first",
      "book:shared",
      "book:local-only",
    ]);
    expect(merged.items.map(({ position }) => position)).toEqual([0, 1, 2]);
    expect(new Set(merged.items.map(({ bookKey }) => bookKey)).size).toBe(3);
  });

  it("is deterministic and idempotent for collections, order and favorites", () => {
    const shelf = collection();
    const local = snapshot(
      [shelf],
      [item(shelf.id, "book:local", 0)],
      [favorite("book:favorite", { updatedAt: secondTimestamp })]
    );
    const remote = snapshot(
      [collection({ title: "Remote", updatedAt: secondTimestamp })],
      [item(shelf.id, "book:remote", 0)],
      [favorite("book:favorite", { addedAt: secondTimestamp, updatedAt: thirdTimestamp })]
    );

    const first = mergeBookCollectionSnapshots(local, remote);
    const second = mergeBookCollectionSnapshots(first, remote);
    const repeated = mergeBookCollectionSnapshots(local, remote);
    expect(second).toEqual(first);
    expect(repeated).toEqual(first);
    expect(first.favorites).toEqual([
      {
        bookKey: "book:favorite",
        addedAt: firstTimestamp,
        updatedAt: thirdTimestamp,
      },
    ]);
  });

  it("merges a safe icon with the winning collection metadata", () => {
    const local = snapshot([
      collection({ icon: "book", updatedAt: firstTimestamp }),
    ]);
    const remote = snapshot([
      collection({ icon: "star", updatedAt: secondTimestamp }),
    ]);

    const merged = mergeBookCollectionSnapshots(local, remote);

    expect(merged.collections[0]?.icon).toBe("star");
    expect(parseBookCollectionSnapshot(merged)).toEqual(merged);
  });

  it("fails closed on duplicate or orphan memberships", () => {
    const shelf = collection();
    expect(
      parseBookCollectionSnapshot(
        snapshot(
          [shelf],
          [item(shelf.id, "book:one", 0), item(shelf.id, "book:one", 1)]
        )
      )
    ).toBeNull();
    expect(
      parseBookCollectionSnapshot(
        snapshot([shelf], [item("collection:missing", "book:one", 0)])
      )
    ).toBeNull();
    expect(
      parseBookCollectionSnapshot(
        snapshot([shelf], [], [favorite("book:one"), favorite("book:one")])
      )
    ).toBeNull();
    expect(createEmptyBookCollectionSnapshot()).toEqual({
      schemaVersion: 1,
      collections: [],
      items: [],
      favorites: [],
    });
  });
});
