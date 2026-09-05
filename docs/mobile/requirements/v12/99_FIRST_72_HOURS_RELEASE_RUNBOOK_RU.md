# FIRST 72 HOURS RELEASE RUNBOOK — V12

## Before release

- store status approved;
- exact artifact retained;
- rollback/hotfix branch ready;
- support contact monitored;
- dashboards/alerts ready;
- optional product kill switch tested;
- content-package rollback tested;
- no remote flag can enable unreviewed Disney/account/analytics;
- owner approves manual or staged release.

## Hour 0–2

Monitor:

- installation/launch;
- crash/ANR;
- black globe/WebGL recovery;
- purchase verification;
- restore;
- content package;
- account deletion if enabled;
- support messages;
- store status.

Do not change remote behavior unless responding to an incident.

## Hour 2–24

Review:

- crash-free sessions;
- slow starts;
- device-specific failures;
- RuStore/Play/App Store variant routing;
- localized listing correctness;
- refunds/payment errors;
- child/Parent Gate reports;
- CDN/backend health;
- privacy/deletion URLs.

Pause staged rollout for any P0/P1.

## Day 2–3

- compare store and backend data;
- process support;
- identify common UX problems;
- confirm no rights/territory issue;
- prepare patch only if necessary;
- keep first release scope stable;
- do not enable extra IAP/Disney/analytics merely because release succeeded.

## P0 examples

- child adult-content leak;
- purchase self-grant or duplicate charge;
- account deletion broken;
- unlicensed asset exposed;
- widespread crash/black globe;
- data loss;
- secret leak.

Action:

1. pause rollout;
2. disable optional content if possible;
3. preserve evidence;
4. activate incident playbook;
5. prepare minimal fix;
6. notify owner/legal/store as needed.

## Owner dashboard

Show:

- platform/version/build;
- rollout percentage;
- store status;
- crash/ANR;
- backend/CDN;
- purchase verification;
- support queue;
- open incidents;
- rights expiry;
- next recommended action.

No child personal data in dashboard.
