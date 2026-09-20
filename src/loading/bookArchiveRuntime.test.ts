import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BookArchiveRuntime } from "./bookArchiveRuntime";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function archive(): BookArchiveRuntime {
  return {
    buildBookArchive: vi.fn(() => []),
    coverArtworkSrcSet: vi.fn(() => undefined),
    isEditorialCover: vi.fn(() => false),
    isCoverArtworkDisplayAllowed: vi.fn(() => false),
    presentBookArchiveEntry: vi.fn(),
  };
}

async function fixture() {
  const primary = deferred<BookArchiveRuntime>(), retry = deferred<BookArchiveRuntime>();
  const primaryStarted = deferred<void>(), retryStarted = deferred<void>();
  const primaryFactory = vi.fn(async () => { primaryStarted.resolve(); return primary.promise; });
  const retryFactory = vi.fn(async () => { retryStarted.resolve(); return retry.promise; });
  vi.doMock("../planet/books", primaryFactory);
  vi.doMock("../planet/books.ts?stage5Load=retry", retryFactory);
  const { loadBookArchiveRuntime: load } = await import("./bookArchiveRuntime");
  return { load, primary, retry, primaryStarted, retryStarted, primaryFactory, retryFactory };
}

beforeEach(() => { vi.resetModules(); });
afterEach(() => {
  vi.doUnmock("../planet/books");
  vi.doUnmock("../planet/books.ts?stage5Load=retry");
  vi.resetModules();
});

describe("demand-owned book runtime recovery", () => {
  it("defers both imports and shares one pending and successful canonical runtime", async () => {
    const f = await fixture(), canonical = archive();
    expect(f.primaryFactory).not.toHaveBeenCalled();
    expect(f.retryFactory).not.toHaveBeenCalled();
    const first = f.load();
    expect(f.load()).toBe(first);
    expect(f.load(true)).toBe(first);
    await f.primaryStarted.promise;
    expect(f.primaryFactory).toHaveBeenCalledTimes(1);
    expect(f.retryFactory).not.toHaveBeenCalled();
    f.primary.resolve(canonical);
    const runtime = await first;
    expect(runtime).toEqual(canonical);
    for (const key of Object.keys(canonical) as (keyof BookArchiveRuntime)[]) expect(runtime[key]).toBe(canonical[key]);
    expect(f.load()).toBe(first);
    expect(f.load(true)).toBe(first);
    expect(await f.load()).toBe(runtime);
    expect(f.retryFactory).not.toHaveBeenCalled();
  });

  it("does not select the retry facade before the primary has failed", async () => {
    const f = await fixture(), canonical = archive();
    const first = f.load(true);
    await f.primaryStarted.promise;
    expect(f.retryFactory).not.toHaveBeenCalled();
    f.primary.resolve(canonical);
    expect(await first).toEqual(canonical);
    expect(f.primaryFactory).toHaveBeenCalledTimes(1);
    expect(f.retryFactory).not.toHaveBeenCalled();
  });

  it("requires explicit recovery after failure and coalesces that recovery without replacing canonical exports", async () => {
    const f = await fixture(), canonical = archive();
    const first = f.load(), failed = expect(first).rejects.toThrow();
    await f.primaryStarted.promise;
    f.primary.reject(new Error("primary facade unavailable"));
    await failed;
    expect(f.retryFactory).not.toHaveBeenCalled();
    // Ordinary consumers cannot silently switch to a second module identity.
    await expect(f.load()).rejects.toThrow();
    expect(f.retryFactory).not.toHaveBeenCalled();
    const recovery = f.load(true);
    expect(f.load(true)).toBe(recovery);
    expect(f.load()).toBe(recovery);
    await f.retryStarted.promise;
    expect(f.retryFactory).toHaveBeenCalledTimes(1);
    f.retry.resolve(canonical);
    const runtime = await recovery;
    expect(runtime).toEqual(canonical);
    for (const key of Object.keys(canonical) as (keyof BookArchiveRuntime)[]) expect(runtime[key]).toBe(canonical[key]);
    expect(f.load(true)).toBe(recovery);
    expect(await f.load()).toBe(runtime);
  });

  it("keeps a failed recovery as an error without an automatic third import or a replacement catalog", async () => {
    const f = await fixture();
    const primaryFailure = expect(f.load()).rejects.toThrow();
    await f.primaryStarted.promise;
    f.primary.reject(new Error("primary facade unavailable"));
    await primaryFailure;
    const recovery = f.load(true), retryFailure = expect(recovery).rejects.toThrow();
    await f.retryStarted.promise;
    f.retry.reject(new Error("shared dependency still unavailable"));
    await retryFailure;
    expect(f.primaryFactory).toHaveBeenCalledTimes(1);
    expect(f.retryFactory).toHaveBeenCalledTimes(1);
    // Another explicit request must report the persistent failure instead of
    // manufacturing success. Whether the browser fetches that same known URL
    // again is covered by the real-browser case, not this module mock.
    await expect(f.load(true)).rejects.toThrow();
    expect(f.primaryFactory).toHaveBeenCalledTimes(1);
    const retryCalls = f.retryFactory.mock.calls.length;
    await Promise.resolve();
    await Promise.resolve();
    expect(f.retryFactory).toHaveBeenCalledTimes(retryCalls);
  });
});
