# Bookshelf controls and dismissal

The primary empty-canvas click now returns either an inspected cover or an open book to the shelf. Pointer event capture records the gesture, so an out-and-back drag, cancelled pointer and Alt orbit do not become dismissal clicks. Leaving the canvas invalidates an uncaptured click candidate even when the pointer later returns to its starting point. Closing waits for the reconnected scene before restoring focus; the previous immediate focus targeted a node removed with the detail column.

The toolbar uses one search-field focus frame, aligned 44px controls and quieter secondary actions. The default editorial order no longer appears as a removable filter. Search, view, filters and collection management have stable responsive groups. Mobile collection actions fill their row, and the quality label and selector align beneath them. Canonical book records and the preserved site Header/Hero are outside these changes.

## Verification

- Public TypeScript and the 22-file typography audit pass.
- Final local full unit run: 3030 passed, 4 skipped; no failures. Shared-language coverage checks every actual phrase, and the original 1425-field interface-copy catalogue remains unchanged. The shorter search placeholder reuses the existing books/writers/countries phrase, reducing the unique component phrase inventory by one.
- The focused presentation and canonical-data checks pass after the additional exact UI projections; source bytes outside those projections keep their historical fingerprint.
- The actual production build was measured at 1708, 1366, 768, 390 and 320px in both languages: all ten cases have zero document overflow, no clipped buttons and at least 44px button/select targets. The default filter rail has zero height. `controls.json` contains the full measurements.
- The desktop and native mobile browser cases both pass for inspected and open books, including empty-click/tap closure, detail removal and focus restoration. Desktop additionally checks Alt-click, straight drag, and out-and-back drag within and beyond the canvas. The test is in `tests/e2e/stage5-baseline.spec.mjs` and runs in the existing serial WebGL suite.
- `controls-desktop.png`, `controls-mobile.png` and `controls-mobile-en.png` show the actual compiled controls. Screenshot-only visibility rules hide the unrelated sticky header/consent overlay; no control styles or text were injected.

These are local compiled checks. Merge, hosted CI and the deployed release marker are recorded separately after publication.
