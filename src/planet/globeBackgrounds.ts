import { GLOBE_EDITIONS } from "../components/globeEditions";
import { baseEditionPolicy } from "./baseEditionPolicy";
import { GLOBE_STAND_IDS, isGlobeStandId } from "./globeStands";

export const GLOBE_BACKGROUND_IDS = Object.freeze([
  "background.base.site-starfield", "background.base.library", "background.base.writer-study",
] as const);
export type GlobeBackgroundId = typeof GLOBE_BACKGROUND_IDS[number];
export const DEFAULT_GLOBE_BACKGROUND_ID: GlobeBackgroundId = "background.base.site-starfield";
export const GLOBE_BACKGROUND_PREFERENCE_KEY = "probpera-planet-background-v1";

const editions = Object.freeze(GLOBE_EDITIONS.filter(edition =>
  edition.visitorAvailable && edition.status === "available").map(edition => edition.id));
const qualityTiers = Object.freeze(["high", "balanced", "economy"] as const);

/** Bundled source inventory. Inclusion does not grant rights, review or entitlements. */
export const GLOBE_BACKGROUNDS = Object.freeze(GLOBE_BACKGROUND_IDS.map(id => Object.freeze({
  id,
  commercialAvailability: "included-in-base" as const,
  provenance: "authored-in-project" as const,
  source: id === DEFAULT_GLOBE_BACKGROUND_ID
    ? "src/components/LiteraryGlobe.tsx" : id === "background.base.writer-study"
      ? "src/components/globeWriterStudyGeometry.ts" : "src/components/globeLibraryGeometry.ts",
  contentVersion: 1,
  sceneId: id === DEFAULT_GLOBE_BACKGROUND_ID ? "museum-starfield-3d"
    : id === "background.base.writer-study" ? "probpera-writer-study-3d" : "probpera-library-3d",
  supportedEditions: editions,
  supportedStands: GLOBE_STAND_IDS,
  supportedAccess: "adult" as const,
  qualityTiers,
  fallbackId: DEFAULT_GLOBE_BACKGROUND_ID,
  childReviewed: false,
  rightsReviewed: false,
  grantsEntitlement: false,
  releaseReady: false,
})));

export function isGlobeBackgroundId(value: unknown): value is GlobeBackgroundId {
  if (!GLOBE_BACKGROUND_IDS.some(id => id === value)) return false;
  const inclusion = baseEditionPolicy.classify(value);
  return inclusion.included && inclusion.canonicalId === value;
}

export type GlobeBackgroundCompatibility = Readonly<{ compatible: true }> | Readonly<{
  compatible: false;
  reason: "unknown-background" | "unknown-edition" | "unknown-stand" | "unsupported-quality" | "access-blocked";
}>;

/** Exact local compatibility only; unknown catalog or child authority cannot allow a scene. */
export function checkGlobeBackgroundCompatibility(context: Readonly<{
  backgroundId: unknown; editionId: unknown; standId: unknown; qualityTier: unknown; access: unknown;
}>): GlobeBackgroundCompatibility {
  if (!isGlobeBackgroundId(context?.backgroundId)) return Object.freeze({ compatible: false, reason: "unknown-background" });
  if (!editions.some(id => id === context.editionId)) return Object.freeze({ compatible: false, reason: "unknown-edition" });
  if (!isGlobeStandId(context.standId)) return Object.freeze({ compatible: false, reason: "unknown-stand" });
  if (!qualityTiers.some(tier => tier === context.qualityTier)) return Object.freeze({ compatible: false, reason: "unsupported-quality" });
  if (context.access !== "adult") return Object.freeze({ compatible: false, reason: "access-blocked" });
  return Object.freeze({ compatible: true });
}

/** The application owns selection; the one existing renderer acknowledges a real frame. */
export type GlobeBackgroundPresentation = Readonly<{
  appliedId: GlobeBackgroundId;
  displayedId: GlobeBackgroundId;
  renderRevision: number;
  onRendered: (revision: number, id: GlobeBackgroundId) => void;
  onFrameRendered?: (revision: number, id: GlobeBackgroundId, frame: number) => void;
  onFailed: (revision: number, id: GlobeBackgroundId) => void;
  onContextLost: () => void;
  onContextRestored?: () => void;
  onEditionChange: () => void;
}>;
