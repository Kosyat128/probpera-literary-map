# Codex Admin Execution State

Audited baseline: `27409c57b51568038a4341f151436f32ec6d87dc`
Working branch: `codex/admin-2-phase3`; branch HEAD is `2c4322642630b9f3b193cab56f4461b0600a57b0`; locally tracked `origin/main` is `dcc98316176d22d5a364d48986416f15cd7bf6d7`
Last updated: `2026-08-28T16:15:39Z`

## Completed

- [x] Preceding Stage 5 released and certified on `fd683994` (Pages, exact-main Quality, live security, rollback drill).
- [x] Baseline-to-HEAD admin-related name-status diff reviewed; no prior Admin 2.0 checkpoint existed.
- [x] Live release head is exactly `fd683994`; Pages, Quality and live-security workflows are green.
- [x] The known public-build backlog was finalized through outbox high-water `281` and legacy-audit high-water `620`.
- [x] Production Pages artifact `33159539789` inspected directly: the baseline article is an authoritative CMS withdrawal, not a generated slug mismatch.
- [x] Fail-closed exact-record restoration tool, focused regression tests and immutable manual production workflow implemented for the required baseline article.
- [x] Next.js upgraded from `16.3.0` to patched `16.3.3` without unrelated dependency upgrades.
- [x] Root/global error boundaries and graceful Russian dependency states added; all 18 nullable Supabase pages no longer render blank screens.
- [x] Admin OpenNext Worker built successfully and size gate passed at `2862.20 / 2900 KiB` gzip.
- [x] Phase 1–2 PR `#132` merged by the repository-required rebase strategy; deploy-admin and Quality are green (`114` browser checks passed, `18` skipped).
- [x] Phase 3 typed Article Editor workspace bridge implemented without DOM scraping, `MutationObserver`, heading-text parsing or synthetic clicks; focused tests (`21/21`) and admin TypeScript passed.
- [x] The first production restoration attempt (`33168427295`) failed closed before mutation because the guard compared the public route segment with the CMS category slug. The CMS contract is now pinned correctly to `book-opinions`; focused restore tests pass (`8/8`).
- [x] Shared editor media workflow extracted and reused by Article/Page: ordered multi-file upload, exact single-file replacement, drag/paste handling, cancel/retry and the read-only media library preserve authoritative `mediaId` metadata.
- [x] Shared RichEditor controls and safe-link workflow extracted without changing TipTap serialization: Article/Page reuse ordered extensions, typography controls, tables, divider, image dialog and authenticated internal-link autocomplete.
- [x] ArticleEditor presentation boundaries extracted into Shell, Core, Toolbar, Gallery and pure validation/publish/cover/SEO/source panels while the parent retains canonical state, effects and submit ordering.
- [x] Recovery is separated through the typed workspace bridge and RecoveryController; server recovery uses actor-only RLS, monotonic per-tab sequences, exact-receipt cleanup, canonical-version conflict detection and explicit manual restore for complete Article/Page snapshots.
- [x] Legacy import, social publication and article-management responsibilities are split into focused action modules while the production fallback remains intentionally available until reconciliation succeeds.
- [x] Shared editor dialog focus management is implemented for link, image, media and gallery dialogs; the remaining parity/focus audit can proceed in parallel before the pre-reconcile PR is frozen.
- [x] A bounded `windows-latest` standalone smoke workflow is defined to type-check, build, prepare, start and HTTP-probe the production admin entrypoint without browser E2E. A green Windows run for the current Phase 3 head has not yet been recorded.

## In progress

- Phase 3 pre-reconcile — close only remaining editor parity/focus findings without changing canonical save contracts, then freeze and review the PR.

## Pending

- [ ] Complete the bounded parity/focus audit, rebase the Phase 3 commit range onto exact current `main`, review the final diff and merge the pre-reconcile PR.
- [ ] On the exact merged-main SHA, run production database reconciliation once and require the expected schema-health fingerprint, including `editor_autosaves`, `editor_autosave_rpc=true`, `article_bundle_rpc=true`, `ledger_entries=17` and `invalid_indexes=0`.
- [ ] Only after that exact reconciliation succeeds, remove the legacy atomic-save fallback/probe and dead compatibility action in a separate cleanup PR with focused regression coverage.
- [ ] Phase 4 — media and gallery.
- [ ] Phase 5 — Style Engine and Site Studio.
- [ ] Phase 6 — Data Studio.
- [ ] Phase 7 — translation runtime and durable jobs.
- [ ] Phase 8 — site copy, SEO and operations.
- [ ] Phase 9 — route/module coverage closure.
- [ ] Phase 10 — final QA.
- [ ] Final QA, release and production verification.

## Reviewed migrations pending production reconciliation

- `20260828_zz_editor_autosaves.sql` — private staff recovery rows only; no canonical editorial writes and no publication outbox trigger.

## Tests already green for current relevant code

- Exact-main Quality run `33159539777` — `fd683994`.
- Pages run `33159539789` and live-security run `33160046572` — `fd683994`.
- Exact-record restoration and resilience source contracts — 2 files, 11 tests.
- Admin TypeScript and Cloudflare TypeScript configurations.
- OpenNext production build on Next `16.3.3` and Worker gzip size gate.
- PR `#132` deploy-admin run `33166448296` and Quality run `33166448257`.
- Typed workspace focused suite: `21/21`; admin TypeScript and `git diff --check` passed.
- Corrected exact-record restore contract: `8/8` focused tests.
- Shared media/link parity: `6` focused files, `23/23` tests; admin TypeScript and `git diff --check` passed.
- Shared RichEditor/autosave/migration/Windows source contracts: `6` focused files, `25/25` tests. This is not a green `windows-latest` workflow result for the current Phase 3 head.
- Recovery integration source contract: `4/4`; admin and Cloudflare TypeScript configurations pass.
- ArticleEditor panel extraction: `15/15` focused tests; toolbar/gallery extraction: `10/10`; EditorCore/translation extraction: `17/17`; Shell extraction: `7/7`.
- Direct media parity: `11/11` focused tests; production reconciliation contract: `10/10`; shared dialog focus: focused source and hook tests are committed.

## Known blockers

- The reviewed `20260828_zz_editor_autosaves.sql` migration and the expanded schema-health fingerprint are not production evidence until reconciliation succeeds on the exact merged-main SHA.
- The legacy atomic-save fallback must remain present through the pre-reconcile merge; deleting it before exact production reconciliation would remove the required fail-safe path.
- The Windows standalone smoke workflow exists in source, but no green `windows-latest` run for the current Phase 3 head is asserted here.

## NEXT STEP

Finish only the remaining bounded parity/focus findings, rebase the Phase 3 commit range onto exact current `main`, review the complete diff and merge the pre-reconcile PR. Next, reconcile production once on that exact merged-main SHA and verify the full schema-health fingerprint. Only after that gate is green, create the separate fallback-cleanup PR; Phase 4 starts after the cleanup is merged.
