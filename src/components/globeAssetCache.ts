export type GlobeTextureImageCacheOptions = {
  maxEntries?: number;
  maxPendingEntries?: number;
  createImage?: () => HTMLImageElement;
};

type PendingTextureImage = {
  image: HTMLImageElement;
  promise: Promise<HTMLImageElement>;
};

/**
 * Keeps in-flight texture requests shared and retains only a tiny decoded LRU.
 * The cache is intentionally bounded: full desktop textures are 4096x2048 and
 * must not accumulate when a reader previews several globe styles.
 */
export class GlobeTextureImageCache {
  private readonly maxEntries: number;
  private readonly maxPendingEntries: number;
  private readonly createImage: () => HTMLImageElement;
  private readonly pending = new Map<string, PendingTextureImage>();
  private readonly decoded = new Map<string, HTMLImageElement>();

  constructor(options: GlobeTextureImageCacheOptions = {}) {
    this.maxEntries = Math.max(1, Math.floor(options.maxEntries ?? 2));
    this.maxPendingEntries = Math.max(
      1,
      Math.floor(options.maxPendingEntries ?? 1)
    );
    this.createImage = options.createImage ?? (() => new Image());
  }

  load(assetName: string, sourceUrl: string): Promise<HTMLImageElement> {
    const cached = this.readDecoded(assetName);
    if (cached) return Promise.resolve(cached);

    const activeRequest = this.pending.get(assetName);
    if (activeRequest) {
      // A real selection supersedes speculative intent without starting a
      // duplicate download.
      activeRequest.image.fetchPriority = "high";
      return activeRequest.promise;
    }

    return this.start(assetName, sourceUrl, "high");
  }

  /**
   * Starts a best-effort hover/focus preload only while the tiny in-flight
   * budget has room. Required loads are never rejected by this bound.
   */
  preload(
    assetName: string,
    sourceUrl: string
  ): Promise<HTMLImageElement | null> {
    const cached = this.readDecoded(assetName);
    if (cached) return Promise.resolve(cached);

    const activeRequest = this.pending.get(assetName);
    if (activeRequest) return activeRequest.promise;

    if (this.pending.size >= this.maxPendingEntries) {
      return Promise.resolve(null);
    }

    return this.start(assetName, sourceUrl, "low");
  }

  private readDecoded(assetName: string) {
    const cached = this.decoded.get(assetName);
    if (!cached) return null;
    this.decoded.delete(assetName);
    this.decoded.set(assetName, cached);
    return cached;
  }

  private start(
    assetName: string,
    sourceUrl: string,
    fetchPriority: "high" | "low"
  ): Promise<HTMLImageElement> {

    const image = this.createImage();
    image.decoding = "async";
    image.fetchPriority = fetchPriority;

    let resolveImage!: (loadedImage: HTMLImageElement) => void;
    let rejectImage!: (error: Error) => void;
    const request = new Promise<HTMLImageElement>((resolve, reject) => {
      resolveImage = resolve;
      rejectImage = reject;
    });
    this.pending.set(assetName, { image, promise: request });

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

        if (this.pending.get(assetName)?.promise === request) {
          this.pending.delete(assetName);
        }
        this.remember(assetName, image);
        resolveImage(image);
      })();
    };
    image.onerror = () => {
      if (settled) return;
      settled = true;
      if (this.pending.get(assetName)?.promise === request) {
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
