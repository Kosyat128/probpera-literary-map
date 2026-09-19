import {
  CONTENT_PACKAGE_MAX_BYTES, CONTENT_PACKAGE_MAX_FILE_BYTES,
  contentPackageCanonicalJson, contentPackageExact, contentPackageHash, inspectContentPackageEnvelope,
  normalizeContentPackageExpected,
  type ContentPackageBytes, type ContentPackageEnvelope, type ContentPackageExpected, type ContentPackageFile,
} from "./contentPackageProtocol.mjs";
import { normalizeContentPackageTrust, verifyContentPackage, verifyContentPackageManifest } from "./verifyContentPackage";
import { downloadContentPackageFile, normalizeContentPackageBaseUrl, type ContentPackageFetch } from "./contentPackageTransport";
import type { ContentPackageLocks, ContentPackageStorage } from "./contentPackageStorage";

const PREFIX = "literary-planet-content-qa-v1-";
const SHA = /^[a-f0-9]{64}$/u;
const METADATA_MAX_BYTES = 128 * 1024;
const encoder = new TextEncoder();
const fail = (reason: string): never => { throw new Error(reason); };
const cancelled = (signal?: AbortSignal) => { if (signal?.aborted) fail("cancelled"); };
type Generation = { readonly sha256: string; readonly version: number };
type Selection = { readonly current: Generation; readonly previous: Generation | null } & (
  { readonly schemaVersion: 1 } | { readonly schemaVersion: 2; readonly epoch: number; readonly retired: boolean });
const epochOf = (selected: Selection | null) => selected?.schemaVersion === 2 ? selected.epoch : 0;
const retired = (selected: Selection | null) => selected?.schemaVersion === 2 && selected.retired;
const receipt = (selected: Selection) => contentPackageHash(contentPackageCanonicalJson(selected));
type OwnedFile = { readonly path: string; readonly bytes: Uint8Array<ArrayBuffer> };
type Rejection = { readonly ok: false; readonly reason: string; readonly activationAllowed: false;
  readonly selectionSha256?: string; readonly cleanupComplete?: boolean };
