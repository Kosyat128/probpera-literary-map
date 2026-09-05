import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

function configuredSuite(suite) {
  const script = `import config from './playwright.config.mjs'; process.stdout.write(JSON.stringify({ testMatch: config.testMatch, testIgnore: config.testIgnore, workers: config.workers, projects: config.projects.map(project => project.name) }));`;
  return JSON.parse(execFileSync(process.execPath, ["--input-type=module", "-e", script], {
    cwd: process.cwd(), encoding: "utf8", env: { ...process.env, CI: "true", PLAYWRIGHT_SUITE: suite },
  }));
}

describe("browser CI suite ownership", () => {
  it("runs the real Canvas typography matrix exactly once per platform in the serial GPU suite", () => {
    const target = "**/typography-and-card-geometry.spec.mjs";
    const serial = configuredSuite("webgl-regression");
    const parallel = configuredSuite("regression");
    const premium = configuredSuite("premium-globe");
    expect(serial.testMatch.filter(pattern => pattern === target)).toHaveLength(1);
    expect(serial.workers).toBe(1);
    expect(serial.projects).toEqual(["desktop-chromium", "mobile-chromium"]);
    expect(parallel.testIgnore.filter(pattern => pattern === target)).toHaveLength(1);
    expect(premium.testMatch).not.toBe(target);
    expect(parallel.projects).toEqual(serial.projects);
  });
});
