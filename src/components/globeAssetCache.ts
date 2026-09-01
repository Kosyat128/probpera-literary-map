export type GlobeTextureImageCacheOptions = {
  maxEntries?: number;
  /** Maximum images that may be downloading or decoding at the same time. */
  maxPendingEntries?: number;
  /** Stops a browser decode promise from blocking the final selection forever. */
  decodeTimeoutMs?: number;
  createImage?: () => HTMLImageElement;
};

type TextureImagePriority = "high" | "low";

type PendingTextureImage = {
  assetName: string;
  sourceUrl: string;
  priority: TextureImagePriority;
  image: HTMLImageElement | null;
  promise: Promise<HTMLImageElement>;
  resolve: (image: HTMLImageElement) => void;
  reject: (error: Error) => void;
  state: "queued" | "loading" | "decoding" | "settled";
};

/** A texture was replaced before its expensive decode had to complete. */
export class GlobeTextureLoadSupersededError extends Error {
  readonly code = "globe-texture-load-superseded";

  constructor(assetName: string) {
    super(`Globe texture load was superseded: ${assetName}`);
    this.name = "AbortError";
  }
}

/**
 * Keeps in-flight texture requests shared and retains only a tiny decoded LRU.
 * Full desktop textures are 4096x2048, so active download/decode work is also
 * bounded. While that budget is occupied, required switches use one latest-only
 * queue entry: quickly scrubbing the edition rail cannot decode every skipped
 * texture, but the reader's final choice is never dropped.
 */
export class GlobeTextureImageCache {
  private readonly maxEntries: number;
  private readonly maxPendingEntries: number;
  private readonly decodeTimeoutMs: number;
  private readonly createImage: () => HTMLImageElement;
  private readonly pending = new Map<string, PendingTextureImage>();
  private readonly decoded = new Map<string, HTMLImageElement>();
  private activeCount = 0;
  private queuedRequired: PendingTextureImage | null = null;

  constructor(options: GlobeTextureImageCacheOptions = {}) {
    this.maxEntries = Math.max(1, Math.floor(options.maxEntries ?? 2));
    this.maxPendingEntries = Math.max(
      1,
      Math.floor(options.maxPendingEntries ?? 1)
    );
    this.decodeTimeoutMs = Math.max(
      1,
      Math.floor(options.decodeTimeoutMs ?? 12_000)
    );
    this.createImage = options.createImage ?? (() => new Image());
  }

  load(assetName: string, sourceUrl: string): Promise<HTMLImageElement> {
    // A newly selected decoded/active texture also invalidates an older queued
    // selection. Otherwise that stale 4K image would still decode afterwards.
    this.supersedeQueuedRequiredExcept(assetName);

    const cached = this.readDecoded(assetName);
    if (cached) return Promise.resolve(cached);

    const pendingRequest = this.pending.get(assetName);
    if (pendingRequest) {
      pendingRequest.priority = "high";
      if (pendingRequest.image) pendingRequest.image.fetchPriority = "high";
      return pendingRequest.promise;
    }

    // A request that has not reached decode yet can be stopped without losing
    // useful work. The final reader selection starts immediately instead of
    // waiting behind a stale hover preload or abandoned download.
    this.cancelLoadingRequestsExcept(assetName);

    const request = this.createRequest(assetName, sourceUrl, "high");
    this.pending.set(assetName, request);
    if (this.activeCount < this.maxPendingEntries) {
      this.activate(request);
    } else {
      this.queuedRequired = request;
    }
    return request.promise;
  }

  /**
   * Records that the already-rendered texture is still the reader's choice.
   * This prevents an older queued switch from decoding after the UI returns to
   * the current edition without calling `load()` again.
   */
  retainRequired(assetName: string | null) {
    this.supersedeQueuedRequiredExcept(assetName);
    this.cancelLoadingRequestsExcept(assetName);
  }

  /**
   * Starts a best-effort hover/focus preload only while the active budget has
   * room. Speculation never queues ahead of an explicit reader selection.
   */
  preload(
    assetName: string,
    sourceUrl: string
  ): Promise<HTMLImageElement | null> {
    const cached = this.readDecoded(assetName);
    if (cached) return Promise.resolve(cached);

    const pendingRequest = this.pending.get(assetName);
    if (pendingRequest) return pendingRequest.promise;

    if (
      this.activeCount >= this.maxPendingEntries ||
      this.queuedRequired !== null
    ) {
      return Promise.resolve(null);
    }

    const request = this.createRequest(assetName, sourceUrl, "low");
    this.pending.set(assetName, request);
    this.activate(request);
    return request.promise;
  }

