export const EDITORIAL_GALLERY_VERSION = 1 as const;
export const EDITORIAL_GALLERY_MAX_ITEMS = 100;

export type EditorialGalleryKind = "gallery" | "slider";
export type EditorialGalleryGap = "compact" | "normal" | "spacious";
export type EditorialGalleryAspect =
  | "auto"
  | "1-1"
  | "4-3"
  | "3-2"
  | "16-9"
  | "2-3";
export type EditorialGalleryFit = "contain" | "cover";

export type EditorialGallerySettings = {
  version: typeof EDITORIAL_GALLERY_VERSION;
  id: string;
  columnsDesktop: number;
  columnsTablet: number;
  columnsMobile: number;
  gap: EditorialGalleryGap;
  aspect: EditorialGalleryAspect;
  fit: EditorialGalleryFit;
  captions: boolean;
  lightbox: boolean;
  arrows: boolean;
  dots: boolean;
  autoplay: boolean;
  interval: number;
  loop: boolean;
};

export type EditorialGalleryItemInput = {
  src: string;
  mediaId?: string | null;
  alt?: string;
  caption?: string;
  credit?: string;
  source?: string;
  license?: string;
  licenseUrl?: string;
  link?: string;
};

export const editorialGalleryAttributeNames = [
  "data-gallery-version",
  "data-gallery-id",
  "data-gallery-mode",
  "data-gallery-columns-desktop",
  "data-gallery-columns-tablet",
  "data-gallery-columns-mobile",
  "data-gallery-gap",
  "data-gallery-aspect",
  "data-gallery-fit",
  "data-gallery-captions",
  "data-gallery-lightbox",
  "data-slider-arrows",
  "data-slider-dots",
  "data-slider-autoplay",
  "data-slider-interval",
  "data-slider-loop",
] as const;

const galleryGaps = new Set<EditorialGalleryGap>([
  "compact",
  "normal",
  "spacious",
]);
const galleryAspects = new Set<EditorialGalleryAspect>([
  "auto",
  "1-1",
  "4-3",
  "3-2",
  "16-9",
  "2-3",
]);
const galleryFits = new Set<EditorialGalleryFit>(["contain", "cover"]);

function integerInRange(value: unknown, minimum: number, maximum: number, fallback: number) {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value || ""), 10);
  return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : fallback;
}

function booleanValue(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return fallback;
}

function enumValue<T extends string>(value: unknown, allowed: Set<T>, fallback: T) {
  return typeof value === "string" && allowed.has(value as T)
    ? (value as T)
    : fallback;
}

function safeGalleryId(value: unknown) {
  if (typeof value !== "string") return "";
  const normalized = value.trim();
  return /^[a-z0-9][a-z0-9_-]{0,79}$/iu.test(normalized) ? normalized : "";
}

function safeMediaId(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(
    normalized
  )
    ? normalized.toLowerCase()
    : null;
}

function safeHttpsUrl(value: unknown) {
  if (typeof value !== "string") return "";
  const normalized = value.trim();
  try {
    const parsed = new URL(normalized);
    return parsed.protocol === "https:" &&
      Boolean(parsed.hostname) &&
      !parsed.username &&
      !parsed.password
      ? parsed.href
      : "";
  } catch {
    return "";
  }
}

export function createEditorialGalleryId() {
  const suffix =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
  return `gallery-${suffix}`;
}

export function defaultEditorialGallerySettings(
  kind: EditorialGalleryKind,
  id = createEditorialGalleryId()
): EditorialGallerySettings {
  return {
    version: EDITORIAL_GALLERY_VERSION,
    id,
    columnsDesktop: kind === "gallery" ? 2 : 1,
    columnsTablet: kind === "gallery" ? 2 : 1,
    columnsMobile: 1,
    gap: "normal",
    aspect: "auto",
    fit: "contain",
    captions: true,
    lightbox: true,
    arrows: true,
    dots: true,
    autoplay: false,
    interval: 5000,
    loop: true,
  };
}

export function normalizeEditorialGallerySettings(
  value: Partial<EditorialGallerySettings> | Record<string, unknown>,
  kind: EditorialGalleryKind,
  options: { createId?: boolean } = {}
): EditorialGallerySettings {
  const defaults = defaultEditorialGallerySettings(kind, "");
  const id = safeGalleryId(value.id);
  return {
    version: EDITORIAL_GALLERY_VERSION,
    id: id || (options.createId ? createEditorialGalleryId() : ""),
    columnsDesktop: integerInRange(value.columnsDesktop, 1, 6, defaults.columnsDesktop),
    columnsTablet: integerInRange(value.columnsTablet, 1, 4, defaults.columnsTablet),
    columnsMobile: integerInRange(value.columnsMobile, 1, 2, defaults.columnsMobile),
    gap: enumValue(value.gap, galleryGaps, defaults.gap),
    aspect: enumValue(value.aspect, galleryAspects, defaults.aspect),
    fit: enumValue(value.fit, galleryFits, defaults.fit),
    captions: booleanValue(value.captions, defaults.captions),
    lightbox: booleanValue(value.lightbox, defaults.lightbox),
    arrows: booleanValue(value.arrows, defaults.arrows),
    dots: booleanValue(value.dots, defaults.dots),
    autoplay: booleanValue(value.autoplay, defaults.autoplay),
    interval: integerInRange(value.interval, 2000, 15000, defaults.interval),
    loop: booleanValue(value.loop, defaults.loop),
  };
}

