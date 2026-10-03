import { evaluateChildAccess, type ChildPlatform } from "./childAccessPolicy";
import { decodeChildDataScope, sameChildDataScope, type ChildDataScope } from "./childDataNamespace";
import type { createVerifiedChildIndex } from "./childIndex";
import { childDataArray, childRecord, copyChildPackageChallenge, decodeChildEntityReference,
  type ChildEntityReference, type ChildIndexedEntity, type ChildPackageDigestPort } from "./childPackage";
import type { ChildRouteChallenge } from "./childStartup";
import { CHILD_SVG_MAX_BYTES, preflightChildStaticSvg } from "./childStaticSvg";

export const CHILD_MEDIA_MAX_MANIFEST_BYTES = 512 * 1024;
export const CHILD_MEDIA_MAX_ASSETS = 512;
export const CHILD_MEDIA_MAX_ASSET_BYTES = 32 * 1024 * 1024;
export const CHILD_MEDIA_MIMES = Object.freeze(["image/png", "image/jpeg", "image/webp", "image/svg+xml", "audio/wav"] as const);
export type ChildMediaMime = typeof CHILD_MEDIA_MIMES[number];
export interface ChildMediaInventoryEntry {
  readonly inventoryKey: string; readonly sha256: string; readonly bytes: number; readonly mime: ChildMediaMime;
}
export interface ChildMediaAsset extends ChildMediaInventoryEntry {
  readonly assetId: string; readonly owner: ChildEntityReference; readonly entity: ChildEntityReference;
}
export interface ChildMediaManifest {
  readonly schemaVersion: 1; readonly namespace: "child"; readonly scope: ChildDataScope;
  readonly validFromEpochMs: number; readonly validUntilEpochMs: number; readonly assets: readonly ChildMediaAsset[];
}
export interface ChildMediaReviewChallenge {
  readonly context: ChildRouteChallenge; readonly manifest: ChildMediaManifest;
  readonly manifestChecksum: string; readonly nowEpochMs: number;
}
export interface ChildCurrentMediaReviewPort {
  /** Independently authenticate current human review/rights for these exact
   * manifest bytes, every owner/media relationship, media digest and policy.
   * Success: {status:'verified',challenge:<same object>,validUntilEpochMs}.
   * A checksum, self-declared review flag or package signature is insufficient. */
  verify(challenge: ChildMediaReviewChallenge, signal: AbortSignal): Promise<unknown>;
}
export interface ChildMediaReadRequest {
  readonly context: ChildRouteChallenge; readonly asset: ChildMediaAsset;
  readonly manifestChecksum: string; readonly lease: object;
  /** Check immediately at the isolated local read; never scan an adult store. */
  isCurrent(): boolean;
}
export interface ChildLocalMediaInventoryPort {
  /** Explicit trusted emitted/installed child-only allowlist; keys are opaque
   * inventory identities, never URLs or paths. No enumeration/fetch fallback. */
  readonly entries: readonly ChildMediaInventoryEntry[];
  read(request: ChildMediaReadRequest, signal: AbortSignal): Promise<unknown>;
}
export interface ChildMediaOptions {
  /** The host owns the actual active compiled child index. No UI boolean or
   * metadata-only replacement may implement this trusted construction seam. */
  readonly index: Pick<ReturnType<typeof createVerifiedChildIndex>, "visitEntity" | "getSnapshot" | "routePort">;
  /** Current independently verified startup/index context. Changes must also
   * retire the index and this loader before publishing another child view. */
  context(): ChildRouteChallenge | null;
  isCurrent(context: ChildRouteChallenge): boolean;
  readonly manifestSource: { load(context: ChildRouteChallenge, signal: AbortSignal): Promise<unknown> };
  readonly review: ChildCurrentMediaReviewPort; readonly inventory: ChildLocalMediaInventoryPort;
  readonly digest: ChildPackageDigestPort; readonly clock: { nowEpochMs(): number };
  readonly timeoutMs: number; readonly platform: ChildPlatform; readonly territory: string;
  readonly initialVisibility: "active" | "background";
}
export interface ChildMediaDelivery {
  readonly scope: ChildDataScope; readonly asset: ChildMediaAsset; readonly bytes: Uint8Array;
  /** Actual loader review/manifest/context intersection, never fresh authority. */
  readonly validUntilEpochMs: number;
}
const epoch = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value)
  && value >= 0 && value <= 8_640_000_000_000_000;
