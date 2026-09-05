# Typography and homepage card geometry

Baseline: `e073b21acfea854b3b573aa4613215156957ff38` (`origin/main`). Branch: `codex/master-typography-and-card-geometry`. Work is isolated in `probpera-typography`; other working copies are untouched.

## Scope and owner decisions

This is the independent typography task requested in `Типография.txt`. Later owner instructions take precedence: both Header bands and the complete Hero retain their original appearance; the community/forum panels receive a further layout pass; calendar country badges become accessible SVG flag controls. The owner's final screenshot explicitly authorizes restyling the open Sections and Articles navigation panels only, as a new exception to the earlier complete Header preservation.

Article text, editorial data, translations, routes, SEO metadata, images and book/writer records are preserved. The intentional calendar exception removes the visible generic country caption/name from each event action while retaining the localized country name as its accessible label and tooltip. It does not change the selected country or action.

## Typography

- `src/styles/site-typography.css` owns public families, roles, sizes, weights, leading and tracking. Existing homepage variables resolve to these roles. Legacy style sheets use the lower `site-defaults` cascade layer; validated CMS styles remain unlayered.
- Existing local Source Serif 4 serves editorial headings and reading text; Source Sans 3 serves excerpts, navigation, metadata and actions. The existing WOFF2 files, real 400/600/700 weights and italic faces are reused. No new dependency, font download or CDN was introduced.
- Card titles respond to their own container: featured 28-38px, standard 20-27px, compact 18-23px, with explicit fallbacks. Directory titles use the stable 24px card role: their shared row containers deliberately have no layout containment. The editorial-standard heading uses the larger featured role at the owner's request, with its supporting list increased to 14px. Excerpts are 16px, metadata 13px, actions 14px. Text is complete; editorial words no longer use `anywhere`/`break-all` wrapping.
- Reader content retains its existing 90%-130% scale. Heading and body roles scale together; the smallest reader has enough horizontal space for the measured long Russian words.
- `header-preserved.css` is the explicit, narrow exception for the owner's original system fonts and metrics. The initial comparison against baseline CSS found zero differences across 170 Header/Hero elements per RU/EN case at 390px/1440px. The later comparison excludes only the subsequently authorized open navigation panels: all 91 protected elements have zero differences in all four cases. CSS comparisons require identical rendered text so asynchronous archive counters cannot create false geometry differences. See `typography-evidence/header-hero-baseline-computed.json`.

## Card layout and homepage

| Existing role / selector | Canonical token | Local family and default |
|---|---|---|
| `--home-title-major`, section headings | `--type-section-title` | Source Serif 4, 28-52px |
| Featured / lead cards, editorial standard | `--type-card-feature-title` | Source Serif 4, 28-38px in its container |
| "Book of the month" section heading | `--type-card-feature-title × 1.25` | Source Serif 4, exactly 25% larger than the previous heading at the same width |
| `.article-copy h3`, `.library-card-copy h3` | `--type-card-title` | Source Serif 4, 20-27px in its container |
| Directory heading on an uncontained subgrid | `--type-card-title` fallback | Source Serif 4, 24px |
| Compact cards and author names | `--type-card-compact-title` | Source Serif 4, 18-23px in its container |
| Nested "article on the topic" title | `--type-card-related-title` | Source Serif 4, 18px / 1.3, regular 400 |
| `--home-copy`, card excerpts | `--type-card-excerpt` | Source Sans 3, 16px / 1.6 |
| `--home-metadata`, Share label | `--type-card-meta` | Source Sans 3, 13px / 1.4 |
| `--home-action-size`, section links and series controls | `--type-action` | Source Sans 3, 14px |
| Article / CMS prose | `--type-reading` | Source Serif 4, 19px desktop / 17px mobile, existing reader scale |

The removed declarations and original selectors are recorded in `typography-evidence/migrated-declarations.json`, `calendar-migrated-declarations.json` and `community-migrated-declarations.json`.

