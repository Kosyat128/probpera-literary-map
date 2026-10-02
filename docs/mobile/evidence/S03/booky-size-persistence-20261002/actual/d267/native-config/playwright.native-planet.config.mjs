import { defineConfig } from "@playwright/test";

const runId = process.env.NATIVE_PLANET_RUN_ID;
if (runId !== undefined && !/^[a-z0-9][a-z0-9-]{5,63}$/u.test(runId)) throw new Error("Invalid native planet browser run ID");
const output = ".tmp/native-planet-browser-results" + (runId ? "/" + runId : "");

export default defineConfig({
  testDir: "tests/host",
  testMatch: "native-planet.spec.mjs",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  workers: 1,
  fullyParallel: false,
  retries: 0,
  forbidOnly: true,
  outputDir: output + "/artifacts",
  reporter: [["list"], ["json", { outputFile: output + "/results.json" }]],
});
