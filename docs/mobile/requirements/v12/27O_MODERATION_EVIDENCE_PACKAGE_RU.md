# MODERATION EVIDENCE PACKAGE — V12

## 1. Directory structure

```text
reports/moderation/
  common/
  app-store/<version-build>/
  google-play/<version-build>/
  rustore/<version-build>/
  web-pwa/<version-build>/
  rejections/
```

## 2. Common evidence

- canonical site/globe parity;
- requirements traceability;
- release test summary;
- rights manifest;
- privacy data inventory;
- permission inventory;
- age-content inventory;
- child boundary report;
- account deletion test;
- Starter Set completeness;
- optional-purchase verification;
- artifact checksums;
- SBOM/dependency/secret scans;
- known limitations.

## 3. Per-store evidence

- exact binary identity;
- signing status;
- toolchain;
- store provider;
- screenshots;
- metadata snapshot;
- review credentials health;
- Parent PIN test;
- sandbox SKU test;
- account deletion route;
- privacy declaration snapshot;
- target audience/age rating;
- rights summary;
- competing-store link scan;
- installation/update video;
- review notes.

## 4. Evidence properties

Each evidence item:

- generatedAt;
- build SHA;
- content version;
- command/tool;
- environment;
- reviewer;
- result;
- checksum;
- expiry/recheck date.

## 5. Confidentiality

Do not commit:

- passwords;
- PIN plaintext;
- private keys;
- contracts with confidential terms;
- raw receipts/tokens;
- merchant secrets;
- personal tax/banking information.

Commit only secure references and redacted summaries.

## 6. Owner review bundle

Generate a small nontechnical summary:

- green/red status;
- what owner must do;
- what to upload;
- where to paste notes;
- price/category/age decisions;
- final screenshots;
- external blockers;
- rollback/rejection steps.

## 7. Retention

Keep moderation evidence per released version long enough for:

- appeal;
- resubmission;
- incident;
- rights audit;
- privacy audit;
- reproducibility.

Apply owner-approved retention policy.

## 8. Acceptance

Submission blocked if evidence references a different artifact or content
version than the one being submitted.
