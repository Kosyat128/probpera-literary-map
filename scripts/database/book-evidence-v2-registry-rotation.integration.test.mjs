import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canonicalUtf8ContentSha256 } from "../lib/book-evidence-v2-attestations.mjs";
import { BOOK_EVIDENCE_V2_REGISTRY_TRANSITION as transition } from "../lib/book-evidence-v2-registry-rotation.mjs";

const read = (file) => readFileSync(file, "utf8").replace(/\r\n?/gu, "\n");
const migration = read("supabase/migrations/20260912_literary_work_evidence_v2_registry_rotation.sql");
const historical = read("supabase/migrations/20260902_zz_literary_archive_atomic_release.sql");
const fixture = read("scripts/database/fixtures/book-evidence-v2-registry-rotation-contract.sql");
const beforeAnchor = "  set constraints all deferred;\n\n  -- Full replacement semantics:";
const afterAnchor = "  select count(*)::integer\n  into predecessor_public_count\n  from public.literary_works work\n  where public.is_publishable_literary_work_pre_evidence_v2(work.id);";
const commit = historical.match(/create or replace function public\.commit_literary_archive_release\([\s\S]+?\n\$\$;/u)?.[0];
const sql = fixture.replace("-- __REGISTRY_ROTATION_MIGRATION__", () => `${migration}\n${migration}`);
const dockerProbe = spawnSync("docker", ["info", "--format", "{{.ServerVersion}}"], { encoding: "utf8" });
const integrationTest = dockerProbe.status === 0 || process.env.CI ? it : it.skip;
const docker = (args, options = {}) => spawnSync("docker", args,
  { encoding: "utf8", maxBuffer: 12 * 1024 * 1024, ...options });
function succeeded(result, label) {
  if (result.status !== 0) throw new Error(`${label}: ${result.error?.message || result.stderr || result.stdout}`);
}

describe("forward Evidence V2 registry SQL boundary", () => {
  it("retains historical migration bytes and finds exactly the intended locked commit boundaries", () => {
    expect(canonicalUtf8ContentSha256(historical)).toBe("a03f27a42fc6e7607dae6c46cb52292798ffc4eb931c470bfc2e9a481ebb1ef9");
    expect(commit).toBeTruthy();
    expect(commit.split(beforeAnchor)).toHaveLength(2);
    expect(commit.split(afterAnchor)).toHaveLength(2);
    expect(commit).toContain("CMS lock or stale live content blocks archive release");
    expect(commit.indexOf(beforeAnchor)).toBeGreaterThan(commit.indexOf("CMS lock or stale live content blocks archive release"));
    expect(commit.indexOf(afterAnchor)).toBeGreaterThan(commit.indexOf("perform public.attest_literary_work_evidence_v2("));
    expect(commit.indexOf(afterAnchor)).toBeLessThan(commit.indexOf("into invalid_attestation_count"));
    expect(commit.indexOf("if target.status = 'committed'")).toBeLessThan(commit.indexOf(beforeAnchor));
  });
  it("updates only the forward default and keeps the rotation private and transaction-bound", () => {
    expect(migration).toContain(`set default\n    '${transition.targetSha256}'`);
    expect(migration).not.toMatch(/set\s+enforcement_enabled\s*=|set_literary_work_evidence_v2_enforcement|insert into public\.literary_works|update public\.literary_works/iu);
    expect(migration).toContain("public.is_literary_work_evidence_v2_attested(live_work.id)");
    expect(migration).toContain("public.assert_literary_work_evidence_v2_health(");
    expect(migration).toContain("rotation -> 'priorPublicLegacyIds' is distinct from prior_keys");
    expect(migration).toContain("proof -> 'expectedContent' is distinct from public.literary_work_evidence_v2_content(live_work.id)");
    expect(migration).not.toMatch(/grant execute on function public\.(?:prepare|assert)_literary_archive_registry_rotation/u);
    expect(migration).not.toMatch(/^\s*(?:commit|rollback|begin)\s*;/gimu);
    expect(sql).not.toContain("-- __REGISTRY_ROTATION_MIGRATION__");
    expect(sql.match(/do \$literary_archive_registry_rotation_hooks\$/gu)).toHaveLength(2);
  });
  integrationTest("executes the exact forward migration twice and tests stale snapshots, prior-public coverage, rollback, enforcement and idempotency in PostgreSQL", () => {
    if (dockerProbe.status !== 0) throw new Error("Docker is required for the CI registry rotation contract");
    const name = `probpera-registry-rotation-${process.pid}-${randomUUID().slice(0, 8)}`;
    let started = false;
    try {
      const start = docker(["run", "--detach", "--rm", "--name", name, "--network", "none",
        "--env", "POSTGRES_PASSWORD=fixture-only", "--env", "POSTGRES_DB=registry_rotation",
        process.env.POSTGRES_EVIDENCE_V2_TEST_IMAGE || "postgres:17-alpine"], { timeout: 120_000 });
      succeeded(start, "Start isolated PostgreSQL"); started = true;
      let ready = false;
      let consecutiveSuccesses = 0;
      for (let attempt = 0; attempt < 80; attempt += 1) {
        const probe = docker(["exec", name, "psql", "-U", "postgres", "-d", "registry_rotation", "-Atc", "select 1"], { timeout: 2000 });
        consecutiveSuccesses = probe.status === 0 && probe.stdout.trim() === "1"
          ? consecutiveSuccesses + 1 : 0;
        if (consecutiveSuccesses >= 3) { ready = true; break; }
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
      }
      if (!ready) throw new Error("Isolated PostgreSQL database did not become ready");
      const execution = docker(["exec", "--interactive", name, "psql", "-U", "postgres", "-d", "registry_rotation",
        "--no-psqlrc", "--tuples-only", "--no-align", "--set=ON_ERROR_STOP=1"], { input: sql, timeout: 90_000 });
      succeeded(execution, "Execute registry rotation boundary fixture");
      expect(execution.stdout).toContain("REGISTRY_ROTATION_CONTRACT_OK");
      const rollback = docker(["exec", name, "psql", "-U", "postgres", "-d", "registry_rotation", "-Atc",
        "select to_regclass('public.literary_works') is null"], { timeout: 10_000 });
      succeeded(rollback, "Verify isolated fixture rollback");
      expect(rollback.stdout.trim()).toBe("t");
    } finally {
      if (started) docker(["rm", "--force", name], { timeout: 20_000 });
    }
  }, 240_000);
});