const positive = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value > 0;
const id = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/u.test(value);
const hex = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
const mediaKinds = new Set(["image", "narration", "animation", "background", "skin", "stand", "accessory"]);
const sameReference = (a: ChildEntityReference, b: ChildEntityReference) => a.kind === b.kind && a.id === b.id && a.contentChecksum === b.contentChecksum;
function copyBytes(input: unknown, maximum: number): Uint8Array | null {
  if (!(input instanceof Uint8Array) || Object.getPrototypeOf(input) !== Uint8Array.prototype) return null;
  // Native typed-array getters bypass caller accessors/methods. Copy before
  // digesting; a returned/shared source buffer never supplies mutable authority.
  const prototype = Object.getPrototypeOf(Uint8Array.prototype);
  const length: number = Object.getOwnPropertyDescriptor(prototype, "byteLength")!.get!.call(input);
  const offset: number = Object.getOwnPropertyDescriptor(prototype, "byteOffset")!.get!.call(input);
  const buffer: ArrayBuffer = Object.getOwnPropertyDescriptor(prototype, "buffer")!.get!.call(input);
  if (length < 1 || length > maximum) return null;
  const output = new Uint8Array(length); output.set(new Uint8Array(buffer, offset, length)); return output;
}
function inventoryEntry(input: unknown): ChildMediaInventoryEntry | null {
  const row = childRecord(input, ["inventoryKey", "sha256", "bytes", "mime"]);
  if (!row || typeof row.inventoryKey !== "string" || !/^[a-z0-9][a-z0-9_-]{0,63}\.(png|jpg|webp|svg|wav)$/u.test(row.inventoryKey)
    || !hex(row.sha256) || !positive(row.bytes) || row.bytes > CHILD_MEDIA_MAX_ASSET_BYTES
    || !(CHILD_MEDIA_MIMES as readonly unknown[]).includes(row.mime) || row.mime === "image/svg+xml" && row.bytes > CHILD_SVG_MAX_BYTES) return null;
  const extensions: Record<ChildMediaMime, string> = { "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/svg+xml": ".svg", "audio/wav": ".wav" };
  if (!row.inventoryKey.endsWith(extensions[row.mime as ChildMediaMime])) return null;
  return Object.freeze(row as unknown as ChildMediaInventoryEntry);
}
function copyContext(input: unknown, at: number): ChildRouteChallenge | null {
  const row = childRecord(input, ["generation", "request", "selection", "profile", "scope", "validUntilEpochMs"]);
  const startup = row && copyChildPackageChallenge({ generation: row.generation, request: row.request,
    selection: row.selection, profile: row.profile }, at), scope = row && decodeChildDataScope(row.scope);
  if (!row || !startup || !scope || !epoch(row.validUntilEpochMs) || row.validUntilEpochMs <= at
    || scope.profileId !== startup.profile.id || scope.profileId !== startup.selection.profileId
    || scope.profileRevision !== startup.selection.profileRevision || scope.exactAge !== startup.profile.exactAge
    || scope.locale !== startup.request.locale || scope.policyVersion !== startup.selection.policyVersion
    || scope.policyChecksum !== startup.selection.policyChecksum) return null;
  return Object.freeze({ ...startup, scope, validUntilEpochMs: row.validUntilEpochMs });
}
/** Strict manifest metadata only: successful parsing never authenticates media. */
export function decodeChildMediaManifest(input: unknown): ChildMediaManifest | null {
  try {
    const row = childRecord(input, ["schemaVersion", "namespace", "scope", "validFromEpochMs", "validUntilEpochMs", "assets"]);
    const scope = row && decodeChildDataScope(row.scope), raw = row && childDataArray(row.assets, CHILD_MEDIA_MAX_ASSETS);
    if (!row || row.schemaVersion !== 1 || row.namespace !== "child" || !scope || !raw?.length
      || !epoch(row.validFromEpochMs) || !epoch(row.validUntilEpochMs) || row.validUntilEpochMs <= row.validFromEpochMs) return null;
    const assets: ChildMediaAsset[] = [], ids = new Set<string>(), relations = new Set<string>();
    for (const value of raw) {
      const item = childRecord(value, ["assetId", "owner", "entity", "inventoryKey", "sha256", "bytes", "mime"]);
      const entry = item && inventoryEntry({ inventoryKey: item.inventoryKey, sha256: item.sha256, bytes: item.bytes, mime: item.mime });
      const owner = item && decodeChildEntityReference(item.owner), entity = item && decodeChildEntityReference(item.entity);
      if (!item || !entry || !owner || !entity || !id(item.assetId) || !mediaKinds.has(entity.kind)
        || (entity.kind === "narration" ? entry.mime !== "audio/wav" : !entry.mime.startsWith("image/"))
        || entity.kind === "animation" && entry.mime !== "image/webp" || ids.has(item.assetId)) return null;
      const relation = JSON.stringify([owner.kind, owner.id, entity.kind, entity.id]); if (relations.has(relation)) return null;
      ids.add(item.assetId); relations.add(relation);
      assets.push(Object.freeze({ assetId: item.assetId, owner, entity, ...entry }));
    }
    return Object.freeze({ schemaVersion: 1, namespace: "child", scope, validFromEpochMs: row.validFromEpochMs,
      validUntilEpochMs: row.validUntilEpochMs, assets: Object.freeze(assets) });
  } catch { return null; }
}
/** Self-contained supported container signatures, not a codec/renderer or
 * complete structural parser. Exact reviewed byte digests remain mandatory. */
