import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/host",
  testMatch: "native-navigation.spec.mjs",
  timeout: 20_000,
  workers: 1,
  fullyParallel: false,
  retries: 0,
  forbidOnly: true,
  outputDir: ".tmp/native-navigation-results",
  reporter: "list",
});
