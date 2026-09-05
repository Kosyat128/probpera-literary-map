# Dossier schema-only deployment

Prepared source only. No workflow dispatch, production query, database mutation or deployment was performed for this implementation.

The existing `reconcile-production-database.yml` has no migration-only mode: it always continues into full literary archive publication. The separate manual `apply-book-dossier-schema.yml` uses the existing production environment and trusted `supabase-database-safety.sh` instead. It adds no secrets and needs only `contents: read`; DB URL, public Supabase URL and backup encryption key are the existing configuration. It never loads the service-role key or archive publisher.

The only accepted migration is `supabase/migrations/20260905_book_dossiers_v2.sql`, normalized UTF-8/LF SHA-256 `825e562a16bea91318e3e043876d5d5912824180837d038cabe68fdd9b66165e`. The script refuses different bytes. The existing reviewed Evidence V2 ledger receipt and runtime prerequisites must already exist. It creates the dossier table/functions and a separate RLS-protected `book_dossier_schema_migrations` receipt; it does not write the historical 35-entry ledger or replay historical migrations.

The new receipt is separate because the older reviewed planner intentionally rejects unexpected entries in its own ledger. This keeps that strict contract valid. Reapplication verifies the receipt, function-definition digest, policy, RPC grants, RLS and table shape, and preserves every existing dossier record. Unreceipted objects, changed checksums, changed function bodies or exposed private-table permissions stop the transaction. The PostgREST schema reload notification is committed with the migration.

## Run sequence after reviewed main merge

1. Dispatch **Apply book dossier schema only** on `main`, supplying its exact current 40-character SHA, `mode=dry-run`, and confirmation `REVIEW BOOK DOSSIER SCHEMA`.
2. The workflow validates the immutable checkout, fixed migration hash and allowlisted production identity. A SQL `READ ONLY` transaction checks prerequisites. It creates and encrypts a backup plus UUID-only auth sidecar, uploads those encrypted artifacts, then rehearses the complete migration and health gates on an isolated restored database.
3. Review that run and its manifest/health evidence. Dispatch again with the still-current exact main SHA, `mode=apply`, and `APPLY BOOK DOSSIER SCHEMA`. This run repeats the backup and rehearsal; it rechecks main and plan bytes immediately before applying the production plan through the existing `psql --single-transaction` helper, then runs read-only health verification.

Both modes share the existing `production-database-reconciliation` concurrency group. Production environment controls still apply. Dry-run performs production reads and backup only; it never applies the schema to production. No user-selectable SQL path, SQL body, checksum or project identifier exists.

The trusted restore helper uses `pg_restore --no-privileges`. Therefore `rehearsal.sql` restores only known dossier ACLs on that disposable database before running the exact production plan. `plan.sql`, the only file passed to production `apply-plan`, contains no rehearsal ACL normalization. Plaintext backups and identity sidecars are removed in an always-run cleanup step; uploaded evidence excludes those materials.

## Validation and limits

- 33 actual in-memory PGlite 0.5.8 PostgreSQL cases passed, including the fixed migration, failed-transaction rollback, no-write preflight, idempotent replay with saved records, unchanged historical ledger, drift refusal and disposable restore ACL handling. Existing rights/review/CAS/public-delivery cases remain covered.
- 28 focused source-contract tests passed for the new workflow/planner and unchanged historical deployment/data locks.
- The database foundation and prerequisite ledger in local execution are explicitly synthetic. The migration, compiler, staff helper and SHA helper are actual project source. Docker backup/restore and production environment access have not been executed locally or against production.
- The previous broad dispatcher independently watches `package.json` and other existing paths. It remains unchanged; merging this branch can still trigger that pre-existing broader workflow. This new manual path does not dispatch it.
- Successful schema deployment enables storage and RPC delivery. Publishing a dossier still requires actual staff authoring, rights evidence and all six human reviews; no such approval is created by the migration.
