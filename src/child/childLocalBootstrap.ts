import { childDataArray, childRecord, type ChildPackageDigestPort } from "./childPackage";

export const CHILD_LOCAL_SEED_V2_MAX_BYTES = 4096;
export interface ChildLocalSeedV2Policy { readonly version: string; readonly checksum: string }
export interface ChildLocalUnenrolledSeedV2 {
  readonly schemaVersion: 2; readonly revision: 1; readonly mode: "adult";
  readonly selectionRevision: 1; readonly profileRevision: 1;
  readonly policyChecksum: string; readonly registryChecksum: string;
  readonly registry: Readonly<{ schemaVersion: 1; policyVersion: string; activeProfileId: null; profiles: readonly [] }>;
  readonly pin: null; readonly clock: Readonly<{ schemaVersion: 2; logicalMs: 0 }>;
}
const keys = ["schemaVersion", "revision", "mode", "selectionRevision", "profileRevision", "policyChecksum",
  "registryChecksum", "registry", "pin", "clock"] as const;
const hex = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
const id = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/u.test(value);
function policyCopy(value: unknown): ChildLocalSeedV2Policy | null {
  try { const policy = childRecord(value, ["version", "checksum"]);
    return policy && id(policy.version) && hex(policy.checksum)
      ? Object.freeze({ version: policy.version, checksum: policy.checksum }) : null;
  } catch { return null; }
}
function emptyRegistry(version: string): ChildLocalUnenrolledSeedV2["registry"] {
  return Object.freeze({ schemaVersion: 1, policyVersion: version, activeProfileId: null, profiles: Object.freeze([]) as readonly [] });
}
function seed(policy: ChildLocalSeedV2Policy, registryChecksum: string): ChildLocalUnenrolledSeedV2 {
  return Object.freeze({ schemaVersion: 2, revision: 1, mode: "adult", selectionRevision: 1, profileRevision: 1,
    policyChecksum: policy.checksum, registryChecksum, registry: emptyRegistry(policy.version), pin: null,
    clock: Object.freeze({ schemaVersion: 2, logicalMs: 0 }) });
}
/** Empty local draft shape only. This is not an installed record, OS-owner
 * permission, v1 boot identity, trusted epoch, Parent Gate or child admission.
 * A missing/corrupt/enrolled store must never be passed here as a fresh seed. */
export function decodeChildLocalUnenrolledSeedV2(value: unknown, policyValue: unknown): ChildLocalUnenrolledSeedV2 | null {
  try {
    const policy = policyCopy(policyValue), root = childRecord(value, keys);
    const registry = root && childRecord(root.registry, ["schemaVersion", "policyVersion", "activeProfileId", "profiles"]);
    const clock = root && childRecord(root.clock, ["schemaVersion", "logicalMs"]);
    if (!policy || !root || !registry || !clock || root.schemaVersion !== 2 || root.revision !== 1 || root.mode !== "adult"
      || root.selectionRevision !== 1 || root.profileRevision !== 1 || root.policyChecksum !== policy.checksum
      || !hex(root.registryChecksum) || root.pin !== null || registry.schemaVersion !== 1 || registry.policyVersion !== policy.version
      || registry.activeProfileId !== null || !childDataArray(registry.profiles, 0)
      || clock.schemaVersion !== 2 || clock.logicalMs !== 0 || Object.is(clock.logicalMs, -0)) return null;
    return seed(policy, root.registryChecksum);
  } catch { return null; }
}
/** Serializes only the validated empty v2 shape. No caller getter/toJSON runs. */
export function childLocalUnenrolledSeedV2Bytes(value: ChildLocalUnenrolledSeedV2): Uint8Array {
  const root = childRecord(value, keys), registry = root && childRecord(root.registry, ["schemaVersion", "policyVersion", "activeProfileId", "profiles"]);
  const decoded = registry && decodeChildLocalUnenrolledSeedV2(value, { version: registry.policyVersion, checksum: root!.policyChecksum });
  if (!decoded) throw new TypeError("child-local-seed-v2-invalid");
  return new TextEncoder().encode(JSON.stringify(decoded));
}
/** Generates exact draft bytes and a real empty-registry digest. Native setup
 * independently rebuilds/checks these bytes and requires its original OS proof;
 * this pure builder performs no storage, enrollment or reset. */
export async function createChildLocalUnenrolledSeedV2(policyValue: unknown, digest: ChildPackageDigestPort): Promise<ChildLocalUnenrolledSeedV2 | null> {
  const policy = policyCopy(policyValue); if (!policy) return null;
  const bytes = new TextEncoder().encode(JSON.stringify(emptyRegistry(policy.version)));
  try { const checksum = await digest.sha256(bytes); return hex(checksum) ? seed(policy, checksum) : null; }
  catch { return null; }
  finally { bytes.fill(0); }
}
const typed = Object.getPrototypeOf(Uint8Array.prototype);
const lengthGetter = Object.getOwnPropertyDescriptor(typed, "byteLength")!.get!;
const offsetGetter = Object.getOwnPropertyDescriptor(typed, "byteOffset")!.get!;
const bufferGetter = Object.getOwnPropertyDescriptor(typed, "buffer")!.get!;
const arrayLengthGetter = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, "byteLength")!.get!;
function ownBytes(value: unknown): Uint8Array | null {
  try {
    if (!ArrayBuffer.isView(value) || Object.getPrototypeOf(value) !== Uint8Array.prototype) return null;
    const length = lengthGetter.call(value) as number, offset = offsetGetter.call(value) as number, buffer = bufferGetter.call(value) as ArrayBuffer;
    arrayLengthGetter.call(buffer); // SharedArrayBuffer is not an owned, stable wire input.
    if (length < 1 || length > CHILD_LOCAL_SEED_V2_MAX_BYTES || Reflect.ownKeys(value).length !== length) return null;
    const copy = new Uint8Array(length); Uint8Array.prototype.set.call(copy, new Uint8Array(buffer, offset, length)); return copy;
  } catch { return null; }
}
/** Exact canonical bytes plus independently computed registry digest only.
 * The returned shape does not authenticate first installation or a clock. */
export async function verifyChildLocalUnenrolledSeedV2Bytes(value: unknown, policyValue: unknown, digest: ChildPackageDigestPort): Promise<ChildLocalUnenrolledSeedV2 | null> {
  const policy = policyCopy(policyValue); if (!policy) return null;
  const bytes = ownBytes(value); if (!bytes) return null;
  let registryBytes: Uint8Array | null = null;
  try {
    const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
    const decoded = decodeChildLocalUnenrolledSeedV2(JSON.parse(text), policy);
    if (!decoded || text !== JSON.stringify(decoded)) return null;
    registryBytes = new TextEncoder().encode(JSON.stringify(decoded.registry));
    return await digest.sha256(registryBytes) === decoded.registryChecksum ? decoded : null;
  } catch { return null; }
  finally { bytes.fill(0); registryBytes?.fill(0); }
}
