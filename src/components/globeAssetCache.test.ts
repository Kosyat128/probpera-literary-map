import { describe, expect, it } from "vitest";

import {
  GlobeTextureImageCache,
  GlobeTextureLoadSupersededError,
} from "./globeAssetCache";

class FakeImage {
  decoding = "auto";
  fetchPriority = "auto";
  src = "";
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  decodeCalls = 0;
  private releaseDecode: (() => void) | null = null;
  private decodePromise: Promise<void> | null = null;

  holdDecode() {
    this.decodePromise = new Promise<void>((resolve) => {
      this.releaseDecode = resolve;
    });
  }

  decode() {
    this.decodeCalls += 1;
    return this.decodePromise ?? Promise.resolve();
  }

  finishDecode() {
    this.releaseDecode?.();
  }

  finishLoad() {
    this.onload?.();
  }

  finishError() {
    this.onerror?.();
  }

  removeAttribute(name: string) {
    if (name === "src") this.src = "";
  }
}

function createHarness(
  maxEntries = 2,
  maxPendingEntries = 1,
  decodeTimeoutMs = 12_000
) {
  const images: FakeImage[] = [];
  const cache = new GlobeTextureImageCache({
    maxEntries,
    maxPendingEntries,
    decodeTimeoutMs,
    createImage: () => {
      const image = new FakeImage();
      images.push(image);
      return image as unknown as HTMLImageElement;
    },
  });
  return { cache, images };
}

async function loadAsset(
  harness: ReturnType<typeof createHarness>,
  assetName: string
) {
  const request = harness.cache.load(assetName, `/textures/${assetName}`);
  harness.images[harness.images.length - 1]?.finishLoad();
  return await request;
}

