# V12 OWNER-MINIMAL FINAL EXECUTION OVERLAY
# ВЫСШИЙ ПРИОРИТЕТ ПОСЛЕ 03_MASTER_EXECUTIVE_PROMPT_V12_RU_EN.txt

Этот документ усиливает V12 так, чтобы после работы Codex владельцу
остались только объективно неизбежные действия: юридическая идентификация,
store/merchant accounts, production secrets, финальное утверждение,
ручное нажатие Submit/Release и ответы магазину.

Нельзя переносить на владельца:

- выбор внутренней архитектуры;
- написание store descriptions;
- ручное составление Data Safety/App Privacy;
- ручную подготовку screenshots;
- поиск путей к Parent Gate;
- заполнение десятков разрозненных конфигурационных файлов;
- создание release commands;
- проверку SDK/permissions;
- поиск причин crash/black globe;
- ручную сборку контентных пакетов;
- ручную сверку rights manifests;
- подготовку reviewer notes;
- составление ответа на типовое замечание;
- выбор безопасных технических defaults;
- повторное изучение всего проекта после лимита Codex.

======================================================================
1. ЕДИНЫЙ OWNER INPUT
======================================================================

Все несекретные решения владельца собираются в одном файле:

`owner-release-inputs.json`

Все секреты передаются только через обозначенные secret stores и никогда
не записываются в этот файл.

Codex должен:

1. Сгенерировать `owner-release-inputs.example.json`.
2. Валидировать его по JSON Schema.
3. Подставить безопасные defaults.
4. Сформировать понятный отчёт только по незаполненным обязательным полям.
5. Из одного файла сгенерировать:
   - app identifiers;
   - display names;
   - store metadata;
   - prices planning;
   - territories;
   - privacy/support/legal URLs;
   - review notes;
   - reviewer routes;
   - owner sign-off forms;
   - release profile;
   - store console worksheets;
   - release commands;
   - submission packages.
6. Не задавать владельцу вопрос, если безопасный default уже определён.
7. Не требовать повторно вводить одно значение в нескольких местах.

======================================================================
2. SAFE FIRST RELEASE PROFILE
======================================================================

По умолчанию первая публичная версия использует профиль:

`SAFE_PAID_BILINGUAL_V1`

Его цель — выпустить полноценное приложение с минимальным риском
модерации и минимальным количеством действий владельца.

Обязательные defaults:

- сайт и готовая Литературная планета — единственный канон;
- платная базовая редакция;
- богатый Starter Set;
- child mode и Parent Center включены;
- Планетка включена;
- offline bootstrap включён;
- no ads;
- no subscription;
- no consumable currency;
- no loot boxes;
- no open chat;
- no microphone;
- no camera;
- no location;
- no contact/SMS/call-log access;
- no behavioural analytics;
- no push notifications in V1;
- no Disney/Pixar assets, names, screenshots or SKU;
- no other licensed pack without complete rights;
- no alternative/external digital checkout link inside native builds;
- one optional original non-consumable product per store only if every
  store/backend/reviewer gate is green;
- otherwise IAP code remains complete but production product visibility
  is disabled without breaking the paid base app;
- account/sync remains disabled for first public release unless the
  existing account system, deletion, privacy declarations and reviewer
  access all pass;
- Russian interface must be complete;
- any additional locale is enabled only at 100% UI/content/store readiness;
- no unfinished locale;
- no Coming Soon cards for unavailable licensed content;
- manual/staged release after store approval;
- no automatic production launch.

This profile does not remove features from the codebase. It controls which
fully validated features are enabled in the first public release.

======================================================================
3. ACCOUNTLESS-FIRST DEFAULT
======================================================================

To reduce review, privacy and owner burden:

- native paid app core is guest-first;
- local favorites, history, child profiles and settings work without an
  account;
- store account handles paid app download and native IAP restore;
- cloud sync is optional and disabled by default in SAFE_PAID_BILINGUAL_V1 unless it
  is already production-ready;
- disabling cloud account must not disable base features;
- account UI must not be visible in production when the feature flag is
  off;
- account-related SDKs and data collection must be excluded from the
  binary/manifest when disabled where feasible;
- if account creation is enabled, in-app deletion and required public web
  deletion become mandatory before submission.

Web/PWA may require an entitlement identity for the paid web license, but
this must be the minimum necessary commerce identity and have deletion,
recovery, privacy and support flows.

