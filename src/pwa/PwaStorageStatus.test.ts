import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPwaStorageStatus, type PwaStorageStatusController } from "./PwaStorageStatus";

function deferred<T = unknown>() {
  let resolve!: (value: T) => void, reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
async function flush() { for (let turn = 0; turn < 8; turn++) await Promise.resolve(); }
const stops: (() => void)[] = [];
function activate(controller: PwaStorageStatusController) { const stop = controller.activate(); stops.push(stop); return stop; }
function fixture() {
  const storage = {
    estimate: vi.fn<() => unknown>(async () => ({ usage: 12_000, quota: 98_000 })),
    persisted: vi.fn<() => unknown>(async () => false),
    persist: vi.fn<() => unknown>(async () => false),
  };
  const getStorage = vi.fn<() => unknown>(() => storage);
  const controller = createPwaStorageStatus({ getStorage, timeoutMs: 100 });
  return { storage, getStorage, controller };
}
beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { for (const stop of stops.splice(0)) stop(); vi.clearAllTimers(); vi.useRealTimers(); });

describe("bounded PWA storage status", () => {
  it("performs no constructor IO, skips discarded StrictMode activation, and shares a live activation without prompting", async () => {
    const f = fixture(), initial = f.controller.getSnapshot();
    expect(Object.isFrozen(initial)).toBe(true); expect(f.getStorage).not.toHaveBeenCalled();
    activate(f.controller)();
    const first = activate(f.controller), second = activate(f.controller); await flush();
    expect(f.getStorage).toHaveBeenCalledOnce(); expect(f.storage.estimate).toHaveBeenCalledOnce();
    expect(f.storage.persisted).toHaveBeenCalledOnce(); expect(f.storage.persist).not.toHaveBeenCalled();
    expect(f.controller.getSnapshot()).toMatchObject({ busy: null, usage: 12_000, quota: 98_000, persisted: false, denied: false, error: false });
    const stable = f.controller.getSnapshot(), listener = vi.fn();
    const unsubscribe = f.controller.subscribe(listener); expect(f.controller.getSnapshot()).toBe(stable);
    first(); expect(f.controller.getSnapshot()).toBe(stable); expect(listener).not.toHaveBeenCalled();
    second(); unsubscribe(); expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["estimate", "persisted"] as const)("bounds hanging %s, keeps the other result, and lets an explicit refresh replace it", async hanging => {
    const f = fixture(), old = deferred(); f.storage[hanging].mockReturnValueOnce(old.promise);
    if (hanging === "estimate") f.storage.persisted.mockResolvedValueOnce(true);
    activate(f.controller); await flush(); expect(f.controller.getSnapshot().busy).toBe("estimate");
    await vi.advanceTimersByTimeAsync(100);
    expect(f.controller.getSnapshot()).toMatchObject(hanging === "estimate"
      ? { busy: null, usage: null, quota: null, persisted: true, canPersist: true, denied: false, error: true }
      : { busy: null, usage: 12_000, quota: 98_000, persisted: null, canPersist: true, denied: false, error: true });
    const timedOut = f.controller.getSnapshot();
    old.resolve(hanging === "estimate" ? { usage: 1, quota: 2 } : true); await flush();
    expect(f.controller.getSnapshot()).toBe(timedOut);
    f.storage.estimate.mockResolvedValue({ usage: 20, quota: 90 }); f.storage.persisted.mockResolvedValue(false);
    await f.controller.refresh();
    expect(f.controller.getSnapshot()).toMatchObject({ busy: null, usage: 20, quota: 90, persisted: false, denied: false, error: false });
    expect(f.storage.persist).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
  });

  it("invokes persistence in the caller's user stack with its original receiver and coalesces double clicks", async () => {
    const f = fixture(), choice = deferred(), receivers: unknown[] = []; let inUserHandler = false;
    f.storage.persist.mockImplementation(function(this: unknown) {
      receivers.push(this); expect(inUserHandler).toBe(true); return choice.promise;
    });
    activate(f.controller); await flush();
    inUserHandler = true;
    const first = f.controller.requestPersistence(), duplicate = f.controller.requestPersistence();
    expect(f.storage.persist).toHaveBeenCalledOnce(); expect(duplicate).toBe(first); inUserHandler = false;
    expect(receivers).toEqual([f.storage]); expect(f.controller.getSnapshot().busy).toBe("persist");
    choice.resolve(false); await first;
    expect(f.controller.getSnapshot()).toMatchObject({ persisted: false, denied: true, error: false, busy: null });
    f.storage.persist.mockResolvedValueOnce(true); await f.controller.requestPersistence();
    expect(f.controller.getSnapshot()).toMatchObject({ persisted: true, denied: false, error: false });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("treats malformed, thrown and rejected permission responses as unknown rather than granted or denied", async () => {
    const f = fixture(); activate(f.controller); await flush();
    const invalid: (() => unknown)[] = [() => undefined, () => "true", () => ({ granted: true }),
      () => { throw new Error("browser failure"); }, () => Promise.reject(new Error("browser rejection"))];
    for (const response of invalid) {
      f.storage.persist.mockImplementationOnce(response); await f.controller.requestPersistence();
      expect(f.controller.getSnapshot()).toMatchObject({ busy: null, persisted: null, denied: false, error: true, usage: 12_000, quota: 98_000 });
      expect(vi.getTimerCount()).toBe(0);
    }
  });

  it("guards storage and method getters, preserves valid peer results, and supports missing browser APIs truthfully", async () => {
    const f = fixture(); f.getStorage.mockReturnValueOnce(null); activate(f.controller); await flush();
    expect(f.controller.getSnapshot()).toEqual({ busy: null, usage: null, quota: null, persisted: null, canPersist: false, denied: false, error: false });
    f.getStorage.mockImplementationOnce(() => { throw new Error("storage getter blocked"); }); await f.controller.refresh();
    expect(f.controller.getSnapshot()).toMatchObject({ busy: null, error: true, persisted: null, denied: false });
    const brokenEstimate = { get estimate() { throw new Error("method getter blocked"); },
      persisted() { return Promise.resolve(true); }, persist: f.storage.persist };
    f.getStorage.mockReturnValueOnce(brokenEstimate);
    await f.controller.refresh();
    expect(f.controller.getSnapshot()).toMatchObject({ busy: null, usage: null, persisted: true, canPersist: true, error: true, denied: false });
    f.getStorage.mockReturnValueOnce(brokenEstimate); f.storage.persist.mockResolvedValueOnce(true);
    await f.controller.requestPersistence();
    expect(f.controller.getSnapshot()).toMatchObject({ busy: null, persisted: true, denied: false, error: false });
    f.getStorage.mockReturnValueOnce({ estimate() { return { quota: 640 }; } }); await f.controller.refresh();
    expect(f.controller.getSnapshot()).toMatchObject({ usage: null, quota: 640, persisted: null, canPersist: false, error: false });
    expect(f.storage.persist).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects malformed read values and throwing result accessors without hanging or claiming persistence", async () => {
    const f = fixture(); f.storage.estimate.mockResolvedValueOnce({ usage: NaN, quota: 900 });
    f.storage.persisted.mockResolvedValueOnce("false"); activate(f.controller); await flush();
    expect(f.controller.getSnapshot()).toMatchObject({ busy: null, usage: null, quota: 900, persisted: null, denied: false, error: true });
    f.storage.estimate.mockResolvedValueOnce({ get usage() { throw new Error("malformed result"); } });
    await f.controller.refresh(); expect(f.controller.getSnapshot()).toMatchObject({ busy: null, usage: null, error: true });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("fences a timed-out permission reply after a fresh explicit denial and never retries the browser prompt itself", async () => {
    const f = fixture(), old = deferred(); activate(f.controller); await flush(); f.storage.persist.mockReturnValueOnce(old.promise);
    const first = f.controller.requestPersistence(); await vi.advanceTimersByTimeAsync(100); await first;
    expect(f.controller.getSnapshot()).toMatchObject({ busy: null, persisted: null, denied: false, error: true });
    await vi.advanceTimersByTimeAsync(500); expect(f.storage.persist).toHaveBeenCalledOnce();
    await f.controller.requestPersistence(); const denied = f.controller.getSnapshot();
    expect(denied).toMatchObject({ persisted: false, denied: true, error: false });
    old.resolve(true); await flush(); expect(f.controller.getSnapshot()).toBe(denied); expect(vi.getTimerCount()).toBe(0);
  });

  it("settles replaced reads and ignores late values and rejections after a successful retry", async () => {
    const f = fixture(), oldEstimate = deferred(), oldPersisted = deferred();
    f.storage.estimate.mockReturnValueOnce(oldEstimate.promise); f.storage.persisted.mockReturnValueOnce(oldPersisted.promise);
    activate(f.controller); await flush();
    await f.controller.refresh(); const refreshed = f.controller.getSnapshot();
    expect(refreshed).toMatchObject({ busy: null, usage: 12_000, persisted: false, error: false });
    oldEstimate.resolve({ usage: 999_999 }); oldPersisted.reject(new Error("late unsupported read")); await flush();
    expect(f.controller.getSnapshot()).toBe(refreshed); expect(vi.getTimerCount()).toBe(0);
  });

  it("settles cleanup immediately, ignores late replies, and requires a new user action after remount", async () => {
    const f = fixture(), pending = deferred(); const stop = activate(f.controller); await flush();
    f.storage.persist.mockReturnValueOnce(pending.promise); const result = f.controller.requestPersistence();
    stop(); await result; const stopped = f.controller.getSnapshot(); expect(vi.getTimerCount()).toBe(0);
    pending.resolve(true); await flush(); expect(f.controller.getSnapshot()).toBe(stopped);
    await f.controller.requestPersistence(); expect(f.storage.persist).toHaveBeenCalledOnce();
    activate(f.controller); await flush(); expect(f.storage.persist).toHaveBeenCalledOnce();
    expect(f.controller.getSnapshot()).toMatchObject({ busy: null, persisted: false, denied: false, error: false });
  });

  it("lets reentrant cleanup revoke the request before any permission method is invoked", async () => {
    const f = fixture(), stop = activate(f.controller); await flush();
    const unsubscribe = f.controller.subscribe(() => { if (f.controller.getSnapshot().busy === "persist") stop(); });
    await f.controller.requestPersistence();
    expect(f.storage.persist).not.toHaveBeenCalled(); expect(f.controller.getSnapshot().busy).toBeNull();
    expect(vi.getTimerCount()).toBe(0); unsubscribe();
  });
});