  private createRequest(
    assetName: string,
    sourceUrl: string,
    priority: TextureImagePriority
  ) {
    let resolveImage!: (image: HTMLImageElement) => void;
    let rejectImage!: (error: Error) => void;
    const promise = new Promise<HTMLImageElement>((resolve, reject) => {
      resolveImage = resolve;
      rejectImage = reject;
    });
    return {
      assetName,
      sourceUrl,
      priority,
      image: null,
      promise,
      resolve: resolveImage,
      reject: rejectImage,
      state: "queued",
    } satisfies PendingTextureImage;
  }

  private activate(request: PendingTextureImage) {
    if (request.state !== "queued") return;
    request.state = "loading";
    this.activeCount += 1;

    let image: HTMLImageElement;
    try {
      image = this.createImage();
    } catch (error) {
      this.rejectActive(request, error);
      return;
    }
    request.image = image;
    image.decoding = "async";
    image.fetchPriority = request.priority;

    let loadFired = false;
    image.onload = () => {
      if (loadFired || request.state !== "loading") return;
      loadFired = true;
      request.state = "decoding";
      void (async () => {
        try {
          // onload does not guarantee that a browser honored decoding="async".
          // Waiting here also keeps the single active slot occupied until the
          // large bitmap really is decoded, not merely downloaded.
          if (typeof image.decode === "function") {
            await this.waitForDecode(image);
          }
        } catch {
          // A successfully loaded image is still drawable when decode() is not
          // implemented or rejects because decoded pixels were reclaimed.
        }

        if (request.state !== "decoding") return;
        this.remember(request.assetName, image);
        this.settleActive(request);
        request.resolve(image);
      })();
    };
    image.onerror = () => {
      if (loadFired || request.state !== "loading") return;
      loadFired = true;
      this.rejectActive(
        request,
        new Error(`Globe texture failed to load: ${request.assetName}`)
      );
    };

    try {
      image.src = request.sourceUrl;
    } catch (error) {
      if (!loadFired) {
        loadFired = true;
        this.rejectActive(request, error);
      }
    }
  }

  private rejectActive(request: PendingTextureImage, reason: unknown) {
    if (request.state !== "loading" && request.state !== "decoding") return;
    this.settleActive(request);
    request.reject(
      reason instanceof Error
        ? reason
        : new Error(`Globe texture failed to load: ${request.assetName}`)
    );
  }

  private async waitForDecode(image: HTMLImageElement) {
    let decodePromise: Promise<void>;
    try {
      decodePromise = image.decode();
    } catch {
      return;
    }
    let timeout: ReturnType<typeof globalThis.setTimeout> | null = null;
    try {
      await Promise.race([
        decodePromise.catch(() => undefined),
        new Promise<void>((resolve) => {
          timeout = globalThis.setTimeout(resolve, this.decodeTimeoutMs);
        }),
      ]);
    } finally {
      if (timeout !== null) globalThis.clearTimeout(timeout);
    }
  }

  private settleActive(request: PendingTextureImage) {
    request.state = "settled";
    if (request.image) {
      request.image.onload = null;
      request.image.onerror = null;
    }
    this.activeCount = Math.max(0, this.activeCount - 1);
    if (this.pending.get(request.assetName) === request) {
      this.pending.delete(request.assetName);
    }
    this.drainRequiredQueue();
  }

  private drainRequiredQueue() {
    if (
      this.activeCount >= this.maxPendingEntries ||
      !this.queuedRequired
    ) {
      return;
    }
    const request = this.queuedRequired;
    this.queuedRequired = null;
    this.activate(request);
  }

  private supersedeQueuedRequiredExcept(assetName: string | null) {
    const queued = this.queuedRequired;
    if (!queued || queued.assetName === assetName) return;
    this.queuedRequired = null;
    queued.state = "settled";
    if (this.pending.get(queued.assetName) === queued) {
      this.pending.delete(queued.assetName);
    }
    queued.reject(new GlobeTextureLoadSupersededError(queued.assetName));
  }

  private cancelLoadingRequestsExcept(assetName: string | null) {
    for (const request of this.pending.values()) {
      if (
        request.state !== "loading" ||
        request.assetName === assetName
      ) {
        continue;
      }
      const image = request.image;
      if (image) {
        image.onload = null;
        image.onerror = null;
        image.removeAttribute("src");
      }
      this.settleActive(request);
      request.reject(new GlobeTextureLoadSupersededError(request.assetName));
    }
  }

  private readDecoded(assetName: string) {
    const cached = this.decoded.get(assetName);
    if (!cached) return null;
    this.decoded.delete(assetName);
    this.decoded.set(assetName, cached);
    return cached;
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
