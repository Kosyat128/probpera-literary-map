# ONE-COMMAND RELEASE PREPARATION — V12

## Main command

```bash
npm run release:prepare:all
```

Codex must implement an equivalent command for the repository package
manager.

It performs no production submission.
It does not submit or release.

## Flow

1. Verify clean branch and expected main/base.
2. Validate `owner-release-inputs.json`.
3. Print one consolidated missing-owner-input report.
4. Validate secret references without printing values.
5. Refresh official store/platform requirements.
6. Recheck open PR/branch protection/current dependencies.
7. Generate SAFE_PAID_BILINGUAL_V1 configuration.
8. Build Web/PWA, Google Play, RuStore and iOS/iPadOS variants.
9. Run canonical site/globe/content parity.
10. Run child/Parent Gate/age-policy tests.
11. Run Starter Set and optional product tests.
12. Run rights and blocked-IP binary scan.
13. Run privacy/SDK/network/permission audit.
14. Run DSA/export/developer-verification checks.
15. Run technical and device moderation smoke.
16. Generate exact-build screenshots.
17. Generate store metadata/declarations/reviewer notes.
18. Generate review dossiers.
19. Generate draft-upload packages and commands.
20. Generate FINAL_OWNER_APPROVAL report.
21. Generate FINAL_OWNER_ACTIONS report.
22. Freeze hashes.

## Exit states

- `READY_INTERNAL`
- `BLOCKED_OWNER_INPUT`
- `BLOCKED_STORE_ACCOUNT`
- `BLOCKED_SIGNING`
- `BLOCKED_LEGAL`
- `BLOCKED_RIGHTS`
- `BLOCKED_INTERNAL`

Only real external missing items may use external blocker states.
Any code/test/asset/metadata mismatch is `BLOCKED_INTERNAL`.

## Draft upload

```bash
npm run release:upload:drafts -- --confirm-draft-upload
```

Must not:

- submit for review;
- publish;
- change public price/territories without approved input;
- accept agreements;
- enable Disney;
- deploy production Web/PWA;
- merge main.

## Final generated owner folder

```text
artifacts/owner-handoff/
  00_READ_ME_FIRST_RU.md
  FINAL_OWNER_APPROVAL_RU.html
  FINAL_OWNER_APPROVAL_RU.md
  MISSING_INPUTS_RU.md
  SECRETS_TO_ADD_RU.md
  STORE_CONSOLE_STEPS_RU.md
  APP_STORE_UPLOAD/
  GOOGLE_PLAY_UPLOAD/
  RUSTORE_UPLOAD/
  WEB_PWA_DEPLOY/
  REVIEW_NOTES/
  SCREENSHOTS/
  LEGAL/
  RIGHTS/
  BUILD_CHECKSUMS.txt
  RELEASE_STATUS.json
```

The owner should not need to browse the repository to find deliverables.
