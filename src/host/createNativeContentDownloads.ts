import { createContentDownloads, type ContentDownloadDescriptor, type ContentDownloadLifecycle } from "../planet/ContentDownloads";
import { contentDownloadCatalog, contentDownloadTrust } from "../planet/contentDownloadCatalog";
import { createContentPackageCache } from "../planet/contentPackageCache";
import { normalizeContentPackageTrust } from "../planet/verifyContentPackage";
import type { ContentPackageFetch } from "../planet/contentPackageTransport";
import { createNativeContentStorage, createNativeContentLocks, NATIVE_CONTENT_ORIGIN, type NativeContentStoreBridge } from "./nativeContentStorage";

export function createNativeContentDownloads(bridge: NativeContentStoreBridge | null, options: {
  readonly descriptors?: readonly ContentDownloadDescriptor[]; readonly trustedKeys?: unknown;
  readonly fetch?: ContentPackageFetch | null; readonly subtle?: SubtleCrypto | null;
  readonly lifecycle?: ContentDownloadLifecycle;
} = {}) {
  const descriptors = options.descriptors ?? contentDownloadCatalog;
  const trustedKeys = descriptors.length ? normalizeContentPackageTrust(options.trustedKeys ?? contentDownloadTrust) : null;
  const subtle = options.subtle === undefined ? globalThis.crypto?.subtle : options.subtle;
  const fetch = options.fetch === undefined ? globalThis.fetch?.bind(globalThis) ?? null : options.fetch;
  return createContentDownloads({ descriptors, fetch, lifecycle: options.lifecycle, createCache: bridge && subtle && trustedKeys
    ? () => createContentPackageCache({ allowLocalQa: true, origin: NATIVE_CONTENT_ORIGIN,
      trustedKeys, subtle, caches: createNativeContentStorage(bridge), locks: createNativeContentLocks() }) : null });
}
