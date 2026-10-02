import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CHILD_ENTITY_KINDS, evaluateChildAccess, type ChildAccessInput, type ChildEntityKind } from "./childAccessPolicy";

// Every record is synthetic policy data. These tests issue no editorial or rights approval.
const now = 1_700_000_000_000, ruChecksum = "a".repeat(64), enChecksum = "b".repeat(64);
function fixture(kind: ChildEntityKind = "work", exactAge = 8): ChildAccessInput {
  return {
    profile: { exactAge, allowedTopics: null, blockedTopics: [], policyVersion: "synthetic-policy-v1" },
    entity: { id: `synthetic.${kind}`, kind, sourceVersion: "synthetic-source-v1", policyVersion: "synthetic-policy-v1",
      minAge: 7, maxAge: 11, reviewStatus: "approved", topics: ["synthetic-topic"], topicTagsComplete: true,
      commercialAvailability: "included-in-base", localizedContent: [
        { locale: "ru", contentChecksum: ruChecksum, reviewStatus: "approved", available: true,
          reviewerId: "synthetic-reviewer", reviewedAt: now - 1_000 },
        { locale: "en", contentChecksum: enChecksum, reviewStatus: "approved", available: true,
          reviewerId: "synthetic-reviewer", reviewedAt: now - 1_000 },
      ], rights: { status: "approved", basis: "original", platforms: ["web-pwa", "android-google", "android-rustore", "ios-ipados"],
        territories: ["RU", "GB"], validFrom: now - 10_000, expiresAt: now + 10_000 } },
    context: { entityId: `synthetic.${kind}`, entityKind: kind, sourceVersion: "synthetic-source-v1", contentChecksum: ruChecksum,
      locale: "ru", platform: "web-pwa", territory: "RU", policyVersion: "synthetic-policy-v1", now },
  };
}
const matrixRows = readFileSync(new URL("../../docs/mobile/requirements/v12/62_CHILD_AGE_POLICY_MATRIX.csv", import.meta.url), "utf8")
  .trim().split(/\r?\n/u).slice(1).map(line => line.split(",", 1)[0]);

