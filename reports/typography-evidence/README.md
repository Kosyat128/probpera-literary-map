# Typography browser evidence

Captured from local production builds in Chrome, with loaded fonts and reduced motion. The earlier typography suite passed **7 tests** (one desktop project; each test sets its own mobile/desktop viewport). Its directory checks missed overlapping vertical content; that gap and the later repair are documented below.

The user-preserved Header and Hero retain their original typography and styling. The Source-font and minimum-text-size claims below apply to the edited content blocks, not these protected areas. No retained full-page screenshot is presented as proof of the final homepage.

## Results

- RU and EN home, interactive journal archive and reader checked at 320×800, 360×800, 390×844, 430×932, 768×1024, 1024×768, 1280×800, 1366×768, 1440×900 and 1920×1080.
- Eight text snapshots remain byte-for-byte identical: home and interactive archive in both languages, three RU articles and the one available EN article. SHA-256 before and after: `20620a4865d62b0a314d0e661e2a4442b55e2b37c391f3bdd3d454618db9b639`.
- The Japanese reference card at 320px changed from Georgia 21px with a three-line excerpt clamp to Source Serif 4 Local 20.23px and complete text. Excerpt clipping decreased from 24px to 0px in both languages. All four share controls measure exactly 44×44px and their vertical position spread is 0px.
- Focus, hover, active, copied, reduced-motion and forced-colors checks retain control geometry. The real CMS stylesheet generator overrides public defaults; component heading overrides do not affect nested reader headings.
- Reader controls retain 90%-130% text scaling. At 130%, the long RU article about knights now fits the narrow 320px reader, including its longest headings and `противоборствующими`.
- Project/editorial-directory title and description are complete at 320, 390 and 1440px in both languages. Footer label and middle dot use Source Sans 3, 14px/600, normal tracking and no text transformation.
- Delaying every font request by 1200ms on the earlier typography build produced CLS **0.000014643464265046294** at RU/1440 and **0** at EN/390. The observer was installed before navigation and excluded shifts following recent input; the reported value uses the standard maximum session window. See `font-loading.json` for actual shift entries. These are bounded local observations, not a production performance guarantee.
- Focused axe contrast checks found no confirmed violations and no rendered text below 12px in the editorial cards, community section and site footer. Header/Hero are excluded. **81 RU / 61 EN results remain incomplete** because image/pseudo-element backgrounds prevent automatic color determination. This is not a complete contrast certification; see `contrast.json` and rendered artwork screenshots.
- The earlier typography capture reported no browser page errors. No LCP/INP baseline comparison was performed.

## Artifacts and limits

`before/` contains 20 original screenshots and the original measurements. `after/` contains 28 screenshots, geometry, directory geometry and the text comparison summary from the earlier typography pass; article-image crops there predate the later preview-image cover change. The Japanese card crops show the original wrapping/clipping problem directly. The original hero crop omitted the painted image after offscreen viewport resizing, so it cannot substantiate a before/after image-surface contrast claim. Later hero captures reload, decode and repaint the actual image. Reference card capture also waits for image decoding.

Card-only screenshots hide sticky site navigation without changing card layout. Full-page screenshots temporarily make sticky navigation relative so it does not cover content. Tests and geometry measurements use the unmodified layout.

The domain build at `http://127.0.0.1:4184/` supplied four refreshed community section captures and two real book-mode reader lead/share captures. Both full-page PNGs were removed: EN/390 contained a repeated page segment of unestablished cause, and RU/1440 predated the directory repair. Mobile component captures remain available. An invalid or outdated capture is not a passing visual assertion. `after/final-domain-previews.json` records retained captures and actual book-mode styles.

The 200%/400% reflow test checks the corresponding 640px/320px CSS viewports of a 1280px window; it does not automate browser-chrome zoom. `/stati/` is an intentionally static RU SEO archive; the bilingual archive evidence targets the interactive `#journal` view. CMS compatibility uses the production stylesheet generator in the browser and does not publish CMS changes.

## Directory repair and image follow-up

