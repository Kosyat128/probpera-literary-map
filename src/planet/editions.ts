/** Existing edition metadata and asset references; no texture/renderer loading. */
export {
  AVAILABLE_GLOBE_EDITIONS,
  DEFAULT_GLOBE_EDITION_ID,
  GLOBE_EDITIONS,
  GLOBE_EDITION_BY_ID,
  GLOBE_EDITION_IDS,
  SOURCE_ONLY_CENTROID_OVERLAY_PROFILE,
  STANDARD_GLOBE_OVERLAY_PROFILE,
  editionIdForLegacySurfaceProfile,
  globeEditionText,
  isGlobeEditionId,
  legacySurfaceProfileForEdition,
  parseStoredGlobeEdition,
  resolveGlobeEditionTexturePath,
  resolveGlobeEditionTextureUrl,
} from "../components/globeEditions";
export type {
  GlobeEditionDefinition,
  GlobeEditionId,
  GlobeEditionStatus,
  GlobeEditionTexture,
  GlobeOverlayProfile,
  LegacyGlobeVisualStyle,
} from "../components/globeEditions";
