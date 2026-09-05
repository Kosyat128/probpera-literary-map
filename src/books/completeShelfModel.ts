import type { BookShelfPhase } from "./bookShelfState";
import type { BookShelfPresentationProfile } from "./bookShelfPresentationProfiles";
import { bookShelfCoverAngle, resolveBookShelfInspectionGutter } from "./bookShelfPhysicalLayout";
/** The archive/catalog controller advances by one predictable editorial batch. */
export const COMPLETE_SHELF_CATALOG_BATCH_SIZE = 13;
export const COMPLETE_SHELF_MAX_WORKING_SET = 21;
export const COMPLETE_SHELF_ECONOMICAL_WORKING_SET = 17;
export const COMPLETE_SHELF_TABLET_WORKING_SET = 13;
export const COMPLETE_SHELF_TABLET_ECONOMICAL_WORKING_SET = 11;
export const COMPLETE_SHELF_MOBILE_WORKING_SET = 9;
export const COMPLETE_SHELF_MOBILE_ECONOMICAL_WORKING_SET = 7;
export const COMPLETE_SHELF_GAP = 0.022;
export const COMPLETE_SHELF_TOP = -1.02;
export const COMPLETE_SHELF_INSPECTION_LIFT = 0.13;
export const COMPLETE_SHELF_BOOK_FORMAT = Object.freeze({
  height: 1.52,
  coverWidth: 1.07,
  pageDepth: 0.27,
  boardThickness: 0.032,
  pageInset: 0.052,
});

export function completeShelfVisibleBookLimit(requested: number) {
  return Math.max(1, Math.min(17, Math.trunc(requested) || 1));
}

export function completeShelfRowWidth(count: number) {
  const spine = COMPLETE_SHELF_BOOK_FORMAT.pageDepth + COMPLETE_SHELF_BOOK_FORMAT.boardThickness * 2;
  return Math.max(spine, count * spine + Math.max(0, count - 1) * COMPLETE_SHELF_GAP);
}

export const OWNER_LOCKED_SPINE_PALETTE = Object.freeze([
  "#406872", "#BF5441", "#889149", "#C29043", "#AC4141", "#BB5441",
  "#508B8A", "#808A44", "#A3494E", "#CC7545", "#45739C", "#B34E3E",
  "#B08B56", "#BB8B43", "#4C5580", "#B8873E", "#B07C35",
] as const);
export const OWNER_LOCKED_WOVEN_CLOTH = "OWNER_LOCKED_WOVEN_CLOTH" as const;
/** Compatibility export. Actual clearance is resolved from the moving rig. */
export const COMPLETE_SHELF_INSPECTION_GUTTER = 0.72;

export type CompleteShelfFoilMotif =
  | "arch"
  | "diamond"
  | "orbital"
  | "rules";

export type CompleteShelfBinding = "leather" | "cloth";

export type CompleteShelfItemInput = Readonly<{
  key: string;
  title: string;
  writer: string;
  year?: number | null;
  baseColor: string;
  accentColor: string;
  paperColor: string;
  coverUrl?: string;
  presentationProfile?: BookShelfPresentationProfile;
  /** Explicit palette identity for the deterministic owner reference fixture. */
  ownerPaletteSlot?: number;
}>;

