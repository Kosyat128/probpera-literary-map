# Public symbolic map evidence

This is an explicitly synthetic interface fixture, not a published catalogue dossier. The test helper runs the real local review workflow and public compiler using test-only attestations. No character facts or approvals are added to catalogue content.

- RU at 1440 and 390px: 3 public characters, 2 named groups, 2 relationships; hidden character and its edge absent.
- Native modal dialog: actual 44px HTML node controls over the decorative SVG, full accessible lists, complete selected-item text and source destination.
- Keyboard Enter selects both a graph node and an edge. Escape closes only the map and restores the same preview focus without changing the dossier anchor. All inspected controls are at least 44px; horizontal overflow is zero. Targeted axe contrast, control names and dialog ARIA checks report zero issues.
- Themes, motifs and symbols use only explicit known values; all three fixture explanations remain visible.
- DURING_READING controlled progress select is 44px high at 390px; choosing the second safe prefix calls onProgressChange(2) and retains value 2.
- The paper PNG is the actual 2D texture painter after local Source fonts loaded, not a WebGL or physical-size readability certification. Its bounded diagram retains all three node names on the same page; full groups and explanatory content continue naturally. The fixture paginates to 12 pages with an explicit test cap of 36, so its synthetic CORE workflow stamp is not evidence that it passes the production CORE measured-design page cap.

`map-proof.json` records measurements. The three `synthetic-map-*.png` files show desktop/mobile details and the actual paper texture. The browser fixture loads production font styles but bundles the current source component and layout. It does not load the application bundle or create WebGL.

Reproduce with a local preview serving font assets:

```powershell
node scripts/audit-book-dossier-map.mjs http://127.0.0.1:4185/
npx vitest run src/books/bookDossierDiagram.test.ts src/books/bookInspectionPageLayout.test.ts src/books/bookInspectionTextures.test.ts scripts/lib/book-dossier-graph-fixture.test.ts
```

Final focused validation: 4 suites / 18 tests passed; TypeScript passed; typography audit 19 files / 0 issues. Sources freeze after this run; the parent release workflow validates the final production bundle separately.
