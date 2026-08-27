import {
  CanvasTexture,
  ClampToEdgeWrapping,
  LinearFilter,
  LinearMipmapLinearFilter,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
} from "three";

import {
  normalizeCompleteShelfCoverUrl,
  normalizeCompleteShelfText,
  type CompleteShelfBookSpec,
  type CompleteShelfFoilMotif,
} from "./completeShelfModel";
const textureColor = (value: string, fallback: string) =>
  /^#[0-9a-f]{6}$/iu.test(value.trim()) ? value.trim() : fallback;

const mixTextureColor = (
  value: string,
  target: "#000000" | "#ffffff",
  ratio: number
) => {
  const source = textureColor(value, "#d6b261");
  const targetChannel = target === "#ffffff" ? 255 : 0;
  const amount = Math.max(0, Math.min(1, ratio));
  return `#${[1, 3, 5]
    .map((offset) =>
      Math.round(
        Number.parseInt(source.slice(offset, offset + 2), 16) * (1 - amount) +
          targetChannel * amount
      )
        .toString(16)
        .padStart(2, "0")
    )
    .join("")}`;
};

const completeShelfRelativeLuminance = (value: string) => {
  const normalized = textureColor(value, "#000000");
  const channels = [1, 3, 5].map((offset) => {
    const channel =
      Number.parseInt(normalized.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};

const completeShelfColorContrast = (first: string, second: string) => {
  const firstLuminance = completeShelfRelativeLuminance(first);
  const secondLuminance = completeShelfRelativeLuminance(second);
  return (
    (Math.max(firstLuminance, secondLuminance) + 0.05) /
    (Math.min(firstLuminance, secondLuminance) + 0.05)
  );
};

export function resolveCompleteShelfSpineTextColor(
  baseColor: string,
  foilColor: string
) {
  // Use a single solid foil tone, selected for the binding rather than a
  // shadow/outline. This keeps every glyph crisp while preserving a warm
  // antique-gold appearance on both light and dark cloth.
  const candidates = [
    mixTextureColor(foilColor, "#ffffff", 0.72),
    mixTextureColor(foilColor, "#ffffff", 0.42),
    mixTextureColor(foilColor, "#ffffff", 0.26),
    textureColor(foilColor, "#d6b261"),
    mixTextureColor(foilColor, "#000000", 0.76),
  ];
  return candidates.reduce((best, candidate) =>
    completeShelfColorContrast(baseColor, candidate) >
    completeShelfColorContrast(baseColor, best)
      ? candidate
      : best
  );
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
    hasCoverArtwork: Boolean(spec.coverUrl),
    textCoverLayout: ((spec.seed >>> 4) & 7) as
      | 0
      | 1
      | 2
      | 3
      | 4
      | 5
      | 6
      | 7,
  });
}

const COMPLETE_SHELF_TEXT_COVER_LAYOUTS = Object.freeze([
  { medallionY: 0.245, firstRuleY: 0.36, titleY: 0.505, secondRuleY: 0.65, writerY: 0.745, motifY: 0.855 },
  { medallionY: 0.205, firstRuleY: 0.315, titleY: 0.455, secondRuleY: 0.61, writerY: 0.715, motifY: 0.86 },
  { medallionY: 0.285, firstRuleY: 0.39, titleY: 0.525, secondRuleY: 0.665, writerY: 0.77, motifY: 0.875 },
  { medallionY: 0.22, firstRuleY: 0.345, titleY: 0.49, secondRuleY: 0.625, writerY: 0.735, motifY: 0.845 },
  { medallionY: 0.26, firstRuleY: 0.375, titleY: 0.54, secondRuleY: 0.69, writerY: 0.785, motifY: 0.88 },
  { medallionY: 0.19, firstRuleY: 0.3, titleY: 0.44, secondRuleY: 0.59, writerY: 0.7, motifY: 0.835 },
  { medallionY: 0.3, firstRuleY: 0.405, titleY: 0.555, secondRuleY: 0.695, writerY: 0.79, motifY: 0.875 },
  { medallionY: 0.235, firstRuleY: 0.35, titleY: 0.475, secondRuleY: 0.62, writerY: 0.73, motifY: 0.87 },
] as const);

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
}: {
  naturalWidth: number;
  naturalHeight: number;
  coverAspectRatio: number;
  economical: boolean;
}) {
  const safeAspectRatio = Math.min(0.72, Math.max(0.42, coverAspectRatio));
  const widthCap = economical ? 320 : 1024;
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

function paintMotif(
  context: CanvasRenderingContext2D,
  motif: CompleteShelfFoilMotif,
  centerX: number,
  centerY: number,
  radius: number,
  foilColor: string
) {
  context.save();
  context.strokeStyle = foilColor;
  context.fillStyle = foilColor;
  context.lineWidth = Math.max(1.5, radius * 0.045);
  if (motif === "arch") {
    context.beginPath();
    context.arc(centerX, centerY + radius * 0.28, radius, Math.PI, 0);
    context.moveTo(centerX - radius, centerY + radius * 0.28);
    context.lineTo(centerX - radius, centerY + radius);
    context.moveTo(centerX + radius, centerY + radius * 0.28);
    context.lineTo(centerX + radius, centerY + radius);
    context.stroke();
  } else if (motif === "diamond") {
    context.beginPath();
    context.moveTo(centerX, centerY - radius);
    context.lineTo(centerX + radius * 0.72, centerY);
    context.lineTo(centerX, centerY + radius);
    context.lineTo(centerX - radius * 0.72, centerY);
    context.closePath();
    context.stroke();
  } else if (motif === "orbital") {
    context.beginPath();
    context.arc(centerX, centerY, radius * 0.42, 0, Math.PI * 2);
    context.stroke();
    context.beginPath();
    context.ellipse(centerX, centerY, radius, radius * 0.34, -0.45, 0, Math.PI * 2);
    context.stroke();
  } else {
    for (let offset = -1; offset <= 1; offset += 1) {
      context.beginPath();
      context.moveTo(centerX - radius, centerY + offset * radius * 0.32);
      context.lineTo(centerX + radius, centerY + offset * radius * 0.32);
      context.stroke();
    }
  }
  context.restore();
}

function paintLiteraryMedallion(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  foilColor: string
) {
  context.save();
  context.strokeStyle = foilColor;
  context.fillStyle = foilColor;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = Math.max(1.4, radius * 0.036);

  context.beginPath();
  context.ellipse(
    centerX,
    centerY,
    radius * 1.12,
    radius * 0.94,
    0,
    0,
    Math.PI * 2
  );
  context.stroke();
  context.globalAlpha = 0.46;
  context.beginPath();
  context.ellipse(
    centerX,
    centerY,
    radius * 0.96,
    radius * 0.8,
    0,
    0,
    Math.PI * 2
  );
  context.stroke();
  context.globalAlpha = 1;

  // An open book and quill make the archive identity legible at a glance.
  const bookY = centerY + radius * 0.24;
  context.beginPath();
  context.moveTo(centerX, bookY - radius * 0.22);
  context.bezierCurveTo(
    centerX - radius * 0.24,
    bookY - radius * 0.34,
    centerX - radius * 0.58,
    bookY - radius * 0.26,
    centerX - radius * 0.72,
    bookY - radius * 0.1
  );
  context.lineTo(centerX - radius * 0.72, bookY + radius * 0.24);
  context.bezierCurveTo(
    centerX - radius * 0.42,
    bookY + radius * 0.12,
    centerX - radius * 0.18,
    bookY + radius * 0.14,
    centerX,
    bookY + radius * 0.3
  );
  context.bezierCurveTo(
    centerX + radius * 0.18,
    bookY + radius * 0.14,
    centerX + radius * 0.42,
    bookY + radius * 0.12,
    centerX + radius * 0.72,
    bookY + radius * 0.24
  );
  context.lineTo(centerX + radius * 0.72, bookY - radius * 0.1);
  context.bezierCurveTo(
    centerX + radius * 0.58,
    bookY - radius * 0.26,
    centerX + radius * 0.24,
    bookY - radius * 0.34,
    centerX,
    bookY - radius * 0.22
  );
  context.closePath();
  context.stroke();
  context.beginPath();
  context.moveTo(centerX, bookY - radius * 0.2);
  context.lineTo(centerX, bookY + radius * 0.28);
  context.stroke();

  context.save();
  context.translate(centerX + radius * 0.06, centerY - radius * 0.12);
  context.rotate(-0.62);
  context.beginPath();
  context.moveTo(0, radius * 0.52);
  context.bezierCurveTo(
    -radius * 0.3,
    radius * 0.16,
    -radius * 0.22,
    -radius * 0.48,
    0,
    -radius * 0.62
  );
  context.bezierCurveTo(
    radius * 0.34,
    -radius * 0.34,
    radius * 0.28,
    radius * 0.2,
    0,
    radius * 0.52
  );
  context.stroke();
  context.beginPath();
  context.moveTo(0, radius * 0.58);
  context.lineTo(0, -radius * 0.5);
  context.stroke();
  for (const offset of [-0.34, -0.12, 0.1, 0.3]) {
    context.beginPath();
    context.moveTo(0, radius * offset);
    context.lineTo(-radius * 0.2, radius * (offset - 0.12));
    context.moveTo(0, radius * offset);
    context.lineTo(radius * 0.2, radius * (offset - 0.12));
    context.stroke();
  }
  context.restore();
  context.restore();
}

function paintSplitFoilRule(
  context: CanvasRenderingContext2D,
  width: number,
  y: number,
  foilColor: string,
  lineWidth: number
) {
  context.save();
  context.strokeStyle = foilColor;
  context.lineWidth = lineWidth;
  context.lineCap = "round";
  for (const [start, end] of [
    [0.16, 0.46],
    [0.54, 0.84],
  ] as const) {
    context.beginPath();
    context.moveTo(width * start, y);
    context.lineTo(width * end, y);
    context.stroke();
  }
  context.restore();
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

function withReadableFoilText(
  context: CanvasRenderingContext2D,
  paint: () => void
) {
  context.save();
  // Foil is a single clean metal mask. Shadows here produced a dark offset
  // contour after alpha sampling and made Cyrillic titles look doubled.
  context.shadowColor = "transparent";
  context.shadowBlur = 0;
  context.shadowOffsetX = 0;
  context.shadowOffsetY = 0;
  paint();
  context.restore();
}

function paintCenteredTextBlock(
  context: CanvasRenderingContext2D,
  lines: readonly string[],
  centerX: number,
  centerY: number,
  lineHeight: number
) {
  const firstBaseline = centerY - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, index) => {
    context.fillText(line, centerX, firstBaseline + index * lineHeight);
  });
}

