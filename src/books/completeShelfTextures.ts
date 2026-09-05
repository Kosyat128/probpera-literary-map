import {
  CanvasTexture,
  ClampToEdgeWrapping,
  LinearFilter,
  LinearMipmapLinearFilter,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
} from "three";

import { BookDossierTypographyTokens, OwnerBookTypographyTokens, bookTypographyIsReady, fitBookText, type BookTextLayout } from "./bookTypography";

import { SharedAsyncLru } from "./sharedAsyncLru";

import {
  normalizeCompleteShelfCoverUrl,
  normalizeCompleteShelfText,
  type CompleteShelfBookSpec,
  type CompleteShelfFoilMotif,
} from "./completeShelfModel";
const textureColor = (value: string, fallback: string) =>
  /^#[0-9a-f]{6}$/iu.test(value.trim()) ? value.trim() : fallback;

export function resolveCompleteShelfSpineTextColor(_baseColor: string, _foilColor: string) {
  return OwnerBookTypographyTokens.ivory;
}

export type CompleteShelfArtworkPlan = Readonly<{
  titleLines: readonly string[];
  frontWriterLines: readonly string[];
  spineTitleLines: readonly string[];
  spineWriterLines: readonly string[];
  spineTitle: string;
  writer: string;
  yearLabel: string;
  baseColor: string;
  accentColor: string;
  paperColor: string;
  foilColor: string;
  motif: CompleteShelfFoilMotif;
  hasCoverArtwork: boolean;
  textCoverLayout: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
}>;

export type CompleteShelfArtworkTextures = Readonly<{
  frontFoil: CanvasTexture | null;
  frontFoilEmboss: CanvasTexture | null;
  spineFoil: CanvasTexture | null;
  spineFoilEmboss: CanvasTexture | null;
  spineSurface: CanvasTexture | null;
}>;

export type CompleteShelfClothSurfaceMaps = Readonly<{
  normal: CanvasTexture | null;
  roughness: CanvasTexture | null;
}>;

export type CompleteShelfPageEdgeTextures = Readonly<{
  fore: CanvasTexture | null;
  headTail: CanvasTexture | null;
}>;

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function wrapCompleteShelfArtworkText(
  value: string,
  maximumCharacters: number,
  maximumLines: number
) {
  const words = normalizeCompleteShelfText(value, 180).split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? current + " " + word : word;
    if (candidate.length <= maximumCharacters || !current) {
      current = candidate.slice(0, maximumCharacters);
      continue;
    }
    lines.push(current);
    current = word.slice(0, maximumCharacters);
    if (lines.length === maximumLines) break;
  }
  if (current && lines.length < maximumLines) lines.push(current);
  if (words.join(" ").length > lines.join(" ").length && lines.length) {
    const last = lines.length - 1;
    lines[last] =
      lines[last].slice(0, Math.max(1, maximumCharacters - 1)).trimEnd() + "…";
  }
  return Object.freeze(lines);
}

function wrapCompleteShelfTextWithoutLoss(
  value: string,
  characterLimit: number,
  maximumCharacters: number
) {
  const normalized = normalizeCompleteShelfText(value, maximumCharacters);
  const words = normalized.split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";
  const limit = Math.max(1, Math.trunc(characterLimit));

  for (const word of words) {
    let remainder = word;
    while (remainder) {
      if (current) {
        const available = limit - current.length - 1;
        if (available >= remainder.length) {
          current += " " + remainder;
          remainder = "";
          continue;
        }
        lines.push(current);
        current = "";
        continue;
      }
      const canSplitByGlyph =
        /[\u3040-\u30ff\u3400-\u9fff]/u.test(remainder) &&
        !/[()[\]{}]/u.test(remainder);
      if (remainder.length <= limit || !canSplitByGlyph) {
        current = remainder;
        remainder = "";
      } else {
        lines.push(remainder.slice(0, limit));
        remainder = remainder.slice(limit);
      }
    }
  }
  if (current) lines.push(current);
  return lines;
}

export function wrapCompleteShelfWriterText(
  value: string,
  preferredCharacters = 13,
  maximumLines = 6
) {
  const normalized = normalizeCompleteShelfText(value, 120);
  if (!normalized) return Object.freeze([]) as readonly string[];
  const boundedLines = Math.max(1, Math.trunc(maximumLines));
  let characterLimit = Math.max(1, Math.trunc(preferredCharacters));
  let lines = wrapCompleteShelfTextWithoutLoss(
    normalized,
    characterLimit,
    120
  );
  while (lines.length > boundedLines && characterLimit < normalized.length) {
    characterLimit += 1;
    lines = wrapCompleteShelfTextWithoutLoss(
      normalized,
      characterLimit,
      120
    );
  }
  return Object.freeze(lines);
}

export function wrapCompleteShelfTitleText(
  value: string,
  preferredCharacters = 16,
  maximumLines = 5
) {
  const normalized = normalizeCompleteShelfText(value, 180);
  if (!normalized) return Object.freeze([]) as readonly string[];
  const boundedLines = Math.max(1, Math.trunc(maximumLines));
  let characterLimit = Math.max(1, Math.trunc(preferredCharacters));
  let lines = wrapCompleteShelfTextWithoutLoss(
    normalized,
    characterLimit,
    180
  );
  while (lines.length > boundedLines && characterLimit < normalized.length) {
    characterLimit += 1;
    lines = wrapCompleteShelfTextWithoutLoss(
      normalized,
      characterLimit,
      180
    );
  }
  return Object.freeze(lines);
}

