import { describe, expect, it } from "vitest";

import {
  createBookCollectionMembershipDialogModel,
  normalizeNewBookCollectionTitle,
  type BookCollectionMembershipShelf,
} from "./bookCollectionMembershipDialog";

describe("book collection membership dialog model", () => {
  it("offers only writable system and manual shelves", () => {
    const shelves: readonly BookCollectionMembershipShelf[] = [
      {
        id: "system:library",
        title: "Моя библиотека",
        kind: "system",
        checked: true,
      },
      {
        id: "manual:summer",
        title: "На лето",
        kind: "manual",
        checked: false,
        disabled: true,
      },
      {
        id: "smart:classics",
        title: "Классика",
        kind: "smart",
        checked: false,
      },
      {
        id: "editorial:choice",
        title: "Выбор редакции",
        kind: "editorial",
        checked: false,
      },
    ];

    const model = createBookCollectionMembershipDialogModel(shelves);

    expect(model.writableShelves.map((shelf) => shelf.id)).toEqual([
      "system:library",
      "manual:summer",
    ]);
    expect(model.writableShelves[0]?.checked).toBe(true);
    expect(model.writableShelves[1]?.disabled).toBe(true);
    expect(model.readOnlyShelfCount).toBe(2);
  });

  it("keeps the first shelf when an id is repeated", () => {
    const model = createBookCollectionMembershipDialogModel([
      { id: "manual:one", title: "Первая", kind: "manual", checked: true },
      { id: "manual:one", title: "Вторая", kind: "manual", checked: false },
    ]);

    expect(model.writableShelves).toHaveLength(1);
    expect(model.writableShelves[0]?.title).toBe("Первая");
  });

  it("normalizes a personal shelf title and rejects unsafe values", () => {
    expect(normalizeNewBookCollectionTitle("  Русская\n классика  ")).toBe(
      "Русская классика",
    );
    expect(normalizeNewBookCollectionTitle("   ")).toBeNull();
    expect(normalizeNewBookCollectionTitle("<script>полка</script>")).toBeNull();
    expect(normalizeNewBookCollectionTitle("я".repeat(121))).toBeNull();
  });
});
