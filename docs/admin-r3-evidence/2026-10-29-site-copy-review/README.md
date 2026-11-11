# Site-copy private review and source preservation

This supplements the single continuation checkpoint at
`docs/CODEX_ADMIN_EXECUTION_STATE.md`. The working tree is based on
`acb910d89133396e8e9794e91bd5db74128dab3b`; these changes are local, not a new
commit or deployment. All agents for this continuation used GPT-6.1 Sol Ultra.

## Runtime evidence

`runtime-evidence.zip`: SHA256
`2c05821394593fb7c58c76cae83653c6526d9a99ca2fd7c20fb9f0888ba11010`.

The unchanged paired fixture executes the actual site-copy batch action,
installed Supabase SDK transport, actual premium translator/reviewer and actual
public exporter. Both BEFORE and CURRENT execute two provider passes. In the
seven common checks BEFORE has one execution/control PASS, five expected T05
failures and one separately identified preservation failure; there are zero
execution failures. CURRENT passes all 66 maintained checks. The original
BEFORE report is retained verbatim, with the latest CURRENT source graph and
source delta separately recorded. The exact fixture SHA256 is
`2aa44238aa7dcabd189a81a69ab5606c3793c0db94a8ddd0c7b214320f15eade`.

A separate actual page/review/discard fixture passes four recovery checks:
deleted master, recreated master, keyset pagination with distinct panel IDs,
and an unavailable discovery RPC that leaves canonical editing available.
Graphs contain 15 original, 23 CURRENT core and 21 recovery application modules.
Archive entries and captured source bytes were verified against their manifests.

Provider, Auth, SDK/database transport, catalog and publication boundaries are
controlled. Application modules, installed SDK and framework primitives execute.
This proves local runtime behavior, not managed Auth/PostgREST, real browser,
production database or deployed public delivery acceptance. No paid call ran.

Maintained tests:

```sh
node node_modules/vitest/vitest.mjs run apps/admin/lib/site-copy-machine-review.integration.test.ts apps/admin/lib/site-copy-private-recovery-page.integration.test.ts --maxWorkers=2
```

Historical test captures stay inside ZIP files so ordinary test discovery does
not execute evidence copies. Verify package hashes before extraction to empty
scratch directories. Keep original reports and use fresh replay output labels.

## Native SQL and receipt compatibility

`sql-evidence.zip`: SHA256
`8c9da02603ff70882620ea89f4b1ce3aba28e7b13a713bbb7cea47260822e12c`.

The CLI-created additive migration is
`supabase/migrations/20261029181630_site_copy_private_translation_review.sql`
(SHA256 `85bea15066f64998b0b2effe07b6926af30e414802e384641fb47b5ee958e52e`).
The new maintained fixture is
`scripts/database/fixtures/site-copy-private-translation-review.sql`
(original run SHA256 `2f35e9728d1be28a8e5fb9e5c4b1496835f3637ce5c72b58a561583ad249cc85`;
final escaped-source SHA256
`235daaba17bd9565f4f4d5933988d67104f10e16000b98503743512119ec2353`).

Native PostgreSQL 17.11 passed 28 groups: ten inherited book/country groups,
seven writer groups and eleven site-copy groups. A separate two-session probe
confirms the actual shared singleton advisory lock used by `save_site_copy_block`.
Fourteen checks execute the current TypeScript DTO on native SQL receipts,
including metadata discovery, UUIDs, exact timestamps, key ordering and UTF-16
length boundaries. Seven literal comparisons preserve earlier function branches.

Staging validates recorded source data and retains a private provider result
even after a concurrent canonical edit/deletion. Promotion independently locks
the current singleton and requires exact current settings, source/target CAS,
ownership, candidate hash and explicit staff review. Only selected EN keys and
their own machine provenance change; raw RU, other locales, unrelated settings,
existing metadata and canonical block attributes remain intact. A staff-only
read RPC discovers saved candidates even when their canonical row is gone.

Native Auth/staff, public outbox capture and part of the fixture schema are
synthetic. This is not managed Auth/PostgREST or full deployment verification.
The isolated advisor command remains FAIL: eleven warnings and four errors in
inherited synthetic fixture objects. The new migration and owned new fixture
functions have no advisor findings; the raw FAIL is retained, not waived.
Diagnostic failures and superseded runs remain labeled in the package. The
owned PostgreSQL processes/listener were stopped. No service was installed.

`sql-presentation-evidence.zip`: SHA256
`666610fb8bfea91ba11e3fd1ef3df520d4da84893fdd6625f44abbb24cd58fae`.
The original SQL package remains unchanged. The new package verifies the final
source representation: two synthetic SQL string literals use Unicode escapes,
with identical executed stage arguments and candidate digest. Fresh native
Run10 passes all 28 groups, the shared lock and 14 actual DTO checks.
The migration and application code did not change.

The maintained CJS fixture likewise replaces nine literal Unicode characters
with JavaScript escapes. All 499 parsed executable literal/template values are
identical before/after; no assertion changed. The final CJS SHA256 is
`c25d3684c7ddfea071ae659cc0d274e7a9ff2f1c02df46e7f582029874b117cd`.
Both maintained runtime files pass 70/70 after that representation change.
The frozen SAME fixture/archive retains its original bytes and provenance.

