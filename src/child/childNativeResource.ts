import { childDataArray, childRecord } from "./childPackage";

/** Fixed source data, never native admission. The private LOCAL2 SDK maker
 * binds these bytes to the actual original command/context/media permit.
 * No URL, clock assertion, callbacks or DTO can manufacture that claim. */
export const CHILD_NATIVE_RESOURCE_PIN_KIND = "literary-planet-child-native-resource-release-pins-v2";
export const CHILD_NATIVE_RESOURCE_CATALOG_KIND = "literary-planet-child-native-resource-catalog-v2";
export const CHILD_NATIVE_RESOURCE_TRANSFORM = "fixed-native-resource-pin-projection-v2";
export type ChildNativeResourceMime = "image/png" | "image/jpeg" | "image/webp" | "audio/wav";
export interface ChildNativeResourceOrigin {
  readonly id: string;
  readonly origin: string;
  readonly tlsPublicKeyX963Checksums: readonly string[];
}
export interface ChildNativeResourceBinding {
  readonly id: string;
  readonly packageId: string;
  readonly packageVersion: number;
  readonly packageChecksum: string;
  readonly policyVersion: string;
  readonly policyChecksum: string;
  readonly manifestChecksum: string;
  readonly reviewChecksum: string;
  readonly assetId: string;
  readonly assetChecksum: string;
  readonly assetBytes: number;
  readonly mime: ChildNativeResourceMime;
  readonly originId: string;
  readonly path: string;
  readonly validFromEpochMs: number;
  readonly validUntilEpochMs: number;
}
export interface ChildNativeResourcePins {
  readonly schemaVersion: 2;
  readonly kind: typeof CHILD_NATIVE_RESOURCE_PIN_KIND;
  readonly origins: readonly ChildNativeResourceOrigin[];
  readonly resources: readonly ChildNativeResourceBinding[];
}
const id = (x: unknown): x is string => typeof x === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/u.test(x);
const hash = (x: unknown): x is string => typeof x === "string" && /^[a-f0-9]{64}$/u.test(x);
const integer = (x: unknown, min: number, max: number): x is number => typeof x === "number"
  && Number.isSafeInteger(x) && !Object.is(x, -0) && x >= min && x <= max;
