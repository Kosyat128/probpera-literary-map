import { describe, expect, it, vi } from "vitest";

// These throw if an eager dependency is introduced into a lightweight entry.
// They do not replace the real-corpus identity and publication tests.
vi.mock("../data/countries", () => { throw new Error("Country payload evaluated eagerly"); });
vi.mock("../data/countries/index", () => { throw new Error("Editorial payload evaluated eagerly"); });
vi.mock("../data/bookArchive", () => { throw new Error("Book payload evaluated eagerly"); });
vi.mock("../components/globeAtlas", () => { throw new Error("Globe runtime evaluated eagerly"); });
vi.mock("../components/LiteraryGlobe", () => { throw new Error("Globe component evaluated eagerly"); });
vi.mock("three", () => { throw new Error("3D dependency evaluated eagerly"); });

describe("shared facade loading boundaries", () => {
  it("loads type, selection, edition and brand entries without country/book/3D evaluation", async () => {
    const [types, selection, editions, brand] = await Promise.all([
      import("./types"),
      import("./selection"),
      import("./editions"),
      import("./brand"),
    ]);
    expect(Object.keys(types)).toEqual([]);
    expect(selection.createGlobeCoordinates(55, 37)).toEqual({ latitude: 55, longitude: 37 });
    expect(editions.parseStoredGlobeEdition("antique")).toBe(editions.DEFAULT_GLOBE_EDITION_ID);
    expect(brand.countryFlagAssetPath("RU")).toContain("assets/country-flags/ru.svg");
  });
});
