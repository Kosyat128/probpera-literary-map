import { createContentDownloads, type ContentDownloadDescriptor, type ContentDownloadLifecycle } from "../../../planet/ContentDownloads";
import { contentDownloadCatalog, contentDownloadTrust } from "../../../planet/contentDownloadCatalog";
import { createContentPackageCache } from "../../../planet/contentPackageCache";
import type { ContentPackageLocks, ContentPackageStorage } from "../../../planet/contentPackageStorage";
import type { ContentPackageFetch } from "../../../planet/contentPackageTransport";
import { normalizeContentPackageTrust } from "../../../planet/verifyContentPackage";
import type { DownloadPreferenceStore } from "../../../planet/DownloadNetworkPreference";

export interface WebContentHost {
  readonly caches?: ContentPackageStorage;
  readonly location?: { readonly origin: string };
  readonly navigator?: { readonly locks?: ContentPackageLocks; readonly storage?: Pick<StorageManager, "estimate"> };
  readonly crypto?: { readonly subtle: SubtleCrypto };
  fetch?: ContentPackageFetch;
}

/** Captures capabilities, without opening storage or starting network requests. */
export function createWebContentDownloads(host: WebContentHost | null, configuration: {
  readonly descriptors: readonly ContentDownloadDescriptor[]; readonly trustedKeys: unknown;
} = { descriptors: contentDownloadCatalog, trustedKeys: contentDownloadTrust }, lifecycle?: ContentDownloadLifecycle, preferences?: DownloadPreferenceStore) {
  const trustedKeys = configuration.descriptors.length ? normalizeContentPackageTrust(configuration.trustedKeys) : null;
  try {
    const caches = host?.caches, locks = host?.navigator?.locks, subtle = host?.crypto?.subtle;
    const origin = host?.location?.origin, fetch = host?.fetch?.bind(host) ?? null;
    return createContentDownloads({ descriptors: configuration.descriptors, fetch, lifecycle, preferences,
      readSpace: async () => {
        const value = await host?.navigator?.storage?.estimate();
        if (!value || typeof value.quota !== "number" || typeof value.usage !== "number"
          || !Number.isFinite(value.quota) || !Number.isFinite(value.usage) || value.quota < 0 || value.usage < 0
          || value.quota > Number.MAX_SAFE_INTEGER || value.usage > Number.MAX_SAFE_INTEGER) throw new Error("storage-estimate-unavailable");
        return { kind: "browser-estimate", availableBytes: Math.floor(Math.max(0, value.quota - value.usage)) };
      },
      createCache: caches && locks && origin && subtle && trustedKeys
        ? () => createContentPackageCache({ allowLocalQa: true, origin, caches, locks, subtle, trustedKeys }) : null });
  } catch {
    return createContentDownloads({ descriptors: configuration.descriptors, createCache: null, fetch: null, lifecycle, preferences });
  }
}
