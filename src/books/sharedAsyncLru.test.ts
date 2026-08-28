import { describe, expect, it, vi } from "vitest";

import { SharedAsyncLru } from "./sharedAsyncLru";

describe("SharedAsyncLru", () => {
  it("shares one in-flight and decoded value per key", async () => {
    const cache = new SharedAsyncLru<object>(4);
    const create = vi.fn(async () => ({ decoded: true }));

    const first = cache.getOrCreate("cover-a", create);
    const second = cache.getOrCreate("cover-a", create);

    expect(first).toBe(second);
    await expect(first).resolves.toBe(await second);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("is bounded, touches reused values, and retries rejected loads", async () => {
    const cache = new SharedAsyncLru<string>(2);
    await cache.getOrCreate("a", async () => "a");
    await cache.getOrCreate("b", async () => "b");
    await cache.getOrCreate("a", async () => "unused");
    await cache.getOrCreate("c", async () => "c");
    expect(cache.size).toBe(2);

    const failed = vi.fn(async () => {
      throw new Error("decode failed");
    });
    await expect(cache.getOrCreate("bad", failed)).rejects.toThrow(
      "decode failed"
    );
    await Promise.resolve();
    await expect(cache.getOrCreate("bad", async () => "recovered")).resolves.toBe(
      "recovered"
    );
    expect(failed).toHaveBeenCalledTimes(1);
  });
});
