const imageLayouts = new Set(["wide", "normal", "full", "left", "right"]);
const imageAspects = new Set(["auto", "1-1", "4-3", "3-2", "16-9", "2-3"]);
const imageFits = new Set(["contain", "cover"]);

export type EditorialImageLayout = "wide" | "normal" | "full" | "left" | "right";
export type EditorialImageAspect = "auto" | "1-1" | "4-3" | "3-2" | "16-9" | "2-3";
export type EditorialImageFit = "contain" | "cover";

export const editorialImageWidthPresets = [33, 50, 66, 75, 100] as const;

export type EditorialImageAttributes = {
  layout: EditorialImageLayout;
  width: number;
  maxWidth: number;
  aspect: EditorialImageAspect;
  fit: EditorialImageFit;
  focusX: number;
  focusY: number;
  credit: string;
  source: string;
  license: string;
  licenseUrl: string;
  link: string;
  lightbox: boolean;
  decorative: boolean;
};

function enumValue<T extends string>(
  value: unknown,
  allowed: Set<string>,
  fallback: T
): T {
  return typeof value === "string" && allowed.has(value)
    ? (value as T)
    : fallback;
}

function boundedNumber(value: unknown, minimum: number, maximum: number, fallback: number) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(maximum, Math.max(minimum, number));
}

function boundedInteger(value: unknown, minimum: number, maximum: number, fallback: number) {
  return Math.round(boundedNumber(value, minimum, maximum, fallback));
}

function boundedText(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

export function safeEditorialMediaUrl(value: unknown) {
  const text = boundedText(value, 2_000);
  if (!text) return "";
  if (text.startsWith("//")) return "";
  if (text.startsWith("/") || text.startsWith("#")) return text;
  try {
    const url = new URL(text);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
  } catch {
    return "";
  }
}

function safeEditorialImageSource(value: unknown) {
  const source = safeEditorialMediaUrl(value);
  return source.startsWith("#") ? "" : source;
}

function booleanValue(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return fallback;
}

export function normalizeEditorialImageAttributes(
  value: Record<string, unknown> = {}
): EditorialImageAttributes {
  const rawMaxWidth = boundedInteger(value.maxWidth, 0, 2_400, 0);
  return {
    layout: enumValue(value.layout, imageLayouts, "wide"),
    width: boundedInteger(value.width, 20, 100, 100),
    maxWidth: rawMaxWidth > 0 ? Math.max(240, rawMaxWidth) : 0,
    aspect: enumValue(value.aspect, imageAspects, "auto"),
    fit: enumValue(value.fit, imageFits, "contain"),
    focusX: boundedNumber(value.focusX, 0, 1, 0.5),
    focusY: boundedNumber(value.focusY, 0, 1, 0.5),
    credit: boundedText(value.credit, 300),
    source: boundedText(value.source, 600),
    license: boundedText(value.license, 300),
    licenseUrl: safeEditorialMediaUrl(value.licenseUrl),
    link: safeEditorialMediaUrl(value.link),
    lightbox: booleanValue(value.lightbox, true),
    decorative: booleanValue(value.decorative, false),
  };
}

export function editorialImageHtmlAttributes(value: Record<string, unknown>) {
  const normalized = normalizeEditorialImageAttributes(value);
  return {
    class: `article-image is-${normalized.layout} is-aspect-${normalized.aspect} is-fit-${normalized.fit}`,
    "data-image-layout": normalized.layout,
    "data-image-width": String(normalized.width),
    ...(normalized.maxWidth
      ? { "data-image-max-width": String(normalized.maxWidth) }
      : {}),
    "data-image-aspect": normalized.aspect,
    "data-image-fit": normalized.fit,
    "data-focus-x": normalized.focusX.toFixed(4),
    "data-focus-y": normalized.focusY.toFixed(4),
    ...(normalized.credit ? { "data-credit": normalized.credit } : {}),
    ...(normalized.source ? { "data-source": normalized.source } : {}),
    ...(normalized.license ? { "data-license": normalized.license } : {}),
    ...(normalized.licenseUrl ? { "data-license-url": normalized.licenseUrl } : {}),
    ...(normalized.link ? { "data-link": normalized.link } : {}),
    "data-lightbox": String(normalized.lightbox),
    "data-decorative": String(normalized.decorative),
  };
}

export const editorialImageDataAttributes = [
  "data-image-layout",
  "data-image-width",
  "data-image-max-width",
  "data-image-aspect",
  "data-image-fit",
  "data-focus-x",
  "data-focus-y",
  "data-credit",
  "data-source",
  "data-license",
  "data-license-url",
  "data-link",
  "data-lightbox",
  "data-decorative",
] as const;

/** Canonicalize the allowlisted image attributes after sanitize-html. */
export function safeEditorialImageHtmlAttributes(attributes: Record<string, string>) {
  const normalized = normalizeEditorialImageAttributes({
    layout: attributes["data-image-layout"],
    width: attributes["data-image-width"],
    maxWidth: attributes["data-image-max-width"],
    aspect: attributes["data-image-aspect"],
    fit: attributes["data-image-fit"],
    focusX: attributes["data-focus-x"],
    focusY: attributes["data-focus-y"],
    credit: attributes["data-credit"],
    source: attributes["data-source"],
    license: attributes["data-license"],
    licenseUrl: attributes["data-license-url"],
    link: attributes["data-link"],
    lightbox: attributes["data-lightbox"],
    decorative: attributes["data-decorative"],
  });
  const next = { ...attributes };
  const src = safeEditorialImageSource(attributes.src);
  if (src) next.src = src;
  else delete next.src;
  next.alt = normalized.decorative ? "" : boundedText(attributes.alt, 500);
  const title = boundedText(attributes.title, 500);
  if (title) next.title = title;
  else delete next.title;
  editorialImageDataAttributes.forEach((name) => delete next[name]);
  Object.assign(next, editorialImageHtmlAttributes(normalized));
  return next;
}

function sanitizedImageNodeAttrs(value: unknown) {
  const attrs = value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
  const normalized = normalizeEditorialImageAttributes(attrs);
  const src = safeEditorialImageSource(attrs.src);
  const mediaId = boundedText(attrs.mediaId, 80);
  const alt = normalized.decorative ? "" : boundedText(attrs.alt, 500);
  return {
    ...attrs,
    src,
    alt,
    title: boundedText(attrs.title, 500) || null,
    caption: boundedText(attrs.caption, 600),
    mediaId: mediaId || null,
    ...normalized,
  };
}

/**
 * Treat submitted TipTap JSON as untrusted while keeping unknown nodes intact
 * for forward and legacy compatibility.
 */
export function sanitizeEditorialMediaJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => sanitizeEditorialMediaJson(item));
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  const next: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(record)) {
    next[key] = sanitizeEditorialMediaJson(child);
  }
  if (record.type === "image") next.attrs = sanitizedImageNodeAttrs(record.attrs);
  return next;
}

export function editorialMediaAccessibilityIssues(value: unknown) {
  const issues: string[] = [];
  let index = 0;
  const visit = (candidate: unknown) => {
    if (Array.isArray(candidate)) {
      candidate.forEach(visit);
      return;
    }
    if (!candidate || typeof candidate !== "object") return;
    const record = candidate as Record<string, unknown>;
    if (record.type === "image") {
      index += 1;
      const attrs = sanitizedImageNodeAttrs(record.attrs);
      if (!attrs.decorative && attrs.alt.length < 3) {
        issues.push(`добавьте описание к изображению ${index} или отметьте его декоративным`);
      }
    }
    Object.values(record).forEach(visit);
  };
  visit(value);
  return issues;
}
