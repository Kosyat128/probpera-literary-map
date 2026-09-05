import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  BOOK_COLLECTION_SCHEMA_VERSION,
  createEmptyBookCollectionSnapshot,
  type BookCollection,
  type BookCollectionSnapshot,
} from "../books/bookCollections";
import { normalizeBookArchiveFilterState } from "../books/bookArchiveFacets";
import {
  selectBookCollectionShelf,
  type BookCollectionShelfStatus,
} from "../books/bookCollectionShelfSelector";
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
      'value="manual:modern" selected="">Современная проза - 1 книга, 1 недоступно'
    );
    expect(markup).not.toContain("book-collection-switcher--compact");
    expect(markup).not.toContain("book-collection-switcher__compact-value");
  });

  it("adds a visual-only ready title and count without changing native options", () => {
    const ready = selectBookCollectionShelf({
      archiveBookKeys: ["book:available", "book:other"],
      systemSnapshot: createEmptyBookCollectionSnapshot(),
      personalSnapshot,
      activeShelfId: "all",
    });
    const render = (compact: boolean) => renderToStaticMarkup(
      <BookCollectionShelfSwitcher
        id="compact-shelf"
        selection={ready}
        compact={compact}
        disabled
        onChange={() => {}}
      />
    );
    const regular = render(false);
    const compact = render(true);

    expect(compact).toContain("book-collection-switcher--compact");
    expect(compact).toContain('class="book-collection-switcher__compact-value" aria-hidden="true"');
    expect(compact).toContain('class="book-collection-switcher__compact-title" title="Весь архив">Весь архив</span>');
    expect(compact).toContain('class="book-collection-switcher__compact-count">2</span>');
    expect(compact).not.toContain("book-collection-switcher__compact-status");
    expect(compact.match(/<select[^>]*>([\s\S]*?)<\/select>/)?.[1]).toBe(
      regular.match(/<select[^>]*>([\s\S]*?)<\/select>/)?.[1]
    );
    expect(compact).toContain('for="compact-shelf"');
    expect(compact).toContain('class="book-collection-switcher__label">Выбрать полку</span>');
    expect(compact).toContain('<select id="compact-shelf" title="Весь архив" disabled="" aria-describedby="compact-shelf-status">');
    expect(compact).toContain('id="compact-shelf-status" aria-live="polite"');
  });

  it.each<BookCollectionShelfStatus>(["empty", "partial", "missing", "unresolved"])(
    "keeps the full %s status instead of implying a ready count",
    (status) => {
      const activeOption = { ...selection.activeOption, status };
      const markup = renderToStaticMarkup(
        <BookCollectionShelfSwitcher
          selection={{ ...selection, activeOption }}
          compact
          onChange={() => {}}
          labels={{ empty: "Empty shelf", unresolved: "Updating collection" }}
        />
      );
      const expected = status === "empty" ? "Empty shelf"
        : status === "unresolved" ? "Updating collection"
          : describeBookCollectionShelfOption(activeOption);
      expect(markup).not.toContain("book-collection-switcher__compact-count");
      expect(markup).toContain(`class="book-collection-switcher__compact-status">${expected}</span>`);
      expect(markup).toContain(`book-collection-switcher__status is-${status}`);
    }
  );

  it("links the native select to a screen-reader live status", () => {
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
      "Весь архив - 2 книги"
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
