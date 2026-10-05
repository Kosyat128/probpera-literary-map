import { describe, expect, it, vi } from "vitest";
import releasePins from "./childNativeResourceReleasePins.json";
import {
  CHILD_NATIVE_RESOURCE_CATALOG_KIND, CHILD_NATIVE_RESOURCE_PIN_KIND,
  childNativeResourceBindingKey, childNativeResourceOrigin, childNativeResourcePath,
  decodeChildNativeResourceBinding, decodeChildNativeResourceCatalog, decodeChildNativeResourcePins,
  type ChildNativeResourceBinding, type ChildNativeResourceMime, type ChildNativeResourceOrigin,
} from "./childNativeResource";

// AUTHOR_ONLY_NOT_RUN. These synthetic fixtures describe closed source data.
// No fixture supplies rights/review approval, platform TLS trust, authenticated
// bytes, a current child context or the original private native LOCAL2 claim.
const PACKAGE_HASH = "a".repeat(64), POLICY_HASH = "b".repeat(64), MANIFEST_HASH = "c".repeat(64);
const REVIEW_HASH = "d".repeat(64), ASSET_HASH = "e".repeat(64), KEY_HASH = "f".repeat(64);
const SOURCE_HASH = "1".repeat(64), OTHER_HASH = "2".repeat(64);
const EXTENSIONS: Readonly<Record<ChildNativeResourceMime, string>> = {
  "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "audio/wav": "wav",
};
function binding(patch: Partial<ChildNativeResourceBinding> = {}): ChildNativeResourceBinding {
  return { id: "binding-one", packageId: "package-one", packageVersion: 1, packageChecksum: PACKAGE_HASH,
    policyVersion: "local-policy-v2", policyChecksum: POLICY_HASH, manifestChecksum: MANIFEST_HASH,
    reviewChecksum: REVIEW_HASH, assetId: "asset-one", assetChecksum: ASSET_HASH, assetBytes: 1024,
    mime: "image/png", originId: "origin-one", path: `/objects/${ASSET_HASH}.png`,
    validFromEpochMs: 1_000, validUntilEpochMs: 31_000, ...patch };
}
function origin(patch: Partial<ChildNativeResourceOrigin> = {}): ChildNativeResourceOrigin {
  return { id: "origin-one", origin: "https://resources.example.org", tlsPublicKeyX963Checksums: [KEY_HASH], ...patch };
}
function pins(resources: unknown[] = [binding()], origins: unknown[] = [origin()]) {
  return { schemaVersion: 2, kind: CHILD_NATIVE_RESOURCE_PIN_KIND, origins, resources };
}
function catalog(platform: "android-google" | "android-rustore" | "ios-ipados" | null = "android-google",
  resources: unknown[] = [binding()], origins: unknown[] = [origin()]) {
  return { schemaVersion: 2, kind: CHILD_NATIVE_RESOURCE_CATALOG_KIND, platform,
    resourcePinSourceChecksum: SOURCE_HASH, origins, resources };
}
function withoutField(value: object, field: string): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...value }; delete copy[field]; return copy;
}

