import { describe, expect, it } from "vitest";

import {
  globeKeyboardCandidateAriaCopy,
  selectGlobeKeyboardCandidate,
  type GlobeKeyboardCandidate,
} from "./globeKeyboardNavigation";

type CountryStub = { id: string };

function candidate(
  id: string,
  direction: { x: number; y: number; z: number },
  overrides: Partial<GlobeKeyboardCandidate<CountryStub>> = {}
): GlobeKeyboardCandidate<CountryStub> {
  return {
    id,
    name: id,
    value: { id },
    direction,
    visible: true,
    selectable: true,
    ...overrides,
  };
}

describe("globe keyboard country candidate", () => {
  const viewDirection = { x: 0, y: 0, z: 1 };

  it("prefers the actual centre ray hit over a nearer fallback entry", () => {
    const hit = candidate("centre-hit", { x: 0.1, y: 0, z: 0.99 });
    const nearest = candidate("nearest", { x: 0, y: 0, z: 1 });
    expect(
      selectGlobeKeyboardCandidate({
        centreHit: hit,
        candidates: [nearest],
        viewDirection,
      })
    ).toBe(hit);
  });

  it("uses the nearest visible and selectable country over ocean", () => {
    const unavailable = candidate("filtered", { x: 0, y: 0, z: 1 }, {
      selectable: false,
    });
    const near = candidate("near", { x: 0.18, y: 0, z: 0.98 });
    const farther = candidate("farther", { x: 0.4, y: 0, z: 0.92 });
    expect(
      selectGlobeKeyboardCandidate({
        candidates: [farther, unavailable, near],
        viewDirection,
      })
    ).toBe(near);
  });

  it("never selects a far-away or back-side country", () => {
    expect(
      selectGlobeKeyboardCandidate({
        candidates: [
          candidate("far", { x: 1, y: 0, z: 0.01 }),
          candidate("back", { x: 0, y: 0, z: -1 }),
        ],
        viewDirection,
        maxAngularDistanceRadians: Math.PI / 6,
      })
    ).toBeNull();
  });

  it("uses a stable id tie-breaker", () => {
    const beta = candidate("beta", { x: 0.2, y: 0, z: 1 });
    const alpha = candidate("alpha", { x: -0.2, y: 0, z: 1 });
    expect(
      selectGlobeKeyboardCandidate({
        candidates: [beta, alpha],
        viewDirection,
      })?.id
    ).toBe("alpha");
  });
});

describe("globe keyboard aria copy", () => {
  it("keeps RU and EN candidate instructions explicit and stable", () => {
    expect(
      globeKeyboardCandidateAriaCopy({ countryName: "Франция" })
    ).toBe(
      "В центре глобуса: Франция. Нажмите Enter, чтобы открыть архив страны."
    );
    expect(
      globeKeyboardCandidateAriaCopy({
        countryName: "France",
        language: "en",
        selected: true,
      })
    ).toBe("At the globe centre: France. Country selected.");
    expect(
      globeKeyboardCandidateAriaCopy({
        countryName: "Россия",
        writerCount: 41,
      })
    ).toContain("41 автор в архиве");
    expect(
      globeKeyboardCandidateAriaCopy({
        countryName: "England",
        writerCount: 72,
        language: "en",
      })
    ).toContain("72 writers in the archive");
  });
});
