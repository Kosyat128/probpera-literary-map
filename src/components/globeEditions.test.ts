import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  GLOBE_EDITION_BY_ID,
  GLOBE_EDITION_IDS,
  GLOBE_EDITIONS,
  SOURCE_ONLY_CENTROID_OVERLAY_PROFILE,
  STANDARD_GLOBE_OVERLAY_PROFILE,
  parseStoredGlobeEdition,
  resolveGlobeEditionTexturePath,
  resolveGlobeEditionTextureUrl,
} from "./globeEditions";

function textureContentVersionForEdition(
  editionId: (typeof GLOBE_EDITION_IDS)[number]
) {
  const paths = [
    resolveGlobeEditionTexturePath(editionId, false, "ru"),
    resolveGlobeEditionTexturePath(editionId, false, "en"),
    resolveGlobeEditionTexturePath(editionId, true, "ru"),
    resolveGlobeEditionTexturePath(editionId, true, "en"),
  ].filter((path, index, all): path is string =>
    Boolean(path && all.indexOf(path) === index)
  );
  const hashes = paths.map((path) =>
    createHash("sha256")
      .update(readFileSync(new URL(`../../public/${path}`, import.meta.url)))
      .digest("hex")
  );
  return `sha256-${createHash("sha256")
    .update(hashes.join(":"))
    .digest("hex")
    .slice(0, 16)}`;
}

describe("globe edition registry", () => {
  it("exposes the nine reviewed visitor editions in chronological order", () => {
    expect(GLOBE_EDITIONS.map((edition) => edition.id)).toEqual(
      GLOBE_EDITION_IDS
    );
    expect(GLOBE_EDITIONS).toHaveLength(9);
    expect(GLOBE_EDITIONS.every((edition) => edition.visitorAvailable)).toBe(
      true
    );
  });

  it("keeps source-only historical maps free of modern fill and outlines", () => {
    for (const id of [
      "behaim-1492",
      "hondius-1615",
      "coronelli-1697",
      "scherer-1700",
      "cassini-1790",
    ] as const) {
      expect(GLOBE_EDITION_BY_ID[id].overlayProfile).toBe(
        SOURCE_ONLY_CENTROID_OVERLAY_PROFILE
      );
    }
  });

  it("uses canonical selection overlays for 1887, registered 1943 and modern editions", () => {
    for (const id of [
      "rand-mcnally-1887",
      "us-army-general-reference-1943",
      "nasa-blue-marble",
      "natural-earth-2026",
    ] as const) {
      expect(GLOBE_EDITION_BY_ID[id].overlayProfile).toBe(
        STANDARD_GLOBE_OVERLAY_PROFILE
      );
    }
  });

  it("migrates the old three-style preference without retaining old ids", () => {
    expect(parseStoredGlobeEdition("antique")).toBe("rand-mcnally-1887");
    expect(parseStoredGlobeEdition("earth")).toBe("nasa-blue-marble");
    expect(parseStoredGlobeEdition("modern")).toBe("natural-earth-2026");
    expect(parseStoredGlobeEdition("unknown")).toBe("rand-mcnally-1887");
  });

  it("resolves local responsive texture paths, including the 1943 contract", () => {
    expect(resolveGlobeEditionTexturePath("behaim-1492", false)).toBe(
      "textures/behaim-1492-ravenstein-1908.webp"
    );
    expect(resolveGlobeEditionTexturePath("behaim-1492", true)).toBe(
      "textures/behaim-1492-ravenstein-1908-mobile.webp"
    );
    expect(resolveGlobeEditionTexturePath("us-army-general-reference-1943", false)).toBe(
      "textures/us-army-general-reference-1943.webp"
    );
  });

  it("cache-busts every local edition by the bytes actually shipped", () => {
    for (const edition of GLOBE_EDITIONS) {
      const expectedVersion = textureContentVersionForEdition(edition.id);
      expect(edition.textureContentVersion).toBe(expectedVersion);
      expect(resolveGlobeEditionTextureUrl(edition.id, false, "ru")).toContain(
        `?v=${expectedVersion}`
      );
    }
  });
});
