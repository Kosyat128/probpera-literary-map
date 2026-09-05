import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/pwa", testMatch: "password-recovery.spec.mjs", timeout: 25_000,
  workers: 1, fullyParallel: false, retries: 0, forbidOnly: true,
  outputDir: ".tmp/password-recovery-browser-results", reporter: "list",
});
