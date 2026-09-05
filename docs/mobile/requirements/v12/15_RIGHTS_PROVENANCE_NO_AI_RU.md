# CONTENT, PROVENANCE AND NO-AI SUBSTITUTION

## Canonical content

All factual content comes from the existing site pipeline:

- writers;
- countries;
- works;
- dates;
- coordinates;
- awards;
- biographies;
- sources;
- flags;
- portraits;
- covers;
- historical globe materials.

Platform exports are derived artifacts, not editorial sources.

## Real persons

Forbidden:

- generated writer portrait;
- face reconstruction;
- “similar-looking” person;
- synthetic restoration changing identity;
- deepfake;
- generated historical photo;
- unapproved face stylization.

Allowed:

- rights-approved original portrait;
- conservative technical resize/crop/format conversion;
- colour management;
- accessibility-safe framing;
- branded faceless placeholder when no approved portrait exists.

Every portrait needs canonical writer ID, source, rights/license status,
attribution, original/derivative paths, checksum and review status.

## Flags

Use canonical SVG flag registry. Never generate or redraw flags with AI.
Keep attribution/license files.

## Biographies and facts

Forbidden:

- invented fact;
- invented quotation;
- unsourced “interesting fact”;
- automatic factual rewrite published without review;
- platform-only correction;
- machine translation marked final without review.

Child biography is a separate human-reviewed editorial field, not an
automatic truncation.

## Book covers

Priority:

1. owner-supplied and rights-approved;
2. verified licensed/public-domain asset;
3. neutral typographic placeholder.

Never generate a cover and present it as a real edition.

## Literary characters

A public-domain source text does not automatically clear a modern
illustration, translation, film/cartoon design, logo/trademark,
voice/performance or 3D model.

Rights are asset-, territory-, platform- and time-specific.

## Export gates

Platform content export must fail closed on missing stable ID, invalid
coordinates, missing source for factual child field, portrait without
rights, broken flag, duplicate writer, child not reviewed, checksum
mismatch, unsupported schema or app-only mutation.

## Parity report

Generate hashes/counts comparing canonical source, site export, PWA
export, Android bootstrap, iOS bootstrap and child packages.

Any factual divergence without explicit presentation-only rationale is P0.
