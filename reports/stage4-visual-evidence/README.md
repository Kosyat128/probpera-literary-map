# Stage 4 visual evidence — V11

Capture date: 2026-08-23
Preview used: `http://127.0.0.1:4190/` with root base `/`
Evidence set: **16 PNG files**
Result: **PASS — no remaining P0/P1 issue was found in the inspected states after the V11 mobile containment correction.**

This folder is a visual record of the current V11 domain build. The stale preview that had previously occupied port `4173` was not used: it resolved the HTML but served the wrong Vite base and returned `404` for root assets.

## Build identity

| Artifact | SHA-256 |
| --- | --- |
| `dist/index.html` | `9346785f44edc591d6aabe16f4d8b4fd0457d3c15f32ecc6f4a3e4bcf1f4721c` |
| `dist/assets/index-5Xx9xcn8.js` | `c2cc86617e6782364d194bc7f125fb9234ce269321b9f6599957a64d1eb9f080` |
| `dist/assets/index-DxjTw1qg.css` | `3bbbd9cea3810ec9f1b3fe33e781db0eb43e2a45704ca2af94afbee63c49f34a` |
| `dist/assets/LiteraryWorldMap-CX0RtNhM.js` | `f08912e79a71d43a3b503cfd7da4c64265292b21fc636a30c79c9e68db0674c1` |

## Viewport and state matrix

The requested dimensions are the page's exact `window.innerWidth × window.innerHeight`. On embedded pages the native browser screenshot raster can be narrower/shorter because the in-app browser omits its reserved scrollbar/gutter pixels; this does not indicate document overflow. Every inspected page reported `documentElement.scrollWidth <= documentElement.clientWidth`.

| Screenshot | Requested viewport | PNG raster | Language | Mode | Public style | State inspected | Result | SHA-256 |
| --- | ---: | ---: | --- | --- | --- | --- | --- | --- |
| `ru-320x800-embedded-antique-filters.png` | 320×800 | 305×763 | RU | Embedded | Старинный | Compact filter rail and globe | PASS | `b835871f32fd1556f4dadad587de433ff67f17df9939974d32edbff540fc4d35` |
| `en-360x800-embedded-modern-country-collapsed.png` | 360×800 | 345×767 | EN | Embedded | Современный | Selected country, collapsed mobile sheet | PASS | `4184f79139cecc72a863a909f0a14e0c99d69d2ae9b8e9ead2611c955c6e97a4` |
| `ru-390x844-embedded-filters.png` | 390×844 | 375×811 | RU | Embedded | Старинный | Compact filter rail | PASS | `fd89a7e2fe24d3618c97bd72d4a9ec6f7c6de505e30adac0d030cec194dc4ae1` |
| `ru-390x844-embedded-archives-open.png` | 390×844 | 375×811 | RU | Embedded | Старинный | “Крупнейшие архивы” popover | PASS | `40e976733409b03748cc6e8b3d2409ee919b825f7ae7b30313ddf7d3f83365fa` |
| `en-430x932-immersive-antique-country-expanded.png` | 430×932 | 430×931 | EN | Immersive | Старинный | Selected France, expanded mobile sheet | PASS | `1243f1db2af71c55b93d4b4774a059611e04735cdb911ab937762000b1b5cc11` |
| `ru-768x1024-embedded-modern-archives-open.png` | 768×1024 | 753×1004 | RU | Embedded | Современный | Tablet globe and archives popover | PASS | `16c49463725c15b86251bb37d546e81833a861043815702be687c6ab83c4ae1b` |
| `en-1024x768-embedded-classic-country.png` | 1024×768 | 1009×757 | EN | Embedded | Классический | Selected country desktop panel | PASS | `2263d596f795b9061a842ee3315de5335543cfe58f3abd448e0de5a6d667c6d6` |
| `ru-1280x800-embedded-antique-brush.png` | 1280×800 | 1265×791 | RU | Embedded | Старинный | Exposition boundary and orange brush | PASS | `28ff9a4fc14255baab0832792a637f823248243d9d45d76f3949b755618dcb86` |
| `en-1366x700-immersive-modern-country.png` | 1366×700 | 1366×700 | EN | Immersive | Современный | Selected-country desktop panel | PASS | `334ce4d4bf39e973adcd462267850538dd6fe254fb86e988b7fe88138fce492a` |
| `ru-1366x768-embedded-filters.png` | 1366×768 | 1351×759 | RU | Embedded | Старинный | Full filter row | PASS | `f002ea5c7cb9e63f44480108a52c595d622a900bc26c740dfffd16f4637c3edb` |
| `ru-1366x768-embedded-archives-open.png` | 1366×768 | 1351×759 | RU | Embedded | Старинный | Archives disclosure and aligned list | PASS | `753fe49302aadf20a49438e21e0924d1083fd0aac8f121459f58e3066cbd03e2` |
| `ru-1366x768-embedded-classic-writer-marker.png` | 1366×768 | 1351×759 | RU | Embedded | Классический | Thomas Mann detail and activated writer marker | PASS | `fd36ac845d0309700cdf0cb3361cbed0d9982709c09a00efd98f8f1d35332693` |
| `ru-1366x768-embedded-brush.png` | 1366×768 | 1351×759 | RU | Embedded | Старинный | Brush and orbit line behind/below exposition | PASS | `091348591b02c69171a0877f6e0fefa24614aceda4665a737eca2fb94a864270` |
| `en-1440x900-embedded-antique-country.png` | 1440×900 | 1425×891 | EN | Embedded | Старинный | Selected-country wide desktop panel | PASS | `2b201a7fea3a1a53316f2b5da8b66315f6ee26268d6a9d6af133dc0c074435bd` |
| `ru-1920x1080-immersive-modern-filters-open.png` | 1920×1080 | 1920×1074 | RU | Immersive | Современный | Nobel/filter microstates, full globe | PASS | `31e17d7933dbc38685d8725b73cb64cee7b74dec1d553ffb1f565420f97a3966` |
| `ru-1920x1080-immersive-modern-nobel-detail.png` | 1920×1080 | 760×760 crop | RU | Immersive | Современный | Nobel detail, medallions and marker treatment | PASS | `161d85d70958d0e650cdc3aad3a0577005a0b4664a2fc12dd8a6773bd3ea21dd` |

