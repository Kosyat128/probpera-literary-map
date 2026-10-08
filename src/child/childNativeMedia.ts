import { childDataArray, childRecord, decodeChildEntityPayload, decodeChildEntityReference, type ChildEntityReference } from "./childPackage";
import type { ChildNativeAppController, ChildNativeContext } from "./childNativeAppBridge";
import { decodeChildNativeReadingPosition, resolveChildReadingPosition } from "./childReadingPosition";

/** LOCAL2 presentation data. Only the native original package worker can
 * admit/read/decode media. No V1 route challenge, byte buffer or URL crosses
 * this seam and a presentation token is correlation, never a grant. */
export const CHILD_NATIVE_MEDIA_METHODS = Object.freeze(["listMedia", "presentMedia", "resumeNarration", "releaseMedia"] as const);
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
/** Prepared decoded native audio only. It has not been played or heard. */
export interface ChildNativeNarrationResumePresentation {
  readonly status: "prepared" | "unavailable";
  readonly presentationToken: string | null;
  readonly assetId: string;
  readonly remainingLifetimeMs: number;
  readonly readingRevision: number | null;
  readonly anchorVersion: number | null;
  readonly anchorId: string | null;
  readonly sampleRate: number;
  readonly frameCount: number;
  readonly startFrame: number;
}
export type ChildNativeNarrationResumeOutcome =
  | Readonly<{ status: "prepared"; presentation: ChildNativeNarrationResumePresentation }>
  | Readonly<{ status: "absent" | "unavailable" | "retired" }>;
