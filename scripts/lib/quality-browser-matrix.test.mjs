import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseDocument } from "yaml";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../../", import.meta.url));
const workflowPath = ".github/workflows/quality.yml";
const document = parseDocument(readFileSync(path.join(root, workflowPath), "utf8"));
const workflow = document.toJSON();
const { preflight, browser, verify } = workflow.jobs;
const browserStep = browser.steps.find(step => step.name === "Run browser checks");
const matrix = browser.strategy.matrix.include;
const baseline = parseDocument(execFileSync("git", [
  "show", `cfbd444b279c4aa7a5abe44a661cf16815253b5d:${workflowPath}`,
], { cwd: root, encoding: "utf8" })).toJSON();
const bash = process.platform === "win32"
  ? "C:/Program Files/Git/bin/bash.exe"
  : "/bin/bash";

function recordedCommands(lane, fail = false) {
  // Execute the actual workflow shell, replacing only npm with a recorder.
  // No browser, package installation, network or site mutation occurs here.
  const recorder = `npm() { printf 'COMMAND|%s|%s' "$PLAYWRIGHT_SUITE" "$PLAYWRIGHT_HTML_OUTPUT_DIR"; printf '|%s' "$@"; printf '\\n'; return ${fail ? 9 : 0}; }\n`;
  const result = spawnSync(bash, ["--noprofile", "--norc", "-c", recorder + browserStep.run], {
    cwd: root,
    encoding: "utf8",
    timeout: 10_000,
    env: { ...process.env, PLAYWRIGHT_SUITE: lane.suite, PLAYWRIGHT_SHARDS: lane.shards },
  });
  if (result.error) throw result.error;
  return {
    status: result.status,
    commands: result.stdout.split(/\r?\n/u).filter(line => line.startsWith("COMMAND|"))
      .map(line => line.split("|").slice(1)),
  };
}