export function buildCompleteShelfArtworkPlan(
  spec: CompleteShelfBookSpec
): CompleteShelfArtworkPlan {
  const spineTitleCharacterTarget = /[\u3040-\u30ff\u3400-\u9fff]/u.test(
    spec.title
  )
    ? 6
    : 8;
  return Object.freeze({
    titleLines: wrapCompleteShelfTitleText(spec.title, 18, 5),
    frontWriterLines: wrapCompleteShelfWriterText(spec.writer, 22, 4),
    // CJK titles have no spaces to guide wrapping, so they use shorter lines.
    // Other scripts keep an eight-character target to avoid splitting common
    // words such as «Голодный» while retaining a large readable type size.
    spineTitleLines: wrapCompleteShelfTitleText(
      spec.title,
      spineTitleCharacterTarget,
      8
    ),
    spineWriterLines: wrapCompleteShelfWriterText(spec.writer, 10, 7),
    spineTitle: normalizeCompleteShelfText(spec.title, 180),
    writer: normalizeCompleteShelfText(spec.writer, 120),
    yearLabel: spec.year ? String(spec.year) : "",
    baseColor: spec.baseColor,
    accentColor: spec.accentColor,
    paperColor: spec.paperColor,
    foilColor: spec.foilColor,
    motif: spec.motif,
    hasCoverArtwork: false,
    textCoverLayout: 0,
  });
}

function createTexture(
  width: number,
  height: number,
  paint: (context: CanvasRenderingContext2D) => void,
  dataTexture = false,
  anisotropy = dataTexture ? 2 : 8
) {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return null;
  paint(context);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = dataTexture ? NoColorSpace : SRGBColorSpace;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = true;
  // Three clamps this value to the renderer/device maximum.  Keeping the
  // requested value on the texture gives oblique spines and the extracted
  // cover enough sampling quality without creating additional live meshes.
  texture.anisotropy = anisotropy;
  texture.needsUpdate = true;
  return texture;
}

export function resolveCompleteShelfCoverTextureSize({
  naturalWidth,
  naturalHeight,
  coverAspectRatio,
  economical,
  maximumHeight,
}: {
  naturalWidth: number;
  naturalHeight: number;
  coverAspectRatio: number;
  economical: boolean;
  maximumHeight?: number;
}) {
  const safeAspectRatio = Math.min(0.72, Math.max(0.42, coverAspectRatio));
  const safeMaximumHeight =
    typeof maximumHeight === "number" && Number.isFinite(maximumHeight)
      ? Math.min(2048, Math.max(256, Math.trunc(maximumHeight)))
      : null;
  const widthCap = safeMaximumHeight
    ? Math.max(1, Math.floor(safeMaximumHeight * safeAspectRatio))
    : economical
      ? 320
      : 1024;
  // Bound the physical-board canvas by usable native pixels on both axes so
  // a small archive image is never blurred by an artificial upscale, while
  // large originals retain the high-quality 1024 px selected-book path.
  const nativeFillWidth = Math.min(
    Math.max(1, naturalWidth),
    Math.max(1, naturalHeight) * safeAspectRatio
  );
  const width = Math.max(1, Math.floor(Math.min(widthCap, nativeFillWidth)));
  const height = Math.max(1, Math.floor(width / safeAspectRatio));
  return Object.freeze({ width, height, aspectRatio: safeAspectRatio });
}

export function resolveCompleteShelfCoverContainRect({
  naturalWidth,
  naturalHeight,
  targetWidth,
  targetHeight,
}: {
  naturalWidth: number;
  naturalHeight: number;
  targetWidth: number;
  targetHeight: number;
}) {
  const safeNaturalWidth = Math.max(1, Number(naturalWidth) || 1);
  const safeNaturalHeight = Math.max(1, Number(naturalHeight) || 1);
  const safeTargetWidth = Math.max(1, Number(targetWidth) || 1);
  const safeTargetHeight = Math.max(1, Number(targetHeight) || 1);
  const scale = Math.min(
    1,
    safeTargetWidth / safeNaturalWidth,
    safeTargetHeight / safeNaturalHeight
  );
  const width = safeNaturalWidth * scale;
  const height = safeNaturalHeight * scale;
  return Object.freeze({
    x: (safeTargetWidth - width) / 2,
    y: (safeTargetHeight - height) / 2,
    width,
    height,
  });
}

export function isCompleteShelfCoverTextureUrlAllowed(
  value: string,
  siteOrigin =
    typeof window !== "undefined" && window.location
      ? window.location.origin
      : ""
) {
  const normalizedUrl = normalizeCompleteShelfCoverUrl(value);
  if (!normalizedUrl) return false;
  const scheme = normalizedUrl.match(/^([a-z][a-z\d+.-]*):/iu)?.[1];
  if (!scheme) return true;
  if (!/^https?$/iu.test(scheme) || !siteOrigin) return false;
  try {
    const target = new URL(normalizedUrl);
    const site = new URL(siteOrigin);
    return (
      !target.username &&
      !target.password &&
      target.origin === site.origin
    );
  } catch {
    return false;
  }
}

function createFoilTexture(
  width: number,
  height: number,
  paint: (context: CanvasRenderingContext2D) => void,
  anisotropy: number
) {
  const texture = createTexture(width, height, (context) => {
    context.clearRect(0, 0, width, height);
    paint(context);
  }, false, anisotropy);
  if (texture) texture.premultiplyAlpha = true;
  return texture;
}

