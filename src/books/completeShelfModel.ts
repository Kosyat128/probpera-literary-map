import type { BookShelfPhase } from "./bookShelfState";
export const COMPLETE_SHELF_MAX_WORKING_SET = 13;
export const COMPLETE_SHELF_ECONOMICAL_WORKING_SET = 11;
export const COMPLETE_SHELF_GAP = 0.022;
export const COMPLETE_SHELF_TOP = -1.02;

const FALLBACK_BASE_COLORS = [
  "#3f244d",
  "#264653",
  "#5b2c35",
  "#293b32",
] as const;
const FALLBACK_ACCENTS = ["#d8b568", "#b87333"] as const;
const PREMIUM_FALLBACK_PALETTES = [
  {
    baseColor: "#1f4057",
    accentColor: "#d8b56b",
    paperColor: "#eadfc9",
    foilColor: "#f0cf86",
  },
  {
    baseColor: "#652c35",
    accentColor: "#d4aa63",
    paperColor: "#efe0cb",
    foilColor: "#edca7d",
  },
  {
    baseColor: "#d2b98d",
    accentColor: "#754726",
    paperColor: "#f5ead5",
    foilColor: "#fff0c4",
  },
  {
    baseColor: "#294d43",
    accentColor: "#d9b66a",
    paperColor: "#e9dec7",
    foilColor: "#f1d28f",
  },
  {
    baseColor: "#a86032",
    accentColor: "#542f27",
    paperColor: "#f0dfc6",
    foilColor: "#f4d492",
  },
  {
    baseColor: "#333b61",
    accentColor: "#d6ad68",
    paperColor: "#ece1cd",
    foilColor: "#efd08b",
  },
] as const;
export const COMPLETE_SHELF_INSPECTION_GUTTER = 0.54;

export type CompleteShelfFoilMotif =
  | "arch"
  | "diamond"
  | "orbital"
  | "rules";

export type CompleteShelfItemInput = Readonly<{
  key: string;
  title: string;
  writer: string;
  year?: number | null;
  baseColor: string;
  accentColor: string;
  paperColor: string;
  coverUrl?: string;
}>;

export type CompleteShelfBookSpec = Readonly<{
  key: string;
  title: string;
  writer: string;
  year: number | null;
  sourceIndex: number;
  seed: number;
  dimensions: Readonly<{
    height: number;
    coverWidth: number;
    pageDepth: number;
    boardThickness: number;
    pageInset: number;
  }>;
  baseColor: string;
  accentColor: string;
  paperColor: string;
  foilColor: string;
  coverUrl: string | null;
  motif: CompleteShelfFoilMotif;
  lean: number;
}>;

export type CompleteShelfLayoutEntry = Readonly<{
  spec: CompleteShelfBookSpec;
  x: number;
  slotIndex: number;
}>;

export type CompleteShelfBookPose = Readonly<{
  position: readonly [number, number, number];
  rotation: readonly [number, number, number];
  scale: number;
  coverAngle: number;
  firstLeafAngle: number;
  secondLeafAngle: number;
}>;

export type CompleteShelfSettlement =
  | "motion-reached"
  | "motion-settled"
  | "inspection-entered"
  | "cover-opened"
  | "page-settled"
  | "inspection-closed"
  | "shelf-restored";

const round = (value: number) => Math.round(value * 10_000) / 10_000;
const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value));
const color = (value: string, fallback: string) =>
  /^#[0-9a-f]{6}$/iu.test(value.trim()) ? value.trim() : fallback;

export function normalizeCompleteShelfText(value: string, maximum = 120) {
  return value
    .replace(/[\u0000-\u001f\u007f-\u009f]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, maximum);
}

