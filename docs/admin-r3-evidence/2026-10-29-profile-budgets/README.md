# M07 profile translation budget evidence

The later [type-only correction](runtime-type-correction.md) records the final
test source and a fresh 39/39 runtime plus admin TypeScript PASS. The original
runtime archive and its source-bound results below remain unchanged.

`runtime-regression-evidence.zip` records focused per-invocation budget controls
for writer biographies, library works and country profiles. The final maintained
suite passed **39/39**, with **33/33** detailed CURRENT scenarios. Its captured
26-file execution/test graph has aggregate SHA-256
`5bfacc1f38758a714f61bd9bcde8e36abcc3d76ac08e698a3296704c57e96034`
and zero source drift across the recorded final commands. This identifies the
executed graph, not the whole repository. The separate root focused regression
result **251/251** is retained in the archive with its own receipt.

The frozen conflict comparison uses the original inputs and assertions. Original
V1 archives and genuine BEFORE source bytes remain intact. V2 adds only a
synthetic SDK response returning `true` for the new readiness RPC; exact reversal
proofs and hashes are included. V2 BEFORE again fails all four target assertions
per domain. V2 CURRENT passes: writer **3 attempts / 6 calls / cursor 3**, library
**4 / 8 / 4**, country **2 / 4 / 2**. The default limits are respectively
**3 attempts / 12 calls**, **4 / 16**, and **2 / 8**, with a 300000 ms deadline.

CURRENT controls cover readiness missing/false/malformed with zero paid work,
manual/current/pending guards without spending the attempt cap, shared
translation/review/repair/retry reservations, deadline before the first request
without skipping the candidate, a started partial request advancing once,
completed private output retained after deadline, and an unconfirmed journal
acknowledgement without claiming a saved cursor. Missing/false readiness reports
`translation_migration_required`; malformed readiness reports
`database_read_failed`. Canonical authored fields, rights, third locales, source
records and pending private candidates are checked where applicable; publication
requests and canonical machine writes remain zero.

Actual actions, domain helpers, validators, premium pipeline, budget, DTO/run
adapters and installed Supabase SDK execute. Only synthetic Auth/catalog/SDK
transport, Cloudflare AI responses and the budget clock are controlled. Warm-up
calls constructing current/pending receipts are separately recorded. Child
fixtures receive system-path environment variables only; uncontrolled network
is denied. There are no paid, production, live database or real provider calls.
Native SQL readiness/error-code compatibility is separate evidence owned by the
SQL validation task.

These results establish the stated per-invocation controls. Cross-run/global
accounting and restart uncertainty remain uncovered. They do not establish all
M07/R3 criteria, production deployment, real billing, browser behavior, or a full
repository test PASS.

Artifacts:

- `runtime-regression-evidence.zip`: SHA-256
  `63bad20db74b9a90a13427798fd313b9ad06a92a8c5abdc0bceda4995a44d9fd`;
  760319 bytes, 189 members, all 188 payload hashes verified after ZIP readback.
- `runtime-regression-evidence-manifest.json`: archive receipt and final counts.
- `country-budget-before.zip`: unchanged original country BEFORE archive,
  SHA-256 `6fc49faa517a1d0c544cde0b3c7d8ecf95aba62fa0465c199e293d804bb17875`.
  It records a defect, not an acceptance PASS.
- Original writer/library BEFORE archives remain in
  `../2026-10-29-site-copy-review/next-budget-before.zip` and
  `../2026-10-29-site-copy-review/next-library-budget-before.zip`; unchanged copies
  of all three originals are also nested in the runtime archive.

Maintained replay uses the repository fixtures and defaults to CURRENT sources:

```powershell
node node_modules/vitest/vitest.mjs run apps/admin/lib/profile-library-batch-budgets.integration.test.ts --maxWorkers=2
```

The archive retains exact source snapshots, raw JSON, terminal receipts, before
and after manifests, transport-only diffs, safe runners, original failure reports
and historical scope notes. Its README explains historical replay. An original
script's unchanged BEFORE-mode prose is historical; each execution's sourceRoot,
hashes and actual target results identify its evidence role.

## Final whole-admin validation

`whole-validation-evidence.zip`: SHA-256
`383dcab8d3789600025c07ca796ab98bbca28714232ddd78dd08971fcc559d07`;
4,315,867 bytes, 75 members, all 74 payload hashes and the internal manifest
verified after ZIP readback. Its adjacent receipt records the source identity.

