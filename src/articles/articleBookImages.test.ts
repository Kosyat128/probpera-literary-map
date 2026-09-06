import { afterEach, describe, expect, it, vi } from "vitest";
import { createArticleBookImageLoader } from "./articleBookImages";

type Response = {delay: number; error?: boolean; width?: number; height?: number};
function imageFactory(plan: (url: string, attempt: number) => Response) {
  const requests: string[] = [];
  const instances: Array<{src: string; onload: (() => void) | null; onerror: (() => void) | null}> = [];
  const attempts = new Map<string, number>();
  const createImage = () => {
    let src = "";
    let timer: ReturnType<typeof setTimeout> | undefined;
    const image = {
      crossOrigin: "", decoding: "", naturalWidth: 0, naturalHeight: 0,
      onload: null as (() => void) | null, onerror: null as (() => void) | null,
      decode: () => Promise.resolve(),
      get src() { return src; },
      set src(value: string) {
        src = value;
        if (timer !== undefined) clearTimeout(timer);
        if (!value) return;
        requests.push(value);
        const attempt = (attempts.get(value) || 0) + 1;
        attempts.set(value, attempt);
        const response = plan(value, attempt);
        if (!Number.isFinite(response.delay)) return;
        timer = setTimeout(() => {
          if (response.error) image.onerror?.();
          else {
            image.naturalWidth = response.width || 1024;
            image.naturalHeight = response.height || 1536;
            image.onload?.();
          }
        }, response.delay);
      },
    };
    instances.push(image);
    return image as unknown as HTMLImageElement;
  };
  return {createImage, requests, instances};
}

afterEach(() => vi.useRealTimers());

describe("progressive article book images", () => {
  it("returns immediately, retains slow illustrations beyond 3.5 seconds and publishes their dimensions", async () => {
    vi.useFakeTimers();
    const factory = imageFactory(() => ({delay: 5000}));
    const loader = createArticleBookImageLoader(["cover"], {createImage: factory.createImage});
    const changed = vi.fn();
    loader.subscribe(changed);
    expect(loader.getState("cover")).toBe("pending");
    expect(loader.images.size).toBe(0);
    await vi.advanceTimersByTimeAsync(4000);
    expect(factory.instances[0].src).toBe("cover");
    expect(changed).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1100);
    expect(loader.getState("cover")).toBe("ready");
    expect(loader.images.get("cover")).toMatchObject({naturalWidth: 1024, naturalHeight: 1536});
    expect(changed).toHaveBeenCalledOnce();
    expect(loader.getRevision()).toBe(1);
    loader.dispose();
  });

  it("attempts the complete queue after eight seconds while preserving priority, deduplication and source map keys", async () => {
    vi.useFakeTimers();
    const factory = imageFactory(() => ({delay: 5000}));
    const sources = ["cover", ...Array.from({length: 7}, (_, index) => `inline-${index}`)];
    const loader = createArticleBookImageLoader([...sources, "cover"], {createImage: factory.createImage, concurrency: 2, resolveUrl: source => `/rendition/${source}.webp`});
    await vi.advanceTimersByTimeAsync(21000);
    await loader.settled;
    expect(factory.requests).toEqual(sources.map(source => `/rendition/${source}.webp`));
    expect([...loader.images.keys()]).toEqual(sources);
    expect(sources.every(source => loader.getState(source) === "ready")).toBe(true);
    loader.dispose();
  });

  it("retries a timeout once and refreshes a previously pending image when the retry succeeds", async () => {
    vi.useFakeTimers();
    const factory = imageFactory((_url, attempt) => ({delay: attempt === 1 ? Infinity : 100}));
    const loader = createArticleBookImageLoader(["delayed"], {createImage: factory.createImage, timeoutMs: 4000});
    const changed = vi.fn();
    loader.subscribe(changed);
    await vi.advanceTimersByTimeAsync(4300);
    expect(factory.requests).toEqual(["delayed", "delayed"]);
    expect(factory.instances[0].src).toBe("");
    expect(loader.getState("delayed")).toBe("ready");
    expect(changed).toHaveBeenCalledOnce();
    loader.dispose();
  });

  it("settles permanent errors after a bounded retry and batches simultaneous image notifications", async () => {
    vi.useFakeTimers();
    const factory = imageFactory(url => ({delay: 100, error: url === "missing"}));
    const loader = createArticleBookImageLoader(["one", "two", "missing"], {createImage: factory.createImage});
    const changed = vi.fn();
    loader.subscribe(changed);
    await vi.advanceTimersByTimeAsync(190);
    expect(changed).toHaveBeenCalledOnce();
    expect(loader.images.size).toBe(2);
    await vi.advanceTimersByTimeAsync(120);
    await loader.settled;
    expect(factory.requests.filter(url => url === "missing")).toHaveLength(2);
    expect(loader.getState("missing")).toBe("failed");
    expect(changed).toHaveBeenCalledTimes(2);
    loader.dispose();
  });

  it("cancels active requests and all queued work without late notifications after disposal", async () => {
    vi.useFakeTimers();
    const factory = imageFactory(() => ({delay: 5000}));
    const loader = createArticleBookImageLoader(["one", "two", "three"], {createImage: factory.createImage, concurrency: 1});
    const changed = vi.fn();
    loader.subscribe(changed);
    await vi.advanceTimersByTimeAsync(100);
    loader.dispose();
    await vi.runAllTimersAsync();
    await loader.settled;
    expect(factory.requests).toEqual(["one"]);
    expect(factory.instances[0]).toMatchObject({src: "", onload: null, onerror: null});
    expect(changed).not.toHaveBeenCalled();
    expect(loader.images.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not start a stale compile's requests when its signal was already aborted", async () => {
    vi.useFakeTimers();
    const factory = imageFactory(() => ({delay: 100}));
    const controller = new AbortController();
    controller.abort();
    const loader = createArticleBookImageLoader(["cover"], {createImage: factory.createImage, signal: controller.signal});
    await loader.settled;
    expect(factory.requests).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });
});
