# V12 status — 2026-09-08

The live canonical Literary Planet is the ONLY application home: orange
launch -> globe reveal; search, reading, collection and future child/Planetka,
settings/customization/store functions surround the same scene. No magazine
homepage or intermediate menu. See GLOBE_APPLICATION_CONTRACT.md.

S00-S02 accepted. S03 remains first-open and IN_PROGRESS. S04/S05 are
IN_PROGRESS under documented parallel-safe entry. S06-S40 have not started.
No global requirement passed; releaseReady:false.

Native globe-only entry is implemented and its focused working validation
passed. The canonical App/R3F in Chrome retained one Canvas, the same scene
and settled camera pose through RU/EN switching, work reading and return.
Narrow 390x844 reduced-motion and safe-area geometry also passed. These are
separate bounded cases a4b/work, a5/locale and a6/narrow; original failed runs
remain preserved. Final typecheck/platform boundaries passed. Evidence:
evidence/S04/globe-entry-20260908/result.json. Browser native bindings and CDP
insets are test fixtures, not installed-device runtime evidence.

Fresh Android/dev build3cd14423 is bound to source26e290845639d05b72972381e1f83453a674d75c.
Native strict audit, offline Gradle compilation and independent actual APK
byte/plugin/resource/debug-signature/alignment checks passed. The new APK
contains globe-only entry, not the old magazine homepage. Exact runtime and
APK copies were preserved without overwriting historical builds:
.tmp/native-builds/android-dev/3cd14423/app-dev-debug.apk
34,415,589 bytes; SHA256
f73f86414a7e88a8bb26c3d8d7d06a230a618efae1f00a78348ef6f23a784cb2.
Evidence: evidence/S04/android-globe-entry-20260908/result.json. No Android
installation/emulator/physical-device run or store/RC readiness is claimed.
Workspace-local SDK license and installation were already authorized/completed.

Controlled paid-PWA adaptation to the same globe-only product presentation
and its access/help controls is now in progress. Its changed-source tests and
artifact validation remain a separate next gate. Historical PWA evidence in
evidence/S03/current-pwa-20260908/result.json remains11pass/1selector failure
plus the corrected single-case pass with a new QA authority; both strict
audits passed. This older evidence does not validate the current adaptation.
Historical authorities/artifacts stay preserved; OS installation remains open.

iOS run34179803208 at public325e9f3c installed/launched on separate RU/EN
iPhone17 simulators. Its actual screenshots showed a magazine homepage and
status-bar overlap, which FAIL the application contract. That historical
source/artifact is distinct from the local globe correction. Earlier install
timeout34178911693 and the successful240-second retry remain preserved in
evidence/S04/ios-runtime-20260908. A corrected iOS runtime is still required.

Full onboarding, sealed child policy/Parent Gate/profiles/interactive original
Planetka, optional commerce, scene quality/customization, offline/content,
complete bilingual editorial/legal/store/support/accessibility and owner
release gates remain open. No programming or translation is assigned to owner.

Canonical main5d3f6fb is incorporated through72a62b31. Historical969 affected
tests/61files and39 local SQL checks remain preserved, not rerun for this
change. Accepted headSha still refers to S02:6305df5f. No production deploy,
Submit, Release, merge, store mutation or production DB action has occurred.