- Editorial cards use a natural content area and a separate bottom footer. Section links, Share labels and controls share the content rails. Four equal 44×44px controls contain 18px icons; interaction states retain their boxes.
- A later full-page review found that four editorial cards were still using a three-column composition with a two-row lead, leaving an empty cell and 612px between the lead excerpt and action. The shared four-card composition now uses four complete columns at wide widths, two rows of two at medium widths and the unchanged mobile stack. Matching 16:10 preview frames also align image bottoms and metadata starts. The final desktop grid is 649px high instead of 1306px; the disproportionate lead gap is removed. Other card counts retain their existing composition.
- Editorial and library preview images now fill their existing rectangular frames with `object-fit: cover` and zero minimum dimensions, as requested. Image assets, proportions and existing focal positions are preserved; reader illustrations and book covers keep their original fitting behavior. Fourteen final screenshots and decoded-image/frame assertions cover real RU/EN cards at 390px/1440px, including the reported Hells Angels image, and two explicitly labeled temporary portrait fixtures.
- Directory cards use six shared natural grid rows. Eyebrows, titles, descriptions, series, the nested related article and bottom actions align with adjacent cards. Empty desktop slots retain the row landmarks; mobile empty slots collapse.
- The entire directory CTA label is vertically centered against its 44px arrow circle, including multiline labels. Series links and library filters use the 14px action role and 44px minimum touch targets. Existing keyboard focus rings are restored where local rules previously removed them.
- The nested related-article title uses a quieter 18px regular face instead of the previous 20px semibold compact title, with 1.3 leading, an 8px label/title gap and more breathing room inside the linked panel. This is a shared variant for every section, with complete titles and the existing shared row alignment.
- Interactions reuse the established 160ms/200ms easing tokens and 80ms pressed feedback. Share controls, directory arrows, community topic controls and calendar actions have deliberate border/background/shadow feedback without moving their layout boxes. Primary book/community actions retain a distinct pressed state. Preview-image zoom and decorative library/more arrows animate only for a fine hover pointer with no reduced-motion preference. Header and Hero motion is untouched.
- Community panels use readable single-column measures inside the desktop pair. Discussion cards show their complete titles, with consistent metadata and spacing. The forum dialog uses restrained heading sizes, readable text, and reachable tabs/close controls.
- Calendar event rows retain date, writer and country actions. SVG flags replace large text country badges; the date and action columns have consistent rails. Country names remain available to assistive technology.
- Bookshelf and globe interaction/data pipelines retain their existing structure and assets; their local text uses the shared font aliases.
- A final review restored the library search and reader sequence keyboard focus, including forced-colors mode. Community discussion controls and the bookshelf scene hint retain a static gradient while their background color transitions smoothly. Portrait attribution uses the 14px secondary-action role; life dates and footer metadata use 13px. Footer buttons and social links now reach 44px on coarse pointers without changing Header controls.
- Closed editorial-policy cards no longer stretch to the height of their open neighbor. The report-error and footer email actions have 44px targets while prose links retain their normal reading flow.
- Open navigation panels use Source fonts, 13-14px supporting text and 18/24/30px title roles. Sixty-two old font declarations and twelve clipping declarations were removed from `index.css`. Sections use compact natural lists with common column rails and adapt from four columns to two and one; forced equal text rows were removed after the owner identified excessive whitespace. An opaque cream surface prevents content behind the panel from showing through. The Articles lead uses 40% of the body width and places its full intrinsic-ratio image above the complete copy; the blurred duplicate, image overlay and hover crop are removed. Group names and category labels use a legible orange. The panels have bounded scrolling and reachable footer actions. The original mobile Header routes users directly to the catalog; narrow popup layouts are checked as explicit fixtures, not presented as newly available mobile navigation.
- The "Book of the month" heading is exactly 25% larger at the same container width, as separately requested. Standard reader section headings have responsive 32-48px top margins plus 20px separator padding instead of 78px plus 26px; subheadings use 24-36px top margins instead of 55px. The book theme keeps its specific pagination spacing and the reader's font scale remains available.
- The book-month heading measures 28px before and 35px after at both 390px and 1440px. Its real loaded cover, full copy and actions remain visible. The owner's subsequent white-text request applies to the book-month "About the book" button: its label stays white in rest, hover, keyboard-focus and pressed states. Scoped darker orange shades retain contrast without changing the global palette.
- The owner separately authorized reorganizing the embedded Literary Planet controls. A small layout wrapper retains the existing heading/search/filter nodes and IDs; filters start at the left and search occupies the right of the same control row, with a stacked narrow layout. Immersive panels retain their existing owners. This does not change globe rendering, selection, search data or navigation logic.

