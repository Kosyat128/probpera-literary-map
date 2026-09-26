# Literary news schema rollout

Prepared, not remotely executed. This adds a manual `apply-literary-news-schema.yml` workflow for the already reviewed `20260926_literary_news_runtime_cas.sql`; the migration and existing database safety helper are unchanged.

Inputs are the exact current main commit SHA, the migration's LF-normalized SHA-256 `4a097df7cadca82b59f1685d730aca7f8afe40704cabc409d5cf20ac8c54c402`, mode `dry-run` or `apply`, and the corresponding exact confirmation `REVIEW LITERARY NEWS SCHEMA` or `APPLY LITERARY NEWS SCHEMA`. The default is dry-run. The workflow is main-only and uses the existing production environment and shared database reconciliation concurrency group.

The fixed compiler checks its migration bytes and produces read-only preflight/verification, production transaction and isolated rehearsal plans with SHA-256 receipts. The workflow verifies target identity, creates a full encrypted backup and encrypted auth identity sidecar, and persists the artifact before any production mutation. It then restores the application schema in an isolated container with the unchanged safety helper, rehearses the transaction, repeats the main-tip and all generated-byte comparisons, requires the persisted backup artifact ID, and only in apply mode executes the plan with `psql --single-transaction --set=ON_ERROR_STOP=1`. A failing SQL guard rolls back functions, trigger, index and receipt together.

No new table is created. The immutable schema receipt uses the existing protected `admin_audit_log` namespace `history:schema:20260926_literary_news_runtime_cas`; the historical migration ledger remains unchanged. Existing unreceipted runtime objects fail closed. A repeated run succeeds only when the single receipt, migration hash, functions, owner, search path, exact effective ACL, index and enabled trigger match. ACL entries include grant-option state, and unexpected grantees are rejected.

The wrapper pins the three new function owners to postgres and limits their callers to the intended roles: the trigger function retains standard PUBLIC execute, service CAS is callable by service_role, and the staff operator RPC by authenticated. Its internal staff/AAL/role gates remain unchanged. Supabase's optional default grants are narrowed to those roles; unknown default grantees stop the transaction. The disposable restore requires its own exact database/user identity and normalizes these owners/ACLs because the established restore helper uses `--no-owner --no-privileges`. This normalization cannot run through the production plan.

Local validation: four focused Vitest checks pass; `local-check.json` records 21 substantive isolated PostgreSQL/PGlite assertions, including atomic rollback, idempotence, unrelated audit/history preservation, malformed prerequisites, owner/definition/ACL/trigger/index/receipt drift, extra role grants, grant options, and actual staff/service CAS behavior. The compiler requires no third-party dependency. Reproduce:

```powershell
npx vitest run --configLoader runner scripts/database/literary-news-schema-plan.test.mjs
node scripts/database/check-literary-news-schema-plan.mjs --pglite=../r10-sql-test/node_modules/@electric-sql/pglite/dist/index.js
```

The real Docker restore drill, workflow dispatch and production apply have not run locally. They remain required workflow gates after merge. This workflow performs schema installation only: it does not configure a destination, mark history reconciled, upload media, or publish a post.