Coverage totals:

- Required viewports: **11/11** — 320×800, 360×800, 390×844, 430×932, 768×1024, 1024×768, 1280×800, 1366×700, 1366×768, 1440×900 and 1920×1080.
- Languages: **RU and EN**.
- Modes: **embedded and immersive**.
- Public globe styles: **Старинный, Современный and Классический**.
- Interaction states: compact and desktop filters, archive disclosure, selected-country compact/expanded/desktop presentations, writer marker, Nobel filter/detail and exposition brush layering.

## V11 mobile containment regression check

The previously observed 430×932 immersive regression was rechecked after the V11 correction using France and the exact `collapsed → half → expanded` sequence.

| State | Immersive surface overflow | Surface scrollTop | Surface scrollHeight/clientHeight | Chrome top | Sheet/content height | Result |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| Direct selected state | `clip` | 0 | 932/932 | 14 px | — | PASS |
| Collapsed | `clip` | 0 | 932/932 | 14 px | content 0 px | PASS |
| Half | `clip` | 0 | 932/932 | 14 px | 429/357 px | PASS |
| Expanded | `clip` | 0 | 932/932 | 14 px | 652/580 px | PASS |

The immersive surface and world-map stage both stayed at `scrollTop = 0`; the immersive chrome and Close control did not shift out of view. The country content receives an exact mobile height, while collapsed content is zero-height.

## Sharpness review

No source change is required for the inspected sharpness concern.

| Viewport | Runtime tier and backing data | Visual result |
| --- | --- | --- |
| 360×800 | Compact texture tier by viewport width; `earth-blue-marble-mobile.webp` is 2048×1024; Canvas backing buffer observed at 307×610 with DPR ≈ 1; `data-atlas-economical=false`. | No pixel breakup, stair-stepping or blurred SVG edges. The photographic Blue Marble texture is intentionally softer/darker than vector labels at this small globe size, but is not under-resolved. Controls and outlines are crisp. |
| 1366×768 | Desktop 4096×2048 texture; Canvas backing buffer 1240×720 with DPR ≈ 1; `data-atlas-economical=false`. | Map labels, country outline, Thomas Mann portrait, activated writer marker and SVG controls remain sharp at native capture scale. |
| 1920×1080 | Desktop 4096×2048 texture; Canvas backing buffer 1920×1080 with DPR ≈ 1; `data-atlas-economical=false`. | Globe texture, visible microstate/Nobel symbols, medallions, status chips and rails remain sharp. The 760×760 Nobel detail crop shows no pixel breakup. |