function createEmbossTexture(
  source: CanvasTexture | null,
  economical: boolean
) {
  if (!source) return null;
  const texture = new CanvasTexture(source.image);
  texture.colorSpace = NoColorSpace;
  texture.wrapS = source.wrapS;
  texture.wrapT = source.wrapT;
  texture.repeat.copy(source.repeat);
  texture.offset.copy(source.offset);
  texture.center.copy(source.center);
  texture.rotation = source.rotation;
  texture.anisotropy = economical ? 4 : 16;
  texture.needsUpdate = true;
  return texture;
}

export function resolveCompleteShelfSpineOrnamentLayout(
  width: number,
  height: number,
  centerRatio: number
) {
  const safeWidth = Math.max(8, Math.round(width));
  const safeHeight = Math.max(8, Math.round(height));
  const centerX = safeWidth / 2;
  const lineWidth = Math.max(1, Math.round(safeWidth * 0.01));
  const rawCenterY =
    safeHeight * Math.max(0.05, Math.min(0.95, centerRatio));
  const centerY =
    lineWidth % 2 === 0 ? Math.round(rawCenterY) : Math.floor(rawCenterY) + 0.5;
  const dotRadius = Math.max(2, Math.round(safeWidth * 0.022));
  const centerGap = Math.max(2, Math.round(safeWidth * 0.022));
  const lineLength = Math.max(
    4,
    Math.floor(
      (safeWidth * 0.68 - (dotRadius + centerGap) * 2) / 2
    )
  );
  const leftEnd = centerX - dotRadius - centerGap;
  const rightStart = centerX + dotRadius + centerGap;
  return Object.freeze({
    centerX,
    centerY,
    lineWidth,
    dotRadius,
    left: leftEnd - lineLength,
    leftEnd,
    rightStart,
    right: rightStart + lineLength,
  });
}

function paintSpineBinderOrnament(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  centerRatio: number,
  foilColor: string
) {
  const layout = resolveCompleteShelfSpineOrnamentLayout(
    width,
    height,
    centerRatio
  );
  context.save();
  context.strokeStyle = foilColor;
  context.fillStyle = foilColor;
  context.lineWidth = layout.lineWidth;
  context.lineCap = "butt";
  context.beginPath();
  context.moveTo(layout.left, layout.centerY);
  context.lineTo(layout.leftEnd, layout.centerY);
  context.moveTo(layout.rightStart, layout.centerY);
  context.lineTo(layout.right, layout.centerY);
  context.stroke();
  context.beginPath();
  context.arc(
    layout.centerX,
    layout.centerY,
    layout.dotRadius,
    0,
    Math.PI * 2
  );
  context.fill();
  context.restore();
}

type ShelfTextContext = Pick<CanvasRenderingContext2D, "font" | "measureText">;

export function resolveCompleteShelfTypography(
  context: ShelfTextContext,
  spec: CompleteShelfBookSpec
) {
  const height = OwnerBookTypographyTokens.referenceHeight;
  const physicalWidth = spec.dimensions.pageDepth + spec.dimensions.boardThickness * 1.88;
  const width = height * physicalWidth / (spec.dimensions.height - 0.012);
  const fit = (text: string, role: "title" | "author", front = false) => {
    const token = OwnerBookTypographyTokens[role];
    const zone = OwnerBookTypographyTokens[role === "title" ? "titleZone" : "authorZone"];
    return fitBookText({
      text,
      width: front ? 1000 * spec.dimensions.coverWidth / spec.dimensions.height * .78 : width * OwnerBookTypographyTokens.safeWidth,
      height: front ? (role === "title" ? 260 : 180) : height * (zone.bottom - zone.top),
      maximumFontSize: front ? (role === "title" ? 58 : 34) : token.maximum,
      minimumFontSize: front ? (role === "title" ? 25 : 23) : token.minimum,
      maximumLines: front ? 7 : 8,
      leading: token.leading,
      measure: (line, size) => {
        context.font = token.weight + " " + size + "px " + BookDossierTypographyTokens.serif;
        return context.measureText(line).width;
      },
    });
  };
  return Object.freeze({
    width, height,
    title: fit(spec.title, "title"),
    author: fit(spec.writer, "author"),
    frontTitle: fit(spec.title, "title", true),
    frontAuthor: fit(spec.writer, "author", true),
  });
}

function paintOwnerText(
  context: CanvasRenderingContext2D,
  layout: BookTextLayout,
  centerX: number,
  centerY: number
) {
  if (!layout.fits) return;
  context.save();
  context.textAlign = "center";
  context.textBaseline = "alphabetic";
  context.font = "600 " + layout.fontSize + "px " + BookDossierTypographyTokens.serif;
  context.fillStyle = OwnerBookTypographyTokens.ivory;
  context.strokeStyle = OwnerBookTypographyTokens.sepia;
  context.lineWidth = layout.fontSize * .026;
  context.lineJoin = "round";
  // The coincident fine outline is optical separation, never an offset shadow.
  const first = context.measureText(layout.lines[0] || "");
  const last = context.measureText(layout.lines[layout.lines.length - 1] || "");
  const ascent = first.actualBoundingBoxAscent || layout.fontSize * .75;
  const descent = last.actualBoundingBoxDescent || layout.fontSize * .22;
  const baseline = centerY - ((layout.lines.length - 1) * layout.lineHeight - ascent + descent) / 2;
  layout.lines.forEach((line, index) => {
    const y = baseline + index * layout.lineHeight;
    context.strokeText(line, centerX, y);
    context.fillText(line, centerX, y);
  });
  context.restore();
}

