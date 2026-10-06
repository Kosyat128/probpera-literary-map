import { describe, expect, it, vi } from "vitest";
import { decodeChildNativePassportProgram, decodeChildNativePassportProgramPins, decodeChildNativeBadges,
  decodeChildNativeDownloadedRoutes, decodeChildNativeRouteSave } from "./childNativePassportProgram";
import { decodeChildNativePassport, decodeChildNativeRemovalTarget } from "./childNativeDiscoveryPassport";
import type { ChildNativeContext } from "./childNativeAppBridge";

// AUTHORED_NOT_RUN. These projections confer no native review/storage authority.
const hash = "a".repeat(64), context = { profileId: "profile-a", locale: "en", generation: 2, package: { version: 3 } } as ChildNativeContext;
const binding = { profileId: context.profileId, locale: context.locale, generation: context.generation };
const rule = () => ({ badgeId: "learning-badge", ruleVersion: 1, displayReference: { kind: "recommendation", id: "reviewed-badge-copy", contentChecksum: hash },
  journeyId: "journey-a", journeyVersion: 3, contentVersion: 3, trigger: "completed-learning", nodeIds: ["writer-a", "work-a"] });
const program = () => ({ schemaVersion: 1, kind: "literary-planet-child-passport-program-v1", programId: "program-a", programVersion: 2,
  packageId: "package-a", packageVersion: 3, packageChecksum: hash, policyVersion: "policy-a", policyChecksum: hash, locale: "en", exactAge: 9,
  awardRules: [rule()], validFromEpochMs: 1000, validUntilEpochMs: 2000 });
const badge = () => ({ badgeId: "learning-badge", ruleVersion: 1, programId: "program-a", programVersion: 2, programChecksum: hash,
  journeyId: "journey-a", journeyVersion: 3, contentVersion: 3, title: "Synthetic badge DTO" });
const route = () => ({ journeyId: "journey-a", journeyVersion: 3, contentVersion: 3, title: "Synthetic route DTO", description: "Text only.", nodeCount: 3,
  snapshotChecksum: hash, byteLength: 1024, media: { locale: "en", audioStatus: "text-only", audioItemCount: 0,
    imageItemCount: 0, transcriptByteLength: 0, mediaByteLength: 0 } });
const emptyPassport = () => ({ schemaVersion: 2, ...binding, revision: 4, countries: [], writers: [], works: [], journeys: [], unresolvedCompletedNodeIds: [],
  badges: { status: "ready", items: [badge()] }, downloadedRoutes: { status: "ready", items: [route()] } });
