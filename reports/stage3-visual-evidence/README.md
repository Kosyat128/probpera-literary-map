# Stage 3 visual evidence

Captured from the final frozen Stage 3 source at
`http://127.0.0.1:4175/probpera-literary-map/` on 2026-08-22.

Each matrix image was taken only after the archive reported 200 countries, the
globe canvas was mounted, and `data-atlas-transition="idle"` was reached.
Screenshots are viewport captures, not full-page captures.

The filenames record the requested CSS viewport override. In embedded states
the in-app browser exports the scrollbar-excluded content box (for example,
345px from a requested 360px viewport); at the 1920px maximum it also trims a
small browser inset from the PNG height. DOM geometry was therefore checked
separately against `window.innerWidth` / `window.innerHeight`, and immersive
surface, stage, and canvas still measured the full requested viewport.

## Required RU/EN matrix

| Viewport | RU embedded | RU immersive | EN embedded | EN immersive |
| --- | --- | --- | --- | --- |
| 360x800 | `ru-360x800-embedded-idle.png` | `ru-360x800-immersive-idle.png` | `en-360x800-embedded-idle.png` | `en-360x800-immersive-idle.png` |
| 768x1024 | `ru-768x1024-embedded-idle.png` | `ru-768x1024-immersive-idle.png` | `en-768x1024-embedded-idle.png` | `en-768x1024-immersive-idle.png` |
| 1366x768 | `ru-1366x768-embedded-idle.png` | `ru-1366x768-immersive-idle.png` | `en-1366x768-embedded-idle.png` | `en-1366x768-immersive-idle.png` |
| 1440x900 | `ru-1440x900-embedded-idle.png` | `ru-1440x900-immersive-idle.png` | `en-1440x900-embedded-idle.png` | `en-1440x900-immersive-idle.png` |
| 1920x1080 | `ru-1920x1080-embedded-idle.png` | `ru-1920x1080-immersive-idle.png` | `en-1920x1080-embedded-idle.png` | `en-1920x1080-immersive-idle.png` |

## Representative interaction states

- `en-1920x1080-immersive-search-results.png` - APG combobox with the query
  `Fran`, active France option, writers, and a scrollable results list.
- `en-1920x1080-immersive-filters.png` - reusable globe filters in the
  immersive overlay.
- `en-1920x1080-immersive-country-drawer.png` - selected France and the
  desktop country drawer.
- `en-360x800-immersive-country-sheet-collapsed.png` - collapsed mobile
  country sheet.
- `en-360x800-immersive-country-sheet-expanded.png` - expanded mobile country
  sheet.
- `en-360x800-immersive-economical-mode.png` - rendered mobile economical
  fallback (`data-atlas-economical="true"`). This is not labelled as a
  reduced-motion capture.

## Geometry and overflow results

- PASS: in immersive mode, `.atlas-experience-surface`, `.world-map-stage`,
  and the single globe canvas match the viewport exactly at all five widths.
- PASS: no document-level horizontal overflow was measured in any of the 20
  matrix states.
- PASS: the final mobile embedded launch row is collision-free in both
  languages. At 360px the 44px CTA ends at y=697 and the globe stage starts at
  y=709; at 768px it ends at y=686 and the stage starts at y=698. Both retain a
  12px safe gap and no longer overlap `.globe-copy` or
  `.globe-style-switch`.
- PASS: the final 360px embedded `#country-search` input measures 218x44px
  inside a 309x50px field.
- PASS: the 1920px search surface stays inside the viewport at x=1474,
  width=430; its results list ends at y=672.
- PASS: the 1920px filter surface stays inside the viewport at x=16, y=70,
  width=710, height about 122.
- PASS: the 1920px country drawer is 440x990 at x=1462, y=72 and does not
  intersect the globe controls.
- PASS: at 360px the collapsed sheet begins at y=658 while the globe controls
  end at y=646, preserving a 12px gap. The expanded 560px sheet intentionally
  becomes the foreground interaction surface.
- PASS: economical mode is active at 360px and inactive at the wider matrix
  sizes; the 360px state has no document overflow.

## Residual visual observations

- P2: `.atlas-filters` is an intentional horizontal scroller on 360px
  (`scrollWidth=745`, `clientWidth=309`), but the embedded idle image offers
  only a subtle cropped-chip cue. A visible edge fade would make the swipe
  affordance clearer. There is no page-level overflow.
- P3: in the collapsed mobile sheet, the selected globe label can remain
  visible through the translucent sheet header, so `France` can briefly read
  like a duplicated label. Increasing only the collapsed header backdrop
  opacity would remove the ambiguity without changing structure.

No P0 or P1 visual blocker remains in the final matrix.

## Reduced motion note

The connected browser exposes responsive viewport control but no CSS media
emulation, so a truthful rendered `prefers-reduced-motion: reduce` screenshot
could not be produced in this run. The result is not represented by a fake or
renamed image. Atlas-specific and global reduced-motion CSS is present, and
the behavior is covered separately by automated state/tests. The economical
mobile capture above is retained only as a rendered performance-fallback
proxy.
