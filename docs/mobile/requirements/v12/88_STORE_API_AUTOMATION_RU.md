# STORE API AUTOMATION AND ONE-COMMAND RELEASE PREPARATION — V12

## 1. Goal

Reduce owner work without performing unauthorized production actions.

Codex prepares official-API automation with dry-run as default.

## 2. Apple automation

Use supported Apple mechanisms:

- App Store Connect API for metadata, screenshots, TestFlight, IAP and
  submission resources where supported;
- current build upload API, Xcode or Transporter for binary upload;
- JWT App Store Connect API key;
- API dry-run/validation;
- exact resource IDs stored as nonsecret config;
- new app record, agreements, trader status, tax/banking and some
  compliance decisions remain owner actions.

Official sources:
https://developer.apple.com/documentation/appstoreconnectapi/
https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds/

## 3. Google Play automation

Use Google Play Developer Publishing API:

- transactional edit;
- upload AAB/APK;
- assign internal/closed/staged tracks;
- update localized listings and images;
- validate edit;
- abandon safely;
- commit only with explicit owner authorization.

An existing app record/initial artifact and legal consent fields may
require Play Console.

Official source:
https://developers.google.com/android-publisher/edits

## 4. RuStore automation

Use RuStore Public API where supported:

- create draft version;
- upload artifact;
- upload icon/screenshots;
- fill compatible metadata;
- validate response;
- no final moderation submission without owner action.

Respect API limitations:

- existing/active app prerequisites;
- one draft limitation;
- paid app type consistency;
- signature requirements;
- console-only legal/monetization fields.

Official sources:
https://www.rustore.ru/help/en/work-with-rustore-api/api-upload-publication-app/create-draft-version
https://www.rustore.ru/help/work-with-rustore-api/api-upload-publication-app/apk-icon-upload

## 5. Web/PWA automation

- build signed/versioned artifact;
- validate manifest/Service Worker;
- deploy to staging;
- run entitlement and webhook smoke;
- generate production plan;
- production deploy requires explicit owner authorization.

## 6. Command safeguards

Every command:

- prints target environment/store/app/version;
- starts in dry-run;
- requires `--confirm-draft-upload` for draft upload;
- requires separate explicit human action for submit/release;
- checks clean branch and expected SHA;
- validates exact artifact checksum;
- prevents wrong app/store/environment;
- logs redacted audit;
- retries safely;
- rolls back/abandons transactional edit when possible;
- never accepts legal agreements;
- never modifies price/territories without owner-approved input;
- never uploads Disney/blocked assets.

## 7. One-command preparation

```text
npm run release:prepare:all
```

Must:

1. validate owner inputs;
2. validate secret references without revealing them;
3. refresh official requirements;
4. build all variants;
5. run release/moderation gates;
6. capture exact screenshots;
7. generate metadata/reviewer notes;
8. create review dossiers;
9. create draft-upload packages;
10. generate owner action report.

It does not submit or release.

## 8. Draft upload

```text
npm run release:upload:drafts -- --confirm-draft-upload
```

Only available when:

- owner authorizes;
- credentials exist;
- every internal gate passes;
- artifact hash matches;
- target app IDs match;
- production submission remains untriggered.

## 9. Final owner report

The command generates:

- what succeeded;
- what is already uploaded as draft;
- exactly which console actions remain;
- direct store section names;
- values to paste;
- screenshots/files to upload;
- status and blockers;
- no source-code instruction.
