import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/pwa",
  // These scenarios run the actual controlled artifact and Service Worker.
  // Account, recovery and lifecycle component fixtures have separate configs.
  testMatch: ["controlled-pwa.spec.mjs", "offline-catalog.spec.mjs"],
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  outputDir: ".tmp/pwa-browser-results",
  reporter: [["list"], ["json", { outputFile: ".tmp/pwa-browser-results/results.json" }]],
  use: {
    baseURL: "http://127.0.0.1:4293",
    channel: "chrome",
    serviceWorkers: "allow",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "pwa-desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "pwa-mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "node tests/pwa/support/local-server.mjs --port 4293 --buildqa",
    url: "http://127.0.0.1:4293/__pwa_qa__/ready",
    timeout: 120_000,
    reuseExistingServer: false,
  },
});
