# PRIVACY, PERMISSIONS AND DATA SAFETY — V12

## 1. Single source of truth

Generate `reports/privacy/data-inventory.json` from:

- TypeScript code;
- native manifests/plists;
- Capacitor plugins;
- SDK dependency graph;
- backend endpoints;
- database schemas;
- network traces;
- logs;
- purchase providers;
- account flows;
- child profiles;
- support/contact forms.

Manual declarations must be derived from and checked against this inventory.

## 2. Data categories

Evaluate:

- adult account identifiers;
- authentication data;
- child local profile age/nickname;
- favorites/history/progress;
- purchase/transaction identifiers;
- IP/network logs;
- crash diagnostics;
- device/app identifiers;
- support messages;
- audio files delivered;
- analytics events;
- web license records;
- account deletion requests.

State whether data is collected, linked, shared, retained, encrypted and
optional/required.

## 3. Child data minimization

- exact age in years only;
- no full birth date;
- no child email/phone;
- no child public account;
- no child photo;
- no location;
- no ad ID;
- no behavioral advertising;
- local by default;
- parent can delete;
- no open chat uploads.

## 4. Permissions

Create permission allowlist. CI fails on unapproved additions.

Default deny:

- camera;
- microphone;
- location;
- contacts;
- SMS;
- phone;
- call logs;
- broad storage;
- advertising identifier;
- background location;
- Bluetooth;
- calendar.

If notification permission is added later, it requires owner-approved
feature and child review.

## 5. Privacy Policy

Must:

- identify developer and app;
- explain actual data;
- describe purposes;
- disclose processors;
- explain purchase verification;
- explain child mode;
- explain retention;
- explain deletion;
- provide contact;
- show effective date/version;
- be public without login;
- be accessible in app;
- match all store declarations.

## 6. Data Safety/Apple/RuStore outputs

Generate store-specific worksheets and validate field-by-field against
inventory. Do not reuse old answers after adding/removing SDKs.

## 7. Account deletion

If adult account creation exists:

- in-app deletion;
- confirmation;
- public web deletion route where required;
- server deletion/anonymization job;
- status;
- lawful-retention explanation;
- cancellation grace only if transparent;
- tests;
- reviewer instructions.

Local child profiles are deleted by parent immediately from Parent Center,
subject only to transparent backup/sync policy.

## 8. SDK gate

A new SDK requires:

- necessity;
- official source;
- privacy behavior;
- child suitability;
- data flow;
- opt-out/consent;
- retention;
- security;
- current policy check;
- removal plan.

Prefer NoOp/self-hosted minimal functionality.

## 9. Network verification

Capture release-build traffic and compare to declarations:

- domains;
- endpoint purpose;
- payload categories;
- TLS;
- environment;
- third party;
- child/adult behavior.

Unexpected endpoint = release failure.

## 10. Store rejection prevention

Block submission for:

- “no data collected” mismatch;
- privacy URL unavailable;
- account deletion absent;
- hidden SDK collection;
- unnecessary permission;
- child tracking;
- receipt/token logging;
- production secrets;
- privacy manifest mismatch;
- different behavior in review vs public build.
