import { afterEach, describe, expect, it, vi } from "vitest";
import type { PreferenceStore } from "../platform/ports";
import {
  DEFAULT_GLOBE_COMPOSITION_SELECTION as defaults, GLOBE_COMPOSITION_PREFERENCE_KEY as key,
  parseGlobeComposition, serializeGlobeComposition, type GlobeCompositionSelection,
} from "../planet/globeComposition";
import { GLOBE_STAND_PREFERENCE_KEY } from "../planet/globeStands";
import { GLOBE_BACKGROUND_PREFERENCE_KEY } from "../planet/globeBackgrounds";
import {
  createPlanetCompositionController, PLANET_COMPOSITION_CONFIRMATION_TIMEOUT_MS,
  PLANET_COMPOSITION_PREVIEW_TIMEOUT_MS, type PlanetCompositionController, type PlanetCompositionOptions,
} from "./planetComposition";

const editionKey = "probpera.globe-edition.v2", styleKey = "probpera.globe-style.v1";
const selection = (changes: Partial<GlobeCompositionSelection> = {}): GlobeCompositionSelection => ({ ...defaults, ...changes });
const raw = (value = selection()) => serializeGlobeComposition({ schemaVersion: 1, commitId: "fixture:1", selection: value })!;
const flush = async () => { for (let index = 0; index < 40; index++) await Promise.resolve(); };
const stops: (() => void)[] = [];
function activate(controller: PlanetCompositionController) { const stop = controller.activate(); stops.push(stop); return stop; }
afterEach(() => { for (const stop of stops.splice(0)) stop(); vi.useRealTimers(); });
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function fixture(options: Partial<Omit<PlanetCompositionOptions, "preferences">> = {}) {
  const memory = new Map<string, string>();
  const preferences = {
    persistence: "best-effort" as const,
    get: vi.fn<PreferenceStore["get"]>(async name => memory.get(name) ?? null),
    set: vi.fn<PreferenceStore["set"]>(async (name, value) => { memory.set(name, value); return true; }),
    remove: vi.fn<PreferenceStore["remove"]>(async name => memory.delete(name)),
  };
  const controller = createPlanetCompositionController({ preferences, enabled: true, access: "adult", ...options });
  return { controller, preferences, memory };
}
function parts(controller: PlanetCompositionController) {
  const { renderRevision: revision, displayed } = controller.getSnapshot();
  expect(controller.acknowledgePartRendered("edition", revision, displayed.editionId)).toBe(true);
  expect(controller.acknowledgePartRendered("stand", revision, displayed.standId)).toBe(true);
  expect(controller.acknowledgePartRendered("background", revision, displayed.backgroundId)).toBe(true);
  return { revision, displayed };
}
function frame(controller: PlanetCompositionController) {
  const { revision, displayed } = parts(controller);
  expect(controller.acknowledgeRendered(revision, displayed)).toBe(true);
}
function applyStand(controller: PlanetCompositionController, id = "stand.base.wood") {
  expect(controller.open("stand")).toBe(true); expect(controller.preview("stand", id)).toBe(true);
  frame(controller); expect(controller.apply()).toBe(true);
}
function draftCombination(controller: PlanetCompositionController, standId = "stand.base.book-stack", backgroundId = "background.base.library") {
  expect(controller.open("stand")).toBe(true); expect(controller.preview("stand", standId)).toBe(true);
  expect(controller.open("background")).toBe(true); expect(controller.preview("background", backgroundId)).toBe(true);
  return controller.getSnapshot();
}

