import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const root = "C:/Users/User/Documents/ChatGPT/Работа по сайту/literary-planet-v12-work";
const require = createRequire(pathToFileURL(root + "/package.json"));
const { defineConfig } = require("@playwright/test");
assert.equal(process.env.S03_BROWSER_CHANNEL, "msedge");
assert.match(process.env.PWA_QA_ORIGIN ?? "", /^http:\/\/127\.0\.0\.1:\d{1,5}$/u);
assert.ok(process.env.S03_PWA_OUTPUT && process.env.S03_PWA_REPORT);

export default defineConfig({
  testDir: root + "/tests/pwa",
  testMatch: ["offline-catalog.spec.mjs"],
  grep: /offline PWA cross-language author search and book return retain the globe and integrated archive card$/u,
  timeout: 180000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: true,
  outputDir: process.env.S03_PWA_OUTPUT,
  reporter: [["json", { outputFile: process.env.S03_PWA_REPORT }]],
  projects: [{ name: "s03-premium-msedge-390", use: {
    baseURL: process.env.PWA_QA_ORIGIN, channel: "msedge", viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1, hasTouch: true, serviceWorkers: "allow", reducedMotion: "reduce",
    screenshot: "only-on-failure", trace: "off", video: "off",
  } }],
});