describe("globe texture image cache", () => {
  it("shares a pending image and waits for asynchronous decode", async () => {
    const harness = createHarness();
    const first = harness.cache.load("modern.webp", "/textures/modern.webp");
    const second = harness.cache.load("modern.webp", "/textures/modern.webp");

    expect(first).toBe(second);
    expect(harness.images).toHaveLength(1);
    expect(harness.images[0].decoding).toBe("async");
    expect(harness.images[0].fetchPriority).toBe("high");

    harness.images[0].holdDecode();
    harness.images[0].finishLoad();
    let resolved = false;
    void first.then(() => {
      resolved = true;
    });
    await Promise.resolve();
    expect(resolved).toBe(false);

    harness.images[0].finishDecode();
    await expect(first).resolves.toBe(harness.images[0]);
    expect(harness.images[0].decodeCalls).toBe(1);
  });

  it("reuses a decoded texture and bounds the LRU to two full-size assets", async () => {
    const harness = createHarness(2);
    const antique = await loadAsset(harness, "antique.webp");
    const modern = await loadAsset(harness, "modern.webp");

    await expect(
      harness.cache.load("modern.webp", "/textures/modern.webp")
    ).resolves.toBe(modern);
    expect(harness.images).toHaveLength(2);

    await loadAsset(harness, "earth.webp");
    await expect(
      harness.cache.load("modern.webp", "/textures/modern.webp")
    ).resolves.toBe(modern);
    expect(harness.images).toHaveLength(3);

    const antiqueReload = harness.cache.load(
      "antique.webp",
      "/textures/antique.webp"
    );
    expect(harness.images).toHaveLength(4);
    harness.images[3].finishLoad();
    await expect(antiqueReload).resolves.not.toBe(antique);
  });

  it("allows only one speculative preload and admits another after settlement", async () => {
    const harness = createHarness();
    const first = harness.cache.preload("first.webp", "/textures/first.webp");

    await expect(
      harness.cache.preload("second.webp", "/textures/second.webp")
    ).resolves.toBeNull();
    expect(harness.images).toHaveLength(1);
    expect(harness.images[0].fetchPriority).toBe("low");

    harness.images[0].finishLoad();
    await expect(first).resolves.toBe(harness.images[0]);

    const second = harness.cache.preload(
      "second.webp",
      "/textures/second.webp"
    );
    expect(harness.images).toHaveLength(2);
    harness.images[1].finishLoad();
    await expect(second).resolves.toBe(harness.images[1]);
  });

  it("upgrades a matching preload without starting a duplicate image", async () => {
    const harness = createHarness(2, 1);
    const speculative = harness.cache.preload(
      "preview.webp",
      "/textures/preview.webp"
    );
    const requiredPreview = harness.cache.load(
      "preview.webp",
      "/textures/preview.webp"
    );

    expect(requiredPreview).toBe(speculative);
    expect(harness.images[0].fetchPriority).toBe("high");

    harness.images[0].finishLoad();
    await expect(requiredPreview).resolves.toBe(harness.images[0]);
    expect(harness.images).toHaveLength(1);
  });

  it("preempts a stale network preload for the reader's selection", async () => {
    const harness = createHarness(2, 1);
    const speculative = harness.cache.preload(
      "preview.webp",
      "/textures/preview.webp"
    );
    const speculativeResult = speculative.catch((error: unknown) => error);
    const requiredSwitch = harness.cache.load(
      "selected.webp",
      "/textures/selected.webp"
    );
    expect(harness.images).toHaveLength(2);
    expect(harness.images[0].src).toBe("");
    expect(harness.images[1].fetchPriority).toBe("high");
    await expect(speculativeResult).resolves.toBeInstanceOf(
      GlobeTextureLoadSupersededError
    );

    harness.images[1].finishLoad();
    await expect(requiredSwitch).resolves.toBe(harness.images[1]);
  });

  it("keeps the decode budget bounded once an image has reached decode", async () => {
    const harness = createHarness(2, 1);
    const decoding = harness.cache.load("first.webp", "/textures/first.webp");
    harness.images[0].holdDecode();
    harness.images[0].finishLoad();

    const latest = harness.cache.load("latest.webp", "/textures/latest.webp");
    expect(harness.images).toHaveLength(1);

    harness.images[0].finishDecode();
    await expect(decoding).resolves.toBe(harness.images[0]);
    expect(harness.images).toHaveLength(2);
    harness.images[1].finishLoad();
    await expect(latest).resolves.toBe(harness.images[1]);
  });

  it("cannot be blocked forever by a browser decode promise", async () => {
    const harness = createHarness(2, 1, 1);
    const request = harness.cache.load("slow.webp", "/textures/slow.webp");
    harness.images[0].holdDecode();
    harness.images[0].finishLoad();

    await expect(request).resolves.toBe(harness.images[0]);
  });

  it("keeps only the latest queued required texture during rapid selection", async () => {
    const harness = createHarness(2, 1);
    const active = harness.cache.load("first.webp", "/textures/first.webp");
    const activeResult = active.catch((error: unknown) => error);
    const skipped = harness.cache.load("second.webp", "/textures/second.webp");
    const skippedResult = skipped.catch((error: unknown) => error);
    const latest = harness.cache.load("third.webp", "/textures/third.webp");

    expect(harness.images).toHaveLength(3);
    await expect(activeResult).resolves.toBeInstanceOf(
      GlobeTextureLoadSupersededError
    );
    await expect(skippedResult).resolves.toBeInstanceOf(
      GlobeTextureLoadSupersededError
    );
    expect(harness.images[0].src).toBe("");
    expect(harness.images[1].src).toBe("");
    expect(harness.images[2].src).toBe("/textures/third.webp");

    harness.images[2].finishLoad();
    await expect(latest).resolves.toBe(harness.images[2]);
  });

  it("releases the active slot after failure", async () => {
    const harness = createHarness(2, 1);
    const failed = harness.cache.load("failed.webp", "/textures/failed.webp");

    harness.images[0].finishError();
    await expect(failed).rejects.toThrow(
      "Globe texture failed to load: failed.webp"
    );
    const latest = harness.cache.load("latest.webp", "/textures/latest.webp");
    expect(harness.images).toHaveLength(2);
    expect(harness.images[1].src).toBe("/textures/latest.webp");

    harness.images[1].finishLoad();
    await expect(latest).resolves.toBe(harness.images[1]);
  });

  it("drops a stale queued switch when the rendered edition is retained", async () => {
    const harness = createHarness(2, 1);
    const current = harness.cache.load("current.webp", "/textures/current.webp");
    harness.images[0].holdDecode();
    harness.images[0].finishLoad();
    const stale = harness.cache.load("stale.webp", "/textures/stale.webp");
    const staleResult = stale.catch((error: unknown) => error);

    harness.cache.retainRequired("current.webp");
    await expect(staleResult).resolves.toBeInstanceOf(
      GlobeTextureLoadSupersededError
    );
    harness.images[0].finishDecode();
    await expect(current).resolves.toBe(harness.images[0]);
    expect(harness.images).toHaveLength(1);
  });
});