function paintPublisherMark(context: CanvasRenderingContext2D, width: number) {
  // Reuses the project's BrandQuillIcon geometry, without a surrounding medallion.
  const quill = new Path2D("M53.8 7.4c-11.9 1-21.6 5.6-28.9 13.8-7.1 7.9-10.3 17.2-9.6 27.9 4.1-1.6 8-3.8 11.5-6.6 7.2-5.6 12.7-12.7 16.4-21.3-2.5 7.5-6.8 14.1-12.9 19.8-4.6 4.4-9.9 7.7-15.8 10.1l-5.2 5.1 2.7 2.7 5.1-5.2c2.9-.1 5.8-.7 8.7-1.8 3.7-1.4 7-3.4 9.9-5.9l-8.9-.2c4.7-1.4 9-3.7 12.9-6.9 2.7-2.3 5.1-4.9 7-7.8l-10.6 1.2c4.9-2.4 9.1-5.7 12.5-9.8 2.5-3 4.4-6.4 5.7-10.2l-10.9 3.2c4.4-2.8 7.9-6.5 10.4-11.1Z M9.7 55.2 4.9 60l6.6-1.8 1.8-1.8-3.6-1.2Z");
  context.save();
  context.translate(width / 2 - 29, 700);
  context.scale(58 / 64, 58 / 64);
  context.fillStyle = OwnerBookTypographyTokens.rule;
  context.fill(quill);
  context.restore();
  context.fillStyle = OwnerBookTypographyTokens.ivory;
  context.textAlign = "center";
  context.font = "600 21px " + BookDossierTypographyTokens.serif;
  context.fillText("Пробы пера", width / 2, 798);
}

