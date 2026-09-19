import {
  DEFAULT_GLOBE_STAND_ID, GLOBE_STAND_PREFERENCE_KEY, isGlobeStandId, type GlobeStandId,
} from "../planet/globeStands";
import {
  createPlanetCustomizationController, usePlanetCustomization,
  PLANET_CUSTOMIZATION_CONFIRMATION_TIMEOUT_MS, PLANET_CUSTOMIZATION_PREVIEW_TIMEOUT_MS,
  type PlanetCustomizationController, type PlanetCustomizationOptions, type PlanetCustomizationSnapshot,
} from "./planetCustomization";

export const PLANET_STAND_CONFIRMATION_TIMEOUT_MS = PLANET_CUSTOMIZATION_CONFIRMATION_TIMEOUT_MS;
export const PLANET_STAND_PREVIEW_TIMEOUT_MS = PLANET_CUSTOMIZATION_PREVIEW_TIMEOUT_MS;
export type PlanetStandCustomizationSnapshot = PlanetCustomizationSnapshot<GlobeStandId>;
export type PlanetStandCustomizationController = PlanetCustomizationController<GlobeStandId>;
export type PlanetStandCustomizationOptions = Pick<PlanetCustomizationOptions<GlobeStandId>, "preferences" | "enabled" | "access">;

const configuration = Object.freeze({
  preferenceKey: GLOBE_STAND_PREFERENCE_KEY,
  defaultId: DEFAULT_GLOBE_STAND_ID,
  isId: isGlobeStandId,
  alreadyActiveMessage: "Stand customization controller is already active",
});

export function createPlanetStandCustomizationController(options: PlanetStandCustomizationOptions): PlanetStandCustomizationController {
  return createPlanetCustomizationController({ ...options, ...configuration });
}

export function usePlanetStandCustomization(options: PlanetStandCustomizationOptions) {
  return usePlanetCustomization({ ...options, ...configuration });
}
