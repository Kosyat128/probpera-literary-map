import type { BookShelfPhase } from "./bookShelfState";
import type { BookShelfPresentationProfile } from "./bookShelfPresentationProfiles";
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

const PREMIUM_FALLBACK_PALETTES = [
  {
    baseColor: "#173f52",
    accentColor: "#d49a3d",
    paperColor: "#eadfc9",
    foilColor: "#f3cf79",
  },
  {
    baseColor: "#641e2b",
    accentColor: "#c9893f",
    paperColor: "#efe0cb",
    foilColor: "#efc66e",
  },
  {
    baseColor: "#806238",
    accentColor: "#bd8437",
    paperColor: "#f5ead5",
    foilColor: "#f3d38b",
  },
  {
    baseColor: "#174b3d",
    accentColor: "#c89338",
    paperColor: "#e9dec7",
    foilColor: "#f0ca72",
  },
  {
    baseColor: "#914420",
    accentColor: "#ce8739",
    paperColor: "#f0dfc6",
    foilColor: "#f2ca75",
  },
  {
    baseColor: "#27335e",
    accentColor: "#c68d3c",
    paperColor: "#ece1cd",
    foilColor: "#efc974",
  },
  {
    baseColor: "#15505a",
    accentColor: "#c78a38",
    paperColor: "#eee1ca",
    foilColor: "#efc66f",
  },
  {
    baseColor: "#741f27",
    accentColor: "#cf8b41",
    paperColor: "#efe2d0",
    foilColor: "#f1ca76",
  },
  {
    baseColor: "#805615",
    accentColor: "#c88d35",
    paperColor: "#f1e3cb",
    foilColor: "#f2d17e",
  },
  {
    baseColor: "#1e4b7a",
    accentColor: "#ce9139",
    paperColor: "#e9dfcf",
    foilColor: "#f0c76e",
  },
  {
    baseColor: "#7a291f",
    accentColor: "#cd8b43",
    paperColor: "#f0dfca",
    foilColor: "#f1cb78",
  },
  {
    baseColor: "#4c5b24",
    accentColor: "#c9963d",
    paperColor: "#eee4ce",
    foilColor: "#efcb75",
  },
] as const;
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

const mixHexColor = (
  value: string,
  target: "#000000" | "#ffffff",
  ratio: number
) => {
  const source = color(value, "#53345f");
  const targetChannel = target === "#ffffff" ? 255 : 0;
  const amount = clamp(ratio, 0, 1);
  const channels = [1, 3, 5].map((offset) => {
    const channel = Number.parseInt(source.slice(offset, offset + 2), 16);
    return Math.round(channel + (targetChannel - channel) * amount)
      .toString(16)
      .padStart(2, "0");
  });
  return `#${channels.join("")}`;
};

const deterministicPaletteTone = (value: string, seed: number) => {
  const signedStep = ((seed >>> 24) % 9) - 4;
  return signedStep >= 0
    ? mixHexColor(value, "#ffffff", signedStep * 0.014)
    : mixHexColor(value, "#000000", Math.abs(signedStep) * 0.01);
};

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
  const presentationProfile = input.presentationProfile || null;
  const profileMotif: CompleteShelfFoilMotif | null = presentationProfile
    ? presentationProfile.spinePreset === "ornate"
      ? "arch"
      : presentationProfile.spinePreset === "ruled"
        ? "rules"
        : presentationProfile.spinePreset === "playful"
          ? "orbital"
          : "diamond"
    : null;
  const verifiedBinding =
    presentationProfile?.verifiedEditionMaterial === "leather"
      ? "leather"
      : presentationProfile?.verifiedEditionMaterial === "cloth"
        ? "cloth"
        : null;
  return Object.freeze({
    key,
    title: normalizeCompleteShelfText(input.title, 180) || "Untitled",
    writer: normalizeCompleteShelfText(input.writer, 120),
    year: rawYear >= 1000 && rawYear <= 2100 ? rawYear : null,
    sourceIndex,
    seed,
    dimensions: COMPLETE_SHELF_BOOK_FORMAT,
    // The shelf is a premium archive binding, not a reproduction of a
    // particular edition.  Every physical binding therefore comes from the
    // deterministic archive palette even when an authorized cover exists for
    // the adjacent detail panel.
    baseColor: deterministicPaletteTone(fallbackPalette.baseColor, seed),
    accentColor: deterministicPaletteTone(
      fallbackPalette.accentColor,
      seed ^ 0x9e3779b9
    ),
    paperColor: fallbackPalette.paperColor,
    foilColor: deterministicPaletteTone(
      fallbackPalette.foilColor,
      seed ^ 0x85ebca6b
    ),
    coverUrl,
    presentationProfile,
    motif: profileMotif || motifs[(seed >>> 18) % motifs.length],
    binding:
      verifiedBinding ||
      (presentationProfile?.materialPreset.includes("cloth")
        ? "cloth"
        : (seed >>> 20) % 3 === 0
          ? "cloth"
          : "leather"),
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
}: {
  pixelWidth: number;
  viewportWidth: number;
  shelfWidth: number;
}) {
  const safePixelWidth = Math.max(1, Number(pixelWidth) || 1);
  if (safePixelWidth > 640) {
    return Object.freeze({ scale: 1, positionY: 0 });
  }
  const safeViewportWidth = Math.max(0.1, Number(viewportWidth) || 0.1);
  const safeShelfWidth = Math.max(0.1, Number(shelfWidth) || 0.1);
  return Object.freeze({
    scale: round(clamp((safeViewportWidth * 0.9) / safeShelfWidth, 0.3, 0.72)),
    positionY: -0.18,
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
  pageTurnProgress,
  pageDirection = "forward",
}: {
  layout: CompleteShelfLayoutEntry;
  anchorSlot: number;
  phase: BookShelfPhase;
  selectedBookKey: string | null;
  focusedBookKey: string | null;
  pageTurnProgress?: number;
  pageDirection?: "forward" | "backward";
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
          (inspecting ? COMPLETE_SHELF_INSPECTION_LIFT : 0)
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
  return ["INSPECTION_CLOSED", "COVER_CRACKED", "BOOK_OPEN"].includes(
    phase
  );
}
