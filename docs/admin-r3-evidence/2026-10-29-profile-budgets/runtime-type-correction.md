# Runtime evidence after the environment type correction

The initial runtime suite passed 39/39, but the subsequent admin TypeScript gate
rejected the newly added child-environment allowlist's inferred object type
against the application's augmented `NodeJS.ProcessEnv`. The correction adds
only `as NodeJS.ProcessEnv` to that expression in
`apps/admin/lib/profile-library-batch-budgets.integration.test.ts`. Inputs,
assertions, runtime allowlist, production code and the four CJS fixtures are
unchanged.

Actual admin TypeScript 5.9.3 transpilation with the admin compiler options emits
**byte-identical JavaScript** before and after the assertion, SHA-256
`d74821d27f33d48a5581393ca5aa6b071d1a4b59b43480eba19b085212573b11`.
The proof includes both TypeScript sources, both emitted files and compiler
options. The source changed from SHA-256
`2401a3c0ee96cb47d866ac5d1565d374390646c06098ddf8e4d904ab60fca1ee`
to `f27ebed12677e0b4336265c73c04d9a03baa531ce69be952682b3f55bb799c6f`.

Fresh commands on the corrected source completed:

- Maintained suite: **39/39 PASS**, zero failed/pending/todo, terminal exit 0.
- Standalone CURRENT controls: **33/33 PASS**, terminal exit 0.
- Admin TypeScript `--noEmit --incremental false`: terminal exit 0.

The final captured 26-file execution/test graph has aggregate SHA-256
`c8a3e1afa5a4dfd27875e6ea50bbc5a2bbd3502106a0f38221e20193eba60397`,
with no drift across those commands. Its only difference from the preceding
26-file snapshot is the type assertion in the new test. The other 25 files,
including all 21 actual application modules executed by the controls, are
unchanged. `type-correction-source-comparison.json` records that comparison.
This is a graph fingerprint, not a whole-repository fingerprint.

`runtime-regression-evidence-typefix.zip` has SHA-256
`143141b7d38d093a26572752f69231fb865951dbd868cd1b3d6e84af1c2c38b3`,
776499 bytes and 199 members. All 198 payload hashes were verified after ZIP
readback. It contains the original V1 archives, V2 paired failures/results,
transport-only diffs, type-equivalence proof, final raw runtime reports, source
snapshots and terminal receipts. Its adjacent manifest identifies the archive.

The preceding `runtime-regression-evidence.zip` remains unchanged with SHA-256
`63bad20db74b9a90a13427798fd313b9ad06a92a8c5abdc0bceda4995a44d9fd`.
Its successful runtime result and the separate initial TypeScript failure are
evidence of the earlier source, and are not relabelled as results for the fixed
file. Full-suite and build results have their own source snapshots and receipts.

All original scope limits remain: controlled synthetic transport, no paid or
production calls, per-invocation budgets only. Cross-run/global accounting and
restart uncertainty remain uncovered; this supplement establishes no complete
M07/R3 or full-repository acceptance claim.
