# Codex Admin Execution State

Audited Phase 4 baseline: `7a189e173d9efebafdd6077b9c36ff1af8f8ad3e`
Phase 4 branch: `codex/admin-phase4-media-gallery`
Last updated: `2026-08-30`

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
- [x] Phase 1-2 PR `#132` merged by the repository-required rebase strategy; deploy-admin and Quality are green (`114` browser checks passed, `18` skipped).
- [x] Phase 3 typed Article Editor workspace bridge implemented without DOM scraping, `MutationObserver`, heading-text parsing or synthetic clicks; focused tests (`21/21`) and admin TypeScript passed.
- [x] The first production restoration attempt (`33168427295`) failed closed before mutation because the guard compared the public route segment with the CMS category slug. The CMS contract is now pinned correctly to `book-opinions`; focused restore tests pass (`8/8`).
- [x] Shared editor media workflow extracted and reused by Article/Page: ordered multi-file upload, exact single-file replacement, drag/paste handling, cancel/retry and the read-only media library preserve authoritative `mediaId` metadata.
- [x] Shared RichEditor controls and safe-link workflow extracted without changing TipTap serialization: Article/Page reuse ordered extensions, typography controls, tables, divider, image dialog and authenticated internal-link autocomplete.
- [x] ArticleEditor presentation boundaries extracted into Shell, Core, Toolbar, Gallery and pure validation/publish/cover/SEO/source panels while the parent retains canonical state, effects and submit ordering.
- [x] Recovery is separated through the typed workspace bridge and RecoveryController; server recovery uses actor-only RLS, monotonic per-tab sequences, exact-receipt cleanup, canonical-version conflict detection and explicit manual restore for complete Article/Page snapshots.
- [x] Legacy import, social publication and article-management responsibilities are split into focused action modules; the reconciled canonical atomic article RPC is now the only save path.
- [x] Shared editor dialog focus management is implemented for link, image, media and gallery dialogs; the remaining parity/focus audit can proceed in parallel before the pre-reconcile PR is frozen.
- [x] A bounded `windows-latest` standalone smoke workflow type-checks, builds, prepares, starts and HTTP-probes the production admin entrypoint without browser E2E; the Phase 3 PR run is green.
- [x] Phase 3 PR `#137` merged to exact main SHA `ae5e02e5fdac929e03cff2729202c201651f39d1` with Quality/security, deploy-admin and Windows smoke green.
- [x] Production reconciliation run `33194740075` succeeded on that exact SHA with `article_bundle_rpc=true`, `editor_autosaves=true`, `editor_autosave_rpc=true`, `ledger_entries=17` and `invalid_indexes=0`.
- [x] The post-reconciliation compatibility probe, legacy atomic-save fallback and dead auto-publish compatibility action are removed; saves now fail closed through the canonical transactional RPC.

## In progress

- Phase 4 implementation is complete in the release branch: shared typed responsive
  images, structured galleries/sliders, Media Studio lifecycle and usage graph,
  Safe Replace, bulk metadata, orphan cleanup, staged owner-only permanent purge,
  and one-pass repair for invalid structured translations.
- Final combined verification, PR/CI, production reconciliation and deployment are
  in progress. Phase 5 must start only after the exact Phase 4 release is verified.

## Pending

- [ ] Phase 5 - Style Engine and Site Studio.
- [ ] Phase 6 - Data Studio.
- [ ] Phase 7 - translation runtime and durable jobs.
- [ ] Phase 8 - site copy, SEO and operations.
- [ ] Phase 9 - route/module coverage closure.
- [ ] Phase 10 - final QA.
- [ ] Final QA, release and production verification.

## Production reconciliation evidence

- `20260828_zz_editor_autosaves.sql` is applied in production; it stores private staff recovery rows only and does not perform canonical editorial writes or trigger the publication outbox.
- Reconciliation run `33194740075` passed the immutable invocation, exact-main recheck, backup, isolated validation, production apply and exact schema-health comparison on `ae5e02e5fdac929e03cff2729202c201651f39d1`.

## Tests already green for current relevant code

- Exact-main Quality run `33159539777` - `fd683994`.
- Pages run `33159539789` and live-security run `33160046572` - `fd683994`.
- Exact-record restoration and resilience source contracts - 2 files, 11 tests.
- Admin TypeScript and Cloudflare TypeScript configurations.
- OpenNext production build on Next `16.3.3` and Worker gzip size gate.
- PR `#132` deploy-admin run `33166448296` and Quality run `33166448257`.
- Typed workspace focused suite: `21/21`; admin TypeScript and `git diff --check` passed.
- Corrected exact-record restore contract: `8/8` focused tests.
- Shared media/link parity: `6` focused files, `23/23` tests; admin TypeScript and `git diff --check` passed.
- Shared RichEditor/autosave/migration/Windows source contracts: `6` focused files, `25/25` tests; the Phase 3 `windows-latest` workflow is green.
- Recovery integration source contract: `4/4`; admin and Cloudflare TypeScript configurations pass.
- ArticleEditor panel extraction: `15/15` focused tests; toolbar/gallery extraction: `10/10`; EditorCore/translation extraction: `17/17`; Shell extraction: `7/7`.
- Direct media parity: `11/11` focused tests; production reconciliation contract: `10/10`; shared dialog focus: focused source and hook tests are committed.
- Phase 3 fallback cleanup: all `36/36` focused source, governance and atomic-bundle tests pass; admin TypeScript and `git diff --check` pass.
- Phase 4 media lifecycle migration and production planner contracts: `16/16`.
- Phase 4 bulk metadata, orphan cleanup and staged permanent purge contracts: `13/13`.
- Phase 4 editor/gallery/public/translation focused result: `97/97` relevant tests
  green (one combined `93/97`, followed only by the four corrected files: `18/18`).
- Admin, Cloudflare Worker and public-site TypeScript configurations pass. The
  Cloudflare check reused the exact already-installed locked type package
  `@cloudflare/workers-types@5.20260823.1`; dependencies were not reinstalled.
- Independent final audit: no P0 or P1 findings; migration/planner checksum is
  `ace78c21a0b5b7b36ed2ebce7e840dfed0d0f2fb1f1798ff84e13209de7c0e7f`.

## Known blockers

- No known Phase 4 blocker. Local implementation verification and independent
  audit are complete; PR/CI and production release verification remain.

## NEXT STEP

Complete the single combined Phase 4 verification, merge the reviewed PR, reconcile
the production database on the exact merged SHA, deploy and verify. Then continue
from the first unfinished Phase 5 item without reopening completed phases.
