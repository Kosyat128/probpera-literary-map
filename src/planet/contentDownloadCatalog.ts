import type { ContentDownloadDescriptor } from "./ContentDownloads";
import type { ContentPackageTrustKey } from "./verifyContentPackage";

/** No approved release packages exist yet. QA pins are injected only by the
 * controlled validation harness, never imported from its transport or evidence. */
export const contentDownloadCatalog: readonly ContentDownloadDescriptor[] = Object.freeze([]);
export const contentDownloadTrust: readonly ContentPackageTrustKey[] = Object.freeze([]);
