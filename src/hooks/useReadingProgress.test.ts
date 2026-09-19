import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createReadingProgressController, readingProgressStorageKey,
  READING_PROGRESS_REMOTE_DELAY_MS, READING_PROGRESS_REMOTE_TIMEOUT_MS,
  type ReadingProgressRemote, type StoredReadingProgress } from "./useReadingProgress";

const first = "2026-09-18T10:00:00.000Z";
const now = "2026-09-19T10:00:00.000Z";
const future = "2026-09-19T11:00:00.000Z";
const record = (progress: number, extra: Partial<StoredReadingProgress> = {}): StoredReadingProgress =>
  ({ progress, updatedAt: first, syncPending: false, ...extra });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
function fixture(initial: StoredReadingProgress | null = null, remoteEnabled = true) {
  let local = initial;
  const read = vi.fn<ReadingProgressRemote["read"]>(async () => ({ data: null, error: null }));
  const write = vi.fn<ReadingProgressRemote["write"]>(async () => ({ error: null }));
  const writeLocal = vi.fn((value: StoredReadingProgress) => { local = { ...value }; });
  let current = true;
  const create = () => createReadingProgressController({ readLocal: () => local, writeLocal,
    remote: remoteEnabled ? { read, write } : null, isCurrent: () => current });
  return { controller: create(), create, read, write, writeLocal, stored: () => local,
    replaceLocal: (value: StoredReadingProgress) => { local = value; },
    switchScope: () => { current = false; } };
}

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(now)); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

