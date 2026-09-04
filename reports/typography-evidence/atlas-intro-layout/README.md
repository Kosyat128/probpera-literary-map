# Atlas intro and controls

The embedded Atlas keeps the title and description above a common control row: five filters, then largest archives, then search at the right edge. At 1440px and 1848px all six buttons and the search field share one row. The search column grows from 220px to 320px; compact horizontal padding preserves readable 14px labels where desktop space is tighter. Below the width needed for one row the filters wrap; at 960px and below the search fills a separate row. Filter controls and the search field share the existing 48px control token. Labels/counts use the canonical 13px role.

The JSX adds one wrapper around the existing heading/search and filter panel owners. Existing IDs, refs, labels and handlers are retained. The wrapper uses `display: contents` in immersive mode, where existing panel layout rules continue to apply. No globe/canvas/data code changes.

The 320px check found a pre-existing heading defect: its 45px text occupied 314.2px in a 284px content column and was clipped by `#atlas`/`.magazine-app`. The narrow heading now scales from 36 to 45px against the intro container; its full glyph range fits the column. Wider heading sizes are retained.

The four PNGs and `measurements.json` are the final production evidence at RU320/390/1440/1848, without source injection. Both wide cases have a zero-pixel vertical spread across all six buttons, with archives after the fifth filter and search at the right edge. Search fields are 220px at 1440 and 320px at 1848; on mobile they fill the 284px/354px content column. All four passed full control text, 48px targets, zero document/filter overflow, unclipped heading glyphs and search/archive/filter actions. All four final crops were visually reviewed.

The preceding production check covered RU320/390/1440/1848. Its 1440px immersive check passed entry, search/filter focus, Escape focus restoration and exit. The single-row adjustment remains scoped to embedded layout; immersive panel styles are unchanged.

Earlier source proof covered RU/EN390/1440 and RU320/1848; it is superseded by the final PNGs. The optional `--source` mode adds only the layout wrapper and the exact current layout/canonical typography CSS, without fabricating controls or country data.

Repeat against the separately running production preview:

```powershell
node scripts/audit-atlas-intro-layout.mjs http://127.0.0.1:4184/ --cases=ru/320,ru/390,ru/1440,ru/1848
```

The bounded audit checks all six filter targets, full control text, wrapping, horizontal overflow, desktop first-filter/search alignment, full-width mobile search, search/Escape, largest-archives/Escape and real filter selection. It records heading glyph bounds and clipping ancestors separately; page scroll width alone is insufficient to prove that text is visible.

Add `--immersive` only when another modal regression is justified. It was not repeated for the final embedded single-row adjustment.