export function parseEditorialGalleryElement(
  element: HTMLElement,
  kind: EditorialGalleryKind
) {
  return normalizeEditorialGallerySettings(
    {
      version: element.getAttribute("data-gallery-version"),
      id: element.getAttribute("data-gallery-id"),
      columnsDesktop: element.getAttribute("data-gallery-columns-desktop"),
      columnsTablet: element.getAttribute("data-gallery-columns-tablet"),
      columnsMobile: element.getAttribute("data-gallery-columns-mobile"),
      gap: element.getAttribute("data-gallery-gap"),
      aspect: element.getAttribute("data-gallery-aspect"),
      fit: element.getAttribute("data-gallery-fit"),
      captions: element.getAttribute("data-gallery-captions"),
      lightbox: element.getAttribute("data-gallery-lightbox"),
      arrows: element.getAttribute("data-slider-arrows"),
      dots: element.getAttribute("data-slider-dots"),
      autoplay: element.getAttribute("data-slider-autoplay"),
      interval: element.getAttribute("data-slider-interval"),
      loop: element.getAttribute("data-slider-loop"),
    },
    kind
  );
}

export function editorialGalleryHtmlAttributes(
  settings: Partial<EditorialGallerySettings> | Record<string, unknown>,
  kind: EditorialGalleryKind
) {
  const normalized = normalizeEditorialGallerySettings(settings, kind);
  return {
    "data-gallery-version": String(normalized.version),
    ...(normalized.id ? { "data-gallery-id": normalized.id } : {}),
    "data-gallery-mode": kind,
    "data-gallery-columns-desktop": String(normalized.columnsDesktop),
    "data-gallery-columns-tablet": String(normalized.columnsTablet),
    "data-gallery-columns-mobile": String(normalized.columnsMobile),
    "data-gallery-gap": normalized.gap,
    "data-gallery-aspect": normalized.aspect,
    "data-gallery-fit": normalized.fit,
    "data-gallery-captions": String(normalized.captions),
    "data-gallery-lightbox": String(normalized.lightbox),
    "data-slider-arrows": String(normalized.arrows),
    "data-slider-dots": String(normalized.dots),
    "data-slider-autoplay": String(normalized.autoplay),
    "data-slider-interval": String(normalized.interval),
    "data-slider-loop": String(normalized.loop),
  };
}

export function editorialGallerySettingsFromNodeAttributes(
  attributes: Record<string, unknown>,
  kind: EditorialGalleryKind,
  options: { createId?: boolean } = {}
) {
  return normalizeEditorialGallerySettings(
    {
      version: attributes.galleryVersion,
      id: attributes.galleryId,
      columnsDesktop: attributes.galleryColumnsDesktop,
      columnsTablet: attributes.galleryColumnsTablet,
      columnsMobile: attributes.galleryColumnsMobile,
      gap: attributes.galleryGap,
      aspect: attributes.galleryAspect,
      fit: attributes.galleryFit,
      captions: attributes.galleryCaptions,
      lightbox: attributes.galleryLightbox,
      arrows: attributes.sliderArrows,
      dots: attributes.sliderDots,
      autoplay: attributes.sliderAutoplay,
      interval: attributes.sliderInterval,
      loop: attributes.sliderLoop,
    },
    kind,
    options
  );
}

export function editorialGalleryNodeAttributes(
  settings: Partial<EditorialGallerySettings> | Record<string, unknown>,
  kind: EditorialGalleryKind,
  options: { createId?: boolean } = {}
) {
  const normalized = normalizeEditorialGallerySettings(settings, kind, options);
  return {
    galleryVersion: normalized.version,
    galleryId: normalized.id,
    galleryColumnsDesktop: normalized.columnsDesktop,
    galleryColumnsTablet: normalized.columnsTablet,
    galleryColumnsMobile: normalized.columnsMobile,
    galleryGap: normalized.gap,
    galleryAspect: normalized.aspect,
    galleryFit: normalized.fit,
    galleryCaptions: normalized.captions,
    galleryLightbox: normalized.lightbox,
    sliderArrows: normalized.arrows,
    sliderDots: normalized.dots,
    sliderAutoplay: normalized.autoplay,
    sliderInterval: normalized.interval,
    sliderLoop: normalized.loop,
  };
}

