import path from "node:path";
import { defineConfig } from "@playwright/test";
import { crossEngineSettings } from "./tests/pwa/support/cross-engine-server.mjs";

const settings = crossEngineSettings();
if (!process.env.PLAYWRIGHT_BROWSERS_PATH || path.resolve(process.env.PLAYWRIGHT_BROWSERS_PATH) !== settings.browserPath) {
  throw new Error("Set PLAYWRIGHT_BROWSERS_PATH to this checkout's .tmp/browser-engines before starting Playwright");
}
export default defineConfig({
  testDir: "tests/pwa", testMatch: "cross-engine-pwa.spec.mjs",
  timeout: 120_000, expect: { timeout: 15_000 }, fullyParallel: false, workers: 1, retries: 0, forbidOnly: true,
  outputDir: path.join(settings.outputPath, "artifacts"),
  reporter: [["list"], ["json", { outputFile: path.join(settings.outputPath, "results.json") }]],
  use: { baseURL: settings.origin, viewport: { width: 1280, height: 800 }, serviceWorkers: "allow", trace: "retain-on-failure", screenshot: "only-on-failure" },
  // Native desktop defaults; no Safari or physical-mobile UA/device emulation.
  projects: [
    { name: "chrome-desktop", use: { browserName: "chromium", channel: "chrome" } },
    { name: "firefox-playwright-desktop", use: { browserName: "firefox" } },
    { name: "webkit-playwright-desktop", use: { browserName: "webkit" } },
  ],
  webServer: {
    command: "node tests/pwa/support/cross-engine-server.mjs --serve", url: settings.origin + "/__pwa_qa__/ready",
    cwd: settings.root, timeout: 120_000, reuseExistingServer: false,
  },
});