## CMS compatibility

The existing site/component/template/page/instance model and breakpoint order are preserved. Generated selectors use `:where()` so cascade layers can give valid CMS settings priority without `!important`. Heading overrides exclude nested component and instance roots; root headings are supported. Invalid settings still generate no public rule.

Admin article/page previews and the Studio typography sketch load the same existing local font files. The font source editor clears an incompatible previous family when switching between uploaded and system fonts.

The inherited body-setting behavior is intentionally retained: a body override changes inherited body text, while an explicit child role keeps its own size/family. The Studio sketch remains a structural sample; browser compatibility checks use the actual public CSS generator. No CMS publication or external data mutation was performed. See `typography-evidence/cms-compatibility.md`.

The public-template review also aligns CMS headers and prose to one reading measure (316px at 390px, capped at 760px on desktop), removes double side padding and reduces combined bottom padding from 182px to 72/112px. Wide tables and code reuse the reader's horizontal scrolling and scaled technical-text role. Forum category titles and descriptions wrap fully instead of ending in an ellipsis. All 36 assertions in four source-CSS fixtures pass; these are explicitly representative CMS/forum fixtures, not live CMS content or authenticated forum data. The route-family mapping and limits are in `typography-evidence/final-review/public-template-review.md`.

## Evidence and validation

Detailed artifacts and reproduction commands are in [typography-evidence/README.md](typography-evidence/README.md).

- Browser matrix: RU/EN, 320, 360, 390, 430, 768, 1024, 1280, 1366, 1440 and 1920 CSS pixels; home, archive and readers; full excerpts, Share rails, states, scaling and CMS overrides.
- Real before/after reference-card screenshots show the removed three-line excerpt clamp and corrected four-control Share row.
- Reflow checks use the 640px/320px CSS viewports equivalent to 200%/400% of a 1280px window. They do not automate browser-chrome zoom.
- Delayed local-font loading measurements and sampled card/reader contrast are recorded separately. No before/after LCP or INP claim is made. Image-backed contrast has explicitly documented automatic-check limits.
- Source audit rejects competing canonical size owners, unavailable weights, unauthorized font aliases, unsafe wrapping and clipped full-text roles. The restored Header/Hero exception is explicit and bounded.

Integrated validation results:

