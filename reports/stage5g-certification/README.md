# Stage 5G - final local certification

- Tested product commit: `00043d57ad43208e5cff9e9da13345d308dd52d0`
- Main synchronization commit: `c1939a632bc4c3d36649e7c4b2076fcc0711d2c4`
- Previous Stage 5F commit: `d473278a7d0617f14b1d50938fda9bab5c464efa`
- Environment: Windows, bundled Node.js runtime, Playwright Chrome
- Certification date: 2026-08-28 (Europe/Moscow)

The tested commit is a linear continuation of the completed Stage 5A-5F work.
The Bookshelf implementation was not restarted or replaced. The final block
closes cumulative interface-language coverage, checkout-portable security and
database source contracts, current owner locks, root-domain performance
measurement and the remaining browser-test drift.

## Final disposition

**PASS.** All failures observed in the one full local release/browser pass were
classified and resolved without weakening product, privacy, RLS, owner-lock,
content-lock, accessibility or performance guarantees.

The full browser pass produced `128 passed`, `18 expected skips` and eight
failures. Six were stale ASCII-hyphen expectations after restoration of the
approved Russian Hero en dash. The other two were main-thread/lazy-boundary
timeouts seen only under eight-worker contention. Post-fix focused validation:

- Hero/Header approved punctuation and responsive geometry: `6/6 PASS`
  across desktop and mobile;
- desktop Archive grid and lazy Globe book selection: `2/2 PASS` with one
  expected mobile-only skip;
- earlier focused Archive/art-direction journey: `10/10 PASS`;
- rich Archive interaction journey: `1/1 PASS`;
- Globe demand-loading, search and responsive journey: `6/6 PASS`.

No second full Playwright run was made after those focused checks because the
changed surface was limited to the eight diagnosed expectations/timeouts.

## Release and data gates

- ESLint: **PASS**.
- Vitest full pass before final expectation alignment: `329` files passed,
  `2` skipped; `1,771` tests passed, `2` skipped. The two stale Header/Hero
  expectations were then corrected and their focused owner/governance suites
  passed.
- Admin Next.js production build: **PASS**.
- Root-domain production build: **PASS** - `162` static article pages and
  `2,271` legacy redirects.
- Domain audit: **PASS** - `12,524 / 12,524` checks.
- SEO audit: **PASS** - `5,317 / 5,317` checks.
- CMS publication metadata: **PASS** - `162` ready, `0` mismatches.
- Content, editorial, media, country, biography, identity, Nobel, book-cover
  and Globe deterministic audits: **PASS**.

## Performance result

Measured against the root-domain `dist/` used by Playwright:

| Budget | Measured | Limit | Result |
| --- | ---: | ---: | --- |
| Initial references | 4 | 4 | PASS |
| Initial JavaScript gzip | 217,832 B | 307,200 B | PASS |
| Distribution total | 115,177,258 B | 115,343,360 B | PASS |
| Distribution excluding book covers | 75,602,092 B | 75,759,616 B | PASS |

Largest/main JavaScript, cover, portrait and texture budgets also passed. The
production package contains `4,512` files. Heavy Globe, Three.js, complete book
data and full search data remain outside the initial graph and load on demand.

## Final cumulative interface attestation

- Interface registry: `1,189` entries.
- Interface key SHA-256:
  `79edc8b7923dc9eaf3a6859bc988a38edf2d3dcaa0d1bbd5841a259883323cc5`.
- Interface pair SHA-256:
  `1538ec0ee99fc7f4254af02b9765a4f683812aca8bfdaebfd524e2848d6a2f49`.
- Private interface catalogue: `1,403` entries.
- Catalogue key SHA-256:
  `164e06ac283059a7949b7894d3d68968df5ac2df8b8d4e985adfdb77f619273c`.
- Catalogue content SHA-256:
  `99f8b1b753e3c7ea0248c054e53d62851b8611b51d43ffc6d36c5576de417b74`.

## Locked content attestations

- Authorial corpus (`320` files):
  `e1f092a4e14c78a01335662135cc5c47ba2295b05ca1b6c0d5c1dab0ed644ace`.
- Published CMS:
  `3175e13dbf0fc107239568ab94b138773a372f3bd29c0b9126a1983ebda6efa3`.
- Canonical data:
  `008055a29f40a52aa9afd04b9b9ceded0b47522c5a3c6e65a8512af96f0620dc`.
- Stage 4 ownership:
  `260a808d2a2f97e9d48a8b2262a08d3cf770d3eaf0d8cd9b0306daf1ed143a30`.
- Book archive owner:
  `7b64ee4ff098a8dab2f65d8169612e6438d5f81a98c646069c162bd123e483f5`.
- Premium presentation:
  `b701065625ba4cf6ccb94c48562d9438ceee069cd49970262b5df220d4fa5e41`.

## Limitations and next gate

This is local certification, not a production claim. Stage 5H must verify the
exact merged/deployed SHA, public and admin origins, redirects, canonical/SEO
endpoints, security headers, service-worker freshness, private catalog SHA
preseed, representative RU/EN desktop/mobile journeys and rollback evidence.

**STAGE 5 PREMIUM SITE EXPERIENCE: READY FOR OWNER REVIEW**