The original directory checks covered typography, clamping and horizontal bounds, but did not reject vertical overlap. `directory-overlap-diagnostic/` preserves the broken state at 1767/1920px with normal/reduced motion and 8/17 cards. Inline-size containment disabled the card's subgrid, putting its content blocks in one overlapping row. A temporary diagnostic override restored the six-track layout; that fixture is explicitly diagnostic, not a final production screenshot. Current directory evidence is maintained separately in `directory-repair/`, and the six About-project crops in `after/` are refreshed against the repaired build.

The repaired build passed **36 directory snapshots**: RU/EN at 320, 768, 1024, 1440, 1767 and 1920px, each with initial/font-loaded 8 cards and expanded 17 cards. Across **396 measured cards**, all nonempty content boxes and text ranges stay in sequence and inside their cards; the smallest gap between successive text ranges is **12.875px**. Corresponding rows differ by **0px**, every action circle is **44×44px**, and category pills are at most **30.1875px** high. `directory-alignment.json` replaces the earlier insufficient alignment-only report. `directory-repair/*first-row*` shows the repaired wide rows; `*expanded*` shows all 17 cards. The focused permanent Playwright checks passed for RU/EN at 1767/1920, along with Stage 5C. Empty desktop slots reserve height only when the same slot has content in a neighboring card; fully empty rows add no blank band.

The footer follow-up centers the complete CTA label block against its circular arrow. The updated audit measured a **0px maximum center difference** across all 396 cards, including **91 multiline labels**. Wide screenshots wait for the actual local background artwork to decode before capture.

The final related-article title follow-up uses 18px/400 with a 23.4px line height, an 8px internal gap and 12px 14px 12px 16px padding. The complete 36-state audit passed again with 0px row and footer-center differences. `directory-repair/ru-norway-related-article-390.png` is a separate crop of the real Norway link, with its complete title visible.

Article preview images now use `object-fit: cover` inside their existing bounded rectangles, preserving proportions while cropping edges. Reader illustrations and book-cover rules retain their existing intrinsic/contain behavior. `preview-image-before/` shows the real Hell's Angels asset before the change: the combined unpainted bands measured 20.88px at 390px and 78.80px at 1440px. `preview-image-after/` contains the later real preview crops, enlarged editorial-standard headings and decoded-image measurements. Files named `portrait-media-fixture-*` are temporary browser fixtures using an existing local portrait asset solely to check image fitting; they are not published article content.

The final preview pass produced 14 PNGs with no capture errors: real editorial/library images and the editorial-standard panel in RU/EN at 390/1440px, plus two portrait-media fixtures. Every decoded preview image fills its container exactly; zero intrinsic grid-item minimums keep both landscape and portrait assets inside the same rectangle. The editorial-standard heading measures 28px at 390px and 28.4342px at 1440px, with 14px list text. These final component captures supersede earlier preview-image appearances.

## Community and forum follow-up

`community-before/` and `community-after/` each contain eight actual screenshots and measured styles: homepage community section and real forum dialog in RU/EN at 390px and 1440px. The preview has no live forum connection, so its actual dialog shows the existing setup state; no populated discussion data was invented.

The community left panel now uses one comfortable reading column instead of two nested narrow columns. Topic prompts use 16px UI text, supporting metadata 13px, and the forum setup heading 24px. Uppercase list prose was restored to natural case and 16px reading text. Decorative overflow decreased from 29px at 390 and 108px at 1440 to zero; the section also fits at 320px. The community primary label uses ink on orange (measured contrast 5.98:1), with its final appearance included in the screenshots. Authored strings, routes and community actions are unchanged.

Final community section PNGs include the equal-row correction: all three topic controls measure 98.5625px at 390px and 82px at 1440px in both languages, with category text starting 15px below each control's top. These final measurements are in `after/final-domain-previews.json`; the earlier `community-after/measurements.json` predates that last row-alignment correction.

Existing forum/account tab-switch tests passed in desktop and mobile projects (2 tests). The Stage 5C source suite passed all 6 tests, including the exact canonical typography owner/token for community statistics. A narrow diagnostic of daily, author, editorial, trust and section-directory blocks at 390/1440 found no text below 12px or text clipped by hidden overflow; its raw results are in `other-home-block-audit.json`.

## Interaction polish

