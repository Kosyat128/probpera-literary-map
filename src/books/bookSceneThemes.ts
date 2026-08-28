import paletteManifestJson from "./bookCoverPalettes.generated.json";

import {
  bookArchiveKey,
  isCoverArtworkDisplayAllowed,
  type BookArchiveEntry,
} from "../data/bookArchive";

export const PROBPERA_VIOLET = "#300A4F" as const;
export const PROBPERA_ORANGE = "#F67518" as const;

export const bookSceneArchetypes = [
  "VIOLET LIBRARY",
  "WARM PAPER",
  "MUSEUM IVORY",
  "MIDNIGHT ARCHIVE",
  "AMBER READING ROOM",
  "ORANGE VIOLET TWILIGHT",
  "INK ROOM",
  "DEEP BLUE STUDY",
  "MUTED GREEN LIBRARY",
  "BURGUNDY EDITION",
  "CHARCOAL GALLERY",
  "CREAM PUBLISHING ROOM",
] as const;

export type BookSceneArchetype = (typeof bookSceneArchetypes)[number];
export type BookSceneThemeSource = "cover" | "fallback" | "owner-override";
export type BookSceneSurfaceMode =
  | "cloth"
  | "paper"
  | "wood"
  | "stone"
  | "lacquer";

type HexColor = `#${string}`;

export type BookSceneTheme = {
  bookKey: string;
  source: BookSceneThemeSource;
  archetype: BookSceneArchetype;
  baseColor: HexColor;
  secondaryColor: HexColor;
  accentColor: HexColor;
  warmColor: HexColor;
  paperColor: HexColor;
  inkColor: HexColor;
  shelfColor: HexColor;
  lightColor: HexColor;
  surfaceMode: BookSceneSurfaceMode;
  gradientAngle: number;
  glowPosition: string;
  grainStrength: number;
  contrastScore: number;
  versionHash: string;
};

type PaletteRightsStatus =
  | "public-domain"
  | "licensed"
  | "permission"
  | "editorial-original";

export type BookCoverPaletteRecord = {
  coverUrl: string;
  coverSha256: string;
  rightsStatus: PaletteRightsStatus;
  dominantColor: HexColor;
  darkColor: HexColor;
  lightColor: HexColor;
  accentColor: HexColor;
  warmColor: HexColor;
};

type BookCoverPaletteManifest = {
  schemaVersion: 1;
  generatedAt: string;
  entries: BookCoverPaletteRecord[];
};

export type BookSceneOwnerOverride = {
  archetype: BookSceneArchetype;
};

export type ResolveBookSceneThemeOptions = {
  audienceIds?: readonly string[];
  ownerOverride?: BookSceneOwnerOverride | null;
  /** Test/build injection. Undefined uses the generated local-cover registry. */
  palette?: BookCoverPaletteRecord | null;
};

type Rgb = { r: number; g: number; b: number };
type Hsl = { h: number; s: number; l: number };

type ArchetypePalette = {
  baseColor: HexColor;
  secondaryColor: HexColor;
  accentColor: HexColor;
  warmColor: HexColor;
  paperColor: HexColor;
  inkColor: HexColor;
  shelfColor: HexColor;
  lightColor: HexColor;
  surfaceMode: BookSceneSurfaceMode;
};

