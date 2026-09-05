# BILINGUAL EDITORIAL CORRECTION WORKFLOW / ИСПРАВЛЕНИЯ RU/EN V12

## 1. Purpose

Allow factual or translation corrections without turning the application
into an unmoderated user-generated-content platform.

## 2. User report

Adult users may submit a structured correction report through support. In
child mode, the action is behind Parent Gate and addressed to the adult.
Collect the minimum: entity/field, active locale, issue category, optional
comment and contact only when the adult chooses follow-up.

Do not publicly display reports, comments or reporter identity. No automatic
publication or community voting.

## 3. Categories

- factual error;
- wrong English/Russian name or title;
- mistranslation/omission;
- broken citation/link;
- age suitability;
- rights/attribution;
- accessibility/layout;
- pronunciation/audio;
- search alias;
- legal/support text.

## 4. Editorial handling

1. Create immutable report ID.
2. Preserve entity ID, locale, app/content versions and source hash.
3. Triage factual/translation/child/rights/legal owner.
4. Verify against authoritative evidence.
5. Update canonical Russian fact if necessary.
6. Mark dependent English translation stale.
7. Review both languages, search aliases, child policy and offline packages.
8. Publish atomically with audit trail.
9. Notify the adult reporter only when consent/contact exists.

## 5. Emergency removal

A rights, child-safety or serious factual issue may hide the affected item
through a signed content manifest while preserving a safe fallback. Do not
replace it with unreviewed machine translation or a generated portrait.

## 6. Metrics and privacy

Track issue category, time to resolution and affected locale without child
profiling. Redact personal data and apply retention. Reports are not training
data for external translation providers by default.

## 7. Release blocker

A critical confirmed error, stale dependent translation, broken source hash,
child-safety conflict or rights issue remains blocked until all affected
locale packages, search indexes, screenshots/store claims and evidence are
updated.
