import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { exerciseRegistryTransport } from "./fixtures/book-evidence-v2-registry-transport.mjs";

const probe = spawnSync("docker", ["info", "--format", "{{.ServerVersion}}"], { encoding: "utf8" });
const integrationTest = probe.status === 0 || process.env.CI ? it : it.skip;
const run = (args, input) => {
  const result = spawnSync("docker", args, { encoding: "utf8", input, timeout: 120_000, maxBuffer: 1_000_000 });
  if (result.status !== 0) throw new Error(result.error?.message || result.stderr || "Isolated PostgreSQL transport command failed.");
  return result.stdout;
};

describe("registry JavaScript/PostgreSQL evidence transport", () => {
  integrationTest("binds actual JSONB bytes and JavaScript-generated reference and coverage payloads", async () => {
    if (probe.status !== 0) throw new Error("Docker is required for the CI registry transport contract.");
    const name = `probpera-registry-transport-${process.pid}-${randomUUID().slice(0, 8)}`;
    let started = false;
    try {
      run(["run", "--detach", "--rm", "--name", name, "--network", "none",
        "--env", "POSTGRES_PASSWORD=fixture-only", "--env", "POSTGRES_DB=registry_transport",
        process.env.POSTGRES_EVIDENCE_V2_TEST_IMAGE || "postgres:17-alpine"]);
      started = true;
      let ready = false;
      let consecutiveSuccesses = 0;
      for (let attempt = 0; attempt < 80; attempt += 1) {
        const check = spawnSync("docker", ["exec", name, "pg_isready", "-U", "postgres", "-d", "registry_transport"], { encoding: "utf8", timeout: 2000 });
        consecutiveSuccesses = check.status === 0 ? consecutiveSuccesses + 1 : 0;
        if (consecutiveSuccesses >= 3) { ready = true; break; }
        await new Promise(resolve => setTimeout(resolve, 250));
      }
      if (!ready) throw new Error("Isolated PostgreSQL transport database did not become ready.");
      const query = async (sql, values) => {
        const bound = sql.replace(/\$(\d+)/gu, (_, ordinal) => `'${values[Number(ordinal) - 1].replace(/'/gu, "''")}'`);
        const output = run(["exec", "--interactive", name, "psql", "-U", "postgres", "-d", "registry_transport",
          "--no-psqlrc", "--tuples-only", "--no-align", "--set=ON_ERROR_STOP=1"], `${bound};`);
        return output.trim().split(/\r?\n/u).map(line => JSON.parse(line));
      };
      expect(await exerciseRegistryTransport(query)).toEqual({ contentTextVerified: true, numericScalePreserved: true,
        writerReferencesVerified: 2, coverageTextVerified: true, staleTextAndContentRejected: true });
    } finally {
      if (started) run(["rm", "--force", name]);
    }
  }, 150_000);
});