describe("native passport program source and factual projections", () => {
  it("closes exact rules over stable versions and copies node IDs without issuing awards", () => {
    const raw = program(), parsed = decodeChildNativePassportProgram(raw)!;
    expect(parsed.awardRules[0].nodeIds).toEqual(["writer-a", "work-a"]); raw.awardRules[0].nodeIds.push("later");
    expect(parsed.awardRules[0].nodeIds).toHaveLength(2); expect(Object.isFrozen(parsed.awardRules[0])).toBe(true);
    expect(decodeChildNativePassportProgram({ ...program(), policyVersion: 1 })).toBeNull();
  });
  it("rejects approval flags, payment unlocks, arbitrary badge copy, wrong package versions and ambiguous rules", () => {
    for (const delta of [{ approved: true }, { exactAge: 2 }, { validUntilEpochMs: 1000 }, { awardRules: [rule(), rule()] },
      { awardRules: [{ ...rule(), title: "Caller invented award" }] }, { awardRules: [{ ...rule(), paidUnlock: true }] },
      { awardRules: [{ ...rule(), contentVersion: 4 }] }, { awardRules: [{ ...rule(), nodeIds: ["writer-a", "writer-a"] }] },
      { awardRules: [{ ...rule(), displayReference: { ...rule().displayReference, kind: "work" } }] }])
      expect(decodeChildNativePassportProgram({ ...program(), ...delta })).toBeNull();
  });
  it("keeps genuine empty pins explicit and denies duplicate review keys and future authority fields", () => {
    const pins = { schemaVersion: 1, kind: "literary-planet-child-passport-program-release-pins-v1", reviewKeys: [], programs: [] };
    expect(decodeChildNativePassportProgramPins(pins)?.programs).toEqual([]);
    expect(decodeChildNativePassportProgramPins({ ...pins, approved: true })).toBeNull();
    const key = { keyId: "child-passport-review-fixture", reviewerId: "fixture", publicKeyX963Hex: "04" + "a".repeat(128) };
    expect(decodeChildNativePassportProgramPins({ ...pins, reviewKeys: [key, key] })).toBeNull();
  });
  it("rejects accessor and sparse source programs without invoking getters", () => {
    const raw = program(), getter = vi.fn(() => raw.awardRules); Object.defineProperty(raw, "awardRules", { enumerable: true, get: getter });
    expect(decodeChildNativePassportProgram(raw)).toBeNull(); expect(getter).not.toHaveBeenCalled();
    expect(decodeChildNativePassportProgram({ ...program(), awardRules: new Array(2) })).toBeNull();
  });
  it("accepts only fully versioned native award provenance and separates unavailable from empty", () => {
    expect(decodeChildNativeBadges({ status: "ready", items: [badge()] }, 3)?.items[0].programId).toBe("program-a");
    expect(decodeChildNativeBadges({ status: "ready", items: [] }, 3)?.status).toBe("ready");
    for (const value of [{ status: "unavailable", items: [badge()] }, { status: "ready", items: [badge(), badge()] },
      { status: "ready", items: [{ ...badge(), contentVersion: 2 }] }, { status: "ready", items: [{ ...badge(), granted: true }] }])
      expect(decodeChildNativeBadges(value, 3)).toBeNull();
  });
  it("requires actual bounded route-byte receipts instead of ID membership, stream URLs or download booleans", () => {
    expect(decodeChildNativeDownloadedRoutes({ status: "ready", items: [route()] }, 3)?.items[0].byteLength).toBe(1024);
    for (const item of [{ ...route(), byteLength: 0 }, { ...route(), byteLength: 524289 }, { ...route(), snapshotChecksum: "" },
      { ...route(), url: "https://example.test/route.zip" }, { ...route(), downloaded: true }, { ...route(), contentVersion: 2 }])
      expect(decodeChildNativeDownloadedRoutes({ status: "ready", items: [item] }, 3)).toBeNull();
    expect(decodeChildNativeDownloadedRoutes({ status: "ready", items: [route(), route()] }, 3)).toBeNull();
  });
  it("requires save success to confirm exact profile locale generation route and next CAS revision", () => {
    const receipt = { ...binding, revision: 5, route: route() };
    expect(decodeChildNativeRouteSave(receipt, context, "journey-a", 4)?.revision).toBe(5);
    for (const delta of [{ profileId: "profile-b" }, { locale: "ru" }, { generation: 3 }, { revision: 4 }, { revision: 6 }, { complete: true }])
      expect(decodeChildNativeRouteSave({ ...receipt, ...delta }, context, "journey-a", 4)).toBeNull();
    expect(decodeChildNativeRouteSave(receipt, context, "other", 4)).toBeNull();
    expect(decodeChildNativeRouteSave({ ...receipt, route: { ...route(), media: { ...route().media, locale: "ru" } } }, context, "journey-a", 4)).toBeNull();
  });
  it("binds per-locale checked audio/transcript byte facts without manufacturing permission to play", () => {
    const saved = { ...route(), media: { locale: "en", audioStatus: "downloaded", audioItemCount: 1,
      imageItemCount: 0, transcriptByteLength: 32, mediaByteLength: 256 } };
    const decoded = decodeChildNativeDownloadedRoutes({ status: "ready", items: [saved] }, 3)!;
    expect(decoded.items[0].media.audioStatus).toBe("downloaded"); expect(Object.isFrozen(decoded.items[0].media)).toBe(true);
    for (const delta of [{ audioStatus: "text-only" }, { audioItemCount: 0 }, { transcriptByteLength: 0 }, { mediaByteLength: 0 },
      { locale: "fr" }, { imageItemCount: 64 }, { mediaByteLength: 1024 }, { consent: true }, { playable: true }, { sourceUrl: "file:///fixture.wav" }])
      expect(decodeChildNativeDownloadedRoutes({ status: "ready", items: [{ ...saved, media: { ...saved.media, ...delta } }] }, 3)).toBeNull();
    expect(decodeChildNativePassport({ ...emptyPassport(), downloadedRoutes: { status: "ready", items: [{ ...saved, media: { ...saved.media, locale: "ru" } }] } }, context)).toBeNull();
    const getter = vi.fn(() => saved.media); Object.defineProperty(saved, "media", { enumerable: true, get: getter });
    expect(decodeChildNativeDownloadedRoutes({ status: "ready", items: [saved] }, 3)).toBeNull(); expect(getter).not.toHaveBeenCalled();
  });
  it("keeps v1 unavailable compatibility but prevents v1 from manufacturing the new factual categories", () => {
    expect(decodeChildNativePassport(emptyPassport(), context)?.schemaVersion).toBe(2);
    expect(decodeChildNativePassport({ ...emptyPassport(), schemaVersion: 1 }, context)).toBeNull();
    expect(decodeChildNativePassport({ ...emptyPassport(), schemaVersion: 1, badges: { status: "unavailable", items: [] }, downloadedRoutes: { status: "unavailable", items: [] } }, context)?.schemaVersion).toBe(1);
    const items = Array.from({ length: 5 }, (_, i) => ({ ...route(), journeyId: "journey-" + i, byteLength: 524288 }));
    expect(decodeChildNativePassport({ ...emptyPassport(), downloadedRoutes: { status: "ready", items } }, context)).toBeNull();
  });
  it("allows only explicit original Parent Gate download scope and no arbitrary route/file deletion target", () => {
    expect(decodeChildNativeRemovalTarget({ profileId: "profile-a", scope: "downloads" })).toEqual({ profileId: "profile-a", scope: "downloads" });
    expect(decodeChildNativeRemovalTarget({ profileId: "profile-a", scope: "downloads", journeyId: "journey-a" })).toBeNull();
  });
});