## Runtime budget and compatible release

One request admits at most 50 selected strings and one expensive batch attempt,
with at most four provider calls across the existing passes/repairs and a
45-second admission deadline. This is a conservative local default, not a
measured provider SLA. No new pass starts after the budget expires; an already
accepted external request is not claimed to be cancelled or nonexistent.
An ordinary form saves accepted RU/EN through its existing guarded RPC first,
then optionally translates only changed nonempty RU keys into a private draft.

No release was performed. For a later authorized rollout, retain the existing
translation stop controls while introducing the new code and additive schema,
verify the migration ledger/checksum and run authenticated review/discard with
controlled provider/build boundaries. The new code fails closed before paid
generation if private capabilities are absent while ordinary source saving
remains available. Keep generation stopped while rolling back to old code,
whose legacy site-copy path can write machine EN directly. Keep the additive
schema/private candidates; backout must not delete editorial or pending data.
Then verify roles, publication outbox and the actual public result separately.

## Final validation and source binding

`validation-evidence.zip`: SHA256
`b3c4dff26c15eaeea67b9d5f8c5177661b96ff3d24e72d811f05152ffabe3c48`.
Its 93 members were checked against the internal manifest. Receipts, raw reports,
source snapshots, preservation audits, failed attempts and corrections remain
separate and retain their actual source identity.

The V2 broad selection passes 6064/6070 tests in 199 files, no skips or todos.
All six errors are the original absent M02 historical BEFORE capture. The first
run's extra six SSR failures used a ready provider probe fixed to 2026-10-08,
which the unchanged 24-hour guard correctly rejected on 2026-10-29. Exactly one
fixture timestamp field in each of two test files now uses its current clock;
all assertions/production code remain unchanged. The two-file run passes
117/117. Both broad runs and the complete two-file correction proof are retained.

The original build failed on Windows trace-copy EPERM after compilation. One
same-source narrow build retry passed exit 0. Both TypeScript gates and the
secret scanner pass. The first text gate found 43 files, including two new
fixture literals; after the equivalent escapes described above it reports the
exact original 41-file failure, byte for byte. Effective gates are 4/5; the
excluded text gate is not marked PASS, and no rule was relaxed.

The broad V2 source fingerprint is
`48e448d251ffd5122bf0b277823a1960f98bacad98d22fad86f03ab54cb91c3c`.
The final source/test fingerprint is
`133d81610096506d232709c9b5a3e50f85467d121d4be62e73b73c1aeb8750db`.
Their only non-doc differences are the two new synthetic fixture source escapes;
the other 10,410 non-doc files are byte-identical. Executed values/stage arguments
are identical, and fresh 70 runtime checks plus native 28 groups/14 DTO checks
cover that exact delta. No full 6070-test rerun on the changed fixture bytes is
claimed. Checkpoint/evidence edits are separately identified documentation.

Full M07, M24 and R3 acceptance remains pending. The 66 and four runtime checks,
28 SQL groups and 14 DTO assertions are verifier counts, not completed counts
of the 230 acceptance criteria.

## Next budget defect: preserved BEFORE

`next-budget-before.zip`: SHA256
`fc8dbf4b87fbdcf3ba41ce92846b33fb9d5083e613898082c020499bc33e30ff`.

This is a defect reproduction for the next M07-T10/T11 step, not a fixed result.
The actual writer batch performs five expensive attempts and ten validated
provider passes, with zero successes and five conflicts despite its success
cap of three. Canonical machine writes and public build requests are zero.
The synthetic concurrency boundary changes only override timestamps; authored
fields remain exact. The actual action/helper/premium algorithms execute.

The package retains the original 15-source graph, frozen diagnostic and replay,
dependency hashes and a separate frozen acceptance fixture for the same five
inputs. That acceptance fixture currently fails four target checks with zero
execution/preservation failures (exit 1), expecting three attempts, six passes,
three conflicts and cursor 3 after the future fix. Its SHA256 is
`ee8b3c97d6db0db81efd67f8edf7c26cc4ff05c4507ba37b3e7ca6a0209fdc8e`.
The observation diagnostic's exit 0 means the known defect was reproduced;
it must not be mislabeled acceptance PASS. No budget implementation changed.
Verify internal manifests before extracting to empty scratch directories and
replay unchanged against future CURRENT sources with fresh output labels.

`next-library-budget-before.zip`: SHA256
`d41a461f4e656096aef15dadab3162f851d255571eefaed673f84021f9468eae`.
The analogous actual library diagnostic has five attempts, ten premium passes,
zero successes and five RU CAS conflicts despite the success cap of four.
All five real bibliographic title-source checks execute. Its frozen acceptance
fixture expects four attempts, eight passes, four conflicts and cursor 4;
BEFORE fails four target checks with zero execution/preservation failures.
Fixture SHA256:
`e442438f2c234ca1da007d7633ce49d3363c2eb860f4287418fa2c7f3c1d2a51`.
Captured source graphs and replay were verified. This positive provenance
scenario makes no claim about manual EN, retries, deadlines or scan stability;
those need their own controls in the following implementation step.
