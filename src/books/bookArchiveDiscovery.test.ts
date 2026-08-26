import { describe, expect, it } from "vitest";

import {
  BOOK_ARCHIVE_RANDOM_HISTORY_LIMIT,
  chooseRandomBookArchiveItem,
  rememberRandomBookArchiveItem,
} from "./bookArchiveDiscovery";

describe("book archive random discovery", () => {
  it("returns null when the complete archive is empty", () => {
    expect(
      chooseRandomBookArchiveItem({ candidates: [], randomValue: 0.5 })
    ).toBeNull();
  });

  it("can select far beyond the visible 13-book shelf batch", () => {
    const archive = Array.from({ length: 10_000 }, (_, index) => ({
      key: `book-${index.toString().padStart(5, "0")}`,
      sourceIndex: index,
    }));

    const selected = chooseRandomBookArchiveItem({
      candidates: archive,
      randomValue: 0.9729,
    });

    expect(selected).toEqual({ key: "book-09729", sourceIndex: 9729 });
    expect(selected?.sourceIndex).toBeGreaterThan(12);
  });

  it("is deterministic for a given random value regardless of source order", () => {
    const archive = [
      { key: "delta" },
      { key: "alpha" },
      { key: "charlie" },
      { key: "bravo" },
    ];
    const options = { candidates: archive, randomValue: 0.51 };

    expect(chooseRandomBookArchiveItem(options)?.key).toBe("charlie");
    expect(
      chooseRandomBookArchiveItem({
        ...options,
        candidates: [...archive].reverse(),
      })?.key
    ).toBe("charlie");
  });

  it("clamps invalid and boundary random values to a valid archive item", () => {
    const archive = [{ key: "alpha" }, { key: "bravo" }, { key: "charlie" }];

    expect(
      chooseRandomBookArchiveItem({ candidates: archive, randomValue: -1 })?.key
    ).toBe("alpha");
    expect(
      chooseRandomBookArchiveItem({ candidates: archive, randomValue: 1 })?.key
    ).toBe("charlie");
    expect(
      chooseRandomBookArchiveItem({ candidates: archive, randomValue: NaN })
        ?.key
    ).toBe("alpha");
  });

  it("avoids the current and recent works while alternatives remain", () => {
    const archive = ["alpha", "bravo", "charlie", "delta", "echo"].map(
      (key) => ({ key })
    );

    expect(
      chooseRandomBookArchiveItem({
        candidates: archive,
        randomValue: 0,
        currentKey: "alpha",
        recentKeys: ["bravo", "charlie"],
      })?.key
    ).toBe("delta");
  });

  it("relaxes recent history before allowing the current work", () => {
    expect(
      chooseRandomBookArchiveItem({
        candidates: [{ key: "alpha" }, { key: "bravo" }],
        randomValue: 0,
        currentKey: "alpha",
        recentKeys: ["bravo"],
      })?.key
    ).toBe("bravo");
  });

  it("keeps the latest 13 unique canonical keys", () => {
    const initial = Array.from(
      { length: BOOK_ARCHIVE_RANDOM_HISTORY_LIMIT },
      (_, index) => `book-${index}`
    );
    const withNewSelection = rememberRandomBookArchiveItem(
      initial,
      "book-13"
    );
    const withRepeatedSelection = rememberRandomBookArchiveItem(
      withNewSelection,
      "book-5"
    );

    expect(withNewSelection).toEqual(
      Array.from(
        { length: BOOK_ARCHIVE_RANDOM_HISTORY_LIMIT },
        (_, index) => `book-${index + 1}`
      )
    );
    expect(withRepeatedSelection).toHaveLength(
      BOOK_ARCHIVE_RANDOM_HISTORY_LIMIT
    );
    expect(new Set(withRepeatedSelection).size).toBe(
      BOOK_ARCHIVE_RANDOM_HISTORY_LIMIT
    );
    expect(withRepeatedSelection[withRepeatedSelection.length - 1]).toBe(
      "book-5"
    );
  });
});