function fitCompleteShelfTextBlock(
  context: CanvasRenderingContext2D,
  lines: readonly string[],
  maximumWidth: number,
  maximumHeight: number,
  maximumFontSize: number,
  minimumFontSize: number,
  fontWeight: number
) {
  if (!lines.length) {
    return Object.freeze({
      fontSize: minimumFontSize,
      lineHeight: minimumFontSize,
    });
  }
  const upper = Math.max(minimumFontSize, Math.floor(maximumFontSize));
  const lower = Math.max(1, Math.floor(minimumFontSize));
  for (let fontSize = upper; fontSize >= lower; fontSize -= 1) {
    const lineHeight = fontSize * 1.16;
    context.font = `${fontWeight} ${fontSize}px Georgia, "Times New Roman", serif`;
    if (
      lineHeight * lines.length <= maximumHeight &&
      lines.every((line) => context.measureText(line).width <= maximumWidth)
    ) {
      return Object.freeze({ fontSize, lineHeight });
    }
  }
  return Object.freeze({ fontSize: lower, lineHeight: lower * 1.16 });
}

export function createCompleteShelfArtworkTextures(
  spec: CompleteShelfBookSpec,
  economical: boolean,
  includeFrontFoil = true
): CompleteShelfArtworkTextures {
  const plan = buildCompleteShelfArtworkPlan(spec);
  const textCoverLayout =
    COMPLETE_SHELF_TEXT_COVER_LAYOUTS[plan.textCoverLayout];
  // Foil canvases are pure masks; the physical material supplies the actual
  // metal colour.  This keeps alphaMap luminance at one instead of making
  // darker copper/gold artwork accidentally translucent.
  const maskColor = "#ffffff";
  const frontHeight = economical ? 512 : 1536;
  const frontWidth = Math.round(
    frontHeight * (spec.dimensions.coverWidth / spec.dimensions.height)
  );
  const spineHeight = frontHeight;
  const spinePhysicalWidth =
    spec.dimensions.pageDepth + spec.dimensions.boardThickness * 1.88;
  const spineWidth = Math.round(
    spineHeight * (spinePhysicalWidth / (spec.dimensions.height - 0.012))
  );
  // The foil is the fail-closed text-cover fallback. When an authorized real
  // cover loads for the selected inspection book it replaces this front map
  // without altering the reusable archive binding or shelf spines.
  const frontFoil = !includeFrontFoil
    ? null
    : createFoilTexture(frontWidth, frontHeight, (context) => {
        const outerInset = frontWidth * 0.064;
        const innerInset = frontWidth * 0.086;
        context.strokeStyle = maskColor;
        context.fillStyle = maskColor;
        context.lineCap = "round";
        context.lineJoin = "round";
        context.lineWidth = Math.max(1.5, frontWidth * 0.0038);

        // A restrained double bookbinder frame gives the selected binding a
        // collectible-edition hierarchy without a heavy raster cover.
        context.globalAlpha = 0.86;
        context.strokeRect(
          outerInset,
          outerInset,
          frontWidth - outerInset * 2,
          frontHeight - outerInset * 2
        );
        context.globalAlpha = 0.42;
        context.strokeRect(
          innerInset,
          innerInset,
          frontWidth - innerInset * 2,
          frontHeight - innerInset * 2
        );
        context.globalAlpha = 1;

        for (const [x, y, xDirection, yDirection] of [
          [innerInset, innerInset, 1, 1],
          [frontWidth - innerInset, innerInset, -1, 1],
          [innerInset, frontHeight - innerInset, 1, -1],
          [frontWidth - innerInset, frontHeight - innerInset, -1, -1],
        ] as const) {
          const flourish = frontWidth * 0.055;
          context.beginPath();
          context.moveTo(x, y + yDirection * flourish);
          context.quadraticCurveTo(
            x + xDirection * flourish * 0.08,
            y + yDirection * flourish * 0.08,
            x + xDirection * flourish,
            y
          );
          context.stroke();
          context.beginPath();
          context.ellipse(
            x + xDirection * flourish * 0.34,
            y + yDirection * flourish * 0.34,
            frontWidth * 0.008,
            frontWidth * 0.015,
            xDirection * yDirection * -0.72,
            0,
            Math.PI * 2
          );
          context.stroke();
        }

        paintLiteraryMedallion(
          context,
          frontWidth / 2,
          frontHeight * textCoverLayout.medallionY,
          frontWidth * 0.125,
          maskColor
        );
        paintSplitFoilRule(
          context,
          frontWidth,
          frontHeight * textCoverLayout.firstRuleY,
          maskColor,
          Math.max(1.25, frontWidth * 0.003)
        );

        context.textAlign = "center";
        context.textBaseline = "middle";
        withReadableFoilText(context, () => {
          context.fillStyle = maskColor;
          const titleFit = fitCompleteShelfTextBlock(
            context,
            plan.titleLines,
            frontWidth * 0.76,
            frontHeight * 0.205,
            frontWidth * 0.078,
            frontWidth * 0.036,
            700
          );
          context.font =
            `700 ${titleFit.fontSize}px Georgia, "Times New Roman", serif`;
          paintCenteredTextBlock(
            context,
            plan.titleLines,
            frontWidth / 2,
            frontHeight * textCoverLayout.titleY,
            titleFit.lineHeight
          );
        });

        paintSplitFoilRule(
          context,
          frontWidth,
          frontHeight * textCoverLayout.secondRuleY,
          maskColor,
          Math.max(1.2, frontWidth * 0.0026)
        );
        withReadableFoilText(context, () => {
          context.fillStyle = maskColor;
          const writerFit = fitCompleteShelfTextBlock(
            context,
            plan.frontWriterLines,
            frontWidth * 0.7,
            frontHeight * 0.125,
            frontWidth * 0.044,
            frontWidth * 0.026,
            600
          );
          context.font =
            `600 ${writerFit.fontSize}px Georgia, "Times New Roman", serif`;
          paintCenteredTextBlock(
            context,
            plan.frontWriterLines,
            frontWidth / 2,
            frontHeight * textCoverLayout.writerY,
            writerFit.lineHeight
          );
        });

        paintMotif(
          context,
          plan.motif,
          frontWidth / 2,
          frontHeight * textCoverLayout.motifY,
          frontWidth * 0.032,
          maskColor
        );
        if (plan.yearLabel) {
          context.fillStyle = maskColor;
          context.font =
            "600 " + Math.round(frontWidth * 0.034) + "px Georgia, serif";
          context.fillText(
            plan.yearLabel,
            frontWidth / 2,
            frontHeight * 0.91
          );
        }
      }, economical ? 4 : 12);
  const spineGoldColor = textureColor(plan.foilColor, "#d6b261");
  const spineTextColor = resolveCompleteShelfSpineTextColor(
    plan.baseColor,
    spineGoldColor
  );
  const spineFoil = createFoilTexture(
    spineWidth,
    spineHeight,
    (context) => {
      context.strokeStyle = spineGoldColor;
      context.fillStyle = spineGoldColor;
      context.lineCap = "round";
      context.lineWidth = Math.max(1.5, spineWidth * 0.035);
      paintSpineBinderOrnament(
        context,
        spineWidth,
        spineHeight,
        0.09,
        spineGoldColor
      );
      paintSpineBinderOrnament(
        context,
        spineWidth,
        spineHeight,
        0.91,
        spineGoldColor
      );
      context.textAlign = "left";
      context.textBaseline = "middle";
      withReadableFoilText(context, () => {
        context.textAlign = "center";
        context.fillStyle = spineTextColor;
        const titleFit = fitCompleteShelfTextBlock(
          context,
          plan.spineTitleLines,
          spineWidth * 0.9,
          spineHeight * 0.29,
          spineWidth * 0.255,
          spineWidth * 0.075,
          700
        );
        context.font =
          `700 ${titleFit.fontSize}px Georgia, "Times New Roman", serif`;
        paintCenteredTextBlock(
          context,
          plan.spineTitleLines,
          spineWidth / 2,
          spineHeight * 0.27,
          titleFit.lineHeight
        );
        context.fillStyle = spineTextColor;
        const writerFit = fitCompleteShelfTextBlock(
          context,
          plan.spineWriterLines,
          spineWidth * 0.9,
          spineHeight * 0.25,
          spineWidth * 0.185,
          spineWidth * 0.07,
          700
        );
        context.font =
          `700 ${writerFit.fontSize}px Georgia, "Times New Roman", serif`;
        paintCenteredTextBlock(
          context,
          plan.spineWriterLines,
          spineWidth / 2,
          spineHeight * 0.565,
          writerFit.lineHeight
        );
      });
    },
    economical ? 4 : 12
  );
  const spineSurface = createTexture(
    spineWidth,
    spineHeight,
    (context) => {
      const random = seededRandom(spec.seed ^ 0x5f31c2a9);
      context.fillStyle = textureColor(plan.baseColor, "#27364a");
      context.fillRect(0, 0, spineWidth, spineHeight);
      const shade = context.createLinearGradient(0, 0, spineWidth, 0);
      shade.addColorStop(0, "rgba(0,0,0,.24)");
      shade.addColorStop(0.14, "rgba(255,255,255,.075)");
      shade.addColorStop(0.54, "rgba(255,255,255,.018)");
      shade.addColorStop(0.84, "rgba(255,255,255,.045)");
      shade.addColorStop(1, "rgba(0,0,0,.22)");
      context.fillStyle = shade;
      context.fillRect(0, 0, spineWidth, spineHeight);
      if (spec.binding === "leather") {
        const poreCount = economical ? 420 : 2300;
        for (let pore = 0; pore < poreCount; pore += 1) {
          const radius = 0.35 + random() * (economical ? 0.8 : 1.45);
          context.fillStyle =
            random() > 0.3
              ? `rgba(0,0,0,${0.018 + random() * 0.045})`
              : `rgba(255,255,255,${0.012 + random() * 0.026})`;
          context.beginPath();
          context.ellipse(
            random() * spineWidth,
            random() * spineHeight,
            radius * (0.62 + random() * 0.65),
            radius,
            random() * Math.PI,
            0,
            Math.PI * 2
          );
          context.fill();
        }
        const creaseCount = economical ? 14 : 46;
        for (let crease = 0; crease < creaseCount; crease += 1) {
          const y = random() * spineHeight;
          context.strokeStyle = `rgba(0,0,0,${0.026 + random() * 0.04})`;
          context.lineWidth = 0.45 + random() * 0.8;
          context.beginPath();
          context.moveTo(-spineWidth * 0.1, y);
          context.bezierCurveTo(
            spineWidth * 0.28,
            y + (random() - 0.5) * spineWidth * 0.18,
            spineWidth * 0.7,
            y + (random() - 0.5) * spineWidth * 0.18,
            spineWidth * 1.1,
            y + (random() - 0.5) * spineWidth * 0.08
          );
          context.stroke();
        }
      } else {
        const threadCount = economical ? 380 : 1900;
        for (let thread = 0; thread < threadCount; thread += 1) {
          const x = random() * spineWidth;
          const y = random() * spineHeight;
          const vertical = random() > 0.42;
          context.strokeStyle =
            random() > 0.5
              ? `rgba(255,255,255,${0.018 + random() * 0.038})`
              : `rgba(0,0,0,${0.018 + random() * 0.034})`;
          context.lineWidth = 0.45 + random() * 0.72;
          context.beginPath();
          context.moveTo(x, y);
          context.lineTo(
            vertical ? x + (random() - 0.5) * 1.2 : x + 8 + random() * 28,
            vertical ? y + 8 + random() * 34 : y + (random() - 0.5) * 1.2
          );
          context.stroke();
        }
      }
      const tailShade = context.createLinearGradient(
        0,
        spineHeight * 0.82,
        0,
        spineHeight
      );
      tailShade.addColorStop(0, "rgba(0,0,0,0)");
      tailShade.addColorStop(0.28, "rgba(8,6,10,.22)");
      tailShade.addColorStop(1, "rgba(7,5,9,.62)");
      context.fillStyle = tailShade;
      context.fillRect(0, 0, spineWidth, spineHeight);
    },
    false,
    economical ? 4 : 16
  );
  return Object.freeze({
    frontFoil,
    frontFoilEmboss: createEmbossTexture(frontFoil, economical),
    spineFoil,
    spineFoilEmboss: createEmbossTexture(spineFoil, economical),
    spineSurface,
  });
}

