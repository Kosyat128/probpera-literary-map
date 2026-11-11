# Writer durable admission and paid-response retention

This directory records one local increment within the full26-module/230-criterion
R3 goal. It does not establish complete M07, managed/browser acceptance or a
production release. All work used the required GPT-6.1 Sol /Ultra. Keys and the
managed environment remain separately deferred; no paid/live provider was used.

## Behavior and boundaries

All three writer helper callers now use committed admission before any provider
dispatch. The existing jobs/items/attempts remain authoritative; the additional
private artifact cache stores source bindings, response bodies and completed
candidates, without scheduling or lease state. Public operational/audit metadata
contains bounded IDs/hashes/counters only. Raw received JSON is untrusted and
incomplete; only an actual two-pass result passing the existing parser/fidelity
validator becomes a private candidate. Human approval/publication stay separate.

New UUIDs, actors, providers, changed sources and cancellation do not bypass an
unresolved dispatch. Replayed ACKs and reads never authorize another request.
Lost ACKs reconcile exact operation/call/body identities. A confirmed zero-call
admission may close skipped without advancing its cursor; a pending call remains
blocked. Partial-pass replay is not implemented or claimed.

Complete output survives source/manual EN/rights drift and stays unapprovable
under stale bindings. An existing competing pending draft stays exact; its ID
is never borrowed as authority for the new cached candidate. FINISH, one terminal
attempt and cursor advance commit atomically. A consumed/discarded completed
draft is not silently restaged or regenerated. Operation receipts are historical
and do not assert that a draft still awaits review after another human action.

Both ordinary writer saves commit source audit/publication before optional
translation. Writer batch unknowns pin position before processed accounting;
paid items use their operation receipts, while legacy aggregates contain free
observations only. Default ordinary limits are1 attempt/4 reservations/300000ms;
the shared batch limits remain3/12/300000. Counters are admission/reservation
evidence, not verified external billing. Other provider/model behavior is retained.

The editor accepts an operation link only after UUID/real writer selection and
fresh bound RPC parsing. Separate operation jobs cannot be launched through the
legacy scan-resume action, even by a forged POST. Legacy writer cursor jobs still
use their stored cursor. No new operator retry control or worker is claimed.

## Executed evidence

| Check | Result | Boundary |
| --- | --- | --- |
| Original invariant contract | BEFORE4 controls PASS/2 target FAIL; CURRENT6/6 | One identical adapted SDK/observer harness; original17-source capture and contract unchanged |
| Focused final suite | 154/154 in six files, exit0 | New admission22, old review40, budget39, premium19, RPC18, routing/SSR16 |
| Native PostgreSQL17.11 | Twelve groups PASS plus real two-session exclusion | Actual original SQL graph and new migration; synthetic Auth/staff |
| Native DTO envelopes | 20/20, exit0 | Unchanged native JSON through actual TypeScript parser/wrappers |
| Ordinary editor regression | 145/145 in two existing files, exit0 | Actual page/action source and protected save behavior |
| Final broad selection | 6178/6184 in204 files, exit1 | Same six genuine absent M02 baseline errors; no skip/todo |
| Final five gates | 4/5 | Build, both TypeScript checks and secret scan PASS; readonly text gate exact41 baseline FAIL |
| Protected source | PASS | Four normalizers,19 rules/tests,16 AST scopes,64 old migrations,six Telegram paths/patch,three package files |

The original writer conflict expectations3 attempts/6 requests/3 conflicts/
cursor3 remain intact. Boundary/observer adaptations for the new protocol are
listed explicitly; the original defect-specific diagnostic is not called an
unchanged CURRENT runner. Country/library frozen fixtures and assertion bodies
remain unchanged. Earlier failed attempts/selectors and corrections remain raw.

Native guards cover current/raw source and ownership, zero-call position,
unknown/cancel/ACK replay, competing slots, restrictive deletion/write proofs,
authenticated/service tamper, owner-only artifact reads and unchanged lease
grants. The one-item active-entity index admits one of two real concurrent
sessions and returns the same blocked operation to the other. Fourteen native
routine bodies exactly match the new migration source.