======================================================================
4. ONE OPTIONAL PRODUCT STRATEGY
======================================================================

For the first store review, prefer one original, low-risk, small,
non-consumable optional product:

- no third-party character;
- no Disney/Pixar;
- no real-person likeness;
- no questionable music;
- clear visual value;
- small download;
- safe fallback;
- works on all supported devices;
- easy to preview;
- easy to restore;
- no age concern;
- complete rights.

Preferred candidates:

1. Original premium book-stack stand.
2. Original premium 3D library background.
3. Original Planetka accessory bundle.

Codex chooses the strongest production-ready candidate after testing.
Additional products remain disabled until after first approval unless
they pass exactly the same gates.

This reduces the chance that one incomplete SKU blocks the entire first
submission while still delivering a real optional-purchase system.

======================================================================
5. OWNER-MINIMAL RELEASE AUTOMATION
======================================================================

Create root commands, adapted to the repository package manager:

```text
release:owner:init
release:owner:validate
release:owner:missing
release:prepare:all
release:preflight:all
release:review-dossiers
release:capture:screenshots
release:package:all
release:upload:draft:apple
release:upload:draft:google
release:upload:draft:rustore
release:upload:draft:web
release:status
release:owner:handoff
```

Rules:

- all upload commands are dry-run by default;
- a separate explicit flag and available credentials are required for an
  authorized draft upload;
- no command submits to review, releases to production, changes price,
  accepts agreements or merges main automatically;
- commands produce machine-readable JSON and a short Russian summary;
- secrets are redacted;
- missing external values are grouped into one owner task list;
- successful reruns are idempotent;
- partial failure does not corrupt store state;
- each store uses its official API or officially supported upload path;
- an API limitation is documented instead of hidden.

======================================================================
6. OFFICIAL STORE AUTOMATION BOUNDARIES
======================================================================

Apple:

- App Store Connect API may manage metadata, screenshots, TestFlight,
  IAP and submissions where supported;
- binary upload uses an officially supported Apple path such as the
  current App Store Connect build upload API, Xcode or Transporter;
- a new app record and agreements may still require App Store Connect;
- API keys remain secrets;
- no automatic Submit for Review without explicit owner action.

Google Play:

- use Google Play Developer Publishing API transactional edits for
  artifacts, tracks and listings where supported;
- first app record, legal declarations and some console actions remain
  manual;
- do not commit an edit to production without explicit owner action;
- internal/closed track upload can be automated after credentials exist.

RuStore:

- use current RuStore Public API for draft/version/assets where supported;
- respect API prerequisites such as an existing/active app record;
- paid type, monetization, legal verification and final moderation remain
  owner/console actions;
- upload is dry-run or draft-only by default.

Web/PWA:

- generate deploy artifact and merchant configuration validation;
- production deploy remains explicit;
- no merchant secret in source;
- support rollback.

======================================================================
7. OWNER SECRETS CONTRACT
======================================================================

Codex creates a names-only secrets matrix.

Expected secret references may include:

- APP_STORE_CONNECT_KEY_ID;
- APP_STORE_CONNECT_ISSUER_ID;
- APP_STORE_CONNECT_PRIVATE_KEY;
- APPLE_TEAM_ID;
- IOS_SIGNING_CERTIFICATE/PROFILE references;
- GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
- ANDROID_UPLOAD_KEYSTORE;
- ANDROID_UPLOAD_KEY_ALIAS;
- ANDROID_UPLOAD_KEY_PASSWORD;
- ANDROID_KEYSTORE_PASSWORD;
- RUSTORE_PUBLIC_API_TOKEN;
- RUSTORE_PAY_PROJECT/MERCHANT secrets;
- WEB_PSP_SECRET;
- WEB_PSP_WEBHOOK_SECRET;
- SUPABASE/CLOUDFLARE production secrets where actually required.

Rules:

- no value appears in Git, reports, screenshots, logs or chat;
- every secret has owner, purpose, rotation, backup and revocation plan;
- production and sandbox secrets are separated;
- CI gets least privilege;
- store API keys cannot administer unrelated apps where avoidable;
- owner receives an emergency-recovery checklist.

======================================================================
8. LEGAL AND REGIONAL COMPLIANCE GATES
======================================================================

