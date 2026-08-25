# Stage 5B art-direction evidence

This package records the targeted visual checkpoint for the scoped Stage 5B
homepage typography, rhythm, action-orange, and fallback-surface work.

## Capture scope

- source branch base: `d9a77efee9ce9348569162a91261ece66210283d`;
- browser: Chrome `151.0.7922.170` through Playwright;
- RU desktop: `1440x900` at Book Month, Article Library, Community, Authors,
  Sections, Trust, and Calendar;
- EN mobile: `390x844` at Book Month, Article Library, Community, Sections, and
  Calendar;
- reduced motion and disabled transitions for deterministic rasters;
- all twelve captures have zero document-level horizontal overflow;
- browser console/page errors: zero.

The exact capture metadata and computed root backgrounds are in
`visual/manifest.json`. Reproduce the package against a running production
preview with:

```text
node scripts/capture-stage5b-art-direction.mjs http://127.0.0.1:4173/probpera-literary-map/
```

The final immutable PR head is recorded in the PR description because a commit
cannot embed its own SHA. The visual package is evidence for presentation and
overflow only; content-readiness claims remain governed by the existing data
and premium-translation tests. In particular, the English Article Library
capture honestly preserves the current localized empty state and does not
invent translated publications.

## Human review result

The twelve images were reviewed for title wrapping, readable body line-height,
background layering, CMS precedence, section separation, control legibility,
sticky-header overlap, clipping, and horizontal overflow. No Stage 5B visual
regression was found. Header/Hero, Globe architecture, Book Archive, article
copy, source data, and section order were not changed by this substage.
