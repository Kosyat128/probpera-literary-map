import type { BookEditorialPage } from "./bookEditorialPages";

export const bookInspectionTextureQualities = [
  "HIGH",
  "BALANCED",
  "ECONOMY",
] as const;

export type BookInspectionTextureQuality =
  (typeof bookInspectionTextureQualities)[number];

export type BookInspectionTexturePlan = Readonly<{
  quality: BookInspectionTextureQuality;
  width: number;
  height: number;
  dpi: number;
  estimatedRgbaBytes: number;
}>;

export type BookInspectionTextureTheme = Readonly<{
  paperColor?: string;
  inkColor?: string;
  mutedColor?: string;
  accentColor?: string;
}>;

export type BookInspectionTextureRequest = Readonly<{
  documentCacheKey: string;
  page: BookEditorialPage;
  quality: BookInspectionTextureQuality;
  theme?: BookInspectionTextureTheme;
}>;

export type BookInspectionCanvas = HTMLCanvasElement | OffscreenCanvas;

export type BookInspectionTextureResource = Readonly<{
  key: string;
  surface: BookInspectionCanvas;
  width: number;
  height: number;
  dpi: number;
  disposed: boolean;
  dispose: () => void;
}>;

export type BookInspectionTextureGeneration = Readonly<{
  id: number;
  isCurrent: () => boolean;
  cancel: () => void;
}>;

type InspectionCanvasContext =
  | CanvasRenderingContext2D
  | OffscreenCanvasRenderingContext2D;

type TextureRenderer = (
  request: BookInspectionTextureRequest,
  plan: BookInspectionTexturePlan,
  key: string
) => BookInspectionTextureResource | null;

const profileByQuality: Readonly<
  Record<
    BookInspectionTextureQuality,
    Readonly<{ height: number; dpi: number }>
  >
> = {
  HIGH: { height: 2_000, dpi: 192 },
  BALANCED: { height: 1_400, dpi: 144 },
  ECONOMY: { height: 800, dpi: 96 },
};

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function resolveBookInspectionTexturePlan(
  quality: BookInspectionTextureQuality,
  pageAspectRatio = 0.7
): BookInspectionTexturePlan {
  const safeQuality = bookInspectionTextureQualities.includes(quality)
    ? quality
    : "BALANCED";
  const profile = profileByQuality[safeQuality];
  const ratio = clamp(
    Number.isFinite(pageAspectRatio) ? pageAspectRatio : 0.7,
    0.62,
    0.78
  );
  const width = Math.round(profile.height * ratio);
  return Object.freeze({
    quality: safeQuality,
    width,
    height: profile.height,
    dpi: profile.dpi,
    estimatedRgbaBytes: width * profile.height * 4,
  });
}

function normalizedKeyPart(value: unknown, maximumLength = 320) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, maximumLength);
}

export function createBookInspectionTextureCacheKey(
  request: Pick<
    BookInspectionTextureRequest,
    "documentCacheKey" | "page" | "quality"
  >
) {
  return [
    normalizedKeyPart(request.documentCacheKey),
    `page=${request.page.index}:${request.page.id}`,
    `quality=${request.quality}`,
  ].join("|");
}

function safeColor(value: string | undefined, fallback: string) {
  const candidate = normalizedKeyPart(value, 32);
  return /^(?:#[\da-f]{3}|#[\da-f]{6}|#[\da-f]{8})$/iu.test(candidate)
    ? candidate
    : fallback;
}

function createBrowserCanvas(width: number, height: number) {
  if (typeof document !== "undefined" && document.createElement) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
  if (typeof globalThis.OffscreenCanvas === "function") {
    return new globalThis.OffscreenCanvas(width, height) as BookInspectionCanvas;
  }
  return null;
}

function getCanvasContext(surface: BookInspectionCanvas) {
  return surface.getContext("2d") as InspectionCanvasContext | null;
}

function truncateLine(
  context: InspectionCanvasContext,
  text: string,
  maximumWidth: number
) {
  if (context.measureText(text).width <= maximumWidth) return text;
  let left = 0;
  let right = text.length;
  while (left < right) {
    const middle = Math.ceil((left + right) / 2);
    if (context.measureText(`${text.slice(0, middle).trim()}…`).width <= maximumWidth) {
      left = middle;
    } else {
      right = middle - 1;
    }
  }
  return `${text.slice(0, Math.max(1, left)).trim()}…`;
}

function wrapLines(
  context: InspectionCanvasContext,
  text: string,
  maximumWidth: number,
  maximumLines: number
) {
  const words = text.split(/\s+/u).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (context.measureText(candidate).width <= maximumWidth) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    current = truncateLine(context, word, maximumWidth);
    if (lines.length >= maximumLines) break;
  }
  if (current && lines.length < maximumLines) lines.push(current);
  if (lines.length === maximumLines && words.join(" ") !== lines.join(" ")) {
    lines[lines.length - 1] = truncateLine(
      context,
      `${lines[lines.length - 1]}…`,
      maximumWidth
    );
  }
  return lines;
}

