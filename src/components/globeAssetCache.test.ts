import { describe, expect, it } from "vitest";

import { GlobeTextureImageCache } from "./globeAssetCache";

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
}

function createHarness(maxEntries = 2) {
  const images: FakeImage[] = [];
  const cache = new GlobeTextureImageCache({
    maxEntries,
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
});