describe("parallel browser quality contract", () => {
  it("preserves workflow triggers, permissions, concurrency and every prerequisite", () => {
    expect(document.errors).toEqual([]);
    expect(workflow.on).toEqual(baseline.on);
    expect(workflow.permissions).toEqual({ contents: "read" });
    expect(workflow.concurrency).toEqual(baseline.concurrency);
    expect(Object.keys(workflow.jobs)).toEqual(["preflight", "browser", "verify"]);
    const previous = baseline.jobs.verify.steps.filter(step =>
      !step.env?.PLAYWRIGHT_SUITE &&
      step.name !== "Install browser quality tools" &&
      step.name !== "Upload browser diagnostics on failure"
    );
    for (const step of previous) {
      expect(preflight.steps.find(current => current.name === step.name), step.name).toEqual(step);
    }
    expect(preflight.steps).toHaveLength(previous.length + 2);
    const install = preflight.steps.findIndex(step => step.run === "npm ci");
    expect(preflight.steps[install + 1].run).toBe("npm audit --omit=dev --audit-level=high");
    for (const job of Object.values(workflow.jobs)) {
      expect(job["continue-on-error"]).toBeUndefined();
      expect(job.steps.some(step => step["continue-on-error"])).toBe(false);
    }
    expect(preflight.if).toBeUndefined();
    expect(browser.if).toBeUndefined();
    expect(browserStep.if).toBeUndefined();
  });

  it("runs all 22 premium and 6 WebGL shards exactly once with their original flags", () => {
    if (process.platform === "win32") expect(existsSync(bash), "Git Bash is required to verify the Linux runner shell").toBe(true);
    expect(browser.needs).toBe("preflight");
    expect(browser.strategy["fail-fast"]).toBe(false);
    expect(browser.strategy["max-parallel"]).toBe(4);
    expect(matrix).toHaveLength(6);
    expect(new Set(matrix.map(lane => lane.id)).size).toBe(matrix.length);
    expect(browserStep.env).toEqual({
      PLAYWRIGHT_SUITE: "${{ matrix.suite }}",
      PLAYWRIGHT_SHARDS: "${{ matrix.shards }}",
    });
    const all = matrix.flatMap(lane => {
      const result = recordedCommands(lane);
      expect(result.status, lane.id).toBe(0);
      return result.commands;
    });
    for (const [suite, total, prefix, buckets] of [
      ["premium-globe", 22, "premium", 2],
      ["webgl-regression", 6, "webgl", 3],
    ]) {
      expect(matrix.filter(lane => lane.suite === suite)).toHaveLength(buckets);
      const commands = all.filter(command => command[0] === suite);
      expect(commands).toHaveLength(total);
      const shards = commands.map(command => Number(command[5].match(/^--shard=(\d+)\/\d+$/u)?.[1]));
      expect([...shards].sort((a, b) => a - b)).toEqual(Array.from({ length: total }, (_, i) => i + 1));
      for (const [i, command] of commands.entries()) {
        expect(command).toEqual([
          suite, `playwright-report/${prefix}-${shards[i]}`,
          "run", "test:e2e", "--", `--shard=${shards[i]}/${total}`,
          "--workers=1", `--output=test-results/${prefix}-${shards[i]}`,
        ]);
      }
    }
    expect(matrix.find(lane => lane.suite === "premium-globe").shards.split(" ")[0]).toBe("21");
    expect(all.filter(command => command[0] === "regression")).toEqual([
      ["regression", "playwright-report/regression", "run", "test:e2e", "--", "--output=test-results/regression"],
    ]);
    expect(all).toHaveLength(29);
  });

  it("fails the real runner command on a test error, unknown suite or empty shard list", () => {
    expect(recordedCommands(matrix[0], true).status).toBe(9);
    expect(recordedCommands(matrix.find(lane => lane.suite === "regression"), true).status).toBe(9);
    expect(recordedCommands({ suite: "unknown", shards: "1" }).status).not.toBe(0);
    expect(recordedCommands({ suite: "premium-globe", shards: "" }).status).not.toBe(0);
  });

  it("shares the same audited build and generated image inputs with checksum enforcement", () => {
    const pack = preflight.steps.find(step => step.id === "browser_inputs");
    expect(pack.run).toContain("dist src/data/imageDelivery.generated.json reports/public-image-delivery.json");
    expect(pack.run).toContain("sha256sum .tmp/browser-quality-inputs.tar.gz");
    expect(preflight.outputs.browser_inputs_sha256).toBe("${{ steps.browser_inputs.outputs.sha256 }}");
    const upload = preflight.steps.find(step => step.name === "Share the audited browser inputs");
    const download = browser.steps.find(step => step.name === "Download the audited browser inputs");
    expect(upload.with.name).toBe(download.with.name);
    expect(upload.with["if-no-files-found"]).toBe("error");
    const restore = browser.steps.find(step => step.name === "Restore the audited browser inputs");
    expect(restore.env.BROWSER_INPUTS_SHA256).toBe("${{ needs.preflight.outputs.browser_inputs_sha256 }}");
    expect(restore.run).toContain("sha256sum --check --strict");
    expect(restore.run.indexOf("sha256sum --check --strict")).toBeLessThan(restore.run.indexOf("tar -xzf"));
    expect(restore.run).toContain("cp -a dist/cms/. public/cms/");
    expect(restore.run).toContain("cp -a dist/media/optimized/. public/media/optimized/");
    expect(browser.steps.filter(step => step.run?.includes("build:domain"))).toEqual([]);
    expect(browser.steps.find(step => step.name === "Install exact dependencies").run).toBe("npm ci");
    expect(browser.steps.find(step => step.name === "Install browser quality tools").run)
      .toBe("npx playwright install --with-deps chromium");
    const diagnostics = browser.steps.find(step => step.name === "Upload browser diagnostics on failure");
    expect(diagnostics.if).toBe("failure() || cancelled()");
    expect(diagnostics.with.name).toBe("browser-quality-report-${{ matrix.id }}");
    expect(diagnostics.with.path).toBe("playwright-report\ntest-results\n");
    expect(diagnostics.with["retention-days"]).toBe(14);
    expect(readFileSync(path.join(root, "playwright.config.mjs"), "utf8").replaceAll("\r\n", "\n"))
      .toBe(execFileSync("git", ["show", "cfbd444b279c4aa7a5abe44a661cf16815253b5d:playwright.config.mjs"], { cwd: root, encoding: "utf8" }));
  });

  it("retains verify and rejects every failed, cancelled, skipped or missing dependency result", () => {
    expect(verify.if).toBe("${{ always() }}");
    expect(verify.needs).toEqual(["preflight", "browser"]);
    expect(verify.name).toBeUndefined();
    expect(verify.steps).toHaveLength(1);
    const step = verify.steps[0];
    expect(step.if).toBeUndefined();
    expect(step.env).toEqual({ PREFLIGHT_RESULT: "${{ needs.preflight.result }}", BROWSER_RESULT: "${{ needs.browser.result }}" });
    const script = step.run.match(/^node --input-type=module <<'NODE'\n([\s\S]*)\nNODE\n$/u)?.[1];
    expect(script).toBeTruthy();
    for (const preflightResult of ["success", "failure", "cancelled", "skipped", ""]) {
      for (const browserResult of ["success", "failure", "cancelled", "skipped", ""]) {
        const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
          encoding: "utf8", timeout: 5_000,
          env: { ...process.env, PREFLIGHT_RESULT: preflightResult, BROWSER_RESULT: browserResult },
        });
        if (result.error) throw result.error;
        expect(result.status, `${preflightResult}/${browserResult}`)
          .toBe(preflightResult === "success" && browserResult === "success" ? 0 : 1);
      }
    }
  });
});
