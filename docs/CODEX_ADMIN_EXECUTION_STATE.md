# Codex Admin Execution State

Audited baseline: `27409c57b51568038a4341f151436f32ec6d87dc`
Working HEAD: `080565e0` on `codex/admin-2-phase3`; production `main` is `c9bed23e7a4a66ee6ec95d2809d54e1204c1c076`
Last updated: `2026-08-28T11:56:00Z`

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
- [x] Shared editor media foundation implemented: Article/Page use one typed upload helper, Page has direct upload and exact replacement, media identity survives as `data-media-id`, and both editors use a controlled safe-link dialog instead of link prompts.

## In progress

- Phase 3 — finish safe ArticleEditor decomposition, shared rich-editor controls and server autosave/recovery.

## Pending

- [ ] Complete and merge the remaining Phase 3 shared-editor/decomposition/recovery work.
- [ ] Phase 4 — media and gallery.
- [ ] Phase 5 — Style Engine and Site Studio.
- [ ] Phase 6 — Data Studio.
- [ ] Phase 7 — translation runtime and durable jobs.
- [ ] Phase 8 — site copy, SEO and operations.
- [ ] Phase 9 — route/module coverage closure.
- [ ] Phase 10 — final QA.
- [ ] Final QA, release and production verification.

## Applied migrations

- None in the Admin 2.0 execution branch yet.

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

## Known blockers

- `page--article--page--books--14` remains withdrawn until the corrected fail-closed guard is merged to `main` and the fixed-purpose workflow is rerun. The failed run made no mutation.
- Production outbox is currently empty: run `33168427295` reported `No pending public build requests (outbox).` before the guarded mutation step.

## NEXT STEP

Extract the first safe ArticleEditor module/shared RichEditor control boundary, then implement scoped server autosave/recovery without changing the existing save contract. After Phase 3 is green, rebase its commits onto exact `main`, review and merge once; rerun the corrected exact-record restore against that immutable main SHA, refresh Pages once and verify canonical/legacy routes before Phase 4.