export type CompleteShelfBookSpec = Readonly<{
  key: string;
  title: string;
  writer: string;
  year: number | null;
  sourceIndex: number;
  seed: number;
  paletteSlot: number;
  physicalBindingVisual: typeof OWNER_LOCKED_WOVEN_CLOTH;
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
  presentationProfile: BookShelfPresentationProfile | null;
  motif: CompleteShelfFoilMotif;
  binding: CompleteShelfBinding;
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

export type CompleteShelfVerticalBounds = Readonly<{
  minY: number;
  maxY: number;
  opticalCenterY: number;
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
  const requestedSlot = input.ownerPaletteSlot ?? -1;
  const paletteSlot = Number.isInteger(requestedSlot) &&
    requestedSlot >= 0 && requestedSlot < OWNER_LOCKED_SPINE_PALETTE.length
    ? requestedSlot
    : (seed >>> 9) % OWNER_LOCKED_SPINE_PALETTE.length;
  const rawYear = Number.isFinite(input.year) ? Math.trunc(input.year as number) : 0;
  const presentationProfile = input.presentationProfile || null;
  return Object.freeze({
    key,
    title: normalizeCompleteShelfText(input.title, 180) || "Untitled",
    writer: normalizeCompleteShelfText(input.writer, 120),
    year: rawYear >= 1000 && rawYear <= 2100 ? rawYear : null,
    sourceIndex,
    seed,
    dimensions: COMPLETE_SHELF_BOOK_FORMAT,
    paletteSlot,
    physicalBindingVisual: OWNER_LOCKED_WOVEN_CLOTH,
    baseColor: OWNER_LOCKED_SPINE_PALETTE[paletteSlot],
    accentColor: "#d7be83",
    paperColor: "#efe5d2",
    foilColor: "#f3ead7",
    coverUrl,
    presentationProfile,
    motif: "rules",
    binding: "cloth",
    lean: 0,
  });
}

export function completeShelfWorkingSetLimit(
  pixelWidth: number,
  economical: boolean
) {
  const safePixelWidth = Math.max(1, Number(pixelWidth) || 1);
  if (safePixelWidth <= 640) {
    return economical
      ? COMPLETE_SHELF_MOBILE_ECONOMICAL_WORKING_SET
      : COMPLETE_SHELF_MOBILE_WORKING_SET;
  }
  if (safePixelWidth <= 1024) {
    return economical
      ? COMPLETE_SHELF_TABLET_ECONOMICAL_WORKING_SET
      : COMPLETE_SHELF_TABLET_WORKING_SET;
  }
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
  const preferredAnchorSlot = Math.floor(count / 2);
  const startSourceIndex = clamp(
    anchorSourceIndex - preferredAnchorSlot,
    0,
    Math.max(0, items.length - count)
  );
  const anchorSlot = anchorSourceIndex - startSourceIndex;
  const entries = Array.from({ length: count }, (_, slotIndex) => {
    const sourceIndex = startSourceIndex + slotIndex;
    return Object.freeze({ item: items[sourceIndex], sourceIndex, slotIndex });
  });
  return Object.freeze({
    entries: Object.freeze(entries),
    anchorSlot,
    anchorSourceIndex,
  });
}

export function resolveCompleteShelfViewportFraming({
  pixelWidth,
  viewportWidth,
  shelfWidth,
  verticalBounds = resolveCompleteShelfVerticalBounds(),
}: {
  pixelWidth: number;
  viewportWidth: number;
  shelfWidth: number;
  verticalBounds?: CompleteShelfVerticalBounds;
}) {
  const safePixelWidth = Math.max(1, Number(pixelWidth) || 1);
  const safeViewportWidth = Math.max(0.1, Number(viewportWidth) || 0.1);
  const safeShelfWidth = Math.max(0.1, Number(shelfWidth) || 0.1);
  const scale =
    safePixelWidth > 640
      ? 1
      : round(clamp((safeViewportWidth * 0.9) / safeShelfWidth, 0.3, 0.72));
  return Object.freeze({
    scale,
    positionY: round(-verticalBounds.opticalCenterY * scale),
  });
}

/**
 * The optical shelf bounds include the wooden slab below the bindings. Keeping
 * their midpoint at world Y=0 prevents the first rendered frame from drifting
 * as the camera and viewport finish their layout.
 */
export function resolveCompleteShelfVerticalBounds(
  specs: readonly CompleteShelfBookSpec[] = []
): CompleteShelfVerticalBounds {
  const tallestBook = specs.reduce<number>(
    (height, spec) => Math.max(height, spec.dimensions.height),
    COMPLETE_SHELF_BOOK_FORMAT.height
  );
  const minY = round(COMPLETE_SHELF_TOP - 0.2);
  const maxY = round(COMPLETE_SHELF_TOP + tallestBook);
  return Object.freeze({
    minY,
    maxY,
    opticalCenterY: round((minY + maxY) / 2),
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

export function buildCompleteShelfBookPose({
  layout,
  anchorSlot,
  phase,
  selectedBookKey,
  focusedBookKey,
  pageTurnProgress,
  pageDirection = "forward",
  hovered = false,
  pressed = false,
  inspectionScale = 1.42,
  inspectionOriginX = 0,
}: {
  layout: CompleteShelfLayoutEntry;
  anchorSlot: number;
  phase: BookShelfPhase;
  selectedBookKey: string | null;
  focusedBookKey: string | null;
  pageTurnProgress?: number;
  pageDirection?: "forward" | "backward";
  hovered?: boolean;
  pressed?: boolean;
  inspectionScale?: number;
  inspectionOriginX?: number;
}): CompleteShelfBookPose {
  const { spec, slotIndex } = layout;
  const selected = spec.key === selectedBookKey;
  const focused = spec.key === focusedBookKey;
  const inspecting = selected && completeShelfPhaseHasInspection(phase);
  const gutter = resolveBookShelfInspectionGutter({
    dimensions: spec.dimensions,
    phase,
    scale: inspectionScale,
    pageProgress: pageTurnProgress,
  });
  const spread = completeShelfPhaseHasInspection(phase)
    ? slotIndex < anchorSlot
      ? -gutter.left
      : slotIndex > anchorSlot
        ? gutter.right
        : 0
    : 0;
  const defaultLeafProgress =
    selected && phase === "PAGE_DRAGGING"
      ? 1
      : selected &&
          (phase === "BOOK_OPEN" ||
            phase === "COVER_OPENING" ||
            phase === "PAGE_SETTLING")
        ? 0.28
        : 0;
  const leafProgress =
    selected &&
    (phase === "PAGE_DRAGGING" || phase === "PAGE_SETTLING") &&
    Number.isFinite(pageTurnProgress)
      ? Math.min(1, Math.max(0, pageTurnProgress || 0))
      : defaultLeafProgress;
  const pageDirectionSign = pageDirection === "backward" ? 1 : -1;
  const segmentedPageActive = Number.isFinite(pageTurnProgress);
  const pageTurnAngle = segmentedPageActive ? 0 : 0.68;
  const scale = inspecting ? inspectionScale : 1;
  return Object.freeze({
    position: Object.freeze([
      inspecting ? 0 : round(layout.x + spread -
        (completeShelfPhaseHasInspection(phase) ? inspectionOriginX : 0)),
      round(
          COMPLETE_SHELF_TOP +
          (spec.dimensions.height * scale) / 2 +
          (inspecting ? COMPLETE_SHELF_INSPECTION_LIFT : 0)
      ),
      inspecting
        ? 1.05
        : pressed
          ? 0.035
          : hovered
            ? 0.09
            : focused
              ? 0.025
          : 0,
    ]) as readonly [number, number, number],
    rotation: Object.freeze([
      0,
      inspecting ? 0.08 : Math.PI / 2,
      0,
    ]) as readonly [number, number, number],
    scale,
    coverAngle: selected ? bookShelfCoverAngle(phase) : 0,
    firstLeafAngle: round(pageDirectionSign * pageTurnAngle * leafProgress),
    secondLeafAngle: segmentedPageActive
      ? 0
      : round(pageDirectionSign * 0.34 * leafProgress),
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

export function completeShelfPhaseAllowsSelectionSwitch(
  phase: BookShelfPhase
) {
  return [
    "INSPECTION_ENTERING",
    "INSPECTION_CLOSED",
    "COVER_CRACKED",
    "COVER_OPENING",
    "BOOK_OPEN",
    "PAGE_DRAGGING",
    "PAGE_SETTLING",
  ].includes(phase);
}
