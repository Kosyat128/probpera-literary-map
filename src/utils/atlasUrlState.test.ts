import { describe, expect, it } from "vitest";

import { readAtlasUrlState, withAtlasUrlState } from "./atlasUrlState";

describe("atlas URL state", () => {
  it("reads a shareable filter, country and writer selection", () => {
    expect(
      readAtlasUrlState(
        "https://probpera.ru/?atlas=verified&country=russia&writer=chekhov#atlas"
      )
    ).toEqual({
      filter: "verified",
      countryId: "russia",
      writerId: "chekhov",
    });
  });

  it("keeps unrelated query parameters and the anchor when updating", () => {
    const url = withAtlasUrlState(
      "https://probpera.ru/?ref=journal#atlas",
      { filter: "nobel", countryId: "france", writerId: null }
    );

    expect(`${url.pathname}${url.search}${url.hash}`).toBe(
      "/?ref=journal&atlas=nobel&country=france#atlas"
    );
  });

  it("removes default and orphaned atlas parameters", () => {
    const url = withAtlasUrlState(
      "https://probpera.ru/?atlas=rich&country=usa&writer=fixture#atlas",
      { filter: "all", countryId: null, writerId: null }
    );

    expect(`${url.pathname}${url.search}${url.hash}`).toBe("/#atlas");
    expect(
      readAtlasUrlState("https://probpera.ru/?atlas=unknown&writer=orphan")
    ).toEqual({ filter: "all", countryId: null, writerId: null });
  });

  it("keeps a writer identity because atlas filters describe countries", () => {
    expect(
      readAtlasUrlState(
        "https://probpera.ru/?atlas=verified&country=usa&writer=william_bradford"
      )
    ).toEqual({
      filter: "verified",
      countryId: "usa",
      writerId: "william_bradford",
    });
  });
});
