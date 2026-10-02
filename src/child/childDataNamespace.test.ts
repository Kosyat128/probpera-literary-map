import { describe, expect, it } from "vitest";
import { CHILD_DATA_PURPOSES, childDataNamespace, decodeChildDataScope, sameChildDataScope, type ChildDataScope } from "./childDataNamespace";

// Synthetic coordinates are neither a verified package nor an editorial approval.
function fixture(): ChildDataScope {
  return { schemaVersion: 1, namespace: "child", profileId: "synthetic-child", profileRevision: 1, exactAge: 7, locale: "ru",
    policyVersion: "synthetic-policy-v1", policyChecksum: "a".repeat(64), packageId: "synthetic-child-package",
    packageVersion: 1, packageChecksum: "b".repeat(64) };
}
const changes: readonly Partial<ChildDataScope>[] = [
  { profileId: "synthetic-other-child" }, { profileRevision: 2 }, { exactAge: 8 }, { locale: "en" },
  { policyVersion: "synthetic-policy-v2" }, { policyChecksum: "c".repeat(64) }, { packageId: "synthetic-other-package" },
  { packageVersion: 2 }, { packageChecksum: "d".repeat(64) },
];

describe("isolated child metadata namespaces without content admission", () => {
  it("returns a copied immutable child scope and retains its exact coordinates", () => {
    const input = { ...fixture() }, decoded = decodeChildDataScope(input);
    expect(decoded).toEqual(input);
    expect(decoded).not.toBe(input);
    expect(Object.isFrozen(decoded)).toBe(true);
    input.profileId = "mutated-input";
    expect(decoded?.profileId).toBe("synthetic-child");
  });
  it("accepts null-prototype data while rejecting inherited authority", () => {
    const input = Object.assign(Object.create(null), fixture());
    expect(decodeChildDataScope(input)).toEqual(fixture());
    expect(decodeChildDataScope(Object.create(fixture()))).toBeNull();
  });
  it("separates all required child purposes with an explicit child-only prefix", () => {
    const purposes = ["search", "cache", "history", "favorites", "offline", "recommendations", "narration", "themes"];
    expect(CHILD_DATA_PURPOSES).toEqual(purposes);
    const keys = purposes.map(purpose => childDataNamespace(fixture(), purpose));
    expect(new Set(keys).size).toBe(purposes.length);
    for (let index = 0; index < purposes.length; index++) {
      expect(keys[index]).toMatch(new RegExp(`^probpera-child-v1/${purposes[index]}/[a-f0-9]+$`, "u"));
      expect(keys[index]).not.toContain("adult");
    }
  });
  it.each(changes)("changes the namespace and publication scope for changed coordinates %j", change => {
    const prior = fixture(), next = { ...prior, ...change };
    expect(sameChildDataScope(prior, next)).toBe(false);
    for (const purpose of CHILD_DATA_PURPOSES) expect(childDataNamespace(prior, purpose)).not.toBe(childDataNamespace(next, purpose));
  });
  it("distinguishes exact ages within one presentation band", () => {
    const seven = fixture(), eight = { ...seven, exactAge: 8 };
    expect(childDataNamespace(seven, "search")).not.toBe(childDataNamespace(eight, "search"));
    expect(sameChildDataScope(seven, eight)).toBe(false);
  });
  it("preserves distinct case-sensitive identities even on a case-folding key backend", () => {
    const left = { ...fixture(), profileId: "Synthetic-Child" }, right = { ...fixture(), profileId: "synthetic-child" };
    const a = childDataNamespace(left, "cache"), b = childDataNamespace(right, "cache");
    expect(a).not.toBeNull(); expect(b).not.toBeNull();
    expect(a?.toLowerCase()).not.toBe(b?.toLowerCase());
    expect(sameChildDataScope(left, right)).toBe(false);
  });
  it("does not alias ambiguously concatenated IDs and versions", () => {
    const left = { ...fixture(), profileId: "a-b", policyVersion: "c" }, right = { ...fixture(), profileId: "a", policyVersion: "b-c" };
    expect(left.profileId + "-" + left.policyVersion).toBe(right.profileId + "-" + right.policyVersion);
    expect(childDataNamespace(left, "history")).not.toBe(childDataNamespace(right, "history"));
  });
  it("is deterministic across property order and complete equivalent projections", () => {
    const value = fixture(), reversed = Object.fromEntries(Object.entries(value).reverse());
    expect(sameChildDataScope(value, reversed)).toBe(true);
    expect(childDataNamespace(value, "offline")).toBe(childDataNamespace(reversed, "offline"));
    expect(childDataNamespace(value, "offline")).toBe(childDataNamespace(decodeChildDataScope(value), "offline"));
  });
  it("retains the full tuple losslessly without treating the encoding as cryptographic proof", () => {
    const value = fixture(), key = childDataNamespace(value, "offline");
    const encoded = key?.split("/")[2] ?? "";
    const json = (encoded.match(/../gu) ?? []).map(byte => String.fromCharCode(parseInt(byte, 16))).join("");
    expect(JSON.parse(json)).toEqual([1, "child", value.profileId, value.profileRevision, value.exactAge, value.locale,
      value.policyVersion, value.policyChecksum, value.packageId, value.packageVersion, value.packageChecksum]);
    expect(decodeChildDataScope({ ...value, verified: true })).toBeNull();
    expect(decodeChildDataScope({ ...value, approved: true })).toBeNull();
  });
  it("supports exact boundary ages and maximum safe integer revisions", () => {
    for (const exactAge of [3, 17]) {
      const value = { ...fixture(), exactAge, profileRevision: Number.MAX_SAFE_INTEGER, packageVersion: Number.MAX_SAFE_INTEGER };
      expect(decodeChildDataScope(value)).toEqual(value);
      expect(childDataNamespace(value, "search")).not.toBeNull();
    }
  });
  it.each(["adult", "recent-adult", "../history", "cache/adult", "constructor", "__proto__", "SEARCH", "", null, true])
    ("rejects unsupported or injected namespace purpose %j", purpose => {
      expect(childDataNamespace(fixture(), purpose)).toBeNull();
    });
  it.each(["../adult", "..", ".", "a/b", "a\\b", "a%2Fb", "a:b", "a\u0000b", "аdult", "x".repeat(97)])
    ("rejects traversal, separator, encoding and unsupported ID %j", id => {
      for (const field of ["profileId", "policyVersion", "packageId"] as const) {
        const input = { ...fixture(), [field]: id };
        expect(decodeChildDataScope(input)).toBeNull();
        expect(childDataNamespace(input, "cache")).toBeNull();
      }
    });
  it("rejects adult, incomplete, newer, coerced or malformed metadata instead of restoring a fallback", () => {
    const value = fixture(), missing = { ...value } as Record<string, unknown>;
    delete missing.packageChecksum;
    for (const input of [null, true, [], JSON.stringify(value), missing, { ...value, namespace: "adult" },
      { ...value, schemaVersion: 2 }, { ...value, locale: "fr" }, { ...value, exactAge: 18 }, { ...value, exactAge: 7.5 },
      { ...value, exactAge: "7" }, { ...value, profileRevision: 0 }, { ...value, profileRevision: NaN },
      { ...value, packageVersion: 0 }, { ...value, packageVersion: Number.MAX_SAFE_INTEGER + 1 },
      { ...value, packageVersion: "1" }, { ...value, policyChecksum: "A".repeat(64) },
      { ...value, packageChecksum: "unknown" }, { ...value, ageBand: "6-8" }, { ...value, adultHistory: [] },
      new Proxy({}, { getPrototypeOf() { throw new Error("synthetic-failed-object"); } }),
    ]) {
      expect(decodeChildDataScope(input)).toBeNull();
      expect(childDataNamespace(input, "history")).toBeNull();
      expect(sameChildDataScope(value, input)).toBe(false);
    }
    expect(sameChildDataScope(null, null)).toBe(false);
  });
  it("does not execute accessors or accept hidden and symbolic metadata", () => {
    const value = fixture(), accessor = { ...value }; let reads = 0;
    Object.defineProperty(accessor, "namespace", { enumerable: true, get() { reads++; return "child"; } });
    const hidden = { ...value };
    Object.defineProperty(hidden, "packageChecksum", { enumerable: false, value: value.packageChecksum });
    for (const input of [accessor, hidden, { ...value, [Symbol("synthetic-approval")]: true }]) {
      expect(decodeChildDataScope(input)).toBeNull();
      expect(childDataNamespace(input, "search")).toBeNull();
    }
    expect(reads).toBe(0);
  });
});
