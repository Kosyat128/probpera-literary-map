import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PreferenceStore } from "../platform/ports";
import { contentTextHash } from "../planet/contentExportHash";
import type { BookyJourneyRuntime, BookyJourneyProgressIntent } from "./bookyJourneyRuntime";
import { BOOKY_JOURNEY_PROGRESS_KEY, DEFAULT_BOOKY_JOURNEY_PROGRESS, parseBookyJourneyProgress,
  serializeBookyJourneyProgress, type BookyJourneyProgressPreference, type BookyJourneyProgressNode } from "./bookyJourneyProgress";
import { createBookyJourneyProgressStore } from "./bookyJourneyProgressStore";
import { createBookyJourneyPersistence } from "./bookyJourneyPersistence";

function progress(acknowledged = 0, revision = 4): BookyJourneyProgressPreference {
  const policyFingerprint = "a".repeat(64), journeyId = "binding-fixture";
  const recordId = contentTextHash(JSON.stringify([policyFingerprint, journeyId, 1]));
  const nodes: BookyJourneyProgressNode[] = [
    { id: "country", kind: "country", screen: "globe", entity: { kind: "country", countryId: "fixture-country" } },
    { id: "checkpoint", kind: "checkpoint", screen: "globe", entity: null },
  ];
  return { schemaVersion: 1, audience: "adult", revision, activeRecordId: recordId, records: [{
    recordId, policyFingerprint, journeyId, journeyVersion: 1, locale: "en", definitionChecksum: "b".repeat(64),
    nodes, acknowledgedNodeIds: nodes.slice(0, acknowledged).map(node => node.id), resumeNodeId: nodes[acknowledged]?.id ?? null,
  }] };
}
const encode = (value: BookyJourneyProgressPreference) => serializeBookyJourneyProgress(value)!;
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(yes => { resolve = yes; });
  return { promise, resolve };
}
async function flush() { for (let turn = 0; turn < 48; ++turn) await Promise.resolve(); }
/** Only the runtime's semantic intent interface is stubbed. Storage and its
 * queue, readback, deadlines and lifecycle are the real implementation. */
function runtimeFixture() {
  let intent: BookyJourneyProgressIntent = Object.freeze({ revision: 0, preference: DEFAULT_BOOKY_JOURNEY_PROGRESS });
  const listeners = new Set<() => void>();
  const present = () => { for (const listener of [...listeners]) if (listeners.has(listener)) listener(); };
  const restoreProgress = vi.fn((preference: BookyJourneyProgressPreference, revision: number) => {
    if (revision !== intent.revision) return false;
    const parsed = parseBookyJourneyProgress(preference); if (!parsed) return false;
    intent = Object.freeze({ revision: intent.revision, preference: parsed }); present(); return true;
  });
  const runtime = {
    getProgressIntent: () => intent,
    restoreProgress,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  } as unknown as BookyJourneyRuntime;
  function gesture(preference: BookyJourneyProgressPreference) {
    const parsed = parseBookyJourneyProgress(preference); if (!parsed) throw new Error("invalid-semantic-test-intent");
    intent = Object.freeze({ revision: intent.revision + 1, preference: parsed }); present();
  }
  return { runtime, gesture, present, restoreProgress };
}
function fixture(raw: string | null = null) {
  const memory = new Map<string, string>([["unrelated", "preserve"]]);
  if (raw !== null) memory.set(BOOKY_JOURNEY_PROGRESS_KEY, raw);
  const preferences = {
    persistence: "best-effort" as const,
    get: vi.fn<PreferenceStore["get"]>(async key => memory.get(key) ?? null),
    set: vi.fn<PreferenceStore["set"]>(async (key, value) => { memory.set(key, value); return true; }),
    remove: vi.fn<PreferenceStore["remove"]>(async key => { memory.delete(key); return true; }),
  };
  const store = createBookyJourneyProgressStore({ preferences, confirmationTimeoutMs: 100 });
  const runtime = runtimeFixture(), binding = createBookyJourneyPersistence(runtime.runtime, store);
  return { memory, preferences, store, binding, ...runtime };
}
const clear = (f: ReturnType<typeof fixture>) => f.binding.clear(f.binding.getSnapshot().revision, f.runtime.getProgressIntent().revision);