export function childMediaContainerMatches(bytes: Uint8Array, mime: ChildMediaMime): boolean {
  if (mime === "image/svg+xml") return preflightChildStaticSvg(bytes) !== null;
  const ascii = (start: number, text: string) => [...text].every((char, index) => bytes[start + index] === char.charCodeAt(0));
  const little32 = (start: number) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(start, true);
  if (mime === "image/png") return bytes.length >= 45 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)
    && ascii(12, "IHDR") && ascii(bytes.length - 8, "IEND") && bytes.slice(bytes.length - 12, bytes.length - 8).every(value => value === 0);
  if (mime === "image/jpeg") return bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    && bytes[bytes.length - 2] === 255 && bytes[bytes.length - 1] === 217;
  if (mime === "image/webp") return bytes.length >= 20 && ascii(0, "RIFF") && little32(4) === bytes.length - 8 && ascii(8, "WEBP")
    && (ascii(12, "VP8 ") || ascii(12, "VP8L") || ascii(12, "VP8X"));
  if (mime === "audio/wav") return bytes.length >= 44 && ascii(0, "RIFF") && little32(4) === bytes.length - 8 && ascii(8, "WAVE") && ascii(12, "fmt ");
  return false;
}
type Operation = { generation: number; deadline: number; context: ChildRouteChallenge; abort: AbortController;
  external: AbortSignal; cancel: () => void; timer: ReturnType<typeof setTimeout> | null; finish: (value: boolean) => void;
  bytes: Uint8Array | null; owner: ChildIndexedEntity | null; media: ChildIndexedEntity | null; manifest: ChildMediaManifest | null };

/** Bounded, unintegrated media adapter. Every request reloads and independently
 * revalidates the manifest, actual index and exact local bytes. No ambient time,
 * URL/fetch, adult source, content activation or permanent metadata authority.
 * Retirement erases our buffers/references. A host must also retire visible
 * renderers/blob URLs; byte copies already handed to a caller cannot be erased.
 * Full SVG, GLTF/video/other codecs, actual reviewed media and App UI remain pending. */
