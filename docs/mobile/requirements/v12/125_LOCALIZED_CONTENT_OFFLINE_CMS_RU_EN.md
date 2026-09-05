# LOCALIZED CONTENT, OFFLINE AND CMS / КОНТЕНТ, ОФЛАЙН И АДМИНКА

## 1. Locale-neutral core

Facts and entity identity are language-neutral. Prose and display fields are
localized. One writer/work/country record owns Russian and English views.

## 2. Content fields

Each localizable field records:

- entity ID;
- field path;
- source locale/value/hash;
- target locale/value;
- glossary version;
- translation memory version;
- status;
- reviewer;
- source references;
- rights;
- age review;
- published version;
- stale reason.

## 3. Base Edition English gate

Before public English release:

- every included country has English display/context;
- every included writer has verified English name and biography;
- every included work has a verified title strategy and description;
- every child-allowed item has child-reviewed English text;
- every journey/fact/task is complete;
- every included customization item is localized;
- every offline critical state is localized;
- no English search result opens a Russian-only critical page.

Coverage target is 100%, not “most”.

## 4. Optional content

An optional pack is independently enabled per locale. A pack may remain
available in Russian and hidden in English until English text, store
metadata, audio and rights are complete. The UI must not advertise it to an
English user before availability.

## 5. Offline packages

Package structure separates:

- common binary/3D/image assets;
- Russian text/search/audio;
- English text/search/audio;
- child subsets;
- optional pack subsets.

Downloads are resumable, signed, checksummed and atomic. Locale switch may
prompt to download the new language pack but retains common assets. Keep an
embedded bilingual emergency/help catalog.

## 6. Search index

Build separate policy-filtered locale indexes sharing entity IDs. Include
cross-language verified aliases. Index version must match content and child
policy versions.

## 7. CMS translation workbench

Admin features:

- source/target side-by-side;
- source diff and stale highlight;
- glossary suggestions;
- protected names/dates/titles;
- translation-memory matches;
- citation/link parity;
- semantic-delta report;
- child reading-level preview;
- desktop/phone/tablet preview;
- search alias editor;
- audio/transcript attachment;
- bulk draft generation;
- bulk validation;
- approval queue;
- rollback;
- audit trail;
- locale package publishing.

## 8. Roles

Separate permissions:

- translator/drafter;
- factual reviewer;
- child reviewer;
- rights reviewer;
- legal approver;
- publisher.

One user may hold multiple roles, but the audit trail records each decision.
Dangerous bulk publication requires preview/dry-run.

## 9. Source updates

When Russian source changes:

- calculate field-level diff;
- mark only affected English units stale;
- remove stale unit from next package or retain last approved version with a
  visible internal warning, according to policy;
- do not silently machine-update production;
- re-run citations, age and layout checks.

## 10. Backup and rollback

Back up translation memory, glossary, localized content, audio and approval
history. A locale package can roll back independently without rolling back
the application binary or Russian content.
