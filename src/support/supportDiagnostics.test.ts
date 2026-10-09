import { afterEach, describe, expect, it, vi } from "vitest";
import { projectSupportDiagnostics, type DiagnosticCatalog, type SupportDiagnosticInput } from "./supportDiagnostics";
import { createSupportDiagnosticSession } from "./supportDiagnosticSession";
import { observePwaDiagnostics, supportStorageBucket } from "./supportDiagnosticObservations";
import type { PwaWorkerSnapshot } from "../pwa/registerPwaWorker";

const secret = "PIN-token-child-query-private-biography";
const catalog: DiagnosticCatalog = { countries: [{ id: "country", writers: [{ id: "writer" }] }],
  books: [{ id: "work", countryId: "country", writerId: "writer" }] };
const input = (): SupportDiagnosticInput => ({ platform: "web", graphicsTier: "balanced",
  activeItems: { scope: "settled-reader", countryId: "country", writerId: "writer", workId: "work" },
  webgl: { lossCount: 3, restorationCount: 2 }, pwa: null, nativeStorage: null });
const report = () => projectSupportDiagnostics(input(), catalog)!;
afterEach(() => vi.unstubAllGlobals());

describe("closed adult diagnostic projection", () => {
  it("exports exactly ten field groups with explicit absent sources and no ambient reads", () => {
    for (const name of ["window", "document", "navigator", "localStorage", "sessionStorage"]) {
      vi.stubGlobal(name, new Proxy({}, { get() { throw new Error(secret); } }));
    }
    const result = report();
    expect(Object.keys(result)).toEqual(["versions", "environment", "graphicsTier", "activeItems",
      "lastTransfer", "webglRecovery", "store", "availableStorage", "integrity", "correlationIds"]);
    expect(result.environment.os).toEqual({ status: "unknown", reason: "not-exposed" });
    expect(result.store.provider).toEqual({ status: "unknown", reason: "not-exposed" });
    expect(result.correlationIds).toEqual({ status: "unknown", reason: "not-exposed" });
    expect(JSON.stringify(result)).not.toContain(secret);
  });
  it("rejects private extra fields at every exported observation boundary", () => {
    expect(projectSupportDiagnostics({ ...input(), token: secret }, catalog)).toBeNull();
    expect(projectSupportDiagnostics({ ...input(), activeItems: { ...input().activeItems!, profile: secret } }, catalog)).toBeNull();
    expect(projectSupportDiagnostics({ ...input(), webgl: { lossCount: 1, restorationCount: 0, lastLossAt: secret } }, catalog)).toBeNull();
    expect(projectSupportDiagnostics({ ...input(), pwa: { engineBuildId: null, activeBuildId: null,
      integrity: null, repair: null, storage: null, receipt: secret } }, catalog)).toBeNull();
    expect(projectSupportDiagnostics({ ...input(), pwa: { engineBuildId: null, activeBuildId: null,
      integrity: { status: "unavailable", category: secret }, repair: null, storage: null } }, catalog)).toBeNull();
  });
  it("rejects accessors, custom serialization, symbols, foreign prototypes and throwing proxies", () => {
    let reads = 0;
    const accessor = { ...input() };
    Object.defineProperty(accessor, "graphicsTier", { get() { reads++; return secret; } });
    expect(projectSupportDiagnostics(accessor, catalog)).toBeNull();
    expect(reads).toBe(0);
    expect(projectSupportDiagnostics({ ...input(), toJSON() { throw new Error(secret); } }, catalog)).toBeNull();
    expect(projectSupportDiagnostics({ ...input(), [Symbol("private")]: secret }, catalog)).toBeNull();
    expect(projectSupportDiagnostics(Object.assign(Object.create({ inherited: secret }), input()), catalog)).toBeNull();
    const revoked = Proxy.revocable({}, {}); revoked.revoke();
    expect(projectSupportDiagnostics(revoked.proxy, catalog)).toBeNull();
    expect(projectSupportDiagnostics(new Proxy({}, { ownKeys() { throw new Error(secret); } }), catalog)).toBeNull();
  });
  it("admits IDs only in the known current catalog relation, never a syntactically valid stored alias", () => {
    expect(projectSupportDiagnostics({ ...input(), activeItems: { scope: "settled-reader",
      countryId: "country", writerId: "writer", workId: "stored-secret-id" } }, catalog)).toBeNull();
    expect(projectSupportDiagnostics(input(), { ...catalog, books: [] })).toBeNull();
    expect(projectSupportDiagnostics(input(), { ...catalog, countries: [{ id: "country", writers: [] }] })).toBeNull();
    expect(report().activeItems).toMatchObject({ status: "observed", source: "adult-canonical-selection",
      value: { countryId: "country", writerId: "writer", workId: "work" } });
  });
  it("rejects impossible counters, unbounded IDs and untrusted version strings", () => {
    for (const lossCount of [NaN, Infinity, -1, -0, 1.5, 1_000_000_001]) {
      expect(projectSupportDiagnostics({ ...input(), webgl: { lossCount, restorationCount: 0 } }, catalog)).toBeNull();
    }
    // The existing lifecycle counts the two browser events independently.
    expect(projectSupportDiagnostics({ ...input(), webgl: { lossCount: 0, restorationCount: 1 } }, catalog)?.webglRecovery)
      .toMatchObject({ value: { lossCount: 0, restorationCount: 1 } });
    expect(projectSupportDiagnostics({ ...input(), activeItems: { scope: "globe-selection",
      countryId: "x".repeat(161), writerId: null, workId: null } }, catalog)).toBeNull();
    expect(projectSupportDiagnostics({ ...input(), pwa: { engineBuildId: secret, activeBuildId: null,
      integrity: null, repair: null, storage: null } }, catalog)).toBeNull();
  });
});

