import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/pwa",
  testMatch: "pwa-edition-lifecycle.spec.mjs",
  timeout: 20_000,
  workers: 1,
  fullyParallel: false,
  retries: 0,
  forbidOnly: true,
  outputDir: ".tmp/pwa-lifecycle-results",
  reporter: "list",
});