describe("reader progress ownership and recovery", () => {
  it("fences late hydration after new reading intent even when the server timestamp is later", async () => {
    const env = fixture(record(10)), response = deferred<{ data: unknown; error: unknown }>();
    env.read.mockReturnValue(response.promise);
    const stop = env.controller.activate();
    await vi.advanceTimersByTimeAsync(0);
    env.controller.saveProgress(67, "new-heading");
    response.resolve({ data: { progress_percent: 40, position_hint: "old-heading", updated_at: future }, error: null });
    await vi.advanceTimersByTimeAsync(0);
    expect(env.stored()).toEqual(record(67, { positionHint: "new-heading", updatedAt: now, syncPending: true }));
    expect(env.controller.getSnapshot()).toBe(10);
    await vi.advanceTimersByTimeAsync(READING_PROGRESS_REMOTE_DELAY_MS);
    expect(env.write).toHaveBeenCalledTimes(1);
    expect(env.write.mock.calls[0][0].progress).toBe(67);
    expect(env.stored()?.syncPending).toBe(false);
    stop();
    expect(env.create().getSnapshot()).toBe(67);
  });

  it.each(["returned", "thrown"])("retains a zero reset after a %s upload failure and retries once on demand", async failure => {
    const env = fixture(record(80));
    if (failure === "returned") env.write.mockResolvedValueOnce({ error: new Error("offline") });
    else env.write.mockRejectedValueOnce(new Error("offline"));
    const stop = env.controller.activate();
    await vi.advanceTimersByTimeAsync(0);
    env.controller.saveProgress(0);
    await vi.advanceTimersByTimeAsync(READING_PROGRESS_REMOTE_DELAY_MS);
    expect(env.stored()).toEqual(record(0, { updatedAt: now, syncPending: true }));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(env.write).toHaveBeenCalledTimes(1);
    await env.controller.retry();
    expect(env.write).toHaveBeenCalledTimes(2);
    expect(env.write.mock.calls[1][0].progress).toBe(0);
    expect(env.stored()?.syncPending).toBe(false);
    await env.controller.retry();
    expect(env.write).toHaveBeenCalledTimes(2);
    stop();
  });

  it("does not acknowledge a newer reset when an older upload succeeds", async () => {
    const env = fixture(), sent = deferred<{ error: unknown }>();
    env.write.mockReturnValueOnce(sent.promise);
    const stop = env.controller.activate();
    env.controller.saveProgress(75);
    await vi.advanceTimersByTimeAsync(READING_PROGRESS_REMOTE_DELAY_MS);
    env.controller.saveProgress(0);
    sent.resolve({ error: null });
    await vi.advanceTimersByTimeAsync(0);
    expect(env.stored()?.progress).toBe(0);
    expect(env.stored()?.syncPending).toBe(true);
    await vi.advanceTimersByTimeAsync(READING_PROGRESS_REMOTE_DELAY_MS);
    expect(env.write.mock.calls.map(([value]) => value.progress)).toEqual([75, 0]);
    expect(env.stored()?.syncPending).toBe(false);
    stop();
  });

  it("rechecks storage before upload and sends another reader's newer reset instead of stale pending progress", async () => {
    const env = fixture(record(80)), stop = env.controller.activate();
    env.controller.saveProgress(75);
    // Equal wall-clock timestamps are possible across readers; persistence
    // changing after our own save still establishes the newer local intent.
    env.replaceLocal(record(0, { updatedAt: now, syncPending: true }));
    await vi.advanceTimersByTimeAsync(READING_PROGRESS_REMOTE_DELAY_MS);
    expect(env.write.mock.calls.map(([value]) => value.progress)).toEqual([0]);
    expect(env.stored()).toEqual(record(0, { updatedAt: now }));
    stop();
  });

  it("does not upload stale pending progress after another reader has already synchronized its edit", async () => {
    const env = fixture(record(80)), stop = env.controller.activate();
    env.controller.saveProgress(75);
    env.replaceLocal(record(0, { updatedAt: now }));
    await vi.advanceTimersByTimeAsync(READING_PROGRESS_REMOTE_DELAY_MS);
    expect(env.write).not.toHaveBeenCalled();
    expect(env.stored()).toEqual(record(0, { updatedAt: now }));
    stop();
  });

  it.each([false, true])("keeps in-memory intent when persistence fails (initially unavailable: %s)", async unavailable => {
    const env = fixture(unavailable ? null : record(80)), stop = env.controller.activate();
    env.writeLocal.mockImplementation(() => { throw new Error("storage unavailable"); });
    env.controller.saveProgress(0);
    if (unavailable) env.replaceLocal(record(80));
    await vi.advanceTimersByTimeAsync(READING_PROGRESS_REMOTE_DELAY_MS);
    expect(env.write.mock.calls.map(([value]) => value.progress)).toEqual([0]);
    expect(env.stored()?.progress).toBe(80);
    stop();
  });

  it("bounds a hanging upload, retains dirty progress and retries only on a new explicit attempt", async () => {
    const env = fixture(record(80)), response = deferred<{ error: unknown }>();
    env.write.mockReturnValueOnce(response.promise);
    const stop = env.controller.activate();
    env.controller.saveProgress(0);
    await vi.advanceTimersByTimeAsync(READING_PROGRESS_REMOTE_DELAY_MS);
    const oldSignal = env.write.mock.calls[0][1];
    expect(oldSignal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(READING_PROGRESS_REMOTE_TIMEOUT_MS);
    expect(oldSignal.aborted).toBe(true);
    expect(env.stored()?.syncPending).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(env.write).toHaveBeenCalledTimes(1);
    await env.controller.retry();
    expect(env.write.mock.calls.map(([value]) => value.progress)).toEqual([0, 0]);
    expect(env.stored()?.syncPending).toBe(false);
    env.controller.saveProgress(65);
    response.resolve({ error: null });
    await vi.advanceTimersByTimeAsync(0);
    expect(env.stored()?.progress).toBe(65);
    expect(env.stored()?.syncPending).toBe(true);
    await vi.advanceTimersByTimeAsync(READING_PROGRESS_REMOTE_DELAY_MS);
    expect(env.write.mock.calls.map(([value]) => value.progress)).toEqual([0, 0, 65]);
    stop();
  });

  it("bounds a hanging hydration and fences its late result after a successful explicit retry", async () => {
    const env = fixture(record(10)), response = deferred<{ data: unknown; error: unknown }>();
    env.read.mockReturnValueOnce(response.promise);
    const stop = env.controller.activate();
    await vi.advanceTimersByTimeAsync(0);
    const oldSignal = env.read.mock.calls[0][0];
    await vi.advanceTimersByTimeAsync(READING_PROGRESS_REMOTE_TIMEOUT_MS);
    expect(oldSignal.aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(env.read).toHaveBeenCalledTimes(1);
    env.read.mockResolvedValueOnce({ data: { progress_percent: 30, updated_at: now }, error: null });
    await env.controller.retry();
    expect(env.controller.getSnapshot()).toBe(30);
    response.resolve({ data: { progress_percent: 99, updated_at: future }, error: null });
    await vi.advanceTimersByTimeAsync(0);
    expect(env.controller.getSnapshot()).toBe(30);
    expect(env.stored()).toEqual(record(30, { updatedAt: now }));
    expect(env.write).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    stop();
  });

  it("clears a pending timer on scope cleanup and allows the next item to schedule", async () => {
    const previous = fixture(), next = fixture();
    const stopPrevious = previous.controller.activate();
    previous.controller.saveProgress(25);
    previous.switchScope();
    stopPrevious();
    const stopNext = next.controller.activate();
    next.controller.saveProgress(55);
    await vi.advanceTimersByTimeAsync(READING_PROGRESS_REMOTE_DELAY_MS);
    expect(previous.write).not.toHaveBeenCalled();
    expect(next.write).toHaveBeenCalledTimes(1);
    expect(previous.stored()?.syncPending).toBe(true);
    stopNext();
  });

  it("aborts and fences a hanging previous identity without blocking the next identity", async () => {
    const previous = fixture(), next = fixture(), response = deferred<{ error: unknown }>();
    previous.write.mockReturnValueOnce(response.promise);
    const stopPrevious = previous.controller.activate();
    previous.controller.saveProgress(20);
    await vi.advanceTimersByTimeAsync(READING_PROGRESS_REMOTE_DELAY_MS);
    const oldSignal = previous.write.mock.calls[0][1];
    previous.switchScope();
    stopPrevious();
    expect(oldSignal.aborted).toBe(true);
    const stopNext = next.controller.activate();
    next.controller.saveProgress(90);
    await vi.advanceTimersByTimeAsync(READING_PROGRESS_REMOTE_DELAY_MS);
    expect(next.stored()?.syncPending).toBe(false);
    response.resolve({ error: null });
    await vi.advanceTimersByTimeAsync(0);
    expect(previous.stored()?.syncPending).toBe(true);
    await previous.controller.retry();
    expect(previous.write).toHaveBeenCalledTimes(1);
    stopNext();
  });

  it("recovers a persisted dirty value on reopening, while an absent remote row alone starts no upload", async () => {
    const clean = fixture(record(45));
    const stopClean = clean.controller.activate();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(clean.write).not.toHaveBeenCalled();
    expect(clean.stored()?.syncPending).toBe(false);
    stopClean();
    const dirty = fixture(record(0, { syncPending: true }));
    const stopDirty = dirty.controller.activate();
    await vi.advanceTimersByTimeAsync(READING_PROGRESS_REMOTE_DELAY_MS);
    expect(dirty.write).toHaveBeenCalledTimes(1);
    expect(dirty.stored()?.progress).toBe(0);
    expect(dirty.stored()?.syncPending).toBe(false);
    stopDirty();
  });

  it("stores accepted remote progress with its original timestamp and never uploads that read", async () => {
    const env = fixture(record(10));
    env.read.mockResolvedValue({ data: { progress_percent: 35, position_hint: "remote", updated_at: now }, error: null });
    const stop = env.controller.activate();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(env.controller.getSnapshot()).toBe(35);
    expect(env.stored()).toEqual(record(35, { updatedAt: now, positionHint: "remote" }));
    expect(env.write).not.toHaveBeenCalled();
    stop();
  });

  it("does not overwrite another reader's local change with a delayed remote response", async () => {
    const env = fixture(record(15)), response = deferred<{ data: unknown; error: unknown }>();
    env.read.mockReturnValue(response.promise);
    const stop = env.controller.activate();
    await vi.advanceTimersByTimeAsync(0);
    env.replaceLocal(record(0, { updatedAt: now, syncPending: true }));
    response.resolve({ data: { progress_percent: 40, updated_at: future }, error: null });
    await vi.advanceTimersByTimeAsync(0);
    expect(env.stored()).toEqual(record(0, { updatedAt: now, syncPending: true }));
    expect(env.writeLocal).not.toHaveBeenCalled();
    stop();
  });

  it("reactivates after cleanup with a fresh timer and fences the old hydration", async () => {
    const env = fixture(record(15)), oldRead = deferred<{ data: unknown; error: unknown }>();
    env.read.mockReturnValueOnce(oldRead.promise);
    const firstStop = env.controller.activate();
    await vi.advanceTimersByTimeAsync(0);
    const oldSignal = env.read.mock.calls[0][0];
    env.controller.saveProgress(30);
    firstStop();
    const secondStop = env.controller.activate();
    env.controller.saveProgress(50);
    oldRead.resolve({ data: { progress_percent: 99, updated_at: future }, error: null });
    await vi.advanceTimersByTimeAsync(READING_PROGRESS_REMOTE_DELAY_MS);
    expect(oldSignal.aborted).toBe(true);
    expect(env.write.mock.calls.map(([value]) => value.progress)).toEqual([50]);
    expect(env.stored()?.progress).toBe(50);
    secondStop();
  });

  it("keeps the guest path local and separates account keys without relabelling legacy data", async () => {
    const env = fixture(record(65), false), stop = env.controller.activate();
    env.controller.markCompleted();
    expect(env.controller.getSnapshot()).toBe(100);
    env.controller.saveProgress(0);
    await env.controller.retry();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(env.stored()).toEqual(record(0, { updatedAt: now }));
    expect(env.read).not.toHaveBeenCalled();
    expect(env.write).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    expect(readingProgressStorageKey(null)).toBe("probpera-reading-progress");
    expect(new Set([null, "reader-a", "reader-b"].map(readingProgressStorageKey)).size).toBe(3);
    stop();
  });
});