describe("explicit consent and exact preview lifetime", () => {
  it("never reads adult observations before consent or through a denied boundary", () => {
    let allowed = false;
    const read = vi.fn(report);
    const session = createSupportDiagnosticSession({ canUse: () => allowed, read });
    session.setConsent(true); expect(session.preview()).toBe(false); expect(session.exportPreview()).toBeNull();
    allowed = true; expect(session.preview()).toBe(false);
    expect(read).not.toHaveBeenCalled();
    session.setConsent(true); expect(read).not.toHaveBeenCalled();
    expect(session.preview()).toBe(true); expect(read).toHaveBeenCalledTimes(1);
  });
  it("takes a fresh snapshot on each explicit preview and downloads exactly the reviewed bytes", () => {
    let tier: "balanced" | "economy" = "balanced";
    const read = vi.fn(() => projectSupportDiagnostics({ ...input(), graphicsTier: tier }, catalog));
    const session = createSupportDiagnosticSession({ canUse: () => true, read });
    session.setConsent(true); expect(session.preview()).toBe(true);
    const first = session.getSnapshot().preview;
    tier = "economy";
    expect(session.exportPreview()).toBe(first); expect(read).toHaveBeenCalledTimes(1);
    expect(session.preview()).toBe(true);
    expect(session.getSnapshot().preview).toContain("economy");
    expect(read).toHaveBeenCalledTimes(2);
  });
  it("clears bytes and consent when admission is lost, and requires new consent after return", () => {
    let allowed = true;
    const session = createSupportDiagnosticSession({ canUse: () => allowed, read: report });
    session.setConsent(true); session.preview(); allowed = false;
    expect(session.exportPreview()).toBeNull();
    expect(session.getSnapshot()).toEqual({ consented: false, preview: null, failure: "unavailable" });
    allowed = true; expect(session.preview()).toBe(false);
    session.setConsent(true); session.preview(); session.clear();
    expect(session.getSnapshot()).toEqual({ consented: false, preview: null, failure: null });
  });
  it("rejects a preview whose synchronous reader crosses the adult boundary", () => {
    const session = createSupportDiagnosticSession({ canUse: () => true,
      read: () => { session.clear(); return report(); } });
    session.setConsent(true);
    expect(session.preview()).toBe(false);
    expect(session.exportPreview()).toBeNull();
    expect(session.getSnapshot().preview).toBeNull();
  });
  it("does not restore consent or bytes when an authority read synchronously invalidates the session", () => {
    // Calls: consent, initial preview, pre-read guard, final preview guard, export.
    for (const clearAt of [1, 2, 3, 4, 5]) {
      let calls = 0;
      const session = createSupportDiagnosticSession({
        canUse: () => { if (++calls === clearAt) session.clear(); return true; },
        read: report,
      });
      session.setConsent(true);
      session.preview();
      expect(session.exportPreview()).toBeNull();
      expect(session.getSnapshot().consented).toBe(false);
      expect(session.getSnapshot().preview).toBeNull();
    }
  });
  it("never retains a prior preview or raw exception after a rejected observation", () => {
    let invalid = false;
    const session = createSupportDiagnosticSession({ canUse: () => true,
      read: () => { if (invalid) throw new Error(secret); return report(); } });
    session.setConsent(true); session.preview(); invalid = true;
    expect(session.preview()).toBe(false);
    expect(session.getSnapshot()).toEqual({ consented: true, preview: null, failure: "invalid-observation" });
    expect(JSON.stringify(session.getSnapshot())).not.toContain(secret);
  });
});

describe("existing PWA observations", () => {
  const engine = "a".repeat(64), active = "b".repeat(64);
  const worker: PwaWorkerSnapshot = { phase: "ready", engineBuildId: engine, activeBuildId: active,
    update: null, error: null, rollback: null };
  const storage = { busy: null, usage: 12_345_678, quota: 2_000_000_000, persisted: true,
    canPersist: true, denied: false, error: false } as const;
  it("reports only coarse storage and observed matching-build integrity", () => {
    const value = observePwaDiagnostics(worker,
      { status: "complete", engineBuildId: engine, activeBuildId: active, fileCount: 99, bytes: 123456 }, null, storage);
    expect(value.storage).toEqual({ bucket: "1-to-5-gib", scope: "browser-origin" });
    expect(value.integrity).toEqual({ status: "complete", category: null });
    expect(JSON.stringify(value)).not.toMatch(/123456|12345678|2000000000|persisted|fileCount/);
    expect(observePwaDiagnostics({ ...worker, activeBuildId: "c".repeat(64) },
      { status: "complete", engineBuildId: engine, activeBuildId: active, fileCount: 99, bytes: 123456 }, null, storage).integrity).toBeNull();
  });
  it("does not infer a successful update or check from a ready worker", () => {
    const pwa = observePwaDiagnostics(worker, null, null, { ...storage, error: true });
    const value = projectSupportDiagnostics({ ...input(), pwa }, catalog)!;
    expect(value.integrity).toEqual({ status: "unknown", reason: "not-observed" });
    expect(value.lastTransfer.update).toEqual({ status: "unknown", reason: "not-observed" });
    expect(value.availableStorage).toEqual({ status: "unknown", reason: "not-observed" });
  });
  it("rejects nonsensical storage without exporting exact sizes", () => {
    for (const value of [undefined, secret, -1, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1]) {
      expect(supportStorageBucket(value)).toBeNull();
    }
    expect(supportStorageBucket(0)).toBe("under-100-mib");
    expect(supportStorageBucket(1024 ** 3)).toBe("1-to-5-gib");
  });
});
