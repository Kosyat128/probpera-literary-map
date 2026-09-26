# N: persistent bounded HTML archive pagination

Implemented in `scripts/lib/literary-news-feed.mjs`. Only the code-owned Nobel press-release HTML profile currently opts in: `link[rel~=next][href]`, exact anchored `/press-release/page/[1-9][0-9]{0,3}/` path grammar. The existing cached Nobel root HTML contained the observed page-2 link; it was not guessed. The live audit then fetched both real pages with the production pinned-DNS transport.

Each source check reads one page. The scheduler persists `nextPageUrl`; an HTML page without a next link rotates back to the root. A parser/pagination-profile or endpoint change invalidates the cursor, conditional validators and cooldown, while retaining historical candidates. Invalid or ambiguous next links preserve current-page findings and the unchanged cursor with `paginationError: next_url_not_allowed`; they never become fetch destinations. The collector applies HTTPS, same-origin, credential-free, query-free, fragment-free exact path checks to both remote links and restored cursors; redirects remain prohibited.

Budgets are separate: `maxRequests` bounds source checks, `maxPageChecks` bounds page checks, and `maxHttpRequests` bounds actual HTTP requests including unconditional 304 retries. Defaults keep the existing scheduled 12-source budget at at most 12 pages / 24 HTTP calls, not 12 HTTP calls. `scheduler.lastRun` records actual counts. Conditional reuse on a paginated source additionally requires the same page URL and retained candidate URLs under the same parser fingerprint. A foreign-page 304 needs a body retry within the same request budget.

Historical page findings merge by canonical URL; unchanged discovery timestamps and editorial decisions survive. The collector rejects growth beyond the existing 25,000-item limit without eviction or cursor advancement. The existing ingestion byte guard and single digest-checked KV generation commit candidate findings and scheduler together. The test invokes those actual serializers and sync function: a failed generation commit leaves page 2 pending, and the next run re-fetches page 2 before committing page 3.

Validation:

- `node scripts/check-literary-news-pagination.mjs`: PASS. Fresh process-equivalent collector instances, actual root HTTP 200 followed by page 2 HTTP 200; 20 → 40 held candidates, 20 additional findings from page 2. Exactly two requests, zero public items, zero external writes. The manual read-only audit clears due time between its two stages; normal two-hour cadence stays in place. Evidence: `live-check.json` with actual URLs, timestamps, content hashes and both cursor snapshots.
- Five focused suites / 53 tests PASS, including 19 pagination cases and the complete standalone Node collector regression suite. Evidence: `tests.json`.
- Public TypeScript `tsc --noEmit` and `git diff --check`: PASS.

Scope: discovery pagination is active for this one HTML profile only. The other profiles keep their existing single-page/feed behavior until their own path and extraction contracts are reviewed. No claim that all 108 sources support archive pagination. Nobel press releases include nonliterary material; every HTML discovery remains held. This path is separate from the narrow, fact-validated literature-winner automatic profile. No deployment, remote storage mutation or social publication was performed.
