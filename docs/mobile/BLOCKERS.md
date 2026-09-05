# V12 blockers and pending work

Internal work:

- S00: finish refreshed current-main tests/build/browser evidence and acceptance.
- S01-S40: architecture, shared runtime, paid PWA, native clients, content,
  child/purchase/offline/rights flows and full bilingual release work remain.
- English content is incomplete in main; prior release deliberately paused bulk
  English generation. This is internal work, never an owner translation task.
- No Java/Gradle/adb/Xcode/Swift detected on PATH at intake. Android tooling and
  a macOS Xcode build environment must be prepared or accessed before native QA.

External evidence/access limitations (do not block independent implementation):

- Main reports protected=true; detailed legacy branch-protection configuration
  is inaccessible to current integration (403). Do not infer required checks from
  empty ruleset responses. Preserve main and require owner review before merge.
- Signing, merchant/store accounts, territory/rights/legal decisions and final
  owner approval are unverified. Consolidated concrete owner steps will be built
  when their corresponding artifacts exist; no secrets requested at intake.

Production actions remain prohibited by the user. None have been performed.
