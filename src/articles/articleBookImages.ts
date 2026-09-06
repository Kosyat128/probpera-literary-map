export type ArticleBookImageState = "pending" | "ready" | "failed";
type Options = {
  concurrency?: number;
  timeoutMs?: number;
  retries?: number;
  notifyDelayMs?: number;
  createImage?: () => HTMLImageElement;
  resolveUrl?: (source: string) => string;
  signal?: AbortSignal;
};

/** A bounded request queue keeps loading illustrations after the first page opens. */
export function createArticleBookImageLoader(sources: readonly string[], options: Options = {}) {
  const queue = [...new Set(sources.filter(Boolean))];
  const images = new Map<string, HTMLImageElement>();
  const states = new Map<string, ArticleBookImageState>(queue.map(source => [source, "pending"]));
  const listeners = new Set<() => void>();
  const active = new Set<() => void>();
  const createImage = options.createImage || (() => new Image());
  const timeoutMs = Math.max(1, options.timeoutMs ?? 12000);
  const retries = Math.max(0, Math.min(2, options.retries ?? 1));
  let disposed = false;
  let next = 0;
  let revision = 0;
  let notifyTimer: ReturnType<typeof setTimeout> | undefined;

  const notify = () => {
    if (disposed || notifyTimer !== undefined) return;
    notifyTimer = setTimeout(() => {
      notifyTimer = undefined;
      if (disposed) return;
      revision += 1;
      listeners.forEach(listener => listener());
    }, options.notifyDelayMs ?? 80);
  };

  const request = (source: string): Promise<HTMLImageElement | null> => new Promise(resolve => {
    if (disposed) { resolve(null); return; }
    const image = createImage();
    let finished = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (ready: boolean) => {
      if (finished) return;
      finished = true;
      if (timer !== undefined) clearTimeout(timer);
      active.delete(cancel);
      image.onload = null;
      image.onerror = null;
      if (!ready) image.src = "";
      resolve(ready ? image : null);
    };
    const cancel = () => finish(false);
    active.add(cancel);
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    timer = setTimeout(cancel, timeoutMs);
    image.onerror = () => finish(false);
    image.onload = () => {
      void image.decode().then(() => finish(image.naturalWidth > 0 && image.naturalHeight > 0), () => finish(false));
    };
    try { image.src = options.resolveUrl ? options.resolveUrl(source) : source; }
    catch { finish(false); }
  });

  async function worker() {
    while (!disposed && next < queue.length) {
      const source = queue[next++];
      let image: HTMLImageElement | null = null;
      for (let attempt = 0; !disposed && !image && attempt <= retries; attempt++) image = await request(source);
      if (disposed) { if (image) image.src = ""; return; }
      if (image) images.set(source, image);
      states.set(source, image ? "ready" : "failed");
      notify();
    }
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    options.signal?.removeEventListener("abort", dispose);
    if (notifyTimer !== undefined) clearTimeout(notifyTimer);
    notifyTimer = undefined;
    for (const cancel of [...active]) cancel();
    for (const image of images.values()) image.src = "";
    images.clear();
    listeners.clear();
  }
  options.signal?.addEventListener("abort", dispose, {once: true});
  if (options.signal?.aborted) dispose();
  const settled = Promise.resolve().then(() => Promise.all(Array.from({length: Math.min(queue.length, Math.max(1, options.concurrency ?? 6))}, worker))).then(() => undefined);

  return {
    images,
    settled,
    getState: (source: string): ArticleBookImageState => states.get(source) || "failed",
    getRevision: () => revision,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    dispose,
  };
}