Advisors remain FAIL with fifteen inherited synthetic findings (eleven WARN/four
ERROR), zero new production-object findings. PL/pgSQL lint is NOT_RUN because
its extension is unavailable. No extension/service was installed. Both final
owned PostgreSQL starts stopped cleanly. Managed Auth/PostgREST, authenticated
browser actions and deployed public results remain unverified.

## Source identity and archives

Final non-doc fingerprint:
`f1f3582c13a5dee91c3aad9da3bee719a1e579ebbb09e3e7b73a92b10126b196`
for10,433 tracked/owned source/test/SQL files. All204 tests and five gates bind to
these same bytes, with zero drift. The10,660-file full inventory aggregate is
`cb74d31b1c313523638265ab8425e411df6ce04ba6d303e94d4b7dc9b9c0f935`.
Eleven preceding files changed and twelve were added; all other10,410 preceding
non-doc files remain byte-identical. Later checkpoint/evidence prose has its
separate declared scope.

- `whole-validation-evidence.zip`: SHA256
  `289c7b4b26d237c2c7b21bc724375398fc04a4d81e4de25e59647fc87ee65b6b`;
  1,889,243 bytes,37 members,36 payload hashes plus manifest readback verified.
- `writer-admission-controlled-tests.zip`: SHA256
  `1092eb007c1a699903525eb20bd4537a070a85a0bde8f60b9a008df6f5d0f11e`;
  1,130,515 bytes,299 members verified. Contains original/adapted BEFORE, CURRENT,
  11 owned/55 production source bindings, raw failures, DTO proof and replay notes.
- `sql-evidence.zip`: SHA256
  `585272c0a49a8137e7bc5c7885b409ceb75a0ba8d2a2490749051c8446c4ffa0`;
  339,525 bytes,59 payload files plus verified manifest. Includes native goldens,
  exact SQL/functions, guarded runners, advisors, race evidence and cleanup.
- Adjacent JSON manifests/receipts bind archive/member sizes and hashes.

Migration:
`supabase/migrations/20261029202308_writer_translation_operation_admission.sql`,
SHA256 `f09a8d9b727e9d3a3948e027ed503bfecdd86535f6d4021b78c1e205a338fca5`.
Fixture: `scripts/database/fixtures/writer-translation-operation-admission.sql`,
SHA256 `5918c13f6643dbd10e06102737e56fd0542f179d02537b1898f594ff2e118d15`.
Historical migrations were not edited or deployed.

Verify ZIP/member hashes before extracting into empty scratch space. Runners
retain historical absolute workspace paths and expect the locked dependencies;
adapt paths deliberately and use fresh output labels. Credentials, dependencies,
native binaries/database data and generated caches are excluded. Do not confuse
old receipts with a new execution or use a substitute M02 BEFORE capture.

## Release and backout

No release was performed. For a later authorized rollout, keep new generation
stopped while applying the preceding private review/budget dependencies and this
additive migration. Check ledger/checksums, fresh role access/readiness and the
authenticated review flow with controlled provider/build boundaries before
enabling writer generation. New code fails closed before expense if admission
capabilities are missing; ordinary source saving remains independent.

Retain private artifacts, candidates, operational receipts and added schema on
backout. Older binaries can call a provider without durable admission, so keep
generation stopped while they run; a retained database index alone does not make
that old external-call path safe. Do not delete unresolved operations or apply a
blind downgrade/reset. No service-role lease privileges were broadened.

## Next unresolved library/country admission defect

`next-library-country-admission-before.zip`: SHA256
`652bbe1367df8b92f267a418600d55ce76feb9fa1f9a69b969722a02c8f27cef`;
247,080 bytes,93 payload entries plus verified internal manifest. Adjacent JSON
files retain its source/replay identities.

Actual library17-module and country16-module graphs each reproduce one accepted
controlled request with lost delivery, followed by two more same-source provider
calls in a fresh actual action. Canonical/manual/RU/EN/sources/rights/revisions
remain exact, public builds and machine canonical writes are zero. Frozen replay
matches; execution/control failures are zero and all four invariant targets FAIL.
This is a genuine unresolved BEFORE, not acceptance PASS or external billing proof.

Use the existing journal/private-artifact protocol with entity-specific guards;
book/country IDs cannot be passed to writer/article-only RPCs. Partial-pass retry,
global budgets/concurrency, stable M07-T12 traversal and complete T03/T13 operator
actions remain pending. The full26-module/230-criterion goal remains active.