const archetypePalettes: Readonly<Record<BookSceneArchetype, ArchetypePalette>> = {
  "VIOLET LIBRARY": {
    baseColor: "#24083A",
    secondaryColor: "#4B087C",
    accentColor: PROBPERA_ORANGE,
    warmColor: "#D99A5E",
    paperColor: "#FFF1D7",
    inkColor: "#1A062B",
    shelfColor: "#351B32",
    lightColor: "#FFE0AD",
    surfaceMode: "cloth",
  },
  "WARM PAPER": {
    baseColor: "#3B291F",
    secondaryColor: "#73513C",
    accentColor: PROBPERA_ORANGE,
    warmColor: "#D6A261",
    paperColor: "#F7E8C9",
    inkColor: "#21150F",
    shelfColor: "#4A3024",
    lightColor: "#FFDC9D",
    surfaceMode: "paper",
  },
  "MUSEUM IVORY": {
    baseColor: "#403B32",
    secondaryColor: "#756B58",
    accentColor: PROBPERA_ORANGE,
    warmColor: "#C8955C",
    paperColor: "#F6EEDA",
    inkColor: "#201C17",
    shelfColor: "#514538",
    lightColor: "#FFE8BA",
    surfaceMode: "stone",
  },
  "MIDNIGHT ARCHIVE": {
    baseColor: "#10162A",
    secondaryColor: "#273657",
    accentColor: PROBPERA_ORANGE,
    warmColor: "#C98A55",
    paperColor: "#F0E8D9",
    inkColor: "#111521",
    shelfColor: "#20273A",
    lightColor: "#FFD6A2",
    surfaceMode: "cloth",
  },
  "AMBER READING ROOM": {
    baseColor: "#352116",
    secondaryColor: "#714628",
    accentColor: PROBPERA_ORANGE,
    warmColor: "#E0A250",
    paperColor: "#F8E7C8",
    inkColor: "#24140B",
    shelfColor: "#4B2D1D",
    lightColor: "#FFD083",
    surfaceMode: "wood",
  },
  "ORANGE VIOLET TWILIGHT": {
    baseColor: "#2D123D",
    secondaryColor: "#6A2653",
    accentColor: PROBPERA_ORANGE,
    warmColor: "#DE8450",
    paperColor: "#F8E7D2",
    inkColor: "#210B2E",
    shelfColor: "#43203A",
    lightColor: "#FFC48C",
    surfaceMode: "lacquer",
  },
  "INK ROOM": {
    baseColor: "#0F0D14",
    secondaryColor: "#2B2531",
    accentColor: PROBPERA_ORANGE,
    warmColor: "#BD855F",
    paperColor: "#EEE7DB",
    inkColor: "#121015",
    shelfColor: "#242027",
    lightColor: "#F9D6AF",
    surfaceMode: "lacquer",
  },
  "DEEP BLUE STUDY": {
    baseColor: "#10243B",
    secondaryColor: "#24506A",
    accentColor: PROBPERA_ORANGE,
    warmColor: "#C98C5A",
    paperColor: "#F0E8D8",
    inkColor: "#101B27",
    shelfColor: "#1E3441",
    lightColor: "#FFD7A5",
    surfaceMode: "cloth",
  },
  "MUTED GREEN LIBRARY": {
    baseColor: "#1D302A",
    secondaryColor: "#456154",
    accentColor: PROBPERA_ORANGE,
    warmColor: "#C58D59",
    paperColor: "#F1E9D5",
    inkColor: "#13201C",
    shelfColor: "#2E4036",
    lightColor: "#FAD5A0",
    surfaceMode: "wood",
  },
  "BURGUNDY EDITION": {
    baseColor: "#35121F",
    secondaryColor: "#6B263A",
    accentColor: PROBPERA_ORANGE,
    warmColor: "#CE885D",
    paperColor: "#F6E5D1",
    inkColor: "#250C15",
    shelfColor: "#4B2330",
    lightColor: "#FFD0A5",
    surfaceMode: "cloth",
  },
  "CHARCOAL GALLERY": {
    baseColor: "#1B1C20",
    secondaryColor: "#41434A",
    accentColor: PROBPERA_ORANGE,
    warmColor: "#BF895F",
    paperColor: "#EEE8DE",
    inkColor: "#17181B",
    shelfColor: "#303136",
    lightColor: "#F8D7B2",
    surfaceMode: "stone",
  },
  "CREAM PUBLISHING ROOM": {
    baseColor: "#46382E",
    secondaryColor: "#7A6652",
    accentColor: PROBPERA_ORANGE,
    warmColor: "#D09A63",
    paperColor: "#FAECD2",
    inkColor: "#251B15",
    shelfColor: "#594536",
    lightColor: "#FFE0AB",
    surfaceMode: "paper",
  },
};

const manifest = paletteManifestJson as BookCoverPaletteManifest;
const palettesByCoverUrl = new Map(
  manifest.entries.map((entry) => [normalizedLocalCoverUrl(entry.coverUrl), entry])
);

const safePaletteRightsStatuses = new Set<PaletteRightsStatus>([
  "public-domain",
  "licensed",
  "permission",
  "editorial-original",
]);

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizedLocalCoverUrl(value: string | undefined) {
  const normalized = String(value || "").trim().replace(/^\/+/, "");
  if (
    !normalized ||
    /^(?:https?:|data:|blob:)/iu.test(normalized) ||
    normalized.includes("\\") ||
    normalized.split("/").includes("..")
  ) {
    return "";
  }
  return normalized;
}

function isHexColor(value: unknown): value is HexColor {
  return typeof value === "string" && /^#[0-9a-f]{6}$/iu.test(value);
}

function hexToRgb(value: HexColor): Rgb {
  return {
    r: Number.parseInt(value.slice(1, 3), 16),
    g: Number.parseInt(value.slice(3, 5), 16),
    b: Number.parseInt(value.slice(5, 7), 16),
  };
}

