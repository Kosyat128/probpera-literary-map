import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const root = path.resolve(process.cwd());
const planner = path.join(
  root,
  "scripts/database/build-production-migration-plan.mjs"
);
const helper = readFileSync(
  path.join(root, "scripts/database/supabase-database-safety.sh"),
  "utf8"
);
const workflowSource = readFileSync(
  path.join(root, ".github/workflows/reconcile-production-database.yml"),
  "utf8"
);
const backupWorkflow = readFileSync(
  path.join(root, ".github/workflows/backup.yml"),
  "utf8"
);
const dumpImplementation = helper.slice(
  helper.indexOf("command_dump()"),
  helper.indexOf("command_encrypt_verify()")
);
const readinessImplementation = helper.slice(
  helper.indexOf("wait_for_initialized_restore_database()"),
  helper.indexOf("verify_initialized_restore_vault()")
);
const vaultVerificationImplementation = helper.slice(
  helper.indexOf("verify_initialized_restore_vault()"),
  helper.indexOf("assert_empty_application_schema()")
);
const applicationOwnerImplementation = helper.slice(
  helper.indexOf("verify_isolated_application_owner()"),
  helper.indexOf("validate_database_url()")
);
const identityValidationImplementation = helper.slice(
  helper.indexOf("validate_identity_sidecar()"),
  helper.indexOf("wait_for_initialized_restore_database()")
);
const restoreImplementation = helper.slice(
  helper.indexOf("command_restore_drill()"),
  helper.indexOf("command_apply_plan()")
);