export type ContentPackageSaveResult = Rejection | {
  readonly ok: true; readonly manifestSha256: string; readonly previousManifestSha256: string | null;
  readonly selectionSha256: string;
  readonly activationAllowed: false; readonly releaseReady: false; readonly persistence: "best-effort";
};
export type ContentPackageReadResult = Rejection | {
  readonly ok: true; readonly manifestSha256: string; readonly envelope: ContentPackageEnvelope;
  readonly selectionSha256: string;
  readonly selectedCurrentManifestSha256: string;
  readonly files: readonly ContentPackageBytes[]; readonly activationAllowed: false; readonly releaseReady: false;
};
export type ContentPackageDiscardResult = Rejection | {
  readonly ok: true; readonly removed: boolean; readonly activationAllowed: false;
};
export type ContentPackageUninstallResult = Rejection | {
  readonly ok: true; readonly cleanupComplete: boolean; readonly selectionSha256: string; readonly activationAllowed: false;
};
export interface ContentPackageCacheOptions {
  /** Current S08 signatures are QA candidates, and never production approval. */
  readonly allowLocalQa: true;
  readonly origin: string;
  readonly trustedKeys: unknown;
  /** App-trusted exact pins only; downloaded metadata cannot grant removal. */
  readonly optionalPackages?: readonly { expected: ContentPackageExpected; manifestSha256: string }[];
  readonly caches: ContentPackageStorage | null;
  /** Explicit platform coordination. Web uses Web Locks; native also requires
   * atomic compare-and-swap and candidate validation in its native IO queue. */
  readonly locks: ContentPackageLocks | null;
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
export interface ContentPackageDownloadProgress {
  readonly phase: "downloading" | "verifying" | "saved";
  readonly downloadedBytes: number; readonly cachedBytes: number; readonly totalBytes: number;
  readonly path: string | null;
}
export interface ContentPackageDownloadRequest extends Omit<ContentPackageSaveRequest, "files"> {
  readonly baseUrl: string;
  /** Explicit data transport capability; constructors never start a download. */
  readonly fetch: ContentPackageFetch;
  readonly idleTimeoutMs?: number;
  readonly onProgress?: (progress: ContentPackageDownloadProgress) => void;
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
  const removable = new Set<string>();
  for (const item of options.optionalPackages ?? []) {
    const expected = normalizeContentPackageExpected(item.expected);
    if (expected.namespace !== "adult") fail("adult-download-controller-required");
    removable.add(contentPackageCanonicalJson(expected) + ":" + digest(item.manifestSha256));
  }

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
    const selected = value as Selection;
    if (selected?.schemaVersion !== 1 && selected?.schemaVersion !== 2) fail("invalid-cache-selection");
    contentPackageExact(value, selected.schemaVersion === 1 ? ["schemaVersion", "current", "previous"]
      : ["schemaVersion", "epoch", "retired", "current", "previous"], "invalid-cache-selection");
    if (selected.schemaVersion === 2 && (!Number.isSafeInteger(selected.epoch) || selected.epoch < 1
      || typeof selected.retired !== "boolean" || (selected.retired && selected.previous !== null))) fail("invalid-cache-selection");
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
  async function candidateFile(name: string, hash: string, file: ContentPackageFile, signal?: AbortSignal) {
    const response = await storage!.match(fileUrl(file.path), { cacheName: name + "-" + hash });
    cancelled(signal);
    if (!response) return null;
    try {
      const bytes = await readBytes(response, file.bytes, signal);
      return bytes.length === file.bytes && contentPackageHash(bytes) === file.sha256 ? bytes : null;
    } catch (error) {
      cancelled(signal);
      if (error instanceof Error && ["incomplete-content-cache", "content-cache-byte-limit"].includes(error.message)) return null;
      throw error;
    }
  }
  async function locked<T>(name: string, signal: AbortSignal | undefined, operation: () => Promise<T>): Promise<T> {
    cancelled(signal);
    if (!storage || !locks) return fail("content-cache-unavailable");
    return locks.request(name, { mode: "exclusive", ...(signal ? { signal } : {}) }, async () => { cancelled(signal); return operation(); });
  }
  async function prune(name: string, keep: readonly string[], epoch: number, signal?: AbortSignal) {
    for (const cacheName of await storage!.keys()) {
      cancelled(signal);
      if (!cacheName.startsWith(name + "-")) continue;
      const hash = cacheName.slice(name.length + 1);
      if (SHA.test(hash) && !keep.includes(hash)) {
        if (epochOf(await selection(name, signal)) !== epoch) fail("content-generation-conflict");
        await storage!.delete(cacheName, { epoch });
      }
    }
  }
  const hasGenerations = async (name: string) => (await storage!.keys()).some(key => key.startsWith(name + "-") && SHA.test(key.slice(name.length + 1)));
  function accepts(before: Selection | null, hash: string, version: number, priorPin: string | null, epoch: number) {
    if (epochOf(before) !== epoch) fail("content-generation-conflict");
    const active = !retired(before), alreadySelected = active && before?.current.sha256 === hash;
    if (!alreadySelected && (active ? before?.current.sha256 ?? null : null) !== priorPin) fail("content-generation-conflict");
    if (!alreadySelected && before && version <= before.current.version
      && !(retired(before) && hash === before.current.sha256 && version === before.current.version)) fail("content-version-not-newer");
    return alreadySelected;
  }

