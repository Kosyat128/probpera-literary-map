import { afterEach, describe, expect, it, vi } from "vitest";
import { createNativeNavigationBridge } from "./NativeNavigationBridge";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe("native Capacitor navigation bridge", () => {
  it("normalizes a launch URL without performing any policy decision", async () => {
    const bridge = createNativeNavigationBridge({
      getLaunchUrl: async () => ({ url: "https://probpera.ru/en/?atlas=all" }),
      subscribeUrl: () => ({ remove: vi.fn() }),
    });
    const value = await bridge.getLaunchUrl();
    expect(value).toEqual({ url: "https://probpera.ru/en/?atlas=all" });
    expect(Object.isFrozen(value)).toBe(true);
  });

  it("rejects malformed launch payloads and reports only a sanitized reason", async () => {
    const failures: unknown[] = [];
    const bridge = createNativeNavigationBridge({
      getLaunchUrl: async () => ({ value: "not-a-launch-payload" }),
      subscribeUrl: () => ({ remove: vi.fn() }),
      onFailure: failure => { failures.push(failure); },
    });
    await expect(bridge.getLaunchUrl()).rejects.toMatchObject({ operation: "launch-url", reason: "invalid-response" });
    expect(failures).toEqual([{ operation: "launch-url", reason: "invalid-response" }]);
  });

  it("bounds a stalled launch reader and observes its late completion", async () => {
    vi.useFakeTimers();
    const pending = deferred<undefined>();
    const failures: unknown[] = [];
    const bridge = createNativeNavigationBridge({
      getLaunchUrl: () => pending.promise,
      subscribeUrl: () => ({ remove: vi.fn() }),
      timeoutMs: 20,
      onFailure: failure => { failures.push(failure); },
    });
    const result = bridge.getLaunchUrl();
    const rejected = expect(result).rejects.toMatchObject({ operation: "launch-url", reason: "timeout" });
    await vi.advanceTimersByTimeAsync(20);
    await rejected;
    pending.resolve(undefined);
    await vi.runAllTimersAsync();
    expect(failures).toEqual([{ operation: "launch-url", reason: "timeout" }]);
  });

  it("adapts appUrlOpen events and makes removal idempotent", async () => {
    let callback: ((event: unknown) => void) | undefined;
    const remove = vi.fn(async () => undefined);
    const bridge = createNativeNavigationBridge({
      getLaunchUrl: async () => undefined,
      subscribeUrl: listener => { callback = listener; return { remove }; },
    });
    const received: string[] = [];
    const handle = await bridge.subscribeUrl(url => received.push(url));
    callback?.({ url: "https://probpera.ru/ru/#atlas" });
    expect(received).toEqual(["https://probpera.ru/ru/#atlas"]);
    await handle.remove();
    await handle.remove();
    expect(remove).toHaveBeenCalledOnce();
    callback?.({ url: "https://probpera.ru/en/" });
    expect(received).toEqual(["https://probpera.ru/ru/#atlas"]);
  });

  it("keeps malformed warm events out of the application callback", async () => {
    let callback: ((event: unknown) => void) | undefined;
    const failures: unknown[] = [];
    const bridge = createNativeNavigationBridge({
      getLaunchUrl: async () => undefined,
      subscribeUrl: listener => { callback = listener; return { remove: vi.fn() }; },
      onFailure: failure => { failures.push(failure); },
    });
    const received: string[] = [];
    await bridge.subscribeUrl(url => received.push(url));
    callback?.({ malformed: true });
    expect(received).toEqual([]);
    expect(failures).toEqual([{ operation: "url-listener", reason: "invalid-response" }]);
  });

  it("normalizes Android Back events at the same lifecycle boundary", async () => {
    let callback: ((event: unknown) => void) | undefined;
    const bridge = createNativeNavigationBridge({
      getLaunchUrl: async () => undefined,
      subscribeUrl: () => ({ remove: vi.fn() }),
      subscribeBack: listener => { callback = listener; return { remove: vi.fn() }; },
    });
    const received: boolean[] = [];
    const handle = await bridge.subscribeBack!(event => received.push(event.canGoBack));
    callback?.({ canGoBack: true });
    expect(received).toEqual([true]);
    await handle.remove();
  });

  it("removes a native listener that resolves after the bridge timeout", async () => {
    vi.useFakeTimers();
    const pending = deferred<{ remove: () => void }>();
    const remove = vi.fn();
    const bridge = createNativeNavigationBridge({
      getLaunchUrl: async () => undefined,
      subscribeUrl: () => pending.promise,
      timeoutMs: 15,
    });
    const result = bridge.subscribeUrl(() => undefined);
    const rejected = expect(result).rejects.toMatchObject({ operation: "url-listener", reason: "timeout" });
    await vi.advanceTimersByTimeAsync(15);
    await rejected;
    pending.resolve({ remove });
    await vi.runAllTimersAsync();
    expect(remove).toHaveBeenCalledOnce();
  });
});
