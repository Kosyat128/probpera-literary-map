import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/host",
  testMatch: "atlas-application-root.spec.mjs",
  timeout: 15_000,
  workers: 1,
  fullyParallel: false,
  retries: 0,
  forbidOnly: true,
  outputDir: ".tmp/atlas-root-results",
  reporter: "list",
});