export function createChildMediaLoader(options: ChildMediaOptions) {
  if (!options || !positive(options.timeoutMs) || options.timeoutMs > 2_147_483_647
    || typeof options.context !== "function" || typeof options.isCurrent !== "function" || typeof options.clock?.nowEpochMs !== "function"
    || typeof options.index?.visitEntity !== "function" || typeof options.index?.getSnapshot !== "function" || typeof options.index?.routePort?.verify !== "function"
    || typeof options.manifestSource?.load !== "function" || typeof options.review?.verify !== "function"
    || typeof options.inventory?.read !== "function" || typeof options.digest?.sha256 !== "function"
    || !["web-pwa", "android-google", "android-rustore", "ios-ipados"].includes(options.platform) || !/^[A-Z]{2}$/u.test(options.territory)
    || options.initialVisibility !== "active" && options.initialVisibility !== "background") throw new TypeError("Explicit trusted child media ports required");
  const clock = options.clock.nowEpochMs.bind(options.clock), context = options.context.bind(options), hostCurrent = options.isCurrent.bind(options);
  const visitEntity = options.index.visitEntity.bind(options.index), snapshot = options.index.getSnapshot.bind(options.index);
  const verifyRoute = options.index.routePort.verify.bind(options.index.routePort);
  const source = options.manifestSource.load.bind(options.manifestSource), review = options.review.verify.bind(options.review);
  const read = options.inventory.read.bind(options.inventory), digest = options.digest.sha256.bind(options.digest);
  const timeoutMs = options.timeoutMs, platform = options.platform, territory = options.territory;
  const rawInventory = childDataArray(options.inventory.entries, CHILD_MEDIA_MAX_ASSETS);
  const entries = rawInventory?.map(inventoryEntry);
  if (!entries?.length || entries.some(item => !item) || new Set(entries.map(item => item!.inventoryKey)).size !== entries.length)
    throw new TypeError("Explicit immutable local child inventory required");
  const inventory = new Map(entries.map(item => [item!.inventoryKey, item!]));
  let generation = 0, disposed = false, brokenClock = false, lastNow = -1, active: Operation | null = null;
  let visible = options.initialVisibility === "active";
  function erase(operation: Operation) {
    operation.bytes?.fill(0); operation.bytes = null; operation.owner = null; operation.media = null; operation.manifest = null;
  }
  function retire() {
    const old = active; active = null;
    if (generation === Number.MAX_SAFE_INTEGER) brokenClock = true; else generation++;
    const ticket = generation;
    if (old) { erase(old); old.abort.abort(); old.finish(false); }
    return ticket;
  }
  function now(): number | null {
    if (disposed || brokenClock) return null;
    try { const at = clock(); if (!epoch(at) || at < lastNow) { brokenClock = true; retire(); return null; }
      lastNow = at; return at;
    } catch { brokenClock = true; retire(); return null; }
  }
  function current(operation: Operation, exclusiveLimit = operation.context.validUntilEpochMs): boolean {
    if (active !== operation || operation.generation !== generation || disposed || brokenClock || !visible
      || operation.abort.signal.aborted || operation.external.aborted) return false;
    const at = now(); if (at === null || at >= operation.deadline || at >= operation.context.validUntilEpochMs || at >= exclusiveLimit) return false;
    try {
      const latest = copyContext(context(), at);
      const host = hostCurrent(operation.context) === true;
      const ready = snapshot().phase === "ready", checkedAt = now();
      const finalContext = checkedAt === null ? null : copyContext(context(), checkedAt);
      // The final context callback may consume validity or retire this request.
      // Sample time last, then fence clock reentry without another host callback.
      const completedAt = now();
      return !!latest && JSON.stringify(latest) === JSON.stringify(operation.context) && !!finalContext
        && JSON.stringify(finalContext) === JSON.stringify(operation.context) && host && ready
        && completedAt !== null && completedAt < operation.deadline && completedAt < operation.context.validUntilEpochMs && completedAt < exclusiveLimit
        && active === operation && operation.generation === generation && !disposed && !brokenClock && visible
        && !operation.abort.signal.aborted && !operation.external.aborted;
    } catch { return false; }
  }
  function policyCurrent(row: ChildIndexedEntity, captured: ChildRouteChallenge, at: number): boolean {
    return evaluateChildAccess({ profile: { exactAge: captured.profile.exactAge, allowedTopics: captured.profile.allowedTopics,
      blockedTopics: captured.profile.blockedTopics, policyVersion: captured.scope.policyVersion }, entity: row.policy,
      context: { entityId: row.reference.id, entityKind: row.reference.kind, sourceVersion: row.policy.sourceVersion,
        contentChecksum: row.reference.contentChecksum, locale: captured.scope.locale, platform, territory,
        policyVersion: captured.scope.policyVersion, now: at } }).allowed;
  }
  async function work(operation: Operation, assetId: string, owner: ChildEntityReference, visitor: (value: ChildMediaDelivery) => void): Promise<boolean> {
    if (!current(operation)) return false;
    const raw = await source(operation.context, operation.abort.signal);
    if (!current(operation)) return false;
    const manifestBytes = copyBytes(raw, CHILD_MEDIA_MAX_MANIFEST_BYTES); if (!manifestBytes) return false;
    const manifestChecksum = await digest(manifestBytes.slice());
    if (!current(operation) || !hex(manifestChecksum)) return false;
    const manifest = decodeChildMediaManifest(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(manifestBytes)));
    const at = now();
    if (!manifest || at === null || !current(operation) || !sameChildDataScope(manifest.scope, operation.context.scope)
      || manifest.validFromEpochMs > at || manifest.validUntilEpochMs <= at) return false;
    operation.manifest = manifest;
    for (const asset of manifest.assets) {
      const entry = inventory.get(asset.inventoryKey);
      if (!entry || entry.sha256 !== asset.sha256 || entry.bytes !== asset.bytes || entry.mime !== asset.mime) return false;
    }
    const asset = manifest.assets.find(candidate => candidate.assetId === assetId && sameReference(candidate.owner, owner));
    if (!asset) return false;
    let validUntil = Math.min(manifest.validUntilEpochMs, operation.context.validUntilEpochMs);
    const freshReview = async () => {
      const requestedAt = now(); if (requestedAt === null || !current(operation)) return false;
      const challenge: ChildMediaReviewChallenge = Object.freeze({ context: operation.context, manifest, manifestChecksum, nowEpochMs: requestedAt });
      const result = childRecord(await review(challenge, operation.abort.signal), ["status", "challenge", "validUntilEpochMs"]);
      const reviewedAt = now();
      if (!result || result.status !== "verified" || result.challenge !== challenge || !epoch(result.validUntilEpochMs)
        || reviewedAt === null || result.validUntilEpochMs <= reviewedAt || !current(operation)) return false;
      validUntil = Math.min(validUntil, result.validUntilEpochMs); return reviewedAt < validUntil;
    };
    if (!await freshReview()) return false;
    const routeCurrent = async () => {
      if (!current(operation)) return false;
      const proof = childRecord(await verifyRoute(operation.context, operation.abort.signal), ["status", "challenge"]);
      return !!proof && proof.status === "verified" && proof.challenge === operation.context && current(operation);
    };
    if (!await routeCurrent()) return false;
    if (!await visitEntity(asset.owner, row => { if (current(operation)) operation.owner = row; }) || !current(operation) || !operation.owner
      || !operation.owner.payload.references.some(reference => sameReference(reference, asset.entity))) return false;
    if (!await visitEntity(asset.entity, row => { if (current(operation)) operation.media = row; }) || !current(operation) || !operation.media) return false;
    const request: ChildMediaReadRequest = Object.freeze({ context: operation.context, asset, manifestChecksum,
      lease: Object.freeze({}), isCurrent: () => current(operation, validUntil) });
    if (!request.isCurrent()) return false;
    const loaded = await read(request, operation.abort.signal);
    if (!request.isCurrent()) return false;
    operation.bytes = copyBytes(loaded, CHILD_MEDIA_MAX_ASSET_BYTES);
    if (!operation.bytes || operation.bytes.length !== asset.bytes) return false;
    if (!childMediaContainerMatches(operation.bytes, asset.mime) || !current(operation)) return false;
    const actualChecksum = await digest(operation.bytes.slice());
    if (!hex(actualChecksum) || actualChecksum !== asset.sha256 || !request.isCurrent() || !operation.bytes
      || !await freshReview() || !await routeCurrent()) return false;
    let delivered = false;
    // Re-enter the actual active index immediately at handoff; cached entities
    // and metadata cannot keep a retired index or a changed parent policy alive.
    const admitted = await visitEntity(asset.owner, row => {
      const deliveryAt = now(), media = operation.media, bytes = operation.bytes;
      if (!request.isCurrent() || deliveryAt === null || !media || !bytes || !sameReference(row.reference, asset.owner)
        || !row.payload.references.some(reference => sameReference(reference, asset.entity))
        || !policyCurrent(row, operation.context, deliveryAt) || !policyCurrent(media, operation.context, deliveryAt)
        || !current(operation)) return;
      const value: ChildMediaDelivery = Object.freeze({ scope: operation.context.scope, asset, bytes: bytes.slice(), validUntilEpochMs: validUntil });
      const completion: unknown = visitor(value);
      if (completion !== undefined) { void Promise.resolve(completion).catch(() => {}); return; }
      delivered = request.isCurrent();
    });
    return admitted === true && delivered && request.isCurrent();
  }
  return Object.freeze({
    getSnapshot() { return Object.freeze({ phase: disposed ? "disposed" as const : active ? "loading" as const : "sealed" as const }); },
    retire() { retire(); }, background() { visible = false; retire(); }, foreground() { if (!disposed) { visible = true; retire(); } },
    dispose() { if (!disposed) { disposed = true; retire(); } },
    async visitMedia(input: unknown, external: AbortSignal, visitor: (value: ChildMediaDelivery) => void): Promise<boolean> {
      const ticket = retire(), at = now();
      try {
        const request = childRecord(input, ["assetId", "owner"]), owner = request && decodeChildEntityReference(request.owner);
        const captured = at === null ? null : copyContext(context(), at);
        if (!request || !id(request.assetId) || !owner || !captured || typeof visitor !== "function" || !(external instanceof AbortSignal)
          || external.aborted || disposed || brokenClock || !visible || generation !== ticket || at === null) return false;
        const deadline = Math.min(at + timeoutMs, captured.validUntilEpochMs); if (!epoch(deadline) || deadline <= at) return false;
        return await new Promise<boolean>(resolve => {
          let settled = false;
          const operation: Operation = { generation: ticket, deadline, context: captured, abort: new AbortController(), external,
            cancel: () => {}, timer: null, finish: () => {}, bytes: null, owner: null, media: null, manifest: null };
          operation.finish = value => {
            if (settled) return; settled = true;
            if (operation.timer !== null) clearTimeout(operation.timer); external.removeEventListener("abort", operation.cancel);
            if (active === operation) active = null;
            erase(operation); resolve(value);
          };
          operation.cancel = () => { if (!operation.abort.signal.aborted) operation.abort.abort(); operation.finish(false); };
          active = operation;
          external.addEventListener("abort", operation.cancel, { once: true });
          operation.timer = setTimeout(operation.cancel, timeoutMs);
          Promise.resolve().then(() => current(operation) ? work(operation, request.assetId as string, owner, visitor) : false)
            .then(value => operation.finish(value === true && current(operation)), () => operation.finish(false));
        });
      } catch { return false; }
    },
  });
}