describe("strict child access foundation without runtime admission", () => {
  it("covers every separately specified matrix entity boundary", () => {
    expect(matrixRows).toHaveLength(19);
    expect(new Set(matrixRows).size).toBe(19);
    expect(matrixRows.every(kind => (CHILD_ENTITY_KINDS as readonly string[]).includes(kind))).toBe(true);
  });
  describe.each(matrixRows)("required %s boundary", rawKind => {
    const kind = rawKind as ChildEntityKind;
    it.each([[6, "age-too-low"], [7, "approved"], [11, "approved"], [12, "age-too-high"]] as const)
      ("enforces exact age %i (%s)", (age, reason) => {
        const expected = kind === "store-preview" && reason === "approved" ? "parent-gate-required" : reason;
        expect(evaluateChildAccess(fixture(kind, age))).toMatchObject({ allowed: expected === "approved", reasonCode: expected,
          profileAge: age, entityMinAge: 7, entityMaxAge: 11 });
      });
    it("denies an unreviewed entity independently of its reviewed locale", () => {
      const source = fixture(kind);
      expect(evaluateChildAccess({ ...source, entity: { ...source.entity, reviewStatus: "not-reviewed" } }))
        .toMatchObject({ allowed: false, reasonCode: "not-reviewed" });
    });
    it("denies a parent-blocked topic", () => {
      const source = fixture(kind);
      expect(evaluateChildAccess({ ...source, profile: { ...source.profile, blockedTopics: ["synthetic-topic"] } }))
        .toMatchObject({ allowed: false, reasonCode: "topic-blocked" });
    });
    it("denies rights at the exclusive expiry boundary", () => {
      const source = fixture(kind);
      expect(evaluateChildAccess({ ...source, context: { ...source.context, now: source.entity.rights.expiresAt } }))
        .toMatchObject({ allowed: false, reasonCode: "license-expired" });
    });
  });
  it("also evaluates country, biography, quiz, favorite and recent independently", () => {
    for (const kind of ["country", "biography", "quiz", "favorite", "recent"] as const) {
      expect(evaluateChildAccess(fixture(kind))).toMatchObject({ allowed: true, reasonCode: "approved" });
    }
  });
  it("accepts the global child range only through exact integer ages", () => {
    for (const age of [3, 17]) {
      const source = fixture("work", age);
      expect(evaluateChildAccess({ ...source, entity: { ...source.entity, minAge: 3, maxAge: 17 } })).toMatchObject({ allowed: true });
    }
    for (const age of [2, 18, 7.5, "8", NaN, Infinity, undefined]) {
      const source = fixture();
      expect(evaluateChildAccess({ ...source, profile: { ...source.profile, exactAge: age } })).toMatchObject({ allowed: false });
    }
  });
  it("cannot reuse a writer review for a requested work or another entity ID", () => {
    const writer = fixture("writer"), work = fixture("work");
    expect(evaluateChildAccess(writer)).toMatchObject({ allowed: true });
    expect(evaluateChildAccess({ ...writer, context: work.context })).toMatchObject({ allowed: false, reasonCode: "not-reviewed" });
    expect(evaluateChildAccess({ ...work, context: { ...work.context, entityId: "synthetic.other-work" } })).toMatchObject({ allowed: false });
    expect(evaluateChildAccess({ ...work, entity: { ...work.entity, reviewStatus: "rejected" } }))
      .toMatchObject({ allowed: false, reasonCode: "rejected" });
  });
  it("binds source, policy and locale payload to current independent context", () => {
    const source = fixture();
    for (const context of [
      { ...source.context, sourceVersion: "synthetic-source-v2" },
      { ...source.context, policyVersion: "synthetic-policy-v2" },
      { ...source.context, contentChecksum: "c".repeat(64) },
      { ...source.context, locale: "en" },
    ]) expect(evaluateChildAccess({ ...source, context })).toMatchObject({ allowed: false, reasonCode: "not-reviewed" });
    expect(evaluateChildAccess({ ...source, profile: { ...source.profile, policyVersion: "old-policy" } })).toMatchObject({ allowed: false });
    expect(evaluateChildAccess({ ...source, context: { ...source.context, locale: "en", contentChecksum: enChecksum } }))
      .toMatchObject({ allowed: true });
  });
  it("requires separate available and reviewed child content in the requested locale", () => {
    const source = fixture();
    for (const localizedContent of [[], source.entity.localizedContent.filter(item => item.locale === "en"),
      source.entity.localizedContent.map(item => ({ ...item, available: false }))]) {
      expect(evaluateChildAccess({ ...source, entity: { ...source.entity, localizedContent } }))
        .toMatchObject({ allowed: false, reasonCode: "missing-child-content" });
    }
    for (const reviewStatus of ["not-reviewed", "rejected"] as const) {
      const localizedContent = source.entity.localizedContent.map(item => ({ ...item, reviewStatus }));
      expect(evaluateChildAccess({ ...source, entity: { ...source.entity, localizedContent } }))
        .toMatchObject({ allowed: false, reasonCode: reviewStatus });
    }
    const future = source.entity.localizedContent.map(item => ({ ...item, reviewedAt: now + 1 }));
    expect(evaluateChildAccess({ ...source, entity: { ...source.entity, localizedContent: future } })).toMatchObject({ allowed: false });
  });
  it("requires complete topics and blocks only an explicitly intersecting topic", () => {
    const source = fixture();
    expect(evaluateChildAccess({ ...source, entity: { ...source.entity, topicTagsComplete: false, topics: [] } }))
      .toMatchObject({ allowed: false, reasonCode: "not-reviewed" });
    expect(evaluateChildAccess({ ...source, profile: { ...source.profile, blockedTopics: ["unrelated-topic"] } })).toMatchObject({ allowed: true });
  });
  it("preserves an explicit parent topic allowlist and gives blocked topics precedence", () => {
    const source = fixture();
    expect(evaluateChildAccess({ ...source, profile: { ...source.profile, allowedTopics: ["synthetic-topic"] } }))
      .toMatchObject({ allowed: true });
    for (const allowedTopics of [[], ["other-topic"]]) {
      expect(evaluateChildAccess({ ...source, profile: { ...source.profile, allowedTopics } }))
        .toMatchObject({ allowed: false, reasonCode: "topic-blocked" });
    }
    expect(evaluateChildAccess({ ...source, profile: { ...source.profile, allowedTopics: ["synthetic-topic"], blockedTopics: ["synthetic-topic"] } }))
      .toMatchObject({ allowed: false, reasonCode: "topic-blocked" });
    const mixed = { ...source, entity: { ...source.entity, topics: ["synthetic-topic", "other-topic"] } };
    expect(evaluateChildAccess({ ...mixed, profile: { ...mixed.profile, allowedTopics: ["synthetic-topic"] } }))
      .toMatchObject({ allowed: false, reasonCode: "topic-blocked" });
  });
  it("requires independent rights approval, explicit platform and explicit territory", () => {
    const source = fixture();
    for (const status of ["review-required", "blocked"] as const) {
      expect(evaluateChildAccess({ ...source, entity: { ...source.entity, rights: { ...source.entity.rights, status } } }))
        .toMatchObject({ allowed: false, reasonCode: "rights-blocked" });
    }
    expect(evaluateChildAccess({ ...source, entity: { ...source.entity, rights: { ...source.entity.rights, platforms: ["ios-ipados"] } } }))
      .toMatchObject({ allowed: false, reasonCode: "rights-blocked" });
    expect(evaluateChildAccess({ ...source, context: { ...source.context, territory: "US" } }))
      .toMatchObject({ allowed: false, reasonCode: "territory-blocked" });
    for (const platform of ["android-google", "android-rustore", "ios-ipados"] as const) {
      expect(evaluateChildAccess({ ...source, context: { ...source.context, platform, territory: "GB" } })).toMatchObject({ allowed: true });
    }
  });
  it("treats the rights interval as inclusive start and exclusive end", () => {
    const source = fixture(), validFrom = now + 1_000, expiresAt = validFrom + 1_000;
    const input = { ...source, entity: { ...source.entity, rights: { ...source.entity.rights, validFrom, expiresAt } } };
    expect(evaluateChildAccess({ ...input, context: { ...input.context, now: validFrom - 1 } })).toMatchObject({ allowed: false, reasonCode: "rights-blocked" });
    expect(evaluateChildAccess({ ...input, context: { ...input.context, now: validFrom } })).toMatchObject({ allowed: true });
    expect(evaluateChildAccess({ ...input, context: { ...input.context, now: expiresAt - 1 } })).toMatchObject({ allowed: true });
    expect(evaluateChildAccess({ ...input, context: { ...input.context, now: expiresAt } })).toMatchObject({ allowed: false, reasonCode: "license-expired" });
  });
  it("permits explicit perpetual cleared rights without inferring approval from their basis", () => {
    const source = fixture();
    for (const basis of ["original", "public-domain"] as const) {
      const rights = { ...source.entity.rights, basis, expiresAt: null };
      expect(evaluateChildAccess({ ...source, entity: { ...source.entity, rights } })).toMatchObject({ allowed: true });
      expect(evaluateChildAccess({ ...source, entity: { ...source.entity, rights: { ...rights, status: "review-required" } } }))
        .toMatchObject({ allowed: false, reasonCode: "rights-blocked" });
    }
    const missingExpiry = { ...source.entity.rights } as Record<string, unknown>;
    delete missingExpiry.expiresAt;
    expect(evaluateChildAccess({ ...source, entity: { ...source.entity, rights: missingExpiry } })).toMatchObject({ allowed: false });
  });
  it("keeps optional and licensed admission unavailable without independent ownership/licensor gates", () => {
    const source = fixture();
    expect(evaluateChildAccess({ ...source, entity: { ...source.entity, commercialAvailability: "optional" } }))
      .toMatchObject({ allowed: false, reasonCode: "rights-blocked" });
    expect(evaluateChildAccess({ ...source, entity: { ...source.entity, rights: { ...source.entity.rights, basis: "licensed" } } }))
      .toMatchObject({ allowed: false, reasonCode: "rights-blocked" });
  });
  it("leaves external links/store previews behind the unavailable secure Parent Gate", () => {
    for (const kind of ["external-link", "store-preview"] as const) {
      expect(evaluateChildAccess(fixture(kind))).toMatchObject({ allowed: false, reasonCode: "parent-gate-required" });
    }
    const source = fixture("external-link");
    const blocked = { ...source, entity: { ...source.entity, rights: { ...source.entity.rights, status: "blocked" } } };
    expect(evaluateChildAccess(blocked)).toMatchObject({ allowed: false, reasonCode: "rights-blocked" });
    for (const input of [{ ...source, parentGatePassed: true }, { ...blocked, parentOverride: true },
      { ...source, context: { ...source.context, parentGatePassed: true } }]) {
      expect(evaluateChildAccess(input)).toMatchObject({ allowed: false });
    }
  });
  it("denies malformed input without coercion, accessor execution or throws", () => {
    const source = fixture(), sparseTopics = new Array(1), decoratedTopics = ["synthetic-topic"];
    Object.defineProperty(decoratedTopics, "extra", { value: true, enumerable: true });
    let reads = 0;
    const accessor = { ...source.entity };
    Object.defineProperty(accessor, "reviewStatus", { enumerable: true, get: () => { reads += 1; return "approved"; } });
    const accessorTopics = ["synthetic-topic"];
    Object.defineProperty(accessorTopics, "0", { enumerable: true, get: () => { reads += 1; return "synthetic-topic"; } });
    for (const input of [null, undefined, true, [], JSON.stringify(source), Object.create(source), { ...source, unknown: true },
      { ...source, entity: accessor }, { ...source, entity: { ...source.entity, topics: accessorTopics } },
      { ...source, entity: { ...source.entity, topics: sparseTopics } },
      { ...source, entity: { ...source.entity, topics: decoratedTopics } },
      { ...source, entity: { ...source.entity, topics: ["synthetic-topic", "synthetic-topic"] } },
      { ...source, entity: { ...source.entity, topics: ["Synthetic-Topic"] } },
      { ...source, profile: { ...source.profile, blockedTopics: ["SYNTHETIC-TOPIC"] } },
      { ...source, profile: { ...source.profile, allowedTopics: ["synthetic topic"] } },
      { ...source, profile: { ...source.profile, allowedTopics: undefined } },
      { ...source, entity: { ...source.entity, minAge: 12, maxAge: 7 } },
      { ...source, entity: { ...source.entity, kind: "constructor" } },
      { ...source, entity: { ...source.entity, reviewStatus: "APPROVED" } },
      { ...source, entity: { ...source.entity, localizedContent: [...source.entity.localizedContent, source.entity.localizedContent[0]] } },
      { ...source, context: { ...source.context, locale: "fr" } },
      { ...source, context: { ...source.context, territory: "*" } },
      { ...source, context: { ...source.context, platform: "android" } },
      new Proxy({}, { getPrototypeOf: () => { throw new Error("synthetic-failed-object"); } }),
    ]) expect(evaluateChildAccess(input)).toMatchObject({ allowed: false });
    expect(reads).toBe(0);
  });
  it("denies malformed clocks/intervals rather than treating unknown expiry as perpetual", () => {
    const source = fixture();
    for (const clock of [NaN, Infinity, -1, 1.5, "1700000000000", undefined, 8_640_000_000_000_001]) {
      expect(evaluateChildAccess({ ...source, context: { ...source.context, now: clock } })).toMatchObject({ allowed: false });
    }
    for (const expiresAt of [undefined, "never", NaN, now - 10_000, now - 10_001]) {
      expect(evaluateChildAccess({ ...source, entity: { ...source.entity, rights: { ...source.entity.rights, expiresAt } } }))
        .toMatchObject({ allowed: false });
    }
  });
  it("bounds metadata collections and identifiers consistently with the local profile codec", () => {
    const source = fixture(), tooManyTopics = Array.from({ length: 65 }, (_, index) => `topic-${index}`);
    for (const input of [
      { ...source, profile: { ...source.profile, allowedTopics: tooManyTopics } },
      { ...source, profile: { ...source.profile, blockedTopics: tooManyTopics } },
      { ...source, entity: { ...source.entity, topics: tooManyTopics } },
      { ...source, entity: { ...source.entity, id: "x".repeat(97) } },
      { ...source, context: { ...source.context, policyVersion: "x".repeat(97) } },
      { ...source, entity: { ...source.entity, localizedContent: [...source.entity.localizedContent, source.entity.localizedContent[0]] } },
      { ...source, entity: { ...source.entity, rights: { ...source.entity.rights, platforms: new Array(5) } } },
      { ...source, entity: { ...source.entity, rights: { ...source.entity.rights, territories: new Array(677) } } },
    ]) expect(evaluateChildAccess(input)).toMatchObject({ allowed: false });
  });
  it("does not mutate caller data and returns an immutable binding decision", () => {
    const source = fixture(), before = JSON.stringify(source), result = evaluateChildAccess(source);
    expect(JSON.stringify(source)).toBe(before);
    expect(Object.isFrozen(result)).toBe(true);
    expect(result).toEqual({ allowed: true, reasonCode: "approved", profileAge: 8, entityMinAge: 7, entityMaxAge: 11,
      reviewStatus: "approved", rightsStatus: "approved", sourcePolicyVersion: "synthetic-policy-v1" });
  });
});
