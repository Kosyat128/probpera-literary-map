import { describe, expect, it } from "vitest";

import {
  atlasExperienceReducer,
  createAtlasExperienceState,
  type AtlasExperienceState,
} from "./atlasExperienceState";

function immersiveIdle(
  overrides: Partial<AtlasExperienceState> = {}
): AtlasExperienceState {
  return {
    ...createAtlasExperienceState({
      view: "immersive",
      entrySource: "url",
      reducedMotion: true,
    }),
    ...overrides,
  };
}

describe("atlasExperienceReducer", () => {
  it("creates deterministic embedded and direct-URL states", () => {
    expect(createAtlasExperienceState()).toEqual({
      view: "embedded",
      transition: "idle",
      entrySource: "embedded",
      searchOpen: false,
      filtersOpen: false,
      sheetState: "collapsed",
      quiet: false,
    });

    expect(
      createAtlasExperienceState({ view: "immersive", entrySource: "url" })
    ).toMatchObject({
      view: "immersive",
      transition: "entering",
      entrySource: "url",
    });

    expect(
      createAtlasExperienceState({
        view: "immersive",
        entrySource: "url",
        reducedMotion: true,
      })
    ).toMatchObject({ view: "immersive", transition: "idle" });
  });

  it("runs a legal prepared-to-enter transition and ignores duplicates", () => {
    const embedded = createAtlasExperienceState();
    const preparing = atlasExperienceReducer(embedded, {
      type: "ENTER",
      source: "hero",
    });
    expect(preparing).toMatchObject({
      view: "embedded",
      transition: "preparing",
      entrySource: "hero",
    });
    expect(
      atlasExperienceReducer(preparing, { type: "ENTER", source: "url" })
    ).toBe(preparing);

    const entering = atlasExperienceReducer(preparing, { type: "PREPARED" });
    expect(entering).toMatchObject({
      view: "immersive",
      transition: "entering",
      entrySource: "hero",
    });

    const idle = atlasExperienceReducer(entering, {
      type: "TRANSITION_END",
    });
    expect(idle).toMatchObject({ view: "immersive", transition: "idle" });
    expect(
      atlasExperienceReducer(idle, { type: "TRANSITION_END" })
    ).toBe(idle);
  });

  it("settles enter and exit immediately when reduced motion is requested", () => {
    const immersive = atlasExperienceReducer(createAtlasExperienceState(), {
      type: "ENTER",
      source: "embedded",
      reducedMotion: true,
    });
    expect(immersive).toMatchObject({
      view: "immersive",
      transition: "idle",
      entrySource: "embedded",
    });

    expect(
      atlasExperienceReducer(immersive, {
        type: "EXIT",
        reducedMotion: true,
      })
    ).toEqual(createAtlasExperienceState());
  });

  it("cancels preparation and completes the regular exit transition", () => {
    const preparing = atlasExperienceReducer(createAtlasExperienceState(), {
      type: "ENTER",
      source: "hero",
    });
    expect(atlasExperienceReducer(preparing, { type: "EXIT" })).toEqual(
      createAtlasExperienceState()
    );

    const immersive = immersiveIdle({
      searchOpen: true,
      sheetState: "expanded",
      quiet: true,
    });
    const exiting = atlasExperienceReducer(immersive, { type: "EXIT" });
    expect(exiting).toMatchObject({
      view: "immersive",
      transition: "exiting",
      searchOpen: false,
      filtersOpen: false,
      quiet: false,
      sheetState: "expanded",
    });
    expect(
      atlasExperienceReducer(exiting, { type: "TRANSITION_END" })
    ).toEqual(createAtlasExperienceState());
  });

  it("keeps search and filters mutually exclusive", () => {
    const initial = immersiveIdle();
    const search = atlasExperienceReducer(initial, { type: "OPEN_SEARCH" });
    expect(search).toMatchObject({ searchOpen: true, filtersOpen: false });

    const filters = atlasExperienceReducer(search, { type: "OPEN_FILTERS" });
    expect(filters).toMatchObject({ searchOpen: false, filtersOpen: true });

    const searchAgain = atlasExperienceReducer(filters, {
      type: "TOGGLE_SEARCH",
    });
    expect(searchAgain).toMatchObject({ searchOpen: true, filtersOpen: false });
    expect(
      atlasExperienceReducer(searchAgain, { type: "TOGGLE_SEARCH" })
    ).toMatchObject({ searchOpen: false, filtersOpen: false });
  });

  it("applies Escape in overlay-first order before exiting immersion", () => {
    const bothOpen = immersiveIdle({ searchOpen: true, filtersOpen: true });
    const withoutSearch = atlasExperienceReducer(bothOpen, { type: "ESCAPE" });
    expect(withoutSearch).toMatchObject({
      searchOpen: false,
      filtersOpen: true,
      transition: "idle",
    });

    const withoutFilters = atlasExperienceReducer(withoutSearch, {
      type: "ESCAPE",
    });
    expect(withoutFilters).toMatchObject({
      filtersOpen: false,
      transition: "idle",
    });

    expect(
      atlasExperienceReducer(withoutFilters, { type: "ESCAPE" })
    ).toMatchObject({ transition: "exiting" });
  });

  it("allows the responsive country sheet in either settled view", () => {
    const embedded = createAtlasExperienceState();
    expect(
      atlasExperienceReducer(embedded, { type: "TOGGLE_SHEET" })
    ).toMatchObject({ sheetState: "half" });
    const half = atlasExperienceReducer(immersiveIdle(), {
      type: "SET_SHEET_STATE",
      sheetState: "half",
    });
    expect(atlasExperienceReducer(half, { type: "TOGGLE_SHEET" })).toMatchObject({
      sheetState: "expanded",
    });
    expect(
      atlasExperienceReducer(embedded, { type: "QUIET_TIMEOUT" })
    ).toBe(embedded);

    const expanded = atlasExperienceReducer(immersiveIdle(), {
      type: "SET_SHEET_STATE",
      sheetState: "expanded",
    });
    expect(expanded).toMatchObject({ sheetState: "expanded", quiet: false });

    const quiet = atlasExperienceReducer(expanded, { type: "QUIET_TIMEOUT" });
    expect(quiet.quiet).toBe(true);
    expect(atlasExperienceReducer(quiet, { type: "ACTIVITY" }).quiet).toBe(
      false
    );

    const searchOpen = { ...quiet, searchOpen: true, quiet: false };
    expect(
      atlasExperienceReducer(searchOpen, { type: "QUIET_TIMEOUT" })
    ).toBe(searchOpen);
  });

  it("synchronizes history view changes without a preparing flash", () => {
    const entering = atlasExperienceReducer(createAtlasExperienceState(), {
      type: "SYNC_VIEW",
      view: "immersive",
    });
    expect(entering).toMatchObject({
      view: "immersive",
      transition: "entering",
      entrySource: "url",
    });

    const exiting = atlasExperienceReducer(entering, {
      type: "SYNC_VIEW",
      view: "embedded",
    });
    expect(exiting).toMatchObject({ view: "immersive", transition: "exiting" });

    const reopened = atlasExperienceReducer(exiting, {
      type: "SYNC_VIEW",
      view: "immersive",
      reducedMotion: true,
    });
    expect(reopened).toMatchObject({
      view: "immersive",
      transition: "idle",
      entrySource: "url",
    });
  });
});