export function safeEditorialGalleryHtmlAttributes(
  attributes: Record<string, string>
) {
  const galleryAttributeSet = new Set<string>(editorialGalleryAttributeNames);
  const retained = Object.fromEntries(
    Object.entries(attributes).filter(([name]) => !galleryAttributeSet.has(name))
  );
  const kind =
    attributes["data-editorial-block"] === "slider"
      ? "slider"
      : attributes["data-editorial-block"] === "gallery"
        ? "gallery"
        : null;
  if (!kind) return retained;
  const settings = normalizeEditorialGallerySettings(
    {
      version: attributes["data-gallery-version"],
      id: attributes["data-gallery-id"],
      columnsDesktop: attributes["data-gallery-columns-desktop"],
      columnsTablet: attributes["data-gallery-columns-tablet"],
      columnsMobile: attributes["data-gallery-columns-mobile"],
      gap: attributes["data-gallery-gap"],
      aspect: attributes["data-gallery-aspect"],
      fit: attributes["data-gallery-fit"],
      captions: attributes["data-gallery-captions"],
      lightbox: attributes["data-gallery-lightbox"],
      arrows: attributes["data-slider-arrows"],
      dots: attributes["data-slider-dots"],
      autoplay: attributes["data-slider-autoplay"],
      interval: attributes["data-slider-interval"],
      loop: attributes["data-slider-loop"],
    },
    kind
  );
  return {
    ...retained,
    ...editorialGalleryHtmlAttributes(settings, kind),
  };
}

/** Canonicalize structured collection attrs while preserving unknown TipTap nodes. */
export function sanitizeEditorialGalleryJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => sanitizeEditorialGalleryJson(item));
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  const next: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(record)) {
    next[key] = sanitizeEditorialGalleryJson(child);
  }
  if (record.type !== "editorialBlock") return next;
  const attrs =
    record.attrs && typeof record.attrs === "object"
      ? (record.attrs as Record<string, unknown>)
      : {};
  const kind = attrs.kind === "slider" ? "slider" : attrs.kind === "gallery" ? "gallery" : null;
  if (!kind) return next;
  if (Array.isArray(next.content)) {
    let imageCount = 0;
    next.content = next.content.filter((child) => {
      if (
        !child ||
        typeof child !== "object" ||
        (child as Record<string, unknown>).type !== "image"
      ) {
        return true;
      }
      imageCount += 1;
      return imageCount <= EDITORIAL_GALLERY_MAX_ITEMS;
    });
  }
  next.attrs = {
    ...attrs,
    kind,
    ...editorialGalleryNodeAttributes(
      editorialGallerySettingsFromNodeAttributes(attrs, kind),
      kind
    ),
  };
  return next;
}

export function parseEditorialGalleryUrls(value: string) {
  return value
    .split(/\r?\n/u)
    .map((item) => safeHttpsUrl(item))
    .filter(Boolean)
    .slice(0, EDITORIAL_GALLERY_MAX_ITEMS);
}

export function normalizeEditorialGalleryItems(
  items: ReadonlyArray<string | EditorialGalleryItemInput>
) {
  return items
    .flatMap((item) => {
      const input: EditorialGalleryItemInput =
        typeof item === "string" ? { src: item } : item;
      const src = safeHttpsUrl(input.src);
      if (!src) return [];
      return [
        {
          src,
          mediaId: safeMediaId(input.mediaId),
          alt: typeof input.alt === "string" ? input.alt.trim().slice(0, 500) : "",
          caption:
            typeof input.caption === "string" ? input.caption.trim().slice(0, 600) : "",
          credit:
            typeof input.credit === "string" ? input.credit.trim().slice(0, 300) : "",
          source:
            typeof input.source === "string" ? input.source.trim().slice(0, 600) : "",
          license:
            typeof input.license === "string" ? input.license.trim().slice(0, 300) : "",
          licenseUrl: safeHttpsUrl(input.licenseUrl),
          link: safeHttpsUrl(input.link),
        },
      ];
    })
    .slice(0, EDITORIAL_GALLERY_MAX_ITEMS);
}

export function mergeEditorialGalleryItems(
  ...groups: ReadonlyArray<ReadonlyArray<string | EditorialGalleryItemInput>>
) {
  const seenMediaIds = new Set<string>();
  const seenSources = new Set<string>();
  return groups
    .flatMap((items) => normalizeEditorialGalleryItems(items))
    .filter((item) => {
      if (
        seenSources.has(item.src) ||
        (item.mediaId !== null && seenMediaIds.has(item.mediaId))
      ) {
        return false;
      }
      seenSources.add(item.src);
      if (item.mediaId !== null) seenMediaIds.add(item.mediaId);
      return true;
    })
    .slice(0, EDITORIAL_GALLERY_MAX_ITEMS);
}

/**
 * Reorders an already validated gallery without re-normalizing its items.
 * Keeping this operation pure lets the composer and the TipTap node view use
 * exactly the same final-index semantics for arrows and drag-and-drop.
 */
export function reorderEditorialGalleryItems<Item>(
  items: ReadonlyArray<Item>,
  fromIndex: number,
  toIndex: number
) {
  const next = [...items];
  if (
    !Number.isInteger(fromIndex) ||
    !Number.isInteger(toIndex) ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= next.length ||
    toIndex >= next.length ||
    fromIndex === toIndex
  ) {
    return next;
  }

  const removed = next.splice(fromIndex, 1);
  if (!removed.length) return next;
  next.splice(toIndex, 0, removed[0]);
  return next;
}
