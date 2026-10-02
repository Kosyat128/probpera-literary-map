# Live UI and news delivery repair, 2 October 2026

This follow-up responds to the owner's report of a reduced showcase, only 190
calendar dates, and missing Telegram posts. It starts from protected main
`4e4e1e1dff6425083154f0cf67ff01eb88e95b25`. Earlier acceptance packets remain
immutable; the independent live UI packet reverses only the exact new fragments.

The showcase retains its 1+6 structure and published CMS selection. The lead
photo occupies the entire column at its natural ratio. Secondary cards now have
their own article images, full titles and short excerpts; the lead has a light
reading surface. Short screens retain a single scroll area and reachable footer.
The local QA uses the real public 174-article snapshot explicitly injected for
testing, including unchanged article bodies. It is not production acceptance.
See `showcase/live-regression-20261002/focused-qa.json` and its screenshots.

The 190 events are October 2026's monthly count. The canonical country runtime
contains 2340 annual unique dates, of which 2338 occur in the non-leap year 2026.
The new year view exposes all 12 months, a searchable list and 117 pages of
20 rows. Real browser tests traverse all 2338 distinct IDs on desktop and mobile,
check leap day handling, readable contrast and the actual writer route.
No date, writer identity, biography, or canonical globe state changed here.
See `calendar/runtime-coverage-20261002.json` and `runtime-validation-20261002.json`.

The delivery-only Worker was enabled on production but recorded no successful
native dispatch checkpoint. A local reproduction with the real SDK reached
request 51 before dispatch under a 50-request external budget. This is a proven
code-path defect; historical production exception details were unavailable.
The fix separates capture and dispatch into private Durable Object invocations,
rotates four of the 24 fresh candidates and processes at most two dispatch jobs.
The counter covers Supabase, feed and Telegram requests, reserves receipt and
heartbeat capacity, and stops after quota failure or uncertain provider outcomes.
The common pacing and CAS history remain intact; public HTTP routes return 404.
Real SDK tests measure 22 capture requests, 42 for a new photo plus a correction,
and exactly 50 on a safely deferred capture with a genuine failure checkpoint.
Worker/admissions/operations/budget tests: 84 passed. Bundle dry-run passed.

During repair, native delivery was disabled through the intended deployment
workflow and the existing GitHub fallback was enabled. Run `37039939941`
completed successfully and acknowledged a new Telegram post at
`2026-10-02T17:22:42.247Z`, remote ID `431`:
<https://t.me/probbaperra/431>. Thirteen same-text corrections also cleared with
their original remote IDs. This receipt proves fallback delivery, not yet the
new native Cron. VK remains deferred. Preparation AI stays paused until the
scheduled conditional quota check; this repair makes no AI request.

Source collection also rejected held records after reviewed path grammars became
stricter. Versioned code-owned previous grammars now apply only to retained held
queue validation, with current and historical origin checks. Fresh discovery
keeps the stricter grammar; metadata, decisions and evidence are retained, with
no automatic promotion. CLI failures expose only bounded allowlisted reason
codes. Related source/queue/production tests: 64 passed. The actual remote queue
requires post-merge refresh verification; it was not downloaded into this review.

Production UI screenshots, current main/code-head equality, source refresh and
the new native Cron checkpoint are separate post-deployment requirements.
This document does not claim full archive acceptance or the conditional
additional 1000 calendar-date target.
