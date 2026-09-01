const imageLayouts = new Set(["wide", "normal", "full", "left", "right"]);
const imageAspects = new Set(["auto", "1-1", "4-3", "3-2", "16-9", "2-3"]);
const imageFits = new Set(["contain", "cover"]);
const imageAppearances = new Set(["clean", "frame", "shadow"]);
const imageReveals = new Set(["none", "fade-up", "zoom"]);

export const editorialImageDataAttributes = [
  "data-media-id",
  "data-caption",
  "data-image-layout",
  "data-image-width",
  "data-image-max-width",
  "data-image-aspect",
  "data-image-fit",
  "data-image-appearance",
  "data-image-reveal",
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

export type EditorialImagePublicAttributes = {
  mediaId: string;
  caption: string;
  layout: "wide" | "normal" | "full" | "left" | "right";
  width: number;
  maxWidth: number | null;
  aspect: "auto" | "1-1" | "4-3" | "3-2" | "16-9" | "2-3";
  fit: "contain" | "cover";
  appearance: "clean" | "frame" | "shadow";
  reveal: "none" | "fade-up" | "zoom";
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
  value: string | undefined,
  allowed: Set<string>,
  fallback: T
) {
  return value && allowed.has(value) ? (value as T) : fallback;
}

function boundedText(value: string | undefined, maximum: number) {
  return (value || "").trim().slice(0, maximum);
}

function finiteNumber(value: string | undefined, fallback: number) {
  const text = (value || "").trim();
  if (!/^-?\d+(?:\.\d+)?$/u.test(text)) return fallback;
  const number = Number(text);
  return Number.isFinite(number) ? number : fallback;
}

function boundedNumber(
  value: string | undefined,
  minimum: number,
  maximum: number,
  fallback: number
) {
  return Math.min(maximum, Math.max(minimum, finiteNumber(value, fallback)));
}

function boundedInteger(
  value: string | undefined,
  minimum: number,
  maximum: number,
  fallback: number
) {
  return Math.round(boundedNumber(value, minimum, maximum, fallback));
}

function booleanValue(value: string | undefined, fallback: boolean) {
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return fallback;
}

export function safeEditorialMediaUrl(value: string | undefined) {
  const text = boundedText(value, 2_000);
  if (!text) return "";
  if (text.startsWith("#")) return text;
  if (text.startsWith("/") && !text.startsWith("//")) return text;
  try {
    const url = new URL(text);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
  } catch {
    return "";
  }
}

export function normalizeEditorialImagePublicAttributes(
  attributes: Record<string, string | undefined>
): EditorialImagePublicAttributes {
  const rawMediaId = boundedText(attributes["data-media-id"], 80);
  const mediaId = /^[a-z0-9][a-z0-9_-]{0,79}$/iu.test(rawMediaId)
    ? rawMediaId
    : "";
  const rawMaxWidth = boundedInteger(
    attributes["data-image-max-width"],
    0,
    2_400,
    0
  );

  return {
    mediaId,
    caption: boundedText(attributes["data-caption"], 600),
    layout: enumValue(attributes["data-image-layout"], imageLayouts, "wide"),
    width: boundedInteger(attributes["data-image-width"], 20, 100, 100),
    maxWidth: rawMaxWidth > 0 ? Math.max(240, rawMaxWidth) : null,
    aspect: enumValue(attributes["data-image-aspect"], imageAspects, "auto"),
    fit: enumValue(attributes["data-image-fit"], imageFits, "contain"),
    // Existing content used this framed presentation before it became configurable.
    appearance: enumValue(
      attributes["data-image-appearance"],
      imageAppearances,
      "frame"
    ),
    reveal: enumValue(attributes["data-image-reveal"], imageReveals, "none"),
    focusX: boundedNumber(attributes["data-focus-x"], 0, 1, 0.5),
    focusY: boundedNumber(attributes["data-focus-y"], 0, 1, 0.5),
    credit: boundedText(attributes["data-credit"], 300),
    source: boundedText(attributes["data-source"], 600),
    license: boundedText(attributes["data-license"], 300),
    licenseUrl: safeEditorialMediaUrl(attributes["data-license-url"]),
    link: safeEditorialMediaUrl(attributes["data-link"]),
    lightbox: booleanValue(attributes["data-lightbox"], true),
    decorative: booleanValue(attributes["data-decorative"], false),
  };
}

export function canonicalEditorialImageData(
  attributes: EditorialImagePublicAttributes
) {
  return {
    ...(attributes.mediaId ? { "data-media-id": attributes.mediaId } : {}),
    ...(attributes.caption ? { "data-caption": attributes.caption } : {}),
    "data-image-layout": attributes.layout,
    "data-image-width": String(attributes.width),
    ...(attributes.maxWidth
      ? { "data-image-max-width": String(attributes.maxWidth) }
      : {}),
    "data-image-aspect": attributes.aspect,
    "data-image-fit": attributes.fit,
    "data-image-appearance": attributes.appearance,
    "data-image-reveal": attributes.reveal,
    "data-focus-x": attributes.focusX.toFixed(4),
    "data-focus-y": attributes.focusY.toFixed(4),
    ...(attributes.credit ? { "data-credit": attributes.credit } : {}),
    ...(attributes.source ? { "data-source": attributes.source } : {}),
    ...(attributes.license ? { "data-license": attributes.license } : {}),
    ...(attributes.licenseUrl
      ? { "data-license-url": attributes.licenseUrl }
      : {}),
    ...(attributes.link ? { "data-link": attributes.link } : {}),
    "data-lightbox": String(attributes.lightbox),
    "data-decorative": String(attributes.decorative),
  };
}

export function editorialImageFigureStyle(
  attributes: EditorialImagePublicAttributes
) {
  const declarations = [`--editorial-image-width: ${attributes.width}%`];
  if (attributes.maxWidth) {
    declarations.push(`--editorial-image-max-width: ${attributes.maxWidth}px`);
  }
  return declarations.join("; ");
}

export function editorialImageElementStyle(
  attributes: EditorialImagePublicAttributes
) {
  return [
    `--editorial-focus-x: ${(attributes.focusX * 100).toFixed(2)}%`,
    `--editorial-focus-y: ${(attributes.focusY * 100).toFixed(2)}%`,
  ].join("; ");
}
