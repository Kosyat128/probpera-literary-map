import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PreferenceStore } from "../platform/ports";
import { createPlanetMascotController, type PlanetMascotContext } from "./planetMascot";
import { createPlanetMascotPersistence } from "./planetMascotPersistence";
import { BOOKY_PREFERENCE_KEY, BOOKY_PREFERENCE_MAX_LENGTH, DEFAULT_BOOKY_PREFERENCE, parseBookyPreference, serializeBookyPreference } from "./planetMascotPreference";

import { PLANET_MASCOT_ROUTES } from "./planetMascotRoutes";

const ready = (override: Partial<PlanetMascotContext> = {}): PlanetMascotContext => ({
  enabled: true, access: "adult", active: true, screen: "globe", selectedCountry: true, selectedWriter: true, ...override,
});
const saved = { schemaVersion: 1, audience: "adult", visible: true,
  resume: { route: "country-to-book", stepId: "open-books" } } as const;
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
async function flush() { for (let turn = 0; turn < 24; ++turn) await Promise.resolve(); }
function fixture() {
  const controller = createPlanetMascotController();
  const get = vi.fn<PreferenceStore["get"]>().mockResolvedValue(null);
  const set = vi.fn<PreferenceStore["set"]>().mockResolvedValue(true);
  const remove = vi.fn<PreferenceStore["remove"]>().mockResolvedValue(true);
  const preferences: PreferenceStore = { persistence: "best-effort", get, set, remove };
  const persistence = createPlanetMascotPersistence({ controller, preferences, confirmationTimeoutMs: 100 });
  return { controller, get, set, remove, preferences, persistence };
}