const epoch = (x: unknown): x is number => integer(x, 0, 8_640_000_000_000_000);
const extensions = Object.freeze({ "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "audio/wav": "wav" } as const);
const mime = (x: unknown): x is ChildNativeResourceMime => typeof x === "string" && Object.prototype.hasOwnProperty.call(extensions, x);

/** Canonical release source only. Actual native DNS/trust/TLS/read checks
 * independently apply before any bytes are acquired; this is not a grant. */
export function childNativeResourceOrigin(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 512 || !/^https:\/\/[a-z0-9.-]+$/u.test(raw)) return null;
  try {
    const url = new URL(raw), labels = url.hostname.split(".");
    if (url.origin !== raw || url.href !== raw + "/" || url.protocol !== "https:"
      || url.port || url.username || url.password || url.search || url.hash
      || url.hostname.length > 253 || labels.length < 2 || /^[\d.]+$/u.test(url.hostname)
      || labels.some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u.test(label))
      || ["localhost", "local", "internal", "lan", "home"].includes(labels[labels.length - 1] ?? "")) return null;
    return raw;
  } catch { return null; }
}
export function childNativeResourcePath(checksum: unknown, type: unknown): string | null {
  return hash(checksum) && mime(type) ? "/objects/" + checksum + "." + extensions[type] : null;
}
export function childNativeResourceBindingKey(binding: ChildNativeResourceBinding): string {
  return binding.packageChecksum + "/" + binding.assetId;
}
function decodeOrigin(raw: unknown): ChildNativeResourceOrigin | null {
  const row = childRecord(raw, ["id", "origin", "tlsPublicKeyX963Checksums"]);
  if (!row || !id(row.id) || !childNativeResourceOrigin(row.origin)) return null;
  const keys = childDataArray(row.tlsPublicKeyX963Checksums, 4);
  if (!keys?.length || keys.some(key => !hash(key)) || new Set(keys).size !== keys.length) return null;
  return Object.freeze({ id: row.id, origin: row.origin as string,
    tlsPublicKeyX963Checksums: Object.freeze(keys.slice() as string[]) });
}
export function decodeChildNativeResourceBinding(raw: unknown): ChildNativeResourceBinding | null {
  try {
    const row = childRecord(raw, ["id", "packageId", "packageVersion", "packageChecksum", "policyVersion", "policyChecksum",
      "manifestChecksum", "reviewChecksum", "assetId", "assetChecksum", "assetBytes", "mime", "originId", "path",
      "validFromEpochMs", "validUntilEpochMs"]);
    if (!row || !id(row.id) || !id(row.packageId) || !integer(row.packageVersion, 1, Number.MAX_SAFE_INTEGER)
      || !hash(row.packageChecksum) || !id(row.policyVersion) || !hash(row.policyChecksum)
      || !hash(row.manifestChecksum) || !hash(row.reviewChecksum) || !id(row.assetId) || !hash(row.assetChecksum)
      || !mime(row.mime) || !id(row.originId) || row.path !== childNativeResourcePath(row.assetChecksum, row.mime)
      || !integer(row.assetBytes, 1, row.mime === "audio/wav" ? 25_165_824 : 33_554_432)
      || !epoch(row.validFromEpochMs) || !epoch(row.validUntilEpochMs) || row.validFromEpochMs >= row.validUntilEpochMs) return null;
    return Object.freeze({ id: row.id, packageId: row.packageId, packageVersion: row.packageVersion,
      packageChecksum: row.packageChecksum, policyVersion: row.policyVersion, policyChecksum: row.policyChecksum,
      manifestChecksum: row.manifestChecksum, reviewChecksum: row.reviewChecksum, assetId: row.assetId,
      assetChecksum: row.assetChecksum, assetBytes: row.assetBytes, mime: row.mime, originId: row.originId,
      path: row.path as string, validFromEpochMs: row.validFromEpochMs, validUntilEpochMs: row.validUntilEpochMs });
  } catch { return null; }
}
export function decodeChildNativeResourcePins(raw: unknown): ChildNativeResourcePins | null {
  try {
    const row = childRecord(raw, ["schemaVersion", "kind", "origins", "resources"]);
    if (!row || row.schemaVersion !== 2 || row.kind !== CHILD_NATIVE_RESOURCE_PIN_KIND) return null;
    const rawOrigins = childDataArray(row.origins, 8), rawResources = childDataArray(row.resources, 512);
    if (!rawOrigins || !rawResources) return null;
    const origins: ChildNativeResourceOrigin[] = [], resources: ChildNativeResourceBinding[] = [];
    for (const rawOrigin of rawOrigins) { const origin = decodeOrigin(rawOrigin); if (!origin) return null; origins.push(origin); }
    for (const rawResource of rawResources) { const resource = decodeChildNativeResourceBinding(rawResource); if (!resource) return null; resources.push(resource); }
    if (new Set(origins.map(x => x.id)).size !== origins.length || new Set(origins.map(x => x.origin)).size !== origins.length
      || new Set(resources.map(x => x.id)).size !== resources.length
      || new Set(resources.map(childNativeResourceBindingKey)).size !== resources.length
      || resources.some(resource => !origins.some(origin => origin.id === resource.originId))
      || origins.some(origin => !resources.some(resource => resource.originId === origin.id))) return null;
    return Object.freeze({ schemaVersion: 2, kind: CHILD_NATIVE_RESOURCE_PIN_KIND,
      origins: Object.freeze(origins), resources: Object.freeze(resources) });
  } catch { return null; }
}
export function decodeChildNativeResourceCatalog(raw: unknown, checksum: string,
  platform: "android-google" | "android-rustore" | "ios-ipados" | null): ChildNativeResourcePins | null {
  try {
    if (platform !== null && platform !== "android-google" && platform !== "android-rustore"
      && platform !== "ios-ipados") return null;
    const row = childRecord(raw, ["schemaVersion", "kind", "platform", "resourcePinSourceChecksum", "origins", "resources"]);
    if (!row || row.schemaVersion !== 2 || row.kind !== CHILD_NATIVE_RESOURCE_CATALOG_KIND
      || !hash(checksum) || row.resourcePinSourceChecksum !== checksum || row.platform !== platform) return null;
    const pins = decodeChildNativeResourcePins({ schemaVersion: 2, kind: CHILD_NATIVE_RESOURCE_PIN_KIND,
      origins: row.origins, resources: row.resources });
    return pins && (platform !== null || pins.origins.length === 0 && pins.resources.length === 0) ? pins : null;
  } catch { return null; }
}
