# SKINS, STANDS, ACCESSORIES AND COMPOSITION ENGINE — V12 BINDING CONTRACT

## 1. Главный инвариант

Все оформления применяются к одному существующему globe runtime сайта.
Смена skin, stand, background или accessory не создаёт второй Canvas, не
сбрасывает camera, selected country/writer, mode, journey или child profile.

## 2. Composition model

```ts
type ActiveComposition = {
  globeEditionId: string;
  globeSkinId: string;
  standId: string;
  backgroundId: string;
  accessoryIds: string[];
  lightingPresetId: string;
  audioPresetId?: string;
  qualityTier: "high" | "balanced" | "economy";
};
```

Separate concepts:

- catalog visibility;
- included/owned entitlement;
- downloaded;
- installed;
- compatible;
- previewed;
- active.

## 3. Skin categories

Included:

- all canonical existing production-ready globe editions;
- modern atlas;
- physical Earth;
- child educational globe;
- cheerful Planetka.

Optional candidates:

- parchment;
- bronze;
- wood;
- porcelain;
- glass;
- night lights;
- constellations;
- mythology;
- literary epochs;
- travel map;
- ocean animals;
- puzzle;
- watercolor;
- clay;
- knitted;
- pixel;
- neon;
- winter/new-year/seasonal;
- humorous original skins.

A skin may alter material/surface presentation but cannot alter canonical
coordinates/picking. Fictional decorations are separate overlays/layers.

## 4. Stand categories

- museum/classic;
- wood;
- bronze;
- gold;
- marble;
- stack of books;
- open book;
- quill and inkwell;
- cloud;
- puzzle;
- rocket;
- story tree;
- observatory base;
- seasonal originals.

Stand requirements:

- own mesh/material/LOD;
- no picking interference;
- no clipping mascot;
- camera-safe bounds;
- portrait/landscape/tablet;
- high/balanced/economy;
- explicit disposal;
- checksum/provenance;
- accessibility-hidden if decorative.

## 5. Accessories

Original Planetka accessories only unless licensed:

- quill badge;
- traveler backpack;
- star scarf;
- book badge;
- explorer cap;
- winter scarf;
- telescope;
- magnifying glass;
- small reading lantern.

No accessory imitates protected character/costume without rights.

## 6. Compatibility graph

Each item declares:

- supported globe editions;
- mascot/explore compatibility;
- allowed stands/backgrounds/accessories;
- childSafe and age range;
- platform/device tier;
- memory/GPU budget;
- rights/territories;
- fallback;
- minimum app/content version.

Admin validates conflicts before publication. Runtime fail-closed and
keeps previous valid composition.

## 7. Transactional preview/apply

```text
snapshot current composition
→ policy/rights/entitlement check
→ compatibility and memory check
→ preload minimal suitable assets
→ checksum/signature verify
→ shader/material warm-up
→ temporary preview on same runtime
→ user rotate/inspect
→ apply only if included/owned+installed
→ persist atomically
→ release old resources
```

Close/error/timeout restores exact snapshot. Rapid A→B→C commits only C.
Preview never grants entitlement and never starts checkout automatically.

## 8. Download and update

- versioned asset packages;
- CDN/object storage;
- checksums/signatures;
- resumable download;
- free-space check;
- delta/full update where safe;
- rollback asset;
- last-known-good version;
- remove optional assets without losing entitlement;
- re-download;
- Wi-Fi-only setting;
- license expiry handling.

## 9. Performance

- bounded LRU cache;
- no mass preload of catalog;
- explicit dispose textures/materials/geometries/render targets;
- GPU budget per tier;
- decode concurrency limit;
- pause preload during gesture/camera flight;
- memory-pressure eviction;
- static/economy fallback;
- 30+ switch stress test;
- context-loss recovery.

## 10. Commerce

Starter Set items have `included-in-base`, no IAP SKU. Optional items are
non-consumable. Child UI shows only included/owned safe items and no price.
Licensed items hidden until rights pass.

## 11. Admin self-service

Owner can:

- create item/bundle;
- upload preview and tiers;
- set compatibility;
- set included vs optional;
- map platform SKUs;
- set rights/territory/term;
- set child age policy;
- preview combinations;
- publish/unpublish/rollback;
- inspect package size/performance;
- trigger asset audit.

## 12. Acceptance

- one runtime;
- exact state preservation;
- no black flash;
- latest-wins;
- rollback on failure;
- no GPU leak;
- included Starter Set complete;
- child/rights gates;
- offline re-use;
- owner can add new items without runtime code.
