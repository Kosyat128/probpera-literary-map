# Shelf lettering and woven-cloth refinement

Scope: the published main 00b891c6 bookshelf, followed by the current focused refinement. This is separate from the earlier 50-open/100-turn resource audit. No new claim of a full stress or release run is made here.

## Confirmed cause and repair

The actual Russian shelf contained three empty spines: The World Set Free, To Kill a Mockingbird, and Pride and Prejudice. A long Cyrillic word exceeded the 79.18-design-pixel safe rail at the existing minimum font size. One failed layout discarded every artwork map, including the author and ornaments. Real loaded fonts and WebGL material visibility confirmed this cause; it was not an exposure or network issue.

Measured discretionary Cyrillic breaks now preserve every original character, including the authored ellipsis. Already-fitting owner layouts are unchanged. A second English check identified Number9Dream: its written CamelCase boundary now permits Number9 | Dream without an inserted hyphen or abbreviation. Ordinary unstructured Latin words are not split arbitrarily.

Front artwork, spine artwork and cloth maps are allocated independently. An actually impossible artwork layout now reports the existing accessible fallback instead of silently rendering a bare spine. The original text remains available in the DOM.

The coarse normal-map cells and strong stacked normal/bump relief caused the porous front cover. The replacement keeps procedural woven cloth, with a finer weave, shallow relief, narrow matte roughness variation and a lighter front-text outline. A final neutral sRGB grayscale albedo map adds irregular yarns and short fibres so cloth remains visible without deep pores. This map is shared by the two boards, allocated only for inspection and disposed when that rig is removed. Closed spine materials and their palette are unaffected by this final addition. Original palette identities, light exposure, cover geometry and canonical data remain unchanged. Resting keyboard focus uses the existing outline; it no longer pulls one book ahead of the aligned row. Hover/press feedback remains.

## Verification checkpoint

- Four targeted Vitest suites: 43/43 PASS. The final amplitude adjustment was followed by 22/22 PASS in the two affected suites. Cases include all three Russian titles, Number9Dream, preserved complete text, rejected unstructured Latin overflow, independent front/cloth allocation and resting geometry.
- Real Source-font Canvas maps for all 46 Russian books at 512 and 1536 texture heights: 92/92 PASS. All 17 original owner layouts are identical to baseline.
- Intermediate compiled Russian WebGL: all 46 title/author maps visible, three formerly blank spines restored. All four rows have top spread 0 px, bottom spread 0 px and uniform 5.294675 px gaps at the measured 1720 viewport.
- Intermediate compiled 17-book palette: CIEDE2000 mean 3.380, maximum 6.208, within the established mean <= 4 / maximum <= 7 gate. See row-colour-intermediate.json. This measured material result precedes the final CamelCase-only update.
- cover-before.png is the actual published coarse-cloth cover for When the Sleeper Wakes, captured before rebuilding. It is not an AI image or a reconstructed texture fixture.
- Final compiled RU/EN glyph audit at 2026-09-05T12:38:49.541Z: 8/8 batches PASS, all 46 unique books in each language, issues=[]. Real texture title ink >= 563 pixels and author ink >= 860 pixels in their separate zones; no empty artwork or catalogue fallback. All resting top/bottom spreads are 0 px; gaps range from 5.294675317347128 to 5.29467531734781 px. See result.json, ru-row.png, en-row.png and the three restored-spine crops.
- cover-smooth-intermediate.png records the intermediate correction: pores disappeared, but the cover was too smooth. It is not the accepted final cloth result.
- cover-woven-preview.png is the accepted material preview on the two actual selected WebGL boards. It uses a temporary source-generated neutral albedo map, not a substituted image of a cover. It remains labelled as a preview.
- cover-after.png / cover-after.json are the final compiled capture without material substitutions. Both real boards share one 512x727 texture UUID; all RGB channels are equal (chroma 0), roughness is .94, metalness 0, bump .0006 and normal scale .12. The actual map colorSpace is sRGB: installed React Three Fiber applies its color-map output-space convention. The factory now declares sRGB explicitly, with a unit assertion, matching that measured rendering. This makes the woven colour modulation a little more visible than the manual linear-map preview; the result was visually checked as fine matte cloth without the original porous highlight grid and accepted by the root agent. This material verification is complete. Closed-spine colour and the previously measured 17-book palette remain unchanged.
- The final cover capture is separate from the earlier 8-case lettering/alignment audit; the last addition changes only inspection-board albedo, so that complete audit was not repeated.
- The later explicit factory colorSpace declaration does not change the measured sRGB material or its visual parameters, so no redundant cover capture is required.
- Browser closed after both final captures. No full stress, new release verification, or unrelated page matrix was run.

## Reproduce the final glyph and alignment check

~~~powershell
node scripts/audit-bookshelf-spine-legibility.mjs http://127.0.0.1:4185/ reports/bookshelf-owner-evidence/legibility-refinement
~~~

The check reads actual compiled WebGL maps, independently counts title and author ink pixels, measures row rails/gaps and exits unsuccessfully for missing lettering, fallback, misalignment or incomplete 46-book coverage. It uses the existing audit-only React/WebGL observer; no source injection or production test globals are added.
