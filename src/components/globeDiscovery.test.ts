import { describe, expect, it } from "vitest";

import {
  chooseRandomLiteraryDestination,
  rememberLiteraryDestination,
} from "./globeDiscovery";

const countries = [
  { id: "delta", region: "south" },
  { id: "alpha", region: "north" },
  { id: "charlie", region: "north" },
  { id: "bravo", region: "north" },
];

describe("Random Literary Journey selection", () => {
  it("uses only filter-eligible destinations", () => {
    expect(
      chooseRandomLiteraryDestination({
        candidates: countries,
        randomValue: 0.99,
        isEligible: (country) => country.region === "north",
      })?.region
    ).toBe("north");
  });

  it("avoids the current country and the last three visits", () => {
    const candidates = [...countries, { id: "echo", region: "north" }];
    expect(
      chooseRandomLiteraryDestination({
        candidates,
        randomValue: 0.5,
        currentId: "delta",
        recentIds: ["alpha", "bravo", "charlie"],
      })?.id
    ).toBe("echo");
  });

  it("relaxes history, but not current selection, for a small filter", () => {
    expect(
      chooseRandomLiteraryDestination({
        candidates: [{ id: "alpha" }, { id: "bravo" }],
        randomValue: 0,
        currentId: "alpha",
        recentIds: ["bravo"],
      })?.id
    ).toBe("bravo");
  });

  it("is deterministic for a given candidate set and random value", () => {
    const options = {
      candidates: countries,
      randomValue: 0.51,
      recentIds: [] as string[],
    };
    expect(chooseRandomLiteraryDestination(options)?.id).toBe("charlie");
    expect(
      chooseRandomLiteraryDestination({
        ...options,
        candidates: [...countries].reverse(),
      })?.id
    ).toBe("charlie");
  });

  it("keeps a three-item unique history", () => {
    expect(
      rememberLiteraryDestination(["alpha", "bravo", "charlie"], "bravo")
    ).toEqual(["alpha", "charlie", "bravo"]);
    expect(
      rememberLiteraryDestination(["alpha", "bravo", "charlie"], "delta")
    ).toEqual(["bravo", "charlie", "delta"]);
  });
});
