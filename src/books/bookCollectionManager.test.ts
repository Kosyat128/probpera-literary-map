import { describe, expect, it } from "vitest";

import {
  normalizeBookCollectionManagerDraft,
  reorderBookCollectionManagerItems,
  reorderBookCollectionManagerItemsByDrop,
  type BookCollectionManagerBookItem,
} from "./bookCollectionManager";

const items: readonly BookCollectionManagerBookItem[] = [
  { bookKey: "book:a", title: "А" },
  { bookKey: "book:b", title: "Б" },
  { bookKey: "book:c", title: "В" },
  { bookKey: "book:d", title: "Г" },
];
const keys = (value: readonly BookCollectionManagerBookItem[]) =>
  value.map((item) => item.bookKey);

describe("book collection manager", () => {
  it("moves a manual membership to every required position without mutation", () => {
    expect(keys(reorderBookCollectionManagerItems(items, "book:c", "first"))).toEqual([
      "book:c",
      "book:a",
      "book:b",
      "book:d",
    ]);
    expect(keys(reorderBookCollectionManagerItems(items, "book:c", "up"))).toEqual([
      "book:a",
      "book:c",
      "book:b",
      "book:d",
    ]);
    expect(keys(reorderBookCollectionManagerItems(items, "book:b", "down"))).toEqual([
      "book:a",
      "book:c",
      "book:b",
      "book:d",
    ]);
    expect(keys(reorderBookCollectionManagerItems(items, "book:b", "last"))).toEqual([
      "book:a",
      "book:c",
      "book:d",
      "book:b",
    ]);
    expect(keys(items)).toEqual(["book:a", "book:b", "book:c", "book:d"]);
  });

  it("does not invent a move for an edge or missing membership", () => {
    expect(reorderBookCollectionManagerItems(items, "book:a", "up")).toBe(items);
    expect(reorderBookCollectionManagerItems(items, "book:d", "down")).toBe(items);
    expect(reorderBookCollectionManagerItems(items, "book:missing", "first")).toBe(
      items
    );
  });

  it("supports explicit before/after drag-and-drop placement", () => {
    expect(
      keys(reorderBookCollectionManagerItemsByDrop(items, "book:d", "book:b", "before"))
    ).toEqual(["book:a", "book:d", "book:b", "book:c"]);
    expect(
      keys(reorderBookCollectionManagerItemsByDrop(items, "book:a", "book:c", "after"))
    ).toEqual(["book:b", "book:c", "book:a", "book:d"]);
  });

  it("normalizes safe settings and rejects unsafe collection metadata", () => {
    expect(
      normalizeBookCollectionManagerDraft({
        title: "  Русская   классика ",
        description: " Для повторного чтения ",
        backgroundPreset: "warm-paper",
        dynamicBookThemes: true,
        themeIntensity: 107.6,
        sortMode: "manual",
      })
    ).toEqual({
      title: "Русская классика",
      description: "Для повторного чтения",
      icon: "book",
      backgroundPreset: "warm-paper",
      dynamicBookThemes: true,
      themeIntensity: 100,
      sortMode: "manual",
    });
    expect(
      normalizeBookCollectionManagerDraft({
        title: "<script>",
        icon: "https://example.com/icon.svg",
        backgroundPreset: "unsafe",
        dynamicBookThemes: true,
        themeIntensity: 50,
        sortMode: "manual",
      })
    ).toBeNull();
  });
});
