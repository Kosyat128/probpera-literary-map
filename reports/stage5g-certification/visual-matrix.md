# Stage 5G — visual and interaction matrix

## Certified baseline

- Branch: `chore/home-stage5g-certification`
- Visual execution baseline: `d473278a7d0617f14b1d50938fda9bab5c464efa`
- Current generated main-sync marker: `c1939a632bc4c3d36649e7c4b2076fcc0711d2c4`
- Artifact: existing `dist/` (no rebuild was performed by this audit)
- Browser: Playwright Chrome, one worker
- Result: **PASS — 12/12 applicable scenarios**

## Matrix coverage

| Contract | Evidence | Result |
| --- | --- | --- |
| 360 px | RU/EN header and Hero geometry; 44 px controls; mobile archive grid, controls, portrait and search-cover proportions | PASS |
| 768 px | RU/EN Hero; protected artwork; two-column book Catalog; archive action alignment | PASS |
| 1440 px | RU/EN Hero; desktop menus; global search; three-column Catalog; image proportions; archive filters | PASS |
| 1920 px | RU/EN Hero; protected header bands; action ordering and menu viewport containment | PASS |
| Reduced motion | Header animation contract at 1440 px | PASS |
| Shelf / Catalog | Catalog activation, 9,729 / 9,681 / 48 states, filters, current-shelf count, detail replacement, close and focus return | PASS |
| Global search | Latin `Dostoevsky` resolves to Dostoevsky; empty state settles; book cover preserves `object-fit: contain` | PASS |
| Mobile archive | One-column layout, no control overlap, minimum 44 px actions, search modal and cover containment | PASS |

WebGL-unavailable and forced-colour fallbacks are intentionally not claimed by this browser slice: the selected Chrome runtime exposes WebGL. Those paths remain covered by the repository's focused component contracts (`bookShelfState.test.ts` and `bookShelfApprovedPresentation.test.ts`) and the Stage 5G release gate.

## Commands and results

Desktop matrix, existing artifact only:

```powershell
node node_modules/@playwright/test/cli.js test tests/e2e/header-hero-polish.spec.mjs tests/e2e/book-archive-history.spec.mjs tests/e2e/archive-search-calendar.spec.mjs --project=desktop-chromium --workers=1
```

The first run produced 9 passes, 1 expected mobile skip and 2 failures. Both failures had the same cause: the interface visibly rendered the correct count and Catalog contents, while the tests still addressed the removed direct child `.book-shelf-frame__collection > span`.

The two selectors were updated to the current count owner, `.book-shelf-frame__collection-actions > span`; no product code changed. Focused rerun:

```powershell
node node_modules/@playwright/test/cli.js test tests/e2e/archive-search-calendar.spec.mjs tests/e2e/book-archive-history.spec.mjs --project=desktop-chromium --workers=1 --grep 'архив разделяет|switching book details'
```

Result: **2 passed**.

Mobile archive scenario:

```powershell
node node_modules/@playwright/test/cli.js test tests/e2e/archive-search-calendar.spec.mjs --project=mobile-chromium --workers=1 --grep 'на мобильном архив и изображения не растягиваются'
```

Result: **1 passed**.

## Conclusion

The required RU/EN visual widths, reduced-motion state, global search and responsive book Catalog contracts were green against the recorded Stage 5F artifact. The current generated artifact is tied to the main-sync SHA shown above; the historical visual run is not relabelled as if it had executed against that later commit. The only issue discovered by this slice was E2E selector drift; it was corrected and both affected journeys passed on the targeted rerun.
