import { describe, expect, it } from "vitest";

import {
  BOOK_COLLECTION_SCHEMA_VERSION,
  SYSTEM_BOOK_COLLECTION_IDS,
  createEmptyBookCollectionSnapshot,
  deriveSystemBookCollections,
  type BookCollection,
  type BookCollectionItem,
  type BookCollectionSnapshot,
} from "./bookCollections";
import {
  BOOK_COLLECTION_ALL_SHELF_ID,
  BOOK_COLLECTION_FAVORITES_SHELF_ID,
  selectBookCollectionShelf,
} from "./bookCollectionShelfSelector";

const now = "2026-08-27T10:00:00.000Z";

const collection = (
  id: string,
  kind: BookCollection["kind"],
  title: string,
  overrides: Partial<BookCollection> = {}
): BookCollection => ({
  id,
  kind,
  title,
  visibility: kind === "editorial" ? "public" : "private",
  dynamicBookThemes: true,
  themeIntensity: 70,
  sortMode: kind === "manual" ? "manual" : "editorial-relevance",
  schemaVersion: BOOK_COLLECTION_SCHEMA_VERSION,
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

const membership = (
  collectionId: string,
  bookKey: string,
  position: number
): BookCollectionItem => ({
  collectionId,
  bookKey,
  position,
  addedAt: now,
  updatedAt: now,
});

const snapshot = (
  collections: readonly BookCollection[],
  items: readonly BookCollectionItem[] = [],
  favoriteKeys: readonly string[] = []
): BookCollectionSnapshot => ({
  schemaVersion: BOOK_COLLECTION_SCHEMA_VERSION,
  collections,
  items,
  favorites: favoriteKeys.map((bookKey) => ({
    bookKey,
    addedAt: now,
    updatedAt: now,
  })),
});

describe("book collection shelf selector", () => {
  it("models archive, editorial, system, favorites, manual and smart options", () => {
    const archiveBookKeys = ["book:a", "book:b", "book:c", "book:d"];
    const systemSnapshot = deriveSystemBookCollections([
      { id: "book:a", kind: "book", status: "saved", addedAt: now },
      { id: "book:b", kind: "book", status: "reading", addedAt: now },
      { id: "book:c", kind: "book", status: "finished", addedAt: now },
    ]);
    const manual = collection("manual:classics", "manual", "Классика");
    const smart = collection("smart:short", "smart", "Короткие", {
      filterState: { sort: "title" } as BookCollection["filterState"],
    });
    const editorial = collection(
      "editorial:choice",
      "editorial",
      "Выбор редакции",
      { description: "Проверенная подборка" }
    );
    const selection = selectBookCollectionShelf({
      archiveBookKeys,
      systemSnapshot,
      personalSnapshot: snapshot(
        [smart, manual],
        [membership(manual.id, "book:d", 0)],
        ["book:b"]
      ),
      editorialSnapshot: snapshot(
        [editorial],
        [membership(editorial.id, "book:c", 0)]
      ),
      smartCandidateKeys: new Map([[smart.id, ["book:a", "book:d"]]]),
      activeShelfId: smart.id,
    });

    expect(selection.groups.map(({ id }) => id)).toEqual([
      "archive",
      "editorial",
      "library",
      "personal",
    ]);
    expect(selection.options.map(({ kind }) => kind)).toEqual([
      "archive",
      "editorial",
      "system",
      "favorites",
      "system",
      "system",
      "system",
      "manual",
      "smart",
    ]);
    expect(selection.activeShelfId).toBe(smart.id);
    expect(selection.candidateKeys).toEqual(["book:a", "book:d"]);
    expect(selection.candidateKeySet.has("book:d")).toBe(true);
    expect(
      selection.options.find(({ id }) => id === BOOK_COLLECTION_FAVORITES_SHELF_ID)
        ?.candidateKeys
    ).toEqual(["book:b"]);
  });

  it("keeps favorites independent from saved and reading system shelves", () => {
    const systemSnapshot = deriveSystemBookCollections([
      { id: "book:saved", kind: "book", status: "saved", addedAt: now },
      { id: "book:reading", kind: "book", status: "reading", addedAt: now },
    ]);
    const selection = selectBookCollectionShelf({
      archiveBookKeys: ["book:saved", "book:reading", "book:favorite"],
      systemSnapshot,
      personalSnapshot: snapshot([], [], ["book:favorite"]),
      activeShelfId: BOOK_COLLECTION_FAVORITES_SHELF_ID,
    });

    expect(selection.candidateKeys).toEqual(["book:favorite"]);
    expect(
      selection.options.find(
        ({ id }) => id === SYSTEM_BOOK_COLLECTION_IDS["want-to-read"]
      )?.candidateKeys
    ).toEqual(["book:saved"]);
    expect(
      selection.options.find(
        ({ id }) => id === SYSTEM_BOOK_COLLECTION_IDS.reading
      )?.candidateKeys
    ).toEqual(["book:reading"]);
  });

  it("reports partial and fully missing references without substitutions", () => {
    const manual = collection("manual:missing", "manual", "Архивная полка");
    const editorial = collection(
      "editorial:missing",
      "editorial",
      "Утраченные ссылки"
    );
    const selection = selectBookCollectionShelf({
      archiveBookKeys: ["book:present", "book:other"],
      systemSnapshot: createEmptyBookCollectionSnapshot(),
      personalSnapshot: snapshot(
        [manual],
        [
          membership(manual.id, "book:present", 0),
          membership(manual.id, "book:missing", 1),
        ]
      ),
      editorialSnapshot: snapshot(
        [editorial],
        [membership(editorial.id, "book:gone", 0)]
      ),
      activeShelfId: manual.id,
    });
    const manualOption = selection.activeOption;
    const editorialOption = selection.options.find(
      ({ id }) => id === editorial.id
    );

    expect(manualOption).toMatchObject({
      status: "partial",
      count: 1,
      referenceCount: 2,
      missingCount: 1,
      candidateKeys: ["book:present"],
    });
    expect(manualOption.missingReferences[0]).toEqual({
      shelfId: manual.id,
      bookKey: "book:missing",
      source: "membership",
      position: 1,
      removable: true,
    });
    expect(editorialOption).toMatchObject({
      status: "missing",
      count: 0,
      referenceCount: 1,
      missingCount: 1,
      candidateKeys: [],
    });
    expect(editorialOption?.missingReferences[0].removable).toBe(false);
  });

  it("distinguishes an empty smart result from a not-yet-resolved smart shelf", () => {
    const unresolved = collection("smart:unresolved", "smart", "Новые", {
      filterState: { sort: "recent" } as BookCollection["filterState"],
    });
    const empty = collection("smart:empty", "smart", "Без результатов", {
      filterState: { sort: "title" } as BookCollection["filterState"],
    });
    const personalSnapshot = snapshot([unresolved, empty]);
    const selection = selectBookCollectionShelf({
      archiveBookKeys: ["book:a"],
      systemSnapshot: createEmptyBookCollectionSnapshot(),
      personalSnapshot,
      smartCandidateKeys: new Map([[empty.id, []]]),
      activeShelfId: unresolved.id,
    });

    expect(selection.activeOption.status).toBe("unresolved");
    expect(
      selection.options.find(({ id }) => id === empty.id)?.status
    ).toBe("empty");
  });

  it("falls back to the full archive and excludes non-private personal data", () => {
    const unsafePersonal = collection(
      "manual:public",
      "manual",
      "Не должна появиться",
      { visibility: "public" }
    );
    const selection = selectBookCollectionShelf({
      archiveBookKeys: ["book:a", "book:a", "", "book:b"],
      systemSnapshot: createEmptyBookCollectionSnapshot(),
      personalSnapshot: snapshot([unsafePersonal]),
      activeShelfId: "missing:shelf",
    });

    expect(selection.activeShelfId).toBe(BOOK_COLLECTION_ALL_SHELF_ID);
    expect(selection.candidateKeys).toEqual(["book:a", "book:b"]);
    expect(selection.activeOption.status).toBe("ready");
    expect(selection.options.some(({ id }) => id === unsafePersonal.id)).toBe(
      false
    );
  });
});
