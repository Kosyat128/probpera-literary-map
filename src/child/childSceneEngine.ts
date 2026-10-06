/** Known owner allocations plus a bounded bookkeeping allowance; not a physical GPU/OS memory measurement. */
export const CHILD_ENGINE_FIXED_RESIDENT_BYTES = 65_536;
export class ChildSceneBudgetError extends Error {}
export class ChildSceneCleanupError extends Error {}
import { childDataArray, childRecord } from "./childPackage";

export type ChildEngineTier = "high" | "balanced" | "economy";
export type ChildEnginePlatform = "android" | "ios" | "web";
export type ChildEngineSlot = "skin" | "stand" | "background";
export interface ChildEngineItem {
  readonly slotId: ChildEngineSlot; readonly assetId: string; readonly contentChecksum: string;
  readonly editions: readonly string[]; readonly partners: Readonly<Record<ChildEngineSlot, readonly string[]>>;
  readonly accessoryIds: readonly string[]; readonly booky: "preserve-existing"; readonly explore: boolean;
  readonly childSafe: true; readonly minAge: number; readonly maxAge: number;
  readonly platforms: readonly ChildEnginePlatform[]; readonly tiers: readonly ChildEngineTier[];
  readonly minAppVersion: 1; readonly minContentVersion: number; readonly rightsBinding: "current-native-scene";
}
export interface ChildEngineTexture {
  readonly slotId: ChildEngineSlot; readonly assetId: string; readonly width: number; readonly height: number;
}
export interface ChildEngineTierPolicy {
  readonly tier: ChildEngineTier; readonly classification: "geometry" | "3d-lite";
  readonly maxDecodedBytes: number; readonly maxResidentBytes: number; readonly maxTriangles: number;
  readonly maxEncodedCacheBytes: number;
}
/** Signed presentation constraints. These never grant policy/rights/ownership,
 * renew a lease or supply a new camera, globe or Booky actor. Integer lighting
 * units keep the canonical cross-platform signature projection deterministic. */
