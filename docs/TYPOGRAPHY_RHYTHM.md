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

`npm run typography:audit` checks default canonical readable roles for line heights above 1.65, including numeric aliases and font shorthand. Responsive token definitions are checked at their largest resolved ratio. Icon geometry and published CMS values are outside this upper bound. This source check complements visual review; it does not measure rendered text or replace responsive layout checks.