function paintFrontBinderRule(context: CanvasRenderingContext2D, width: number, y: number) {
  context.save();
  context.strokeStyle = OwnerBookTypographyTokens.rule;
  context.fillStyle = OwnerBookTypographyTokens.rule;
  context.lineWidth = 1.6;
  context.beginPath();
  context.moveTo(width * .16, y);
  context.lineTo(width / 2 - 12, y);
  context.moveTo(width / 2 + 12, y);
  context.lineTo(width * .84, y);
  context.stroke();
  context.beginPath();
  context.arc(width / 2, y, 2.8, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

export function createCompleteShelfArtworkTextures(
  spec: CompleteShelfBookSpec,
  economical: boolean,
  includeFrontFoil = true,
  quality?: Readonly<{ height: number; anisotropy: number }>
): CompleteShelfArtworkTextures {
  const unavailable = Object.freeze({ frontFoil: null, frontFoilEmboss: null, spineFoil: null, spineFoilEmboss: null, spineSurface: null });
  if (!bookTypographyIsReady()) return unavailable;
  const plan = buildCompleteShelfArtworkPlan(spec);
  const frontHeight = quality ? Math.min(2048, Math.max(256, Math.trunc(quality.height))) : economical ? 512 : 1536;
  const textureAnisotropy = quality ? Math.min(16, Math.max(1, Math.trunc(quality.anisotropy))) : economical ? 4 : 12;
  const frontDesignWidth = 1000 * spec.dimensions.coverWidth / spec.dimensions.height;
  const frontWidth = Math.round(frontHeight * frontDesignWidth / 1000);
  const measurement = document.createElement("canvas").getContext("2d");
  if (!measurement) return unavailable;
  const typography = resolveCompleteShelfTypography(measurement, spec);
  // A title that cannot fit its approved zone requires the accessible DOM view.
  // Never crop, invent an abbreviation, squeeze glyphs, or silently omit a name.
  if (![typography.title, typography.author, ...(includeFrontFoil ? [typography.frontTitle, typography.frontAuthor] : [])].every((layout) => layout.fits)) return unavailable;
  const spineWidth = Math.round(frontHeight * typography.width / typography.height);
  const frontFoil = !includeFrontFoil ? null : createFoilTexture(frontWidth, frontHeight, (context) => {
    context.scale(frontHeight / 1000, frontHeight / 1000);
    paintFrontBinderRule(context, frontDesignWidth, 90);
    paintFrontBinderRule(context, frontDesignWidth, 910);
    paintOwnerText(context, typography.frontTitle, frontDesignWidth / 2, 310);
    paintOwnerText(context, typography.frontAuthor, frontDesignWidth / 2, 550);
    paintPublisherMark(context, frontDesignWidth);
    if (plan.yearLabel) {
      context.fillStyle = OwnerBookTypographyTokens.ivory;
      context.font = "400 18px " + BookDossierTypographyTokens.sans;
      context.fillText(plan.yearLabel, frontDesignWidth / 2, 852);
    }
  }, textureAnisotropy);
  const spineFoil = createFoilTexture(spineWidth, frontHeight, (context) => {
    context.scale(spineWidth / typography.width, frontHeight / typography.height);
    paintSpineBinderOrnament(context, typography.width, typography.height, OwnerBookTypographyTokens.topRule, OwnerBookTypographyTokens.rule);
    paintSpineBinderOrnament(context, typography.width, typography.height, OwnerBookTypographyTokens.bottomRule, OwnerBookTypographyTokens.rule);
    paintOwnerText(context, typography.title, typography.width / 2, typography.height * OwnerBookTypographyTokens.titleCenter);
    paintOwnerText(context, typography.author, typography.width / 2, typography.height * OwnerBookTypographyTokens.authorCenter);
  }, textureAnisotropy);
  const spineSurface = createTexture(spineWidth, frontHeight, (context) => {
    context.scale(spineWidth / typography.width, frontHeight / typography.height);
    const width = typography.width;
    const height = typography.height;
    const random = seededRandom(spec.seed ^ 0x5f31c2a9);
    context.fillStyle = textureColor(plan.baseColor, "#406872");
    context.fillRect(0, 0, width, height);
    const shade = context.createLinearGradient(0, 0, width, 0);
    shade.addColorStop(0, "rgba(0,0,0,.14)");
    shade.addColorStop(.08, "rgba(0,0,0,0)");
    shade.addColorStop(.48, "rgba(255,255,255,.016)");
    shade.addColorStop(.92, "rgba(0,0,0,0)");
    shade.addColorStop(1, "rgba(0,0,0,.12)");
    context.fillStyle = shade;
    context.fillRect(0, 0, width, height);
    // Same woven coordinates at every quality; LOD changes sampling only.
    context.lineWidth = .18;
    context.strokeStyle = "rgba(255,255,255,.06)";
    context.beginPath();
    for (let x = .8; x < width; x += 1.7) {
      context.moveTo(x, 0);
      context.lineTo(x, height);
    }
    for (let y = .8; y < height; y += 2.1) {
      context.moveTo(0, y);
      context.lineTo(width, y);
    }
    context.stroke();
    for (let thread = 0; thread < 1500; thread += 1) {
      const x = random() * width;
      const y = random() * height;
      const vertical = random() > .5;
      context.strokeStyle = random() > .5 ? "rgba(255,255,255,.055)" : "rgba(0,0,0,.035)";
      context.lineWidth = .24;
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x + (vertical ? 0 : 1 + random() * 3), y + (vertical ? 1 + random() * 4 : 0));
      context.stroke();
    }
  }, false, textureAnisotropy);
  return Object.freeze({
    frontFoil,
    frontFoilEmboss: createEmbossTexture(frontFoil, economical),
    spineFoil,
    spineFoilEmboss: createEmbossTexture(spineFoil, economical),
    spineSurface,
  });
}

const sharedCompleteShelfCoverImages = new SharedAsyncLru<HTMLImageElement>(32);

function loadSharedCompleteShelfCoverImage(normalizedUrl: string) {
  return sharedCompleteShelfCoverImages.getOrCreate(
    normalizedUrl,
    () =>
      new Promise<HTMLImageElement>((resolve, reject) => {
        const image = document.createElement("img");
        image.decoding = "async";
        if (/^https?:\/\//iu.test(normalizedUrl)) {
          image.crossOrigin = "anonymous";
        }
        image.onload = () => {
          const finish = () => resolve(image);
          if (typeof image.decode !== "function") {
            finish();
            return;
          }
          void image.decode().then(finish, finish);
        };
        image.onerror = () => reject(new Error("cover-image-load"));
        image.src = normalizedUrl;
      })
  );
}

export function loadCompleteShelfCoverTexture(
  {
    coverUrl,
    baseColor,
    coverAspectRatio,
    economical,
    maximumHeight,
    anisotropy,
  }: {
    coverUrl: string;
    baseColor: string;
    coverAspectRatio: number;
    economical: boolean;
    maximumHeight?: number;
    anisotropy?: number;
  },
  onReady: (texture: CanvasTexture) => void,
  onError: (reason: string) => void = () => {}
) {
  const normalizedUrl = normalizeCompleteShelfCoverUrl(coverUrl);
  if (
    !normalizedUrl ||
    !isCompleteShelfCoverTextureUrlAllowed(normalizedUrl) ||
    typeof document === "undefined"
  ) {
    if (typeof document !== "undefined") onError("cover-url-rejected");
    return () => {};
  }
  let cancelled = false;
  void loadSharedCompleteShelfCoverImage(normalizedUrl).then((image) => {
    if (cancelled) return;
    if (!image.naturalWidth || !image.naturalHeight) {
      onError("cover-image-empty");
      return;
    }
    const { width, height } = resolveCompleteShelfCoverTextureSize({
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      coverAspectRatio,
      economical,
      maximumHeight,
    });
    const texture = createTexture(width, height, (context) => {
      context.fillStyle = textureColor(baseColor, "#27364a");
      context.fillRect(0, 0, width, height);
      // Keep every authored pixel of the allowed cover.  The board may show a
      // narrow binding-colour margin when the edition aspect ratio differs;
      // the artwork itself is never cropped, stretched, or recoloured.
      const contain = resolveCompleteShelfCoverContainRect({
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
        targetWidth: width,
        targetHeight: height,
      });
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(
        image,
        contain.x,
        contain.y,
        contain.width,
        contain.height
      );
    }, false, anisotropy ?? (economical ? 4 : 16));
    if (!texture) {
      onError("cover-texture-allocation");
      return;
    }
    if (cancelled) {
      texture.dispose();
      return;
    }
    onReady(texture);
  }, () => {
    if (!cancelled) onError("cover-image-load");
  });
  return () => {
    cancelled = true;
  };
}

export function createCompleteShelfClothMap(economical: boolean) {
  const size = economical ? 96 : 256;
  const texture = createTexture(
    size,
    size,
    (context) => {
      context.scale(size / 256, size / 256);
      context.fillStyle = "#929292";
      context.fillRect(0, 0, 256, 256);
      const threadStep = 8;
      for (let axis = 0; axis < 256; axis += threadStep) {
        context.fillStyle =
          axis % (threadStep * 2) === 0
            ? "rgba(255,255,255,.18)"
            : "rgba(0,0,0,.16)";
        context.fillRect(axis, 0, 1, 256);
        context.fillRect(0, axis + 1, 256, 1);
      }
      const random = seededRandom(0xc10f4a7);
      for (let fleck = 0; fleck < 768; fleck += 1) {
        const value = 110 + Math.round(random() * 62);
        context.fillStyle = `rgba(${value},${value},${value},.22)`;
        context.fillRect(
          Math.floor(random() * 256),
          Math.floor(random() * 256),
          1,
          1
        );
      }
    },
    true,
    economical ? 2 : 8
  );
  if (texture) {
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.repeat.set(6, 8);
  }
  return texture;
}

export function createCompleteShelfLeatherMap(economical: boolean) {
  const size = economical ? 96 : 256;
  const texture = createTexture(
    size,
    size,
    (context) => {
      context.fillStyle = "#8f8f8f";
      context.fillRect(0, 0, size, size);
      const random = seededRandom(0x1ea7ae51);
      const poreCount = economical ? size * 3 : size * 8;
      for (let pore = 0; pore < poreCount; pore += 1) {
        const x = random() * size;
        const y = random() * size;
        const radius = 0.22 + random() * (economical ? 0.7 : 1.15);
        const value = 70 + Math.round(random() * 92);
        context.fillStyle = `rgba(${value},${value},${value},${0.12 + random() * 0.22})`;
        context.beginPath();
        context.ellipse(
          x,
          y,
          radius * (0.65 + random() * 0.7),
          radius,
          random() * Math.PI,
          0,
          Math.PI * 2
        );
        context.fill();
      }
      const creaseCount = economical ? 12 : 34;
      for (let crease = 0; crease < creaseCount; crease += 1) {
        const y = random() * size;
        context.strokeStyle = `rgba(48,48,48,${0.055 + random() * 0.07})`;
        context.lineWidth = 0.35 + random() * 0.65;
        context.beginPath();
        context.moveTo(-size * 0.08, y);
        context.bezierCurveTo(
          size * 0.28,
          y + (random() - 0.5) * size * 0.08,
          size * 0.7,
          y + (random() - 0.5) * size * 0.08,
          size * 1.08,
          y + (random() - 0.5) * size * 0.03
        );
        context.stroke();
      }
    },
    true,
    economical ? 2 : 10
  );
  if (texture) {
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.repeat.set(economical ? 4 : 6, economical ? 7 : 10);
  }
  return texture;
}

export function createCompleteShelfClothSurfaceMaps(
  economical: boolean
): CompleteShelfClothSurfaceMaps {
  if (typeof document === "undefined") {
    return Object.freeze({ normal: null, roughness: null });
  }
  const size = economical ? 96 : 256;
  const heightField = new Float32Array(size * size);
  const normalCanvas = document.createElement("canvas");
  const roughnessCanvas = document.createElement("canvas");
  normalCanvas.width = roughnessCanvas.width = size;
  normalCanvas.height = roughnessCanvas.height = size;
  const normalContext = normalCanvas.getContext("2d");
  const roughnessContext = roughnessCanvas.getContext("2d");
  if (!normalContext || !roughnessContext) {
    return Object.freeze({ normal: null, roughness: null });
  }
  const normalImage = normalContext.createImageData(size, size);
  const roughnessImage = roughnessContext.createImageData(size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const warp = Math.sin(x / size * Math.PI * 24);
      const weft = Math.sin(y / size * Math.PI * 20);
      const cross = Math.sin((x + y) / size * Math.PI * 16);
      heightField[y * size + x] =
        0.5 + warp * 0.18 + weft * 0.15 + cross * 0.045;
    }
  }
  const sampleHeight = (x: number, y: number) =>
    heightField[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const source = y * size + x;
      const pixel = source * 4;
      const dx = (sampleHeight(x + 1, y) - sampleHeight(x - 1, y)) * size / 64;
      const dy = (sampleHeight(x, y + 1) - sampleHeight(x, y - 1)) * size / 64;
      const length = Math.hypot(dx, dy, 1);
      normalImage.data[pixel] = Math.round(((-dx / length) * 0.5 + 0.5) * 255);
      normalImage.data[pixel + 1] = Math.round(
        ((-dy / length) * 0.5 + 0.5) * 255
      );
      normalImage.data[pixel + 2] = Math.round(
        ((1 / length) * 0.5 + 0.5) * 255
      );
      normalImage.data[pixel + 3] = 255;
      const roughness = Math.round(188 + heightField[source] * 56);
      roughnessImage.data[pixel] = roughness;
      roughnessImage.data[pixel + 1] = roughness;
      roughnessImage.data[pixel + 2] = roughness;
      roughnessImage.data[pixel + 3] = 255;
    }
  }
  normalContext.putImageData(normalImage, 0, 0);
  roughnessContext.putImageData(roughnessImage, 0, 0);
  const configureMap = (canvas: HTMLCanvasElement) => {
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = NoColorSpace;
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.repeat.set(5, 8);
    texture.anisotropy = economical ? 2 : 12;
    texture.needsUpdate = true;
    return texture;
  };
  return Object.freeze({
    normal: configureMap(normalCanvas),
    roughness: configureMap(roughnessCanvas),
  });
}

