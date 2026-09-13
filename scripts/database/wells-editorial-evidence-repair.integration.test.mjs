import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { buildWellsEditorialRepairFixture, wellsRepairMigration } from "./fixtures/build-wells-editorial-repair-fixture.mjs";

const probe = spawnSync("docker", ["info", "--format", "{{.ServerVersion}}"], { encoding: "utf8" });
const integrationTest = probe.status === 0 || process.env.CI ? it : it.skip;
const fixture = buildWellsEditorialRepairFixture();
const run = (args, input) => {
  const result = spawnSync("docker", args, { encoding: "utf8", input, timeout: 120_000, maxBuffer: 1_000_000 });
  if (result.status !== 0) throw new Error(result.error?.message || result.stderr || "Isolated Wells repair PostgreSQL command failed.");
  return result.stdout;
};

describe("reviewed Wells editorial repair", () => {
  it("installs a fixed-packet service RPC without mutating content or publication controls during installation", () => {
    expect(wellsRepairMigration).toContain("'d48b285b-8278-4551-91d7-30b3703df154'");
    expect(wellsRepairMigration).toContain("'d91a7f950bd540ffaf36f9566f343b4f5c20e83f24610c741e5430bda569872a'");
    expect(wellsRepairMigration).toContain("'015b97ada9cd080a67b5bea05c022405d1787faa1eea6540f4092b7ef41f774c'");
    expect(wellsRepairMigration).toContain("grant execute on function public.repair_wells_editorial_evidence_20260913(jsonb) to service_role;");
    expect(wellsRepairMigration).not.toMatch(/grant execute[^;]+to (?:anon|authenticated)|set\s+enforcement_enabled\s*=|set_literary_work_evidence_v2_enforcement/u);
    expect(wellsRepairMigration).not.toMatch(/update public\.literary_works set description|set is_cms_locked\s*=/u);
    expect(wellsRepairMigration).toContain("in share row exclusive mode nowait");
    expect(wellsRepairMigration).toContain("work_protected");
    expect(wellsRepairMigration).toContain("translations_protected");
    expect(wellsRepairMigration).toContain("sources_preserved");
  });
  it("patches only three uniquely recognized origin checks and retains the unchanged attestation validator", () => {
    expect(wellsRepairMigration).toContain("description-origin-contract-20260913: exact frozen-validator origin/method binding.");
    expect(wellsRepairMigration).toContain("is distinct from original_definition");
    expect(wellsRepairMigration).toContain("Evidence V2 description origin contract cannot be patched safely");
    expect(wellsRepairMigration).toContain("Installed description origin contract is not the reviewed version");
    expect(wellsRepairMigration).toContain("translation ->> 'method' is distinct from 'human-translation'");
    expect(wellsRepairMigration).toContain("translation ->> 'method' is distinct from 'editorial-original'");
    expect(fixture).not.toMatch(/-- __(?:REAL_|WELLS_|REVIEWED_)/u);
    expect(fixture.match(/do \$wells_description_origin_contract_20260913\$/gu)).toHaveLength(2);
    expect(fixture).toContain("Both descriptions require complete provenance");
    expect(fixture).toContain("Evidence validator or canon registry identity is stale");
    expect(fixture).toContain("Description evidence does not match stored content");
  });
  integrationTest("executes the reviewed packet through the real attester with rollback, preservation, idempotence and origin guards", async () => {
    if (probe.status !== 0) throw new Error("Docker is required for the CI Wells editorial repair contract.");
    const name = `probpera-wells-repair-${process.pid}-${randomUUID().slice(0, 8)}`;
    let started = false;
    try {
      run(["run", "--detach", "--rm", "--name", name, "--network", "none",
        "--env", "POSTGRES_PASSWORD=fixture-only", "--env", "POSTGRES_DB=wells_repair",
        process.env.POSTGRES_EVIDENCE_V2_TEST_IMAGE || "postgres:17-alpine"]);
      started = true;
      let ready = false;
      let consecutiveSuccesses = 0;
      for (let attempt = 0; attempt < 80; attempt += 1) {
        const check = spawnSync("docker", ["exec", name, "pg_isready", "-U", "postgres", "-d", "wells_repair"], { encoding: "utf8", timeout: 2000 });
        consecutiveSuccesses = check.status === 0 ? consecutiveSuccesses + 1 : 0;
        if (consecutiveSuccesses >= 3) { ready = true; break; }
        await new Promise(resolve => setTimeout(resolve, 250));
      }
      if (!ready) throw new Error("Isolated Wells repair PostgreSQL did not become ready.");
      const result = run(["exec", "--interactive", name, "psql", "-U", "postgres", "-d", "wells_repair",
        "--no-psqlrc", "--tuples-only", "--no-align", "--set=ON_ERROR_STOP=1"], fixture);
      expect(result).toContain("WELLS_EDITORIAL_REPAIR_CONTRACT_OK");
      expect(run(["exec", name, "psql", "-U", "postgres", "-d", "wells_repair", "-Atc",
        "select to_regclass('public.literary_works') is null"]).trim()).toBe("t");
    } finally {
      if (started) run(["rm", "--force", name]);
    }
  }, 150_000);
});