Codex must include a territory decision matrix and ask the owner to choose
only once.

Apple/EU:

- DSA trader status must be assessed and verified before EU distribution;
- trader contact information and app-specific status are recorded;
- current EU App Store business terms are rechecked, especially if
  submission/release occurs on or after 2026-10-01;
- external payment/alternative distribution options remain OFF by default;
- export-compliance/encryption questions are completed;
- if distribution includes France and non-exempt encryption is used,
  determine whether French encryption documentation is required;
- Required Reason APIs and privacy manifests are audited.

Google/Android:

- developer identity and organization verification are completed;
- app/package is registered under Android developer verification where
  required;
- recheck the 2026-09-30 rollout in Brazil, Indonesia, Singapore and
  Thailand and subsequent expansion;
- target API, Billing and Play policies are current;
- Data Safety, account deletion and Families declarations are current.

RuStore:

- developer/organization/EDS requirements;
- paid-app monetization;
- current Pay SDK;
- matching signing;
- personal-data/operator and consumer-information review;
- territory/payment restrictions.

The initial public territory set must not automatically be “all
countries”. It is generated from:

- store payment availability;
- legal/trader/tax readiness;
- rights territories;
- supported language;
- support capability;
- privacy requirements;
- publisher decision.

======================================================================
9. APPLE DSA, EXPORT AND PRIVACY-API CHECKS
======================================================================

Add dedicated Apple gates:

- DSA trader status declared even if EU is not selected, where App Store
  Connect requires it;
- trader contact verification completed before EU release;
- app encryption/export compliance questionnaire completed;
- Info.plist encryption declaration set only when accurate;
- French encryption declaration/CCATS decision documented when relevant;
- PrivacyInfo.xcprivacy generated and audited;
- Xcode privacy report generated from the exact archive;
- Required Reason API usage includes approved reasons;
- third-party SDK signatures/manifests reviewed;
- App Privacy answers match the privacy report and actual backend traffic;
- Accessibility Nutrition Label fields are generated from tested
  capabilities rather than marketing claims.

======================================================================
10. ANDROID DEVELOPER VERIFICATION
======================================================================

Add a release gate that verifies:

- developer identity;
- organization details;
- package registration;
- signing certificate association;
- app record registration;
- rollout-country requirements;
- no mismatch between Google Play, RuStore and direct/test signatures;
- September 30, 2026 affected-country readiness;
- evidence stored without exposing personal documents.

A verification failure is an external owner/account blocker only after all
technical package/signing metadata and exact instructions are prepared.

======================================================================
11. ONE-TIME OWNER APPROVAL SCREEN
======================================================================

Codex must generate a single owner-facing report:

`FINAL_OWNER_APPROVAL_RU.html` and `.md`

It shows only decisions that genuinely require the owner:

- legal seller;
- public app name/subtitle;
- SAFE_PAID_BILINGUAL_V1 profile;
- price per store;
- countries/territories;
- mixed/family audience;
- Apple Kids Category default NO;
- age rating answers;
- privacy/Data Safety answers;
- app icon;
- screenshots;
- Starter Set;
- one optional product;
- support/privacy/terms/deletion URLs;
- rights summary;
- Disney excluded;
- final artifact SHA;
- staged/manual release mode.

Each item has:

- recommended default;
- why it matters;
- exact artifact/preview;
- approve/reject field;
- no technical jargon where unnecessary.

Owner approval is entered once and propagated to all store packages.

======================================================================
12. CONTEXT-EFFICIENT CODEX EXECUTION
======================================================================

The archive is large. Codex must not reread the entire standalone prompt
on every session.

First session:

1. Read MANIFEST.
2. Read executive prompt.
3. Read 03A and this 03B.
4. Read requirements/stage routing.
5. Read only Stage 0 documents.
6. Persist package under docs/mobile/requirements with hashes.

Every next Stage:

- load only shared invariants plus the current Stage’s routed documents;
- update AUTOPILOT_STATE;
- keep a compact decision log;
- do not duplicate closed analysis;
- do not regenerate unchanged artifacts;
- run narrow tests first;
- run full gates at checkpoints;
- leave a self-contained NEXT_CODEX_PROMPT.

The concatenated standalone prompt remains a fallback, not something to
read twice after modular documents.

======================================================================
13. RELEASE TERRITORY DEFAULTS
======================================================================

