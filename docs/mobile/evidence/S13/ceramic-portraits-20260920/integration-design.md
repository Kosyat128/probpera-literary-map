# Ceramic portrait stands: bounded integration design

Design reviewed before promotion. The five-file integration patch was promoted after whale checkpoint `fd0ec64ddcd1e1ae1b74d438a5b9bf6bb1348dfe`; the new portrait geometry is under active visual revision. Local implementation inclusion supplies no art, rights, child, store, entitlement, or release approval.

## Exact identities and policy

Add exactly these explicit owner-requested, bundled adult items:

| ID | RU draft label | EN draft label | Canonical policy identity |
| --- | --- | --- | --- |
| `stand.base.portrait-pushkin` | Александр Пушкин | Alexander Pushkin | same ID |
| `stand.base.portrait-hemingway` | Эрнест Хемингуэй | Ernest Hemingway | same ID |
| `stand.base.portrait-tolstoy` | Лев Толстой | Leo Tolstoy | same ID |

These are new authored ceramic portrait models, not derivatives of the site's canonical globe. Do not alias them to `canonical-globe`, the existing museum stand, a writer record, or a protected portrait source. Labels identify the requested subjects; they do not certify portrait likeness or art review.

Minimal extension in `src/planet/baseEditionPolicy.ts`:

1. Keep `STARTER_ROWS`, `BaseEditionStarterItemId`, `BaseEditionStarterCategory`, and `BASE_EDITION_STARTER_ITEMS` exactly as they are. The pinned CSV and all 29 `STARTER-*` identities remain unchanged.
2. Introduce a private fixed tuple of the three IDs above and an exported deeply frozen `OWNER_ADDED_BASE_ITEMS`. A separate `OwnerAddedBaseItemId` union derives from that tuple. Each descriptor has `id`, `category: "stand"`, `inclusionBasis: "explicit-owner-request"`, `commercialAvailability: "included-in-base"`, and `iapSkuAllowed: false`. It has no synthetic `requirementId`.
3. Add `readonly ownerAdditions: readonly OwnerAddedBaseItem[]` to `BaseEditionPolicySnapshot`; bind it to the frozen array. Existing `starterItems` remains 29, while `ownerAdditions` is exactly 3. Existing global `grantsEntitlement: false` and `releaseReady: false` remain unchanged.
4. Include the three fixed IDs in the private `canonicalIds` set and update its collision-count assertion to include their count. Retain syntactic validation and reject collisions before alias resolution. This makes `classify(id)` return `included: true`, `canonicalId: id`, `reason: "included-in-base"`, `iapSkuAllowed: false`, `grantsEntitlement: false`.
5. Preserve `createBaseEditionPolicy(aliases: readonly BaseEditionAlias[] = [])`. Do not add caller-supplied additions, prefixes, flags, optional authority, or public registration. Existing direct alias rules may target only the resulting exact canonical set; alias chains, overwrites, malformed bindings, and unknown targets still fail.
6. Preserve the singleton's existing explicit whale alias to `canonical-globe`. The portrait IDs are direct canonical entries in every policy instance, including the factory used by the starter audit.
7. Existing `validateOptionalSkuMapping` naturally denies each portrait SKU as `included-in-base` on all four platforms. No new SKU schema, entitlement, or purchase path is needed.

## Registry and rendering connection

`src/planet/globeStands.ts` already enforces two independent conditions: exact local descriptor membership and a policy canonical identity equal to `descriptor.sourceItemId`. Keep that behavior.

Export an exact `CERAMIC_PORTRAIT_GLOBE_STAND_IDS` tuple and its `CeramicPortraitGlobeStandId` type, include it once in `INCLUDED_GLOBE_STAND_IDS`, and provide a narrow exact membership guard for the factory dispatcher. The portrait descriptors use:

- `sourceItemId: id`, `provenance: "authored-in-project"`, `canonicalSource: null`;
- `source: "src/components/globeCeramicPortraitStandGeometry.ts"`, confirmed by the geometry author;
- `contentVersion: 1`, `commercialAvailability: "included-in-base"`, `iapSkuAllowed: false`;
- `supportedAccess: "adult"`, `childReviewed: false`, `rightsReviewed: false`, `artReviewed: false`, `grantsEntitlement: false`, `releaseReady: false`.

`artReviewed: false` is a truthful additional descriptor flag, not a new source of approval. Do not derive any approval from completed local geometry or a screenshot.

