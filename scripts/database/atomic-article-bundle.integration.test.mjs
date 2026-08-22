import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd());
const migration = readFileSync(
  path.join(root, "supabase/migrations/20260822_zz_atomic_article_bundle.sql"),
  "utf8"
);
const contractTemplate = readFileSync(
  path.join(root, "scripts/database/fixtures/atomic-article-bundle-contract.sql"),
  "utf8"
);
const marker = "-- __ATOMIC_ARTICLE_BUNDLE_MIGRATION__";
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
    maxBuffer: 16 * 1024 * 1024,
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
      "--dbname=probpera_atomic",
      "--no-psqlrc",
      "--tuples-only",
      "--no-align",
      "--command",
      "select current_database();",
    ]);
    if (
      lastProbe.status === 0 &&
      lastProbe.stdout.trim() === "probpera_atomic"
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
      "PostgreSQL did not finish creating probpera_atomic.",
      lastProbe ? commandFailure("Last readiness probe", lastProbe) : "",
      containerLogs(containerName),
    ]
      .filter(Boolean)
      .join("\n")
  );
}

function integrationSql() {
  const count = contractTemplate.split(marker).length - 1;
  if (count !== 1) {
    throw new Error(`Atomic fixture must contain one migration marker; found ${count}`);
  }
  return contractTemplate.replace(marker, migration.trim());
}

describe("atomic article bundle PostgreSQL contract", () => {
  integrationTest(
    "commits Russian and English together and rolls every side effect back on failure",
    () => {
      if (!dockerAvailable) {
        throw new Error(
          `Docker is required for the CI atomic integration test: ${
            dockerProbe.stderr?.trim() || "Docker daemon is unavailable"
          }`
        );
      }

      const containerName = `probpera-atomic-${process.pid}-${randomUUID()
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
            "POSTGRES_DB=probpera_atomic",
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
            "--dbname=probpera_atomic",
            "--no-psqlrc",
            "--set=ON_ERROR_STOP=1",
          ],
          { input: integrationSql(), timeout: 120_000 }
        );
        if (result.status !== 0) {
          throw new Error(commandFailure("Executing atomic article contract", result));
        }
        expect(result.stdout).toContain("ATOMIC_ARTICLE_BUNDLE_OK");
      } finally {
        if (started) {
          docker(["rm", "--force", containerName], { timeout: 20_000 });
        }
      }
    },
    300_000
  );
});