describe("native resource source projection", () => {
  it("keeps genuine release pins empty and decodes the closed accountless source", () => {
    expect(releasePins).toEqual({ schemaVersion: 2, kind: CHILD_NATIVE_RESOURCE_PIN_KIND, origins: [], resources: [] });
    const decoded = decodeChildNativeResourcePins(releasePins);
    expect(decoded).toEqual(releasePins);
    expect(decoded).not.toBe(releasePins);
    expect(Object.isFrozen(decoded)).toBe(true);
    expect(Object.isFrozen(decoded!.origins)).toBe(true);
    expect(Object.isFrozen(decoded!.resources)).toBe(true);
  });

  it("copies a closed canonical resource tuple and freezes every nested record", () => {
    const rawOrigin = origin(), rawBinding = binding(), raw = pins([rawBinding], [rawOrigin]);
    const decoded = decodeChildNativeResourcePins(raw);
    expect(decoded).toEqual(raw);
    expect(decoded!.resources[0]).not.toBe(rawBinding);
    expect(decoded!.origins[0]).not.toBe(rawOrigin);
    for (const value of [decoded, decoded!.origins, decoded!.resources,
      decoded!.origins[0], decoded!.origins[0].tlsPublicKeyX963Checksums, decoded!.resources[0]])
      expect(Object.isFrozen(value)).toBe(true);
    (rawOrigin.tlsPublicKeyX963Checksums as string[])[0] = OTHER_HASH;
    raw.resources[0] = binding({ assetBytes: 2048 });
    expect(decoded!.origins[0].tlsPublicKeyX963Checksums).toEqual([KEY_HASH]);
    expect(decoded!.resources[0].assetBytes).toBe(1024);
    expect(Object.keys(decoded!.resources[0]).sort()).toEqual(Object.keys(rawBinding).sort());
  });

  it("projects all four static byte formats to their exact content-addressed paths", () => {
    for (const [mime, extension] of Object.entries(EXTENSIONS) as [ChildNativeResourceMime, string][]) {
      const path = `/objects/${ASSET_HASH}.${extension}`;
      expect(childNativeResourcePath(ASSET_HASH, mime)).toBe(path);
      expect(decodeChildNativeResourceBinding(binding({ mime, path }))).toEqual(binding({ mime, path }));
    }
  });

  it("retains the exact package/policy/manifest/review/asset source tuple without claiming approval", () => {
    const decoded = decodeChildNativeResourceBinding(binding())!;
    expect([decoded.packageId, decoded.packageVersion, decoded.packageChecksum, decoded.policyVersion,
      decoded.policyChecksum, decoded.manifestChecksum, decoded.reviewChecksum, decoded.assetId,
      decoded.assetChecksum, decoded.assetBytes, decoded.mime]).toEqual([
      "package-one", 1, PACKAGE_HASH, "local-policy-v2", POLICY_HASH, MANIFEST_HASH, REVIEW_HASH,
      "asset-one", ASSET_HASH, 1024, "image/png",
    ]);
    expect(childNativeResourceBindingKey(decoded)).toBe(`${PACKAGE_HASH}/asset-one`);
    for (const extra of [{ nativeClaim: true }, { reviewed: true }, { rightsApproved: true },
      { currentContext: "caller-context" }, { url: "https://resources.example.org/anything" }])
      expect(decodeChildNativeResourceBinding({ ...binding(), ...extra })).toBeNull();
  });

  it("rejects missing and future source fields instead of accepting a partial tuple", () => {
    for (const field of Object.keys(binding())) expect(decodeChildNativeResourceBinding(withoutField(binding(), field))).toBeNull();
    for (const field of Object.keys(pins())) expect(decodeChildNativeResourcePins(withoutField(pins(), field))).toBeNull();
    for (const bad of [{ ...pins(), schemaVersion: 1 }, { ...pins(), schemaVersion: 3 },
      { ...pins(), kind: CHILD_NATIVE_RESOURCE_CATALOG_KIND }, { ...pins(), futureCapability: true }])
      expect(decodeChildNativeResourcePins(bad)).toBeNull();
  });
});

