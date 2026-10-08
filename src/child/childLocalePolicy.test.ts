import { describe, expect, it, vi } from "vitest";
import { childProfileAllowsLocale, decodeChildLocalePolicy, decodeChildProfiles } from "./childProfile";
import { copyChildPackageChallenge } from "./childPackage";

// AUTHORED_NOT_RUN: pure synthetic data only; no parent/native/content authority.
const now = Date.parse("2026-10-02T12:00:00.000Z"), policyVersion = "synthetic-policy-v1";
const profile = () => ({ id: "reader", label: "Reader", exactAge: 9, locale: "ru" as const,
  ageConfirmedAt: "2026-10-01T12:00:00.000Z", readingLevel: null, allowedTopics: null, blockedTopics: [],
  soundEnabled: false, motion: "calm", narrationEnabled: false });
const decode = (row: unknown) => decodeChildProfiles({ schemaVersion: 1, policyVersion, activeProfileId: "reader", profiles: [row] }, { policyVersion, now });
describe("S16 BIL009 allowed locale policy", () => {
  it("restores and deeply freezes an explicit policy without aliasing its parent data", () => {
    const input = { schemaVersion: 1, allowedLocales: ["ru", "en"] }, result = decode({ ...profile(), localeLocked: false, localePolicy: input });
    expect(result.error).toBeNull(); const policy = result.registry!.profiles[0].localePolicy!;
    expect(policy).toEqual(input); expect(Object.isFrozen(policy)).toBe(true); expect(Object.isFrozen(policy.allowedLocales)).toBe(true);
    input.allowedLocales.pop(); expect(policy.allowedLocales).toEqual(["ru", "en"]);
    expect(childProfileAllowsLocale(result.registry!.profiles[0], "en")).toBe(true);
  });
  it("leaves legacy bytes unchanged and admits only their current locale", () => {
    for (const lock of [undefined, false, true]) {
      const input = { ...profile(), ...(lock === undefined ? {} : { localeLocked: lock }) }, raw = JSON.stringify(input);
      const restored = decode(input).registry!.profiles[0];
      expect(restored).not.toHaveProperty("localePolicy"); expect(JSON.stringify(input)).toBe(raw);
      expect(childProfileAllowsLocale(restored, "ru")).toBe(true); expect(childProfileAllowsLocale(restored, "en")).toBe(false);
    }
  });
  it("refuses malformed schema arrays duplicate unknown and excluded-current languages", () => {
    for (const value of [null, { schemaVersion: true, allowedLocales: ["ru"] }, { schemaVersion: "1", allowedLocales: ["ru"] },
      { schemaVersion: 2, allowedLocales: ["ru"] }, { schemaVersion: 1, allowedLocales: [] },
      { schemaVersion: 1, allowedLocales: ["ru", "ru"] }, { schemaVersion: 1, allowedLocales: ["en"] },
      { schemaVersion: 1, allowedLocales: ["ru", "de"] }, { schemaVersion: 1, allowedLocales: ["ru"], extra: false }]) {
      expect(decodeChildLocalePolicy(value, "ru")).toBeNull();
      expect(decode({ ...profile(), localePolicy: value }).registry).toBeNull();
    }
    expect(decode({ ...profile(), localePolicy: undefined }).registry).toBeNull();
  });
  it("never reads nested accessors sparse arrays symbols or hostile proxy traps", () => {
    const getter = vi.fn(() => ["ru"]), accessor = { schemaVersion: 1 };
    Object.defineProperty(accessor, "allowedLocales", { enumerable: true, get: getter });
    const sparse = new Array(1), symbolic = { schemaVersion: 1, allowedLocales: ["ru"], [Symbol("extra")]: true }, arrayAccessor = ["ru"];
    Object.defineProperty(arrayAccessor, "0", { enumerable: true, get: getter });
    for (const value of [accessor, { schemaVersion: 1, allowedLocales: sparse }, { schemaVersion: 1, allowedLocales: arrayAccessor }, symbolic]) {
      expect(decodeChildLocalePolicy(value, "ru")).toBeNull();
    }
    for (const trap of ["getPrototypeOf", "ownKeys", "getOwnPropertyDescriptor"] as const) {
      const refused = vi.fn(() => { throw new Error("refused"); });
      const handler: ProxyHandler<object> = trap === "getPrototypeOf" ? { getPrototypeOf: refused }
        : trap === "ownKeys" ? { ownKeys: refused } : { getOwnPropertyDescriptor: refused };
      expect(decodeChildLocalePolicy(new Proxy({ schemaVersion: 1, allowedLocales: ["ru"] }, handler), "ru")).toBeNull();
      expect(refused).toHaveBeenCalled();
    }
    expect(getter).not.toHaveBeenCalled();
  });
  it("requires explicit unlocked state and refuses policies invalidated by a locale edit", () => {
    const policy = { schemaVersion: 1, allowedLocales: ["ru", "en"] };
    for (const localeLocked of [undefined, true]) expect(childProfileAllowsLocale({ ...profile(), localePolicy: policy,
      ...(localeLocked === undefined ? {} : { localeLocked }) }, "en")).toBe(false);
    expect(decode({ ...profile(), locale: "en", localePolicy: { schemaVersion: 1, allowedLocales: ["ru"] } }).registry).toBeNull();
  });
  it("rejects a disallowed package challenge before exposing a mutable profile", () => {
    const challenge = { generation: 1, request: { locale: "en", route: { kind: "home", entityId: null } },
      selection: { schemaVersion: 1, mode: "child", selectionRevision: 1, profileId: "reader", profileRevision: 1,
        profileChecksum: "a".repeat(64), policyVersion, policyChecksum: "b".repeat(64) }, profile: { ...profile(), localeLocked: false } };
    expect(copyChildPackageChallenge(challenge, now)).toBeNull();
    Object.assign(challenge.profile, { localePolicy: { schemaVersion: 1, allowedLocales: ["ru", "en"] } });
    expect(copyChildPackageChallenge(challenge, now)?.profile.localePolicy?.allowedLocales).toEqual(["ru", "en"]);
  });
});
