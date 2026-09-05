import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { buildBookDossierMigrationPlan, DOSSIER_MIGRATION, DOSSIER_LAYOUT_MIGRATION, DOSSIER_MIGRATIONS } from "./build-book-dossier-migration-plan.mjs";

const repositorySha = "a".repeat(40);
const workflowText = readFileSync(".github/workflows/apply-book-dossier-schema.yml", "utf8");
const workflow = parse(workflowText);

describe("isolated book dossier schema deployment", () => {
  it("accepts only the fixed reviewed migration and exact repository SHA", () => {
    const result = buildBookDossierMigrationPlan({ repositorySha });
    expect(result.manifest.migration).toEqual(DOSSIER_MIGRATION);
    expect(result.manifest.migrations).toEqual([DOSSIER_MIGRATION, DOSSIER_LAYOUT_MIGRATION]);
    expect(result.manifest.layoutVersion).toBe("book-inspection-layout-v4");
    expect(result.manifest.archivePublication).toBe(false);
    expect(() => buildBookDossierMigrationPlan({ repositorySha: "main" })).toThrow(/SHA/u);
    expect(() => buildBookDossierMigrationPlan({ repositorySha, source: "select 1;" })).toThrow(/mismatch/u);
    const original = readFileSync(`supabase/migrations/${DOSSIER_MIGRATION.filename}`, "utf8");
    expect(() => buildBookDossierMigrationPlan({ repositorySha, source: `${original}\n-- changed` })).toThrow(/mismatch/u);
    expect(() => buildBookDossierMigrationPlan({ repositorySha, layoutSource: "select 1;" })).toThrow(/mismatch/u);
  });

  it("keeps the historical ledger immutable and preflight genuinely read-only", () => {
    const { plan, preflight, verification, rehearsal } = buildBookDossierMigrationPlan({ repositorySha });
    expect(preflight).toMatch(/^set transaction read only;/u);
    expect(verification).toMatch(/^set transaction read only;/u);
    // Permission checks contain SQL privilege names inside string literals, not writes.
    expect(preflight.replace(/'(?:[^']|'')*'/gu, "''")).not.toMatch(/\b(?:create|insert|update|delete|grant|revoke|notify)\b/iu);
    expect(plan).not.toMatch(/(?:insert into|update|delete from|alter table) public\.probpera_schema_migrations/iu);
    expect(plan).toContain("pg_advisory_xact_lock(hashtextextended('probpera-production-database-reconciliation'");
    expect(plan).toContain("Dossier function definition drift detected");
    expect(plan.indexOf("Dossier function definition drift detected")).toBeLessThan(plan.indexOf("create table if not exists public.book_dossier_schema_migrations"));
    expect(plan).not.toMatch(/(?:update|delete from) public\.book_dossier_schema_migrations/iu);
    expect(plan).toContain("Dossier layout migration receipt missing");
    expect(verification).toContain("layout=book-inspection-layout-v4");
    expect(plan).not.toContain("$restore_acl$");
    expect(rehearsal).toContain("$restore_acl$");
    expect(rehearsal.endsWith(plan)).toBe(true);
  });

  it("adds only the new measured-layout requirement and public read guard to historical SQL", () => {
    const [previous, current] = DOSSIER_MIGRATIONS.map(migration => readFileSync(`supabase/migrations/${migration.filename}`, "utf8").replace(/\r\n?/gu, "\n"));
    const definition = (source, name) => source.match(new RegExp(`create or replace function public\\.${name}\\([\\s\\S]+?end; \\$\\$;`, "u"))?.[0];
    expect(definition(current, "book_dossier_design_proof_valid")).toBe(definition(previous, "book_dossier_design_proof_valid").replace("book-inspection-layout-v3", "book-inspection-layout-v4"));
    const addedGuard = "  -- A layout revision invalidates the old measured approval without rewriting its history.\n  if public.book_dossier_design_proof_valid(stored.record->'reviews'->3->'designProof', stored.record->'draft', stored.record->>'contentChecksum') is distinct from true then return null; end if;\n";
    expect(current).toContain(addedGuard);
    expect(definition(current, "get_published_book_dossier").replace(addedGuard, "")).toBe(definition(previous, "get_published_book_dossier"));
    expect(current).not.toMatch(/\b(?:insert into|update|delete from|alter table)\b/iu);
    expect([...current.matchAll(/create or replace function public\.(\w+)/gu)].map(match => match[1])).toEqual(["book_dossier_design_proof_valid", "get_published_book_dossier"]);
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
    const mainRecheck = position("/commits/main");
    expect(mainRecheck).toBeGreaterThanOrEqual(0);
    expect(apply).toBeGreaterThan(mainRecheck);
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
