import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/host",
  testMatch: "host-lifecycle.spec.mjs",
  timeout: 20_000,
  workers: 1,
  fullyParallel: false,
  retries: 0,
  forbidOnly: true,
  outputDir: ".tmp/host-lifecycle-results",
  reporter: "list",
});
