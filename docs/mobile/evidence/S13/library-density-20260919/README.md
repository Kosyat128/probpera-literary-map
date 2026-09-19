# S13 library density across quality tiers

This slice preserves the included library's architecture and deterministic book
placement at reduced quality. The nominal layout remains 16 bays, 8 rows per bay
and 8 slots per row at every tier. Horizontal stacks can replace upright slots;
these dimensions do not claim 1,024 independent books. The actual placement count
must remain identical between tiers.

Lower tiers reduce the detail of each true-3D volume through economical compound
geometry instead of removing architecture or leaving shelves sparse. The library
geometry and its private book helper own this change. Stand geometry, shared craft
materials and the validated composition core remain unchanged. Existing scene,
camera, lighting, semantic selection and resource ownership remain authoritative.
No external images, flat scene substitutes or new catalog IDs are introduced.

The user's realistic-quality requirement still needs actual visual assessment.
The coordinator inspects current actual-App views and close-ups at all tiers;
technical success and mesh counts do not establish final art quality.
`visual-review.json` must report `pass: true`, `artAccepted: false` and exact
current `sourceInputs`, including `globeLibraryGeometry.ts` and the new
`globeLibraryBookGeometry.ts` when present. The checkpoint also includes any
other private `globeLibrary*.ts` implementation helper in that source boundary.
Capture output alone is not a completed visual review.

## Evidence and preserved sources

The coordinating owner maintains `entry.json`, check/capture runners, browser
configuration, tests, inventory and the final visual review. These helpers do not
run or overwrite them. The previous lighting/art result is preserved at source
`9b8952d73f664b16f78b045e5dfe53031711616e`. Its seven recorded composition core
hashes and its reviewed stand/craft hashes must still match the current files.
Older imagery remains historical evidence for that source; it does not prove the
new lower-tier density behavior.

`checkpoint.mjs` takes final source SHA, unit attempt, static attempt and browser
attempt as four explicit arguments. It derives passing counts from those final
reports, requires zero failures/skips/flakiness, validates every current source
hash and requires the new visual review plus two matching preserved builds.
An optional refreshed `starter-set-source-inventory.json` must validate current
bindings with 11/29 source-bound items and zero accepted items; otherwise the
previous inventory remains explicitly historical. New inventory is referenced
from S12 without changing its acceptance status.

## Local build helpers

After focused testing, TypeScript, visual review and final source commit,
`run-pwa.mjs` builds/audits the local QA PWA, runs the existing installed offline
shell check through its separate `pwa.config.mjs`, and verifies every preserved
copy. `build-android.ps1` compiles Android devDebug offline and invokes
`verify-android.mjs` for actual APK inspection. `preserve-android.mjs` copies and
fully verifies the new runtime/APK. Only the coordinating owner runs them.

New artifacts and QA control paths use the dedicated `s13-ld` subtree under the
existing D-volume visualization root. The prior `s13-ll` artifacts stay preserved:
PWA `3d84a3f602546075f7078f92a31d4b603e93ece4ccf346163e4d5d797b0a4496`
and Android `0de476d60baf9ed5ae3d24a323fff36750da87d152bce9effaff083589d3312a`.
Their manifests/APK and recorded exact-copy evidence are checked without repeating
whole old runtime-payload hashes. All new copied bytes are verified. Existing
attempt/output paths cause a safe stop rather than an overwrite.

Before owner execution, these scripts are prepared work, not green build evidence.
They do not deploy, install, submit or release the app. Existing S13 criteria stay
IN_PROGRESS; stages remain 3 complete / 11 in progress / 27 unstarted, first open
S03. Full catalog/Background Studio, accessory/audio/child composition, formal
art/certified lightmaps, rights, installed-device budgets, iOS and release remain
open. The next bounded scene or Starter Set task keeps the same realistic-quality
review requirement.

## Proposed D135 — owner appends separately

- D135: The included library retains its architecture and deterministic placement
  density across quality tiers. Lower tiers simplify each true-3D book assembly
  within resource budgets instead of removing rows or architecture. Stand/craft
  and composition sources retain their validated owners. Current actual-App and
  close-up tier views bind the review to source; equal counts and technical passes
  do not establish final realistic art, certified lightmaps or device acceptance.

The checkpoint never appends D135 and rejects duplicate D135 entries. Its final
status note and next action remain subject to the coordinating owner's review.