export function createCompleteShelfLeatherSurfaceMaps(
  economical: boolean
): CompleteShelfClothSurfaceMaps {
  if (typeof document === "undefined") {
    return Object.freeze({ normal: null, roughness: null });
  }
  const size = economical ? 96 : 256;
  const heightField = new Float32Array(size * size);
  const random = seededRandom(0x5a17face);
  for (let index = 0; index < heightField.length; index += 1) {
    heightField[index] = 0.48 + (random() - 0.5) * 0.09;
  }
  const poreCount = economical ? size * 2 : size * 6;
  for (let pore = 0; pore < poreCount; pore += 1) {
    const centerX = Math.floor(random() * size);
    const centerY = Math.floor(random() * size);
    const radius = economical ? 1 : 1 + Math.floor(random() * 2);
    const depth = 0.08 + random() * 0.12;
    for (let y = -radius; y <= radius; y += 1) {
      for (let x = -radius; x <= radius; x += 1) {
        const distance = Math.hypot(x, y) / Math.max(1, radius);
        if (distance > 1) continue;
        const targetX = (centerX + x + size) % size;
        const targetY = (centerY + y + size) % size;
        heightField[targetY * size + targetX] -= depth * (1 - distance);
      }
    }
  }
  for (let y = 0; y < size; y += 1) {
    const wrinkle = Math.sin(y * 0.17) * 0.018 + Math.sin(y * 0.043) * 0.024;
    for (let x = 0; x < size; x += 1) {
      heightField[y * size + x] += wrinkle * Math.sin(x * 0.031 + y * 0.019);
    }
  }

  const normalCanvas = document.createElement("canvas");
  const roughnessCanvas = document.createElement("canvas");
  normalCanvas.width = roughnessCanvas.width = size;
  normalCanvas.height = roughnessCanvas.height = size;
  const normalContext = normalCanvas.getContext("2d");
  const roughnessContext = roughnessCanvas.getContext("2d");
  if (!normalContext || !roughnessContext) {
    return Object.freeze({ normal: null, roughness: null });
  }
  const normalImage = normalContext.createImageData(size, size);
  const roughnessImage = roughnessContext.createImageData(size, size);
  const sampleHeight = (x: number, y: number) =>
    heightField[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const source = y * size + x;
      const pixel = source * 4;
      const dx = (sampleHeight(x + 1, y) - sampleHeight(x - 1, y)) * 2.2;
      const dy = (sampleHeight(x, y + 1) - sampleHeight(x, y - 1)) * 2.2;
      const length = Math.hypot(dx, dy, 1);
      normalImage.data[pixel] = Math.round(((-dx / length) * 0.5 + 0.5) * 255);
      normalImage.data[pixel + 1] = Math.round(
        ((-dy / length) * 0.5 + 0.5) * 255
      );
      normalImage.data[pixel + 2] = Math.round(
        ((1 / length) * 0.5 + 0.5) * 255
      );
      normalImage.data[pixel + 3] = 255;
      const roughness = Math.max(
        170,
        Math.min(242, Math.round(218 + heightField[source] * 28))
      );
      roughnessImage.data[pixel] = roughness;
      roughnessImage.data[pixel + 1] = roughness;
      roughnessImage.data[pixel + 2] = roughness;
      roughnessImage.data[pixel + 3] = 255;
    }
  }
  normalContext.putImageData(normalImage, 0, 0);
  roughnessContext.putImageData(roughnessImage, 0, 0);
  const configureMap = (canvas: HTMLCanvasElement) => {
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = NoColorSpace;
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.repeat.set(economical ? 4 : 6, economical ? 7 : 10);
    texture.anisotropy = economical ? 2 : 12;
    texture.needsUpdate = true;
    return texture;
  };
  return Object.freeze({
    normal: configureMap(normalCanvas),
    roughness: configureMap(roughnessCanvas),
  });
}