export interface ChildEngineComposition {
  readonly schemaVersion: 1; readonly profile: "canonical-scene-v1";
  readonly sceneId: string; readonly modelPackageId: string; readonly modelPackageVersion: number;
  readonly items: readonly ChildEngineItem[]; readonly textures: readonly ChildEngineTexture[];
  readonly anchors: Readonly<{ globe: "canonical-origin"; booky: "existing-screen-avatar";
    camera: "preserve-live"; stand: "canonical-below-globe"; bookyPaddingPx: number }>;
  readonly tiers: readonly ChildEngineTierPolicy[];
  readonly lighting: Readonly<{ ambientRgb: readonly number[]; ambientMilli: number;
    keyRgb: readonly number[]; keyMilli: number; exposurePermille: number }>;
  readonly ambience: Readonly<{ animation: "none" | "gentle-light"; amplitudePermille: number;
    periodMs: number; audio: "silent" }>;
  readonly transition: Readonly<{ durationMs: number; timeoutMs: number; reducedMotion: "instant" }>;
  readonly fallback: Readonly<{ staticAllowed: boolean; preserveSkin: true; preserveBooky: true }>;
}
const slots = ["skin", "stand", "background"] as const, tiers = ["high", "balanced", "economy"] as const;
const id = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/u.test(v);
const hash = (v: unknown): v is string => typeof v === "string" && /^[a-f0-9]{64}$/u.test(v);
const integer = (v: unknown, min: number, max: number): v is number => typeof v === "number" && Number.isSafeInteger(v) && !Object.is(v, -0) && v >= min && v <= max;
function strings(value: unknown, maximum: number, allowed?: readonly string[], empty = false): readonly string[] | null {
  const a = childDataArray(value, maximum);
  if (!a || (!empty && a.length === 0) || a.some(x => !id(x) || allowed && !allowed.includes(x)) || new Set(a).size !== a.length) return null;
  return Object.freeze(a.slice()) as readonly string[];
}
function rgb(value: unknown): readonly number[] | null {
  const a = childDataArray(value, 3); return a?.length === 3 && a.every(v => integer(v, 0, 255)) ? Object.freeze(a.slice()) as readonly number[] : null;
}
export function decodeChildEngineComposition(value: unknown): ChildEngineComposition | null {
  try {
    const e = childRecord(value, ["schemaVersion", "profile", "sceneId", "modelPackageId", "modelPackageVersion", "items", "textures", "anchors", "tiers", "lighting", "ambience", "transition", "fallback"]);
    if (!e || e.schemaVersion !== 1 || e.profile !== "canonical-scene-v1" || !id(e.sceneId) || !id(e.modelPackageId) || !integer(e.modelPackageVersion, 1, Number.MAX_SAFE_INTEGER)) return null;
    const itemRows = childDataArray(e.items, 3), textureRows = childDataArray(e.textures, 3), tierRows = childDataArray(e.tiers, 3);
    if (itemRows?.length !== 3 || textureRows?.length !== 3 || tierRows?.length !== 3) return null;
    const items: ChildEngineItem[] = [], textures: ChildEngineTexture[] = [], policies: ChildEngineTierPolicy[] = [];
    for (const [index, value] of itemRows.entries()) {
      const i = childRecord(value, ["slotId", "assetId", "contentChecksum", "editions", "partners", "accessoryIds", "booky", "explore", "childSafe", "minAge", "maxAge", "platforms", "tiers", "minAppVersion", "minContentVersion", "rightsBinding"]);
      const p = i && childRecord(i.partners, [...slots]), editions = i && strings(i.editions, 32), platforms = i && strings(i.platforms, 3, ["android", "ios", "web"]), itemTiers = i && strings(i.tiers, 3, tiers), accessories = i && strings(i.accessoryIds, 0, undefined, true);
      const skin = p && strings(p.skin, 16), stand = p && strings(p.stand, 16), background = p && strings(p.background, 16);
      if (!i || i.slotId !== slots[index] || !id(i.assetId) || !hash(i.contentChecksum) || !editions || !platforms || !itemTiers || !accessories || accessories.length !== 0 || !skin || !stand || !background
        || i.booky !== "preserve-existing" || typeof i.explore !== "boolean" || i.childSafe !== true || !integer(i.minAge, 3, 17) || !integer(i.maxAge, i.minAge, 17)
        || i.minAppVersion !== 1 || !integer(i.minContentVersion, 1, Number.MAX_SAFE_INTEGER) || i.rightsBinding !== "current-native-scene") return null;
      items.push(Object.freeze({ ...i, editions, platforms, tiers: itemTiers, accessoryIds: accessories, partners: Object.freeze({ skin, stand, background }) }) as unknown as ChildEngineItem);
    }
    for (const [index, value] of textureRows.entries()) {
      const t = childRecord(value, ["slotId", "assetId", "width", "height"]);
      if (!t || t.slotId !== slots[index] || t.assetId !== items[index].assetId || !integer(t.width, 1, 4096) || !integer(t.height, 1, 4096) || index === 0 && t.width !== 2 * t.height) return null;
      textures.push(Object.freeze({ ...t }) as unknown as ChildEngineTexture);
    }
    for (const [index, value] of tierRows.entries()) {
      const t = childRecord(value, ["tier", "classification", "maxDecodedBytes", "maxResidentBytes", "maxTriangles", "maxEncodedCacheBytes"]);
      if (!t || t.tier !== tiers[index] || t.classification !== (index === 2 ? "3d-lite" : "geometry") || !integer(t.maxDecodedBytes, 1, 67_108_864)
        || !integer(t.maxResidentBytes, t.maxDecodedBytes, 134_217_728) || !integer(t.maxTriangles, 1, 200_000) || !integer(t.maxEncodedCacheBytes, 0, 4_194_304)
        || t.maxEncodedCacheBytes > t.maxResidentBytes) return null;
      policies.push(Object.freeze({ ...t }) as unknown as ChildEngineTierPolicy);
    }
    // A lower tier cannot silently increase any capacity. Both staging and the
    // live branch are charged; fallback cannot pretend to resize base images.
    for (let i = 1; i < policies.length; i++) for (const key of ["maxDecodedBytes", "maxResidentBytes", "maxTriangles", "maxEncodedCacheBytes"] as const)
      if (policies[i][key] > policies[i - 1][key]) return null;
    const a = childRecord(e.anchors, ["globe", "booky", "camera", "stand", "bookyPaddingPx"]);
    const l = childRecord(e.lighting, ["ambientRgb", "ambientMilli", "keyRgb", "keyMilli", "exposurePermille"]), ambientRgb = l && rgb(l.ambientRgb), keyRgb = l && rgb(l.keyRgb);
    const m = childRecord(e.ambience, ["animation", "amplitudePermille", "periodMs", "audio"]), t = childRecord(e.transition, ["durationMs", "timeoutMs", "reducedMotion"]), f = childRecord(e.fallback, ["staticAllowed", "preserveSkin", "preserveBooky"]);
    if (!a || a.globe !== "canonical-origin" || a.booky !== "existing-screen-avatar" || a.camera !== "preserve-live" || a.stand !== "canonical-below-globe" || !integer(a.bookyPaddingPx, 0, 48)
      || !l || !ambientRgb || !keyRgb || !integer(l.ambientMilli, 0, 1500) || !integer(l.keyMilli, 0, 2000) || !integer(l.exposurePermille, 750, 1250)
      || !m || !["none", "gentle-light"].includes(m.animation as string) || !integer(m.amplitudePermille, 0, 50) || m.animation === "none" && m.amplitudePermille !== 0 || !integer(m.periodMs, 4000, 20000) || m.audio !== "silent"
      || !t || !integer(t.durationMs, 0, 700) || !integer(t.timeoutMs, t.durationMs + 250, 2000) || t.reducedMotion !== "instant"
      || !f || typeof f.staticAllowed !== "boolean" || f.preserveSkin !== true || f.preserveBooky !== true) return null;
    return Object.freeze({ ...e, items: Object.freeze(items), textures: Object.freeze(textures), tiers: Object.freeze(policies), anchors: Object.freeze({ ...a }),
      lighting: Object.freeze({ ...l, ambientRgb, keyRgb }), ambience: Object.freeze({ ...m }), transition: Object.freeze({ ...t }), fallback: Object.freeze({ ...f }) }) as unknown as ChildEngineComposition;
  } catch { return null; }
}
export interface ChildEngineEnvironment {
  readonly editionId: string; readonly platform: ChildEnginePlatform; readonly exactAge: number; readonly contentVersion: number;
  readonly exploring: boolean; readonly visible: boolean; readonly reducedMotion: boolean; readonly preloadPaused?: boolean;
}
export interface ChildEngineSlotBinding { readonly assetId: string; readonly entity: Readonly<{ contentChecksum: string }> }
export function childEngineCompatible(engine: ChildEngineComposition, scene: Readonly<{ sceneId: string; skin: ChildEngineSlotBinding; stand: Readonly<{ asset: ChildEngineSlotBinding }>; background: Readonly<{ asset: ChildEngineSlotBinding }> }>, environment: ChildEngineEnvironment, tier: ChildEngineTier, requireTier = true): boolean {
  if (!environment.visible || engine.sceneId !== scene.sceneId || !integer(environment.exactAge, 3, 17) || !integer(environment.contentVersion, 1, Number.MAX_SAFE_INTEGER)) return false;
  const selected = { skin: scene.skin, stand: scene.stand.asset, background: scene.background.asset };
  return engine.items.every(item => item.assetId === selected[item.slotId].assetId && item.contentChecksum === selected[item.slotId].entity.contentChecksum
    && item.editions.includes(environment.editionId) && item.platforms.includes(environment.platform) && (!requireTier || item.tiers.includes(tier))
    && environment.exactAge >= item.minAge && environment.exactAge <= item.maxAge && environment.contentVersion >= item.minContentVersion
    && (!environment.exploring || item.explore) && slots.every(slot => item.partners[slot].includes(selected[slot].assetId)));
}
export const childEngineTextureBytes = (t: Pick<ChildEngineTexture, "width" | "height">) => Math.ceil(t.width * t.height * 16 / 3);
/** A real fallback omits the optional stand image and imported environment;
 * retained skin/background pixels keep their actual checked dimensions. */
