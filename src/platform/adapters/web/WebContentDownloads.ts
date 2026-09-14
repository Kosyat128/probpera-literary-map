import { createContentDownloads, type ContentDownloadDescriptor, type ContentDownloadLifecycle } from "../../../planet/ContentDownloads";
import { contentDownloadCatalog, contentDownloadTrust } from "../../../planet/contentDownloadCatalog";
import { createContentPackageCache } from "../../../planet/contentPackageCache";
import type { ContentPackageLocks, ContentPackageStorage } from "../../../planet/contentPackageStorage";
import type { ContentPackageFetch } from "../../../planet/contentPackageTransport";
import { normalizeContentPackageTrust } from "../../../planet/verifyContentPackage";

export interface WebContentHost {
  readonly caches?: ContentPackageStorage;
  readonly location?: { readonly origin: string };
  readonly navigator?: { readonly locks?: ContentPackageLocks };
  readonly crypto?: { readonly subtle: SubtleCrypto };
  fetch?: ContentPackageFetch;
}

/** Captures capabilities, without opening storage or starting network requests. */
export function createWebContentDownloads(host: WebContentHost | null, configuration: {
  readonly descriptors: readonly ContentDownloadDescriptor[]; readonly trustedKeys: unknown;
} = { descriptors: contentDownloadCatalog, trustedKeys: contentDownloadTrust }, lifecycle?: ContentDownloadLifecycle) {
  const trustedKeys = configuration.descriptors.length ? normalizeContentPackageTrust(configuration.trustedKeys) : null;
  try {
    const caches = host?.caches, locks = host?.navigator?.locks, subtle = host?.crypto?.subtle;
    const origin = host?.location?.origin, fetch = host?.fetch?.bind(host) ?? null;
    return createContentDownloads({ descriptors: configuration.descriptors, fetch, lifecycle,
      createCache: caches && locks && origin && subtle && trustedKeys
        ? () => createContentPackageCache({ allowLocalQa: true, origin, caches, locks, subtle, trustedKeys }) : null });
  } catch {
    return createContentDownloads({ descriptors: configuration.descriptors, createCache: null, fetch: null });
  }
}