function rgbToHex({ r, g, b }: Rgb): HexColor {
  return `#${[r, g, b]
    .map((channel) => Math.round(clamp(channel, 0, 255)).toString(16).padStart(2, "0"))
    .join("")}`.toUpperCase() as HexColor;
}

function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const channels = [r, g, b].map((value) => value / 255);
  const max = Math.max(...channels);
  const min = Math.min(...channels);
  const delta = max - min;
  const lightness = (max + min) / 2;
  if (!delta) return { h: 0, s: 0, l: lightness };
  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue = 0;
  if (max === channels[0]) hue = ((channels[1] - channels[2]) / delta) % 6;
  else if (max === channels[1]) hue = (channels[2] - channels[0]) / delta + 2;
  else hue = (channels[0] - channels[1]) / delta + 4;
  return { h: ((hue * 60 + 360) % 360) / 360, s: saturation, l: lightness };
}

function hslToRgb({ h, s, l }: Hsl): Rgb {
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const hue = h * 6;
  const segment = chroma * (1 - Math.abs((hue % 2) - 1));
  const [red, green, blue] =
    hue < 1
      ? [chroma, segment, 0]
      : hue < 2
        ? [segment, chroma, 0]
        : hue < 3
          ? [0, chroma, segment]
          : hue < 4
            ? [0, segment, chroma]
            : hue < 5
              ? [segment, 0, chroma]
              : [chroma, 0, segment];
  const match = l - chroma / 2;
  return { r: (red + match) * 255, g: (green + match) * 255, b: (blue + match) * 255 };
}

function boundedColor(
  value: HexColor,
  bounds: { minS?: number; maxS?: number; minL?: number; maxL?: number }
) {
  const hsl = rgbToHsl(hexToRgb(value));
  return rgbToHex(
    hslToRgb({
      h: hsl.h,
      s: clamp(hsl.s, bounds.minS ?? 0, bounds.maxS ?? 1),
      l: clamp(hsl.l, bounds.minL ?? 0, bounds.maxL ?? 1),
    })
  );
}

function mixColor(first: HexColor, second: HexColor, secondWeight: number) {
  const left = hexToRgb(first);
  const right = hexToRgb(second);
  const weight = clamp(secondWeight, 0, 1);
  return rgbToHex({
    r: left.r * (1 - weight) + right.r * weight,
    g: left.g * (1 - weight) + right.g * weight,
    b: left.b * (1 - weight) + right.b * weight,
  });
}

function linearChannel(value: number) {
  const channel = value / 255;
  return channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(color: HexColor) {
  const { r, g, b } = hexToRgb(color);
  return 0.2126 * linearChannel(r) + 0.7152 * linearChannel(g) + 0.0722 * linearChannel(b);
}

export function bookSceneThemeContrastRatio(first: HexColor, second: HexColor) {
  const values = [relativeLuminance(first), relativeLuminance(second)].sort(
    (left, right) => right - left
  );
  return (values[0] + 0.05) / (values[1] + 0.05);
}

function contrastSafeColor(
  preferred: HexColor,
  background: HexColor,
  candidates: readonly HexColor[],
  minimum = 4.5
) {
  if (bookSceneThemeContrastRatio(preferred, background) >= minimum) return preferred;
  return [...candidates, preferred].sort(
    (left, right) =>
      bookSceneThemeContrastRatio(right, background) -
      bookSceneThemeContrastRatio(left, background)
  )[0];
}

function fnv1a(value: string, seed: number) {
  let hash = seed >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function stableHash(value: string) {
  const first = fnv1a(value, 0x811c9dc5).toString(16).padStart(8, "0");
  const second = fnv1a(value, 0x9e3779b1).toString(16).padStart(8, "0");
  return `${first}${second}`;
}

function normalizedFacetValues(values: readonly string[] | undefined) {
  const normalized = (values || [])
    .map((value) => value.normalize("NFKC").trim().toLocaleLowerCase("en"))
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right, "en"));
  return normalized.length ? [...new Set(normalized)].join(",") : "unknown";
}

function periodBucket(firstPublished: number | undefined) {
  if (!Number.isFinite(firstPublished)) return "unknown";
  if (Number(firstPublished) < 1800) return "pre-1800";
  if (Number(firstPublished) <= 1899) return "xix";
  if (Number(firstPublished) <= 1945) return "1900-1945";
  if (Number(firstPublished) <= 1999) return "1946-1999";
  return "xxi";
}