describe("fixed HTTPS origin and content-addressed path boundaries", () => {
  it("accepts canonical HTTPS names without normalizing a caller URL", () => {
    for (const value of ["https://example.org", "https://resources.example.org", "https://cdn-1.example.org"])
      expect(childNativeResourceOrigin(value)).toBe(value);
  });

  it("rejects schemes, authority controls and alternate URL spellings", () => {
    for (const value of [undefined, null, 42, {}, "", "http://resources.example.org", "ftp://resources.example.org",
      "file:///resources.example.org", "//resources.example.org", "HTTPS://resources.example.org",
      "https://Resources.example.org", "https://resources.example.org/", "https://resources.example.org:443",
      "https://resources.example.org:8443", "https://user@resources.example.org",
      "https://user:password@resources.example.org", "https://resources.example.org?token=caller",
      "https://resources.example.org#caller", "https://resources.example.org/objects/resource.png",
      " https://resources.example.org", "https://resources.example.org ", "https://resources.example.org\n",
      "https://resources.example.org\\evil", "https://resourcés.example.org"])
      expect(childNativeResourceOrigin(value)).toBeNull();
  });

  it("rejects local literals and malformed or oversized DNS labels", () => {
    for (const value of ["https://localhost", "https://127.0.0.1", "https://2130706433", "https://[::1]",
      "https://resources.local", "https://resources.internal", "https://resources.lan", "https://resources.home",
      "https://resources.localhost", "https://-cdn.example.org", "https://cdn-.example.org",
      "https://cdn..example.org", "https://cdn_example.org", "https://example.org.",
      `https://${"x".repeat(64)}.example.org`, `https://${Array(5).fill("x".repeat(63)).join(".")}`,
      `https://${"x".repeat(513)}.org`]) expect(childNativeResourceOrigin(value)).toBeNull();
  });

  it("rejects noncanonical hashes and unsupported active or alternate MIME types", () => {
    for (const hash of [undefined, null, 1, {}, "", ASSET_HASH.slice(1), `${ASSET_HASH}e`, ASSET_HASH.toUpperCase(),
      `${"e".repeat(63)}g`, ` ${ASSET_HASH}`, `${ASSET_HASH}\n`]) expect(childNativeResourcePath(hash, "image/png")).toBeNull();
    for (const mime of [undefined, null, {}, "image/svg+xml", "image/gif", "image/jpg", "image/PNG",
      "image/png; charset=utf-8", "video/mp4", "audio/mp3", "audio/x-wav", "application/octet-stream"])
      expect(childNativeResourcePath(ASSET_HASH, mime)).toBeNull();
  });

  it("rejects caller paths, alternate extensions, traversal and URL additions", () => {
    for (const path of ["", `objects/${ASSET_HASH}.png`, `/objects/${OTHER_HASH}.png`, `/objects/${ASSET_HASH}.jpg`,
      `/objects/${ASSET_HASH}.PNG`, `/objects/${ASSET_HASH}.png/`, `/objects/${ASSET_HASH}.png?token=caller`,
      `/objects/${ASSET_HASH}.png#caller`, `/objects/../${ASSET_HASH}.png`, `/objects/%2e%2e/${ASSET_HASH}.png`,
      `/objects//${ASSET_HASH}.png`, `/objects/%65${ASSET_HASH.slice(1)}.png`,
      `https://resources.example.org/objects/${ASSET_HASH}.png`, `file:///objects/${ASSET_HASH}.png`,
      `/objects/${ASSET_HASH}.png\n`]) expect(decodeChildNativeResourceBinding(binding({ path }))).toBeNull();
  });
});

describe("untrusted source records and arrays", () => {
  it("rejects inherited, hidden, accessor and symbol fields without invoking getters", () => {
    const getter = vi.fn(() => ASSET_HASH), accessor = { ...binding() };
    Object.defineProperty(accessor, "assetChecksum", { enumerable: true, get: getter });
    const hidden = { ...binding() };
    Object.defineProperty(hidden, "assetChecksum", { enumerable: false, value: ASSET_HASH });
    for (const value of [undefined, null, false, 7, "binding", [], accessor, hidden,
      Object.create(binding()), { ...binding(), [Symbol("permit")]: true }])
      expect(decodeChildNativeResourceBinding(value)).toBeNull();
    expect(getter).not.toHaveBeenCalled();
  });

  it("rejects unknown origin fields and TLS key accessors without invoking getters", () => {
    const getter = vi.fn(() => KEY_HASH), keys = [KEY_HASH];
    Object.defineProperty(keys, "0", { enumerable: true, get: getter });
    const originGetter = vi.fn(() => "https://resources.example.org"), accessor = { ...origin() };
    Object.defineProperty(accessor, "origin", { enumerable: true, get: originGetter });
    const hidden = { ...origin() };
    Object.defineProperty(hidden, "origin", { enumerable: false, value: "https://resources.example.org" });
    for (const value of [{ ...origin(), redirectOrigin: "https://other.example.org" },
      { ...origin(), verified: true }, { ...origin(), [Symbol("trust")]: true }, Object.create(origin()),
      accessor, hidden, origin({ tlsPublicKeyX963Checksums: keys })])
      expect(decodeChildNativeResourcePins(pins([binding()], [value]))).toBeNull();
    expect(getter).not.toHaveBeenCalled();
    expect(originGetter).not.toHaveBeenCalled();
  });

  it("accepts own enumerable data on null-prototype records", () => {
    const raw = Object.assign(Object.create(null), pins(
      [Object.assign(Object.create(null), binding())], [Object.assign(Object.create(null), origin())]));
    expect(decodeChildNativeResourcePins(raw)).toEqual(pins());
  });

  it("rejects sparse, decorated, subclassed and accessor collection arrays", () => {
    const sparse = Array(1), decorated = Object.assign([binding()], { permit: true });
    const symbolArray = Object.assign([binding()], { [Symbol("permit")]: true });
    const accessor = [binding()], getter = vi.fn(() => binding());
    Object.defineProperty(accessor, "0", { enumerable: true, get: getter });
    const inheritedArray = [binding()]; Object.setPrototypeOf(inheritedArray, Object.create(Array.prototype));
    for (const resources of [sparse, decorated, symbolArray, accessor, inheritedArray])
      expect(decodeChildNativeResourcePins(pins(resources))).toBeNull();
    const hiddenOrigin = [origin()]; Object.defineProperty(hiddenOrigin, "0", { enumerable: false, value: origin() });
    expect(decodeChildNativeResourcePins(pins([binding()], hiddenOrigin))).toBeNull();
    expect(getter).not.toHaveBeenCalled();
  });

  it("requires closed data fields at the pins and compiled catalog roots", () => {
    const getter = vi.fn(() => [binding()]), raw = pins();
    Object.defineProperty(raw, "resources", { enumerable: true, get: getter });
    for (const value of [raw, Object.create(pins()), { ...pins(), sourceApproval: true },
      { ...pins(), [Symbol("source")]: SOURCE_HASH }, { ...pins(), origins: {} }, { ...pins(), resources: {} }])
      expect(decodeChildNativeResourcePins(value)).toBeNull();
    expect(getter).not.toHaveBeenCalled();
    const catalogGetter = vi.fn(() => SOURCE_HASH), rawCatalog = catalog();
    Object.defineProperty(rawCatalog, "resourcePinSourceChecksum", { enumerable: true, get: catalogGetter });
    for (const value of [rawCatalog, Object.create(catalog()), { ...catalog(), sourceApproval: true },
      { ...catalog(), [Symbol("source")]: SOURCE_HASH }])
      expect(decodeChildNativeResourceCatalog(value, SOURCE_HASH, "android-google")).toBeNull();
    expect(catalogGetter).not.toHaveBeenCalled();
  });
});

