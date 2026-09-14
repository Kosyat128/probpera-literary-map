import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { exerciseNativePostflight } from "./fixtures/literary-archive-native-postflight.mjs";

const probe = spawnSync("docker", ["info", "--format", "{{.ServerVersion}}"], { encoding: "utf8", timeout: 5000 });
const integrationTest = probe.status === 0 || process.env.CI ? it : it.skip;
function docker(args, input) {
  const result = spawnSync("docker", args, { input, encoding: "utf8", timeout: 90000, maxBuffer: 1000000 });
  if (result.status !== 0) throw Object.assign(new Error(result.error?.message || result.stderr || "Native read fixture failed"),
    { code: result.stderr?.match(/ERROR:\s+([A-Z0-9]{5})/u)?.[1] });
  return result.stdout;
}

describe("native archive read-only PostgreSQL boundary", () => {
  integrationTest("executes the real published assertion, enforces read-only service context and rejects content or child drift", async () => {
    if (probe.status !== 0) throw new Error("Docker is required for the CI native read-only archive contract.");
    const name = `probpera-native-read-${process.pid}-${randomUUID().slice(0, 8)}`;
    let started = false;
    try {
      docker(["run", "--detach", "--rm", "--name", name, "--network", "none",
        "--env", "POSTGRES_PASSWORD=fixture-only", "--env", "POSTGRES_DB=native_read",
        process.env.POSTGRES_EVIDENCE_V2_TEST_IMAGE || "postgres:17-alpine"]);
      started = true;
      let consecutive = 0;
      for (let attempt = 0; attempt < 80; attempt += 1) {
        const ready = spawnSync("docker", ["exec", name, "pg_isready", "-U", "postgres", "-d", "native_read"], { encoding: "utf8", timeout: 2000 });
        consecutive = ready.status === 0 ? consecutive + 1 : 0;
        if (consecutive >= 3) break;
        await new Promise(resolve => setTimeout(resolve, 250));
      }
      if (consecutive < 3) throw new Error("Isolated native-read PostgreSQL did not become ready.");
      const run = async sql => docker(["exec", "--interactive", name, "psql", "-U", "postgres", "-d", "native_read",
        "--no-psqlrc", "--quiet", "--tuples-only", "--no-align", "--set=ON_ERROR_STOP=1", "--set=VERBOSITY=sqlstate", "--file=-"], sql)
        .trim().split(/\r?\n/u).filter(Boolean).map(line => JSON.parse(line));
      expect(await exerciseNativePostflight(run)).toEqual({ realPublishedAssertion: true, readOnly: true,
        repeatableRead: true, serviceOnly: true, nullUid: true, writeRejected: true,
        contentDriftRejected: true, childDriftRejected: true, evidenceIdentityRejected: true, logicalReceiptDriftRejected: true,
        logicalMetadataMissingRejected: true, preconditionNative: true, sessionRestored: true });
    } finally { if (started) docker(["rm", "--force", name]); }
  }, 150000);
});