The final V2 selection passes **6103/6109 in 200 files**, exit 1, zero skips or
todos. All six failures have exactly the same names and first errors as the
preceding validation: genuine absent `.tmp/m02-operation-wiring-before` sources.
They were neither replaced nor skipped. All five gates execute again after the
test-only type correction: build, both TypeScript checks and client secret scan
PASS; readonly text check FAIL with the byte-identical original41-file log.
Initial mkdir EPERM, initial type failures, unsuccessful build retry and V1
reports remain separate raw diagnostics. V2 is the final full rerun.

Final non-doc fingerprint:
`a2134c72d6abd557c9c7821f55b637dd4483f711e58ff861d8a4385053589c31`
for 10,421 files, unchanged before/after tests and gates. The 10,648-file full
inventory aggregate is
`d1327427541aa78eca1081fe96e6a5fe58c582113b6aed1c8b288418ba085651`.
Compared with the preceding site-copy slice, exactly ten existing files change
and nine owned files are added; the other10,402 preceding non-doc files remain
exact. Documentation/evidence has its separate scope. Four normalizers,
19 rules/tests, 16 AST scopes, 64 old migrations, six Telegram paths/the saved
patch and three package files pass their preservation comparison.

## Native schema compatibility

`sql-evidence.zip`: SHA-256
`958ea4df53fba7890ecc739bdf1ec8e23cbb00611e8ada1ba13d67e4a089f2ec`;
60,487 bytes, 33 payload files plus verified internal manifest.

Actual PostgreSQL17.11 executes both original Translation Operations migrations
unchanged. BEFORE rejects the explicit stop outcome for all three kinds with
23514 and leaves no orphan job. The additive
`20261029194216_profile_translation_operation_budget.sql` extends only the two
error-code guards, preserving all nine old codes. CURRENT passes ten result
groups: exact budget/cursor roundtrips through actual record/resume, both error
columns, old/null/invalid codes, strict validated readiness, staff/null actor,
anon/service ACL and unchanged lease grants. Maintained SQL fixture and native
function body are bound to their source hashes.

The new readiness RPC is SECURITY INVOKER with empty search_path and no anon or
service-role execute grant. Fresh missing staff access raises42501; false
capability is distinct from denied access. Advisor output remains FAIL for one
synthetic receipt table, with zero findings on the new function. PL/pgSQL lint
is NOT_RUN because its extension is unavailable; nothing was installed. All
three owned native starts stopped cleanly. Managed Auth/PostgREST and deployed
database acceptance remain unverified.

## Release and backout boundary

No release was performed. For a later separately authorized release, keep new
generation stopped, apply the additive migration, verify its ledger/checksum
and authenticated readiness before enabling the three batch actions. New code
fails closed before their source scan/provider work when capability is missing.
Ordinary source editing and existing private review remain independent.

Retain new private candidates and schema during backout. Keep generation stopped
if returning to success-only batch limits; that older code can repeat expensive
conflicts. Do not downgrade/drop operational data or roll back private editorial
review guarantees. Validate authenticated roles, existing review and publication
outbox separately before a later production release.

## Next failing writer admission BEFORE

`next-writer-admission-before.zip`: SHA-256
`44eceea641f3b19178a24b0824fa14b6adef0c77f4933db038d9a2404e498949`;
138,357 bytes, all 51 members verified. Adjacent manifest/receipt preserve a
genuine17-module source capture, original diagnostic and separate frozen SAME
invariant contract. This is an unresolved defect reproduction.

First actual writer action: one controlled accepted request loses delivery,
records a failure and leaves no private candidate. A fresh action on the exact
same source/target revision then makes two further passes and creates a private
candidate. Canonical/manual/source/rights/revision preservation and no public
build pass. Frozen diagnostic: seven controls PASS/two targets FAIL, execution
failures zero; separate SAME contract: four controls PASS/two targets FAIL.
This models acceptance at the synthetic binding, not real billing or elapsed
timeout. It establishes neither concurrency exclusion nor T03/T13 UI acceptance.

Next implementation should reuse the existing premium provider journal and
jobs/items/attempts with narrow profile identity adapters. Article-only RPCs
cannot accept writer IDs. Global/cross-run/restart safety and stable M07-T12
profile/library traversal remain pending; the per-invocation budget increment
does not close the full M07 or26-module/230-criterion goal.
