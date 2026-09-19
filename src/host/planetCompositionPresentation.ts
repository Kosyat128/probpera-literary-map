import type { PlanetCompositionController, PlanetCompositionSnapshot } from "./planetComposition";
import type { PlanetCustomizationSnapshot } from "./planetCustomization";
import type { GlobeStandId } from "../planet/globeStands";
import type { GlobeBackgroundId } from "../planet/globeBackgrounds";
import { strictWebStorage } from "../utils/safeWebStorage";

export type PlanetCompositionPresentation = Readonly<{
  controller: PlanetCompositionController;
  snapshot: PlanetCompositionSnapshot;
}>;

/** Views of one owner, with no independent preference queues or lifecycle. */
export function compositionCustomizationView<Part extends "stand" | "background">(
  owner: PlanetCompositionPresentation, part: Part,
) {
  type Id = Part extends "stand" ? GlobeStandId : GlobeBackgroundId;
  const { controller, snapshot } = owner;
  const key = part === "stand" ? "standId" : "backgroundId";
  const isOpen = snapshot.editor === part;
  const view: PlanetCustomizationSnapshot<Id> = {
    appliedId: snapshot.applied[key] as Id,
    displayedId: snapshot.displayed[key] as Id,
    previewId: isOpen && (snapshot.phase === "preparing" || snapshot.phase === "preview")
      ? snapshot.displayed[key] as Id : null,
    isOpen, phase: isOpen ? snapshot.phase : "idle",
    renderRevision: snapshot.renderRevision, saveState: snapshot.saveState,
    reason: snapshot.reason === "preview-timeout" ? "preview-timeout"
      : snapshot.reason === "render-failed" || snapshot.reason === "incompatible" ? "render-failed" : null,
  };
  return {
    snapshot: view,
    controller: {
      open: () => controller.open(part),
      preview: (id: Id) => controller.preview(part, id),
      apply: controller.apply, cancel: controller.cancel, retrySave: controller.retrySave,
    },
  };
}

/** Migration is read-only, and used only after confirmed absent platform keys. */
export function readLegacyWebViewGlobeEdition(): string | null {
  if (typeof window === "undefined") return null;
  const storage = strictWebStorage("local");
  return storage.getItem("probpera.globe-edition.v2")
    ?? storage.getItem("probpera.globe-style.v1");
}
