import { describe, expect, it } from "vitest";
import { OWNER_LOCKED_BOOK_KEYS, ownerPaletteSlotForBookKey } from "./bookOwnerSpineIdentity";
import { buildCompleteShelfBookSpec, OWNER_LOCKED_SPINE_PALETTE } from "./completeShelfModel";
import { bookArchiveKey, buildBookArchive } from "../data/bookArchive";
import { bookArchiveCountries } from "../data/countries";

describe("canonical owner spine identities", () => {
  it("resolves every pinned identity in the current canonical archive", () => {
    const archive = new Map(buildBookArchive(bookArchiveCountries).map(book => [bookArchiveKey(book.countryId, book.writerId, book.id), book]));
    for (const key of OWNER_LOCKED_BOOK_KEYS) expect(archive.has(key), key).toBe(true);
    expect(archive.get(OWNER_LOCKED_BOOK_KEYS[0])!.title).toBe("1984");
    expect(archive.get(OWNER_LOCKED_BOOK_KEYS[3])!.title).toBe("Будденброки");
  });
  it("pins all 17 distinct work identities to the prescribed palette order", () => {
    expect(OWNER_LOCKED_BOOK_KEYS).toHaveLength(17);
    expect(new Set(OWNER_LOCKED_BOOK_KEYS).size).toBe(17);
    expect(ownerPaletteSlotForBookKey("england:george_orwell:nineteen-eighty-four")).toBe(0);
    expect(ownerPaletteSlotForBookKey("germany:thomas_mann:buddenbrooks-editorial")).toBe(3);
    expect(ownerPaletteSlotForBookKey("usa:vladimir_nabokov:lolita-editorial")).toBe(15);
  });

  it("preserves owner colour after filtering, sorting and changing localized labels", () => {
    for (const key of [...OWNER_LOCKED_BOOK_KEYS].reverse()) {
      const slot = ownerPaletteSlotForBookKey(key)!;
      for (const index of [0, 4, 16, 31]) {
        for (const title of ["Книга", "Book"]) {
          const spec = buildCompleteShelfBookSpec({ key, title, writer: "Author", ownerPaletteSlot: slot, baseColor: "#000000", accentColor: "#000000", paperColor: "#ffffff" }, index);
          expect(spec.baseColor).toBe(OWNER_LOCKED_SPINE_PALETTE[slot]);
          expect(spec.paletteSlot).toBe(slot);
        }
      }
    }
  });

  it("does not match another edition, another writer or a translated title by accident", () => {
    for (const key of ["1984", "ru:1984", "other:writer:nineteen-eighty-four", "england:george_orwell:nineteen-eighty-four-other-edition", ""]) {
      expect(ownerPaletteSlotForBookKey(key)).toBeUndefined();
    }
  });
});
