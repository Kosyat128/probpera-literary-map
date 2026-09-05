# REVIEWER ACCESS AND CONTROLLED DEMO MODE — V12

## 1. Principle

A reviewer must reproduce every protected flow without contacting the
owner or spending real money. At the same time, the review mechanism must
not become a public bypass.

## 2. Review configuration

Create an environment-bound review configuration:

```text
REVIEW_MODE = disabled | store-review
```

Requirements:

- enabled only in signed review build or server allowlisted build identity;
- not discoverable from normal navigation;
- no universal master password in public source;
- no bypass of rights/child content;
- no grant of production entitlements;
- sandbox products only;
- logs clearly identify review environment;
- automatically invalid for unrelated production builds.

## 3. Reviewer account

If account features exist, create a durable account with:

- verified adult status;
- preloaded non-sensitive sample favorites/progress;
- no personal data;
- no MFA/OTP;
- password stored only in store review fields/secure owner vault;
- deletion test permitted;
- deterministic recreation procedure;
- periodic automated health check.

Do not embed credentials in binary or public Git.

## 4. Parent PIN

Create a review PIN reference:

- valid for review account/build;
- non-expiring during review;
- not the production owner PIN;
- delivered only through secure store review fields;
- supports testing wrong attempts/backoff;
- does not bypass exact-age filtering.

## 5. IAP sandbox

Prepare one optional non-consumable test item per store:

- visible to reviewer;
- low-risk original asset;
- no licensed character;
- clear path;
- price from sandbox;
- purchase/pending/cancel/restore documented;
- backend sandbox verification;
- safe fallback.

## 6. Access instruction format

Each step numbered, no ambiguity:

```text
1. Launch app.
2. Tap ...
3. Enter review PIN ...
4. Open ...
5. Select sandbox item ...
6. Restore at ...
```

Include expected result and recovery if network is unavailable.

## 7. Clean-install validation

Automated/manual test from:

- clean simulator/emulator;
- clean real device;
- external network;
- no owner cookies;
- no preinstalled content;
- supported locale;
- supported territory or documented review availability.

## 8. Reviewer video

Create a short unedited evidence video showing:

- launch;
- globe;
- country/writer;
- child mode;
- Parent Gate;
- adult store;
- sandbox item;
- restore;
- account deletion;
- offline fallback.

Video supplements instructions; it does not replace working access.

## 9. Failure handling

If review account/backend is unhealthy:

- pre-submission gate fails;
- owner is alerted;
- submission is blocked;
- no last-minute undocumented workaround;
- status page/diagnostic records the incident.

## 10. Security audit

Verify:

- no hardcoded credentials;
- review flag absent/disabled in public production;
- sandbox and production entitlements isolated;
- no access to owner/admin CMS;
- no ability to create arbitrary grants;
- no child/adult boundary bypass;
- all actions auditable and redacted.
