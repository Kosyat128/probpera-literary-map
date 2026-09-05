# REJECTION AND RESUBMISSION PLAYBOOK — V12

## 1. Purpose

Store rejection is handled as a controlled incident, not as an improvised
conversation. Preserve evidence, fix the root cause and prevent recurrence.

## 2. Intake

Immediately record:

- store;
- app/version/build;
- submission ID;
- date/time;
- reviewer message verbatim;
- cited rule;
- screenshots/video attached by reviewer;
- metadata and binary actually submitted;
- reviewer account state;
- backend/content versions;
- current store-console configuration;
- response deadline, if any.

Do not paraphrase away details.

## 3. Classification

One primary class and optional secondary classes:

- ACCESS
- STABILITY
- BROKEN_FUNCTIONALITY
- METADATA_TRUTH
- AGE_RATING
- TARGET_AUDIENCE
- CHILD_SAFETY
- PARENT_GATE
- PRIVACY_DATA_SAFETY
- ACCOUNT_DELETION
- PERMISSIONS
- PAYMENT_IAP
- PAID_APP_CONFIGURATION
- INTELLECTUAL_PROPERTY
- SPAM_MINIMUM_FUNCTIONALITY
- TOOLCHAIN_SDK
- STORE_LINKS
- SIGNING_VERSIONING
- POLICY_AMBIGUITY
- FALSE_POSITIVE_OR_REVIEWER_MISUNDERSTANDING

## 4. Reproduction

- Checkout the exact submitted SHA.
- Restore exact environment/content/catalog.
- Install exact artifact.
- Use the same reviewer instructions.
- Reproduce on equivalent device/OS/locale/network.
- Capture evidence.
- If not reproducible, still test plausible paths and verify reviewer
  account/backend health at rejection time.

## 5. Remediation rule

Fix the root cause. Examples:

- reviewer cannot login → durable access automation, not a temporary SMS;
- screenshot mismatch → recapture exact build, not argue about mockup;
- adult leak → fix pre-render policy and add bypass tests;
- unlicensed asset → remove it from binary/manifests and prove scan;
- privacy mismatch → correct code/data flow and declarations;
- IAP unavailable → fix product/store/backend configuration and sandbox;
- crash → fix, regression test, new build;
- unclear behavior → improve UI and notes only if the behavior is valid.

Never hide noncompliant functionality only during review.

## 6. Change control

Every rejection creates:

- tracked issue;
- owner;
- severity;
- root-cause analysis;
- affected requirements;
- code/metadata/legal fix;
- regression test;
- new build number where binary changes;
- updated checksum;
- updated review dossier;
- updated rejection ledger.

## 7. Response style

- factual;
- respectful;
- concise;
- acknowledge actual issue;
- cite exact fix and path;
- provide new steps;
- avoid emotional argument;
- avoid unsupported legal claims;
- do not claim rights without evidence;
- do not expose confidential credentials in ordinary message fields.

## 8. Response cases

### Code fixed
State:
- old build;
- issue;
- new build;
- exact behavior;
- testing path.

### Metadata fixed
State:
- field corrected;
- misleading claim removed;
- screenshots recaptured;
- binary unchanged or identify new build if changed.

### Rights evidence supplied
State:
- rights holder;
- scope;
- platform/territory/term;
- secure attachment/reference;
- exact assets.

### False positive
Explain exact steps and evidence, while remaining willing to adjust
review access or UI. Do not merely say “it works for us.”

## 9. Resubmission gate

Before resubmission:

- affected test green;
- full critical smoke green;
- reviewer account health green;
- declarations synchronized;
- screenshots match;
- build number incremented where required;
- artifact rescanned;
- rights scan green;
- notes updated;
- owner approves response.

## 10. Rejection ledger

Maintain:

```text
reports/moderation/rejections/ledger.csv
```

Fields:

- ID;
- store;
- version/build;
- date;
- rule;
- class;
- root cause;
- fix;
- regression test;
- response;
- resubmission;
- outcome;
- prevention action.

Future release prechecks include all prior prevention actions.

## 11. Escalation

Escalate to owner/legal when:

- license scope disputed;
- store requests confidential agreement;
- payment/legal entity issue;
- target audience strategic change;
- Kids Category decision;
- package/bundle identity conflict;
- Google Play package already publicly free;
- policy interpretation materially changes business model.

## 12. Completion

A rejection is closed only after:

- approval, or
- owner explicitly withdraws submission, or
- documented product strategy change.

“Response sent” is not resolution.
