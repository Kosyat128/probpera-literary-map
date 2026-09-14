import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const sql = readFileSync(new URL("./literary-archive-native-commit.sql", import.meta.url), "utf8");
const fixture = readFileSync(new URL("./fixtures/literary-archive-native-commit.sql", import.meta.url), "utf8");
const safety = readFileSync(new URL("./supabase-database-safety.sh", import.meta.url), "utf8");
const releaseId = "10000000-0000-4000-8000-000000000001";
const failedReleaseId = "10000000-0000-4000-8000-000000000002";
const manifest = "a".repeat(64);
const probe = spawnSync("docker", ["info", "--format", "{{.ServerVersion}}"], { encoding: "utf8", timeout: 5000 });
const nativeTest = probe.status === 0 || process.env.CI ? it : it.skip;

function docker(args, input, allowFailure = false) {
  const result = spawnSync("docker", args, { input, encoding: "utf8", timeout: 90_000, maxBuffer: 1_000_000 });
  if (!allowFailure && result.status !== 0) throw new Error(result.error?.message || result.stderr || "Isolated native commit test failed.");
  return result;
}

describe("native archive commit transaction transport", () => {
  it("calls only the existing two-argument RPC under local service settings", () => {
    expect([...sql.matchAll(/:'([^']+)'/gu)].map((match) => match[1])).toEqual(["release_id", "manifest_sha256"]);
    for (const setting of ["statement_timeout = '5min'", "lock_timeout = '15s'", "role service_role", "request.jwt.claims = '{\"role\":\"service_role\"}'", "request.jwt.claim.role = 'service_role'"]) {
      expect(sql.indexOf(`set local ${setting}`)).toBeGreaterThan(-1);
      expect(sql.indexOf(`set local ${setting}`)).toBeLessThan(sql.indexOf("public.commit_literary_archive_release("));
    }
    expect(sql).toContain("auth.uid() is not null");
    expect(sql).not.toMatch(/\b(?:insert|update|delete|grant|create function)\b/iu);
    const command = safety.slice(safety.indexOf("command_commit_archive()"), safety.indexOf("usage()", safety.indexOf("command_commit_archive()")));
    expect(command).toContain("--single-transaction");
    expect(command).toContain("--set=ON_ERROR_STOP=1");
    expect(command).toContain("--file /probpera-sql/literary-archive-native-commit.sql");
    expect(command).toContain("--env PGSSLMODE=require");
    expect(command).toContain("validate_database_url");
  });

  nativeTest("executes real psql parameters, role isolation, retry, rollback and restored session settings", async () => {
    if (probe.status !== 0) throw new Error("Docker is required for the CI native PostgreSQL transport contract.");
    const name = `probpera-native-commit-${process.pid}-${randomUUID().slice(0, 8)}`;
    let started = false;
    const psql = (input, options = {}) => docker([
      "exec", "--interactive", name, "psql", "-U", "postgres", "-d", "native_commit",
      "--no-psqlrc", "--quiet", "--tuples-only", "--no-align", "--set=ON_ERROR_STOP=1",
      `--set=release_id=${options.releaseId || releaseId}`,
      `--set=manifest_sha256=${options.manifest || manifest}`,
      ...(options.singleTransaction ? ["--single-transaction"] : []), "--file=-",
    ], input, options.allowFailure);
    const scalar = (query) => psql(query).stdout.trim();
    try {
      docker(["run", "--detach", "--rm", "--name", name, "--network", "none",
        "--env", "POSTGRES_PASSWORD=fixture-only", "--env", "POSTGRES_DB=native_commit",
        process.env.POSTGRES_EVIDENCE_V2_TEST_IMAGE || "postgres:17-alpine"]);
      started = true;
      let consecutive = 0;
      for (let attempt = 0; attempt < 80; attempt += 1) {
        const ready = spawnSync("docker", ["exec", name, "pg_isready", "-U", "postgres", "-d", "native_commit"], { encoding: "utf8", timeout: 2000 });
        consecutive = ready.status === 0 ? consecutive + 1 : 0;
        if (consecutive >= 3) break;
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      if (consecutive < 3) throw new Error("Isolated native PostgreSQL did not become ready.");
      psql(fixture);
      const envelope = JSON.parse(psql(sql, { singleTransaction: true }).stdout.trim());
      expect(envelope).toEqual({ transport: "native-postgres", elapsedMs: expect.any(Number), receipt: { releaseId, manifestSha256: manifest, alreadyCommitted: false } });
      expect(envelope.elapsedMs).toBeGreaterThanOrEqual(0);
      expect(JSON.parse(scalar("select observed_context from public.native_commit_fixture;"))).toEqual({ role: "service_role", uid: null, claims: { role: "service_role" }, statementTimeoutMs: 300000, lockTimeoutMs: 15000 });
      const retry = JSON.parse(psql(sql, { singleTransaction: true }).stdout.trim());
      expect(retry.receipt.alreadyCommitted).toBe(true);
      expect(scalar("select count(*) from public.native_commit_fixture;")).toBe("1");

      const failure = psql(sql, { releaseId: failedReleaseId, manifest: "f".repeat(64), singleTransaction: true, allowFailure: true });
      expect(failure.status).not.toBe(0);
      expect(failure.stderr).toContain("Fixture later phase failed after insertion");
      expect(scalar(`select count(*) from public.native_commit_fixture where release_id='${failedReleaseId}';`)).toBe("0");

      for (const role of ["anon", "authenticated"]) {
        expect(scalar(`select has_function_privilege('${role}','public.commit_literary_archive_release(uuid,text)','EXECUTE');`)).toBe("f");
        const denied = psql(`set role ${role}; select public.commit_literary_archive_release('${releaseId}','${manifest}');`, { allowFailure: true });
        expect(denied.status).not.toBe(0);
        expect(denied.stderr).toContain("permission denied for function commit_literary_archive_release");
      }
      expect(scalar("select has_function_privilege('service_role','public.commit_literary_archive_release(uuid,text)','EXECUTE');")).toBe("t");
      const human = psql(`set request.jwt.claim.sub='00000000-0000-4000-8000-000000000099';\n${sql}`, { singleTransaction: true, allowFailure: true });
      expect(human.status).not.toBe(0);
      expect(human.stderr).toContain("Native archive commit requires a service-only context");

      const restored = psql(`set statement_timeout='9s'; set lock_timeout='3s'; set request.jwt.claims='{}'; set request.jwt.claim.role='';\nbegin;\n${sql}\ncommit;\nselect jsonb_build_object('role',current_user,'statementTimeoutMs',(select setting::integer from pg_settings where name='statement_timeout'),'lockTimeoutMs',(select setting::integer from pg_settings where name='lock_timeout'),'claims',current_setting('request.jwt.claims'),'claimRole',current_setting('request.jwt.claim.role'));`).stdout.trim().split(/\r?\n/u);
      expect(JSON.parse(restored.at(-1))).toEqual({ role: "postgres", statementTimeoutMs: 9000, lockTimeoutMs: 3000, claims: "{}", claimRole: "" });
      expect(scalar("select count(*) from public.native_commit_fixture;")).toBe("1");
    } finally {
      if (started) docker(["rm", "--force", name]);
    }
  }, 150_000);
});
