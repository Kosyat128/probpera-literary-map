import { DEFAULT_GLOBE_EDITION_ID, GLOBE_EDITIONS, editionIdForLegacySurfaceProfile, type GlobeEditionId } from "./editions";

// Pinned V12 starter requirements, not a second asset catalog. Titles, textures,
// rights evidence and readiness remain with their existing canonical owners.
const STARTER_ROWS = [
  ["STARTER-001", "skin", "skin.base.antique"],
  ["STARTER-002", "skin", "skin.base.modern"],
  ["STARTER-003", "skin", "skin.base.earth"],
  ["STARTER-004", "skin", "skin.base.child-educational"],
  ["STARTER-005", "skin", "skin.base.planetka-cheerful"],
  ["STARTER-006", "stand", "stand.base.museum"],
  ["STARTER-007", "stand", "stand.base.wood"],
  ["STARTER-008", "stand", "stand.base.book-stack"],
  ["STARTER-009", "stand", "stand.base.child-book-cloud"],
  ["STARTER-010", "background", "background.base.site-starfield"],
  ["STARTER-011", "background", "background.base.library"],
  ["STARTER-012", "background", "background.base.writer-study"],
  ["STARTER-013", "background", "background.base.child-room"],
  ["STARTER-014", "background", "background.base.story-forest"],
  ["STARTER-015", "accessory", "accessory.base.quill"],
  ["STARTER-016", "accessory", "accessory.base.backpack"],
  ["STARTER-017", "accessory", "accessory.base.star-scarf"],
  ["STARTER-018", "accessory", "accessory.base.book-badge"],
  ["STARTER-019", "core", "canonical-globe"],
  ["STARTER-020", "core", "literary-archive"],
  ["STARTER-021", "core", "search-favorites-offline"],
  ["STARTER-022", "child", "child-mode"],
  ["STARTER-023", "child", "planetka"],
  ["STARTER-024", "world", "world.planetka"],
  ["STARTER-025", "world", "world.russian-folklore"],
  ["STARTER-026", "world", "world.pushkin"],
  ["STARTER-027", "world", "world.andersen"],
  ["STARTER-028", "world", "world.alice-literary"],
  ["STARTER-029", "world", "world.oz-literary"],
] as const;
export type BaseEditionStarterItemId = (typeof STARTER_ROWS)[number][2];
export type BaseEditionStarterCategory = (typeof STARTER_ROWS)[number][1];
export interface BaseEditionStarterItem {
  readonly requirementId: (typeof STARTER_ROWS)[number][0];
  readonly id: BaseEditionStarterItemId;
  readonly category: BaseEditionStarterCategory;
  readonly commercialAvailability: "included-in-base";
  readonly iapSkuAllowed: false;
}
export const BASE_EDITION_STARTER_ITEMS: readonly BaseEditionStarterItem[] = Object.freeze(STARTER_ROWS.map(([requirementId, category, id]) =>
  Object.freeze({ requirementId, category, id, commercialAvailability: "included-in-base" as const, iapSkuAllowed: false as const })));

// These nine editions were visitor-available in the canonical site registry at
// the V12 policy checkpoint. Later hiding an edition must not make it optional.
const GRANDFATHERED_MINIMUM = ["behaim-1492", "hondius-1615", "coronelli-1697", "scherer-1700", "cassini-1790",
  "rand-mcnally-1887", "us-army-general-reference-1943", "nasa-blue-marble", "natural-earth-2026"] as const satisfies readonly GlobeEditionId[];
