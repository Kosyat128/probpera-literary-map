# S13 included library and stand surface realism

This bounded slice addresses visible material defects in the included library and
stands: wood grain direction and end grain, paired brass oxidation/roughness/metallic
response, quieter irregular reflection and restrained leather detail. Geometry/maps
are authored in the project; no external imagery, licenses, scene controls, common
lights or composition authority are added. Procedural provenance is not formal
rights, editorial, child, lightmap or final art approval.

The coordinating owner inspects current actual-App views and close-ups of the
library and all three included stands. Source-bound captures and technical passes
do not establish that the user's realistic-quality requirement is satisfied.
`visual-review.json` must explicitly retain `artAccepted: false`. Remaining visible
issues from that review determine the next bounded improvement, rather than
skipping onward solely because catalog or mesh counts pass.

## Current and historical evidence

The previous checkpoint is `47228eb3407d87401ab34293284707fdf137c0c5`, with density
source `f0a275abfbdec4e2afaa36fe3ab8ce061d86f7e4`. `entry.previousDensity` points to
`library-density-20260919/result.json`; `entry.previousArt` points to its visual
review. Previous craft/stand/library hashes and imagery remain historical, since
these surfaces intentionally change. They are not asserted unchanged.

Seven composition core inputs must still match the prior recorded hashes. The
economical `globeLibraryBookGeometry.ts` helper must also match the density review.
The reviewed library layout remains 16 bays, 8 rows per bay and 8 nominal slots per
row; horizontal stacks replace some upright slots. Current actual-App observations
must preserve the previous 984 actual books and placement fingerprint at high,
balanced and economy. Instance colour is compared across current tiers, not pinned
to the previous material review.

The new visual review must include current source hashes for at least these five
runtime files: `globeCraftMaterials.ts`, `globeStandGeometry.ts`,
`globeTurnedWoodAtlas.ts`, `globeLibraryGeometry.ts` and `globeLibraryBookGeometry.ts`.
Other scene, capture and browser dependencies remain in its full source inventory.
It retains the browser's `actualAppObservations` containing `high`, `tiers`,
`english`, `narrow` and `restored` views. These provide the density comparison;
`standViews` remain part of the owner's visual evidence. A fresh
`starter-set-source-inventory.json` is mandatory and must remain 11/29 source-bound,
zero accepted, with current source hashes. It is also linked from S12 without
changing acceptance status.

## Checkpoint contract

`checkpoint.mjs` takes four explicit arguments: final source SHA, unit attempt,
static attempt and browser attempt. Counts come from those final reports; no old
fixed pass count is reused. It requires passing executions, unchanged current
source hashes, zero failed/skipped/flaky tests, current visual review, inventory,
and matching PWA/Android builds. The new wood-atlas helper is a required source
input in checks, visual review and build manifests.

All evidence, preserved source hashes, stage statuses, decisions and destination
notes are preflighted before writing result/state/notes. Existing result or note
markers prevent accidental duplicate checkpointing. Only the coordinating owner
executes this script after the source is frozen, reviewed, tested and committed.
Preparing it does not itself update global documents or establish a green result.

The owner maintains entry, runners, capture/browser evidence and inventory. Local
artifacts and QA authority use the separate `s13-sr` subtree. Prior density PWA
`2ad37f157df8ddf1b2fa937df72fb3ab8224c02c021a320603667365a6bde875` and Android
`bc593569f6d9b37ee86a7f94525c304504ef75d0807c2aaf4dc9962eaa271868` stay preserved.
Existing build helpers verify prior recorded manifests/APK without repeating the
whole old runtime-payload audit, and fully verify newly copied bytes.

S13.CUSTOM-001/003/006/007 remain IN_PROGRESS. Counts stay 3 complete / 11 in progress /
27 unstarted, with S03 first open. Full catalog/Background Studio, accessory/audio/
child composition, final realistic art/certified lightmaps, rights/entitlements,
installed-device performance, iOS and release gates remain open. There is no
deployment, installation, store submission or release in these helpers.

## Proposed D136 — coordinating owner appends separately

- D136: Refine original material surfaces in the included library and stands while
  retaining the inspected library density, economical book geometry and existing
  composition owners. Pair brass oxidation with colour/roughness/metallic response;
  correct wood mapping and improve restrained leather detail without changing
  shared lighting or downloading assets. Current actual-App and close-up views
  bind the scoped assessment to source. Further work follows remaining visible
  defects; technical passes and authored provenance do not establish the user's
  final realistic-quality requirement, certified lightmaps or device acceptance.

The checkpoint does not append D136 and rejects duplicate D136 entries. Final
visual judgments and the next-action wording remain subject to owner review.
