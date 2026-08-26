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



export type CompleteShelfArtworkPlan = Readonly<{
  titleLines: readonly string[];
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

export function buildCompleteShelfArtworkPlan(
  spec: CompleteShelfBookSpec
): CompleteShelfArtworkPlan {
  return Object.freeze({
    titleLines: wrapCompleteShelfArtworkText(spec.title, 16, 4),
    spineTitleLines: wrapCompleteShelfArtworkText(spec.title, 11, 3),
    spineWriterLines: wrapCompleteShelfArtworkText(spec.writer, 12, 2),
    spineTitle: normalizeCompleteShelfText(spec.title, 52),
    writer: normalizeCompleteShelfText(spec.writer, 48),
    yearLabel: spec.year ? String(spec.year) : "",
    baseColor: spec.baseColor,
    accentColor: spec.accentColor,
    paperColor: spec.paperColor,
    foilColor: spec.foilColor,
    motif: spec.motif,
    hasCoverArtwork: Boolean(spec.coverUrl),
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
}: {
  naturalWidth: number;
  naturalHeight: number;
  coverAspectRatio: number;
  economical: boolean;
}) {
  const safeAspectRatio = Math.min(0.72, Math.max(0.42, coverAspectRatio));
  const widthCap = economical ? 320 : 1024;
  // Cover-fill sampling crops one source axis.  Bound the canvas by the
  // usable native pixels on both axes so a small archive image is never
  // blurred by an artificial upscale, while large originals retain the
  // high-quality 1024 px selected-book path.
  const nativeFillWidth = Math.min(
    Math.max(1, naturalWidth),
    Math.max(1, naturalHeight) * safeAspectRatio
  );
  const width = Math.max(1, Math.floor(Math.min(widthCap, nativeFillWidth)));
  const height = Math.max(1, Math.floor(width / safeAspectRatio));
  return Object.freeze({ width, height, aspectRatio: safeAspectRatio });
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

function withReadableFoilText(
  context: CanvasRenderingContext2D,
  paint: () => void
) {
  context.save();
  context.shadowColor = "rgba(4, 2, 1, 0.96)";
  context.shadowBlur = 8;
  context.shadowOffsetY = 2;
  paint();
  context.restore();
}

export function createCompleteShelfArtworkTextures(
  spec: CompleteShelfBookSpec,
  economical: boolean,
  includeFrontFoil = true
): CompleteShelfArtworkTextures {
  const plan = buildCompleteShelfArtworkPlan(spec);
  // Foil canvases are pure masks; the physical material supplies the actual
  // metal colour.  This keeps alphaMap luminance at one instead of making
  // darker copper/gold artwork accidentally translucent.
  const maskColor = "#ffffff";
  const frontWidth = economical ? 256 : 768;
  const frontHeight = economical ? 384 : 1152;
  const spineWidth = economical ? 128 : 384;
  const spineHeight = frontHeight;
  // Authorized editorial artwork is already a finished cover.  Never draw a
  // generic frame over it: that was the source of the flat, poster-in-a-box
  // look and also changed the intended artwork colours.
  const frontFoil = !includeFrontFoil || plan.hasCoverArtwork
    ? null
    : createFoilTexture(frontWidth, frontHeight, (context) => {
    const inset = frontWidth * 0.09;
    context.strokeStyle = maskColor;
    context.fillStyle = maskColor;
    context.lineCap = "round";
    context.lineWidth = Math.max(1.5, frontWidth * 0.006);
    // Bookbinder corner tooling reads as an inset ornament without turning
    // the whole cover into an empty technical rectangle.
    for (const [x, y, xDirection, yDirection] of [
      [inset, inset, 1, 1],
      [frontWidth - inset, inset, -1, 1],
      [inset, frontHeight - inset, 1, -1],
      [frontWidth - inset, frontHeight - inset, -1, -1],
    ] as const) {
      context.beginPath();
      context.moveTo(x, y + yDirection * frontWidth * 0.09);
      context.quadraticCurveTo(
        x,
        y,
        x + xDirection * frontWidth * 0.09,
        y
      );
      context.stroke();
      context.beginPath();
      context.arc(
        x + xDirection * frontWidth * 0.025,
        y + yDirection * frontWidth * 0.025,
        frontWidth * 0.008,
        0,
        Math.PI * 2
      );
      context.fill();
    }
    context.globalAlpha = 0.7;
    context.fillRect(
      frontWidth * 0.32,
      frontHeight * 0.405,
      frontWidth * 0.36,
      Math.max(1.5, frontWidth * 0.004)
    );
    context.globalAlpha = 1;
    paintMotif(
      context,
      plan.motif,
      frontWidth / 2,
      frontHeight * 0.27,
      frontWidth * 0.13,
      maskColor
    );
    context.textAlign = "center";
    context.textBaseline = "middle";
    withReadableFoilText(context, () => {
      context.fillStyle = maskColor;
      context.font =
        "700 " + Math.round(frontWidth * 0.086) + "px Georgia, serif";
      const titleStart =
        frontHeight * 0.48 -
        ((plan.titleLines.length - 1) * frontWidth * 0.052);
      plan.titleLines.forEach((line, index) => {
        context.fillText(
          line,
          frontWidth / 2,
          titleStart + index * frontWidth * 0.105,
          frontWidth * 0.78
        );
      });
    });
    withReadableFoilText(context, () => {
      context.fillStyle = maskColor;
      context.font =
        "600 " + Math.round(frontWidth * 0.054) + "px Georgia, serif";
      context.fillText(
        plan.writer,
        frontWidth / 2,
        frontHeight * 0.82,
        frontWidth * 0.74
      );
    });
    if (plan.yearLabel) {
      context.fillStyle = maskColor;
      context.font =
        "600 " + Math.round(frontWidth * 0.046) + "px Georgia, serif";
      context.fillText(plan.yearLabel, frontWidth / 2, frontHeight * 0.9);
    }
  }, economical ? 4 : 12);
  const spineFoil = createFoilTexture(
    spineWidth,
    spineHeight,
    (context) => {
      context.strokeStyle = maskColor;
      context.fillStyle = maskColor;
      context.lineCap = "round";
      context.lineWidth = Math.max(1.5, spineWidth * 0.035);
      for (const y of [spineHeight * 0.075, spineHeight * 0.105]) {
        context.beginPath();
        context.moveTo(spineWidth * 0.18, y);
        context.lineTo(spineWidth * 0.82, y);
        context.stroke();
      }
      for (const y of [spineHeight * 0.895, spineHeight * 0.925]) {
        context.beginPath();
        context.moveTo(spineWidth * 0.18, y);
        context.lineTo(spineWidth * 0.82, y);
        context.stroke();
      }
      for (const y of [spineHeight * 0.09, spineHeight * 0.91]) {
        context.save();
        context.translate(spineWidth / 2, y);
        context.rotate(Math.PI / 4);
        context.fillRect(
          -spineWidth * 0.035,
          -spineWidth * 0.035,
          spineWidth * 0.07,
          spineWidth * 0.07
        );
        context.restore();
      }
      context.textAlign = "left";
      context.textBaseline = "middle";
      withReadableFoilText(context, () => {
        context.textAlign = "center";
        context.fillStyle = maskColor;
        context.font =
          "700 " + Math.round(spineWidth * 0.245) + "px Georgia, serif";
        const titleStart = spineHeight * 0.215;
        plan.spineTitleLines.forEach((line, index) => {
          context.strokeStyle = maskColor;
          context.lineWidth = Math.max(1.4, spineWidth * 0.022);
          context.strokeText(
            line,
            spineWidth / 2,
            titleStart + index * spineWidth * 0.29,
            spineWidth * 0.84
          );
          context.fillText(
            line,
            spineWidth / 2,
            titleStart + index * spineWidth * 0.29,
            spineWidth * 0.84
          );
        });
        context.fillStyle = maskColor;
        context.font =
          "700 " + Math.round(spineWidth * 0.18) + "px Georgia, serif";
        plan.spineWriterLines.forEach((line, index) => {
          context.strokeStyle = maskColor;
          context.lineWidth = Math.max(1.25, spineWidth * 0.019);
          context.strokeText(
            line,
            spineWidth / 2,
            spineHeight * 0.62 + index * spineWidth * 0.22,
            spineWidth * 0.84
          );
          context.fillText(
            line,
            spineWidth / 2,
            spineHeight * 0.62 + index * spineWidth * 0.22,
            spineWidth * 0.84
          );
        });
      });
      paintMotif(
        context,
        plan.motif,
        spineWidth / 2,
        spineHeight * 0.775,
        spineWidth * 0.22,
        maskColor
      );
      if (plan.yearLabel) {
        context.fillStyle = maskColor;
        context.textAlign = "center";
        context.font =
          "700 " + Math.round(spineWidth * 0.18) + "px Georgia, serif";
        context.fillText(plan.yearLabel, spineWidth / 2, spineHeight * 0.955);
      }
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
      shade.addColorStop(0, "rgba(0,0,0,.3)");
      shade.addColorStop(0.14, "rgba(255,255,255,.12)");
      shade.addColorStop(0.54, "rgba(255,255,255,.025)");
      shade.addColorStop(0.84, "rgba(255,255,255,.07)");
      shade.addColorStop(1, "rgba(0,0,0,.26)");
      context.fillStyle = shade;
      context.fillRect(0, 0, spineWidth, spineHeight);
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
      for (const bandY of [0.115, 0.885]) {
        const bandHeight = spineHeight * 0.016;
        const band = context.createLinearGradient(
          0,
          spineHeight * bandY - bandHeight,
          0,
          spineHeight * bandY + bandHeight
        );
        band.addColorStop(0, "rgba(0,0,0,.2)");
        band.addColorStop(0.42, "rgba(255,255,255,.1)");
        band.addColorStop(0.58, "rgba(255,255,255,.055)");
        band.addColorStop(1, "rgba(0,0,0,.24)");
        context.fillStyle = band;
        context.fillRect(
          0,
          spineHeight * bandY - bandHeight,
          spineWidth,
          bandHeight * 2
        );
      }
      const tailShade = context.createLinearGradient(
        0,
        spineHeight * 0.82,
        0,
        spineHeight
      );
      tailShade.addColorStop(0, "rgba(0,0,0,0)");
      tailShade.addColorStop(1, "rgba(0,0,0,.14)");
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
  if (!normalizedUrl || typeof document === "undefined") return () => {};
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
      // Editorial covers are authored as full-bleed 2:3 artwork.  Fill the
      // physical board and crop only the overflow instead of letterboxing it
      // inside a second coloured frame.
      const scale = Math.max(
        width / image.naturalWidth,
        height / image.naturalHeight
      );
      const drawWidth = image.naturalWidth * scale;
      const drawHeight = image.naturalHeight * scale;
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(
        image,
        (width - drawWidth) / 2,
        (height - drawHeight) / 2,
        drawWidth,
        drawHeight
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