  async function save(request: ContentPackageSaveRequest, capturedEpoch?: number): Promise<ContentPackageSaveResult> {
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
      const epoch = capturedEpoch ?? await locked(name, signal, async () => epochOf(await selection(name, signal)));
      const verified = await verifyContentPackage({ envelope, expected, trustedKeys, files, signal, subtle });
      if (!verified.verified || verified.manifestSha256 !== hash) fail(verified.reason ?? "package-manifest-digest-mismatch");
      return await locked(name, signal, async () => {
        const before = await selection(name, signal), alreadySelected = accepts(before, hash, expected.version, priorPin, epoch);
        const previous = retired(before) ? null : alreadySelected ? before!.previous : before?.current ?? null;
        if (alreadySelected) {
          let readable = false;
          try {
            await readGeneration(name, hash, expected, signal);
            readable = true;
          } catch { cancelled(signal); /* Repair only this already selected exact generation. */ }
          if (receipt((await selection(name, signal))!) !== receipt(before!)) fail("content-generation-conflict");
          if (readable) {
            return Object.freeze({ ok: true, manifestSha256: hash, previousManifestSha256: previous?.sha256 ?? null,
              selectionSha256: receipt(before!),
              activationAllowed: false, releaseReady: false, persistence: "best-effort" });
          }
        }
        const keep = [hash, before?.current.sha256, before?.previous?.sha256].filter((value): value is string => !!value);
        await prune(name, keep, epoch, signal);
        const cacheName = name + "-" + hash, cache = await storage!.open(cacheName, { epoch });
        for (const file of files) {
          cancelled(signal);
          const record = parsed.manifest.files.find(record => record.path === file.path)!;
          if (await candidateFile(name, hash, record, signal)) continue;
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
        const next: Selection = epoch > 0
          ? { schemaVersion: 2, epoch, retired: false, current: { sha256: hash, version: expected.version }, previous }
          : { schemaVersion: 1, current: { sha256: hash, version: expected.version }, previous };
        const index = await storage!.open(name);
        cancelled(signal);
        if (storage!.commitSelection) {
          const committed = await storage!.commitSelection({ name, url: selectionUrl,
            expectedSha256: before ? contentPackageHash(contentPackageCanonicalJson(before)) : null,
            json: contentPackageCanonicalJson(next), candidate: { name: cacheName, entries: [
              ...parsed.manifest.files.map(file => ({ url: fileUrl(file.path), bytes: file.bytes, sha256: file.sha256 })),
              ...[[envelopeUrl, envelope], [markerUrl, { schemaVersion: 1, state: "VERIFIED_CANDIDATE", manifestSha256: hash, activationAllowed: false }]].map(([key, value]) => {
                const source = contentPackageCanonicalJson(value);
                return { url: key as string, bytes: encoder.encode(source).byteLength, sha256: contentPackageHash(source) };
              }),
            ] } });
          if (!committed) fail("content-generation-conflict");
        } else await index.put(selectionUrl, metadataResponse(next));
        // This write is the commit boundary. A late abort cannot truthfully
        // turn an already stored selection into a reported rollback.
        if (!signal?.aborted) await prune(name, [hash, ...(previous ? [previous.sha256] : [])], epoch, signal).catch(() => undefined);
        return Object.freeze({ ok: true, manifestSha256: hash, previousManifestSha256: previous?.sha256 ?? null,
          selectionSha256: receipt(next),
          activationAllowed: false, releaseReady: false, persistence: "best-effort" });
      });
    } catch (error) { return rejected(error, signal); }
  }