describe("binding scalar, byte and time limits", () => {
  it("requires source identifiers and policy version to remain bounded canonical identifiers", () => {
    const fields = ["id", "packageId", "policyVersion", "assetId", "originId"] as const;
    for (const field of fields) {
      expect(decodeChildNativeResourceBinding(binding({ [field]: "x".repeat(96) }))).not.toBeNull();
      for (const value of ["", "x".repeat(97), ".first", "-first", "_first", "two words", "../caller",
        "caller/id", "политика", " caller", "caller\n", null, true, 1])
        expect(decodeChildNativeResourceBinding({ ...binding(), [field]: value })).toBeNull();
    }
    for (const id of ["", "x".repeat(97), "bad/id"])
      expect(decodeChildNativeResourcePins(pins([binding()], [origin({ id })]))).toBeNull();
  });

  it("requires every package, policy, manifest, review and asset digest as lowercase SHA-256", () => {
    for (const field of ["packageChecksum", "policyChecksum", "manifestChecksum", "reviewChecksum", "assetChecksum"] as const)
      for (const value of ["", "a".repeat(63), "a".repeat(65), "A".repeat(64), "g".repeat(64),
        `${"a".repeat(64)}\n`, null, 7, { checksum: POLICY_HASH }])
        expect(decodeChildNativeResourceBinding({ ...binding(), [field]: value })).toBeNull();
  });

  it("requires a positive safe package version without coercion or negative zero", () => {
    expect(decodeChildNativeResourceBinding(binding({ packageVersion: Number.MAX_SAFE_INTEGER }))).not.toBeNull();
    for (const packageVersion of [0, -0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, Number.NaN,
      Number.POSITIVE_INFINITY, "1", true, null])
      expect(decodeChildNativeResourceBinding({ ...binding(), packageVersion })).toBeNull();
  });

  it("accepts exact raster/audio encoded byte caps and refuses the first excess byte", () => {
    for (const [mime, limit] of [["image/png", 33_554_432], ["image/jpeg", 33_554_432],
      ["image/webp", 33_554_432], ["audio/wav", 25_165_824]] as const) {
      const value = binding({ mime, path: `/objects/${ASSET_HASH}.${EXTENSIONS[mime]}` });
      expect(decodeChildNativeResourceBinding({ ...value, assetBytes: 1 })).not.toBeNull();
      expect(decodeChildNativeResourceBinding({ ...value, assetBytes: limit })).not.toBeNull();
      expect(decodeChildNativeResourceBinding({ ...value, assetBytes: limit + 1 })).toBeNull();
      for (const assetBytes of [0, -0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, "1024", null])
        expect(decodeChildNativeResourceBinding({ ...value, assetBytes })).toBeNull();
    }
  });

  it("bounds the source interval and requires its end strictly after its start", () => {
    const maximum = 8_640_000_000_000_000;
    expect(decodeChildNativeResourceBinding(binding({ validFromEpochMs: 0, validUntilEpochMs: 1 }))).not.toBeNull();
    expect(decodeChildNativeResourceBinding(binding({ validFromEpochMs: maximum - 1, validUntilEpochMs: maximum }))).not.toBeNull();
    for (const pair of [[1_000, 1_000], [1_001, 1_000], [-1, 1_000], [-0, 1_000], [0, -0],
      [0, maximum + 1], [0.5, 1_000], [0, 1_000.5], [Number.NaN, 1_000], [0, Number.POSITIVE_INFINITY],
      ["0", 1_000], [0, "1000"], [null, 1_000]])
      expect(decodeChildNativeResourceBinding({ ...binding(), validFromEpochMs: pair[0], validUntilEpochMs: pair[1] })).toBeNull();
  });

  it("preserves declared source time without treating a fixture clock as native admission", () => {
    // Source decoding has no live clock/context input. The private native issuer
    // independently checks current review/rights/context deadlines before use.
    for (const value of [binding({ validFromEpochMs: 0, validUntilEpochMs: 1 }),
      binding({ validFromEpochMs: 8_640_000_000_000_000 - 1, validUntilEpochMs: 8_640_000_000_000_000 })])
      expect(decodeChildNativeResourceBinding(value)).toEqual(value);
  });
});

