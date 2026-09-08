import path from "node:path";
import { defineConfig, devices } from "@playwright/test";
import { crossEngineSettings } from "./tests/pwa/support/cross-engine-server.mjs";

const settings = crossEngineSettings();
if (!process.env.PLAYWRIGHT_BROWSERS_PATH || path.resolve(process.env.PLAYWRIGHT_BROWSERS_PATH) !== settings.browserPath) {
  throw new Error("Set PLAYWRIGHT_BROWSERS_PATH to this checkout's .tmp/browser-engines before starting Playwright");
}
// The unique run binds both specs and the existing signer wrapper. Historical
// default authority/control files and earlier browser output are untouched.
process.env.PWA_QA_CONTROL_PATH = settings.controlPath;
process.env.PWA_QA_ORIGIN = settings.origin;

export default defineConfig({
  testDir: "tests/pwa",
  testMatch: ["controlled-pwa.spec.mjs", "offline-catalog.spec.mjs"],
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  outputDir: path.join(settings.outputPath, "artifacts"),
  reporter: [["list"], ["json", { outputFile: path.join(settings.outputPath, "results.json") }]],
  use: {
    baseURL: settings.origin,
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
    command: "node tests/pwa/support/cross-engine-server.mjs --serve",
    url: settings.origin + "/__pwa_qa__/ready",
    cwd: settings.root,
    timeout: 120_000,
    reuseExistingServer: false,
  },
});
