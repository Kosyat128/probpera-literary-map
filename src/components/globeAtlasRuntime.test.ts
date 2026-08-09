import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("globe atlas initialization", () => {
  it("does not allocate atlas canvases after an in-flight mount is aborted", async () => {
    vi.resetModules();
    let resolveFetch!: (response: Response) => void;
    const fetchResponse = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    vi.stubGlobal("fetch", vi.fn(() => fetchResponse));

    class FakeImage {
      decoding = "auto";
      fetchPriority = "auto";
      naturalWidth = 4096;
      naturalHeight = 2048;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }

      decode() {
        return Promise.resolve();
      }
    }

    const createElement = vi.fn(() => {
      throw new Error("stale atlas attempted to allocate a canvas");
    });
    vi.stubGlobal("Image", FakeImage);
    vi.stubGlobal("document", { createElement });

    const { createGlobeAtlas } = await import("./globeAtlas");
    const controller = new AbortController();
    const pendingAtlas = createGlobeAtlas([], "antique", "ru", {
      compact: false,
      signal: controller.signal,
    });

    controller.abort();
    resolveFetch({
      ok: true,
      json: async () => ({ type: "FeatureCollection", features: [] }),
    } as Response);

    await expect(pendingAtlas).rejects.toMatchObject({ name: "AbortError" });
    expect(createElement).not.toHaveBeenCalled();
  });

  it("retries GeoJSON after a transient first-request failure", async () => {
    vi.resetModules();
    let resolveRetry!: (response: Response) => void;
    const retryResponse = new Promise<Response>((resolve) => {
      resolveRetry = resolve;
    });
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("temporary atlas network failure"))
      .mockImplementationOnce(() => retryResponse);
    vi.stubGlobal("fetch", fetchMock);

    class FakeImage {
      decoding = "auto";
      fetchPriority = "auto";
      naturalWidth = 4096;
      naturalHeight = 2048;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      set src(_value: string) {
        queueMicrotask(() => this.onload?.());
      }

      decode() {
        return Promise.resolve();
      }
    }

    const createElement = vi.fn(() => {
      throw new Error("retry test attempted to allocate a canvas");
    });
    vi.stubGlobal("Image", FakeImage);
    vi.stubGlobal("document", { createElement });

    const { createGlobeAtlas } = await import("./globeAtlas");
    await expect(
      createGlobeAtlas([], "antique", "ru", { compact: false })
    ).rejects.toThrow("temporary atlas network failure");

    const controller = new AbortController();
    const retriedAtlas = createGlobeAtlas([], "antique", "ru", {
      compact: false,
      signal: controller.signal,
    });
    controller.abort();
    resolveRetry({
      ok: true,
      json: async () => ({ type: "FeatureCollection", features: [] }),
    } as Response);

    await expect(retriedAtlas).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(createElement).not.toHaveBeenCalled();
  });
});
