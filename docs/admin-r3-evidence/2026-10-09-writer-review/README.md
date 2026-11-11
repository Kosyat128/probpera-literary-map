# Local writer biography review continuation

The current continuation point is `docs/CODEX_ADMIN_EXECUTION_STATE.md`.
These materials describe the working tree based on
`acb910d89133396e8e9794e91bd5db74128dab3b`, not a new commit or deployment.

## Runtime comparison

`writer-runtime-evidence.zip` has SHA256
`1ef34f15bde50d13b2b398bd3b5476d7b8975bfd68b2655e89f8cae098ccbb2b`.
Its 14 entries include a manifest, an unchanged paired fixture, the original
50-source graph, a CURRENT source delta, reports, and replay instructions.
The paired fixture passes 7/15 before and 15/15 after the fix. Seven failures
demonstrate M07-T05; the eighth is a separately identified malformed authored
English preservation failure. Both runs have zero execution/control failures.
The maintained CURRENT suite passes 40/40 checks across its 57-source graph.

The runtime tests execute application modules and installed SDK transport with
controlled Auth, catalog, provider, database/RPC and publication boundaries.
They do not claim real browser, managed Auth/PostgREST/RLS, paid provider or
deployed public-site acceptance. Captured test sources stay inside ZIP files so
ordinary Vitest discovery cannot mistake evidence copies for maintained tests.

The maintained test is
`apps/admin/lib/writer-biography-machine-review.integration.test.ts`.
Run it from the repository with the locked dependencies installed:

```sh
node node_modules/vitest/vitest.mjs run apps/admin/lib/writer-biography-machine-review.integration.test.ts --maxWorkers=2
```

## Native SQL and runtime receipts

`writer-private-sql-evidence.zip` has SHA256
`43dd256ffb95319435406201f9c41de3d21b34f6177503a8d21800ad5f5e8ed3`.
It contains the assembled isolated fixture, exact source hashes, terminal logs,
native envelopes, actual TypeScript DTO replay, independent SQL comparison and
cleanup receipts. PostgreSQL 17.11 passed the existing ten book/country groups
and seven writer groups. The current TypeScript parser passed 14 checks against
the native envelopes, including exact timestamps, Unicode identity limits,
raw rights, promotion/discard receipts and malformed acknowledgement rejection.

Auth/staff roles and publication capture were synthetic local boundaries.
Production schema deployment, managed Auth/PostgREST and real canonical FK
registry acceptance were not exercised. The owned database process and its
loopback listener were stopped. No database data directory, installed binary,
dependency tree, credential or personal session is packaged.

The new migration is
`supabase/migrations/20261009082816_writer_biography_private_translation_review.sql`
(SHA256 `d9c9a31101bbf2193ff69fdab97591b7c6cb80098a754bfbba81095b8f8300be`).
Its maintained SQL fixture is
`scripts/database/fixtures/writer-biography-private-translation-review.sql`
(SHA256 `34bdea8566b08c2a22f26c258f241523d66597cf499c2107efb5eca1b9f0ae86`).
Earlier migrations and book/country function branches remain unchanged.

Verify archive and internal manifest hashes before extraction into empty
scratch directories. Historical absolute paths identify where evidence was
produced; adapt replay paths deliberately, retain original reports and use
fresh output labels. Never treat an old report as proof for changed sources.
The SQL fixture uses synthetic setup and must only run in an isolated database.

## Broad validation

`validation-evidence.zip` has SHA256
`e411af9f41c00034517d93484ccbc67050aad278ac6bdebe0029658d330433c5`.
Its 72 members include the internal manifest, final raw JSON, terminal command
receipts/logs, source snapshots, preservation checks, exact selection, baseline
failures and reproducible runners. The archive was checked member by member.

The final broad run passed 5992/5998 tests in 197 files, with no skips or todos.
All six failures match the pristine clone's missing historical M02 capture.
The admin build, admin TypeScript, Cloudflare TypeScript and client-secret
scanner passed. The unchanged readonly text gate reports the same 41 files.
The current selection is the inherited 196 files plus the new writer test; it
is different from the historical 197-file selection that included an
independent Telegram change. No failing assertion was skipped or weakened.

There was zero byte drift across the 10,631 tracked/new owned source files
through final tests and gates. Documentation and these evidence archives were
added afterwards. The tested non-doc source fingerprint is
`a08ae62048ff1aabde3d38771619e07b41d94ec09b2c4a4575f8c3e547075abd`.
After the checkpoint/README edit, a further readonly text check still reported
the same 41 files, and `git diff --check` passed. Full M07, M04, M02, M13 and R3
acceptance remains pending.
