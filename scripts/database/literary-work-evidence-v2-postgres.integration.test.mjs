import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd());
const migration = readFileSync(
  path.join(
    root,
    "supabase/migrations/20260902_literary_work_evidence_v2_attestations.sql"
  ),
  "utf8"
).replace(/\r\n?/gu, "\n");

const functionStartMarker =
  "create or replace function public.attest_literary_work_evidence_v2(\n";
const functionEndMarker =
  "\n$$;\n\nrevoke all on function public.attest_literary_work_evidence_v2(\n";
const functionTerminator = "\n$$;";
const expectedSignature =
  "public.attest_literary_work_evidence_v2(uuid,text,jsonb,jsonb,text,date)";
const expectedHeader = `create or replace function public.attest_literary_work_evidence_v2(
  p_work_id uuid,
  p_expected_content_sha256 text,
  p_expected_content jsonb,
  p_evidence jsonb,
  p_reviewer text,
  p_reviewed_at date
)
returns jsonb
language plpgsql`;

function exactMarkerOffset(source, marker, label) {
  const offsets = [];
  let offset = source.indexOf(marker);
  while (offset !== -1) {
    offsets.push(offset);
    offset = source.indexOf(marker, offset + marker.length);
  }
  if (offsets.length !== 1) {
    throw new Error(
      `Expected exactly one ${label} marker; found ${offsets.length}.`
    );
  }
  return offsets[0];
}

function extractAttestationFunction() {
  const start = exactMarkerOffset(
    migration,
    functionStartMarker,
    "attestation function start"
  );
  const end = exactMarkerOffset(
    migration,
    functionEndMarker,
    "attestation function end"
  );
  if (end <= start) {
    throw new Error("Attestation function end precedes its start.");
  }
  return migration.slice(start, end + functionTerminator.length);
}

const attestationFunction = extractAttestationFunction();
const postgresImage =
  process.env.POSTGRES_EVIDENCE_V2_TEST_IMAGE || "postgres:17-alpine";
const dockerProbe = spawnSync(
  "docker",
  ["info", "--format", "{{.ServerVersion}}"],
  { encoding: "utf8" }
);
const dockerAvailable = dockerProbe.status === 0;
const integrationTest = dockerAvailable || process.env.CI ? it : it.skip;

