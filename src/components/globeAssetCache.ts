export type GlobeTextureImageCacheOptions = {
  maxEntries?: number;
  createImage?: () => HTMLImageElement;
};

/**
 * Keeps in-flight texture requests shared and retains only a tiny decoded LRU.
 * The cache is intentionally bounded: full desktop textures are 4096x2048 and
 * must not accumulate when a reader previews several globe styles.
 */
export class GlobeTextureImageCache {
  private readonly maxEntries: number;
  private readonly createImage: () => HTMLImageElement;
  private readonly pending = new Map<string, Promise<HTMLImageElement>>();
  private readonly decoded = new Map<string, HTMLImageElement>();

  constructor(options: GlobeTextureImageCacheOptions = {}) {
    this.maxEntries = Math.max(1, Math.floor(options.maxEntries ?? 2));
    this.createImage = options.createImage ?? (() => new Image());
  }

  load(assetName: string, sourceUrl: string): Promise<HTMLImageElement> {
    const cached = this.decoded.get(assetName);
    if (cached) {
      this.decoded.delete(assetName);
      this.decoded.set(assetName, cached);
      return Promise.resolve(cached);
    }

    const activeRequest = this.pending.get(assetName);
    if (activeRequest) return activeRequest;

    const image = this.createImage();
    image.decoding = "async";
    image.fetchPriority = "high";

    let resolveImage!: (loadedImage: HTMLImageElement) => void;
    let rejectImage!: (error: Error) => void;
    const request = new Promise<HTMLImageElement>((resolve, reject) => {
      resolveImage = resolve;
      rejectImage = reject;
    });
    this.pending.set(assetName, request);

    let settled = false;
    image.onload = () => {
      if (settled) return;
      settled = true;
      void (async () => {
        try {
          // onload does not guarantee that a browser honored decoding="async".
          // Waiting for decode keeps drawImage from causing a synchronous hitch.
          if (typeof image.decode === "function") await image.decode();
        } catch {
          // A successfully loaded image is still drawable when decode() is not
          // implemented or rejects because the decoded pixels were reclaimed.
        }

        if (this.pending.get(assetName) === request) {
          this.pending.delete(assetName);
        }
        this.remember(assetName, image);
        resolveImage(image);
      })();
    };
    image.onerror = () => {
      if (settled) return;
      settled = true;
      if (this.pending.get(assetName) === request) {
        this.pending.delete(assetName);
      }
      rejectImage(new Error(`Globe texture failed to load: ${assetName}`));
    };
    image.src = sourceUrl;

    return request;
  }

  private remember(assetName: string, image: HTMLImageElement) {
    this.decoded.delete(assetName);
    this.decoded.set(assetName, image);

    while (this.decoded.size > this.maxEntries) {
      const oldestAssetName = this.decoded.keys().next().value as
        | string
        | undefined;
      if (!oldestAssetName) break;
      this.decoded.delete(oldestAssetName);
    }
  }
}