| Check | Result |
|---|---|
| `npm run lint` | Passed public/admin type checks, text policy and typography audit |
| `npm test` | 501 files passed, 2 skipped; 2902 tests passed, 3 skipped |
| `npm run typography:audit` | 18 public CSS files, 0 issues |
| Focused typography Playwright suite | 7/7 passed; both locales and ten viewports are exercised inside the suite |
| Added wide-directory Playwright regressions | 2/2 passed; initial/loaded/expanded states at 1767px and 1920px, RU/EN |
| Final typography suite plus homepage geometry after interaction polish | 10/10 passed (the nine typography tests and existing Stage 5C browser regression) |
| Related-title follow-up | All 3 affected directory/homepage browser regressions passed after the final 18px change |
| Button interaction follow-up | RU/EN at 390px/1440px passed; stable label/circle centers and control boxes, visible keyboard focus, distinct pressed states, reduced-motion checks. Series controls use explicitly labeled fixtures because the current published data does not expose that navigation |
| Existing forum/account switching | 2/2 passed, desktop and mobile |
| Existing homepage/navigation/reader/globe/book/calendar regressions | 15/15 passed; includes the unchanged exact community height and first-line alignment assertions |
| Directory alignment | 36 initial/loaded/expanded locale/viewport cases, including 1767px and 1920px; 396 cards, six real rows, no vertical overlap, 0px row spread and 0px CTA label/circle center difference, including 91 multiline labels |
| Calendar SVG and geometry audit | 30/30 content and control-state cases; 0px writer/flag rail spread, loaded SVGs and localized accessible labels |
| CMS and audit focused tests | 33/33 passed |
| Final source guard and layout contract tests | 20/20 passed, including the new subgrid containment guard |
| Public-template integration before the last Atlas/action follow-up | 22 browser tests passed, 1 mobile-only case skipped in the desktop project; typography, Header/Hero, reader themes, globe controls, community and homepage geometry |
| Final card/menu integration | 16/16 browser tests passed; two additional RU/EN card tests passed after image-frame alignment |
| Final navigation panels | 28/28 cases passed: 12 real desktop dropdowns and 16 explicit narrow fixtures; 98 orange labels at minimum 4.657:1 contrast |
| Loaded book-month heading and button | 28→35px at 390/1440; white label retained in all eight recorded button states, contrast 4.817-6.319:1, fixed geometry |
| Final four-story grid, policy cards and email controls | 22/22 assertions passed at 390/1440 against built pages, with actual decoded images and content/link comparison |
| Final Atlas control row | 4/4 built-page cases at 320/390/1440/1848; six buttons and search share one row at 1440/1848 with 0px button-row spread, all controls 48px high, no heading clipping. Updated desktop/mobile control E2E: 2/2 passed. Earlier immersive enter/search/filter/Escape/exit smoke also passed |
| Admin production build | Passed |
| Snapshot/domain public build, domain and SEO audits | Passed |
| Release content/configuration/editorial/book/cover/globe gates | All completed successfully |
| Final performance budget | Passed, 4564 production files; initial module/preload/CSS gzip 255307 / 307200 bytes |

The `release:check` chain was resumed from its remaining gates after Windows CRLF checkout bytes caused exact-generation comparisons to fail. Each affected artifact was first compared with the baseline; only line endings were restored. Git-normalized data and authored content are unchanged. Already successful tests were not repeated just to restart the chain. Verification used the versioned CMS snapshot (`CMS_SNAPSHOT_PREEXPORTED=true`) without a live CMS export.

Independent review also found a light-reader theme regression before delivery: the dark muted color was reaching paper/book surfaces. The canonical light theme group now includes both; the existing reader contrast regression additionally checks the real lead and Share label.

The integrated homepage regression also caught unequal mobile discussion-card heights. These now share the natural height of the largest card and align content to the top; the original exact geometry assertions pass without relaxed tolerances. Calendar mobile dates use their own row, while writer names and SVG flags share the full available width below.

The owner then exposed a directory regression missed by the original cross-card alignment checks: `container-type: inline-size` disabled `subgrid` on the card itself, causing all six child slots to overlap. Removing containment from this carrier restores real shared rows; labels retain their natural height. The source audit now rejects size/layout containment on subgrid carriers, and a permanent browser regression checks visible semantic blocks for non-overlap before/after loading and expansion at the affected wide viewports. Earlier 0px rail measurements alone were insufficient; current directory proof explicitly checks the missing conditions. Diagnosed broken screenshots are labeled separately, and stale full-home screenshots were removed from final evidence.

## Release boundary

Local browser results are not a claim of deployment or production readiness. This task does not merge a PR, publish CMS changes, alter DNS or deploy the site. Historical Header/Hero accessibility findings are retained because their original appearance was explicitly requested.
