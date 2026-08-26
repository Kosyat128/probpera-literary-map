# Header + Hero Polish - visual evidence

## Scope

This package records the isolated Stage 2 review of the public homepage header and Hero. After owner review, every visual change to the upper topline, main header, lower mobile navigation and Hero was explicitly reverted. Header controls were additionally restored from the pre-UI-Foundation historical reference, including native search, compact RU/EN, five social links and the reader button. The `after/` set therefore proves visual preservation; only non-visual menu/accessibility behavior and the separately approved footer spacing adjustment remain. The logo, Hero artwork, orange-purple palette, editorial concept, globe scene, CMS schema, data and routing are unchanged.

- branch base: `main` at `160d7833b61e5caf39e7bd8b9820ba0a62a2038b`
- owner-approved historical header reference: `c547c312c34c285385d7c97971d9d9d608217310` (2026-08-20)
- implementation branch: `codex/header-hero-polish`
- capture script: `scripts/capture-header-hero-qa.mjs`
- audit ledger: `reports/ui-ux-audit.md`

## Matrix

The `before/` set contains 46 deterministic WebP captures; `after/` contains the same 46 captures plus the approved footer-menu evidence image (`prefers-reduced-motion: reduce`, animations disabled after load):

- RU: 320×800, 360×800, 390×844, 430×932, 768×1024, 1024×768, 1280×800, 1366×768, 1440×900, 1920×1080;
- EN: 360×800, 768×1024, 1440×900, 1920×1080;
- for every matrix viewport: Header, Hero, and combined Header+Hero;
- interaction states: Articles menu, Sections menu and the original mobile navigation.

The local fallback snapshot used for the final `after/` capture reports 161 publications, while the earlier baseline capture used the live 165-publication snapshot. That expected text/data delta affects some image hashes; the tracked CSS for both header bands and Hero has zero diff from the baseline commit.

Representative comparisons:

| Viewport | Before | After |
|---|---|---|
| RU 360 | [before](before/ru-360x800-header-hero.webp) | [after](after/ru-360x800-header-hero.webp) |
| RU 768 portrait | [before](before/ru-768x1024-header-hero.webp) | [after](after/ru-768x1024-header-hero.webp) |
| RU 1440 | [before](before/ru-1440x900-header-hero.webp) | [after](after/ru-1440x900-header-hero.webp) |
| EN 360 | [before](before/en-360x800-header-hero.webp) | [after](after/en-360x800-header-hero.webp) |
| EN 1440 | [before](before/en-1440x900-header-hero.webp) | [after](after/en-1440x900-header-hero.webp) |
| Articles menu | [before](before/ru-1440x900-articles-menu.webp) | [after](after/ru-1440x900-articles-menu.webp) |
| Sections menu | [before](before/ru-1440x900-sections-menu.webp) | [after](after/ru-1440x900-sections-menu.webp) |
| Footer menu spacing | - | [after](after/ru-1440x900-footer-menu.webp) |

## Protected asset proof

The Stage 2 diff contains no files under `public/brand/`. Review-time SHA-256 values:

| Asset | SHA-256 |
|---|---|
| `magazine-hero-wide.avif` | `cf58f94ef29aacc546c412f41459f5afc1d0b1e7f6c8e1e9e87a1880a0ce04ba` |
| `magazine-hero-wide.webp` | `29df2ed78320b87c8d49abc6dc76cee466e4ad75d8d1ee4a373d339c23ee1cd9` |
| `magazine-hero-mobile.avif` | `304a0cb57ebd0736b26d82fe9a04739b5dc3da9b5a2ca2ac874e1e324caf73d3` |
| `magazine-hero-mobile.webp` | `4b09de40909a720a94844e538e8efebfe196c451feecbae3b2f833214d47b713` |
| `probpera-logo.png` | `d8b31268a45ddbc576fe36e1d65ff68883ee4c4a7b490b8976001858d3f3ba27` |

## Findings addressed

- `HEADER-003` - outside/Escape menu close with focus return, without a visual redesign;
- `A11Y-004` - stable localized accessible name for the reader control;
- `UI-005` - effective desktop footer white-link row gap reduced from 7 to 5 px;
- `UI-002` - partial: Header/Hero evidence matrix added;
- `MOBILE-001` - partial: the existing UI Foundation target contract remains covered.

Owner-directed visual freeze: `HEADER-001`, `HEADER-002`, `HERO-001` and `HERO-002` remain open. No search/button/social/header sizing, two-row geometry, title wrapping or 768 art-direction change is included.

The historical native search/RU-EN/social/login structure is now pinned by source and browser tests so later stages cannot silently reapply UI Foundation sizing to this owner-locked group.

## Automated evidence

- `src/components/headerHeroPresentation.test.ts` protects asset references, exact RU copy, the original two-row header/lower-nav/title structure, CMS markers and the non-visual accessibility additions;
- `tests/e2e/header-hero-polish.spec.mjs` checks RU/EN geometry, CTA/proof separation, reachable original mobile navigation, menu bounds, keyboard Escape/focus return, the original art direction/header bands and reduced motion;
- `tests/e2e/public-smoke.spec.mjs` retains the protected artwork dimensions and localized headline smoke contract.

The final build/performance values are recorded in the PR description after the release checks complete. Screenshot updates are review-only; this script never updates Playwright golden snapshots or merges a PR.