describe("Booky adult preference persistence", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("does no constructor/public/child IO, restores a closed offer once, and survives StrictMode cleanup and background", async () => {
    const f = fixture(); f.get.mockResolvedValue(serializeBookyPreference(saved));
    expect(f.get).not.toHaveBeenCalled(); expect(f.set).not.toHaveBeenCalled();
    const discarded = f.persistence.activate(); discarded();
    const stop = f.persistence.activate(); discarded(); // An obsolete cleanup cannot revoke this activation.
    for (const blocked of [ready({ enabled: false }), ready({ access: "child" }), ready({ access: "blocked" })]) {
      f.controller.setContext(blocked); await flush();
      expect(f.controller.show()).toBe(false); expect(f.persistence.retry()).toBe(false);
    }
    expect(f.get).not.toHaveBeenCalled(); expect(f.set).not.toHaveBeenCalled();
    f.controller.setContext(ready()); await flush();
    expect(f.get).toHaveBeenCalledExactlyOnceWith(BOOKY_PREFERENCE_KEY);
    expect(f.controller.getSnapshot()).toMatchObject({ visibility: "shown", panel: "closed", mode: "help", route: null,
      resumeOffer: saved.resume, intentRevision: 0 });
    expect(f.persistence.getSnapshot()).toEqual({ state: "idle", error: null });
    expect(f.controller.resume()).toBe(true);
    expect(f.controller.getSnapshot()).toMatchObject({ mode: "tour", route: "country-to-book", step: 2 });
    f.controller.setContext(ready({ active: false })); await vi.advanceTimersByTimeAsync(1_000);
    f.controller.setContext(ready()); await flush();
    expect(f.controller.getSnapshot()).toMatchObject({ panel: "closed", mode: "tour", step: 2, resumeOffer: null });
    expect(f.get).toHaveBeenCalledTimes(1); expect(f.set).not.toHaveBeenCalled(); expect(f.remove).not.toHaveBeenCalled();
    stop(); f.controller.dispose();
  });

  it("fences a delayed stored route with explicit current intent and exposes failed saves for manual retry", async () => {
    const f = fixture(), read = deferred<string | null>();
    f.get.mockReturnValueOnce(read.promise); f.set.mockResolvedValueOnce(false);
    f.controller.setContext(ready()); const stop = f.persistence.activate(); await flush();
    expect(f.persistence.getSnapshot().state).toBe("loading");
    f.controller.show(); f.controller.start("overview"); await flush();
    expect(f.set).toHaveBeenCalledTimes(1);
    expect(parseBookyPreference(f.set.mock.calls[0][1])).toMatchObject({ visible: true, resume: { route: "overview", stepId: "search" } });
    expect(f.persistence.getSnapshot()).toEqual({ state: "failed", error: "write" });
    read.resolve(serializeBookyPreference(saved)); await flush();
    expect(f.controller.getSnapshot()).toMatchObject({ panel: "open", mode: "tour", route: "overview", step: 0, resumeOffer: null });
    await vi.advanceTimersByTimeAsync(1_000); expect(f.set).toHaveBeenCalledTimes(1);
    expect(f.persistence.retry()).toBe(true); await flush();
    expect(f.set).toHaveBeenCalledTimes(2); expect(f.set.mock.calls[1]).toEqual(f.set.mock.calls[0]);
    expect(f.persistence.getSnapshot()).toEqual({ state: "idle", error: null });
    expect(f.persistence.retry()).toBe(false); stop();
    // A confirmed old write is not proof that storage still contains it.
    // Another owner deleted the record before this cold mount (get => null).
    const nextController = createPlanetMascotController(); nextController.setContext(ready());
    const next = createPlanetMascotPersistence({ controller: nextController, preferences: f.preferences, confirmationTimeoutMs: 100 });
    const stopNext = next.activate(); await flush();
    expect(nextController.getSnapshot().visibility).toBe("hidden");
    expect(f.set).toHaveBeenCalledTimes(2);
    nextController.start("overview"); await flush();
    expect(f.set).toHaveBeenCalledTimes(3); expect(f.set.mock.calls[2]).toEqual(f.set.mock.calls[0]);
    stopNext();
  });

  it("bounds unavailable reads, pauses their deadline in background, and never treats invalid data as absence", async () => {
    const f = fixture(), old = deferred<string | null>(), fresh = deferred<string | null>();
    f.get.mockReturnValueOnce(old.promise).mockReturnValueOnce(fresh.promise).mockResolvedValueOnce("{}").mockResolvedValueOnce(null);
    f.controller.setContext(ready()); const stop = f.persistence.activate(); await flush();
    f.controller.setContext(ready({ active: false })); await vi.advanceTimersByTimeAsync(200);
    expect(f.persistence.getSnapshot()).toEqual({ state: "idle", error: null });
    f.controller.setContext(ready()); await flush();
    old.resolve(serializeBookyPreference(saved)); await flush();
    expect(f.controller.getSnapshot().visibility).toBe("hidden");
    expect(f.persistence.getSnapshot().state).toBe("loading");
    await vi.advanceTimersByTimeAsync(101);
    expect(f.persistence.getSnapshot()).toEqual({ state: "failed", error: "read" });
    fresh.resolve(serializeBookyPreference(saved)); await flush();
    expect(f.controller.getSnapshot().visibility).toBe("hidden");
    expect(f.persistence.retry()).toBe(true); await flush();
    expect(f.persistence.getSnapshot()).toEqual({ state: "failed", error: "read" });
    expect(f.persistence.retry()).toBe(true); await flush();
    expect(f.persistence.getSnapshot()).toEqual({ state: "idle", error: null });
    expect(f.set).not.toHaveBeenCalled(); expect(f.get).toHaveBeenCalledTimes(4); stop();
  });

  it("coalesces unstarted writes across remount but never overtakes a timed-out raw write", async () => {
    const f = fixture(), first = deferred<boolean>(), latest = deferred<boolean>();
    f.set.mockReturnValueOnce(first.promise).mockReturnValueOnce(latest.promise);
    f.controller.setContext(ready()); const stop = f.persistence.activate(); await flush();
    f.controller.show(); await flush();
    f.controller.start("overview"); f.controller.next(); await flush();
    expect(f.set).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(101);
    expect(f.persistence.getSnapshot()).toEqual({ state: "failed", error: "write" });
    stop(); f.controller.dispose();
    const nextController = createPlanetMascotController(); nextController.setContext(ready());
    const next = createPlanetMascotPersistence({ controller: nextController, preferences: f.preferences, confirmationTimeoutMs: 100 });
    const stopNext = next.activate(); await flush();
    expect(nextController.getSnapshot()).toMatchObject({ panel: "closed", mode: "help", resumeOffer: { route: "overview", stepId: "country" } });
    expect(f.get).toHaveBeenCalledTimes(1); expect(f.set).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(101);
    expect(next.getSnapshot()).toEqual({ state: "failed", error: "write" });
    first.resolve(true); await flush();
    expect(f.set).toHaveBeenCalledTimes(2);
    expect(parseBookyPreference(f.set.mock.calls[1][1])?.resume).toEqual({ route: "overview", stepId: "country" });
    expect(next.getSnapshot()).toEqual({ state: "failed", error: "write" });
    latest.resolve(true); await flush();
    expect(next.getSnapshot()).toEqual({ state: "idle", error: null });
    expect(f.set).toHaveBeenCalledTimes(2); stopNext();
  });

  it("rechecks permission before starting queued IO and handles observer cleanup without persisting context resets", async () => {
    const f = fixture(); f.controller.setContext(ready());
    const stop = f.persistence.activate(); await flush();
    let stopObserver: () => void = () => undefined;
    stopObserver = f.persistence.subscribe(() => {
      if (f.persistence.getSnapshot().state === "saving") {
        stopObserver(); f.controller.setContext(ready({ access: "child" }));
      }
    });
    f.controller.show(); await flush();
    expect(f.set).not.toHaveBeenCalled();
    expect(f.controller.getSnapshot()).toMatchObject({ available: false, visibility: "hidden" });
    expect(f.controller.getPreferenceIntent().value.visible).toBe(true); // Revocation is not an adult hide preference.
    await vi.advanceTimersByTimeAsync(200); expect(f.set).not.toHaveBeenCalled();
    f.controller.setContext(ready()); await flush();
    expect(f.set).toHaveBeenCalledTimes(1);
    expect(parseBookyPreference(f.set.mock.calls[0][1])).toEqual({ ...DEFAULT_BOOKY_PREFERENCE, visible: true });
    const stable = f.persistence.getSnapshot();
    f.controller.setContext(ready({ active: false })); stop(); await flush();
    expect(f.persistence.getSnapshot()).toBe(stable); expect(f.set).toHaveBeenCalledTimes(1);
    expect(f.remove).not.toHaveBeenCalled();
  });
});

