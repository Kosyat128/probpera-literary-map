# Final recomposed bookshelf toolbar

This evidence supersedes the earlier `panel-design` presentation and previous expanded toolbar screenshots. It documents the compact violet toolbar with orange/white primary action and purple view/settings controls. Earlier material, physics and Reader evidence is separate and is not invalidated by this toolbar change.

All captures use the actual local production preview `http://127.0.0.1:4185/`. No live site, authored content, persistent shelf, or application source was changed by these audits. Browser contexts ran sequentially and were closed. The files were copied from `.review/bookshelf-toolbar-recomposed/`; every copied file matched its source SHA-256. `checksums.json` records hashes and sizes for the 12 PNGs, two JSON reports and two logs.

## Final geometry

`geometry-results.json` and `geometry-run.log`: **10/10 PASS**, completed 2026-09-05T18:51:04.220Z, with zero issues and page errors. RU and EN were measured at 1440, 1100, 768, 390 and 320px. The inner toolbar, excluding surrounding rail padding, measures 52px in one row at 1440, 111px in two rows at 1100/768, and 165px in three rows at 390/320. Ordinary visible labels fit; document horizontal overflow is zero. Buttons and native selects meet 44px targets; the associated search hit label is also 44px.

The compact title is Onest 16px/500 in normal case. Quality is 13px in normal case with computed foreground/background contrast **10.04:1** against the violet menu panel. This contrast measurement applies to the quality label; this bounded final pass did not calculate a new exhaustive button-state contrast matrix. Settings menus stay inside all tested viewports. Final `ru/en-1440/390/320-toolbar.png` and corresponding `settings.png` files contain the current presentation; desktop, mobile and settings crops were visually inspected.

## Interaction scope

`interaction-results.json` and `interaction-run.log`: **4/4 PASS**. The RU/EN desktop flows use real 1984 archive/global searches and verify keyboard suggestion references, Escape, random book opening/closing and deferred drawer focus return. The narrow RU cases at 768/390 confirm actual focus restoration after Escape. These interactions ran before the final title-case, responsive-breakpoint and quality-label CSS adjustment; the final geometry run validates those changed styles without repeating the flows.

The preceding local matrix also exercised the transparent native collection overlay and label/live-status association, existing empty-shelf/ready-shelf switching, Catalog/Shelf selection, settings Tab order (New shelf then quality), Escape/outside dismissal, both available drawer presets, and all native quality option widths. No New shelf action was invoked. Manage shelf was not applicable to the all-archive selection; no persistent collection was manufactured for that condition.

The historical local matrix had three focus assertions before the application's focus RAF and two global-search waits that refocused an already-focused, Escape-dismissed input. The explicit follow-up waits for real focus restoration and uses a normal input click to reopen suggestions. Those raw historical reports remain in `.review`; their failures are not silently represented as a green full matrix. These bounded results do not claim a full release, accessibility or WebGL regression rerun.
