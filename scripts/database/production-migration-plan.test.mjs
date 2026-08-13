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
      expect(manifest.migrations).toHaveLength(9);
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
      ]);
      expect(manifest.migrations.every((migration) => /^[0-9a-f]{64}$/u.test(migration.sha256))).toBe(true);
      expect(plan).not.toContain("\r\n");
      expect(plan).toContain("Historical migration checksum mismatch");
      expect(plan).toContain("Database ledger contains migrations outside this plan");
      expect(plan).toContain("Editorial schema health RPC did not report a current schema");
      expect(plan).toContain("pg_advisory_xact_lock");
      expect(plan).not.toMatch(/^\s*(?:begin|commit|rollback)\s*;/gimu);
      expect(verification).toContain("public.get_editorial_schema_health()");
      expect(verification).toContain("ledger_entries=");
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
    expect(
      workflowSource.indexOf("Persist encrypted backup before any production mutation")
    ).toBeLessThan(
      workflowSource.indexOf("Apply the verified plan to production")
    );
    expect(workflowSource).not.toMatch(/echo[^\n]*SUPABASE_DB_URL/iu);
  });
});
