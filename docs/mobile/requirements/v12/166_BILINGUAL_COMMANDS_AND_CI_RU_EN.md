# BILINGUAL COMMANDS AND CI CONTRACT / КОМАНДЫ V12

Codex must expose repository-appropriate equivalents of:

```text
bilingual:official:refresh
bilingual:catalogs:extract
bilingual:types
bilingual:hardcoded
bilingual:placeholders
bilingual:icu
bilingual:glossary
bilingual:provider-audit
bilingual:semantic-diff
bilingual:names-titles
bilingual:search-aliases
bilingual:child
bilingual:planetka
bilingual:audio
bilingual:offline
bilingual:native
bilingual:web-seo
bilingual:legal-parity
bilingual:support
bilingual:screenshots
bilingual:store-fields
bilingual:evidence
bilingual:handoff
bilingual:all
```

Every command:

- records app/content/catalog/source hashes;
- emits JSON plus concise human output;
- redacts credentials and personal data;
- exits nonzero for a blocking mismatch;
- supports deterministic `--check` where possible;
- does not publish content, upload stores or change production by default.

CI jobs:

```text
bilingual-static
bilingual-content
bilingual-child
bilingual-native
bilingual-web-seo
bilingual-store-legal-support
bilingual-exact-rc
bilingual-final
```

`bilingual:all` fails when any applicable BIL requirement, translation
quality target, legal/support parity, store localization, exact screenshot,
English offline package, name/title evidence or owner handoff is incomplete.

A store-account/legal external blocker may prevent final console action, but
it cannot turn a missing translation, broken search, stale legal text or
mixed-language screen green.
