# Inner bookshelf polish: final bounded evidence

Actual local production preview: `http://127.0.0.1:4185/`. All browsers are closed. No source edits were made by the capture scripts. The physical layout-v4 typography and full-extraction mechanism were not changed or recertified by this UI pass.

`typography-summary.json` contains the measured results from RU 1440, RU 390 and EN 1440: catalogue title 20px/500/1.25, author 14px/1.4, country 13px/500 in normal case; heart and About actions share a row and meet 44px targets. Detail headings are 24-28px, original titles 14px; Reader body remains 17px/25.5px. All three cases passed these scoped assertions. Sampled Axe colour-contrast checks returned no violations; this is not a complete accessibility or animated-gradient certification.

The RU 390 motion check measured half 278.39px -> expanded 472px -> half 278.39px. The completed expanded/returned states are idle. Reduced-motion expansion and return use the same geometry with an application duration of 0ms and idle states (the global CSS duration is 0.01ms). The first recorded initial half snapshot was settling, not an independently asserted idle state.

`mobile-focus-results.json` is the final follow-up on the last compiled build. Mobile navigation has two visible batch controls, zero edge/single controls, zero overflow and targets at least 44px; height 155px. The corrected `ru-390-navigation.png` is the current mobile navigation proof. The expanded Reader has height 472px and idle state; its top 319.83px is below the actual sticky-controls bottom 311.83px. `ru-390-reader-expanded.png` shows that unobstructed reading surface.

The desktop focus scenario created one empty local shelf in a fresh unauthenticated ephemeral browser context with no storageState. All network write methods were blocked, and the context was destroyed. This was a real temporary user interaction, not an editorial fixture or published collection. Both New shelf -> manager -> Escape and Manage -> manager -> Escape restored the visible settings trigger, with the settings menu hidden. No network write was attempted.

Failed intermediate navigation and obstructed crops remain only in `.review/bookshelf-inner-final/`; they are not included here. The desktop catalogue/detail/Reader images preceded the final menu-focus and mobile-navigation-only corrections; their sampled styles were unchanged. Site-header images are visual captures of the soft brand background; this pass did not independently compare header geometry with an older baseline.

`checksums.json` records SHA-256 and byte sizes; every copied file matched its source. Full diagnostic records remain in `.review/bookshelf-inner-final/`. These bounded results do not claim a new full-matrix, CI, release or production-deployment pass.

A final navigation-only follow-up at 320 and 768px also confirms zero document/panel overflow and all visible buttons within bounds with targets at least 44px. See navigation-widths.json.
