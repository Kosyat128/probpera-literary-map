# Public typography rhythm

`src/styles/site-typography.css` owns the public Onest defaults. Published CMS typography remains an independent override. The preserved Header and Hero keep their existing typography.

| Role | Default size | Line height |
| --- | --- | --- |
| Section heading | 28-52px | 1.16 |
| Card heading | 24px; 20-27px in a card container | 1.16 |
| Compact heading | 20px | 1.2 |
| Card and interface copy | 16px | 1.45 |
| Metadata | 14px | 1.35 |
| Actions and navigation | 15px | 1.35 |
| Long reading text | 19px; 17px on narrow screens | 1.55 |
| Article title | 32-56px, based on the paper column | 1.12 |
| Article subheadings | H2 24-34px; H3 21-27px; H4 18-22px | 1.2 |
| Captions and reading metadata | 14px | 1.4 |
| Sources and tables | 15px, follows reading size control | 1.5 |

Reading paragraphs use a shared `1.1em` gap. Card text uses a 12px content gap. The reading size control continues to scale the reader's text.

`article-reading-layout.css` owns reading geometry: a 68ch prose measure, a wider main column before a third sidebar is introduced at 1680px, compact metadata, and a collapsible contents list on smaller screens. Images, quotes and tables share a 24-40px block gap. Nested list paragraphs do not add another full paragraph margin. Image size, focus and appearance set by the editor remain respected.

`search-account-layout.css` owns dialog geometry and its dedicated roles. Search uses the available viewport height; results scroll independently. Form fields remain 16px, with 14px labels and hints. Password visibility controls reserve their own input space.

The illustrated book mode uses the existing shelf renderer and page-turn session. Its article adapter measures the same local Onest font, paginates the complete sanitized article without a fixed page limit, and retains illustrations, captions, links and source text. Page changes save through the existing reading-progress hook. Semantic page text and a complete illustrated fallback remain available when the 3D view cannot render.

Book pages use a smaller reading size with 1.40 body leading and measured justification between words. Paragraph endings, headings and captions stay aligned to the starting edge. Very narrow phones retain a readable size, and the reader's text-size control still applies. Each article's cover supplies the softened background behind its physical book.

Russian and English word breaks use the pinned [hyphen dictionary package](https://github.com/ytiurin/hyphen), loaded with the book adapter. Discretionary rendering hyphens do not change the original article text, links or copied page text. A failed 3D renderer keeps its readable fallback during text-size changes.

Writer biographies use 16px/1.55, with 14px/1.5 supporting notes. CMS tables and code blocks follow the 15px/1.5 technical-text role and retain their own horizontal scrolling; long inline references wrap inside the prose column. Collection labels and hints use 14px, inputs remain 16px, and collection and forum controls keep a 44px target. Menus retain keyboard focus when the pointer leaves, while programmatic reading navigation respects reduced motion.

Keep these design relationships when extending the public styles:

- Four equal publication cards use the same card-heading scale, including the first card marked `is-featured`.
- At the user's explicit request, card share controls are compact: 32px buttons, 16px glyphs and 6px between buttons. The share label stays beside the controls in the same row. Reader share controls retain their full 44px size.
- The calendar has its own section-heading scale. At widths up to 560px, summary labels and counts share compact rows instead of stacking vertically.
- Primary book and community actions use ink `#271538` on orange `#f67518`; hover uses `#ff9b45`. Default and pressed colors calculate to 5.98:1 contrast, hover to 8.02:1, above the 4.5:1 minimum. Press feedback uses an inset shadow without moving the control or darkening its background. Check rendered colors again if published theme values change.

`npm run typography:audit` checks default canonical readable roles for line heights above 1.65, including numeric aliases and font shorthand. Responsive token definitions are checked at their largest resolved ratio. Icon geometry and published CMS values are outside this upper bound. This source check complements visual review; it does not measure rendered text or replace responsive layout checks.
