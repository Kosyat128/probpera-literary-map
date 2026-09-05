import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/pwa", testMatch: "writer-panel-runtime.spec.mjs", timeout: 20_000,
  workers: 1, fullyParallel: false, retries: 0, forbidOnly: true,
  outputDir: ".tmp/writer-panel-browser-results", reporter: "list",
});
