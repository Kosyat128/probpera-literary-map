# Stage 5C structure and community evidence

This package records the targeted checkpoint for homepage structure, shared card
geometry, Book Month composition, Community layout, and responsive flow.

## Immutable baseline and scope

- source base: `9e75dc01bc143e0330264c72da74eb7b35018902`;
- branch: `feat/home-stage5c-layout-community`;
- target: `stage5/integration`;
- final tested head and mandatory CI run are recorded in the PR after commit;
- Header, Hero, Globe architecture, Book Archive, article content, CMS data,
  URLs, and source catalogs remain owner-locked and unchanged.

## Verification

- Focused Vitest: 17/17 across Stage 5 governance, closed Stage 5B
  art-direction, and the Stage 5C scoped layout contract.
- TypeScript: `tsc --noEmit` passed.
- Production Vite diagnostic: 1030 modules; CSS 334.26 KB raw / 61.07 KB gzip.
- Performance budget: 106600241 / 115081216 total bytes and 67025075 /
  75497472 bytes excluding book covers; all 2205 production files passed.
- Targeted Playwright: one desktop-chromium scenario passed while explicitly
  exercising 1440x900, 1024x768, and 390x844.
- Runtime assertions cover final DOM and visual order; 4/2/1 Sections and
  Authors grids; same-row Sections landmark deltas <=2px; desktop/tablet empty
  slots and compact mobile; Book Month split/supporting-pair/stack flow; equal
  Community prompt heights, padding, and baselines; author height caps; and
  document/component horizontal overflow.

## Visual evidence

The `visual/` directory contains 12 compact WebP captures (800172 bytes total)
and a machine-readable manifest from Chrome 151.0.7922.170:

- RU 1440x900: Book Month, Authors, Sections, Calendar, Community;
- EN 1024x768: Book Month, Sections, Community;
- EN 390x844: Book Month, Authors, Sections, Community.

All captures report zero document horizontal overflow and zero browser/page
errors. Human review covered order, card alignment, title wrapping, supporting
block proportions, prompt rhythm, CTA grouping, clipping, and responsive flow.
No Stage 5C visual regression was found.

Reproduce against an already running production preview:

```text
node scripts/capture-stage5c-layout-community.mjs http://127.0.0.1:4173/probpera-literary-map/
```

## Known limitations

Remote mandatory checks are intentionally not claimed before the PR exists.
The local build and budget audit are diagnostics, not substitutes for the
SHA-bound CI artifact. No authenticated Community state, new interface copy,
content readiness, or service-worker runtime trace is inferred by this
layout-only substage. Automatic merge, if used after terminal-green checks, is
permitted only into `stage5/integration`, never `main`.