function sleep(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function docker(args, options = {}) {
  return spawnSync("docker", args, {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    ...options,
  });
}

function commandFailure(label, result) {
  return [
    `${label} failed with status ${String(result.status)}`,
    result.error?.message ? `error: ${result.error.message}` : "",
    result.stdout?.trim() ? `stdout:\n${result.stdout.trim()}` : "",
    result.stderr?.trim() ? `stderr:\n${result.stderr.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function containerLogs(containerName) {
  const result = docker(["logs", containerName], { timeout: 20_000 });
  return [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
}

function waitForDatabase(containerName) {
  let consecutiveSuccesses = 0;
  let lastProbe = null;

  for (let attempt = 0; attempt < 240; attempt += 1) {
    const state = docker([
      "inspect",
      "--format",
      "{{.State.Running}}",
      containerName,
    ]);
    if (state.status !== 0 || state.stdout.trim() !== "true") {
      throw new Error(
        [
          "PostgreSQL container stopped during initialization.",
          containerLogs(containerName),
        ]
          .filter(Boolean)
          .join("\n")
      );
    }

    lastProbe = docker([
      "exec",
      containerName,
      "psql",
      "--username=postgres",
      "--dbname=probpera_evidence_v2",
      "--no-psqlrc",
      "--tuples-only",
      "--no-align",
      "--command",
      "select current_database();",
    ]);
    if (
      lastProbe.status === 0 &&
      lastProbe.stdout.trim() === "probpera_evidence_v2"
    ) {
      consecutiveSuccesses += 1;
      if (consecutiveSuccesses >= 3) return;
    } else {
      consecutiveSuccesses = 0;
    }
    sleep(250);
  }

  throw new Error(
    [
      "PostgreSQL did not finish creating probpera_evidence_v2.",
      lastProbe ? commandFailure("Last readiness probe", lastProbe) : "",
      containerLogs(containerName),
    ]
      .filter(Boolean)
      .join("\n")
  );
}

function parseContractSql() {
  return `\\set ON_ERROR_STOP on
set check_function_bodies = on;
begin;
create schema auth;
create function auth.role()
returns text
language sql
stable
as $auth_role_stub$
  select 'service_role'::text;
$auth_role_stub$;

${attestationFunction}

select case
  when to_regprocedure('${expectedSignature}') is not null
    then 'EVIDENCE_V2_PARSE_OK'
  else 'EVIDENCE_V2_PARSE_MISSING'
end;
rollback;
`;
}

describe("literary-work Evidence V2 PostgreSQL grammar", () => {
  it("extracts exactly the complete attestation function and exact signature", () => {
    expect(attestationFunction.startsWith(expectedHeader)).toBe(true);
    expect(attestationFunction.endsWith(functionTerminator)).toBe(true);
    expect(attestationFunction).not.toContain(functionEndMarker);
    expect(attestationFunction.match(/create or replace function/gu)).toHaveLength(
      1
    );
    expect(parseContractSql()).toContain(`to_regprocedure('${expectedSignature}')`);
  });

  integrationTest(
    "compiles the exact function with check_function_bodies and rolls it back",
    () => {
      if (!dockerAvailable) {
        throw new Error(
          `Docker is required for the CI Evidence V2 PostgreSQL integration test: ${
            dockerProbe.error?.message ||
            dockerProbe.stderr?.trim() ||
            "Docker daemon is unavailable"
          }`
        );
      }

      const containerName = `probpera-evidence-v2-${process.pid}-${randomUUID()
        .replaceAll("-", "")
        .slice(0, 12)}`;
      let started = false;
      try {
        const start = docker(
          [
            "run",
            "--detach",
            "--rm",
            "--name",
            containerName,
            "--network",
            "none",
            "--env",
            "POSTGRES_PASSWORD=probpera-test-only",
            "--env",
            "POSTGRES_DB=probpera_evidence_v2",
            postgresImage,
          ],
          { timeout: 120_000 }
        );
        if (start.status !== 0) {
          throw new Error(commandFailure("Starting PostgreSQL", start));
        }
        started = true;
        waitForDatabase(containerName);

        const parse = docker(
          [
            "exec",
            "--interactive",
            containerName,
            "psql",
            "--username=postgres",
            "--dbname=probpera_evidence_v2",
            "--no-psqlrc",
            "--tuples-only",
            "--no-align",
            "--set=ON_ERROR_STOP=1",
          ],
          { input: parseContractSql(), timeout: 90_000 }
        );
        if (parse.status !== 0) {
          throw new Error(commandFailure("Compiling Evidence V2 function", parse));
        }
        expect(
          parse.stdout
            .split(/\r?\n/gu)
            .map((line) => line.trim())
        ).toContain("EVIDENCE_V2_PARSE_OK");

        const rollbackProbe = docker([
          "exec",
          containerName,
          "psql",
          "--username=postgres",
          "--dbname=probpera_evidence_v2",
          "--no-psqlrc",
          "--tuples-only",
          "--no-align",
          "--set=ON_ERROR_STOP=1",
          "--command",
          `select to_regprocedure('${expectedSignature}') is null;`,
        ]);
        if (rollbackProbe.status !== 0) {
          throw new Error(
            commandFailure("Verifying Evidence V2 rollback", rollbackProbe)
          );
        }
        expect(rollbackProbe.stdout.trim()).toBe("t");
      } finally {
        if (started) {
          docker(["rm", "--force", containerName], { timeout: 20_000 });
        }
      }
    },
    240_000
  );
});
