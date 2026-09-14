import {
  CONTENT_PACKAGE_MAX_BYTES, CONTENT_PACKAGE_MAX_FILE_BYTES,
  contentPackageCanonicalJson, contentPackageExact, contentPackageHash, inspectContentPackageEnvelope,
  normalizeContentPackageExpected,
  type ContentPackageBytes, type ContentPackageEnvelope, type ContentPackageExpected,
} from "./contentPackageProtocol.mjs";
import { normalizeContentPackageTrust, verifyContentPackage } from "./verifyContentPackage";

const PREFIX = "literary-planet-content-qa-v1-";
const SHA = /^[a-f0-9]{64}$/u;
const METADATA_MAX_BYTES = 128 * 1024;
const encoder = new TextEncoder();
const fail = (reason: string): never => { throw new Error(reason); };
const cancelled = (signal?: AbortSignal) => { if (signal?.aborted) fail("cancelled"); };
type Generation = { readonly sha256: string; readonly version: number };
type Selection = { readonly schemaVersion: 1; readonly current: Generation; readonly previous: Generation | null };
type OwnedFile = { readonly path: string; readonly bytes: Uint8Array<ArrayBuffer> };
type Rejection = { readonly ok: false; readonly reason: string; readonly activationAllowed: false };
export type ContentPackageSaveResult = Rejection | {
  readonly ok: true; readonly manifestSha256: string; readonly previousManifestSha256: string | null;
  readonly activationAllowed: false; readonly releaseReady: false; readonly persistence: "best-effort";
};
export type ContentPackageReadResult = Rejection | {
  readonly ok: true; readonly manifestSha256: string; readonly envelope: ContentPackageEnvelope;
  readonly files: readonly ContentPackageBytes[]; readonly activationAllowed: false; readonly releaseReady: false;
};
export interface ContentPackageCacheOptions {
  /** Current S08 signatures are QA candidates, and never production approval. */
  readonly allowLocalQa: true;
  readonly origin: string;
  readonly trustedKeys: unknown;
  readonly caches: CacheStorage | null;
  /** Required cross-document coordination. No unsafe memory-lock fallback. */
  readonly locks: Pick<LockManager, "request"> | null;
  readonly subtle?: SubtleCrypto | null;
}
export interface ContentPackageSaveRequest {
  readonly envelope: unknown; readonly files: readonly ContentPackageBytes[]; readonly expected: ContentPackageExpected;
  /** Canonical manifest digest retained independently from package transport. */
  readonly manifestSha256: string;
  /** Null for first import; otherwise the previously observed current receipt. */
  readonly expectedCurrentManifestSha256: string | null;
  readonly signal?: AbortSignal;
}
export interface ContentPackageReadRequest {
  readonly expected: ContentPackageExpected; readonly manifestSha256: string; readonly signal?: AbortSignal;
}

function digest(value: unknown): string {
  if (typeof value !== "string" || !SHA.test(value)) return fail("exact-manifest-digest-required");
  return value;
}
function snapshotFiles(input: readonly ContentPackageBytes[]): OwnedFile[] {
  if (!Array.isArray(input) || input.length < 2 || input.length > 128) return fail("invalid-data-file-count");
  let total = 0;
  return input.map(file => {
    contentPackageExact(file, ["path", "bytes"], "invalid-data-file");
    const value = file.bytes;
    if ((typeof value !== "string" && !(value instanceof Uint8Array)) || value.length > CONTENT_PACKAGE_MAX_FILE_BYTES) return fail("data-file-byte-limit");
    const bytes = typeof value === "string" ? encoder.encode(value) : new Uint8Array(value);
    total += bytes.byteLength;
    if (!bytes.byteLength || bytes.byteLength > CONTENT_PACKAGE_MAX_FILE_BYTES || total > CONTENT_PACKAGE_MAX_BYTES) return fail("package-byte-limit");
    return { path: file.path, bytes };
  });
}

/** Derived signed byte cache only. It has no catalog authoring, search index,
 * scene, purchase, profile or content-publishing authority. Constructors do no IO.
 * Current and previous generations remain separate until a single pointer write.
 * Web Locks serialize cooperating documents; signed bytes are rechecked on read. */
