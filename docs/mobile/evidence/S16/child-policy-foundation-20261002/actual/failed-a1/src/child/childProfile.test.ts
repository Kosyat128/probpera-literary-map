import { describe, expect, it, vi } from "vitest";
import { CHILD_PROFILE_MAX_LENGTH, childAgeBand, decodeChildProfiles, isChildExactAge } from "./childProfile";

const context = { policyVersion: "synthetic-policy-v1", now: Date.parse("2026-10-02T12:00:00.000Z") };
const record = (id = "synthetic-child-1", exactAge = 9) => ({ id, label: "Reader One", exactAge, locale: "ru",
  ageConfirmedAt: "2026-10-01T12:00:00.000Z", readingLevel: null, allowedTopics: null as string[] | null, blockedTopics: ["violence"],
  soundEnabled: false, motion: "calm", narrationEnabled: false });
const registry = (profiles = [record()], activeProfileId: string | null = profiles[0]?.id ?? null) => ({
  schemaVersion: 1, policyVersion: context.policyVersion, activeProfileId, profiles });

describe("local child profile metadata foundation", () => {
  it.each([[3, "3-5"], [5, "3-5"], [6, "6-8"], [8, "6-8"], [9, "9-11"], [11, "9-11"],
    [12, "12-14"], [14, "12-14"], [15, "15-17"], [17, "15-17"]])("derives presentation band at exact age %s", (age, band) => {
    expect(isChildExactAge(age)).toBe(true);
    expect(childAgeBand(age)).toBe(band);
    const decoded = decodeChildProfiles(registry([record("synthetic-child-1", age as number)]), context);
    expect(decoded.registry?.profiles[0]).toMatchObject({ exactAge: age, ageBand: band });
  });
  it.each([2, 18, 3.5, NaN, Infinity, "9", null, undefined, true])("never coerces invalid age %s", age => {
    expect(isChildExactAge(age)).toBe(false);
    expect(childAgeBand(age)).toBeNull();
    expect(decodeChildProfiles(registry([{ ...record(), exactAge: age } as ReturnType<typeof record>]), context).registry).toBeNull();
  });
  it("restores four local profiles and their exact active ID without changing the input", () => {
    const input = registry([record("child-one", 3), record("child-two", 8), record("child-three", 12), record("child-four", 17)], "child-three");
    const before = JSON.stringify(input);
    const decoded = decodeChildProfiles(before, context);
    expect(decoded.error).toBeNull();
    expect(decoded.registry?.profiles).toHaveLength(4);
    expect(decoded.registry?.activeProfileId).toBe("child-three");
    expect(decoded.registry?.profiles.map(row => row.exactAge)).toEqual([3, 8, 12, 17]);
    expect(JSON.stringify(input)).toBe(before);
  });
  it("rejects a fifth profile, duplicate IDs and an unresolved active ID as a whole", () => {
    for (const input of [registry(Array.from({ length: 5 }, (_, index) => record("child-" + index))),
      registry([record(), record()]), registry([record()], "missing-child")]) {
      expect(decodeChildProfiles(input, context)).toEqual({ registry: null, error: "invalid" });
    }
  });
  it("can reload decoded metadata but never accepts a stored band contradicting exact age", () => {
    const decoded = decodeChildProfiles(registry(), context);
    expect(decodeChildProfiles(JSON.stringify(decoded.registry), context)).toEqual(decoded);
    expect(decodeChildProfiles(registry([{ ...record(), ageBand: "15-17" } as ReturnType<typeof record>]), context).registry).toBeNull();
  });
  it("round-trips four profiles at the allowed topic and label limits", () => {
    const topicKeys = Array.from({ length: 64 }, (_, index) => ("topic-" + index).padEnd(64, "x"));
    const input = registry(Array.from({ length: 4 }, (_, index) => ({ ...record("child-" + index),
      label: "r".repeat(80), allowedTopics: topicKeys, blockedTopics: topicKeys })));
    const decoded = decodeChildProfiles(input, context);
    expect(decoded.error).toBeNull();
    expect(decodeChildProfiles(JSON.stringify(decoded.registry), context)).toEqual(decoded);
  });
  it("distinguishes an explicit empty registry from missing, malformed and newer data without granting a mode", () => {
    expect(decodeChildProfiles(registry([], null), context)).toMatchObject({ error: null, registry: { profiles: [], activeProfileId: null } });
    expect(decodeChildProfiles(null, context)).toEqual({ registry: null, error: "missing" });
    for (const input of [undefined, "", "{", "null", [], {}]) expect(decodeChildProfiles(input, context).registry).toBeNull();
    expect(decodeChildProfiles({ schemaVersion: 2, futureFormat: true }, context)).toEqual({ registry: null, error: "unsupported" });
  });
  it("keeps policy changes and future, normalized or invalid age confirmations sealed", () => {
    expect(decodeChildProfiles({ ...registry(), policyVersion: "synthetic-policy-v2" }, context)).toEqual({ registry: null, error: "policy-mismatch" });
    for (const ageConfirmedAt of ["2026-10-03T12:00:00.000Z", "2026-02-30T12:00:00.000Z", "2026-10-01", "2026-10-01T12:00:00Z"])
      expect(decodeChildProfiles(registry([{ ...record(), ageConfirmedAt }]), context).registry).toBeNull();
    expect(decodeChildProfiles(registry([{ ...record(), ageConfirmedAt: "2026-10-02T12:00:00.000Z" }]), context).error).toBeNull();
  });
  it("does not infer an annual confirmation interval absent from the binding plan", () => {
    expect(decodeChildProfiles(registry([{ ...record(), ageConfirmedAt: "2020-01-01T00:00:00.000Z" }]), context).error).toBeNull();
  });
  it("requires explicit RU/EN locale, settings and exact metadata fields", () => {
    for (const patch of [{ locale: "fr" }, { soundEnabled: "false" }, { narrationEnabled: 1 }, { motion: "unrestricted" },
      { readingLevel: "unknown" }, { label: " Reader One" }, { label: "Reader\nOne" }, { ageBand: "15-17" }])
      expect(decodeChildProfiles(registry([{ ...record(), ...patch } as ReturnType<typeof record>]), context).registry).toBeNull();
    const { locale: _locale, ...missingLocale } = record();
    expect(decodeChildProfiles(registry([missingLocale as ReturnType<typeof record>]), context).registry).toBeNull();
    expect(decodeChildProfiles(registry([{ ...record(), locale: "en", readingLevel: "plain", motion: "system" } as ReturnType<typeof record>]), context).error).toBeNull();
  });
  it("rejects personal/telemetry fields and adult cache references instead of retaining them", () => {
    for (const patch of [{ fullBirthDate: "2017-03-01" }, { email: "synthetic@example.invalid" }, { photo: "portrait" },
      { advertisingIdentifier: "synthetic-id" }, { adultHistory: ["adult-writer"] }, { parentPin: "synthetic-pin" }])
      expect(decodeChildProfiles(registry([{ ...record(), ...patch }]), context).registry).toBeNull();
  });
  it("copies and freezes profile settings; a blocked topic remains present even when also allowed", () => {
    const input = registry([{ ...record(), allowedTopics: ["adventure", "violence"] }]);
    const decoded = decodeChildProfiles(input, context);
    const profile = decoded.registry!.profiles[0];
    input.profiles[0].blockedTopics.length = 0;
    input.profiles[0].allowedTopics!.push("new-topic");
    input.profiles[0].exactAge = 17;
    expect(profile.blockedTopics).toEqual(["violence"]);
    expect(profile.allowedTopics).toEqual(["adventure", "violence"]);
    expect(profile.exactAge).toBe(9);
    for (const value of [decoded, decoded.registry, decoded.registry!.profiles, profile, profile.blockedTopics, profile.allowedTopics])
      expect(Object.isFrozen(value)).toBe(true);
  });
  it("rejects uncertain topics and hidden/accessor/prototype metadata without invoking a getter", () => {
    const getter = vi.fn(() => 9);
    const accessor = Object.defineProperty({ ...record() }, "exactAge", { get: getter, enumerable: true });
    const hidden = Object.defineProperty({ ...record() }, "secret", { value: "synthetic", enumerable: false });
    const symbolic = { ...record(), [Symbol("extra")]: true };
    for (const row of [accessor, hidden, symbolic, Object.assign(Object.create(record()), {})])
      expect(decodeChildProfiles(registry([row]), context).registry).toBeNull();
    expect(getter).not.toHaveBeenCalled();
    for (const blockedTopics of [["violence", "violence"], ["Violence"], [""], new Array(1)])
      expect(decodeChildProfiles(registry([{ ...record(), blockedTopics }]), context).registry).toBeNull();
  });
  it("rejects sparse/extended profile arrays and unsafe clock/context values", () => {
    const extended = Object.assign([record()], { account: "synthetic" });
    for (const profiles of [new Array(1), extended]) expect(decodeChildProfiles(registry(profiles), context).registry).toBeNull();
    for (const now of [NaN, Infinity, -1, 1.5, 8_640_000_000_000_001, "123"])
      expect(decodeChildProfiles(registry(), { ...context, now } as typeof context).registry).toBeNull();
    expect(decodeChildProfiles(registry(), { ...context, approved: true } as typeof context).registry).toBeNull();
    expect(decodeChildProfiles(" ".repeat(CHILD_PROFILE_MAX_LENGTH + 1), context).registry).toBeNull();
  });
});