export function createCompleteShelfPageEdgeTextures(
  economical: boolean
): CompleteShelfPageEdgeTextures {
  const makeEdge = (width: number, height: number, fore: boolean) =>
    createTexture(
      width,
      height,
      (context) => {
        const random = seededRandom(fore ? 0x54f4e36 : 0x7e12b45);
        context.fillStyle = "#dcd5c7";
        context.fillRect(0, 0, width, height);
        const pageStep = fore ? 2 : 1.35;
        for (let y = 0; y < height; y += pageStep) {
          const shade = Math.round(106 + random() * 74);
          const signature = random() > 0.965;
          context.strokeStyle = `rgba(${shade},${shade - 3},${
            shade - 9
          },${signature ? 0.34 : 0.13 + random() * 0.13})`;
          context.lineWidth = signature ? 1.05 : 0.42 + random() * 0.42;
          context.beginPath();
          context.moveTo(0, y + (random() - 0.5) * 0.5);
          context.bezierCurveTo(
            width * 0.3,
            y + (random() - 0.5) * 0.9,
            width * 0.72,
            y + (random() - 0.5) * 0.9,
            width,
            y + (random() - 0.5) * 0.5
          );
          context.stroke();
        }
        const shade = context.createLinearGradient(0, 0, width, 0);
        shade.addColorStop(0, "rgba(58,48,35,.18)");
        shade.addColorStop(0.035, "rgba(255,255,255,.04)");
        shade.addColorStop(0.86, "rgba(255,255,255,0)");
        shade.addColorStop(1, "rgba(58,48,35,.12)");
        context.fillStyle = shade;
        context.fillRect(0, 0, width, height);
      },
      false,
      economical ? 3 : 12
    );
  return Object.freeze({
    fore: makeEdge(economical ? 256 : 512, economical ? 768 : 2048, true),
    headTail: makeEdge(
      economical ? 768 : 2048,
      economical ? 160 : 384,
      false
    ),
  });
}