describe("adult Booky preference codec", () => {
  it("round-trips actual route steps into detached immutable records without a navigation payload", () => {
    expect(parseBookyPreference(serializeBookyPreference(DEFAULT_BOOKY_PREFERENCE))).toEqual(DEFAULT_BOOKY_PREFERENCE);
    expect(Object.isFrozen(DEFAULT_BOOKY_PREFERENCE)).toBe(true);
    for (const [route, definition] of Object.entries(PLANET_MASCOT_ROUTES)) {
      for (const step of definition.steps) {
        const input = { schemaVersion: 1, audience: "adult", visible: true, resume: { route, stepId: step.id } };
        const parsed = parseBookyPreference(input)!;
        expect(parsed).toEqual(input); expect(parsed).not.toBe(input); expect(parsed.resume).not.toBe(input.resume);
        expect(Object.isFrozen(parsed)).toBe(true); expect(Object.isFrozen(parsed.resume)).toBe(true);
        const json = serializeBookyPreference(parsed)!;
        expect(json.length).toBeLessThan(BOOKY_PREFERENCE_MAX_LENGTH);
        expect(parseBookyPreference(`  ${json}\n`)).toEqual(parsed);
        input.resume.stepId = "changed";
        expect(parsed.resume?.stepId).toBe(step.id);
      }
    }
  });

  it("fails closed for unknown authority, hidden routes, invalid steps and non-data records", () => {
    const valid = { schemaVersion: 1, audience: "adult", visible: true, resume: null };
    let getterCalls = 0;
    const getter = Object.defineProperty({ ...valid }, "visible", { enumerable: true, get() { ++getterCalls; return true; } });
    const inputs: unknown[] = [null, undefined, [], true, 1, "", "{", " ".repeat(BOOKY_PREFERENCE_MAX_LENGTH + 1),
      { ...valid, schemaVersion: 2 }, { ...valid, audience: "child" }, { ...valid, visible: 1 }, { ...valid, resume: undefined },
      { ...valid, visible: false, resume: { route: "overview", stepId: "search" } },
      { ...valid, resume: { route: "country-to-book", stepId: "search" } },
      { ...valid, resume: { route: "overview", stepId: "open-books" } },
      { ...valid, resume: { route: "unknown", stepId: "search" } },
      { ...valid, resume: { route: "overview", stepId: "search", countryId: "russia" } },
      ...["countryId", "writerId", "capability", "completed", "camera"].map(key => ({ ...valid, [key]: "untrusted" })),
      { ...valid, [Symbol("extra")]: true }, Object.assign(Object.create({ inherited: true }), valid), getter,
      Object.defineProperty({ ...valid }, "visible", { value: true, enumerable: false }),
    ];
    for (const input of inputs) {
      expect(parseBookyPreference(input)).toBeNull(); expect(serializeBookyPreference(input)).toBeNull();
    }
    expect(getterCalls).toBe(0);
  });
});
