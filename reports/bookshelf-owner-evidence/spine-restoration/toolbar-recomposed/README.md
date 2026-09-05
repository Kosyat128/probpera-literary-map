# Extraction with the recomposed toolbar

Captured 2026-09-05T18:52:35.149Z from the local compiled production at http://127.0.0.1:4185/.
The desktop toolbar uses one row and the mobile toolbar uses three rows. This is a narrow follow-up to the earlier extraction proof, using the resulting viewport insets.

These captures precede the later interior CSS adjustment and overflow-menu focus-return fix. They verify the compiled physical extraction shown here, not those later changes. The source tree was uncommitted; no exact source HEAD or deployment identity is claimed.

| Viewport width | Moving RAF samples | Straight withdrawal samples | Clipped samples | Minimum free-edge margin | Same row keys, Group UUIDs and return slots |
| --- | ---: | ---: | ---: | ---: | --- |
| 1720 | 64 | 9 | 0 | 8.14 px | PASS |
| 390 | 71 | 12 | 0 | 26.51 px | PASS |

Selected last visible books: 1720: `england:h_g_wells:men-like-gods`; 390: `england:david_mitchell:slade-house`.

Both cases passed with `issues: []`. The audit checks straight withdrawal before rotation/scaling, the projected footprint against the real unobscured rectangle during entry and return, and exact row identity and slot restoration. RAF sampling and screenshots observe the live animation without source injection or paused animation.

`result.json` contains the full trace. Six 1720 px PNGs show the row, four intermediate states and inspection; the two 390 px PNGs show the row and inspection endpoints. `checksums.json` records SHA-256 and byte length for these files and this README.

Reproduce the same two cases with `node scripts/audit-bookshelf-extraction.mjs http://127.0.0.1:4185/ --last-only`. That standard command writes to `.review/spine-extraction-final`; this captured run used an otherwise unchanged ignored harness with its output directed to `.review/spine-extraction-toolbar-final` to preserve earlier evidence.

No palette, material, full-catalog, stress, interior typography or menu interaction audit was repeated. Browsers were closed after the two cases. Earlier evidence remains unchanged.
