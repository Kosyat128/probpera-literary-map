# V12 blockers and pending work

Internal work:

- S03-S40: controlled paid PWA, native clients, content,
  child/purchase/offline/rights flows and full bilingual release work remain.
- English content is incomplete in main; prior release deliberately paused bulk
  English generation. This is internal work, never an owner translation task.
- Android tooling is now installed and verified inside the workspace, under the
  user's explicit SDK license authorization. A real dev APK was compiled and
  independently verified. Installed-device behavior remains unverified.
- The user has no macOS computer. Actual cloud Xcode/Swift compilation succeeded
  on explicitly authorized historical source273f400d, and independent binary
  verification passed. Simulator launch, installed behavior and physical devices
  remain unverified; no Mac purchase or programming is assigned to the owner.
- Current main5d3f6fb is integrated through72a62b31 with969 affected tests passing.
  Historical native/PWA binaries predate it. New image-delivery coverage and fresh
  artifact validation are internal work, along with actual native URL/Back wiring.
- PWA locked-shell preparation passed4 actual Chrome checks; OS installation
  remains unverified. Full standalone tests need a disposable OS environment and
  fresh QA candidate with its signer alive; do not overwrite historical authority.

External evidence/access limitations (do not block independent implementation):

- Main reports protected=true; detailed legacy branch-protection configuration
  is inaccessible to current integration (403). Do not infer required checks from
  empty ruleset responses. Preserve main and require owner review before merge.
- Signing, merchant/store accounts, territory/rights/legal decisions and final
  owner approval are unverified. Consolidated concrete owner steps will be built
  when their corresponding artifacts exist; no secrets requested at intake.

Production actions remain prohibited by the user. None have been performed.
