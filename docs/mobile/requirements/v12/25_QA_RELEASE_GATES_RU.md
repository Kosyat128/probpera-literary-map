# TEST AND RELEASE GATES

## Gate groups

### Canon/site parity

- globe edition registry;
- geography/projection;
- country picking;
- stable IDs;
- coordinates;
- portraits/flags;
- biographies/works;
- brand tokens;
- content hashes.

### Web/PWA

- production build;
- installable manifest;
- service-worker scope;
- offline boot;
- update/rollback;
- no site cache conflict;
- responsive;
- keyboard/touch;
- accessibility;
- Lighthouse budgets.

### Android

- Gradle build/tests;
- debug install;
- Google AAB;
- RuStore artifact;
- Back;
- App Links;
- lifecycle/process recreation;
- low memory;
- secure storage;
- billing sandbox.

### iOS/iPadOS

- simulator build/tests;
- iPhone/iPad layouts;
- safe areas;
- Dynamic Type;
- VoiceOver;
- lifecycle/memory warning;
- Universal Links;
- StoreKit sandbox;
- archive when signing available.

### Child mode

- no adult flash;
- exact age;
- per-work policy;
- separate indexes/caches;
- direct ID/deep link/history/favorite/offline bypass;
- Parent Gate;
- wrong PIN backoff;
- restart/process recreation;
- no ads/tracking;
- character rights;
- child store boundary.

### Store

- catalog states;
- real localized price;
- preview/apply/revert;
- same Canvas;
- memory/disposal;
- pending/cancel/reinstall;
- restore;
- server verification;
- duplicate/idempotency;
- refund/revocation;
- rights expiry;
- Web checkout disabled safely without PSP.

### Content/no AI

- no generated real-person assets;
- portrait provenance;
- flag provenance;
- child editorial status;
- no app-only biography;
- no fake cover;
- export checksum.

### Quality

- TypeScript/lint/unit/integration/E2E;
- visual regression;
- accessibility;
- performance;
- memory stress;
- security/secret scan;
- dependency/SBOM;
- site/admin regression.

## Severity

- P0: leakage, data loss, purchase bypass, Parent Gate bypass, wrong person,
  geographic corruption, second globe, production remote runtime.
- P1: broken primary flow, install/build failure, major accessibility,
  persistent memory leak, store entitlement failure.
- P2: important polish/compatibility issue.
- P3: non-blocking enhancement.

No P0/P1 at RC. P2 requires explicit documented acceptance; Codex cannot
silently waive it.

## Release artifacts

Web/PWA:
- bundle/deployment package;
- manifest/SW;
- checksums;
- Lighthouse/E2E reports.

Android:
- QA APK;
- Google AAB;
- RuStore artifact;
- mapping/symbols as appropriate;
- checksums.

iOS:
- simulator result;
- Xcode project;
- archive/export config;
- archive/IPA if credentials;
- checksums.

Common:
- content manifests;
- store metadata;
- security/privacy;
- test evidence;
- final handoff;
- external owner steps.

## Honest completion

`COMPLETE` requires all internal gates and available signed artifacts.

`COMPLETE_WITH_EXTERNAL_BLOCKERS` is allowed only when source, tests,
unsigned/simulator artifacts and preparation are complete, and remaining
work is truly external signing/store/legal action.

## V12 bilingual release gates

Add blocking gates for 100% Russian/English critical-path coverage,
placeholder parity, hardcoded strings, pseudolocalization, text expansion,
native per-app language, state-preserving language switching, English
Base Edition content, names/titles evidence, cross-script search, child
policy after alias resolution, localized offline packages, audio/transcript
coverage, localized legal/support/store materials, exact-build screenshot
pairs, web canonical/hreflang and bilingual owner handoff. Use 127, 131,
141, 149 and 158 as machine-readable acceptance inputs.
