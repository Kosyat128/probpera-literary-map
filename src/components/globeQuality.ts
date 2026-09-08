export type GlobeQualityTier = "high" | "balanced" | "economy";

/** Live scene detail only: no texture, atlas, camera or animation preference. */
export type GlobeQualityProfile = Readonly<{
  tier: GlobeQualityTier;
  dprCap: number;
  antialias: boolean;
  starCount: number;
  skyShader: boolean;
  skyWidthSegments: number;
  skyHeightSegments: number;
  surfaceWidthSegments: number;
  surfaceHeightSegments: number;
  highlightWidthSegments: number;
  highlightHeightSegments: number;
  contemporaryFrameSegments: number;
  contemporaryBaseSegments: number;
  modernFrameSegments: number;
  equatorSegments: number;
}>;

const high: GlobeQualityProfile = Object.freeze({
  tier: "high", dprCap: 1.5, antialias: true, starCount: 2400,
  skyShader: true, skyWidthSegments: 48, skyHeightSegments: 32,
  surfaceWidthSegments: 144, surfaceHeightSegments: 96,
  highlightWidthSegments: 112, highlightHeightSegments: 72,
  contemporaryFrameSegments: 192, contemporaryBaseSegments: 144,
  modernFrameSegments: 176, equatorSegments: 192,
});

const balanced: GlobeQualityProfile = Object.freeze({
  tier: "balanced", dprCap: 1.25, antialias: true, starCount: 1600,
  skyShader: true, skyWidthSegments: 36, skyHeightSegments: 24,
  surfaceWidthSegments: 128, surfaceHeightSegments: 84,
  highlightWidthSegments: 104, highlightHeightSegments: 68,
  contemporaryFrameSegments: 160, contemporaryBaseSegments: 120,
  modernFrameSegments: 144, equatorSegments: 168,
});

const economy: GlobeQualityProfile = Object.freeze({
  tier: "economy", dprCap: 1.1, antialias: true, starCount: 900,
  skyShader: false, skyWidthSegments: 24, skyHeightSegments: 16,
  surfaceWidthSegments: 112, surfaceHeightSegments: 72,
  highlightWidthSegments: 96, highlightHeightSegments: 64,
  contemporaryFrameSegments: 128, contemporaryBaseSegments: 96,
  modernFrameSegments: 112, equatorSegments: 144,
});

const legacyEconomy: GlobeQualityProfile = Object.freeze({ ...economy, antialias: false });

/**
 * Explicit application tiers keep context-creation antialiasing unchanged.
 * The legacy website boolean retains its original renderer configuration.
 * High preserves the existing richest path; no new texture tier is implied.
 */
export function resolveGlobeQualityProfile(
  qualityTier?: GlobeQualityTier,
  economical = false
): GlobeQualityProfile {
  if (qualityTier === "high") return high;
  if (qualityTier === "balanced") return balanced;
  if (qualityTier === "economy") return economy;
  return economical ? legacyEconomy : high;
}
