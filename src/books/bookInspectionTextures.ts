import type { BookEditorialPage } from "./bookEditorialPages";
import { bookDossierDiagramPoint } from "./bookDossierDiagram";
import { BOOK_TYPOGRAPHY_VERSION, BookDossierPaperTokens, BookDossierSpacingTokens, BookDossierTypographyTokens, ensureBookTypographyReady } from "./bookTypography";
import { BOOK_INSPECTION_LAYOUT_VERSION, bookInspectionFont, getBookInspectionPageLayout } from "./bookInspectionPageLayout";

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
    "documentCacheKey" | "page" | "quality" | "theme"
  >
) {
  return [
    normalizedKeyPart(request.documentCacheKey),
    `page=${request.page.index}:${request.page.id}`,
    `quality=${request.quality}`,
    BOOK_TYPOGRAPHY_VERSION,
    BOOK_INSPECTION_LAYOUT_VERSION,
    JSON.stringify(request.theme || {}),
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

function renderEditorialPage(
  surface: BookInspectionCanvas,
  request: BookInspectionTextureRequest,
  plan: BookInspectionTexturePlan
) {
  const context = getCanvasContext(surface);
  const layout = getBookInspectionPageLayout(request.page);
  // Unpaginated input remains available in the semantic DOM reader.
  if (!context || !layout) return false;
  const paper = safeColor(request.theme?.paperColor, BookDossierPaperTokens.paper);
  const ink = safeColor(request.theme?.inkColor, BookDossierPaperTokens.ink);
  const muted = safeColor(request.theme?.mutedColor, BookDossierPaperTokens.muted);
  const accent = safeColor(request.theme?.accentColor, BookDossierPaperTokens.accent);
  context.save();
  context.scale(plan.width / BookDossierSpacingTokens.designWidth, plan.height / BookDossierSpacingTokens.designHeight);
  context.fillStyle = paper;
  context.fillRect(0, 0, 1400, 2000);
  // Low-contrast fixed-coordinate paper fibres survive quality changes quietly.
  context.fillStyle = "rgba(70,50,28,.025)";
  for (let y = 7; y < 2000; y += 19) {
    const x = (y * 71) % 1400;
    context.fillRect(x, y, 18, .6);
  }
  const outer = BookDossierSpacingTokens.outer;
  const gutter = BookDossierSpacingTokens.gutter;
  const inset = request.page.index % 2 === 0 ? outer : gutter;
  const right = request.page.index % 2 === 0 ? 1400 - gutter : 1400 - outer;
  context.strokeStyle = accent;
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(inset, BookDossierSpacingTokens.top);
  context.lineTo(right, BookDossierSpacingTokens.top);
  context.stroke();
  context.textAlign = "left";
  context.textBaseline = "alphabetic";
  context.letterSpacing = "0px";
  if (layout.template === "timeline") {
    const entries = new Map<string, { x: number; y: number }>();
    for (const command of layout.commands) {
      if (command.x > inset && !entries.has(command.sourceId)) entries.set(command.sourceId, { x: command.x - BookDossierSpacingTokens.paragraph / 2, y: command.y });
    }
    const points = [...entries.values()];
    if (points.length) {
      context.strokeStyle = accent;
      context.fillStyle = accent;
      context.lineWidth = 1.5;
      context.beginPath();
      context.moveTo(points[0].x, points[0].y);
      context.lineTo(points[points.length - 1].x, points[points.length - 1].y);
      context.stroke();
      for (const point of points) {
        context.beginPath();
        context.arc(point.x, point.y, 3, 0, Math.PI * 2);
        context.fill();
      }
    }
  }
  if (layout.diagram) {
    const { preview, x, y, width, height } = layout.diagram;
    const points = new Map(preview.nodes.map((node, index) => {
      const point = bookDossierDiagramPoint(index, preview.nodes.length);
      return [node.number, { x: x + point.x / 400 * width, y: y + point.y / 300 * height }];
    }));
    context.strokeStyle = accent;
    context.lineWidth = 5;
    for (const edge of preview.edges) {
      const from = points.get(edge.from)!, to = points.get(edge.to)!;
      const length = Math.hypot(to.x - from.x, to.y - from.y);
      if (!length) continue;
      const dx = (to.x - from.x) / length, dy = (to.y - from.y) / length;
      const end = { x: to.x - dx * 66, y: to.y - dy * 66 };
      context.beginPath(); context.moveTo(from.x + dx * 62, from.y + dy * 62); context.lineTo(end.x, end.y);
      context.moveTo(end.x - dx * 22 - dy * 12, end.y - dy * 22 + dx * 12); context.lineTo(end.x, end.y);
      context.lineTo(end.x - dx * 22 + dy * 12, end.y - dy * 22 - dx * 12); context.stroke();
    }
    context.font = bookInspectionFont("caption");
    context.textAlign = "center"; context.textBaseline = "middle";
    for (const node of preview.nodes) {
      const point = points.get(node.number)!;
      context.fillStyle = paper; context.beginPath();
      if (node.groupIndex % 3 === 1) context.rect(point.x - 58, point.y - 58, 116, 116);
      else if (node.groupIndex % 3 === 2) {
        context.moveTo(point.x, point.y - 70); context.lineTo(point.x + 70, point.y); context.lineTo(point.x, point.y + 70); context.lineTo(point.x - 70, point.y); context.closePath();
      } else context.arc(point.x, point.y, 62, 0, Math.PI * 2);
      context.fill(); context.stroke(); context.fillStyle = ink; context.fillText(String(node.number), point.x, point.y);
    }
    context.textAlign = "left"; context.textBaseline = "alphabetic";
  }
  for (const command of layout.commands) {
    context.font = bookInspectionFont(command.role);
    context.fillStyle = command.role === "caption" ? accent : command.role === "metadata" ? muted : ink;
    context.fillText(command.text, command.x, command.y);
  }
  context.fillStyle = muted;
  context.font = "400 " + BookDossierTypographyTokens.folio.size + "px " + BookDossierTypographyTokens.sans;
  context.textAlign = request.page.index % 2 === 0 ? "left" : "right";
  context.fillText(String(request.page.index + 1), request.page.index % 2 === 0 ? inset : right, 2000 - outer);
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
  if (!surface) return null;
  if (!renderEditorialPage(surface, request, plan)) {
    surface.width = 1;
    surface.height = 1;
    return null;
  }
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
    if (this.renderer === defaultRenderer && !await ensureBookTypographyReady()) return null;
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
