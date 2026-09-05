# MODERATION PRECHECK COMMANDS — V12

Codex must adapt command names to the real repository, then expose a
single root command:

```text
npm run mobile:moderation:check
```

## 1. Common checks

Suggested component commands:

```text
mobile:moderation:identity
mobile:moderation:site-parity
mobile:moderation:requirements
mobile:moderation:starter-set
mobile:moderation:child
mobile:moderation:parent-gate
mobile:moderation:rights
mobile:moderation:privacy
mobile:moderation:permissions
mobile:moderation:accounts
mobile:moderation:deletion
mobile:moderation:iap
mobile:moderation:screenshots
mobile:moderation:metadata
mobile:moderation:artifact
mobile:moderation:reproducibility
mobile:moderation:technical-smoke
```

## 2. Store checks

```text
mobile:moderation:apple
mobile:moderation:google-play
mobile:moderation:rustore
mobile:moderation:web-pwa
```

## 3. Expected fail-closed findings

Commands fail on:

- name/metadata over current limits;
- missing review instructions;
- expiring/inaccessible review account;
- child bypass;
- account without deletion;
- privacy mismatch;
- new undeclared permission;
- blocked asset bundled;
- concept screenshot;
- fake price;
- Disney term/asset without license;
- mixed store provider/link;
- wrong target/toolchain;
- public Google Play free-state risk;
- incomplete Starter Set;
- optional IAP not restorable;
- exact artifact mismatch;
- crash/blank globe/endless loader.

## 4. Report outputs

```text
reports/moderation/common/precheck.json
reports/moderation/app-store/precheck.json
reports/moderation/google-play/precheck.json
reports/moderation/rustore/precheck.json
reports/moderation/web-pwa/precheck.json
reports/moderation/MODERATION_SCORECARD.md
```

Each report includes command, SHA, build identity, status and evidence
links.

## 5. CI

Add protected jobs:

- moderation-common;
- moderation-app-store;
- moderation-google-play;
- moderation-rustore;
- moderation-web-pwa.

Store-console-only conditions may be `BLOCKED_EXTERNAL`, never silently
green. Internal code/metadata/test failures remain red.

## 6. Final command

`mobile:release:check` must depend on moderation checks before generating
FINAL HANDOFF.
