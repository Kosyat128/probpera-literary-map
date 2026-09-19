import {
  DEFAULT_GLOBE_BACKGROUND_ID, GLOBE_BACKGROUND_PREFERENCE_KEY, isGlobeBackgroundId, type GlobeBackgroundId,
} from "../planet/globeBackgrounds";
import {
  createPlanetCustomizationController, usePlanetCustomization,
  PLANET_CUSTOMIZATION_CONFIRMATION_TIMEOUT_MS, PLANET_CUSTOMIZATION_PREVIEW_TIMEOUT_MS,
  type PlanetCustomizationController, type PlanetCustomizationOptions, type PlanetCustomizationSnapshot,
} from "./planetCustomization";

export const PLANET_BACKGROUND_CONFIRMATION_TIMEOUT_MS = PLANET_CUSTOMIZATION_CONFIRMATION_TIMEOUT_MS;
export const PLANET_BACKGROUND_PREVIEW_TIMEOUT_MS = PLANET_CUSTOMIZATION_PREVIEW_TIMEOUT_MS;
export type PlanetBackgroundCustomizationSnapshot = PlanetCustomizationSnapshot<GlobeBackgroundId>;
export type PlanetBackgroundCustomizationController = PlanetCustomizationController<GlobeBackgroundId>;
export type PlanetBackgroundCustomizationOptions = Pick<PlanetCustomizationOptions<GlobeBackgroundId>, "preferences" | "enabled" | "access">;

const configuration = Object.freeze({
  preferenceKey: GLOBE_BACKGROUND_PREFERENCE_KEY,
  defaultId: DEFAULT_GLOBE_BACKGROUND_ID,
  isId: isGlobeBackgroundId,
  alreadyActiveMessage: "Background customization controller is already active",
});

export function createPlanetBackgroundCustomizationController(options: PlanetBackgroundCustomizationOptions): PlanetBackgroundCustomizationController {
  return createPlanetCustomizationController({ ...options, ...configuration });
}

export function usePlanetBackgroundCustomization(options: PlanetBackgroundCustomizationOptions) {
  return usePlanetCustomization({ ...options, ...configuration });
}