describe("Booky journey persistence binding", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("keeps actions closed until authoritative hydration without constructor IO", async () => {
    const f = fixture(), read = deferred<string | null>(); f.preferences.get.mockReturnValueOnce(read.promise);
    expect(f.preferences.get).not.toHaveBeenCalled(); expect(f.binding.retry()).toBe(false); expect(clear(f)).toBe(false);
    f.binding.start(); await flush();
    expect(f.binding.getSnapshot()).toMatchObject({ canAct: false, unsaved: false, clearing: false, storage: { state: "loading" } });
    expect(f.restoreProgress).not.toHaveBeenCalled(); read.resolve(encode(progress(1))); await flush();
    expect(f.restoreProgress).toHaveBeenCalledExactlyOnceWith(progress(1), 0);
    expect(f.binding.getSnapshot()).toMatchObject({ canAct: true, unsaved: false, clearing: false });
    expect(Object.isFrozen(f.binding.getSnapshot())).toBe(true);
    expect(f.preferences.set).not.toHaveBeenCalled(); expect(f.preferences.remove).not.toHaveBeenCalled(); f.binding.stop();
  });

  it("does not write or advance progress for presentation changes or lifecycle hydration", async () => {
    const initial = progress(1), f = fixture(encode(initial)); f.binding.start(); await flush();
    for (let change = 0; change < 6; ++change) f.present();
    const before = f.binding.getSnapshot(); f.binding.start(); expect(f.binding.getSnapshot()).toBe(before);
    f.binding.stop(); expect(f.binding.getSnapshot().canAct).toBe(false); f.binding.start(); await flush();
    f.present(); expect(f.runtime.getProgressIntent()).toEqual({ revision: 0, preference: initial });
    expect(f.preferences.set).not.toHaveBeenCalled(); expect(f.preferences.remove).not.toHaveBeenCalled();
    expect(f.restoreProgress).toHaveBeenCalledTimes(2); f.binding.stop();
  });

  it("keeps accepted intent unsaved until readback and never restores over the live runtime on acknowledgement", async () => {
    const f = fixture(encode(progress())), write = deferred<boolean>(); f.binding.start(); await flush();
    f.preferences.set.mockImplementationOnce(async (key, value) => { await write.promise; f.memory.set(key, value); return true; });
    f.gesture(progress(1)); await flush();
    expect(f.binding.getSnapshot()).toMatchObject({ canAct: true, unsaved: true, storage: { state: "saving", preference: null } });
    write.resolve(true); await flush();
    expect(f.binding.getSnapshot()).toMatchObject({ canAct: true, unsaved: false, storage: { state: "ready", preference: progress(1, 5) } });
    expect(f.restoreProgress).toHaveBeenCalledOnce(); expect(f.runtime.getProgressIntent().revision).toBe(1); f.binding.stop();
  });

  it("allows local continuation after a write failure and saves the next explicit gesture", async () => {
    const f = fixture(encode(progress())); f.binding.start(); await flush(); f.preferences.set.mockResolvedValueOnce(false);
    f.gesture(progress(1)); await flush();
    expect(f.binding.getSnapshot()).toMatchObject({ canAct: true, unsaved: true, storage: { state: "failed", error: "write" } });
    f.present(); expect(f.preferences.set).toHaveBeenCalledOnce(); f.gesture(progress(2)); await flush();
    expect(f.preferences.set).toHaveBeenCalledTimes(2);
    expect(f.binding.getSnapshot()).toMatchObject({ canAct: true, unsaved: false, storage: { preference: progress(2, 6) } });
    expect(f.restoreProgress).toHaveBeenCalledOnce(); f.binding.stop();
  });

  it("retains failed save intent and usable local progress across stop/start until explicit retry", async () => {
    const f = fixture(encode(progress())); f.binding.start(); await flush(); f.preferences.set.mockResolvedValueOnce(false);
    f.gesture(progress(1)); await flush(); const bytes = f.preferences.set.mock.calls[0][1];
    f.binding.stop(); f.binding.start(); await flush();
    expect(f.binding.getSnapshot()).toMatchObject({ canAct: true, unsaved: true, storage: { state: "failed", error: "write" } });
    expect(f.runtime.getProgressIntent().preference).toEqual(progress(1)); expect(f.preferences.set).toHaveBeenCalledOnce();
    expect(f.binding.retry()).toBe(true); await flush(); expect(f.preferences.set.mock.calls[1][1]).toBe(bytes);
    expect(f.binding.getSnapshot()).toMatchObject({ canAct: true, unsaved: false, storage: { state: "ready" } }); f.binding.stop();
  });

  it("preserves a newer gesture through a late first hydration and requires an explicit retry to save it", async () => {
    const f = fixture(), read = deferred<string | null>(); f.preferences.get.mockReturnValueOnce(read.promise);
    f.binding.start(); await flush(); f.gesture(progress(1));
    expect(f.binding.getSnapshot()).toMatchObject({ canAct: false, unsaved: true });
    f.memory.set(BOOKY_JOURNEY_PROGRESS_KEY, encode(progress())); read.resolve(encode(progress())); await flush();
    expect(f.runtime.getProgressIntent().preference).toEqual(progress(1)); expect(f.restoreProgress).not.toHaveBeenCalled();
    expect(f.binding.getSnapshot()).toMatchObject({ canAct: true, unsaved: true }); expect(f.preferences.set).not.toHaveBeenCalled();
    expect(f.binding.retry()).toBe(true); await flush(); expect(f.preferences.set).toHaveBeenCalledOnce();
    expect(f.binding.getSnapshot()).toMatchObject({ canAct: true, unsaved: false, storage: { preference: progress(1, 5) } }); f.binding.stop();
  });

  it("observes semantic intent changed while stopped without replacing it from storage or auto-saving it", async () => {
    const f = fixture(encode(progress(1))); f.binding.start(); await flush(); f.binding.stop();
    f.gesture(progress(2)); expect(f.preferences.set).not.toHaveBeenCalled(); f.binding.start(); await flush();
    expect(f.binding.getSnapshot()).toMatchObject({ canAct: true, unsaved: true });
    expect(f.runtime.getProgressIntent().preference).toEqual(progress(2)); expect(f.restoreProgress).toHaveBeenCalledOnce();
    expect(f.preferences.set).not.toHaveBeenCalled(); f.binding.retry(); await flush();
    expect(f.binding.getSnapshot()).toMatchObject({ unsaved: false, storage: { preference: progress(2, 5) } }); f.binding.stop();
  });

  it("recognizes an exact submitted write confirmed while stopped without replaying or restoring it", async () => {
    const f = fixture(), write = deferred<boolean>(); f.binding.start(); await flush();
    f.preferences.set.mockImplementationOnce(async (key, value) => { await write.promise; f.memory.set(key, value); return true; });
    f.gesture(progress(1)); await flush(); f.binding.stop(); write.resolve(true); await flush();
    f.binding.start(); await flush(); expect(f.binding.getSnapshot()).toMatchObject({ canAct: true, unsaved: false });
    expect(f.preferences.set).toHaveBeenCalledOnce(); expect(f.restoreProgress).toHaveBeenCalledOnce(); f.binding.stop();
  });

  it("does not mark an unconfirmed local intent saved merely because remount reads a different supported preference", async () => {
    const f = fixture(), write = deferred<boolean>(); f.binding.start(); await flush();
    f.preferences.set.mockImplementationOnce(async (key, value) => { await write.promise; f.memory.set(key, value); return true; });
    f.gesture(progress(1)); await flush(); f.binding.stop(); write.resolve(true); await flush();
    f.memory.set(BOOKY_JOURNEY_PROGRESS_KEY, encode(progress(2, 40))); f.binding.start(); await flush();
    expect(f.binding.getSnapshot()).toMatchObject({ canAct: true, unsaved: true });
    expect(f.runtime.getProgressIntent().preference).toEqual(progress(1)); f.binding.retry(); await flush();
    expect(f.binding.getSnapshot()).toMatchObject({ unsaved: false, storage: { preference: progress(1, 41) } }); f.binding.stop();
  });

  it("rejects reset consent when either the binding or semantic intent revision has changed", async () => {
    const f = fixture(encode(progress(1))); f.binding.start(); await flush();
    const snapshot = f.binding.getSnapshot(), intent = f.runtime.getProgressIntent();
    expect(f.binding.clear(snapshot.revision - 1, intent.revision)).toBe(false);
    expect(f.binding.clear(snapshot.revision, intent.revision + 1)).toBe(false);
    expect(f.preferences.remove).not.toHaveBeenCalled(); expect(clear(f)).toBe(true); await flush();
    expect(f.runtime.getProgressIntent().preference).toEqual(DEFAULT_BOOKY_JOURNEY_PROGRESS);
    expect(f.binding.getSnapshot()).toMatchObject({ canAct: true, clearing: false, unsaved: false }); f.binding.stop();
  });

  it("clears an unsupported preference only after explicit confirmation and restores empty semantic data", async () => {
    const future = '{"schemaVersion":3,"future":true}', f = fixture(future); f.binding.start(); await flush();
    expect(f.binding.getSnapshot()).toMatchObject({ canAct: false, storage: { state: "failed", error: "unsupported" } });
    f.binding.retry(); await flush(); expect(f.memory.get(BOOKY_JOURNEY_PROGRESS_KEY)).toBe(future);
    expect(f.preferences.remove).not.toHaveBeenCalled(); clear(f);
    expect(f.binding.getSnapshot()).toMatchObject({ canAct: false, clearing: true }); await flush();
    expect(f.binding.getSnapshot()).toMatchObject({ canAct: true, clearing: false, unsaved: false });
    expect(f.runtime.getProgressIntent().preference).toEqual(DEFAULT_BOOKY_JOURNEY_PROGRESS);
    expect(f.memory.get("unrelated")).toBe("preserve"); expect(f.preferences.set).not.toHaveBeenCalled(); f.binding.stop();
  });

  it("keeps deletion locked through failure and remount, then retries deletion without saving the old checkpoint", async () => {
    const f = fixture(encode(progress(1))); f.binding.start(); await flush(); f.preferences.remove.mockResolvedValueOnce(false);
    clear(f); await flush();
    expect(f.binding.getSnapshot()).toMatchObject({ canAct: false, clearing: true, storage: { state: "failed", error: "write" } });
    f.binding.stop(); f.binding.start(); await flush();
    expect(f.binding.getSnapshot()).toMatchObject({ canAct: false, clearing: true, storage: { state: "failed", error: "write" } });
    expect(f.preferences.remove).toHaveBeenCalledOnce(); expect(f.binding.retry()).toBe(true); await flush();
    expect(f.preferences.remove).toHaveBeenCalledTimes(2); expect(f.preferences.set).not.toHaveBeenCalled();
    expect(f.binding.getSnapshot()).toMatchObject({ canAct: true, clearing: false, unsaved: false });
    expect(f.runtime.getProgressIntent().preference).toEqual(DEFAULT_BOOKY_JOURNEY_PROGRESS); f.binding.stop();
  });

  it("cancels stale consent if an observer advances semantic intent while clear is announced", async () => {
    const f = fixture(encode(progress())); f.binding.start(); await flush(); let changed = false;
    f.binding.subscribe(() => {
      if (f.binding.getSnapshot().clearing && !changed) { changed = true; f.gesture(progress(1)); }
    });
    expect(clear(f)).toBe(false); await flush(); expect(f.preferences.remove).not.toHaveBeenCalled();
    expect(f.preferences.set).not.toHaveBeenCalled(); expect(f.runtime.getProgressIntent().preference).toEqual(progress(1));
    expect(f.binding.getSnapshot()).toMatchObject({ canAct: true, clearing: false, unsaved: true }); f.binding.stop();
  });

  it("does not erase a newer local gesture when already-started deletion confirms", async () => {
    const f = fixture(encode(progress())), remove = deferred<boolean>(); f.binding.start(); await flush();
    f.preferences.remove.mockImplementationOnce(async key => { await remove.promise; f.memory.delete(key); return true; });
    clear(f); await flush(); f.gesture(progress(1)); remove.resolve(true); await flush();
    expect(f.binding.getSnapshot()).toMatchObject({ canAct: true, clearing: false, unsaved: true });
    expect(f.runtime.getProgressIntent().preference).toEqual(progress(1)); expect(f.preferences.set).not.toHaveBeenCalled();
    expect(f.binding.retry()).toBe(true); await flush();
    expect(f.binding.getSnapshot()).toMatchObject({ unsaved: false, storage: { preference: progress(1, 1) } }); f.binding.stop();
  });

  it("does not issue deletion after an observer stops the binding during confirmation publication", async () => {
    const f = fixture(encode(progress(1))); f.binding.start(); await flush();
    const unsubscribe = f.binding.subscribe(() => { if (f.binding.getSnapshot().clearing) f.binding.stop(); });
    expect(clear(f)).toBe(false); await flush(); expect(f.preferences.remove).not.toHaveBeenCalled();
    expect(f.binding.getSnapshot()).toMatchObject({ canAct: false, clearing: false, storage: { state: "idle" } });
    unsubscribe(); f.binding.start(); await flush(); expect(f.runtime.getProgressIntent().preference).toEqual(progress(1)); f.binding.stop();
  });

  it("keeps actions closed while a confirmed clear waits behind an unabortable timed-out save", async () => {
    const f = fixture(), write = deferred<boolean>(); f.binding.start(); await flush();
    f.preferences.set.mockImplementationOnce(async (key, value) => { await write.promise; f.memory.set(key, value); return true; });
    f.gesture(progress(1)); await flush(); await vi.advanceTimersByTimeAsync(101);
    expect(f.binding.getSnapshot()).toMatchObject({ canAct: true, unsaved: true }); clear(f); await flush();
    expect(f.binding.getSnapshot()).toMatchObject({ canAct: false, clearing: true }); expect(f.preferences.remove).not.toHaveBeenCalled();
    write.resolve(true); await flush(); expect(f.preferences.remove).toHaveBeenCalledOnce();
    expect(f.binding.getSnapshot()).toMatchObject({ canAct: true, clearing: false, unsaved: false });
    expect(f.runtime.getProgressIntent().preference).toEqual(DEFAULT_BOOKY_JOURNEY_PROGRESS); f.binding.stop();
  });

  it("keeps read failures closed until explicit retry hydrates supported progress", async () => {
    const f = fixture(encode(progress(1))); f.preferences.get.mockRejectedValueOnce(new Error("read-unavailable"));
    f.binding.start(); await flush();
    expect(f.binding.getSnapshot()).toMatchObject({ canAct: false, storage: { state: "failed", error: "read" } });
    expect(f.restoreProgress).not.toHaveBeenCalled(); expect(f.binding.retry()).toBe(true); await flush();
    expect(f.binding.getSnapshot()).toMatchObject({ canAct: true, unsaved: false });
    expect(f.runtime.getProgressIntent().preference).toEqual(progress(1)); expect(f.preferences.set).not.toHaveBeenCalled(); f.binding.stop();
  });

  it("confirms only the latest semantic intent when a newer gesture queues behind a pending write", async () => {
    const f = fixture(), first = deferred<boolean>(); f.binding.start(); await flush();
    f.preferences.set.mockImplementationOnce(async (key, value) => { await first.promise; f.memory.set(key, value); return true; });
    f.gesture(progress(1)); await flush(); f.gesture(progress(2)); f.present();
    expect(f.binding.getSnapshot().unsaved).toBe(true); first.resolve(true); await flush();
    expect(f.preferences.set).toHaveBeenCalledTimes(2);
    expect(f.binding.getSnapshot()).toMatchObject({ unsaved: false, storage: { preference: progress(2, 2) } });
    expect(f.restoreProgress).toHaveBeenCalledOnce(); f.binding.stop();
  });

  it("keeps a rejected new save unsaved until explicit clear repairs exhausted storage", async () => {
    const f = fixture(encode(progress(0, Number.MAX_SAFE_INTEGER))); f.binding.start(); await flush(); f.gesture(progress(1));
    expect(f.binding.getSnapshot()).toMatchObject({ canAct: true, unsaved: true, storage: { state: "ready" } });
    expect(f.binding.retry()).toBe(false); expect(f.preferences.set).not.toHaveBeenCalled(); clear(f); await flush();
    expect(f.binding.getSnapshot()).toMatchObject({ canAct: true, unsaved: false, clearing: false }); f.binding.stop();
  });
});
