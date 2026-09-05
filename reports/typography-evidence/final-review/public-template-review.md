# Public template review

Implemented in existing CSS owners only: CMS reading width/spacing, scrollable table/code blocks, CMS navigation/metadata roles, and complete forum category labels. No HTML, authored content, catalog data, account logic, book logic, 3D geometry, or main Header/Hero changes.

| Public family | Route or entry point | Shared template |
| --- | --- | --- |
| Journal and section archives | `/stati/`, `/stati/{section-slug}/?series={id}` | ArticleLibrarySection |
| Articles, RU/EN and reader themes | `/stati/{section-slug}/{article-slug}/`; legacy `/articles/{id}/` also resolves | ArticleReader |
| CMS pages | `/stranitsy/{slug}/` | CmsPageReader |
| Book archive and selected book | Main page `#books`; `?book={key}&archiveShelf={id}` stores selection | BookArchiveSection |
| Forum and account | CommunityHub dialog opened by `openCommunity()`; no separate URL route | CommunityHub |

Routes are relative to the configured Vite base URL. This maps template families; it is not a route availability or content catalog audit.

Evidence: `public-template-review.json` contains current-source SHA-256 values, before/after computed styles, and four Chrome fixture cases: 390/1440 CSS px at reader scale 1/1.3. All 36 case assertions pass.

- CMS wide `pre`/`table`: previously overflowed a clipped article; both now retain their full text and scroll horizontally. Actual `scrollLeft=100` is recorded for each case. They reuse the reader's existing 13px technical-text role and its 1.3 scaling to 16.9px.
- CMS header/prose: share one centered reading width with responsive outer gutters. Prose is 316px at 390px and capped at 760px on desktop. Combined bottom padding falls from 182px to 72/112px. The former typography-layer `68ch` constraint remains on ArticleReader; CMS width now has one owner.
- Main reading text and page title computed sizes are unchanged. Body remains 17/19px, increasing to 22.1/24.7px at scale 1.3. Navigation/back labels use 14px; update/brand metadata uses 13px.
- Forum: the actual category label `Современная литература` and its description fit fully, with no ellipsis/clamp. The title retains its 14px role, description uses 13px and the shared dark-surface muted color. Horizontal category navigation remains.
- Fixture text SHA-256 is identical before/after; document horizontal overflow is absent in all four cases.

Scope and limitations: these are isolated source-CSS fixtures with representative markup, not live CMS/forum pages or authenticated flows. No full-page screenshots, font-file loading audit, route navigation, 3D interaction, account review, build, full test suite, or production checks were performed for this bounded change. Browser rendering checks validate CSS sizes and scaling, not a new font asset release. Root performs integration/build verification separately.
