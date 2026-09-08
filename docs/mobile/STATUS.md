# V12 status — 2026-09-08

The owner clarified that the live canonical Literary Planet is the ONLY
application home: orange launch -> globe reveal; all other functions are
controls/panels around it. No magazine homepage or intermediate menu.
See GLOBE_APPLICATION_CONTRACT.md. Original interactive 3D Planetka and scene
quality remain required, together with the rest of V12.

S00-S02 accepted. S03 remains first-open and IN_PROGRESS. S04/S05 are
IN_PROGRESS under documented parallel-safe entry. S06-S40 have not started.
No global requirement passed; releaseReady:false.

Current implementation: native entry reuses the canonical atlas as its root;
the public magazine page is not rendered. Search/country/writer remain on the
globe, collection/reading use a retained overlay. Locale and presentation
preserve the same scene. The collection uses its canonical catalog surface,
without creating a second bookshelf Canvas. Orange bootstrap and first-scene
reveal include reduced motion and a bounded real error/loading fallback.
Actual browser verification is in progress; no corrected native artifact or
full child/shop/bilingual-content completion is claimed yet.

Fresh browser findings: native scene entry, RU/EN object and camera-pose
retention were observed; seven missing selected portraits were added from
canonical files with exact hashes and existing credits. The archive-load
failure in the esbuild fixture was traced to Vite import.meta.glob semantics;
the fixture is corrected without changing production loader code. Original
failed runs remain under .tmp/native-planet-browser-results.

Actual iOS run34179803208 at public325e9f3c installed/launched on separate
RU/EN iPhone17 simulators. Root inspected exact screenshots: the magazine
homepage and status-bar overlap FAIL the intended application. Source and
artifact are historical, distinct from this local correction. Earlier install
timeout34178911693 is preserved; successful installs took88.6s/62.5s, explaining
the correction from60s to240s. Evidence: evidence/S04/ios-runtime-20260908.

Latest previous Android/dev46ebba56 APK is preserved at
.tmp/native-builds/android-dev/46ebba56/app-dev-debug.apk, SHA256
8244b5022bf89373890254204ce06bdf9226a382d33d75f21422802db830d502.
It includes current-main/navigation/image corrections and passes independent
APK byte/plugin/resource/signature/alignment checks, but predates globe-only
entry. No connected Android device/install was observed. Workspace-local SDK
license and installation were explicitly authorized and completed.

Latest PWA evidence/S03/current-pwa-20260908/result.json records11pass/1selector
failure plus the corrected single-case pass on the same product source with a
new QA authority. Both341-file strict audits passed. Historical default signer
files and artifacts are preserved. OS installation and exact-RC remain open.

Canonical main5d3f6fb is incorporated through72a62b31. Historical969 affected
tests/61files and39 local SQL checks are preserved, not rerun for this change.
Accepted headSha still refers to S02:6305df5f. No production deploy, Submit,
Release, merge, store mutation or production DB action has occurred.
