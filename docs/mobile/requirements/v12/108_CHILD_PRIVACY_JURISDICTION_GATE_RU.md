# CHILD PRIVACY JURISDICTION GATE — V12

## 1. Safe default

The first native release is accountless-first and keeps child profiles,
age, favorites, history and progress local by default.

This design intentionally minimizes the need to collect personal data
from a child and reduces, but does not automatically eliminate, legal
obligations in every territory.

No cloud child sync, child email, child phone, child photo, exact birth
date, location, advertising ID, behavioural analytics, open chat, voice
upload or targeted advertising is enabled in `SAFE_PAID_BILINGUAL_V1`.

## 2. Territory-based legal gate

Before enabling a public territory, Codex creates a jurisdiction worksheet
from current official sources and the exact release data flow.

The worksheet determines:

- whether the service is child-directed or likely to be accessed by
  children;
- whether child personal data is collected;
- whether consent is the legal basis;
- parental-consent threshold;
- age-assurance requirements;
- child-friendly notice requirements;
- data minimization/retention;
- parental access/deletion rights;
- default-high-privacy settings;
- DPIA or equivalent assessment;
- contractual capacity for a paid service;
- store/Families/Kids obligations.

Codex does not make the final legal conclusion. It prepares the factual
data-flow and legal-question matrix for owner/legal approval.

## 3. United States / COPPA

If the service is directed to children under 13, or has actual knowledge
that it collects personal information from a child under 13, a COPPA
review is mandatory.

Default V12 response:

- no child cloud account;
- no targeted advertising;
- no third-party child analytics;
- no unnecessary collection;
- local-only child profile;
- parent controls deletion;
- no child free-text upload.

If any online child personal-information collection is enabled, release to
the United States is blocked until:

- clear child privacy notice;
- direct parent notice;
- verifiable parental consent where required;
- parent access/deletion controls;
- data minimization;
- retention/deletion schedule;
- service-provider review;
- security controls;
- legal approval.

Official sources:
https://www.ftc.gov/news-events/topics/protecting-consumer-privacy-security/kids-privacy-coppa
https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions
https://www.ftc.gov/news-events/news/press-releases/2025/01/ftc-finalizes-changes-childrens-privacy-rule-limiting-companies-ability-monetize-kids-data

## 4. European Union / GDPR

When processing relies on consent for an information-society service
offered directly to a child, the parental-consent threshold varies by
Member State between 13 and 16.

The release gate records the threshold for every enabled Member State and
does not use one EU-wide guessed age.

Required:

- child-friendly clear language;
- lawful-basis assessment;
- privacy by default;
- minimization;
- parental-consent workflow if needed;
- age-assurance proportionality;
- deletion/access;
- processor/SDK review;
- DPIA/legal review when applicable.

Official source:
https://commission.europa.eu/law/law-topic/data-protection/information-business-and-organisations/legal-grounds-processing-data/are-there-any-specific-safeguards-data-about-children_en

## 5. France

For relevant consent-based online processing, France uses an age threshold
of 15; below that, the child and holder of parental responsibility may
need to consent jointly, depending on the processing and legal basis.

`SAFE_PAID_BILINGUAL_V1` keeps child data local and disables optional cloud/consent
features by default. France is not enabled as a public territory until
the owner/legal reviewer confirms:

- child data flows;
- lawful bases;
- age/parent consent logic if applicable;
- paid-service contractual capacity;
- privacy notices;
- deletion;
- Apple encryption/export compliance where relevant.

Official sources:
https://www.cnil.fr/en/recommendation-1-regulate-capacity-children-act-online
https://cnil.fr/fr/node/241
https://www.cnil.fr/fr/les-bases-legales/consentement

## 6. United Kingdom

For online services likely to be accessed by children, the UK Children’s
Code / Age Appropriate Design Code must be assessed.

Default V12 alignment:

- best interests of the child;
- high privacy by default;
- minimum data;
- no profiling/ads;
- geolocation off;
- age-appropriate explanations;
- parent tools;
- no nudges to weaken privacy;
- DPIA/legal review;
- developmental-stage UX.

The current ICO guidance must be rechecked because guidance may change.

Official sources:
https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/standards-of-age-appropriate-design/
https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/3-age-appropriate-application/

## 7. Paid application and child contracts

A child profile is not the purchaser.

- the adult/store account purchases the application;
- optional purchases require Parent Gate;
- the child does not enter a contract or payment data;
- child UI does not show price or persuasive upsell;
- no “ask your parent to buy now” pressure;
- store family features do not replace in-app child safety.

The owner/legal reviewer confirms consumer-contract and family-use wording
for each territory.

## 8. Feature escalation

Any of these features reopens the child privacy gate:

- child cloud sync;
- child account;
- public profile;
- messaging/chat;
- voice/photo upload;
- notifications targeted to the child;
- behavioural personalization;
- third-party analytics;
- advertising;
- social sharing;
- school/classroom accounts;
- precise location;
- AI service receiving child input.

Remote config cannot enable such a feature without:

- app update/review where required;
- owner approval;
- privacy/legal update;
- store declaration update;
- child safety tests;
- territory matrix update.

## 9. Evidence

Create:

- `reports/legal/child-data-flow.json`;
- `reports/legal/child-jurisdiction-matrix.csv`;
- `reports/legal/child-notice-readability.json`;
- `reports/legal/child-retention.json`;
- `reports/legal/parental-consent-decision.json`;
- `reports/legal/child-dpia-or-assessment.md`;
- owner/legal approval reference.

## 10. Release blocker

A territory is blocked if:

- child data flow is unknown;
- child-directed status is not assessed;
- required parental consent is absent;
- child notice is not age appropriate;
- account/deletion flow is incomplete;
- SDK collects undeclared child data;
- behavioural ads/profiling are present;
- local-only claim differs from actual network behavior;
- owner/legal approval is missing for an applicable requirement.
