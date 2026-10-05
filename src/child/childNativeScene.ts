import { childDataArray, childRecord, decodeChildEntityReference, type ChildEntityReference } from "./childPackage";
import type { ChildNativeProfileAppearance, ChildNativeAppearanceRestore } from "./childNativeAppearance";
import { childNativeMediaOwner, childNativeMediaToken, sameChildNativeMediaReference } from "./childNativeMedia";

/** These closed DTOs correlate a native-owned output. Parsing never verifies a
 * child review, native host, source graph, rights or a resource URI capability. */
export const CHILD_NATIVE_SCENE_PIN_KIND = "literary-planet-child-native-scene-release-pins-v2";
export const CHILD_NATIVE_SCENE_CATALOG_KIND = "literary-planet-child-native-scene-catalog-v2";
export const CHILD_NATIVE_SCENE_SOURCE_PATHS = Object.freeze([
  "src/components/globeBookCloudStandGeometry.ts", "src/components/globeCraftMaterials.ts",
  "src/components/globeLibraryBookGeometry.ts", "src/components/globeLibraryGeometry.ts",
] as const);
export type ChildNativeSceneSlotId = "skin" | "stand" | "background";
export type ChildNativeSceneMime = "image/png" | "image/jpeg" | "image/webp";
export interface ChildNativeSceneSlot {
  readonly slotId: ChildNativeSceneSlotId; readonly assetId: string; readonly entity: ChildEntityReference;
  readonly mime: ChildNativeSceneMime; readonly checksum: string; readonly encodedBytes: number; readonly altText: string;
}
export interface ChildNativeSceneHotspot {
  readonly id: string; readonly target: ChildEntityReference; readonly position: readonly [number, number, number]; readonly radius: number;
}
export interface ChildNativeSceneSummary { readonly sceneId: string; readonly title: string; readonly owner: ChildEntityReference }
export interface ChildNativeScene {
  readonly status: "opened"; readonly sceneToken: string; readonly sceneId: string; readonly owner: ChildEntityReference;
  readonly skin: ChildNativeSceneSlot;
  readonly stand: Readonly<{ geometryId: "stand.base.child-book-cloud"; asset: ChildNativeSceneSlot }>;
  readonly background: Readonly<{ geometryId: "background.base.library"; asset: ChildNativeSceneSlot }>;
  readonly hotspots: readonly ChildNativeSceneHotspot[]; readonly remainingLifetimeMs: number;
}
export interface ChildNativeWebResource {
  readonly status: "available"; readonly sceneToken: string; readonly slotId: ChildNativeSceneSlotId; readonly resourceToken: string;
  readonly assetId: string; readonly entity: ChildEntityReference; readonly mime: ChildNativeSceneMime;
  readonly checksum: string; readonly encodedBytes: number; readonly uri: string; readonly remainingLifetimeMs: number;
}
export interface ChildNativeSceneRecipient { clear(): void; join(): Promise<void> }
export interface ChildNativeSceneController {
  /** Stable protected profile choice only; decoding grants no native approval. */
  readSelection(): Promise<ChildNativeProfileAppearance | null>;
  remember(scene: ChildNativeScene, expectedRevision: number): Promise<ChildNativeProfileAppearance | null>;
  restore(expected: ChildNativeProfileAppearance): Promise<ChildNativeAppearanceRestore | null>;
  list(owner: ChildEntityReference): Promise<readonly ChildNativeSceneSummary[] | null>;
  open(owner: ChildEntityReference, sceneId: string): Promise<ChildNativeScene | null>;
  acquire(scene: ChildNativeScene, slot: ChildNativeSceneSlot): Promise<ChildNativeWebResource | null>;
  releaseResource(token: string | null): Promise<boolean>;
  release(token: string | null): Promise<boolean>;
  releaseAll(): Promise<boolean>;
  /** Privately captured concrete renderer cleanup only. Neither an ID nor the
   * completion of this callback can grant native admission. */
  attachRecipient(recipient: ChildNativeSceneRecipient): () => void;
}
export const childNativeSceneId = (x: unknown): x is string => typeof x === "string" && x===x.trim() && /^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/u.test(x);
export const childNativeSceneHash = (x: unknown): x is string => typeof x === "string" && x.length===64 && /^[a-f0-9]{64}$/u.test(x);
const number = (x: unknown, min: number, max: number): x is number => typeof x === "number" && Number.isSafeInteger(x) && !Object.is(x, -0) && x >= min && x <= max;
const text = (x: unknown, max = 240): x is string => typeof x === "string" && x.length > 0 && x.length <= max && !/[\u0000-\u001f\u007f]/u.test(x);
const mime = (x: unknown): x is ChildNativeSceneMime => ["image/png", "image/jpeg", "image/webp"].includes(x as string);
export function decodeChildNativeSceneSlot(raw: unknown, expected?: ChildNativeSceneSlotId): ChildNativeSceneSlot | null {
  const row = childRecord(raw, ["slotId","assetId","entity","mime","checksum","encodedBytes","altText"]);
  const entity = row && decodeChildEntityReference(row.entity);
  return row && entity && ["skin","stand","background"].includes(row.slotId as string) && (!expected || row.slotId === expected)
    && entity.kind === row.slotId && childNativeSceneId(row.assetId) && mime(row.mime) && childNativeSceneHash(row.checksum)
    && number(row.encodedBytes, 1, 33_554_432) && text(row.altText)
    ? Object.freeze({ ...row, entity }) as unknown as ChildNativeSceneSlot : null;
}
export function decodeChildNativeSceneHotspots(raw: unknown): readonly ChildNativeSceneHotspot[] | null {
  const rows = childDataArray(raw, 16); if (!rows) return null;
  const output: ChildNativeSceneHotspot[] = [], ids = new Set<string>();
  for (const value of rows) {
    const row = childRecord(value, ["id","target","position","radius"]), target = row && childNativeMediaOwner(row.target);
    const xyz = row && childDataArray(row.position, 3);
    if (!row || !target || !childNativeSceneId(row.id) || ids.has(row.id) || xyz?.length !== 3
      || xyz.some((n, i) => typeof n !== "number" || !Number.isFinite(n) || Object.is(n,-0) || Math.abs(n) > (i === 1 ? 5 : 10))
      || typeof row.radius !== "number" || !Number.isFinite(row.radius) || row.radius < .05 || row.radius > .6
      || Math.hypot(...xyz as number[]) - row.radius <= 1.3
      || Math.hypot(xyz[0] as number,xyz[2] as number) + row.radius >= 12) return null;
    ids.add(row.id); output.push(Object.freeze({ id: row.id, target, position: Object.freeze(xyz) as unknown as readonly [number,number,number], radius: row.radius }));
  }
  return Object.freeze(output);
}
export function decodeChildNativeSceneSummaries(raw: unknown, owner: ChildEntityReference): readonly ChildNativeSceneSummary[] | null {
  const rows = childDataArray(raw, 32); if (!rows) return null; const ids = new Set<string>(), result: ChildNativeSceneSummary[] = [];
  for (const value of rows) {
    const row = childRecord(value, ["sceneId","title","owner"]), reference = row && childNativeMediaOwner(row.owner);
    if (!row || !reference || !sameChildNativeMediaReference(reference, owner) || !childNativeSceneId(row.sceneId) || !text(row.title)
      || ids.has(row.sceneId)) return null;
    ids.add(row.sceneId); result.push(Object.freeze({ sceneId: row.sceneId, title: row.title, owner: reference }));
  }
  return Object.freeze(result);
}
export function decodeChildNativeScene(raw: unknown, owner: ChildEntityReference, id: string): ChildNativeScene | null {
  const row = childRecord(raw, ["status","sceneToken","sceneId","owner","skin","stand","background","hotspots","remainingLifetimeMs"]);
  const reference = row && childNativeMediaOwner(row.owner), skin = row && decodeChildNativeSceneSlot(row.skin,"skin");
  const s = row && childRecord(row.stand, ["geometryId","asset"]), b = row && childRecord(row.background, ["geometryId","asset"]);
  const stand = s && decodeChildNativeSceneSlot(s.asset,"stand"), background = b && decodeChildNativeSceneSlot(b.asset,"background");
  const hotspots = row && decodeChildNativeSceneHotspots(row.hotspots);
  if (!row || row.status !== "opened" || !childNativeMediaToken(row.sceneToken) || row.sceneId !== id || !childNativeSceneId(id)
    || !reference || !sameChildNativeMediaReference(reference,owner) || !skin || !stand || !background || !hotspots
    || s?.geometryId !== "stand.base.child-book-cloud" || b?.geometryId !== "background.base.library"
    || !number(row.remainingLifetimeMs,1,60000) || new Set([skin.assetId,stand.assetId,background.assetId]).size !== 3) return null;
  return Object.freeze({ status:"opened", sceneToken:row.sceneToken,sceneId:id,owner:reference,skin,
    stand:Object.freeze({geometryId:s.geometryId,asset:stand}),background:Object.freeze({geometryId:b.geometryId,asset:background}),
    hotspots,remainingLifetimeMs:row.remainingLifetimeMs });
}
export function decodeChildNativeWebResource(raw: unknown, scene: ChildNativeScene, slot: ChildNativeSceneSlot): ChildNativeWebResource | null {
  const row = childRecord(raw, ["status","sceneToken","slotId","resourceToken","assetId","entity","mime","checksum","encodedBytes","uri","remainingLifetimeMs"]);
  const entity = row && decodeChildEntityReference(row.entity);
  if (!row || row.status !== "available" || row.sceneToken !== scene.sceneToken || row.slotId !== slot.slotId || !childNativeMediaToken(row.resourceToken)
    || row.uri !== "planet-child-resource://local/" + row.resourceToken || row.assetId !== slot.assetId || !entity
    || !sameChildNativeMediaReference(entity,slot.entity) || row.mime !== slot.mime || row.checksum !== slot.checksum
    || row.encodedBytes !== slot.encodedBytes || !number(row.remainingLifetimeMs,1,60000)) return null;
  return Object.freeze({ ...row, entity }) as unknown as ChildNativeWebResource;
}
export function decodeChildNativeSceneRetired(raw: unknown, field: "sceneToken" | "resourceToken", token: string | null): boolean {
  const row = childRecord(raw, ["status", field]); return !!row && row.status === "retired" && row[field] === token;
}
export interface ChildNativeScenePins {
  readonly schemaVersion: 2; readonly kind: typeof CHILD_NATIVE_SCENE_PIN_KIND;
  readonly reviewKeys: readonly Readonly<{keyId:string;reviewerId:string;publicKeyX963Hex:string}>[];
  readonly manifests: readonly Readonly<{sceneId:string;packageId:string;packageVersion:number;packageChecksum:string;manifestChecksum:string;reviewChecksum:string}>[];
}
export function decodeChildNativeScenePins(raw: unknown): ChildNativeScenePins | null {
  const row = childRecord(raw, ["schemaVersion","kind","reviewKeys","manifests"]);
  const keys = row && childDataArray(row.reviewKeys,16), manifests = row && childDataArray(row.manifests,32);
  if (!row || row.schemaVersion !== 2 || row.kind !== CHILD_NATIVE_SCENE_PIN_KIND || !keys || !manifests) return null;
  const k: ChildNativeScenePins["reviewKeys"][number][] = [], m: ChildNativeScenePins["manifests"][number][] = [];
  for (const rawKey of keys) {
    const key = childRecord(rawKey, ["keyId","reviewerId","publicKeyX963Hex"]);
    if (!key || !text(key.keyId,67) || !/^child-scene-review-[A-Za-z0-9_-]{1,48}$/u.test(key.keyId)
      || !childNativeSceneId(key.reviewerId) || typeof key.publicKeyX963Hex !== "string" || key.publicKeyX963Hex.length!==130 || !/^04[a-f0-9]{128}$/u.test(key.publicKeyX963Hex)) return null;
    k.push(Object.freeze(key) as unknown as ChildNativeScenePins["reviewKeys"][number]);
  }
  for (const rawManifest of manifests) {
    const pin = childRecord(rawManifest, ["sceneId","packageId","packageVersion","packageChecksum","manifestChecksum","reviewChecksum"]);
    if (!pin || !childNativeSceneId(pin.sceneId) || !childNativeSceneId(pin.packageId) || !number(pin.packageVersion,1,Number.MAX_SAFE_INTEGER)
      || !["packageChecksum","manifestChecksum","reviewChecksum"].every(field=>childNativeSceneHash(pin[field]))) return null;
    m.push(Object.freeze(pin) as unknown as ChildNativeScenePins["manifests"][number]);
  }
  if (new Set(k.map(key=>key.keyId)).size !== k.length || new Set(k.map(key=>key.publicKeyX963Hex)).size !== k.length
    || new Set(m.map(pin=>pin.packageChecksum+"/"+pin.sceneId)).size !== m.length || m.length > 0 && k.length === 0) return null;
  return Object.freeze({schemaVersion:2,kind:CHILD_NATIVE_SCENE_PIN_KIND,reviewKeys:Object.freeze(k),manifests:Object.freeze(m)});
}
