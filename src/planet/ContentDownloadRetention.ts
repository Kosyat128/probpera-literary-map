import { contentPackageCanonicalJson, normalizeContentPackageExpected, type ContentPackageExpected } from "./contentPackageProtocol.mjs";

export type ContentDownloadRetention = "required" | "optional";
type RetentionDescriptor = { readonly expected: ContentPackageExpected; readonly manifestSha256: string; readonly retention?: ContentDownloadRetention;
  readonly previous?: Readonly<{ expected: ContentPackageExpected; manifestSha256: string }> | null };

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
    const candidates = [{ expected, manifestSha256: descriptor.manifestSha256 }];
    if (descriptor.previous !== undefined && descriptor.previous !== null) {
      const prior = normalizeContentPackageExpected(descriptor.previous.expected);
      const priorScope = contentPackageCanonicalJson({ packageId: prior.packageId, namespace: prior.namespace, childPolicy: prior.childPolicy });
      if (priorScope !== scope || prior.version >= expected.version || !/^[a-f0-9]{64}$/u.test(descriptor.previous.manifestSha256)) {
        throw new Error("invalid-content-download-previous");
      }
      candidates.push({ expected: prior, manifestSha256: descriptor.previous.manifestSha256 });
    }
    if (retention === "optional") {
      if (expected.namespace !== "adult" || !/^[a-f0-9]{64}$/u.test(descriptor.manifestSha256)) throw new Error("invalid-optional-content-pin");
      for (const candidate of candidates) {
        const pin = contentPackageCanonicalJson(candidate);
        pins.set(pin, Object.freeze({ expected: Object.freeze(candidate.expected), manifestSha256: candidate.manifestSha256 }));
      }
    }
  }
  return Object.freeze([...pins.values()]);
}
