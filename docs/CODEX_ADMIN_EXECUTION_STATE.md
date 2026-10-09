# Codex Admin Execution State

Phase 4 production baseline: `ff9f4853684208f37ac9deba8e14f4944f1fef51`

Current continuation branch: `codex/admin-r3-data-errors`

Last updated: `2026-10-09`

Current work status: **GitHub handoff; M07-T05 book/country private machine candidates and explicit human review implemented and focused checks passed. Final broad tests and build/gates were interrupted and remain NOT_VERIFIED. Full M07/M04/M02/M13/R3 acceptance pending.**

Latest rechecked source snapshot: `62b00fe41d04d4dbc11f1e911ec91bfa926235fc6e487bbeadce9968f6c008a4` (246 files, zero drift on 2026-10-09). Historical pre-commit HEAD: `9d9efe7fdd7702c7ee38630aca986be0c863f225`. Resume the latest commit on the branch, not this historical base. Previous fingerprints and their evidence remain below.

## 2026-10-09: GitHub handoff; M07-T05 book/country review work in progress

This is the current continuation point. Active module: M07. The complete goal
remains M00-M25 (26 modules, 230 criteria); it is not complete. The user explicitly
authorized saving this work to GitHub to continue on another computer. This
authorizes the checkpoint commit and branch push, not deployment, production
migrations, paid translation, social delivery, merge or publication.

Resume the GitHub branch `codex/admin-r3-data-errors` at its latest checkpoint
commit. Do not reset it to the historical base
`9d9efe7fdd7702c7ee38630aca986be0c863f225`. Historical evidence below retains its
original HEAD and fingerprint. Prefer GPT-6 Astra Ultra for complex work and
GPT-6.1 Sol Ultra for other work, following the user's explicit instruction.

The latest 246-file source snapshot was rechecked on 2026-10-09 with zero drift:
`.tmp/m07-t05-final-v1-source-fingerprint.json`, SHA256
`9e08d8e0d89b965ebef7eca3275b515c1ab5a8ebfc8395593b9d3da069dcf855`;
pre-commit fingerprint
`62b00fe41d04d4dbc11f1e911ec91bfa926235fc6e487bbeadce9968f6c008a4`.
This fingerprint includes the historical base HEAD. A new commit changes HEAD;
compare file hashes and create fresh evidence for the new checkout instead of
calling the old fingerprint evidence for a different commit.

Implemented in this increment:

- New book and country machine translations remain private working candidates.
  They do not replace canonical EN, acquire human review, or request a public
  build merely because the provider succeeded. Existing admitted machine text,
  manual RU/EN, other locales, sources, rights and metadata are retained.
- Repeated pending candidates cause no additional provider call. Missing or
  ambiguous private-draft responses fail closed. Stage acknowledgements bind
  source, target, payload and provenance before technical success is reported.
- The editor can compare current RU, canonical EN and the pending candidate,
  explicitly approve after checking facts/sources, or discard the exact candidate.
  Approval reloads source data, checks revisions and ownership, validates the
  receipt and only then requests the existing publication coordinator.
- A deleted RU/EN/title source keeps a valid stale candidate visible and
  discardable. Country approval bypasses the catalog cache. Promotion receipts
  must identify the known canonical target. An uncertain acknowledgement is
  not presented as confirmed success and does not trigger a blind retry.
- The country profile save caller passes the unchanged catalog to generation;
  the helper separately reads the saved override. This prevents an immediately
  stale candidate after an ordinary RU profile edit.
- Additive local migration
  `supabase/migrations/20261008160000_premium_translation_working_drafts.sql`
  provides private storage and four staff-checked RPCs. Its SQL/CAS/ACL contracts
  were tested on isolated PostgreSQL; it has not been applied to production.

Verified local evidence, all retained with explicit mock boundaries:

| Check | Before | Current | Scope |
| --- | --- | --- | --- |
| Book machine review SAME16 | 3 pass / 13 fail | 16/16 | Original 382-file capture versus current; installed SDK, controlled fetch/provider |
| Country machine review SAME17 | 5 pass / 12 fail | 17/17 | Same original capture/fixture; controlled SDK transport/provider |
| New review/actions/panel SAME34 | 28 pass / 6 fail | 34/34 | Intermediate new implementation versus corrected implementation, not original baseline |
| Country save caller SAME2 | 0 pass / 2 fail | 2/2 | Captured one-file caller correction; other 33 actual modules shared |
| Existing T01 compatibility | Historical evidence retained | 19/19 + 39/39 | Intentional private-stage positive assertions; manual/CAS/source controls retained |
| Page load compatibility | Original 250 retained | 254/254 | Four added private-read/canonical-read controls; controlled read boundary |
| Native PostgreSQL 17.11 | Additive contract | 10 groups / 29 verifier checks | Synthetic Auth/staff and outbox; actual SQL and actual runtime DTO client |
| Source preservation | 382 files plus caller supplement | 1393/1393 | Four normalizer files, all 16 call scopes, six independent Telegram files and old SQL unchanged |

Default CURRENT runs for the three new primary fixtures also passed with
filesystem guards denying reads from ignored BEFORE captures. SQL receipts
preserve microseconds and pass the actual strict runtime parser. The temporary
PostgreSQL instance, owned PID and SUBST alias were removed; port 54329 was free.
Focused whole-admin TypeScript completed successfully before the final run.

The final broad run and final build/gates started on 2026-10-08 and were
interrupted. On handoff, their process handles were missing, the recorded PIDs
were absent, and there were no terminal results/command receipts for:
`.tmp/m07-t05-final-v1-tests-command.json`,
`.tmp/m07-t05-final-v1-gates-command.json`, or
`.tmp/m07-t05-final-v1-tests.json`.
Therefore the planned 5982 tests in 197 files, final build, and final five gates
are NOT_VERIFIED for this increment. Partial logs are not PASS. Earlier T01
5909-test/build evidence below belongs to its earlier source state.

Portable materials are in Git:

- `docs/admin-r3-task-package/`: all 49 original task-package files copied byte
  for byte. Read CORE_RULES.md, EXECUTION_PLAN.md and only active modules/M07.md;
  do not restart the entire audit or read duplicate full representations.
- `docs/admin-r3-evidence/2026-10-09-handoff/`: curated proof archive, manifest
  and restoration instructions. Restore only as described in its README.
  Native binaries, installed dependencies, credentials and personal sessions
  are intentionally outside the package. Some older evidence below remains
  historical and local; consult the archive inventory before relying on a path.
- `docs/admin-r3-evidence/2026-10-09-handoff/independent-telegram.patch` preserves
  the six pre-existing independent changes without applying them to this admin
  commit. Patch SHA256:
  `fba9551c2a131fd04dbf6ed04127c907bf3bbcf520ed3ed0241475877ff64122`.
  Its reverse check against the original working tree passed. The original
  full 197-file selection includes these independent tests, including the new
  footer test. Reproducing that exact mixed working-tree run requires restoring
  this separate patch; do not silently claim identical coverage without it.

Next actions on the other computer:

1. Check out the latest `codex/admin-r3-data-errors`; inspect status/HEAD/diff and
   this checkpoint. Preserve all existing work and the exclusions below.
2. Use the repository's Node 24 / npm 11 dependencies and local environment
   setup. Credentials must be configured privately; no auth/session transfer
   is included in this commit. Restore the curated evidence only if required.
3. Finish the interrupted broad test selection and five gates with a fresh
   source snapshot tied to the current HEAD. Existing commands are Vitest with
   `--maxWorkers=2`, `npm run admin:build`, both admin TypeScript configurations,
   `node scripts/check-admin-client-secrets.mjs`, and the unchanged read-only
   `node scripts/normalize-short-hyphens.mjs`. Do not use `--write`.
4. Resolve any concrete failures before recording PASS. Then continue M07-T05
   for writer biographies. The unchanged writer helper still constructs
   reviewed canonical EN and a generation-day review date; its batch requests
   publication after translation. This is a read-only source finding, not yet
   a SAME runtime reproduction. Capture its actual graph and reproduce before
   fixing; retain already admitted machine text and authored manual EN.

Full M07, M02, M04, M13 and R3 acceptance remains pending. Actual managed
Auth/PostgREST/DB/RLS, production, external publication and paid providers remain
not_verified. Country catalog authenticity is enforced by the trusted app
reload; SQL cannot independently read the repository/KV catalog. Do not drop
new private drafts or perform destructive down migrations for rollback.

All closed R2 work is retained. Do not alter short-hyphen/dash normalizers,
their calls, rules or tests, and do not modify independent Telegram work.
No new implementation work was started during this GitHub handoff. All earlier
checkpoint entries below are preserved byte for byte as historical evidence.

## 2026-10-08: M07-T01 manual English drafts in books and countries

This is the current continuation point; active module is M07. This increment
is PROGRESS: two helper ownership defects were reproduced and fixed locally.
The goal remains ACTIVE for M00-M25 /230 criteria. Full M07/M04/M02/M13/R3
acceptance remains pending; this is not acceptance of every automatic route.
Complex work used GPT-6 Astra Ultra; fixture work used GPT-6.1 Sol Ultra,
following the user's model preference. No push/deploy/paid/social call occurred.

Book automation now preserves every existing non-machine English translation,
including human, editorial-original and licensed-source drafts. It previously
protected only reviewed/verified rows. A manual revision winning the first CAS
was safe initially but could be overwritten by a later helper invocation; the
new guard also prevents that later expense and write. Real stored short nonblank
drafts are protected. No title-only scaffold exception was invented: inspected
storage/import contracts require a nonempty description. Existing verified-title
and source requirements, eligible machine regeneration, current fast path and
RU/EN CAS behavior remain intact. No safe-wrapper or provider logic changed.

Country automation now preserves an own English entry unless locale and method
explicitly establish machine ownership, regardless of editorial status. Legacy,
partial, null and ambiguous EN entries remain intact. A partial override map can
hide catalog manual EN; the guard checks that source EN only when the effective
map has no own EN. This is a no-write guard, not a translation-map merge. Explicit
machine EN in an override keeps its existing priority. Genuinely absent EN and
valid machine regeneration still work. Full authored RU/EN, other locales,
sources, rights/provenance, coordinates and custom metadata are preserved in the
protected scenarios. Existing source validation and revision checks are intact.

Maintained delta: only `apps/admin/lib/auto-translate-literary-work.ts` and
`apps/admin/lib/auto-translate-country-profile.ts`, plus two new focused tests:
`apps/admin/lib/literary-work-manual-english.integration.test.ts` and
`apps/admin/lib/country-profile-manual-english.integration.test.ts`.
Final232 fingerprint:
`07ed86cf5b2662a012926afecd96e6c14c49e543a8791222817af8482498d11a`.
Manifest `.tmp/m07-t01-final-v2-source-fingerprint.json`, SHA
`e7e49f73aa13a3d263da6e050dba9c7fef58c1845f827378ef611d6cc680d2f5`.
Immutable366 capture `.tmp/m07-t01-before/manifest.json`, SHA
`73eb5d73d4cc6e374d185cb8230bd87526bbfebdc0b13429966d2e991666cd56`.
Two clean validator dependencies were separately captured before the book fix:
`.tmp/m07-t01-before-supplement-v1/manifest.json`, SHA
`91dcbe145a151fb0391524ddfcc5f78a57d44f7505cb29a540d77883daf00a11`.
The original366 capture was not rewritten.

Book SAME19: BEFORE14 PASS/5 FAIL -> CURRENT19/19, terminal0. Fixture SHA
`849cdd36234fd7fbbc7ede2ddd154e3e12d7b127d5a96f1057baf7a38451019b`.
Actual safe wrapper, helper, premium transport/gate and14 APP modules execute;
installed Supabase SDK uses controlled fetch and controlled Cloudflare AI.run.
Only the book helper differs across the pair. A separate portable19/19 run
denies ignored baseline reads. These are repeated helper invocations, not proof
that the complete batch/backfill/restore UI routes ran. Pair proof
`.tmp/m07-t01-book-same19-final-v1-proof.json`, SHA
`b752a682e975fa2ebbdbebd39553a19d439d02a7b1f41c566c29cebbc459531a`.
Early book harness diagnostics (missing two clean dependencies and an incomplete
SDK predicate) remain stored; they are not claimed as product defect evidence.

Country final SAME39: BEFORE21 PASS/18 FAIL -> CURRENT39/39, terminal0.
Final fixture SHA
`3c1a03b1f2c48d85198ef973bce1eb2c1dc34f2166b6ad9026fc22ae7b2e20f2`.
All18 previously destructive cases changed from translated/two controlled
provider calls/two writes to manual/zero calls/zero writes/exact preservation.
Eight actual APP modules execute, including premium transport, gate/probe and
validators. Supabase is a controlled fluent interface, not installed SDK HTTP
transport or real DB. Cloudflare provider binding is controlled. Pair
`.tmp/m07-t01-country-comparison-v2.json`, SHA
`19fcbb99453086dd91f9995abfbf37b91081b7afad208ef710894b8d2f39c85f`.

Broad regression passed5909/5909 in193 files,0 fail/skip/todo, terminal0: prior188
plus both new fixtures and three existing book/writer/country compatibility
suites. It executed at V1 fingerprint
`ad3c36d95e527f27559243d2cc8c622fcb77ca2784e5f2f2085dba688933dde7`.
Raw `.tmp/m07-t01-final-v1-tests.json`, SHA
`1971e42a9da64e9aff706f96ae0f1198a9fcf63a2af43d643af18336c79b853c`;
command `.tmp/m07-t01-final-v1-tests-command.json`, SHA
`1ee467b00efceba2e3250918dadc88d60ead437db88bb9f64108bfdaca3351ca`.
V1 build/admin TS found two encoding-overload errors in the new country fixture
under the project's Cloudflare/Node Buffer declarations; isolated TS had passed.
After the broad run finished, exactly two erased type assertions fixed those
errors. All other231 frozen sources are byte-identical. Executable fixture JS
is byte-identical under TS ES2022 CommonJS, TS ES2020 ESNext and esbuild ES2022
ESM, independently rechecked by the aggregate. Fresh final SAME39 above and
whole admin TS with incremental=false passed. No broad V2 rerun is claimed.
Type-only proof `.tmp/m07-t01-country-type-only-proof.json`, SHA
`8246cfaa8321df03a38fc6be240236bd7ba54fd141b83a7548e6c5b9c89e3055`.

Final five gates each terminal0: admin build, both TypeScript configurations,
client-secret scanner and readonly text gate. Command
`.tmp/m07-t01-final-v2-gates-command.json`, SHA
`270f22529d86e2461a65711429f58e3d199352160f21b23f676d67bab647ffd3`.
Protection1332/1332 confirms exact two existing-code changes,363 retained
captured code files, both supplemental files,4 normalizer files/16 call scopes,
6 independent TG6 files, prior migrations/SQL fixtures/M02 definitions,
planner/allowlist and package/lockfiles. Proof
`.tmp/m07-t01-final-v2-protected-proof.json`, SHA
`9235c81387ac8c3559750f60e28e0daa821bb524d5eea5acf5416d5fc4d90eea`.
Aggregate independently verifies source identity, raw results, SAME evidence,
all three type erasures and final gates:
`.tmp/m07-t01-final-aggregate-v1-proof.json`, SHA
`0b5ab671b51f75984e72dc665d3f94b345bb5fc8f5deea728b9b1007af9429a0`.
Verifier assertions are not additional app scenarios.

No new native SQL or native browser run was performed for this helper increment.
Earlier native proofs keep their original fingerprints; they are not relabelled
as current runs. Managed Auth/PostgREST/DB/RLS, real provider and production are
not_verified. M07-T01 DB/integration acceptance across all automatic routes is
still incomplete, including later M24 site-copy coverage.

Next concrete independent step: M07-T05, books first. Reproduce with an actual
helper/action/display/public-admission fixture whether newly generated machine
EN gains reviewed status/date and a public-build request without human review.
Pair it with an already admitted reviewed machine record and a protected manual
EN record. Existing reviewed machine compatibility must remain intact; do not
globally reject historical records or weaken their tests. Country counterpart
follows the same pending-review versus already-admitted distinction. Readonly
source diagnosis `.tmp/m07-t05-next-readonly-v1.json`, SHA
`263290c429b999425e7b2ed583ee83c583fbdc0063a3eaa78e53df462e318746`,
records14 files with line references; tests0, no runtime reproduction or T05
acceptance claimed. Capture the next immutable baseline before any T05 edit.

## 2026-10-08: M07-T04 active-work stop and confirmed call accounting

This is the current continuation point; active module is M07. The preceding
goal turn was PROGRESS: T06 was verified and checkpointed. This increment
reproduced and fixed one T04 summary defect, verified existing stop behavior,
and added isolated native SQL coverage. The goal stays ACTIVE for all26 modules
M00-M25 /230 criteria; neither M07 nor the full R3 package is accepted yet.

The actual staff-sync action reported two provider requests after a known first
response followed by a gate refusal before review. The journal already correctly
held one acknowledged call and a finished not-configured operation; the second
number was an unused budget reservation. The action now sums providerCalls from
the already validated terminal operation receipts. Its unfinished/unknown guard
runs before this sum. Budget reservations/limits, coordinator and premium helper
are unchanged; no unknown call is erased or treated as a confirmed zero.
Each ordinary invocation creates fresh item/operation IDs and the strict parser
binds all receipts to those IDs, so prior POST costs are not silently accumulated.
Separate explicit recovery and existing private-draft guards are preserved.

The same controlled fixture exercised two candidate articles, a deferred accepted
first response, persisted probe becoming false, the exact original response ACK,
terminal not-configured/one call, the original job with remaining candidate B,
no review/repair/B dispatch, and no expense on a later fresh or continuation POST.
Existing full RU/EN and a separate authored private draft remain exact. Unknown
response and lost response ACK retain the original active operation, without a
fabricated FINISH or blind generation. These stop mechanisms already worked;
only the misleading displayed provider-call count required a runtime change.

Maintained delta: `apps/admin/app/(dashboard)/translations/article-actions.ts`
(one counter, validated receipt accumulation and summary substitution), three
appended cases plus narrow harness support in
`apps/admin/lib/article-ordinary-admission.integration.test.ts`, and one new
`scripts/database/fixtures/translation-active-stop.sql`. No migration changed.
Final228 fingerprint:
`a84765d55c2cd14c0869fb14455e360cb2857f6bb28aba2314ba3e7371352706`.
Manifest `.tmp/m07-t04-final-v2-source-fingerprint.json`, SHA
`45e932d318b3c913218752e1cb30a93351c723d5ce14e40af1a24b312e821263`.
Immutable353 before capture `.tmp/m07-t04-before/manifest.json`, SHA
`5e3d5ed8f0ddadee22125a119bf9c17ed3fd1e9e8d44b609abc4dbb5dfdc809c`.
Two captured code files changed and350 are unchanged. All original migrations,
database fixtures/helpers/planner/allowlist, M02 exact9, T06 configuration logic,
dependencies,4 normalizer files/16 import-call scopes and independent TG6 remain
unchanged. Protection1281/1281: `.tmp/m07-t04-final-v2-protected-proof.json`, SHA
`ce86d0e0bc75156d8350d2c0f96ffe066ceea7edd260280332841e2ecd9d5f2c`.

Final SAME43 fixture SHA
`e49a37bb7dccebe2cc78c9df529103b462734ac6a2551db297b1444fcd50746d`:
BEFORE14fc42 PASS/1 FAIL (display2 instead of1) -> CURRENT43/43,0skip/todo,
terminal0. All original40 cases,266 assertion AST calls and9 authored definitions
are retained. Forty-two actual APP dependencies are bound; only the action
changes between executions. Pair `.tmp/m07-t04-same43-final-v2-proof.json`, SHA
`abc3668d78cfe9c6f2f57b14f7a04f1ec0269c5df892ba84b03349f857a16583`.
Preservation `.tmp/m07-t04-fixture-preservation-v2-proof.json`, SHA
`54db108f50416e75d0ec52e6c847a8b0467011f016d9206429c7469a5140e18f`.
Actual action/helper/gate/coordinator/SDK run with controlled Auth, DB ledger and
provider binding. This is local integration, not managed Auth/DB/RLS acceptance.

Broad regression executed5804/5804 in the unchanged188-file selection,0 FAIL/
skip/todo, terminal0, on V1 fingerprint
`e703c0cd1633d801794c82d3cc24c693050885e1c6f9538b879a5dfee8392338`.
Raw `.tmp/m07-t04-final-v1-tests.json`, SHA
`0ee42c5f1bd45132d4762c84fe2b99f57ebde4e3093637bfc82d03178073b912`;
command `.tmp/m07-t04-final-v1-tests-command.json`, SHA
`a7c127a10f403d5c36911657a2b5b799edd50666c047fb4f5614b8831a87e618`.
V1 build/admin TS found two possibly-undefined Map lookups in the newly appended
test. After the full run ended, only two erased non-null assertions were added.
All other227 selected sources are byte-identical from V1 to final V2. Actual
executable fixture JavaScript is identical under three TS/esbuild transforms,
independently rechecked by the aggregate. Fresh corrected SAME43 above and final
five gates passed. The broad V1 evidence retains its original binding; no broad
V2 rerun is claimed. Type-only proof
`.tmp/m07-t04-type-only-v3-applied-proof.json`, SHA
`175f417a45880c2844404015d1b0079ded8a46b622c09e7dcb8ba3c27662cefd`.
Final five-gate command `.tmp/m07-t04-final-v2-gates-command.json`, SHA
`eb739b77584cefb72c1ed7e7e85f6c0d13a8b5f753a26b25cb9ba848475bfdc4`: admin build,
both TypeScript configurations, client-secret scanner and readonly text gate,
each terminal0 at final228. Child TEMP/TMP remain owned local scratch.

Existing service-role lease cancellation is now separately exercised in actual
PostgreSQL17.11: claim A -> staff cancellation -> claim B empty -> accepted A
completed successfully. The job ends cancelled with its one completed item and
one unattempted cancelled item. Actor/CAS/ACL, wrong worker, expiry/reclaim and
duplicate completion controls pass. Full authored RU/EN, private draft, revisions,
receipts/outbox and the exact9 M02 definitions are preserved. Seven SQL groups,
17 actual commands terminal0; no implementation defect or migration fix needed.
Fixture SHA `10738168b1abec094942d2fc104650905aa89a8b5651afc90be29d5cba11af61`.
Proof `.tmp/m07-t04-sql-active-stop-v1-proof.json`, SHA
`4d9cd6446ad5593bc51f2fe667ad956bd0f5cd16d87f0d706615e91ca810c9e8`.
Native result:
`.tmp/m02-postgres-tools/native-cases/m07-t04-sql-active-stop-v1-20261008144646502-9892-94d407c0/result.json`,
SHA `c54e8cc37145f2e2ab4aee2cc20de98b6dad2535fbfe727e1b46ad087430b4c4`.
All19 SQL dependencies bind unchanged. Native own server stopped, owned P: alias
removed,54329 independently confirmed free. SQL cancellation does not establish
an active runtime worker or its environment kill switch; current runtime remains
staff bounded-sync. No background worker is invented or claimed by this result.

Aggregate572/572 verifier assertions (not application cases):
`.tmp/m07-t04-final-aggregate-v1-proof.json`, SHA
`2d7716bb3b30ed16b3d0be3aec815f7508e81fbaf4d2768238c4d279471e393f`.
Retained diagnostics include the actual SAME summary failure, V1 build/admin TS
failure and pre-SQL builderV1 missing clean-source capture membership. BuilderV2
uses verified existing predecessor hashes; no native SQL failure was hidden.
No fresh native browser run for this increment: previous T06 native89 remains
historical on14fc. Managed Auth/PostgREST/RLS, real provider, production and original
Supabase402 cause remain NOT_VERIFIED. No push/deploy, production migration, paid
call or social send. User model preference and all preservation rules continue.

Next concrete independent step: M07-T01, manual English drafts outside articles.
Readonly code inspection found that the literary-work and country helpers only
protect non-machine English when its status is reviewed/verified; a manual draft
can proceed to the automatic path. This is a source finding, not a claimed runtime
overwrite. Start with actual literary-work-safe -> literary-work helper using a
reviewed RU book, existing human-translation/draft EN, nonempty authored description,
valid English title and matching bibliographic source. On the identical fixture
require manual/zero provider/zero update with exact EN title/description/sources/
metadata preservation; add eligible machine and reviewed-human controls. Then
cover the country counterpart. Writer human ownership is already unconditional
with focused draft/reviewed/verified tests; do not rewrite it. Site-copy stays M24.
Readonly diagnosis `.tmp/m07-t01-manual-draft-next-v1-proof.json`, SHA
`b34ea4a706ac68bcf51bd3f2956b255ce81a0b066853cbcbca02b6c5d36bdb9c`.

All following entries are historical checkpoints; their uses of "current" refer
to that entry's recorded source state. Prior evidence and limitations are retained.


## 2026-10-08: M07-T06 current configuration self-test binding

This is the current continuation point; active module is M07. The full panel
goal stays ACTIVE for M00-M25:26 modules,25 main stages plus M00,230 criteria.
The preceding continuation made progress: implementation and local proofs were
preserved; missing process handles were checked against live process state.
The interrupted full test/native runs had no terminal evidence and were not
called PASS. Their outputs were retained; missing checks used new labels.
User-selected delegation: GPT-6 Astra Ultra for complex subtasks and GPT-6.1
Sol Ultra for the others. No module-wide or goal-wide acceptance is claimed.

M07-T06 is locally verified at its required unit/static boundary, with additional
actual full SSR/action tests and isolated PostgreSQL evidence. A completed probe
now binds provider, actual translator and reviewer/repair models, review mode,
both reasoning configurations, and the fingerprint of the three unchanged prompt
arrays. Health and Translations consume the same strict full11-field probe and
current identity. Missing/malformed/old/future/expired/pending results do not
authorize a translation. Model labels reflect actual runtime configuration.
Old results remain readable as history and do not certify a new configuration.

BEGIN reserves a short-lived actor/configuration-bound lease without relabeling
or overwriting the previous completed result. The action validates this complete
reservation before any controlled provider call, tests both actual model slots
(including repair when content review is off), and accepts PASS only after an
exact validated FINISH receipt. Wrong actor/token/config/model, stale lease,
malformed result and unknown database outcomes fail closed without blind retry.
Native Next control-flow signals remain intact. Provider-error text cannot map
to unsupported database error codes or fabricate success. No authored content
is written by this self-test path, and all original prompt arrays are unchanged.

One additive migration was created by the actual Supabase CLI, with local-only
application: `supabase/migrations/20261008131138_admin_translation_provider_self_test_binding.sql`,
SHA `da73a9df3a14e3d59c110da6d38b009360a05828f96027a08c9457ebd2124c4a`.
New public invoker RPCs call guarded private definers; no extra private-schema
USAGE or direct-write grant is introduced. Legacy RPC signatures/ACL remain,
but the unbound self-test operations reject safely. operations_ready continues
to recognize the installed protocol. SQL CHECK predicates use built-ins so the
existing service_role update path does not acquire a new private EXECUTE need.
No destructive migration, old migration edit, backfill, provider/model change
or managed database operation was performed. Release must retain new data and
restrictions; a blind downgrade is not an approved recovery procedure.

Exact source freeze is227 files, fingerprint
`14fc7865f67cee88ee2e02c2077e2cabb1e121591d77616a88f13c66ce3f4421`.
Manifest: `.tmp/m07-t06-final-v2-source-fingerprint.json`, SHA
`1449e5a3bd464ea76056d2e6344bdd2700e091ceeec0f800c95326a1a7df0ed6`.
The V3 manifest is an identical byte copy. Original343 capture manifest SHA:
`8c685f86841bd974e4ae431faaa7178bdc7249191f7698740318b4bc4b1e0d3a`.
Of342 captured code files,14 changed and328 are unchanged. There are5 new
maintained files and2 adapted existing tests whose original authority is HEAD,
not the343 capture. Dependency manifests/lockfile, all8 captured migrations,
6 database fixtures/helpers, M02 exact9/planner/allowlist, all4 full
normalizer files and16 import/call AST scopes, and independent TG6 are preserved.
Protection1246/1246: `.tmp/m07-t06-final-v2-protected-v3-proof.json`, SHA
`03ecf91ddb3a786112b9330e310a7fdd49f39cb40f5ac65ca45c1698cd84a68f`.
Existing9 APP fixture adaptations preserve855 original assertion calls,28
author/source/rights/media literals and6 ordinary authored fixture definitions:
`.tmp/m07-t06-app-tests-preservation-v3-proof.json`, SHA
`889f23f3c4a1519bc63b47d42cd8f0109359c469c7430312c8808be424e23564`.

Final broad regression:5801/5801 in188 files,0 FAIL/skip/todo, terminal0.
The188 selection retains all186 prior files and adds the two new SAME fixtures.
Raw report `.tmp/m07-t06-final-v3-tests.json`, SHA
`19bfe1fd45b8b07967e7b945ac1bd78be20e73d542b3ed60a387c53029dcadb3`;
command `.tmp/m07-t06-final-v3-tests-command.json`, SHA
`114d90c747c47d51db204a5c815889e17fd210bb078cb9f640022a8e05052845`.
Five gates on identical227 sources passed with terminal0: admin build, both
TypeScript configurations, client-secret scanner and existing readonly text gate.
Command `.tmp/m07-t06-final-v2-gates-command.json`, SHA
`c4142374a23d3d9cc955e82b2260a1704f3678121dd4deeda300c893c5939839`.
Child TEMP/TMP were confined to owned repo scratch; no normalizer --write.

SAME37 actual gate/full Health+Translations SSR: BEFORE343-v5 7 PASS/30 FAIL,
CURRENT37/37. Exact same fixture SHA
`312b2c47c27ae4c9c033db3385804c58d4b99967614cce57ca42d0223019bdc6`,
same case names and independently computed original prompt identity. Actual
APP dependency graph is24 BEFORE/25 CURRENT. Default-current portability also
passes37/37 under two filesystem guards denying ignored baseline capture reads.
Pair `.tmp/m07-t06-app-pair-final-v3-proof.json`, SHA
`7a2b599eeaf4a59bd121575ccd11d992aedf9590df7c38f720b59bd2362b6278`.

SAME70 actual self-test action/core/SDK/Next: BEFORE8 PASS/62 FAIL -> CURRENT70/70.
Fixture SHA `20e36da448eb994a781826ee55b89961ab20af85f1401a3cc91acc9ee67b8df5`.
Pair `.tmp/m07-t06-action-pair-v2-proof.json`, SHA
`a9675219cc194f780b4b403c73095b62130ea8111505091022d1e18d147e39e2`.
This pair ran at the global V1 freeze; the same70 fixture and all7 actually loaded
APP modules remain byte-identical under final V2. Only two other test files changed
between these freezes. BEFORE failures include new DTO/protocol expectations;
neither30 nor62 is a count of independent defects. Controlled provider/Auth/DB
boundaries are explicit in the reports; actual paid provider calls are zero.

SAME native PostgreSQL17.11 fixture reproduced old PASS retargeting, wrong-model
completion and cross-actor completion. CURRENT has11/11 SQL PASS groups. Both
BEFORE/CURRENT execute17 terminal0 commands, with existing foundation/M02/private
definitions/migrations and actual synthetic roles, forced RLS and function ACL.
Pair `.tmp/m07-t06-sql-binding-pair-v4-proof.json`, SHA
`af5c4c1925828ddcba5f625f90d978c305c68922fae38104f49696eb0983d1ca`.
Two additional unmodified native reservation/completion DTO pairs (successful
and failed probe) passed the actual APP codecs; negative token/hash/model/time/
lease/cooldown/config controls reject. `.tmp/m07-t06-cross-layer-app-codec-v2-proof.json`,
SHA `5e9055c73652eb52c1eea1ae0f449bb2c4bba175a8f80a33efecd9519a809bde`.
The244 SQL/86 codec checks are verifier assertions, not244/86 application cases.
Native PG own server stopped and owned SUBST removed; no live Supabase was used.

Native Next CURRENT regression:89/89 checks in7 existing ordinary-admission
groups,80 actual compiled modules,15 multipart POST303 and saved follow-up pages.
This is existing workflow regression under the new probe contract, not89 new
configuration-freshness cases. Auth/MFA, JavaScript SQL ledger, provider transport
and ancillary endpoints are controlled; actual Next/SDK/application paths run.
Evidence `.tmp/m07-t06-native-regression-current-v2-evidence.json`, SHA
`2743331c25dc42ea4e13b2b56f36c3d08dc81b567232e4533582583b96fcb503`.
Verified proof `.tmp/m07-t06-native-regression-current-v2-verified-proof.json`, SHA
`d46f95f83fc0cda5db30e0332223ec961c3acc5e739ccb1915f1111adb5edc49`.
Original17 fixture files/3 scripts and323 preceding artefacts are unchanged;
the new copied fixture retains15 exact files and2 explicit SDK/path adaptations.
Own13 processes stopped,3187 free; cleanup proof SHA
`b16ab65e2b77abe0d532d086213a401ba7059801157ecee4ef89a7e809977ed2` at
`.tmp/m07-t06-native-regression-current-v2-cleanup-after.json`.

Independent aggregate678/678 verifier assertions bind actual reports, raw counts,
current sources, action graph, SQL terminal statuses, codecs, compiled native
graph and saved wire bytes: `.tmp/m07-t06-final-aggregate-v1-proof.json`, SHA
`6b77be1c316144b5a890d80b783147b97e706c28ef7b805571ccdff1d1c24e6f`.
All checks above are local. Managed Auth/DB/RLS/PostgREST, real provider, remote
advisors, original Supabase402 root cause and production remain NOT_VERIFIED.
Full M07/M04/M02/M13/R3 acceptance remains pending. No push/deploy, production
migration, paid calls or social sends. Author RU/EN, rights and sources preserved.

Retained diagnostics: V1 broad5780/5801 with21 stale-protocol fixture failures;
V1 build/admin-type failure from two Uint8Array.toString typings; SQLv2 fixture
operator precedence and SQLv3 real private-CHECK-ACL incompatibility; first
protection proof's missing clean-package capture assumption; codecV1 stop before
execution on the two authorized test-only changes. Each has an explicit corrected
successor above. Interrupted full V2 had no terminal report, protectionV2 and APP
pair checkerV2 were empty, and native current-v1 stopped with9 DOM/11 wire files;
these were preserved, never relabelled PASS, and only then rerun under new labels.

Next concrete independent step: M07-T04. Check the existing kill-switch behavior
while a task is already active, distinguishing staff bounded-sync from service-role
lease execution. Preserve accepted current work and its durable result while
preventing new provider dispatch/claims after stop. Readonly diagnosis reused8
existing passing cases; no new test run or source edit. The actual ordinary gate
loss case currently asserts one call/no draft/public preservation, but does not
assert this branch's original operation terminal state, acknowledged call count
and remaining cursor. Next fixture: two missing articles, hold the first accepted
provider response, set the controlled persisted probe false, release that same
response+ACK, then assert original operation finished/not-configured/one call,
no review/repair/second item, preserved public/private data and cursor; another
POST with the gate false must add zero provider calls. Service-role lease APIs
exist in SQL, but an active runtime worker caller was not found in this scoped
search; do not invent a background worker or equate staff sync to service role.
Diagnosis `.tmp/m07-t04-readonly-diagnosis-v1-proof.json`, SHA
`7aae49bf4efefe20983b3ef4c33ea95295337d1a4dbacdf80a28ac541490fc79`,
is explicitly not acceptance. Do not restart a full audit or rewrite the existing
queue. T06 remains frozen.

All following entries are historical checkpoints. Their uses of "current" refer
to the recorded state at that entry; all previous evidence and limitations remain.

## 2026-10-08: M07 compatibility and original-job completion

This is the current continuation point; active module is M07. The previous
goal turn answering the requested25-stage table made no implementation change.
This continuation revalidated the same worktree/checkpoint and completed the
pending8-suite compatibility work rather than restarting the audit. The panel
goal remains ACTIVE for all M00-M25:26 modules,25 main stages plus M00,230 criteria.
This local result does not accept the full module or goal.

Two actual runtime gaps are corrected. After a fulfilled STAGE40001, an exact
typed read must confirm the original running operation, missing candidate,
provider/source/CAS and known acknowledged call count before FINISH may record
conflict with no English envelope. Unknown/malformed reads, an existing STAGED
body, mismatched intent or unacknowledged response retain the active operation.
Confirmed conflict/stale and database-read refusals have truthful helper results.

For a resumed legacy or ordinary run with an empty remaining scan, the action
uses the existing atomic complete_article_translation_scan RPC and original job
identity. Ordinary completion obtains the actual full saved resume cursor and
validates its marker, actor, provider and exact scan binding. It never substitutes
the stripped cursor, rotates the full500-item job, creates a fake item or repeats
generation. SQL still checks the entire cursor and newly published candidates;
the same original accepted completion intent is idempotent.

Four runtime files and8 maintained test files changed relative to immutable339;
the new ordinary SQL fixture only gained an append. All original50,475 fixture
bytes are an exact prefix. All7 translation migrations, M02 exact9/private
definitions, planner/allowlist, dependencies, author fixtures, protected source
guards, normalizer files/calls/rules/tests and independent TG6 remain unchanged.
Eight compatibility suites now model real admission, call ACK, private STAGE,
FINISH and checkpoint rather than the retired posthoc recording protocol.

Current source manifest:
`.tmp/m07-ordinary-admission-compat-final-v1-source-fingerprint.json`,
SHA `5f3eb45367f4eeaf2cea0a7b75ce604d6591a22dda87921c35172adc3384fe56`.
Immutable339 manifest SHA is
`e04b1c7813c1c2872adc0a84a188efed76e364d130bd01b05b41b318649e3e82`.
Exact delta13/326 unchanged against339; original334 delta15/319 unchanged;
selected217 contains5 added,15 changed existing and197 unchanged sources.
Protection proof1737/1737:
`.tmp/m07-ordinary-admission-compat-final-v2-corrected-protected-proof.json`,
SHA `67b12211ce8722c57a5e6eb6337001e2ac8de1b69935f4e9ace8b01e9543a33d`.

Fresh broad regression used the identical186-file selection, SHA
`330f68970c9c6a55455903a0afedf587df259001b02ca48633dd8731115c8bbe`:
5690/5690 PASS,0 FAIL/skip/todo, terminal0. Both commands bind unchanged217
source bytes before/after to720eba. Raw report:
`.tmp/m07-ordinary-admission-compat-final-v1-combined-final.json`,
SHA `19c8d0171a63e9cc5df4d59c6b6f3e5a03069f9b727f151fdf7e7dbb74a3f2c6`.
Command proofs are `...compat-final-v1-tests-command.json` and
`...compat-final-v1-gates-command.json`. Five gates terminal0: admin build,
both TypeScript configs, client-secret scanner and existing readonly text gate.
Child TEMP/TMP remained in owned repo scratch; no normalizer --write was used.
The previous broad5422/5665 with243 FAIL remains immutable historical evidence.

