import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd());
const hotfix = readFileSync(
  path.join(
    root,
    "supabase/hotfixes/20260821_articles_staff_read_rls.sql"
  ),
  "utf8"
);
const contractTemplate = readFileSync(
  path.join(root, "scripts/database/fixtures/article-rls-contract.sql"),
  "utf8"
);
const hotfixMarker = "-- __ARTICLE_RLS_HOTFIX__";
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
    maxBuffer: 8 * 1024 * 1024,
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

  // The official image briefly starts a temporary PostgreSQL server while it
  // creates POSTGRES_DB. pg_isready can report success during that phase even
  // though the requested database does not exist yet. Require three successful
  // SQL connections to the exact database so the test cannot race initdb.
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
      "--dbname=probpera_rls",
      "--no-psqlrc",
      "--tuples-only",
      "--no-align",
      "--command",
      "select current_database();",
    ]);

    if (
      lastProbe.status === 0 &&
      lastProbe.stdout.trim() === "probpera_rls"
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
      "PostgreSQL did not finish creating probpera_rls for the integration test.",
      lastProbe ? commandFailure("Last database readiness probe", lastProbe) : "",
      containerLogs(containerName),
    ]
      .filter(Boolean)
      .join("\n")
  );
}

function integrationSql() {
  const markerCount = contractTemplate.split(hotfixMarker).length - 1;
  if (markerCount !== 1) {
    throw new Error(
      `Article RLS fixture must contain exactly one hotfix marker; found ${markerCount}`
    );
  }
  return contractTemplate.replace(hotfixMarker, hotfix.trim());
}

describe("article RLS integration contract", () => {
  integrationTest(
    "executes staff INSERT ... RETURNING and keeps drafts private",
    () => {
      if (!dockerAvailable) {
        throw new Error(
          `Docker is required for the CI RLS integration test: ${
            dockerProbe.stderr?.trim() || "Docker daemon is unavailable"
          }`
        );
      }

      const containerName = `probpera-rls-${process.pid}-${randomUUID()
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
            "POSTGRES_DB=probpera_rls",
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
            "--dbname=probpera_rls",
            "--no-psqlrc",
            "--set=ON_ERROR_STOP=1",
          ],
          {
            input: integrationSql(),
            timeout: 90_000,
          }
        );
        if (result.status !== 0) {
          throw new Error(commandFailure("Executing the RLS contract", result));
        }
        expect(result.stdout).toContain("RLS_CONTRACT_OK");
      } finally {
        if (started) {
          docker(["rm", "--force", containerName], { timeout: 20_000 });
        }
      }
    },
    240_000
  );
});
