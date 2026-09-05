# STORE SUBMISSION, LEGAL DRAFTS AND FINAL HANDOFF — V12


> **V12 priority notice:** this document must be executed together with
> `03A_MODERATION_READY_EXECUTION_OVERLAY_RU.md` and
> `27A_MODERATION_READINESS_MASTER_RU.md` through
> `27Q_MODERATION_PRECHECK_COMMANDS_RU.md`. Store submission is not ready
> until the exact RC artifact, reviewer access, truthful screenshots,
> whole-binary age disclosures, privacy/account deletion, rights-clean
> scan and rejection-resubmission gates pass.


## 1. Store submission package

Create separate directories for:

- App Store;
- Google Play;
- RuStore;
- Web/PWA commerce;
- common brand/legal assets.

Each includes:

- app name/subtitle/descriptions;
- category and age-rating draft;
- privacy/data safety mapping;
- screenshots from real release candidate;
- icon/feature graphic;
- release notes;
- support/privacy/terms URLs;
- reviewer instructions;
- test access only where needed;
- purchase/restore explanation;
- child/Parent Gate explanation;
- platform-specific product list;
- known limitations;
- artifact/version/hash.

## 2. Paid app checks

- nonzero base price in each console;
- Google listing never public-free;
- Paid Apps/monetization agreements;
- countries/currencies/taxes/banking;
- one-time web license;
- no subscription/ad claim;
- Starter Set messaging;
- optional purchase disclosure;
- platform-specific ownership disclosure;
- family-sharing claim only when configured.

## 3. Screenshots/marketing truth

- real app UI;
- canonical site globe;
- real approved portraits/flags;
- no fake price;
- no unavailable feature;
- no Disney/unlicensed character;
- no debug UI;
- correct locale/device;
- no misleading free/no-subscription wording;
- no promise of cross-platform entitlement;
- visual reference is not itself a store screenshot.

## 4. Legal drafts

Prepare for owner/legal review:

- Privacy Policy;
- Terms/EULA;
- paid app and optional purchase terms;
- refund/store scope explanation;
- child privacy/parent controls;
- account/data export/deletion;
- copyright/takedown policy;
- licensed content terms/expiry;
- accessibility statement;
- support policy;
- web cookie/storage notice;
- open-source notices;
- trademark/attribution notices.

Codex must not claim legal approval. Mark responsible owner/reviewer/date.

## 5. Rights handoff

- asset provenance inventory;
- portrait/cover/flag licenses;
- original project art ownership;
- contractor releases where relevant;
- literary source/translation review;
- character rights matrix;
- Disney licensing workflow;
- approved territories/platforms/languages;
- expiry calendar;
- takedown/delisting procedure.

## 6. App review rejection playbook

Prepare fixes/responses for:

- crash/blank globe;
- incomplete tablet layout;
- missing restore;
- child external link/purchase without gate;
- privacy mismatch;
- data deletion missing;
- misleading screenshots;
- unavailable SKU;
- external checkout mention;
- age rating mismatch;
- unsupported/outdated SDK;
- unlicensed asset;
- reviewer unable to access feature;
- PWA/web confusion.

Each has reproduction, remediation, evidence and reviewer note template.

## 7. Release candidates

Artifacts:

- Web/PWA production package;
- Android QA APK;
- Google Play AAB;
- RuStore artifact;
- iOS simulator build;
- iOS archive/configuration when signing available;
- content packages/manifests;
- SBOM;
- checksums;
- test reports;
- screenshot evidence.

No debug secrets/test endpoints/products in release.

## 8. Final handoff

Must include:

- system/repository maps;
- local development;
- build and CI;
- content/admin operations;
- customization asset authoring;
- full-3D scene authoring;
- child review;
- purchases/refunds/reconciliation;
- rights/Disney process;
- store submission;
- rollback/incidents/backups;
- support;
- maintenance calendar;
- external owner steps;
- artifact inventory/hashes;
- known limitations;
- final PR and CI status.

## 9. External blockers

Only genuine external actions:

- store/merchant accounts;
- agreements/tax/banking;
- signing credentials;
- final price/territories entered in consoles;
- real-money testing credentials;
- Disney/other licenses;
- legal approval;
- manual submission/review;
- production deploy/merge.

Incomplete code, tests, UI, child safety, store adapters, server
verification, offline or documentation are not external blockers.

## 10. Acceptance

- complete store packages;
- accurate screenshots/metadata;
- legal drafts mapped to actual data flows;
- rights matrix complete;
- release candidates reproducible;
- external actions consolidated;
- final PR open, auto-merge off;
- owner can execute submission without rediscovering architecture.

## V12 bilingual store handoff

Generate separate English and Russian metadata, screenshot inventories,
reviewer instructions and legal/support URL maps from the exact release
candidate. App Store receives supported English and Russian localizations;
Google Play receives an English default listing plus a Russian localization;
RuStore receives Russian primary moderation materials plus verified English
in-app language support. No store localization may be copied from another
locale without a separate factual, rights, layout and owner approval gate.
