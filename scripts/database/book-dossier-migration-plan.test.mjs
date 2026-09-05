import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { buildBookDossierMigrationPlan, DOSSIER_MIGRATION } from "./build-book-dossier-migration-plan.mjs";

const repositorySha = "a".repeat(40);
const workflowText = readFileSync(".github/workflows/apply-book-dossier-schema.yml", "utf8");
const workflow = parse(workflowText);

describe("isolated book dossier schema deployment", () => {
  it("accepts only the fixed reviewed migration and exact repository SHA", () => {
    const result = buildBookDossierMigrationPlan({ repositorySha });
    expect(result.manifest.migration).toEqual(DOSSIER_MIGRATION);
    expect(result.manifest.archivePublication).toBe(false);
    expect(() => buildBookDossierMigrationPlan({ repositorySha: "main" })).toThrow(/SHA/u);
    expect(() => buildBookDossierMigrationPlan({ repositorySha, source: "select 1;" })).toThrow(/mismatch/u);
    const original = readFileSync(`supabase/migrations/${DOSSIER_MIGRATION.filename}`, "utf8");
    expect(() => buildBookDossierMigrationPlan({ repositorySha, source: `${original}\n-- changed` })).toThrow(/mismatch/u);
  });

  it("keeps the historical ledger immutable and preflight genuinely read-only", () => {
    const { plan, preflight, verification, rehearsal } = buildBookDossierMigrationPlan({ repositorySha });
    expect(preflight).toMatch(/^set transaction read only;/u);
    expect(verification).toMatch(/^set transaction read only;/u);
    expect(preflight).not.toMatch(/\b(?:create|insert|update|delete|grant|revoke|notify)\b/iu);
    expect(plan).not.toMatch(/(?:insert into|update|delete from|alter table) public\.probpera_schema_migrations/iu);
    expect(plan).toContain("pg_advisory_xact_lock(hashtextextended('probpera-production-database-reconciliation'");
    expect(plan).toContain("Dossier function definition drift detected");
    expect(plan).not.toContain("$restore_acl$");
    expect(rehearsal).toContain("$restore_acl$");
    expect(rehearsal.endsWith(plan)).toBe(true);
  });

  it("defaults to a manual dry-run and reuses the guarded backup/transaction runner", () => {
    expect(Object.keys(workflow.on)).toEqual(["workflow_dispatch"]);
    expect(workflow.on.workflow_dispatch.inputs.mode.default).toBe("dry-run");
    expect(workflow.permissions).toEqual({ contents: "read" });
    expect(workflow.concurrency.group).toBe("production-database-reconciliation");
    const job = workflow.jobs["dossier-schema"];
    expect(job.if).toBe("github.ref == 'refs/heads/main'");
    expect(job.environment.name).toBe("production");
    const steps = job.steps;
    const position = part => steps.findIndex(step => (step.run || "").includes(part));
    const apply = position(" apply-plan ");
    expect(apply).toBeGreaterThan(position(" restore-drill "));
    expect(apply).toBeGreaterThan(position("git ls-remote"));
    expect(position(" restore-drill ")).toBeGreaterThan(steps.findIndex(step => step.uses === "actions/upload-artifact@v7"));
    expect(steps[apply].if).toBe("inputs.mode == 'apply'");
    expect(steps[position("dossier-schema/verification.sql")].if).toBe("inputs.mode == 'apply'");
    expect(workflowText).not.toMatch(/sync-literary-archive|SERVICE_ROLE|npm ci|build-production-migration-plan/u);
    expect(workflowText).toContain("dossier-schema/rehearsal.sql dossier-schema/restore-result.env");
    expect(workflowText).toContain("apply-plan dossier-schema/plan.sql");
    const helper = readFileSync("scripts/database/supabase-database-safety.sh", "utf8");
    expect(helper.slice(helper.indexOf("run_remote_psql()"), helper.indexOf("command_validate_target()"))).toContain("--single-transaction");
  });
});
