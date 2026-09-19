# S13 included adult stands

Three original procedural models use the existing globe scene: museum, wood and
an unlettered stack of books. `canonical` remains the existing edition-specific
frame and is not relabelled as a newly completed Starter Set item. The public
website keeps its existing frame and controls.

The app owns the stand draft. A native select previews a model without trapping
focus or blocking globe rotation. Apply becomes available after a real renderer
frame. Cancel, Escape, native Back, background and another app surface discard
the draft. Background also suspends untouched preference restoration so a late
read cannot replace an explicit choice or lose a saved choice on resume.

Apply commits the session choice. Writes remain ordered even after their
confirmation deadline. Failed confirmation keeps that applied stand and offers
RU/EN retry. This is not a full composition persist-or-rollback transaction.

Each model owns its geometry and materials. Compilation uses the existing
renderer, camera and scene lights. The renderer retains the applied baseline
and latest draft, releasing superseded resources. Decorative meshes cannot
intercept country picking. Actual transformed vertices stay inside the reserved
stand volume and quality tiers reduce geometry buffers.

`run-checks.mjs` preserves each unit, static or browser attempt under a new
directory and records the bytes relevant to that command. Unit checks cover
controller races, geometry ownership and preference adapters; three actual
Chrome cases cover scene continuity, cancellation, persistence and RU/EN mobile
controls. Browser OS ports are controlled; the app, renderer and CSS are real.

Final accepted attempt references and source commit belong in `result.json`.
Failed attempts remain available. PWA and Android helpers build and preserve a
single accumulated batch, including the preceding antique quality geometry.
The APK inspection does not establish installed-device execution. Previous
edition-preference artifacts remain preserved at their recorded D: paths.

The Starter Set audit records these three source bindings with acceptance still
open. Original source provenance is not legal/editorial approval, child review,
an entitlement, a release decision, or evidence for the rest of the stand catalog.
S13 stays in progress and S03 remains the first open stage.

Home-view inspection caught the existing control rail covering the new stand
bases. A narrow app-only layout adjustment clears that volume without moving
the camera. Visual a2 establishes the three desktop models and books at 390 px;
a3 checks the last max-width-380 adjustment on museum at 320 px. The final review
records that media-query scope, exact source hashes, control bounds and remaining
gaps. This is measured Home-view evidence, not all-camera/all-device acceptance.
