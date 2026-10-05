import { childRecord, type ChildEntityReference } from "./childPackage";
import { childNativeSceneId, decodeChildNativeScene, type ChildNativeScene } from "./childNativeScene";

/** Stable local choice only. This projection grants no native, review, rights,
 * profile or resource authority and intentionally contains no capability. */
export interface ChildNativeAppearanceSelection {
  readonly schemaVersion: 1;
  readonly sceneId: string;
  readonly owner: Readonly<{ kind: ChildEntityReference["kind"]; id: string }>;
  readonly skin: Readonly<{ assetId: string; entityId: string }>;
  readonly stand: Readonly<{ geometryId: "stand.base.child-book-cloud"; assetId: string; entityId: string }>;
  readonly background: Readonly<{ geometryId: "background.base.library"; assetId: string; entityId: string }>;
}
export interface ChildNativeProfileAppearance {
  readonly profileId: string; readonly revision: number;
  readonly selection: ChildNativeAppearanceSelection | null;
}
export interface ChildNativeAppearanceRestore extends ChildNativeProfileAppearance {
  readonly status: "absent" | "restored" | "unavailable";
  readonly scene: ChildNativeScene | null;
}
const owners = new Set(["country", "writer", "biography", "work", "character", "storyworld", "fact", "quote",
  "activity", "quiz", "search-result", "recommendation", "favorite", "recent", "offline-package", "deep-link"]);
export const childNativeAppearanceRevision = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && !Object.is(value, -0) && value >= 0 && value < Number.MAX_SAFE_INTEGER;
function slot(raw: unknown) {
  const value = childRecord(raw, ["assetId", "entityId"]);
  return value && childNativeSceneId(value.assetId) && childNativeSceneId(value.entityId)
    ? Object.freeze({ assetId: value.assetId, entityId: value.entityId }) : null;
}
function geometry(raw: unknown, expected: "stand.base.child-book-cloud" | "background.base.library") {
  const value = childRecord(raw, ["geometryId", "assetId", "entityId"]);
  return value && value.geometryId === expected && childNativeSceneId(value.assetId) && childNativeSceneId(value.entityId)
    ? Object.freeze({ geometryId: expected, assetId: value.assetId, entityId: value.entityId }) : null;
}
export function decodeChildNativeAppearanceSelection(raw: unknown): ChildNativeAppearanceSelection | null {
  try {
    const value = childRecord(raw, ["schemaVersion", "sceneId", "owner", "skin", "stand", "background"]);
    const owner = value && childRecord(value.owner, ["kind", "id"]);
    const skin = value && slot(value.skin), stand = value && geometry(value.stand, "stand.base.child-book-cloud");
    const background = value && geometry(value.background, "background.base.library");
    if (!value || value.schemaVersion !== 1 || !childNativeSceneId(value.sceneId) || !owner
      || typeof owner.kind !== "string" || !owners.has(owner.kind) || !childNativeSceneId(owner.id)
      || !skin || !stand || !background || new Set([skin.assetId, stand.assetId, background.assetId]).size !== 3) return null;
    return Object.freeze({ schemaVersion: 1, sceneId: value.sceneId,
      owner: Object.freeze({ kind: owner.kind as ChildEntityReference["kind"], id: owner.id }), skin,
      stand: stand as ChildNativeAppearanceSelection["stand"],
      background: background as ChildNativeAppearanceSelection["background"] });
  } catch { return null; }
}
export function childNativeAppearanceFromScene(scene: ChildNativeScene): ChildNativeAppearanceSelection | null {
  // The decoder still verifies a closed stable projection. It cannot manufacture
  // the native live lease from which a genuine native write derives this value.
  return decodeChildNativeAppearanceSelection({ schemaVersion: 1, sceneId: scene.sceneId,
    owner: { kind: scene.owner.kind, id: scene.owner.id },
    skin: { assetId: scene.skin.assetId, entityId: scene.skin.entity.id },
    stand: { geometryId: scene.stand.geometryId, assetId: scene.stand.asset.assetId, entityId: scene.stand.asset.entity.id },
    background: { geometryId: scene.background.geometryId, assetId: scene.background.asset.assetId, entityId: scene.background.asset.entity.id } });
}
export function sameChildNativeAppearance(a: ChildNativeAppearanceSelection, b: ChildNativeAppearanceSelection): boolean {
  return a.schemaVersion === b.schemaVersion && a.sceneId === b.sceneId && a.owner.kind === b.owner.kind && a.owner.id === b.owner.id
    && a.skin.assetId === b.skin.assetId && a.skin.entityId === b.skin.entityId
    && a.stand.geometryId === b.stand.geometryId && a.stand.assetId === b.stand.assetId && a.stand.entityId === b.stand.entityId
    && a.background.geometryId === b.background.geometryId && a.background.assetId === b.background.assetId
    && a.background.entityId === b.background.entityId;
}
export function decodeChildNativeProfileAppearance(raw: unknown, profileId: string): ChildNativeProfileAppearance | null {
  try {
    const value = childRecord(raw, ["profileId", "revision", "selection"]);
    const selection = value?.selection === null ? null : decodeChildNativeAppearanceSelection(value?.selection);
    if (!value || !childNativeSceneId(profileId) || value.profileId !== profileId || !childNativeAppearanceRevision(value.revision)
      || value.selection !== null && !selection || value.revision === 0 && selection !== null) return null;
    return Object.freeze({ profileId, revision: value.revision, selection });
  } catch { return null; }
}
export function decodeChildNativeAppearanceRestore(raw: unknown, profileId: string,
  expected: ChildNativeProfileAppearance): ChildNativeAppearanceRestore | null {
  try {
    const value = childRecord(raw, ["status", "profileId", "revision", "selection", "scene"]);
    if (!value || expected.profileId !== profileId) return null;
    const saved = decodeChildNativeProfileAppearance({ profileId: value.profileId, revision: value.revision, selection: value.selection }, profileId);
    if (!saved || saved.revision !== expected.revision || (saved.selection === null) !== (expected.selection === null)
      || saved.selection && expected.selection && !sameChildNativeAppearance(saved.selection, expected.selection)) return null;
    if (value.status === "absent") return !saved.selection && value.scene === null ? Object.freeze({ ...saved, status: "absent", scene: null }) : null;
    if (value.status === "unavailable") return saved.selection && value.scene === null ? Object.freeze({ ...saved, status: "unavailable", scene: null }) : null;
    if (value.status !== "restored" || !saved.selection) return null;
    const row = childRecord(value.scene, ["status", "sceneToken", "sceneId", "owner", "skin", "stand", "background", "hotspots", "remainingLifetimeMs"]);
    const owner = row && childRecord(row.owner, ["kind", "id", "contentChecksum"]);
    if (!row || !owner || owner.kind !== saved.selection.owner.kind || owner.id !== saved.selection.owner.id) return null;
    const scene = decodeChildNativeScene(value.scene, owner as unknown as ChildEntityReference, saved.selection.sceneId);
    const projected = scene && childNativeAppearanceFromScene(scene);
    return scene && projected && sameChildNativeAppearance(projected, saved.selection)
      ? Object.freeze({ ...saved, status: "restored", scene }) : null;
  } catch { return null; }
}