SAME125 private/source/caller fixtures: BEFORE339123 PASS/2 positive target FAIL;
CURRENT125/125,0skip. Seven added unknown/mismatch controls also passed BEFORE;
they retain running,0 FINISH,0 canonical writes and the exact existing private
body. SAME117 scan/terminal: BEFORE33963 PASS/54 protocol/target FAIL;
CURRENT117/117,0skip. These are not54 independent defects. Original102 cases,
author fixture AST and terminal assertions are preserved;15 cases were added.
Pair proofs: `.tmp/m07-private-compat-pair-v2-proof.json` and
`.tmp/m07-scan-terminal-same117-proof-v1.json`.

Fresh unchanged SAME40 fixture passed40/40 on41 bound APP modules:
`.tmp/m07-ordinary-admission-compat-final-v1-command.json`.
Its original BEFORE33410/40 and BEFORE33732/40 remain the same fixture evidence;
the seven structural old-helper fixture failures retain their former classification.
Fresh native Next used the same17 fixture files/browser runner:89/89 checks in7
groups,79 actual compiled APP modules bound to current source, real local
multipart POST303/GET. Evidence:
`.tmp/m07-ordinary-admission-native-compat-final-v1-evidence.json`,
SHA `e8b92dbb40659f6948c20de6b64e703424b3332b8942694d0b7a26d008ee69f8`.
Auth/SQL ledger/Cloudflare responses are controlled. Login landing is omitted;
permission-loss404 demonstrates only the actual Auth redirect boundary.

Fresh portable PostgreSQL17.11 executed actual old atomic completion with full
ordinary markers at499/500, stripped-cursor40001 without writes, original-job
replay with one audit/version bump, and known pre-STAGE missing-candidate
FINISHconflict preserving the full new authored RU/old public EN and ACK ledger.
All predecessor/native guards, actual role/RLS probe and multisession admission
also passed. Report:
`.tmp/m02-postgres-tools/native-cases/m07-ordinary-compat-current-v2-20261008123720400-26152-5ad846d4/result.json`.
SQL SHA `fcf91792c600c36a0c9dd8e91df7859d33e1909296869770e543ac5b5ae6479e`.
Actual stdout has14 PASS markers plus2 observation payloads; earlier marker
totals included an observations payload. Synthetic Auth claims/schema remain
the boundary. Own Next/PG stopped, owned SUBST removed,3181/54329 verified free.

Aggregate verifier892/892 (verification assertions, not application cases):
`.tmp/m07-ordinary-admission-compat-final-v3-verified-proof.json`,
SHA `e2f449d606228a31cea28c9a2674c812f99015458368766805b5d8b40450e1f4`.
The SQLv1 operator-precedence fixture failure, protectionv1 clean-inventory
failure, aggregatev1 missing clean native dependency and aggregatev2 marker-count
failure are retained diagnostics. Only corrected uniquely labelled proofs passed.
The mislabeled historical scan BEFOREv5 remains excluded from SAME pairing.

Next concrete independent step: M07-T06. Readonly controlled diagnosis executes
the actual gate/metadata and page predicate; old-model PASS remains stored while
SQL BEGIN projects a new model/in-progress state, which the current gate/page
may treat as ready. Reviewer/two-pass changes are not bound; Health does not read
the same persisted probe and the translations description hardcodes model names.
Evidence `.tmp/m07-t06-readonly-diagnostic-v1-proof.json`, SHA
`d6762f1b0eb2c725cf9329268233787e51d11cce8dddb566a1f5efbe468914ea`.
Nine sources unchanged,0 external/provider calls. SQL projection is static;
native SQL reproduction and full page/Health verification are NOT_RUN. Reproduce
actual BEGIN first on the same fixture, then bind the effective configuration
(including repair model with review off), pending state and immutable probe
identity through the existing lease/cooldown mechanism and shared typed reads.
Use an additive migration; do not rewrite closed SQL or base prompt/content.

Managed Auth/DB/RLS/PostgREST, paid provider acceptance, account402 and production
remain NOT_VERIFIED/externally BLOCKED. No push/deploy/production migration,
paid call, social send, real-account role mutation or dependency install occurred. Independent
safe work is available, so the full goal remains ACTIVE rather than complete.

## 2026-10-08: M07 ordinary durable admission and retained candidate

This entry is historical after the compatibility continuation above. Earlier
next-step instructions below are historical where superseded. The panel goal remains ACTIVE for
M00-M25:26 modules,25 main stages plus M00,230 acceptance criteria. No module or
the full goal is accepted merely because this focused local slice passed.

Ordinary owner/admin requests now enter an atomic durable job/item/operation
before provider dispatch. Existing tables and journal are reused. The narrow
12-argument BEGIN binds auth.uid, original actor, provider, complete RU snapshot,
hash, both RU/EN CAS and cursor. Global active-item admission also guards old
retry jobs for the same article; a fresh UUID cannot bypass an unresolved call.
Role loss is checked on subsequent mutations. Existing service-role contracts,
M02 private schema and six earlier M07 migrations remain unchanged.

FINISH updates the admitted run rather than inventing a posthoc model outcome.
Ordinary lifetime cap3, batch cap2 expensive items,4 provider calls/item,8/batch,
500-item scan window and100-ID reads remain bounded. Continue scans remaining
candidates; selected Retry reuses only the chosen failed item. A full500-item
job rotates to a new job at the saved cursor without overwriting the old run.
The readiness RPC must return literal true; unavailable capability stops the
form and helper before model entry. This is synchronous admission, not a claim
that a background worker or public delivery was exercised.

The SAME fixture reproduced a retained staged candidate becoming permanently
active after canonical RU/EN changed. The corrected FINISH preserves the frozen
original outcome/envelope and validates the intact private candidate before
accounting for a known source_changed or english_changed refusal. It clears the
active accounting entry without a second model call, second body SAVE or public
overwrite. Changed/missing private bodies and unknown receipts remain blocked.
Legacy candidate recovery retains its former refusal policy. The ordinary UI
offers an explicit accounting-finalization action with the retained text notice;
this action does not constitute human review or publication.

Current source manifest:
`.tmp/m07-ordinary-admission-final-v2-source-fingerprint.json`,
SHA `2f029c5adf8cb55d5a295b8ff84ab5eef7c396527c46ba292a6400757dbf8a08`.
Compared with immutable334, exactly7 existing files changed and5 were added;
the other327 captured sources and205 selected sources are unchanged. Source-only
proof `.tmp/m07-ordinary-admission-final-v2-corrected-protected-proof.json`
verified901/901 assertions: normalizer files/full AST call projections, TG6,
closed source guard, old SQL/M02 exact9, planner/allowlist and dependencies.
The first protection diagnostic retained two inventory sorting failures; the
corrected verifier compares identical paths/SHA in authoritative manifest order.

Focused SAME40:
`.tmp/m07-ordinary-admission-final-v1-same-proof.json` (1028 verifier assertions,
not1028 application cases) binds all39 actual APP dependencies and fixture SHA
`6dccf719a25575448f4a56461ff142980ca88a1da2338285e4f5d3892c76cbe2`.
Immutable BEFORE334 was10 PASS/30 diagnostic FAIL; seven failures inspect an
operation absent from the old helper and are structural fixture failures, not
independent regression proof. Initial ordinary BEFORE337 was32 PASS/8 exact
post-stage/cap targets FAIL. CURRENT is40/40, terminal0. Concurrent actual
provider entries4 became2; unknown accepted dispatch prevents new provider
entry. Ten actual candidates produced8 complete private successes/2 known
failures; retrying the two chosen failures did not regenerate the eight successes.
The older retry/candidate tests were adapted only for the additional read
protocol; their focused v4 result121/121 and prior diagnostics are retained.

Native SQL: paired isolated PostgreSQL17.11 with the full maintained fixture and
existing predecessor migrations, real transactions/locks/ACL/RLS, synthetic
Auth claims/schema helpers. BEFORE49c8 and CURRENT each emitted13 fixture marker
groups, including actual multisession admission. Reports:
`.tmp/m02-postgres-tools/native-cases/m07-ordinary-admission-unicode-before49c8-v7-20261008115616919-23412-86655d26/result.json`
and
`.tmp/m02-postgres-tools/native-cases/m07-ordinary-admission-unicode-current-v6-20261008114010283-11224-bfb298f1/result.json`.
Both terminal PASS; own serverStopped/aliasRemoved true. The native source-change
case uses a valid actual saveBundle and published-to-draft transition; it does
not prove a still-published pure timestamp-only change. The independent private
body-change case still refuses original recovery with40001. The SQL fixture
represents its synthetic authored em dash with U& Unicode escape, preserving
the same decoded text/hash and satisfying the existing readonly text gate.
No normalizer, call, rule or normalizer test was changed. Earlier native guard,
ACL/fixture-order diagnostics, default Add-Type preflight denial and a wrong
expected-marker diagnostic remain FAIL evidence, never relabelled PASS.

Native Next SAME17 fixture files and same corrected Chrome runner:
BEFORE `.tmp/m07-ordinary-admission-native-before-final-v4-evidence.json`:
86 checks,81 PASS/5 reproduced target FAIL,0 app failures,7 groups.
CURRENT `.tmp/m07-ordinary-admission-native-current-final-v4-evidence.json`:
89/89,7 groups, compiled APP graphs77/78 source-bound. Actual local Next document
multipart POST303/GET and actual internal Auth/actions/helpers/installed SDK ran;
external Auth/SQL ledger/Cloudflare responses were controlled. Permission loss
redirected to /login with zero model writes. The synthetic fixture omits the
login landing, so its recorded404 proves only the actual redirect boundary,
not login-page or full authenticated acceptance. The prior82/83 diagnostic
waited for /translations after this valid redirect; only the ignored runner
expectation was corrected. Both own Next launchers stopped;3181/54329 free.

Current build, both TypeScript configurations, client-secret scanner and readonly
text gate are terminal0, source unchanged:
`.tmp/m07-ordinary-admission-final-v2-gates-command.json`.
The first broad test/browser attempts were interrupted, with no final reports;
they are not PASS. Default TEMP outside the writable root caused an all-import
EPERM diagnostic; child-only TEMP/TMP inside this repo fixed test execution.
No install, global environment change or existing browser profile was used.

ACTUAL BROAD REGRESSION REMAINS FAIL:
`.tmp/m07-ordinary-admission-final-v3-combined-final.json`, terminal1,
186 suites:178 PASS/8 FAIL;5665 tests:5422 PASS/243 FAIL. Failed suites/counts:
article-item-retry-journal3;article-ordinary-private-draft22;
article-retry-source16;article-batch33;article-machine-draft-callers2;
article-scan46;article-terminal40;translations-load-errors81.
Unexpected new readiness/domain RPCs and old posthoc journal expectations are
observed among the failures. These are unresolved, not dismissed as harmless
mocks, and broad acceptance is not granted. Exact raw diagnostics are retained.

Source-bound readback/cleanup proof:
`.tmp/m07-ordinary-admission-checkpoint-v1-proof.json`,400/400 verifier assertions,
status LOCAL_FOCUSED_RESULT_VERIFIED_BROAD_REGRESSION_PENDING.
Managed Auth/DB/RLS/PostgREST, provider acceptance/charges, initial402 root cause
and production remain NOT_VERIFIED; initial managed bootstrap remains externally
BLOCKED. No push/deploy/production migration/paid/social call was performed.

NEXT CONCRETE STEP: investigate and restore the eight broad regression suites
against the exact current217 source. Start with translations-load-errors81:
support the new strict readiness/domain reads while retaining all error/access,
zero-model and cursor assertions. Then reconcile the ordinary private-draft,
scan/batch/terminal and old journal fixtures with atomic admission/accounting;
fix genuine runtime failures if demonstrated, preserving original assertions
and SAME reproductions. Do not weaken fail-closed guards or create fake admitted
model outcomes. Re-freeze only after actual changes, then rerun appropriate
focused/broad checks. M07-T06 model/config probe freshness remains a later pending
criterion. Full M07 and other module acceptance remain incomplete.
Работа возобновлена по просьбе пользователя. Цель в центральной панели активна:
полностью завершить M00..M25, 26 модулей (25 основных и подготовительный M00), 230 критериев приёмки.
Article recovery, confirmed article success и следующий локальный SQL-контракт
проверены в указанных ниже границах; article operationId/lookup подключены к форме.
Partial RU-only release сохраняет прежний private EN в существующем working draft;
его read model и receipt проверены локально. Исходные article A/opId/CAS и поздний
ввод B теперь сохраняются в хранилище вкладки до отправки и восстанавливаются после
reload; результат записи подтверждается только серверным lookup. Весь M02 ещё не принят.

## Исправление прав атомарной публикации, 5 сентября

- Воспроизведены два отказа PostgreSQL: блокировка рабочего черновика через
  `FOR UPDATE` при SELECT-only правах и прямой INSERT перенаправления после
  перехода SEO на защищённые RPC. Общая ошибка неверно упоминала английскую версию.
- Аддитивная миграция сохраняет SECURITY INVOKER у публичных RPC, RLS,
  контроль версий и запрет прямого DML. Узкий owner/admin helper блокирует
  черновик; перенаправление делегируется существующим guarded SEO RPC.
- Реальный изолированный SQL-прогон воспроизвёл обе прежние ошибки, проверил
  публикацию без EN, повторное применение миграции, CAS, полный rollback и роли.
  В CI тот же контракт запускается на PostgreSQL 17. Production-статус
  подтверждается отдельно после слияния и штатной сверки БД.
- Необработанные ошибки больше не выводят ложное требование английской версии;
  серверный журнал сохраняет только разрешённый код ошибки и имя операции,
  без SQL, содержимого статьи и секретов.

## Завершение публикации и прямого редактирования, 4 сентября

- Русская вкладка публикует русскую статью независимо от незавершённого
  английского черновика; проверки двух языков и совместная публикация разделены.
  Сохранённый перевод остаётся в базе; автоматический перевод для отдельного
  русского выпуска не запускается.
  Новый intent обрабатывает отдельный серверный адаптер; зафиксированный
  Stage 5 pipeline сохранения, его проверки доступа и контрольные суммы сохранены.
- В предпросмотре главной подписи интерфейса внутри фоновых маркеров секций
  снова выбираются кликом. Управляемый текст статьи или страницы остаётся
  связан со своим редактором.
- Ошибка соединения при загрузке версии выбранного поля больше не оставляет
  инспектор в бесконечном ожидании; сбой сохранения показывает понятный статус.
  Ответ сохранения предыдущего поля не перезаписывает выбранное новое поле;
  версия сохранённого блока обновляется в кеше независимо от текущего выбора.
- Закрыта GHSA-cp6q-959q-f8rh в редакторе: 32 пакета Tiptap согласованы на
  версии 3.30.4, регрессия опасного JSON-атрибута проверена на установленной
  версии. Проверка production-зависимостей: 0 известных уязвимостей.
- Исправлен порядок нормализации тире и редакционных замен: финальная обработка
  экспорта больше не создаёт пропущенных исправлений в двух CMS-статьях.
  Вложенные HTML-сущности метаданных также нормализуются за один вызов.
- Профильные проверки: 30 тестов русской публикации/предпросмотра, 20 тестов
  публичного direct-edit и 13 тестов редакционных исправлений/экспорта прошли.
  Браузерный сценарий прошёл на компьютере и телефоне: заголовок, подпись кнопки,
  изменение/повторный выбор и изображение фона. Статус CI и production-релиза
  подтверждается отдельно по GitHub Actions после слияния. TypeScript админки
  и публичного сайта прошёл без ошибок.
  Дополнительно прошли 15 тестов адаптера/фасада и 14 тестов защиты Stage 5
  и атрибутов редактора; корневая конфигурация зависимостей не изменена.

## Состояние реализации

- [x] Phase 5 - Site Studio: типизированный реестр компонентов, дизайн-токены,
  адаптивные состояния, наборы изменений, атомарные релизы и откат; публичный
  runtime/export; Direct Edit v2; безопасная загрузка растровых изображений.
- [x] Phase 6 - Data Studio: единый маршрут, канонические справочники стран и
  писателей, validated FK, ручной приоритет, SELECT-only/FORCE RLS, атомарные
  операции с изданиями и CAS/audit/outbox.
- [x] Phase 7 - Translation Operations: реальный provider self-test со строгой
  JSON-схемой, cooldown/lease и сроком 24 часа; безопасные коды ошибок; durable
  jobs/items/attempts и ограниченное продолжение по сохранённому курсору.
- [x] Phase 8 - Site Copy, SEO, комментарии, аналитика и операции: атомарные RPC,
  запрет обхода прямым DML, защита редиректов, агрегированная DB-аналитика и CSV,
  backup Storage manifest с SHA-256, restore verification и operational markers.
- [x] Phase 9 - единый типизированный реестр модулей для sidebar и command
  palette; все операторские маршруты покрыты и проверены.
- [x] Phase 10 - fail-closed schema health, закрытый словарь статусов, редактирование
  без вывода сырых PostgREST/provider ошибок, граница клиентских секретов,
  документация и матрица CMS-покрытия.
- [x] Published-article draft isolation - отдельная versioned/CAS рабочая копия,
  FORCE RLS, закрытый прямой DML и транзакционное удаление после публикации.
- [x] Article composer polish - безопасная автоматизация анонса/SEO/OG без
  перезаписи ручных формулировок, семь редакционных шаблонов, единая русская
  терминология и управляемое оформление изображений.

## Инварианты релиза

- Production migration plan содержит ровно 35 рассмотренных миграций с
  нормализованными SHA-256 и завершается
  `20260905_article_publication_permissions`.
- Итоговый health RPC наследует все прежние проверки и дополнительно закрывает
  Site/Data/Translation Studio, Direct Edit v2, last-owner, mutation guards,
  analytics и operational observability.
- Итоговый health RPC также подтверждает приватные рабочие черновики статей:
  таблицу, FORCE RLS, staff-only SELECT, RPC ACL, cleanup-trigger и RLS-разделение
  owner/admin publication против editor draft/review для статьи и перевода,
  bounded 5 MiB payload для обеих языковых версий и атомарный working-draft
  CAS перед privileged release.
- Сверка БД выполняется только из exact `main`, после зашифрованной резервной
  копии и изолированной restore-проверки; несовпадение SHA, ledger или health
  останавливает применение.
- Клиентские chunks проверяются после production/OpenNext build; серверные
  secrets и их значения в `.next/static` запрещены.
- Глобус и книжная полка остаются `ownerLocked`: Site Studio не меняет их
  геометрию и интерактивные алгоритмы.

## Проверки текущего блока

- Полный финальный suite: **461 тестовый файл, 2572/2572 теста**; ещё 2
  штатно пропущены.
- Единый `npm run lint`: успешно, включая публичный TypeScript, оба admin
  TypeScript-конфига, каталоги интерфейса и Cloudflare bindings.
- Admin TypeScript (`tsc --noEmit` и Cloudflare tsconfig): успешно.
- Финальный объединённый focused suite: **34 файла, 154/154 теста**.
- Production migration planner/schema-health suite: **21/21 тест**.
- Working-draft migration/final-health/planner suite: **30/30 тестов**.
- Article working-draft server flow: **9 файлов, 50/50 тестов**; Admin
  TypeScript typecheck успешно.
- Дополнительные профильные прогоны фаз до финального набора: Data Studio
  **11/11**, mutation guards **10/10**, Translation Operations **47/47**.
- `git diff --check`: ошибок нет; сообщения о будущей CRLF-нормализации на
  Windows не являются ошибками содержимого.
- Локальный OpenNext build на Windows остановлен известной junction-проблемой
  окружения (`node_modules` разрешается в другой диск). Кодовая проверка и
  typecheck зелёные; авторитетная production-сборка выполняется в чистом Linux CI
  из lockfile, без повторного локального прогона той же сломанной команды.

## Документация оператора

- [Матрица покрытия CMS](./CMS_COVERAGE_RU.md)
- [Data Studio](./ADMIN_DATA_STUDIO_RU.md)
- [Site Studio](./ADMIN_SITE_STUDIO_RU.md)
- [Translation Operations](./ADMIN_TRANSLATION_RU.md)
- [Восстановление редакционной работы](./ADMIN_RECOVERY_RUNBOOK_RU.md)
- [Backup, restore и operational checks](./ADMIN_OPERATIONS_RUNBOOK_RU.md)

## Граница текущего релиза

Изменения глобуса из соседней задачи не редактируются этим блоком. Добавление в
`src/index.css` ограничено публичным оформлением редакционных изображений;
геометрия и интерактивные алгоритмы глобуса остаются без изменений. Каталоги
контента не включаются без отдельного подтверждённого содержательного изменения.

## R3 checkpoint: M02, загрузка данных и сохранение страниц и статей, 7 октября 2026 года

Это продолжение существующего состояния. Закрытые этапы выше сохранены как
исторические результаты, без повторного заявления их PASS для текущего R3.
Прежняя completion branch: `codex/fix-article-publication-rpc`.

- Package: `PROBPERA_ADMIN_R3_FINAL_20260923`; SHA-256 исходного архива
  `5281789727a8638d664d10191ab960ef7c86872ac444a2166f3e39688b814789`.
- Рабочая ветка: `codex/admin-r3-data-errors`, отдельный worktree.
- Фактический HEAD: `9d9efe7fdd7702c7ee38630aca986be0c863f225`.
  Изменения M02 не закоммичены; этот checkpoint обновлён на месте.
- Active module: **M02**, текущий локальный шаг завершён; прежняя пауза снята пользователем.
  Локальный шаг загрузчиков
  dashboard, articles/list/new/edit/preview, health, settings/team,
  translations, data-studio, library/dossiers, analytics/export, publication,
  media, history, SEO, editorial database, menus, site-copy, pages, categories,
  comments, banners/homepage, Site Studio и news delivery overview проверен.
  Дополнительно проверены сохранение страницы, browser Storage, восстановление
  и удержание открытого редактора при ошибке повторного чтения.
  Отправка статьи, известные отказы, unknown outcome, Storage и резервные копии
  проверены изолированно. Удержание открытой статьи/new/copy при повторном чтении,
  сохранение исходных версий и рубрики, безопасный retry сохранены. Текущий шаг
  recovery добавил отказ неполных/повреждённых snapshots до изменения формы
  и совместимость полных копий. Новый шаг confirmed article success сохраняет
  поздние RU/EN и ручные поля при receipt/cookie/Flight, принимает собственный
  серверный ID/CAS и не выполняет автоматический переход из открытой формы.
  Отдельная поздняя просьба пользователя о Telegram footer выполнена
  в локальном шаблоне. Весь M02 и весь R3 не приняты.
- Production R3: **NOT_RUN**. Выполнены изолированные browser/component и
  native Next fixture проверки с явно указанными mocks. Полный авторизованный
  admin E2E и проверка настоящей DB/RLS не выполнены.
- Code fingerprint:
  `e3a0ce9324fba96dbe726372b3fe726093a30d7e179f4f4b470ee72723c7f74e`.
  Это SHA-256 от JSON `{head, branch, files}`; 136 изменённых/новых файлов
  кода и тестов отсортированы по пути, для каждого записан SHA-256 сырых байтов.
  Из них 126 файлов admin, 4 SQL/DB contract файла и 6 файлов
  дополнительной Telegram-правки пользователя. Область fingerprint расширена
  новыми `scripts/database/` и `supabase/migrations/`; прежние файлы не исключены.
  Полный список: `.tmp/m02-code-fingerprint.json`. Сам checkpoint и локальные
  evidence-файлы исключены из fingerprint. Финальные результаты связаны с ним
  в `.tmp/m02-pending-reload-final-verification.json`.
  Предыдущий private EN fingerprint
  `2339d1d686d524a2cbe9d3b7bd11e9ee3489743a931867e9831278fc00da2844`
  и 133 файла сохранены в `.tmp/m02-code-fingerprint-before-pending-reload.json`;
  `.tmp/m02-private-en-final-verification.json` остаётся историческим proof.
  Полные исходные bytes для before/current reload сохранены в
  `.tmp/m02-pending-reload-before/manifest.json`; отдельный before fresh-history
  воспроизводит появившуюся ошибку на fingerprint f8b5a147 и сохранён в
  `.tmp/m02-pending-reload-before-entry-isolation/manifest.json`.
  Предыдущее содержимое этого checkpoint сохранено как ignored evidence:
  `.tmp/m02-checkpoint-before-pending-reload.md`.
  Предыдущий operation wiring fingerprint
  `5147aa7b1f68163a92c7e8821de95e6e195712be69c92eea1712e3d86b878ac8`
  и 130 файлов сохранены в `.tmp/m02-code-fingerprint-before-pending-en.json`;
  `.tmp/m02-operation-wiring-final-verification.json` остаётся историческим proof.
  Source snapshots до private EN изменения сохранены в
  `.tmp/m02-private-en-contract-baseline/manifest.json` и
  `.tmp/m02-residual-english-client-before/manifest.json`.
  Предыдущее содержимое этого checkpoint сохранено только как ignored evidence:
  `.tmp/m02-checkpoint-before-pending-en.md`.
  Предыдущий operation foundation fingerprint
  `cefe05c4b95568ce77f435b2f2a437c3827ab774f66e3fb9288419707801e3ce`
  и 123 файла сохранены в `.tmp/m02-code-fingerprint-before-wiring.json`;
  `.tmp/m02-editor-operation-final-verification.json` остаётся историческим proof.

  Предыдущий confirmed-success fingerprint
  `296a5eeb3d1268c8e8692ee04cff4a6456135964d81ac5883dbd3a96375a9ecd`
  и 113 файлов сохранены в `.tmp/m02-code-fingerprint-before-operations.json`;
  `.tmp/m02-article-success-final-verification.json` относится к этому срезу.
  В предыдущем срезе Article61/Page39 выполнены заново, native Article success10
  выполнен на одинаковом baseline/current fixture. Прежние native Page5/Article9 сохранены
  только по неизменным сырым SHA wrappers/runner. Общая сверка модулей и manifest:
  `.tmp/m02-article-recovery-final-evidence-applicability.json`. SHA-сверка
  не является новым native прогоном; ограничения прежних fixtures сохранены.

### Выполненный diff и сохранность R2

- `safeCount` сохраняет подтверждённый ноль; error, missing/null count,
  дробное/отрицательное/небезопасное число возвращают `null`.
  Dashboard изолирует все 12 запросов; недоступные значения не становятся нулями.