export interface ChildNativeMediaController {
  list(owner: ChildEntityReference): Promise<readonly ChildNativeMediaAsset[] | null>;
  present(asset: ChildNativeMediaAsset, layout: ChildNativeMediaLayout): Promise<ChildNativeMediaPresentation | null>;
  /** Native derives the saved anchor and actual PCM suffix. No autoplay. */
  resumeNarration?(asset: ChildNativeMediaAsset, layout: ChildNativeMediaLayout,
    expectedReadingRevision: number): Promise<ChildNativeNarrationResumePresentation | null>;
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

const readingKinds = new Set(["country", "writer", "biography", "work", "character", "storyworld", "fact", "quote", "activity", "quiz"]);
export const childNativeNarrationAsset = (asset: ChildNativeMediaAsset): boolean =>
  asset.role === "narration" && asset.entity.kind === "narration" && asset.mime === "audio/wav" && readingKinds.has(asset.owner.kind);
export const childNativeNarrationRevision = (value: unknown): value is number =>
  integer(value, 0, Number.MAX_SAFE_INTEGER - 2);
export function decodeChildNativeNarrationResume(raw: unknown, assetId: string,
  expectedReadingRevision: number): ChildNativeNarrationResumePresentation | null {
  const row = childRecord(raw, ["status", "presentationToken", "assetId", "remainingLifetimeMs", "readingRevision",
    "anchorVersion", "anchorId", "sampleRate", "frameCount", "startFrame"]);
  if (!row || row.assetId !== assetId || !childNativeNarrationRevision(expectedReadingRevision)) return null;
  if (row.status === "prepared") {
    if (!childNativeMediaToken(row.presentationToken) || !integer(row.remainingLifetimeMs, 1, 60000)
      || expectedReadingRevision === 0 || row.readingRevision !== expectedReadingRevision
      || !integer(row.anchorVersion, 1, Number.MAX_SAFE_INTEGER - 1) || !ident(row.anchorId)
      || !integer(row.sampleRate, 8000, 48000) || !integer(row.frameCount, 1, Number(row.sampleRate) * 60)
      || !integer(row.startFrame, 0, Number(row.frameCount) - 1)) return null;
  } else if (row.status !== "unavailable" || row.presentationToken !== null || row.readingRevision !== null
    || row.anchorVersion !== null || row.anchorId !== null || !integer(row.remainingLifetimeMs, 0, 0)
    || !integer(row.sampleRate, 0, 0) || !integer(row.frameCount, 0, 0) || !integer(row.startFrame, 0, 0)) return null;
  return Object.freeze(row as unknown as ChildNativeNarrationResumePresentation);
}
/** Called only by an explicit Resume action. The cancellation callback can
 * retire UI intent; it cannot replace the genuine captured native context. */
export async function prepareChildNativeNarrationResume(
  controller: Pick<ChildNativeAppController, "getSnapshot" | "reading" | "media" | "readEntity">,
  expectedContext: ChildNativeContext, asset: ChildNativeMediaAsset, layout: ChildNativeMediaLayout,
  isPending: () => boolean = () => true): Promise<ChildNativeNarrationResumeOutcome> {
  const current = () => {
    try {
      const snapshot = controller.getSnapshot();
      return isPending() && snapshot.phase === "ready" && snapshot.status === "child"
        && snapshot.context === expectedContext && expectedContext.mode === "child"
        && !!expectedContext.profileId && !!expectedContext.package && expectedContext.remainingLifetimeMs > 0;
    } catch { return false; }
  };
  const copied = decodeChildNativeMediaAsset(asset), geometry = decodeChildNativeMediaLayout(layout);
  if (!current()) return Object.freeze({ status: "retired" });
  if (!copied || !geometry || !childNativeNarrationAsset(copied) || !controller.reading
    || typeof controller.media?.resumeNarration !== "function") return Object.freeze({ status: "unavailable" });
  try {
    const observed = await controller.reading.readReadingPosition(copied.owner);
    if (!current()) return Object.freeze({ status: "retired" });
    const saved = decodeChildNativeReadingPosition(observed, expectedContext.profileId!, copied.owner);
    if (!saved || !childNativeNarrationRevision(saved.revision)) return Object.freeze({ status: "unavailable" });
    if (saved.position === null) return Object.freeze({ status: "absent" });
    const entity = await controller.readEntity(copied.owner);
    if (!current()) return Object.freeze({ status: "retired" });
    const row = childRecord(entity, ["reference", "payload"]), reference = row && decodeChildEntityReference(row.reference),
      payload = row && decodeChildEntityPayload(row.payload), anchors = payload?.readingAnchors;
    if (!payload || !reference || !sameChildNativeMediaReference(reference, copied.owner) || !anchors || copied.transcript !== payload.text
      || !resolveChildReadingPosition(saved.position, anchors, copied.owner)
      || !anchors.narration || anchors.narration.assetId !== copied.assetId) return Object.freeze({ status: "unavailable" });
    const cue = anchors.narration.cues.find(value => value.anchorId === saved.position!.anchorId);
    if (!cue || !current()) return Object.freeze({ status: "unavailable" });
    const raw = await controller.media.resumeNarration(copied, geometry, saved.revision);
    const prepared = decodeChildNativeNarrationResume(raw, copied.assetId, saved.revision);
    if (!current()) {
      if (prepared?.presentationToken && controller.getSnapshot().context === expectedContext)
        await controller.media.release(prepared.presentationToken);
      return Object.freeze({ status: "retired" });
    }
    if (prepared?.status === "unavailable") return Object.freeze({ status: "unavailable" });
    if (!prepared || prepared.anchorVersion !== saved.position.anchorVersion || prepared.anchorId !== saved.position.anchorId
      || prepared.sampleRate !== anchors.narration.sampleRate || prepared.frameCount !== anchors.narration.frameCount
      || prepared.startFrame !== cue.startFrame) {
      await controller.media.releaseAll();
      return Object.freeze({ status: current() ? "unavailable" : "retired" });
    }
    return Object.freeze({ status: "prepared", presentation: prepared });
  } catch { return Object.freeze({ status: current() ? "unavailable" : "retired" }); }
}
/** Scene roles belong to the canonical Three receiver rather than a native image slot. */
export const childNativeSlotMedia=(asset:ChildNativeMediaAsset):boolean=>["image","portrait","narration"].includes(asset.role);
