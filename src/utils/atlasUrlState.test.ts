import { describe, expect, it } from "vitest";

import {
  readAtlasImmersiveHistoryMarker,
  readAtlasUrlState,
  withAtlasImmersiveHistoryMarker,
  withoutAtlasImmersiveHistoryMarker,
  withAtlasUrlState,
} from "./atlasUrlState";

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
        view: "embedded",
      });
  });

  it("keeps unrelated query parameters and the anchor when updating", () => {
    const url = withAtlasUrlState(
      "https://probpera.ru/?ref=journal#atlas",
      {
        filter: "nobel",
        countryId: "france",
        writerId: null,
        view: "embedded",
      }
    );

    expect(`${url.pathname}${url.search}${url.hash}`).toBe(
      "/?ref=journal&atlas=nobel&country=france#atlas"
    );
  });

  it("removes default and orphaned atlas parameters", () => {
    const url = withAtlasUrlState(
      "https://probpera.ru/?atlas=rich&country=usa&writer=fixture#atlas",
      {
        filter: "all",
        countryId: null,
        writerId: null,
        view: "embedded",
      }
    );

    expect(`${url.pathname}${url.search}${url.hash}`).toBe("/#atlas");
    expect(
      readAtlasUrlState("https://probpera.ru/?atlas=unknown&writer=orphan")
    ).toEqual({
      filter: "all",
      countryId: null,
      writerId: null,
      view: "embedded",
    });
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
        view: "embedded",
      });
  });

  it("keeps the filter and immersive presentation in independent parameters", () => {
    expect(
      readAtlasUrlState(
        "https://probpera.ru/?atlas=nobel&atlasView=immersive&country=japan&writer=mishima"
      )
    ).toEqual({
      filter: "nobel",
      countryId: "japan",
      writerId: "mishima",
      view: "immersive",
    });

    expect(
      readAtlasUrlState("https://probpera.ru/?atlas=immersive")
    ).toEqual({
      filter: "all",
      countryId: null,
      writerId: null,
      view: "embedded",
    });
  });

  it("adds and removes only atlasView while preserving selection and unrelated state", () => {
    const immersive = withAtlasUrlState(
      "https://probpera.ru/?ref=journal&atlas=verified&country=usa&writer=fixture#atlas",
      {
        filter: "verified",
        countryId: "usa",
        writerId: "fixture",
        view: "immersive",
      }
    );
    expect(`${immersive.pathname}${immersive.search}${immersive.hash}`).toBe(
      "/?ref=journal&atlas=verified&country=usa&writer=fixture&atlasView=immersive#atlas"
    );

    const embedded = withAtlasUrlState(immersive, {
      filter: "verified",
      countryId: "usa",
      writerId: "fixture",
      view: "embedded",
    });
    expect(`${embedded.pathname}${embedded.search}${embedded.hash}`).toBe(
      "/?ref=journal&atlas=verified&country=usa&writer=fixture#atlas"
    );
  });

  it("tags only app-owned immersive history entries without erasing other state", () => {
    const tagged = withAtlasImmersiveHistoryMarker(
      { bookOverlay: "open" },
      "hero"
    );
    expect(tagged.bookOverlay).toBe("open");
    expect(readAtlasImmersiveHistoryMarker(tagged)).toEqual({
      source: "hero",
      version: 1,
    });
    expect(withoutAtlasImmersiveHistoryMarker(tagged)).toEqual({
      bookOverlay: "open",
    });
    expect(readAtlasImmersiveHistoryMarker({})).toBeNull();
  });
});