function seedForBook(book: BookArchiveEntry, audienceIds: readonly string[] | undefined) {
  return [
    bookArchiveKey(book.countryId, book.writerId, book.id),
    book.countryId.normalize("NFKC").trim().toLocaleLowerCase("en") || "unknown",
    normalizedFacetValues(book.genres),
    periodBucket(book.firstPublished),
    normalizedFacetValues(audienceIds),
  ].join("|");
}

function fallbackArchetype(seed: string) {
  return bookSceneArchetypes[fnv1a(seed, 0x811c9dc5) % bookSceneArchetypes.length];
}

function paletteDistance(first: HexColor, second: HexColor) {
  const left = hexToRgb(first);
  const right = hexToRgb(second);
  return (
    (left.r - right.r) ** 2 * 0.3 +
    (left.g - right.g) ** 2 * 0.59 +
    (left.b - right.b) ** 2 * 0.11
  );
}

function coverArchetype(palette: BookCoverPaletteRecord) {
  return [...bookSceneArchetypes].sort((left, right) => {
    const leftPalette = archetypePalettes[left];
    const rightPalette = archetypePalettes[right];
    return (
      paletteDistance(palette.darkColor, leftPalette.baseColor) +
        paletteDistance(palette.dominantColor, leftPalette.secondaryColor) -
      (paletteDistance(palette.darkColor, rightPalette.baseColor) +
        paletteDistance(palette.dominantColor, rightPalette.secondaryColor))
    );
  })[0];
}

function validPaletteRecord(
  book: BookArchiveEntry,
  palette: BookCoverPaletteRecord | null | undefined
): palette is BookCoverPaletteRecord {
  const coverUrl = normalizedLocalCoverUrl(book.coverUrl);
  if (
    !palette ||
    !coverUrl ||
    normalizedLocalCoverUrl(palette.coverUrl) !== coverUrl ||
    !/^[a-f0-9]{64}$/u.test(palette.coverSha256) ||
    !safePaletteRightsStatuses.has(palette.rightsStatus) ||
    palette.rightsStatus !== book.coverRights?.status ||
    !isCoverArtworkDisplayAllowed(book)
  ) {
    return false;
  }
  return [
    palette.dominantColor,
    palette.darkColor,
    palette.lightColor,
    palette.accentColor,
    palette.warmColor,
  ].every(isHexColor);
}

function safeThemePalette(
  archetype: BookSceneArchetype,
  palette?: BookCoverPaletteRecord
): ArchetypePalette {
  const base = archetypePalettes[archetype];
  if (!palette) {
    const paperColor = contrastSafeColor(base.paperColor, base.baseColor, ["#FFF1D7", "#FFFFFF"]);
    return {
      ...base,
      accentColor: contrastSafeColor(
        base.accentColor,
        base.baseColor,
        ["#FF9B45", "#FFB067", paperColor]
      ),
      paperColor,
      inkColor: contrastSafeColor(base.inkColor, paperColor, ["#11031D", "#000000"], 7),
      lightColor: contrastSafeColor(base.lightColor, base.baseColor, [paperColor]),
    };
  }

  const baseColor = boundedColor(mixColor(base.baseColor, palette.darkColor, 0.34), {
    minS: 0.08,
    maxS: 0.68,
    minL: 0.055,
    maxL: 0.2,
  });
  const secondaryFromCover = mixColor(base.secondaryColor, palette.dominantColor, 0.34);
  const secondaryColor = boundedColor(
    mixColor(secondaryFromCover, PROBPERA_VIOLET, 0.14),
    { minS: 0.1, maxS: 0.72, minL: 0.12, maxL: 0.34 }
  );
  const accentCandidate = boundedColor(
    mixColor(PROBPERA_ORANGE, palette.accentColor, 0.28),
    { minS: 0.56, maxS: 0.9, minL: 0.47, maxL: 0.65 }
  );
  const warmCandidate = boundedColor(mixColor(base.warmColor, palette.warmColor, 0.35), {
    minS: 0.28,
    maxS: 0.72,
    minL: 0.5,
    maxL: 0.72,
  });
  const paperCandidate = boundedColor(mixColor(base.paperColor, palette.lightColor, 0.18), {
    minS: 0.08,
    maxS: 0.48,
    minL: 0.82,
    maxL: 0.96,
  });
  const paperColor = contrastSafeColor(paperCandidate, baseColor, [base.paperColor, "#FFFFFF"]);
  const inkColor = contrastSafeColor(base.inkColor, paperColor, ["#11031D", "#000000"], 7);
  const accentColor = contrastSafeColor(
    accentCandidate,
    baseColor,
    [PROBPERA_ORANGE, "#FFB067", paperColor]
  );
  return {
    ...base,
    baseColor,
    secondaryColor,
    accentColor,
    warmColor: warmCandidate,
    paperColor,
    inkColor,
    shelfColor: boundedColor(mixColor(base.shelfColor, palette.darkColor, 0.24), {
      minS: 0.06,
      maxS: 0.58,
      minL: 0.08,
      maxL: 0.25,
    }),
    lightColor: contrastSafeColor(
      boundedColor(mixColor(base.lightColor, palette.lightColor, 0.16), {
        minS: 0.2,
        maxS: 0.68,
        minL: 0.68,
        maxL: 0.9,
      }),
      baseColor,
      [base.lightColor, paperColor]
    ),
  };
}

