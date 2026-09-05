# DOM reader audit

The final compiled candidate (`index-BxRSq4dm.css`, captured 2026-09-05 03:27:20-03:27:30 UTC) passes all six targeted cases in `reader-dom-final-check.json`: RU/EN at 320px and 390px, 200%-equivalent reflow, and forced colours/reduced motion. There is no horizontal overflow, clipped text, enabled target below 44px or measured text below 12px. Axe reports no violations in either final mobile detail panel. Real source sections expose five RU and six EN links; full text selection, contents, next/previous and exact keyed focus return pass.

The primary button is Source Sans 3 Local, 15px/600, normal case and 44px high at 1440px. Normal, hover, pressed and keyboard-focus states keep the same measured geometry. The real pressed state is confirmed with `:active`, a darker background and inset shading; keyboard focus has a visible 2px outline. Final PNGs show the two complete action groups, the RU 320px controls, both 390px reader footers and the equivalent 200% reflow. These are real compiled styles, with `sourceCSSInjected: false`. All browsers were closed after capture. This harness is not a GPU timing test and may briefly initialize the default shelf before selecting catalogue mode.

The initial production candidate at `http://127.0.0.1:4185/` was checked with the real 1984 catalogue entry in RU and EN at 320, 390, 767, 1024, 1366 and 1920 pixels. The same browser page was resized sequentially; the catalogue avoids repeated GPU work.

`reader-dom-audit.json` records the 12 viewport cases plus 200% CSS zoom and forced-colours/reduced-motion cases. Text selection matches the complete visible reader text. Contents navigation, next/previous navigation and return of keyboard focus to the keyed book trigger passed in both languages. There was no horizontal overflow, permanent clipping or visible text smaller than 12px in the measured reader/detail scope.

Two defects were reported to the source owner: the close button was 34x34px, and four orange action buttons had 4.06:1 white-text contrast. The mobile crop also shows the floating close button overlapping a reader line during scrolling. These screenshots document that initial candidate, not a final clean certification. That flow selected the colophon rather than the source section; source-link interaction was not certified by the initial capture.

The harness now also includes visible catalogue/search/navigation controls. A final targeted run can retain the original diagnostic evidence under a new report name:

```powershell
node scripts/audit-bookshelf-reader-dom.mjs http://127.0.0.1:4185/ ru,en 320,390 reader-dom-final-check
```

Omit the locale, width and report arguments for the full six-width run. The current 200% check uses the equivalent 960x500 layout viewport of a 1920x1000 viewport at 200% zoom; it is not claimed as an automated browser-toolbar gesture. Earlier diagnostic runs used `zoom:2`, which does not change media queries and produced artificial four-column catalogue compression. Those diagnostics remain preserved. Vertical content outside a working scrollport is treated as scrollable content rather than permanent clipping; empty DOM ranges in replaced inputs are not treated as text clipping.

The `reader-buttons-*-source-proof` files document CSS-injected development checks and may contain intermediate failures. The final narrow fix is recorded separately in `buttons-320-source-proof.json`: all seven controls have at least 44px targets, no cropped labels. Below 360px, the view switch and filters wrap into two columns with the final action across the full row. The original tiny target and contrast defects were corrected before this button redesign.
