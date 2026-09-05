# Bookshelf panel design

This replaces the earlier orange-on-paper control design in `legibility-refinement`. Primary actions now use white text on an orange surface; secondary actions use violet. All new panel colours come from the existing site palette and its colour mixes.

Search is bounded to 380 px on a wide viewport. At narrow widths its scope sits beside the filter trigger; Verified and Classic remain available inside the existing filter drawer. The Children tab is removed. Quality is an occasional preference behind a disclosure with outside-click, Escape, Tab and focus-return behaviour.

`result.json` records 16 actual compiled RU/EN layouts at 1708, 1440, 1240, 1100, 768, 390, 360 and 320 px. No page overflow, clipped controls, sub-44px buttons, duplicate focus frames, quality-option clipping, or reduced-motion failures were found. `contrast.json` records 32 primary-action samples; the minimum contrast is 4.837:1.

Normal screenshots show the unmodified control layout. Only the unrelated sticky site navigation is hidden for cropped screenshots so it cannot obscure the evidence. Quality snapshots show one field focus ring inside the violet settings surface. These checks cover panel design; extraction motion and interior typography have separate evidence.
