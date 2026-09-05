# TRANSLATION ASSISTANCE AND AI/MT GOVERNANCE / УПРАВЛЕНИЕ ПЕРЕВОДОМ V12

## 1. Allowed role

Machine translation or an AI assistant may produce a draft only. It cannot
set `APPROVED`, publish content, choose a factual English name/title, waive
rights, approve child content or approve legal/store copy.

## 2. Prohibited inputs to external providers

Do not send without an approved data-processing/rights decision:

- child personal data or search history;
- reviewer/store credentials;
- private contracts;
- production secrets;
- unpublished licensed assets;
- support tickets with personal data;
- full copyrighted texts not permitted for processing;
- internal security reports.

Use redacted, minimum source segments and approved providers/configurations.

## 3. Provider registry

For every translation-assistance provider record:

- vendor/model/version;
- purpose;
- data sent;
- retention/training settings;
- region;
- contract/DPA;
- child-data prohibition;
- confidential-data prohibition;
- copyright/rights assessment;
- opt-out/disable path;
- cost and rate limits;
- last security/policy review.

The production application does not expose an open translation AI endpoint.

## 4. Draft provenance

A generated draft stores:

- provider and model/version;
- prompt/template version;
- source hash;
- glossary/TM version;
- generation date;
- protected spans;
- automated warnings;
- human review status.

Do not present generated text as a published edition title or quotation.

## 5. Human review

Mandatory independent review for:

- child safety;
- legal/privacy;
- purchases/refunds;
- writer biographies and factual claims;
- English names/work titles;
- quotations;
- store/reviewer materials;
- audio scripts.

Low-risk repetitive UI may use sampled second review only after terminology,
placeholder, context and layout tests pass; critical flows always receive
full review.

## 6. Automated checks

- semantic addition/omission/negation diff;
- numbers/dates/names/title parity;
- citation/link parity;
- glossary and banned-translation lint;
- plagiarism/overlap review where relevant;
- mixed-language detection;
- child reading-level check;
- layout and accessibility;
- rights and confidential-data scanner.

## 7. Cost and owner-minimal execution

Codex batches drafts, reuses approved translation memory and retranslates
only changed fields. The owner receives final reviewed artifacts and coverage
reports, not raw machine drafts or thousands of approval requests.

## 8. Release blocker

Raw provider output, undisclosed provider/data flow, confidential or child
data sent without approval, missing human review, altered fact, fake quote,
guessed title or provider policy conflict blocks publication.