Codex generates three territory sets:

- `TEST_ONLY`: sandbox/internal/TestFlight/closed testing.
- `SAFE_INITIAL`: only territories with complete language, payment,
  support, legal and rights readiness.
- `EXPANDED`: later rollout after evidence.

No public release to an unready territory.

For each territory record:

- store availability;
- price;
- currency;
- tax/trader status;
- language;
- rights;
- support;
- privacy/legal;
- child/audience requirements;
- licensed packs;
- release status.

======================================================================
14. FIRST 72 HOURS AND ROLLOUT
======================================================================

After approval:

- owner manually releases or starts the approved staged rollout;
- monitor crash-free launch, purchase verification, content downloads,
  account deletion, support and reviews;
- maintain a kill switch for optional products/content packages, not for
  the paid core;
- no remote behavior that changes app into an unreviewed product;
- pause rollout on P0/P1;
- preserve submitted artifact and evidence;
- prepare rollback or hotfix;
- respond to reviews without exposing child/user data.

Codex must prepare the dashboard, alerts and exact owner runbook.

======================================================================
15. OWNER-MINIMAL DEFINITION OF DONE
======================================================================

V12 is internally complete only when:

- one non-secret owner input file controls all release configuration;
- owner missing-input report is generated;
- owner secret names and setup paths are generated;
- SAFE_PAID_BILINGUAL_V1 profile is implemented and tested;
- accountless-first native core works;
- one original optional product is fully reviewable or safely disabled;
- Apple/Google/RuStore/Web store packages are generated;
- draft-upload automation exists where official APIs support it;
- all commands default to dry-run;
- DSA trader, export compliance, privacy manifests, developer verification
  and territory gates exist;
- exact console field worksheets exist;
- exact screenshots and review notes exist;
- final approval report exists;
- owner action list contains no programming task;
- owner action list contains no duplicated data entry;
- post-approval 72-hour runbook exists;
- context routing prevents repeated full-prompt reads;
- all prior canon, child, commerce, rights, moderation and quality gates
  remain green.

The owner should be left with roughly these classes of actions only:

1. Verify/create legal, developer and merchant accounts.
2. Place signing/API/payment secrets in the specified secret store.
3. Complete one owner input/approval file.
4. Approve legal texts, rights, age/privacy declarations and screenshots.
5. Allow draft upload or upload the generated artifacts.
6. Click Submit/Release in each store and answer reviewers.
7. Merge the final PR after review.

No prompt can remove these external responsibilities, but everything
around them must be prepared and verified.



======================================================================
16. CHILD PRIVACY AND JURISDICTION LOCK
======================================================================

SAFE_PAID_BILINGUAL_V1 keeps child profiles and progress local by default and
disables child cloud accounts, uploads, advertising, behavioural
analytics, push targeting and child AI input.

Before enabling a public territory, Codex prepares the applicable child
privacy/contract worksheet. Mandatory review includes:

- United States / COPPA when applicable;
- EU Member-State consent thresholds;
- France age-15 consent snapshot and contractual/privacy questions;
- UK Children's Code;
- equivalent requirements in every additional territory.

A territory with unresolved child data/legal obligations stays outside
SAFE_INITIAL. This is a legal approval task for the owner only after Codex
has produced the exact data-flow, feature, consent and deletion evidence.

======================================================================
17. FINAL OWNER HANDOFF LOCK
======================================================================

Codex must generate one self-contained `artifacts/owner-handoff/` folder.

A nontechnical owner must be able to find in under five minutes:

- remaining missing inputs;
- secrets to add by name;
- approved artifacts and hashes;
- exact screenshots;
- exact store notes;
- exact fields and values;
- exact draft upload command;
- exact manual Submit/Release path;
- rejection-response procedure;
- first 72-hour runbook.

The final owner action matrix must contain zero programming tasks and no
duplicated data entry.

======================================================================
18. FINAL STAGES
======================================================================

S32 — single owner input, SAFE_PAID_BILINGUAL_V1, secret/signing map.
S33 — DSA/export/privacy APIs, Android verification, child jurisdiction
and SAFE_INITIAL territory approval.
S34 — one-command release preparation and dry-run/draft API packages.
S35 — owner approval, self-contained handoff, manual submission/release
instructions and 72-hour operations.

FINAL HANDOFF is forbidden before S35.
