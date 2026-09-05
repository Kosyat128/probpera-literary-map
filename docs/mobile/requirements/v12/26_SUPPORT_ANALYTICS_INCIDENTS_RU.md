# SUPPORT, OBSERVABILITY, ANALYTICS, INCIDENTS AND BUSINESS CONTINUITY — V12

## 1. Support objective

Пользователь и владелец должны решать типовые проблемы без новой
разработки и без раскрытия персональных/секретных данных.

## 2. In-app help for adult/parent

- getting started;
- globe controls;
- offline/downloads;
- graphics/safe mode;
- content update/repair;
- restore purchases;
- platform purchase scope;
- child profiles/Parent Gate;
- PIN recovery policy;
- licensed content availability;
- privacy/export/delete;
- accessibility;
- contact support.

Child help uses safe simple copy, no commercial detail.

## 3. Redacted diagnostic export

With explicit adult consent export:

- app/build/content version;
- platform/OS/device class;
- graphics tier;
- active item IDs, not assets/secrets;
- last update/download result;
- WebGL recovery counters;
- store provider and redacted error category;
- available storage bucket;
- integrity status;
- correlation IDs.

Never include PIN, raw receipt/token, child queries, exact child profile,
full biography text, private admin data or secrets.

## 4. Analytics policy

Default NoOp until approved. Allowed adult/operational events:

- app start and version;
- screen/feature aggregate;
- content update result;
- download result;
- WebGL/context/performance bucket;
- optional store funnel after adult access;
- purchase verification/restore result;
- error category.

Forbidden:

- advertising ID;
- cross-app tracking;
- child behavioural profile;
- raw child search;
- precise movement/camera trail;
- sensitive text;
- PIN/receipt/token;
- dark-pattern personalization.

Provide consent/opt-out where required and retention/deletion controls.

## 5. Health and alerts

Owner dashboard/alerts:

- backend/CDN outage;
- content integrity failure;
- update failure spike;
- crash/recovery trend;
- purchase verification failure;
- entitlement reconciliation lag;
- store provider outage;
- license expiry;
- licensed asset wrong territory;
- disk/package budget;
- backup/restore failure;
- CI/release gate failure;
- security advisory.

Alerts should be actionable, deduplicated and severity-based.

## 6. Incident severity

P0:
- child boundary breach;
- unlicensed IP production exposure;
- purchase self-grant/security compromise;
- data/secrets exposure;
- widespread app unusable/data corruption.

P1:
- core globe/search broken;
- paid users locked out;
- restore/refund failure at scale;
- content update corrupt but rollback available;
- severe accessibility blocker.

P2/P3:
- localized/visual/non-core issues.

Define owners, response SLA, communication, mitigation, rollback,
postmortem and follow-up tests.

## 7. Runbooks

Required:

- disable optional store;
- disable one SKU/territory;
- delist licensed/Disney pack;
- rollback content manifest;
- rollback Web/PWA;
- halt Android/iOS rollout;
- switch to Economy/safe background;
- repair local package;
- rotate compromised secret;
- reconcile purchases;
- restore database/media backup;
- respond to store rejection;
- publish status/support message;
- remove rights-infringing asset.

## 8. Backup and recovery

- database backups;
- object/media backups;
- rights/store metadata backups;
- content/artifact manifest archive;
- encryption/key rotation;
- restore drills;
- RPO/RTO targets;
- last-known-good release;
- owner access recovery;
- signing key loss response;
- tested restore evidence.

Backup without restore test is not accepted.

## 9. Support matrix

Create standard replies and diagnostic steps for:

- purchase pending;
- restore not found;
- wrong store installation;
- optional item missing/download corrupt;
- app offline;
- globe black/slow;
- child mode/PIN;
- content error/correction;
- account deletion;
- licensed pack unavailable;
- refund guidance;
- accessibility issue;
- migration/update issue.

## 10. Status and communications

Provide maintenance/status page strategy, in-app banner and localization.
No promise that contradicts store or license scope. Child screen receives
only calm non-commercial service wording.

## 11. Acceptance

- P0/P1 runbooks tested/tabletop;
- diagnostic redaction tested;
- restore drill passed;
- alerts map to owners;
- support docs match actual app;
- child privacy respected;
- optional store outage does not break base app.
