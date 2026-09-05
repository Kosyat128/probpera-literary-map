# BILINGUAL LEGAL AND CONTROLLING-LANGUAGE CONTRACT / ЮРИДИЧЕСКИЕ ТЕКСТЫ

## 1. Required documents

Maintain synchronized Russian and English versions of:

- Privacy Policy;
- Terms/User Agreement;
- paid-sale and optional-IAP explanation;
- refund/cancellation information;
- account and data deletion notice;
- child privacy notice;
- support/contact notice;
- rights/attribution notice;
- custom EULA only when owner/legal chooses one.

## 2. Controlling language

The owner/legal reviewer must explicitly select the controlling language or
territory-specific rule. The user-facing English version must clearly state
that rule where legally appropriate. A controlling-language clause does not
permit an inaccurate translation.

## 3. Version synchronization

Each legal document records:

- document ID;
- `ru` and `en` version;
- effective date;
- source hash;
- translator/reviewer;
- legal approval;
- applicable platforms/territories;
- change summary;
- archived previous version;
- acceptance/re-consent decision where applicable.

One language cannot be updated without marking the other `STALE` and
blocking rollout in territories that require the stale version.

## 4. Meaning parity

Automated and human checks compare:

- data categories and purposes;
- processors/third parties;
- child-data statements;
- purchase/subscription/no-ads claims;
- retention and deletion;
- support and response times;
- governing law/jurisdiction;
- rights and disclaimers;
- refund terms;
- accountless-first behavior.

English marketing or legal copy may not promise broader offline access,
rights, support, refunds, family sharing or cross-store ownership than the
Russian version and actual product.

## 5. Child-facing notices

Provide age-appropriate English and Russian explanations. Parent-facing
legal detail remains accessible. No child notice is hidden behind adult-only
legal jargon. Child notice translation undergoes child readability review.

## 6. Store-specific presentation

Generate the correct format for App Store, Google Play, RuStore and Web/PWA.
Apple custom EULA localization, when used, is prepared as required by the
current App Store Connect workflow. Store declarations and public pages
reference the same approved document versions.

## 7. Owner burden

Codex creates side-by-side diffs, parity reports and final documents. The
owner/legal reviewer approves a concise report; the owner is never asked to
translate legal clauses manually.

## 8. Release blocker

A stale locale, missing controlling-language decision, weaker privacy/deletion
promise, different paid model, untranslated child notice, broken public URL,
wrong territory or unapproved legal version blocks that locale/territory.