function drawWrappedText(options: {
  context: InspectionCanvasContext;
  text: string;
  x: number;
  y: number;
  maximumWidth: number;
  lineHeight: number;
  maximumLines: number;
}) {
  const lines = wrapLines(
    options.context,
    options.text,
    options.maximumWidth,
    options.maximumLines
  );
  lines.forEach((line, index) => {
    options.context.fillText(
      line,
      options.x,
      options.y + options.lineHeight * index,
      options.maximumWidth
    );
  });
  return options.y + lines.length * options.lineHeight;
}

function renderEditorialPage(
  surface: BookInspectionCanvas,
  request: BookInspectionTextureRequest,
  plan: BookInspectionTexturePlan
) {
  const context = getCanvasContext(surface);
  if (!context) return false;

  const paper = safeColor(request.theme?.paperColor, "#f3ead8");
  const ink = safeColor(request.theme?.inkColor, "#261c24");
  const muted = safeColor(request.theme?.mutedColor, "#6f6266");
  const accent = safeColor(request.theme?.accentColor, "#b85b27");
  const scale = plan.width / 1_400;
  const inset = Math.round(132 * scale);
  const contentWidth = plan.width - inset * 2;
  const page = request.page;

  context.save();
  context.fillStyle = paper;
  context.fillRect(0, 0, plan.width, plan.height);
  context.fillStyle = "rgba(32, 18, 25, 0.035)";
  for (let y = 0; y < plan.height; y += Math.max(8, Math.round(14 * scale))) {
    context.fillRect(0, y, plan.width, Math.max(1, Math.round(scale)));
  }
  context.strokeStyle = accent;
  context.lineWidth = Math.max(2, Math.round(3 * scale));
  context.beginPath();
  context.moveTo(inset, Math.round(150 * scale));
  context.lineTo(plan.width - inset, Math.round(150 * scale));
  context.stroke();

  let y = Math.round(220 * scale);
  context.textBaseline = "alphabetic";
  context.fillStyle = accent;
  context.font = `600 ${Math.round(25 * scale)}px Arial, sans-serif`;
  context.letterSpacing = `${Math.max(1, Math.round(2 * scale))}px`;
  context.fillText(page.eyebrow.toLocaleUpperCase(), inset, y, contentWidth);

  y += Math.round(102 * scale);
  context.letterSpacing = "0px";
  context.fillStyle = ink;
  context.font = `600 ${Math.round((page.id === "identity" ? 82 : 58) * scale)}px Georgia, "Times New Roman", serif`;
  y = drawWrappedText({
    context,
    text: page.title,
    x: inset,
    y,
    maximumWidth: contentWidth,
    lineHeight: Math.round((page.id === "identity" ? 98 : 72) * scale),
    maximumLines: page.id === "identity" ? 4 : 3,
  });

  if (page.rows.length > 0) {
    y += Math.round(74 * scale);
    const labelWidth = Math.round(contentWidth * 0.36);
    for (const row of page.rows.slice(0, 9)) {
      context.fillStyle = muted;
      context.font = `600 ${Math.round(24 * scale)}px Arial, sans-serif`;
      context.fillText(row.label.toLocaleUpperCase(), inset, y, labelWidth);
      context.fillStyle = ink;
      context.font = `500 ${Math.round(31 * scale)}px Georgia, "Times New Roman", serif`;
      const rowEnd = drawWrappedText({
        context,
        text: row.value,
        x: inset + labelWidth,
        y,
        maximumWidth: contentWidth - labelWidth,
        lineHeight: Math.round(39 * scale),
        maximumLines: 2,
      });
      y = Math.max(y + Math.round(62 * scale), rowEnd + Math.round(22 * scale));
      if (y > plan.height - Math.round(180 * scale)) break;
    }
  }

  if (page.paragraphs.length > 0) {
    y += Math.round(70 * scale);
    context.fillStyle = ink;
    context.font = `400 ${Math.round(36 * scale)}px Georgia, "Times New Roman", serif`;
    for (const paragraph of page.paragraphs.slice(0, 2)) {
      y = drawWrappedText({
        context,
        text: paragraph,
        x: inset,
        y,
        maximumWidth: contentWidth,
        lineHeight: Math.round(54 * scale),
        maximumLines: 16,
      });
      y += Math.round(42 * scale);
    }
  }

  if (page.sources.length > 0) {
    y += Math.round(68 * scale);
    for (const source of page.sources.slice(0, 6)) {
      context.fillStyle = ink;
      context.font = `600 ${Math.round(29 * scale)}px Georgia, "Times New Roman", serif`;
      context.fillText(
        truncateLine(context, source.provider, contentWidth),
        inset,
        y,
        contentWidth
      );
      y += Math.round(39 * scale);
      context.fillStyle = muted;
      context.font = `400 ${Math.round(22 * scale)}px Arial, sans-serif`;
      const rights = [source.usageLabel, source.license, source.rightsHolder]
        .filter(Boolean)
        .join(" · ");
      context.fillText(
        truncateLine(context, rights, contentWidth),
        inset,
        y,
        contentWidth
      );
      y += Math.round(32 * scale);
      context.fillText(
        truncateLine(context, source.sourceUrl, contentWidth),
        inset,
        y,
        contentWidth
      );
      y += Math.round(72 * scale);
      if (y > plan.height - Math.round(180 * scale)) break;
    }
  }

  context.fillStyle = muted;
  context.font = `500 ${Math.round(21 * scale)}px Arial, sans-serif`;
  context.textAlign = "right";
  context.fillText(String(page.index + 1), plan.width - inset, plan.height - inset);
  context.restore();
  return true;
}

