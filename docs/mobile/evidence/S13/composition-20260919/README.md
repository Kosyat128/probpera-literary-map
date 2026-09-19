# S13 included composition transaction

This slice coordinates the existing adult edition, stand and background through
one bounded JSON preference, `probpera-planet-composition-v1`. Version 1 contains
`schemaVersion`, `commitId` and the exact `selection` fields `editionId`, `standId`
and `backgroundId`. Current bundled IDs and whole-selection compatibility remain
the authority. Accessories, audio, optional entitlements and child-reviewed
compositions are not added or inferred.

The existing scene owns the renderer and camera. Part readiness alone cannot
commit a selection: all three parts and the current texture upload must agree in
one actual rendered frame. Preview/Apply stays explicit for stand/background;
the edition rail keeps its immediate transaction. Cancel, failed preparation
and lifecycle interruption return the whole applied selection. The applied atlas
source remains retained so rollback can repaint the original map canvas without
a new, potentially failing network request.

The new record is read first. Only confirmed absence permits read-only migration
from the earlier edition/style, stand and background keys. Malformed data,
unavailable storage and timeout never authorize fallback. The migrated selection
is saved only after the combined frame. The native WebView fallback is consulted
only after both platform edition keys are absent. Explicit intent fences delayed
hydration and frame receipts.

One queue serializes the whole preference record across controller remounts.
A timeout bounds confirmation, not the underlying native mutation: started
writes retain the queue until they settle. Save failure keeps the rendered
session selection with a truthful retry action. Best-effort port acceptance is
not crash-safe storage durability. This bounded local record does not complete
the full document-17 accessory/audio/child composition model.

The user's realism requirement and the detailed library/stand models are
preserved. The preceding library checkpoint retains visual inspection and the
Starter Set inventory: 11 source-bound items of 29, zero fully accepted. This
engine change does not reopen unchanged art tests or grant art/lightmap approval.
The checkpoint verifies that the three geometry/material sources still match
the previous visual evidence; it does not treat old App hashes as current.
If the coordinating owner supplies `starter-set-source-inventory.json` with the
updated composition source bindings, the checkpoint validates its current source
hashes and unchanged 11/29/0 counts, uses that reference and adds it to S12's
artifacts. Otherwise the prior inventory remains explicitly historical.

## Evidence and build helpers

`entry.json`, `run-checks.mjs` and the source-browser configuration are maintained
by their assigned owners. Final unit, static and actual Chrome reports must pass
against the final frozen source. Do not reuse an older report after source edits.
`checkpoint.mjs` takes the source SHA and three explicit attempt IDs in order:
unit, static, browser. It derives truthful passed counts from those reports,
requires zero failures/skips/flakiness, and revalidates their source hashes.

After testing and the final source commit, `run-pwa.mjs` builds the local QA PWA,
runs strict artifact inspection and the existing installed offline shell check,
then preserves and verifies every copied byte. Its `pwa.config.mjs` is separate
from the source-browser configuration. `build-android.ps1` compiles the Android
devDebug artifact offline and calls `verify-android.mjs` to inspect the real APK.
`preserve-android.mjs` makes and checks the complete new runtime/APK copy. None of
these helpers deploys, installs, submits or releases an application.

New large artifacts and temporary files use the existing D-volume visualization
root under `s13-cp`. The previous PWA
`14df8b63640d370d070bb0e2a41e2a60893cee494e8b26fcb5fc4f2fd9687b52`
and Android
`fe8acc9f96f3c5295a1d3288f702d2801d7a4a8ccac43f2e2918072346332b44`
remain preserved under `s13-lb`. Helpers verify those prior manifests/APK and
recorded exact-copy evidence without repeating whole old runtime-payload hashes.
Each new artifact is fully checked. Existing attempt/output directories cause a
safe stop rather than an overwrite.

Only the coordinating owner runs the helpers and final checkpoint. Before that
execution, this folder's scripts are prepared work, not green build evidence.
The checkpoint requires both new preserved builds to match the final source SHA;
it updates only existing S13 criteria as IN_PROGRESS. Stage counts remain
3 complete, 11 in progress and 27 unstarted, with S03 first open. Full catalog,
Background Studio, formal art/lightmaps, rights/entitlements, installed-device
performance/soak, iOS and release acceptance remain separate open gates.

## Proposed D133 — owner appends separately

- D133: The adult included edition, stand and background use one bounded,
  versioned local composition record and the existing renderer/camera. Exact
  part readiness and texture upload must agree in one actual scene frame before
  commit. The applied atlas source is retained for network-independent repaint
  rollback. Confirmed absence alone permits migration from unchanged legacy
  keys; unknown, malformed or timed-out new storage does not. Whole-record writes
  remain serialized across timeouts and remounts. A confirmed best-effort write
  is not crash-safe durability. This scope preserves the detailed art and does
  not grant optional/accessory/audio/child authority or full S13 acceptance.

`checkpoint.mjs` never appends D133 and rejects duplicate D133 entries.
