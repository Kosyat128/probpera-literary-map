import type { RefObject } from "react";
import type { PlanetSceneInspectionController } from "./planetSceneInspection";

/** Transient UI bridge; neither a saved composition field nor a scene owner. */
export type GlobeSceneInspectionBridge = Readonly<{
  controller: PlanetSceneInspectionController;
  markerRef: RefObject<HTMLButtonElement>;
  mode: "closed" | "scene" | "object";
  /** Opaque transient session; camera values remain exclusively in GlobeCameraRig. */
  cameraSession?: string | null;
}>;
