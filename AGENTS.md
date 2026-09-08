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
