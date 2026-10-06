import { childDataArray, childRecord, decodeChildEntityReference, type ChildEntityReference } from "./childPackage";

/** LOCAL2 presentation data. Only the native original package worker can
 * admit/read/decode media. No V1 route challenge, byte buffer or URL crosses
 * this seam and a presentation token is correlation, never a grant. */
export const CHILD_NATIVE_MEDIA_METHODS = Object.freeze(["listMedia", "presentMedia", "releaseMedia"] as const);
export const CHILD_NATIVE_MEDIA_ROLES = Object.freeze(["image", "portrait", "narration", "background", "skin", "stand", "accessory"] as const);
export type ChildNativeMediaRole = typeof CHILD_NATIVE_MEDIA_ROLES[number];
export type ChildNativeMediaMime = "image/png" | "image/jpeg" | "image/webp" | "audio/wav" | "model/gltf+json" | "model/gltf-binary" | "application/octet-stream";
export interface ChildNativeMediaAsset {
  readonly assetId: string;
  readonly owner: ChildEntityReference;
  readonly entity: ChildEntityReference;
  readonly mime: ChildNativeMediaMime;
  readonly role: ChildNativeMediaRole;
  readonly altText: string;
  readonly transcript: string | null;
}
export interface ChildNativeMediaLayout {
  readonly x: number; readonly y: number;
  readonly width: number; readonly height: number;
  readonly viewportWidth: number; readonly viewportHeight: number;
}
export interface ChildNativeMediaPresentation {
  readonly status: "presented" | "unavailable";
  readonly presentationToken: string | null;
  readonly assetId: string;
  readonly remainingLifetimeMs: number;
}
export interface ChildNativeMediaController {
  list(owner: ChildEntityReference): Promise<readonly ChildNativeMediaAsset[] | null>;
  present(asset: ChildNativeMediaAsset, layout: ChildNativeMediaLayout): Promise<ChildNativeMediaPresentation | null>;
  release(presentationToken: string | null): Promise<boolean>;
  /** Joins actual native release replies before an entity route is published.
   * Native retirement separately owns its concrete UI/audio/worker drains. */
  releaseAll(): Promise<boolean>;
}
const textKinds = new Set(["country", "writer", "biography", "work", "character", "storyworld", "fact", "quote",
  "activity", "quiz", "search-result", "recommendation", "favorite", "recent", "offline-package", "deep-link"]);
const mediaKinds = new Set(["image", "narration", "background", "skin", "stand", "accessory"]);
const ident = (x: unknown): x is string => typeof x === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/u.test(x);
export const childNativeMediaToken = (x: unknown): x is string => typeof x === "string" && /^[a-f0-9]{32}$/u.test(x);
const integer = (x: unknown, min: number, max: number): x is number => typeof x === "number"
  && Number.isSafeInteger(x) && !Object.is(x, -0) && x >= min && x <= max;
const plainText = (x: unknown, max: number): x is string => typeof x === "string"
  && x.length > 0 && x.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(x);
export function childNativeMediaOwner(raw: unknown): ChildEntityReference | null {
  const ref = decodeChildEntityReference(raw);
  return ref && textKinds.has(ref.kind) ? ref : null;
}
export function sameChildNativeMediaReference(a: ChildEntityReference, b: ChildEntityReference): boolean {
  return a.kind === b.kind && a.id === b.id && a.contentChecksum === b.contentChecksum;
}
export function decodeChildNativeMediaAsset(raw: unknown): ChildNativeMediaAsset | null {
  const row = childRecord(raw, ["assetId", "owner", "entity", "mime", "role", "altText", "transcript"]);
  const owner = row && childNativeMediaOwner(row.owner), entity = row && decodeChildEntityReference(row.entity);
  if (!row || !owner || !entity || !mediaKinds.has(entity.kind) || !ident(row.assetId)
    || !(CHILD_NATIVE_MEDIA_ROLES as readonly unknown[]).includes(row.role) || !plainText(row.altText, 240) || /[\u0000-\u001f\u007f]/u.test(row.altText)
    || !["image/png", "image/jpeg", "image/webp", "audio/wav", "model/gltf+json", "model/gltf-binary", "application/octet-stream"].includes(row.mime as string)) return null;
  if (entity.kind === "narration") {
    if (row.role !== "narration" || row.mime !== "audio/wav" || !plainText(row.transcript, 32768)) return null;
  } else if (row.mime === "audio/wav" || row.transcript !== null
    || !String(row.mime).startsWith("image/") && !["stand","background"].includes(row.role as string)
    || (entity.kind === "image" ? !["image", "portrait"].includes(row.role as string) : row.role !== entity.kind)) return null;
  return Object.freeze({ assetId: row.assetId, owner, entity, mime: row.mime as ChildNativeMediaMime,
    role: row.role as ChildNativeMediaRole, altText: row.altText, transcript: row.transcript as string | null });
}
export function decodeChildNativeMediaAssets(raw: unknown, owner: ChildEntityReference): readonly ChildNativeMediaAsset[] | null {
  const rows = childDataArray(raw, 64); if (!rows) return null;
  const assets: ChildNativeMediaAsset[] = [], ids = new Set<string>(), entities = new Set<string>();
  for (const value of rows) {
    const asset = decodeChildNativeMediaAsset(value);
    if (!asset || !sameChildNativeMediaReference(asset.owner, owner) || ids.has(asset.assetId)
      || entities.has(asset.entity.kind + "/" + asset.entity.id)) return null;
    ids.add(asset.assetId); entities.add(asset.entity.kind + "/" + asset.entity.id); assets.push(asset);
  }
  return Object.freeze(assets);
}
export function decodeChildNativeMediaLayout(raw: unknown): ChildNativeMediaLayout | null {
  const row = childRecord(raw, ["x", "y", "width", "height", "viewportWidth", "viewportHeight"]);
  if (!row || !integer(row.x, 0, 8192) || !integer(row.y, 0, 8192) || !integer(row.width, 1, 8192)
    || !integer(row.height, 1, 8192) || !integer(row.viewportWidth, 1, 8192) || !integer(row.viewportHeight, 1, 8192)
    || row.x + row.width > row.viewportWidth || row.y + row.height > row.viewportHeight) return null;
  return Object.freeze(row as unknown as ChildNativeMediaLayout);
}
export function decodeChildNativeMediaPresentation(raw: unknown, assetId: string): ChildNativeMediaPresentation | null {
  const row = childRecord(raw, ["status", "presentationToken", "assetId", "remainingLifetimeMs"]);
  if (!row || row.assetId !== assetId) return null;
  if (row.status === "presented") {
    if (!childNativeMediaToken(row.presentationToken) || !integer(row.remainingLifetimeMs, 1, 60000)) return null;
  } else if (row.status !== "unavailable" || row.presentationToken !== null || row.remainingLifetimeMs !== 0) return null;
  return Object.freeze(row as unknown as ChildNativeMediaPresentation);
}
export function decodeChildNativeMediaRetirement(raw: unknown, token: string | null): boolean {
  const row = childRecord(raw, ["status", "presentationToken"]);
  return !!row && row.status === "retired" && row.presentationToken === token;
}

/** Scene roles belong to the canonical Three receiver rather than a native image slot. */
export const childNativeSlotMedia=(asset:ChildNativeMediaAsset):boolean=>["image","portrait","narration"].includes(asset.role);
