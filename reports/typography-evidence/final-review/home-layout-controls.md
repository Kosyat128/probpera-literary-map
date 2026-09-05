# Homepage layout and control evidence

`home-layout-controls.json` records 18 passing assertions on the actual RU homepage DOM at 390 and 1440 CSS px. Before uses the then-current dist at `localhost:4184`; after injects only `editorial-card-layout.css`, `stage5-home-layout.css`, and `stage5f-responsive-accessibility.css`. Source hashes and computed geometry are included.

At 1440px, the four-story grid changes from 1306px to 681px high, and the featured story's empty gap before its action changes from 612px to 16px. All four titles fit. Content/order, image URLs, links, and 44px Share controls are preserved. The mobile article geometry is unchanged. Closed editorial-policy panels shrink from 306px to 107px on desktop, and both email links have 44px hit areas.

Scope: this proves the three source CSS changes against actual page markup. It is not verification of a newly built dist, image downloads, production, authentication, 3D behavior, or a full responsive/test matrix. The 681-1279px two-column branch is source-defined; these two browser cases cover 390px and 1440px only.

The final-dist check is complete: `home-layout-controls-final-dist.json` records **22/22 passing assertions** on the actual built page, with no CSS injection. Each lazy image is decoded while its card is in view. The final assertions also check matching image and metadata rails; asset URLs and capture time are recorded in the JSON.

The later four-card refinement gives all preview frames the same 16:10 ratio, with preserved `cover` fitting. The desktop grid is now 649px high and image bottoms, metadata starts and Share rails align. Closed policy cards are 107px high and both email hit areas are 44px. Mobile card geometry is unchanged. Content/order, image URLs, links, full titles, Share control sizes, and absence of horizontal overflow pass at both tested widths.

`home-layout-controls-image-loading-diagnostic.json` preserves an earlier attempt that scrolled past mobile cards before their lazy external images finished loading. Its image-loading assertion failed while all geometry assertions passed. The final helper waits for each actual image decode instead; the passing result above supersedes that diagnostic.

The desktop crops `final-dist-1440-four-stories.png` and `final-dist-1440-trust.png` were opened and visually reviewed. `.tmp/home-visual-check/check-final-dist.mjs` is the bounded helper used for this check. This remains a verification of these three areas at two widths, not a full test suite, production release, or verification of a subsequent unrelated Atlas-only rebuild.
