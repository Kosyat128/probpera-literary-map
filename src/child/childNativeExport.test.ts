import { describe, expect, it, vi } from "vitest";
import { CHILD_NATIVE_EXPORT_MAX_BYTES, decodeChildNativeExportReceipt, decodeChildNativeExportReply } from "./childNativeExport";
// AUTHORED_NOT_RUN. Synthetic receipts prove wire refusal only; no native save.
const REQUEST = "a".repeat(32), PROFILE = "child-a", HASH = "b".repeat(64);
const saved = () => ({ requestId: REQUEST, profileId: PROFILE, schemaVersion: 1, sha256: HASH, bytes: 256, outcome: "saved" });
const envelope = (receipt: unknown = saved()) => ({ version: 2, requestId: REQUEST, status: "export", receipt });
describe("original parent child-data export receipt", () => {
  it("returns an immutable exact saved result with a bounded native byte count", () => {
    const raw = saved(), result = decodeChildNativeExportReply(envelope(raw), REQUEST, PROFILE);
    expect(result).toEqual(raw); expect(Object.isFrozen(result)).toBe(true);
    raw.bytes = 1; expect(result?.bytes).toBe(256);
    expect(decodeChildNativeExportReply(envelope({ ...saved(), bytes: CHILD_NATIVE_EXPORT_MAX_BYTES }), REQUEST, PROFILE)?.bytes).toBe(CHILD_NATIVE_EXPORT_MAX_BYTES);
  });
  it("preserves known cancellation and write error separately, before or after snapshot capture", () => {
    for (const outcome of ["cancelled", "error"] as const) for (const captured of [false, true]) {
      const receipt = { ...saved(), outcome, sha256: captured ? HASH : null, bytes: captured ? 256 : 0 };
      expect(decodeChildNativeExportReply(envelope(receipt), REQUEST, PROFILE)?.outcome).toBe(outcome);
    }
  });
  it("rejects missing data proof or mismatched snapshot pairs rather than inventing save completion", () => {
    for (const receipt of [{ ...saved(), sha256: null, bytes: 0 }, { ...saved(), sha256: null }, { ...saved(), bytes: 0 },
      { ...saved(), outcome: "cancelled", sha256: HASH, bytes: 0 }, { ...saved(), outcome: "error", sha256: null, bytes: 1 }])
      expect(decodeChildNativeExportReply(envelope(receipt), REQUEST, PROFILE)).toBeNull();
  });
  it("rejects wrong request/profile/schema/outcome and unsafe byte or digest values", () => {
    for (const receipt of [{ ...saved(), requestId: "c".repeat(32) }, { ...saved(), profileId: "sibling" }, { ...saved(), schemaVersion: 2 },
      { ...saved(), outcome: "verified" }, { ...saved(), sha256: HASH.toUpperCase() }, { ...saved(), sha256: "b".repeat(63) },
      ...[-0, -1, 1.5, Infinity, NaN, CHILD_NATIVE_EXPORT_MAX_BYTES + 1].map(bytes => ({ ...saved(), bytes }))])
      expect(decodeChildNativeExportReply(envelope(receipt), REQUEST, PROFILE)).toBeNull();
    expect(decodeChildNativeExportReply(envelope(), REQUEST, "../child-a")).toBeNull();
    expect(decodeChildNativeExportReply(envelope(), REQUEST.toUpperCase(), PROFILE)).toBeNull();
  });
  it("does not accept generic bootstrap/boolean authority or an uncorrelated outer envelope", () => {
    for (const value of [true, { version: 2, requestId: REQUEST, status: "child", context: {}, profiles: [] },
      { ...envelope(), status: "ok" }, { ...envelope(), version: 1 }, { ...envelope(), requestId: "c".repeat(32) },
      { ...envelope(), verified: true }, { ...envelope(), contextToken: "c".repeat(32) }])
      expect(decodeChildNativeExportReply(value, REQUEST, PROFILE)).toBeNull();
  });
  it("denies filenames URI bytes secrets and unknown fields at either exact envelope level", () => {
    for (const field of ["path", "uri", "contextToken", "data", "pin", "salt", "key", "profiles"]) {
      expect(decodeChildNativeExportReply({ ...envelope(), [field]: "forbidden" }, REQUEST, PROFILE)).toBeNull();
      expect(decodeChildNativeExportReply(envelope({ ...saved(), [field]: "forbidden" }), REQUEST, PROFILE)).toBeNull();
    }
  });
  it("never invokes getters or accepts inherited symbol or revoked proxy state", () => {
    const getter = vi.fn(() => saved()), accessor = { ...envelope() };
    Object.defineProperty(accessor, "receipt", { enumerable: true, get: getter });
    expect(decodeChildNativeExportReply(accessor, REQUEST, PROFILE)).toBeNull(); expect(getter).not.toHaveBeenCalled();
    const nested = { ...saved() }; Object.defineProperty(nested, "bytes", { enumerable: true, get: getter });
    expect(decodeChildNativeExportReply(envelope(nested), REQUEST, PROFILE)).toBeNull(); expect(getter).not.toHaveBeenCalled();
    expect(decodeChildNativeExportReply(Object.create(envelope()), REQUEST, PROFILE)).toBeNull();
    expect(decodeChildNativeExportReply(envelope({ ...saved(), [Symbol("data")]: 1 }), REQUEST, PROFILE)).toBeNull();
    const proxy = Proxy.revocable(saved(), {}); proxy.revoke();
    expect(decodeChildNativeExportReceipt(proxy.proxy, REQUEST, PROFILE)).toBeNull();
  });
});
