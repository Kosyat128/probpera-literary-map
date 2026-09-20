# Literary Planet V12 execution

The active task is the user's V12 bilingual product request, based on canonical
`Kosyat128/probpera-literary-map` main. Preserve unrelated worktrees.

- Read `docs/mobile/AUTOPILOT_STATE.json`, `STATUS.md`, `DECISIONS.md`,
  `BLOCKERS.md` and `NEXT_CODEX_PROMPT.txt` before resuming.
- Run `node scripts/mobile/verify-requirements.mjs` before using the immutable V12 input.
  Use `node scripts/mobile/stage-context.mjs S00` with the actual active stage. Read
  shared invariants and only the routed current-stage documents. The standalone
  prompt is a recovery fallback. Never edit `docs/mobile/requirements/v12/`.
- Russian and English are equal required production locales. AI output is draft
  only. Do not invent human/editorial/legal approval or name/title evidence.
- Preserve the existing LiteraryWorldMap/LiteraryGlobe/GlobeCameraRig and one
  Canvas/renderer. Locale and presentation changes must preserve scene and
  semantic state. Canonical CMS facts, real portraits and flag assets stay shared.
- The user's clarified product contract (2026-09-08) is globe-only application
  home: orange launch -> reveal the live canonical Literary Planet. Search,
  country/writer/work, collection, child/Planetka, settings and optional store
  are controls/panels around that persistent scene. Never use the website's
  magazine homepage, hero, editorial feed or an intermediate menu as app home.
  Preserve public-site chrome in the public site only. A compiled homepage
  wrapper or screenshot of it is not acceptance of the application experience.
- Preserve the approved header, hero, orange/violet brand and antique globe
  defaults from current main. Its typography scope allows the documented open
  Sections/Articles panel and embedded control-row refinements; see
  `reports/master-typography-and-card-geometry.md`. Native imports belong only
  in platform adapters.
- Paid base plus optional non-consumables; SAFE_PAID_BILINGUAL_V1. Child mode is
  local and deny-by-default; no child advertising, tracking or open AI chat.
- No unlicensed protected assets in production builds, manifests, screenshots,
  metadata, downloadable packages or SKUs. Requirements are internal source input.
- No production deploy, Submit, Release, merge, production database writes or
  automatic store mutation. Store automation defaults to local dry-run.
- Stage loop: tests, fixes, regression, evidence, atomic commit, persistent
  checkpoint, next stage. Completion requires evidence, not generated checklists.
- Keep internal implementation gaps separate from external owner actions.
  Never transfer translation/programming tasks to the owner.

<!-- s15-booky-offline-20260920:begin -->
Source 707044e7: adult Booky explains offline/unknown/loading/error states and offers explicit recovery for countries, books and the collection component. Fixed cached entry rejection and a 320px card overlap that blocked language controls; original failures remain evidence.
114 units, TypeScript, 5 actual-App Chrome cases and 5 inspected views passed. Local PWA b0e03c47 / Android-dev ddfbd43c bind the source; PWA runtime coverage is offline/download smoke, not all source-fixture failures. 86 protected scene/model/art inputs stay exact.
Only S15.PLANETKA-005/global005 become IN_PROGRESS. Stages remain 3 complete, 12 in progress, 26 unstarted. First unresolved S03.acceptance; releaseReady:false. All former Planetka functions remain Booky scope, including child, reviewed dialogue/audio and full literary journeys/progress.
Evidence: docs/mobile/evidence/S15/booky-offline-help-20260920/result.json.
Continue S15 with versioned adult semantic progress for the two existing navigation routes: persist only explicitly acknowledged steps; migrate v1 to v2 strictly without inferring completed steps; preserve progress when Booky is hidden; provide explicit reset; and never overwrite an unsupported future record version. Keep restore closed and resume deliberate, without automatic navigation or restored permissions. Preserve offline/error recovery, the canonical scene and bounded split-module retry facades. This remains adult navigation progress only: full literary/educational journeys, child scenarios, reviewed dialogue/audio, full migration, screen-reader, installed-device/performance, iOS and release acceptance remain pending. S03.acceptance remains first unresolved.
<!-- s15-booky-offline-20260920:end -->
