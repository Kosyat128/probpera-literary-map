import type { Group, Texture } from "three";
import { isGlobeBackgroundId, type GlobeBackgroundId } from "../planet/globeBackgrounds";
import { createGlobeLibrary } from "./globeLibraryGeometry";
import { createGlobeWriterStudy } from "./globeWriterStudyGeometry";
import type { GlobeQualityTier } from "./globeQuality";

export interface OwnedGlobeBackground {
  readonly group: Group;
  setAmbientTime(seconds: number): void;
  /** Borrow the displayed atlas texture; the atlas retains all mutation and disposal ownership. */
  setAtlasMap?(texture: Texture | null): void;
  dispose(): void;
}

/** Exact bundled scene dispatch; the site starfield keeps its existing owner. */
export function createIncludedGlobeBackground(id: GlobeBackgroundId, quality: GlobeQualityTier): OwnedGlobeBackground {
  if (!isGlobeBackgroundId(id)) throw new Error("Invalid included globe background");
  switch (id) {
    case "background.base.library": return createGlobeLibrary(quality);
    case "background.base.writer-study": return createGlobeWriterStudy(quality);
    default: throw new Error("The canonical background is owned by the existing scene");
  }
}
