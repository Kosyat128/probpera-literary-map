import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/pwa", testMatch: "planet-account.spec.mjs", timeout: 25_000,
  workers: 1, fullyParallel: false, retries: 0, forbidOnly: true,
  outputDir: ".tmp/planet-account-browser-results", reporter: "list",
});