`interaction-polish/` contains four focused footer/button screenshots and the RU/EN 390/1440px interaction outcomes. RU/390 completed in the earlier run; `ru-390-prior-run.json` preserves its completed assertions and screenshots, and explicitly notes that detailed state measurements were not written before the following desktop case stopped. The remaining three cases passed against the later build and have full measurements in `measurements.json`.

In the twelve recorded footer states, text/circle centers differ by 0px. Keyboard focus has a visible 3px outline; hover, focus and active states preserve control geometry. The primary button changes from orange to light orange on hover, then darker orange with an inset shadow while pressed. The script obtains a fresh viewport hit target immediately before mouse-down so lazy-landmark/focus scrolling cannot cause a false inactive result.

The current catalog does not render multi-series controls, so their 14px Source Sans typography and 44px coarse-pointer targets are checked with explicitly marked temporary DOM fixtures using the existing component classes. No fixture is published or retained in the application. With reduced motion, editorial/library image transforms and library-arrow transforms remain `none`. The directory-more arrow retains its identical resting/hover matrix: its static 0.25px optical offset is not an animation. Header/Hero are outside this audit.

## CMS and admin preview

Published rules retain site → component → template → page → instance precedence, base/mobile/tablet/desktop breakpoints and validated arbitrary sizes (including 17, 23, 37 and 61px). Their unlayered, zero-specificity selectors override layered defaults on the addressed semantic element without `!important`. Component/instance heading selectors stop at nested component roots. Uploaded fonts and allowlisted system families remain available; changing font source in the admin resolver now replaces the inherited source correctly.

Article/page previews and the Studio sample load the same 14 local WOFF2 assets through Next.js. The Studio sample remains explicitly a structural sketch; this change does not add a live resolved-settings preview. Admin TypeScript validation passed after workspace dependencies were linked.

An existing inheritance limitation remains: a `site/body` override of 23px Georgia changes the body itself, while `.article-copy p` retains its directly declared 16px Source Sans 3 default. Chrome verified this distinction. The cascade was not broadened to force all descendant semantic roles to inherit the body setting. CMS settings were not published, and this work makes no production-deployment claim.

## Reproduce

Serve the domain production build at port 4184 in a separate terminal. Do not rebuild `dist` during a browser run.

```powershell
$env:HOST = '127.0.0.1'
$env:PORT = '4184'
node scripts/serve-dist.mjs
```

Then run the checks in another terminal:

```powershell
$env:PLAYWRIGHT_PORT = '4184'
$env:PLAYWRIGHT_REUSE_SERVER = 'true'
npx playwright test tests/e2e/typography-and-card-geometry.spec.mjs --project=desktop-chromium --workers=1
node scripts/capture-typography-evidence.mjs --phase=after --url=http://127.0.0.1:4184/
node scripts/audit-typography-contrast.mjs http://127.0.0.1:4184/
node scripts/audit-typography-font-loading.mjs http://127.0.0.1:4184/
node scripts/capture-community-evidence.mjs after http://127.0.0.1:4184/
node scripts/audit-calendar-geometry.mjs http://127.0.0.1:4184/
node scripts/audit-interaction-polish.mjs http://127.0.0.1:4184/
node scripts/audit-directory-geometry.mjs http://127.0.0.1:4184/
```

Capture `--phase=before` only against an actual unmodified baseline build. The evidence scripts accept a different preview URL (capture: `--url=...`; audits: first positional argument).

The calendar audit checks RU/EN at 320, 390 and 1440px in compact, full-month, selected-day and deselected states, plus hover/focus geometry. It writes `calendar-geometry.json` and six calendar screenshots, and exits unsuccessfully if any geometry or flag-accessibility assertion fails. Sticky navigation is hidden only during screenshot capture; application styles remain unchanged.

The directory audit verifies both alignment between cards and non-overlap of content boxes and text ranges within each card. Desktop cards must expose a real six-row subgrid, with no layout containment on its carriers. It checks initial, font-loaded and expanded states at six widths including 1767/1920px, and rejects collapsed tracks, hidden content and stretched labels/action circles. Results are written to `directory-alignment.json`, wide screenshots to `directory-repair/`, and the six refreshed About-project crops to `after/`.
