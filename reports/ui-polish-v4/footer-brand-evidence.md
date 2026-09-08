# Footer brand and historical header language font

Local owner request, 2026-09-08. No production publication.

The home footer logo link now repeats the existing desktop masthead: the unchanged real orange logo URL, Georgia title at 23px/500 with .02em tracking, Segoe UI uppercase subtitle at 8px/800 with .18em tracking, 3px title/subtitle separation, 13px image/text gap, and a 55x55px logo. Authored brand text and navigation URL are unchanged. Footer prose and navigation retain the accepted Onest typography.

At 390px the complete footer brand remains visible within its column. The existing compact header intentionally shows only its 40px logo; this mobile header behavior was not changed. The footer preserves the full desktop brand composition requested by the owner.

## Historical evidence for RU/EN

- `git show 0a348bd4^:src/index.css`: `--sans` starts with Segoe UI; `.interface-language-control button` uses `font: inherit` (then 7px/900).
- `git show 0a348bd4:src/styles/header-preserved.css` (2026-09-05) explicitly preserves the same Segoe UI stack in the header; it did not introduce a different header family.
- `git show 00b891c6 -- src/styles/site-typography.css` (2026-09-05) changes the general interface to Onest while retaining the header exception.
- `git show c0525995 -- src/styles/header-preserved.css` (2026-09-06) only adds the header background glow.
- Before this follow-up, live computed header RU/EN already read Segoe UI, 400, 12px. The follow-up explicitly pins `font-family: var(--sans)` on these buttons, preserving the earlier 400 correction. There is no invented claim of a newly changed visible family.

## Actual verification

`node reports/ui-polish-v4/capture-brand.mjs brand-after-dev http://127.0.0.1:5186 --check` passed at 1440 and 390. Assertions compare the real logo URLs and brand strings; check RU/EN family and weight; check that the footer fits; and compare desktop header/footer title and subtitle family, size, weight, leading, spacing and color, plus logo dimensions and image/text gap. Screenshots were visually inspected. The mobile language targets remain 44px wide.

Before: footer title Onest 27px/400, subtitle Onest 14px/400 with no tracking, logo 62px. After: the masthead values above. Header geometry is unchanged.

| View | Before | After dev |
| --- | --- | --- |
| Desktop header | [header-1440](brand-before/header-1440.png) | [header-1440](brand-after-dev/header-1440.png) |
| Desktop footer | [footer-1440](brand-before/footer-1440.png) | [footer-1440](brand-after-dev/footer-1440.png) |
| Mobile header | [header-390](brand-before/header-390.png) | [header-390](brand-after-dev/header-390.png) |
| Mobile footer | [footer-390](brand-before/footer-390.png) | [footer-390](brand-after-dev/footer-390.png) |

Computed records: [before](brand-before/measurements.json), [after dev](brand-after-dev/measurements.json).

`node scripts/audit-typography.mjs`: 27 public CSS files, 0 issues. The owner's explicit footer-logo exception is restricted to `.footer-brand > a` and its image/span/strong/small descendants in `header-preserved.css`. It does not exempt footer prose, navigation, or arbitrary stylesheets. `scripts/audit-typography.test.mjs`: 14 tests passed including negative guards. The first sandbox run could not read the linked node_modules parent through esbuild; the approved local retry passed.

## Final built-preview result

After root's successful final domain and preview builds, `node reports/ui-polish-v4/capture-brand.mjs brand-after http://127.0.0.1:4186 --check` completed with exit 0 on the frozen local preview. All 1440/390 assertions passed. The historical Segoe UI/400/12px header language font is confirmed on the final build; desktop footer/title/subtitle/logo dimensions and spacing match the actual header. The complete mobile footer brand fits without truncation, and its subtitle remains visible. Final screenshots were visually inspected.

| View | Final built preview |
| --- | --- |
| Desktop header | [header-1440](brand-after/header-1440.png) |
| Desktop footer | [footer-1440](brand-after/footer-1440.png) |
| Mobile header | [header-390](brand-after/header-390.png) |
| Mobile footer | [footer-390](brand-after/footer-390.png) |

Final computed measurements: [brand-after/measurements.json](brand-after/measurements.json). Command log: [brand-final-capture.log](brand-final-capture.log). The four previously accepted extended reader scenarios were not repeated. No production publication or production verification is claimed.
