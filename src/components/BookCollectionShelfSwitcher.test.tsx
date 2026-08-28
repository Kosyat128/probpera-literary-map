import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  BOOK_COLLECTION_SCHEMA_VERSION,
  createEmptyBookCollectionSnapshot,
  type BookCollection,
  type BookCollectionSnapshot,
} from "../books/bookCollections";
import { normalizeBookArchiveFilterState } from "../books/bookArchiveFacets";
import { selectBookCollectionShelf } from "../books/bookCollectionShelfSelector";
import BookCollectionShelfSwitcher, {
  describeBookCollectionShelfOption,
  formatBookCollectionShelfOptionLabel,
} from "./BookCollectionShelfSwitcher";

const now = "2026-08-28T12:00:00.000Z";
const manualCollection: BookCollection = {
  id: "manual:modern",
  kind: "manual",
  title: "Современная проза",
  visibility: "private",
  dynamicBookThemes: true,
  themeIntensity: 70,
  sortMode: "manual",
  schemaVersion: BOOK_COLLECTION_SCHEMA_VERSION,
  createdAt: now,
  updatedAt: now,
};
const personalSnapshot: BookCollectionSnapshot = {
  schemaVersion: BOOK_COLLECTION_SCHEMA_VERSION,
  collections: [manualCollection],
  items: [
    {
      collectionId: manualCollection.id,
      bookKey: "book:available",
      position: 0,
      addedAt: now,
      updatedAt: now,
    },
    {
      collectionId: manualCollection.id,
      bookKey: "book:missing",
      position: 1,
      addedAt: now,
      updatedAt: now,
    },
  ],
  favorites: [],
};

describe("BookCollectionShelfSwitcher", () => {
  const selection = selectBookCollectionShelf({
    archiveBookKeys: ["book:available", "book:other"],
    systemSnapshot: createEmptyBookCollectionSnapshot(),
    personalSnapshot,
    activeShelfId: manualCollection.id,
  });

  it("renders all semantic groups and the selected shelf", () => {
    const markup = renderToStaticMarkup(
      <BookCollectionShelfSwitcher selection={selection} onChange={() => {}} />
    );

    expect(markup).toContain('<optgroup label="Архив">');
    expect(markup).toContain('<optgroup label="Редакционные полки">');
    expect(markup).toContain('<optgroup label="Моя библиотека">');
    expect(markup).toContain('<optgroup label="Мои полки">');
    expect(markup).toContain(
      'value="manual:modern" selected="">Современная проза — 1 книга, 1 недоступно'
    );
  });

  it("links the native select to a live, visible status", () => {
    const markup = renderToStaticMarkup(
      <BookCollectionShelfSwitcher
        id="archive-shelf"
        selection={selection}
        onChange={() => {}}
      />
    );

    expect(markup).toContain('aria-describedby="archive-shelf-status"');
    expect(markup).toContain('id="archive-shelf-status"');
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain("is-partial");
  });

  it("formats ready, partial and unresolved states without hiding counts", () => {
    expect(describeBookCollectionShelfOption(selection.activeOption)).toBe(
      "1 книга, 1 недоступно"
    );
    expect(formatBookCollectionShelfOptionLabel(selection.options[0])).toBe(
      "Весь архив — 2 книги"
    );

    const smart: BookCollection = {
      ...manualCollection,
      id: "smart:recent",
      kind: "smart",
      title: "Недавние",
      sortMode: "recent",
      filterState: normalizeBookArchiveFilterState({ sort: "recent" }),
    };
    const unresolved = selectBookCollectionShelf({
      archiveBookKeys: ["book:available"],
      systemSnapshot: createEmptyBookCollectionSnapshot(),
      personalSnapshot: {
        ...personalSnapshot,
        collections: [smart],
        items: [],
      },
      activeShelfId: smart.id,
    });

    expect(describeBookCollectionShelfOption(unresolved.activeOption)).toBe(
      "Подборка обновляется"
    );
  });
});
