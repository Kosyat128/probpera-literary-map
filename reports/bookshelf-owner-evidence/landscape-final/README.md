# Mobile inspection orientation

PASS on the local production build at `http://127.0.0.1:4185/`, captured
2026-09-05 04:50:47 UTC. Chrome headless, RU, touch/mobile emulation, DPR 1.
This is the final Onest and landscape build. The PNGs are original viewport
captures, without masking, resizing, or changes to the scene.

| Actual state | Viewport | Unobscured height | Physical book height | Book inside free rectangle | Header/actions overlap |
| --- | --- | ---: | ---: | --- | --- |
| Half sheet | 390 x 844 | 201.61 px | 141.85 px | PASS | 0 |
| Collapsed sheet | 390 x 844 | 374.77 px | 211.03 px | PASS | 0 |
| Rotation, without manual scrolling | 844 x 390 | 242.78 px | 174.25 px | PASS | 0 |
| Landscape after manual centering | 844 x 390 | 251.00 px | 166.65 px | PASS | 0 |
| Portrait restored, half sheet | 390 x 844 | 201.61 px | 141.85 px | PASS | 0 |

The scenario selected the first physical spine with its actual projected click
coordinate, opened the cover, turned to page 2, dragged the sheet handle to
collapse it, and rotated the viewport. The rotated state restored the scene
without a test scroll. The next capture independently checked manual centering.
The projected bounds include all visible physical meshes, not only their centers.
Checks use both the camera's free rectangle and independently measured sticky
header, mobile navigation, and action button rectangles, with a 1 px tolerance.

Both landscape panel page buttons measured 44 x 44 px. Actual next and previous
clicks advanced and returned the page. The DOM dossier opened, received focus,
contained its text, and contained zero editable fields. This verifies access to
the scrollable document; it does not claim the entire document fits on screen.

The semantic anchor was identical in all five captures:
`description / description-content / book-dossier-v2-catalogue / ru / BEFORE_READING`,
with page ID `description` and progress 0. Closing returned to `SHELF_IDLE`,
removed the selected book and detail panel, and returned focus to the archive's
search input. The browser reported zero page errors. No full resource stress
test was repeated for these layout changes; the separate physics evidence
retains the earlier 50 open/close and 100 page-turn results.

The original failing orientation evidence remains diagnostic under `.review`.
Two preliminary harness attempts did not reach this scenario: the first timed
out after the initial click without enough diagnostics to establish its cause,
and the second waited for a lazy scene before scrolling it into view.
Neither attempt is counted as an app pass.
The final run explicitly activates the lazy scene and waits for fonts, layout,
measured insets, visible inspection surfaces, and the demand-render idle state.

Files: [measured result](result.json), [portrait half](portrait-half.png),
[portrait collapsed](portrait-collapsed.png),
[rotation without manual scroll](rotated-collapsed.png),
[landscape after centering](landscape-centred.png),
[portrait restored](portrait-restored.png).

Reproduce from the repository root with the production preview running and
without another simultaneous WebGL audit:

```powershell
node scripts/audit-bookshelf-landscape.mjs http://127.0.0.1:4185/ .review/landscape-recheck
```

The reusable script preserves the measured scenario and fails on geometry,
interaction, anchor, focus, or page errors. Its syntax was checked after moving
the successful `.review` scenario into `scripts`; no extra browser run was made.