export function createCompleteShelfContactShadowTexture(
  economical: boolean
) {
  const width = economical ? 256 : 512;
  const height = economical ? 64 : 128;
  return createTexture(
    width,
    height,
    (context) => {
      const gradient = context.createRadialGradient(
        width / 2,
        height / 2,
        10,
        width / 2,
        height / 2,
        width * 0.496
      );
      gradient.addColorStop(0, "rgba(255,255,255,.95)");
      gradient.addColorStop(0.38, "rgba(255,255,255,.62)");
      gradient.addColorStop(0.72, "rgba(255,255,255,.18)");
      gradient.addColorStop(1, "rgba(255,255,255,0)");
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);
    },
    true,
    economical ? 2 : 8
  );
}

export function createCompleteShelfWoodMap(
  baseColor: string,
  economical: boolean
) {
  const width = economical ? 384 : 1024;
  const height = economical ? 96 : 256;
  const texture = createTexture(width, height, (context) => {
    const walnut = textureColor(baseColor, "#6a3b26");
    const ground = context.createLinearGradient(0, 0, 0, height);
    ground.addColorStop(0, "#8b5837");
    ground.addColorStop(0.46, walnut);
    ground.addColorStop(1, "#4b281b");
    context.fillStyle = ground;
    context.fillRect(0, 0, width, height);
    const random = seededRandom(0x51f15e);
    const grainLines = economical ? 36 : 84;
    for (let line = 0; line < grainLines; line += 1) {
      const y = random() * height;
      context.strokeStyle =
        line % 4 === 0
          ? `rgba(255,210,153,${0.055 + random() * 0.075})`
          : `rgba(34,12,5,${0.1 + random() * 0.13})`;
      context.lineWidth = 0.55 + random() * (economical ? 1.6 : 2.2);
      context.beginPath();
      context.moveTo(0, y);
      context.bezierCurveTo(
        width * 0.27,
        y + (random() - 0.5) * height * 0.12,
        width * 0.66,
        y + (random() - 0.5) * height * 0.12,
        width,
        y + (random() - 0.5) * height * 0.05
      );
      context.stroke();
    }
    const knotCount = economical ? 2 : 5;
    for (let knot = 0; knot < knotCount; knot += 1) {
      const x = width * (0.12 + random() * 0.76);
      const y = height * (0.18 + random() * 0.64);
      for (let ring = 0; ring < 4; ring += 1) {
        context.strokeStyle = `rgba(40,13,5,${0.13 - ring * 0.018})`;
        context.lineWidth = 0.8 + ring * 0.35;
        context.beginPath();
        context.ellipse(
          x,
          y,
          width * (0.012 + ring * 0.007),
          height * (0.026 + ring * 0.012),
          (random() - 0.5) * 0.22,
          0,
          Math.PI * 2
        );
        context.stroke();
      }
    }
    const gloss = context.createLinearGradient(0, 0, 0, height);
    gloss.addColorStop(0, "rgba(255,235,205,.15)");
    gloss.addColorStop(0.5, "rgba(255,255,255,0)");
    gloss.addColorStop(1, "rgba(18,7,3,.24)");
    context.fillStyle = gloss;
    context.fillRect(0, 0, width, height);
  }, false, economical ? 4 : 16);
  if (texture) {
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.repeat.set(2.65, 1);
  }
  return texture;
}

export function createCompleteShelfWoodDetailMap(economical: boolean) {
  const width = economical ? 256 : 512;
  const height = economical ? 64 : 128;
  const texture = createTexture(
    width,
    height,
    (context) => {
      context.fillStyle = "#c9c9c9";
      context.fillRect(0, 0, width, height);
      const random = seededRandom(0x77a1b2c3);
      const lines = economical ? 30 : 68;
      for (let line = 0; line < lines; line += 1) {
        const y = random() * height;
        const value = 108 + Math.round(random() * 96);
        context.strokeStyle = `rgba(${value},${value},${value},${0.18 + random() * 0.2})`;
        context.lineWidth = 0.65 + random() * 1.25;
        context.beginPath();
        context.moveTo(0, y);
        context.bezierCurveTo(
          width * 0.28,
          y + (random() - 0.5) * height * 0.11,
          width * 0.7,
          y + (random() - 0.5) * height * 0.11,
          width,
          y + (random() - 0.5) * height * 0.04
        );
        context.stroke();
      }
    },
    true,
    economical ? 4 : 12
  );
  if (texture) {
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.repeat.set(2.65, 1);
  }
  return texture;
}

export function disposeCompleteShelfTextures(
  textures: readonly (CanvasTexture | null | undefined)[]
) {
  textures.forEach((texture) => texture?.dispose());
}
