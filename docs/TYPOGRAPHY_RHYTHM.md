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

Reading paragraphs use a shared `1.1em` gap. Card text uses a 12px content gap. The reading size control continues to scale the reader's text.

Keep these design relationships when extending the public styles:

- Four equal publication cards use the same card-heading scale, including the first card marked `is-featured`.
- At the user's explicit request, card share controls are compact: 32px buttons, 16px glyphs and 6px between buttons. The share label stays beside the controls in the same row. Reader share controls retain their full 44px size.
- The calendar has its own section-heading scale. At widths up to 560px, summary labels and counts share compact rows instead of stacking vertically.
- Primary book and community actions use ink `#271538` on orange `#f67518`; hover uses `#ff9b45`. Default and pressed colors calculate to 5.98:1 contrast, hover to 8.02:1, above the 4.5:1 minimum. Press feedback uses an inset shadow without moving the control or darkening its background. Check rendered colors again if published theme values change.

`npm run typography:audit` checks default canonical readable roles for line heights above 1.65, including numeric aliases and font shorthand. Responsive token definitions are checked at their largest resolved ratio. Icon geometry and published CMS values are outside this upper bound. This source check complements visual review; it does not measure rendered text or replace responsive layout checks.
