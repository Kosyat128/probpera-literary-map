# FINAL EXECUTION AND STOP CONDITIONS — V12

## 1. Codex may stop as COMPLETE only after S00–S40

A session limit is not project completion. At a limit, write a checkpoint
and resume.

## 2. Internal blocker rule

Codex must continue working when any of these remain:

- failing build/test;
- missing UI state;
- broken WebGL;
- child leakage;
- incomplete Parent Gate;
- missing offline fallback;
- missing store metadata/screenshots;
- inconsistent privacy declaration;
- account deletion missing;
- missing rights record/fallback;
- optional IAP code not verified;
- store variant pollution;
- owner handoff unclear;
- release automation missing;
- owner is asked to program;
- duplicated owner input.

These are not external blockers.

## 3. Objective external blocker rule

A blocker may be external only after all possible local preparation is
complete and evidence points to one of:

- developer/store/merchant account not created or verified;
- legal seller/trader/tax/banking agreement;
- production signing/API/payment secret;
- store console app record or price/territory action requiring owner;
- legal/privacy/rights approval;
- Disney/other signed license;
- manual Submit/Release;
- store review decision;
- manual PR merge.

For every external blocker Codex must produce:

- exact owner action;
- official section/source;
- prepared value/file;
- prerequisite;
- completion check;
- safe fallback;
- no code task.

## 4. No false completion

Forbidden final statements:

- “everything is ready” when an internal gate fails;
- “published” before store evidence;
- “Disney ready” without license;
- “no data collected” without network/SDK proof;
- “offline” if only the shell works;
- “three platforms complete” if one is only a skeleton;
- “owner only needs to submit” without dossiers, screenshots, signing and
  console worksheets.

## 5. Final outputs

COMPLETE or COMPLETE_WITH_EXTERNAL_BLOCKERS requires:

- Russian and English release gates complete;
- Base Edition English coverage = 100%;
- no raw machine translation, mixed critical screen or unverified English title;

- 100% internal requirement traceability;
- S00–S40 states;
- exact build artifacts or honest platform-specific external signing
  blocker after unsigned/simulator/local build passes;
- final owner handoff;
- owner input/missing report;
- owner approval report;
- store packages/dossiers;
- automation dry-run;
- first 72-hour runbook;
- final PR;
- no auto-merge.

## 6. Session close

Before any session stop:

- update state;
- commit safe complete work;
- record exact next requirement/stage;
- record routed documents;
- record commands and latest result;
- record external blocker evidence;
- write NEXT_CODEX_PROMPT;
- do not ask owner to re-upload the whole package.

- A missing English translation, localization test or English store dossier is an internal blocker, never a translation owner task.

## V12 strengthened bilingual stop conditions

Codex cannot stop as complete while any of these remain:

- English style/terminology drift;
- unreviewed AI/MT draft;
- missing provider privacy/rights record;
- stale RU/EN legal pair or missing controlling language;
- unsupported English support SLA;
- English security/deletion email missing;
- bad canonical/hreflang/sitemap/indexing state;
- incomplete name/title evidence;
- translation quality score below mandatory target;
- bilingual release evidence schema failure;
- store locale field matrix incomplete;
- owner/reviewer handoff unusable in either language.
