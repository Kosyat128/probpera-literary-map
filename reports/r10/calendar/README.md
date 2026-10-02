# R10 / C: existing literary calendar

Local implementation and data verification, 2026-09-26. No publication, deployment, database or social delivery was performed.

The original production data contains 1,684 public writer records and 1,671 deduplicated identities. The original calendar shows 2,235 annual events; **179 is the September month count**, not the annual corpus. The baseline of the original historical +1,000 task is unknown; earlier accepted work has not been reset or claimed as this batch.

The corrected QID/event selector counts 2,237 baseline events. Its +2 difference from the old selector is a deduplication correction, not added dates. With this batch it counts **2,297 annual events**, including 1,254 birthdays and 1,043 memorial dates. The same policy/year/locale is used for before and after. In display year 2026, 2,295 are visible; in leap year 2028, 2,297 are visible.

The batch contains 60 guarded field patches: **51 newly filled or refined date values and 9 already stored 1 January values whose day precision is now confirmed**. It adds 60 unique calendar events, of which 59 appear in 2026 and all 60 in 2028. The difference is Tim Powers's documented 1952-02-29 birthday. Restored 1 January visibility is reported separately from new date values.

The >=2,000 total threshold is met. The +1,000 growth threshold is **not complete**: the remainder is 940 unique calendar events, or 949 if counting only new date values. This batch does not establish the unavailable historical cumulative baseline. More identities and authoritative exact dates are needed; absent claims, living writers without death dates, disputed dates, baptism/traditional dates, and unsupported precision are not manufactured to fill the target.

## Evidence and effective layer

- `legacy-observed-baseline.json`: actual before-edit runtime inventory, including all months and source HEAD.
- `baseline-dates.json`: date-only input fingerprint and each existing public writer's stable key/QID.
- `wikidata-date-evidence.json`: bounded current Wikidata batch, original birth/death statements, qualifiers, references, revision IDs and retrieval time. Existing `normalizeStatement` from the facts refresh helper is reused.
- `audit.json`: matched before/after policy, unique birth/death counts, each accepted new event and remaining target.
- `held.json`: all missing/non-calendar date fields, classified by unavailable identity, unavailable precise evidence, pre-existing editorial decision, unsupported calendar, qualifying statement or conflicting claims.
- `scripts/governance/calendar-reviewed-precision.r10.json`: three year-to-day refinements separately confirmed with UKZN's Alan Paton timeline and SAHO's Alex La Guma event record. All other prior precision decisions remain held for source review.

Runtime path: reviewed editorial country corpus -> `applyWriterDatePatches` -> CMS country/writer overrides -> App countryArchive -> existing LiteraryCalendar `selectCalendarEvents`. CMS remains the final authority. A later source/CMS edit is retained; an overridden patch is not counted as newly visible by `--check`.

The allowlist is exactly `birthDate`/`deathDate` and value-bound `dateEvidence`. Each patch has an expected old date/evidence pair, applied value and source revision. Apply and rollback check those pairs and preserve later edits. Missing statements do not clear a field. Rollback has no permission to replace a writer object. No names, biographies, works or photos change. A test compares all non-date fields for every patched writer.

The existing calendar UI, route, callbacks and styles remain unchanged. The date fixes address demonstrated defects: confirmed 1 January was suppressed, pre-1900 leap validation used 1900 instead of the source year, same-surname/date deduplication could merge people, language-dependent name length could select a different country link, and February's agenda could show a nonexistent 29 February. Stable reviewed QID (fallback stable country/writer key) identifies events. Conflicting exact dates for the same QID are held rather than selected by display-name length. RU/EN use the same identity and writer link.

## Verification

- PASS: `node scripts/enrich-calendar-dates-r10.mjs --check`; reuses persistent source evidence without network requests.
- PASS: `node node_modules/vitest/vitest.mjs run src/components/LiteraryCalendar.test.ts src/data/countries/writerDatePatches.test.ts src/data/countries/writerFactCorrections.test.ts src/data/countries/writerIdentityRegistry.test.ts src/utils/writerDates.test.ts --configLoader runner --cache=false`: 5 files, 160 tests.
- PASS: `node node_modules/typescript/bin/tsc --noEmit`.
- The date tests verify every patch's exact referenced claim and QID, Gregorian precision, impossible dates, birth/death order, future death rejection, idempotence, apply conflict, rollback conflict, later biography preservation, missing opposite-field preservation, effective CMS precedence, RU/EN identity and leap/non-leap visibility.

`node scripts/enrich-calendar-dates-r10.mjs --write` deterministically rebuilds this accepted batch from unchanged inputs and persistent evidence. `--refresh --write` explicitly fetches the bounded candidate QIDs again. Do not run the broad writer importer for this task.

C01-C03, C05-C07, C09-C14 have local evidence above. C04 remains partial because +1,000 was not established. C08 browser/visual evidence is recorded separately in `browser-check.json` and PNGs after the local runtime check; it is not production acceptance or a deployment claim.

Browser PASS: local Chrome, 1280x1000, Europe/Moscow, fixed 2026-01-05; January shows 223 events and all nine confirmed 1 January birthdays, February shows 191 with no day 29, September shows 182 and Agatha Christie opens `?country=england&writer=agatha_christie#calendar`. EN February shows the same 191 events. No page errors. The three PNGs were opened and visually inspected: original calendar layout, date states, country flags, writer rows and language switch remain intact. This verifies local runtime, not live production.

## Runtime coverage and discoverability, 2026-10-02

The current public corpus has 2,340 unique annual events (1,287 birthdays and 1,053 memorials). In 2026, 2,338 are available; both documented 29 February birthdays are available in 2028. **190 is the October 2026 total**, not an event cap or partial data load. App imports the complete public `countries` export and passes its unfiltered `countryArchive` to the calendar.

The monthly summary now says "дат за месяц" / "dates this month". A derived annual coverage line states the actual corpus and the available display-year total. The Month/Year switch provides direct access to all twelve months, a paginated year list with twenty real events per page, and search by displayed writer name, country or DD.MM. Year navigation retains the search and filters the actual events for the selected year. Existing month selection, compact agenda and writer/country callbacks are preserved.

`node scripts/audit-calendar-runtime-coverage-r10.mjs --write` checks the current App input, unique events, public writer references, RU/EN identity parity and leap/non-leap totals. Its report is `runtime-coverage-20261002.json`. The browser regression `tests/e2e/calendar-runtime-coverage.spec.mjs` traverses all 117 pages and verifies 2,338 unique reachable writer controls, every month total, February search in 2026/2027/2028 and the Christie writer URL. `runtime-ui-20261002.json` records separate local Chrome RU/EN geometry and page errors. These are local runtime checks; production acceptance is recorded by the release owner.

The known baseline remains 2,237 annual events. Net growth is 103, so the original additional-1,000 requirement is still incomplete. This UI correction adds no writer records or dates and does not change canonical profiles, CMS precedence, database services or the globe renderer.
