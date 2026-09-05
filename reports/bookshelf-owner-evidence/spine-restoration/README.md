# Spine quality and continuous extraction

This checkpoint follows the user's request to restore the quality of the spines and show the complete withdrawal from the shelf. All final images and JSON here come from the compiled production build served at port 4185. They contain no material substitutions or paused animation. The immutable 17-book owner reference and the earlier full RU/EN lettering evidence remain unchanged.

## Confirmed repairs

The earlier front-cover softening also reduced the spine's cloth relief and letter embossing. Spine material now has independent normal scale .26, bump .002, matte roughness .88 and letter relief .0016. The coloured cloth map has fine, irregular warp and weft fibres. Front-board material, the 17 dye identities, lighting and complete authored text are unchanged. Compare `before-row.png` with `row.png`.

The main animation defect was a mutable readiness flag stored in `Group.userData`. React Three Fiber replaced that metadata object on rerender, so the same physical Group was initialized again at its final pose. A persistent ref now tracks the initialized Group itself. The selected book first moves straight forward, completely clear of the row, then turns and approaches the inspection camera. The camera follows the same readiness/progress clock. Return reverses the sequence. A partially withdrawn cancellation reverses directly.

The visible row persists throughout inspection and return. A source-order guard releases it for sorting, filtering or LOD changes. The archive's idle physical click opens directly; it no longer shifts the visible row through a preliminary focus navigation. Clicking during an already moving row retains the existing pending-intent behavior.

## Final compiled measurements

| Case | Moving samples | Straight withdrawal samples | Clipped samples | Minimum free-edge clearance | Row/Group after return |
| --- | ---: | ---: | ---: | ---: | --- |
| Desktop 1720, actual last book | 97 | 22 | 0 | 7.55 px | Same keys, Group UUIDs and slots |
| Mobile 390, actual last book | 112 | 24 | 0 | 24.27 px | Same keys, Group UUIDs and slots |

`extraction.json` contains every sampled pose, camera, free rectangle, material Group identity and the before/after row. Bounds use the actual header/panel/action insets. The 6 desktop images show the live sequence from row to inspection; 2 mobile images show its endpoints. The screenshots do not scroll the canvas or alter the running animation. Earlier first-edge cases also passed before the final idle-click adjustment; they are not relabelled as this final compiled run.

`motion.json` independently verifies idle, hover, press, selected and returned states. Measured Z positions are 0, .09, .035 and 1.05 respectively. All 17 title and author maps contain visible ink. Resting top and bottom spreads are both 0 px; gaps range from 5.294675317347128 to 5.29467531734781 px. The final return restores the common row.

`row-colour.json` compares actual WebGL cloth pixels with matching text-free regions in the owner PNG: CIEDE2000 mean 2.882629, maximum 5.416995. The established mean <= 4 / maximum <= 7 gate passes for all 17 unique owner slots. This is a rendered-colour measurement, not a palette-HEX assertion.

Targeted extraction/model/camera/source suites: 33/33 PASS. TypeScript passed. The earlier 44-test material/lettering pass and complete 46-book RU/EN evidence are separate checkpoints; a full 50-open/100-turn stress run was not repeated for this refinement.

## Reproduce

Run from the repository root after building and serving the production site:

```powershell
node scripts/audit-bookshelf-extraction.mjs http://127.0.0.1:4185/ --last-only
node scripts/audit-bookshelf-spine-motion.mjs http://127.0.0.1:4185/
node scripts/audit-bookshelf-owner-physical-colour.mjs ../../../.review/spine-restoration-final/row 17
```

Omit `--last-only` to also check the first visible book. Reports are written to ignored `.review` directories; this folder preserves the reviewed checkpoint. No image-generation assets, database mutations or publication actions are part of these audits.
