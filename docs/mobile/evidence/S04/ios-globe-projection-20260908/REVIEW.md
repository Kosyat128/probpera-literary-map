# Validated local iOS simulator source projection — a5

Frozen source: 8a3ef924aa911aeda4742b4434ac925ac576764e
Only allowed public parent: 325e9f3c0daef6600c1a96e5af76c9f9d2f857c4
Base public tree: 0ba8e8d71236a2299607cab27617b517691e1db0
Expected candidate tree (computed locally; no Git object created): 58ea6814d6d6abe49a0f57ed7f3b00f867d35ab1
Exact payload SHA256: 5d3e521294ae46f827ecd974525136462c104d54bee03448bac0ec7a21531741

The reviewed delta contains 83 source/config files: 51 modifications and 32 additions. Candidate directory: ../candidate-a5, with 4360 exact public-parent/overlay files and all retained public src/tests. It contains no .git or private history. Public docs/reports are omitted from disk except one exact unchanged public report imported by an existing baseline test; that report is absent from the publication delta.

Local validation:
- Candidate-wide TypeScript PASS: corrected attempt 2, 19.967 seconds. The first failure remains in candidate-tsc-attempt1.*.
- Actual descriptor hashes and public Git blob identities PASS for all 285 assets. No asset repinning during validation.
- All 848 frozen input files and all 83 overlay files still match after validation. Root advanced to 585e479f482bb2c574dc266883766df4461feed8 only for docs/mobile state and Android evidence; frozen source stays unchanged.
- Workflow differs by exactly one line: src/App.tsx in the existing narrow push paths.
- Existing node_modules is reused through a workspace junction. No dependency installation, mutation, or app build was run.

The first TypeScript check exposed an ambient declaration omitted by the import graph and a public report omitted by the sparse disk projection. The correction adds exact public-main src/articles/hyphen.d.ts (217 bytes) as the 83rd delta file. The public report is a disk exception only. No private data or modified baseline test was substituted.

Authorization classification:
- changed-path-inside-recorded-74: 18
- exact-already-public-main-bytes: 49
- unpublished-current-bytes-outside-recorded-74: 16

Unpublished current bytes outside the exact recorded 74-file list:
- src/atlas/useAtlasExperience.ts
- src/components/AtlasExperienceChrome.tsx
- src/components/BookCoverArtwork.tsx
- src/components/BookShelfControls.tsx
- src/host/hostInert.ts
- src/host/NativeNavigation.ts
- src/host/NativeNavigationBridge.ts
- src/host/nativeNavigationTarget.ts
- src/host/NativePlanetLaunch.tsx
- src/host/NativePlanetPanel.tsx
- src/host/planetLaunch.css
- src/host/ProductNoticeHost.tsx
- src/host/useNativeNavigation.ts
- src/loading/DeferredHomepageArchives.tsx
- src/utils/imageDelivery.ts
- src/utils/imageDeliveryControlled.ts

Existing authorization remains in force for its reviewed scope. These 16 unpublished files are surfaced for coverage review before any public Git blob/tree/commit/ref write. This task performed no publication question or remote mutation.

Review authority:
- payload.json: exact base64, SHA256, Git blob IDs and public parent.
- review.json: corrected classification, actual local validation and limitations.
- source.diff: readable line diff. Exact bytes are authoritative in payload.json; the parent may use CRLF, projected source uses LF.
- source-snapshot.json: exact input hashes and frozen source commit identities.
- candidate-tsc.json and candidate-assets.json: actual local validation evidence.
- intended-tree.json: only 83 reviewed paths applied to the exact public base_tree.
- overlay/ and before/: candidate source and exact changed-existing public-parent bytes.

The previous 82-file payload/tree is superseded and retained in *.before-ambient-fix. Initial preparation and materialization scripts plus correct-a5-ambient-projection.mjs record the exact correction sequence.

No Git objects, commits, refs, pushes, dispatches, store actions, deployments or root source changes were made by this task. A fresh native build and actual current-globe RU/EN iOS simulator screenshots remain required. releaseReady=false.
