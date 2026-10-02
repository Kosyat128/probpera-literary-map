import { afterEach, describe, expect, it, vi } from "vitest";
import { createReaderPrivacyCoordinator, readerPrivateDatabaseName, readerPrivateStorageKeys } from "./readerPrivacy";
const A = "11111111-1111-4111-8111-111111111111", B = "22222222-2222-4222-8222-222222222222";
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
function fixture() {
  const values = new Map<string, string>(), order: string[] = [];
  for (const key of [...readerPrivateStorageKeys(A), ...readerPrivateStorageKeys(B), "probpera-reading-library", "probpera-reading-progress", "probpera-reader-subscriptions", "booky-size", "unrelated-session"]) values.set(key, "synthetic-private-data");
  const remove = vi.fn((key: string) => { order.push("remove"); values.delete(key); });
  const deleteDatabase = vi.fn(async (_name: string) => { order.push("database"); });
  const ports = { remove, read: (key: string) => values.get(key) ?? null, deleteDatabase, timeoutMs: 100 };
  return { values, order, remove, deleteDatabase, ports, coordinator: createReaderPrivacyCoordinator(ports) };
}
afterEach(() => vi.useRealTimers());
describe("own-user local privacy cleanup", () => {
  it("seals memory synchronously and deletes only A's exact three keys and collection database", async () => {
    const f = fixture(), seal = vi.fn(() => f.order.push("seal")); f.coordinator.register(A, seal);
    const operation = f.coordinator.clear(A);
    expect(f.order).toEqual(["seal"]); expect(f.coordinator.isBlocked(A)).toBe(true);
    expect(await operation).toBe(true);
    expect(f.remove.mock.calls.map(call => call[0])).toEqual(readerPrivateStorageKeys(A));
    expect(f.deleteDatabase).toHaveBeenCalledWith(readerPrivateDatabaseName(A));
    expect(readerPrivateStorageKeys(A).every(key => !f.values.has(key))).toBe(true);
    expect(readerPrivateStorageKeys(B).every(key => f.values.has(key))).toBe(true);
    expect(f.values.has("probpera-reading-library")).toBe(true); expect(f.values.has("booky-size")).toBe(true);
    const stale = vi.fn(); f.coordinator.register(A, stale); expect(stale).toHaveBeenCalledTimes(1);
    f.coordinator.resume(A); expect(f.coordinator.isBlocked(A)).toBe(false);
  });
  it("attempts the remaining exact resources after failure and exposes a bounded explicit retry", async () => {
    const f = fixture(); f.remove.mockImplementationOnce(() => { throw new Error("synthetic storage failure"); });
    expect(await f.coordinator.clear(A)).toBe(false); expect(f.remove).toHaveBeenCalledTimes(3); expect(f.deleteDatabase).toHaveBeenCalledTimes(1);
    expect(f.coordinator.phase(A)).toBe("error"); f.coordinator.resume(A); expect(f.coordinator.isBlocked(A)).toBe(true);
    expect(await f.coordinator.clear(A)).toBe(true); f.coordinator.resume(A); expect(f.coordinator.isBlocked(A)).toBe(false);
  });
  it("bounds an unresponsive database and never turns its late delete into a successful cleanup", async () => {
    vi.useFakeTimers(); const f = fixture(), late = deferred<void>(); f.deleteDatabase.mockImplementationOnce(() => late.promise);
    const operation = f.coordinator.clear(A); await vi.advanceTimersByTimeAsync(100);
    expect(await operation).toBe(false); expect(f.coordinator.phase(A)).toBe("error");
    late.resolve(); await Promise.resolve(); await Promise.resolve(); expect(f.coordinator.phase(A)).toBe("error");
  });
  it("coalesces repeated deletion signals and keeps a permanent accepted deletion sealed after verified re-login", async () => {
    const f = fixture(), late = deferred<void>(); f.deleteDatabase.mockImplementationOnce(() => late.promise);
    const first = f.coordinator.clear(A), second = f.coordinator.clear(A, true); expect(first).toBe(second);
    late.resolve(); expect(await first).toBe(true); f.coordinator.resume(A);
    expect(f.coordinator.isPermanent(A)).toBe(true); expect(f.coordinator.isBlocked(A)).toBe(true); expect(f.remove).toHaveBeenCalledTimes(3);
  });
  it("rejects malformed namespace input before any storage or controller action", async () => {
    const f = fixture(); expect(() => f.coordinator.clear("../other")).toThrow(TypeError);
    expect(() => f.coordinator.register("user:other", vi.fn())).toThrow(TypeError);
    expect(f.remove).not.toHaveBeenCalled(); expect(f.deleteDatabase).not.toHaveBeenCalled();
  });
});