In `src/components/globeStandGeometry.ts`, insert an explicit portrait guard/return before the existing museum/wood/book allocation path. The current final `else` builds books, so registry expansion without this branch would silently show the wrong model. The confirmed API is `createCeramicPortraitStand(kind: "pushkin" | "hemingway" | "tolstoy", quality)`, selected through an exact ID-to-kind object. The factory returns the existing structural `OwnedGlobeStand` contract (`group`, idempotent `dispose`), with group identity `included-globe-stand:${id}` and actual ID/quality/provenance metadata. It must not allocate the old craft palette or book geometry before dispatching. The geometry author owns the new factory and its physical bounds.

Add all three RU/EN entries to `planetStandCopy.locales.*.names` in `src/host/PlanetStandControls.tsx`. Options already come from `GLOBE_STAND_IDS`; keep the current selection, preview, Apply, Cancel, focus, and persistence UI.

No new coordinator or bridge is necessary:

- `GlobeIncludedStand.tsx` uses the existing factory and resource key `${id}:${quality}`, and acknowledges the actual rendered revision.
- `globeComposition.ts` validates stand IDs through `isGlobeStandId`; the existing schema-1 `{editionId, standId, backgroundId}` record remains unchanged.
- `globeBackgrounds.ts` references the current stand ID array and denies non-adult access. Portraits therefore retain both existing backgrounds and all currently compatible editions without adding child authority.
- Host and Web preference adapters already import `GLOBE_STAND_IDS` and the composition codec. Runtime adapter key/value logic needs no extension. The existing `probpera-planet-composition-v1` key stays authoritative; no additional portrait preference key or migration is introduced.
- App, Canvas, renderer, camera, locale, country selection, and established scene lifecycle need no structural change for adding these choices.

## Narrow verification after promotion

Do not run these while the preceding build is active. Reuse existing fixtures and central runner once source is promoted/frozen.

1. Add one focused policy/registry case covering the exact three self-canonical owner additions, deeply frozen snapshot, no synthetic requirement IDs, all approval flags false, rejection of near-spellings and unknown portrait IDs, and denial of all four platform SKUs. The separately pinned CSV test must still compare exactly 29 starter rows and the unchanged SHA.
2. Add one composition case iterating the three explicit portrait IDs: exact JSON round-trip with a non-default edition and library background, adult validity at all three quality tiers, rejection of child/blocked access and unknown portrait IDs. Do not duplicate coordinator timing tests; its API/state machine is unchanged.
3. Extend only the two existing exact adult stand preference round-trip case arrays in `HostPlatformServices.test.ts` and `WebPlatformAdapter.test.ts`. Their current filtered test names remain usable. Unknown values and arbitrary keys must remain denied.
4. Geometry tests must call the actual dispatcher at least once per portrait, so registry-to-factory routing is exercised. Use the author's actual envelope and closure/resource contract; do not force the old compact stand's `r <= .55` or whale envelope onto portraits. Keep the existing three-stand envelope test's explicit ID list unchanged.
5. One actual-scene browser flow should cover preview, Cancel, actual-frame Apply, shared composition restore, unchanged edition/background and one canvas. Geometry/visual likeness assessment is a separate evidence outcome, never inferred from policy membership.

## Audit and provenance boundary

`scripts/mobile/audit-starter-set.mjs` derives its inventory only from the immutable 29 CSV rows. Leave that obligation denominator intact. Do not attach portraits to `canonical-globe`'s existing source bindings to make them appear to satisfy `STARTER-019`.

The reviewed patch draft adds a separate `ownerAdditions` section and `ownerAddedCount: 3` with the three exact IDs and their own factory/registry/policy source hashes. It retains the existing required-row calculation: `requiredCount: 29`, `sourceBoundCount: 11`. The audit validates exact owner-list membership, self-canonical source identity, authored provenance, adult scope and false approval flags before reporting source presence. Do not claim earlier acceptance or edit `docs/mobile/requirements/v12/`. A missing completed portrait factory remains incomplete local implementation even when its policy schema is drafted.

## Promotion boundary

After the root accepted this direction, `integration.patch` was prepared under `.tmp/ceramic-portrait-stands/`, with original/next draft copies and a reproducible draft writer. Its five targets are policy, registry, dispatcher, RU/EN labels, and the separate owner-addition inventory in the audit. The draft was subsequently reviewed and promoted into the actual five targets after the completed whale checkpoint. Four focused new test cases and two existing adapter loops cover this integration. Draft preparation itself ran no checks/builds; subsequent attempts are recorded separately.