export function completeShelfHash(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function normalizeCompleteShelfCoverUrl(value?: string) {
  const normalized = String(value || "").trim();
  if (
    !normalized ||
    /[\u0000-\u001f\u007f\\"'<>]/u.test(normalized) ||
    /^(?:data|blob|javascript|file):/iu.test(normalized) ||
    /^\/\//u.test(normalized)
  ) {
    return null;
  }
  let decoded = normalized;
  try {
    decoded = decodeURIComponent(normalized);
  } catch {
    return null;
  }
  if (decoded.split(/[/?#]/u).includes("..")) return null;
  return normalized;
}

export function buildCompleteShelfBookSpec(
  input: CompleteShelfItemInput,
  sourceIndex = 0
): CompleteShelfBookSpec {
  const normalizedKey = normalizeCompleteShelfText(input.key, 240);
  const key = normalizedKey || "book-" + sourceIndex;
  const seed = completeShelfHash(normalizedKey || "book");
  const coverUrl = normalizeCompleteShelfCoverUrl(input.coverUrl);
  const fallbackPalette =
    PREMIUM_FALLBACK_PALETTES[
      (seed >>> 9) % PREMIUM_FALLBACK_PALETTES.length
    ];
  const rawYear = Number.isFinite(input.year)
    ? Math.trunc(input.year as number)
    : 0;
  const motifs: readonly CompleteShelfFoilMotif[] = [
    "arch",
    "diamond",
    "orbital",
    "rules",
  ];
  const height = round(1.36 + (seed % 8) * 0.045);
  // Real hardcovers cluster around a recognisable portrait ratio.  The old
  // independent width randomizer occasionally produced unnaturally narrow
  // boards and forced authorized artwork into a thick letterbox frame.
  const coverAspectRatio = 0.56 + ((seed >>> 4) % 5) * 0.016;
  return Object.freeze({
    key,
    title: normalizeCompleteShelfText(input.title, 180) || "Untitled",
    writer: normalizeCompleteShelfText(input.writer, 120),
    year: rawYear >= 1000 && rawYear <= 2100 ? rawYear : null,
    sourceIndex,
    seed,
    dimensions: Object.freeze({
      height,
      coverWidth: round(height * coverAspectRatio),
      pageDepth: round(0.215 + ((seed >>> 8) % 7) * 0.018),
      boardThickness: 0.032,
      pageInset: round(0.048 + ((seed >>> 16) % 3) * 0.006),
    }),
    baseColor: coverUrl
      ? color(
          input.baseColor,
          FALLBACK_BASE_COLORS[seed % FALLBACK_BASE_COLORS.length]
        )
      : fallbackPalette.baseColor,
    accentColor: coverUrl
      ? color(
          input.accentColor,
          FALLBACK_ACCENTS[(seed >>> 3) % FALLBACK_ACCENTS.length]
        )
      : fallbackPalette.accentColor,
    paperColor: coverUrl
      ? color(input.paperColor, "#e8dcc4")
      : fallbackPalette.paperColor,
    foilColor: fallbackPalette.foilColor,
    coverUrl,
    motif: motifs[(seed >>> 18) % motifs.length],
    lean: round((((seed >>> 21) % 7) - 3) * 0.008),
  });
}

export function completeShelfWorkingSetLimit(economical: boolean) {
  return economical
    ? COMPLETE_SHELF_ECONOMICAL_WORKING_SET
    : COMPLETE_SHELF_MAX_WORKING_SET;
}

export function selectCompleteShelfWorkingSet<T extends { key: string }>(
  items: readonly T[],
  anchorKey: string | null,
  requestedLimit = COMPLETE_SHELF_MAX_WORKING_SET
) {
  if (!items.length) {
    return Object.freeze({
      entries: Object.freeze([]) as readonly Readonly<{
        item: T;
        sourceIndex: number;
        slotIndex: number;
      }>[],
      anchorSlot: -1,
      anchorSourceIndex: -1,
    });
  }
  const limit = clamp(
    Math.trunc(requestedLimit) || 1,
    1,
    COMPLETE_SHELF_MAX_WORKING_SET
  );
  const count = Math.min(items.length, limit);
  const found = anchorKey
    ? items.findIndex((item) => item.key === anchorKey)
    : -1;
  const anchorSourceIndex =
    found >= 0
      ? found
      : Math.min(items.length - 1, Math.floor((count - 1) / 2));
  const anchorSlot = Math.floor(count / 2);
  const entries = Array.from({ length: count }, (_, slotIndex) => {
    const sourceIndex =
      (anchorSourceIndex + slotIndex - anchorSlot + items.length) %
      items.length;
    return Object.freeze({ item: items[sourceIndex], sourceIndex, slotIndex });
  });
  return Object.freeze({
    entries: Object.freeze(entries),
    anchorSlot,
    anchorSourceIndex,
  });
}

export function layoutCompleteShelfBooks(
  specs: readonly CompleteShelfBookSpec[],
  anchorSlot: number,
  gap = COMPLETE_SHELF_GAP
): readonly CompleteShelfLayoutEntry[] {
  if (!specs.length) return Object.freeze([]);
  const anchor = clamp(Math.trunc(anchorSlot), 0, specs.length - 1);
  const positions = new Array<number>(specs.length).fill(0);
  const outerSpineExtent = (spec: CompleteShelfBookSpec) =>
    spec.dimensions.pageDepth + spec.dimensions.boardThickness * 2;
  for (let index = anchor + 1; index < specs.length; index += 1) {
    positions[index] =
      positions[index - 1] +
      outerSpineExtent(specs[index - 1]) / 2 +
      outerSpineExtent(specs[index]) / 2 +
      gap;
  }
  for (let index = anchor - 1; index >= 0; index -= 1) {
    positions[index] =
      positions[index + 1] -
      outerSpineExtent(specs[index + 1]) / 2 -
      outerSpineExtent(specs[index]) / 2 -
      gap;
  }
  return Object.freeze(
    specs.map((spec, slotIndex) =>
      Object.freeze({ spec, x: round(positions[slotIndex]), slotIndex })
    )
  );
}

export function completeShelfPhaseHasInspection(phase: BookShelfPhase) {
  return ![
    "SHELF_IDLE",
    "SHELF_MOVING",
    "SHELF_SETTLING",
    "SHELF_RESTORING",
    "ERROR_FALLBACK",
  ].includes(phase);
}

const coverTarget = (phase: BookShelfPhase, selected: boolean) => {
  if (!selected) return 0;
  if (phase === "COVER_CRACKED") return -0.12;
  return [
    "COVER_OPENING",
    "BOOK_OPEN",
    "PAGE_DRAGGING",
    "PAGE_SETTLING",
  ].includes(phase)
    ? -2.18
    : 0;
};

export function buildCompleteShelfBookPose({
  layout,
  anchorSlot,
  phase,
  selectedBookKey,
  focusedBookKey,
}: {
  layout: CompleteShelfLayoutEntry;
  anchorSlot: number;
  phase: BookShelfPhase;
  selectedBookKey: string | null;
  focusedBookKey: string | null;
}): CompleteShelfBookPose {
  const { spec, slotIndex } = layout;
  const selected = spec.key === selectedBookKey;
  const focused = spec.key === focusedBookKey;
  const inspecting = selected && completeShelfPhaseHasInspection(phase);
  const spread = completeShelfPhaseHasInspection(phase)
    ? slotIndex < anchorSlot
      ? -COMPLETE_SHELF_INSPECTION_GUTTER
      : slotIndex > anchorSlot
        ? COMPLETE_SHELF_INSPECTION_GUTTER
        : 0
    : 0;
  const leafProgress =
    selected && phase === "PAGE_DRAGGING"
      ? 1
      : selected &&
          (phase === "BOOK_OPEN" ||
            phase === "COVER_OPENING" ||
            phase === "PAGE_SETTLING")
        ? 0.28
        : 0;
  const inspectionScale =
    inspecting &&
    (phase === "COVER_OPENING" ||
      phase === "BOOK_OPEN" ||
      phase === "PAGE_DRAGGING" ||
      phase === "PAGE_SETTLING")
      ? 1.5
      : inspecting
        ? 1.42
        : 1;
  return Object.freeze({
    position: Object.freeze([
      inspecting ? 0 : round(layout.x + spread),
      round(
        COMPLETE_SHELF_TOP +
          (spec.dimensions.height * inspectionScale) / 2 +
          (inspecting ? 0.018 : 0)
      ),
      inspecting
        ? 1.05
        : focused && phase === "SHELF_MOVING"
          ? 0.08
          : 0,
    ]) as readonly [number, number, number],
    rotation: Object.freeze([
      0,
      inspecting ? 0.08 : Math.PI / 2,
      0,
    ]) as readonly [number, number, number],
    scale: inspectionScale,
    coverAngle: coverTarget(phase, selected),
    firstLeafAngle: round(-0.68 * leafProgress),
    secondLeafAngle: round(-0.34 * leafProgress),
  });
}

export function completeShelfSettlementForPhase(
  phase: BookShelfPhase
): CompleteShelfSettlement | null {
  const settlements: Partial<Record<BookShelfPhase, CompleteShelfSettlement>> =
    {
      SHELF_MOVING: "motion-reached",
      SHELF_SETTLING: "motion-settled",
      INSPECTION_ENTERING: "inspection-entered",
      COVER_OPENING: "cover-opened",
      PAGE_SETTLING: "page-settled",
      INSPECTION_CLOSING: "inspection-closed",
      SHELF_RESTORING: "shelf-restored",
  };
  return settlements[phase] || null;
}
