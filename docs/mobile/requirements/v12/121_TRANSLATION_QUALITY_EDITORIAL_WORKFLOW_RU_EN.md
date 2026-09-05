# TRANSLATION QUALITY AND EDITORIAL WORKFLOW / КАЧЕСТВО ПЕРЕВОДА

## 1. Principle

English text must read as authored English while preserving every factual
claim of the canonical source. Translation is not permission to rewrite,
embellish or “improve” historical facts.

## 2. Translation unit lifecycle

```text
MISSING
→ DRAFT_GENERATED
→ TERMINOLOGY_CHECKED
→ SEMANTIC_REVIEWED
→ RIGHTS_CHECKED
→ AGE_REVIEWED (when applicable)
→ LAYOUT_TESTED
→ APPROVED
→ PUBLISHED
```

Source change moves translation to `STALE` and removes it from the next
English package until re-approved. `BLOCKED_RIGHTS` never publishes.

## 3. Multi-pass process

Pass A — source normalization:

- immutable source hash;
- factual fields separated from prose;
- citations/links preserved;
- names, dates, titles and quotations marked as protected spans.

Pass B — draft:

- follow glossary;
- use clear international English with en-US base spelling;
- preserve tone and paragraph structure where appropriate;
- no extra facts.

Pass C — structured checks:

- placeholders and markup;
- names/dates/numbers;
- hyperlinks/citation IDs;
- quotation boundaries;
- glossary consistency;
- banned literal mistranslations;
- no lost negation;
- no changed award/title/status.

Pass D — independent semantic review:

- compare propositions source vs target;
- report omissions/additions/uncertainty;
- back-translation or meaning graph diff;
- resolve every high-severity delta.

Pass E — audience/style:

- adult clarity;
- age-banded child readability;
- Planetka natural speech;
- no patronizing language;
- no unsupported educational claim.

Pass F — UI/context:

- actual screen preview;
- truncation;
- VoiceOver/TalkBack;
- offline/error states;
- screenshots.

## 4. Publication classes

- Critical UI, legal, commerce, privacy and child safety: independent
  review required.
- Writer biographies and facts: semantic/fact parity review required.
- Proper names and published titles: authoritative-source verification.
- Decorative microcopy: glossary + context review.
- Store descriptions: owner approval and exact-build truth check.

Codex performs all draft and QA work and produces a compact owner approval
summary. The owner is not asked to translate individual strings.

## 5. English style

- plain, precise, internationally understandable English;
- en-US spelling in shared app catalog unless term is a proper title;
- no excessive title case;
- short direct controls;
- avoid Russian syntactic calques;
- preserve literary terminology consistently;
- do not translate official award names arbitrarily;
- use an em dash, quotation style and punctuation consistently according to
  the English style guide;
- Planetka remains a proper name.

## 6. Child readability

For child content record:

- age band;
- sentence length;
- vocabulary difficulty;
- sensitive concepts;
- pronunciation notes;
- narration duration;
- comprehension goal.

Automated readability scores are advisory, not the only age decision.
Editorial allowlists remain authoritative.

## 7. Legal translation

Legal/privacy/support English is generated from the approved factual data
inventory, then requires owner/legal approval. Declare controlling language
and update both versions together. A translation cannot promise rights or
data practices the product does not implement.

## 8. Metrics

Release reports include:

- total units;
- approved/published/stale/blocked/missing;
- coverage by screen/domain/content type;
- glossary violations;
- semantic-delta severity;
- hardcoded strings;
- untranslated Cyrillic in English UI;
- unexpected Latin placeholders in Russian UI;
- source/target length outliers;
- owner/legal pending items.

## 9. Failures

P0 examples:

- changed date, country or award;
- invented title or quotation;
- missing “not”;
- wrong writer identity;
- child safety meaning weakened;
- purchase/legal statement changed;
- citation points to another claim;
- raw machine output published;
- source changed after approval.
