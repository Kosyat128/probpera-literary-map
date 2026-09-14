export type ContentPackagePolicy = { readonly policyId: string; readonly version: string; readonly sha256: string } | null;
export interface ContentPackageFile { readonly path: string; readonly bytes: number; readonly sha256: string; }
export interface ContentPackageBytes { readonly path: string; readonly bytes: string | Uint8Array; }
export interface ContentPackageExpected {
  readonly packageId: string; readonly version: number; readonly sourceCommit: string;
  readonly namespace: "adult" | "child"; readonly childPolicy: ContentPackagePolicy; readonly readerVersion: number;
}
export interface ContentPackageManifest {
  readonly schemaVersion: 1; readonly contract: "literary-planet-data-package-v1";
  readonly purpose: "literary-planet-content-data"; readonly environment: "local-qa"; readonly releaseReady: false;
  readonly packageId: string; readonly version: number; readonly sourceCommit: string;
  readonly locales: readonly ["ru", "en"]; readonly namespace: "adult" | "child"; readonly childPolicy: ContentPackagePolicy;
  readonly compatibility: { readonly catalogSchemaVersion: 1; readonly minimumReaderVersion: number; readonly maximumReaderVersion: number };
  readonly files: readonly ContentPackageFile[];
}
export interface ContentPackageEnvelope {
  readonly contract: "literary-planet-data-package-signature-v1"; readonly algorithm: "ES256";
  readonly keyId: string; readonly manifest: ContentPackageManifest; readonly signature: string;
}
export const CONTENT_PACKAGE_PURPOSE: "literary-planet-content-data";
export const CONTENT_PACKAGE_ENVIRONMENT: "local-qa";
export const CONTENT_PACKAGE_SIGNATURE_CONTRACT: "literary-planet-data-package-signature-v1";
export const CONTENT_PACKAGE_MAX_FILE_BYTES: number;
export const CONTENT_PACKAGE_MAX_BYTES: number;
export function contentPackageCanonicalJson(value: unknown): string;
export function contentPackageHash(value: string | Uint8Array): string;
export function contentPackageExact(value: unknown, keys: readonly string[], reason: string): void;
export function validateContentPackageKeyId(value: unknown): string;
export function contentPackageSigningBytes(manifest: ContentPackageManifest, keyId: string): Uint8Array<ArrayBuffer>;
export function decodeContentPackageSignature(value: unknown): Uint8Array<ArrayBuffer>;
export function normalizeContentPackageManifest(value: unknown): ContentPackageManifest;
export function normalizeContentPackageExpected(value: unknown): ContentPackageExpected;
export function contentPackageFileInventory(files: unknown, context: Pick<ContentPackageExpected, "namespace" | "sourceCommit">): ContentPackageFile[];
export function inspectContentPackageEnvelope(envelope: unknown, expected: unknown): {
  manifest: ContentPackageManifest; keyId: string; signature: unknown;
};
export function prepareContentPackageManifest(options: {
  packageId: string; version: number; sourceCommit: string; files: readonly ContentPackageBytes[];
  namespace?: "adult" | "child"; childPolicy?: ContentPackagePolicy; compatibility?: ContentPackageManifest["compatibility"];
}): ContentPackageManifest;