describe("receipt-bound whole globe composition lifecycle", () => {
  it("performs no constructor, public-site or blocked-policy IO", async () => {
    for (const options of [{ enabled: false }, { access: "blocked" as const }, { getEnvironment: () => ({ access: "child", qualityTier: "high" }) }]) {
      const f = fixture(options);
      expect(f.preferences.get).not.toHaveBeenCalled(); activate(f.controller); await flush();
      expect(f.controller.open("stand")).toBe(false);
      expect(f.controller.requestEdition("nasa-blue-marble")).toBe(false);
      expect(f.controller.apply()).toBe(false); expect(f.controller.retrySave()).toBe(false);
      expect(f.preferences.get).not.toHaveBeenCalled(); expect(f.preferences.set).not.toHaveBeenCalled();
    }
  });

  it("leaves fresh defaults alone and does not write a gratuitous composition", async () => {
    const f = fixture(); activate(f.controller); await flush();
    expect(f.controller.getSnapshot()).toMatchObject({ applied: defaults, displayed: defaults, phase: "idle", reason: null });
    expect(f.preferences.get.mock.calls.map(call => call[0])).toEqual([key, editionKey, styleKey, GLOBE_STAND_PREFERENCE_KEY, GLOBE_BACKGROUND_PREFERENCE_KEY]);
    expect(f.preferences.set).not.toHaveBeenCalled(); expect(f.preferences.remove).not.toHaveBeenCalled();
  });

  it("restores a valid new record only after three parts and a matching whole frame, ignoring legacy", async () => {
    const f = fixture(); const saved = selection({ editionId: "nasa-blue-marble", standId: "stand.base.book-stack", backgroundId: "background.base.library" });
    f.memory.set(key, raw(saved)); f.memory.set(editionKey, "natural-earth-2026"); activate(f.controller); await flush();
    expect(f.preferences.get.mock.calls).toEqual([[key]]);
    expect(f.controller.getSnapshot()).toMatchObject({ applied: defaults, displayed: saved, phase: "preparing" });
    const revision = f.controller.getSnapshot().renderRevision;
    expect(f.controller.acknowledgeRendered(revision, saved)).toBe(false);
    expect(f.controller.acknowledgePartRendered("stand", revision, "canonical")).toBe(false);
    parts(f.controller);
    expect(f.controller.acknowledgeRendered(revision, selection({ standId: saved.standId }))).toBe(false);
    expect(f.controller.acknowledgeRendered(revision, saved)).toBe(true);
    expect(f.controller.getSnapshot().applied).toEqual(saved);
    expect(f.preferences.set).not.toHaveBeenCalled(); expect(f.memory.get(editionKey)).toBe("natural-earth-2026");
  });

  it("migrates a coherent legacy selection only after its combined frame and never edits legacy keys", async () => {
    const fallback = vi.fn(() => "earth"), f = fixture({ readLegacyEdition: fallback });
    f.memory.set(styleKey, "modern"); f.memory.set(GLOBE_STAND_PREFERENCE_KEY, "stand.base.wood");
    f.memory.set(GLOBE_BACKGROUND_PREFERENCE_KEY, "background.base.library");
    const legacy = new Map(f.memory); activate(f.controller); await flush();
    expect(fallback).not.toHaveBeenCalled(); expect(f.preferences.set).not.toHaveBeenCalled();
    const desired = selection({ editionId: "natural-earth-2026", standId: "stand.base.wood", backgroundId: "background.base.library" });
    expect(f.controller.getSnapshot().displayed).toEqual(desired); frame(f.controller); await flush();
    expect(f.preferences.set).toHaveBeenCalledTimes(1);
    expect(parseGlobeComposition(f.memory.get(key))?.selection).toEqual(desired);
    for (const [name, value] of legacy) expect(f.memory.get(name)).toBe(value);
    expect(f.preferences.remove).not.toHaveBeenCalled();
  });

  it("consults WebView migration only after both edition keys are confirmed absent", async () => {
    const fallback = vi.fn(() => "earth"), f = fixture({ readLegacyEdition: fallback });
    activate(f.controller); await flush(); expect(fallback).toHaveBeenCalledTimes(1);
    expect(f.controller.getSnapshot().displayed.editionId).toBe("nasa-blue-marble");
    frame(f.controller); await flush(); expect(parseGlobeComposition(f.memory.get(key))?.selection.editionId).toBe("nasa-blue-marble");
    const other = fixture({ readLegacyEdition: fallback }); other.memory.set(editionKey, "corrupt");
    activate(other.controller); await flush(); expect(fallback).toHaveBeenCalledTimes(1);
    expect(other.preferences.get.mock.calls.map(call => call[0])).not.toContain(styleKey);
    expect(other.controller.getSnapshot().displayed.editionId).toBe(defaults.editionId);
  });

  it.each(["malformed", "rejected", "timeout"])("never reads legacy after a %s new-record read", async failure => {
    vi.useFakeTimers();
    const fallback = vi.fn(() => "modern"), f = fixture({ readLegacyEdition: fallback });
    if (failure === "malformed") f.memory.set(key, "{broken}");
    else if (failure === "rejected") f.preferences.get.mockRejectedValue(new Error("denied"));
    else f.preferences.get.mockReturnValue(new Promise(() => undefined));
    activate(f.controller); await flush();
    if (failure === "timeout") { await vi.advanceTimersByTimeAsync(PLANET_COMPOSITION_CONFIRMATION_TIMEOUT_MS + 1); await flush(); }
    expect(f.preferences.get.mock.calls).toEqual([[key]]); expect(fallback).not.toHaveBeenCalled();
    expect(f.preferences.set).not.toHaveBeenCalled();
    expect(f.controller.getSnapshot()).toMatchObject({ applied: defaults, displayed: defaults, phase: "error", reason: failure === "malformed" ? "invalid-preference" : "preference-unavailable" });
  });

  it("fences delayed hydration with explicit intent, including a subsequently failed render", async () => {
    const f = fixture(), held = deferred<string | null>(); f.preferences.get.mockReturnValueOnce(held.promise);
    activate(f.controller); await flush(); f.controller.requestEdition("nasa-blue-marble");
    const revision = f.controller.getSnapshot().renderRevision;
    expect(f.controller.failRendering(revision)).toBe(true);
    held.resolve(raw(selection({ backgroundId: "background.base.library" }))); await flush();
    expect(f.controller.getSnapshot()).toMatchObject({ applied: defaults, displayed: defaults, phase: "error", reason: "render-failed" });
    expect(f.preferences.set).not.toHaveBeenCalled(); expect(f.preferences.get).toHaveBeenCalledTimes(1);
  });

  it("keeps preview separate from Apply and cancels the whole draft when edition intent arrives", async () => {
    const f = fixture(); activate(f.controller); await flush();
    draftCombination(f.controller);
    const stale = parts(f.controller);
    expect(f.controller.apply()).toBe(false); expect(f.preferences.set).not.toHaveBeenCalled();
    expect(f.controller.requestEdition("nasa-blue-marble")).toBe(true);
    expect(f.controller.acknowledgeRendered(stale.revision, stale.displayed)).toBe(false);
    expect(f.controller.getSnapshot()).toMatchObject({ editor: null, applied: defaults, displayed: selection({ editionId: "nasa-blue-marble" }) });
    frame(f.controller); await flush();
    expect(parseGlobeComposition(f.memory.get(key))?.selection).toEqual(selection({ editionId: "nasa-blue-marble" }));
    const combined = draftCombination(f.controller); frame(f.controller);
    expect(f.controller.getSnapshot().phase).toBe("preview"); expect(f.preferences.set).toHaveBeenCalledTimes(1);
    expect(combined.displayed).toEqual(selection({ editionId: "nasa-blue-marble", standId: "stand.base.book-stack", backgroundId: "background.base.library" }));
    expect(f.controller.apply()).toBe(true); await flush();
    expect(f.controller.apply()).toBe(false); expect(f.preferences.set).toHaveBeenCalledTimes(2);
    expect(parseGlobeComposition(f.memory.get(key))?.selection).toEqual(combined.displayed);
    expect(f.controller.getSnapshot().editor).toBe("background");
  });

  it("keeps pending receipts and the original deadline when switching appearance tabs", async () => {
    vi.useFakeTimers(); const f = fixture(); activate(f.controller); await flush();
    const pending = draftCombination(f.controller);
    expect(f.controller.acknowledgePartRendered("stand", pending.renderRevision, pending.displayed.standId)).toBe(true);
    await vi.advanceTimersByTimeAsync(PLANET_COMPOSITION_PREVIEW_TIMEOUT_MS - 1);
    expect(f.controller.open("stand")).toBe(true);
    expect(f.controller.getSnapshot()).toEqual({ ...pending, editor: "stand" });
    expect(f.controller.acknowledgePartRendered("edition", pending.renderRevision, pending.displayed.editionId)).toBe(true);
    expect(f.controller.acknowledgePartRendered("background", pending.renderRevision, pending.displayed.backgroundId)).toBe(true);
    expect(f.controller.acknowledgeRendered(pending.renderRevision, pending.displayed)).toBe(true);
    expect(f.controller.apply()).toBe(true); await flush();
    expect(parseGlobeComposition(f.memory.get(key))?.selection).toEqual(pending.displayed);

    const next = draftCombination(f.controller, "stand.base.museum", "background.base.writer-study");
    await vi.advanceTimersByTimeAsync(PLANET_COMPOSITION_PREVIEW_TIMEOUT_MS - 1);
    expect(f.controller.open("stand")).toBe(true); expect(f.controller.apply()).toBe(false);
    expect(f.controller.getSnapshot().renderRevision).toBe(next.renderRevision);
    await vi.advanceTimersByTimeAsync(1);
    expect(f.controller.getSnapshot()).toMatchObject({ displayed: pending.displayed, applied: pending.displayed,
      editor: "stand", phase: "error", reason: "preview-timeout" });
    expect(f.controller.acknowledgeRendered(next.renderRevision, next.displayed)).toBe(false);
    expect(f.preferences.set).toHaveBeenCalledTimes(1);
  });

  it("requires fresh whole-combination receipts after a new choice and leaves rejected requests untouched", async () => {
    let access = "adult";
    const f = fixture({ getEnvironment: () => ({ qualityTier: "high", access }) }); activate(f.controller); await flush();
    draftCombination(f.controller); const older = parts(f.controller);
    expect(f.controller.open("stand")).toBe(true);
    expect(f.controller.preview("stand", "stand.base.museum")).toBe(true);
    const latest = f.controller.getSnapshot();
    expect(latest.displayed).toEqual(selection({ standId: "stand.base.museum", backgroundId: "background.base.library" }));
    expect(f.controller.acknowledgeRendered(older.revision, older.displayed)).toBe(false);
    expect(f.controller.acknowledgePartRendered("background", older.revision, older.displayed.backgroundId)).toBe(false);
    expect(f.controller.failRendering(older.revision)).toBe(false);
    expect(f.controller.acknowledgePartRendered("stand", latest.renderRevision, latest.displayed.standId)).toBe(true);
    expect(f.controller.acknowledgeRendered(latest.renderRevision, latest.displayed)).toBe(false);
    expect(f.controller.preview("stand", "stand.unknown")).toBe(false);
    expect(f.controller.preview("background", "background.base.writer-study")).toBe(false);
    expect(f.controller.getSnapshot()).toBe(latest);
    access = "blocked";
    expect(f.controller.open("background")).toBe(false);
    expect(f.controller.preview("stand", "stand.base.wood")).toBe(false);
    expect(f.controller.apply()).toBe(false); expect(f.controller.getSnapshot()).toBe(latest);
    access = "adult";
    expect(f.controller.acknowledgePartRendered("edition", latest.renderRevision, latest.displayed.editionId)).toBe(true);
    expect(f.controller.acknowledgePartRendered("background", latest.renderRevision, latest.displayed.backgroundId)).toBe(true);
    expect(f.controller.acknowledgeRendered(latest.renderRevision, latest.displayed)).toBe(true);
    expect(f.controller.open("background")).toBe(true);
    expect(f.controller.getSnapshot()).toMatchObject({ displayed: latest.displayed, phase: "preview", renderRevision: latest.renderRevision });
    expect(f.preferences.set).not.toHaveBeenCalled();
  });

  it("opening an editor fences an unfinished restore or immediate edition change", async () => {
    for (const operation of ["restore", "edition"] as const) {
      const f = fixture();
      if (operation === "restore") f.memory.set(key, raw(selection({ editionId: "nasa-blue-marble", standId: "stand.base.wood", backgroundId: "background.base.library" })));
      activate(f.controller); await flush();
      if (operation === "edition") expect(f.controller.requestEdition("nasa-blue-marble")).toBe(true);
      const obsolete = parts(f.controller);
      expect(f.controller.open("background")).toBe(true);
      expect(f.controller.getSnapshot()).toMatchObject({ applied: defaults, displayed: defaults, editor: "background", phase: "idle" });
      expect(f.controller.acknowledgeRendered(obsolete.revision, obsolete.displayed)).toBe(false);
      expect(f.controller.acknowledgePartRendered("edition", obsolete.revision, obsolete.displayed.editionId)).toBe(false);
      draftCombination(f.controller); frame(f.controller);
      expect(f.controller.getSnapshot().displayed).toEqual(selection({ standId: "stand.base.book-stack", backgroundId: "background.base.library" }));
      expect(f.preferences.set).not.toHaveBeenCalled();
    }
  });

  it("rolls back all displayed fields on cancel, render failure and deadline without saving the draft", async () => {
    vi.useFakeTimers(); const f = fixture(); activate(f.controller); await flush();
    draftCombination(f.controller, "stand.base.wood", "background.base.writer-study");
    frame(f.controller); expect(f.controller.apply()).toBe(true); await flush();
    const applied = f.controller.getSnapshot().applied;
    draftCombination(f.controller);
    const old = f.controller.getSnapshot().renderRevision; f.controller.cancel();
    expect(f.controller.acknowledgePartRendered("background", old, "background.base.library")).toBe(false);
    expect(f.controller.getSnapshot()).toMatchObject({ applied, displayed: applied, editor: null });
    draftCombination(f.controller);
    expect(f.controller.failRendering(f.controller.getSnapshot().renderRevision)).toBe(true);
    expect(f.controller.getSnapshot()).toMatchObject({ displayed: applied, phase: "error", reason: "render-failed" });
    draftCombination(f.controller);
    await vi.advanceTimersByTimeAsync(PLANET_COMPOSITION_PREVIEW_TIMEOUT_MS + 1);
    expect(f.controller.getSnapshot()).toMatchObject({ displayed: applied, phase: "error", reason: "preview-timeout" });
    draftCombination(f.controller); frame(f.controller);
    f.controller.setVisibility(false);
    expect(f.controller.getSnapshot()).toMatchObject({ displayed: applied, applied, phase: "idle", editor: null });
    expect(f.controller.open("stand")).toBe(false); expect(f.controller.preview("background", "background.base.writer-study")).toBe(false);
    f.controller.setVisibility(true); frame(f.controller);
    expect(f.controller.getSnapshot()).toMatchObject({ displayed: applied, applied, editor: null });
    expect(f.preferences.set).toHaveBeenCalledTimes(1);
  });

  it("requires new receipts after an environment change and preserves preview instead of applying it", async () => {
    let qualityTier = "high", access = "adult";
    const f = fixture({ getEnvironment: () => ({ qualityTier, access }) }); activate(f.controller); await flush();
    draftCombination(f.controller, "stand.base.wood"); frame(f.controller);
    const old = f.controller.getSnapshot(); qualityTier = "economy"; f.controller.refreshEnvironment();
    expect(f.controller.getSnapshot()).toMatchObject({ editor: "background", displayed: old.displayed, applied: defaults, phase: "preparing" });
    expect(f.controller.acknowledgeRendered(old.renderRevision, old.displayed)).toBe(false);
    expect(f.controller.acknowledgePartRendered("stand", old.renderRevision, old.displayed.standId)).toBe(false);
    expect(f.controller.acknowledgeRendered(f.controller.getSnapshot().renderRevision, old.displayed)).toBe(false);
    frame(f.controller); expect(f.controller.getSnapshot().phase).toBe("preview"); expect(f.preferences.set).not.toHaveBeenCalled();
    f.controller.apply(); await flush(); f.controller.refreshEnvironment(); frame(f.controller); await flush();
    expect(f.preferences.set).toHaveBeenCalledTimes(1);
    draftCombination(f.controller, "stand.base.museum", "background.base.writer-study");
    access = "blocked"; f.controller.refreshEnvironment();
    expect(f.controller.getSnapshot()).toMatchObject({ applied: old.displayed, displayed: old.displayed, phase: "error", reason: "incompatible", editor: null });
    expect(f.controller.open("stand")).toBe(false);
  });

  it("retains the applied composition after failed persistence and retries only that whole selection", async () => {
    const f = fixture(); f.preferences.set.mockResolvedValueOnce(false); activate(f.controller); await flush();
    const applied = draftCombination(f.controller, "stand.base.wood").displayed;
    frame(f.controller); expect(f.controller.apply()).toBe(true); await flush();
    expect(f.controller.getSnapshot()).toMatchObject({ applied, saveState: "failed" });
    const draft = draftCombination(f.controller, "stand.base.book-stack", "background.base.writer-study");
    expect(f.controller.retrySave()).toBe(true); await flush();
    const saved = parseGlobeComposition(f.memory.get(key))!;
    expect(saved.selection).toEqual(applied);
    expect(f.controller.getSnapshot()).toMatchObject({ displayed: draft.displayed, applied, saveState: "idle" });
  });

  it("never lets a newer queued write overtake timed-out native IO, including remount hydration", async () => {
    vi.useFakeTimers(); const f = fixture(), held = deferred<boolean>();
    f.preferences.set.mockImplementationOnce(async (name, value) => {
      const saved = await held.promise; if (saved) f.memory.set(name, value); return saved;
    });
    const stop = activate(f.controller); await flush(); applyStand(f.controller, "stand.base.wood"); await flush();
    await vi.advanceTimersByTimeAsync(PLANET_COMPOSITION_CONFIRMATION_TIMEOUT_MS + 1);
    expect(f.controller.getSnapshot().saveState).toBe("failed");
    applyStand(f.controller, "stand.base.book-stack"); await flush();
    expect(f.preferences.set).toHaveBeenCalledTimes(1); stop();
    const next = createPlanetCompositionController({ preferences: f.preferences, enabled: true, access: "adult" });
    const reads = f.preferences.get.mock.calls.length; activate(next); await flush(); expect(f.preferences.get).toHaveBeenCalledTimes(reads);
    held.resolve(true); await flush();
    expect(f.preferences.set).toHaveBeenCalledTimes(2);
    expect(next.getSnapshot()).toMatchObject({ phase: "preparing", displayed: selection({ standId: "stand.base.book-stack" }) });
    frame(next); expect(next.getSnapshot().applied.standId).toBe("stand.base.book-stack");
  });

  it("drops superseded unstarted writes and ignores an older failure after a newer successful commit", async () => {
    const f = fixture(), held = deferred<boolean>(); f.preferences.set.mockReturnValueOnce(held.promise);
    activate(f.controller); await flush(); applyStand(f.controller, "stand.base.museum"); await flush();
    applyStand(f.controller, "stand.base.wood"); applyStand(f.controller, "stand.base.book-stack"); await flush();
    held.resolve(false); await flush();
    expect(f.preferences.set).toHaveBeenCalledTimes(2);
    expect(parseGlobeComposition(f.memory.get(key))?.selection.standId).toBe("stand.base.book-stack");
    expect(f.controller.getSnapshot()).toMatchObject({ saveState: "idle", applied: selection({ standId: "stand.base.book-stack" }) });
  });

  it("suspends untouched hydration while hidden and rejects its late result after foreground retry", async () => {
    const f = fixture(), held = deferred<string | null>(); f.preferences.get.mockReturnValueOnce(held.promise);
    activate(f.controller); await flush(); f.controller.setVisibility(false);
    expect(f.controller.open("stand")).toBe(false); expect(f.controller.requestEdition("nasa-blue-marble")).toBe(false);
    f.memory.set(key, raw(selection({ standId: "stand.base.museum" }))); f.controller.setVisibility(true); await flush();
    const current = f.controller.getSnapshot();
    held.resolve(raw(selection({ backgroundId: "background.base.library" }))); await flush();
    expect(f.controller.getSnapshot()).toBe(current); frame(f.controller);
    expect(f.controller.getSnapshot().applied.standId).toBe("stand.base.museum"); expect(f.preferences.set).not.toHaveBeenCalled();
  });

  it("pauses restoring frame deadlines but cancels explicit pending edition on background", async () => {
    vi.useFakeTimers(); const f = fixture(); f.memory.set(key, raw(selection({ standId: "stand.base.wood" })));
    activate(f.controller); await flush(); const old = parts(f.controller); f.controller.setVisibility(false);
    await vi.advanceTimersByTimeAsync(PLANET_COMPOSITION_PREVIEW_TIMEOUT_MS * 2);
    expect(f.controller.getSnapshot().reason).toBeNull(); f.controller.setVisibility(true); await flush();
    expect(f.controller.acknowledgeRendered(old.revision, old.displayed)).toBe(false); frame(f.controller);
    f.controller.requestEdition("nasa-blue-marble"); const pending = parts(f.controller); f.controller.setVisibility(false); f.controller.setVisibility(true);
    expect(f.controller.acknowledgeRendered(pending.revision, pending.displayed)).toBe(false);
    expect(f.controller.getSnapshot().displayed).toEqual(selection({ standId: "stand.base.wood" })); frame(f.controller);
    expect(f.preferences.set).not.toHaveBeenCalled();
  });

  it("survives StrictMode cleanup/reactivation without duplicate committed writes or stale frame acknowledgement", async () => {
    const f = fixture(), held = deferred<boolean>(); f.preferences.set.mockReturnValueOnce(held.promise);
    let stop = activate(f.controller); await flush(); applyStand(f.controller); await flush(); stop();
    stop = activate(f.controller); await flush(); expect(f.preferences.set).toHaveBeenCalledTimes(1);
    held.resolve(true); await flush(); expect(f.controller.getSnapshot().saveState).toBe("idle");
    draftCombination(f.controller); const old = parts(f.controller);
    stop(); activate(f.controller);
    expect(f.controller.acknowledgeRendered(old.revision, old.displayed)).toBe(false);
    expect(f.controller.getSnapshot()).toMatchObject({ displayed: selection({ standId: "stand.base.wood" }), editor: null });
  });

  it("registers ownership before notifications so reentrant cancel cannot authorize the obsolete composition", async () => {
    const f = fixture(); activate(f.controller); await flush();
    const snapshots: ReturnType<PlanetCompositionController["getSnapshot"]>[] = [];
    const unsubscribe = f.controller.subscribe(() => {
      const current = f.controller.getSnapshot(); snapshots.push(current);
      if (current.phase === "preparing") f.controller.cancel();
    });
    f.controller.requestEdition("nasa-blue-marble"); unsubscribe();
    const obsolete = snapshots.find(item => item.phase === "preparing")!;
    expect(f.controller.acknowledgePartRendered("edition", obsolete.renderRevision, obsolete.displayed.editionId)).toBe(false);
    expect(f.controller.getSnapshot()).toMatchObject({ applied: defaults, displayed: defaults, phase: "idle" });
    expect(Object.isFrozen(f.controller.getSnapshot())).toBe(true); expect(Object.isFrozen(f.controller.getSnapshot().displayed)).toBe(true);
    expect(f.preferences.set).not.toHaveBeenCalled();
  });
});
