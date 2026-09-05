# Owner material and typography proof

These are measured **2D canvas texture fixtures**, not final 3D camera, silhouette or lighting certification. The exact owner PNG is preserved in `docs/stage5-reference/OWNER_LOCKED_BOOK_SPINES_EXACT_2026-08-30.png`. The production renderer still needs its separate comparison under the final lighting and camera.

- `owner-material-2d-1720.png`: all 17 prescribed titles, full authors and explicit owner palette slots, drawn using loaded local Source Serif 4. All title/author layouts fit their safe zones. The longest unbroken word uses 10.25 design pixels at a 411-pixel spine height; this is reported explicitly, with the full canonical title available in the DOM.
- `owner-front-2d.png`: the same colour and ivory/sepia lettering, restrained rules and the project's existing quill geometry. The physical cover does not consume an external cover image.
- `inner-page-fixture-*.png`: labelled technical prose for typography verification, not a published dossier. Real glyph bounds stay within the outer/gutter margins and above the folio.
- `canonical-dossier-layout.json`: font-ready measurement of all 17 real owner books in RU and EN, through the public legacy adapter with their released article relations. All 34 variants fit: 7-13 pages, no rejected layout, all 34 approved editorial descriptions retained. These catalogue fallbacks have no reviewed tier; this does not certify CORE/SIGNATURE publishing requirements. The report explicitly records its country/genre localization limits.
- `owner-material-metrics.json`: exact sample coordinates, mean RGB values, complete measured text layouts and inner glyph bounds. CIEDE2000 is the acceptance metric; CIE76 is retained under its own name. Colour differences compare matched text-free 40x40 cloth patches.

The CIEDE2000 implementation follows [Sharma, Wu and Dalal's equations](https://hajim.rochester.edu/ece/sites/gsharma/ciede2000/ciede2000noteCRNA.pdf), with 12 independent published reference pairs tested in both directions, including neutral and hue-boundary cases. Formula version: `ciede2000-sharma-2005-v1`.

Measured flat-patch CIEDE2000: mean **2.142**, maximum **4.053**, within the requested 4/7 limits. These numbers do not certify scene lighting. `bookOwnerSpineIdentity.ts` separately pins the real 17 archive identities to their owner slots; the tests resolve every key against the current canonical archive and verify stability after filtering, sorting and changing translated labels.

The separate final **actual WebGL** captures now pass the same matched-patch limits at all three quality levels: HIGH, 17 spines at 1440px, mean **2.407**, maximum **4.266**; BALANCED, 13 spines at 1024px, mean **2.181**, maximum **3.986**; ECONOMY, 7 spines at 390px, mean **2.949**, maximum **4.299**. See `../physics-after/closed-row-1440-colour.json`, `closed-row-1024-colour.json` and `closed-row-390-colour.json` with their original PNGs and measured rectangles. All use the calibrated neutral lights and fixed 0.38 exposure; no browser colour injection was applied to these final captures.

Reproduce from the worktree root while a local preview is available:

```powershell
node scripts/audit-bookshelf-owner-textures.mjs http://127.0.0.1:4184/
node scripts/audit-bookshelf-dossier-layout.mjs http://127.0.0.1:4185/
npx vitest run scripts/lib/colour-difference.test.mjs
npx vitest run src/books/bookTypography.test.ts src/books/completeShelfTextures.test.ts src/books/bookInspectionTextures.test.ts src/books/bookInspectionPageLayout.test.ts src/books/completeShelfCanvas.source.test.ts
npx vitest run src/books/bookOwnerSpineIdentity.test.ts
```

The script compiles an in-memory probe only, uses one Chrome page, and closes it after capture. It does not rebuild the site or modify production data. Text layout is computed in stable design coordinates; changing raster quality does not change line breaks, semantic anchors or the cloth pattern.

Internal pagination retains the complete source document. A font failure, unsupported long token, unsafe heading or a result exceeding the configured dossier tier cap explicitly requests the DOM reader rather than clipping, squeezing or discarding content. Pagination adds presentation fragments while preserving source section/block anchors. The texture store retains bounded LRU disposal and generation cancellation.

Final inner typography uses a 1400x2000 design space: title/heading 120, body 92, metadata 88, caption 84 and folio 76. At a 330px projected leaf height, these correspond to 19.8/15.18/14.52/13.86/12.54px respectively; actual physical screen size remains a separate renderer check. Continuation pages retain the full title as a compact running title. The first measured larger-type pass found two overflowing Russian titles and one 18-page cap overrun; the final title scale and continuation layout resolved all three without increasing the cap.

The approved final paper presentation prints complete descriptive article labels/value/text and complete source provider/title/domain, without technical URL paths. The original full destinations remain in semantic `row.href`, `items.href` and `page.sources[].sourceUrl` and in the DOM links. This is an explicit presentation choice, not truncation or an ellipsis. Source providers use the readable caption role; long domains prefer their dot boundaries. A later adapter correction restored the existing approved prose in all 34 variants before the final measurement.