export function loadCompleteShelfCoverTexture(
  {
    coverUrl,
    baseColor,
    coverAspectRatio,
    economical,
  }: {
    coverUrl: string;
    baseColor: string;
    coverAspectRatio: number;
    economical: boolean;
  },
  onReady: (texture: CanvasTexture) => void
) {
  const normalizedUrl = normalizeCompleteShelfCoverUrl(coverUrl);
  if (
    !normalizedUrl ||
    !isCompleteShelfCoverTextureUrlAllowed(normalizedUrl) ||
    typeof document === "undefined"
  ) {
    return () => {};
  }
  const image = document.createElement("img");
  let cancelled = false;
  image.decoding = "async";
  if (/^https?:\/\//iu.test(normalizedUrl)) image.crossOrigin = "anonymous";
  image.onload = () => {
    if (cancelled || !image.naturalWidth || !image.naturalHeight) return;
    const { width, height } = resolveCompleteShelfCoverTextureSize({
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      coverAspectRatio,
      economical,
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
    }, false, economical ? 4 : 16);
    if (!texture) return;
    if (cancelled) {
      texture.dispose();
      return;
    }
    onReady(texture);
  };
  image.onerror = () => {};
  image.src = normalizedUrl;
  return () => {
    cancelled = true;
    image.onload = null;
    image.onerror = null;
    if (!image.complete) image.src = "";
  };
}

export function createCompleteShelfClothMap(economical: boolean) {
  const size = economical ? 96 : 256;
  const texture = createTexture(
    size,
    size,
    (context) => {
      context.fillStyle = "#929292";
      context.fillRect(0, 0, size, size);
      const threadStep = economical ? 4 : 3;
      for (let axis = 0; axis < size; axis += threadStep) {
        context.fillStyle =
          axis % (threadStep * 2) === 0
            ? "rgba(255,255,255,.18)"
            : "rgba(0,0,0,.16)";
        context.fillRect(axis, 0, 1, size);
        context.fillRect(0, axis + 1, size, 1);
      }
      const random = seededRandom(0xc10f4a7);
      for (let fleck = 0; fleck < size * 3; fleck += 1) {
        const value = 110 + Math.round(random() * 62);
        context.fillStyle = `rgba(${value},${value},${value},.22)`;
        context.fillRect(
          Math.floor(random() * size),
          Math.floor(random() * size),
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
    texture.repeat.set(economical ? 6 : 10, economical ? 8 : 14);
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
      const warp = Math.sin(x * Math.PI * 0.52);
      const weft = Math.sin(y * Math.PI * 0.41);
      const cross = Math.sin((x + y) * Math.PI * 0.19);
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
      const dx = (sampleHeight(x + 1, y) - sampleHeight(x - 1, y)) * 1.5;
      const dy = (sampleHeight(x, y + 1) - sampleHeight(x, y - 1)) * 1.5;
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