const PLATFORMS = ["web-pwa", "android-google", "android-rustore", "ios-ipados"] as const;
export type BaseEditionPlatform = (typeof PLATFORMS)[number];
export interface BaseEditionAlias { readonly alias: string; readonly includedItemId: string }
export interface BaseEditionPolicySnapshot {
  readonly profileId: "SAFE_PAID_BILINGUAL_V1";
  readonly distributionModel: "PAID_UPFRONT_WITH_OPTIONAL_NON_CONSUMABLES";
  readonly requiredLocales: readonly ["ru", "en"];
  readonly starterItems: readonly BaseEditionStarterItem[];
  readonly grandfatheredEditionIds: readonly GlobeEditionId[];
  readonly defaultEditionId: GlobeEditionId;
  readonly skinEditionBindings: readonly Readonly<{ itemId: BaseEditionStarterItemId; editionId: GlobeEditionId }>[];
  readonly grantsEntitlement: false;
  readonly releaseReady: false;
}
export interface BaseEditionClassification {
  readonly included: boolean;
  readonly canonicalId: string | null;
  readonly reason: "included-in-base" | "optional-authority-unavailable" | "invalid-item-id";
  readonly iapSkuAllowed: false;
  readonly grantsEntitlement: false;
}
export interface OptionalSkuMappingDecision {
  readonly allowed: false;
  readonly canonicalId: string | null;
  readonly reason: "included-in-base" | "optional-authority-unavailable" | "invalid-sku-mapping";
  readonly grantsEntitlement: false;
}
export interface BaseEditionPolicy {
  getSnapshot(): BaseEditionPolicySnapshot;
  classify(itemId: unknown): BaseEditionClassification;
  /** A narrow inclusion guard, not the schema45 StoreProduct parser or a
   * purchase/rights decision. Exact request: { itemId, sku, platform }. */
  validateOptionalSkuMapping(input: unknown): OptionalSkuMappingDecision;
}
const itemId = (value: unknown): value is string => typeof value === "string" && value.length <= 160
  && /^[a-z0-9][a-z0-9._-]*$/u.test(value);
const skuId = (value: unknown): value is string => typeof value === "string" && value.length <= 200
  && /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value);
function exactRecord(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return false;
  const ownKeys = Reflect.ownKeys(value);
  return ownKeys.length === keys.length && keys.every(key => Object.prototype.hasOwnProperty.call(value, key)
    && Object.prototype.hasOwnProperty.call(Object.getOwnPropertyDescriptor(value, key), "value"));
}
function fail(reason: string): never { throw new Error(reason); }

/** Trusted local inclusion aliases can only strengthen existing protection.
 * No caller-supplied flag, optional candidate, unknown item or SKU grants a
 * purchase right; independent optional-product authority does not exist yet. */
