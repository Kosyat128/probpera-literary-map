import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd());
const migration = readFileSync(
  path.join(root, "supabase/migrations/20260823_staff_opt_in_mfa_rls.sql"),
  "utf8"
);
const contractTemplate = readFileSync(
  path.join(root, "scripts/database/fixtures/staff-mfa-rls-contract.sql"),
  "utf8"
);
const marker = "-- __STAFF_MFA_RLS_MIGRATION__";
const postgresImage =
  process.env.POSTGRES_RLS_TEST_IMAGE || "postgres:17-alpine";
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
    maxBuffer: 12 * 1024 * 1024,
    ...options,
  });
}

function commandFailure(label, result) {
  return [
    `${label} failed with status ${String(result.status)}`,
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
          "PostgreSQL container stopped during MFA RLS initialization.",
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
      "--dbname=probpera_mfa_rls",
      "--no-psqlrc",
      "--tuples-only",
      "--no-align",
      "--command",
      "select current_database();",
    ]);
    if (
      lastProbe.status === 0 &&
      lastProbe.stdout.trim() === "probpera_mfa_rls"
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
      "PostgreSQL did not finish creating probpera_mfa_rls.",
      lastProbe ? commandFailure("Last readiness probe", lastProbe) : "",
      containerLogs(containerName),
    ]
      .filter(Boolean)
      .join("\n")
  );
}

function integrationSql() {
  const markerCount = contractTemplate.split(marker).length - 1;
  if (markerCount !== 1) {
    throw new Error(
      `Staff MFA fixture must contain exactly one migration marker; found ${markerCount}`
    );
  }
  // Use a function replacement so JavaScript does not interpret PostgreSQL
  // dollar-quote pairs (for example $$) as replacement-string tokens.
  return contractTemplate.replace(marker, () => migration.trim());
}

describe("staff opt-in MFA RLS integration contract", () => {
  integrationTest(
    "keeps unenrolled staff working, blocks verified aal1, allows aal2 and leaves readers unchanged",
    () => {
      if (!dockerAvailable) {
        throw new Error(
          `Docker is required for the CI staff MFA RLS test: ${
            dockerProbe.stderr?.trim() || "Docker daemon is unavailable"
          }`
        );
      }

      const containerName = `probpera-mfa-rls-${process.pid}-${randomUUID()
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
            "POSTGRES_DB=probpera_mfa_rls",
            postgresImage,
          ],
          { timeout: 120_000 }
        );
        if (start.status !== 0) {
          throw new Error(commandFailure("Starting PostgreSQL", start));
        }
        started = true;
        waitForDatabase(containerName);

        const result = docker(
          [
            "exec",
            "--interactive",
            containerName,
            "psql",
            "--username=postgres",
            "--dbname=probpera_mfa_rls",
            "--no-psqlrc",
            "--set=ON_ERROR_STOP=1",
          ],
          { input: integrationSql(), timeout: 120_000 }
        );
        if (result.status !== 0) {
          throw new Error(commandFailure("Executing staff MFA RLS contract", result));
        }
        expect(result.stdout).toContain("STAFF_MFA_RLS_OK");
      } finally {
        if (started) {
          docker(["rm", "--force", containerName], { timeout: 20_000 });
        }
      }
    },
    300_000
  );
});
