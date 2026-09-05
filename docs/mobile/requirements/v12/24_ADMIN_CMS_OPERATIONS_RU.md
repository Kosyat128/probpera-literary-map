# ADMIN, CMS, OWNER OPERATIONS AND SELF-SERVICE — V12

## 1. Goal

После handoff владелец должен развивать приложение без ручной правки
runtime-кода для стандартных операций. Existing admin/CMS remains the
canonical editorial control plane and is extended, not replaced.

## 2. Workspaces

Create logically separated, role-protected areas:

- Literary Content Studio;
- Child Review Studio;
- Journey/Planetka Studio;
- Character/StoryWorld Studio;
- Rights & Provenance Studio;
- Customization Studio;
- Store/Product Studio;
- Content Package/Release Studio;
- Health/Operations Studio;
- Support/Incident Studio.

## 3. Editorial workflow

States:

```text
draft → in-review → approved → scheduled → published → corrected/retired
```

For child/rights/licensed content require additional approvals and
fail-closed validations.

Owner can manage:

- countries/writers/works through canonical records;
- sources/evidence;
- portraits/covers/flags without generated replacement;
- child biography and exact age;
- works/characters/tasks/facts;
- translations;
- corrections and emergency unpublish.

## 4. Planetka/Journey Studio

- graph editor;
- canonical entity selectors;
- dialogue/script editor;
- source attachment;
- age/reading level;
- narration upload/transcript/rights;
- activity templates;
- preview per profile/platform;
- accessibility/reduced copy;
- publish/rollback;
- validation report.

## 5. Customization Studio

- item/bundle creation;
- skin/stand/background/accessory types;
- high/balanced/economy assets;
- preview;
- compatibility graph;
- included vs optional;
- platform SKU mapping;
- territory/language;
- child age/safety;
- rights/license/expiry;
- package size/performance;
- publish/delist/rollback.

## 6. Licensed/Disney Studio

- candidate records remain blocked;
- agreement metadata;
- approved assets/hashes;
- platforms/territories/languages;
- IAP/marketing/audio/3D rights;
- licensor approval evidence;
- royalty/reporting metadata;
- expiry alerts;
- post-term policy;
- controlled publication;
- emergency kill switch.

No rights record = no preview/SKU/publish.

## 7. Store and pricing operations

Owner can manage planning data without binary change:

- base price target by platform/territory;
- optional products;
- SKU status;
- included Starter Set;
- price snapshot/import;
- commercial availability;
- family-sharing policy;
- release notes;
- store metadata/screenshots;
- sandbox status;
- reconciliation status.

Actual store price/agreements remain console actions documented exactly.

## 8. Release Studio

- generate deterministic web/mobile/child packages;
- dry-run validations;
- signed manifest;
- staged rollout;
- schedule;
- minimum app version;
- package size;
- release notes;
- publish approval;
- rollback;
- previous verified versions;
- artifact/checksum inventory.

## 9. Operations dashboard

Display:

- current app/content versions;
- platform release status;
- package/update health;
- purchase verification/reconciliation;
- rights expiry;
- asset integrity;
- performance/error categories;
- backup/restore status;
- CI/release gate status;
- support incident status.

No child behavioural profile and no secrets.

## 10. Roles and security

- owner;
- administrator;
- editor;
- child reviewer;
- rights reviewer;
- translator;
- release operator;
- support read-only.

Least privilege, server authorization, audit log, MFA policy, transactional
writes, CAS/version conflict handling, autosave/recovery and no public
catalog leakage.

## 11. Dangerous actions

For publish, rollback, delete, revoke, delist, price mapping and license
changes:

- dry-run;
- preview/diff;
- validation;
- explicit confirmation;
- audit log;
- compensation/rollback when possible;
- no silent direct production mutation.

## 12. Manuals and automation

Generate Russian owner manuals and CLI commands for:

- add writer/work;
- approve child content;
- create journey;
- add skin/stand/background;
- create optional product;
- add licensed pack;
- publish content;
- rollback;
- build platforms;
- store submission;
- purchase reconciliation;
- backup/restore;
- incident response;
- support diagnostics.

## 13. Acceptance

- standard operations require no runtime-code editing;
- all publish paths fail-closed;
- owner can preview before publish;
- audit/rollback works;
- role boundaries tested;
- admin existing functions do not regress;
- docs match actual UI/commands.

## V12 localization workbench

The CMS must support translation units, source hashes, stale propagation,
glossary/translation-memory suggestions, protected names/dates/titles,
semantic-delta review, child reading-level review, rights review, localized
search aliases, transcripts/audio, device preview, locale package
publication and rollback. Publishing English content outside this workflow
is prohibited.