function createTextureResource(
  key: string,
  surface: BookInspectionCanvas,
  plan: BookInspectionTexturePlan
): BookInspectionTextureResource {
  let disposed = false;
  return Object.freeze({
    key,
    surface,
    width: plan.width,
    height: plan.height,
    dpi: plan.dpi,
    get disposed() {
      return disposed;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      surface.width = 1;
      surface.height = 1;
    },
  });
}

const defaultRenderer: TextureRenderer = (request, plan, key) => {
  const surface = createBrowserCanvas(plan.width, plan.height);
  if (!surface || !renderEditorialPage(surface, request, plan)) return null;
  return createTextureResource(key, surface, plan);
};

export class BookInspectionTextureLru<T extends { dispose: () => void }> {
  readonly capacity: number;
  private readonly values = new Map<string, T>();

  constructor(capacity = 4) {
    this.capacity = Math.round(clamp(capacity, 1, 8));
  }

  get size() {
    return this.values.size;
  }

  get(key: string) {
    const value = this.values.get(key);
    if (!value) return undefined;
    this.values.delete(key);
    this.values.set(key, value);
    return value;
  }

  set(key: string, value: T) {
    const previous = this.values.get(key);
    if (previous === value) {
      this.values.delete(key);
      this.values.set(key, value);
      return;
    }
    if (previous) previous.dispose();
    this.values.delete(key);
    this.values.set(key, value);
    while (this.values.size > this.capacity) {
      const oldest = this.values.entries().next().value as
        | [string, T]
        | undefined;
      if (!oldest) break;
      this.values.delete(oldest[0]);
      oldest[1].dispose();
    }
  }

  clear() {
    for (const value of this.values.values()) value.dispose();
    this.values.clear();
  }
}

export class BookInspectionTextureStore {
  private readonly cache: BookInspectionTextureLru<BookInspectionTextureResource>;
  private readonly renderer: TextureRenderer;
  private generationSequence = 0;
  private activeGeneration: BookInspectionTextureGeneration | null = null;
  private storeDisposed = false;

  constructor(options: { capacity?: number; renderer?: TextureRenderer } = {}) {
    this.cache = new BookInspectionTextureLru(options.capacity ?? 4);
    this.renderer = options.renderer || defaultRenderer;
  }

  get size() {
    return this.cache.size;
  }

  beginGeneration(): BookInspectionTextureGeneration {
    this.activeGeneration?.cancel();
    const id = ++this.generationSequence;
    let cancelled = false;
    const generation: BookInspectionTextureGeneration = Object.freeze({
      id,
      isCurrent: () =>
        !cancelled &&
        !this.storeDisposed &&
        this.activeGeneration === generation,
      cancel: () => {
        cancelled = true;
      },
    });
    this.activeGeneration = generation;
    return generation;
  }

  async request(
    request: BookInspectionTextureRequest,
    generation: BookInspectionTextureGeneration
  ) {
    if (
      this.storeDisposed ||
      this.activeGeneration !== generation ||
      !generation.isCurrent()
    ) {
      return null;
    }
    const key = createBookInspectionTextureCacheKey(request);
    const cached = this.cache.get(key);
    if (cached) return cached;

    // The microtask boundary keeps generation lazy and gives a newer selection
    // a chance to cancel work before allocating a large page surface.
    await Promise.resolve();
    if (
      this.storeDisposed ||
      this.activeGeneration !== generation ||
      !generation.isCurrent()
    ) {
      return null;
    }

    const plan = resolveBookInspectionTexturePlan(request.quality);
    let resource: BookInspectionTextureResource | null = null;
    try {
      resource = this.renderer(request, plan, key);
    } catch {
      resource = null;
    }
    if (!resource) return null;
    if (
      this.storeDisposed ||
      this.activeGeneration !== generation ||
      !generation.isCurrent()
    ) {
      resource.dispose();
      return null;
    }
    this.cache.set(key, resource);
    return resource;
  }

  clear() {
    this.cache.clear();
  }

  dispose() {
    if (this.storeDisposed) return;
    this.storeDisposed = true;
    this.activeGeneration?.cancel();
    this.activeGeneration = null;
    this.cache.clear();
  }
}
