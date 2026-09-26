import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync, symlinkSync, linkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import { parse } from "yaml";
import { buildLiteraryNewsSchemaPlan, NEWS_RUNTIME_MIGRATION } from "./build-literary-news-schema-plan.mjs";

const repositorySha = "a".repeat(40);
const workflow = parse(readFileSync(".github/workflows/apply-literary-news-schema.yml", "utf8"));
const temporaryRoots=[];
afterEach(()=>{
  for(const root of temporaryRoots.splice(0)){
    if(!path.resolve(root).startsWith(path.join(path.resolve(tmpdir()),"r10-schema-cli-")))throw Error("Unexpected cleanup path");
    rmSync(root,{recursive:true,force:true});
  }
});
function cliFixture(){
  const base=mkdtempSync(path.join(tmpdir(),"r10-schema-cli-"));temporaryRoots.push(base);
  const root=path.join(base,"repo"),outside=path.join(base,"outside");
  mkdirSync(path.join(root,"scripts/database"),{recursive:true});mkdirSync(path.join(root,"supabase/migrations"),{recursive:true});mkdirSync(outside);
  const compiler=path.join(root,"scripts/database/build-literary-news-schema-plan.mjs");
  writeFileSync(compiler,readFileSync("scripts/database/build-literary-news-schema-plan.mjs"));
  writeFileSync(path.join(root,"supabase/migrations",NEWS_RUNTIME_MIGRATION.filename),readFileSync(`supabase/migrations/${NEWS_RUNTIME_MIGRATION.filename}`));
  return{root,outside,run:output=>spawnSync(process.execPath,[compiler,"--repository-sha",repositorySha,
    "--migration-sha",NEWS_RUNTIME_MIGRATION.sha256,"--output-dir",output],{cwd:outside,encoding:"utf8"})};
}
describe("guarded literary news runtime schema rollout", () => {
  it("writes both literal CLI targets inside its own checkout, preserving exact plan bytes from another cwd",()=>{
    const fixture=cliFixture(),expected=buildLiteraryNewsSchemaPlan({repositorySha});
    for(const output of ["news-runtime-schema","news-runtime-schema-recheck"]){
      const result=fixture.run(output);expect(result.status,result.stderr).toBe(0);
      for(const name of ["plan","rehearsal","preflight","verification"])
        expect(readFileSync(path.join(fixture.root,output,`${name}.sql`),"utf8")).toBe(expected[name]);
      expect(JSON.parse(readFileSync(path.join(fixture.root,output,"manifest.json"),"utf8"))).toEqual(expected.manifest);
      expect(fixture.run(output).status).toBe(0); // safe, byte-identical repeat
    }
    expect(readdirSync(fixture.outside)).toEqual([]);
  });
  it("rejects traversal, absolute paths and alternate encodings before any output write",()=>{
    const fixture=cliFixture();
    for(const input of ["../outside",fixture.outside,"news-runtime-schema/../outside","./news-runtime-schema",
      "news-runtime-schema\\..\\outside","news-runtime-schema%2f..%2foutside","file:///tmp/elsewhere"]){
      const result=fixture.run(input);expect(result.status).not.toBe(0);expect(result.stderr).toContain("Schema output must be");
    }
    expect(readdirSync(fixture.root).sort()).toEqual(["scripts","supabase"]);expect(readdirSync(fixture.outside)).toEqual([]);
  });
  it("rejects a fixed output directory redirected through a symlink or Windows junction",()=>{
    const fixture=cliFixture();symlinkSync(fixture.outside,path.join(fixture.root,"news-runtime-schema"),"junction");
    const result=fixture.run("news-runtime-schema");expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("must not redirect");expect(readdirSync(fixture.outside)).toEqual([]);
  });
  it("rejects an existing hard-linked output without modifying its external target or writing a partial plan",()=>{
    const fixture=cliFixture(),output=path.join(fixture.root,"news-runtime-schema"),outsideFile=path.join(fixture.outside,"keep.sql");
    mkdirSync(output);writeFileSync(outsideFile,"unchanged");linkSync(outsideFile,path.join(output,"plan.sql"));
    const result=fixture.run("news-runtime-schema");expect(result.status).not.toBe(0);expect(result.stderr).toContain("must not redirect");
    expect(readFileSync(outsideFile,"utf8")).toBe("unchanged");expect(readdirSync(output)).toEqual(["plan.sql"]);
  });
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
