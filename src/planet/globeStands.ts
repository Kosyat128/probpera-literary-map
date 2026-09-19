import { baseEditionPolicy } from "./baseEditionPolicy";

export const INCLUDED_GLOBE_STAND_IDS = Object.freeze([
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
  provenance: "authored-in-project" as const,
  source: "src/components/globeStandGeometry.ts",
  contentVersion: 1,
  supportedAccess: "adult" as const,
  childReviewed: false,
  rightsReviewed: false,
  grantsEntitlement: false,
  releaseReady: false,
})));

export function isIncludedGlobeStandId(value: unknown): value is IncludedGlobeStandId {
  if (!INCLUDED_GLOBE_STAND_IDS.some(id => id === value)) return false;
  const inclusion = baseEditionPolicy.classify(value);
  return inclusion.included && inclusion.canonicalId === value;
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
  onFailed: (revision: number, id: GlobeStandId) => void;
  onContextLost: () => void;
  onEditionChange: () => void;
}>;
