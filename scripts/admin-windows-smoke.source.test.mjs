import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const root = path.resolve(process.cwd());
const workflowSource = readFileSync(
  path.join(root, ".github", "workflows", "admin-windows-smoke.yml"),
  "utf8"
);
const workflow = parse(workflowSource);
const adminPackage = JSON.parse(
  readFileSync(path.join(root, "apps", "admin", "package.json"), "utf8")
);
const prepareStandalone = readFileSync(
  path.join(root, "apps", "admin", "scripts", "prepare-standalone.mjs"),
  "utf8"
);
const startAdmin = readFileSync(
  path.join(root, "apps", "admin", "scripts", "start-admin.mjs"),
  "utf8"
);

function step(name) {
  const match = workflow.jobs.smoke.steps.find((candidate) => candidate.name === name);
  expect(match, `missing workflow step: ${name}`).toBeDefined();
  return match;
}

describe("admin Windows standalone smoke workflow", () => {
  it("uses one bounded Windows job without a browser E2E suite", () => {
    expect(workflow.jobs.smoke["runs-on"]).toBe("windows-latest");
    expect(workflow.jobs.smoke["timeout-minutes"]).toBeLessThanOrEqual(25);

    const commands = workflow.jobs.smoke.steps
      .map((candidate) => candidate.run || "")
      .join("\n");
    expect(commands.match(/\bnpm ci\b/gu)).toHaveLength(1);
    expect(commands).not.toContain("test:e2e");
    expect(commands).not.toContain("playwright install");
    expect(commands).not.toContain("npm run lint");
    expect(commands).not.toContain("admin:dev");
    expect(commands).not.toContain("next dev");
  });

  it("type-checks and builds through the existing admin package scripts", () => {
    expect(step("Type-check admin").run).toBe(
      "npm run typecheck --workspace @probpera/admin"
    );
    expect(adminPackage.scripts.typecheck).toBe(
      "tsc --noEmit && tsc --project tsconfig.cloudflare.json"
    );
    expect(step("Build admin standalone output").run).toBe(
      "npm run admin:build"
    );
  });

  it("prepares and starts the production entrypoint before an HTTP probe", () => {
    const build = step("Build admin standalone output");
    const smoke = step("Prepare, start and probe standalone admin");
    expect(build.env.ADMIN_BASE_PATH).toBe("/");
    expect(smoke.env.ADMIN_BASE_PATH).toBe("/");
    expect(smoke.shell).toBe("pwsh");
    expect(smoke.run).toContain('Join-Path $env:GITHUB_WORKSPACE "apps\\admin"');
    expect(smoke.run).toContain('& node "scripts\\prepare-standalone.mjs"');
    expect(smoke.run).toContain('-ArgumentList "scripts\\start-admin.mjs"');
    expect(smoke.run).toContain("-WindowStyle Hidden");
    expect(smoke.run).toContain("@supabase\\supabase-js\\package.json");
    expect(smoke.run).toContain(
      'Invoke-WebRequest -Uri $healthUrl -TimeoutSec 5 -UseBasicParsing'
    );
    expect(smoke.run).toContain(
      '$healthUrl = "http://127.0.0.1:3210/login"'
    );
    expect(smoke.run).not.toContain("/admin/login");
    expect(smoke.run).toContain(
      'Admin standalone health check passed: $healthUrl'
    );
  });

  it("keeps the Windows-safe standalone runtime safeguards under test", () => {
    expect(prepareStandalone).toContain('"@supabase/supabase-js"');
    expect(prepareStandalone).toContain(
      '"@supabase/supabase-js/package.json"'
    );
    expect(prepareStandalone).toContain("path.join(standaloneRoot, \"node_modules\")");
    expect(startAdmin).toContain("spawn(command, args");
    expect(startAdmin).toContain("await run(process.execPath, [serverEntrypoint]");
    expect(startAdmin).toContain("path.delimiter");
  });
});
