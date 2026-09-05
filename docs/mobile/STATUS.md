# V12 status

S00-S02 are accepted. S03 is IN_PROGRESS and remains first-open. S04 is
IN_PROGRESS under its documented parallel-safe entry. S05-S40 have not started.
No global requirement is PASSED. releaseReady:false.

Canonical main f406a7de9e16e8cf63545cbce6681ed9278761a4 is incorporated by five
local cherry-picks through8e6cfe1f482ebd261965d774cbf4e14f80f62f1d. Accepted
headSha remains S02:6305df5fe671718c78b38af1ccc2bafbbdd44346. Working checkpoints
0afad090 and e2530cc6 preserve S03 integration and saved-verification behavior;
neither accepts S03. Current S04 evidence records working source beyond e2530cc6.

S03 measured results:

- Integrated unit regression:4479 passed,4 existing skips,576 files passed,
  3 skipped,553.88s. Subsequent bounded changes have separate evidence.
- Fresh PWA b006c275:20/20 actual Chrome scenarios and335-file audit passed.
  Real Dostoevsky/work cold-offline navigation and RU/EN saved-access text retain
  the same Canvas/renderer/camera/scene and selection. This is local QA, not RC.
- Saved-access fix:117 affected unit,6 Chrome component and12 typography tests.
- Historical cross-engine4a0696ef:4 PASS,2 FAIL. Firefox both passed; Chrome
  network-hint reset and Windows WebKit offline transport failure were reproduced
  independently. Preserve failures; this is not Safari or native-device evidence.
- Canonical public browser6, WriterPanel/StrictMode4, dossier38 unit/7 browser,
  domain12876/SEO5513/dossier659 checks, safe-reader deletion70 with independent
  6 SQL/6 CLI groups, localized404106 checks are preserved in S03 evidence.
- Later private-content audit fixes passed88 affected tests across recorded runs;
  copy normalization passed137. These did not rerun the earlier full4479 suite.

S04 implemented and measured:

- Shared canonical App mounts through Android/iOS adapters and SDK-free host
  capabilities. There is one existing global language provider; initialization,
  preference ordering, lifecycle/network hints and external-link policy are tested.
- Exact Capacitor packages were inspected and installed:81 additions, no existing
  package changes/removals. Both native projects use local bundled assets. No
  remote runtime, account SDK in the native graph, production signing or release.
- The user authorized the Google SDK license. Workspace-local Java21, SDK36 and
  Gradle8.14.3 were verified. Actual Android dev APK compiled:167 tasks,161 seconds.
  APK:33,359,413 bytes; SHA256
  3a4cccecf310a7b2eabef22426d96fe78033e89bdca058249383e30d2b17cf20.
  Preserved at .tmp/native-builds/android-dev/fa9dd4a0/app-dev-debug.apk.
  Independent actual-byte, ZIP, DEX, RU/EN resources, signature and alignment
  verification passed. No installed-device run has been observed.
- Android fa9dd4a0 and iOS e7921e30 each passed strict native artifact audit.
  Both actual syncs passed. iOS320 declared files match, plus2 empty Cordova
  compatibility files. Current dist-native is iOS; do not sync it into Android.
- Canonical brand assets replace stock icons/splashes; resource compilation,
  safe-area geometry and exact hashes passed. Native RU/EN resource strings and
  iOS privacy/project structure are preserved. Text review remains incomplete.
- Host80, adapters/initialization68, auditor64, shared governance/provider129,
  backend guards11, persistence outcomes10 tests passed. Five actual Chrome host
  component tests use a DOM probe instead of App, not an actual globe or device.
  Final TypeScript,26 CSS files and platform boundaries passed.
- iOS app SPM constraint is exact8.5.1. The incorrect earlier intake range claim
  is explicitly corrected with original bytes retained. There is no completed
  Swift resolution, Xcode build, simulator run or IPA.

The user has no Mac. A cloud macOS simulator workflow is being prepared locally;
its existence will not be claimed as a successful remote build. Signing and
store delivery remain separate from unsigned simulator validation.

Primary current evidence: evidence/S04/working-native-implementation.json,
android-dev-apk-verification.json, ios-project-sync-review.json and their
byte-preserved reports/logs. Initial failures remain alongside corrections.

Open work includes S03 browser/device boundaries and broader account lifecycle;
native installed behavior, child/deep-link/navigation/commerce policy; complete
reviewed RU/EN content, search/audio/offline packages, accessibility, bilingual
legal/store support, exact-RC screenshots and owner approval. These are internal
implementation tasks except concrete account/signing/legal decisions. No human
translation/legal approval or release readiness is fabricated.

No production deploy, Submit, Release, merge, store mutation or production data
write has been performed. Historical evidence is not silently reclassified.