function completeTheme(
  bookKey: string,
  source: BookSceneThemeSource,
  archetype: BookSceneArchetype,
  palette: ArchetypePalette,
  seed: string
): BookSceneTheme {
  const motionHash = fnv1a(seed, 0x9e3779b1);
  const contrastScore = Math.min(
    bookSceneThemeContrastRatio(palette.paperColor, palette.baseColor),
    bookSceneThemeContrastRatio(palette.inkColor, palette.paperColor),
    bookSceneThemeContrastRatio(palette.accentColor, palette.baseColor)
  );
  const core = {
    bookKey,
    source,
    archetype,
    ...palette,
    gradientAngle: 96 + (motionHash % 169),
    glowPosition: `${18 + (motionHash % 65)}% ${16 + ((motionHash >>> 8) % 61)}%`,
    grainStrength: Number((0.035 + ((motionHash >>> 16) % 46) / 1000).toFixed(3)),
    contrastScore: Number(contrastScore.toFixed(2)),
  };
  return {
    ...core,
    versionHash: `theme-v1-${stableHash(JSON.stringify(core))}`,
  };
}

export function bookSceneThemeForArchetype(
  archetype: BookSceneArchetype,
  bookKey = "book-scene-preview"
) {
  const safeArchetype = bookSceneArchetypes.includes(archetype)
    ? archetype
    : "VIOLET LIBRARY";
  return completeTheme(
    bookKey,
    "owner-override",
    safeArchetype,
    safeThemePalette(safeArchetype),
    `${bookKey}|${safeArchetype}|owner-override`
  );
}

export function resolveBookSceneTheme(
  book: BookArchiveEntry,
  options: ResolveBookSceneThemeOptions = {}
) {
  const key = bookArchiveKey(book.countryId, book.writerId, book.id);
  const seed = seedForBook(book, options.audienceIds);
  const requestedOverride = options.ownerOverride?.archetype;
  if (requestedOverride && bookSceneArchetypes.includes(requestedOverride)) {
    return completeTheme(
      key,
      "owner-override",
      requestedOverride,
      safeThemePalette(requestedOverride),
      `${seed}|${requestedOverride}|owner-override`
    );
  }

  const registeredPalette =
    options.palette === undefined
      ? palettesByCoverUrl.get(normalizedLocalCoverUrl(book.coverUrl))
      : options.palette;
  if (validPaletteRecord(book, registeredPalette)) {
    const archetype = coverArchetype(registeredPalette);
    return completeTheme(
      key,
      "cover",
      archetype,
      safeThemePalette(archetype, registeredPalette),
      `${seed}|${registeredPalette.coverSha256}|cover`
    );
  }

  const archetype = fallbackArchetype(seed);
  return completeTheme(
    key,
    "fallback",
    archetype,
    safeThemePalette(archetype),
    `${seed}|fallback`
  );
}

export const bookSceneThemeCssVariables = [
  "--book-scene-base",
  "--book-scene-secondary",
  "--book-scene-accent",
  "--book-scene-warm",
  "--book-scene-paper",
  "--book-scene-ink",
  "--book-scene-shelf",
  "--book-scene-light",
  "--book-scene-gradient-angle",
  "--book-scene-glow-position",
  "--book-scene-grain-strength",
] as const;

export function bookSceneThemeCssProperties(theme: BookSceneTheme) {
  return {
    "--book-scene-base": theme.baseColor,
    "--book-scene-secondary": theme.secondaryColor,
    "--book-scene-accent": theme.accentColor,
    "--book-scene-warm": theme.warmColor,
    "--book-scene-paper": theme.paperColor,
    "--book-scene-ink": theme.inkColor,
    "--book-scene-shelf": theme.shelfColor,
    "--book-scene-light": theme.lightColor,
    "--book-scene-gradient-angle": `${theme.gradientAngle}deg`,
    "--book-scene-glow-position": theme.glowPosition,
    "--book-scene-grain-strength": String(theme.grainStrength),
  } as Record<(typeof bookSceneThemeCssVariables)[number], string>;
}
