import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { AVAILABLE_GLOBE_EDITIONS, DEFAULT_GLOBE_EDITION_ID, GLOBE_EDITION_BY_ID } from "../components/globeEditions";
import { baseEditionPolicy, createBaseEditionPolicy } from "./baseEditionPolicy";

const sourceBytes = readFileSync(new URL("../../docs/mobile/requirements/v12/37_BASE_EDITION_STARTER_SET.csv", import.meta.url));
const sourceLines = sourceBytes.toString("utf8").trim().split(/\r?\n/u);
// The three identity columns precede the quoted RU label. This deliberately
// reads the immutable requirement IDs rather than deriving an oracle from the
// policy's own arrays or building a second production CSV parser.
const requirements = sourceLines.slice(1).map(line => {
  const [requirementId, category, id] = line.split(",", 3);
  return { requirementId, category, id };
});
const mapping = (itemId: unknown, platform = "web-pwa") => ({ itemId, sku: "test.optional.product", platform });
const sortedIds = (items: readonly { id: string }[]) => items.map(item => item.id).sort();
function expectFrozen(value: unknown) {
  if (!value || typeof value !== "object") return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) expectFrozen(child);
}

describe("Base Edition inclusion policy without purchase authority", () => {
  it("matches every mandatory identity in the separately pinned V12 CSV exactly once", () => {
    expect(sourceBytes.byteLength).toBe(7009);
    expect(createHash("sha256").update(sourceBytes).digest("hex")).toBe("575f40b97986cb4e64cb89243059a3b18c4cda8069f4f0e1c7d3565f6132b731");
    expect(sourceLines[0].split(",").slice(0, 3)).toEqual(["requirement_id", "category", "item_id"]);
    expect(requirements).toHaveLength(29);
    const actual = baseEditionPolicy.getSnapshot().starterItems;
    expect(actual.map(({ requirementId, category, id }) => ({ requirementId, category, id })))
      .toEqual(requirements);
    expect(new Set(actual.map(item => item.id)).size).toBe(29);
    expect(new Set(actual.map(item => item.requirementId)).size).toBe(29);
    for (const row of actual) expect(row).toMatchObject({ commercialAvailability: "included-in-base", iapSkuAllowed: false });
  });

  it("protects each mandatory item from every optional platform SKU without creating an entitlement", () => {
    for (const { id } of requirements) {
      expect(baseEditionPolicy.classify(id)).toEqual({ included: true, canonicalId: id, reason: "included-in-base", iapSkuAllowed: false, grantsEntitlement: false });
      for (const platform of ["web-pwa", "android-google", "android-rustore", "ios-ipados"]) {
        expect(baseEditionPolicy.validateOptionalSkuMapping(mapping(id, platform)))
          .toEqual({ allowed: false, canonicalId: id, reason: "included-in-base", grantsEntitlement: false });
      }
    }
  });

  it("grandfathers the actual canonical visitor editions and retains the canonical default", () => {
    const snapshot = baseEditionPolicy.getSnapshot(), canonicalIds = AVAILABLE_GLOBE_EDITIONS.map(edition => edition.id);
    expect([...snapshot.grandfatheredEditionIds].sort()).toEqual([...canonicalIds].sort());
    expect(snapshot.defaultEditionId).toBe(DEFAULT_GLOBE_EDITION_ID);
    for (const editionId of canonicalIds) {
      expect(baseEditionPolicy.classify(editionId)).toMatchObject({ included: true, canonicalId: editionId, iapSkuAllowed: false, grantsEntitlement: false });
      expect(baseEditionPolicy.validateOptionalSkuMapping(mapping(editionId))).toMatchObject({ allowed: false, reason: "included-in-base" });
    }
  });

  it("does not turn a grandfathered edition into an optional item when the live registry hides it", async () => {
    const canonical = await vi.importActual<typeof import("./editions")>("./editions");
    try {
      vi.resetModules();
      vi.doMock("./editions", () => ({ ...canonical, GLOBE_EDITIONS: canonical.GLOBE_EDITIONS.map(edition =>
        edition.id === "behaim-1492" ? { ...edition, visitorAvailable: false } : edition) }));
      const hidden = (await import("./baseEditionPolicy")).baseEditionPolicy;
      expect(hidden.classify("behaim-1492")).toMatchObject({ included: true, canonicalId: "behaim-1492" });
      expect(hidden.validateOptionalSkuMapping(mapping("behaim-1492"))).toMatchObject({ allowed: false, reason: "included-in-base" });
      vi.resetModules();
      vi.doMock("./editions", () => ({ ...canonical, GLOBE_EDITIONS: canonical.GLOBE_EDITIONS.filter(edition => edition.id !== "behaim-1492") }));
      await expect(import("./baseEditionPolicy")).rejects.toThrow("missing-grandfathered-edition");
    } finally {
      vi.doUnmock("./editions"); vi.resetModules();
    }
  });

  it("binds only the three existing adult skin roles and keeps both required child skins unresolved", () => {
    const snapshot = baseEditionPolicy.getSnapshot();
    expect(snapshot.skinEditionBindings).toEqual(expect.arrayContaining([
      { itemId: "skin.base.antique", editionId: DEFAULT_GLOBE_EDITION_ID },
      { itemId: "skin.base.modern", editionId: "natural-earth-2026" },
      { itemId: "skin.base.earth", editionId: "nasa-blue-marble" },
    ]));
    expect(snapshot.skinEditionBindings).toHaveLength(3);
    for (const binding of snapshot.skinEditionBindings) {
      expect(GLOBE_EDITION_BY_ID[binding.editionId as keyof typeof GLOBE_EDITION_BY_ID].visitorAvailable).toBe(true);
    }
    const unresolvedSkins = snapshot.starterItems.filter(item => item.category === "skin"
      && !snapshot.skinEditionBindings.some(binding => binding.itemId === item.id));
    expect(sortedIds(unresolvedSkins)).toEqual(["skin.base.child-educational", "skin.base.planetka-cheerful"]);
    expect(snapshot).toMatchObject({ grantsEntitlement: false, releaseReady: false });
  });

  it("recognizes documented base and legacy aliases without using broad included prefixes", () => {
    const aliases = [
      ["base.antique", "skin.base.antique"],
      ["base.world.pushkin-tales", "world.pushkin"],
      ["base.background.child-reading-room", "background.base.child-room"],
      ["antique", DEFAULT_GLOBE_EDITION_ID],
      ["modern", "natural-earth-2026"],
      ["earth", "nasa-blue-marble"],
    ];
    for (const [alias, canonicalId] of aliases) {
      expect(baseEditionPolicy.classify(alias)).toMatchObject({ included: true, canonicalId, grantsEntitlement: false });
      expect(baseEditionPolicy.validateOptionalSkuMapping(mapping(alias))).toMatchObject({ allowed: false, reason: "included-in-base", canonicalId });
    }
    for (const unknown of ["base.unregistered", "skin.base.antique-extra", "world.pushkin-extra"]) {
      expect(baseEditionPolicy.classify(unknown)).toMatchObject({ included: false, reason: "optional-authority-unavailable", grantsEntitlement: false });
    }
  });

  it("copies explicit direct aliases without turning alias configuration into optional authority", () => {
    const aliases = [{ alias: "test.alias.child", includedItemId: "child-mode" },
      { alias: "test.alias.old-globe", includedItemId: "behaim-1492" }];
    const policy = createBaseEditionPolicy(aliases);
    aliases[0].includedItemId = "unknown.replacement";
    expect(policy.classify("test.alias.child")).toMatchObject({ included: true, canonicalId: "child-mode", grantsEntitlement: false });
    expect(policy.classify("test.alias.old-globe")).toMatchObject({ included: true, canonicalId: "behaim-1492" });
    expect(policy.validateOptionalSkuMapping(mapping("test.alias.child"))).toMatchObject({ allowed: false, reason: "included-in-base" });
    expect(policy.validateOptionalSkuMapping(mapping("original.background.unconfigured")))
      .toEqual({ allowed: false, reason: "optional-authority-unavailable", canonicalId: null, grantsEntitlement: false });
  });

  it("rejects conflicting identity mappings, alias chains and unknown inclusion targets", () => {
    const invalid = [
      [{ alias: "test.alias", includedItemId: "does-not-exist" }],
      [{ alias: "test.alias", includedItemId: "base.antique" }],
      [{ alias: "child-mode", includedItemId: "planetka" }],
      [{ alias: "antique", includedItemId: "nasa-blue-marble" }],
      [{ alias: "test.alias", includedItemId: "child-mode" }, { alias: "test.alias", includedItemId: "planetka" }],
      [{ alias: "test.alias", includedItemId: "child-mode" }, { alias: "test.alias", includedItemId: "child-mode" }],
      [{ alias: "test.first", includedItemId: "child-mode" }, { alias: "test.second", includedItemId: "test.first" }],
      [{ alias: "", includedItemId: "child-mode" }],
      [{ alias: "test.alias", includedItemId: "child-mode", grantsEntitlement: true }],
    ];
    for (const aliases of invalid) expect(() => createBaseEditionPolicy(aliases as never)).toThrow();
  });

  it("fails closed on malformed SKU mappings instead of interpreting authority or price claims", () => {
    const valid = mapping("original.background.unconfigured");
    let getterReads = 0;
    const accessor = Object.defineProperty({ ...valid }, "itemId", { enumerable: true,
      get() { getterReads++; return "child-mode"; } });
    for (const malformed of [null, [], "test", {}, { ...valid, itemId: "" }, { ...valid, sku: "" },
      { ...valid, platform: "unknown-store" }, { ...valid, sku: 1 }, { ...valid, price: "0.00" },
      { ...valid, authority: "trusted" }, { ...valid, grantsEntitlement: true }, { ...valid, entitlement: "active" },
      { ...valid, platformProducts: { web: "other-sku" } }, accessor, Object.create(valid),
      { ...valid, [Symbol("authority")]: true }]) {
      expect(baseEditionPolicy.validateOptionalSkuMapping(malformed)).toEqual({ allowed: false,
        reason: "invalid-sku-mapping", canonicalId: null, grantsEntitlement: false });
    }
    expect(getterReads).toBe(0);
    for (const value of [null, undefined, {}, [], 1, "", " child-mode", "child-mode "]) {
      expect(baseEditionPolicy.classify(value)).toEqual({ included: false, canonicalId: null,
        reason: "invalid-item-id", iapSkuAllowed: false, grantsEntitlement: false });
    }
  });

  it("never authorizes an unknown optional item on any platform even with a well-formed SKU", () => {
    for (const platform of ["web-pwa", "android-google", "android-rustore", "ios-ipados"]) {
      expect(baseEditionPolicy.validateOptionalSkuMapping(mapping("original.background.future-library", platform)))
        .toEqual({ allowed: false, reason: "optional-authority-unavailable", canonicalId: null, grantsEntitlement: false });
    }
  });

  it("exposes stable deeply immutable policy facts while leaving purchase and release authority absent", () => {
    const snapshot = baseEditionPolicy.getSnapshot();
    expect(baseEditionPolicy.getSnapshot()).toBe(snapshot);
    expect(snapshot).toMatchObject({ profileId: "SAFE_PAID_BILINGUAL_V1", distributionModel: "PAID_UPFRONT_WITH_OPTIONAL_NON_CONSUMABLES",
      requiredLocales: ["ru", "en"], grantsEntitlement: false, releaseReady: false });
    expectFrozen(snapshot); expectFrozen(baseEditionPolicy.classify("child-mode"));
    expectFrozen(baseEditionPolicy.validateOptionalSkuMapping(mapping("child-mode")));
    expect(() => Object.assign(snapshot.starterItems[0], { iapSkuAllowed: true })).toThrow();
    expect(baseEditionPolicy.classify("child-mode").iapSkuAllowed).toBe(false);
  });
});