describe("origin key inventory and resource closure", () => {
  it("accepts bounded independent TLS key hashes and refuses missing, duplicate or malformed pins", () => {
    const keys = [KEY_HASH, SOURCE_HASH, OTHER_HASH, PACKAGE_HASH];
    expect(decodeChildNativeResourcePins(pins([binding()], [origin({ tlsPublicKeyX963Checksums: keys })]))).not.toBeNull();
    for (const tlsPublicKeyX963Checksums of [[], [KEY_HASH, KEY_HASH], [...keys, POLICY_HASH], ["F".repeat(64)],
      ["f".repeat(63)], ["g".repeat(64)], [null], "caller-key", { key: KEY_HASH }])
      expect(decodeChildNativeResourcePins(pins([binding()], [{ ...origin(), tlsPublicKeyX963Checksums }]))).toBeNull();
    const sparse = Array(1), decorated = Object.assign([KEY_HASH], { trusted: true });
    for (const keys of [sparse, decorated])
      expect(decodeChildNativeResourcePins(pins([binding()], [origin({ tlsPublicKeyX963Checksums: keys })]))).toBeNull();
  });

  it("requires every origin record to use one canonical source authority", () => {
    for (const field of Object.keys(origin()))
      expect(decodeChildNativeResourcePins(pins([binding()], [withoutField(origin(), field)]))).toBeNull();
    for (const value of ["http://resources.example.org", "https://localhost", "https://resources.example.org/",
      "https://resources.example.org:443", "https://user@resources.example.org"])
      expect(decodeChildNativeResourcePins(pins([binding()], [origin({ origin: value })]))).toBeNull();
  });

  it("rejects missing and unused origins rather than leaving an open resource relation", () => {
    expect(decodeChildNativeResourcePins(pins([binding()], []))).toBeNull();
    expect(decodeChildNativeResourcePins(pins([], [origin()]))).toBeNull();
    expect(decodeChildNativeResourcePins(pins([binding({ originId: "origin-missing" })]))).toBeNull();
    expect(decodeChildNativeResourcePins(pins([binding()], [origin(),
      origin({ id: "origin-unused", origin: "https://unused.example.org" })]))).toBeNull();
  });

  it("rejects duplicate origin IDs/authorities and resource IDs/package-asset keys", () => {
    const second = binding({ id: "binding-two", assetId: "asset-two", originId: "origin-two" });
    expect(decodeChildNativeResourcePins(pins([binding(), second],
      [origin(), origin({ id: "origin-two" })]))).toBeNull();
    expect(decodeChildNativeResourcePins(pins([binding()],
      [origin(), origin({ origin: "https://other.example.org" })]))).toBeNull();
    expect(decodeChildNativeResourcePins(pins([binding(), binding({ assetId: "asset-two" })]))).toBeNull();
    for (const patch of [{ id: "binding-two" }, { id: "binding-two", packageVersion: 2 },
      { id: "binding-two", policyChecksum: OTHER_HASH }, { id: "binding-two", reviewChecksum: OTHER_HASH },
      { id: "binding-two", assetChecksum: OTHER_HASH, path: `/objects/${OTHER_HASH}.png` }])
      expect(decodeChildNativeResourcePins(pins([binding(), binding(patch)]))).toBeNull();
  });

  it("keeps the same asset ID separate across distinct content-addressed packages", () => {
    const other = binding({ id: "binding-two", packageId: "package-two", packageChecksum: OTHER_HASH });
    const decoded = decodeChildNativeResourcePins(pins([binding(), other]));
    expect(decoded!.resources).toEqual([binding(), other]);
    expect(new Set(decoded!.resources.map(childNativeResourceBindingKey)).size).toBe(2);
  });

  it("allows exactly eight referenced origins and rejects a ninth", () => {
    const origins = Array.from({ length: 8 }, (_, index) => origin({ id: `origin-${index}`, origin: `https://cdn-${index}.example.org` }));
    const resources = origins.map((row, index) => binding({ id: `binding-${index}`, assetId: `asset-${index}`, originId: row.id }));
    expect(decodeChildNativeResourcePins(pins(resources, origins))).not.toBeNull();
    expect(decodeChildNativeResourcePins(pins([...resources, binding({ id: "binding-extra", assetId: "asset-extra", originId: "origin-extra" })],
      [...origins, origin({ id: "origin-extra", origin: "https://extra.example.org" })]))).toBeNull();
  });

  it("allows exactly 512 unique source bindings and rejects a 513th", () => {
    const resources = Array.from({ length: 512 }, (_, index) => binding({ id: `binding-${index}`, assetId: `asset-${index}` }));
    expect(decodeChildNativeResourcePins(pins(resources))).not.toBeNull();
    expect(decodeChildNativeResourcePins(pins([...resources, binding({ id: "binding-extra", assetId: "asset-extra" })]))).toBeNull();
  });
});