export function createBaseEditionPolicy(aliases: readonly BaseEditionAlias[] = []): BaseEditionPolicy {
  if (!Array.isArray(aliases) || aliases.length > 128) fail("invalid-base-edition-aliases");
  const registryIds = new Set<string>();
  for (const edition of GLOBE_EDITIONS) {
    if (!itemId(edition.id) || registryIds.has(edition.id) || typeof edition.visitorAvailable !== "boolean") fail("invalid-base-edition-registry");
    registryIds.add(edition.id);
  }
  if (GRANDFATHERED_MINIMUM.some(id => !registryIds.has(id))) fail("missing-grandfathered-edition");
  const grandfatheredEditionIds = Object.freeze([...new Set<GlobeEditionId>([...GRANDFATHERED_MINIMUM,
    ...GLOBE_EDITIONS.filter(edition => edition.visitorAvailable).map(edition => edition.id)])]);
  const skinEditionBindings = Object.freeze([
    { itemId: "skin.base.antique" as const, editionId: DEFAULT_GLOBE_EDITION_ID },
    { itemId: "skin.base.modern" as const, editionId: editionIdForLegacySurfaceProfile("modern") },
    { itemId: "skin.base.earth" as const, editionId: editionIdForLegacySurfaceProfile("earth") },
  ].map(binding => {
    if (!grandfatheredEditionIds.includes(binding.editionId)) fail("invalid-starter-edition-binding");
    return Object.freeze(binding);
  }));
  const canonicalIds = new Set<string>([...BASE_EDITION_STARTER_ITEMS.map(item => item.id), ...grandfatheredEditionIds]);
  if (canonicalIds.size !== BASE_EDITION_STARTER_ITEMS.length + grandfatheredEditionIds.length) fail("conflicting-base-edition-identity");
  const resolved = new Map([...canonicalIds].map(id => [id, id]));
  const addAlias = (alias: string, includedItemId: string) => {
    if (!itemId(alias) || !itemId(includedItemId)) fail("invalid-base-edition-alias");
    if (!canonicalIds.has(includedItemId)) fail("unknown-base-edition-alias-target");
    const previous = resolved.get(alias);
    if (previous !== undefined) fail(previous === includedItemId ? "duplicate-base-edition-alias" : "conflicting-base-edition-alias");
    resolved.set(alias, includedItemId);
  };
  // Alternate IDs in the binding prose are aliases of the CSV requirements,
  // not additional deliverables or permission to create a second paid item.
  for (const item of BASE_EDITION_STARTER_ITEMS) {
    if (item.id.includes(".base.")) {
      const suffix = item.id.split(".base.")[1];
      addAlias(item.category === "skin" ? `base.${suffix}` : `base.${item.category}.${suffix}`, item.id);
    } else if (item.category === "world") addAlias(`base.${item.id}`, item.id);
  }
  addAlias("base.background.child-reading-room", "background.base.child-room");
  addAlias("base.world.pushkin-tales", "world.pushkin");
  for (const profile of ["antique", "modern", "earth"] as const) addAlias(profile, editionIdForLegacySurfaceProfile(profile));
  for (const binding of aliases) {
    try {
      if (!exactRecord(binding, ["alias", "includedItemId"])) fail("invalid-base-edition-alias");
      if (!itemId(binding.alias) || !itemId(binding.includedItemId)) fail("invalid-base-edition-alias");
      addAlias(binding.alias, binding.includedItemId);
    } catch (error) {
      if (error instanceof Error && /^(?:invalid|unknown|duplicate|conflicting)-base-edition-alias(?:-target)?$/u.test(error.message)) throw error;
      fail("invalid-base-edition-alias");
    }
  }
  const snapshot: BaseEditionPolicySnapshot = Object.freeze({ profileId: "SAFE_PAID_BILINGUAL_V1",
    distributionModel: "PAID_UPFRONT_WITH_OPTIONAL_NON_CONSUMABLES", requiredLocales: Object.freeze(["ru", "en"] as const),
    starterItems: BASE_EDITION_STARTER_ITEMS, grandfatheredEditionIds, defaultEditionId: DEFAULT_GLOBE_EDITION_ID,
    skinEditionBindings, grantsEntitlement: false, releaseReady: false });
  const classify = (value: unknown): BaseEditionClassification => {
    const valid = itemId(value), canonicalId = valid ? resolved.get(value) ?? null : null;
    return Object.freeze({ included: canonicalId !== null, canonicalId,
      reason: !valid ? "invalid-item-id" : canonicalId ? "included-in-base" : "optional-authority-unavailable",
      iapSkuAllowed: false, grantsEntitlement: false });
  };
  return Object.freeze({ getSnapshot: () => snapshot, classify,
    validateOptionalSkuMapping(input: unknown): OptionalSkuMappingDecision {
      const decision = (reason: OptionalSkuMappingDecision["reason"], canonicalId: string | null = null): OptionalSkuMappingDecision =>
        Object.freeze({ allowed: false, canonicalId, reason, grantsEntitlement: false });
      try {
        if (!exactRecord(input, ["itemId", "sku", "platform"]) || !itemId(input.itemId) || !skuId(input.sku)
          || !PLATFORMS.includes(input.platform as BaseEditionPlatform)) return decision("invalid-sku-mapping");
        const classification = classify(input.itemId);
        return decision(classification.included ? "included-in-base" : "optional-authority-unavailable", classification.canonicalId);
      } catch { return decision("invalid-sku-mapping"); }
    },
  });
}

// Explicit owner request: the existing site's three-whale support becomes a
// selectable derivative of canonical-globe. The 29 Starter Set rows stay fixed.
export const baseEditionPolicy = createBaseEditionPolicy([
  { alias: "stand.base.three-whales", includedItemId: "canonical-globe" },
]);
