import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

function configuredSuites() {
  // One isolated process loads Playwright once. Each query imports the actual
  // config afresh after setting the suite, preserving its environment contract.
  const script = `const results={}; for (const suite of ['webgl-regression','regression','premium-globe']) { process.env.PLAYWRIGHT_SUITE=suite; const { default: config } = await import('./playwright.config.mjs?suite='+suite); results[suite]={testMatch:config.testMatch,testIgnore:config.testIgnore,workers:config.workers,projects:config.projects.map(project=>project.name)}; } process.stdout.write(JSON.stringify(results));`;
  return JSON.parse(execFileSync(process.execPath, ["--input-type=module", "-e", script], {
    cwd: process.cwd(), encoding: "utf8", timeout: 15_000, env: { ...process.env, CI: "true" },
  }));
}

describe("browser CI suite ownership", () => {
  it("runs the real Canvas typography matrix exactly once per platform in the serial GPU suite", () => {
    const target = "**/typography-and-card-geometry.spec.mjs";
    const { "webgl-regression": serial, regression: parallel, "premium-globe": premium } = configuredSuites();
    expect(serial.testMatch.filter(pattern => pattern === target)).toHaveLength(1);
    expect(serial.workers).toBe(1);
    expect(serial.projects).toEqual(["desktop-chromium", "mobile-chromium"]);
    expect(parallel.testIgnore.filter(pattern => pattern === target)).toHaveLength(1);
    expect(premium.testMatch).not.toBe(target);
    expect(parallel.projects).toEqual(serial.projects);
  }, 20_000);
});
