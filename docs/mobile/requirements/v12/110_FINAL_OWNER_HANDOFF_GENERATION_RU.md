# FINAL OWNER HANDOFF GENERATION CONTRACT — V12

## 1. Objective

At the end of Codex work the owner must receive a self-contained folder
that can be understood without reading the repository or the 20,000-line
master specification.

## 2. Mandatory folder

```text
artifacts/owner-handoff/
  00_READ_ME_FIRST_RU.md
  01_FINAL_OWNER_APPROVAL_RU.html
  02_FINAL_OWNER_APPROVAL_RU.md
  03_ONLY_REMAINING_ACTIONS_RU.md
  04_MISSING_OWNER_INPUTS_RU.md
  05_SECRETS_TO_ADD_RU.md
  06_STORE_ACCOUNTS_AND_AGREEMENTS_RU.md
  07_PRICES_AND_TERRITORIES_RU.md
  08_LEGAL_PRIVACY_RIGHTS_RU.md
  09_APP_STORE_STEP_BY_STEP_RU.md
  10_GOOGLE_PLAY_STEP_BY_STEP_RU.md
  11_RUSTORE_STEP_BY_STEP_RU.md
  12_WEB_PWA_STEP_BY_STEP_RU.md
  13_REVIEWER_CREDENTIALS_HEALTH_RU.md
  14_SCREENSHOTS_APPROVAL/
  15_RELEASE_ARTIFACTS/
  16_REVIEW_DOSSIERS/
  17_DRAFT_UPLOAD_COMMANDS_RU.md
  18_SUBMIT_AND_RELEASE_BUTTONS_RU.md
  19_REJECTION_RESPONSE_RU.md
  20_FIRST_72_HOURS_RU.md
  BUILD_CHECKSUMS.txt
  RELEASE_STATUS.json
```

## 3. Read-me format

The first page answers:

- what is ready;
- what is not externally possible yet;
- exact current release status;
- which seven owner actions remain;
- which action is first;
- where to click;
- which file to upload;
- which value to paste;
- where the secret goes;
- what not to do;
- who/what blocks submission.

## 4. No technical burden

The owner instructions must not say:

- edit this source file;
- run an undocumented script;
- calculate a hash;
- modify JSON manually in five places;
- determine target SDK;
- investigate an SDK;
- inspect an APK;
- create screenshots;
- write privacy answers from scratch;
- invent App Review Notes;
- search for the correct artifact.

Codex creates those artifacts and only asks for approval or external
credentials/actions.

## 5. Direct console assistance

For every manual field show:

- platform;
- console section;
- field label;
- exact prepared value;
- current limit;
- source/evidence;
- whether sensitive;
- whether owner approval is required;
- screenshot illustrating the section when safe;
- official help source.

Do not fabricate direct URLs to private console pages if unstable.

## 6. Owner approvals

The HTML approval report:

- is printable;
- works offline;
- contains previews;
- has approve/reject/notes controls;
- exports signed/hashable JSON or a clear manual approval record;
- contains no secret values;
- clearly distinguishes technical PASS from owner/legal pending.

## 7. Final status honesty

Possible final states:

- `BLOCKED_INTERNAL` — Codex must continue fixing.
- `BLOCKED_OWNER_INPUT` — one owner input is missing.
- `BLOCKED_STORE_ACCOUNT`
- `BLOCKED_SIGNING`
- `BLOCKED_LEGAL`
- `BLOCKED_RIGHTS`
- `READY_INTERNAL`
- `DRAFT_UPLOAD_READY`
- `DRAFT_UPLOADED`
- `READY_FOR_MANUAL_SUBMISSION`
- `SUBMITTED`
- `APPROVED`
- `RELEASED`

Codex cannot label APPROVED/RELEASED without actual store evidence.

## 8. Handoff acceptance

The handoff is complete only if a nontechnical owner can:

1. identify missing items in under five minutes;
2. find each store artifact immediately;
3. approve screenshots and texts;
4. add secrets without exposing them;
5. perform draft upload or use generated automation;
6. click the manual submission steps;
7. send a prepared rejection response;
8. monitor the first 72 hours.

Test the handoff with a fresh reader or structured usability review.

## 10. Bilingual final handoff

The owner handoff must additionally contain:

- `00_READ_ME_FIRST_RU_EN.md`;
- complete Russian and English product identity;
- English Base Edition coverage report;
- translation quality/stale/name-title reports;
- Russian and English screenshot folders;
- App Store en-US and Russian localizations;
- Google en-US default and ru-RU translation;
- RuStore Russian moderator note plus English backup;
- English Privacy/Terms/Support/deletion URLs;
- English reviewer notes;
- `134_AFTER_FULL_BUILD_APPLICATION_OWNER_ACTIONS_EN.txt`;
- bilingual owner approval HTML;
- final bilingual metrics and publishing gate.

The owner must not be asked to translate UI, content, legal text, store
metadata or reviewer notes.

## V12 bilingual handoff contents

The owner handoff folder must contain both Russian and English:

- application/store identity;
- exact-build screenshots;
- store descriptions and release notes;
- reviewer paths and button labels;
- legal/support URL inventory;
- English content coverage and stale-translation reports;
- writer-name and work-title evidence;
- search alias evidence;
- audio/transcript evidence;
- web SEO/hreflang evidence;
- post-build owner guides.

The owner is not asked to translate or proofread raw catalogs manually.
Only concise owner/legal approval of already reviewed artifacts remains.