describe("guarded production database reconciliation", () => {
  it("builds only the reviewed ordered migration plan", () => {
    const temporaryDirectory = mkdtempSync(
      path.join(os.tmpdir(), "probpera-migration-plan-")
    );
    try {
      const planPath = path.join(temporaryDirectory, "plan.sql");
      const manifestPath = path.join(temporaryDirectory, "manifest.json");
      const verificationPath = path.join(temporaryDirectory, "verify.sql");
      execFileSync(process.execPath, [
        planner,
        "--output",
        planPath,
        "--manifest",
        manifestPath,
        "--verification",
        verificationPath,
        "--repository-sha",
        "0123456789abcdef0123456789abcdef01234567",
      ]);

      const plan = readFileSync(planPath, "utf8");
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      const verification = readFileSync(verificationPath, "utf8");
      expect(manifest.migrations).toHaveLength(14);
      expect(manifest.migrations.map((migration) => migration.filename)).toEqual([
        "20260808_article_translations.sql",
        "20260808_book_translations_and_import_staging.sql",
        "20260812_homepage_block_revisions.sql",
        "20260812_writer_and_work_revisions.sql",
        "20260813_editorial_database_admin.sql",
        "20260813_homepage_atomic_move.sql",
        "20260813_tags_updated_at.sql",
        "20260813_unified_revision_history.sql",
        "20260814_publication_outbox_and_schema_health.sql",
        "20260820_homepage_book_month_editorial_choice.sql",
        "20260820_literary_work_cover_artworks.sql",
        "20260822_staff_editorial_read_rls.sql",
        "20260822_zz_atomic_article_bundle.sql",
        "20260823_premium_machine_translation.sql",
      ]);
      expect(manifest.migrations.every((migration) => /^[0-9a-f]{64}$/u.test(migration.sha256))).toBe(true);
      expect(plan).not.toContain("\r\n");
      expect(plan).toContain("Historical migration checksum mismatch");
      expect(plan).toContain("Database ledger contains migrations outside this plan");
      expect(plan).toContain("Editorial schema health RPC did not report a current schema");
      expect(plan).toContain("pg_advisory_xact_lock");
      expect(plan).toContain("public.save_article_bundle");
      expect(plan).toContain("public.premium_machine_translation_ready");
      expect(plan).not.toMatch(/^\s*(?:begin|commit|rollback)\s*;/gimu);
      expect(verification).toContain("public.get_editorial_schema_health()");
      expect(verification).toContain("ledger_entries=");
      expect(verification).toContain("work_cover_artworks=");
      expect(verification).toContain("staff_editorial_read_policies=");
      expect(verification).toContain("article_bundle_rpc=");
      expect(verification).toContain("premium_machine_translation=");
      expect(verification).toContain("then 'true' else 'false' end");
    } finally {
      rmSync(temporaryDirectory, { recursive: true, force: true });
    }
  });

  it("keeps backup and reconciliation on the same restore implementation", () => {
    expect(backupWorkflow).toContain(
      "scripts/database/supabase-database-safety.sh restore-drill"
    );
    expect(workflowSource).toContain(
      "scripts/database/supabase-database-safety.sh restore-drill"
    );
    expect(helper).toContain("pg_restore");
    expect(helper).toContain("--exit-on-error");
    expect(helper).toContain("--single-transaction");
    expect(helper).toContain("PGSSLMODE=require");
    expect(helper).toContain(
      'readonly EXPECTED_PRODUCTION_PROJECT_REF="sjqejjmwpzfsczxdghvw"'
    );
    expect(helper).toContain(
      'db.${EXPECTED_PRODUCTION_PROJECT_REF}.supabase.co'
    );
    expect(helper).toContain(
      'postgres.${EXPECTED_PRODUCTION_PROJECT_REF}'
    );
    expect(helper).toContain('SUPABASE_DB_URL must contain exactly one database host.');
    expect(helper).toContain(
      'db_query" == "sslmode=require" || "$db_query" == "sslmode=verify-full"'
    );
    expect(helper).toContain(
      'SUPABASE_DB_URL must connect only to the postgres database.'
    );
    expect(helper).not.toContain('[[ "$SUPABASE_DB_URL" == *"$project_ref"* ]]');
  });

  it("passes the validated database URI explicitly to every remote client", () => {
    expect(
      helper.match(/--dbname="\$SUPABASE_DB_URL"/gu)
    ).toHaveLength(5);
    expect(helper).not.toContain("PGDATABASE");
    expect(helper).not.toMatch(/(?:echo|printf)[^\n]*SUPABASE_DB_URL/iu);
  });

  it("waits for the final base server and verifies initialized platform Vault", () => {
    expect(restoreImplementation).toContain(
      "--env POSTGRES_DB=probpera_restore"
    );
    expect(readinessImplementation).not.toContain("/proc/1/comm");
    expect(readinessImplementation).not.toContain("/proc/1/cmdline");
    expect(readinessImplementation).not.toContain("/proc/1/exe");
    expect(readinessImplementation).not.toContain("readlink");
    expect(readinessImplementation).not.toContain("/proc/$");
    expect(readinessImplementation).not.toContain("coproc");
    expect(readinessImplementation).not.toContain("pg_read_file");
    expect(readinessImplementation).not.toContain("pg_backend_pid");
    expect(readinessImplementation).not.toMatch(/\bgrant\b/iu);
    expect(readinessImplementation).toContain(
      "IFS= read -r postmaster_pid < /var/lib/postgresql/data/postmaster.pid"
    );
    expect(readinessImplementation).toContain(
      '[ "$postmaster_pid" = "1" ]'
    );
    expect(readinessImplementation.indexOf("postmaster.pid")).toBeLessThan(
      readinessImplementation.indexOf(
        'docker exec "$RESTORE_CONTAINER" pg_isready'
      )
    );
    expect(readinessImplementation).toContain("pg_isready");
    expect(readinessImplementation).toContain(
      '--host="$ISOLATED_DATABASE_HOST"'
    );
    expect(readinessImplementation).toContain("--username=postgres");
    expect(readinessImplementation).toContain("--dbname=probpera_restore");
    expect(helper).toContain(
      'readonly ISOLATED_DATABASE_HOST="/var/run/postgresql"'
    );
    expect(
      helper.match(/--host="\$ISOLATED_DATABASE_HOST"/gu)
    ).toHaveLength(13);
    expect(
      helper.match(
        /docker exec(?: --interactive)? "\$RESTORE_CONTAINER" (?:psql|pg_isready|pg_restore) \\/gu
      )
    ).toHaveLength(13);
    expect(helper).not.toContain("--env PGHOST=");
    expect(readinessImplementation).not.toContain("supabase_vault");
    expect(readinessImplementation).not.toContain("vault.secrets");
    expect(readinessImplementation).toContain(
      "to_regclass('auth.users') is not null"
    );
    expect(readinessImplementation).toContain("column_name = 'id'");
    expect(readinessImplementation).toContain("udt_name = 'uuid'");
    expect(readinessImplementation).toContain("is_nullable = 'NO'");
    expect(readinessImplementation).toContain("column_name <> 'id'");
    expect(readinessImplementation).toContain("column_default is null");
    expect(readinessImplementation).toContain("is_identity = 'NO'");
    expect(readinessImplementation).toContain("is_generated = 'NEVER'");
    expect(readinessImplementation).toContain("c.contype in ('p', 'u')");
    expect(readinessImplementation).toContain("cardinality(c.conkey) = 1");
    expect(readinessImplementation).toContain(
      '"t|t|t|t|t"'
    );
    expect(readinessImplementation).not.toContain(
      "to_regnamespace('storage')"
    );
    expect(helper).not.toMatch(/create\s+schema\s+storage/iu);
    expect(readinessImplementation).toContain(
      "Isolated base vector (database|auth_users|auth_schema|roles|auth_id_contract)"
    );
    expect(readinessImplementation).toContain(
      "^[tf]\\|[tf]\\|[tf]\\|[tf]\\|[tf]$"
    );
    expect(readinessImplementation).toContain(
      'local diagnostic_state="unavailable"'
    );
    expect(readinessImplementation).toContain(
      'local postmaster_pid_stage="waiting"'
    );
    expect(readinessImplementation).toContain(
      'local pg_isready_stage="not-run"'
    );
    expect(readinessImplementation).toContain('local query_stage="not-run"');
    expect(readinessImplementation).toContain(
      'postmaster_pid_stage="ready"'
    );
    expect(readinessImplementation).toContain('pg_isready_stage="ready"');
    expect(readinessImplementation).toContain('query_stage="error"');
    expect(readinessImplementation).toContain('query_stage="invalid-output"');
    expect(readinessImplementation).toContain(
      "Isolated readiness stages (postmaster_pid|pg_isready|query)"
    );
    expect(readinessImplementation).toContain(
      "did not reach the exact initialized base platform state"
    );
    expect(readinessImplementation).not.toContain("|| true");

    expect(vaultVerificationImplementation).toContain(
      "to_regnamespace('vault') is not null"
    );
    expect(vaultVerificationImplementation).toContain(
      "e.extname = 'supabase_vault' and n.nspname = 'vault'"
    );
    expect(vaultVerificationImplementation).toContain(
      "default_version is not null"
    );
    expect(vaultVerificationImplementation).toContain(
      "e.extversion = a.default_version"
    );
    expect(vaultVerificationImplementation).toContain(
      "c.relname = 'secrets' and c.relkind in ('r', 'p')"
    );
    expect(vaultVerificationImplementation).toContain('"t|t|t|t|t"');
    expect(vaultVerificationImplementation).toContain(
      "^[tf]\\|[tf]\\|[tf]\\|[tf]\\|[tf]$"
    );
    expect(vaultVerificationImplementation).toContain(
      "Isolated Vault vector (database|schema|extension_schema|extension_version|secrets_table)"
    );
    expect(vaultVerificationImplementation).toContain("--set=ON_ERROR_STOP=1");
    expect(vaultVerificationImplementation).not.toContain(
      "--single-transaction"
    );
    expect(vaultVerificationImplementation).not.toMatch(
      /create\s+(?:schema|extension)/iu
    );
    expect(vaultVerificationImplementation).not.toMatch(/\bgrant\b/iu);
    expect(vaultVerificationImplementation).not.toMatch(/\bhook\b/iu);
    expect(vaultVerificationImplementation).not.toMatch(/if\s+not\s+exists/iu);
    expect(vaultVerificationImplementation).not.toContain("|| true");
    expect(vaultVerificationImplementation).toContain(
      "Isolated platform Vault is not initialized to the exact schema, extension version, and secrets table state"
    );
    expect(restoreImplementation.indexOf("wait_for_initialized_restore_database"))
      .toBeLessThan(restoreImplementation.indexOf("verify_initialized_restore_vault"));
    expect(restoreImplementation.indexOf("verify_initialized_restore_vault"))
      .toBeLessThan(restoreImplementation.indexOf("assert_empty_application_schema"));
  });

  it("preflights and uses the pinned application owner only for application writes", () => {
    expect(applicationOwnerImplementation).toContain(
      "exists (select 1 from pg_catalog.pg_roles where rolname = 'supabase_admin')"
    );
    expect(applicationOwnerImplementation).toContain("rolcanlogin");
    expect(applicationOwnerImplementation).toContain("rolsuper");
    expect(applicationOwnerImplementation).toContain(
      "has_schema_privilege(r.oid, 'public', 'CREATE')"
    );
    expect(applicationOwnerImplementation).toContain('"t|t|t|t|t"');
    expect(applicationOwnerImplementation).toContain(
      "^[tf]\\|[tf]\\|[tf]\\|[tf]\\|[tf]$"
    );
    expect(applicationOwnerImplementation).toContain(
      "Isolated application-owner vector (database|role|login|superuser|public_create)"
    );
    expect(applicationOwnerImplementation).toContain("--username=postgres");
    expect(applicationOwnerImplementation).not.toContain(
      "--username=supabase_admin"
    );
    expect(helper).not.toMatch(/^\s*(?:grant|revoke)\b/gimu);
    expect(
      helper.match(/--username=supabase_admin/gu)
    ).toHaveLength(2);

    const restoreClient = restoreImplementation.slice(
      restoreImplementation.indexOf(
        'docker exec "$RESTORE_CONTAINER" pg_restore'
      ),
      restoreImplementation.indexOf(
        "verify_seeded_identity_ids",
        restoreImplementation.indexOf(
          'docker exec "$RESTORE_CONTAINER" pg_restore'
        )
      )
    );
    expect(restoreClient).toContain("--username=supabase_admin");

    const planClient = restoreImplementation.slice(
      restoreImplementation.indexOf(
        'docker cp "$plan_absolute" "$RESTORE_CONTAINER:/tmp/reconciliation.sql"'
      ),
      restoreImplementation.indexOf("restored_articles=")
    );
    expect(planClient).toContain("--username=supabase_admin");
    expect(planClient).toContain("--file=/tmp/reconciliation.sql");
    expect(restoreImplementation.indexOf("assert_empty_application_schema"))
      .toBeLessThan(restoreImplementation.indexOf("verify_isolated_application_owner"));
    expect(restoreImplementation.indexOf("verify_isolated_application_owner"))
      .toBeLessThan(restoreImplementation.indexOf('docker cp "$dump"'));
  });

  it("keeps a full recovery dump and strictly drills the public application slice", () => {
    expect(dumpImplementation).toContain("--format=custom");
    expect(dumpImplementation).not.toContain("--schema=public");
    expect(restoreImplementation).toContain(
      "assert_empty_application_schema"
    );
    expect(helper).toContain(
      "Isolated application schema is not empty."
    );
    expect(restoreImplementation).toContain("--schema=public");
    expect(restoreImplementation).not.toContain("--data-only");
    expect(restoreImplementation).not.toContain("--schema=auth");
    expect(restoreImplementation).not.toContain("--table=users");
    expect(restoreImplementation).toContain("--strict-names");
    expect(restoreImplementation).toContain("--exit-on-error");
    expect(restoreImplementation).toContain(
      "restore_scope=public-application-schema"
    );
    expect(restoreImplementation).toContain(
      "identity_seed=auth-user-id-sidecar-v1"
    );
    expect(restoreImplementation).toContain("identity_seed_sha256=");
    expect(
      restoreImplementation.match(
        /\s+docker exec "\$RESTORE_CONTAINER" pg_restore \\/gu
      )
    ).toHaveLength(1);
    expect(restoreImplementation).not.toMatch(/^\s+--clean(?:\s|\\)/mu);
    expect(restoreImplementation).not.toMatch(/^\s+--if-exists(?:\s|\\)/mu);
    expect(restoreImplementation).not.toMatch(
      /--(?:exclude-schema|exclude-table|use-list)/u
    );
    expect(restoreImplementation.indexOf("wait_for_initialized_restore_database"))
      .toBeLessThan(restoreImplementation.indexOf("assert_empty_application_schema"));
    expect(restoreImplementation.indexOf("assert_empty_application_schema"))
      .toBeLessThan(restoreImplementation.indexOf("pg_restore"));
  });

  it("exports, validates, and seeds only canonical auth user UUIDs", () => {
    expect(dumpImplementation).toContain(
      "select lower(id::text) from auth.users order by id;"
    );
    expect(dumpImplementation).toContain("format=probpera-auth-user-ids-v1");
    expect(dumpImplementation).toContain("count=%s");
    expect(dumpImplementation).toContain("sha256=%s");
    expect(dumpImplementation).toContain("LC_ALL=C sort -c -u");
    expect(dumpImplementation).not.toMatch(
      /auth\.users[^\n]*(?:email|phone|password|metadata)/iu
    );

    expect(identityValidationImplementation).toContain(
      "format=probpera-auth-user-ids-v1"
    );
    expect(identityValidationImplementation).toContain(
      "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"
    );
    expect(identityValidationImplementation).toContain("cmp --silent");
    expect(identityValidationImplementation).toContain("LC_ALL=C sort -c -u");
    expect(identityValidationImplementation).toContain(
      "count does not match its body"
    );
    expect(identityValidationImplementation).toContain(
      "digest does not match its body"
    );

    expect(restoreImplementation).toContain(
      'validate_identity_sidecar "$identity_sidecar"'
    );
    expect(restoreImplementation).toContain(
      "\\copy auth.users (id) from pstdin with (format text)"
    );
    expect(restoreImplementation).not.toMatch(
      /(?:insert|copy|\\copy)\s+(?:into\s+)?auth\.users\s*\((?!id\))/iu
    );
    expect(identityValidationImplementation).toContain(
      'cmp --silent "$RESTORE_IDENTITY_BODY" "$RESTORE_IDENTITY_RAW"'
    );
    expect(identityValidationImplementation).toContain(
      '"$restored_digest" == "$RESTORE_IDENTITY_DIGEST"'
    );
    expect(identityValidationImplementation).toContain(
      '"$restored_count" == "$RESTORE_IDENTITY_COUNT"'
    );
    expect(
      restoreImplementation.match(/verify_seeded_identity_ids/gu)
    ).toHaveLength(2);
  });

  it("keeps restore cleanup state alive until the EXIT trap runs", () => {
    expect(helper).toContain('RESTORE_CONTAINER=""');
    expect(helper).toContain('RESTORE_IDENTITY_BODY=""');
    expect(helper).toContain('RESTORE_IDENTITY_RAW=""');
    expect(helper).toContain(
      'local active_container="${RESTORE_CONTAINER:-}"'
    );
    expect(helper).toContain(
      "Failed to remove the isolated restore container."
    );
    expect(helper).toContain('trap cleanup_restore EXIT');
    expect(helper).not.toContain("local dump plan result container");
    expect(helper).not.toContain('docker rm --force "$container"');
  });

  it("requires an exact main SHA, confirmation, lock, and production environment", () => {
    const workflow = parse(workflowSource);
    expect(workflow.on).toEqual({
      workflow_dispatch: {
        inputs: expect.objectContaining({
          expected_main_sha: expect.objectContaining({ required: true }),
          confirmation: expect.objectContaining({ required: true }),
        }),
      },
    });
    expect(workflow.concurrency).toEqual({
      group: "production-database-reconciliation",
      "cancel-in-progress": false,
    });
    expect(workflow.jobs.reconcile.environment).toEqual({ name: "production" });
    expect(workflowSource).toContain("RECONCILE PRODUCTION DATABASE");
    expect(workflowSource).toContain("git ls-remote --exit-code origin refs/heads/main");
    expect(workflowSource).toContain("actions/upload-artifact@v7");
    expect(workflowSource).toContain(
      "schema_health=20260822_zz_atomic_article_bundle;outbox=true;outbox_rpc=true;article_bundle_rpc=true;publication_triggers=true;staff_editorial_read_policies=true;revision_history=true;work_translations=true;work_cover_artworks=true;country_overrides=true;writer_overrides=true;homepage_move=true;tags_updated_at=true;migration_ledger=true;premium_machine_translation=true;ledger_entries=14;invalid_indexes=0"
    );
    expect(workflowSource).toContain(
      '[[ "$restore_scope" == "public-application-schema" ]]'
    );
    expect(workflowSource).toContain(
      '[[ "$identity_seed" == "auth-user-id-sidecar-v1" ]]'
    );
    expect(backupWorkflow).toContain(
      '[[ "$restore_scope" == "public-application-schema" ]]'
    );
    expect(backupWorkflow).toContain(
      '[[ "$identity_seed" == "auth-user-id-sidecar-v1" ]]'
    );
    expect(workflowSource).toContain(
      '[[ "$identity_seed_sha256" =~ ^[0-9a-f]{64}$ ]]'
    );
    expect(backupWorkflow).toContain(
      '[[ "$identity_seed_sha256" =~ ^[0-9a-f]{64}$ ]]'
    );
    expect(workflowSource).toContain(
      "Verified auth identity sidecar SHA-256: $identity_seed_sha256"
    );
    expect(backupWorkflow).toContain(
      "Verified auth identity sidecar SHA-256: $identity_seed_sha256"
    );
    expect(backupWorkflow).toContain(
      "backup/database/auth-user-ids.seed"
    );
    expect(backupWorkflow).toContain("verify-auth-user-ids.seed");
    expect(backupWorkflow).toMatch(
      /- name: Encrypt and verify archive[\s\S]*?run: \|\n\s+umask 077/u
    );
    expect(workflowSource).toContain("auth-user-ids.seed");
    expect(workflowSource).toContain("identity_archive=$identity_archive");
    expect(workflowSource).toContain(
      "${{ steps.archive.outputs.identity_archive }}.sha256"
    );
    const backupUpload = backupWorkflow.slice(
      backupWorkflow.indexOf("- name: Upload encrypted backup"),
      backupWorkflow.indexOf(
        "- name: Restore application schema into an isolated Supabase database"
      )
    );
    const reconciliationUpload = workflowSource.slice(
      workflowSource.indexOf(
        "- name: Persist encrypted backup before any production mutation"
      ),
      workflowSource.indexOf(
        "- name: Restore and reconcile the isolated application schema"
      )
    );
    expect(backupUpload).not.toContain("verify-auth-user-ids.seed");
    expect(backupUpload).not.toContain("backup/database/auth-user-ids.seed");
    expect(reconciliationUpload).not.toContain(
      "reconciliation/auth-user-ids.seed"
    );
    expect(reconciliationUpload).not.toContain(
      "reconciliation/auth-user-ids.verified.seed"
    );
    expect(
      backupWorkflow.indexOf("Upload encrypted backup")
    ).toBeLessThan(
      backupWorkflow.indexOf(
        "Restore application schema into an isolated Supabase database"
      )
    );
    expect(
      workflowSource.indexOf("Persist encrypted backup before any production mutation")
    ).toBeLessThan(
      workflowSource.indexOf("Restore and reconcile the isolated application schema")
    );
    expect(
      workflowSource.indexOf("Persist encrypted backup before any production mutation")
    ).toBeLessThan(
      workflowSource.indexOf("Apply the verified plan to production")
    );
    expect(workflowSource).not.toMatch(/echo[^\n]*SUPABASE_DB_URL/iu);
  });
});