describe("compiled resource catalog source/platform binding", () => {
  it("decodes closed catalogs for each supported native platform into source data only", () => {
    for (const platform of ["android-google", "android-rustore", "ios-ipados"] as const) {
      const decoded = decodeChildNativeResourceCatalog(catalog(platform), SOURCE_HASH, platform);
      expect(decoded).toEqual(pins());
      expect(Object.isFrozen(decoded)).toBe(true);
      expect(Object.isFrozen(decoded!.resources[0])).toBe(true);
      expect(Object.keys(decoded!).sort()).toEqual(["kind", "origins", "resources", "schemaVersion"]);
    }
  });

  it("requires exact canonical source checksum in both selected input and catalog", () => {
    for (const checksum of ["", SOURCE_HASH.slice(1), `${SOURCE_HASH}1`, "G".repeat(64), OTHER_HASH])
      expect(decodeChildNativeResourceCatalog(catalog(), checksum, "android-google")).toBeNull();
    for (const resourcePinSourceChecksum of [undefined, null, 1, "", OTHER_HASH, "G".repeat(64)])
      expect(decodeChildNativeResourceCatalog({ ...catalog(), resourcePinSourceChecksum }, SOURCE_HASH, "android-google")).toBeNull();
  });

  it("rejects a catalog from another platform or a future/unrecognized platform", () => {
    for (const platform of ["android-rustore", "ios-ipados", "web-pwa", "android", "future-native", undefined, null])
      expect(decodeChildNativeResourceCatalog({ ...catalog(), platform }, SOURCE_HASH, "android-google")).toBeNull();
    expect(decodeChildNativeResourceCatalog(catalog(), SOURCE_HASH, "ios-ipados")).toBeNull();
    expect(decodeChildNativeResourceCatalog(catalog(), SOURCE_HASH, null)).toBeNull();
  });

  it("requires exact v2 catalog kind and every source/platform field", () => {
    for (const field of Object.keys(catalog()))
      expect(decodeChildNativeResourceCatalog(withoutField(catalog(), field), SOURCE_HASH, "android-google")).toBeNull();
    for (const value of [{ ...catalog(), schemaVersion: 1 }, { ...catalog(), schemaVersion: 3 },
      { ...catalog(), kind: CHILD_NATIVE_RESOURCE_PIN_KIND }, { ...catalog(), kind: "future-resource-catalog" }])
      expect(decodeChildNativeResourceCatalog(value, SOURCE_HASH, "android-google")).toBeNull();
  });

  it("admits a null-platform projection only while origins and resources both stay empty", () => {
    expect(decodeChildNativeResourceCatalog(catalog(null, [], []), SOURCE_HASH, null)).toEqual(pins([], []));
    expect(decodeChildNativeResourceCatalog(catalog(null), SOURCE_HASH, null)).toBeNull();
    expect(decodeChildNativeResourceCatalog(catalog(null, [], [origin()]), SOURCE_HASH, null)).toBeNull();
    expect(decodeChildNativeResourceCatalog(catalog(null, [binding()], []), SOURCE_HASH, null)).toBeNull();
    expect(decodeChildNativeResourceCatalog(catalog("android-google", [], []), SOURCE_HASH, "android-google")).toEqual(pins([], []));
  });

  it("applies resource path, policy tuple and origin closure denials to compiled catalogs", () => {
    for (const value of [catalog("android-google", [withoutField(binding(), "policyChecksum")]),
      catalog("android-google", [binding({ path: "/caller/path.png" })]),
      catalog("android-google", [binding({ originId: "unbound-origin" })]),
      catalog("android-google", [binding(), binding({ id: "binding-two" })]),
      catalog("android-google", [binding()], [origin({ tlsPublicKeyX963Checksums: [] })]),
      catalog("android-google", [binding()], [origin(), origin({ id: "unused", origin: "https://unused.example.org" })])])
      expect(decodeChildNativeResourceCatalog(value, SOURCE_HASH, "android-google")).toBeNull();
  });
});