The compact tier is a deliberate bandwidth tier, not the economical renderer. The economical runtime was **not** active in any of these three checks.

## Texture and identity asset provenance

| Asset | Dimensions | Bytes | SHA-256 |
| --- | ---: | ---: | --- |
| `antique-world-1887-mobile.webp` | 2048×1024 | 687972 | `65ea5f03a43b6583dd95b456f42b1d184c48dc0449eaba25c5d23269b1e5974d` |
| `antique-world-1887.webp` | 4096×2048 | 2901792 | `b498488cba930c48c5c68564ab8f355a50fe620f5aec15353225edcdf592a175` |
| `earth-blue-marble-mobile.webp` | 2048×1024 | 126246 | `7e7dcfff082c0e1efe909e6d64ee815bc1b9d17f782b802a8fd4e4b2e7a65397` |
| `earth-blue-marble.webp` | 4096×2048 | 434610 | `cc2b9b11fb1ccd4194c612c84320f0ef1ab991f6b247473be7b51a66f3328c41` |
| `modern-atlas-2026-en-mobile.webp` | 2048×1024 | 390810 | `b897e3722909ffbefa25013851ad2bdf605711a069e5c552129b6e470bb3c957` |
| `modern-atlas-2026-en.webp` | 4096×2048 | 1461376 | `8df82c055820b44b178efa7321888e9049821859ca0408bbc77b64b2d9219399` |
| `modern-atlas-2026-ru-mobile.webp` | 2048×1024 | 395256 | `dab618c766250d9df340868366a987f2a402864dc8b717482255e470f92c39ab` |
| `modern-atlas-2026-ru.webp` | 4096×2048 | 1477396 | `2eb0a86aea6d1adff08c1aace8fbd89149f432aebc4001f1b97aec637321d82b` |
| `public/brand/probpera-logo.png` | 500×500 | 20811 | `d8b31268a45ddbc576fe36e1d65ff68883ee4c4a7b490b8976001858d3f3ba27` |
| `public/brand/alfred-nobel-medallion.png` | 200×200 | 20003 | `7c81bf2b388b45e6a2a8a85f126f657719cd3dcd2f7eab4524918b026bca3e85` |

## Visual findings

- The orange brush and orbit line render at the lower exposition boundary and behind the interactive globe surface; neither covers the globe or its controls in the inspected embedded states.
- The compact filter family stays on a deliberate internal horizontal rail. “Крупнейшие архивы” opens as a distinct, readable disclosure instead of mixing its country entries into the primary metrics row.
- The selected-country panel/drawer is contained at mobile, tablet and desktop sizes. It neither displaces immersive chrome nor creates document-level horizontal overflow.
- Writer, Nobel and country-marker treatments remain visually distinguishable against all three inspected globe styles.
- No browser console warning or error was recorded after completing the matrix.

## Scope and limitations

- This is a native-raster visual inspection, not a new accessibility, performance or full functional audit. Existing automated suites remain the source of truth for keyboard behavior, reduced motion, semantics and interaction invariants.
- Automatic globe motion was left in normal product behavior. Captures were taken after the requested UI state settled; the images are evidence of layout/state quality, not deterministic pixel baselines for globe rotation.
- The in-app browser cannot independently validate GPU texture sampling beyond the native screenshot and the source-asset/backing-buffer metadata recorded above.
- `data-atlas-overflow-x=true` can occur on embedded captures because the filter and timeline rails intentionally scroll internally. The page document itself remained free of horizontal overflow in every recorded viewport.
- The 1920 Nobel detail image is an intentional 760×760 crop from the exact 1920×1080 state so marker/medallion edge quality can be inspected at native scale.
