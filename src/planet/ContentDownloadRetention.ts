import { contentPackageCanonicalJson, normalizeContentPackageExpected, type ContentPackageExpected } from "./contentPackageProtocol.mjs";

export type ContentDownloadRetention = "required" | "optional";
type RetentionDescriptor = { readonly expected: ContentPackageExpected; readonly manifestSha256: string; readonly retention?: ContentDownloadRetention };

/** Trusted application configuration only. Absence never authorizes removal. */
export function contentDownloadOptionalPackages(descriptors: readonly RetentionDescriptor[]) {
  const scopes = new Map<string, ContentDownloadRetention>(), pins = new Map<string, Readonly<{ expected: ContentPackageExpected; manifestSha256: string }>>();
  for (const descriptor of descriptors) {
    const retention = descriptor.retention === undefined ? "required" : descriptor.retention;
    if (retention !== "required" && retention !== "optional") throw new Error("invalid-content-retention");
    const expected = normalizeContentPackageExpected(descriptor.expected);
    const scope = contentPackageCanonicalJson({ packageId: expected.packageId, namespace: expected.namespace, childPolicy: expected.childPolicy });
    const previous = scopes.get(scope);
    if (previous && previous !== retention) throw new Error("conflicting-content-retention");
    scopes.set(scope, retention);
    if (retention === "optional") {
      if (expected.namespace !== "adult" || !/^[a-f0-9]{64}$/u.test(descriptor.manifestSha256)) throw new Error("invalid-optional-content-pin");
      const pin = contentPackageCanonicalJson({ expected, manifestSha256: descriptor.manifestSha256 });
      pins.set(pin, Object.freeze({ expected: Object.freeze(expected), manifestSha256: descriptor.manifestSha256 }));
    }
  }
  return Object.freeze([...pins.values()]);
}
