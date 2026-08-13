import { describe, expect, it } from "vitest";

import { featuredSectionIds, sectionActionKind } from "./SectionsDirectory";

describe("section directory actions", () => {
  it("uses task-specific actions for encyclopedia destinations", () => {
    expect(sectionActionKind({ id: "atlas" }, 4)).toBe("explore");
    expect(sectionActionKind({ id: "calendar" }, 0)).toBe("view");
    expect(sectionActionKind({ id: "books" }, 8)).toBe("open");
    expect(
      sectionActionKind({ id: "authors", metric: "writers" }, 3)
    ).toBe("open");
  });

  it("reserves the reading action for editorial sections", () => {
    expect(sectionActionKind({ id: "book-opinions" }, 12)).toBe("read");
    expect(sectionActionKind({ id: "empty-section" }, 0)).toBe("open");
  });

  it("keeps functional gateways in the compact directory", () => {
    expect(
      featuredSectionIds([
        { id: "journal", metric: "all-articles" },
        { id: "book-opinions" },
        { id: "atlas" },
        { id: "books" },
        { id: "calendar" },
        { id: "community", action: "forum" },
      ])
    ).toEqual(["journal", "atlas", "books", "calendar", "community"]);
  });

  it("does not hide links in a catalogue without configured gateways", () => {
    expect(featuredSectionIds([{ id: "one" }, { id: "two" }])).toEqual([
      "one",
      "two",
    ]);
  });
});