- Общий read-result helper различает schema, permission, unavailable и invalid;
  успешные `[]`, `0` и разрешённый nullable ответ остаются успешными.
  Error вместе с data не принимается как успех. Сырые provider/DB ошибки не
  попадают в сообщения интерфейса. Коды сверены с
  [официальным справочником PostgREST](https://docs.postgrest.org/en/stable/references/errors.html).
- Редактор и создание/копирование статьи закрывают форму при недочитанном
  обязательном RU/EN bundle, categories или working draft. Ошибка основного
  запроса не превращается в ложный `notFound`; штатный успешный `data:null`
  и Next.js navigation signals сохраняют прежний контракт.
  Необязательные history/templates/social данные показывают недоступность.
- Список статей сохраняет независимые строки при сбоях counts/views/profiles;
  ошибка основного списка не выглядит пустым архивом. GET-retry сохраняет
  фильтры, пагинацию и admin base path. Предпросмотр проверяет принадлежность
  RU/EN/working draft, даты и DTO до вывода HTML; исходные текст/HTML сохранены.
- Health изолирует пять чтений. Ошибки diagnostics/markers/schema/queue
  не дают пустой список, ложный ноль или зелёный статус. Неполный ответ
  текущей схемы имеет UNKNOWN; подтверждённые отрицательные capabilities
  и старая версия остаются отдельным результатом проверки.
- Settings/team сохраняет независимые readiness/session/MFA и закрывает
  изменение доступа при неуспешном чтении команды. Настоящий `[]` сохранён.
  Сравнение собственного UUID не зависит от регистра и не меняет его байты.
- Translations изолирует девять DB-чтений и каталог. Неизвестная readiness
  не становится false/миграцией; подтверждённый bounded режим R2 сохранён.
  Недочитанные обязательные зависимости закрывают соответствующие batch,
  resume и self-test. Поддержаны оба законных operations DTO, включая старый
  без resumeCursor. Допустимый SQL UUID не убирает список/counts; только
  несовместимая с прежним action кнопка resume закрыта. Probe проверяется
  по provider, типам, allowlist и SQL-инварианту success/error.
- Data Studio изолирует пять counts, schema RPC и каталог. Sync закрыт
  при неизвестных/повреждённых обязательных данных. Миграционный текст
  основан на подтверждённой старой версии или false. Lookup query errors
  защищён от inherited prototype keys. URL-флаги в settings/translations/
  data-studio не являются подтверждением commit или публикации.
- Library изолирует основные и зависимые чтения, ISBN lookup и counts.
  Недочитанный work/edition/writer bundle закрывает соответствующий редактор,
  независимые каталоги сохраняются. Три пагинации сохраняют фильтры/base path;
  неизвестный total не отправляет на первую страницу. Поддержаны допустимые
  SQL UUID, safe bigint counts, nullable/arbitrary JSON metadata и реальные
  неполные черновики без переписывания содержания. Несовместимые с прежними
  actions UUID остаются читаемыми, соответствующие формы закрыты.
  Artwork secondary count неизвестен при неизвестном total/primary или
  primary > total. SQL/actions, ISBN producer и редактор не изменены.
- Dossiers проверяет список и выбранный DTO: book_key/locale, revision,
  reviews/audit/blocks/sources/rights и совпадение внешней записи с draft.
  Ошибка не создаёт пустой новый редактор; successful requested null остаётся
  отсутствующей записью. Реальные неполные RU/EN drafts и их байты сохранены.
  GET-retry сохраняет book/locale/base path; CAS и permissions не изменены.
- Analytics проверяет полный RPC DTO до прежнего normalizeAnalyticsReport:
  диапазон, строки, даты, safe counts и rating. Ошибка не выглядит нулевой
  статистикой; подтверждённые 0/[] остаются такими. CSV GET отвергает
  повреждённый ответ, возвращает 403 для permission и 503 для недоступности,
  включая private/no-store. Прежняя защита CSV formulas сохранена.
- Publication изолирует список и три counts. SQL BIGINT ids читаются без
  потери точности; четыре статуса, attempts и nullable producer fields
  проверяются без запрета законных финализированных записей с attempts=0.
  Неизвестный total не даёт ложной пустой страницы. GET retry сохраняет
  фильтры, сырые last_error не выводятся, URL-флаги не служат receipt.
  При недочитанных обязательных данных закрыты dependent/full-build формы;
  outbox, actions, receipt и provider policy не изменены.
- Media проверяет assets/usages/orphan/replacement RPC и обязательные связанные
  записи. Ошибка и неизвестный count не становятся пустой медиатекой; unsafe
  bulk/replace закрыты, настоящий первый пустой диапазон сохранён. Публичный URL
  берётся прежним SDK, без загрузки файлов. Identity и replacement DTO проверены.
- History изолирует версии, restorable count и audit. SQL BIGINT string и
  nullable удалённые сущности читаются без потери точности; arbitrary JSON
  snapshot остаётся читаемым. Восстановление доступно только с проверенным
  bundle и совместимой версией. Непримитивный snapshot title не падает при SSR.
- SEO изолирует пять чтений; независимые результаты остаются доступны.
  Ошибки counts/issues/redirects не дают ложного нуля или пустого списка.
- Editorial database изолирует каталог, schema, overrides и counts; ошибка
  выбранного override не создаёт пустую форму. Country/writer identity проверены.
  Сохранены null/пустые locale ownership tombstones, частичные языковые карты и
  допустимые старые профили. Predicate проверяет прежние bounds/control chars
  biography consumer до его вызова, чтобы профиль/источник не исчезал из формы.
  Сохранённые данные, прежний reader и его нормализаторы не менялись.
- Menus проверяет полный bundle, IDs, FK и родительские ссылки. Законные
  deep/cross-menu/cycle записи прежнего SQL остаются читаемыми. Site-copy
  монтирует реальный editor только после полного чтения каталога и storage;
  настоящие пустые/nullable RU/EN сохранены, malformed maps не превращаются в {}.
- Pages list/edit/preview проверяют DTO, counts, identity и версии. Ошибка
  основной записи не даёт ложный 404; подтверждённый null сохраняет native 404.
  Независимый сбой истории не убирает корректный редактор, но закрывает restore.
  Удалены подтверждения по URL. savedAfterSubmit=false не позволяет считать
  query-флаг квитанцией для очистки автокопии.
- Page JSON проверяется фактической общей TipTap-схемой. Неизвестные node/mark,
  повреждённая вложенность и поля/attrs, теряемые nodeFromJSON, закрывают форму.
  Добавляемые schema defaults не переписывают входной DTO. Канонический новый
  пустой draft разрешён только с пустым HTML; пустой JSON поверх непустого HTML
  не открывается как пустой редактор. Preview HTML сохраняется без переписывания.
- Для серверной проверки схема отделена от React node views: EditorialBlock
  и EditorialImage сохраняют прежние attrs/parse/render/commands, а новый
  RichEditorClientExtensions подключает прежние два view. В ArticleEditor и
  PageEditor изменён только import factory. Общий порядок extensions сохранён.
  10 actual-schema fixtures проверяют attrs/defaults, JSON roundtrip и запрет
  browser imports/normalizer calls при построении серверной схемы, без DOM.
- Categories/tags/comments показывают неизвестные counts и сохраняют
  независимые результаты. Unsafe формы и bulk moderation закрыты, неподдержанная
  action ISO-версия остаётся читаемой. Пустой диапазон с неизвестным total
  не называется пустым архивом; это также исправлено у pages/history.
- Banners/homepage проверяют обязательные media/settings bundles перед
  редактором и preview. Некорректные, отсутствующие или конфликтующие media
  ссылки закрывают зависимые действия. Поддержаны прежние numeric/bool strings,
  showcase order 0..6 и SQL block UUID; прежний узкий media UUID gate сохранён.
  Settings null/scalar/array и значения, которые editor потерял бы, читаются
  без открытия пустой формы.
- Site Studio tokens/fonts/releases проверяет полные bundles, counts,
  версии и связи. Корректные частичные строки доступны для чтения; редактор
  закрыт до полного bundle. JSON typography, который прежний consumer обнулил
  бы, остаётся читаемым без опасной формы. Пустая первая bounded history при
  положительном count является ошибкой; непустая bounded history сохранена.
  Restore дополнительно требует поддерживаемой snapshot identity и отсутствия
  конфликта с загруженными overrides. Исторически законная смена identity и
  opaque snapshot metadata остаются читаемыми.
- News delivery overview использует реальную RPC projection и различает
  complete empty, invalid metadata и payload cap. Неполный обзор не сообщает,
  что назначений/заданий нет. Receipt-backed status и valid partial rows
  сохранены; runtime helper, worker и receipt policy этим срезом не менялись.
- Применимость закрытых R2 изменений сверена с текущим diff и guards:
  сохранены AdminDependencyState, lazy editor, article action facade, working-draft
  overlay/ownership, publication/translation policy и safe links. Ниже описаны
  изменения результатов inline savePageAction и двух article save actions.
  CAS-фильтры, RPC/SQL, RLS, outbox, auth/MFA, успешные article redirects
  и остальные четыре page actions сохранены.
- Авторские данные, RU/EN проза, источники, изображения и права не изменены.
  Подсистема дефисов/тире, её правила/исключения/старые тесты сохранены;
  выполнена только существующая read-only проверка. Нет новых миграций,
  deploy/push/PR, реальных provider/social вызовов или production-записей.

### M02: форма страницы, Storage и повторное чтение

- PageEditor больше не снимает dirty при отправке. Подтверждённый ответ содержит
  ID страницы и новую точную updated_at; учитываются микросекунды, одинаковая
  дата в другом часовом поясе/с padding не считается новой редакцией. Только
  подтверждённый сохранённый snapshot снимает dirty; более новые правки остаются.
- Validation/media refusal, отсутствие зависимости до записи, CAS conflict и
  unknown outcome разделены. Обрыв/неполный receipt не объявляется rollback;
  слепой повтор заблокирован, доступно сравнение в новой вкладке. Известный отказ
  можно повторить с тем же введённым текстом и контекстом. Fake operationId нет.
- Реальный update возвращает id,updated_at при прежних ID+updated_at CAS filters.
  После подтверждённой записи аудит, публикационная очередь и обновление кеша
  сообщаются независимо. Их сбой не превращает подтверждённую запись в отказ.
  Ни сырой provider message, ни query flags не становятся receipt.
- Двойная отправка и отправка при недочитанной зависимости закрыты. beforeunload
  защищает также pending submit без предварительного редактирования. Native
  redirect/notFound пробрасываются штатно. React 19 automatic form reset
  отменён: он воспроизводимо возвращал status select в draft после publish,
  хотя controlled state уже был published; новые select/checkbox edits сохранены.
- localStorage getter/read/write/remove failures не размонтируют редактор.
  Успех локальной копии не показывается без фактического true. Shared
  RecoveryController при недоступном sessionStorage держит только metadata
  сессии/sequence/receipt в памяти; авторский snapshot таким fallback не объявляется.
  Неизвестные durable metadata и malformed pending receipts не очищаются вслепую.
- Metadata-only recovery не подставляет пустое тело. JSON перед заменой проходит
  прежнюю actual TipTap schema/preserved-values проверку, выделенную в
  canEditPageContent; unsupported node/attrs/text не очищают текущий текст.
  Допустимая намеренно пустая legacy HTML-копия остаётся восстанавливаемой.
- Inline revalidatePath воспроизводимо вызывал новый Flight render и потерю B,
  введённого во время сохранения A, при следующем loader failure. Две прежние
  invalidations теперь регистрируются через Next after; результат честно
  scheduled, а не complete. Подтверждение выполнения фонового кеша не выдумывается.
  Поведение сверено с installed Next и [официальным описанием revalidatePath](https://nextjs.org/docs/app/api-reference/functions/revalidatePath).
- Cookie write также вызывает Flight независимо от after. Поэтому server page
  всегда возвращает стабильный PageEditorLoader с ключом страницы. Он удерживает
  последний подтверждённый bundle только этой страницы при failed reread,
  сохраняет смонтированную форму и блокирует canonical Save/Publish. Успешный
  read-only router.refresh возвращает доступность без замены нового ввода.
  При первоначальной ошибке редактора нет; данные другой страницы не наследуются.
  Обычный client factory throw безопасно классифицирован, native signals сохранены.
- Три прежних source guards адаптированы по смыслу: CAS/catalog проверяет новую
  receipt projection и typed conflict до aftermath; media проверяет оба submit
  guards; operator-data-error проверяет typed content refusal и русское сообщение
  в mounted editor. Остальные assertions сохранены, добавлены реальные action
  и browser proofs; проверки не отключались ради зелёного результата.
- AST proof `.tmp/m02-page-save-preservation-proof.json`: все четыре прежних
  normalizer call expressions и create/status/delete/restore функции byte-identical.
  Нет изменения DB/schema, auth/cookies, author data, нормализаторов или их правил.

### M02: отправка статьи и сохранность копий

- ArticleEditor теперь обрабатывает ответ action внутри смонтированной формы.
  Конечный ArticleSaveResult содержит только rejected с известной причиной,
  dependency-unavailable, conflict или unknown-outcome. Неизвестный/повреждённый
  ответ и обычный transport reject оставляют RU/EN ввод и закрывают blind retry.
  Есть безопасная ссылка в новую вкладку для сравнения сохранённой версии.
  При известном отказе до записи повтор доступен; browser proof действительно
  вызывает второй action и проверяет полный введённый RU/EN snapshot.
- Canonical и atomic actions возвращают известный отказ до persistence RPC:
  permissions, schedule, schema/content/media, обязательное чтение и CAS.
  Ошибка определения владельца EN не превращается в отсутствие перевода и не
  разрешает strip/preserve metadata. Неполный previous row, включая неверный
  status, не позволяет миновать сохранение рабочего черновика опубликованной
  статьи. Недоступная выбранная категория не подменяется пустым slug.
- Оба catch вокруг working-draft/bundle RPC возвращают unknown-outcome.
  Даже похожее на известный SQL-отказ сообщение не становится доказательством
  rollback. Native redirect/notFound пробрасываются через unstable_rethrow,
  включая прежний catch автоматического перевода. Success/preview redirects,
  CAS tokens, RPC signatures/payloads, RU/EN ownership и publication pipeline
  сохранены. В тестах providers, auth и Supabase boundary изолированы mocks.
- Pending длится до фактического завершения запроса: удалён 15-second timer,
  повторный submit блокируется ref и всеми Save/Preview/Publish controls.
  beforeunload защищает также pending submit; React automatic form reset
  отменён. Dirty не снимается без подтверждения сохранённой редакции.
- Query saveConfirmed больше не разрешает удалять local/server recovery copies
  статьи. Client fingerprint и autosave identity не доказывают canonical commit.
  Пока canonical receipt не реализован, автоматическая очистка отключена только
  у ArticleEditor; shared controller и явный discard сохранены.
- Отказ localStorage getter/getItem/setItem/removeItem не выводит форму из строя.
  Неизвестные шаблоны не удаляются вслепую; shape проверяется до React updater.
  Вставка шаблона отменяется, если обязательная резервная копия не записана.
  Подтверждённое сохранение шаблона и неудачная локальная запись показаны отдельно.
  При частичном удалении только подтверждённые элементы исчезают из списка.
  Ошибка чтения body по locator не удаляет locator и саму локальную копию.
- На прежнем шаге articleTemplates, recoverySnapshot, applyRecoverySnapshot,
  switchEditorLocale и hasStructuredContent были byte-identical исходному checkpoint:
  `.tmp/m02-article-author-preservation-proof.json`. Два normalizer call expressions
  и два imports, RU/EN payload/RPC expressions проверены отдельно в action proof.
  Вызовы/правила/исключения нормализаторов и прежние migration/SQL не изменены.

Article browser: **21/21 PASS**, настоящий Chrome + Next compiled React/ReactDOM,
ArticleEditor, ArticleEditorShell, TipTap и RecoveryController; action, auth,
routing/network, autosave, template/media boundaries замокированы явно.
Команда: `node apps/admin/tests/browser/article-form-browser.mjs --label=final --source-root=current`.
Лог и полные assertions: `.tmp/m02-article-form-final.log`,
`.tmp/m02-article-form-final-evidence.json`. Внешних запросов нет.
Прежний native Next fixture относится к PageEditorLoader, не к ArticleEditor.
Полного ArticleEditor + native Flight + Auth + DB E2E этим шагом не было.

Baseline для browser использует сохранённый ArticleEditor/Shell и одинаковые
финальные fixtures; новое typed refusal response отдельно подтверждено actual
action tests. Legacy action раньше не возвращал этот DTO, поэтому один browser
mock сам по себе не доказывает прежний полный server path.
Промежуточные ошибки harness (selector с символом плюс, старый dirty label,
неверный success mock удаления) сохранены в candidate logs и не названы
исправленными runtime-дефектами. Финальные сравнения используют исправленный
одинаковый harness. Первая проверка text gate обнаружила запрещённый литерал
только в новом synthetic fixture; Unicode escape сохраняет его runtime bytes,
правила и исключения gate не менялись.


### M02: открытая статья при повторном чтении

Следующий шаг выполнен от fingerprint `991f9b1066c365c21007f808b93dcea4b5e764f90ca3c07bb6bb80cc617c0f3b`.
Изменены девять файлов относительно этого checkpoint: ArticleEditor/Loader,
edit/new server pages, прежний SSR suite и три assertions working-draft source
guard, один case существующего action suite и поддерживаемые browser runner/fixture. Другие 95 файлов общего manifest
не изменены; шесть пользовательских Telegram-файлов сохранены.

Edit/new возвращают один keyed ArticleEditorLoader при ready и failed bundle.
Последние разрешённые props удерживаются только для той же article/new/copy
identity. Initial failure не открывает пустую форму; другой ID/тип черновика
не наследует текст. Native notFound при подтверждённом отсутствии и native
redirect/notFound из client factory сохраняются. Обычный factory throw получает
безопасное unavailable-состояние. Запросы, RU/EN copy payload и working-draft
overlay не менялись: `.tmp/m02-article-read-preservation-proof.json`.

При failed reread введённые RU/EN, рубрика, изображения и локальные копии
остаются в форме. Canonical save/preview/publish закрыты в пяти кнопках,
workspace controls, onSubmit и action callback; callback освобождает флаг
ожидающей отправки, если bundle стал недоступен до вызова action. Серверные
before/after controls не удерживаются вместе со stale props. Retry использует
router.refresh без ухода с формы; модифицированные клики не перехватываются.

У mounted ArticleEditor сохранён исходный article/EN/draftKey/categories base.
Успешный reread не подтверждает старый ввод и не заменяет RU/EN CAS, working-draft
version, previousStatus, source hash или autosave base новой редакцией. Обновлённый
справочник не удаляет выбранную option и не меняет canonical path открытого
черновика. Актуальные права продолжают приходить с сервера. Следующий save
отправляет исходные CAS; действующие серверные проверки могут отказать при
изменении версии/рубрики. Это не receipt и не автоматическое объединение правок.

При первом открытии статьи с выбранной, но отсутствующей в visible catalog
рубрикой теперь есть отдельная option с исходным ID. Отправка не превращает
его в пустой category_id; выбор «Без рубрики» остаётся явным действием.
Дополнительный case actual action suite с categoryData:null подтверждает отказ
до любых записей, если выбранная рубрика действительно недоступна. Первоначальное
формирование canonical URL является прежним отдельным поведением и не объявлено
исправленным этим сохранением category_id.

Проверки и границы:

- SSR: одинаковые 133 fixtures, baseline 29 FAIL / 104 PASS; current 133 PASS.
  Вместе с 24 существующими guards: 157 PASS, 6 suites, exit 0, 18:34:14 MSK.
  `.tmp/m02-article-read-ssr-baseline.log`, `.tmp/m02-article-read-first-final.log`.
  Полный baseline log первоначального прогона 18:31 был перезаписан при пересечении
  имён browser/SSR logs. Указанный SSR baseline является реальным повтором 18:49:36
  с сохранёнными loaders и неизменёнными fixtures; metadata/command/SHA находятся
  в `.tmp/m02-article-read-ssr-baseline-replay-evidence.json`, это не восстановленный
  задним числом старый лог. Browser logs получили отдельные уникальные имена.
  Mock: provider/auth/framework/browser components; реальные page/helpers/DTO.
  Три source assertions изменены только с JSX props на равнозначные object fields;
  права owner/admin/editor дополнительно проверены шестью SSR cases.
- Реальный ArticleEditor в Chrome: одинаковые 29 fixtures, baseline 4 FAIL / 25 PASS;
  current 29/29 PASS, exit 0, 2026-09-30 18:51:18 MSK, внешних запросов 0. Доказаны удержание
  длинного RU/EN, все submit gates, actual FormData с прежними версиями/рубрикой/
  media/canonical после успешного reread, initial/cross-ID/new/copy isolation и
  сохранность copy scope. Уже проходившие baseline cases не объявлены новыми
  исправлениями. Logs: `.tmp/m02-article-browser-read-baseline-v2.log`,
  `.tmp/m02-article-browser-read-final-v2.log`; полные assertions/SHA:
  `.tmp/m02-article-form-article-read-{baseline,final}-v2-evidence.json`.
  Команда: `node apps/admin/tests/browser/article-form-browser.mjs --label=article-read-final-v2 --source-root=current`.
  Actions/autosave/Next dynamic/router/media transport изолированы; modifier test
  проверяет обработчик до отмены навигации самим fixture, не реальную новую вкладку.
- Native Next 16.3.3 fixture: одинаковые 9 scenarios, baseline 5 FAIL / 4 PASS,
  current 9/9 PASS, 18:40:03 MSK. Реальные ArticleEditorLoader, next/dynamic,
  server action/cookie/Flight/router.refresh; child editor, action result и файловые
  данные синтетические. Удержание B при cookie-triggered reread доказано для
  article/new/copy; mount counters не меняются. Проверены retry, initial failure,
  переходы и guard несовпадающего candidate. Последний guard является отдельным
  wrapper-contract test, не доказательством такого ответа production loader.
  Evidence: `.tmp/m02-native-article-read-{baseline,current}-evidence.json`;
  runner: `node .tmp/m02-native-article-read-browser.mjs --mode=current` с локальным
  fixture server на 3119. Настоящие ArticleEditor+Auth+DB в этом fixture не соединены.
  Собственный сервер остановлен, порт 3119 вернул ECONNREFUSED. Рецепт и точные
  ограничения: `.tmp/m02-native-article-read-readme.md`; manifest восьми исходных
  файлов fixture снят после прогона, это не дополнительный тест PASS.

Общая сверка сырых SHA: `.tmp/m02-article-read-final-evidence-applicability.json`.
Она проверяет Article29 (50 загруженных файлов и runner), прежние Page39 (37 файлов
и runner), native Page5/Article9 wrappers и все 104 файла текущего manifest.
Применимость прежнего Page-прогона не объявляется новым выполнением тестов.
На том шаге защищённые author/template/recovery/locale expressions были неизменны:
`.tmp/m02-article-author-preservation-proof.json`. Новый recovery diff и отдельная
сверка сохранности относительно последнего checkpoint описаны ниже. DB/RLS, реальный Auth и
production не проверены. M02 целиком не принят.

### M02: безопасное восстановление статьи, завершённый шаг и пауза

Шаг начат с подтверждённых HEAD/branch и fingerprint
`6897ff4f441023ef3c20e01d1146a8d8e4b8350fb8066eb77b3c198fcbd77d2b`.
Сохранён исходный ArticleEditor/RecoveryController/helper:
`.tmp/m02-article-recovery-baseline-source/manifest.json`.
Это снимок текущего checkpoint до правки, не whole-HEAD baseline.
Из старых 104 файлов изменены только ArticleEditor, RecoveryController и два
browser harness файла; добавлены article-recovery-snapshot.ts и его unit suite.
Другие 100 файлов, включая все шесть независимых Telegram-файлов, byte-identical.

- Partial-v2 больше не подставляет empty/default поверх отсутствующих RU/EN,
  category, cover, sources/bibliography или ручных метаданных. Metadata-only,
  неполный English bundle, неправильные поля/версии и повреждённые JSON-копии
  отклоняются до setContent, React setters и изменения locale/dirty/CAS.
- Новый узкий parser проверяет полный v2 DTO и оба документа на настоящей
  schema текущего редактора, включая неактивный язык. Node/mark/check и
  сохранность всех переданных значений проверены до восстановления;
  неизвестные attrs, которые ProseMirror молча отбросил бы, не допускаются.
  Повреждённые структуры и неверные значения атрибутов media/прав/источников
  не становятся HTML fallback. Нормализаторы не вызываются новой проверкой.
- Полные v2 копии сохраняют ручные RU/EN и метаданные без переписывания.
  Законный intentionally empty полный snapshot по-прежнему восстанавливается.
  Существующий HTML-only путь и пустой JSON doc sentinel сохранены для полных
  legacy HTML-копий. Это прежний путь редактора, не новая обработка содержания.
- Подтверждённый полный старый unversioned smaller format с RU title/slug/body
  и optional полным smaller English body восстанавливается с сохранением
  отсутствующих у него текущих metadata/category/media/sources. RU-only copy
  при активном EN не очищает видимый английский текст. Полная v2-копия с удалённой
  version не выдаётся за smaller legacy и не теряет собственные метаданные.
- RecoveryController принимает boolean отказ Article callback: сохраняет
  серверную копию и панель, показывает отказ без ложного loaded success.
  Existing Page void callback остаётся совместимым. Explicit discard отдельно
  вызывает прежнее exact deletion с id/clientSessionId/sequence/snapshotHash.
  Local parse/restore failure сообщает безопасную ошибку, не удаляет копию.

Доказательства:

- Один и тот же реальный browser fixture на recorded source до исправления:
  **7 PASS / 25 FAIL из 32 recovery cases**, exit 1. На current source:
  **61/61 PASS**, exit 0, 2026-09-30 19:18:28 MSK (29 прежних + 32 recovery).
  Evidence: `.tmp/m02-article-form-recovery-{baseline,final}-evidence.json`.
  Команды: `node apps/admin/tests/browser/article-form-browser.mjs --label=recovery-baseline --source-root=.tmp/m02-article-recovery-baseline-source --cases=recovery`
  и `node apps/admin/tests/browser/article-form-browser.mjs --label=recovery-final --source-root=current`.
- `.tmp/m02-article-recovery-browser-comparison.json` подтверждает identical
  runner/fixture raw SHA, payload bytes и initial actual FormData для всех 32
  одинаковых recovery fixtures. Записаны before/after RU/EN FormData, editor
  DOM/text, locale/dirty, backup bytes, covers и image rights/source attrs.
  Refusal требует exact сохранность DOM/FormData; accepted legacy сравнивает
  содержание и JSON без декоративных атрибутов существующего Placeholder.
  Browser использует actual ArticleEditor/Controller/TipTap/Chrome и compiled
  React/ReactDOM; canonical/template/autosave actions, routing/dynamic/router,
  dialogs и network изолированы mocks. Внешних запросов 0. Auth/DB/RLS не испытаны.
- Новая unit suite: **220 PASS**, реальные pure schema/extensions через локальный
  alias-resolving TS loader без mocks. Каждый отказ проверяет frozen current/input
  и отсутствие изменения байтов; schema defaults/rights/media, таблицы, оба языка,
  версии/полнота, intended empty и smaller legacy покрыты. DOM/renderHTML,
  actions/DB/Auth и normalizer functions в этой suite не выполняются.
- После shared controller правки заново выполнен Page browser: **39/39 PASS**,
  exit 0, 2026-09-30 19:13:11 MSK. Evidence:
  `.tmp/m02-page-form-article-recovery-page-final-evidence.json`;
  команда `node apps/admin/tests/browser/page-form-browser.mjs --label=article-recovery-page-final --source-root=current`.
  Его прежние action/DB mocks и ограничения сохранены.
- Общий итог: **3162/3162 PASS, 122 suites, 0 skipped**, оба TypeScript-конфига,
  прямой Next webpack build, существующий read-only text gate и client secret
  scanner PASS. Команды, времена и окончательный fingerprint:
  `.tmp/m02-article-recovery-validation-evidence.json`.
  Новый build не запускал экспортирующие prebuild scripts или внешние записи.
- `.tmp/m02-article-recovery-preservation-proof.json`: 100/104 прежних файлов
  неизменны, включая Telegram/actions/SQL/normalizers. Article templates,
  recoverySnapshot producer, switchEditorLocale, hasStructuredContent и saveArticle
  function byte-identical последнему checkpoint. applyRecoverySnapshot намеренно
  изменён в этом шаге; прежний author-preservation proof остаётся историческим.
  Финальные raw SHA сверены в `.tmp/m02-article-recovery-final-evidence-applicability.json`.

**Пауза по просьбе пользователя, 30 сентября 2026, 19:21 MSK.** Этот локальный
recovery шаг завершён, следующая задача не начата. M02 в целом не принят;
canonical article success receipt, operationId/reconciliation, авторизованный
admin E2E, настоящие Auth/DB/RLS и production остаются NOT_RUN/BLOCKED.
Push, deploy, production-миграции, paid/provider/social вызовы не выполнялись.

### Дополнительная просьба пользователя: Telegram footer

- Общий шаблон строит source/brand entities по финальному тексту как для
  photo caption, так и для text fallback, для news/announcement/calendar.
  «Источник: » остаётся обычным текстом; целиком кликабельны имя источника
  и `Литературная повестка «Пробы пера»`. Summary/title, source URL и ссылка
  `https://probpera.ru/#literary-news` сохранены. Entity offsets учитывают
  UTF-16, включая emoji, по
  [официальному Bot API](https://core.telegram.org/bots/api#messageentity).
  VK payload и semantic text revision не изменены.
- Новая format revision обновляет старый prepared text по прежнему remote ID,
  без создания второго поста. Уже подтверждённое фото при смене формата
  пропускает edit только при совпадении полного payload/media и проверяемого
  acknowledgement с desired/prepared revision. Actual receipt сохраняется;
  новый не придумывается. Изменённые caption/media и неполный receipt сохраняют
  correction path. При том же формате обновление verifiedAt/publication
  продолжается без отправки.
- Новые 26 cases проверяют целые ссылки, emoji, все три вида, оба профиля,
  credit fallback, mocked send/edit JSON, миграцию stored text и отсутствие
  лишнего photo edit/повторного поста. Реальные Telegram вызовы не выполнялись.
  Причина старой частичной ссылки не установлена: прежний photo formatter
  уже имел правильные границы в локальных fixtures. Пользователь сообщил,
  что исправил старый пост сам; этот пост не изменён нами. Native Telegram
  отображение и production template deployment: **NOT_RUN**.
- В четырёх существующих news suites обновлены только assertions нового
  footer-контракта и сохранение URL при перестановке entity keys; receipt,
  ambiguous/retry/delete, source-image и права guards не ослаблены.

### Confirmed article success без потери поздних правок, 7 октября

Продолжение начато с тех же branch/HEAD и подтверждённого fingerprint
`160c11ada147e1c3ba19c917a152526c3729c13df855eb46ff7d123cb91b95e9`.
Сохранённый source до этого шага: `.tmp/m02-article-success-baseline-source/manifest.json`.
Предыдущий checkpoint и manifest: `.tmp/m02-checkpoint-before-article-success.md`,
`.tmp/m02-code-fingerprint-before-article-success.json`. Новый общий аудит не выполнялся.

- ArticleEditor передаёт `article_result_mode=receipt`. Его обычное сохранение,
  предпросмотр, working draft и promotion получают action DTO из существующего
  RPC результата. Callers без этого поля сохраняют прежние native redirects.
- Проверяются UUID, ровно одна RPC строка, обязательные nullable поля, timestamps,
  целая безопасная версия и соответствие submitted ID/CAS. При повреждённой
  квитанции исход остаётся unknown, identity не меняется и blind retry закрыт.
  Сравнение CAS сохраняет дробную точность PostgreSQL и не меняет переданные bytes.
- Canonical receipt продвигает собственные RU/EN CAS; null EN при mode=none
  сохраняет исходный EN CAS. Working draft продвигает только его version,
  сохраняя canonical RU/EN base; draft updated_at не становится RU CAS.
  Новая статья и копия получают настоящий возвращённый ID для следующего submit.
- Отправленная A и текущая B различаются лишь для dirty-state. Это сравнение
  не доказывает commit и не разрешает очистку. RU/EN, источники, медиа и ручные
  поля B не заменяются ответом. Форма остаётся открытой даже без новых правок;
  сохранённый edit/preview доступен явной ссылкой в новой вкладке.
- Последняя локальная копия сохраняется под подтверждённым ID. Ошибка Storage
  показывает отдельный статус и не отменяет подтверждённую запись или ввод B.
  Автоочистка local/server recovery не добавлена; явный discard сохранён.
- Состояние public build отдельно от записи. Ошибка запроса выпуска после
  успешного RPC не превращает сохранение в известный отказ. Revalidation через
  `after` подтверждает только регистрацию (`scheduled`), не успех callback/кеша.
  Настоящий cache aftermath в полном приложении этим шагом не принят.

Локальное воспроизведение использует одинаковые fixtures:

| Проверка | Baseline | Current | Evidence |
|---|---|---|---|
| Actual saved action/parser, новые 50 receipt cases | 40 FAIL / 10 PASS; 110 прежних SKIP | 160 action cases PASS; с RPC helper suites 204 PASS | `.tmp/m02-article-success-action-{baseline,current}.log` |
| Actual ArticleEditor в native Next 16.3.3, десять сценариев | 10 FAIL / 0 PASS, exit 1 | 10/10 PASS, exit 0 | `.tmp/m02-native-article-success-{baseline,current}-evidence.json` |
| Existing Article browser | сохранённый recovery baseline выше | 61/61 PASS, exit 0 | `.tmp/m02-article-form-article-success-existing-final-evidence.json` |
| Existing Page browser, совместимость | прежний baseline выше | 39/39 PASS, exit 0 | `.tmp/m02-page-form-article-success-page-applicability-evidence.json` |

Native10 реально использует ArticleEditor/Loader, TipTap, React form, Chrome,
Next Server Action serialization, cookies/Flight и redirect прежнего caller.
Auth/DB/RLS/RPC и canonical action persistence заменены задержанной синтетической
file-backed Server Action. Autosave/template/link actions изолированы mocks.
Synthetic action удерживает ответ до введения B; destination route заранее
прогрета, затем ответ освобождается перед очередной локальной автокопией.
Debounce 900ms не подменяется; это контролируемый порядок событий,
не доказательство частоты гонки в production. Внешних запросов нет.
Проверены save/preview с B и без B, отказ Storage, новые статьи и копии с
повторным submit, published working draft, mismatched receipt после synthetic
commit и отдельные publication/cache unknown. Оба финальных runs имеют
одинаковые runner/fixture SHA; отдельно сверены загруженные исходники.
Actual action unit suite отдельно использует реальные action/helpers и
замокированные Supabase/Auth/Next/public-build/after boundaries.
Это два согласованных локальных proof, а не единый Auth/DB/app E2E.

Сохранность: `.tmp/m02-article-success-preservation-proof.json` подтверждает
102 неизменённых файла прежнего manifest, включая Telegram; imports/calls
нормализаторов, RU/EN payload, RPC args/calls и recovery/template expressions
идентичны сохранённому source. SQL, права, источники, авторский контент,
правила/тесты нормализаторов и независимые Telegram-изменения не редактировались.
Два устаревших source assertions обновлены по смыслу: hidden context допускает
только собственный validated receipt; RPC identity проверяется strict schema.
Первый общий прогон 3405 PASS / 2 FAIL сохранён в
`.tmp/m02-article-success-combined-first.log`; он не объявляется PASS.
Первый typecheck FAIL TS2322 сохранён; исправлен typed validated receipt.
Первый text gate обнаружил один ранее записанный длинный знак в этом checkpoint;
исправлена только эта фраза, правила и нормализаторы не менялись.

### Доказательства предыдущего confirmed article success шага

Environment: Windows, Node `v24.20.0`, Vitest `4.1.10`, timezone Europe/Moscow.
Финальный набор: **3407/3407 PASS, 123 test files, 0 skipped**, exit 0.
Прежние наборы 3162/122 и 2942/121 сохранены как историческое evidence.
Результат относится к тому же HEAD и предыдущему fingerprint
`296a5eeb3d1268c8e8692ee04cff4a6456135964d81ac5883dbd3a96375a9ecd`.
Точная последовательность путей сохранена в `.tmp/m02-selected-tests.txt`;
повтор команды в PowerShell:

```powershell
$taskTests = @(Get-Content -LiteralPath '.tmp/m02-selected-tests.txt' | Where-Object { $_ })
& node node_modules/vitest/vitest.mjs run @taskTests --maxWorkers 4
```

| test_id | status | level | command | exit_code | checked_at | evidence_path |
|---|---|---|---|---|---|---|
| M02-T01 | PASS, проверенные loaders | unit+component, изолированный SSR | общий `vitest run @taskTests --maxWorkers 4`, count отказы | 0 | 2026-10-07 07:08:19 MSK | `.tmp/m02-article-success-combined-final.log` |
| M02-T02 | PASS, проверенные loaders | unit+component, изолированный SSR | та же команда, подтверждённые нули | 0 | 2026-10-07 07:08:19 MSK | `.tmp/m02-article-success-combined-final.log` |
| M02-T06 | PASS, проверенные loaders | unit, 59 cases helper + классификация в SSR | та же команда | 0 | 2026-10-07 07:08:19 MSK | `.tmp/m02-article-success-combined-final.log` |
| Загрузчики, R2 guards, receipts и footer | PASS, ограниченный шаг | isolated SSR+static+mock transport, не весь M02 | та же команда, 3407/3407 | 0 | 2026-10-07 07:08:19 MSK | `.tmp/m02-article-success-combined-final.log` |
| Admin TypeScript | PASS | static, оба admin-конфига | `npm.cmd run typecheck --workspace @probpera/admin` | 0 | 2026-10-07 07:03:36 MSK | `.tmp/m02-article-success-typecheck-final.log` |
| Существующий text gate | PASS | read-only, правила не изменены | `npm.cmd run text:hyphens:check` | 0 | 2026-10-07 07:10:56 MSK | `.tmp/m02-article-success-text-gate-final.log` |
| Next.js webpack build | PASS, локальный build | compile+Next TypeScript+route build | `node ../../node_modules/next/dist/bin/next build --webpack`, cwd apps/admin | 0 | 2026-10-07 07:04:48 MSK | `.tmp/m02-article-success-next-build-final.log` |
| Client secret boundary | PASS | существующий scanner собранных static assets, без вывода secret values | `node .tmp/m02-check-built-client.mjs` | 0 | 2026-10-07 | `.tmp/m02-article-success-client-secrets.log` |

Сборка выполнена напрямую с существующими catalog-assets, без экспортирующих
prebuild scripts. Это не deploy и не авторизованный runtime postflight.
Next сообщает deprecation warnings для middleware/Edge Runtime; сборка exit 0.

Предыдущий Article шаг добавил 109 action/parser fixtures и расширил
article-recovery до 11 случаев. В общий набор включены связанные прежние R2
article RPC/working-draft/facade и editor guards. Текущий шаг расширяет edit/new SSR
с 94 до 133 cases, actual action suite до 110 (выбранная рубрика data:null). Последний Article browser29 проверен 2026-09-30 18:51:18 MSK;
старый browser21 и его baseline сохраняются как историческое доказательство.

Срез страниц добавил 81 actual page-action/parser cases, 19 recovery/autosave/storage/SQL
guard cases и три client-factory SSR cases. Page SSR теперь 128; прежние 125
assertions сохранены по смыслу с новым props boundary.

Новые suites в этом наборе: counts 19 unit + 35 dashboard SSR;
read-result 59 unit; articles edit/new 94 SSR, list 50, preview 48;
health 58, settings 44, translations 83, data-studio 77 SSR.
Продолжение добавляет library 115, dossiers 62, analytics/export 64,
publication 95 SSR/GET cases и Telegram footer 26 cases.
Добавлены media 130, history 110, SEO 98, editorial database 135, menus 66,
site-copy 67, pages 125, categories/comments 99, banners/homepage 164,
Site Studio 196, news runtime overview 18 SSR и 10 actual-schema cases.
Прежние 61 cases прямых R2 guards сохранены; добавлены связанные регрессии library/analytics/
publication/news. Изменения старых news assertions описаны отдельно выше.
Проверяются реальные страницы, helpers, working-draft parser/overlay и SSR HTML.
Повреждённые DTO, data+error, отклонённые transport promises, реальные пустые
ответы/нули, безопасные сообщения, UUID/locale identity и fresh GET-retry покрыты.

Mocked dependencies: Supabase client/query/RPC read boundary; auth/session,
каталог и provider-readiness boundary там, где требуются изоляцией suite;
Next.js Link/dynamic/navigation/fonts/CSS и серверные actions/submit controls.
Library suite рендерит реальный LiteraryWorkWorkspace; dossiers проверяет
границу props mocked BookDossierEditor с настоящим validator/workflow DTO.
News media синтетическая; fetch/transport изолированы mocks. Их mode=live
проверяет локальный транспорт с vi.fn fetch, а не делает сетевой вызов.
Synthetic rights/design proof не является Canvas/production evidence.
SSR asserts проверяют отсутствие action/публикационных вызовов при GET.
Дополнительно проверены реальные SiteCopyEditor и news projection/overview;
PageEditorLoader, TokenStudio, TypographyWorkspace и visual preview остаются
props-boundary mocks. Actual TipTap schema тестируется без DOM; browser views
заменены sentinels, вызовы нормализаторов в schema harness запрещены.
Этот SSR/transport набор не проверяет настоящую DB/RLS, живые roles или providers.
Отдельный browser/native scope и его ограничения зафиксированы ниже.

Браузерный итог: **39/39 PASS**, exit 0, 2026-09-30 17:34:19 MSK.
Команда: `node apps/admin/tests/browser/page-form-browser.mjs --label=final --source-root=current`.
Evidence: `.tmp/m02-page-form-final.log`, `.tmp/m02-page-form-final-evidence.json`.
Настоящие PageEditor, PageEditorLoader, RecoveryController, TipTap, Chrome и
Next compiled React/ReactDOM; actions, routing, media busy flag и network
замокированы/изолированы явно. Проверены длинный ввод, доступность повторной
отправки после известного отказа (сам второй action в этих fixtures не вызван),
unknown/conflict, точный CAS, double-submit, более новые правки/controls,
published status, native signals, Storage faults, autosave sequence, recovery
и временная недоступность чтения. Внешних запросов нет.

Отдельно выполнен local native Next 16.3.3 fixture с настоящими action/Flight,
next/dynamic и cookie machinery. Пять контрольных режимов воспроизвели потери
при inline invalidation и cookie write; after без cookie сохраняет B.
Пять сценариев с actual PageEditorLoader подтвердили удержание B при cookie+
failed reread, блокировку save, успешный refresh и отсутствие cross-ID/initial
fallback. Дочерний editor, receipt и filesystem persistence синтетические;
реальные PageEditor+actions+Auth+DB одним app E2E не проверены. Cache eviction
в dev fixture не доказан: контроль без invalidation тоже читал новую generation.
Рецепт: `.tmp/m02-native-page-save-readme.md`; evidence:
`.tmp/m02-native-page-save-evidence.json`,
`.tmp/m02-native-page-save-boundary-evidence.json`. Собственный сервер остановлен.

Browser global fingerprint при запуске: f9fc4af50a4952011587f452a47de8c8790b06096d2bf895e98e2912db6c16cf.
После него изменён только operator-data-error source test. Все browser source
SHA, actual native wrapper и action proof сверены с финальным деревом:
`.tmp/m02-final-evidence-applicability.json`. Это проверка применимости доказательств,
не новый выдуманный browser run. Это исторический глобальный fingerprint
среза страниц: e5fcd86cc79befb8bfdede4f74fb20e28c7567a14abf1a126b18c8bc95721938.
Историческая сверка того шага: Page39 + Article29 + native Page/Article wrappers
и 104 файла, `.tmp/m02-article-read-final-evidence-applicability.json`. Текущие
Article61/Page39 и 106 файлов проверены отдельно в recovery applicability выше;
suite/types/text/build/client scanner этого среза относятся к предыдущему
confirmed-success fingerprint 296a5eeb, не к новому operation-contract срезу.

Baseline evidence сохранено отдельно от финального fingerprint:

| Шаг до исправления | Фактический baseline | evidence_path |
|---|---|---|
| Dashboard | 46 FAIL / 5 PASS из 51; ещё 3 retry cases добавлены после правки | `.tmp/m02-dashboard-baseline.log` |
| Article edit/new | 30 FAIL / 4 PASS из 34 | `.tmp/m02-article-load-baseline.log` |
| Article DTO follow-up | 43 FAIL / 34 PASS из 77 | `.tmp/m02-article-shape-baseline.log` |
| Article list | 46 FAIL / 4 PASS из 50 | `.tmp/m02-article-list-baseline.log` |
| Preview | 30 FAIL / 13 PASS из 43 | `.tmp/m02-preview-baseline.log` |
| Preview EN identity follow-up | 4 FAIL / 44 SKIP, targeted cases | `.tmp/m02-preview-identity-baseline.log` |
| Health | 47 FAIL / 4 PASS из 51; позднее добавлены 7 cases | `.tmp/m02-health-baseline.log` |
| Health incomplete current-schema follow-up | 2 FAIL / 56 SKIP, targeted cases | `.tmp/m02-health-capabilities-baseline.log` |
| Settings/team | 29 FAIL / 14 PASS из 43 | `.tmp/m02-settings-baseline.log` |
| Settings UUID follow-up | 1 FAIL / 43 SKIP, targeted case | `.tmp/m02-settings-uuid-baseline.log` |
| Translations | 66 FAIL / 10 PASS на одинаковых 76 fixtures | `.tmp/m02-translations-baseline.log` |
| Translations compatibility follow-up | 5 FAIL / 2 PASS / 76 SKIP, 7 targeted cases | `.tmp/m02-translations-compat-baseline.log` |
| Data Studio | 70 FAIL / 7 PASS на одинаковых финальных 77 fixtures | `.tmp/m02-data-studio-baseline-final-fixtures.log` |
| Library, HEAD loader и финальные fixtures | 101 FAIL / 14 PASS из 115 | `.tmp/m02-library-baseline.log`, `.tmp/m02-library-baseline-evidence.json` |
| Dossiers, HEAD loader и финальные fixtures | 50 FAIL / 12 PASS из 62 | `.tmp/m02-dossiers-baseline-final-fixtures.log` |
| Analytics/export, HEAD source и финальные fixtures | 61 FAIL / 3 PASS из 64, отдельный temporary harness | `.tmp/m02-analytics-confirmed-baseline.log` |
| Publication, HEAD loader и финальные fixtures | 75 FAIL / 20 PASS из 95 | `.tmp/m02-publication-baseline-final-fixtures.log` |
| Telegram footer, HEAD source | 12 FAIL / 6 PASS из первых 18 финальных fixtures; последующие 8 описаны ниже | `.tmp/telegram-footer-baseline-final-fixtures.log` |
| Telegram photo no-op follow-up, до guard | 3 FAIL / 22 PASS из 25 | `.tmp/telegram-footer-photo-noop-baseline.log` |
| Telegram same-format metadata follow-up, до ограничения guard | 1 FAIL / 25 SKIP, targeted case | `.tmp/telegram-footer-metadata-renewal-baseline.log` |
| Media, HEAD loader и финальные 130 fixtures | 119 FAIL / 11 PASS | `.tmp/m02-media-baseline-final-fixtures.log` |
| History, HEAD loader и финальные 110 fixtures | 91 FAIL / 19 PASS | `.tmp/m02-history-confirmed-baseline-final-fixtures.log` |
| SEO, HEAD loader и финальные 98 fixtures | 86 FAIL / 12 PASS | `.tmp/m02-seo-baseline.log` |
| Editorial database, HEAD loader и финальные 135 fixtures | 111 FAIL / 24 PASS | `.tmp/m02-editorial-confirmed-baseline-final-fixtures.log` |
| Menus, HEAD loader и финальные 66 fixtures | 59 FAIL / 7 PASS | `.tmp/m02-menus-baseline-final-fixtures.log` |
| Site-copy, HEAD loader и финальные 67 fixtures | 55 FAIL / 12 PASS | `.tmp/m02-site-copy-baseline-final-fixtures.log` |
| Pages, HEAD loaders и финальные 125 fixtures | 111 FAIL / 14 PASS | `.tmp/m02-root-baseline-final-fixtures.log`, `.tmp/m02-pages-baseline-evidence.json` |
| Categories/comments, HEAD loaders и финальные 99 fixtures | 86 FAIL / 13 PASS | `.tmp/m02-root-baseline-final-fixtures.log`, `.tmp/m02-taxonomy-comments-baseline-evidence.json` |
| Banners/homepage, HEAD loaders и финальные 164 fixtures | 148 FAIL / 16 PASS | `.tmp/m02-visual-baseline-final-fixtures.log` |
| Site Studio, HEAD loaders и финальные 196 fixtures | 161 FAIL / 35 PASS | `.tmp/m02-studio-baseline-final-fixtures.log` |
| News overview, HEAD component и финальные 18 fixtures | 13 FAIL / 5 PASS | `.tmp/m02-news-overview-baseline-final-fixtures.log` |
| Pure schema boundary, три HEAD schema modules и 10 финальных fixtures | 9 FAIL / 1 PASS; новый client wrapper текущий, это не whole-HEAD baseline | `.tmp/m02-rich-editor-schema-parity-head-schema.log` |
| Page save action, сохранённый неизменённый action и финальные 81 fixtures | 50 FAIL / 31 PASS | `.tmp/m02-page-save-after-baseline-final-fixtures.log` |
| Page form, сохранённые исходники и финальные 39 browser fixtures | 33 FAIL / 6 PASS; legacy caller composition для старого loader API явно указана | `.tmp/m02-page-form-final39-baseline.log`, `.tmp/m02-page-form-final39-baseline-evidence.json` |
| Pages, HEAD loaders и новые 128 fixtures с текущими transitive helpers | 112 FAIL / 16 PASS, не whole-HEAD baseline | `.tmp/m02-pages-128-baseline.log` |
| React form reset до onReset guard | publish status DOM был draft, harmless rerender возвращал published; узкий candidate 2/2 PASS | `.tmp/m02-page-form-publish-reset-probe-evidence.json`, `.tmp/m02-page-form-reset-candidate-evidence.json` |
| Article actions, две сохранённые action source и финальные 109 fixtures | 69 FAIL / 40 PASS; parser и transitive helpers текущие, не whole-HEAD | `.tmp/m02-article-save-baseline-final-fixtures.log`; итог с 39 прежними guards 148 PASS: `.tmp/m02-article-save-final.log` |
| Article form, записанные исходники и одинаковые финальные 21 browser fixtures | 18 FAIL / 3 PASS; итог 21/21 PASS | `.tmp/m02-article-form-final-baseline.log`, `.tmp/m02-article-form-final-baseline-evidence.json`, `.tmp/m02-article-form-final.log` |
| Article recovery locator, прежний helper и одинаковые финальные 11 fixtures | 1 FAIL / 10 PASS; итог 11/11 PASS | `.tmp/m02-article-recovery-baseline-final-fixtures.log`, `.tmp/m02-article-recovery-final.log` |
| Article recovery snapshots, source последнего checkpoint и одинаковые 32 browser fixtures | 25 FAIL / 7 PASS; current recovery 32/32 PASS плюс прежние 29, total 61/61 | `.tmp/m02-article-form-recovery-{baseline,final}-evidence.json`, `.tmp/m02-article-recovery-browser-comparison.json` |
| Article confirmed success, saved action/helpers и одинаковые 50 fixtures | 40 FAIL / 10 PASS; current 50 PASS плюс 110 прежних, total 160 action cases | `.tmp/m02-article-success-action-{baseline,current}.log` |
| Article confirmed success, actual form и одинаковые native Next10 fixtures | 10 FAIL / 0 PASS; current 10/10 PASS | `.tmp/m02-native-article-success-{baseline,current}-evidence.json` |

Предыдущий успешный набор 1189/49 и fingerprint 40 файлов сохранены как
исторические evidence в `.tmp/*-before-media.*`. Первый общий прогон нового
набора дал 2630 PASS / 2 FAIL, text gate также FAIL на трёх новых fixtures;
логи сохранены в `.tmp/*-first-all-loaders.*`, они не объявляются PASS.
Исправлены root import form для прежнего R2 guard и confirmed-empty text.
В новых тестовых строках применены Unicode escapes с теми же runtime bytes;
правила/исключения text gate и авторские данные не менялись. Дополнительные
peer findings Studio включены в финальные 196 fixtures и общий прогон.
Первый Next build не прошёл из-за импорта browser node views на сервере;
после разделения схемы итоговая сборка и client scanner прошли.

Предыдущий успешный шаг 2651/105 и fingerprint 81 файла сохранён в
`.tmp/*-before-page-form.*`. Первый новый общий прогон: 2752 PASS / 2 FAIL
(устаревший source assertion и 5s timeout при неограниченных workers);
`.tmp/m02-combined-page-form-first.log`. Source assertion семантически обновлён,
повтор использует прежние --maxWorkers 4, без увеличения timeout или skip.

Предыдущий успешный page шаг 2754/110 и fingerprint 93 файлов сохранён в
`.tmp/*-before-article-form.*`. Первые Article action/read и browser candidate
прогоны сохранены отдельно; FAIL/неисполненные harness assertions не являются
PASS. Финальная исправленная fixture проверена на прежнем и текущем source.

SKIP в targeted baseline не является PASS. Итоговый общий прогон не имеет SKIP.
Read-only review и `git diff --check` выполнены отдельно от runtime checks.
Они не заменяют DB, браузерный E2E или production acceptance.
Итоговый fingerprint повторно рассчитан после тестов, изменений кода нет.

### Предыдущий шаг: actual action/native Next и article operation foundation, 7 октября

Центральная цель активна: завершить M00..M25, 26 модулей, 230 критериев
приёмки. Этот шаг закрывает только перечисленные локальные проверки M02.
Весь M02, остальные модули и production не объявлены завершёнными.

Добавлены три пары runtime/test: `article-operation-intent`,
`article-operation-result`, `article-operation-rpc`. Исходный intent сохраняет
RU/EN и ручные поля без нормализации; строгий DTO связывает operationId, исходный
ID/CAS, preview/save/publish и версию рабочего черновика. Receipt принимает
только собственный validated результат. Replay не означает подтверждённый
public build или cache aftermath: эти статусы остаются `unknown`.
RPC boundary не повторяет запись и не откатывается к прежнему RPC при ошибке.
Противоречивый non-null/missing data вместе с error не становится известным
отказом даже при permission/capability коде. Пять новых fixtures воспроизвели
ошибочную классификацию до guard и прошли после исправления на тех же данных.

Новая аддитивная миграция `20261007_admin_editor_operations.sql` добавляет
три operation wrappers над неизменёнными article producers и
`get_editor_operation_result`. Canonical save/promotion остаются SECURITY
INVOKER; working draft использует прежний guarded SECURITY DEFINER producer.
CAS/RBAC, старые producer signatures/args и
вызовы нормализаторов не менялись. Receipt записывается в той же транзакции;
повтор того же operationId/actor/intent возвращает исходную квитанцию до нового
CAS/изменения. Actor, original intent и подготовленные RPC args привязаны
раздельными hashes. Hash не является доказательством commit на стороне формы.
Private ledger хранит ограниченный receipt/context, без текста статьи;
прямой API DML закрыт. Ограниченный NOLOGIN/NOBYPASSRLS writer имеет только
нужные права и ноль входящих role memberships. Current access перепроверяется.

| Проверка | Фактический результат | Evidence |
|---|---|---|
| Финальный объединённый набор | **3542/3542 PASS, 127 test files, 0 skipped/todo**, exit 0 | `.tmp/m02-editor-operations-combined-final.json`, `.log`; список `.tmp/m02-editor-operation-final-tests.txt` |
| Новые intent/result/RPC suites | 55 + 36 + 35 = 126 PASS; DB migration source suite ещё 8 PASS | включены в финальный общий набор |
| Оба admin TypeScript-конфига | PASS, exit 0 | `.tmp/m02-editor-operations-typecheck-final.log` |
| Actual canonical action/native Next 16.3.3 | 7/7 PASS; 69 загруженных actual source SHA совпадают | `.tmp/m02-native-article-actual-action-current-evidence.json`, `.tmp/m02-native-article-actual-action-preservation-proof.json` |
| Прежний R2 publication permissions contract на PostgreSQL 17.11 | PASS без SKIP; прежние два отказа воспроизведены, исправление проверено | `.tmp/m02-postgres-tools/native-cases/publication-r2-20261007043920531-16432-c69c42ea/result.json` |
| Новый operation SQL contract на fresh PostgreSQL 17.11 | два отдельных кластера PASS; 17 контрольных marker groups в каждом | `.tmp/m02-postgres-tools/native-cases/editor-operations-ninth-20261007050048206-19796-9a6413a5/result.json`, `.tmp/m02-postgres-tools/native-cases/editor-operations-20261007050252784-14260-7a3b4962/result.json` |
| Реальные SQL receipts через actual TypeScript parser | 10/10 PASS, все три persistence режима | `.tmp/m02-editor-operation-dto-proof.json`; предыдущий cluster proof `.tmp/m02-editor-operation-dto-proof-first.json` |
| Существующий text gate и diff check | PASS, exit 0 | `.tmp/m02-editor-operations-text-gate-final.log`, `.tmp/m02-editor-operations-diff-check-final.log` |

Финальный общий прогон начат в 08:09:19 MSK. Новые helpers и SQL не подключены
к canonical action/ArticleEditor: открытая форма пока использует прежние RPC
и запрещает blind retry при unknown. Build/client scanner прежнего среза
сохранены как исторические; новый полный build в этом шаге не выполнялся.
Final verification связывает текущий fingerprint, raw SHA и перечисленные
результаты: `.tmp/m02-editor-operation-final-verification.json`.

Native7 использует настоящие facade, publication adapter, save action,
atomic pipeline, RPC validators, ArticleEditor/Loader/TipTap и native
cookies/Flight/after/revalidatePath. Проверены поздний ввод B, save/preview,
повторное сохранение new/copy, published working draft, отдельный sibling
after failure и потеря POST ответа после traced synthetic commit.
Auth/query/RPC persistence, provider/public-build и autosave/template/link
boundaries замокированы. Sibling callback failure не доказывает сбой самого
canonical cache backend. Сохранение RU/EN JSON точное; HTML DOM/media/rights
сохранены, порядок атрибутов/void serialization не объявлен byte-identical.
Собственный сервер остановлен; внешних provider/publication вызовов нет.

Оба SQL прогона используют один SQL SHA
`b46abfe3ad5fbffe53472a3f5184c0743953b6951aa247203be7ef6cc4d0b222`.
На одинаковом seed/payload fixture сначала подтверждены старые stale-CAS
при retry и дубликат при retry новой статьи. После сброса fixture новый
operation replay возвращает тот же receipt, изменения происходят один раз.
Проверены new/copy, working draft/promotion, mode none с сохранением существующего
EN, invalid intents, чужой actor, текущие права, поздний receipt failure с
полным rollback и 13 вариантов повреждённого installed state.
17 markers не выдаются за отдельный подсчёт всех SQL assertions.
Actual PostgreSQL transactions/ACL/RLS работают; auth.users/auth.uid/is_staff
и revision/outbox capture triggers синтетические. Настоящие Supabase Auth,
GoTrue, PostgREST HTTP, production DB и доставка не проверены.
SQL source SHA: `418b54b3ef4e3d2c3eb326498f9a31fa4b3baae5c2a66a22d85417eba0a585c5`.

Portable engine получен из официального EDB ZIP; SHA архива
`80379b2c04d51c30225532e0ae04509899141e9957ed096fe749d7fd9df8f82f`.
Использованы только bin/lib/share в `.tmp`, fresh cluster на loopback,
проверенный временный ASCII alias P: и скрытые процессы. Все собственные
серверы остановлены, alias снят, результаты и логи сохранены. Системные
services/PATH, production и чужие процессы не изменены.

Первое применение миграции намеренно требует настоящего superuser и
проверяется в той же атомарной DO-транзакции; второй apply только сверяет
точное installed state и не расширяет права. Non-superuser initial apply
отказывается до DDL; non-superuser repeat после isolated privileged bootstrap
прошёл. Managed initial bootstrap остаётся BLOCKED. Новая миграция не включена
в production allowlist: существующий planner с 39 reviewed migrations не
изменён. Её нельзя считать готовой к применению в настоящем проекте.

Автоматическая проверка отклонила пробный source patch, сохраняющий ADMIN
membership migration executor над private writer: это постоянное расширение
прав без отдельной авторизации. Patch не применён; отказ не обходился.
Выбран вариант без сохраняемого membership: privileged initial bootstrap,
полное снятие временного grant и verify-only repeat. В native PostgreSQL также
подтверждено, что non-superuser creator не может отозвать неявный ADMIN grant
от bootstrap grantor. Production privileges не менялись.

Промежуточные FAIL/неисполненные SQL probes и первые harness attempts сохранены
в `.tmp/m02-postgres-tools/native-cases/`, не считаются PASS. Первый text gate
обнаружил длинный знак только в новом SQL fixture; запись заменена на Unicode
SQL escape с тем же runtime символом. Нормализаторы, их вызовы, правила,
исключения и тесты не менялись. Независимые Telegram-файлы сохранены.

| Оставшийся критерий M02 | status | Фактически проверено и оставшееся ограничение |
|---|---|---|
| M02-T03 | BLOCKED, E2E-зависимость | SSR133, Article61 и native Article wrapper9 удерживают форму в изолированных сценариях; полный авторизованный app E2E не проверен |
| M02-T04 | BLOCKED полностью, DB+E2E-зависимость | SSR закрывает недочитанный EN bundle; новый SQL fixture сохраняет существующий EN при mode none. Сквозной read failure/action/Auth/DB/E2E не проверен |
| M02-T05 | NOT_ACCEPTED полностью; local media-read slice VERIFIED | categories и зависимые bundles проверены в SSR; actual ArticleEditor/MediaDialog HTTP503/fetch rejection сохраняют RU/EN и связи, 2 cases/198 checks; guarded working-draft payload проверен с synthetic SDK; реальное сохранение связей через managed DB/RLS не проверено |
| M02-T07 | BLOCKED полностью; локальные page/article slices PASS | Page39, Article61, native success10 и actual canonical-action native7 (receipt, B, собственные CAS/ID, потеря ответа) выполнены с указанными mocks; полный авторизованный app E2E не принят |
| M02-T08 | NOT_RUN полностью | secret/error redaction, selected identity/permission states, static guards и новый SQL receipt actor/current-access/RLS boundary проверены в fixtures; все loader/RLS/privacy surfaces не приняты |
| M02-T09, M02-T10 | IN_PROGRESS; article operation UI/action/SQL slices PASS локально | Frozen operationId/intent, replay lookup до CAS и explicit check подключены. Native9 использует synthetic ledger, PostgreSQL20/DTO14 проверены отдельно. Reload pending operation и page contract не реализованы/не приняты; pending EN partial-write loss воспроизведён и не исправлен. Recovery marker не является receipt |

Теперь создан portable PostgreSQL 17.11 в `.tmp/m02-postgres-tools`, только
для fresh isolated fixtures на loopback. Auth/claims и capture triggers
синтетические; PostgreSQL transactions, role flags, ACL и RLS выполняются
на настоящем engine. Собственные серверы остановлены, временный alias снят;
системные services, PATH и production не изменены. Авторизованный admin E2E
не настроен. Playwright config публичного Vite не выдаётся за admin E2E.
Новые реальные engine evidence описаны ниже и не являются Supabase/GoTrue PASS.

### Предыдущий проверенный шаг: article operation wiring и точная граница EN, 7 октября

Шаг продолжен с fingerprint cefe05c4 и существующего diff, без общего аудита.
Форма присваивает accepted submit новый UUID и сохраняет frozen FormData A,
исходные ID/CAS/version отдельно от позднего ввода B. Unknown result удерживает
эту операцию и блокирует новую запись. Явная проверка читает только receipt A;
not-found или transport failure остаётся unknown и не разрешает blind retry.
Save facade выполняет lookup до canonical CAS/provider и повторно читает receipt
после неоднозначного результата. Replay не выполняет producer, audit/revision,
public build или cache aftermath повторно; этих последних фактических состояний
receipt не доказывает. Legacy submit без operationId сохраняет прежний путь.

Прямой result связывается с собственным operationId. Новые helpers вызывают
operation RPC с прежними prepared args; original intent захватывается после
существующего publication adapter, до нормализаторов и изменения EN ownership.
Два прежних normalizer вызова/аргумента сохранены дословно. Provider error log
редактируется до статического разрешённого кода без текста и токенов.

EN receipt сообщает фактическую область saved/preserved/status-only. SQL ledger
сохраняет эту метку из actual producer mode; raw legacy result keys не меняются.
Missing marker остаётся unknown. Только full EN ACK подтверждает введённый EN A.
Canonical EN baseline не берётся из copy или working draft и не обновляется
full working-draft ACK. Последний может подтвердить A именно как private draft.
Неизвестный canonical baseline сохраняет ручной EN dirty; доказанно отсутствующий
EN обычной начальной формы допускает clean RU-only save с пустым EN.
При этой доказанной начальной пустоте сравнение исключает только автоматически
изменённый EN canonical URL с canonicalEdited=false. Ручной URL, собственный
canonical EN, copy и working draft сохраняют строгий comparator; full canonical
EN ACK снимает флаг начальной пустоты.
Подтверждение A сохраняет поздний B, manual rights/media/sources и собственные
high-precision CAS; не выполняет автоматический переход или discard recovery.

| Проверка текущего среза | Фактический результат | Evidence |
|---|---|---|
| Общий набор, bounded maxWorkers=2 | **3643/3643 PASS, 129 test files, 0 skipped/todo**, exit 0 | .tmp/m02-operation-wiring-combined-final.json/.log; selection .tmp/m02-operation-wiring-final-tests.txt |
| Новый actual facade / server chain | 40 + 35 PASS; тот же fixture до wiring: facade 39 FAIL/1 PASS, server 31 FAIL/4 PASS | .tmp/m02-operation-wiring-facade-baseline-final.json; .tmp/m02-operation-server-baseline-final.json; включены в общий набор |
| Client operation/provenance/empty EN | 17/17 PASS на final source; тот же fixture: foundation 2 PASS/15 FAIL, pre-provenance 11 PASS/6 FAIL, e24 и 13c по 15 PASS/2 FAIL | .tmp/m02-article-operation-browser-final-current-evidence.json; .tmp/m02-article-operation-final-five-way-comparison.json |
| Существующая ArticleEditor регрессия | 61/61 PASS на final source | .tmp/m02-article-form-operation-final-current-evidence.json |
| Actual native Next operation transport | 9/9 PASS, 130 assertions, 72 loaded source SHA совпадают | .tmp/m02-native-article-operation-before-pending-en-current-evidence.json; .tmp/m02-native-article-operation-before-pending-en-preservation-proof.json; .tmp/m02-native-article-operation-before-pending-en-metadata.json |
| Оба admin TypeScript-конфига, Next webpack build, client-secret scanner | PASS, exit 0; client scanner 0 findings | .tmp/m02-operation-wiring-typecheck-admin-final.log; typecheck-cloudflare-final.log; next-build-final.log; client-secrets-final.log |
| PostgreSQL 17.11 EN scope contract | 20 marker groups; новый SQL SHA 0f33cc1cdb2b2987a78f211890c925be8ccdeacd20f4603230825e97552f79e9; identical baseline FAIL ожидаемо воспроизвёл missing EN scope | .tmp/m02-operation-wiring-english-same-fixture-proof.json; native current/baseline result paths внутри |
| Реальные SQL DTO через actual TypeScript parser | 14/14 PASS, saved/preserved/status-only и working-draft modes | .tmp/m02-editor-operation-dto-proof-wiring.json |
| Read-only text gate, diff check, сохранность excluded paths | PASS; normalizer source/calls/rules/tests и 6 Telegram файлов сохранены | .tmp/m02-operation-wiring-text-gate-final.log; final-verification.json |

Native transport выполняет настоящие facade/canonical/atomic/validators/UI и
Next cookies/Flight/after/revalidatePath. Auth/query/RPC/CAS/operation ledger
синтетические файловые границы; providers и public build отключены.
Unknown after committed response loss, own receipt reconciliation, поздний B,
new/copy second save и abort before dispatch проверены на этом стенде.
Standalone client browsers используют synthetic deferred actions.
SQL engine действительно выполняет транзакции/ACL/RLS, но Auth/claims и
capture triggers синтетические. Эти независимые proofs не составляют
сквозной authenticated Supabase app E2E. Реальные Auth/DB/RLS и production
остаются NOT_VERIFIED/NOT_RUN. Собственные стенды остановлены, alias снят.

Сохранены предыдущие и failed runs: combined-first (137 auth harness failures
и source export assertion), combined-second (alias adapter test и 3 timeouts),
provenance-v1 successful run, wrong-cwd Cloudflare TS invocation и first text gate.
Auth mocks adapter согласованы с новыми imports, исходные 2 assertions усилены
проверкой отсутствия lookup на legacy path; timeouts проверены при bounded workers.
Только новый fixture literal записан Unicode escape с идентичным runtime текстом.
Эти FAIL/ошибочные invocation не объявлены PASS и не заменяют final evidence.
Промежуточные provenance/empty-EN source и evidence сохранены отдельно; source
SHA определяет, к какому candidate относится каждый результат.
Параллельный TypeScript probe попал в пересоздание Next .next/types и сохранён
как generated-types-race FAIL; финальные оба конфига выполнены после сборки.
Native 13c first attempt 7 PASS/2 FAIL захватил checking UI на фиксированном
300/400ms; unchanged warm runner дал 9 PASS. Финальный scratch runner заменяет
только эти ожидания на bounded semantic completion 20s; assertions и fixture
сохранены, .tmp/m02-native-article-operation-timing-proof.json подтверждает это.

На предыдущем fingerprint 5147aa дополнительно воспроизведён
**исторический UNFIXED_FAILURE** durable сохранности private EN; исправление
на текущем fingerprint проверено в следующем разделе.
На exact predecessor stack fresh PostgreSQL три actual RPC transitions:
full EN working draft A -> promotion none; -> promotion stale; -> disabled EN
working-draft overwrite. После commit A отсутствует в canonical и current draft.
Canonical E0 остаётся; stale меняет EN CAS/status без переноса A, disabled заменяет
draft envelope. Это не проверка отсутствия всех возможных local recovery backups.
Detection harness PASS означает успешное обнаружение дефекта, не PASS сохранности.
Evidence: .tmp/m02-operation-wiring-pending-en-loss-evidence.json, status
REPRODUCED_UNFIXED; fixture/build/proof с тем же prefix. Native result:
.tmp/m02-postgres-tools/native-cases/operation-wiring-pending-en-loss-v3-20261007060320430-27464-fe12d892/result.json.
SQL SHA 8bd5ee5f3bd0803b4175602d3ee6831074584c30b806f7db10d9f8070242aa40;
4 detection markers не считаются acceptance. Tracked источники не изменялись.

Managed initial bootstrap по-прежнему BLOCKED, новая миграция UNLISTED в
неизменённом production planner; privileges не расширены. No push/deploy,
production migration, paid provider или social send выполнялись. Весь M02,
полная программа M00..M25 и production не приняты; цель на центральной панели ACTIVE.

### Текущий шаг: сохранность private EN после частичного выпуска, 7 октября

Шаг продолжен с fingerprint 5147aa, без общего аудита и отката закрытого R2.
После успешного RU-only promotion none/stale точный прежний EN A остаётся
в существующей `article_working_drafts`, scope `english-only`; version возрастает,
RU base rebased на собственный commit, EN token соответствует actual final row.
Canonical EN не подменяется private A. Disabled private save сохраняет прежний
полный EN envelope и записывает выключенный checkbox отдельно, без стирания тела.
Прямые legacy producers и operation wrappers покрыты общей транзакционной защитой.

В уже существующий, ещё UNLISTED candidate `20261007_admin_editor_operations.sql`
добавлены scope/enabled metadata, ограничения и узкие triggers. Сохраняются
SECURITY INVOKER canonical bundle/promotion, FORCE RLS и отсутствие прямого
API DML. Старые migration sources не изменены. Недопустимый partial/null/malformed
EN отказывает до overwrite; полные старые envelopes с author/provenance extras
принимаются без пересборки. Scope/checkbox backfill сохраняет прежние bundle rows.
Полный bilingual release и explicit discard сохраняют прежний контракт.
Private продолжение scheduled/hidden/archived допустимо только для проверенной
существующей копии; canonical status и авторские данные сохраняются.

Operation receipt получает optional exact `workingDraft` descriptor с scope,
version, stamp, RU/EN tokens, saved/preserved и checkbox. Raw legacy result keys
не меняются. Stored metadata immutable при lookup/replay после позднего изменения
текущего draft; старые 9/10-key receipts принимаются без придуманного подтверждения.
None top-level EN result остаётся null: nested actual token служит продолжению
private copy и не доказывает EN write; stale подтверждает только status update.
Frozen context исходной операции не меняется.

Редактор отдельно хранит private и canonical EN baselines. Preserved A считается
clean только при совпадении с известным private A/checkbox; поздний B и изменённый
EN остаются dirty, принимаются собственные ID/CAS/version. Автоматический переход
и discard не выполняются. Edit/read/preview `english-only` overlay меняет только
private EN: RU/status/category/media/sources остаются canonical. В preview private
EN подписан, canonical EN передаётся отдельно. После discard читается canonical.
Первая RU-only запись new/copy не сохраняет неотправленный manual EN на сервер:
он остаётся dirty/local backup до отдельного полного private save после adopted ID.

| Проверка final private EN среза | Фактический результат | Evidence |
|---|---|---|
| Объединённый локальный набор, maxWorkers=2 | **3759/3759 PASS, 132 test files, 0 skipped/todo**, exit 0 | .tmp/m02-private-en-combined-final.json/.log; .tmp/m02-private-en-combined-command.json; selection .tmp/m02-private-en-final-tests.txt |
| Новый receipt/parser fixture | 56 PASS; identical baseline 29 FAIL/27 PASS; вместе с прежними parser tests 278 PASS | .tmp/m02-private-en-parser-fixture-proof.json; .tmp/m02-private-en-parser-baseline-final.json; .tmp/m02-private-en-receipt-tests-v3.json |
| Новый actual server chain fixture | 49 PASS; identical baseline 39 FAIL/10 PASS; вместе с прежними tests 141 PASS | .tmp/m02-private-en-server-proof.json; focused-final.json; baseline-final.json |
| Actual edit/preview route fixture | 8 PASS; identical baseline 6 FAIL/2 PASS; вместе с прежними tests 189 PASS | .tmp/m02-private-en-load-proof.json; focused-final.json; baseline-final.json |
| Actual ArticleEditor browser | Новый identical fixture: before 0/8, current 8/8, 59 assertions; прежние 17/17 и 61/61 PASS на final source | .tmp/m02-private-en-client-proof.json; .tmp/m02-private-en-client-readme.md; .tmp/m02-residual-client-browser-current-complete-evidence.json |
| Actual native Next regression | 9/9 PASS, 130 assertions, 72 loaded source SHA совпадают; runner/fixture сохранены | .tmp/m02-private-en-native-proof.json; .tmp/m02-private-en-native-current-evidence.json; .tmp/m02-private-en-native-preservation-proof.json |
| Isolated PostgreSQL 17.11 primary | 32/32 declared marker groups, 20 actual operation DTO, 3 author preservation outputs; identical before candidate FAIL на утрате A до новых column checks | .tmp/m02-pending-en-preservation-proof.json; current v7 / baseline native result paths внутри |
| Native PostgreSQL status/stale supplement | 41 markers = 32 main + 9 supplement; 48 actual DTO = 20 main + 28 supplement; 4 statuses × none/stale и 6 disabled private continuations, immutable replay PASS | .tmp/m02-pending-en-preservation-supplement-proof.json; .tmp/m02-pending-en-preservation-supplement-actual-dtos.json |
| Actual SQL results через actual TypeScript parsers | Primary 20/20, supplement combined 48/48 PASS; raw keys/context immutable, protected modes и original replay versions совпадают | .tmp/m02-private-en-dto-proof.json; .tmp/m02-private-en-supplement-dto-proof.json |
| Build и существующие gates | Next webpack build, оба admin TypeScript-конфига после build, catalogs, client secrets (0 findings), read-only text gate и diff check: PASS, exit 0 | .tmp/m02-private-en-next-build-final.log; .tmp/m02-private-en-typecheck-admin-complete.log; .tmp/m02-private-en-typecheck-cloudflare-complete.log; .tmp/m02-private-en-client-secrets-final.log; .tmp/m02-private-en-text-gate-final.log |
| Final source applicability | 133 SHA, ровно 10 прежних source files изменены в этом шаге; normalizer calls/rules/tests, historical SQL и 6 Telegram файлов сохранены | .tmp/m02-private-en-final-verification.json |

Primary SQL SHA `3031884374375d72cd62e2d0d9d74435514672da28b0fa9f604d158037313f47`;
supplement SHA `740da6c9129ba494fa79b0aac9b29b5af736c9471766cfbfbced97c26021f75f`.
Main raw fixture SHA `53a45a2f83f87ef6b72ae9b6ad6538923b6791078c7ccf0dab29f03170a152c2`
идентичен before/current; 3 original author seed definitions и 3 original wrapper
producer calls сохранены. Baseline assertion FAIL откатывает свой fixture statement;
committed loss отдельно доказан прежним сохранённым loss-proof выше.
Actual native assertions проверили none/stale/disabled,
полный release/discard, rollback, испорченный base/version, independent EN CAS/absence,
старые receipts, structural constraints, positive producer EXECUTE и fail-closed
проверку defaults/trigger bindings/ACL/body SHA при повторном apply.

Browser boundaries: synthetic deferred actions; route fixture исполняет настоящие
page functions, SELECT projection соблюдается mock query, loader boundary mock.
Browser reload использует проверенные synthetic props; actual route proof отдельный.
Native Next выполняет actual cookies/Flight/after/revalidate/UI/helpers/facade,
но Auth/query/RPC/ledger остаются synthetic file boundaries. PostgreSQL выполняет
настоящие transaction/ACL/RLS engine statements на isolated schema, с synthetic
claims/Auth/capture triggers. Эти proofs не являются authenticated app E2E.
Собственные browser/Next/PostgreSQL servers остановлены; native aliases сняты.
Настоящие Supabase Auth/DB/RLS app acceptance: NOT_VERIFIED; production: NOT_RUN.

Failed/нефинальные attempts сохранены и не объявлены PASS: первый parser invocation
с import failure, ранние client fixture selector/assertion ошибки, промежуточные
SQL v1+ до завершения constraint/trigger checks и прерванный native Next запуск
`.tmp/m02-private-en-native-interrupted.json`. Generated SQL string substitution
исправлена в ignored harness через callback; final v7 SHA и actual stdout сверены.
Промежуточный native run до final CAS parser сохранён отдельно и не заменяет final.

Candidate требует privileged initial local bootstrap; verify-only repeat apply
не является upgrade уже установленного прежнего candidate и не чинит grants.
Managed initial bootstrap остаётся BLOCKED. Candidate остаётся UNLISTED;
production planner не изменён. Push/deploy, production migration, paid provider
и social send не выполнялись. Весь M02 и M00..M25 не приняты; центральная цель ACTIVE.

### Original article operation через reload/new/copy: проверенный локальный шаг, 7 октября

Шаг продолжен с fingerprint 2339d1d6, прежних HEAD/branch и существующего diff.
Общий аудит и откат закрытого R2 не выполнялись. До source edits сохранены
точные bytes 11 исходных файлов; отдельный fresh-history дефект воспроизведён
на сохранённом промежуточном ArticleEditor, а не восстановлен по предположению.

- Аутентифицированные edit/new/copy loaders передают staff user ID. Cache и
  React key учитывают аккаунт; смена аккаунта не использует чужую форму.
  Actorless legacy fixtures сохраняют прежний mounted путь и не подтверждают Auth.
- До dispatch полный original A, raw author FormData, opId, исходные RU/EN CAS,
  working draft context и latest B записываются в sessionStorage с readback.
  Отказ этой записи не отправляет action. Постоянная local B получает только
  небольшую ссылку; дополнительные полные A остаются только в хранилище вкладки.
  Journal ограничен 20 MiB и прежним сроком recovery 30 дней; браузерная quota
  может отказать раньше. Memory fallback не считается durable success.
- Journal и ссылки привязаны к actor, origin key, draft scope, opId и точному
  context/expiry. Полные A/B и оба TipTap документа проверяются до setContent,
  смены формы или CAS. Повреждённые, просроченные и orphan записи сохраняются,
  новая запись блокируется; повтор чтения хранилища не выдаёт cached commit proof.
- После reload unknown остаётся unknown до read-only lookup исходного A/opId.
  Not-found, ошибка и чужая квитанция не разрешают новую операцию. Собственная
  квитанция меняет ID/CAS; поздний B остаётся в форме. New/copy после ACK и
  следующего save используют свой ID, даже при повторном reload старого URL.
- Для new/copy автоматическое продолжение связано с текущей записью истории.
  Новая копия того же исходника в другой history entry не наследует op/B/ID
  прежней копии. Старый latest-copy pointer продолжает предлагать текст явно.
- Autogenerated slug/canonical на первом render не принимаются за ручной C;
  реальные последующие правки сохраняются. При ошибке восстановления autosave
  и pagehide не затирают исходные B/locator freshly loaded canonical текстом.
  При отказе session mirror полный local B проверяется для того же op; время
  backup выбирает более свежий ввод, но не является доказательством DB revision.
  Неоднозначные copies остаются заблокированными.
- После известного prewrite отказа local копии без locator записываются и
  перечитываются до удаления session journal. При отказе cleanup original A/B
  сохраняется, ссылка не превращается в orphan. Full recovery и явный discard
  сохраняют совместимость; удаление content copy не очищает pending operation.
- Journal не хранит receipt или canonical/private EN provenance. Сохранность
  private EN, disabled body и частичного release перепроверена отдельным
  actor-bound browser fixture; фактический private EN reload этим fixture не выполнен.

| Проверка | Фактический результат | Evidence |
|---|---|---|
| Общий набор, maxWorkers=2 | **3902/3902 PASS, 134 files, 0 skipped/todo**, exit 0 | .tmp/m02-pending-reload-combined-final.json/.log; command.json; .tmp/m02-pending-reload-final-tests.txt |
| Full operation helper + прежний intent/recovery | **397/397 PASS**, включая 122 новых; focused TS 0 diagnostics | .tmp/m02-pending-operation-proof.json |
| Реальные edit/new/copy page functions, одинаковый fixture | current **21/21 PASS**; before **18 FAIL / 3 native redirect PASS** | .tmp/m02-pending-operation-load-proof.json |
| Настоящий browser reload, одинаковый expanded fixture | before 2339d **0/8 PASS**; промежуточный before fresh-history **7/8 PASS**; current **8/8 PASS**, exit 0 | .tmp/m02-pending-reload-client-final-v2-before/current-evidence.json; .tmp/m02-pending-reload-client-entry-isolation-before-evidence.json |
| Неизменённые operation/article/private EN fixtures | **17 + 61 + 8 PASS** | .tmp/m02-pending-reload-client-proof.json; 573 applicability checks PASS |
| Actor-bound private EN вариант | **8/8 PASS, 59 assertions**, только mounted lookup и fresh synthetic props | .tmp/m02-pending-reload-client-private-actor-proof.json; 64 applicability checks PASS |
| Всего текущих browser cases | **102 PASS, 852 assertions** | core 94/793 + actor private 8/59; оба proofs выше |
| Native Next/Flight reload, одинаковый fixture с заменой prefix/config identity | before **0/4 PASS**, 25 выполненных assertions; downstream после отсутствующего lookup NOT_RUN. Current **4/4 PASS, 47 assertions** | .tmp/m02-pending-reload-native-final-proof.json |
| Прежние native nine, legacy и actor-bound variants | **9 + 9 PASS, 130 + 130 assertions**, 73 actual loaded modules SHA сверены в каждом текущем прогоне | тот же native final proof; оба preservation proofs |
| Next build, оба TypeScript-конфига, client-secret scanner, readonly text gate | **PASS**, exit 0; admin TS выполнен после build | .tmp/m02-pending-reload-next-build-final.log; typecheck-admin/cloudflare-complete.log; client-secrets-final.log; text-gate-final.log |
| Итоговая сверка fingerprint, raw SHA, before/current, fixture parity и cleanup | **PASS_LOCAL_PENDING_ARTICLE_RELOAD_SLICE** | .tmp/m02-pending-reload-final-verification.json/.mjs |

Из прежних 133 файлов изменены ровно 6: ArticleEditor/Loader, article-recovery/
article-recovery-snapshot, edit/new routes. Добавлены только operation helper,
его tests и route actor-binding suite. Шесть независимых Telegram файлов и
четыре SQL/contract файла сохранили raw SHA. Нормализаторы, их вызовы, правила
и tests не менялись; readonly gate выполнен без --write. Исторические SQL engine
proofs остаются применимыми к неизменным SQL sources; нового PostgreSQL прогона
этот шаг не заявляет. Production migration planner не менялся, candidate UNLISTED.

Actual browser исполняет ArticleEditor/Loader/TipTap/FormData/storage/history;
actions/ledger/обязательные reads синтетические. Native исполняет установленный
Next, cookies, Flight, after/revalidate и те же UI/helpers/facade, но Auth/query/
RPC/ledger подменены. Native 22 cases проверяют full EN save, не residual private
EN metadata после reload. Actor private 8 case с названием reload-disabled
загружает synthetic fresh props при mount и не выполняет page.reload. Реальные
GoTrue/Auth/PostgREST/app DB/RLS, production и private EN native reload NOT_VERIFIED.
Privacy foreign legacy unscoped copies этим шагом также не доказана.

Собственные browser/Next servers остановлены; порты 3135/3136 проверены свободными:
`.tmp/m02-pending-reload-native-cleanup.json`. Failed preliminary v1/v3, старые
прогоны до final history fix и прерванный prewarm не заменяют финальные результаты.
Первый actor-private 7/8 run имел ошибку fixture: failure Loader boundary не
передавал actor ID. Он сохранён как fixture FAIL; final clone передаёт actor ID
так же, как реальные routes, без изменения assertions. Push/deploy, production
migrations, paid/provider и social sends не выполнялись. Весь M02 и цель M00..M25
остаются активными и не принятыми.

## M02 Pages: durable Save/Publish и полное восстановление, 7 октября

Продолжено с checkpoint `e3a0ce9324fba96dbe726372b3fe726093a30d7e179f4f4b470ee72723c7f74e`,
HEAD `9d9efe7fdd7702c7ee38630aca986be0c863f225`, без общего аудита и отката R2.
Итоговый code fingerprint: `a19d14a6528f8fcb62af41fce38f8ecc55b9ead3d5e5e1245c77aa791fa3977d`
(149 файлов). PageEditor raw SHA-256:
`587aede87177fa96288d8aa3c9737f6a4fbf9ec461f442c50b826860ce05203a`.
ArticleEditor остался byte-identical:
`2438def369558a2cdda50491d7b82a7daab5f6ac8f3580a2a5f731591e09ae7e`.
Исходные bytes сохранены в `.tmp/m02-page-operation-before/manifest.json` (14),
`.tmp/m02-page-operation-before-additional-tests/manifest.json` (2),
`.tmp/m02-page-operation-before-early-edit/manifest.json` (55) и
`.tmp/m02-page-operation-before-tab-mirror/manifest.json` (38);
это копии исходников, не git checkout/reset.

- Existing Page Save/Publish передаёт actor-bound operationId и неизменный
  исходный intent/FormData/CAS. Strict envelope/receipt проверяет operation,
  entity, status и точный timestamp. Новый guarded RPC записывает Page и receipt
  в одной транзакции; replay не создаёт вторую редакцию, audit или build.
  Read-only lookup относится только к исходному A. Error/not-found/чужая receipt
  не разрешают новую запись. Прежние четыре вызова нормализаторов сохранены точно.
- Loader cache/key связан с actor/page. При недоступном обязательном чтении
  форма сохраняется, а Save/Publish/preview закрыты. Actual route связывает
  staff actor и editor boundary; synthetic route tests не доказывают реальную Auth.
- До dispatch полные A/raw FormData и поздний B записываются и перечитываются
  в actor-scoped SESSION. LOCAL содержит full B и небольшой locator без receipt.
  Reload валидирует оба full snapshots и настоящий TipTap schema до setContent,
  изменения React/CAS/dirty. Исходный A/CAS остаётся прежним до собственной
  server receipt; поздний B/C не заменяется canonical reread.
- Неполные/metadata-only/повреждённые recovery copies не применяются частями;
  full body, media/source/license и ручные поля сохраняются. Full legacy copies
  и явный discard совместимы. URL saved/published не доказывает запись и не
  удаляет content/pending journal. Известный prewrite отказ очищает journal
  только после подтверждённой записи полной content copy.
- На одинаковых fixtures воспроизведены и исправлены три узких дефекта:
  ранний C до готовности реального editor заменялся B; собственный submit мог
  перезаписать foreign LOCAL; сохранение foreign LOCAL блокировало зеркалирование
  позднего C в собственный SESSION. Теперь изменённые ручные поля C накладываются
  на валидированный полный B; foreign LOCAL byte-identical, а собственный SESSION
  обновляется раньше попытки LOCAL. Original A/operation/CAS не меняется.

| Проверка | Фактический результат | Evidence |
|---|---|---|
| Общий набор, maxWorkers=2 | **4187/4187 PASS, 141 files, 0 skipped/todo**, exit 0, final source 587aede | .tmp/m02-page-operations-combined-final.json/.log; .tmp/m02-page-operations-combined-command.json; .tmp/m02-page-operations-final-tests.txt |
| Strict Page intent/receipt/recovery/journal/RPC helpers | **218/218 PASS, 5 files**, actual TipTap schema; focused noEmit 0 diagnostics | .tmp/m02-page-owned-proof.json |
| Actual Page actions, same fixture | before **40 FAIL / 3 PASS**; current **43/43 PASS** | .tmp/m02-page-owned-proof.json; page-operation-server.integration.test.ts |
| Actual Page route actor binding, same fixture | before **19 FAIL / 2 PASS**; current **21/21 PASS** | тот же proof; page-pending-operation-load.integration.test.ts |
| Actual isolated PostgreSQL 17.11 | **45 declared markers PASS**: 33 прежних Article/private EN + 12 Page/legacy; focused migration **17/17 PASS** | .tmp/m02-page-operation-sql-final-proof.json |
| Same SQL fixture on prior candidate | **34 markers**, затем missing Page durable API; downstream Page and final role probe **NOT_RUN** | тот же SQL proof; baseline status FAIL_REPRODUCED_MISSING_PAGE_DURABLE_API |
| Actual SQL DTO через настоящие TS parsers | **9 Page DTO** (5 fresh, 4 replay) + **20 Article DTO**, source SHA 7 helpers checked | .tmp/m02-page-operation-actual-dto-proof.json |
| Browser durable Page core, same fixture | before **0/8 PASS**; current **8/8 PASS, 90 assertions** | .tmp/m02-page-operation-client-proof.json |
| Early C / foreign LOCAL regression, same fixture | before **0/2 PASS**; current **2/2 PASS, 16 assertions** | тот же client proof; exact before-early-edit source snapshot |
| Foreign LOCAL / own SESSION late C regression, same fixture | before **0/1 PASS**; current **1/1 PASS, 11 assertions** | тот же client proof; exact before-tab-mirror source snapshot |
| Новый stronger contract39 | before **30 PASS / 9 FAIL**; current **39/39 PASS, 377 assertions** | .tmp/m02-page-operation-page39-contract-proof.json +mapping |
| Fresh Page browser aggregate | **50 PASS, 494 assertions**, final source 587aede | .tmp/m02-page-operation-client-proof.json |
| Native Next/Flight, same final fixture/config | before **3 FAIL / 1 native signal PASS**, 22 executed checks; current **4/4 PASS, 31 checks** | .tmp/m02-page-operation-native-final-proof.json |
| Build, обе TS конфигурации после build, client-secret scanner, readonly text gate | **5 PASS**, exit 0, final source 587aede | .tmp/m02-page-operations-gates.json +final logs |
| Final actual raw SHA / fixture parity / applicability / cleanup | **PASS_LOCAL_PAGE_OPERATIONS_FINAL_VERIFICATION** | .tmp/m02-page-operations-final-verification.json/.mjs |

Новый contract39 изменяет ровно девять требований отдельного ignored runner:
2 storage-read failures блокируют dispatch, 5 partial/invalid recovery candidates
сохраняют исходную форму и bytes, 2 URL cases не очищают content copy. Остальные
30 ветвей/assertions сохранены. Historical unchanged39 result остаётся
**30 PASS / 9 FAIL**; он не переписан и не превращён в PASS. Отдельный более
строгий same-fixture contract: before **30 PASS / 9 FAIL**, current **39 PASS**.
Mapping: `.tmp/m02-page-operation-page39-contract-mapping.json`.
Первые source-regex mismatch и fixture compile/duplicate-plugin/backup-stamp
ошибки сохранены как diagnostics; невыполненные проверки не засчитаны.
Native before compile failure сохранён как **BLOCKED_NOT_RUN**, отдельно от
окончательного **3 FAIL / 1 PASS**. Исправление fixture разрешает только fallback
к 36 неизменным shared dependencies, проверенным по e3 map/HEAD filtered bytes;
5 фактически использованных captured sources остаются authoritative, 13 новых
Page helper files не добавляются в baseline. Окончательные before/current имеют
одинаковые 15 fixture files/config и runner; фактически compiled graphs: 41/46.
Собственные native launchers/runners остановлены, порты 3142/3143 свободны:
`.tmp/m02-page-operation-native-cleanup.json`. Прежние 5 Page native cases
**NOT_RUN_THIS_SLICE**; они не включены в новые 4/31.

Относительно 136 прежних code files изменены ровно 13 и добавлены 13 Page files.
Из existing sources это PageEditor/Loader, page route/actions/save-result,
4 узких integration/source guards и 4 candidate SQL/contract files.
Article runtime/helpers/routes и шесть независимых Telegram files byte-identical.
Нормализаторы, их правила/tests и все существующие вызовы не менялись;
readonly gate выполнен без --write. 14 прежних Article SQL function definitions
сохранены raw byte-identical; два shared validation/replay helper расширены
строго для Page. Исторические migrations и production planner не менялись;
candidate `20261007_admin_editor_operations.sql` остаётся UNLISTED.

Границы доказательства: Chrome fixtures исполняют реальные PageEditor/Loader,
TipTap, FormData, LOCAL/SESSION и page.reload, но actions/reads/ledger синтетические.
DOM projection допускает только TipTap placeholder decoration и disabled двух
image quick-move buttons; raw HTML/JSON/media/source/license и функциональные
Save/Publish/lookup guards проверяются отдельно и точно. Contract39 использует
legacy actorless entry; actor-bound operation покрывается отдельными fixtures.
Native Next исполняет реальные actions/helpers, Flight/cookies/after/revalidate,
но Auth/Supabase query/RPC/ledger/outbox подменены; fixture read route не является
реальным Page route (тот отдельно исполняется в 21 synthetic route tests).
Изолированный PostgreSQL 17.11 использует actual Page foundation table/RLS/
timestamp/revision и транзакции, но auth.uid/auth.users/is_staff и outbox synthetic.
Прежние Article browser102/852 и native22/307 не перезапускались: их фактические
исходники и fixtures сверены в `.tmp/m02-page-operations-inherited-article-applicability.json`
(1310 provenance checks, 485 принятых source references, NOT_RERUN).
Три preparation tsconfig изменены автоматически Next; executed fixture bytes
проверены отдельно, preparation byte-identity не заявлена. Старый общий SQL
artifact заменён свежим actual PostgreSQL proof выше.

Реальные GoTrue/Auth/PostgREST/app DB/RLS, production, native residual private EN
reload и приватность legacy unscoped copies **NOT_VERIFIED**. Foreign LOCAL вместе
с own SESSION при reload остаётся fail-closed; ownership legacy copy не выводится
из URL/timestamp. Initial managed bootstrap внешне **BLOCKED**. Legacy clients
без actor/operation сохраняют прежний protocol; durable nonce acceptance к ним
не приписывается. Push/deploy, production migrations, paid/provider и social sends
не выполнялись. **M02 active, NOT_ACCEPTED; цель M00..M25 остаётся active.**

### M02: native Next сигналы Auth/чтения и безопасный журнал: 7 октября

Продолжен существующий checkpoint, HEAD
`9d9efe7fdd7702c7ee38630aca986be0c863f225`, ветка прежняя.
До этого шага: a19d/149; immutable before sources: 21 основных файла,
2 preview routes и отдельно проверенные неизменные native зависимости/ресурсы.
Сохранён raw предыдущий checkpoint:
`.tmp/m02-checkpoint-before-auth-boundary.md`, SHA ae415e57cb5fd5008830cb4601c52b201365fc8307eb4212864dd22427dac6cf.

Исправлены девять runtime files: read helper, Auth и guarded Auth request,
Article edit/new/preview и Page edit routes, app/error и global-error.
Настоящий `next/navigation.unstable_rethrow` сохраняет native redirect/notFound
в rejected reason и returned error, включая nested MFA/outer Auth catches.
Все завершённые результаты первоначального bundle проверяются до раннего
возврата: ordinary failure/null первого чтения больше не скрывает native сигнал
из более позднего optional чтения. Page preview использует исправленный общий
helper; его собственный файл в этом шаге не менялся.
Оба app-owned error logger теперь выводят только постоянную диагностическую
строку. UI/reset сохранены; Error/message/cause/digest/авторский ввод не передаются
в эти два вызова console.error. Полное подавление журналов React/Next не заявлено.

| Проверка | Фактический результат | Evidence |
|---|---|---|
| Actual Auth/read/layout helpers, same final fixture | before **91 FAIL / 22 PASS**; current **113/113 PASS**, 38 actual source modules | .tmp/m02-auth-control-flow-proof.json; .tmp/m02-auth-boundary-root-focused-rerun.json |
| App-owned error callbacks, same fixture | before **2 FAIL / 6 PASS**; current **8/8 PASS** | .tmp/m02-auth-error-privacy-proof.json |
| Actual native Next Auth/layout/cookies/routes/Flight, same final fixture | before **6 FAIL / 2 PASS**, 26/75 checks; current **8/8 PASS, 75/75 checks**, 126 actual modules on each side | .tmp/m02-auth-boundary-native-proof.json; before/current-final-evidence.json |
| Fresh combined regression set, maxWorkers=2 | **4331/4331 PASS, 147 files, 0 skipped/todo**, exit 0 | .tmp/m02-auth-boundary-combined-final.json/.log; tests-command.json; final-tests.txt |
| Build, both TS configs after build, client-secret scanner, readonly text gate | **5 PASS**, exit 0, frozen current 155 sources unchanged | .tmp/m02-auth-boundary-gates-command.json + final logs |
| Final raw source/fixture/proof applicability | **PASS_LOCAL_AUTH_BOUNDARY_FINAL_VERIFICATION**, 372 checks | .tmp/m02-auth-boundary-final-verification.json/.mjs |
| Owned native processes/port 3144 | **PASS**, own Node/listeners 0 | .tmp/m02-auth-boundary-cleanup.json |

Два новых integration fixtures; восемь старых source-loader fixtures получили
только реальный installed Next unstable_rethrow в прежние navigation mocks.
Все assertions сохранены: точное обратное преобразование восстанавливает
исходные bytes. Новый 113-case fixture получил только исправление TS UTF8 decoding;
его окончательные before/current запущены заново на одинаковых bytes c40783c9.
Capture/proof: `.tmp/m02-auth-boundary-root-fixture-fixes-before/manifest.json`
и `.tmp/m02-auth-boundary-root-fixture-fixes.json`.
Первый общий прогон **683 FAIL** из-за отсутствующего API в восьми mocks и первый
build **FAIL** на TS2554 сохранены в initial-checks-diagnostic; они не объявлены PASS.
Native asset preparation failures сохранены как **BLOCKED_NOT_RUN**.
Окончательный native runner ce6825c3 и executed fixture manifest одинаковы;
459 native provenance checks прошли. Старый runner с меньшим числом наблюдений
сохранён отдельно, его output не смешан с окончательным before/current.

Границы: native исполняет actual Auth helpers, server cookies, Dashboard/root
layout, существующие Article/Page routes/loaders/editors и Next, но Supabase SDK,
membership/MFA/query data и внешние action/provider побочные эффекты synthetic.
Focused 113 также подменяет request cache/visual/action boundaries. Logging8
использует явный effect scheduler с настоящими компонентами/SSR markup:
полный browser dispatch error boundary и framework logs **NOT_VERIFIED**.
Все 126 native compiled sources сверены с текущими bytes после test-only правок.
Прежние широкие Article/Page browser/native результаты **NOT_RERUN_THIS_SLICE**;
изменённые Auth/read/route graphs не получают старый общий PASS автоматически.

Отдельное фактическое наблюдение текущего native fixture: при user без staff role
Page child всё ещё читает pages/page_revisions, и его синтетический title/rights
попадают в HTML/RSC, хотя layout показывает отказ и editor DOM отсутствует.
При missing user child queries также начинаются, но markers в финальном login
ответе отсутствуют. SDK fixture не выполняет RLS: это доказательство поведения
Next layout/child read, **не доказательство production DB/RLS утечки**.
Проверка доступа до private child reads остаётся конкретной незавершённой задачей.

Article/PageEditor и loaders, operation/recovery/journal helpers, candidate SQL,
исторические migrations, Page actions и их четыре normalizer calls не менялись
относительно a19d. Весь прежний 149-file map сохранён за пределами разрешённого
diff; шесть независимых Telegram files byte-identical. Нормализаторы, их вызовы,
правила и tests не менялись; readonly gate выполнен без --write.
GoTrue/application DB/RLS, middleware, production и native residual private EN
reload **NOT_VERIFIED**; initial managed bootstrap **BLOCKED**. Candidate migration
остаётся UNLISTED; planner неизменен. Push/deploy, production migrations,
paid/provider calls и social sends не выполнялись. **M02 NOT_ACCEPTED; цель active.**

### M02: права до private Article/Page reads: 7 октября

Продолжен a373/155 checkpoint на прежних HEAD/ветке. До правки сохранены 151
immutable source/resource file: 126 ранее фактически compiled modules и 25
проверенных CSS/font dependencies. Capture: `.tmp/m02-read-access-before/manifest.json`;
baseline: `.tmp/m02-code-fingerprint-before-read-access.json`.

Новый тонкий `lib/admin-read-access.ts` использует существующие getStaffSession
и navigation.redirect. Порядок login/MFA совпадает с родительским layout;
допустимы прежние owner/admin/editor. Состояния setup, ошибки подтверждения роли
и отсутствующая/неизвестная роль закрывают чтение. Guards стоят до params,
searchParams, data client и запросов в пяти реальных route files: Article edit,
new/copy, Article preview, Page edit и Page preview. Отказ возвращает существующий
AdminStatusState с общим сообщением, без business/editor entity/actor/data props.
Auth, requireStaff, layout и политика MFA не менялись; действующий aal1/aal1
editor policy сохранён. Вызовы GET/preview не создают редакционных записей.

| Проверка | Фактический результат | Evidence |
|---|---|---|
| Actual Auth/read routes, same 92-case fixture | before **62 FAIL / 30 PASS**; current **92/92 PASS**, 36/37 actual modules; 184 provenance checks | .tmp/m02-read-access-server-proof.json + server before/current tests/sources |
| Honest defaults в шести прежних route fixtures | **359/359 PASS, 6 files**; assertions/остальные bytes unchanged; actual guard не подменён | .tmp/m02-read-access-old-fixture-current-results.json; old-fixture-compat.json; old-fixture-before/manifest.json |
| Actual native Next, same fixture/runner | before **5 FAIL / 3 PASS**, 192/241 checks; current **8/8 PASS, 241/241 checks**, 73 observations, 7 addresses | .tmp/m02-read-access-native-proof.json; before/current-final-evidence.json |
| Native source/fixture provenance | **490 checks PASS**, actual graphs 126/127; единственный добавленный module - новый read guard | тот же native proof; runner SHA a16fc666 |
| Fresh combined regression set, maxWorkers=2 | **4423/4423 PASS, 148 files, 0 skipped/todo**, exit 0, final b43/157 | .tmp/m02-read-access-combined-final.json/.log; tests-command.json; final-tests.txt |
| Fresh build, оба TS после build, client-secret scanner, readonly text gate | **5 PASS**, exit 0, final 157 sources unchanged | .tmp/m02-read-access-gates-command.json + final logs |
| Final source/fixture/proof verification | **PASS_LOCAL_READ_ACCESS_FINAL_VERIFICATION**, 658 checks | .tmp/m02-read-access-final-verification.json/.mjs |
| Own native processes / port 3145 | **PASS**, own Node/listeners 0 | .tmp/m02-read-access-cleanup.json |

Before/current native подтверждают исходную проблему и исправление на одинаковых
fixtures. В before no-role на всех семи адресах запускал private queries и передавал
синтетические author title/source/rights в HTML/RSC при скрытом editor DOM.
Missing-user/MFA переходы работали, но child queries также выполнялись.
Current denied состояния, включая отзыв роли с actual reload, не выполняют эти
queries и не передают эти private данные. Три разрешённые роли продолжают чтение;
настоящие native Auth и settled-query сигналы сохранены. Синтетический SDK
намеренно не исполняет RLS: это доказательство app read boundary, а не production
утечки или реальной DB/RLS приёмки. 62 unit failures включают также порядок
params/identity props; все 62 не объявляются отдельными утечками данных.

Изменены пять route files; добавлены read helper и 92-case test. Шесть старых
fixtures получили полные configured/MFA defaults при сохранении прежних role/actor
options. Reverse-byte proof восстанавливает исходные fixtures целиком.
Первый combined result **4422 PASS / 1 FAIL** из-за точной прежней записи import
сохранён в import-style-diagnostic. Gate/assertions не ослаблены: три Article
imports разделены на исходный named import и дополнительный default import.
После этого current92 и current native8 перезапущены; before неизменен.
Pre-import current native241 PASS остаётся отдельной diagnostic execution.
Первый readonly text gate **FAIL** нашёл длинное тире в моём новом заголовке
предыдущего checkpoint раздела. Вручную исправлен только этот заголовок на colon;
initial-text-gate-diagnostic сохранён. Нормализатор не менялся и --write не запускался.
После окончательной правки imports весь combined148/build/оба TS/gates запущен заново.

Остальные 155 baseline files неизменны вне указанных 11 existing files; Author
Article/PageEditor/Loader, actions/operation/recovery/journal/SQL и шесть Telegram
files byte-identical. Старый resilience source gate сохранён. Нормализаторы,
их вызовы, rules/tests не менялись. SDK/Auth transport/query data и request-cache
границы в unit fixture synthetic; native исполняет actual Next/Auth/layout/cookies/
routes/Editors/Loaders. Старые широкие Auth8/Article/Page proofs NOT_RERUN;
новый graph проверен отдельно. Real GoTrue/application DB/RLS/middleware/production,
dirty manual input при Auth denial/actor change и native residual private EN reload
**NOT_VERIFIED**. Другие private operator readers не покрыты этим five-route proof.
Initial managed bootstrap **BLOCKED**; migration candidate UNLISTED, planner неизменен.
Push/deploy, production migrations, paid calls и social sends не выполнялись.
**M02 NOT_ACCEPTED; полная цель M00..M25 active.**

### M02: свежий ввод при потере доступа и принадлежность новых локальных копий: 7 октября

HEAD `9d9efe7fdd7702c7ee38630aca986be0c863f225`, ветка
`codex/admin-r3-data-errors` сохранены. Исходный b43/157 и 152 файла capture
(127 ранее скомпилированных исходников, 25 assets) сохранены неизменно.
Финальный код: d025/159. Пять существующих runtime files изменены только в этом
шаге: ArticleEditor, PageEditor, article-recovery, article-recovery-snapshot,
page-recovery-snapshot. Добавлены editor-recovery-owner и его 31 unit test.
Auth/read guards, loaders, actions, SQL, прежние тесты, Telegram6 и нормализаторы
не менялись в этом шаге. Все остальные baseline bytes проверены отдельно.

Воспроизведена потеря свежих RU/EN после настоящего React unmount при отказе
Auth, пока обычное автосохранение ещё не исполнилось. True-unmount flush теперь
использует последние полные данные и прежние guards исходной операции.
Для Article различаются ручные изменения и служебные обновления TipTap:
setEditable сам отправляет update с docChanged=false. Ручные callbacks и
реальный ввод тела разрешают запись собственной копии; простое открытие формы
в проверенном fixture не заменяет невосстановленную C канонической A.
Pagehide listener установлен независимо от раннего author flag, проверяет
последние refs при уходе и обновляется при смене editor/actor.
Реальный Chromium input выявил microtask race: flag сбрасывался раньше
обработчика TipTap. Сброс перенесён на следующий timer task; тот же body-only
fixture после исправления сохраняет полную форму при Auth unmount/возврате.

Новые local copies имеют проверяемый UUID marker recoveryActorId и отдельный
ключ actor. Это локальные метаданные, не Auth, права, CAS или receipt.
Собственная primary copy имеет приоритет; чужая не показывается в restore UI.
Новый actor может записать свою копию, сохранив primary и shared copy прежнего
actor. Повреждённая primary не разрешает fallback-overwrite. Запись проверяет
readback; необязательная ошибка shared mirror не делает primary несуществующей.
Явный discard удаляет только разрешённую копию с подтверждённым readback.
Page unchanged discard не воскресает при unmount; новый ввод F после discard E
в том же editor instance создаёт новую копию. Исходные A/opId/CAS и поздний B
сохраняются отдельно; очищать их по Auth отказу или local copy нельзя.
Полные legacy copies остаются совместимыми без присвоения им нового owner.
Принадлежность прежних unscoped copies неизвестна; их приватность не принята.

| Проверка | Фактический результат | Evidence в .tmp |
|---|---|---|
| Actual native Next, тот же frozen main fixture/runner | before 1 PASS / 7 FAIL, 101/119 checks; final 8/8 PASS, 119/119 | m02-auth-draft-native-proof.json; before/current-final-author-evidence.json |
| Main source/fixture provenance | 719 checks PASS; loaded graphs 124/125; 23 fixture bytes и runner87873a56 неизменны | m02-auth-draft-native-verify.mjs; native-proof.json |
| Реальный body-only Chromium input и Cancel image dialog | before 1 PASS / 1 FAIL, 10/11; final 2/2 PASS, 11/11 | m02-auth-draft-origin-proof.json; origin-before/current-final-evidence.json |
| Supplement source/fixture provenance | 589 checks PASS; runner7d5fe46f и тот же fixture; current loaded graph106 | m02-auth-draft-origin-verify.mjs; origin-proof.json |
| Actor ownership/storage unit | 31/31 PASS, включены в финальный combined set | apps/admin/lib/editor-recovery-owner.test.ts; combined-final.json |
| Fresh combined regression, maxWorkers=2 | 4454/4454 PASS, 149 files, 0 skipped/todo, exit0, final d025/159 | m02-auth-draft-combined-final.json/.log; tests-command.json; final-tests.txt |
| Fresh build, оба TS после build, client-secret scanner, readonly text gate | 5 PASS, exit0, final159 sources unchanged | m02-auth-draft-gates-command.json и final logs |
| Source protection | 710 PASS; frozen152, Telegram6, normalizer4; changed5 calls0→0, Page actions4→4 exact AST text/args | m02-auth-draft-protection.json/.mjs |
| Финальное связывание исходников, команд и доказательств | 2625 checks PASS_LOCAL_AUTH_DRAFT_FINAL_VERIFICATION | m02-auth-draft-final-verification.json/.mjs |
| Owned native cleanup3146 | PASS, own Node0, own listener0, 4 checks | m02-auth-draft-cleanup.json |

Оба main запуска используют одну версию fixture и 119 одинаковых assertion
contracts. Before Page F prerequisite E-copy отсутствовал из-за исходной потери
при unmount; final действительно выполняет discard E, ввод F и его восстановление
в одном instance. Supplement использует настоящие keyboard/click/input events;
programmatic setContent/dispatchEvent не подменяют body-only проверку.
Для окна до autosave удержаны только callbacks900/12000/15000ms: это не измерение
сохранения в реальном wall-clock интервале900ms. Все остальные UI timers реальны.
Настоящие Next/React/TipTap, cookies/layout/routes/editors/loaders исполняются;
SDK Auth, роли, query/RPC ответы и provider boundaries синтетические, без RLS.
Это локальная проверка приложения, не GoTrue/app DB/RLS или production PASS.
В обоих запусках внешних browser requests0; own dev server остановлен штатно.

Диагностика не переименована в PASS: 287 native6/8 и ad91 native7/8 сохраняются
в собственных diagnostic manifests; 270e main7/8 воспроизвёл отсутствие C после
reload. 353c main8/8 прошёл, но supplemental body-only FAIL обнаружил реальную
event race; его 24 artifacts/исходники сохранены. Все их прежние tests/build
PASS относятся к тем snapshots. Финальные d025 tests/gates и оба native runners
выполнены заново. Ошибки подготовки env/selector/settled redirect/lookup-name
сохранены отдельно как preparation NOT_RUN; contracts финальных runners не ослаблены.

#### Текущая карта M02-T01..T10

Эта карта уточняет старые промежуточные состояния выше; число тестов не заменяет
критерии приёмки или необходимый уровень окружения.

| ID | Локальное доказательство | Оставшаяся граница |
|---|---|---|
| T01 | unit/component counts и dashboard failure cases PASS, свежий combined | PASS только проверенная unit/component область |
| T02 | успешный настоящий0 в тех же fixtures PASS | PASS только проверенная unit/component область |
| T03 | actual loaders133, preview48, сохранность ввода в Chrome/native, новый Auth/unmount proof | Полный авторизованный app E2E NOT_VERIFIED |
| T04 | обязательный EN bundle fail-closed; isolated PG private EN/CAS/rollback, actual DTO и native residual reload92 | Сквозной EN-read failure → submit → real DB unchanged NOT_VERIFIED; residual proof имеет synthetic SDK ledger |
| T05 | categories SSR edit/new/copy refusal и atomic prewrite0RPC; сохранность известной рубрики | Actual MediaDialog read-error внутри полной статьи с сохранностью media/rights не проверен; старый browser29 не текущий run |
| T06 | helper59 и корректная классификация missing-RPC/timeout/denied в actual loaders | PASS только проверенная unit область; deployed RPC не заявлен |
| T07 | Article/Page journal/retry/own lookup; native10/130 на d025 и новый gallery native3/23 на 4915 | Real Auth/DB E2E и публичная доставка NOT_VERIFIED; прежние native10/130 NOT_RERUN после gallery delta |
| T08 | redaction, actual Next signals, pre-query access92/native241, новые actor-scoped copies | Другие private readers/middleware/GoTrue/app RLS и legacy ownership NOT_VERIFIED |
| T09 | isolated PG immutable/replay/rollback, actual TS DTO и own op/CAS native synthetic ledger | Единая GoTrue → PostgREST → DB → Flight цепочка NOT_VERIFIED |
| T10 | isolated PG modified intent/foreign actor/entity и actual server binding | Managed Auth/RPC/DB acceptance NOT_VERIFIED |

Прежние isolated PG45 markers (33 Article/private EN, 12 Page), actual DTO9Page/20Article
и migration17 proofs находятся в page-operation-sql-final-proof.json,
page-operation-actual-dto-proof.json и прежнем разделе. Они NOT_RERUN в этом
editor/storage шаге, соответствующие SQL/actions byte-identical. Полный M02
NOT_ACCEPTED. Initial managed bootstrap исторически BLOCKED, migration candidate
UNLISTED, planner неизменен. Push/deploy/production migrations/paid/social не выполнялись.
Условный legacy gallery edge воспроизведён и исправлен в следующем разделе.
Новый proof проверяет именно selection без galleryId и два положительных controls;
сохранность unrestored C при всех возможных gallery updates не заявлена.

### M02: выбор legacy gallery и сохранность полной копии: 7 октября

Исходный код d025/159 зафиксирован в m02-code-fingerprint-before-gallery-origin.json.
Before mirror m02-gallery-origin-before/manifest.json содержит 265 файлов:
все 159 файлов fingerprint, actual compiled source graph и assets. Mirror не
изменялся. Финальный код 4915/159 отличается от этого baseline только обработчиком
trackAuthorEvent в ArticleEditor.tsx; остальные 158 файлов fingerprint неизменны.
HEAD 9d9efe7fdd7702c7ee38630aca986be0c863f225 и ветка не изменились.

В native Next/Chromium пользователь сначала создал полный ручной recovery C
с RU/EN, категориями, изображениями, credits/license, источниками, библиографией,
SEO и исходными CAS, затем выполнил настоящий page.reload. Пока C ещё не был
восстановлен, выбор canonical legacy gallery без galleryId вызвал штатный
программный updateAttributes с новым ID. На d025 последующий Auth denial/unmount
перезаписал C исходным A в actor-scoped и совместимой общей копии. Две проверки
побайтной сохранности C воспроизвели потерю. Denial по-прежнему не читает private
данные; источник потери здесь был ложный признак ручной правки при выборе блока.

Теперь click выбора gallery/slider вне button/input/select/textarea и перечисленные
клавиши навигации/выделения не помечают программный updateAttributes как авторский
ввод. Генерация galleryId и существующий node view сохранены. Реальная правка
числа колонок через клавиатуру и body-only ввод по-прежнему создают новую копию.
Tab не исключён: существующий TipTap table handler способен добавлять строку.
Manual callbacks, docChanged guard и существующий window.setTimeout(0) сохранены.
Новый общий редакторский механизм или изменения gallery данных не добавлялись.

Все следующие артефакты находятся в .tmp рабочего checkout; это локальные proofs.

| Проверка | Фактический результат | Артефакт |
|---|---|---|
| Одинаковый native runner/fixture на d025 | 3 cases, 2 PASS/1 FAIL; 21/23 assertions, две потери C | m02-gallery-origin-before-final-evidence.json |
| Тот же native runner/fixture на 4915 | 3/3 PASS, 23/23 assertions; selection11, columns7, body5 | m02-gallery-origin-current-final-evidence.json |
| Source-bound paired native proof | 702/702 checks PASS; actual graphs106/106 | m02-gallery-origin-native-proof.json/.mjs |
| Независимая защита исходников | 1053/1053 PASS; handler delta1 и Article вне него byte-identical | m02-gallery-origin-protection.json/.mjs |
| Fresh combined regression, maxWorkers=2 | 4454/4454 PASS, 149 files, 0 skipped/todo, exit0, 4915/159 | m02-gallery-origin-tests-command.json; combined-final.json/.log |
| Build и обязательные gates | admin build, оба TypeScript, client-secrets, readonly text gate: 5 PASS | m02-gallery-origin-gates-command.json и соответствующие final.log |
| Собственные процессы native3147 | 4/4 PASS, own Node/listeners0, чужие процессы не остановлены | m02-gallery-origin-cleanup.json |
| Итоговая проверка evidence/source/Git | 2224/2224 PASS, выход0 | m02-gallery-origin-final-verification.json/.mjs |

Runner m02-gallery-origin-browser.mjs и 23 fixture files одинаковы для before/current.
Manifest SHA256 97b1fe46aca7348b1ed34cee82d437dd66210f65633a2dba326c705d9e52d012.
Runner SHA256 4e47dd2c2072bf1515923e7542590060793638cfd4a988674173e27c605da74d.
Before evidence SHA256 f24e9f9144714b72143c878cf7a5fb76aa75003f6efc97fae3b5a13c0d5a30d7.
Current evidence SHA256 9315c7abfdbbf31da8c6e64ba17dd89c04be77ef6f6e3c6e4ea9639b1add89fc.

Auth/SDK/query/RPC используют synthetic fixture. Browser, actual Next routes,
ArticleEditor и TipTap/node view настоящие; действия выполнены через click/keyboard.
Autosave callbacks 900/12000/15000 удержаны fixture, остальные таймеры, включая
исправленный author flag window.setTimeout(0), настоящие. Программный observer
только считывает транзакции; не заменяет пользовательские операции setContent.
Первоначальные промах по image/paragraph, исчезновение inspector и отсутствующий
после reload observer сохранены как preparation diagnostics, не являются PASS.
Working final fixture использует реальный доступный keyboard columns control.

Auth/read guards, loaders/actions, SQL, generation/media helpers, excluded
normalizers sources/calls/rules/tests и независимый Telegram diff не изменены
от d025; Page normalizer calls4 и Article calls0 сохранены побайтно. Исторические
SQL45/DTO9Page+20Article/migration17 и Auth native10/130 NOT_RERUN на этом delta.
Real Auth/DB/RLS, все gallery controls и production NOT_VERIFIED. M02 NOT_ACCEPTED;
центральная цель всех M00..M25/230 критериев ACTIVE.

### M02: native reload retained private EN при выключенном языке: 7 октября

Существующий код проверен без новых runtime изменений: исходный d025/159 и текущий
4915/159 прошли одинаковый real Next/Chromium lifecycle. Это проверка совместимости
сохранённого private EN, а не новый исправленный defect. Final runner SHA256:
aef64c1df0e0037081f42369841c568b2fbf08873a194a87912cce525d5c422b;
одинаковые23 fixture files, actual compiled source graphs104/104.

Через настоящую UI кнопку intent=publish при hidden english_enabled='' выполнен
RU-only mode none; English checkbox остаётся выключенным. Atomic action получил
исходные operationId/CAS и готовый RU fixture. Synthetic SDK сохранил один RU
release и metadata retained private EN: english-only, version5, новый RU baseR1,
прежний EN tokenE0, draft EnglishEnabled=false, полный ручной EN без перезаписи.
Настоящий page.reload загрузил actual edit route/Loader props с canonical RU и
отдельным private EN; decoded document Flight и его SHA включены в evidence.
Own read-only lookup исходной операции сохранил поля и не добавил запись, revision,
audit или повторный build. Поля изображения, подписи, credits/license, источники,
библиография и15 EN author fields проверены; canonical EN отдельно не подменяется.

Author form status='draft' из frozen A/latest B сохраняется. Canonical status
'published' независимо подтверждён route props, receipt и actual previous_status.
Независимый readonly review ArticleEditor491/2222/2412/2632, Shell124 и
article-working-draft148 не обнаружил actionable mismatch этого разделения.

| Проверка | Фактический результат | Артефакт в .tmp |
|---|---|---|
| Immutable d025 final same-policy run | 1/1 native case, 92/92 PASS | m02-residual-en-before-d025-final-policy-evidence.json |
| Current4915 final same-policy run | 1/1 native case, 92/92 PASS | m02-residual-en-current-4915-final-evidence.json |
| Source/Flight/fixture/provenance | 1077/1077 checks PASS, exit0 | m02-residual-en-proof.json/.mjs |
| Собственные процессы и3148 | 3/3 cleanup PASS, all launchers exit0, Node/listeners0 | m02-residual-en-cleanup.json |

Proof SHA256 fd789e625b1421fc6091acb9d96ce379b87be23b8e84c3a20c06480954e304fd.
Proof script SHA256 d0c8ddd3f540c506c8a20f0991060af6d2c37c1c1b0e2f6d15c6cd6b8c6288bb.
Current source manifest m02-residual-en-current-source-fingerprint.json заморожен
отдельно и не зависит от дальнейшей смены глобального fingerprint. Before265 mirror
тот же immutable gallery baseline. Original87 diagnostics (86/87, неверное ожидание
published в author select), initial compile/selector/mandatory checklist diagnostics
сохранены как diagnostics; не изменены до PASS. Final92 assertions корректируют
разделение authored/canonical status и добавляют отдельные canonical/Flight проверки.

Browser/Next/ArticleEditor/action/DTO настоящие; Auth/user/SDK query/CAS ledger,
notification/translation/build boundaries synthetic. External provider calls0.
Actual managed Auth/DB/RLS и production NOT_VERIFIED. Свежие4454 tests/5gates относятся
к 4915 snapshot из gallery раздела; повтор без runtime delta здесь не требовался.
M02-T04/T07 и весь M02 не считаются полноценно принятыми.

Для остаточного M02-T05 найден конкретный локальный gap: actual ArticleEditor+
Loader+EditorMediaDialog/Workflow с полным RU/EN/media/rights fixture → HTTP503 либо
fetch rejection → explicit error, no insert/select/doc change, exact full refs/CAS
при безопасной отправке. Media parity rejection не равен catalog read failure.
Categories уже покрыты actual route error/reject edit/new/copy, missing-category
option и atomic error/throw/null до RPC; прежний browser29 использовал другие SHA.
Tags отдельным read/form field в этих Article routes не представлен. Managed link
persist/GoTrue/RLS остаётся отдельной непроверенной границей. Без повторного общего
аудита этот один media error сценарий выполнен локально в следующем разделе;
полное M02-T05 не принято по managed Auth/DB/RLS.

### M02-T05: actual media read failure и сохранность полной формы, 7 октября

Продолжен конкретный residual gap без изменения Article runtime. Immutable269
source capture: `.tmp/m02-media-read-source/manifest.json`, SHA256
`58b7ed57294abc36fde594cc40995e9d46f00d23cfe42801fd58b84823214dc0`.
Actual ArticleEditor/Loader/EditorMediaDialog/useEditorMediaWorkflow исполнялись
в native Next/browser fixture с 104 реальными compiled modules. Их отдельные
source bytes сохраняются после M13 diff; global4915 обозначает исторический
снимок этого media прогона, а не новый fingerprint всего рабочего дерева.

Final `.tmp/m02-media-read-final-current-evidence.json`: 2/2 cases и 198/198
assertions PASS. RU HTTP503 с decoy assets и EN fetch rejection показывают
явную ошибку, не создают selectable cards/queue/insert/selection. Полные RU/EN
JSON/HTML, author fields, category/cover/media/rights/sources и CAS остаются
byte equal до и после отказа чтения. После закрытия actual dialog штатный
guarded working-draft save передаёт оба полных locale payloads и исходные CAS;
synthetic canonical RU/EN остаются прежними, working-draft commits2.
На границе исходящего save сравниваются полная JSON-структура и полный HTML DOM,
порядок узлов, текст и все атрибуты. Разница порядка ключей/атрибутов и стандартной
сериализации void img не объявляется потерей; при самом read failure сравнение
полных документов byte equal. Новые преобразования авторского текста не добавлены.

Initial invalid media-parity seed и промежуточные serialization/trim diagnostics
сохранены как diagnostics, не PASS. Финальный seed согласован до монтирования
формы; runtime guards и excluded normalizers не ослаблялись/не менялись.
Proof `.tmp/m02-media-read-proof.json`: PASS646/646 source/metadata checks,
SHA256 `55d53f6cd4003252b1f0212f21956292ce80306c4db0bdff01a444f3e18b0c8d`.
Script SHA256 `f341f8873b741ba3923ac2c2383c700cd450f3c6d32b1a4fbe3391ca18b9592a`;
runner SHA256 `60f0a4d945eb8aaa782cd88b332090d110a7c07c9898d067dea579186a3e912e`.
Cleanup `.tmp/m02-media-read-cleanup.json`: PASS3, SHA256
`05f32327c0c9cc7aa90573a6533c4aade19854e4cfd466578d2ba196a461f300`;
own launcher exit0, собственные Node handles отсутствуют, loopback3149 свободен.
Auth/user/SDK/CAS ledger/catalog transport synthetic; actual managed media API,
Storage, Auth/DB/RLS и production NOT_VERIFIED. Весь M02 не принят.

### M13-T06/T07: scalar UUID SEO RPC и подтверждение результата, 7 октября

Активный локальный M13 шаг завершён от исторического4915/159. Immutable baseline
`.tmp/m13-redirect-before/manifest.json` хранит 168 исходников: original159 и
9 используемых SEO/publication/route/SQL dependencies. Все original159 сохранены
byte equal. Единственный изменённый baseline runtime:
`apps/admin/app/(dashboard)/seo/actions.ts`; добавлены maintained
`seo-redirect-actions.integration.test.ts` и SQL fixture
`scripts/database/fixtures/seo-redirect-scalar-contract.sql`. SQL migrations,
publication.ts, Article/Page/Auth runtime, excluded normalizers и Telegram6
сохраняют прежние bytes. Migration planner и UNLISTED candidate не менялись.

create_seo_redirect_guarded фактически возвращает scalar UUID. Action теперь
валидирует этот контракт и передаёт сам UUID в requestRedirectBuild. Update/delete
валидируют UUID и совпадение с запрошенным ID; known permissions/CAS errors,
catalog filters и native Next redirect остаются прежними. Null/empty/row/object/
array/non-UUID и чужой update/delete UUID дают безопасное сообщение о неподтверждённом
результате до action enqueue/audit/provider/cache. Оно не утверждает rollback
canonical записи: её штатный trigger/outbox остаётся отдельной гарантией.

На одинаковом финальном fixture SHA256
`08fce91cd574e4de0d7f5ef3f256b067c659a039b48b69e24e4d731bcfd2ed02`
paired27: before 5 PASS/22 FAIL, current 27 PASS/0 FAIL; pending0 и неизменные
sources во время каждого запуска. Обычный запуск без native artifact: 26 PASS.
Шесть реальных modules исполняются через existing transpile harness; среди них
меняется только SEO action. Auth/SDK/cache/provider transport synthetic;
actual publication/native Next control-flow исполняются. Все прежние paired26
и промежуточные27 proofs сохранены; исправлены только три TypeScript typing
ошибки harness без изменения names/expectations. Первый full4481 PASS и build
FAIL по этим типам архивированы в `.tmp/m13-redirect-pre-typefix/`, не финальный PASS.
Final command proofs:
`.tmp/m13-seo-redirect-before-db-bridge-typefix-command.json`, SHA256
`e3683dd8c8781058c0c4714a174f5ead44280847e3ef8d443acb37ea6f9730db`;
`.tmp/m13-seo-redirect-current-db-bridge-typefix-command.json`, SHA256
`256a0a78629928142b5a9ca1e3dab766860173d0a50cb8f2d975ee4d6935e99a`;
default26 `.tmp/m13-seo-redirect-current-default-typefix-command.json`, SHA256
`c7d2dd61de8a5b95578674f38bab4860d2e6c78bef59ac7a51a26820e8d34019`.

Настоящий изолированный PostgreSQL17.11 подтвердил 5/5 markers: scalar UUID
signature/guards, single canonical insert, single transactional audit с тем же
ID, actual row-trigger outbox с тем же ID, duplicate refusal без второй записи.
Authenticated test-role без superuser/BYPASSRLS; создание выполнено через actual
guarded RPC. Audit/outbox assertion reads выполняются fixture owner после
RESET ROLE, без выдачи authenticated нового SELECT на audit. Использованы
4 actual guarded redirect functions и 2 actual append/capture outbox functions,
извлечённые из неизменённых миграций; минимальные DDL/Auth fixtures synthetic.
Native report:
`.tmp/m02-postgres-tools/native-cases/m13-seo-redirect-scalar-20261007161409508-24932-c11c0476/result.json`,
SHA256 `f76e5151fddc5370d2b71b1a3212f3ac10afbeb679df3f0ce4bca3ec5baa8705`.
Effective SQL SHA256 `4bd46602ce2d466c937ef83acced471788b9867b3cdd98babbcf304cf15275d7`.
Native server stopped, owned drive alias removed, workspace files preserved.

Actual DB scalar `81238b13-c9fc-46c6-8c37-da187e00c949` exported once в
`.tmp/m13-seo-redirect-db-result.json`, SHA256
`f5982e1f13417ccc3fd938e31b525e2185ae4d79756ec90b98dd85b0f4c98655`.
Opt-in27 case проверяет raw hashes native report/stdout/SQL/builder/sources,
native actor/args/counts, затем этот UUID проходит actual action/publication
modern outbox и compatibility audit path через synthetic SDK. Это native-value
replay; живая цепочка GoTrue/PostgREST/enqueue не проверена. Native SQL update/
delete, concurrent redirect/rollback и остальные M13 criteria здесь NOT_RUN.

Два child write запроса SQL fixture/export были rejected автоматической проверкой
как выходящие за видимую child цель M02; child get_goal был null. Оба действия
тогда NOT_EXECUTED. Root сверил действующую пользовательскую цель всех M00..M25,
конкретные команды и источник результата; те же операции в root контексте
получили approval и завершились. Путь/операция не менялись для обхода; pending
approval нет. Внешних действий/production/paid/social вызовов не выполнялось.

Final fingerprint162 `62d7f4917c353bea7dab0efcfb83149da6a44db3f84eb14f9af363ae6c4a482c`.
Immutable manifest `.tmp/m13-redirect-typefixed-source-fingerprint.json`, SHA256
`0f879daf41f62be915cca6ac4140932631f192de4475e23be092ae8cf7610eda`.
Fresh regression: 4481/4481 tests, 150 files, failed/pending/todo0. Build,
оба TypeScript configs, client-secret scanner и unchanged read-only text gate
PASS5, sourceUnchanged=true. Final `.tmp/m13-redirect-final-verification.json`
PASS835/835 source/metadata checks, SHA256
`00b8a0e51533cccfdd7d9fae671d436d3219a90017eb6fcef74777a0a83689aa`;
script SHA256 `338b86eac0ef08dc9e6a04ec86dc106e6cf66939b88ff9d77c7c13e47e42da78`.
Первый aggregate scope diagnostic (boolean false вместо NOT_VERIFIED string)
архивирован отдельно; runtime/source proofs не менялись ради этого результата.
4 excluded normalizers exact HEAD bytes, Page raw calls4/Article0 и Telegram6
unchanged. M02 residual/media actual104 source graphs проверены неизменными;
их native runs не объявляются свежим full-M02 rerun на новом whole-tree fingerprint.
Local M13-T06/T07 slice VERIFIED; весь M13, M02 и R3 NOT_ACCEPTED.
Managed Auth/DB/RLS, full effective project schema и production NOT_VERIFIED.

### M04-T17: validation до enqueue и проверка доступности outbox, 8 октября

Исходный M13 fingerprint162 `62d7f4917c353bea7dab0efcfb83149da6a44db3f84eb14f9af363ae6c4a482c`
и immutable `.tmp/m04-publication-before/manifest.json` (166 dependencies) сохранены.
Меняется единственный runtime `apps/admin/lib/publication.ts`; existing M13
`seo-redirect-actions.integration.test.ts` адаптирован к readonly outbox probe.
Добавлен maintained `apps/admin/lib/publication-request.integration.test.ts`.
Другие 161 исходника из original162 byte equal; SQL migrations, public-build,
Article/Page/Auth runtime, R2 и независимые Telegram6 не менялись.

Actor UUID, формы entityType/entityId/reason/metadata и skipAutoTranslation
проверяются до translation/enqueue/SDK/provider. Для UUID-backed entities
проверяется UUID, для homepage сохраняется manual_publish; существующие текстовые
site/editorial/batch и natural identities сохраняют совместимость. Исходные
строки и ручные RU/EN/права/источники не переписываются. Ответ enqueue принимается
только как положительный допустимый scalar bigint; decimal string ограничен
PostgreSQL bigint MAX и сохраняется точно. Неподтверждённый ID блокирует dispatch.

Одна ошибка missing enqueue больше не разрешает legacy dispatch: после точного
missing-function DTO выполняется readonly SELECT id LIMIT 0 у public_build_outbox.
Legacy path допускается только при двух точных ответах об отсутствии API capability.
Доступная таблица, permission/transient failure, несовпадающая signature/hint,
contradictory data и повреждённый probe DTO блокируют dispatch. Это API policy;
физическая legacy schema и актуальный managed PostgREST cache НЕ подтверждены.
Actual Next control-flow сохраняется в fulfilled error DTO и rejected probe,
включая post-dispatch mark/audit. Обычные ошибки после external success и
атомарная retry/reconciliation M04-T13/T15/T16 здесь NOT_VERIFIED.

На одном финальном fixture SHA256
`7c3cf2f0dbc9182b0869c3fb5b6fcd68711767801d8f55a30260370f53f64945`
paired139: before 43 PASS/96 FAIL, current 139 PASS/0 FAIL; pending0, names equal,
sourceUnchanged=true. Before runtime SHA256
`bc668f90abd99c3e449ce8e59165543011d7269aaa0d19fcc4c7707875ab433e`,
current `36c63cc41fbbd298e7d68af7f2888c3606976958538932e116c2d99808a00d51`.
Command proofs `.tmp/m04-publication-request-before-escape-final-command.json`
SHA256 `ac566125096e8c0c55537f371da04005bdd5ac38bf584542d8fadcf79833d3aa`,
current command SHA256 `1e251af159f3f74dd867caf75820af9ff3e1116ce523da7182d00c7b798792cb`.
Исполняется actual publication module с настоящими Next/Zod/installed SDK;
3 SDK transport cases используют custom fetch/Response. Auth requests0,
network0, paid/external/social calls0; provider и translator synthetic.
Maintained M13 final compatibility cases также 27/27 и default26/26 PASS,
current publication bytes и final harness SHA256
`90368c8525e37074570fe584be932068770d642ecec7404f1fef154bc04c6181` проверены.
Исторические M13 before/current proofs не перезаписаны.

Первый full4620 PASS, но readonly text gate FAIL по двум символам в новом
test fixture архивированы в `.tmp/m04-publication-pre-escape/`; это не PASS5.
Только написание двух literals заменено на Unicode escape, runtime values equal.
Encoding proof `.tmp/m04-publication-request-encoding-proof.json`: PASS10 named
checks, all decoded AST strings и authored UTF8 byte equal, metadata SHA256
`d74ec8ceea06285426e2bc66bcd0c665c2687399a53e5fd3ae6e4531a9bd3b3b`.
Нормализаторы, их вызовы, правила и существующие tests не изменены.

Native PostgreSQL17.11: 7/7 markers PASS, actual enqueue_public_build_request
(text,text,text,jsonb), append/capture и staff SELECT/RLS policy скопированы из
неизменённой migration. Прежний synthetic enqueue stub явно заменён actual
function. Actual trigger плюс explicit request сохраняют обе intended записи;
natural site/homepage IDs и ручные RU/EN metadata сохранены, canonical1/audit1/
outbox4. Нет coalesce/dedup или отключения trigger. Четыре изолированных rollback
contexts: missing function, wrong arity, renamed arguments, missing internal
helper. Все дают настоящий 42883 при существующем доступном outbox, без изменения
1/1/4. Три внешние signature failures имеют одинаковый текст ошибки, поэтому
он не доказывает legacy schema. Последний actual enqueue сохраняет decimal
MAX `9223372036854775807` точно; canonical1/audit1/outbox5.
SQL SHA256 `5da3b464b1d1fdff4253b697a22b748efaead501c705286b55ee4ed9c0796f76`.
Report `.tmp/m02-postgres-tools/native-cases/m04-publication-enqueue-20261007224030461-9204-3b2b294d/result.json`,
SHA256 `f36f78479645e181320b4ca7af69aad55a3b8d8771c235bee0ea754c880e2b08`.
Actual export `.tmp/m04-publication-native-result.json`, SHA256
`0d7d94db7563d40c31088c2ffb4d5d6e3fa21691e58ae94cde54b1ad40ca014f`.
Synthetic Auth/is_staff/minimal DDL и owner assertion reads; authenticated
не superuser/BYPASSRLS. Actual outbox staff policy применена успешным SQL;
unrelated service_role grant опущен: этой роли нет в минимальном fixture.
Fixed runner security report перечисляет 7 прежних таблиц, без outbox; отсутствующую
строку не подменяем вымышленным подтверждением. Owned server stopped, alias removed,
workspace preserved. GoTrue/PostgREST/managed effective schema/production NOT_VERIFIED.

Final fingerprint164 `1b3791ec715661fb2a86bb8abcd75211ed53023a5d63acbaf7a7481185b9230e`;
immutable `.tmp/m04-publication-escaped-source-fingerprint.json`, SHA256
`86cfe71c829eec6b1a912bf581bc4c7bcd0ba30260b43f8b9a2915e5de026f2d`.
Fresh regression: 4620/4620 tests, 151 files, failed/pending/todo0. Build,
оба TypeScript configs, client-secret scanner и unchanged readonly text gate
PASS5; sourceUnchanged=true. Commands `.tmp/m04-publication-checks.mjs tests`
и `.tmp/m04-publication-checks.mjs gates`; paired runner command lists и native
SQL markers зафиксированы в соответствующих command/result artifacts.
Final `.tmp/m04-publication-final-verification.json`: PASS619 source/evidence
checks, SHA256 `8a009292f7fa57b5bfbf32a1acb7c865cf2060a5c45ff9c26610691c3dadc27f`.
Script SHA256 `213334275f10c75b6a9c79e043d6552470f38da8d3987c25b39d860e9f6206e8`.
Первый aggregate metadata diagnostic архивирован отдельно: verifier ошибочно
ожидал array вместо actual named checks object и outbox в fixed report list;
исправлены только эти ожидания, runtime/SQL/proofs не ослаблялись и не подменялись.
4 excluded normalizers exact HEAD bytes, Page raw calls4/Article0, Telegram6
unchanged. Relevant104 M02 residual/media module graphs остаются byte equal;
их исторические native results не объявляются новым full-M02 rerun на fingerprint164.
Local M04-T17/T11 slices VERIFIED; весь M04, M02, M13 и R3 NOT_ACCEPTED.

### M07-T07/T08/T09/T10/T11: freshness и общий бюджет, 8 октября

Продолжено с M04 fingerprint164
`1b3791ec715661fb2a86bb8abcd75211ed53023a5d63acbaf7a7481185b9230e`.
Immutable `.tmp/m07-before/manifest.json` содержит original164 плюс 14 используемых
translation/SQL dependencies, всего178. Все178 captured bytes валидны; original164
сохранены byte equal. Из baseline меняются только шесть runtime файлов:
translations/article-actions.ts, auto-translate-published-article-premium.ts,
auto-translate-article-premium.ts, premium-english-translation.ts,
translation-run-record.ts и translation-errors.ts. Новые pure classifier и budget
helpers плюс три maintained suites. SQL migrations, роли, provider/model/reasoning
конфигурация, prompts, source-hash/ownership algorithms, R2, normalizers и Telegram6
не менялись. Прочитан только активный modules/M07.md и общие правила.

Batch больше не считает status=published доказательством current и не обходит
helper. Чистый classifier разделяет ownership/freshness/publication. Current
требует machine ownership, совпадения полного source hash и действительной
исходной RU revision; для published batch current также требуется published EN.
Ручная версия остаётся manual даже при совпадающем hash, с отдельной stale/unknown
свежестью в сводке. Машинный fresh draft/review не переводится повторно ради
статистики. Unknown provenance, отсутствующая/повреждённая RU revision и retained
deleted EN пропускаются до дорогой попытки. Удалённый EN читается вместе с
deleted_at: безусловный UNIQUE(article_id,locale) сохраняет его слот, поэтому
не выполняются оплачиваемая генерация для doomed insert и неявное восстановление.
Авторские RU/EN, sources/bibliography/rights и deleted rows не переписываются.

Общий budget одного bounded article run: scan500 (прежний), expensive attempts2
(прежний двухэлементный cap теперь включает conflicts), provider calls8 максимум
(translation/repair/review/final repair, до4 на каждую из2 попыток), admission
deadline300000ms. Это прежний пяти-минутный per-pass timeout как общий потолок
новых вызовов; отдельный existing OpenAI timeout300000 не увеличен. Все8 мест
начала прохода у двух провайдеров используют один budget, wrapper передаёт тот
же объект. Serialization failure не расходует provider call; принятый/error/429
вызов расходует его один раз. Попытка начинается после cheap ownership/freshness
guards. Batch повторно проверяет существующий runtime gate перед новым элементом.
Deadline/stop запрещает следующий проход, но не объявляет принятый запрос
отменённым. Полный final response уже допущенного запроса может завершиться и
сохраниться после deadline; новый элемент не запускается. Это НЕ hard HTTP
wall-clock timeout и НЕ разрешение автоматического повторного платного запроса.

Job items теперь передают actual sourceHash в существующий SQL source_hash.
record_translation_sync_run возвращает scalar UUID, проверяемый до dispatch.
EN save .select(id).maybeSingle требует UUID row и совпадения existing ID при
update. Unsupported DTO/чужой UUID/new INSERT null не объявляются успехом;
translation_save_unconfirmed прямо допускает, что запись могла выполниться.
Existing update zero-row CAS остаётся conflict. Остановка имеет отдельный
translation_operation_stopped, без ложной provider/internal failure причины.
Успешный сохранённый результат возвращает post-write machine/current/published
axes; negative outcomes сохраняют наблюдавшийся исходный context. Source prose
не помещается в job/audit; неизменённые row/outbox triggers остаются действующими.

Одинаковый final batch/helper fixture58 SHA256
`5fd588c0637598d7cb53db902e9673cea5b04b31f8f8e527ff0e2643885f519c`:
before20 PASS/38 FAIL, current58 PASS/0 FAIL; pending0, names equal,
sourceUnchanged=true. Native Next redirects и actual action/helper/hash/ownership/
job mapper/budget исполнены; Auth/SDK/runtime gate/expensive translator/build
transport и clock controlled mocks. Initial and current SDK reads возвращают
отдельные копии данных, update receipt содержит выбранный реальный fixture ID.
Current actual graph15 и before graph13 raw hashes проверены. Final commands:
`.tmp/m07-batch-before-final-v8-command.json`, SHA256
`70cb621de68b863949b89f2dfc9d3cd581c73835e05f3b81fbf140fa3c4a0f95`;
current command SHA256
`484a0f8319a705a5bd8d0cf0907963fb1b2b4cadc5bd4939bb6f34002377dcd9`.
Покрыты stale/current/manual/missing EN, неизвестная revision и PG microseconds/
offset, deleted EN, 500 conflict candidates с attempts2, конфликт плюс success,
kill gate перед вторым элементом, stop/deadline после принятого mock first pass,
read/write/journal failures и повреждённые save/run receipts.

Provider fixture32 SHA256
`dcf7b6d730629e7715d83a25f806526c6373b63f6d05fca5ec5a9625e4ff4a56`:
same before6 PASS/26 FAIL, current32/32 PASS; sourceUnchanged=true, pending0.
Actual provider/wrapper modules2 с controlled OpenAI fetch/Response или Workers
AI binding/clock. Перевод, обе repair, review, общий budget между элементами,
slow first response, late accepted final, stop, rejection/429 без fallback и
сериализация покрыты. `.tmp/m07-premium-budget-before-final-command.json`, SHA256
`da29b71871227db939c079f4c4243a76eede6620126b47a23eb43b624b1e53d3`;
current SHA256 `a2318fe997b54d666cf536b6bf5e78a949f6d6e8cdd5c6e6c44bcbb360c702b8`.
Бюджет helper14 и unchanged provider/wrapper18 также покрыты свежим общим прогоном.
Промежуточные diagnostics сохранены, включая invalid old-source-hash seed,
неверный SDK row alias и v4 current со source drift; они не заменяют final-v8.
Intermediate fingerprint0c42/175 не является финальной проверенной revision.

Final fingerprint175
`fcc3ce4daa97a5b0429c8e91bae70fe120f40d30d2fd0c1ac57d042e88305c60`;
immutable `.tmp/m07-translation-confirmed-source-fingerprint.json`, SHA256
`c1364ccac26d733b4fd2ffc498999e905a5321c8097d58fd28caa4fdeba35c30`.
Fresh regression: 4774/4774 tests, 163 files, failed/pending/todo0. Build,
оба TypeScript configs, client-secret scanner и unchanged readonly text gate
PASS5; sourceUnchanged=true. Commands `.tmp/m07-translation-checks.mjs tests`
и `.tmp/m07-translation-checks.mjs gates`; selection и реальные command arrays
зафиксированы в command artifacts. Final source/evidence verification:
`.tmp/m07-translation-final-verification.json`, PASS607/607, SHA256
`9d7723ca2120d86985190fad6d9c812c84ffac472a16a65a5934290c019f35dc`;
script SHA256 `90977a274b16de92311246b35ae55780472cef2e3f3900c6c1243b0a46903cf3`.
4 excluded normalizers exact HEAD, Page/Article call-bearing files byte equal
baseline (прежние raw calls4/0), Telegram6 unchanged. Исторические M02 residual/
media graphs104 также byte equal; native results не объявляются fresh full-M02
rerun. Собственные tests/build jobs завершились exit0; live launcher/server нет.

Local integration/unit M07-T07..T11 slice VERIFIED в указанной области; required
DB+component/admin E2E acceptance НЕ заменён mocks. Настоящие provider calls0,
paid/social calls0; Auth/DB/RLS, GoTrue/PostgREST и production NOT_VERIFIED.
M07-T05 остаётся открытым: существующий helper payload всё ещё автоматически
ставит published/reviewed_by/approved_by, технический completion не доказывает
человеческое review. M07-T02 атомарность позднего RU check/EN write не доказана
(это две операции); M07-T03/T13 журнал/reconciliation после частичного success
и адресный retry pending. OFFSET/updated_at и legacy numeric cursor ещё не
устойчивы: M07-T12/T13 NOT_VERIFIED. Full M07/M02/M04/M13/R3 NOT_ACCEPTED.

### M07-T12/T13: стабильный обход и продолжение, локальный шаг 8 октября

Статус: IMPLEMENTED / VERIFIED_LOCAL_SCAN_SLICE; не полный PASS M07-T12/T13
или M07. Продолжено с verified `fcc3ce4daa97a5b0429c8e91bae70fe120f40d30d2fd0c1ac57d042e88305c60`
(175 files). Immutable baseline `.tmp/m07-scan-before/manifest.json` содержит 179
sources: прежние175 и четыре ранее чистых зависимости (resume action, старый
numeric cursor helper, две существующие SQL migrations). HEAD/ветка не менялись.
Текущий180 fingerprint: `faef2e8069b2acf4cd3121a3e6dd2fd9886f77fa3fae1af7244b8d7d974850d8`.
Frozen manifest `.tmp/m07-scan-final-source-fingerprint.json`, raw SHA256
`5db66f20fb3d4b10d0f2d8bbe82b7b7191e4e6150ba6b1723aebb179afc892b1`.

Article batch больше не использует изменяемый updated_at + OFFSET. Первый запуск
фиксирует верхнюю UUID-границу; order=id asc и fixed window до500 сохраняются
в существующем JSON resume_cursor. Внутри окна сохраняется nextIndex, после
потребления окна позиция записывается в afterId. REQUIRED lastWindow подтверждается exact count той
же ограниченной выборки; exhausted допустим только при lastWindow=true и пустом
pendingIds. Полный DTO проверяется до продолжения. Numeric legacy resume не
превращается молча в новый обход. Явная кнопка нового обхода отправляет отдельный
intent=fresh, сбрасывая только позицию сканирования. В article URL/форме передаётся
articleJob UUID; полный список IDs остаётся в серверном журнале. Numeric cursor
других доменов и plain GET retry сохранены. Main article form больше не передаёт
старый articleCursor. Resume проверяет identity/kind реального RPC receipt.

Удалённые/неопубликованные кандидаты из фиксированного окна явно пропускаются
с продвижением, без model call. Eligibility читается группами до100 IDs, чтобы
не строить server IN URL из500 UUID. Сравнение UUID insensitive к регистру,
raw сохранённые IDs не переписываются. Существующие2 expensive attempts,
8 provider calls и300000ms admission budget сохранены; новая дорогая операция
не начинается после лимита. Cancelled/cancelling article job не продолжается.

При позднем обычном read error/reject/invalid DTO после100 или500 просмотренных
результаты и достигнутая позиция проходят обычную финализацию; read failure не
скрывается успехом. Actual Next control-flow исключения повторно выбрасываются
на новых read boundaries и в record helper/catch. Ошибка журнала обозначается
translation_run_record_unconfirmed, без ложного утверждения, что уже сохранённые
EN не менялись. UI различает завершённый пакет и конец обхода, legacy/exhausted
resume disabled; отдельный fresh intent явный. Кнопка продолжения обходит
оставшихся кандидатов, а не повторяет failed item.

Это bounded keyset traversal, НЕ transaction-wide frozen membership. Стабильно
текущее окно и upper fence; новая публикация позади уже загруженной позиции или
выше upperId, а также изменения уже обработанного RU требуют явно нового обхода.
Новые допустимые IDs впереди позиции могут войти в следующее окно. Никакого
100% всего постоянно меняющегося архива UI или доказательства не заявляют.

Из прежних175 источников изменены только6: article action, translations page,
run-record/error helpers, batch и load-errors fixtures. Прежние169, включая
freshness/provider runtime, ownership, authors/content flows и6 независимых TG
файлов, побайтно сохранены. Пять новых выбранных paths: resume action и backfill
source test (были чистыми), новый scan helper, его unit test и новый scan integration.
Legacy read regression адаптирована к безопасному disabled resume, сохраняя
подтверждённые counts, видимость job, immutable input и GET retry. Normalizers,
их rules/tests/calls, provider/model configs и обе существующие migrations
не менялись. Новых migrations, real account changes и внешних действий нет.

Одинаковые окончательные fixtures и фактический baseline/current:
- Scan61: BEFORE2 PASS/59 FAIL → CURRENT61/61 PASS, exit1→0, pending0,
  sourceUnchanged=true. Immutable `.tmp/m07-scan-final-v2-fixture.ts`, SHA256
  `e545b5eb275a71b161123170b39dc167e41fad419d5c0bb913c6d4455495bbe8`.
  `.tmp/m07-scan-before-final-v2-command.json` SHA256
  `ce49f295a43410beafdc402817a3dcd00e876741bdf4f37045332d8f9aae07b8`;
  current command SHA256
  `1e0608cf7a8a9f73f58704cf38270318c0966261bd5ebd5fac78ef8fe96e6158`.
- Adapted batch58: BEFORE47 PASS/11 FAIL → CURRENT58/58 PASS, same fixture,
  exit1→0, sourceUnchanged=true. `.tmp/m07-scan-batch-final-fixture.ts` SHA256
  `b6b7979e8e1876267d36cfe5dc737f68c98ac41e6f0268238b7c33841743e7f1`.
  before/current command SHA256 `8256a4bbce48ede86eeab626dd7ac5a9a6185f0b1c9c85c2a01eadfcd326bfa8`
  / `bb42268734fd8334328aa8f9f9c5578cf44e0fd08688cc9d851fa65a658a2a08`.
  Прежний v8 fixture и20/38→58 proofs сохранены как исторические, не свежий PASS.
- Pure scan schema87/87 PASS. Required lastWindow, final500, damaged indices,
  ordering/duplicates/boundaries и strict JSON checked; входит в свежий broad run.

SDK emulator реально выполняет filters/sort/range/limit/count before limit и JSON
roundtrip журналирования. Actual action/helper/hash/ownership/record/resume/SSR
и native Next исполняются. Auth/SDK/runtime gate/translator/build/clock остаются
controlled mocks. Actual SubmitButton исполняется с контролируемым hook
useFormStatus(pending=false), без claim о client pending/hydration/admin browser.
Покрыты равные даты, mutations в loop и между resume, окна500/105, deletion,
unpublish/inserts, partial read failures, uppercase IDs, cancelled jobs,
повреждённые receipts и Next signals. Diagnostics50 и initial focused170/171
не засчитываются как PASS; единственная focused failure была старым ожиданием
активного legacy resume, которое заменено на новый disabled контракт.

Actual isolated PostgreSQL17.11: обе existing TranslationOperations migrations
применены побайтно,7 native markers PASS: scalar UUID и500-ID resume roundtrip,
sourceHash/outcomes, object-vs-nonobject/SQL NULL boundary, damaged object для
application rejection, actual staff/service ACL/RLS и обход после mutations.
Fixture `.tmp/m07-scan-sql-native.sql` SHA256
`edfa6fe2abbea688f51a5573910172ac937b5113875d6f2b321cf63cd1cdad93`.
Result `.tmp/m02-postgres-tools/native-cases/m07-scan-resume-20261007233421143-14148-fc06c3aa/result.json`
statusPASS; own serverStopped/aliasRemoved/workspaceFilesPreserved=true.
Команда: `.tmp/m02-native-postgres-runner.mjs --case=m07-scan-resume
--sql=.tmp/m07-scan-sql-native.sql` с семью explicit markers из manifest.
Actual exported native JSON затем принят/отклонён actual app parser:
`.tmp/m07-scan-native-boundary.json` PASS16/16, SHA256
`faa1b67b1b2abbcb4c856a9e97fceaff6b1be6f12f84d198f6d475afac895374`.
Auth.uid/is_staff/membership/roles и candidate article schema синтетические;
это реальный локальный SQL/RLS, не managed GoTrue/PostgREST chain, canonical
editorial write или production acceptance. Staff lease claim/complete denied;
existing service ACL retained, worker run не выполнялся.

Fresh final180 validation: `.tmp/m07-scan-checks.mjs tests` →4922/4922 PASS,
165 selected suites, pending/todo0, sourceUnchanged=true. Command SHA256
`faa17a5ca096fcd6e2aae7a8cd70ce4b240a9bf3469b99d63d184ca436138a6a`.
`gates` →5/5 PASS: actual admin Next build, оба TypeScript configs, client-secret
scanner, existing READ-ONLY text gate. Command SHA256
`b8f1f9563701ab96774ef5038524e04dd58a86fd8cdfcd1f494bc3ad8b296372`.
Build SHA256 `82f9c00a7f6552fce1db13a7fc9813282298db8ed1358a2a588bbb80cb7d3757`.
Final aggregate `.tmp/m07-scan-final-verification.json` PASS674/674, SHA256
`a0a42b2ac78fee47c3f6f3496db9e5ced29cdfb2f230f55d42a8960ad1258c40`:
actual source180 + original169/capture179, paired fixtures/graphs/artifacts,
native SQL/parser16, fresh4922/gates5, excluded files/configs и git diff --check.
Native runner38777, broad32210 и gates29711 terminal exit0; собственных live
jobs/listeners этого шага нет. Общая цель M00..M25 active; full M07 NOT_ACCEPTED.

Оставшиеся конкретные ограничения:
1. Если после nonfinal окна все оставшиеся кандидаты исчезли, empty end-query
   не имеет durable terminal receipt. Existing SQL запрещает zero items, JS
   возвращает null. Fake item/ложный journal success не создаётся, платный repeat
   не запускается; старый job всё ещё может запросить read-only continuation.
   Закрыть узким проверенным terminal-cursor протоколом, сохранив ACL и CAS.
2. Отдельная команда retry failed item/source revision ещё не реализована.
   Продолжение не заменяет этот M07-T03/T13 контракт и authenticated admin-e2e.
3. T05 completion/review, T02 late-write atomicity и T03 unknown journal outcome
   reconciliation остаются pending. Нет real provider, managed Auth/DB/RLS,
   production, push/deploy или социальных отправок.

### M07: empty terminal receipt существующей задачи, 8 октября 2026

IMPLEMENTED / VERIFIED_LOCAL_INTEGRATION / VERIFIED_ISOLATED_SQL для этого
вертикального шага. M07-T12/T13 имеют дополнительные локальные доказательства;
полные M07-T13 admin-e2e, весь M07 и M00..M25 ещё NOT_ACCEPTED.
Предыдущий пункт про отсутствие durable empty terminal receipt закрыт этим
разделом. Исторические результаты stable scan/resume выше сохранены.

После nonfinal окна и удаления/снятия с публикации оставшихся кандидатов
продолжение раньше теряло articleJob: existing record helper возвращал null
для zero items, сохранённый cursor оставался незавершённым. Теперь отдельный
complete_article_translation_scan подтверждает завершение существующего job.
Его id, kind, status, counters, items, attempts, RU/EN, права и источники
сохраняются. Cursor сохраняет original upperId/afterId и все внешние поля;
меняются только articleScan.lastWindow/exhausted. Status partial сохраняется
при неудавшемся элементе: завершение обхода не объявляет перевод успешным или
проверенным редактором. Повторное чтение выключает continuation; explicit
fresh остаётся отдельным действием.

Новая additive миграция, созданная через Supabase CLI 2.120.0 migration new:
supabase/migrations/20261007235851_admin_article_translation_scan_completion.sql.
SHA256: 2b3c22c4519431accb42054c844999278bdca02ba3d783151aa8f40eed42d810.
Public RPC: (p_job_id uuid, p_expected_cursor jsonb) -> jsonb DTO
{id, kind, status, resumeCursor}. Public SQL-standard wrapper SECURITY INVOKER
связывает private helper при определении функции; новая private namespace
probpera_translation_operations не получает USAGE для authenticated/anon/
service_role. Helper проверяет auth.uid/is_staff, strict cursor/RFC UUID,
finished job status и whole-JSON expected cursor под FOR UPDATE. При наличии
eligible published/nondeleted ID в (afterId, upperId] возвращает 40001.
Успех меняет cursor/version/updated_at и добавляет одну audit запись в той же
транзакции; replay старого expected intent сохраняет версию и audit. Ошибка
audit откатывает изменение job. Existing record zero-items guard, старые
translation migrations, M02 private namespace и service-only lease API не
менялись; table write grants staff не расширены.

Actual application adapter принимает только совпадающий job/kind/finished
status и полный desired JSON. Original p_expected_cursor передаётся без
сведения к articleScan; case/order JSONB не дают ложный неподтверждённый исход.
Missing capability -> translation_migration_required, CAS -> write_conflict,
stop -> translation_operation_stopped, invalid -> translation_resume_stale.
Обычный reject, неизвестная ошибка или повреждённый DTO дают
translation_scan_unconfirmed с сохранённым articleJob; native Next signals
пробрасываются. Missing capability не создаёт fake item/job или paid repeat.

Одинаковый maintained fixture:
apps/admin/app/(dashboard)/translations/article-terminal.integration.test.ts
SHA256: 2ccb39745671ebcb90907d9a4641e7c4a8b58e3e053738e1aa35adfe9799138e.
BEFORE 2 PASS / 39 FAIL -> CURRENT 41/41 PASS, pending0,
sourceUnchanged=true; actual module graph 23 -> 24 включает новый helper только
в current. Native Next action/resume/SSR и настоящие parsers/SDK подключены;
Auth, SDK candidate selection/job persistence, provider, build, clock и
useFormStatus(pending=false) контролируются fixture. Installed Supabase SDK
2.112.3 RPC отдельно проходит controlled fetch. Это не real Auth/DB или browser.
Pair: .tmp/m07-terminal-paired-final.json
SHA256: af5c6136fa995c2a7a759230e01742520233a167b7de7e9bca31559cf6b18103.
Прежние scan61 и batch58 fixtures не менялись и входят в свежий общий прогон.

Native PostgreSQL 17.11: одинаковый common contract на baseline/current
schemas, actual старые SQL migrations и новая миграция byte-for-byte.
BEFORE завершился actual SQLSTATE42883 / exit1 / FAIL; CURRENT exit0,
PASS8/8 групп: existing receipt, idempotent audit, malformed/missing,
whole cursor CAS, late eligible, audit rollback, cancellation, private/role ACL.
32 malformed cursors + 4 invalid job UUID дают 22023; valid typed missing UUID
дают P0002, malformed SQL cast даёт 22P02. Nil/max/uppercase RFC cursor
проверены на exact stored idempotent receipt. SQL uuid канонизирует допустимые
hyphenless/braced аргументы до вызова; текстовая строгость входа у app parser.
Native-summary: .tmp/m07-terminal-sql-final-v2-native-summary.json PASS57/57.
SHA256: b212377a8e1dbe585e9f39b61b2cf3fe21952bb68d43cf9c491665885648b304.
Common contract SHA256:
a8d36113b2b53ab49a628f74f7d8d750b9527d3908ec6caf982bc3f53a8d266e.
Reports: .tmp/m02-postgres-tools/native-cases/
m07-terminal-before-20261008001212202-28852-481e56be/result.json и
m07-terminal-current-20261008001247958-15784-d99a13c0/result.json.
Оба собственных PostgreSQL server остановлены, alias removed, workspace
files preserved. Actual SQL invoker работает без private USAGE; прямой helper,
nonstaff/noactor/anon/service и staff worker claim/complete заблокированы.

Captured actual native DTO принят actual TS helper/parser через installed SDK
и controlled transport: .tmp/m07-terminal-native-boundary-v2.json PASS16/16.
Это связывает SQL returned shape и client parser; настоящего HTTP-to-DB запроса
через managed PostgREST нет. Native auth/users/memberships/is_staff и articles
schema синтетические, SQL/RLS/transaction выполняются PostgreSQL. Existing
M02 private schema migration в этом fixture не применялась; её bytes сохранены.
Late-candidate проверка моделирует последовательное interleaving; завершение
подтверждается на read snapshot, без обещания immutable archive membership или
multi-session phantom-free результата.

Diagnostics сохранены как FAIL: первый SQL fixture final-v1 имел 22P02 из-за
JSONB concatenation в export; исправлен только ignored builder, обе стороны
повторены на одинаковом final-v2. Первый root boundary ошибочно сравнивал общий
audit после отдельной cancellation с первым completion; сохранён FAIL15/16.
Final boundary сверяет actual snapshots до/после replay: audit3/3; audit4 в
конце включает независимую fixture cancellation. Runtime для этих исправлений
не менялся, DB повторно ради root artifact correction не запускалась.

Свежие проверки final183: 4963/4963 PASS в 166 suites, skips/todos0,
Next admin build, оба TypeScript configs, client-secret scanner и существующий
readonly text gate PASS. Evidence .tmp/m07-terminal-tests-command.json,
.tmp/m07-terminal-gates-command.json и .tmp/m07-terminal-combined-final.json.
Final source-bound verification: .tmp/m07-terminal-final-verification.json
PASS666/666: current183/original178/capture183, exact paired source graphs,
native DTO/ACL/cleanup, 4963/gates5, excluded dependencies/configs/normalizers,
independent Telegram files и git diff --check. Из предыдущих180 изменены только
article-actions.ts и translation-errors.ts; добавлены helper, fixture и SQL.
Broad session59456 и gates38418 terminal exit0; собственных live jobs нет.

Production/managed Auth/PostgREST/real account RLS/admin-e2e NOT_VERIFIED.
Новая миграция подготовлена, применялась только в изолированном fixture;
release ledger/allowlist/planner не менялись, production migration не применена.
No push/deploy/paid provider/social dispatch. Full goal остаётся active.

### M07: RU hash/revision guard для будущего адресного retry, 8 октября 2026

Следующий локальный increment выполнен от immutable fingerprint `dcdd5fa3b9741c6add98c50c1548b8d741e4bcffb786ee2503bd27b418a67fff`/183.
Capture `.tmp/m07-retry-before/manifest.json` сохранил 189 исходных файлов,
включая шесть ранее чистых зависимостей. Из прежних 183 sources изменён только
`apps/admin/lib/auto-translate-published-article-premium.ts`; добавлен один
`apps/admin/lib/article-retry-source.integration.test.ts`. Остальные 182 sources,
старые fixtures, обе прежние translation migrations, terminal migration,
M02 private migration, независимые Telegram-файлы и dependencies сохранены.

Actual helper принимает optional `expectedSourceHash`/`expectedSourceUpdatedAt`.
Если передано любое из двух полей, обязательна полная валидная пара:
lowercase64hex hash и точная действительная RU revision. Текущие hash/revision
проверяются до EN read, expensive attempt, translator и write. Несовпадение
или неполная/повреждённая пара возвращают `stale`; 21 соответствующий scenario
показывает ноль EN reads, attempts, simulated provider calls и writes.
Оба поля отсутствуют: прежний обычный маршрут сохраняется. Будущий retry caller
обязан получить проверенный item/source intent и потребовать оба поля;
этот helper сам не восстанавливает историческую revision из журнала.

Computed hash и валидная RU revision возвращаются в результате, включая отказ
EN read. Native Next control-flow сохраняется в article/EN/latest/save/audit
fulfilled errors и provider catch. SAME55 содержит 12 actual native Next
signal scenarios; это не проверка настоящего HTTP/Auth или атомарности БД.
Manual/current/deleted/unknown ownership, legacy no-intent и прежний EN CAS
сохраняются в границах локального fixture. Авторские RU/EN, права и источники
не переписаны из-за добавления guard.

| Проверка | BEFORE | CURRENT | Артефакт |
|---|---|---|---|
| Одинаковый immutable final-v2 SAME55 fixture, actual graph10/10 | 24 PASS / 31 FAIL, exit1 | 55/55 PASS, exit0, pending0 | `.tmp/m07-retry-source-paired-final-v2.json` |
| Свежий combined run на текущих 184 sources | historical evidence отдельно | 5018/5018 PASS, 167 suites, skipped/todo0 | `.tmp/m07-retry-source-v2-tests-command.json` |
| Actual admin build, оба TypeScript configs, client-secret scanner, readonly text gate | первый text gate FAIL сохранён | 5/5 PASS, все exit0 | `.tmp/m07-retry-source-v2-gates-command.json` |
| Source-bound manifest, captures, fixtures, authored semantics, exclusions и diff check | immutable исходные bytes сохранены | 851/851 PASS | `.tmp/m07-retry-source-v2-final-verification.json` |

Final pair SHA `f81ea15c97248fedccc926229dd6ee4fd1dec466c6bcbe6dc3563e231bf1199e`;
fixture SHA `7bc8fcb96491e663949a758f0fb304815b2084d6e42f43d787be0321f31b7da6`.
Baseline/current commands SHA соответственно
`6239fbf7f458b0fc0ef48610015ae9495eb57b65d1ee67af453dbdaf2eff0c82` и
`48deb9ca3827ce25004be7eded3d8fdac952cccf92bbd5048e2c958392f748a4`.
Общий fingerprint184 зафиксирован в `.tmp/m07-retry-source-v2-final-source-fingerprint.json`.
Все actual helper/hash/classifier/ownership/budget/Next modules исполняются;
Auth, SDK persistence/CAS, runtime gate, translator и provider transport
контролируются fixture. Simulated provider passes не являются платными вызовами.

Первый общий run 5018/167 на прежнем физическом fixture и gates FAIL
сохранены в `.tmp/m07-retry-source-*-command.json`. Gate нашёл две raw U+2014
в новом fixture; только они заменены на literal `\u2014`. Новый immutable v2
повторён на обеих сторонах. Все TypeScript cooked literals равны; 110 traces
сохраняют полный original RU/EN и фактические права/источники/hash/input.
Четыре timestamps свежего generated EN исключены только при сравнении generated
результатов между отдельными запусками; original snapshots сверяются полностью.
Runtime RU hash `d35ed52c1993d7315f4101a00ce6ec522fd54bc209755d824fa3cc26c7004c14`
не изменился. Нормализаторы, их вызовы/правила/тесты не изменены, `--write` не запускался.
Первый gate FAIL не переименован в PASS; final-v2 имеет собственные свежие proofs.

Это VERIFIED_UNIT/LOCAL_INTEGRATION foundation, не full M07-T13 acceptance.
UI/action/RPC get/begin/finish, operation receipt/dedupe, unknown reconciliation,
same-item attempt journal и private EN draft persistence ещё не реализованы.
Existing helper сохраняет прежние published/human-review/approval marks;
M07-T05 этим шагом не принят. Latest RU read и EN write остаются разными
транзакциями; ordinary audit failure не стал атомарным. T02/T03 также pending.
Новой миграции или native DB run в этом increment нет; прежние isolated SQL
proofs остаются историческими в их границах, managed Auth/DB/RLS/production
NOT_VERIFIED. Push/deploy/production migration/paid/provider/social dispatch не было.

### M07: отдельный повтор failed item и private EN working draft, 8 октября 2026

Продолжение от `134cd90a84dc6c2710982617ee69940786ebb5f681d4bae6da56fedfb21ef494`/184.
Immutable capture `.tmp/m07-item-retry-before/manifest.json` содержит 190 sources;
recursive before graph содержит 59. Из предыдущих 184 изменены ровно пять:
published helper, translation page, article-actions, resume-action, translation-errors.
Остальные 179, независимые Telegram6, исторические SQL, M02 private namespace,
normalizers/calls/tests, runtime config, зависимости и migration planner сохранены.
Добавлены семь файлов: private RU DTO builder, precise retry revision comparator,
strict item retry adapter, отдельный server action, две integration fixtures и
`supabase/migrations/20261008005802_admin_article_translation_item_retry.sql`.
Миграция создана фактическим Supabase CLI2.120.0 `migration new` локально;
её наличие не означает применение в managed DB. SQL SHA:
`f14313167ff2ec5f0e01d14639fe8d4501e5bb525becb69f95c7ca7936aa67a4`.

Выбранный failed article item теперь имеет отдельное UI намерение, отличный
от continuation всего корпуса. Все 500 элементов bounded package доступны
селектору. Form сохраняет operation UUID, job/item/version/attempt/hash.
GET только читает результат; BEGIN связывает actor/domain/provider/проверенные
RU hash/revision и EN CAS, без повторного допуска того же operation.
FINISH добавляет следующую attempt в тот же job/item и атомарно сохраняет audit,
счётчики и подтверждённый результат. Scan cursor не перемещается. Предельные
версии проверяются до BEGIN; historical GET остаётся читаемым. Existing service
claim/complete ACL не расширены, staff sync не превращён в lease worker.

Private ветка helper сначала проверяет полный совместимый RU DTO и отсутствие
авторского working draft. Manual/current EN, неподтверждённые reads, stale source,
неверный EN token и недоступная capability не дают платного допуска.
Общий budget: одна attempt, максимум четыре provider calls, deadline300000ms.
Успех сохраняет только existing private working draft с scope=english-only и
enabled EN; опубликованные RU/EN не записываются. Machine EN имеет status=draft,
reviewed_at/approved_at/published_at=null. Повтор FINISH возвращает прежний receipt
без второй записи/audit/attempt. Cancel, смена RU/EN и draft после модели получают
фактический отказ без ложного translated success. При неизвестном provider/FINISH
результате operation остаётся pending; GET не запускает новый платный запрос.
Обычный legacy helper сохранён; его прежние human/publication marks этим шагом
не исправлены и M07-T05 целиком не принят.

Фактический native JSON показал UTC receipt и +03:00 table spellings одного
момента. Новый private-only comparator сравнивает момент и сохраняет все
fractional digits, а исходные CAS strings остаются в intent неизменными.
Один microsecond различия продолжает блокировать запись. Legacy source guard
сохраняет прежнее сравнение. SQL limits теперь соответствуют UTF-16 длине
existing Zod DTO: 120 emoji в title допустимы, 121/240 отклоняются.
HTTP URL validator использует явно ограниченный совместимый поднабор:
нетипичные credentials/IDN/special numeric hosts блокируются без переписывания
URL. Полная WHATWG/Zod URL parity не заявлена.

| Проверка и одинаковый fixture | Исходное поведение | Текущий результат | Evidence |
|---|---|---|---|
| SAME61 private helper, original authored RU/EN | 13 PASS / 48 FAIL; фактическая canonical EN write и human marks | 61/61 PASS, canonical writes0 | `.tmp/m07-item-retry-paired-proof-v2.json` |
| SAME61 private helper до precise revision fix | 57 PASS / 4 FAIL | 61/61 PASS, intent strings сохранены | тот же source-bound pair |
| SAME9 actual SSR UI | 0 PASS / 9 FAIL, отдельная команда отсутствует | 9/9 PASS | тот же pair; browser E2E не заменяет |
| Новый action/adapter/UI | прежних exports нет; false baseline не создавался | 77/77 PASS, current-only | `.tmp/m07-item-retry-action-current-final-v2-command.json` |
| SAME native SQL contract, isolated PostgreSQL17.11 | actual42883 FAIL, capability отсутствует | 11/11 groups PASS incl CAS/cancel/rollback/ACL/multisession/UTF16/URL | `.tmp/m07-item-retry-sql-final-v6-native-summary.json` |
| Фактические9 native DTO через actual adapter/installed SDK | separate boundary | 58/58 PASS, controlled fetch19 | `.tmp/m07-item-retry-action-native-final-v4.json` |
| Actual working draft strict parser/read models и true canonical before-after | original v6 success + отдельный export-v1 replay | 48/48 PASS | `.tmp/m07-item-retry-native-read-model-proof.json` |
| Свежий combined run на191 sources | первый FAIL5073/5156 сохранён | 5156/5156 PASS,169 files, skipped/todo0 | `.tmp/m07-item-retry-v2-tests-command.json` |
| Next admin build, оба TS configs, client-secret scanner, readonly text gate | прежние результаты historical | 5/5 PASS, actual exit0 | `.tmp/m07-item-retry-v2-gates-command.json` |
| Source-bound aggregate всех текущих captures/proofs/exclusions/diff | immutable captures и диагностика сохранены | 1177/1177 PASS | `.tmp/m07-item-retry-v2-final-verification.json` |

Final current fingerprint191:
`.tmp/m07-item-retry-v2-final-source-fingerprint.json`.
Команды combined/gates: actual Node `.tmp/m07-item-retry-v2-checks.mjs tests`
и `gates`; broad169 selection в `-v2-final-tests.txt`, maxWorkers2.
Pair proof316 SHA `d45b3f788eaeb38ba7db4e5d876df57aef1641fcccb64297293ddf31e2150de2`.
Native SQL summary SHA `9d6752ed746fb57fe80505ca60def8a08a8487361f329c48f8b2cb0b11585c2a`.
SDK proof58 SHA `9c65e0da56192adbb636d2517b5abdeb165ee0ea3fb8b96d3c736600288a762b`.
Read-model proof48 SHA `adb31ccc73a57b267baff52bdcd3f059e992982a0a8559f6e2fa610b6fd4fb8c`.
Две maintained fixtures заморожены: private61 SHA
`0ca80d92a0021aff8a933929c460c6fb4cc3b900c4f914408a76091d74cd401a`,
action/UI77 SHA `5482c3827d8734bf6b443f0635e6766c2d0e687028e0c6c72585c5dd2535c510`.
Ранее закрытые guard55/scan61/batch58/terminal41/unit32 fixtures не изменялись.

Первый broad191 выявил eager NEW auth import при обычном GET: все старые83
translations-load-errors cases упали на React.cache в старом harness.
Новый импорт перенесён в явно выбранный retry scenario; staff read остаётся
перед новыми запросами, POST guard сохранён. Те же old83 + new77 прошли160/160,
затем заново выполнены broad5156 и gates5 на final191. Первый FAIL и fingerprint
`93132bc4b609a4390ff9feadc544c4b7fa12d3036d49248ba8d2fc90ed130d3d`
остаются historical. SQLv1 fixture claim expectation FAIL, промежуточные native
v2/v3/v5, SDKv1 source-binding54/55 FAIL, suite fixture diagnostics и bridge
47/48 с чрезмерной selected-source assertion сохранены без переименования в PASS.
Неисполненные SDKv2/v3 и SQLcurrentv4 не считаются PASS.

Это VERIFIED_UNIT/LOCAL_INTEGRATION плюс isolated VERIFIED_DB и application
read-model boundary. Native использует synthetic Auth/staff и simplified canonical
tables с фактическими old translation SQL и working draft schema/save function.
Full M02 private migration не применялась заново. Export-v1 добавляет отдельную
инструментацию фактических before/after, не выдаётся за SAME immutable v6 run.
Installed SDK использует controlled fetch, переводчик/Auth/gates в application
fixtures замокированы. Настоящие GoTrue/MFA/PostgREST/managed RLS, authenticated
admin browser, provider transport и production NOT_VERIFIED.
Существующий private EN read model сохраняет прежние reviewed_by/approved_by IDs
из canonical EN при null review dates и draft status. Это явно оставшаяся
read-model граница; новые human IDs не выдаются за подтверждённое утверждение.
Unknown operation не имеет automatic expiry или manual reconciliation UI.
Полная M07-T13/T05/T02/T03 приёмка, M02/M04/M13 и M00..M25 не закрыты.
Все собственные native servers/sessions завершены; fixture artifacts сохранены.
Push/deploy/production migration/paid/provider/social dispatch не выполнялись.

### M07: первый retry POST и одинаковый native browser fixture, 8 октября 2026

Продолжение предыдущего slice выявило фактическое несовпадение initial GET и
SQL-контракта. Форма создаёт новый operation UUID; specific GET такого UUID
возвращает P0002, потому что попытка ещё не началась. Actual native SQL отдельно
подтвердил P0002 и ready при GET(null). На исходном коде настоящий browser POST
завершался database_read_failed до BEGIN/model; explicit fresh-operation query
также не давал рабочую форму. Старые controlled mocks возвращали ready при
specific fresh UUID и этой границы не проверяли. Их исторические результаты
сохранены, full M07 acceptance из них не выводится.

Новый selection helper выполняет отдельный GET(null) только после подтверждённого
fulfilled specific GET с data=null и точным P0002. Ошибки доступа, конфликт intent,
rejected/contradictory/malformed responses и null-operation P0002 остаются отказами.
Такой read не разрешает платный запрос: actual BEGIN, source revision, manual EN,
authored private draft, runtime gate и CAS checks остаются обязательными.
После BEGIN reconciliation по operation UUID сохраняет прежний строгий GET;
неизвестный результат не превращается в право новой генерации.

Изменены только три существующих файла: article-translation-item-retry.ts,
article-item-retry-action.ts и translations/page.tsx. Добавлен один maintained
34-case admission fixture. Прочие 188 selected sources предыдущего fingerprint
не изменены. Новая/старые SQL migrations, M02 exact9 namespace, старые fixtures,
normalizers и их вызовы, шесть независимых Telegram sources, зависимости и
migration planner сохранены. Capture предыдущего кода содержит 211 источников.

| Проверка | Исходное поведение | Текущий результат | Evidence |
|---|---|---|---|
| SAME34 actual action/page/adapter admission fixture | 16 PASS / 18 FAIL | 34/34 PASS; source-bound pair153/153 | `.tmp/m07-item-retry-admission-paired-proof.json` |
| Отдельный actual PostgreSQL17.11 admission capture | fresh-specific P0002 и отдельный null-ready подтверждены | 12 записей с actual JSONB/SQLSTATE | `.tmp/m07-item-retry-sql-admission-v1-proof.json` |
| Current adapter/installed SDK, 9 прежних native DTO и новые admission records | прежний v4 historical | 75/75 PASS, controlled HTTP envelope | `.tmp/m07-item-retry-action-native-final-v5.json` |
| SAME Next16/Chromium fixture и runner v4 | 11/11 assertions воспроизводят исходный отказ, это не acceptance | 60/60 checks в 12 scenario groups | `.tmp/m07-item-retry-browser-final-v5-summary.json` |
| Fresh combined final192 | прежние результаты historical | 5190/5190 PASS,170 files, skipped/todo0 | `.tmp/m07-item-retry-admission-tests-command.json` |
| Admin build, оба TS configs, client scanner, readonly text gate | actual terminal commands | 5/5 PASS, exit0 | `.tmp/m07-item-retry-admission-gates-command.json` |
| Root source/artifact/fixture/cleanup/Git verification | v1 path-mapping diagnostic сохранён | 1523/1523 PASS | `.tmp/m07-item-retry-admission-final-verification-v2.json` |

Браузер выполняет actual form POST/303/GET, reload, duplicate того же operation
с specific ledger GET и неизменными model/BEGIN/FINISH/attempt/audit/private bytes.
Committed FINISH с потерянным ответом подтверждается GET. Uncommitted FINISH и
provider unknown остаются pending: действие «Проверить квитанцию» выполняет GET
без нового перевода. Manual EN, author working draft, kill switch и loss of access
после ready блокируют BEGIN/model. Corpus continuation отдельно проверяет traversal
remaining IDs/cursor; производство следующего перевода этот fixture не доказывает.

Одинаковы 11 fixture files и browser runner; actual compiled graphs по 50 sources
на каждой стороне. BEFORE graph включает captured files и неизменённые HEAD
dependencies. Browser final summary122 проверяет источник, fixture и cleanup;
это 122 binding checks, не дополнительные browser scenarios. Собственные четыре
server launcher sessions завершились exit0, их PIDs отсутствуют, loopback3162
свободен; root проверил порт отдельно. Артефакты и diagnostics сохранены.

Final fingerprint192 хранится в
`.tmp/m07-item-retry-admission-final-source-fingerprint.json`.
SAME34 fixture SHA `7cf95875a557b108cb7653795baff6d1697bf572ce5fc350899e55841bee2d77`.
Pair153 SHA `0ed609ac086f6754bfad0df81f60c0a476b3d1010742a9c795b75b06e274fb6d`.
Browser summary122 SHA `a9e249fcdf172cc5f3ac337de5fbc112cf866a9192be3933d95bb1cbf7e6b88f`.
Actual commands: Node `.tmp/m07-item-retry-admission-root-checks.mjs tests`/`gates`,
browser prepare/server/run-v4 commands и их stdout находятся в native summary.

Diagnostic fixture v1 ошибочно ожидал другой errorCode при strict GET(null)
P0002; mapping database_read_failed сохранён, SAME v2 исправляет только expectation.
Browser v1 ambiguous continuation locator и current-v2 same-URL observation race
не были runtime failures. V3 использовал более слабое подтверждение duplicate;
final v4 проверяет actual POST и specific GET. V4 summary
121/122 ошибочно называл путь existing parser, final v5 меняет только verifier.
Root aggregate v1 ошибочно искал captured graph paths как original source paths;
final v2 связывает actual proof paths и неизменённые HEAD dependencies. Все FAIL
diagnostics сохранены отдельно, final evidence и runtime не переписывались.

Это LOCAL_INTEGRATION/native Next browser плюс отдельный isolated PostgreSQL.
Actual application guards/actions выполняются; Auth/SDK ledger/provider/persistence
и каталожные данные в browser fixture контролируются. Native SQL использует
synthetic staff/Auth и schema из прежнего isolated контракта. Реальные managed
GoTrue/MFA/PostgREST/DB/RLS/provider transport и production NOT_VERIFIED.
Unknown provider attempt после потери процесса не имеет достаточной durable
dispatch/result provenance для безопасного нового paid retry. Read-only receipt
этому не равен; expiry/timeout не доказывает отсутствие принятого запроса.
Reviewer IDs в derived private EN и legacy ordinary helper остаются pending.
Полная M07-T13/T05/T02/T03 приёмка, M02/M04/M13 и M00..M25 не закрыты.
Push/deploy/production migration/paid/provider/social dispatch не выполнялись.

### M07: журнал запросов и идентификаторы проверки, 8 октября 2026

Продолжение с предыдущего e432/192 без нового общего аудита. До первой правки
сохранены 225 исходных файлов в `.tmp/m07-reconciliation-before/manifest.json`
(SHA `529ad0121cf82bec13e33495d6a6999f70892676bf66420628a264d04fa27428`).
Шесть отсутствовавших в этом capture, неизменённых HEAD dependencies сохранены
отдельно; старый capture не дополнен и не переписан. Новый f277/196 содержит
семь изменений существующих runtime-файлов и четыре новых файла (три fixture
и одна additive SQL migration); остальные 185 выбранных источников сохранены.

Реальная private item retry цепочка теперь требует подтверждённой записи каждого
translation/repair/review допуска до входа в provider transport. Descriptor
содержит callId, provider, model и pass. Только первый подтверждённый допуск
возвращает canDispatch=true; replay, GET, повреждённый/неоднозначный ответ и
отсутствующая capability не разрешают новый запрос. После получения envelope
строго записываются responseReceivedAt, HTTP status при наличии, correlation
requestId, отдельный payload responseId и token counters при наличии. Текст
ответа/источника и сырые ошибки не входят в metadata. Ошибка чтения JSON body
не выдаётся за подтверждённое получение envelope. Optional hook проходит через
обе premium article цепочки; вызовы без него сохраняют прежнее поведение.

Новая CLI-created migration:
`supabase/migrations/20261008021735_admin_article_translation_item_retry_journal.sql`,
SHA `4427c8f38a995791a717eb3af8d7abef1abf6a3882ebf4b8d594b9575de9c790`.
Три public SECURITY INVOKER RPC используют существующий operation context.
Проверяются actor/domain/entity/provider/frozen intent/sourceSnapshot/CAS/manual
EN/working draft до каждого допуска; порядок pass, максимум четыре допуска,
idempotency, ACL и отсутствие неизвестного предыдущего ответа. Новые таблицы,
очередь и service-role расширения не добавлены. FINISH атомарно сохраняет
progress в прежней квитанции вместе с private draft/audit/attempt и требует
совпадения providerCalls с durable journal, если journal существует. Неизвестный
ответ не принудительно завершается по возрасту. Старый FINISH без journal
совместим; legacy startedAt остаётся null, даты не выдумываются.

Actual translations GET показывает допуски и их model/pass/response metadata,
отдельно неизвестный результат и ошибку чтения journal. GET/reload не выполняет
перевод. Допуск не доказывает принятие платного запроса провайдером; metadata
не доказывает сохранение/проверку текста. Подтверждённый SQL40001 до следующего
transport завершает conflict с числом прежних durable ACK, сохраняя текущий
авторский RU/EN; rejected/повреждённый RPC остаётся unknown. Подтверждённое
закрытие runtime self-test gate до dispatch завершает not-configured с 0/1
допусками вместо зарезервированного budget slot. FINISH также должен подтвердиться.

В derived private working draft убрано наследование чужого human reviewer ID,
если соответствующая дата private review/approval отсутствует или отличается
от выбранной canonical даты. Точное совпадение сохраняет ID, narrow projection
без поля ID не добавляет его. Исходный payload/даты/CAS/ручные данные не меняются.
Это исправление metadata; actual editor уже использовал private approval date,
поэтому ложный visible approved PASS этим дефектом не был воспроизведён.

Проверяемые SAME fixtures и фактические результаты:
- Reviewer identity: исходно 12 PASS / 9 expected FAIL, current 21/21 PASS;
  `.tmp/m07-review-identity-paired-v4-proof.json`, 63/63 source/evidence checks.
  Actual edit loader/preview/helper проверены; прежние три fixture 201 PASS
  сохранены. Полные данные RU/EN/rights/source и precise instant сохраняются.
- Provider transport: исходно 4 PASS / 30 expected FAIL, current 34/34 PASS;
  `.tmp/m07-provider-journal-paired-proof.json`, 163/163 source/evidence checks.
  Final read-only rebind `.tmp/m07-provider-journal-final-v2-rebind-proof.json`
  65/65 относится к неизменённому actual graph28 и не подменяет новый action test.
- Actual page journal: исходно 1 PASS / 3 expected FAIL, current 4/4 PASS;
  before-v3/current-v4 command/results/trace в `.tmp/m07-reconciliation-ui-*`.
  Fresh current actual graph20 привязан к final sources; ещё 24 current-only
  DTO/installed-SDK проверки входят в maintained fixture из 28 случаев.
- Native PostgreSQL 17.11: SAME baseline actual42883 (capability отсутствует),
  current 10/10 групп, включая multisession и выполнение старого FINISH;
  `.tmp/m07-item-retry-journal-sql-final-v3-proof.json`. Экспортированы actual
  10 progress DTO, 20 SQLSTATE code/message/label и 2 старые квитанции.
  `.tmp/m07-item-retry-journal-sdk-final-v2.json`: 76/76 checks через установленный
  SDK, exact +03 instant/1 microsecond guards. HTTP400 replay контролируемый;
  original error arguments не экспортированы и не объявлены воспроизведёнными.
- Native Next16/Chromium SAME fixture10/runner-v4: BEFORE 25/25 наблюдений
  старого no-journal поведения, CURRENT 91/91 проверок в 10 scenario groups.
  `.tmp/m07-dispatch-journal-browser-final-v1-summary.json`, SHA
  `7cb9ead4d461e56365dd0ca894f4e2396c3371db5556e79132ccec736262183f`.
  Actual graph59/action SHA `02053a57a11f03f36093ba2a7bcf00715985b28904faeccc6df26ffc08f3b8fe`;
  binding-entry счётчик вызывается до fixture guards и подтверждает 0/1/2 входа.
  POST303/specific operation GET/reload/duplicate, ACK loss, provider timeout,
  known source conflict, private success и privacy проверены; 217/217 отдельных
  binding/cleanup checks не являются 217 браузерными сценариями. Midpass stop
  проверяет fresh self-test test_passed=false, не per-pass environment kill-switch.
  Все 17 собственных PID/8 launcher завершены; порт3164 свободен.

Финальный fresh прогон на f277/196: 5273/5273 tests в 173 файлах, без skip/todo;
admin build, оба TypeScript-конфига, client-secret scanner и неизменённый readonly
text gate прошли (5/5). Команды/даты/exit/log SHA/sourceUnchanged:
`.tmp/m07-reconciliation-v2-tests-command.json` и `-gates-command.json`.
Независимая сохранность: `.tmp/m07-reconciliation-v2-protected-proof.json`,
672/672 source-only checks. Root aggregate
`.tmp/m07-reconciliation-v2-final-verification.json`: 915/915 source/evidence
checks, реальные commands/results, final fingerprint и cleanup связаны явно.
Telegram6, normalizer wholefiles/call projections/tests, dependencies/lock,
старые SQL/f143, M02 exact9 и planner/allowlist сохранены. --write не выполнялся.

Диагностики сохранены: первые NEW fixture ошибки и недостаточные captures,
коллекция старых tests из-за нового alias import, неподходящая gate fixture,
ошибочное ожидание running после подтверждённого conflict и учёт AI binding
после guard. First broad 5273 PASS сохранился отдельно, но его text gate был FAIL
из-за literal U+2014 в NEW fixture. Только запись этого символа изменена на
Unicode escape с точным равенством runtime строки; исключённая подсистема не
менялась. Final f277 также включает confirmed-conflict action fix; поэтому
fresh broad/gates/action browser выполнены заново. Старые FAIL не переименованы.

Границы: native SQL использует synthetic Auth/canonical tables; Next выполняет
actual pipeline/transport/validators, но Auth/SDK journal/AI.run контролируются.
Эти отдельные проверки не составляют managed Auth/PostgREST/DB/RLS integration.
Реальный provider, стоимость, production и исходный Supabase402 NOT_VERIFIED.
Потерянный текст после response metadata, но до atomic FINISH, ещё не восстановим:
durable validated private candidate до FINISH пока отсутствует. Request ID
не является правом paid retry; OpenAI store:false не изменён. Legacy обычный
published helper и full M07-T13/T05/T02/T03, M02/M04/M13/R3 остаются pending.
Push/deploy/production migrations/paid calls/social sends не выполнялись.

### M07: сохранённый private candidate и явное восстановление, 8 октября 2026

Продолжение с f277/196 без общего аудита и отката закрытых изменений. До первой
правки сохранены 235 исходных файлов, включая прежние выбранные196 и необходимые
HEAD dependencies: `.tmp/m07-candidate-recovery-before/manifest.json`, SHA
`67746479a64ed066433a7210beebf1ccd39dd57749cab66b34bf84edf7f45e62`.
Final9fd6/200 меняет четыре существующих runtime и три существующих test fixture,
добавляет три fixture и одну additive SQL migration; остальные189 selected
не изменены. Из235 captured current источников228 неизменны; эти области
пересекаются, их размеры не складываются.

После полной проверки translation/review и построения полного EN envelope
private item retry теперь сначала сохраняет validated candidate в существующий
`article_working_drafts`, затем перечитывает RU и завершает учёт. Отдельная
таблица/очередь не добавлена. Текст хранится целиком в private row, включая
проверенный synthetic envelope больше16KiB. Bounded operation metadata содержит
только hash, frozen outcome, точные CAS и указатель version/updatedAt; metadata
не является копией текста. STAGE создаёт одну working draft version, FINISH или
RECOVER подтверждает ту же строку без повторного сохранения/увеличения версии.
No-hook legacy helper сохраняет прежний порядок действий.

Новая CLI-created migration:
`supabase/migrations/20261008031428_admin_article_translation_item_retry_candidate.sql`,
SHA `2e139648d8bdddc98bacc7faf68be899bc80a41e271f168dbf41f7ec37bcf206`.
Три защищённых RPC STAGE/GET/RECOVER используют существующий actor/operation/item
context. Проверяются original sourceSnapshot/hash, precise RU/EN revisions,
manual EN, текущая private version/body и подтверждённые provider responses.
Candidate hash включает RU snapshot, EN envelope и frozen outcome. Старый
FINISH без candidate совместим. M02 private namespace exact9 и прежние SQL
сохранены; production planner/allowlist не расширен этой локальной миграцией.

Actual retry POST проверяет candidate capability после BEGIN до первого provider
dispatch. Отсутствующая capability останавливает запрос с0 model entries; успех
записи not-configured должен отдельно подтвердиться. Сбой позднего RU read,
неоднозначный STAGE ACK или FINISH оставляет committed candidate и незавершённую
квитанцию. GET/reload не запускает перевод. Actual translations UI показывает
неполный учёт отдельно и явную кнопку «Завершить учёт сохранённого перевода».
Четыре поля recovery POST: job_id, item_id, operation_id, candidate_hash.
Fresh Auth/actor/source/EN/draft guards обязательны; RECOVER не требует provider
self-test и не выполняет новый BEGIN, модель или сохранение второй строки.
Отмена завершает учёт с persistence=none, сохраняя полный private текст.

Независимая проверка нашла ещё один отказ: finished receipt другой draft version
после потерянного ACK мог подтверждаться повторным GET. Теперь adapter, обычный
FINISH, recovery, их reconciliation и page read model проверяют связь результата
с submitted candidate hash/context, точной draft version/updatedAt и исходным
числом provider calls. Микросекунды не округляются. Несовпадение не превращается
в зелёный успех; сохранённый текст остаётся в private row. Совместимость старых
finished receipts без candidate сохраняется в прежнем read model.

Фактические доказательства и границы:

| Проверка | Исходное поведение | Исправление и evidence |
| --- | --- | --- |
| SAME20 helper fixture | 6 PASS / 14 expected FAIL | 20/20 PASS; `.tmp/m07-candidate-recovery-final-paired-proof.json`, SHA `397e0017d7bf36f86a20f8266385937307313d7064241e446b2f26d0dfeefb16`; actual graph28 неизменён после прогона |
| SAME10 receipt binding fixture | 4 PASS / 6 expected FAIL на уже существующем recovery action | 10/10 PASS; `.tmp/m07-candidate-receipt-binding-before-final-v2-command.json` и `-current-final-v2-command.json`; maintained fixture byte-identical |
| Native PostgreSQL17.11 | Actual42883, новые capability отсутствуют | 10/10 групп, 22 независимых клиента; `.tmp/m07-item-retry-candidate-sql-final-v1-proof.json`, SHA `a79d77bb608f2f02482f842b886c21458aafb9025f2ec80574144497d891a510` |
| Native exports через installed SDK | Экспортированы actual DTO/SQLSTATE и original API args | Fresh `.tmp/m07-item-retry-candidate-native-sdk-final-v6-proof.json`, 886/886 checks,128 controlled HTTP calls; SHA `e7981dff2fd2a9a2806b5fcae58afae3a1fb3f461488d5a34f56292dc6d9f4f0` |
| Native Next16/Chromium SAME fixture/runner-v3 | 23/23 наблюдений двух прежних точек потери candidate | 272/272 checks в21 группах; `.tmp/m07-candidate-reconcile-browser-current-final-v3-evidence.json`, SHA `a3cffc5eb855c2fadf2a55fc95279d91428befb614605bff937da2e5adbfa0ef` |
| Final fresh broad/gates | Диагностические FAIL сохранены отдельно | 5355/5355 tests в176 файлах, без skip/todo; build, оба TypeScript configs, client-secret scanner, неизменённый readonly text gate 5/5; `.tmp/m07-candidate-recovery-final-v3-tests-command.json` и `-gates-command.json` |

Native SQL проверяет полный body отдельно от bounded metadata, precise CAS,
actor, manual EN/author draft/source guards, legacy FINISH, atomic rollback,
multisession locks и cancellation. Native Next выполняет actual page/actions/
private helper/premium transport/parsers и настоящие POST/redirect/reload.
Проверены normal success, поздний RU-read failure, lost STAGE/FINISH/RECOVER ACK,
rollback, explicit retry of accounting, duplicate original/recovery forms,
missing capability, provider unknown, manual EN/RU/body changes, author draft
edit/discard, Auth/role loss, cancellation, provider-config loss и три bad-receipt
пути. AI binding counter расположен до fixture guards. После восстановления
остаётся исходных2 model entries и ровно1 private save; raw body не попадает в UI.
SSR native form replay берёт настоящие $ACTION_ID поля и тот же frozen operation;
React runtime форму вручную не клонирует.

708/708 независимых source-only checks:
`.tmp/m07-candidate-recovery-final-v3-protected-proof.json`, SHA
`916f24c82fe757883c217a1031a0e44ab5e744d244cac02a57e4e88c0817eab3`.
Root aggregate `.tmp/m07-candidate-recovery-final-v4-verification.json`, SHA
`b2f872be01bae62932b1dec33c3a0cf9a9a6ae932d52d48a5830cb149033ffa6`,
587/587 source/evidence binding checks. Эти числа не являются отдельными
сценариями или критериями приёмки. Exact final manifest:
`.tmp/m07-candidate-recovery-final-v3-source-fingerprint.json`, SHA
`0e2e36ba693ca9ebf2867619d93ef60d1f682898a4d96889c7cad65b153238b9`.
Actual webpack graphs59 BEFORE/current привязаны к источникам; четыре собственных
launcher завершены, восемь известных launcher/Next-parent PID отсутствуют,
порты3166 и54329 свободны. Telegram6, normalizer wholefiles/tests/import/call
arguments, package/lock, old SQL, M02 exact9 и planner/allowlist сохранены.

Сохранены непрошедшие диагностики: V1 broad handle потерян, этот запуск
NOT_VERIFIED; V2 broad5353/5355 из-за двух старых mock и отдельный build/type
FAIL в новом fixture. Mock обновлены под реальный capability/journal/STAGE
контракт, UTF8-default typing исправлен без изменения поведения. Native runner
v1/v2 FAIL относятся к способу повтора React формы и новому UUID отдельного GET;
runner-v3 привязывает настоящий SSR form к original operation. Root aggregate
v3 неверно читал поле pass вместо passed у двух старых proof, v4 исправляет
reader; underlying evidence и failed artifacts не переписаны. Final broad,
gates, SDK и native browser относятся к неизменному9fd6/200.

Границы: isolated PostgreSQL использует synthetic Auth/canonical schema;
SDK/native Next используют controlled HTTP/SSR Auth/roles/ledger/AI.run.
Эти отдельные прогоны не являются managed Auth/PostgREST/DB/RLS integration.
Real provider/charges, production и исходный Supabase402 NOT_VERIFIED.
Потеря до committed STAGE, raw/intermediate непроверенный ответ и отсутствие
достаточного provenance остаются unknown; timer/new UUID не дают paid retry.
Legacy ordinary human-review/source-write T05/T02/T03 и full M07-T13 ещё pending.
Весь M07/M02/M04/M13/R3 не принят. Push/deploy/production migrations/paid calls/
social sends не выполнялись. Полная цель M00..M25/230 остаётся active.

### M07: обычный машинный перевод сохраняется в private EN draft, 8 октября 2026

Продолжение с9fd6/200 по ранее записанному следующему шагу, без нового общего
аудита. До первой правки сохранены239 исходных файлов:
`.tmp/m07-ordinary-private-before/manifest.json`, SHA
`65daa23bcaf45055dd941e0de4785300867a93ce836af73667c7b80cc6f93500`.
Final0e02/204 меняет10 существующих selected файлов (5 runtime,5 fixture),
добавляет adapter,2 fixture и additive SQL migration. Остальные190 selected и
229 captured current файлов не изменены; области пересекаются. Все239 исходных
копий сохранены. Предыдущие доказательства9fd6/200 остаются историческими.

Воспроизведено реальное прежнее поведение ordinary helper: прямой INSERT/UPDATE
канонического EN, автоматические review/approval/publication marks и отдельная
RU-read/EN-write граница. Новый ordinary маршрут после существующих manual/current/
deleted/unknown guards формирует полный RU snapshot и проверяет capability до
первого model entry. После двух существующих проходов переводчика сохраняется
только полный validated EN envelope в существующий `article_working_drafts`:
scope=`english-only`,version1,humanReview=`pending`. Review/approval/publication/
deleted dates нового EN равны null. Canonical RU/EN, их прежние одобрения,
ручные тексты, sources/media/rights и чужой author draft не переписываются.
Старый ordinary canonical writer удалён; compatibility fallback на прямую
каноническую запись отсутствует. Private item retry/candidate protocol сохранён.

Новая CLI-created migration:
`supabase/migrations/20261008043647_admin_article_machine_english_draft.sql`, SHA
`f7207a358f3b7c3bdeae1f5d088d80f50110bb0bd9732fb59021488c842b14ed`.
Два public SECURITY INVOKER RPC возвращают JSONB:
`get_article_machine_english_draft_context` принимает article UUID,source hash,
RU timestamptz,полный source JSONB и nullable expected EN timestamptz;
`save_article_machine_english_draft` дополнительно принимает полный EN envelope.
Context содержит version1,исходные identity/CAS,canGenerate/blockReason.
SAVE receipt дополнительно содержит workingDraftVersion1/updatedAt,scope,
publication=`unchanged`,humanReview=`pending`,persistence=`working-draft`.
Strict client DTO связывает receipt с исходными UUID/hash и precise RU/EN CAS;
невалидный/потерянный ACK не считается подтверждением сохранения.

Private helpers находятся в существующем translation namespace, проверяют fresh
auth.uid/owner/admin, имеют locked search_path. SAVE блокирует article → EN →
working draft, сравнивает полный текущий RU JSONB и точные revisions, повторно
проверяет manual EN/author draft и вызывает прежний working-draft writer с
expected version0. Private body и ограниченный success audit атомарны; ошибка
аудита откатывает запись. SQL не пересчитывает JavaScript source hash: полный
RU snapshot сравнивается независимо, hash связан с EN envelope/receipt.
Serializer/hash parity между SQL и JS не заявляется. M02 private exact9,
старые migrations и production planner/allowlist сохранены.

Article batch больше не запрашивает public build для подготовленного private EN.
Actual translations page показывает техническое completion отдельно от проверки
человеком и публикации, сохраняет прежний canonical EN count и ссылку на список
редакторов статей. Отдельно принятая RU-публикация продолжает enqueue/dispatch.
Legacy `requestPublicBuild` auto-helper branch по reason=`article.published`
добавляет только подтверждённые bounded private metadata; unconfirmed/forged
article receipt markers очищаются. Это не утверждение об автоматическом переводе
всех publication actions: `article.status.*` остаётся отдельным прежним маршрутом.
Новые пять metadata fields ограничены entityType=`article`; контракт SEO/других
публикационных событий сохранён. Shared save-unconfirmed classifier согласован
с новым safe error без вывода SQL/body.

Фактические доказательства на final0e02/204:

| Проверка | BEFORE / CURRENT | Evidence |
| --- | --- | --- |
| SAME42 actual ordinary helper | 5 PASS/37 expected FAIL →42/42 PASS; одинаковый fixture,actual current graph19 | `.tmp/m07-ordinary-private-final-v3-paired-proof.json`,62/62 bindings,SHA `903df5851c64b033c1841b60e9badd44618554e41d04a00971659200ecaa0d54` |
| SAME21 actual callers/page/publication | 3 PASS/18 expected FAIL →21/21 PASS; fresh related320/320,closure17 | `.tmp/m07-ordinary-caller-current-final-v4-proof.json`,SHA `347c70474137e0cb28953f168bc533b197b52ad93ce5e100e9425897d8b1dcd1` |
| Native PostgreSQL17.11 | BEFORE actual42883 capability-only; CURRENT7 SQL groups+6 lock races,38 independent clients | `.tmp/m07-ordinary-private-sql-final-v3-proof.json`,78/78 evidence checks,SHA `56427e52ad59f1f9d15d260e96e591675b4eaf9ade31e21eea8cea45c01ef090` |
| Original SQL exports → installed Supabase SDK2.112.3/current adapter | 15 DTO+24 SQLSTATE с original API/args;891/891 checks,99 controlled HTTP | `.tmp/m07-ordinary-private-native-sdk-final-v1-proof.json`,SHA `5e62748997b1308c9e35781ddd9e1d998a2ee00d3e1bf870f620f9b2eef3f441` |
| Fresh final broad/gates | 5418/5418 tests в178 файлах,без skip/todo;build,both TypeScript,secret scanner,readonly text gate5/5 | `.tmp/m07-ordinary-private-final-v2-tests-command.json` и `-gates-command.json`;actual terminal0 |

SAME helper воспроизводит старые canonical writes/marks и late source races,
а не только отсутствие нового export. Проверены source/body change с тем же
stamp,EN1µ/manual change,existing author draft,missing capability с0 model entries,
lost/malformed ACK,следующий вызов после committed private save с0 model entries,
UTC/+03 equivalent instant,full authored fields и actual Next signals.
Native SQL подтверждает full private EN больше16KiB отдельно от bounded audit,
канонические before/after snapshots,owner/admin/denied roles и wrappers/ACL,
atomic rollback и настоящие multisession row locks. SDK replay не меняет original
exports/args:15 DTO и15 representable SQL errors проходят current adapter,
8 invalid inputs отвергаются до RPC;1 outer-envelope-extra случай честно raw-only.
Existing reader сохраняет canonical RU fields, добавляет working-draft metadata
и очищает inherited reviewer/approver IDs при null private dates. Reader не менялся.

724/724 independent source-only checks:
`.tmp/m07-ordinary-private-final-v2-protected-proof.json`,SHA
`2cc01b95ace7c7375406ed98d93dc36b7c9e86334c1066fda639c7c7cbc2055c`.
Root aggregate725/725 bindings:
`.tmp/m07-ordinary-private-final-v2-verification.json`,SHA
`4bfe2e9ba53a9a1897c7c7d89d6dcf43b5d53c6781dde0e66b0e4543fb1f83e4`.
Числа bindings/SHA/SDK checks не являются отдельными критериями или браузерными
сценариями. Exact final manifest:
`.tmp/m07-ordinary-private-final-v2-source-fingerprint.json`,SHA
`bcf6826af266f69e5b69b78cafaec0a51056c04a463d63b6e124f7cd2d80c9f3`.
TG6,normalizer wholefiles/tests/import/full call arguments,package/lock,old SQL,
M02 exact9 и planner/allowlist сохранены. Native clusters остановлены,их PID/alias
убраны; root повторно подтвердил свободные3166/54329. Все final handles terminal.

Диагностики сохранены без подмены результата: first broad V1=5415 PASS/3 FAIL
обнаружил настоящую регрессию shared publication metadata в неизменном SEO fixture.
Runtime fields ограничены статьями, существующий publication fixture согласован
по unrelated entity domains; старый SEO fixture не менялся. Targeted186/186,
fresh caller320/320,broad5418/5418 и gates повторены после этой правки.
Initial focused obsolete canonical assertions исправлены в fixture, а реальный
safe-error classifier gap исправлен в runtime. Native SQL diagnostic22023 был
ошибкой sequencing в новом fixture; lock-runner diagnostic завершился до первой
race из-за unused witness promise. SDK diagnostic ошибочно сравнивал overlay
целиком с canonical без четырёх working-draft metadata fields. Исправлены только
ignored harness assertions/ordering; новые final native/SDK commands terminal0.

Уровни: M07-T05 unit/component и M07-T02 integration+isolated DB подтверждены
для описанного ordinary маршрута; это не приёмка всех переводческих маршрутов.
M07-T03/T13 и весь M07 остаются partial/pending. Ordinary preflight пока не имеет
durable provider admission journal: конкурентные generation и потеря до SAVE
не закрыты этим CAS writer. Lost ACK может оставить полный private body; новый
context блокирует повтор генерации, но не создаёт completed operation accounting
или право paid retry. Timer/new UUID не подтверждают отсутствие provider request.

Границы: helper/caller Auth,SDK,provider/build dependencies контролируемые;
native PostgreSQL использует synthetic Auth/roles/canonical schema; SDK использует
controlled HTTP replay,не реальный PostgREST. Новый ordinary native Next/admin
browser cycle ещё NOT_RUN; прошлый private-item Next proof исторический.
Managed Auth/DB/RLS/PostgREST,remote advisors,real provider/charges,production и
исходный Supabase402 NOT_VERIFIED. Full M07/M02/M04/M13/R3 не принят.
Push/deploy/production migrations/paid calls/social sends не выполнялись.
Полная цель M00..M25/230 остаётся active; пользователю дана карта25 основных
стадий из TASKS.json,M00 указан отдельно как подготовительный.

### M07: человеческое подтверждение EN и отказ native journal, 8 октября 2026

Продолжение0e02/204 без отката закрытых R2/R3 и независимого Telegram diff.
Maintained изменения этого шага: ArticleEditor.tsx,article-editor/useArticleValidation.ts;
добавлены lib/article-english-human-confirmation.ts и
article-editor/article-english-human-confirmation.integration.test.ts.
Исходный source hash больше не выдаёт машинный перевод за человеческую проверку.
Повторное использование прежнего review требует точной canonical EN редакции,
действительных actor/date review/approval,неизменного полного RU/EN отображения
и совпадения source hash,посчитанного существующей серверной проекцией.
Private/устаревший/изменённый EN и ошибка crypto не получают подтверждение.
Поздний async hash не подтверждает другой текущий текст. Явная отметка человека
остаётся отдельным действием; form/CAS/recovery и серверный release protocol
этой правкой не менялись. Никакой автоматической публикации не добавлено.

Final207 manifest `.tmp/m07-ordinary-editor-final-v2-source-fingerprint.json`,SHA
`5d8db5296bdba7e7c7c1d83ef16ad88eadd06a6a7f860e4c3e3a8ef04e0c9ae0`.
Fingerprint `5c1330b10df5110a61613c45093c6216eeb0973b3b980722bf95c3e3fe028aa9`.
Immutable BEFORE327 `.tmp/m07-ordinary-browser-before/manifest.json`,SHA
`87d04671a867ea3e61a5c9ef912e2af043ae6f3eb8254410748448a984d07ae7`.
На SAME final fixture SHA8459b6fe…: BEFORE33=6 PASS/25 FAIL/2 pending,
current33/33 PASS. Два pending относятся к новым helper-only проверкам отсутствующего
в BEFORE helper,не пропущенные проверки существующего поведения. Actual traces
связывают выполнение с четырьмя BEFORE/шестью current исходниками.
Proofs `.tmp/m07-english-human-before-final-encoded-v4-proof.json`,SHA
`7c2a43b4844cd444051cfda044afaa38eab7487a54ef08334c395734deafa46e`,и
`.tmp/m07-english-human-current-final-encoded-v3-proof.json`,SHA
`e435ca235c897f99287756692a55015c56797f2a611f0af81b798c7270a1de96`.

Fresh final broad: 5462/5462,181 test files,actual handle70834 terminal0.
`.tmp/m07-ordinary-editor-final-v2-tests-command.json` и
`-combined-final.json`; log SHA
`7b920f5897366e03aaeea22c1f1254d3b9c4ce8c8f3933a83cfc9e9ea1246b8b`.
Build,оба TypeScript configs,client-secret scanner и неизменённый readonly
text gate:5/5 terminal0,handle1620; `-gates-command.json` и отдельные final logs.
Первый V1 gates run был FAIL из-за трёх raw literals только в новом fixture.
Их Unicode escape сохраняет все180 decoded strings и semantic AST:17/17,
`.tmp/m07-english-human-literal-encoding-proof.json`,SHA
`14712245b3b20a6fb681fd5569346b6a37b33d0a7cc17241da73b616a6bebf64`.
Нормализаторы,их вызовы,правила и прежние тесты не исправлялись. V1 FAIL не
переписан как PASS; fresh final тесты и все gates повторены после этой правки.

Actual isolated PostgreSQL17.11:6/6 групп,terminal0. Машинный private EN version1
→ явное человеческое private bundle version2 → отдельный full-bundle release
→ same-operation replay и read-only lookup. Проверены missing/old EN,точные
RU/EN CAS и draft version,editor denial,foreign receipt,intent/body conflict
и rollback при поздней ошибке квитанции. Авторские RU поля сохранены; явный
full-bundle release законно меняет технические RU updated_at/updated_by.
Canonical RU/EN до release не меняются; человеческие review/approval принадлежат
actor.17 actual DTO,12 errors,2 полных before/machine/private/published snapshots.
`.tmp/m07-ordinary-human-continuation-final-v3-proof.json`,SHA
`208a0c06c8bde57c462492840ca4172c893403adbf6c0177ff66708d401cdf90`,38 bindings,
60 artifacts. Native case m07-human-continuation-final-v2 сохранил actual SQL
коды P0001/ENGLISH_CONFLICT и ARTICLE_NOT_FOUND вместо удобных предположений.
SQL,исторические миграции,production allowlist и M02 exact9 не менялись.
Это synthetic Auth/canonical/RLS schema,не managed Auth/DB/RLS или PostgREST.

Actual Next webpack + installed Chromium SAME pair завершился FAILED/PENDING.
BEFORE handle6059 terminal1/current73380 terminal1; каждый25 checks=24 positive,
1 failure,только missing-success группа. Это НЕ полный browser PASS.
Первый машинный batch сохранил два private EN,четыре controlled model calls,
canonical и public dispatch остались прежними. Actual editor/locale read и явный
checkbox выполнены; человеческий SAVE остановлен client journal preflight:
«Не удалось подготовить полную копию исходного запроса…запись не начиналась».
Editor SAVE POST/RPC отсутствуют. Ancillary/autosave POST не считаются SAVE.
Остальные lifecycle/reload/lookup/publication группы NOT_VERIFIED.
Native BEFORE false-green не воспроизведён: russianSourceChanged=true маскирует
его. SAME unit BEFORE/current proof выше остаётся отдельным доказательством.
Evidence `.tmp/m07-ordinary-editor-native-before-final-valid-v2-evidence.json`,SHA
`a4bfb6c6a195fa54f4448287181039f36a25839b638fb64982fe6e7de3e26abd`,и
`-current-final-valid-v2-evidence.json`,SHA
`f5582634d4a632e1b6d988ec22d7f2c6d3593dd4491bfefb50da405db8a8419d`.
У каждого сохранены7 wire,5 DOM,failure PNG и immutable compiled graph.
Fixture и runner одинаковы; current graph включает actual final207 helpers.
Контролируемые границы: внешний SSR SDK/Auth/DB ledger,CF responses,outbound
public-build,catalog/autosave/link ancillary и HTTPS fixture cover. Actual
internal Auth,Next primitives,actions/loaders/editors/validators/publication
сохранены; внешних browser requests/page errors не было.

Read-only actual schema probe установил причину: producer
article-translation-machine-ownership.ts:37..53 выдаёт empty doc sentinel с
__probperaMediaReferences и __probperaPremiumTranslation; ordinary helper312
использует его. Recovery documentContent проверяет preserved() до HTML fallback,
Schema.toJSON удаляет эти root keys,поэтому полный журнал отвергается.
Каждый ключ отдельно тоже приводит к null; plain empty sentinel принимает HTML.
Ни один key не удалён из maintained/runtime/fixture ради зелёного результата.
Отдельно неподдерживаемый root authorMetadata из synthetic canonical RU
исчез в форме/локальной копии при первоначальной сериализации,canonical ещё
содержит его. Это не признано допустимой потерей и не скрыто fixture правкой.
Registered image attrs/rights/source сохранены; full no-op JSON preservation
не доказана. Исходная ошибка fixture node name editorialImage была исправлена
до image по actual schema; прежние bytes/diagnostic FAIL сохранены отдельно.
177 initial preparation checks не заменяют recovery admission или browser PASS.
`.tmp/m07-ordinary-editor-native-recovery-readonly-diagnostic-v3-proof.json`,SHA
`ee397fd5793692c6a7bb3edb0dea18bd735074182298bc705f7f78bda52f2772`:
15/15 diagnostic checks,actual10 source bindings; runtime не менялся.

Source protection840/840,`.tmp/m07-ordinary-editor-final-v2-protected-proof.json`,SHA
`0a9398283f113b8d4cadd31e1b70e5fda5574f0576d28779facff2ea0ea30b16`:
TG6,normalizer wholefiles/tests/import/full call arguments,packages/lock,
old SQL,planner и exact9 сохранены. Из captured327 изменены только Editor/hook,
325 unchanged. Root aggregate595/595 source/artifact bindings,`-verification.json`,SHA
`b1e8417878304b9152fbc87ca5a51181aa242a532d8af2a9456c4db2812ef85a`;
browser.fullCycleAccepted=false. Эти числа не критерии приёмки и не E2E scenarios.
Own Next handles60818/48596 terminal0 через свои stopflags; три собственных
Next launchers и PostgreSQL остановлены,3170/54329 свободны. Root cleanup
`-runtime-cleanup.json`,SHA
`4409dc84a1c2fd38ebe6d26e218d06eb7e19ea5d7a0f88520e193fd9fca028f5`.
Managed Auth/DB/RLS/PostgREST,remote advisors,provider charges,production и
исходный Supabase402 NOT_VERIFIED. M07-T05 unit/component slice подтверждён,
full M07-T03/T13,M07/M02/M04/M13/R3 не приняты. No push/deploy/production
migrations/paid calls/social sends. Цель M00..M25/230 остаётся active.

### M07: producer recovery, авторский JSON и источники, 8 октября 2026

Локальный slice завершён на frozen210/750e9ff4. Исправлены только четыре
существующих runtime-файла относительно immutable329 capture5c1330/207:
ArticleEditor.tsx, article-recovery-snapshot.ts, atomic-standard-save-action.ts,
save-article-action.ts. Добавлены три профильных integration fixtures; старые
тесты, SQL, normalizer calls/rules/tests, TG6, packages и lock не изменены.
203 прежних selected sources и325 из329 captured sources сохранены точно.
Final manifest: `.tmp/m07-journal-final-v3-source-fingerprint.json`, SHA
e5361c3909ac46ed949f17704de4212e1775901fbb64d4b98b4093a9a2e5c7b1.

Shared prepareArticleEditorDocumentContent принимает известный полный producer
EN empty-doc sentinel с validated media references и premium provenance через
безопасную schema projection/HTML fallback. Исходный JSON остаётся целиком;
media identity проверяется с тем же HTML. Metadata не подтверждают права,
человеческое review, freshness или публикацию. RU/nonempty/неизвестные author
attrs/root поля и повреждённые metadata не принимаются. ArticleEditor проверяет
loaded/current RU/EN до записи, сохраняет неподдерживаемый исходный JSON для
копирования и блокирует запись; исходный авторский материал не заменяется
монтажной TipTap projection. Неавторский onUpdate не меняет тело/dirty/source.
Полные поддерживаемые copies, journal/CAS и explicit discard сохранены.

Actual native release обнаружил потерю пробелов в sources/bibliography.
Оба существующих lineItems теперь сохраняют текст непустой строки целиком,
порядок и обычную {text} wrapper; blank detection не изменяет непустой текст.
Silent slice100 удалён. Atomic RU/EN max100/max1000 validators отклоняют overflow;
legacy auto branch проверяет RU lists до sourcehash/SDK/provider. Две existing
fingerprint-only trim projections сохраняют прежнюю ownership семантику, без
изменения authored payload или translation source-hash rules. Явная правка
источника всё ещё передаёт ownership человеку; passive save этого не делает.

SAME focused проверки с exact captured source, реальными parsers/schema/actions
и отдельно обозначенными контролируемыми границами:
* Producer recovery46: BEFORE37 PASS/9 FAIL, CURRENT46/46 PASS; unchanged342
  existing snapshot/pending guards также прошли на том же recovery source.
  Proof `.tmp/m07-producer-recovery-final-v1-paired-proof.json`, SHA
  a5a2d4371944e8bf8c1b775d48783cd3ee2d459e5f08b11a2aebfb87b918b2e.
* Authored callbacks/schema20: BEFORE8 PASS/12 FAIL, CURRENT20/20 PASS.
  Это extracted actual callbacks/schema, отдельно от mounted native проверки.
  CURRENT proof `.tmp/m07-authored-json-current-v2-proof.json`, SHA
  7700fc852c37673c9b83a01dcde534ecc64cfd3d7e122cab2ffe4d8adce0ca20.
* Sources69: BEFORE9 PASS/60 FAIL, CURRENT69/69 PASS; actual complete actions,
  strict validators и21 source dependencies. Invalid legacy101/1001 до исправления
  достигает controlled provider boundary; после исправления SDK/provider/write0.
  Provider spy всегда прекращает выполнение до transport; платных calls нет.
  Paired proof `.tmp/m07-article-source-preservation-final-v1-proof.json`, SHA
  a2a5dfb8f9ef856486e84899141a028f863d6d262be14120ebbb5b3fb964b9e7.

Fresh final210 broad command45821 завершился0:5597/5597,184 test files,
0 failed/pending. Raw log SHA
b2603afdcab9c773a39ecf8cee1e2900092455265d2d22dd382f9efb2979a0a5.
Command proof `.tmp/m07-journal-final-v3-tests-command.json`, SHA
419413473a0f917d5515f0549993aebae624137336647251c61afa8f748014e9.
Fresh gates3113 завершились0: admin build, оба TypeScript projects,
client-secret scanner и неизменённый readonly text gate без --write.
Proof `.tmp/m07-journal-final-v3-gates-command.json`, SHA
67c0d952deb3213975693b32779690b98008a0f6c30d056e599cdf1282e7fbe6.
Предыдущий v1 readonly FAIL на двух новых checkpoint separators сохранён;
исправлен только собственный новый текст checkpoint, normalizer не менялся.

SAME native v7 runner/fixture: captured BEFORE29 assertions26 PASS/3 FAIL,
CURRENT92/92 PASS в10 groups, actual Next webpack/Chromium/routes/actions/loaders/
editor/validators/publication. BEFORE остаётся воспроизведённым отказом unknown
author JSON и journal preparation, не объявляется full lifecycle PASS.
Original unknown authored3 rows сохранены целиком в отдельном negative case;
registered happy case сохраняет все прежние text/media/rights/source поля.
Предыдущие v3/v4/v5 diagnostic FAIL и raw wire/DOM/compiled graphs сохранены.
v5 впервые выполнил release и обнаружил exact RU source loss; его82/85 не PASS.

Actual existing successful SAVE оставляет recovery journal; после reload
требуется явный original operation lookup. v7 нажимает существующую кнопку
проверки и подтверждает отсутствие repeat SAVE/model/build. Runtime M02 protocol
для этого не ослаблялся. Recovered different authored EN после user uncheck
не получает canonical approval. Новый browser context без resetState/reseed/
storage wipe читает actual just-published rows и выводит human proof с checkboxOFF.
Проверены machine batch capped2/four mock model calls, полный private EN1,
human SAVE2, точный human release, actor review/approval, lost ACK/reload/lookup,
rollback/capability/manual/author-draft и mandatory read failure retaining input.
Exact authored RU text, JSON, category, cover/rights/source/bibliography сохранены.
SDK/Auth/DB ledger, CF/provider, outbound public-build, ancillary catalog/autosave/
link и declared HTTPS image standin контролируемые; внешний transport0.

BEFORE proof `.tmp/m07-journal-native-before-v7-evidence.json`, SHA
2846b27267b77fe6620652f57092513865082ba816ef6691d6f5315b893c8d24.
CURRENT proof `.tmp/m07-journal-native-current-v7-evidence.json`, SHA
05ad0cee546b3dba28c10bcb55507e1e773a14065519bdb2595d20e657d22ca3.
Compiled graphs BEFORE SHAa13faee979313f79007f5eefb43b1d6ad01cd9e7e636d6ea3764f24b28685dad,
CURRENT SHA117d1f240240cb72ef31ddca3b56ba1d97308059c0158c9383686ea2546ae242.
One frozen v7 runner SHA33b183ce04c6ee6fc8825b60c81ddf26b7035aed1b1df83abf94a2bb37aa1af6.

Independent protection860/860 source bindings, не acceptance criteria:
`.tmp/m07-article-json-final-v3-protected-proof.json`, SHA
1a4d0f55e32a8963fd08bfd7fb0f256b3ee2c1ec8637f6168cde8ac06507e602.
TG6, whole normalizer4 HEAD/capture и15 exact full import/callee/call/arguments
AST scopes, old SQL6, M02 exact9/e6e6, planner/allowlist и dependencies сохранены.
Root aggregate1028/1028 bindings включает actual source closures, native
response bytes и соответствующий frozen210; это не230 acceptance criteria.
`.tmp/m07-journal-final-v3-aggregate-proof.json`, SHA
da938e514425d877945c16914ac47672657462de612b6d09dbab3e28d6a0fc18.
Own cleanup11/11: launchers97169/90686/16680 завершены0 после своих stopflags;
их own PIDs отсутствуют, listeners3170/54329 отсутствуют. Другие процессы не
останавливались. Proof `.tmp/m07-journal-final-v3-cleanup-proof.json`, SHA
8214de4e43db29fc94a42f4fcecac91fac23d0a34dfc54442b3d4d3a68367c71.

Known single-line {text} sources локально сохраняются. Произвольные wrapper
keys/rights/ISBN, bare string array shape, empty items и embedded newlines
через textarea пока не доказаны lossless; отдельный preservation guard pending.
Ordinary durable provider admission/accounting/unknown outcome и общий mixed10
Continue/Retry UI ещё pending. Предыдущий isolated PostgreSQL human continuation
остаётся историческим evidence для неизменённых SQL/RPC, не новым DB прогоном.
Managed Auth/DB/RLS/PostgREST, реальные providers/charges, production и initial
Supabase402 NOT_VERIFIED. Full M07/M02/M04/M13/R3 и M00..M25 не приняты.
Push/deploy/production migrations/social sends/paid calls не выполнялись.

### M07: сохранность структуры источников RU/EN, 8 октября 2026

Frozen212/475fb95ae4a3. Этот шаг продолжает producer/source
preservation из предыдущего раздела; прежние завершённые изменения не откатаны.
Новый чистый source-list guard переиспользует существующий ArticleEditor guard.
До UUID, сериализации и записи проверяются sources/bibliography RU, эффективной EN
и отдельно canonical EN, включая private overlay и выключенный private EN.
Legacy bare strings, extra rights/ISBN keys, empty items и embedded newlines
удерживаются в полной исходной копии; редактирование/save/preview/publish
блокируются. Новый hidden JSON не становится полномочием или серверным receipt.
Raw copy содержит article/effective EN/canonical EN. Known single-line {text}
с padding/order/duplicates, пустая новая статья и полный copy совместимы;
явные ручные textarea edits сохраняются. Recovery/discard не снимает guard
неподдерживаемой исходной версии. SQL/read validators не расширялись.

Maintained delta относительно immutable332 capture: ровно ArticleEditor и прежний
20-case authored-json fixture (только четыре dependency-wiring lines); добавлены
helper и отдельный28-case integration fixture. Все прежние20 data/assertions
побайтно сохранны; остальные208 selected и330 captured current unchanged.

| Проверка | Фактический результат и граница |
|---|---|
| SAME focused48 | BEFORE28 PASS/20 FAIL; CURRENT48/48 PASS. Старые20 проходят в обоих вариантах; actual callbacks/parser с controlled refs |
| SAME actual Next/Chromium v7 | BEFORE74 checks:58 PASS/16 target FAIL, EXPECTED_BEFORE; CURRENT78/78,12 groups. Пять reachable legacy variants реально теряют структуру в private SAVE до исправления; после guard submit остановлен до operation |
| Supported mounted lifecycle | Native SAVE/reload/explicit original-operation lookup сохраняют RU/EN padding/order/duplicates, CAS, media/rights/category; manual edits/full copy/empty new совместимы |
| Fresh selected Vitest | 5625/5625 PASS в185 actual files на final212; actual handle45839 terminal0 |
| Five gates | build, admin TS, Cloudflare TS, client-secrets и unchanged readonly text gate terminal0; actual handle99725 terminal0 |
| Independent protection | 878/878 source-only bindings: TG6, normalizer4 whole files,15 inherited AST scopes плюс unchanged zero-call stub scope, historicalSQL6/M02 exact9/planner/packages |
| Owned cleanup | Шесть Next launchers остановлены; owned PIDs отсутствуют,3170/54329 listeners empty. Browser10285/76206 и launcher47839/27697 terminal0 |

Native diagnostics current-v1..v4 и BEFORE-v5/v6 сохранены как FAIL/INCOMPLETE.
Причины: недопустимый synthetic english-only/disabled DTO, exact textarea label
включал value, category_id является обычным select и transient Windows rename
EPERM в controlled fixture ledger. Исправлены только ignored fixtures/selectors;
atomic rename retry ограничен25x10ms и журналируется. BEFORE/CURRENT v7 используют
одинаковые frozen fixture/runner bytes. Original stale English/unsupported author
profiles сохранены; отдельный synthetic registered English profile явно описан.
Это не признание старых13 parser projections production write failures: shapes,
которые loader/schema уже отсекают, не выдаются за reachable native данные.

Следующий ordinary admission defect отдельно воспроизведён на immutable baseline:
два разрешённых preflight одной revision дают4 controlled provider entries и
один private SAVE/один conflict; unknown accepted transport даёт1 entry, затем
fresh actual FormData Server Action ещё2. Фактические assertions14/14; требования
0/2, EXPECTED_BEFORE, command exit1. Verification97/97 - только bindings,
НЕ M07 PASS. Actual action/helper/hash/premium transport исполнены, Auth/SDK/AI
контролируются; HTTP/browser/DB/provider там NOT_VERIFIED. Исправления пока нет.

Source manifest: .tmp/m07-source-provenance-final-v1-source-fingerprint.json,
SHA e9266f44a9dace27184d49cf259425f0332335916ab65fe5fb364b9bbb49e9b2.
Ключевые immutable artifacts (file/SHA256):
- .tmp/m07-source-provenance-final-v1-paired-proof.json / 03414c5ed84e5841950f77e28acfb986fc76650f984ae31acf126c6a096aed02
- .tmp/m07-source-provenance-native-before-v7-evidence.json / 4a2bf13b7c4af02cdc18af76e366b632561808bd0c9034577cb5f51a29c3799b
- .tmp/m07-source-provenance-native-current-v7-evidence.json / 66c9db21aebb1a63923dd6895286f0afcf1a8002d399e90f5df56a7ea7f4f69a
- .tmp/m07-source-provenance-final-v2-protected-proof.json / c84db1369923ad4ac4a6277a87275c85006ee335eabf86befadef0097db00f90
- .tmp/m07-source-provenance-final-v2-aggregate-proof.json / 2c7086d40cc9522d5c2f0d3661c50bc7397168513b102a3d891232f185a477fe
- .tmp/m07-source-provenance-final-v1-cleanup-proof.json / 5a11c4d35be5770a09368ce3110c0c4ac555bd78fb4c782a4152d359cf8f3cf3
- .tmp/m07-ordinary-admission-baseline-v1-verification.json / f1526d1e3e7e0726a6784c0e83563f7d57a06fa949c18481c7e1438bec6d0fab

Новый native scope использует actual Next webpack/Chromium и внутренние
Auth/actions/loaders/editor/validators; внешние Auth/SDK/DB ledger, ancillary
autosave/catalog/links и HTTPS fixture images контролируются. Model/build/social
dispatch отсутствует. Managed Auth/DB/RLS/PostgREST, real provider/charges,
production и original Supabase402 NOT_VERIFIED. Полная цель M00..M25/230 active;
весь M07/M02/M04/M13/R3 не принят. Push/deploy/production migrations не выполнялись.

### Следующий конкретный шаг и внешняя зависимость

Активный модуль M07. Frozen212/475fb95ae4a3, source-provenance
SAME focused48 и actual native78/78 завершены локально в границах нового раздела.
Полная цель M00..M25/230 остаётся active. Legacy source-provenance guard закрыт
локально; не возвращаться к общему аудиту завершённых slices.

Следующий конкретный шаг - ordinary durable admission/accounting BEFORE provider
dispatch. Использовать существующие translation jobs/items/progress и narrow
additive ordinary BEGIN; binding actor из auth.uid, provider, operationUUID,
полный source snapshot/hash и точные RU/EN CAS. Ordinary owner/admin policy
сохранить во всех последующих journal mutations, включая demotion; существующая
retry staff policy сама по себе недостаточна. Admission другой UUID/job той же
статьи должен блокироваться общей границей, которую соблюдает existing retry;
один новый advisory lock этого не доказывает. Queued create и BEGIN нельзя
разделять видимой worker транзакцией. Progress.calls=[] сохранять до dispatch.
FINISH/cursor/accounting должны завершать тот же durable run с доказанным
учётом активных items; не выдавать posthoc new job или fake audit за продолжение.
Реальный scoped SAME baseline и ограничения reuse указаны выше. Не создавать
новую очередь/таблицу и не расширять service-role claim/complete ACL.

Выполнить ordinary durable provider admission/accounting/unknown outcome
M07-T03/T13: два preflight одной RU/EN revision и потеря после принятого model
response до SAVE/run journal; повтор не имеет права на новый provider call без
durable подтверждения. Отдельный конечный UI fixture10 items,8 success/2 failure:
Continue посещает remaining candidates, Retry только selected failed item/version,
успешные не генерируются заново. Batch cap2 и действующие budgets сохранять.
Existing retry protocol не расширять без отдельного доказательства; timer,
missing receipt и fresh UUID не подтверждают отсутствие принятого запроса.
M07-T05 ordinary machine/human native slice теперь LOCAL_VERIFIED, managed
переход и весь authenticated lifecycle NOT_VERIFIED. T03/T13 ещё partial.
M02 private schema
exact9 не расширять. Историческая RU revision из прежнего журнала не восстанавливается
автоматически. Legacy item без достаточного provenance не даёт paid retry;
успешные/manual/current элементы повторно не переводятся. Existing service-role
ACL и scan cursor сохранять; staff sync не выдавать за lease/background runner.
Без массового перевода, платных вызовов и реальных social/provider dispatch.
modules/M07.md уже прочитан; не возвращаться к общему аудиту завершённых slices.
Не ждать недоступного managed Auth/DB/RLS acceptance ради независимой безопасной
части. M04-T13/T15/T16 обычные post-success ошибки/reconciliation/atomic retry
оставить явно pending; local Next signal checks их не закрывают.
Прежние результаты не переоценивать как новый PASS.
Полная цель M00..M25/230 criteria остаётся active.
Продолжать с текущих HEAD/fingerprint и diff; повторный общий аудит закрытых
loaders, submit/read/recovery boundaries не нужен.
Legacy partial-v2/metadata-only/corrupt recovery локальный шаг завершён выше.

Article operationId/frozen intent/lookup, same-tab reload/new/copy recovery и
private EN сохранность после partial release/disabled overwrite выполнены локально
в границах proofs выше. Local/session copies не являются receipt или правами.
Adopted ID/CAS действует после собственного lookup; URL автоматически не переписывается.
Durable Save/Publish существующего PageEditor завершён локально в границах
нового раздела и доказательств выше; исходные Page A/op/CAS и поздний B/C переживают reload.
Catalog createPageAction и отсутствие Page new/copy editor не подменять article
маршрутами. Replay не повторяет canonical write, audit или build; public delivery
подтверждается отдельно. M02 Pages durable operation: LOCAL_VERIFIED, NOT_ACCEPTED
как часть полного M02. Original Page39 и 5 Page native не объявлять свежим PASS.
Pre-query staff/MFA guards и свежий ручной ввод при Auth denial/reload/actor change
завершены локально в указанных выше границах; legacy gallery selection шаг теперь
также завершён локально. Следующий M02 native proof теперь выполнил actual page.reload
после RU-only partial release при
working_draft_scope=english-only и disabled EN checkbox: полный private EN,
working draft version, RU base CAS, EN token, настоящие edit-route props и
собственный read-only operation lookup. Прежний residual-reload-disabled proof
только монтировал read-model props, настоящую native перезагрузку не заменяет.
Новый native fixture m02-residual-en-* готовится на отдельном loopback3148.
Его подготовительные diagnostics не являются runtime FAIL или PASS: первый
compile требовал unchanged public helpers; затем runner ошибочно ожидал отсутствия
hidden english_enabled вместо корректного пустого значения и publish-ru при
disabled EN. Actual UI в этом состоянии отправляет intent=publish, mode none.
Следующий реальный POST сначала не прошёл обязательный release checklist; вместо
ослабления guards fixture RU исправлен до действительно готового материала.
На immutable d025 lifecycle release → actual page.reload → own read-only lookup
прошёл 86/87 diagnostic assertions: полный retained private EN, disabled choice,
version5/RU base/EN CAS, raw draft null и единственная запись подтверждены fixture.
Одна assertion ошибочно ожидала published в authored status вместо сохранённого
draft из original A/latest B. Actual runtime отдельно хранит canonical status в
savedIdentity/previous_status и receipt; авторский статус сохраняет journal.
Этот diagnostic сохранён без превращения 86/87 в PASS. Final одинаковый runner
отдельно проверил canonical published через actual previous_status/route props/
receipt и сохранность authored draft; результат зафиксирован в новом разделе.
Не ослаблять release guards, не включать EN и не подменять user input ради fixture.
Final paired native runs: d025 1/1 PASS92/92, current4915 1/1 PASS92/92;
одинаковые23 fixture files и runner, actual compiled graphs104/104. Evidence:
m02-residual-en-before-d025-final-policy-evidence.json и
m02-residual-en-current-4915-final-evidence.json. Source-bound aggregate proof1077
и cleanup3148 завершены PASS в новом разделе; собственных live jobs/Node/listeners
больше нет. Baseline/current launchers завершались только своим stopflag;
чужие процессы не останавливались.
Full app Auth/DB/RLS, legacy unscoped ownership и другие private operator readers
NOT_VERIFIED. Не ослаблять read guard ради editor DOM и не выводить receipt или
права из local copy. Закрытые Article/Page slices повторно не аудировать без
нового runtime отказа; полный M02 и цель M00..M25 остаются active/NOT_ACCEPTED.
При внешнем BLOCKED продолжать независимые безопасные части полного плана;
migration planner не менять.
Production не проверен; initial managed bootstrap внешне BLOCKED.

Ограничение ISBN producer: main HTTP non-OK/missing title и некоторые cover
HEAD failures уже преобразуются в null внутри прежнего producer. Новый loader
различает фактический reject/повреждённый candidate, но не может восстановить
скрытую причину такого null; producer не менялся в текущем шаге.

До будущего PR требуется сверить актуальный main и перенести только чистый
R3 diff: текущий worktree продолжает pre-squash HEAD. Tree equality с новым
production/main этим шагом не проверена; push/deploy не выполнялись.
Дополнительную Telegram-правку пользователя отделить от чистого R3 diff.

Сохранённое внешнее состояние предшествующего выпуска новостей: Pages CI
`36685265584` был BLOCKED из-за ожидания 21 годовой Нобелевской статьи при
22 опубликованных CMS-статьях, включая 1924 год. Это историческое состояние,
не новый live postflight. News Workers ранее проверены выключенными;
включение и доставка Telegram этим R3 шагом не выполнялись.

Откат касается только текущих локальных runtime/helpers/tests и не меняет
БД или авторские данные. Сохранять закрытые R2 и независимые изменения;
массовый reset и downgrade миграций не нужны.
