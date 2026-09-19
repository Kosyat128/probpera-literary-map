import { baseEditionPolicy } from "./baseEditionPolicy";

export const THREE_WHALES_GLOBE_STAND_ID = "stand.base.three-whales" as const;
export const INCLUDED_GLOBE_STAND_IDS = Object.freeze([
  THREE_WHALES_GLOBE_STAND_ID,
  "stand.base.museum", "stand.base.wood", "stand.base.book-stack",
] as const);
export type IncludedGlobeStandId = typeof INCLUDED_GLOBE_STAND_IDS[number];
export type GlobeStandId = "canonical" | IncludedGlobeStandId;
export const DEFAULT_GLOBE_STAND_ID: GlobeStandId = "canonical";
export const GLOBE_STAND_PREFERENCE_KEY = "probpera-planet-stand-v1";
export const GLOBE_STAND_IDS: readonly GlobeStandId[] = Object.freeze([
  DEFAULT_GLOBE_STAND_ID, ...INCLUDED_GLOBE_STAND_IDS,
]);

/** Source inventory only. Inclusion never supplies ownership or review approval. */
export const INCLUDED_GLOBE_STANDS = Object.freeze(INCLUDED_GLOBE_STAND_IDS.map(id => Object.freeze({
  id,
  commercialAvailability: "included-in-base" as const,
  provenance: id === THREE_WHALES_GLOBE_STAND_ID ? "canonical-site-derived" as const : "authored-in-project" as const,
  source: id === THREE_WHALES_GLOBE_STAND_ID
    ? "src/components/globeWhaleStandGeometry.ts" : "src/components/globeStandGeometry.ts",
  sourceItemId: id === THREE_WHALES_GLOBE_STAND_ID ? "canonical-globe" : id,
  canonicalSource: id === THREE_WHALES_GLOBE_STAND_ID ? "src/components/LiteraryGlobe.tsx#MythicGlobeFrame" : null,
  contentVersion: id === THREE_WHALES_GLOBE_STAND_ID ? 1 : 2,
  iapSkuAllowed: false,
  supportedAccess: "adult" as const,
  childReviewed: false,
  rightsReviewed: false,
  grantsEntitlement: false,
  releaseReady: false,
})));

export function isIncludedGlobeStandId(value: unknown): value is IncludedGlobeStandId {
  // Descriptor membership is the exact local allowlist. The independent base
  // policy must also resolve this ID to its declared included source identity.
  const descriptor = INCLUDED_GLOBE_STANDS.find(stand => stand.id === value);
  if (!descriptor) return false;
  const inclusion = baseEditionPolicy.classify(value);
  return inclusion.included && inclusion.canonicalId === descriptor.sourceItemId;
}
export function isGlobeStandId(value: unknown): value is GlobeStandId {
  return value === DEFAULT_GLOBE_STAND_ID || isIncludedGlobeStandId(value);
}

/** Scene bridge: the app owns intent; the existing renderer reports completion. */
export type GlobeStandPresentation = Readonly<{
  appliedId: GlobeStandId;
  displayedId: GlobeStandId;
  renderRevision: number;
  onRendered: (revision: number, id: GlobeStandId) => void;
  onFrameRendered?: (revision: number, id: GlobeStandId, frame: number) => void;
  onFailed: (revision: number, id: GlobeStandId) => void;
  onContextLost: () => void;
  onContextRestored?: () => void;
  onEditionChange: () => void;
}>;
