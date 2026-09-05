import { describe, expect, it } from "vitest";
import { advanceBookShelfPointer, bookShelfPointerIsClick, nearestBookShelfSpine } from "./bookShelfPointer";

describe("precise spine interaction", () => {
  it("accepts hand jitter and rejects swipes, vertical scroll, cancellation and another pointer", () => {
    for (const pointerType of ["mouse", "touch", "pen"]) {
      const start = { pointerId: 7, pointerType, x: 50, y: 100, at: 0, moved: false };
      expect(bookShelfPointerIsClick(start, { pointerId: 7, x: 52, y: 102, at: 180 })).toBe(true);
      for (const [x,y] of [[120,100],[50,170]]) {
        const moved = advanceBookShelfPointer(start, { pointerId: 7, x, y });
        expect(bookShelfPointerIsClick(moved, { pointerId: 7, x: 50, y: 100, at: 200 })).toBe(false);
      }
      expect(bookShelfPointerIsClick(start, { pointerId: 8, x: 50, y: 100, at: 200 })).toBe(false);
      expect(bookShelfPointerIsClick(start, { pointerId: 7, x: 50, y: 100, at: 200, cancelled: true })).toBe(false);
      expect(bookShelfPointerIsClick(start, { pointerId: 7, x: 50, y: 100, at: 900 })).toBe(false);
    }
  });

  it("resolves overlapping targets by the visible centre including both ends", () => {
    const books = Array.from({ length: 17 }, (_, index) => ({ key: `book-${index}`, x: 12 + index * 18, y: 80, width: 12, height: 110 }));
    for (let index = 0; index < books.length; index += 1) {
      expect(nearestBookShelfSpine(books, books[index].x + 6, 90)?.key).toBe(books[index].key);
    }
    expect(nearestBookShelfSpine(books, -5, 80)?.key).toBe("book-0");
    expect(nearestBookShelfSpine(books, 316, 80)?.key).toBe("book-16");
    expect(nearestBookShelfSpine(books, 50, 200)).toBeNull();
    expect(nearestBookShelfSpine([], 50, 80)).toBeNull();
  });
});