  const api = {
    /** Retire first, then collect bytes. A retained receipt prevents stale work
     * from resurrecting an absent selection and retains the version floor. */
    async uninstall(request: ContentPackageReadRequest & { selectionSha256: string }): Promise<ContentPackageUninstallResult> {
      const signal = request.signal;
      try {
        const expected = normalizeContentPackageExpected(request.expected), hash = digest(request.manifestSha256);
        const confirmed = digest(request.selectionSha256);
        if (!removable.has(contentPackageCanonicalJson(expected) + ":" + hash)) fail("content-package-required");
        if (storage?.commitSelection && !storage.retireSelection) fail("content-retirement-unavailable");
        const name = scope(expected);
        // Do not wait for an outstanding network request. Its captured epoch
        // rejects every later write and commit after this short atomic operation.
        return await locked(name, signal, async () => {
          const before = await selection(name, signal);
          if (!before || before.current.sha256 !== hash || before.current.version !== expected.version
            || receipt(before) !== confirmed) fail("content-generation-conflict");
          const next: Selection = retired(before) ? before! : { schemaVersion: 2,
            epoch: epochOf(before) + 1, retired: true, current: before!.current, previous: null };
          if (!Number.isSafeInteger(epochOf(next))) fail("content-retirement-limit");
          cancelled(signal);
          if (!retired(before)) {
            try {
              if (storage!.retireSelection) {
                if (!await storage!.retireSelection({ name, url: selectionUrl, expectedSha256: confirmed,
                  json: contentPackageCanonicalJson(next) })) fail("content-generation-conflict");
              } else {
                const index = await storage!.open(name);
                cancelled(signal);
                await index.put(selectionUrl, metadataResponse(next));
              }
            } catch (error) {
              // A lost response after the atomic write is not a rollback. Only
              // an exact readback can establish that this retirement committed.
              const stored = await selection(name).catch(() => null);
              if (!stored || receipt(stored) !== receipt(next)) throw error;
            }
          }
          // Retirement has committed. Cleanup/cancellation cannot undo it or
          // truthfully turn it into a failed removal of offline access.
          let cleanupComplete = false;
          try {
            await prune(name, [], epochOf(next), signal);
            cleanupComplete = !await hasGenerations(name) && receipt((await selection(name))!) === receipt(next);
          } catch { /* Retain a retryable tombstone when any cleanup IO fails. */ }
          return Object.freeze({ ok: true, cleanupComplete, selectionSha256: receipt(next), activationAllowed: false });
        });
      } catch (error) { return rejected(error, signal); }
    },
    /** Explicitly discard one adult candidate. Never remove a selected version,
     * its rollback, another package/namespace, or the mandatory app bootstrap. */
    async discard(request: ContentPackageReadRequest): Promise<ContentPackageDiscardResult> {
      const signal = request.signal;
      try {
        const expected = normalizeContentPackageExpected(request.expected), hash = digest(request.manifestSha256);
        if (expected.namespace !== "adult") fail("adult-download-controller-required");
        const name = scope(expected), candidate = name + "-" + hash;
        // Use the same lock order as downloads. A queued cleanup must recheck
        // selection after a concurrent transfer has finished committing.
        return await locked(name + ":download", signal, () => locked(name, signal, async () => {
          const selected = await selection(name, signal);
          if (!retired(selected) && [selected?.current.sha256, selected?.previous?.sha256].includes(hash)) fail("content-generation-protected");
          cancelled(signal);
          const removed = await storage!.delete(candidate, { epoch: epochOf(selected) });
          // Native removal independently guards selection in its serial IO queue.
          // A false result may mean either absent bytes or a concurrent protection.
          if (!removed && (await storage!.keys()).includes(candidate)) fail("content-removal-not-confirmed");
          // Deletion is the commit boundary; a late cancellation cannot undo it.
          return Object.freeze({ ok: true, removed, activationAllowed: false });
        }));
      } catch (error) { return rejected(error, signal); }
    },
    save: (request: ContentPackageSaveRequest) => save(request),
    async read(request: ContentPackageReadRequest): Promise<ContentPackageReadResult> {
      const signal = request.signal;
      try {
        const expected = normalizeContentPackageExpected(request.expected), hash = digest(request.manifestSha256), name = scope(expected);
        return await locked(name, signal, async () => {
          const selected = await selection(name, signal);
          if (retired(selected)) {
            if (selected!.current.sha256 !== hash) fail("content-generation-not-selected");
            const cleanupComplete = !await hasGenerations(name);
            if (receipt((await selection(name, signal))!) !== receipt(selected!)) fail("content-generation-conflict");
            return Object.freeze({ ok: false, reason: "content-package-removed", selectionSha256: receipt(selected!), cleanupComplete, activationAllowed: false });
          }
          if (![selected?.current.sha256, selected?.previous?.sha256].includes(hash)) fail("content-generation-not-selected");
          const loaded = await readGeneration(name, hash, expected, signal);
          if (receipt((await selection(name, signal))!) !== receipt(selected!)) fail("content-generation-conflict");
          return Object.freeze({ ok: true, manifestSha256: hash, selectionSha256: receipt(selected!),
            selectedCurrentManifestSha256: selected!.current.sha256, ...loaded, activationAllowed: false, releaseReady: false });
        });
      } catch (error) { return rejected(error, signal); }
    },
    async download(request: ContentPackageDownloadRequest): Promise<ContentPackageSaveResult> {
      const signal = request.signal;
      try {
        cancelled(signal);
        const expected = normalizeContentPackageExpected(request.expected), hash = digest(request.manifestSha256);
        const priorPin = request.expectedCurrentManifestSha256 === null ? null : digest(request.expectedCurrentManifestSha256);
        const baseUrl = normalizeContentPackageBaseUrl(request.baseUrl), fetch = request.fetch;
        const idleTimeoutMs = request.idleTimeoutMs, observer = request.onProgress;
        if (typeof fetch !== "function") fail("content-download-unavailable");
        const parsed = inspectContentPackageEnvelope(request.envelope, expected);
        const envelope: ContentPackageEnvelope = { contract: "literary-planet-data-package-signature-v1", algorithm: "ES256",
          keyId: parsed.keyId, manifest: parsed.manifest, signature: parsed.signature as string };
        const name = scope(expected), epoch = await locked(name, signal, async () => epochOf(await selection(name, signal)));
        const authenticated = await verifyContentPackageManifest({ envelope, expected, trustedKeys, signal, subtle });
        if (!authenticated.verified || authenticated.manifestSha256 !== hash) fail(authenticated.reason ?? "package-manifest-digest-mismatch");
        const cacheName = name + "-" + hash, files: OwnedFile[] = [];
        let downloadedBytes = 0, cachedBytes = 0;
        const totalBytes = parsed.manifest.files.reduce((sum, file) => sum + file.bytes, 0);
        const progress = (phase: ContentPackageDownloadProgress["phase"], path: string | null, currentBytes = 0) => {
          try { observer?.(Object.freeze({ phase, path, downloadedBytes: downloadedBytes + currentBytes, cachedBytes, totalBytes })); }
          catch { /* A UI observer does not own the transfer or its cancellation. */ }
        };
        const checkSelection = async () => {
          const selected = await selection(name, signal);
          accepts(selected, hash, expected.version, priorPin, epoch);
          return selected;
        };
        // Serialize downloads separately from short selection/write operations.
        // Existing complete data stays readable while the network is pending.
        return await locked(name + ":download", signal, async () => {
          await locked(name, signal, async () => {
            const selected = await checkSelection();
            await prune(name, [hash, selected?.current.sha256, selected?.previous?.sha256].filter((value): value is string => !!value), epoch, signal);
            await storage!.open(cacheName, { epoch });
          });
          for (const file of parsed.manifest.files) {
            cancelled(signal);
            let bytes = await locked(name, signal, async () => { await checkSelection(); return candidateFile(name, hash, file, signal); });
            if (bytes) { cachedBytes += bytes.length; progress("downloading", file.path); }
            else {
              progress("downloading", file.path);
              bytes = await downloadContentPackageFile({ baseUrl, file, fetch, signal, idleTimeoutMs,
                onBytes: count => progress("downloading", file.path, count) });
              downloadedBytes += bytes.length;
              const verifiedBytes = bytes;
              await locked(name, signal, async () => {
                await checkSelection();
                const cache = await storage!.open(cacheName, { epoch });
                cancelled(signal);
                await cache.put(fileUrl(file.path), new Response(verifiedBytes, { headers: { "Content-Type": "application/json" } }));
              });
            }
            files.push({ path: file.path, bytes });
          }
          progress("verifying", null);
          const saved = await save({ envelope, expected, files, manifestSha256: hash, expectedCurrentManifestSha256: priorPin, signal }, epoch);
          if (saved.ok) progress("saved", null);
          return saved;
        });
      } catch (error) { return rejected(error, signal); }
    },
  };
  return Object.freeze(api);
}
