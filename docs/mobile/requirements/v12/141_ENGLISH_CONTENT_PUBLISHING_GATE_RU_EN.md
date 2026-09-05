# ENGLISH CONTENT PUBLISHING GATE / ПУБЛИКАЦИЯ АНГЛИЙСКОГО КОНТЕНТА

English release package generation fails unless:

- all Base Edition translation units are APPROVED/PUBLISHED;
- source hashes match current Russian canonical fields;
- writer names and work-title strategies are verified;
- citations, URLs, dates, numbers and protected spans match;
- glossary violations = 0 P0/P1;
- semantic delta = 0 high severity;
- child age review is complete;
- rights status is approved;
- screenshots/layout/accessibility tests pass;
- search aliases and offline indexes are current;
- legal/support/store texts have owner approval;
- no raw machine translation or placeholder key is reachable.

Optional packs can be enabled independently by locale. A missing English
optional pack does not block the Russian Base Edition, but it must be
invisible to English users and absent from English store claims.

Generate:

```text
reports/i18n/english-release-gate.json
reports/i18n/base-edition-coverage.csv
reports/i18n/stale-translations.csv
reports/i18n/name-title-verification.csv
reports/i18n/semantic-deltas.json
reports/i18n/layout-accessibility.json
reports/i18n/store-legal-support-coverage.json
```

No owner action may be used to waive a factual, child-safety, rights or
critical-UI translation failure.
