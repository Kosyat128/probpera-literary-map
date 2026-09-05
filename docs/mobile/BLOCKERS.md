# V12 blockers and pending work

Internal work:

- S03-S40: controlled paid PWA, native clients, content,
  child/purchase/offline/rights flows and full bilingual release work remain.
- English content is incomplete in main; prior release deliberately paused bulk
  English generation. This is internal work, never an owner translation task.
- Android tooling is now installed and verified inside the workspace, under the
  user's explicit SDK license authorization. A real dev APK was compiled and
  independently verified. Installed-device behavior remains unverified.
- The user has no macOS computer. Prepare cloud macOS/Xcode validation; do not
  assign a Mac purchase or programming to the owner. The iOS web bundle and
  synchronized native project are verified, but Xcode/Swift compilation and
  simulator/device behavior have not been observed.

External evidence/access limitations (do not block independent implementation):

- Main reports protected=true; detailed legacy branch-protection configuration
  is inaccessible to current integration (403). Do not infer required checks from
  empty ruleset responses. Preserve main and require owner review before merge.
- Signing, merchant/store accounts, territory/rights/legal decisions and final
  owner approval are unverified. Consolidated concrete owner steps will be built
  when their corresponding artifacts exist; no secrets requested at intake.

Production actions remain prohibited by the user. None have been performed.