export function childEngineBaseDecodedBytes(engine: ChildEngineComposition, staticFallback = false): number {
  return engine.textures.reduce((n, t) => n + (staticFallback && t.slotId === "stand" ? 0 : childEngineTextureBytes(t)), 0);
}
export function childEngineTierCandidates(requested: ChildEngineTier, engine: ChildEngineComposition): readonly Readonly<{ tier: ChildEngineTier; staticFallback: boolean }>[] {
  const start = tiers.indexOf(requested), result: Readonly<{ tier: ChildEngineTier; staticFallback: boolean }>[] = tiers.slice(start).map(tier => Object.freeze({ tier, staticFallback: false }));
  if (engine.fallback.staticAllowed) result.push(Object.freeze({ tier: "economy", staticFallback: true }));
  return Object.freeze(result);
}
/** Canonical JSON uses primitives only after strict decoding. No arbitrary
 * getter/serializer runs at a signature or cache boundary. */
export function canonicalChildEngineJson(engine: ChildEngineComposition): string {
  const canonical = (value: unknown): string => value === null || typeof value !== "object" ? JSON.stringify(value)
    : Array.isArray(value) ? "[" + value.map(canonical).join(",") + "]"
    : "{" + Object.keys(value).sort().map(key => JSON.stringify(key) + ":" + canonical((value as Record<string, unknown>)[key])).join(",") + "}";
  return canonical(engine);
}
/** Reservations for the fixed, source-pinned procedural owners, including
 * factory scratch, geometry/instance arrays, all craft tiles and PMREM. Actual
 * renderer measurement must also fit this ceiling. No physical GPU claim.
 * Static fallback omits the optional stand and room; picking/UI remain live. */
export function childEngineProceduralReserve(tier: ChildEngineTier, stand: boolean, background: boolean, hotspots: number, staticFallback = false): Readonly<{ residentBytes: number; triangles: number }> {
  const index = tiers.indexOf(tier);
  if (index < 0 || !integer(hotspots, 0, 16)) throw new Error("Bounded procedural scene required");
  const hotspotTriangles = (index === 2 ? 80 : 288) * hotspots;
  return Object.freeze({
    residentBytes: 32_768 + hotspots * 32_768 + (staticFallback ? 0 : ((stand ? [16, 8, 4][index] : 0) + (background ? [24, 12, 8][index] : 0)) * 1_048_576),
    triangles: 2 + hotspotTriangles + (staticFallback ? 0 : (stand ? [30_000, 18_000, 10_000][index] : 0) + (background ? [500_000, 300_000, 120_000][index] : 0)),
  });
}
