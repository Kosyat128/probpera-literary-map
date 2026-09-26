import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { buildLiteraryNewsSchemaPlan, NEWS_RUNTIME_MIGRATION } from "./build-literary-news-schema-plan.mjs";

const repositorySha = "a".repeat(40);
const workflow = parse(readFileSync(".github/workflows/apply-literary-news-schema.yml", "utf8"));
describe("guarded literary news runtime schema rollout", () => {
  it("pins the exact reviewed source and immutable invocation, including every output hash", () => {
    const result = buildLiteraryNewsSchemaPlan({ repositorySha });
    const source = readFileSync(`supabase/migrations/${NEWS_RUNTIME_MIGRATION.filename}`, "utf8");
    expect(() => buildLiteraryNewsSchemaPlan({ repositorySha: "main" })).toThrow(/SHA/);
    expect(() => buildLiteraryNewsSchemaPlan({ repositorySha, migrationSha: "b".repeat(64) })).toThrow(/mismatch/);
    expect(() => buildLiteraryNewsSchemaPlan({ repositorySha, source: source + "\n-- changed" })).toThrow(/mismatch/);
    expect(buildLiteraryNewsSchemaPlan({ repositorySha, source: source.replace(/\r?\n/g, "\r\n") })).toEqual(result);
    for (const key of ["plan", "rehearsal", "preflight", "verification"])
      expect(result.manifest[`${key}Sha256`]).toBe(createHash("sha256").update(result[key]).digest("hex"));
  });
  it("keeps preflight read-only and historical storage unchanged, with an isolated rehearsal guard", () => {
    const { plan, preflight, verification, rehearsal, manifest } = buildLiteraryNewsSchemaPlan({ repositorySha });
    for (const sql of [preflight, verification]) {
      expect(sql).toMatch(/^set transaction read only;/);
      expect(sql.replace(/'(?:[^']|'')*'/g, "''")).not.toMatch(/\b(?:create|insert|update|delete|grant|revoke|notify)\b/i);
    }
    expect(plan).not.toMatch(/(?:insert into|update|delete from|alter table) public\.probpera_schema_migrations/i);
    expect(manifest).toMatchObject({ newTables: 0, destinationBootstrap: false, externalPublication: false, historicalMigrationLedgerChanged: false });
    expect(rehearsal).toContain("current_database()<>'probpera_restore'");
    expect(rehearsal).toContain("current_user<>'supabase_admin'");
    expect(rehearsal.endsWith(plan)).toBe(true);
    expect(plan).toContain("aclexplode");
    expect(plan).toContain("News exact function ACL invariant failed");
  });
  it("allows only manual main runs and defaults to a non-applying rehearsal", () => {
    expect(Object.keys(workflow.on)).toEqual(["workflow_dispatch"]);
    expect(workflow.on.workflow_dispatch.inputs.mode.default).toBe("dry-run");
    expect(workflow.permissions).toEqual({ contents: "read" });
    expect(workflow.concurrency).toEqual({ group: "production-database-reconciliation", "cancel-in-progress": false });
    const job = workflow.jobs["news-runtime-schema"];
    expect(job.if).toBe("github.ref == 'refs/heads/main'");
    expect(job.environment.name).toBe("production");
    const validation = job.steps.find(step => step.name === "Validate immutable invocation").run;
    expect(validation).toContain('[[ "$GITHUB_SHA" == "$EXPECTED_MAIN_SHA" ]]');
    expect(validation).toContain('[[ "$(git rev-parse HEAD)" == "$EXPECTED_MAIN_SHA" ]]');
    expect(validation).toContain("APPLY LITERARY NEWS SCHEMA");
  });
  it("persists encryption before rehearsal and rechecks main and all plan bytes before one transaction", () => {
    const steps = workflow.jobs["news-runtime-schema"].steps;
    const position = fragment => steps.findIndex(step => step.run?.includes(fragment));
    const backup = steps.findIndex(step => step.id === "backup");
    const rehearsal = position(" restore-drill ");
    const recheck = position("/commits/main");
    const apply = position(" apply-plan ");
    expect(backup).toBeGreaterThan(position(" encrypt-verify "));
    expect(rehearsal).toBeGreaterThan(backup);
    expect(recheck).toBeGreaterThan(rehearsal);
    expect(apply).toBeGreaterThan(recheck);
    expect(steps[recheck].run).toContain("steps.backup.outputs.artifact-id");
    expect(steps[recheck].run).toContain("plan.sql rehearsal.sql preflight.sql verification.sql manifest.json");
    expect(steps[apply].if).toBe("inputs.mode == 'apply'");
    expect(steps[position("news-runtime-schema/verification.sql")].if).toBe("inputs.mode == 'apply'");
    const safety = readFileSync("scripts/database/supabase-database-safety.sh", "utf8");
    expect(safety).toContain("--single-transaction");
    expect(safety).toContain("--set=ON_ERROR_STOP=1");
    expect(steps[backup].with.path).not.toContain("*.dump\n");
    expect(steps[backup].with.path).toContain("*.enc");
  });
});