export function createContentPackageCache(options: ContentPackageCacheOptions) {
  if (options.allowLocalQa !== true) fail("content-cache-qa-only");
  const origin = new URL(options.origin);
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname);
  if (origin.origin !== options.origin || (origin.protocol !== "https:" && !(loopback && origin.protocol === "http:"))) fail("invalid-content-cache-origin");
  const trustedKeys = normalizeContentPackageTrust(options.trustedKeys);
  const storage = options.caches, locks = options.locks, subtle = options.subtle;
  const url = (path: string) => new URL("/__literary_content_qa__/" + path, origin).href;
  const markerUrl = url("complete.json"), envelopeUrl = url("signature.json"), selectionUrl = url("selection.json");
  const fileUrl = (path: string) => url("files/" + path.split("/").map(encodeURIComponent).join("/"));
  const metadataResponse = (value: unknown) => new Response(contentPackageCanonicalJson(value), { headers: { "Content-Type": "application/json" } });
  const scope = (expected: ContentPackageExpected) => PREFIX + contentPackageHash(contentPackageCanonicalJson({
    packageId: expected.packageId, namespace: expected.namespace, childPolicy: expected.childPolicy,
  }));
  const rejected = (error: unknown, signal?: AbortSignal): Rejection => Object.freeze({ ok: false, activationAllowed: false,
    reason: signal?.aborted ? "cancelled" : error instanceof Error ? error.message : "content-cache-unavailable" });

  async function readBytes(response: Response | undefined, maximum: number, signal?: AbortSignal) {
    if (!response || response.status !== 200 || !response.body) return fail("incomplete-content-cache");
    const reader = response.body.getReader();
    let length = 0; const chunks: Uint8Array[] = [];
    try {
      while (true) {
        cancelled(signal);
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > maximum) { void reader.cancel().catch(() => undefined); fail("content-cache-byte-limit"); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    cancelled(signal);
    const bytes = new Uint8Array(length); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return bytes;
  }
  async function metadata(name: string, key: string, maximum: number, signal?: AbortSignal): Promise<unknown | null> {
    const response = await storage!.match(key, { cacheName: name });
    cancelled(signal);
    if (!response) return null;
    const source = new TextDecoder("utf-8", { fatal: true }).decode(await readBytes(response, maximum, signal));
    const value: unknown = JSON.parse(source);
    if (source !== contentPackageCanonicalJson(value)) fail("noncanonical-cache-metadata");
    return value;
  }
  async function selection(name: string, signal?: AbortSignal): Promise<Selection | null> {
    const value = await metadata(name, selectionUrl, 1024, signal);
    if (value === null) return null;
    contentPackageExact(value, ["schemaVersion", "current", "previous"], "invalid-cache-selection");
    const selected = value as Selection;
    if (selected.schemaVersion !== 1) fail("invalid-cache-selection");
    for (const generation of [selected.current, ...(selected.previous ? [selected.previous] : [])]) {
      contentPackageExact(generation, ["sha256", "version"], "invalid-cache-generation");
      digest(generation.sha256);
      if (!Number.isSafeInteger(generation.version) || generation.version < 1) fail("invalid-cache-generation");
    }
    if (selected.previous !== null && (!selected.previous || selected.previous.sha256 === selected.current.sha256
      || selected.previous.version >= selected.current.version)) fail("invalid-cache-selection");
    return selected;
  }
  async function readGeneration(name: string, hash: string, expected: ContentPackageExpected, signal?: AbortSignal, requireMarker = true) {
    const cacheName = name + "-" + hash;
    if (requireMarker) {
      const marker = await metadata(cacheName, markerUrl, 1024, signal);
      if (contentPackageCanonicalJson(marker) !== contentPackageCanonicalJson({ schemaVersion: 1, state: "VERIFIED_CANDIDATE", manifestSha256: hash, activationAllowed: false })) fail("incomplete-content-cache");
    }
    const envelope = await metadata(cacheName, envelopeUrl, METADATA_MAX_BYTES, signal);
    const { manifest, keyId, signature } = inspectContentPackageEnvelope(envelope, expected);
    if (contentPackageHash(contentPackageCanonicalJson(manifest)) !== hash) fail("cached-manifest-digest-mismatch");
    const normalizedEnvelope: ContentPackageEnvelope = { contract: "literary-planet-data-package-signature-v1", algorithm: "ES256", keyId, manifest, signature: signature as string };
    const files: OwnedFile[] = [];
    for (const file of manifest.files) {
      cancelled(signal);
      files.push({ path: file.path, bytes: await readBytes(await storage!.match(fileUrl(file.path), { cacheName }), file.bytes, signal) });
    }
    const verification = await verifyContentPackage({ envelope: normalizedEnvelope, expected, trustedKeys, files, signal, subtle });
    if (!verification.verified || verification.manifestSha256 !== hash) fail(verification.reason ?? "cached-package-verification-failed");
    return { envelope: normalizedEnvelope, files };
  }
  async function locked<T>(name: string, signal: AbortSignal | undefined, operation: () => Promise<T>): Promise<T> {
    cancelled(signal);
    if (!storage || !locks) return fail("content-cache-unavailable");
    return locks.request(name, { mode: "exclusive", ...(signal ? { signal } : {}) }, async () => { cancelled(signal); return operation(); });
  }
  async function prune(name: string, keep: readonly string[], signal?: AbortSignal) {
    for (const cacheName of await storage!.keys()) {
      cancelled(signal);
      if (!cacheName.startsWith(name + "-")) continue;
      const hash = cacheName.slice(name.length + 1);
      if (SHA.test(hash) && !keep.includes(hash)) await storage!.delete(cacheName);
    }
  }

  return Object.freeze({
    async save(request: ContentPackageSaveRequest): Promise<ContentPackageSaveResult> {
      const signal = request.signal;
      try {
        cancelled(signal);
        const expected = normalizeContentPackageExpected(request.expected), hash = digest(request.manifestSha256);
        const priorPin = request.expectedCurrentManifestSha256 === null ? null : digest(request.expectedCurrentManifestSha256);
        const parsed = inspectContentPackageEnvelope(request.envelope, expected);
        const envelope: ContentPackageEnvelope = { contract: "literary-planet-data-package-signature-v1", algorithm: "ES256",
          keyId: parsed.keyId, manifest: parsed.manifest, signature: parsed.signature as string };
        if (encoder.encode(contentPackageCanonicalJson(envelope)).byteLength > METADATA_MAX_BYTES) fail("content-envelope-byte-limit");
        const files = snapshotFiles(request.files), name = scope(expected);
        const verified = await verifyContentPackage({ envelope, expected, trustedKeys, files, signal, subtle });
        if (!verified.verified || verified.manifestSha256 !== hash) fail(verified.reason ?? "package-manifest-digest-mismatch");
        return await locked(name, signal, async () => {
          const before = await selection(name, signal), alreadySelected = before?.current.sha256 === hash;
          if (!alreadySelected && (before?.current.sha256 ?? null) !== priorPin) fail("content-generation-conflict");
          if (!alreadySelected && before && expected.version <= before.current.version) fail("content-version-not-newer");
          const previous = alreadySelected ? before!.previous : before?.current ?? null;
          if (alreadySelected) {
            try {
              await readGeneration(name, hash, expected, signal);
              return Object.freeze({ ok: true, manifestSha256: hash, previousManifestSha256: previous?.sha256 ?? null,
                activationAllowed: false, releaseReady: false, persistence: "best-effort" });
            } catch { cancelled(signal); /* Repair only this already selected exact generation. */ }
          }
          const keep = [hash, before?.current.sha256, before?.previous?.sha256].filter((value): value is string => !!value);
          await prune(name, keep, signal);
          const cacheName = name + "-" + hash, cache = await storage!.open(cacheName);
          for (const file of files) {
            cancelled(signal);
            // Cache.put is not cancellable. Keep the lock until each issued write
            // settles; cancellation can never race a second committing writer.
            await cache.put(fileUrl(file.path), new Response(file.bytes, { headers: { "Content-Type": "application/json" } }));
          }
          cancelled(signal);
          await cache.put(envelopeUrl, metadataResponse(envelope));
          await readGeneration(name, hash, expected, signal, false);
          cancelled(signal);
          await cache.put(markerUrl, metadataResponse({ schemaVersion: 1, state: "VERIFIED_CANDIDATE", manifestSha256: hash, activationAllowed: false }));
          cancelled(signal);
          const next: Selection = { schemaVersion: 1, current: { sha256: hash, version: expected.version }, previous };
          const index = await storage!.open(name);
          cancelled(signal);
          await index.put(selectionUrl, metadataResponse(next));
          // This write is the commit boundary. A late abort cannot truthfully
          // turn an already stored selection into a reported rollback.
          if (!signal?.aborted) await prune(name, [hash, ...(previous ? [previous.sha256] : [])], signal).catch(() => undefined);
          return Object.freeze({ ok: true, manifestSha256: hash, previousManifestSha256: previous?.sha256 ?? null,
            activationAllowed: false, releaseReady: false, persistence: "best-effort" });
        });
      } catch (error) { return rejected(error, signal); }
    },
    async read(request: ContentPackageReadRequest): Promise<ContentPackageReadResult> {
      const signal = request.signal;
      try {
        const expected = normalizeContentPackageExpected(request.expected), hash = digest(request.manifestSha256), name = scope(expected);
        return await locked(name, signal, async () => {
          const selected = await selection(name, signal);
          if (![selected?.current.sha256, selected?.previous?.sha256].includes(hash)) fail("content-generation-not-selected");
          const loaded = await readGeneration(name, hash, expected, signal);
          return Object.freeze({ ok: true, manifestSha256: hash, ...loaded, activationAllowed: false, releaseReady: false });
        });
      } catch (error) { return rejected(error, signal); }
    },
  });
}
