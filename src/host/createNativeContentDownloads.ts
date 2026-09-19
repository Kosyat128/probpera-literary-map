import { createContentDownloads, type ContentDownloadDescriptor, type ContentDownloadLifecycle } from "../planet/ContentDownloads";
import { contentDownloadCatalog, contentDownloadTrust } from "../planet/contentDownloadCatalog";
import { createContentPackageCache } from "../planet/contentPackageCache";
import { normalizeContentPackageTrust } from "../planet/verifyContentPackage";
import type { ContentPackageFetch } from "../planet/contentPackageTransport";
import type { DownloadPreferenceStore } from "../planet/DownloadNetworkPreference";
import { contentDownloadOptionalPackages } from "../planet/ContentDownloadRetention";
import { createNativeContentStorage, createNativeContentLocks, NATIVE_CONTENT_ORIGIN, type NativeContentStoreBridge } from "./nativeContentStorage";

export function createNativeContentDownloads(bridge: NativeContentStoreBridge | null, options: {
  readonly descriptors?: readonly ContentDownloadDescriptor[]; readonly trustedKeys?: unknown;
  readonly fetch?: ContentPackageFetch | null; readonly subtle?: SubtleCrypto | null;
  readonly lifecycle?: ContentDownloadLifecycle;
  readonly preferences?: DownloadPreferenceStore;
} = {}) {
  const descriptors = options.descriptors ?? contentDownloadCatalog;
  const optionalPackages = contentDownloadOptionalPackages(descriptors);
  const trustedKeys = descriptors.length ? normalizeContentPackageTrust(options.trustedKeys ?? contentDownloadTrust) : null;
  const subtle = options.subtle === undefined ? globalThis.crypto?.subtle : options.subtle;
  const fetch = options.fetch === undefined ? globalThis.fetch?.bind(globalThis) ?? null : options.fetch;
  return createContentDownloads({ descriptors, fetch, lifecycle: options.lifecycle, preferences: options.preferences,
    readSpace: bridge?.capacity ? async () => ({ kind: "device", availableBytes: (await bridge.capacity!()).availableBytes }) : null,
    createCache: bridge && subtle && trustedKeys
    ? () => createContentPackageCache({ allowLocalQa: true, origin: NATIVE_CONTENT_ORIGIN,
      trustedKeys, subtle, optionalPackages, caches: createNativeContentStorage(bridge), locks: createNativeContentLocks() }) : null });
}