describe("catalog runtime platform closure", () => {
  it("rejects a matching unknown selector supplied beyond TypeScript's native platform union", () => {
    // Runtime JavaScript input cannot acquire a future platform merely by
    // matching the same unrecognized value in the source catalog and selector.
    for (const platform of ["web-pwa", "future-native", "android", "", false, 1, undefined])
      expect(decodeChildNativeResourceCatalog({ ...catalog(), platform }, SOURCE_HASH, platform as never)).toBeNull();
  });
});

describe("hostile resource decoder reflection", () => {
  it("returns null when revoked proxies or record reflection traps throw at an unknown-input boundary", () => {
    const reflectors: ProxyHandler<object>[] = [
      { getPrototypeOf() { throw new Error("synthetic prototype trap"); } },
      { ownKeys() { throw new Error("synthetic own-keys trap"); } },
      { getOwnPropertyDescriptor() { throw new Error("synthetic descriptor trap"); } },
    ];
    for (const target of [binding(), pins(), catalog()]) {
      const revoked = Proxy.revocable(target, {}); revoked.revoke();
      for (const raw of [revoked.proxy, ...reflectors.map(handler => new Proxy(target, handler))]) {
        expect(decodeChildNativeResourceBinding(raw)).toBeNull();
        expect(decodeChildNativeResourcePins(raw)).toBeNull();
        expect(decodeChildNativeResourceCatalog(raw, SOURCE_HASH, "android-google")).toBeNull();
      }
    }
  });

  it("denies nested resource, origin and TLS-key reflection failures through both pins and catalog decoders", () => {
    const hostile = <T extends object>(target: T): T => new Proxy(target, {
      ownKeys() { throw new Error("synthetic nested reflection trap"); },
    });
    const revoked = Proxy.revocable([binding()], {}); revoked.revoke();
    for (const resources of [hostile([binding()]), [hostile(binding())], revoked.proxy]) {
      expect(decodeChildNativeResourcePins(pins(resources))).toBeNull();
      expect(decodeChildNativeResourceCatalog(catalog("android-google", resources), SOURCE_HASH, "android-google")).toBeNull();
    }
    for (const origins of [hostile([origin()]), [hostile(origin())],
      [origin({ tlsPublicKeyX963Checksums: hostile([KEY_HASH]) })]]) {
      expect(decodeChildNativeResourcePins(pins([binding()], origins))).toBeNull();
      expect(decodeChildNativeResourceCatalog(catalog("android-google", [binding()], origins), SOURCE_HASH, "android-google")).toBeNull();
    }
  });
});
