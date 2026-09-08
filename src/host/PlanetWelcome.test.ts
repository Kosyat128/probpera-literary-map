import { describe, expect, it, vi } from "vitest";
import type { PreferenceStore } from "../platform/ports";
import {
  createPlanetWelcomeSession, PLANET_WELCOME_COMPLETED_VALUE, PLANET_WELCOME_PREFERENCE_KEY,
  type PlanetWelcomeMemory, type PlanetWelcomeSession,
} from "./PlanetWelcome";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };
function fixture(overrides: Partial<PreferenceStore> = {}, shared?: PlanetWelcomeMemory) {
  const read = deferred<string | null>();
  const preferences: PreferenceStore = {
    persistence: "best-effort", get: vi.fn(() => read.promise), set: vi.fn(async () => true), remove: vi.fn(async () => true), ...overrides,
  };
  const memory = shared ?? { suppressed: false, eligibilityObserved: false };
  const visible = vi.fn<(value: boolean) => void>();
  const create = (ready = true, eligible = true) => createPlanetWelcomeSession({ preferences, memory, ready, eligible, onVisibilityChange: visible });
  return { read, preferences, memory, visible, create };
}

describe("first-journey view session", () => {
  it("starts hidden and suppresses a late first read after navigation before scene readiness", async () => {
    const f = fixture(); const session = f.create(false, true);
    expect(f.visible).not.toHaveBeenCalled();
    session.setAvailability(false, false);
    f.read.resolve(null); await flush();
    session.setAvailability(true, true);
    expect(f.visible).not.toHaveBeenCalled();
    expect(f.preferences.set).not.toHaveBeenCalled();
    session.dispose();
  });

  it("allows an initially ineligible bootstrap to become eligible, then never reopens after its loss", async () => {
    const f = fixture(); const session = f.create(false, false);
    f.read.resolve(null); await flush();
    session.setAvailability(true, true);
    expect(f.visible.mock.calls).toEqual([[true]]);
    session.setAvailability(true, false);
    session.setAvailability(true, true);
    expect(f.visible.mock.calls).toEqual([[true], [false]]);
    session.dispose();
  });

  it("isolates StrictMode replay and replacement stores from a previous pending read", async () => {
    const memory = { suppressed: false, eligibilityObserved: false };
    const old = fixture({}, memory); const first = old.create();
    await flush(); first.dispose();
    const current = fixture({}, memory); const second = current.create();
    current.read.resolve(PLANET_WELCOME_COMPLETED_VALUE); await flush();
    old.read.resolve(null); await flush();
    expect(old.visible).not.toHaveBeenCalled();
    expect(current.visible).not.toHaveBeenCalled();
    expect(old.preferences.set).not.toHaveBeenCalled();
    expect(current.preferences.set).not.toHaveBeenCalled();
    second.dispose();
  });

  it("runs the chosen action synchronously once, before persistence, despite reentrancy and failed saving", async () => {
    const saved = deferred<boolean>();
    const events: string[] = [];
    const f = fixture({ set: vi.fn(() => { events.push("write"); return saved.promise; }) });
    let session!: PlanetWelcomeSession;
    const action = vi.fn(() => { events.push("action"); session.complete(action); });
    session = createPlanetWelcomeSession({ preferences: f.preferences, memory: f.memory, ready: true, eligible: true,
      onVisibilityChange: visible => { events.push(visible ? "show" : "hide"); if (!visible) session.complete(action); },
    });
    f.read.resolve(null); await flush();
    expect(session.complete(action)).toBe(true);
    expect(session.complete(action)).toBe(false);
    expect(events).toEqual(["show", "hide", "action"]);
    await flush(); saved.resolve(false); await flush();
    expect(events).toEqual(["show", "hide", "action", "write"]);
    expect(action).toHaveBeenCalledTimes(1);
    expect(f.preferences.set).toHaveBeenCalledExactlyOnceWith(PLANET_WELCOME_PREFERENCE_KEY, PLANET_WELCOME_COMPLETED_VALUE);
    session.setAvailability(true, true);
    expect(events.filter(x => x === "show")).toHaveLength(1);
    session.dispose();
  });

  it("keeps read/write rejection best-effort and dismissal immediate through a later store replacement", async () => {
    const f = fixture({ set: vi.fn(async () => { throw new Error("storage unavailable"); }) });
    const session = f.create(); f.read.reject(new Error("read unavailable")); await flush();
    expect(f.visible.mock.calls).toEqual([[true]]);
    expect(session.complete()).toBe(true);
    expect(f.visible.mock.calls).toEqual([[true], [false]]);
    await flush(); session.dispose();
    const replacement = fixture({}, f.memory); const next = replacement.create();
    replacement.read.resolve(null); await flush();
    expect(replacement.visible).not.toHaveBeenCalled();
    next.dispose();
  });

  it("does not announce, navigate or save after unmount with a pending preference read", async () => {
    const f = fixture(); const session = f.create(); const action = vi.fn();
    await flush(); session.dispose(); f.read.resolve(null); await flush();
    session.setAvailability(true, true);
    expect(session.complete(action)).toBe(false);
    expect(f.visible).not.toHaveBeenCalled(); expect(action).not.toHaveBeenCalled();
    expect(f.preferences.set).not.toHaveBeenCalled();
  });
});
