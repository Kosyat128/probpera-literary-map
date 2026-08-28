import { describe, expect, it } from "vitest";

import { resolveBookShelfPresentationProfile } from "./bookShelfPresentationProfiles";

describe("book shelf presentation profiles", () => {
  it("uses only verified era and audience fields for its semantic classes", () => {
    expect(
      resolveBookShelfPresentationProfile({
        bookKey: "child-classic",
        firstPublished: 1908,
        audienceIds: ["children"],
        hasRealCover: false,
      })
    ).toMatchObject({
      eraClass: "heritage",
      audienceClass: "children",
      paletteStrategy: "children-warm",
      spinePreset: "playful",
    });

    expect(
      resolveBookShelfPresentationProfile({
        bookKey: "undated",
        firstPublished: null,
        audienceIds: [],
        hasRealCover: false,
      })
    ).toMatchObject({
      eraClass: "undated",
      audienceClass: "general",
      treatment: "typographic-premium",
    });
  });

  it("is deterministic and keeps verified edition material explicit", () => {
    const input = {
      bookKey: "stable-profile",
      firstPublished: 1967,
      audienceIds: ["adult"] as const,
      hasRealCover: true,
      verifiedEditionMaterial: "cloth" as const,
    };

    const first = resolveBookShelfPresentationProfile(input);
    const repeated = resolveBookShelfPresentationProfile(input);

    expect(repeated).toEqual(first);
    expect(first).toMatchObject({
      eraClass: "postwar",
      treatment: "postwar-literary",
      verifiedEditionMaterial: "cloth",
      paletteStrategy: "cover-led",
    });
  });

  it("does not infer children presentation from a title or identifier", () => {
    const profile = resolveBookShelfPresentationProfile({
      bookKey: "children-fairy-tale",
      firstPublished: 2020,
      audienceIds: [],
      hasRealCover: false,
    });

    expect(profile.audienceClass).toBe("general");
    expect(profile.treatment).toMatch(/^modern-/u);
  });
});
